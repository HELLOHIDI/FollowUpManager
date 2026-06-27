import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Context } from "hono";

export type AppLogger = Pick<Console, "info" | "error" | "warn" | "debug">;

export type AppVariables = {
  currentUser: User;
  logger: AppLogger;
  requestId: string;
  supabase: SupabaseClient;
};

export type AppEnv = {
  Variables: AppVariables;
};

export type AppContext = Context<AppEnv>;

export const contextKeys = {
  currentUser: "currentUser",
  logger: "logger",
  requestId: "requestId",
  supabase: "supabase",
} as const satisfies Record<keyof AppVariables, keyof AppVariables>;

export const getCurrentUser = (context: AppContext) =>
  context.get(contextKeys.currentUser);

export const getLogger = (context: AppContext) =>
  context.get(contextKeys.logger);

export const getRequestId = (context: AppContext) =>
  context.get(contextKeys.requestId);

export const getSupabase = (context: AppContext) =>
  context.get(contextKeys.supabase);
