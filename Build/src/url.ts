/** Normalize an in-preview link href into a workspace file path. */
export function normalizeInternalHref(href: string): string {
  let path = href.split(/[?#]/)[0] ?? "";
  try {
    path = decodeURIComponent(path);
  } catch {
  }
  return path.replace(/^\.\//, "").replace(/^\/+/, "");
}
