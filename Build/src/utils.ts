export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  return function (this: unknown, ...args: Parameters<T>): void {
    if (timeout !== undefined) clearTimeout(timeout);
    timeout = setTimeout(
      () =>
        Reflect.apply(
          func as unknown as (...a: unknown[]) => unknown,
          this,
          args as unknown[],
        ),
      wait,
    );
  };
}

export function parseCommandLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuote: string | null = null;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
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
