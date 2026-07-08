const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const normalize = (value) => {
  const trimmed = (value ?? "").trim();

  return trimmed === "\"\"" || trimmed === "''" ? "" : trimmed;
};

const fail = (message) => {
  console.error(`Auth env check failed: ${message}`);
  process.exit(1);
};

const assertUrl = (name, value) => {
  try {
    return new URL(value);
  } catch {
    fail(`${name} must be a valid URL.`);
  }
};

if (process.argv.includes("--self-test")) {
  console.assert(normalize("\"\"") === "", "quoted empty string is empty");
  console.assert(normalize(" https://example.supabase.co ") === "https://example.supabase.co", "trims URL");
  console.log("Auth env self-test passed.");
  process.exit(0);
}

const values = Object.fromEntries(
  required.map((name) => [name, normalize(process.env[name])])
);

for (const name of required) {
  if (!values[name]) {
    fail(`${name} is required.`);
  }
}

const publicUrl = assertUrl("NEXT_PUBLIC_SUPABASE_URL", values.NEXT_PUBLIC_SUPABASE_URL);
const serverUrl = assertUrl("SUPABASE_URL", values.SUPABASE_URL);

if (process.env.VERCEL_ENV === "production") {
  for (const [name, url] of [
    ["NEXT_PUBLIC_SUPABASE_URL", publicUrl],
    ["SUPABASE_URL", serverUrl],
  ]) {
    if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co")) {
      fail(`${name} must point to the production Supabase URL.`);
    }
  }
}

console.log("Auth env check passed.");
