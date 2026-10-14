import { requestApi, requestPdfReport } from "@/lib/api/client";

export function downloadPdfReport(signal?: AbortSignal) {
  return requestPdfReport(signal);
}

export function downloadJsonReport(signal?: AbortSignal) {
  return requestApi("downloadJsonReport", { signal });
}

export function saveReportFile(blob: Blob, format: "pdf" | "json") {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `cloudguard-report.${format}`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
