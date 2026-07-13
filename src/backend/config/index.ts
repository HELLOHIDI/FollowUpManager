import { z } from 'zod';

export type AppConfig = {
  supabase: {
    url: string;
    serviceRoleKey: string;
  };
};

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

let cachedConfig: AppConfig | null = null;

export const getAppConfig = (): AppConfig => {
  if (cachedConfig) {
    return cachedConfig;
  }

  const parsed = envSchema.safeParse({
    SUPABASE_URL:
      process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!parsed.success) {
    const messages = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'config'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid backend configuration: ${messages}`);
  }

  cachedConfig = {
    supabase: {
      url: parsed.data.SUPABASE_URL,
      serviceRoleKey: parsed.data.SUPABASE_SERVICE_ROLE_KEY,
    },
  } satisfies AppConfig;

  return cachedConfig;
};

const discordBriefingEnvSchema = z.object({
  APP_URL: z.string().url(),
  CRON_SECRET: z.string().min(1),
  DISCORD_BOT_TOKEN: z.string().min(1),
});

export const getDiscordBriefingConfig = () => {
  const parsed = discordBriefingEnvSchema.safeParse({
    APP_URL: process.env.APP_URL,
    CRON_SECRET: process.env.CRON_SECRET,
    DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
  });

  if (!parsed.success) {
    throw new Error("Discord weekly briefing configuration is invalid.");
  }

  return {
    appUrl: parsed.data.APP_URL.replace(/\/$/, ""),
    botToken: parsed.data.DISCORD_BOT_TOKEN,
    cronSecret: parsed.data.CRON_SECRET,
  };
};
