import { describe, expect, it } from "vitest";
import { createProject, deleteProject } from "./service";
import type { ProjectInput } from "./schema";

const COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const PROJECT_IDS = [
  "33333333-3333-4333-8333-333333333331",
  "33333333-3333-4333-8333-333333333332",
  "33333333-3333-4333-8333-333333333333",
];

const input: ProjectInput = {
  agreementEndDate: "2026-12-31",
  agreementStartDate: "2026-01-01",
  assignmentName: "Grant",
  assignmentNumber: "TASK-001",
  governmentSubsidyRatio: "70",
  hostInstitution: "Agency",
  managerEmail: "pm@example.com",
  managerName: "PM",
  managerPhone: null,
  projectName: "Project",
  projectNotes: null,
  selfCashRatio: "20",
  selfInKindRatio: "10",
  totalProjectBudget: "1000",
};

const createClient = () => {
  const projects: Record<string, any>[] = [];

  return {
    from(table: string) {
      if (table === "companies") {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                maybeSingle: async () => ({ data: { id: COMPANY_ID }, error: null }),
              }),
            }),
          }),
        };
      }

      return {
        insert: (payload: Record<string, unknown>) => ({
          select: () => ({
            single: async () => {
              const row = {
                ...payload,
                created_at: "2026-01-01T00:00:00.000Z",
                id: PROJECT_IDS[projects.length],
                profile_status: "complete",
                updated_at: "2026-01-01T00:00:00.000Z",
              };
              projects.push(row);
              return { data: row, error: null };
            },
          }),
        }),
        update: (payload: Record<string, unknown>) => ({
          eq: (_column: string, projectId: string) => ({
            is: () => ({
              select: () => ({
                maybeSingle: async () => {
                  const row = projects.find((project) => project.id === projectId && project.deleted_at == null);
                  if (!row) return { data: null, error: null };
                  Object.assign(row, payload);
                  return { data: { company_id: row.company_id, id: row.id }, error: null };
                },
              }),
            }),
          }),
        }),
      };
    },
  } as any;
};

describe("project service", () => {
  it("creates a project again after deleting the same assignment number twice", async () => {
    const client = createClient();
    const first = await createProject(client, COMPANY_ID, input);
    expect(first.ok).toBe(true);
    if (first.ok === false) return;

    const firstDelete = await deleteProject(client, first.data.id);
    expect(firstDelete.ok).toBe(true);

    const second = await createProject(client, COMPANY_ID, input);
    expect(second.ok).toBe(true);
    if (second.ok === false) return;
    expect(second.data.assignmentNumber).toBe("TASK-001");

    const secondDelete = await deleteProject(client, second.data.id);
    expect(secondDelete.ok).toBe(true);

    const third = await createProject(client, COMPANY_ID, input);
    expect(third.ok).toBe(true);
    if (third.ok === false) return;
    expect(third.data.assignmentNumber).toBe("TASK-001");
  });
});
