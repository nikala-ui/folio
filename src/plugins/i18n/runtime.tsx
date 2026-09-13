import { createContext, createSignal, onMount, useContext, type Accessor, type ParentComponent } from "solid-js";
import type { PageData } from "../../types.js";
import { findLocalizedPage } from "./navigation.js";
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

  onMount(() => {
    const saved = window.localStorage.getItem(SITE_LOCALE_STORAGE_KEY);
    if (!saved) return;
    setSiteLocale(saved);
    const currentPage = props.pages?.find((page) => page.url === props.currentPath);
    const localizedPage = findLocalizedPage(props.pages || [], currentPage, saved);
    if (localizedPage && localizedPage.url !== props.currentPath) props.onNavigate?.(localizedPage.url);
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
