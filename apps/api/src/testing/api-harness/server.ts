import { createLogger, serializeError } from "@journey/logger";
import { serve } from "@hono/node-server";
import type { ServerType } from "@hono/node-server";
import { createApp } from "../../app";
import { logConsumer } from "../../event-bus/consumers/log-consumer";
import { initEventBus, registerEventConsumer, shutdownEventBus } from "../../event-bus/event-bus";
import { closeRedisConnection } from "../../lib/redis";
import { initWorkflowExecutors } from "../../modules/workflows/init";
import { handleTimerFired, initTimerService, shutdownTimerService } from "../../services/timers";
import type { ApiHarnessInstance, ApiHarnessOptions } from "./types";

const log = createLogger("api-harness");

export function createApiHarness(options: ApiHarnessOptions = {}): ApiHarnessInstance {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 0;
  const app = createApp();

  let server: ServerType | undefined;
  let baseUrl = "";
  let servicesInitialized = false;

  return {
    async start() {
      if (server) {
        return { url: baseUrl, port: Number(new URL(baseUrl).port) };
      }

      if (!servicesInitialized) {
        try {
          registerEventConsumer(logConsumer);
          initEventBus();
          log.info({}, "apiHarness:eventBus:initialized");
        } catch (error) {
          log.warn({ err: serializeError(error) }, "apiHarness:eventBus:initFailed");
        }

        try {
          const { registerBuiltinTools } = await import("@journey/llm/tools");
          await registerBuiltinTools();
          log.info({}, "apiHarness:tools:registered");
        } catch (error) {
          log.warn({ err: serializeError(error) }, "apiHarness:tools:registerFailed");
        }

        try {
          initWorkflowExecutors();
          log.info({}, "apiHarness:workflowExecutors:registered");
        } catch (error) {
          log.warn({ err: serializeError(error) }, "apiHarness:workflowExecutors:registerFailed");
        }

        try {
          await initTimerService(handleTimerFired);
          log.info({}, "apiHarness:timerService:initialized");
        } catch (error) {
          log.warn({ err: serializeError(error) }, "apiHarness:timerService:initFailed");
        }

        servicesInitialized = true;
      }

      await new Promise<void>((resolve) => {
        server = serve(
          { fetch: app.fetch, port, hostname: host },
          (info) => {
            baseUrl = `http://${host}:${info.port}`;
            log.info({ url: baseUrl }, "apiHarness:started");
            resolve();
          }
        );
      });

      return { url: baseUrl, port: Number(new URL(baseUrl).port) };
    },
    async stop() {
      if (!server) return;
      try {
        await new Promise<void>((resolve, reject) => {
          server?.close((err) => {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        });
        log.info({ url: baseUrl }, "apiHarness:stopped");
      } catch (error) {
        log.warn({ err: serializeError(error) }, "apiHarness:stopFailed");
      } finally {
        server = undefined;
      }

      if (servicesInitialized) {
        try {
          await shutdownTimerService();
          log.info({}, "apiHarness:timerService:stopped");
        } catch (error) {
          log.warn({ err: serializeError(error) }, "apiHarness:timerService:stopFailed");
        }

        try {
          shutdownEventBus();
          log.info({}, "apiHarness:eventBus:stopped");
        } catch (error) {
          log.warn({ err: serializeError(error) }, "apiHarness:eventBus:stopFailed");
        }

        try {
          await closeRedisConnection();
          log.info({}, "apiHarness:redis:closed");
        } catch (error) {
          log.warn({ err: serializeError(error) }, "apiHarness:redis:closeFailed");
        }

        servicesInitialized = false;
      }
    },
  };
}
