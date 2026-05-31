export interface TelegramSandboxOptions {
  port?: number;
  host?: string;
  strict?: boolean;
}

export interface OutboundRequest {
  token: string;
  method: string;
  path: string;
  body: Record<string, unknown>;
  headers: Record<string, string>;
  timestamp: string;
}

export interface TelegramSandboxState {
  webhookUrl?: string;
  outbound: OutboundRequest[];
  inbound: unknown[];
  nextMessageId: number;
}

export interface TelegramSandboxSendOptions {
  headers?: Record<string, string>;
}

export interface TelegramSandbox {
  start(): Promise<{ url: string; port: number }>;
  stop(): Promise<void>;
  reset(): void;
  getWebhookUrl(): string | undefined;
  getOutboundRequests(): OutboundRequest[];
  getInboundUpdates(): unknown[];
  sendUpdate(update: unknown, options?: TelegramSandboxSendOptions): Promise<void>;
}
