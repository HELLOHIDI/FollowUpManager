import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";

const readLocalSupabaseStatus = () => {
  const executable = process.platform === "win32" ? "npm.cmd" : "npm";
  const output = execSync(`${executable} exec supabase -- status -o env`, { encoding: "utf8" });
  const values = new Map(output.split(/\r?\n/).map((line) => {
    const match = line.match(/^([A-Z_]+)="(.*)"$/);
    return match ? [match[1], match[2]] as const : ["", ""] as const;
  }));
  return { serviceRoleKey: values.get("SERVICE_ROLE_KEY"), url: values.get("API_URL") };
};

export const createLocalAdmin = () => {
  const localStatus = process.env.SUPABASE_SERVICE_ROLE_KEY ? null : readLocalSupabaseStatus();
  const rawUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? localStatus?.url;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? localStatus?.serviceRoleKey;
  if (!rawUrl || !serviceRoleKey) throw new Error("Local E2E requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  const url = new URL(rawUrl);
  if (!(["127.0.0.1", "localhost"].includes(url.hostname) && url.port === "54321")) throw new Error(`Refusing E2E admin access outside local Supabase: ${url.origin}`);
  return createClient(rawUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
};

export const createLocalTestUser = async (admin: SupabaseClient, prefix: string) => {
  const email = `${prefix}-${Date.now()}@example.com`;
  const password = `Local-${crypto.randomUUID()}-Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true, password });
  if (error) throw error;
  return { email, password, userId: data.user.id };
};
