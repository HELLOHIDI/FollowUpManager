export const DEFAULT_UPLOAD_MIME_TYPES = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  hwp: "application/octet-stream",
  hwpx: "application/octet-stream",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  zip: "application/zip",
} as const;

export type UploadExtension = keyof typeof DEFAULT_UPLOAD_MIME_TYPES;

export const DEFAULT_UPLOAD_MIME_ALIASES = {
  hwp: ["application/x-hwp", "application/haansofthwp"],
  hwpx: ["application/zip"],
  docx: ["application/zip"],
  xlsx: ["application/zip"],
  csv: ["text/plain", "application/vnd.ms-excel"],
  zip: ["application/x-zip-compressed"],
} satisfies Partial<Record<UploadExtension, readonly string[]>>;

export const DEFAULT_BLOCKED_UPLOAD_EXTENSIONS = new Set([
  "exe",
  "bat",
  "cmd",
  "sh",
  "js",
  "msi",
  "dmg",
  "apk",
  "app",
  "scr",
  "vbs",
  "jar",
]);

export type UploadMetadata = {
  canonicalMimeType: string;
  extension: UploadExtension;
};

type UploadMetadataInput = {
  blockedExtensions?: ReadonlySet<string>;
  browserMimeType: string | null;
  originalFileName: string;
};

export const getUploadMetadata = ({
  blockedExtensions,
  browserMimeType,
  originalFileName,
}: UploadMetadataInput): UploadMetadata | null => {
  const extension = originalFileName
    .split(".")
    .pop()
    ?.toLowerCase() as UploadExtension | undefined;

  if (
    !extension ||
    blockedExtensions?.has(extension) ||
    !(extension in DEFAULT_UPLOAD_MIME_TYPES)
  ) {
    return null;
  }

  const canonical = DEFAULT_UPLOAD_MIME_TYPES[extension];
  const browserMime = browserMimeType?.trim().toLowerCase() || null;
  const accepted =
    !browserMime ||
    browserMime === "application/octet-stream" ||
    browserMime === canonical ||
    DEFAULT_UPLOAD_MIME_ALIASES[extension]?.includes(browserMime);

  return accepted ? { canonicalMimeType: canonical, extension } : null;
};
