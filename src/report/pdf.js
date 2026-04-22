import { getReportModelHighlights } from "../core/brasse2.js";
import { getCandidateWarnings, getVariabilityWarnings } from "../core/messages.js";
import {
  escapeHtml,
  formatDateTime,
  formatDb,
  formatDiameterCmList,
  formatFactor,
  formatMeters,
  formatNumber,
  formatSquareMeters,
  formatTemp
} from "../core/formatters.js";
import { svgForCandidate, svgForVariabilityDesign } from "../ui/planSvg.js";

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

function renderReportModelHighlights(candidate, brasse2Models) {
  const highlights = getReportModelHighlights(candidate, brasse2Models);
  if (highlights.length === 0) {
    return `
      <div class="report-note">
        <strong>Modeles BRASSE II</strong>
        <p>Aucun modele compatible dans la base embarquee sur les diametres admissibles.</p>
      </div>
    `;
  }

  return `
    <section class="report-section">
      <h4>Selection BRASSE II</h4>
      <table class="report-table compact">
        <thead>
          <tr>
            <th>Lecture</th>
            <th>Marque / modele</th>
            <th>Diam.</th>
            <th>FCC</th>
            <th>CE dir.</th>
            <th>CFE dir.</th>
            <th>LwA</th>
          </tr>
        </thead>
        <tbody>
          ${highlights
            .map(
              (entry) => `
                <tr>
                  <td>${escapeHtml(entry.title)}</td>
                  <td>${escapeHtml(`${entry.model.brand} ${entry.model.model}`)}</td>
                  <td>${escapeHtml(String(entry.model.diameterCm))}</td>
                  <td>${escapeHtml(Number.isFinite(entry.model.compatibleOption.coverageFactor) ? formatFactor(entry.model.compatibleOption.coverageFactor) : "—")}</td>
                  <td>${escapeHtml(formatTemp(entry.model.ceDirDeboutMax))}</td>
                  <td>${escapeHtml(`${formatNumber(entry.model.cfeDirDeboutMax, 4)} °C/W`)}</td>
                  <td>${escapeHtml(formatDb(entry.model.lwaMaxDbA))}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </section>
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

function renderUniformityReportOptions(candidates, brasse2Models) {
  return candidates
    .map(
      (candidate, index) => `
        <section class="report-option">
          <div class="report-option-head">
            <div>
              <h3>Option ${index + 1}</h3>
              <p>${escapeHtml(`${candidate.fanCount} brasseur${candidate.fanCount > 1 ? "s" : ""} sur ${candidate.nx} × ${candidate.ny} cellules - ${candidate.mountMode.label}`)}</p>
            </div>
          </div>

          ${renderReportMetricGrid([
            ["Diametre retenu", formatMeters(candidate.diameter)],
            ["Diametre theorique max", formatMeters(candidate.theoreticalMaxDiameter)],
            ["FCC reel", formatFactor(candidate.coverageFactor)],
            ["Cellule", `${formatMeters(candidate.cellLength)} × ${formatMeters(candidate.cellWidth)}`],
            ["Mur limitant", formatMeters(candidate.wallClearance)],
            ["Entraxe mini", candidate.interFanSpacing ? formatMeters(candidate.interFanSpacing) : "Non applicable"]
          ])}

          <div class="report-plan-block">
            <div class="report-plan">${svgForCandidate(candidate)}</div>
            <div class="report-side">
              <table class="report-table">
                <tbody>
                  <tr>
                    <th>Montage</th>
                    <td>${escapeHtml(`${candidate.mountMode.label} (${formatMeters(candidate.mountDistance)})`)}</td>
                  </tr>
                  <tr>
                    <th>Hauteur sous pales</th>
                    <td>${escapeHtml(formatMeters(candidate.bladeHeight))}</td>
                  </tr>
                  <tr>
                    <th>Facteur de forme</th>
                    <td>${escapeHtml(formatFactor(candidate.formFactor))}</td>
                  </tr>
                  <tr>
                    <th>Diametres admissibles</th>
                    <td>${escapeHtml(formatDiameterCmList(candidate.compatibleRealDiameters))}</td>
                  </tr>
                </tbody>
              </table>
              ${renderReportWarningList(getCandidateWarnings(candidate))}
            </div>
          </div>

          ${renderReportModelHighlights(candidate, brasse2Models)}
        </section>
      `
    )
    .join("");
}

function renderVariabilityZoneSummaryTable(design) {
  return `
    <section class="report-section">
      <h4>Zones couvertes</h4>
      <table class="report-table compact">
        <thead>
          <tr>
            <th>Zone</th>
            <th>Dimensions</th>
            <th>Cellules actives</th>
            <th>Surface cible</th>
            <th>Surface mobilisee</th>
          </tr>
        </thead>
        <tbody>
          ${design.zoneSummaries
            .map(
              (zoneSummary) => `
                <tr>
                  <td>${escapeHtml(zoneSummary.name)}</td>
                  <td>${escapeHtml(`${formatMeters(zoneSummary.length)} × ${formatMeters(zoneSummary.width)}`)}</td>
                  <td>${escapeHtml(String(zoneSummary.cellsCount))}</td>
                  <td>${escapeHtml(formatSquareMeters(zoneSummary.area))}</td>
                  <td>${escapeHtml(formatSquareMeters(zoneSummary.mobilizedArea))}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </section>
  `;
}

function renderVariabilityReportOptions(designs, brasse2Models) {
  return designs
    .map(
      (design, index) => `
        <section class="report-option">
          <div class="report-option-head">
            <div>
              <h3>Option ${index + 1}</h3>
              <p>${escapeHtml(`${design.fanCount} brasseur${design.fanCount > 1 ? "s" : ""} actifs sur ${design.nx} × ${design.ny} cellules - ${design.mountMode.label}`)}</p>
            </div>
          </div>

          ${renderReportMetricGrid([
            ["Diametre retenu", formatMeters(design.diameter)],
            ["Trame", `${design.nx} × ${design.ny}`],
            ["Cellules actives", `${design.fanCount} / ${design.totalCells}`],
            ["FCC reel", formatFactor(design.coverageFactor)],
            ["Surface cible", formatSquareMeters(design.targetArea)],
            ["Debordement", formatSquareMeters(design.spillArea)]
          ])}

          <div class="report-plan-block">
            <div class="report-plan">${svgForVariabilityDesign(design)}</div>
            <div class="report-side">
              <table class="report-table">
                <tbody>
                  <tr>
                    <th>Cellule</th>
                    <td>${escapeHtml(`${formatMeters(design.cellLength)} × ${formatMeters(design.cellWidth)}`)}</td>
                  </tr>
                  <tr>
                    <th>Montage</th>
                    <td>${escapeHtml(`${design.mountMode.label} (${formatMeters(design.mountDistance)})`)}</td>
                  </tr>
                  <tr>
                    <th>Diametres admissibles</th>
                    <td>${escapeHtml(formatDiameterCmList(design.compatibleRealDiameters))}</td>
                  </tr>
                  <tr>
                    <th>Mur limitant</th>
                    <td>${escapeHtml(formatMeters(design.wallClearance))}</td>
                  </tr>
                  <tr>
                    <th>Entraxe mini</th>
                    <td>${escapeHtml(design.interFanSpacing ? formatMeters(design.interFanSpacing) : "Non applicable")}</td>
                  </tr>
                </tbody>
              </table>
              ${renderReportWarningList(getVariabilityWarnings(design))}
            </div>
          </div>

          ${renderVariabilityZoneSummaryTable(design)}
          ${renderReportModelHighlights(design, brasse2Models)}
        </section>
      `
    )
    .join("");
}

export function buildPdfReportStyles() {
  return `
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, "Segoe UI", Arial, sans-serif;
      color: #111827;
      background: #ffffff;
      line-height: 1.45;
    }
    .report-root { max-width: 190mm; margin: 0 auto; }
    .report-cover {
      display: grid;
      gap: 14px;
      padding-bottom: 14px;
      border-bottom: 2px solid #d6d9df;
      margin-bottom: 18px;
    }
    .report-cover-kicker {
      margin: 0;
      color: #6b7280;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .report-cover h1 {
      margin: 0;
      font-size: 24px;
      line-height: 1.15;
    }
    .report-cover p {
      margin: 0;
      color: #4b5563;
      font-size: 13px;
    }
    .report-meta-grid,
    .report-metrics {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .report-meta-item,
    .report-metric {
      border: 1px solid #d6d9df;
      border-radius: 10px;
      padding: 10px 12px;
      background: #f9fafb;
    }
    .report-meta-item strong,
    .report-metric strong {
      display: block;
      margin-bottom: 4px;
      color: #6b7280;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .report-meta-item span,
    .report-metric span {
      display: block;
      font-size: 13px;
      font-weight: 600;
    }
    .report-block,
    .report-option,
    .report-section,
    .report-note {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .report-block {
      margin-bottom: 18px;
    }
    .report-block h2 {
      margin: 0 0 10px;
      font-size: 17px;
    }
    .report-block > p {
      margin: 0;
      color: #4b5563;
      font-size: 12px;
    }
    .report-option {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #d6d9df;
    }
    .report-option-head h3 {
      margin: 0;
      font-size: 16px;
    }
    .report-option-head p {
      margin: 4px 0 0;
      color: #4b5563;
      font-size: 12px;
    }
    .report-plan-block {
      display: grid;
      gap: 14px;
      grid-template-columns: minmax(0, 1.3fr) minmax(0, 0.9fr);
      align-items: start;
      margin-top: 12px;
    }
    .report-plan {
      border: 1px solid #d6d9df;
      border-radius: 10px;
      padding: 10px;
      background: #f9fafb;
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
      padding: 8px 10px;
      border: 1px solid #d6d9df;
      vertical-align: top;
      text-align: left;
    }
    .report-table th {
      background: #f9fafb;
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
      background: #f9fafb;
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
      margin-top: 20px;
      padding-top: 12px;
      border-top: 1px solid #d6d9df;
      color: #4b5563;
      font-size: 10.5px;
    }
    .report-footer a {
      color: #1f4f82;
      text-decoration: none;
    }
    @media print {
      .report-root { max-width: none; }
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

  const metaItems = [["Simulation", state.simulationName]];
  let bodyContent = "";

  if (state.kind === "uniformity-ok") {
    const best = state.candidates[0];
    bodyContent = `
      <section class="report-block">
        <h2>Synthese</h2>
        ${renderReportMetricGrid([
          ["Option recommandee", `${best.nx} × ${best.ny}`],
          ["Brasseurs", `${best.fanCount}`],
          ["Diametre retenu", formatMeters(best.diameter)],
          ["FCC reel", formatFactor(best.coverageFactor)],
          ["Montage", best.mountMode.label],
          ["Modeles BRASSE II", `${getReportModelHighlights(best, brasse2Models).length}`]
        ])}
      </section>

      <section class="report-block">
        <h2>Options classees</h2>
        ${renderUniformityReportOptions(state.candidates, brasse2Models)}
      </section>
    `;
  } else if (state.kind === "uniformity-empty") {
    bodyContent = `
      <section class="report-block">
        <h2>Conclusion</h2>
        <div class="report-note report-note-warning">
          <strong>Aucune solution compatible</strong>
          <p>Aucun cas standard ou low-profile n'a pu etre valide avec les regles BRASSE de FCC, de distances et de hauteur.</p>
        </div>
        ${state.fallbackFlush ? `
          <div class="report-note" style="margin-top:10px;">
            <strong>Piste flush</strong>
            <p>Un montage flush pourrait rouvrir une piste jusqu'a ${escapeHtml(formatMeters(state.fallbackFlush.diameter))}, avec la forte penalite de performance indiquee par le guide.</p>
          </div>
        ` : ""}
        ${state.issues?.length ? `
          <div class="report-note" style="margin-top:10px;">
            <strong>Motifs releves</strong>
            <ul>
              ${state.issues.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          </div>
        ` : ""}
      </section>
    `;
  } else if (state.kind === "variability-ok") {
    const best = state.designs[0];
    bodyContent = `
      <section class="report-block">
        <h2>Synthese</h2>
        ${renderReportMetricGrid([
          ["Option recommandee", `${best.nx} × ${best.ny}`],
          ["Brasseurs actifs", `${best.fanCount}`],
          ["Diametre retenu", formatMeters(best.diameter)],
          ["Debordement", formatSquareMeters(best.spillArea)],
          ["Surface cible", formatSquareMeters(best.targetArea)],
          ["Montage", best.mountMode.label]
        ])}
      </section>

      <section class="report-block">
        <h2>Options classees</h2>
        ${renderVariabilityReportOptions(state.designs, brasse2Models)}
      </section>
    `;
  } else if (state.kind === "variability-empty") {
    bodyContent = `
      <section class="report-block">
        <h2>Conclusion</h2>
        <div class="report-note report-note-warning">
          <strong>Aucune trame valide</strong>
          <p>Le moteur n'a pas trouve de trame reguliere conforme aux regles BRASSE pour couvrir les rectangles cibles saisis.</p>
        </div>
        ${state.issues?.length ? `
          <div class="report-note" style="margin-top:10px;">
            <strong>Motifs releves</strong>
            <ul>
              ${state.issues.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          </div>
        ` : ""}
      </section>
    `;
  } else if (state.kind === "invalid") {
    bodyContent = `
      <section class="report-block">
        <h2>Calcul impossible</h2>
        <div class="report-note report-note-warning">
          <strong>Donnees invalides</strong>
          <ul>
            ${state.issues.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </div>
      </section>
    `;
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
        <header class="report-cover">
          <p class="report-cover-kicker">Rapport BRASSE • le ${escapeHtml(formatDateTime(state.generatedAt))}</p>
          <h1>${escapeHtml(state.simulationName)}</h1>
          <p>${escapeHtml([state.context, state.modesLabel].filter(Boolean).join(" • "))}</p>
          ${metaItems.length > 0 ? `
            <div class="report-meta-grid">
              ${metaItems
                .map(
                  ([label, value]) => `
                    <article class="report-meta-item">
                      <strong>${escapeHtml(label)}</strong>
                      <span>${escapeHtml(value)}</span>
                    </article>
                  `
                )
                .join("")}
            </div>
          ` : ""}
        </header>
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
