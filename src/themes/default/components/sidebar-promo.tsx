import { ExternalLink } from "lucide-solid";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useSiteLocale } from "../../../plugins/i18n/runtime.jsx";
import type { DocsNavigationConfig } from "../../../types.js";
import type { Component } from "solid-js";

type SidebarPromoData = NonNullable<NonNullable<DocsNavigationConfig["sidebar"]>["promo"]>;

export interface SidebarPromoProps {
  promo: SidebarPromoData;
}

export const SidebarPromo: Component<SidebarPromoProps> = (props) => {
  const siteLocale = useSiteLocale();

  return (
    <Card class="border-primary/30 bg-primary/5 shadow-none">
      <CardContent class="p-4">
        <CardTitle class="text-sm">{props.promo.title}</CardTitle>
        <CardDescription class="mt-2 text-xs leading-relaxed">
          {props.promo.description}
        </CardDescription>
        <a
          href={props.promo.href}
          target="_blank"
          rel="noreferrer"
          class={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4 h-8 w-full gap-1.5 text-xs")}
        >
          {props.promo.cta || siteLocale.t("actions.learnMore")}
          <ExternalLink class="size-3" aria-hidden="true" />
        </a>
      </CardContent>
    </Card>
  );
};
