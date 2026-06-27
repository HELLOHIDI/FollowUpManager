import { createMiddleware } from "hono/factory";
import {
  contextKeys,
  type AppEnv,
  type AppLogger,
} from "@/backend/hono/context";

export const errorBoundary = () =>
  createMiddleware<AppEnv>(async (context, next) => {
    try {
      await next();
    } catch (error) {
      const logger = context.get(contextKeys.logger) as AppLogger | undefined;
      const requestId = context.get(contextKeys.requestId) as string | undefined;

      logger?.error("Unhandled API request error", {
        errorName: error instanceof Error ? error.name : "UnknownError",
        path: context.req.path,
        requestId,
      });

      return context.json(
        {
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "An unexpected error occurred.",
          },
        },
        500
      );
    }
  });
