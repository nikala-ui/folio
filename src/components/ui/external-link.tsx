import { Show, type Accessor, type Component } from "solid-js";
import { useSiteLocale } from "../../plugins/i18n/runtime.jsx";
import { getExternalLinkAttributes, isExternalHref, siteOriginFrom, type ExternalLinkAttributes } from "@/lib/external-links";

// @ts-ignore Resolved by the docs plugin; its shape is the resolved DocsConfig.
import siteConfig from "virtual:folio-config";

/** Origin of the configured `siteUrl`, so same-site absolute links keep opening in the same tab. */
const configuredSiteOrigin = siteOriginFrom((siteConfig as { siteUrl?: string } | undefined)?.siteUrl);

export interface ExternalLinkState {
  /** True when the link opens in a new tab. */
  external: Accessor<boolean>;
  /** `target` and `rel` to spread onto the anchor. */
  attributes: Accessor<ExternalLinkAttributes>;
}

/**
 * Decide whether a link opens in a new tab. Without a configured `siteUrl`
 * the browser's own origin is used, so server-rendered markup treats every
 * absolute http(s) URL as external until the page hydrates.
 */
export function useExternalLink(href: Accessor<string | undefined>, explicit?: Accessor<boolean | undefined>): ExternalLinkState {
  const siteOrigin = () => configuredSiteOrigin ?? (typeof window === "undefined" ? undefined : window.location.origin);
  const options = () => ({ external: explicit?.(), siteOrigin: siteOrigin() });
  return {
    external: () => options().external ?? isExternalHref(href(), options().siteOrigin),
    attributes: () => getExternalLinkAttributes(href(), options()),
  };
}

const DEFAULT_HINT = "(opens in a new tab)";

/** Visually hidden text telling assistive technology that a link opens a new tab. */
export const ExternalLinkHint: Component<{ external: boolean }> = (props) => {
  const siteLocale = useSiteLocale();
  // Sites created before this key existed get the English text, not the key.
  const text = () => {
    const translated = siteLocale.t("navigation.opensInNewTab");
    return translated === "navigation.opensInNewTab" ? DEFAULT_HINT : translated;
  };
  return (
    <Show when={props.external}>
      <span class="sr-only"> {text()}</span>
    </Show>
  );
};
