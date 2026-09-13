export function formatTitleFromFilename(filename: string): string {
  const basename = filename.replace(/\\/g, "/").split("/").pop() || filename;
  const extensionIndex = basename.lastIndexOf(".");
  const base = extensionIndex > 0 ? basename.slice(0, extensionIndex) : basename;
  if (base === "index") return "Overview";
  return base
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
