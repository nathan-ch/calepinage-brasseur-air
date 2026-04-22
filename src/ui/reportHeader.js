import { escapeHtml, formatDateTime } from "../core/formatters.js";

export function refreshReportHeader(
  dom,
  { simulationName, strategyLabel, modesLabel, recommendation = "", generatedAt = new Date() }
) {
  dom.reportKicker.textContent = `Rapport de simulation • le ${formatDateTime(generatedAt)}`;
  dom.reportTitle.textContent = simulationName;
  dom.reportContext.textContent = [strategyLabel, recommendation, modesLabel]
    .filter(Boolean)
    .join(" • ");

  const metaItems = [];
  dom.reportMeta.innerHTML = metaItems
    .map(
      ([label, value]) => `
        <article class="report-meta-card">
          <strong>${escapeHtml(label)}</strong>
          <span>${escapeHtml(value)}</span>
        </article>
      `
    )
    .join("");
  dom.reportMeta.classList.toggle("hidden", metaItems.length === 0);
}

export function setExportAvailability(dom, enabled) {
  dom.exportPdfButton.disabled = !enabled;
}
