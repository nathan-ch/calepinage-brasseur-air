import { getSelectedReportOptions } from "../app/state.js";
import {
  getBrasse2ModelsForCandidate,
  getReportModelHighlights
} from "../core/brasse2.js";
import {
  getCandidateWarnings,
  getVariabilityWarnings
} from "../core/messages.js";
import {
  escapeHtml,
  formatDateTime,
  formatDb,
  formatDiameterCm,
  formatDiameterCmList,
  formatFactor,
  formatMeters,
  formatNumber,
  formatSquareMeters,
  formatTemp
} from "../core/formatters.js";
import {
  svgForCandidate,
  svgForVariabilityDesign
} from "../ui/planSvg.js";

function getAllReportOptions(state) {
  if (!state) {
    return [];
  }

  if (state.kind === "uniformity-ok") {
    return state.candidates || [];
  }

  if (state.kind === "variability-ok") {
    return state.designs || [];
  }

  return [];
}

function getReportOptionNumber(state, option) {
  const index = getAllReportOptions(state).findIndex((item) => item.key === option.key);
  return index >= 0 ? index + 1 : null;
}

function getDistinctCompatibleModels(options, brasse2Models) {
  const modelsById = new Map();

  options.forEach((option) => {
    getBrasse2ModelsForCandidate(option, brasse2Models).forEach((model) => {
      modelsById.set(model.id, model);
    });
  });

  return [...modelsById.values()];
}

function getMaxDiameterSummary(options) {
  const diameters = options.map((option) => option.diameter).filter(Number.isFinite);

  if (diameters.length === 0) {
    return {
      value: "Aucun",
      detail: "Aucun diametre reel compatible"
    };
  }

  const maxDiameter = Math.max(...diameters);
  return {
    value: `${formatDiameterCm(maxDiameter)} cm`,
    detail: "Plus grand diametre reel des options exportees"
  };
}

function renderReportWarningList(items) {
  if (!items || items.length === 0) {
    return "";
  }

  return `
    <div class="report-note report-note-warning">
      <strong>Points d'attention</strong>
      <ul>
        ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </div>
  `;
}

