/**
 * Help → System Diagnostics.
 *
 * Surfaces the browser capabilities HTMLRunner depends on (all of which are
 * gated behind a secure context) plus the git backend actually in use, so
 * "why is git/preview broken on this machine?" has an answer in the UI.
 */
import { capabilityReport, detectCapabilities } from "./capabilities";
import { gitFallbackReason, gitVariant } from "./git-service";
import { showInfoDialog } from "./dialogs";

export function showDiagnostics(): void {
  const caps = detectCapabilities();
  const report = capabilityReport(caps, gitVariant());
  const fallback = gitFallbackReason();
  showInfoDialog(
    "System Diagnostics",
    fallback ? `${report}\n\nGit note: ${fallback}` : report,
  );
}
