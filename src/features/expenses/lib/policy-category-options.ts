export type PolicyCategoryOptionWithSubcategories = {
  subcategories?: ReadonlyArray<unknown>;
};

export const requiresSubcategorySelection = (category: PolicyCategoryOptionWithSubcategories | null | undefined) =>
  (category?.subcategories?.length ?? 0) > 0;
