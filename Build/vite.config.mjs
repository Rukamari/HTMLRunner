import { defineConfig, loadEnv } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { execFileSync } from "node:child_process";
import { X509Certificate } from "node:crypto";
import net from "node:net";
import os from "node:os";
import fs from "fs";
import path from "path";

const CERT_DIR = path.resolve(process.cwd(), ".certs");
const CERT_FILE = path.join(CERT_DIR, "dev-cert.pem");
const KEY_FILE = path.join(CERT_DIR, "dev-key.pem");
const HOSTS_STAMP = path.join(CERT_DIR, "hosts.txt");
const CERT_DAYS = 825;
const RENEW_BEFORE_MS = 7 * 24 * 60 * 60 * 1000;

function httpsLog(message) {
  console.log(`[https] ${message}`);
}

function httpsWarn(message) {
  console.warn(`[https] ${message}`);
}

function collectTlsHosts(extra) {
  const hosts = new Set(["localhost", "127.0.0.1", "::1"]);

  try {
    hosts.add(os.hostname());
  } catch {
  }

  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (!entry || entry.internal) continue;
      if (entry.address.includes("%")) continue;
      if (entry.address.startsWith("fe80")) continue;
      hosts.add(entry.address);
    }
  }

  for (const host of extra) hosts.add(host);
  return [...hosts];
}

function certsAreFresh(hosts) {
  try {
    if (
      !fs.existsSync(CERT_FILE) ||
      !fs.existsSync(KEY_FILE) ||
      !fs.existsSync(HOSTS_STAMP)
    ) {
      return false;
    }
    if (fs.readFileSync(HOSTS_STAMP, "utf8") !== hosts.join("\n")) return false;
    const cert = new X509Certificate(fs.readFileSync(CERT_FILE));
    return Date.parse(cert.validTo) - Date.now() > RENEW_BEFORE_MS;
  } catch {
    return false;
  }
}

function tryCommand(command, args) {
  try {
    execFileSync(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    return true;
  } catch (err) {
    const stderr = err?.stderr ? String(err.stderr).trim().split("\n").pop() : "";
    const reason = stderr || err?.message || String(err);
    httpsWarn(`${command} failed: ${reason}`);
    return false;
  }
}

function generateWithOpenssl(hosts) {
  const san = hosts
    .map((host) => (net.isIP(host) ? `IP:${host}` : `DNS:${host}`))
    .join(",");
  return tryCommand("openssl", [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-sha256",
    "-nodes",
    "-days",
    String(CERT_DAYS),
    "-keyout",
    KEY_FILE,
    "-out",
    CERT_FILE,
    "-subj",
    `/CN=${hosts[0] ?? "localhost"}`,
    "-addext",
    `subjectAltName=${san}`,
    "-addext",
    "basicConstraints=critical,CA:TRUE",
    "-addext",
    "keyUsage=critical,digitalSignature,keyCertSign",
    "-addext",
    "extendedKeyUsage=serverAuth",
  ]);
}

function generateWithMkcert(hosts) {
  return tryCommand("mkcert", [
    "-cert-file",
    CERT_FILE,
    "-key-file",
    KEY_FILE,
    ...hosts,
  ]);
}

function resolveHttpsOptions(env) {
  const setting = String(env.HTTPS ?? "").trim().toLowerCase();
  if (["false", "0", "off", "no"].includes(setting)) {
    httpsLog("disabled via HTTPS=false");
    return undefined;
  }

  const extra = String(env.HTTPS_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);
  const hosts = collectTlsHosts(extra);

  try {
    fs.mkdirSync(CERT_DIR, { recursive: true });
  } catch {
  }

  if (!certsAreFresh(hosts)) {
    httpsLog(`generating certificate for: ${hosts.join(", ")}`);
    const generators =
      setting === "openssl"
        ? [generateWithOpenssl, generateWithMkcert]
        : [generateWithMkcert, generateWithOpenssl];
    const generated = generators.some((generate) => generate(hosts));

    if (!generated) {
      httpsWarn(
        "no certificate could be generated (mkcert and openssl both failed) so staying on HTTP",
      );
      return undefined;
    }

    try {
      fs.writeFileSync(HOSTS_STAMP, hosts.join("\n"));
    } catch {
    }
  }

  try {
    const options = {
      cert: fs.readFileSync(CERT_FILE),
      key: fs.readFileSync(KEY_FILE),
    };
    httpsLog("enabled: serving HTTPS (add --host to reach it from other devices)");
    httpsLog("certificate warning? trust the mkcert CA (`mkcert -CAROOT`) once");
    return options;
  } catch (err) {
    httpsWarn(`could not read certificate: ${err.message}, staying on HTTP`);
    return undefined;
  }
}

function inlineSvgFaviconPlugin(options) {
  return {
    name: "inline-svg-favicon",
    enforce: "post",
    transformIndexHtml(html) {
      if (!fs.existsSync(options.svg)) return html;
      const ext = path.extname(options.svg).toLowerCase();
      let faviconTag = "";

      try {
        if (ext === ".svg") {
          let svgContent = fs.readFileSync(options.svg, "utf8");
          svgContent = svgContent
            .replace(/<\?xml[^>]*>\s*/g, "")
            .replace(/\s+/g, " ");
          const base64 = Buffer.from(svgContent).toString("base64");
          faviconTag = `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,${base64}"/>\n`;
        } else {
          const buf = fs.readFileSync(options.svg);
          const base64 = buf.toString("base64");
          const mime = ext === ".png" ? "image/png" : ext === ".ico" ? "image/x-icon" : "application/octet-stream";
          faviconTag = `<link rel="icon" type="${mime}" href="data:${mime};base64,${base64}"/>\n`;
        }
      } catch (e) {
        return html;
      }

      return html.replace(/(<head[^>]*>)/i, `$1\n  ${faviconTag}`);
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const isSingleFile = env.SINGLE_FILE === "true";

  const https =
    command === "serve" && !process.env.VITEST
      ? resolveHttpsOptions(env)
      : undefined;

  return {
    base: "./",
    plugins: [
      isSingleFile && viteSingleFile(),
      isSingleFile && inlineSvgFaviconPlugin({ svg: "public/favicon.png" }),
    ].filter(Boolean),

    server: https ? { https } : undefined,
    preview: https ? { https } : undefined,

    define: {
      global: "globalThis",
    },

    worker: {
      format: "es",
    },

    build: {
      sourcemap: !isSingleFile,
      outDir: "./dist",
      emptyOutDir: true,
      chunkSizeWarningLimit: 1500,
    },

    optimizeDeps: {
      exclude: ["wasm-git"],
    },
  };
});
