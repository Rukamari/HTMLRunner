export function resolvePath(base: string, relative: string): string {
  const parts = base.split("/");
  for (const seg of relative.split("/")) {
    if (seg === "." || seg === "") continue;
    if (seg === "..") {
      if (parts.length > 1) parts.pop();
    } else {
      parts.push(seg);
    }
  }
  return parts.join("/");
}
