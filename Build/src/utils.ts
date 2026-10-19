export function debounce<Args extends unknown[]>(
  func: (...args: Args) => unknown,
  wait: number,
): (...args: Args) => void {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  return function (this: unknown, ...args: Args): void {
    if (timeout !== undefined) clearTimeout(timeout);
    timeout = setTimeout(() => Reflect.apply(func, this, args), wait);
  };
}

export function parseCommandLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuote: string | null = null;

  for (const ch of line) {
    if (inQuote) {
      if (ch === inQuote) {
        inQuote = null;
      } else {
        current += ch;
      }
    } else if (ch === "'" || ch === '"') {
      inQuote = ch;
    } else if (ch === " ") {
      if (current) {
        result.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current) result.push(current);
  return result;
}

// Copy text to clipboard utility
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err: unknown) {
    console.error("Failed to copy text:", err);
  }
}
