import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAppConfig } from "@/backend/config";
import { createServiceClient } from "@/backend/supabase/client";
import type { Database } from "@/lib/supabase/types";

export type ProjectMutationClientFactory = () => SupabaseClient<Database>;
export const createProjectMutationClient: ProjectMutationClientFactory = () => createServiceClient(getAppConfig().supabase);
