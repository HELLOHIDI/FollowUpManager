import type { PolicyDraftUpdateInput } from "./schema";

export type PolicyParserContext = {
  fileName: string;
};

export type PolicyParser = {
  id: string;
  parse: (text: string, context: PolicyParserContext) => PolicyDraftUpdateInput | null;
};

type ParsedEvidenceGroup = {
  evidenceLines: string[];
  groupName: string | null;
  isCommon: boolean;
};

type ParsedCategory = PolicyDraftUpdateInput["categories"][number] & {
  evidenceLines: string[];
  evidenceGroups: ParsedEvidenceGroup[];
};

const circledNumberPattern = "[\\u2460-\\u2473]";
const numberedEvidencePattern = new RegExp(`^(${circledNumberPattern}|\\d+[.)]|\\?)\\s*`);
const firstEvidencePattern = new RegExp(`^([\\u2460]|1[.)]|\\?)\\s*`);
const bulletGroupPattern = /^\u2022\s*(.+)$/u;
const inlineTitleEvidencePattern = new RegExp(`^(.+?)\\s+(${circledNumberPattern}|\\d+[.)]|\\?)\\s*(.+)$`, "u");
const noteOrSectionPattern = /^[*\u203B-]/u;
const commonGroupNamePattern = /\uACF5\uD1B5/u;
const subcategorySectionPattern = /\uBE44\uBAA9\s*\uC99D\uBE59\uC11C\uB958/u;
const evidenceContinuationKeywordPattern =
  /\uC11C\uB958|\uBB38\uC11C|\uACF5\uBB38|\uACC4\uC57D|\uD655\uC778|\uBCF4\uACE0|\uC99D\uBE59|\uC2E0\uCCAD|\uC811\uC218|\uCE74\uD0C8\uB85C\uADF8|\uC601\uC218\uC99D|\uACC4\uC0B0\uC11C|\uD1B5\uC7A5|\uB4F1\uB85D\uC99D|\uBA85\uC138\uC11C|\uACAC\uC801|\uC694\uCCAD|\uACC4\uD68D\uC11C|\uC2B9\uC778/u;
const conditionalKeywordPattern = /when|if|case|optional|required if|over|exceed/i;
const circledNumberStartCode = 0x2460;

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

const getEvidenceSortOrder = (value: string, fallback: number) => {
  const trimmed = value.trim();
  const circled = trimmed.match(new RegExp(`^(${circledNumberPattern})`, "u"))?.[1];
  if (circled) {
    return circled.codePointAt(0)! - circledNumberStartCode;
  }

  const numbered = trimmed.match(/^(\d+)[.)]/)?.[1];
  if (numbered) {
    return Math.max(0, Number(numbered) - 1);
  }

  return fallback;
};

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

const splitEvidenceGroups = (value: string): ParsedEvidenceGroup[] => {
  const lines = normalizeCellText(value).split("\n").filter(Boolean);
  const groups: ParsedEvidenceGroup[] = [{ evidenceLines: [], groupName: null, isCommon: false }];
  let currentGroup = groups[0]!;
  let isSubcategorySection = false;
  let pendingSubcategoryName: string | null = null;

  const startGroup = (groupName: string | null, isCommon = false) => {
    currentGroup = {
      evidenceLines: [],
      groupName,
      isCommon,
    };
    groups.push(currentGroup);
  };

  const appendToCurrentEvidence = (cleaned: string) => {
    if (currentGroup.evidenceLines.length === 0) {
      return false;
    }
    const lastIndex = currentGroup.evidenceLines.length - 1;
    currentGroup.evidenceLines[lastIndex] = `${currentGroup.evidenceLines[lastIndex]} (${cleaned})`.slice(0, 180);
    return true;
  };

  for (const line of lines) {
    const bulletMatch = line.match(bulletGroupPattern);
    if (bulletMatch?.[1]) {
      const groupName = cleanDisplayText(bulletMatch[1], 100);
      if (groupName) {
        startGroup(groupName, commonGroupNamePattern.test(groupName));
      }
      continue;
    }

    if (noteOrSectionPattern.test(line)) {
      continue;
    }

    const cleaned = cleanDisplayText(line, 140);
    if (!cleaned) {
      continue;
    }

    if (subcategorySectionPattern.test(cleaned)) {
      isSubcategorySection = true;
      pendingSubcategoryName = null;
      continue;
    }

    if (commonGroupNamePattern.test(cleaned)) {
      startGroup(cleaned, true);
      pendingSubcategoryName = null;
      continue;
    }

    const inlineTitleEvidenceMatch = isSubcategorySection ? line.match(inlineTitleEvidencePattern) : null;
    if (inlineTitleEvidenceMatch?.[1] && inlineTitleEvidenceMatch[2] && inlineTitleEvidenceMatch[3]) {
      const titleText = cleanDisplayText(inlineTitleEvidenceMatch[1], 100);
      const evidenceLine = `${inlineTitleEvidenceMatch[2]} ${inlineTitleEvidenceMatch[3]}`.trim();
      if (titleText) {
        const groupName = pendingSubcategoryName
          ? `${pendingSubcategoryName} ${titleText}`.replace(/\s+/g, " ").trim().slice(0, 100)
          : titleText;
        startGroup(groupName, false);
        pendingSubcategoryName = null;
      }
      currentGroup.evidenceLines.push(evidenceLine);
      continue;
    }

    if (numberedEvidencePattern.test(line)) {
      if (pendingSubcategoryName) {
        startGroup(pendingSubcategoryName, false);
        pendingSubcategoryName = null;
      }
      currentGroup.evidenceLines.push(line);
      continue;
    }

    if (isSubcategorySection) {
      if (pendingSubcategoryName) {
        pendingSubcategoryName = `${pendingSubcategoryName} ${cleaned}`.replace(/\s+/g, " ").trim().slice(0, 100);
        continue;
      }

      if (currentGroup.evidenceLines.length === 0 || !evidenceContinuationKeywordPattern.test(cleaned)) {
        pendingSubcategoryName = cleaned;
        continue;
      }
    }

    if (appendToCurrentEvidence(cleaned)) {
      continue;
    }
  }

  return groups.filter((group) => group.evidenceLines.length > 0);
};

