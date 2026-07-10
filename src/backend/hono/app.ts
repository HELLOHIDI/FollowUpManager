import { Hono } from "hono";
import { errorBoundary } from "@/backend/middleware/error";
import { withAppContext } from "@/backend/middleware/context";
import { withAuthenticatedUser } from "@/backend/middleware/auth";
import type { AppEnv } from "@/backend/hono/context";
import { getCurrentUser } from "@/backend/hono/context";
import type { AuthenticatedClientFactory } from "@/backend/supabase/authenticated-client";
import {
  createMutationClient,
  type MutationClientFactory,
} from "@/backend/supabase/client";
import { registerCompanyRoutes } from "@/features/company/backend/route";
import { registerProjectRoutes } from "@/features/projects/backend/route";
import { registerDashboardRoutes } from "@/features/dashboard/backend/route";
import { registerExpenseRoutes } from "@/features/expenses/backend/route";
import { registerProjectExportRoutes } from "@/features/project-export/backend/route";
import { registerProgramEvidencePolicyRoutes } from "@/features/program-evidence-policy/backend/route";
import { registerDiscordBriefingRoutes } from "@/features/discord-briefing/backend/route";

type CreateHonoAppOptions = {
  createAuthenticatedClient?: AuthenticatedClientFactory;
  createCompanyMutationClient?: MutationClientFactory;
  createProjectMutationClient?: MutationClientFactory;
  createExpenseMutationClient?: MutationClientFactory;
};

export const createHonoApp = (options: CreateHonoAppOptions = {}) => {
  const app = new Hono<AppEnv>().basePath("/api");
  const authMiddleware = withAuthenticatedUser(
    options.createAuthenticatedClient
  );

  app.use("*", errorBoundary());
  app.use("*", withAppContext());
  app.use("/auth/*", authMiddleware);
  app.use("/companies", authMiddleware);
  app.use("/companies/*", authMiddleware);
  app.use("/projects", authMiddleware);
  app.use("/projects/*", authMiddleware);
  app.use("/discord/channels", authMiddleware);
  app.use("/discord/channels/*", authMiddleware);
  app.use("/discord/deliveries", authMiddleware);
  app.use("/discord/test", authMiddleware);

  app.get("/auth/me", (context) => {
    const user = getCurrentUser(context);

    return context.json({
      user: {
        id: user.id,
        email: user.email ?? null,
      },
    });
  });

  registerCompanyRoutes(app, {
    createCompanyMutationClient:
      options.createCompanyMutationClient ?? createMutationClient,
  });
  registerProjectRoutes(app, {
    createProjectMutationClient:
      options.createProjectMutationClient ?? createMutationClient,
  });
  registerDashboardRoutes(app);
  registerExpenseRoutes(app, {
    createExpenseMutationClient:
      options.createExpenseMutationClient ?? createMutationClient,
  });
  registerProgramEvidencePolicyRoutes(app);
  registerProjectExportRoutes(app);
  registerDiscordBriefingRoutes(app);

  return app;
};
