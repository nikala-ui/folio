import { createSignal, onCleanup, Show, type Component, type JSX } from "solid-js";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { sidebarMenuButtonVariants, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/cn";
import { isSidebarItemActive } from "../../../navigation/sidebar-state.js";
import type { SidebarItem } from "../../../types.js";
import { CollapsedGroupEntries, CollapsedGroupLink } from "./collapsed-group-entries.jsx";

/** Delay that lets the pointer cross the gap between the rail icon and the flyout. */
const CLOSE_DELAY_MS = 200;
const OPEN_KEYS = new Set(["ArrowDown", "ArrowRight", "Enter", " "]);

export interface CollapsedGroupMenuProps {
  group: SidebarItem;
  currentUrl?: string;
  /** The group's icon, shown as the rail button's content. */
  icon: JSX.Element;
}

/**
 * Flyout for a sidebar group while the sidebar is collapsed to its icon rail.
 * It opens on hover and keyboard focus, lists the group's page and its child
 * pages as a menu, and closes on Escape, blur or when the pointer leaves.
 */
export const CollapsedGroupMenu: Component<CollapsedGroupMenuProps> = (props) => {
  const sidebar = useSidebar();
  const [open, setOpen] = createSignal(false);
  let trigger: HTMLButtonElement | undefined;
  let content: HTMLElement | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  let previousFocus: HTMLElement | null = null;
  let keyboardEntered = false;

  const update = (next: boolean) => {
    setOpen(next);
    if (next) return;
    const restore = !keyboardEntered && previousFocus && previousFocus !== trigger && previousFocus.isConnected;
    keyboardEntered = false;
    if (restore) queueMicrotask(() => previousFocus?.focus());
  };
  const cancelClose = () => clearTimeout(closeTimer);
  const insideFlyout = (node: EventTarget | null) =>
    node instanceof Element && (trigger?.contains(node) || Boolean(node.closest('[role="menu"]')));
  const scheduleClose = (event: { relatedTarget: EventTarget | null }) => {
    if (insideFlyout(event.relatedTarget)) return;
    cancelClose();
    closeTimer = setTimeout(() => { if (!keyboardEntered) update(false); }, CLOSE_DELAY_MS);
  };
  onCleanup(cancelClose);

  // The menu primitive moves focus into its content when it opens. Wait for
  // that, then move to the first item for keyboard entry, or give focus back
  // to the rail icon when the flyout opened because the icon was focused.
  const afterAutoFocus = (callback: () => void) => requestAnimationFrame(() => requestAnimationFrame(callback));
  const focusFirstItem = (attempts = 5) => {
    const first = content?.querySelector<HTMLElement>('[role="menuitem"]');
    if (first) first.focus();
    else if (attempts > 0) requestAnimationFrame(() => focusFirstItem(attempts - 1));
  };
  const show = (keyboard = false) => {
    cancelClose();
    if (keyboard) keyboardEntered = true;
    if (open() && !keyboard) return;
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen(true);
    afterAutoFocus(() => {
      if (keyboard) focusFirstItem();
      else if (previousFocus === trigger && content?.contains(document.activeElement)) trigger?.focus();
    });
  };
  // Escape returns focus to the rail icon without reopening the flyout.
  let ignoreFocus = false;
  const returnFocusToTrigger = () => queueMicrotask(() => {
    ignoreFocus = true;
    trigger?.focus();
    ignoreFocus = false;
  });

  const hoverIntent = {
    onPointerEnter: cancelClose,
    onPointerLeave: scheduleClose,
  };

  return (
    <DropdownMenu
      open={open()}
      onOpenChange={update}
      placement={sidebar.side() === "right" ? "left-start" : "right-start"}
      gutter={8}
      modal={false}
    >
      <DropdownMenuTrigger<"button">
        data-sidebar="menu-button"
        data-active={isSidebarItemActive(props.group, props.currentUrl) ? "true" : "false"}
        aria-label={props.group.title}
        ref={(el: HTMLButtonElement) => (trigger = el)}
        class={cn(sidebarMenuButtonVariants(), "font-normal")}
        onPointerEnter={() => show()}
        onPointerLeave={scheduleClose}
        onFocus={(event: FocusEvent) => { if (!ignoreFocus && (event.currentTarget as HTMLElement).matches(":focus-visible")) show(); }}
        onBlur={(event: FocusEvent) => { if (!insideFlyout(event.relatedTarget)) update(false); }}
        onPointerDown={(event: PointerEvent) => { event.preventDefault(); show(); }}
        onKeyDown={(event: KeyboardEvent) => {
          if (!OPEN_KEYS.has(event.key)) return;
          event.preventDefault();
          show(true);
        }}
      >
        {props.icon}
      </DropdownMenuTrigger>
      <DropdownMenuContent<"div">
        aria-label={props.group.title}
        class="min-w-44"
        ref={(el: HTMLElement) => (content = el)}
        onEscapeKeyDown={() => { keyboardEntered = true; returnFocusToTrigger(); }}
        {...hoverIntent}
      >
        <Show
          when={props.group.href}
          fallback={<div role="presentation" class="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{props.group.title}</div>}
        >
          <CollapsedGroupLink item={props.group} currentUrl={props.currentUrl} />
        </Show>
        <CollapsedGroupEntries items={props.group.items ?? []} currentUrl={props.currentUrl} nestedProps={hoverIntent} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
