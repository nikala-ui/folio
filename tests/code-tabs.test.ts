import { describe, expect, test } from "bun:test";
import { compileMdx } from "../src/mdx/compiler.js";

const FENCES = `<CodeTabs syncKey="os">

\`\`\`bash title="Linux"
curl -fsSL https://example.com/install.sh | sh
\`\`\`

\`\`\`json title="Config"
{ "install": true }
\`\`\`

</CodeTabs>
`;

async function compile(source: string): Promise<string> {
  return (await compileMdx(source)).code;
}

describe("CodeTabs compilation", () => {
  test("passes labels, exact code and languages to the component", async () => {
    const code = await compile(FENCES);
    const tabs = /tabs="([^"]*)"/.exec(code);
    expect(tabs).not.toBeNull();
    expect(JSON.parse(tabs![1].replaceAll("&quot;", '"'))).toEqual([
      { label: "Linux", code: "curl -fsSL https://example.com/install.sh | sh", lang: "bash" },
      { label: "Config", code: '{ "install": true }', lang: "json" },
    ]);
    expect(code).toContain('syncKey="os"');
  });

  test("wraps each fence in a CodeTab panel and keeps its highlighting", async () => {
    const code = await compile(FENCES);
    expect(code.match(/<CodeTab value=/g)?.length).toBe(2);
    expect(code).toContain('<CodeTab value="Linux">');
    expect(code).toContain('<CodeTab value="Config">');
    expect(code).toContain("shiki-code");
    expect(code).not.toContain("data-code");
  });

  test("labels a fence without a title with its language", async () => {
    const code = await compile("<CodeTabs>\n\n```ts\nconst a = 1;\n```\n\n```js\nvar a = 1;\n```\n\n</CodeTabs>\n");
    expect(code).toContain('value="ts"');
    expect(code).toContain('value="js"');
  });

  test("accepts single-quoted titles", async () => {
    const code = await compile("<CodeTabs>\n\n```ts title='Config'\nconst a = 1;\n```\n\n</CodeTabs>\n");
    expect(code).toContain('value="Config"');
  });

  test("leaves fences outside CodeTabs untouched", async () => {
    const code = await compile('```bash title="Linux"\necho hi\n```\n');
    expect(code).not.toContain("CodeTab");
  });

  test("rejects duplicate labels, other children and empty groups", async () => {
    await expect(compile("<CodeTabs>\n\n```ts\na\n```\n\n```ts\nb\n```\n\n</CodeTabs>\n")).rejects.toThrow('two tabs labelled "ts"');
    await expect(compile("<CodeTabs>\n\nSome text\n\n</CodeTabs>\n")).rejects.toThrow("only accepts code fences");
    await expect(compile("<CodeTabs>\n</CodeTabs>\n")).rejects.toThrow("needs at least one code fence");
  });
});
