import { createMiddleware } from "hono/factory";
import {
  contextKeys,
  type AppEnv,
  type AppLogger,
} from "@/backend/hono/context";

const logger: AppLogger = {
  info: (...args) => console.info(...args),
  error: (...args) => console.error(...args),
  warn: (...args) => console.warn(...args),
  debug: (...args) => console.debug(...args),
};

export const withAppContext = () =>
  createMiddleware<AppEnv>(async (context, next) => {
    const requestId = context.req.header("x-request-id") ?? crypto.randomUUID();

    context.set(contextKeys.logger, logger);
    context.set(contextKeys.requestId, requestId);
    context.header("x-request-id", requestId);

    await next();
  });
