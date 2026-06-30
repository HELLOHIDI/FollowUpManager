import type { PolicyDraftUpdateInput } from "./schema";

export type PolicyParserContext = {
  fileName: string;
};

export type PolicyParser = {
  id: string;
  parse: (text: string, context: PolicyParserContext) => PolicyDraftUpdateInput | null;
};

type ParsedCategory = PolicyDraftUpdateInput["categories"][number] & {
  evidenceLines: string[];
};

const circledNumberPattern = "[\\u2460-\\u2473]";
const numberedEvidencePattern = new RegExp(`^(${circledNumberPattern}|\\d+[.)]|\\?)\\s*`);
const firstEvidencePattern = new RegExp(`^([\\u2460]|1[.)]|\\?)\\s*`);
const noteOrSectionPattern = /^[*•※-]/u;
const conditionalKeywordPattern = /when|if|case|optional|required if|over|exceed/i;

const normalizeCellText = (value: string) =>
  value
    .replace(/\s+\|LINE\|\s+/g, "\n")
    .replace(/\t+/g, " ")
    .replace(/[ \u00a0]+/g, " ")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");

const stripEvidenceMarker = (value: string) =>
  value
    .replace(/^\d+[\s.)-]+/, "")
    .replace(new RegExp(`^${circledNumberPattern}\\s*`, "u"), "")
    .replace(/^\?\s*/, "");

const cleanDisplayText = (value: string, maxLength: number) =>
  stripEvidenceMarker(normalizeCellText(value))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const isUsableCategoryName = (value: string) => {
  const normalized = cleanDisplayText(value, 120);
  if (!normalized || normalized.length > 100) return false;
  if (noteOrSectionPattern.test(normalized)) return false;
  return true;
};

export const toStablePolicyKey = (value: string, fallbackPrefix: string) => {
  const ascii = value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return ascii || `${fallbackPrefix}_${Buffer.from(value).toString("hex").slice(0, 8)}`;
};

const uniqueKey = (candidate: string, used: Set<string>) => {
  let key = candidate;
  let index = 2;
  while (used.has(key)) {
    key = `${candidate}_${index}`;
    index += 1;
  }
  used.add(key);
  return key;
};

const splitEvidenceLines = (value: string) => {
  const lines = normalizeCellText(value).split("\n").filter(Boolean);
  const evidenceLines: string[] = [];

  for (const line of lines) {
    if (noteOrSectionPattern.test(line)) {
      continue;
    }

    const cleaned = cleanDisplayText(line, 140);
    if (!cleaned) {
      continue;
    }

    if (numberedEvidencePattern.test(line)) {
      evidenceLines.push(line);
      continue;
    }

    if (evidenceLines.length > 0) {
      evidenceLines[evidenceLines.length - 1] = `${evidenceLines[evidenceLines.length - 1]} ${cleaned}`.slice(0, 180);
    }
  }

  return evidenceLines;
};

const mergeOrCreateCategory = (
  categories: ParsedCategory[],
  categoryName: string,
  evidenceLines: string[],
) => {
  const previous = categories[categories.length - 1];
  const startsAfterFirstEvidence = Boolean(evidenceLines[0]) && !firstEvidencePattern.test(evidenceLines[0] ?? "");

  if (previous && startsAfterFirstEvidence) {
    previous.categoryName = `${previous.categoryName} ${categoryName}`.replace(/\s+/g, " ").trim();
    previous.rawCategoryName = `${previous.rawCategoryName ?? previous.categoryName}\n${categoryName}`;
    previous.evidenceLines.push(...evidenceLines);
    return;
  }

  categories.push({
    categoryKey: "",
    categoryName,
    evidenceLines,
    rawCategoryName: categoryName,
    reviewStatus: "needs_admin_review",
    sortOrder: categories.length,
    sourceReference: {},
  });
};

export const tablePolicyParser: PolicyParser = {
  id: "table-v1",
  parse: (text) => {
    const parsedCategories: ParsedCategory[] = [];

    for (const rawLine of text.split(/\r?\n/)) {
      const [rawCategoryCell, ...rawEvidenceCells] = rawLine.split("\t");
      if (!rawCategoryCell || rawEvidenceCells.length === 0) {
        continue;
      }

      const categoryName = cleanDisplayText(rawCategoryCell, 100);
      if (!isUsableCategoryName(categoryName)) {
        continue;
      }

      const evidenceLines = splitEvidenceLines(rawEvidenceCells.join("\n"));
      if (evidenceLines.length === 0) {
        continue;
      }

      mergeOrCreateCategory(parsedCategories, categoryName, evidenceLines);
    }

    if (parsedCategories.length < 2) {
      return null;
    }

    const categoryKeys = new Set<string>();
    const evidenceKeys = new Set<string>();
    const documentKeys = new Set<string>();
    const categories: PolicyDraftUpdateInput["categories"] = [];
    const evidenceRequirements: PolicyDraftUpdateInput["evidenceRequirements"] = [];

    for (const parsedCategory of parsedCategories.slice(0, 60)) {
      const categoryKey = uniqueKey(toStablePolicyKey(parsedCategory.categoryName, "category"), categoryKeys);
      categories.push({
        categoryKey,
        categoryName: parsedCategory.categoryName,
        rawCategoryName: parsedCategory.rawCategoryName,
        reviewStatus: "needs_admin_review",
        sortOrder: categories.length,
        sourceReference: {},
      });

      for (const evidenceLine of parsedCategory.evidenceLines.slice(0, 80)) {
        const evidenceName = cleanDisplayText(evidenceLine, 140);
        if (!evidenceName) {
          continue;
        }

        const evidenceKeyBase = toStablePolicyKey(`${parsedCategory.categoryName}_${evidenceName}`, "evidence");
        evidenceRequirements.push({
          categoryKey,
          conditionText: conditionalKeywordPattern.test(evidenceLine) ? evidenceLine : null,
          documentKey: uniqueKey(toStablePolicyKey(evidenceName, "document"), documentKeys),
          evidenceKey: uniqueKey(evidenceKeyBase, evidenceKeys),
          evidenceName,
          fulfillmentType: "single",
          requirementType: conditionalKeywordPattern.test(evidenceLine) ? "conditional" : "required",
          reviewStatus: "needs_admin_review",
          sourceReference: {},
          subcategoryKey: null,
        });
      }
    }

    return evidenceRequirements.length > 0
      ? { categories, evidenceRequirements, subcategories: [] }
      : null;
  },
};

const policyParsers: PolicyParser[] = [tablePolicyParser];

export const parsePolicyTextDraft = (text: string, context: PolicyParserContext) => {
  for (const parser of policyParsers) {
    const draft = parser.parse(text, context);
    if (draft) return draft;
  }
  return null;
};
