
export interface CapabilityEnv {
  isSecureContext?: boolean | undefined;
  location?: { protocol?: string; hostname?: string } | undefined;
  navigator?:
    | {
        serviceWorker?: unknown;
        storage?: { getDirectory?: unknown } | undefined;
      }
    | undefined;
  crypto?: { randomUUID?: unknown } | undefined;
  indexedDB?: unknown;
  crossOriginIsolated?: boolean | undefined;
  SharedArrayBuffer?: unknown;
  WebAssembly?:
    | { Suspending?: unknown; promising?: unknown; [key: string]: unknown }
    | undefined;
}

export interface Capabilities {
  secureContext: boolean;
  /** Service workers power the in-browser Vite dev server preview. */
  serviceWorker: boolean;
  opfs: boolean;
  indexedDb: boolean;
  randomUUID: boolean;
  crossOriginIsolated: boolean;
  sharedArrayBuffer: boolean;
  jspi: boolean;
  origin: string;
}

export function detectCapabilities(env: CapabilityEnv = globalThis): Capabilities {
  const nav = env.navigator;
  const wasm = env.WebAssembly;
  return {
    secureContext: env.isSecureContext === true,
    serviceWorker: Boolean(nav?.serviceWorker),
    opfs: Boolean(nav?.storage?.getDirectory),
    indexedDb: Boolean(env.indexedDB),
    randomUUID: Boolean(env.crypto?.randomUUID),
    crossOriginIsolated: env.crossOriginIsolated === true,
    sharedArrayBuffer: typeof env.SharedArrayBuffer === "function",
    jspi:
      typeof wasm?.Suspending === "function" ||
      typeof wasm?.promising === "function",
    origin: describeOrigin(env),
  };
}

function describeOrigin(env: CapabilityEnv): string {
  const location = env.location;
  if (!location) return "unknown";
  const protocol = location.protocol ?? "";
  const host = location.hostname ?? "";
  if (!protocol && !host) return "unknown";
  return `${protocol}//${host}`;
}

export function capabilityWarning(caps: Capabilities): string | null {
  if (caps.secureContext) return null;
  const missing: string[] = [];
  if (!caps.serviceWorker) missing.push("service workers");
  if (!caps.opfs) missing.push("OPFS");
  if (!caps.randomUUID) missing.push("crypto.randomUUID");
  if (missing.length === 0) return null;
  return `Not a secure context, so ${missing.join(", ")} ${
    missing.length === 1 ? "is" : "are"
  } unavailable. Serve the dev server over HTTPS to enable ${
    missing.length === 1 ? "it" : "them"
  }.`;
}

function describe(value: boolean): string {
  return value ? "yes" : "no";
}

/**
 * Human-readable report used by Help → System Diagnostics.
 *
 * @param gitVariant Backend reported by the git worker, or `null` when git
 *   has not initialised (or failed).
 */
export function capabilityReport(
  caps: Capabilities,
  gitVariant: string | null,
): string {
  const lines = [
    "Environment",
    `  Origin              ${caps.origin}`,
    `  Secure context      ${describe(caps.secureContext)}`,
    `  Service workers     ${describe(caps.serviceWorker)}`,
    `  OPFS                ${describe(caps.opfs)}`,
    `  IndexedDB           ${describe(caps.indexedDb)}`,
    `  SharedArrayBuffer   ${describe(caps.sharedArrayBuffer)}`,
    `  WebAssembly JSPI    ${describe(caps.jspi)}`,
    `  crypto.randomUUID   ${describe(caps.randomUUID)}`,
    `  Git backend         ${gitVariant ?? "not initialised"}`,
  ];

  const warning = capabilityWarning(caps);
  if (warning) {
    lines.push(
      "",
      warning,
      "",
      "HTTPS is enabled by default for `npm run dev`; open the printed",
      "https:// URL (see README → Local Development Setup).",
    );
  } else {
    lines.push("", "All required capabilities are available.");
  }

  return lines.join("\n");
}
