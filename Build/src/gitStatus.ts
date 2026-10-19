export interface PorcelainEntry {
  code: string;
  path: string;
}

const BADGE_CLASSES: Readonly<Record<string, string>> = {
  M: "modified",
  A: "added",
  D: "deleted",
  R: "renamed",
};

export function parsePorcelainStatus(text: string): PorcelainEntry[] {
  const entries: PorcelainEntry[] = [];
  for (const line of text.split("\n")) {
    if (line.length < 4) continue;
    const x = line[0] ?? " ";
    const y = line[1] ?? " ";
    const code = x !== " " ? x : y !== " " ? y : "?";
    const rawPath = line.slice(3);
    const arrow = rawPath.lastIndexOf(" -> ");
    const path = arrow >= 0 ? rawPath.slice(arrow + 4) : rawPath;
    if (!path) continue;
    entries.push({ code, path });
  }
  return entries;
}

export function gitStatusBadgeClass(code: string): string {
  return BADGE_CLASSES[code] ?? "other";
}
