import type { Component, JSX, ParentComponent } from "solid-js";
import type { DocsConfig, NavItem, PageData, TocItem, SidebarItem } from "../types.js";
import type { SearchAdapter } from "../search/provider.js";

export type BreadcrumbItemData = { title: string; href?: string };

export interface DocsNavbarProps {
  config: DocsConfig;
  currentPage?: PageData;
  pages?: readonly PageData[];
  onNavigate?: (url: string) => void;
  onOpenSearch?: () => void;
  showBrand?: boolean;
  showSidebarTrigger?: boolean;
  mobileSidebarTrigger?: boolean;
  class?: string;
}

export interface DocsSidebarProps {
  tree: SidebarItem[];
  pages?: readonly PageData[];
  nav?: NavItem[];
  currentUrl?: string;
  title?: string;
  logo?: DocsConfig["logo"];
  headerSubtitle?: string;
  footerText?: string;
  showHeader?: boolean;
  showFooter?: boolean;
  class?: string;
}

export interface DocsTableOfContentsProps {
  items: TocItem[];
  title?: string;
  class?: string;
  onActiveChange?: (id: string) => void;
}

export interface DocsBreadcrumbsProps {
  items: BreadcrumbItemData[];
  class?: string;
}

export interface DocsPaginationProps {
  prev?: { title: string; href: string };
  next?: { title: string; href: string };
  class?: string;
}

export type DocsPagerProps = DocsPaginationProps;

export interface DocsSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pages?: PageData[];
  onSelectPage?: (url: string) => void;
  provider?: string | SearchAdapter;
}

export interface DocsLayoutProps {
  config: DocsConfig;
  tree: SidebarItem[];
  pages?: PageData[];
  currentPage?: PageData;
  onNavigate?: (url: string) => void;
  breadcrumbs?: BreadcrumbItemData[];
  toc?: TocItem[];
  prev?: { title: string; href: string };
  next?: { title: string; href: string };
  sourceContent?: string;
  children?: JSX.Element;
  class?: string;
}

export interface DocsThemeContract {
  name: string;
  Provider?: ParentComponent<{ defaultTheme?: "light" | "dark" | "system"; storageKey?: string }>;
  Layout: Component<DocsLayoutProps>;
  Navbar?: Component<DocsNavbarProps>;
  Sidebar?: Component<DocsSidebarProps>;
  TableOfContents?: Component<DocsTableOfContentsProps>;
  Breadcrumbs?: Component<DocsBreadcrumbsProps>;
  Pagination?: Component<DocsPaginationProps>;
  Pager?: Component<DocsPagerProps>;
  SearchDialog?: Component<DocsSearchDialogProps>;
}
