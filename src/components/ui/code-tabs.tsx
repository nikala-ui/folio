import { createMemo, createSignal, For, onMount, Show, splitProps, type JSX, type ParentComponent } from "solid-js";
import { Tabs as KobalteTabs } from "@kobalte/core/tabs";
import { Check, Copy } from "lucide-solid";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { createClipboard } from "@/hooks/create-clipboard";
import { useSiteLocale } from "../../plugins/i18n/runtime.jsx";
import { cn } from "@/lib/cn";

/** One tab of a code group: its label, the exact code to copy and the fence language. */
export interface CodeTabItem {
  label: string;
  code: string;
  lang?: string;
}

export interface CodeTabsProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, "onChange"> {
  /**
   * The tabs. The MDX compiler fills this from the code fences written inside
   * `<CodeTabs>` (a JSON string); a component can pass an array instead.
   */
  tabs?: string | CodeTabItem[];
  /** Groups on the page that share this key switch together; the choice is remembered across pages. */
  syncKey?: string;
  /** Accessible name of the tab list. */
  label?: string;
  /** Whether the copy button is shown. Defaults to true. */
  copyable?: boolean;
  class?: string;
}

const STORAGE_PREFIX = "folio:code-tabs:";
// Shared by every group on the client; the server never writes to it, so
// rendering stays free of per-request state.
const [syncedTabs, setSyncedTabs] = createSignal<Record<string, string>>({});

function parseTabs(tabs: CodeTabsProps["tabs"]): CodeTabItem[] {
  if (Array.isArray(tabs)) return tabs;
  try {
    const parsed: unknown = JSON.parse(tabs || "[]");
    return Array.isArray(parsed) ? (parsed as CodeTabItem[]) : [];
  } catch {
    return [];
  }
}

function readStoredTab(syncKey: string): string | null {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + syncKey);
  } catch {
    return null;
  }
}

function writeStoredTab(syncKey: string, label: string): void {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + syncKey, label);
  } catch {
    // Storage can be blocked; the choice then lasts until the page is closed.
  }
}

/**
 * Several code fences in one code block frame, switched with tabs in the
 * header. Each fence keeps its own language and highlighting. Write
 * `title="..."` in the fence meta to label a tab.
 */
export const CodeTabs: ParentComponent<CodeTabsProps> = (props) => {
  const siteLocale = useSiteLocale();
  const [local, rest] = splitProps(props, ["tabs", "syncKey", "label", "copyable", "class", "children"]);
  const items = createMemo(() => parseTabs(local.tabs));
  const [ownSelection, setOwnSelection] = createSignal<string>();
  const clipboard = createClipboard();

  onMount(() => {
    const key = local.syncKey;
    if (!key || syncedTabs()[key] !== undefined) return;
    const stored = readStoredTab(key);
    if (stored) setSyncedTabs((current) => ({ ...current, [key]: stored }));
  });

  // The first tab is the default, on the server and before the stored choice is read.
  const active = createMemo(() => {
    const wanted = local.syncKey ? syncedTabs()[local.syncKey] : ownSelection();
    return items().find((item) => item.label === wanted) ?? items()[0];
  });

  const select = (label: string) => {
    const key = local.syncKey;
    if (!key) return setOwnSelection(label);
    setSyncedTabs((current) => ({ ...current, [key]: label }));
    writeStoredTab(key, label);
  };

  return (
    <KobalteTabs
      value={active()?.label}
      onChange={select}
      class={cn("group relative my-4 w-full overflow-hidden rounded-lg border border-border bg-muted/40 font-mono text-sm shadow-2xs", local.class)}
      {...rest}
    >
      <div class="flex h-9 items-center justify-between border-b border-border/70 bg-muted/70 px-3.5 select-none">
        <KobalteTabs.List
          aria-label={local.label}
          class="inline-flex h-auto w-auto items-center gap-0.5 rounded-md border border-border/50 bg-background/60 p-0.5 font-mono"
        >
          <For each={items()}>
            {(item) => (
              <KobalteTabs.Trigger
                value={item.label}
                class="cursor-pointer rounded-xs px-2 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[selected]:bg-primary data-[selected]:font-semibold data-[selected]:text-primary-foreground data-[selected]:shadow-2xs"
              >
                {item.label}
              </KobalteTabs.Trigger>
            )}
          </For>
        </KobalteTabs.List>
        <Show when={(local.copyable ?? true) && active()?.code}>
          <Tooltip>
            <TooltipTrigger
              as={Button}
              variant="ghost"
              size="icon"
              onClick={() => clipboard.copy(active()!.code)}
              aria-label={clipboard.copied() ? siteLocale.t("code.copied") : siteLocale.t("code.copy")}
              class="size-6 cursor-pointer rounded-xs p-0 text-muted-foreground hover:bg-background hover:text-foreground"
            >
              <Show when={clipboard.copied()} fallback={<Copy class="size-3.5" />}>
                <Check class="size-3.5 text-emerald-500 dark:text-emerald-400" />
              </Show>
            </TooltipTrigger>
            <TooltipContent class="px-2 py-1 text-[10px]">
              {clipboard.copied() ? siteLocale.t("actions.copied") : siteLocale.t("code.copy")}
            </TooltipContent>
          </Tooltip>
        </Show>
      </div>
      {local.children}
    </KobalteTabs>
  );
};

export interface CodeTabProps extends JSX.HTMLAttributes<HTMLDivElement> {
  /** The tab label this panel belongs to. */
  value: string;
}

/** One panel of `<CodeTabs>`; the MDX compiler wraps every fence in it. */
export const CodeTab: ParentComponent<CodeTabProps> = (props) => {
  const [local, rest] = splitProps(props, ["value", "class", "children"]);
  return (
    <KobalteTabs.Content value={local.value} class={cn("overflow-x-auto p-4 text-[13px] leading-relaxed [scrollbar-width:thin] focus-visible:outline-none", local.class)} {...rest}>
      <pre class="shiki nikala-code-block m-0 overflow-x-auto bg-transparent p-0 font-mono text-xs">{local.children}</pre>
    </KobalteTabs.Content>
  );
};
