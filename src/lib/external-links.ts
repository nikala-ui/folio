/** Link relationship for destinations opened in a new tab. */
export const EXTERNAL_LINK_REL = "noopener noreferrer";

/** Stand-in base for resolving URLs when the site's own origin is unknown. */
const UNKNOWN_SITE_ORIGIN = "https://folio.invalid";

export interface ExternalLinkAttributes {
  target?: "_blank";
  rel?: string;
}

export interface ExternalLinkOptions {
  /** Explicit choice, for example `NavItem.external`; it wins over the automatic rule. */
  external?: boolean;
  /** Origin of the site itself, from {@link siteOriginFrom} or the current page. */
  siteOrigin?: string;
}

/** The origin of the configured `siteUrl`, or `undefined` when it is missing or invalid. */
export function siteOriginFrom(siteUrl: string | undefined): string | undefined {
  if (!siteUrl) return undefined;
  try {
    return new URL(siteUrl).origin;
  } catch {
    return undefined;
  }
}

/**
 * Whether a link points to another origin. Only http(s) destinations on an
 * origin other than the site's own are external. Relative paths, `#hash`
 * links, same-origin absolute URLs and non-web schemes such as `mailto:` or
 * `tel:` are not.
 */
export function isExternalHref(href: string | undefined, siteOrigin?: string): boolean {
  const value = href?.trim();
  if (!value) return false;
  try {
    const base = new URL(siteOrigin || UNKNOWN_SITE_ORIGIN);
    const url = new URL(value, base);
    return (url.protocol === "http:" || url.protocol === "https:") && url.origin !== base.origin;
  } catch {
    return false;
  }
}

/**
 * `target` and `rel` for a link, or an empty object when it opens in the same
 * tab. An explicit `external` flag wins over the automatic rule.
 */
export function getExternalLinkAttributes(href: string | undefined, options: ExternalLinkOptions = {}): ExternalLinkAttributes {
  const external = options.external ?? isExternalHref(href, options.siteOrigin);
  return external ? { target: "_blank", rel: EXTERNAL_LINK_REL } : {};
}
