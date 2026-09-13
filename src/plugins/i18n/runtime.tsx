import { createContext, createEffect, createSignal, useContext, type Accessor, type ParentComponent } from "solid-js";
import type { PageData } from "../../types.js";
import { findLocalizedPage, getPageLocale } from "./navigation.js";
import { SITE_LOCALE_STORAGE_KEY } from "./constants.js";
import type { DocsUiLocaleConfig, SiteTranslationKey } from "./site-locale.js";

interface SiteLocaleContextValue {
  locale: Accessor<string>;
  locales: Accessor<string[]>;
  setLocale: (locale: string) => void;
  t: (key: SiteTranslationKey, values?: Record<string, string>) => string;
}

type SiteLocaleRuntimeGlobal = typeof globalThis & {
  __folioSiteLocaleContext?: ReturnType<typeof createContext<SiteLocaleContextValue | undefined>>;
};

// Dev mode can load the bundled client and source theme files in one realm.
// Keep one context identity across those module copies without coupling the
// server resolver to a plugin-specific filesystem path.
const runtimeGlobal = globalThis as SiteLocaleRuntimeGlobal;
const SiteLocaleContext = runtimeGlobal.__folioSiteLocaleContext
  || (runtimeGlobal.__folioSiteLocaleContext = createContext<SiteLocaleContextValue>());

interface SiteLocaleProviderProps {
  config?: DocsUiLocaleConfig;
  pages?: readonly PageData[];
  currentPath?: string;
  onNavigate?: (url: string) => void;
}

export const SiteLocaleProvider: ParentComponent<SiteLocaleProviderProps> = (props) => {
  const initial = props.config?.locale || props.config?.defaultLocale || "en";
  const [locale, setLocale] = createSignal(initial);
  const locales = () => Object.keys(props.config?.translations || {}).sort();
  const setSiteLocale = (next: string) => {
    if (locales().includes(next)) setLocale(next);
  };

  createEffect(() => {
    const currentPath = props.currentPath;
    if (typeof window === "undefined") return;

    const saved = window.localStorage.getItem(SITE_LOCALE_STORAGE_KEY);
    const preferredLocale = saved && locales().includes(saved) ? saved : initial;
    if (!currentPath) {
      setSiteLocale(preferredLocale);
      return;
    }

    const currentPage = props.pages?.find((page) => page.url === currentPath);
    const localizedPage = findLocalizedPage(props.pages || [], currentPage, preferredLocale);
    if (!localizedPage && currentPage) {
      setSiteLocale(getPageLocale(currentPage) || initial);
      return;
    }
    setSiteLocale(preferredLocale);
    if (localizedPage && localizedPage.url !== currentPath) props.onNavigate?.(localizedPage.url);
  });

  const t = (key: SiteTranslationKey, values: Record<string, string> = {}) => {
    const translations = props.config?.translations || {};
    const defaultLocale = props.config?.defaultLocale || "en";
    const text = translations[locale()]?.[key] || translations[defaultLocale]?.[key] || key;
    return Object.entries(values).reduce((result, [name, value]) => result.replaceAll(`{${name}}`, value), text);
  };

  const value: SiteLocaleContextValue = {
    locale,
    locales,
    setLocale: (next) => {
      setSiteLocale(next);
      window.localStorage.setItem(SITE_LOCALE_STORAGE_KEY, next);
    },
    t,
  };

  return <SiteLocaleContext.Provider value={value}>{props.children}</SiteLocaleContext.Provider>;
};

export function useSiteLocale(): SiteLocaleContextValue {
  const context = useContext(SiteLocaleContext);
  if (!context) throw new Error("useSiteLocale must be used within a SiteLocaleProvider");
  return context;
}
