import { createLogger, serializeError } from "@journey/logger";
import { Hono } from "hono";
import type { Context } from "hono";
import { serve } from "@hono/node-server";
import type { ServerType } from "@hono/node-server";
import type {
  TelegramSandbox,
  TelegramSandboxOptions,
  TelegramSandboxState,
  TelegramSandboxSendOptions,
  OutboundRequest,
} from "./types";

const log = createLogger("telegram-sandbox");

const TELEGRAM_LIMITS = {
  textMax: 4096,
  captionMax: 1024,
  keyboardRowsMax: 100,
  keyboardColsMax: 8,
  buttonTextMax: 64,
  callbackDataMax: 64,
};

function normalizeBodyValue(value: unknown): unknown {
  if (value && typeof value === "object") {
    const candidate = value as { name?: string; size?: number; type?: string };
    if (typeof candidate.name === "string" && typeof candidate.size === "number") {
      return {
        filename: candidate.name,
        size: candidate.size,
        type: candidate.type,
      };
    }
  }
  if (Array.isArray(value)) {
    return value.map(normalizeBodyValue);
  }
  return value;
}

function normalizeBody(body: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    normalized[key] = normalizeBodyValue(value);
  }
  return normalized;
}

function parseTelegramPath(path: string): { token: string; method: string } | null {
  const directMatch = path.match(/^\/bot([^/]+)\/([^/]+)$/);
  if (directMatch) {
    return { token: directMatch[1], method: directMatch[2] };
  }

  const splitMatch = path.match(/^\/bot\/([^/]+)\/([^/]+)$/);
  if (splitMatch) {
    return { token: splitMatch[1], method: splitMatch[2] };
  }

  return null;
}

function validateKeyboard(body: Record<string, unknown>): string | null {
  const replyMarkup = body.reply_markup;
  if (!replyMarkup || typeof replyMarkup !== "object") {
    return null;
  }

  const keyboard = (replyMarkup as { inline_keyboard?: unknown }).inline_keyboard;
  if (!Array.isArray(keyboard)) {
    return null;
  }

  if (keyboard.length > TELEGRAM_LIMITS.keyboardRowsMax) {
    return `Inline keyboard exceeds ${TELEGRAM_LIMITS.keyboardRowsMax} rows`;
  }

  let buttonCount = 0;
  for (const row of keyboard) {
    if (!Array.isArray(row)) {
      return "Inline keyboard rows must be arrays";
    }
    if (row.length > TELEGRAM_LIMITS.keyboardColsMax) {
      return `Inline keyboard row exceeds ${TELEGRAM_LIMITS.keyboardColsMax} buttons`;
    }
    for (const button of row) {
      if (typeof button !== "object" || button === null) {
        return "Inline keyboard button must be an object";
      }
      const { text, callback_data } = button as { text?: string; callback_data?: string };
      if (text && text.length > TELEGRAM_LIMITS.buttonTextMax) {
        return `Button text exceeds ${TELEGRAM_LIMITS.buttonTextMax} chars`;
      }
      if (callback_data && callback_data.length > TELEGRAM_LIMITS.callbackDataMax) {
        return `Callback data exceeds ${TELEGRAM_LIMITS.callbackDataMax} chars`;
      }
      buttonCount++;
    }
  }

  if (buttonCount > TELEGRAM_LIMITS.keyboardRowsMax * TELEGRAM_LIMITS.keyboardColsMax) {
    return "Inline keyboard exceeds maximum button count";
  }

  return null;
}

function validateSendMessage(body: Record<string, unknown>): string | null {
  const text = typeof body.text === "string" ? body.text : "";
  if (!body.chat_id) {
    return "Missing chat_id";
  }
  if (text.length === 0) {
    return "Missing text";
  }
  if (text.length > TELEGRAM_LIMITS.textMax) {
    return `Text exceeds ${TELEGRAM_LIMITS.textMax} chars`;
  }
  return validateKeyboard(body);
}

function validateCaption(body: Record<string, unknown>): string | null {
  const caption = typeof body.caption === "string" ? body.caption : "";
  if (caption.length > TELEGRAM_LIMITS.captionMax) {
    return `Caption exceeds ${TELEGRAM_LIMITS.captionMax} chars`;
  }
  return validateKeyboard(body);
}

function validateCallback(body: Record<string, unknown>): string | null {
  if (!body.callback_query_id) {
    return "Missing callback_query_id";
  }
  return null;
}

