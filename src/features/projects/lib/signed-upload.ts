export const uploadSignedFile = async ({ canonicalMimeType, fetcher = fetch, file, milliseconds = 120_000, signedUrl }: {
  canonicalMimeType: string; fetcher?: typeof fetch; file: File; milliseconds?: number; signedUrl: string;
}) => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), milliseconds);
  const body = new FormData();
  body.append("cacheControl", "3600");
  body.append("", file.type === canonicalMimeType ? file : new File([file], file.name, { type: canonicalMimeType }));
  try {
    const response = await fetcher(signedUrl, { body, headers: { "x-upsert": "false" }, method: "PUT", signal: controller.signal });
    if (!response.ok) throw new Error("파일을 업로드하지 못했습니다.");
  } catch (error) {
    if (controller.signal.aborted) throw new Error("파일 업로드 시간이 초과되었습니다.");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
};
