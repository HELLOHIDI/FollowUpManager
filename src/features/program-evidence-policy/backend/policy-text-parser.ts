import type { PolicyDraftUpdateInput } from "./schema";

export type PolicyParserContext = {
  fileName: string;
};

export type PolicyParser = {
  id: string;
  parse: (text: string, context: PolicyParserContext) => PolicyDraftUpdateInput | null;
};

const categoryKeywordPattern =
  /비목|항목|집행항목|사업비\s*항목|인건비|재료비|외주|용역|기자재|장비|교육|훈련|마케팅|홍보|회의|출장|여비|수수료|임차|관리비|개발비|특허|인증|시제품|소모품|사업화|category/i;
const categoryEvidenceExclusionPattern = /증빙서류|제출서류|영수증|세금계산서|계산서|거래명세서|계약서|견적서|검수|납품/i;
const evidenceKeywordPattern =
  /증빙|증빙서류|제출서류|영수증|세금계산서|계산서|카드매출전표|거래명세서|계약서|견적서|비교견적|검수|납품|결과보고|신청서|청구서|통장|사업자등록증|invoice|receipt|contract|quote|document/i;
const conditionalKeywordPattern = /경우|해당 시|필요 시|when|if/i;

const cleanCandidateName = (line: string, maxLength: number) =>
  line
    .replace(/^\d+[\s.)-]+/, "")
    .replace(/^[\s\-*.:)]+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const isLikelyCategoryLine = (line: string) =>
  categoryKeywordPattern.test(line)
  && !categoryEvidenceExclusionPattern.test(line)
  && !/^(사업비\s*)?(비목|항목|집행항목|사업비\s*항목)$/i.test(line.trim());

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

export const heuristicPolicyParser: PolicyParser = {
  id: "heuristic-v1",
  parse: (text) => {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length >= 2);
    const categoryKeys = new Set<string>();
    const evidenceKeys = new Set<string>();
    const documentKeys = new Set<string>();
    const categories: PolicyDraftUpdateInput["categories"] = [];
    const evidenceRequirements: PolicyDraftUpdateInput["evidenceRequirements"] = [];
    let currentCategoryKey: string | null = null;

    for (const line of lines) {
      if (categories.length < 40 && isLikelyCategoryLine(line)) {
        const name = cleanCandidateName(line, 80);
        if (name && !categories.some((category) => category.rawCategoryName === line || category.categoryName === name)) {
          const categoryKey = uniqueKey(toStablePolicyKey(name, "category"), categoryKeys);
          categories.push({
            categoryKey,
            categoryName: name,
            rawCategoryName: line,
            reviewStatus: "needs_admin_review",
            sortOrder: categories.length,
            sourceReference: {},
          });
          currentCategoryKey = categoryKey;
        }
        continue;
      }

      if (evidenceRequirements.length < 120 && evidenceKeywordPattern.test(line)) {
        const name = cleanCandidateName(line, 100);
        if (!name) continue;
        const categoryKey = currentCategoryKey ?? categories[categories.length - 1]?.categoryKey ?? null;
        evidenceRequirements.push({
          categoryKey,
          conditionText: conditionalKeywordPattern.test(line) ? line : null,
          documentKey: uniqueKey(toStablePolicyKey(name, "document"), documentKeys),
          evidenceKey: uniqueKey(toStablePolicyKey(name, "evidence"), evidenceKeys),
          evidenceName: name,
          fulfillmentType: "single",
          requirementType: conditionalKeywordPattern.test(line) ? "conditional" : "required",
          reviewStatus: "needs_admin_review",
          sourceReference: {},
          subcategoryKey: null,
        });
      }
    }

    const hasLinkedEvidence = evidenceRequirements.some((evidence) => Boolean(evidence.categoryKey));
    if (categories.length < 2 || !hasLinkedEvidence) {
      return null;
    }

    return { categories, evidenceRequirements, subcategories: [] };
  },
};

const policyParsers: PolicyParser[] = [heuristicPolicyParser];

export const parsePolicyTextDraft = (text: string, context: PolicyParserContext) => {
  for (const parser of policyParsers) {
    const draft = parser.parse(text, context);
    if (draft) return draft;
  }
  return null;
};
