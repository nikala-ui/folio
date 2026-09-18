/// <reference types="vite/client" />

declare module "*.css";

declare module "virtual:folio-config" {
  const config: any;
  export default config;
}

declare module "virtual:folio-tree" {
  export const pages: any[];
  export const tree: any[];
}

declare module "virtual:folio-routes" {
  export const routes: Record<string, () => Promise<any>>;
}

declare module "virtual:folio-components" {
  const components: Record<string, any>;
  export default components;
}

declare module "virtual:folio-icons" {
  export const icons: Record<string, any>;
}
