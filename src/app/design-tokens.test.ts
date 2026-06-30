import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const globalsCss = readFileSync("src/app/globals.css", "utf8");

function extractBlock(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = globalsCss.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`));
  return match?.[1] ?? "";
}

describe("design token contracts", () => {
  it("keeps the light primary token at exact Toss Blue", () => {
    const rootTokens = extractBlock(":root");

    expect(rootTokens).toContain("--primary: 215.33 91.63% 57.84%;");
    expect(rootTokens).toContain("--ring: 215.33 91.63% 57.84%;");
    expect(rootTokens).toContain("--chart-1: 215.33 91.63% 57.84%;");
  });

  it("keeps light and dark chart token families symmetric", () => {
    const rootTokens = extractBlock(":root");
    const darkTokens = extractBlock(".dark");

    for (const index of [1, 2, 3, 4, 5, 6]) {
      expect(rootTokens).toContain(`--chart-${index}:`);
      expect(darkTokens).toContain(`--chart-${index}:`);
    }
  });
});
