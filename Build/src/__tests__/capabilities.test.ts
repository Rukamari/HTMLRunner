import { describe, expect, it } from "vitest";
import {
  capabilityReport,
  capabilityWarning,
  detectCapabilities,
  type CapabilityEnv,
} from "../capabilities";

const insecureEnv: CapabilityEnv = {
  isSecureContext: false,
  location: { protocol: "http:", hostname: "100.115.92.26" },
  navigator: {},
  crypto: {},
};

const secureEnv: CapabilityEnv = {
  isSecureContext: true,
  location: { protocol: "https:", hostname: "localhost" },
  navigator: {
    serviceWorker: {},
    storage: { getDirectory: () => undefined },
  },
  crypto: { randomUUID: () => undefined },
  indexedDB: {},
  crossOriginIsolated: false,
  SharedArrayBuffer: function SharedArrayBuffer() {},
  WebAssembly: { Suspending: function Suspending() {} },
};

describe("detectCapabilities", () => {
  it("reports everything missing on an insecure origin", () => {
    const caps = detectCapabilities(insecureEnv);
    expect(caps.secureContext).toBe(false);
    expect(caps.serviceWorker).toBe(false);
    expect(caps.opfs).toBe(false);
    expect(caps.randomUUID).toBe(false);
    expect(caps.sharedArrayBuffer).toBe(false);
    expect(caps.jspi).toBe(false);
    expect(caps.origin).toBe("http://100.115.92.26");
  });

  it("reports the full set on a secure origin", () => {
    const caps = detectCapabilities(secureEnv);
    expect(caps).toMatchObject({
      secureContext: true,
      serviceWorker: true,
      opfs: true,
      randomUUID: true,
      indexedDb: true,
      crossOriginIsolated: false,
      sharedArrayBuffer: true,
      jspi: true,
      origin: "https://localhost",
    });
  });

  it("tolerates a missing navigator (workers, tests)", () => {
    const caps = detectCapabilities({ isSecureContext: true });
    expect(caps.serviceWorker).toBe(false);
    expect(caps.opfs).toBe(false);
    expect(caps.origin).toBe("unknown");
  });

  it("accepts the WebAssembly promising() spelling of JSPI", () => {
    const caps = detectCapabilities({
      isSecureContext: true,
      WebAssembly: { promising: () => undefined },
    });
    expect(caps.jspi).toBe(true);
  });
});

describe("capabilityWarning", () => {
  it("is null when nothing is missing", () => {
    expect(capabilityWarning(detectCapabilities(secureEnv))).toBeNull();
  });

  it("names the APIs blocked by the insecure origin", () => {
    const warning = capabilityWarning(detectCapabilities(insecureEnv));
    expect(warning).toContain("secure context");
    expect(warning).toContain("service workers");
    expect(warning).toContain("OPFS");
    expect(warning).toContain("crypto.randomUUID");
    expect(warning).toContain("HTTPS");
  });
});

describe("capabilityReport", () => {
  it("lists the environment and the git backend", () => {
    const report = capabilityReport(detectCapabilities(secureEnv), "jspi");
    expect(report).toContain("Origin              https://localhost");
    expect(report).toContain("Secure context      yes");
    expect(report).toContain("Git backend         jspi");
    expect(report).toContain("All required capabilities are available.");
  });

  it("explains the HTTPS fix on an insecure origin", () => {
    const report = capabilityReport(detectCapabilities(insecureEnv), null);
    expect(report).toContain("Secure context      no");
    expect(report).toContain("Git backend         not initialised");
    expect(report).toContain("Not a secure context");
    expect(report).toContain("npm run dev");
  });
});
