import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");

const rules = [
  ["src/components/app-shell.tsx", "href={routes.faq}", true],
  ["src/components/app-shell.tsx", "href={routes.discordSettings}", true],
  ["src/components/app-shell.tsx", "기간 선택", false],
  ["src/components/app-shell.tsx", 'aria-label="전체 검색"', false],
  ["src/app/(protected)/projects/page.tsx", "TEAM_FILTER_OPTIONS", true],
  ["src/app/(protected)/projects/page.tsx", "<FaqBriefing />", false],
  ["src/app/(protected)/projects/page.tsx", "formatBusinessRegistrationNumber(", false],
  ["src/features/expenses/components/expense-quick-create-sheet.tsx", "<NumberInput", true],
  ["src/features/expenses/components/expense-quick-create-sheet.tsx", "EXPENSE_FUNDING_SOURCE_BASE_KEYS", true],
  ["src/features/expenses/components/expense-quick-create-sheet.tsx", 'type="checkbox"', true],
];

const failures = rules.flatMap(([path, text, expected]) => {
  const found = read(path).includes(text);
  return found === expected ? [] : [`${path}: ${expected ? "missing" : "contains"} ${text}`];
});

if (failures.length) {
  console.error("UI baseline check failed:\n" + failures.join("\n"));
  process.exit(1);
}

console.log("UI baseline check passed.");
