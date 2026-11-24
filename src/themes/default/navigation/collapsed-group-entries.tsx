import { For, Show, type Component, type JSX } from "solid-js";
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/cn";
import { isSidebarItemActive } from "../../../navigation/sidebar-state.js";
import type { SidebarItem } from "../../../types.js";

export interface CollapsedGroupEntriesProps {
  items: readonly SidebarItem[];
  currentUrl?: string;
  /** Forwarded to nested flyouts so pointer-intent logic spans every level. */
  nestedProps?: JSX.HTMLAttributes<HTMLDivElement>;
}

/** A page link inside the flyout. The active page is highlighted and marked with `aria-current`. */
export const CollapsedGroupLink: Component<Omit<CollapsedGroupEntriesProps, "items"> & { item: SidebarItem }> = (props) => {
  const active = () => isSidebarItemActive(props.item, props.currentUrl);
  return (
    <DropdownMenuItem
      as="a"
      href={props.item.href || "#"}
      data-active={active() ? "true" : "false"}
      aria-current={active() ? "page" : undefined}
      class={cn("w-full gap-2", active() && "bg-muted font-medium")}
    >
      <span class="min-w-0 flex-1 truncate">{props.item.title}</span>
    </DropdownMenuItem>
  );
};

/** The pages of a sidebar group; nested groups open as submenus that start with the group's own page. */
export const CollapsedGroupEntries: Component<CollapsedGroupEntriesProps> = (props) => (
  <For each={props.items}>
    {(item) => (
      <Show when={item.items?.length} fallback={<CollapsedGroupLink {...props} item={item} />}>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger class="gap-2">
            <span class="min-w-0 flex-1 truncate">{item.title}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent {...props.nestedProps}>
            <Show when={item.href}>
              <CollapsedGroupLink {...props} item={item} />
            </Show>
            <CollapsedGroupEntries {...props} items={item.items ?? []} />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </Show>
    )}
  </For>
);
