/**
 * File Download Utilities
 *
 * Shared helpers for downloading files (JSON, Blob) in the browser.
 * Used by export features across journeys, workflows, and sessions.
 *
 * @module shared/lib/utils/file-download
 */

/**
 * Download JSON data as a file
 *
 * @param data - Data to serialize to JSON
 * @param filename - Name for the downloaded file
 */
export function downloadJson(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  downloadBlob(blob, filename);
}

/**
 * Download a blob as a file
 *
 * Creates a temporary link element to trigger the download,
 * then cleans up after a short delay to handle any browser timing issues.
 *
 * @param blob - Blob data to download
 * @param filename - Name for the downloaded file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Delay URL revocation to handle potential race conditions
  // Some browsers may not have completed the download when click() returns
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
