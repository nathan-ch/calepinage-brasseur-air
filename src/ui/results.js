import { EPS } from "../core/constants.js";
import {
  compareAcoustics,
  compareComfort,
  compareEfficiency,
  compareCoverage,
  getBrasse2ModelsForCandidate,
  modelMountLabel
} from "../core/brasse2.js";
import { normalizeCatalogSearch } from "../core/catalog.js";
import {
  buildHeightDiameterRequirementMessage,
  getCandidateWarnings
} from "../core/messages.js";
import {
  formatDb,
  formatDiameterCm,
  formatFactor,
  formatMeters,
  formatNumber,
  formatSquareMeters,
  formatTemp
} from "../core/formatters.js";
import { planWrapStyle, svgForCandidate } from "./planSvg.js";

const modelSectionRegistry = new Map();
let nextModelSectionId = 1;

function registerModelSection(models) {
  const sectionId = `compatible-models-${nextModelSectionId}`;
  nextModelSectionId += 1;
  modelSectionRegistry.set(sectionId, models);
  return sectionId;
}

function getDefaultCompatibleModelsComparator(a, b) {
  if (Boolean(a.sizing?.sizeFits) !== Boolean(b.sizing?.sizeFits)) {
    return a.sizing?.sizeFits ? -1 : 1;
  }
  if (Boolean(a.sizing?.coverageValid) !== Boolean(b.sizing?.coverageValid)) {
    return a.sizing?.coverageValid ? -1 : 1;
  }
  if (Math.abs((b.sizing?.coverageFactor ?? -Infinity) - (a.sizing?.coverageFactor ?? -Infinity)) > EPS) {
    return (b.sizing?.coverageFactor ?? -Infinity) - (a.sizing?.coverageFactor ?? -Infinity);
  }
  return compareComfort(a, b);
}

function sortCompatibleModels(models, sortKey = "default") {
  const comparator =
    {
      default: getDefaultCompatibleModelsComparator,
      "diameter-desc": (a, b) =>
        b.diameterCm - a.diameterCm || getDefaultCompatibleModelsComparator(a, b),
      "diameter-asc": (a, b) =>
        a.diameterCm - b.diameterCm || getDefaultCompatibleModelsComparator(a, b),
      "fcc-desc": (a, b) => compareCoverage(a, b) || getDefaultCompatibleModelsComparator(a, b),
      comfort: (a, b) => compareComfort(a, b) || getDefaultCompatibleModelsComparator(a, b),
      efficiency: (a, b) =>
        compareEfficiency(a, b) || getDefaultCompatibleModelsComparator(a, b),
      acoustics: (a, b) =>
        compareAcoustics(a, b) || getDefaultCompatibleModelsComparator(a, b)
    }[sortKey] || getDefaultCompatibleModelsComparator;

  return [...models].sort(comparator);
}

function filterCompatibleModels(models, { search }) {
  const normalizedSearch = normalizeCatalogSearch(search);

  return models.filter((model) => {
    if (!normalizedSearch) {
      return true;
    }

    const haystack = normalizeCatalogSearch(
      [
        model.id,
        model.brand,
        model.model,
        model.motor,
        model.fixation,
        String(model.diameterCm)
      ].join(" ")
    );

    return haystack.includes(normalizedSearch);
  });
}

function renderModelsTableSummary(filteredCount, totalCount) {
  if (filteredCount === totalCount) {
    return `${totalCount} modele${totalCount > 1 ? "s" : ""}`;
  }

  return `${filteredCount} / ${totalCount} modele${totalCount > 1 ? "s" : ""}`;
}

function getNeutralMountSummary(items) {
  const labels = [
    ...new Set(
      items
        .map((item) => item.mountMode?.id)
        .filter(Boolean)
        .map((mountId) => (mountId === "low-profile" ? "low-profile" : "standard"))
    )
  ];

  return labels.length > 0 ? labels.join(" + ") : "Aucun";
}

function getMaxDiameterSummary(items) {
  const diameters = items.map((item) => item.diameter).filter(Number.isFinite);

  if (diameters.length === 0) {
    return {
      value: "Aucun",
      detail: "Aucun diametre reel compatible"
    };
  }

  const maxDiameter = Math.max(...diameters);

  return {
    value: `${formatDiameterCm(maxDiameter)} cm`,
    detail: "Plus grand diametre reel compatible sur les options affichees"
  };
}

