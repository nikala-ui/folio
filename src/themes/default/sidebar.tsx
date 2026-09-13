// packages/docs/src/themes/default/sidebar.tsx
import { createSignal, onCleanup, onMount, Show, splitProps, type Component } from "solid-js";
import { Sidebar } from "@/components/ui/sidebar";
import { SidebarContent } from "@/components/ui/sidebar";
import { useSidebar } from "@/components/ui/sidebar";
import { createFocusTrap } from "@/hooks/create-focus-trap";
import { createLockScroll } from "@/hooks/create-lock-scroll";
import { cn } from "@/lib/cn";
import type { DocsSidebarProps } from "../types.js";
import { SidebarFooter } from "./components/sidebar-footer.jsx";
import { SidebarHeader } from "./components/sidebar-header.jsx";
import { SidebarMobileNav } from "./components/sidebar-mobile-nav.jsx";
import { SidebarTree } from "./navigation/sidebar-tree.jsx";
import { useSiteLocale } from "../../plugins/i18n/runtime.jsx";

export const DocsSidebar: Component<DocsSidebarProps> = (props) => {
  const [local, rest] = splitProps(props, ["tree", "pages", "nav", "currentUrl", "title", "logo", "headerSubtitle", "footerText", "showHeader", "showFooter", "class"]);
  const brandText = () => local.logo?.text || local.title || "Folio";
  const siteLocale = useSiteLocale();
  const sidebar = useSidebar();
  const [sidebarElement, setSidebarElement] = createSignal<HTMLDivElement>();

  createFocusTrap(sidebarElement, {
    enabled: () => sidebar.isMobile() && sidebar.openMobile(),
  });
  createLockScroll({
    enabled: () => sidebar.isMobile() && sidebar.openMobile(),
  });

  onMount(() => {
    if (typeof window === "undefined") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && sidebar.isMobile() && sidebar.openMobile()) {
        event.preventDefault();
        sidebar.setOpenMobile(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  return (
    <>
      <Show when={sidebar.isMobile() && sidebar.openMobile()}>
        <button
          type="button"
          aria-label={siteLocale.t("navigation.closeSidebar")}
          class="fixed inset-0 z-40 cursor-default bg-black/50 md:hidden"
          onClick={() => sidebar.setOpenMobile(false)}
        />
      </Show>
      <Show when={!sidebar.isMobile() || sidebar.openMobile()}>
        <div class={cn(
          "w-0 md:shrink-0",
          sidebar.open() ? "md:w-(--sidebar-width)" : "md:w-(--sidebar-width-icon)"
        )}>
          <Sidebar
            ref={setSidebarElement}
            collapsible={sidebar.isMobile() ? "none" : "icon"}
            class={cn(
              "top-0 self-start z-30 h-screen shrink-0 rounded-none border-y-0 border-l-0 border-r border-border bg-card shadow-sm md:fixed md:inset-y-0 md:left-0",
              "overflow-hidden max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:w-[min(17rem,calc(100vw-1rem))] max-md:shadow-xl",
              local.class
            )}
            {...rest}
          >
            <Show when={local.showHeader !== false}>
              <SidebarHeader logo={local.logo} brandText={brandText()} subtitle={local.headerSubtitle} />
            </Show>

            <SidebarContent class="h-full overflow-y-auto scrollbar-none [&::-webkit-scrollbar]:hidden">
              <Show when={local.nav?.length}>
                <SidebarMobileNav items={local.nav} onNavigate={() => sidebar.setOpenMobile(false)} />
              </Show>
              <SidebarTree tree={local.tree} pages={local.pages} currentUrl={local.currentUrl} />
            </SidebarContent>

            <Show when={local.showFooter !== false}>
              <SidebarFooter brandText={brandText()} footerText={local.footerText} />
            </Show>
          </Sidebar>
        </div>
      </Show>
    </>
  );
};
