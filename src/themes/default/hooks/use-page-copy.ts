import { createClipboard } from "@/hooks/create-clipboard";
import { pageToMarkdown, pageToText, sourceToMarkdown } from "../../../client/page-actions.js";
import type { Accessor } from "solid-js";

function pageElement(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector("main article [data-docs-page-content]") as HTMLElement | null;
}

export function createPageCopy(sourceContent: Accessor<string | undefined>) {
  const clipboard = createClipboard();
  const markdown = () => {
    const source = sourceContent();
    const page = pageElement();
    return source ? sourceToMarkdown(source) : page ? pageToMarkdown(page) : "";
  };

  const copyPage = async () => {
    const page = pageElement();
    if (page) await clipboard.copy(pageToText(page));
  };

  const copyMarkdown = async () => {
    const content = markdown();
    if (content) await clipboard.copy(content);
  };

  return { markdown, copyPage, copyMarkdown };
}
