// packages/docs/src/types.ts

import type { Component } from "solid-js";
import type { FolioPluginConfig } from "./plugin.js";
import type { DocsUiLocaleConfig } from "./plugins/i18n/site-locale.js";

export type DocsIcon = Component<{
  class?: string;
  "aria-hidden"?: boolean | "true" | "false";
}>;

export interface Frontmatter {
  title?: string;
  description?: string;
  order?: number;
  categoryOrder?: number;
  icon?: string;
  badge?: string;
  addedAt?: string;
  updatedAt?: string;
  noindex?: boolean;
  prev?: string | { title: string; href: string } | boolean;
  next?: string | { title: string; href: string } | boolean;
  toc?: boolean;
  [key: string]: unknown;
}

export interface TocItem {
  id: string;
  text: string;
  depth: number;
}

export interface DocsPageAction {
  /** Accessible text rendered inside the page action link. */
  label: string;
  /** Destination opened when the visitor activates the action. */
  href: string;
  /** Open external destinations in a new tab with safe link attributes. */
  external?: boolean;
}

export interface PageData {
  slug: string;
  url: string;
  filePath: string;
  sourcePath?: string;
  frontmatter: Frontmatter;
  toc: TocItem[];
  title: string;
  description?: string;
  pageActions?: DocsPageAction[];
}

export interface SidebarItem {
  title: string;
  href?: string;
  badge?: string;
  addedAt?: string;
  icon?: string;
  items?: SidebarItem[];
  collapsed?: boolean;
}

export interface NavItem {
  title: string;
  href: string;
  external?: boolean;
}

export interface DocsThemeConfig {
  defaultMode?: "light" | "dark" | "system";
  path?: string;
}

export type DocsNavigationLayout = "sidebar" | "top";

export interface DocsNavigationConfig {
  /** Keep the navbar beside the sidebar or place it above the full layout. */
  layout?: DocsNavigationLayout;
  navbar?: NavItem[];
  sidebar?: {
    /** Explicit sidebar tree. Omit this or use "auto" for filesystem navigation. */
    nav?: SidebarItem[] | "auto";
    header?: boolean;
    footer?: boolean;
    headerSubtitle?: string;
    footerText?: string;
    promo?: {
      title: string;
      description: string;
      href: string;
      cta?: string;
    };
  };
}

export interface DocsHomeConfig {
  /** Render the root content page as a standalone landing page. */
  layout?: "docs" | "landing";
  showSidebar?: boolean;
  showNavbar?: boolean;
  showBreadcrumbs?: boolean;
  showToc?: boolean;
  showPager?: boolean;
}

export interface DocsAiProvider {
  name: string;
  url: string;
  /** Optional prompt template. Supports {url}, {content}, and {title}. */
  prompt?: string;
}

export interface DocsPageActionsConfig {
  copyPage?: boolean;
  copyMarkdown?: boolean;
  ai?: DocsAiProvider[];
}

/**
 * A Shiki theme: the name of a bundled theme such as `"github-light"`, or a
 * full Shiki theme registration object (with a unique `name`, `type`,
 * `colors` and `tokenColors`). Theme objects must be plain JSON data.
 */
export type ShikiThemeInput = string | import("shiki").ThemeRegistration;

export interface ShikiConfig {
  /**
   * Themes used for light and dark mode. Each accepts a bundled theme name or
   * a Shiki theme object. Object names must not match a bundled theme name,
   * and the light and dark objects must not share a name.
   */
  themes?: {
    light?: ShikiThemeInput;
    dark?: ShikiThemeInput;
  };
  /** Allowlist of built-in language ids. Custom languages are not affected. */
  langs?: string[];
  /**
   * Additional languages as Shiki language registrations (TextMate grammars
   * with `name`, `scopeName`, `patterns` and optional `aliases`). Code fences
   * whose language matches a `name` or alias use the grammar. Names and
   * aliases must not collide with built-in languages or each other. Grammars
   * must be plain JSON data and are loaded lazily.
   */
  customLangs?: import("shiki").LanguageRegistration[];
}

export interface DocsSeoConfig {
  /** Social preview image path or URL. */
  image?: string;
  /** Accessible alternative text for the social preview image. */
  imageAlt?: string;
  /** Site name used by social metadata. Defaults to the configured title. */
  siteName?: string;
  /** Open Graph locale. Defaults to `en_US`. */
  locale?: string;
  /** Twitter/X card type. */
  twitterCard?: "summary" | "summary_large_image";
}

export interface DocsConfig {
  title?: string;
  description?: string;
  siteUrl?: string;
  /** Favicon URL or path served by the consuming documentation site. */
  favicon?: string;
  contentDir?: string;
  /** CSS entrypoint owned by the consuming documentation project. */
  css?: string;
  home?: DocsHomeConfig;
  logo?: {
    text?: string;
    image?: string;
    href?: string;
  };
  /**
   * The project repository. `url` drives the navbar GitHub button; it also
   * builds the "View source" link unless `source` is set.
   */
  repository?: {
    url: string;
    branch?: string;
    rootDir?: string;
    /**
     * Where the documentation pages live, when that is a different repository
     * from `url`. "View source" links are built from it instead of from the
     * fields above. `branch` defaults to `main`; `rootDir` is the folder of the
     * docs project inside that repository (the `contentDir` is appended).
     */
    source?: {
      url: string;
      branch?: string;
      rootDir?: string;
    };
  };
  pageActions?: DocsPageActionsConfig;
  /** @deprecated Use navigation.navbar instead. */
  nav?: NavItem[];
  /** @deprecated Use navigation.sidebar.nav instead. */
  sidebar?: SidebarItem[] | "auto";
  navigation?: DocsNavigationConfig;
  theme?: DocsThemeConfig;
  seo?: DocsSeoConfig;
  shiki?: ShikiConfig;
  search?: {
    enabled?: boolean;
    /** A provider name or a configured adapter instance. */
    provider?: string | import("./search/provider.js").SearchAdapter;
  };
  /** Resolved JSON-backed translations for the documentation interface. */
  uiLocale?: DocsUiLocaleConfig;
  /** Build-time extensions created by Folio plugin factories. */
  plugins?: FolioPluginConfig;
}
