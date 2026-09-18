import { SectionHeading } from "@/components/ui/section-heading";
import type { Component } from "solid-js";
import { PageActions, type PageActionsProps } from "./page-actions.jsx";

export interface PageHeaderProps extends PageActionsProps {
  title: string;
  description?: string;
}

export const PageHeader: Component<PageHeaderProps> = (props) => (
  <SectionHeading
    variant="page"
    title={props.title}
    description={props.description}
    class="mb-8"
    actions={
      <PageActions
        sourceUrl={props.sourceUrl}
        pageActions={props.pageActions}
        aiProviders={props.aiProviders}
        copyPageEnabled={props.copyPageEnabled}
        copyMarkdownEnabled={props.copyMarkdownEnabled}
        pageUrl={props.pageUrl}
        pageTitle={props.pageTitle}
        markdown={props.markdown}
        onCopyPage={props.onCopyPage}
        onCopyMarkdown={props.onCopyMarkdown}
      />
    }
  />
);
