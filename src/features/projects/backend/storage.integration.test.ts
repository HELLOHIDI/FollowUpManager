import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const runnable = Boolean(url && serviceKey && anonKey && /127\.0\.0\.1:54321|localhost:54321/.test(url!));
const requested = process.env.RUN_PROJECT_STORAGE_INTEGRATION === "1";
if (requested && !runnable) throw new Error("Project Storage integration requires local Supabase on port 54321 and all local keys.");
const path = `capability/${crypto.randomUUID()}/round-trip.txt`;

describe.runIf(requested)("private signed storage capability", () => {
  let service: ReturnType<typeof createClient>;

  afterAll(async () => { if (service) await service.storage.from("project-documents").remove([path]); });

  it("uploads with a bounded token, denies public read, signs read, and deletes", async () => {
    service = createClient(url!, serviceKey!, { auth: { persistSession: false, storageKey: "project-capability-service" } });
    const browser = createClient(url!, anonKey!, { auth: { persistSession: false, storageKey: "project-capability-browser" } });
    const intent = await service.storage.from("project-documents").createSignedUploadUrl(path);
    expect(intent.error).toBeNull();
    const upload = await browser.storage.from("project-documents").uploadToSignedUrl(path, intent.data!.token, new Blob(["capability"]), { contentType: "text/csv" });
    expect(upload.error).toBeNull();
    const unsigned = await fetch(`${url}/storage/v1/object/public/project-documents/${path}`);
    expect(unsigned.ok).toBe(false);
    const signed = await service.storage.from("project-documents").createSignedUrl(path, 30);
    expect(signed.error).toBeNull();
    expect((await fetch(signed.data!.signedUrl)).ok).toBe(true);
    expect((await service.storage.from("project-documents").remove([path])).error).toBeNull();
  });
});
