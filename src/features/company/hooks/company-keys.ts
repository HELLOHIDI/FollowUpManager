export const companyKeys = {
  all: ["companies"] as const,
  details: () => [...companyKeys.all, "detail"] as const,
  detail: (companyId: string) =>
    [...companyKeys.details(), companyId] as const,
  lists: () => [...companyKeys.all, "list"] as const,
  list: () => [...companyKeys.lists()] as const,
};