function renderReportSummaryCards(items) {
  return `
    <div class="report-summary-grid">
      ${items
        .map(
          ([label, value, detail]) => `
            <article class="report-summary-card">
              <strong>${escapeHtml(label)}</strong>
              <span>${escapeHtml(value)}</span>
              <small>${escapeHtml(detail)}</small>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderReportMetricGrid(items) {
  return `
    <div class="report-metrics">
      ${items
        .map(
          ([label, value]) => `
            <article class="report-metric">
              <strong>${escapeHtml(label)}</strong>
              <span>${escapeHtml(value)}</span>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderReportTable(headers, rows, compact = false) {
  return `
    <table class="report-table${compact ? " compact" : ""}">
      <thead>
        <tr>
          ${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) => `
              <tr>
                ${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderModelHighlights(option, brasse2Models) {
  const highlights = getReportModelHighlights(option, brasse2Models);
  if (highlights.length === 0) {
    return `
      <div class="report-note">
        <strong>Modeles pre-selectionnes</strong>
        <p>Aucun modele compatible dans la base BRASSE II embarquee sur les diametres admissibles de cette option.</p>
      </div>
    `;
  }

  const rows = highlights.map((entry) => [
    entry.title,
    `${entry.model.brand} ${entry.model.model}`,
    `${entry.model.diameterCm} cm`,
    Number.isFinite(entry.model.compatibleOption.coverageFactor)
      ? formatFactor(entry.model.compatibleOption.coverageFactor)
      : "—",
    formatTemp(entry.model.ceDirDeboutMax),
    `${formatNumber(entry.model.cfeDirDeboutMax, 4)} °C/W`,
    formatDb(entry.model.lwaMaxDbA)
  ]);

  return `
    <section class="report-section">
      <h3>Modeles pre-selectionnes</h3>
      ${renderReportTable(
        ["Lecture", "Marque / modele", "Diam.", "FCC", "CE dir.", "CFE dir.", "LwA"],
        rows,
        true
      )}
    </section>
  `;
}

function renderStudySummarySection(state, selectedOptions, brasse2Models) {
  const roomArea = state.room.length * state.room.width;
  const compatibleModels = getDistinctCompatibleModels(selectedOptions, brasse2Models);
  const maxDiameterSummary = getMaxDiameterSummary(selectedOptions);
  const baseCards = [
    [
      "Piece",
      `${formatMeters(state.room.length)} × ${formatMeters(state.room.width)}`,
      `${formatSquareMeters(roomArea)} - HSP ${formatMeters(state.room.height)}`
    ],
    [
      "Diametre max",
      maxDiameterSummary.value,
      maxDiameterSummary.detail
    ],
    [
      "Base BRASSE II",
      compatibleModels.length > 0 ? `${compatibleModels.length} modeles` : "Aucun modele",
      "Compatibles avec les options exportees"
    ]
  ];

  if (state.kind === "variability-ok") {
    const targetArea = state.zones.reduce((sum, zone) => sum + zone.area, 0);
    baseCards.splice(1, 0, [
      "Zones cibles",
      `${state.zones.length}`,
      `${formatSquareMeters(targetArea)} a couvrir`
    ]);
  }

  return `
    <section class="report-block">
      <h2>Synthese de la piece etudiee</h2>
      ${renderReportSummaryCards(baseCards)}
    </section>
  `;
}

function renderSelectedOptionsOverview(state, selectedOptions) {
  if (selectedOptions.length === 0) {
    return `
      <section class="report-block">
        <h2>Synthese de ou des option(s) retenue(s) :</h2>
        <div class="report-note report-note-warning">
          <strong>Aucune option selectionnee</strong>
          <p>Cochez au moins une option dans l'outil pour l'inclure dans le rapport PDF.</p>
        </div>
      </section>
    `;
  }

  if (state.kind === "uniformity-ok") {
    const rows = selectedOptions.map((option) => [
      `Option ${getReportOptionNumber(state, option)}`,
      `${option.nx} × ${option.ny}`,
      formatMeters(option.diameter),
      option.mountMode.label,
      formatFactor(option.coverageFactor)
    ]);

    return `
      <section class="report-block">
        <h2>Synthese de ou des option(s) retenue(s) :</h2>
        ${renderReportTable(
          ["Option", "Trame", "Diametre reel", "Montage", "FCC reel"],
          rows,
          true
        )}
      </section>
    `;
  }

  const rows = selectedOptions.map((option) => [
    `Option ${getReportOptionNumber(state, option)}`,
    `${option.nx} × ${option.ny}`,
    `${option.fanCount} / ${option.totalCells}`,
    formatMeters(option.diameter),
    option.mountMode.label,
    formatSquareMeters(option.spillArea)
  ]);

  return `
    <section class="report-block">
      <h2>Synthese de ou des option(s) retenue(s) :</h2>
      ${renderReportTable(
        ["Option", "Trame", "Cellules actives", "Diametre reel", "Montage", "Debordement"],
        rows,
        true
      )}
    </section>
  `;
}

function renderZonesSummaryTable(zones) {
  if (!zones || zones.length === 0) {
    return "";
  }

  const rows = zones.map((zone) => [
    zone.name,
    `${formatMeters(zone.length)} × ${formatMeters(zone.width)}`,
    formatSquareMeters(zone.area),
    `${formatMeters(zone.centerX)} ; ${formatMeters(zone.centerY)}`
  ]);

  return `
    <section class="report-block">
      <h2>Zones cibles</h2>
      ${renderReportTable(
        ["Zone", "Dimensions", "Surface", "Centre"],
        rows,
        true
      )}
    </section>
  `;
}

function renderUniformityOptionPage(state, option, brasse2Models) {
  const optionNumber = getReportOptionNumber(state, option);

  return `
    <section class="report-page report-option-page">
      <div class="report-section-head">
        <p class="report-section-kicker">Option ${optionNumber}</p>
        <h2>${escapeHtml(`${option.nx} × ${option.ny} cellules`)}</h2>
        <p>${escapeHtml(`${option.fanCount} brasseur${option.fanCount > 1 ? "s" : ""} • ${option.mountMode.label}`)}</p>
      </div>

      ${renderReportMetricGrid([
        ["Diametre reel retenu", formatMeters(option.diameter)],
        ["Diametre theorique max", formatMeters(option.theoreticalMaxDiameter)],
        ["Facteur de forme", formatFactor(option.formFactor)],
        ["FCC reel", formatFactor(option.coverageFactor)],
        ["Hauteur sous pales", formatMeters(option.bladeHeight)],
        ["Plafond-pales", formatMeters(option.mountDistance)]
      ])}

      <div class="report-plan-block">
        <div class="report-plan">${svgForCandidate(option)}</div>
        <div class="report-side">
          ${renderReportTable(
            ["Lecture", "Valeur"],
            [
              ["Montage", option.mountMode.label],
              ["Cellule", `${formatMeters(option.cellLength)} × ${formatMeters(option.cellWidth)}`],
              ["Mur limitant", `${formatMeters(option.wallClearance)} > ${formatMeters(option.diameter)}`],
              [
                "Entraxe mini",
                option.interFanSpacing
                  ? `${formatMeters(option.interFanSpacing)} > 2,5 × D`
                  : "Non applicable"
              ],
              ["Diametres admissibles", formatDiameterCmList(option.compatibleRealDiameters)]
            ],
            true
          )}
          ${renderReportWarningList(getCandidateWarnings(option))}
        </div>
      </div>

      ${renderModelHighlights(option, brasse2Models)}
    </section>
  `;
}

function renderVariabilityZoneSummary(option) {
  const rows = option.zoneSummaries.map((zoneSummary) => [
    zoneSummary.name,
    `${formatMeters(zoneSummary.length)} × ${formatMeters(zoneSummary.width)}`,
    String(zoneSummary.cellsCount),
    formatSquareMeters(zoneSummary.area),
    formatSquareMeters(zoneSummary.mobilizedArea)
  ]);

  return `
    <section class="report-section">
      <h3>Zones couvertes</h3>
      ${renderReportTable(
        ["Zone", "Dimensions", "Cellules actives", "Surface cible", "Surface mobilisee"],
        rows,
        true
      )}
    </section>
  `;
}

function renderVariabilityOptionPage(state, option, brasse2Models) {
  const optionNumber = getReportOptionNumber(state, option);

  return `
    <section class="report-page report-option-page">
      <div class="report-section-head">
        <p class="report-section-kicker">Option ${optionNumber}</p>
        <h2>${escapeHtml(`${option.nx} × ${option.ny} cellules`)}</h2>
        <p>${escapeHtml(`${option.fanCount} cellule${option.fanCount > 1 ? "s" : ""} active${option.fanCount > 1 ? "s" : ""} • ${option.mountMode.label}`)}</p>
      </div>

      ${renderReportMetricGrid([
        ["Diametre reel retenu", formatMeters(option.diameter)],
        ["Cellules actives", `${option.fanCount} / ${option.totalCells}`],
        ["FCC reel", formatFactor(option.coverageFactor)],
        ["Hauteur sous pales", formatMeters(option.bladeHeight)],
        ["Surface cible", formatSquareMeters(option.targetArea)],
        ["Debordement", formatSquareMeters(option.spillArea)]
      ])}

      <div class="report-plan-block">
        <div class="report-plan">${svgForVariabilityDesign(option)}</div>
        <div class="report-side">
          ${renderReportTable(
            ["Lecture", "Valeur"],
            [
              ["Montage", option.mountMode.label],
              ["Cellule", `${formatMeters(option.cellLength)} × ${formatMeters(option.cellWidth)}`],
              ["Diametre theorique max", formatMeters(option.theoreticalMaxDiameter)],
              ["Mur limitant", `${formatMeters(option.wallClearance)} > ${formatMeters(option.diameter)}`],
              [
                "Entraxe mini",
                option.interFanSpacing
                  ? `${formatMeters(option.interFanSpacing)} > 2,5 × D`
                  : "Non applicable"
              ],
              ["Diametres admissibles", formatDiameterCmList(option.compatibleRealDiameters)]
            ],
            true
          )}
          ${renderReportWarningList(getVariabilityWarnings(option))}
        </div>
      </div>

      ${renderVariabilityZoneSummary(option)}
      ${renderModelHighlights(option, brasse2Models)}
    </section>
  `;
}

function renderReportFirstPage(state, selectedOptions, brasse2Models) {
  return `
    <section class="report-page report-first-page">
      <header class="report-cover">
        <p class="report-cover-kicker">Rapport de simulation • le ${escapeHtml(
          formatDateTime(state.generatedAt)
        )}</p>
        <h1>${escapeHtml(state.simulationName)}</h1>
        <p class="report-cover-lead">
          Synthese de la piece etudiee et des options selectionnees pour l'export PDF.
        </p>
      </header>

      ${renderStudySummarySection(state, selectedOptions, brasse2Models)}
      ${state.kind === "variability-ok" ? renderZonesSummaryTable(state.zones) : ""}
      ${renderSelectedOptionsOverview(state, selectedOptions)}
    </section>
  `;
}

function renderEmptyOrInvalidReport(state) {
  const roomBlock =
    state.room && Number.isFinite(state.room.length)
      ? renderReportSummaryCards([
          [
            "Piece",
            `${formatMeters(state.room.length)} × ${formatMeters(state.room.width)}`,
            `${formatSquareMeters(state.room.length * state.room.width)} - HSP ${formatMeters(
              state.room.height
            )}`
          ]
        ])
      : "";

  let title = "Calcul impossible";
  let text =
    "Les donnees saisies ne permettent pas de produire un rapport de calepinage exploitable.";

  if (state.kind === "uniformity-empty") {
    title = "Aucune solution compatible";
    text =
      "Aucun cas standard ou low-profile n'a pu etre valide avec les regles BRASSE de FCC, de distances et de hauteur.";
  } else if (state.kind === "variability-empty") {
    title = "Aucune trame valide";
    text =
      "Le moteur n'a pas trouve de trame reguliere conforme aux regles BRASSE pour couvrir les zones cibles saisies.";
  }

  return `
    <section class="report-page report-first-page">
      <header class="report-cover">
        <p class="report-cover-kicker">Rapport de simulation • le ${escapeHtml(
          formatDateTime(state.generatedAt)
        )}</p>
        <h1>${escapeHtml(state.simulationName)}</h1>
      </header>
      ${roomBlock}
      <section class="report-block">
        <h2>Conclusion</h2>
        <div class="report-note report-note-warning">
          <strong>${escapeHtml(title)}</strong>
          <p>${escapeHtml(text)}</p>
        </div>
        ${
          state.issues?.length
            ? `
              <div class="report-note" style="margin-top: 10px;">
                <strong>Points releves</strong>
                <ul>
                  ${state.issues.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
                </ul>
              </div>
            `
            : ""
        }
      </section>
    </section>
  `;
}

export function buildPdfReportStyles() {
  return `
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", Arial, sans-serif;
      color: #17212b;
      background: #ffffff;
      line-height: 1.45;
    }
    .report-root {
      max-width: 186mm;
      margin: 0 auto;
    }
    .report-page + .report-page {
      break-before: page;
      page-break-before: always;
    }
    .report-cover {
      display: grid;
      gap: 8px;
      padding-bottom: 12px;
      border-bottom: 1px solid #d6d9df;
      margin-bottom: 16px;
    }
    .report-cover-kicker,
    .report-section-kicker {
      margin: 0;
      color: #6b7280;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    .report-cover h1,
    .report-section-head h2 {
      margin: 0;
      font-size: 22px;
      line-height: 1.15;
    }
    .report-cover-lead {
      margin: 0;
      color: #4b5563;
      font-size: 12px;
    }
    .report-section-head p {
      margin: 4px 0 0;
      color: #4b5563;
      font-size: 12px;
    }
    .report-summary-grid,
    .report-metrics {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .report-summary-card,
    .report-metric {
      border: 1px solid #d6d9df;
      border-radius: 10px;
      padding: 10px 12px;
      background: #f8fafc;
    }
    .report-summary-card strong,
    .report-metric strong {
      display: block;
      margin-bottom: 4px;
      color: #6b7280;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .report-summary-card span,
    .report-metric span {
      display: block;
      font-size: 13px;
      font-weight: 700;
      color: #111827;
    }
    .report-summary-card small {
      display: block;
      margin-top: 4px;
      color: #4b5563;
      font-size: 11px;
      line-height: 1.4;
    }
    .report-block,
    .report-section,
    .report-note,
    .report-plan-block {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .report-block + .report-block,
    .report-section + .report-section {
      margin-top: 16px;
    }
    .report-block h2,
    .report-section h3 {
      margin: 0 0 10px;
      font-size: 15px;
      line-height: 1.25;
    }
    .report-section-head {
      display: grid;
      gap: 2px;
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid #d6d9df;
    }
    .report-plan-block {
      display: grid;
      gap: 14px;
      grid-template-columns: minmax(0, 1.25fr) minmax(0, 0.95fr);
      align-items: start;
      margin-top: 12px;
    }
    .report-plan {
      border: 1px solid #d6d9df;
      border-radius: 10px;
      padding: 10px;
      background: #f8fafc;
    }
    .report-plan svg {
      width: 100%;
      height: auto;
      display: block;
    }
    .report-side {
      display: grid;
      gap: 10px;
    }
    .report-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    .report-table th,
    .report-table td {
      padding: 8px 9px;
      border: 1px solid #d6d9df;
      vertical-align: top;
      text-align: left;
    }
    .report-table th {
      background: #f8fafc;
      color: #374151;
      font-weight: 700;
    }
    .report-table.compact th,
    .report-table.compact td {
      padding: 7px 8px;
      font-size: 10.5px;
    }
    .report-note {
      border: 1px solid #d6d9df;
      border-radius: 10px;
      padding: 10px 12px;
      background: #f8fafc;
    }
    .report-note-warning {
      background: #fff6e5;
      border-color: rgba(184, 109, 33, 0.24);
    }
    .report-note strong {
      display: block;
      margin-bottom: 6px;
      font-size: 11px;
    }
    .report-note p,
    .report-note ul {
      margin: 0;
      color: #4b5563;
      font-size: 11px;
    }
    .report-note ul {
      padding-left: 16px;
    }
    .report-footer {
      margin-top: 18px;
      padding-top: 10px;
      border-top: 1px solid #d6d9df;
      color: #4b5563;
      font-size: 10.5px;
    }
    .report-footer a {
      color: #1f4f82;
      text-decoration: none;
    }
    @media print {
      .report-root {
        max-width: none;
      }
    }
  `;
}

export function buildPdfFilename(simulationName) {
  const base = simulationName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  const stamp = new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
  return `${base || "simulation"}-${stamp}`;
}

export function buildPdfReportDocument(state, brasse2Models) {
  if (!state) {
    return "";
  }

  const selectedOptions = getSelectedReportOptions(state);
  let bodyContent = "";

  if (state.kind === "uniformity-ok") {
    bodyContent = `
      ${renderReportFirstPage(state, selectedOptions, brasse2Models)}
      ${selectedOptions
        .map((option) => renderUniformityOptionPage(state, option, brasse2Models))
        .join("")}
    `;
  } else if (state.kind === "variability-ok") {
    bodyContent = `
      ${renderReportFirstPage(state, selectedOptions, brasse2Models)}
      ${selectedOptions
        .map((option) => renderVariabilityOptionPage(state, option, brasse2Models))
        .join("")}
    `;
  } else {
    bodyContent = renderEmptyOrInvalidReport(state);
  }

  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(buildPdfFilename(state.simulationName))}</title>
      <style>${buildPdfReportStyles()}</style>
    </head>
    <body>
      <main class="report-root">
        ${bodyContent}
        <footer class="report-footer">
          Fait par Nathan Château, <a href="mailto:chateaunathan@proton.me">chateaunathan@proton.me</a>
        </footer>
      </main>
    </body>
    </html>
  `;
}

export function exportPdfReport(latestReportState, brasse2Models) {
  if (!latestReportState) {
    return;
  }

  const reportHtml = buildPdfReportDocument(latestReportState, brasse2Models);
  if (typeof window.open === "function") {
    const popup = window.open("", "_blank");
    if (popup && popup.document) {
      const triggerPrint = () => {
        try {
          popup.focus();
          popup.print();
        } catch (error) {
          console.error("Impossible de lancer l'impression du rapport.", error);
        }
      };

      popup.onload = () => {
        window.setTimeout(triggerPrint, 150);
      };
      popup.document.open();
      popup.document.write(reportHtml);
      popup.document.close();
      window.setTimeout(triggerPrint, 600);
      return;
    }
  }

  if (typeof window.print === "function") {
    window.print();
  }
}
