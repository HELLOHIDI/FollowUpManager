import { EmptyPanel } from "@/components/product-shell";
import type { DashboardResponse } from "../backend/schema";
import { CategoryGroup } from "./category-group";

export function CategoryExpenseList({
  categories,
  projectId,
}: {
  categories: DashboardResponse["categories"];
  projectId: string;
}) {
  const visibleCategories = categories.filter((category) => category.expenses.length > 0);

  if (visibleCategories.length === 0) {
    return (
      <EmptyPanel
        title="등록된 지출이 없습니다"
        description="지출이 등록되면 비목별 합계와 현재 단계를 여기에 표시합니다."
      />
    );
  }

  return (
    <div className="space-y-3">
      {visibleCategories.map((category) => (
        <CategoryGroup key={category.categoryKey} category={category} projectId={projectId} />
      ))}
    </div>
  );
}
