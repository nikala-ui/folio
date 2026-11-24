/** The MDX component the compiler turns the fences inside it into tabs for. */
export const CODE_TABS_COMPONENT = "CodeTabs";

/**
 * MDX components that Folio's own compiler features rely on. A project must
 * own the source of each one, so `folio init` copies them even when no page
 * uses them yet.
 */
export const COMPILER_COMPONENTS: readonly string[] = [CODE_TABS_COMPONENT];
