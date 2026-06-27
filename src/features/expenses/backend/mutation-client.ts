import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAppConfig } from "@/backend/config";
import { createServiceClient } from "@/backend/supabase/client";
import type { Database } from "@/lib/supabase/types";

export type ExpenseMutationClientFactory = () => SupabaseClient<Database>;

export const createExpenseMutationClient: ExpenseMutationClientFactory = () =>
  createServiceClient(getAppConfig().supabase);
