import {
  children as resolveChildren,
  createSignal,
  createEffect,
  createMemo,
  splitProps,
  For,
  Show,
  type JSX,
  type ParentComponent,
} from "solid-js";
import { Check, Copy } from "lucide-solid";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { createClipboard } from "@/hooks/create-clipboard";
import { highlightOnClient } from "./code-highlighter";
import { escapeHtml, highlightCliCommand, transformCommandForPm, type CodeBlockPackageManager } from "./code-block-commands";
import { useSiteLocale } from "../../plugins/i18n/runtime.jsx";
import { cn } from "@/lib/cn";

export type { CodeBlockPackageManager };

export interface CodeBlockProps extends JSX.HTMLAttributes<HTMLDivElement> {
  /** The raw source code text to display and copy */
  code?: string;
  /** File name to display in the header bar (e.g. "App.tsx", "main.rs") */
  filename?: string;
  /** Programming language badge (e.g. "tsx", "rust", "bash") */
  language?: string;
  /** Alias for language */
  lang?: string;
  /** Whether the code snippet is an executable CLI command */
  isCli?: boolean;
  /** Shows the interactive package manager runner tabs (bunx, npx, pnpm, yarn) */
  showPmSwitcher?: boolean;
  /** List of package manager runners to show */
  managers?: CodeBlockPackageManager[];
  /** Whether the copy button is enabled. Defaults to true. */
  copyable?: boolean;
  class?: string;
}

