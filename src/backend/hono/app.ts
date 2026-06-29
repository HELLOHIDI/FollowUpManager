import { Hono } from "hono";
import { errorBoundary } from "@/backend/middleware/error";
import { withAppContext } from "@/backend/middleware/context";
import { withAuthenticatedUser } from "@/backend/middleware/auth";
import type { AppEnv } from "@/backend/hono/context";
import { getCurrentUser } from "@/backend/hono/context";
import type { AuthenticatedClientFactory } from "@/backend/supabase/authenticated-client";
import {
  createCompanyMutationClient,
  type CompanyMutationClientFactory,
} from "@/features/company/backend/mutation-client";
import { registerCompanyRoutes } from "@/features/company/backend/route";
import {
  createProjectMutationClient,
  type ProjectMutationClientFactory,
} from "@/features/projects/backend/mutation-client";
import { registerProjectRoutes } from "@/features/projects/backend/route";
import { registerDashboardRoutes } from "@/features/dashboard/backend/route";
import {
  createExpenseMutationClient,
  type ExpenseMutationClientFactory,
} from "@/features/expenses/backend/mutation-client";
import { registerExpenseRoutes } from "@/features/expenses/backend/route";
import { registerProjectExportRoutes } from "@/features/project-export/backend/route";

type CreateHonoAppOptions = {
  createAuthenticatedClient?: AuthenticatedClientFactory;
  createCompanyMutationClient?: CompanyMutationClientFactory;
  createProjectMutationClient?: ProjectMutationClientFactory;
  createExpenseMutationClient?: ExpenseMutationClientFactory;
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
      options.createCompanyMutationClient ?? createCompanyMutationClient,
  });
  registerProjectRoutes(app, {
    createProjectMutationClient:
      options.createProjectMutationClient ?? createProjectMutationClient,
  });
  registerDashboardRoutes(app);
  registerExpenseRoutes(app, {
    createExpenseMutationClient:
      options.createExpenseMutationClient ?? createExpenseMutationClient,
  });
  registerProjectExportRoutes(app);

  return app;
};
