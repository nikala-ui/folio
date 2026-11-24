import { getExternalLinkAttributes, siteOriginFrom } from "../lib/external-links.js";

interface MdxJsxAttribute {
  type: string;
  name?: string;
  value?: unknown;
}

interface MdxNode {
  type: string;
  name?: string;
  attributes?: MdxJsxAttribute[];
  children?: MdxNode[];
}

export interface RehypeExternalLinksOptions {
  /** The site's `siteUrl`, so same-site absolute links stay in the same tab. */
  siteUrl?: string;
}

/**
 * Opens raw `<a href>` elements written in MDX in a new tab when they point to
 * another origin. MDX does not route these through the `a` component that
 * Markdown links use. An `<a>` that already sets `target` is left alone.
 */
export function rehypeExternalLinks(options: RehypeExternalLinksOptions = {}) {
  const siteOrigin = siteOriginFrom(options.siteUrl);

  function visit(node: MdxNode): void {
    const isAnchor = (node.type === "mdxJsxTextElement" || node.type === "mdxJsxFlowElement") && node.name === "a";
    if (isAnchor && node.attributes) {
      const named = (name: string) => node.attributes!.find((attribute) => attribute.type === "mdxJsxAttribute" && attribute.name === name);
      const href = named("href")?.value;
      if (typeof href === "string" && !named("target")) {
        const { target, rel } = getExternalLinkAttributes(href, { siteOrigin });
        if (target) node.attributes.push({ type: "mdxJsxAttribute", name: "target", value: target });
        if (rel && !named("rel")) node.attributes.push({ type: "mdxJsxAttribute", name: "rel", value: rel });
      }
    }
    node.children?.forEach(visit);
  }

  return (tree: MdxNode) => visit(tree);
}
