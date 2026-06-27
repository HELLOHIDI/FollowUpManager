import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/supabase/types";

export type AuthenticatedClientFactory = (
  accessToken: string
) => SupabaseClient<Database>;

const authClientConfigSchema = z.object({
  anonKey: z.string().min(1),
  url: z.string().url(),
});

const getAuthClientConfig = () =>
  authClientConfigSchema.parse({
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });

export const createAuthenticatedClient: AuthenticatedClientFactory = (
  accessToken
) => {
  const config = getAuthClientConfig();

  return createClient<Database>(
    config.url,
    config.anonKey,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  );
};
