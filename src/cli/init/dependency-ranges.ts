/** The parts of Folio's own package.json that decide which versions `folio init` writes. */
export interface FolioManifest {
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

/**
 * The range Folio itself is built and tested with, read from its package.json.
 * `dependencies` wins, then `devDependencies` (the version the test suite and
 * the docs site run against), then `peerDependencies`. A peer range is the
 * widest range Folio accepts, so it is only a last resort: `solid-js` is
 * declared as `>=1.9.0` there, which would let a new major resolve.
 */
export function folioDependencyRange(manifest: FolioManifest, name: string): string {
  const range = manifest.dependencies?.[name] ?? manifest.devDependencies?.[name] ?? manifest.peerDependencies?.[name];
  if (!range) throw new Error(`Folio's package.json does not declare ${name}, so init cannot choose a version for it.`);
  return range;
}
