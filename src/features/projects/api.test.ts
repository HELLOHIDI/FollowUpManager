import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadSignedFile } from "./lib/signed-upload";

describe("uploadSignedFile", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("aborts the underlying request when the upload times out", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>((_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    const upload = uploadSignedFile({
      canonicalMimeType: "text/csv",
      fetcher,
      file: new File(["a,b"], "test.csv", { type: "text/csv" }),
      milliseconds: 10,
      signedUrl: "http://localhost/storage/upload",
    });
    const rejection = expect(upload).rejects.toThrow("파일 업로드 시간이 초과되었습니다.");

    await vi.advanceTimersByTimeAsync(10);

    await rejection;
    expect(fetcher.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });
});
