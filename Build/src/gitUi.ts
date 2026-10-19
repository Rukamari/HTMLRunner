import {
  gitClone,
  gitCommit,
  gitDiff,
  gitLog,
  gitPull,
  gitPush,
  gitStatus,
  gitStatusPorcelain,
  isGitReady,
  syncAllFilesToWorker,
} from "./git-service";
import { showError, showLoading, showSuccess, hideLoading } from "./ui";
import { showInfoDialog } from "./dialogs";
import { gitStatusBadgeClass, parsePorcelainStatus } from "./gitStatus";

export function renderGitStatus(container: HTMLElement, statusText: string): void {
  container.innerHTML = "";
  const entries = parsePorcelainStatus(statusText);
  if (entries.length === 0) {
    container.innerHTML = '<span class="git-status-empty">No changes</span>';
    return;
  }
  for (const entry of entries) {
    const item = document.createElement("div");
    item.className = "git-status-item";
    item.title = entry.path;

    const badge = document.createElement("span");
    badge.className = `git-badge git-badge-${gitStatusBadgeClass(entry.code)}`;
    badge.textContent = entry.code;
    item.appendChild(badge);

    const name = document.createElement("span");
    name.className = "git-status-filename";
    name.textContent = entry.path;
    item.appendChild(name);

    container.appendChild(item);
  }
}

export async function refreshGitStatus(): Promise<void> {
  const statusEl = document.getElementById("git-status");
  if (!statusEl) return;
  try {
    const output = await gitStatusPorcelain();
    renderGitStatus(statusEl, output);
  } catch {
  }
}

export async function showGitStatus(): Promise<void> {
  try {
    const output = await gitStatus();
    showInfoDialog("Git Status", output || "No changes (clean working tree)");
  } catch {
    showError("Failed to get git status");
  }
}

export async function showGitDiff(): Promise<void> {
  try {
    const diff = await gitDiff();
    if (!diff) {
      showInfoDialog("Git Diff", "No differences found.");
      return;
    }
    showInfoDialog("Git Diff", diff);
  } catch {
    showError("Failed to get git diff");
  }
}

export async function showGitLog(): Promise<void> {
  try {
    const log = await gitLog();
    if (!log || log.trim().length === 0) {
      showInfoDialog("Git Log", "No commits yet.");
      return;
    }
    showInfoDialog("Git Log", log);
  } catch {
    showError("Failed to get git log");
  }
}

export async function commitAction(): Promise<void> {
  const msg = prompt("Commit message:", "Update files");
  if (!msg || !msg.trim()) return;
  try {
    await syncAllFilesToWorker();
    const sha = await gitCommit(msg.trim());
    showSuccess(`Committed: ${sha.slice(0, 7)}`);
    await refreshGitStatus();
  } catch (err) {
    console.error("Commit failed:", err);
    showError("Commit failed");
  }
}

export async function pushAction(): Promise<void> {
  const remote = prompt("Remote name:", "origin") || "origin";
  const ref = prompt("Branch to push:", "main") || "main";
  try {
    showLoading();
    await syncAllFilesToWorker();
    await gitPush(remote, ref);
    showSuccess(`Pushed to ${remote}/${ref}`);
  } catch (err) {
    console.error("Push failed:", err);
    showError(`Push failed: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    hideLoading();
  }
}

export async function pullAction(): Promise<void> {
  const remote = prompt("Remote name:", "origin") || "origin";
  const ref = prompt("Branch to pull:", "main") || "main";
  try {
    showLoading();
    await gitPull(remote, ref);
    showSuccess(`Pulled from ${remote}/${ref}`);
    await refreshGitStatus();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    showError(`Pull failed: ${msg}`);
  } finally {
    hideLoading();
  }
}

export async function cloneAction(): Promise<void> {
  const url = prompt("Clone repository URL:");
  if (!url) return;
  try {
    showLoading();
    await gitClone(url);
    showSuccess("Repository cloned");
    await refreshGitStatus();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    showError(`Clone failed: ${msg}`);
  } finally {
    hideLoading();
  }
}

export function startGitStatusPolling(intervalMs = 5000): () => void {
  const timer = setInterval(() => {
    if (isGitReady()) {
      refreshGitStatus().catch((err) =>
        console.warn("Git status refresh failed:", err),
      );
    }
  }, intervalMs);
  return () => clearInterval(timer);
}
