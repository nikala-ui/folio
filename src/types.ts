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

export interface ShikiConfig {
  themes?: {
    light?: string;
    dark?: string;
  };
  langs?: string[];
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
  repository?: {
    url: string;
    branch?: string;
    rootDir?: string;
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