const mergeOrCreateCategory = (
  categories: ParsedCategory[],
  categoryName: string,
  evidenceGroups: ParsedEvidenceGroup[],
) => {
  const previous = categories[categories.length - 1];
  const evidenceLines = evidenceGroups.flatMap((group) => group.evidenceLines);
  const startsAfterFirstEvidence = Boolean(evidenceLines[0]) && !firstEvidencePattern.test(evidenceLines[0] ?? "");

  if (previous && startsAfterFirstEvidence) {
    previous.categoryName = `${previous.categoryName} ${categoryName}`.replace(/\s+/g, " ").trim();
    previous.rawCategoryName = `${previous.rawCategoryName ?? previous.categoryName}\n${categoryName}`;
    previous.evidenceLines.push(...evidenceLines);
    previous.evidenceGroups.push(...evidenceGroups);
    return;
  }

  categories.push({
    categoryKey: "",
    categoryName,
    evidenceLines,
    evidenceGroups,
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

      const evidenceGroups = splitEvidenceGroups(rawEvidenceCells.join("\n"));
      if (evidenceGroups.length === 0) {
        continue;
      }

      mergeOrCreateCategory(parsedCategories, categoryName, evidenceGroups);
    }

    if (parsedCategories.length < 2) {
      return null;
    }

    const categoryKeys = new Set<string>();
    const evidenceKeys = new Set<string>();
    const documentKeys = new Set<string>();
    const categories: PolicyDraftUpdateInput["categories"] = [];
    const evidenceRequirements: PolicyDraftUpdateInput["evidenceRequirements"] = [];
    const subcategories: PolicyDraftUpdateInput["subcategories"] = [];

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

      const subcategoryKeys = new Set<string>();
      const subcategoryKeyByGroupName = new Map<string, string>();

      for (const group of parsedCategory.evidenceGroups) {
        let subcategoryKey: string | null = null;
        if (group.groupName && !group.isCommon) {
          subcategoryKey = subcategoryKeyByGroupName.get(group.groupName) ?? null;
          if (!subcategoryKey) {
            subcategoryKey = uniqueKey(toStablePolicyKey(`${parsedCategory.categoryName}_${group.groupName}`, "subcategory"), subcategoryKeys);
            subcategoryKeyByGroupName.set(group.groupName, subcategoryKey);
            subcategories.push({
              categoryKey,
              rawSubcategoryName: group.groupName,
              reviewStatus: "needs_admin_review",
              sortOrder: subcategories.filter((subcategory) => subcategory.categoryKey === categoryKey).length,
              sourceReference: {},
              subcategoryKey,
              subcategoryName: group.groupName,
            });
          }
        }

        for (const [evidenceIndex, evidenceLine] of group.evidenceLines.slice(0, 80).entries()) {
          const evidenceName = cleanDisplayText(evidenceLine, 140);
          if (!evidenceName) {
            continue;
          }

          const evidenceKeyBase = toStablePolicyKey(`${parsedCategory.categoryName}_${group.groupName ?? "common"}_${evidenceName}`, "evidence");
          evidenceRequirements.push({
            categoryKey,
            conditionText: conditionalKeywordPattern.test(evidenceLine) ? evidenceLine : null,
            documentKey: uniqueKey(toStablePolicyKey(evidenceName, "document"), documentKeys),
            evidenceKey: uniqueKey(evidenceKeyBase, evidenceKeys),
            evidenceName,
            fulfillmentType: "single",
            requirementType: conditionalKeywordPattern.test(evidenceLine) ? "conditional" : "required",
            reviewStatus: "needs_admin_review",
            sortOrder: getEvidenceSortOrder(evidenceLine, evidenceIndex),
            sourceReference: {},
            subcategoryKey,
          });
        }
      }
    }

    return evidenceRequirements.length > 0
      ? { categories, evidenceRequirements, subcategories }
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