export const CodeBlock: ParentComponent<CodeBlockProps> = (props) => {
  const siteLocale = useSiteLocale();
  const [local, rest] = splitProps(props, [
    "id",
    "code",
    "filename",
    "language",
    "lang",
    "isCli",
    "showPmSwitcher",
    "managers",
    "copyable",
    "class",
    "children",
  ]);

  const clipboard = createClipboard();
  const [activePm, setActivePm] = createSignal<CodeBlockPackageManager>("bunx");
  const [highlightedHtml, setHighlightedHtml] = createSignal("");

  // Children mean the server already highlighted this block. Resolve them once
  // so the same DOM is rendered and inspected.
  const serverContent = resolveChildren(() => local.children);
  const isServerHighlighted = () => serverContent.toArray().length > 0;

  const effectiveLang = () => (local.lang || local.language || "tsx").toLowerCase();
  const copyable = () => local.copyable ?? true;
  const defaultManagers: CodeBlockPackageManager[] = ["bunx", "npx", "pnpm", "yarn"];
  const managersList = () => local.managers || defaultManagers;

  const isBashCli = () => {
    const l = effectiveLang();
    return l === "bash" || l === "sh" || l === "shell" || Boolean(local.isCli);
  };

  const cleanCode = createMemo(() => {
    const raw = (local.code || "").trim();
    if (local.isCli || local.showPmSwitcher) {
      return transformCommandForPm(raw, activePm());
    }
    return raw;
  });

  // Only blocks rendered without children are highlighted in the browser.
  createEffect(() => {
    if (isServerHighlighted()) return;
    const codeStr = cleanCode();
    const lang = effectiveLang();

    if (isBashCli()) {
      setHighlightedHtml(highlightCliCommand(codeStr));
      return;
    }

    if (!codeStr) {
      setHighlightedHtml("");
      return;
    }

    highlightOnClient(codeStr, lang).then((html) => {
      setHighlightedHtml(html ?? `<pre class="text-foreground/90"><code>${escapeHtml(codeStr)}</code></pre>`);
    });
  });

  const handleCopy = async () => {
    let textToCopy = cleanCode();
    if (!textToCopy && typeof window !== "undefined") {
      const target = document.querySelector(`[data-code-block-id="${local.id}"]`);
      if (target) textToCopy = target.textContent || "";
    }

    if (!textToCopy) return;
    await clipboard.copy(textToCopy);
  };

  const shouldShowSwitcher = () => Boolean(local.showPmSwitcher || local.isCli);
  const hasHeader = () => Boolean(shouldShowSwitcher() || local.filename || effectiveLang());

  return (
    <div
      class={cn(
        "group relative my-4 w-full overflow-hidden rounded-lg border border-border bg-muted/40 font-mono text-sm shadow-2xs",
        local.class
      )}
      {...rest}
    >
      {/* Code Header Bar */}
      <Show when={hasHeader()}>
        <div class="flex h-9 items-center justify-between border-b border-border/70 bg-muted/70 px-3.5 text-xs text-muted-foreground select-none">
          <div class="flex items-center gap-2">
            <Show when={shouldShowSwitcher()}>
              <Tabs
                value={activePm()}
                onChange={(val) => setActivePm(val as CodeBlockPackageManager)}
                class="w-auto flex-none"
              >
                <TabsList class="w-auto inline-flex h-auto bg-background/60 p-0.5 border border-border/50 gap-0.5 rounded-md font-mono">
                  <For each={managersList()}>
                    {(pm) => (
                      <TabsTrigger
                        value={pm}
                        class="rounded-xs px-2 py-0.5 text-[11px] font-mono transition-colors cursor-pointer data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-semibold data-[state=active]:shadow-2xs"
                      >
                        {pm}
                      </TabsTrigger>
                    )}
                  </For>
                </TabsList>
              </Tabs>
            </Show>

            <Show when={local.filename}>
              <span class="font-medium text-foreground tracking-tight">{local.filename}</span>
            </Show>

            <Show when={effectiveLang() && !shouldShowSwitcher() && !local.filename}>
              <Badge variant="outline" class="uppercase text-[10px] px-1.5 py-0 h-4 font-mono font-semibold">
                {effectiveLang()}
              </Badge>
            </Show>
          </div>

          <Show when={copyable() && (local.code || cleanCode())}>
            <Tooltip>
              <TooltipTrigger
                as={Button}
                variant="ghost"
                size="icon"
                onClick={handleCopy}
                aria-label={clipboard.copied() ? siteLocale.t("code.copied") : siteLocale.t("code.copy")}
                class="size-6 p-0 rounded-xs text-muted-foreground hover:bg-background hover:text-foreground cursor-pointer"
              >
                <Show when={clipboard.copied()} fallback={<Copy class="size-3.5" />}>
                  <Check class="size-3.5 text-emerald-500 dark:text-emerald-400" />
                </Show>
              </TooltipTrigger>
              <TooltipContent class="text-[10px] py-1 px-2">
                {clipboard.copied() ? siteLocale.t("actions.copied") : siteLocale.t("code.copy")}
              </TooltipContent>
            </Tooltip>
          </Show>
        </div>
      </Show>

      {/* Floating Copy Button (if no header bar is present) */}
      <Show when={!hasHeader() && copyable() && (local.code || cleanCode())}>
        <div class="absolute right-2.5 top-2.5 z-10 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <Tooltip>
            <TooltipTrigger
              as={Button}
              variant="outline"
              size="icon"
              onClick={handleCopy}
                aria-label={clipboard.copied() ? siteLocale.t("code.copied") : siteLocale.t("code.copy")}
              class="size-7 rounded-md border-border/80 bg-background/90 text-muted-foreground backdrop-blur-xs hover:bg-muted hover:text-foreground cursor-pointer shadow-2xs"
            >
              <Show when={clipboard.copied()} fallback={<Copy class="size-3.5" />}>
                <Check class="size-3.5 text-emerald-500 dark:text-emerald-400" />
              </Show>
            </TooltipTrigger>
            <TooltipContent class="text-[10px] py-1 px-2">
                {clipboard.copied() ? siteLocale.t("actions.copied") : siteLocale.t("code.copy")}
            </TooltipContent>
          </Tooltip>
        </div>
      </Show>

      {/* Code Container */}
      <div class="overflow-x-auto p-4 text-[13px] leading-relaxed [scrollbar-width:thin]">
        <Show
          when={isServerHighlighted()}
          fallback={
            <div
              class="font-mono text-sm leading-relaxed overflow-x-auto [&>pre]:!bg-transparent [&>pre]:!p-0 [&>pre]:!m-0 [&>pre]:!border-none"
              innerHTML={highlightedHtml() || `<pre class="text-foreground/90"><code>${escapeHtml(cleanCode())}</code></pre>`}
            />
          }
        >
          <pre class="shiki nikala-code-block m-0 overflow-x-auto bg-transparent p-0 font-mono text-xs">
            {serverContent()}
          </pre>
        </Show>
      </div>
    </div>
  );
};
