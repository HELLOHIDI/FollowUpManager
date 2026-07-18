export const scheduleKeys = {
  all: ["project-schedules"] as const,
  list: (projectId: string, view: string) => [...scheduleKeys.all, projectId, view] as const,
};
