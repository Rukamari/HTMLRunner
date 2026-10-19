import { consoleInterceptor, navigationInterceptor } from "./console";
import { showLoading, showError, hideLoading, switchOutput } from "./ui";
import { clearConsole, logConsoleError } from "./console";
import { filesState, activeFileState } from "./appState";
import { getVFS, isContainerReady } from "./container";
import { getById } from "./dom";
import { marked } from "marked";
import type { ViteDevServer, ServerBridge } from "almostnode";
import type { FileTab } from "./types";

let devServer: ViteDevServer | null = null;
let serverBridge: ServerBridge | null = null;
let previewReady = false;

async function ensureDevServer(): Promise<boolean> {
  if (devServer && previewReady) return true;
  if (!isContainerReady()) return false;

  try {
    const { ViteDevServer, getServerBridge } = await import("almostnode");
    const vfs = getVFS();

    if (!serverBridge) {
      serverBridge = getServerBridge();
      await serverBridge.initServiceWorker();
    }

    if (!devServer) {
      const server = new ViteDevServer(vfs, { port: 3000, root: "/sandbox" });
      devServer = server;
      serverBridge.registerServer(
        {
          get listening() {
            return server.isRunning();
          },
          address: () => ({
            port: server.getPort(),
            address: "0.0.0.0",
            family: "IPv4",
          }),
          handleRequest: (method, url, headers, body) =>
            server.handleRequest(
              method,
              url,
              headers,
              typeof body === "string" ? undefined : body,
            ),
        },
        3000,
      );
    }

    if (!previewReady) {
      devServer.start();
      previewReady = true;
    }

    return true;
  } catch (err) {
    console.error("Failed to start dev server:", err);
    return false;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function safeUrl(url: string): string {
  const stripped = url.trim();
  try {
    const parsed = new URL(stripped);
    if (["http:", "https:", "mailto:"].includes(parsed.protocol)) return stripped;
    return "#";
  } catch {
    return stripped;
  }
}

marked.use({
  renderer: {
    link({ href, title, text }) {
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
      return `<a href="${safeUrl(href || "")}" target="_blank" rel="noopener noreferrer"${titleAttr}>${text}</a>`;
    },
    image({ href, title, text }) {
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
      return `<img src="${safeUrl(href || "")}" alt="${escapeHtml(text || "")}" loading="lazy"${titleAttr}>`;
    },
  },
});

export function renderMarkdownPreview(md: string): string {
  return `<div class="md-preview">${marked.parse(md, { async: false })}</div>`;
}

let prevMdBlobUrl: string | null = null;

function renderMarkdownInPreview(md: string): void {
  const preview = getById("preview", HTMLIFrameElement);
  if (!preview) return;
  const isDark = document.body.classList.contains("dark-mode");
  const css = isDark
    ? "body{background:#1e1e1e;color:#e0e0e0}pre,code{background:#2d2d2d}blockquote{color:#999}h1,h2,h3{border-bottom-color:#333}td,th{border-color:#444}th{background:#2d2d2d}hr{border-top-color:#333}"
    : "";
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
body{font-family:system-ui,sans-serif;max-width:800px;margin:0 auto;padding:20px;line-height:1.8;color:#333;background:#fff}
pre{background:#f5f5f5;padding:16px;border-radius:6px;overflow-x:auto}
code{background:#f0f0f0;padding:2px 6px;border-radius:3px;font-size:0.9em}
pre code{background:none;padding:0}
img{max-width:100%;border-radius:4px}
blockquote{border-left:4px solid #2196F3;margin:16px 0;padding:8px 20px;color:#666}
h1,h2,h3{border-bottom:1px solid #eee;padding-bottom:8px;margin-top:24px}
table{border-collapse:collapse;width:100%;margin:16px 0}
td,th{border:1px solid #ddd;padding:10px;text-align:left}
th{background:#f5f5f5}
hr{border:none;border-top:2px solid #eee;margin:24px 0}
a{color:#2196F3}
${css}
</style>
</head>
<body>${renderMarkdownPreview(md)}</body>
</html>`;
  if (prevMdBlobUrl) URL.revokeObjectURL(prevMdBlobUrl);
  const blob = new Blob([html], { type: "text/html; charset=utf-8" });
  const url = URL.createObjectURL(blob);
  prevMdBlobUrl = url;
  preview.src = url;
}

type PrettierBundle = {
  prettier: typeof import("prettier/standalone");
  parserHtml: typeof import("prettier/plugins/html");
  parserCss: typeof import("prettier/plugins/postcss");
  parserBabel: typeof import("prettier/plugins/babel");
  prettierPluginEstree: typeof import("prettier/plugins/estree");
};

let prettierBundlePromise: Promise<PrettierBundle> | undefined;

type ModuleWithDefault<T> = T & { default?: T };

function moduleDefault<T>(module: ModuleWithDefault<T>): T {
  return module.default ?? module;
}

async function loadPrettierBundle(): Promise<PrettierBundle> {
  if (!prettierBundlePromise) {
    prettierBundlePromise = Promise.all([
      import("prettier/standalone"),
      import("prettier/plugins/html"),
      import("prettier/plugins/postcss"),
      import("prettier/plugins/babel"),
      import("prettier/plugins/estree"),
    ])
      .then(
        ([prettier, parserHtml, parserCss, parserBabel, prettierPluginEstree]) => ({
          prettier,
          parserHtml,
          parserCss,
          parserBabel,
          prettierPluginEstree,
        }),
      )
      .catch((err) => {
        prettierBundlePromise = undefined;
        throw err;
      });
  }
  return prettierBundlePromise;
}

export async function runCode(): Promise<void> {
  showLoading();
  try {
    clearConsole();
    const files = filesState.get();
    if (files.length === 0) {
      hideLoading();
      return;
    }

    const js = files.find((f) => /\.m?js$/i.test(f.name))?.content ?? "";
    if (js.trim()) {
      try {
        new Function(js);
      } catch (syntaxError: unknown) {
        const msg = syntaxError instanceof Error ? syntaxError.message : String(syntaxError);
        logConsoleError(`SyntaxError: ${msg}`);
        hideLoading();
        return;
      }
    }

    const activeId = activeFileState.get();
    const activeFile = files.find((f) => f.id === activeId);
    if (activeFile && /\.md$/i.test(activeFile.name)) {
      renderMarkdownInPreview(activeFile.content);
      switchOutput("preview");
      return;
    }

    const preview = getById("preview", HTMLIFrameElement);
    if (!preview) throw new Error("Preview element not found");

    const serverReady = await ensureDevServer();
    const server = devServer;
    if (serverReady && server) {
      syncFilesToDevServer(files);
      preview.src = `/__virtual__/3000/`;
      preview.onload = () => {
        const target = preview.contentWindow;
        if (!target) return;
        try {
          server.setHMRTarget(target);
        } catch {
          // HMR is best-effort; the preview still renders without it
        }
      };
    } else {
      runBlobFallback(files, preview);
    }

    switchOutput("preview");
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    showError(`Error running code: ${msg}`);
  } finally {
    hideLoading();
  }
}

function syncFilesToDevServer(files: FileTab[]): void {
  if (!devServer) return;
  const vfs = getVFS();
  for (const file of files) {
    const dir = file.name.substring(0, file.name.lastIndexOf("/"));
    if (dir) {
      try {
        vfs.mkdirSync(`/sandbox/${dir}`, { recursive: true });
      } catch {
      }
    }
    const content = /\.html?$/i.test(file.name)
      ? injectInterceptors(file.content)
      : file.content;
    try {
      vfs.writeFileSync(`/sandbox/${file.name}`, content);
    } catch {
    }
  }
}

export function injectInterceptors(html: string): string {
  const script = `<script>${consoleInterceptor}${navigationInterceptor}</script>`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (match) => `${match}\n${script}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (match) => `${match}\n<head>\n${script}\n</head>`);
  }
  return [
    '<!DOCTYPE html><html><head><meta charset="UTF-8">',
    script,
    "</head><body>",
    html,
    "</body></html>",
  ].join("\n");
}

function inlineCssFiles(files: FileTab[]): string {
  return files
    .filter((f) => /\.css$/i.test(f.name) && f.content.trim())
    .map((f) => `<style>${f.content}</style>`)
    .join("\n");
}

function inlineJsFiles(files: FileTab[]): string {
  return files
    .filter((f) => /\.m?js$/i.test(f.name) && f.content.trim())
    .map((f) => `<script>${f.content}</script>`)
    .join("\n");
}

let prevBlobUrl: string | null = null;

function runBlobFallback(files: FileTab[], preview: HTMLIFrameElement): void {
  const htmlFile = files.find((f) => /\.html?$/i.test(f.name));
  const rawHtml = htmlFile?.content ?? "";
  const hasDocTag = /<html[\s>/]|<!doctype\s+html/i.test(rawHtml);

  const cssInlined = inlineCssFiles(files);
  const jsInlined = inlineJsFiles(files);

  const docContent = hasDocTag
    ? injectBlobHtml(rawHtml, cssInlined, jsInlined)
    : [
        '<!DOCTYPE html><html><head><meta charset="UTF-8">',
        `<script>${consoleInterceptor}${navigationInterceptor}</script>`,
        cssInlined,
        "</head><body>",
        rawHtml,
        jsInlined,
        "</body></html>",
      ].filter(Boolean).join("");

  if (prevBlobUrl) URL.revokeObjectURL(prevBlobUrl);
  const blob = new Blob([docContent], { type: "text/html; charset=utf-8" });
  const url = URL.createObjectURL(blob);
  prevBlobUrl = url;
  preview.src = url;
}

function injectBlobHtml(html: string, cssInlined: string, jsInlined: string): string {
  let result = injectInterceptors(html);

  if (cssInlined) {
    result = /<\/head\s*>/i.test(result)
      ? result.replace(/<\/head\s*>/i, (match) => `${cssInlined}\n${match}`)
      : `${cssInlined}\n${result}`;
  }

  if (jsInlined) {
    result = /<\/body\s*>/i.test(result)
      ? result.replace(/<\/body\s*>/i, (match) => `${jsInlined}\n${match}`)
      : `${result}\n${jsInlined}`;
  }

  return result;
}

export async function formatCode(): Promise<void> {
  try {
    const {
      prettier,
      parserHtml,
      parserCss,
      parserBabel,
      prettierPluginEstree,
    } = await loadPrettierBundle();

    const pHtml = moduleDefault(parserHtml);
    const pCss = moduleDefault(parserCss);
    const pBabel = moduleDefault(parserBabel);
    const pEstree = moduleDefault(prettierPluginEstree);

    const files = filesState.get();

    const formatFile = async (file: FileTab): Promise<string> => {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const content = file.content.trim();
      if (!content) return file.content;

      try {
        switch (ext) {
          case "html":
          case "htm":
            return await prettier.format(content, {
              parser: "html",
              plugins: [pHtml],
              printWidth: 120,
              tabWidth: 4,
              htmlWhitespaceSensitivity: "ignore",
              bracketSameLine: true,
              singleAttributePerLine: false,
            });
          case "css":
            return await prettier.format(content, {
              parser: "css",
              plugins: [pCss],
              printWidth: 100,
              tabWidth: 2,
            });
          case "js":
          case "mjs":
          case "cjs":
          case "jsx":
            return await prettier.format(content, {
              parser: "babel",
              plugins: [pBabel, pEstree],
              printWidth: 100,
              tabWidth: 2,
              semi: true,
              singleQuote: true,
              trailingComma: "es5",
              bracketSpacing: true,
            });
          case "ts":
          case "tsx":
            try {
              return await prettier.format(content, {
                parser: "babel-ts",
                plugins: [pBabel, pEstree],
                printWidth: 100,
                tabWidth: 2,
                semi: true,
                singleQuote: true,
              });
            } catch {
              return file.content;
            }
          default:
            return file.content;
        }
      } catch {
        return file.content;
      }
    };

    const updated = await Promise.all(
      files.map(async (file) => ({
        ...file,
        content: await formatFile(file),
      })),
    );
    filesState.set(updated);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    showError(`Error formatting code: ${msg}`);
  }
}
