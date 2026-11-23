/// <reference types="vite/client" />

declare module "*.css";

declare module "virtual:folio-config" {
  const config: any;
  export default config;
}

declare module "virtual:folio-highlight-languages" {
  const languages: Array<{ name: string; aliases?: string[]; [key: string]: unknown }>;
  export default languages;
}

declare module "virtual:folio-tree" {
  export const pages: any[];
  export const tree: any[];
  const def: { pages: any[]; tree: any[] };
  export default def;
}

declare module "virtual:folio-routes" {
  export const routes: Record<string, () => Promise<any>>;
  const def: Record<string, () => Promise<any>>;
  export default def;
}

declare module "virtual:folio-components" {
  const components: Record<string, any>;
  export default components;
}

declare module "virtual:folio-icons" {
  export const icons: Record<string, any>;
}
