import { CODE_TABS_COMPONENT } from "./compiler-components.js";

interface MdxJsxAttribute {
  type: string;
  name?: string;
  value?: unknown;
}

interface MdxNode {
  type: string;
  name?: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  attributes?: MdxJsxAttribute[];
  data?: { meta?: string; rawLang?: string };
  children?: MdxNode[];
}

const TITLE = /(?:^|\s)title=(?:"([^"]*)"|'([^']*)')/;

function textOf(node: MdxNode): string {
  return node.type === "text" ? node.value || "" : (node.children || []).map(textOf).join("");
}

function languageOf(pre: MdxNode): string {
  const declared = pre.properties?.["data-lang"];
  if (typeof declared === "string") return declared;
  const code = pre.children?.find((child) => child.tagName === "code");
  const classes = code?.properties?.className;
  const match = Array.isArray(classes) ? classes.find((name) => String(name).startsWith("language-")) : undefined;
  return match ? String(match).slice("language-".length) : "text";
}

function fail(message: string): never {
  throw new Error(`[folio] <CodeTabs> ${message}`);
}

/**
 * Turns the code fences written inside `<CodeTabs>` into tabs. The fences are
 * wrapped in `<CodeTab>` panels and their labels, code and languages are passed
 * to `<CodeTabs>` as a JSON `tabs` attribute. A tab is labelled by `title="..."`
 * in the fence meta and falls back to the fence language. Runs after Shiki, so
 * every tab keeps its own highlighting.
 */
export function rehypeCodeTabs() {
  function convert(group: MdxNode): void {
    const tabs: Array<{ label: string; code: string; lang: string }> = [];
    const children: MdxNode[] = [];
    for (const child of group.children || []) {
      if (child.type === "text" && !child.value?.trim()) continue;
      if (child.tagName !== "pre") fail("only accepts code fences as children");
      const meta = child.data?.meta || child.children?.find((part) => part.tagName === "code")?.data?.meta || "";
      const lang = languageOf(child);
      const label = (TITLE.exec(meta)?.slice(1).find((value) => value !== undefined) || child.data?.rawLang || lang).trim();
      if (!label) fail("found a code fence with an empty title");
      if (tabs.some((tab) => tab.label === label)) {
        fail(`has two tabs labelled "${label}"; give each fence a unique title="..."`);
      }
      const code = typeof child.properties?.["data-code"] === "string" ? child.properties["data-code"] : textOf(child).trimEnd();
      tabs.push({ label, code, lang });
      children.push({
        type: "mdxJsxFlowElement",
        name: "CodeTab",
        attributes: [{ type: "mdxJsxAttribute", name: "value", value: label }],
        children: child.children,
      });
    }
    if (!tabs.length) fail("needs at least one code fence");
    group.attributes = [
      ...(group.attributes || []).filter((attribute) => attribute.name !== "tabs"),
      { type: "mdxJsxAttribute", name: "tabs", value: JSON.stringify(tabs) },
    ];
    group.children = children;
  }

  function visit(node: MdxNode): void {
    if (node.type === "mdxJsxFlowElement" && node.name === CODE_TABS_COMPONENT) return convert(node);
    node.children?.forEach(visit);
  }

  return (tree: MdxNode) => visit(tree);
}