function getDistinctCompatibleModels(items, brasse2Models) {
  const modelsById = new Map();

  items.forEach((item) => {
    getBrasse2ModelsForCandidate(item, brasse2Models).forEach((model) => {
      if (model?.sizing?.sizeFits && model?.sizing?.coverageValid) {
        modelsById.set(model.id, model);
      }
    });
  });

  return [...modelsById.values()];
}

export function createSummaryCard(label, value, detail) {
  return `
    <article class="summary-card">
      <strong>${label}</strong>
      <span>${value}</span>
      <div class="hint">${detail}</div>
    </article>
  `;
}

function renderExportOptionToggle(optionKey, checked) {
  return `
    <label class="export-option-toggle">
      <input type="checkbox" data-export-option-key="${optionKey}" ${checked ? "checked" : ""}>
      <span>Inclure dans le PDF</span>
    </label>
  `;
}

function renderModelsTable(models) {
  if (models.length === 0) {
    return `
      <div class="notice warning">
        <strong>Aucun modele ne correspond aux filtres actifs.</strong>
        Elargissez la recherche ou reinitialisez les filtres de cette option.
      </div>
    `;
  }

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Diam.</th>
            <th>FCC calc.</th>
            <th>OK dim.</th>
            <th>OK FCC</th>
            <th>Marque</th>
            <th>Modele</th>
            <th>Moteur</th>
            <th>Fixation</th>
            <th>Plafond/BA</th>
            <th>CE dir debout Vmax</th>
            <th>CE moyen Vmax</th>
            <th>LwA Vmin</th>
            <th>LwA Vmax</th>
            <th>Lecture montage</th>
          </tr>
        </thead>
        <tbody>
          ${models
            .map(
              (model) => `
                <tr>
                  <td>${model.diameterCm}</td>
                  <td>${Number.isFinite(model.sizing?.coverageFactor) ? formatFactor(model.sizing.coverageFactor) : "—"}</td>
                  <td>${model.sizing?.sizeFits ? "Oui" : "Non"}</td>
                  <td>${model.sizing?.coverageValid ? "Oui" : "Non"}</td>
                  <td>${model.brand}</td>
                  <td>${model.model}</td>
                  <td>${model.motor}</td>
                  <td>${model.fixation}</td>
                  <td>${formatNumber(model.ceilingDistanceCm, 1)} cm</td>
                  <td>${formatTemp(model.ceDirDeboutMax)}</td>
                  <td>${formatTemp(model.ceAvgMax)}</td>
                  <td>${formatDb(model.lwaMinDbA)}</td>
                  <td>${formatDb(model.lwaMaxDbA)}</td>
                  <td>${modelMountLabel(model)}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderModelsToolbar(sectionId, models) {
  return `
    <div class="models-toolbar">
      <div class="field">
        <label for="${sectionId}-search">Recherche</label>
        <input id="${sectionId}-search" type="search" placeholder="Ref., marque, modele" data-model-search>
      </div>
      <div class="field">
        <label for="${sectionId}-sort">Tri</label>
        <select id="${sectionId}-sort" data-model-sort>
          <option value="default">Ordre recommande</option>
          <option value="fcc-desc">FCC reel decroissant</option>
          <option value="comfort">Confort</option>
          <option value="efficiency">Efficacite</option>
          <option value="acoustics">Acoustique</option>
          <option value="diameter-desc">Diametre decroissant</option>
          <option value="diameter-asc">Diametre croissant</option>
        </select>
      </div>
      <p class="models-toolbar-summary" data-models-summary>${renderModelsTableSummary(models.length, models.length)}</p>
    </div>
  `;
}

function renderModelsTablePanel(sectionId, models) {
  return `
    <div class="models-table-panel" data-model-section="${sectionId}">
      ${renderModelsToolbar(sectionId, models)}
      <div data-models-table-host>${renderModelsTable(sortCompatibleModels(models))}</div>
    </div>
  `;
}

function updateModelsTableSection(sectionElement) {
  if (!sectionElement) {
    return;
  }

  const sectionId = sectionElement.dataset.modelSection;
  const models = modelSectionRegistry.get(sectionId) || [];
  const search = sectionElement.querySelector("[data-model-search]")?.value || "";
  const sort = sectionElement.querySelector("[data-model-sort]")?.value || "default";

  const filteredModels = filterCompatibleModels(models, {
    search
  });
  const sortedModels = sortCompatibleModels(filteredModels, sort);
  const host = sectionElement.querySelector("[data-models-table-host]");
  const summary = sectionElement.querySelector("[data-models-summary]");

  if (host) {
    host.innerHTML = renderModelsTable(sortedModels);
  }
  if (summary) {
    summary.textContent = renderModelsTableSummary(filteredModels.length, models.length);
  }
}

export function bindResultsInteractions(dom) {
  if (dom.resultsList.dataset.resultsInteractionsBound === "true") {
    return;
  }

  const refreshFromEvent = (event) => {
    const target = event.target;
    if (
      !target ||
      !target.matches?.(
        "[data-model-search], [data-model-sort]"
      )
    ) {
      return;
    }

    updateModelsTableSection(target.closest("[data-model-section]"));
  };

  dom.resultsList.addEventListener("input", refreshFromEvent);
  dom.resultsList.addEventListener("change", refreshFromEvent);
  dom.resultsList.dataset.resultsInteractionsBound = "true";
}

export function resetResultsModelSections() {
  modelSectionRegistry.clear();
  nextModelSectionId = 1;
}

function renderBrasse2Section(candidate, brasse2Models, _realDiameters) {
  const models = getBrasse2ModelsForCandidate(candidate, brasse2Models);
  const filteredModels = models.filter((model) => model?.sizing?.sizeFits);

  if (filteredModels.length === 0) {
    return `
      <section class="models-shell">
        <div>
          <h4 class="section-title">Catalogue BRASSE II</h4>
          <p class="section-subtitle" style="margin-bottom:0;">
            Aucun modele du catalogue n'entre dans le diametre theorique recommande pour cette option.
          </p>
        </div>
      </section>
    `;
  }

  const sectionId = registerModelSection(filteredModels);

  return `
    <section class="models-shell">
      <div>
        <h4 class="section-title">Choisir un modele (catalogue BRASSE II)</h4>
        <p class="section-subtitle" style="margin-bottom:0;">
          Liste de modeles a comparer. Le dimensionnement ci-dessus est theorique ; choisissez ensuite un modele adapte.
        </p>
      </div>

      <details class="models-details">
        <summary>Voir les modeles du catalogue dans le diametre theorique (${filteredModels.length})</summary>
        ${renderModelsTablePanel(sectionId, filteredModels)}
      </details>
    </section>
  `;
}

function candidateCard(candidate, rank, brasse2Models, realDiameters, selectedOptionKeys) {
  const warnings = getCandidateWarnings(candidate);
  const isSelectedForExport = selectedOptionKeys.has(candidate.key);

  const title = candidate.isCustom ? "Configuration personnalisée" : `Option ${rank}`;
  let badge = "";
  let customAlertsHtml = "";

  if (candidate.isCustom) {
    const c = candidate.conformity;
    if (c.conforming) {
      badge = `<span class="badge success">Conforme</span>`;
      customAlertsHtml = `
        <div class="notice success" style="margin-bottom: 12px;">
          <strong>Calepinage conforme</strong>
          Cette configuration respecte toutes les regles de securite et de distance reglementaires.
        </div>
      `;
      if (!c.heightRangeOk) {
        const range = candidate.diameter < 2.13 ? "inférieure à 2 D" : "comprise entre 0,8 D et 2 D";
        customAlertsHtml += `
          <div class="notice warning" style="margin-bottom: 12px;">
            <strong>Hauteur de fonctionnement non optimale</strong> : la hauteur sous pales (${formatMeters(candidate.bladeHeight)}) doit être ${range} (${formatMeters(2 * candidate.diameter)} pour ce diametre) pour assurer un bon confort. Envisagez d'ajuster la longueur de la suspension (tige).
          </div>
        `;
      }
    } else {
      badge = `<span class="badge danger">Non conforme</span>`;
      const alerts = [];
      if (!c.wallClearanceOk) {
        alerts.push(`<strong>Distance aux murs insuffisante</strong> : le diametre (${formatMeters(candidate.diameter)}) depasse la distance entre le centre et le mur le plus proche (${formatMeters(candidate.wallClearance)}).`);
      }
      if (!c.spacingOk) {
        alerts.push(`<strong>Entraxe insuffisant</strong> : l'entraxe entre ventilateurs (${formatMeters(candidate.interFanSpacing)}) est inferieur a la limite reglementaire de 2.5 D (${formatMeters(2.5 * candidate.diameter)}).`);
      }
      if (!c.coverageOk) {
        alerts.push(`<strong>Facteur de couverture (FCC) non optimal</strong> : le FCC calcule (${formatFactor(candidate.coverageFactor)}) est en dehors de la plage reglementaire de [0,20 - 0,40].`);
      }
      if (!c.safetyHeightOk) {
        const limit = candidate.diameter < 2.13 ? "2,13 m" : "3,05 m";
        alerts.push(`<strong>Hauteur de securite insuffisante</strong> : la hauteur sous pales (${formatMeters(candidate.bladeHeight)}) est inferieure au seuil de securite obligatoire pour cette classe d'appareil (${limit}).`);
      }
      customAlertsHtml = `
        <div class="notice danger" style="margin-bottom: 12px;">
          <strong>Detail des non-conformites :</strong>
          <ul style="margin: 8px 0 0; padding-left: 18px;">
            ${alerts.map((a) => `<li style="margin-bottom: 4px;">${a}</li>`).join("")}
          </ul>
        </div>
      `;
      if (!c.heightRangeOk) {
        const range = candidate.diameter < 2.13 ? "inférieure à 2 D" : "comprise entre 0,8 D et 2 D";
        customAlertsHtml += `
          <div class="notice warning" style="margin-bottom: 12px;">
            <strong>Hauteur de fonctionnement non optimale</strong> : la hauteur sous pales (${formatMeters(candidate.bladeHeight)}) doit être ${range} (${formatMeters(2 * candidate.diameter)} pour ce diametre) pour assurer un bon confort. Envisagez d'ajuster la longueur de la suspension (tige).
          </div>
        `;
      }
    }
  } else if (candidate.isMarketAlternative) {
    badge = "";
    customAlertsHtml = `
      <div class="notice success" style="margin-bottom: 12px;">
        Le diametre choisi est compris dans les diametres courants.
      </div>
    `;
  }

  return `
    <article class="result-card">
      <div class="result-head">
        <div>
          <h3 class="result-title">${title}${badge}</h3>
          <p class="result-subtitle">
            ${candidate.fanCount} brasseur${candidate.fanCount > 1 ? "s" : ""} centre${candidate.fanCount > 1 ? "s" : ""}
            dans des cellules de ${formatMeters(candidate.cellLength)} × ${formatMeters(candidate.cellWidth)},
            avec un diamètre de ${formatMeters(candidate.diameter)}.
          </p>
        </div>
        ${renderExportOptionToggle(candidate.key, isSelectedForExport)}
      </div>

      ${customAlertsHtml}

      <div class="result-grid">
        <div class="plan-wrap" style="${planWrapStyle(candidate)}">${svgForCandidate(candidate)}</div>

        <div class="stack">
          <div class="metric-grid">
            <div class="metric-card">
              <strong>Diametre theorique recommande</strong>
              <span>${formatMeters(candidate.diameter)}</span>
            </div>
            <div class="metric-card">
              <strong>Facteur de forme</strong>
              <span>${formatFactor(candidate.formFactor)}</span>
            </div>
            <div class="metric-card">
              <strong>FCC reel</strong>
              <span>${formatFactor(candidate.coverageFactor)}</span>
            </div>
          </div>

          <div class="detail-list">
            <div class="detail-item">
              <strong>Montage</strong>
              <span>${candidate.mountMode.label}</span>
            </div>
            <div class="detail-item">
              <strong>Hauteur sous pales</strong>
              <span class="detail-value-stack">
                <span>${formatMeters(candidate.bladeHeight)}</span>
                <span class="detail-subtext">Plafond-pales: ${formatMeters(candidate.mountDistance)}</span>
              </span>
            </div>
            <div class="detail-item">
              <strong>Murs</strong>
              <span>Centre vers mur le plus proche: ${formatMeters(candidate.wallClearance)} &gt; ${formatMeters(candidate.diameter)}</span>
            </div>
            <div class="detail-item">
              <strong>Entre brasseurs</strong>
              <span>${candidate.interFanSpacing ? `${formatMeters(candidate.interFanSpacing)} &gt; ${formatNumber(2.5, 1)} × D` : "Non applicable (un seul brasseur)"}</span>
            </div>
            <div class="detail-item detail-item-stack">
              <strong>Diametres BRASSE II admissibles (info)</strong>
              <span>${
                candidate.compatibleRealDiameters?.length
                  ? candidate.compatibleRealDiameters.map((option) => formatDiameterCm(option.diameter)).join(", ")
                  : "Aucun diametre de la liste de reference"
              }</span>
            </div>
          </div>
        </div>
      </div>

      ${warnings.length > 0 ? `
        <div class="notice warning">
          <strong>Point d'attention.</strong>
          ${warnings.join(" ")}
        </div>
      ` : ""}

      ${renderBrasse2Section(candidate, brasse2Models, realDiameters)}

    </article>
  `;
}

