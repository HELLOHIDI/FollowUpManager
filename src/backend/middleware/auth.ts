import { createMiddleware } from "hono/factory";
import { failure, respond } from "@/backend/http/response";
import {
  contextKeys,
  type AppContext,
  type AppEnv,
  type AppLogger,
} from "@/backend/hono/context";
import {
  createAuthenticatedClient,
  type AuthenticatedClientFactory,
} from "@/backend/supabase/authenticated-client";

export const parseBearerToken = (authorization: string | undefined) => {
  const match = authorization?.match(/^Bearer ([^\s]+)$/i);
  return match?.[1] ?? null;
};

const unauthorized = (context: AppContext) =>
  respond(
    context,
    failure(401, "UNAUTHORIZED", "A valid access token is required.")
  );

export const withAuthenticatedUser = (
  createClient: AuthenticatedClientFactory = createAuthenticatedClient
) =>
  createMiddleware<AppEnv>(async (context, next) => {
    const accessToken = parseBearerToken(context.req.header("Authorization"));

    if (!accessToken) {
      return unauthorized(context);
    }

    const supabase = createClient(accessToken);
    const { data, error } = await supabase.auth.getUser(accessToken);

    if (error || !data.user) {
      const logger = context.get(contextKeys.logger) as AppLogger;
      logger.warn("API authentication rejected", {
        path: context.req.path,
        requestId: context.get(contextKeys.requestId),
      });
      return unauthorized(context);
    }

    context.set(contextKeys.currentUser, data.user);
    context.set(contextKeys.supabase, supabase);

    await next();
  });
