import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

it("documents the absence of analytics consistently", () => {
  const docs = read("docs/analytics.md");
  const site = read("apps/docs/content/docs/security/analytics.mdx");
  expect(docs).toContain("does not send usage analytics or desktop crash reports");
  expect(site.slice(site.indexOf("\n---\n", 3) + "\n---\n".length)).toBe(docs.slice(docs.indexOf("\n") + 1));
  expect(read("package.json")).not.toContain("posthog");
  expect(read("pnpm-lock.yaml")).not.toContain("posthog");
});