export function renderSummary(dom, room, candidates, brasse2Models) {
  const roomArea = room.length * room.width;
  const displayedCandidates = candidates.slice(0, 5);
  const compatibleModels = getDistinctCompatibleModels(displayedCandidates, brasse2Models);
  const diameterSummary = getMaxDiameterSummary(displayedCandidates);
  const mountSummary = getNeutralMountSummary(displayedCandidates);

  dom.summaryGrid.innerHTML = [
    createSummaryCard(
      "Piece",
      `${formatMeters(room.length)} × ${formatMeters(room.width)}`,
      `${formatSquareMeters(roomArea)} - HSP ${formatMeters(room.height)}`
    ),
    createSummaryCard(
      "Options valides",
      `${candidates.length}`,
      `Montages visibles : ${mountSummary}`
    ),
    createSummaryCard(
      "Diametre max",
      diameterSummary.value,
      diameterSummary.detail
    ),
    createSummaryCard(
      "Catalogue BRASSE II",
      compatibleModels.length > 0 ? `${compatibleModels.length} modeles compatibles` : "Aucun modele compatible",
      "Compatibilite calculee sur les options affichees"
    )
  ].join("");
  dom.highlights.innerHTML = "";
}

export function renderStatusNote(
  dom,
  room,
  candidates,
  fallbackFlush,
  modes,
  realDiameters
) {
  const notes = [];
  const heightRequirementMessage = buildHeightDiameterRequirementMessage(room, modes, realDiameters);

  if (candidates.length > 0) {
    const best = candidates[0];
    if (best.mountMode.id === "low-profile") {
      notes.push(`
        <div class="notice warning">
          <strong>Le meilleur cas passe en low-profile.</strong>
          Le guide indique alors une baisse de vitesse d'air d'environ 15 %. Une variante standard est egalement
          affichee plus bas si elle existe.
        </div>
      `);
    }

    if (candidates.every((c) => c.compatibleRealDiameters.length === 0)) {
      notes.push(`
        <div class="notice warning">
          <strong>Aucun modèle compatible disponible dans le catalogue.</strong>
          Les configurations théoriques proposées nécessitent des diamètres supérieurs à la limite du catalogue BRASSE II embarqué (${formatMeters(realDiameters[realDiameters.length - 1])}).
          ${heightRequirementMessage}
        </div>
      `);
    }
  }

  if (fallbackFlush && candidates.length === 0) {
    notes.push(`
      <div class="notice danger">
        <strong>Aucune solution standard ou low-profile n'a ete trouvee.</strong>
        Un montage flush pourrait rouvrir une piste jusqu'a ${formatMeters(fallbackFlush.diameter)}, mais le guide
        annonce alors une perte de performance superieure a 40 % et demande de l'eviter au maximum.
        ${heightRequirementMessage}
      </div>
    `);
  }

  if (!fallbackFlush && candidates.length === 0) {
    notes.push(`
      <div class="notice danger">
        <strong>Aucun calepinage théorique standard ou low-profile n'est possible dans ce local.</strong>
        Le local ne permet pas d'implanter de brasseur d'air respectant les règles BRASSE de FCC, de distances et de hauteur.
        ${heightRequirementMessage}
      </div>
    `);
  }

  dom.statusNote.innerHTML = notes.join("");
}

export function renderResults(dom, candidates, brasse2Models, realDiameters, selectedOptionKeys = []) {
  resetResultsModelSections();
  const selectedOptionKeySet = new Set(selectedOptionKeys);
  dom.resultsList.innerHTML = candidates
    .slice(0, 5)
    .map((candidate, index) =>
      candidateCard(candidate, index + 1, brasse2Models, realDiameters, selectedOptionKeySet)
    )
    .join("");
}