function buildMessageResult(state: TelegramSandboxState, body: Record<string, unknown>): Record<string, unknown> {
  const chatId = typeof body.chat_id === "string" ? body.chat_id : String(body.chat_id ?? "");
  const message = {
    message_id: state.nextMessageId++,
    chat: { id: Number.isNaN(Number(chatId)) ? chatId : Number(chatId), type: "private" },
    date: Math.floor(Date.now() / 1000),
    text: typeof body.text === "string" ? body.text : undefined,
    caption: typeof body.caption === "string" ? body.caption : undefined,
  };

  return message;
}

export function createTelegramSandbox(options: TelegramSandboxOptions = {}): TelegramSandbox {
  const app = new Hono();
  const state: TelegramSandboxState = {
    webhookUrl: undefined,
    outbound: [],
    inbound: [],
    nextMessageId: 1,
  };
  const strict = options.strict ?? false;
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 0;
  let server: ServerType | undefined;
  let baseUrl = "";

  function recordOutbound(token: string, method: string, path: string, body: Record<string, unknown>, headers: Headers): void {
    const headerMap: Record<string, string> = {};
    headers.forEach((value, key) => {
      headerMap[key] = value;
    });

    const entry: OutboundRequest = {
      token,
      method,
      path,
      body: normalizeBody(body),
      headers: headerMap,
      timestamp: new Date().toISOString(),
    };
    state.outbound.push(entry);
  }

  async function parseRequestBody(c: Context): Promise<Record<string, unknown>> {
    const contentType = c.req.header("content-type") || "";
    if (contentType.includes("application/json")) {
      return (await c.req.json()) as Record<string, unknown>;
    }
    const parsed = await c.req.parseBody();
    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed)) {
      body[key] = value;
    }
    return body;
  }

  app.post("*", async (c) => {
    const parsed = parseTelegramPath(c.req.path);
    if (!parsed) {
      return c.json({ ok: false, description: "Unknown endpoint" }, 404);
    }

    const { token, method } = parsed;
    const body = await parseRequestBody(c);
    recordOutbound(token, method, c.req.path, body, c.req.raw.headers);

    const validationError =
      method === "sendMessage"
        ? validateSendMessage(body)
        : method === "sendPhoto" || method === "sendVideo"
          ? validateCaption(body)
          : method === "answerCallbackQuery"
            ? validateCallback(body)
            : null;

    if (strict && validationError) {
      return c.json({ ok: false, description: validationError }, 400);
    }

    if (method === "sendMessage" || method === "sendPhoto" || method === "sendVideo") {
      const message = buildMessageResult(state, body);
      return c.json({ ok: true, result: message });
    }

    if (method === "answerCallbackQuery") {
      return c.json({ ok: true, result: true });
    }

    if (method === "setWebhook") {
      state.webhookUrl = typeof body.url === "string" ? body.url : undefined;
      return c.json({ ok: true, result: true });
    }

    if (method === "deleteWebhook") {
      state.webhookUrl = undefined;
      return c.json({ ok: true, result: true });
    }

    return c.json({ ok: false, description: "Unsupported method" }, 404);
  });

  return {
    async start() {
      if (server) {
        return { url: baseUrl, port: Number(new URL(baseUrl).port) };
      }

      await new Promise<void>((resolve) => {
        server = serve(
          { fetch: app.fetch, port, hostname: host },
          (info) => {
            baseUrl = `http://${host}:${info.port}`;
            log.info({ url: baseUrl, strict }, "telegramSandbox:started");
            resolve();
          }
        );
      });

      return { url: baseUrl, port: Number(new URL(baseUrl).port) };
    },
    async stop() {
      if (!server) return;
      await new Promise<void>((resolve) => {
        server?.close(() => resolve());
      });
      log.info({ url: baseUrl }, "telegramSandbox:stopped");
      server = undefined;
    },
    reset() {
      state.outbound = [];
      state.inbound = [];
      state.webhookUrl = undefined;
      state.nextMessageId = 1;
    },
    getWebhookUrl() {
      return state.webhookUrl;
    },
    getOutboundRequests() {
      return [...state.outbound];
    },
    getInboundUpdates() {
      return [...state.inbound];
    },
    async sendUpdate(update: unknown, options?: TelegramSandboxSendOptions) {
      if (!state.webhookUrl) {
        throw new Error("Webhook URL not set");
      }
      state.inbound.push(update);
      try {
        const response = await fetch(state.webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(options?.headers ?? {}),
          },
          body: JSON.stringify(update),
        });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Webhook responded with ${response.status}: ${text}`);
        }
      } catch (error) {
        log.error({ err: serializeError(error) }, "telegramSandbox:sendUpdate:error");
        throw error;
      }
    },
  };
}
