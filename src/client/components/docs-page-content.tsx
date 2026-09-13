import { Show, type Component } from "solid-js";
import type { PageModule } from "../app-types.js";
import { useSiteLocale } from "../../plugins/i18n/runtime.jsx";

interface DocsPageContentProps {
  pageModule: () => PageModule | null | undefined;
  mdxComponents: Record<string, unknown>;
}

export const DocsPageContent: Component<DocsPageContentProps> = (props) => {
  const siteLocale = useSiteLocale();
  return (
  <Show when={props.pageModule() !== null} fallback={<div class="p-8 text-sm text-muted-foreground">{siteLocale.t("status.loading")}</div>}>
    <Show keyed when={props.pageModule()} fallback={<div class="space-y-4 py-8"><h1 class="text-2xl font-bold">{siteLocale.t("errors.pageNotFound")}</h1><p class="text-muted-foreground text-sm">{siteLocale.t("errors.pageNotFoundDescription")}</p></div>}>
      {(module) => {
        const Page = module.default;
        return <Page components={props.mdxComponents} />;
      }}
    </Show>
  </Show>
  );
};
