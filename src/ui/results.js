import { MAX_GRID_FANS, EPS } from "../core/constants.js";
import {
  buildModelPicks,
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
  getCandidateWarnings,
  getVariabilityWarnings
} from "../core/messages.js";
import {
  formatDb,
  formatDiameterCm,
  formatDiameterCmList,
  formatDiameterList,
  formatFactor,
  formatMeters,
  formatNumber,
  formatSquareMeters,
  formatTemp
} from "../core/formatters.js";
import { zonesOverlap } from "../core/calepinage.js";
import { planWrapStyle, svgForCandidate, svgForVariabilityDesign } from "./planSvg.js";

const modelSectionRegistry = new Map();
let nextModelSectionId = 1;

function registerModelSection(models) {
  const sectionId = `compatible-models-${nextModelSectionId}`;
  nextModelSectionId += 1;
  modelSectionRegistry.set(sectionId, models);
  return sectionId;
}

function getDefaultCompatibleModelsComparator(a, b) {
  if (a.isSelectedDiameter !== b.isSelectedDiameter) {
    return a.isSelectedDiameter ? -1 : 1;
  }
  if (Math.abs(b.compatibleOption.diameter - a.compatibleOption.diameter) > EPS) {
    return b.compatibleOption.diameter - a.compatibleOption.diameter;
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
      modelsById.set(model.id, model);
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

function renderModelCard(title, model) {
  if (!model) {
    return "";
  }
  const hasCoverageFactor = Number.isFinite(model.compatibleOption.coverageFactor);

  return `
    <article class="model-card">
      <strong>${title}</strong>
      <h4>${model.brand} - ${model.model}</h4>
      <p>${model.motor} • ${model.fixation} • ${model.diameterCm} cm${model.isSelectedDiameter ? " • diametre retenu" : ""}</p>
      <div class="model-stats">
        <span>${hasCoverageFactor ? `FCC reel du calepinage: ${formatFactor(model.compatibleOption.coverageFactor)}` : `Diametre BRASSE II compatible: ${model.diameterCm} cm`}</span>
        <span>CE direct debout Vmax: ${formatTemp(model.ceDirDeboutMax)}</span>
        <span>CFE direct debout Vmax: ${formatNumber(model.cfeDirDeboutMax, 4)} °C/W</span>
        <span>LwA Vmax: ${formatDb(model.lwaMaxDbA)}</span>
        <span>${modelMountLabel(model)} (${formatNumber(model.ceilingDistanceCm, 1)} cm de base)</span>
      </div>
    </article>
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
            <th>FCC reel</th>
            <th>Marque</th>
            <th>Modele</th>
            <th>Moteur</th>
            <th>Fixation</th>
            <th>Plafond/BA</th>
            <th>CE dir debout Vmax</th>
            <th>CFE dir debout Vmax</th>
            <th>CE moyen Vmax</th>
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
                  <td>${Number.isFinite(model.compatibleOption.coverageFactor) ? formatFactor(model.compatibleOption.coverageFactor) : "—"}</td>
                  <td>${model.brand}</td>
                  <td>${model.model}</td>
                  <td>${model.motor}</td>
                  <td>${model.fixation}</td>
                  <td>${formatNumber(model.ceilingDistanceCm, 1)} cm</td>
                  <td>${formatTemp(model.ceDirDeboutMax)}</td>
                  <td>${formatNumber(model.cfeDirDeboutMax, 4)} °C/W</td>
                  <td>${formatTemp(model.ceAvgMax)}</td>
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

function renderBrasse2Section(candidate, brasse2Models, realDiameters) {
  const models = getBrasse2ModelsForCandidate(candidate, brasse2Models);

  if (models.length === 0) {
    return `
      <section class="models-shell">
        <div>
          <h4 class="section-title">Modeles pré-sélectionnés</h4>
          <p class="section-subtitle" style="margin-bottom:0;">
            Filtrage sur les diametres BRASSE II admissibles pour ce calepinage.
          </p>
        </div>
        <div class="notice warning">
          <strong>Aucun modele BRASSE II compatible.</strong>
          La base embarquee couvre ici les diametres disponibles dans BRASSE II :
          <code>${formatDiameterList(realDiameters)}</code>.
        </div>
      </section>
    `;
  }

  const sectionId = registerModelSection(models);
  const modelPicks = buildModelPicks(models);

  return `
    <section class="models-shell">
      <div>
        <h4 class="section-title">Modeles pré-sélectionnés</h4>
        <p class="section-subtitle" style="margin-bottom:0;">
          Filtrage sur tous les diametres admissibles. Les cartes ci-dessous lisent le meilleur FCC du calepinage,
          puis les indicateurs BRASSE a Vmax : confort direct debout, efficacite directe debout et acoustique.
        </p>
      </div>

      <div class="models-grid">
        ${modelPicks.map((pick) => renderModelCard(pick.title, pick.model)).join("")}
      </div>

      <details class="models-details">
        <summary>Voir tous les modeles BRASSE II compatibles (${models.length})</summary>
        ${renderModelsTablePanel(sectionId, models)}
      </details>
    </section>
  `;
}

function candidateCard(candidate, rank, brasse2Models, realDiameters, selectedOptionKeys) {
  const warnings = getCandidateWarnings(candidate);
  const isSelectedForExport = selectedOptionKeys.has(candidate.key);

  return `
    <article class="result-card">
      <div class="result-head">
        <div>
          <h3 class="result-title">Option ${rank}</h3>
          <p class="result-subtitle">
            ${candidate.fanCount} brasseur${candidate.fanCount > 1 ? "s" : ""} centre${candidate.fanCount > 1 ? "s" : ""}
            dans des cellules de ${formatMeters(candidate.cellLength)} × ${formatMeters(candidate.cellWidth)},
            avec un diametre BRASSE II retenu de ${formatMeters(candidate.diameter)}.
          </p>
        </div>
        ${renderExportOptionToggle(candidate.key, isSelectedForExport)}
      </div>

      <div class="result-grid">
        <div class="plan-wrap" style="${planWrapStyle(candidate)}">${svgForCandidate(candidate)}</div>

        <div class="stack">
          <div class="metric-grid">
            <div class="metric-card">
              <strong>Diametre réel retenu</strong>
              <span>${formatMeters(candidate.diameter)}</span>
            </div>
            <div class="metric-card">
              <strong>Diametre theorique max</strong>
              <span>${formatMeters(candidate.theoreticalMaxDiameter)}</span>
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
              <strong>Diametres BRASSE II admissibles (FCC &gt;= 0,2)</strong>
              <span>${candidate.compatibleRealDiameters.map((option) => formatDiameterCm(option.diameter)).join(", ")}</span>
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
      "Base BRASSE II",
      compatibleModels.length > 0
        ? `${compatibleModels.length} modeles`
        : "Aucun modele compatible",
      "Compatibles avec les options affichees"
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
          affichee plus bas si elle existe. Le diametre retenu est choisi ici parmi les diametres reels disponibles.
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
        <strong>Aucun diametre réel de la liste testée ne passe dans ce local.</strong>
        L'outil a teste ${formatDiameterList(realDiameters)} avec les regles BRASSE
        de FCC, de distances et de hauteur.
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

function renderVariabilityZoneSummary(zoneSummary) {
  return `
    <section class="zone-result-card">
      <div class="zone-result-head">
        <div>
          <h4>${zoneSummary.name}</h4>
          <p>Cible ${formatMeters(zoneSummary.length)} × ${formatMeters(zoneSummary.width)}</p>
        </div>
      </div>

      <div class="metric-grid">
        <div class="metric-card">
          <strong>Cellules actives</strong>
          <span>${zoneSummary.cellsCount}</span>
        </div>
        <div class="metric-card">
          <strong>Surface cible</strong>
          <span>${formatSquareMeters(zoneSummary.area)}</span>
        </div>
        <div class="metric-card">
          <strong>Surface mobilisee</strong>
          <span>${formatSquareMeters(zoneSummary.mobilizedArea)}</span>
        </div>
        <div class="metric-card">
          <strong>Trame touchee</strong>
          <span>${zoneSummary.cellRefs.length > 0 ? zoneSummary.cellRefs.join(", ") : "Aucune"}</span>
        </div>
      </div>
    </section>
  `;
}

function variabilityCard(design, rank, brasse2Models, realDiameters, selectedOptionKeys) {
  const warnings = getVariabilityWarnings(design);
  const designBrasse2Models = getBrasse2ModelsForCandidate(design, brasse2Models);
  const isSelectedForExport = selectedOptionKeys.has(design.key);

  return `
    <article class="result-card">
      <div class="result-head">
        <div>
          <h3 class="result-title">Option ${rank}</h3>
          <p class="result-subtitle">
            ${design.fanCount} brasseur${design.fanCount > 1 ? "s" : ""} actif${design.fanCount > 1 ? "s" : ""} sur une trame
            ${design.nx} × ${design.ny}, avec des cellules de ${formatMeters(design.cellLength)} × ${formatMeters(design.cellWidth)}.
          </p>
        </div>
        ${renderExportOptionToggle(design.key, isSelectedForExport)}
      </div>

      <div class="result-grid">
        <div class="plan-wrap" style="${planWrapStyle(design)}">${svgForVariabilityDesign(design)}</div>

        <div class="stack">
          <div class="metric-grid">
            <div class="metric-card">
              <strong>Diametre réel retenu</strong>
              <span>${formatMeters(design.diameter)}</span>
            </div>
            <div class="metric-card">
              <strong>Cellules actives</strong>
              <span>${design.fanCount} / ${design.totalCells}</span>
            </div>
            <div class="metric-card">
              <strong>Debordement hors zones</strong>
              <span>${formatSquareMeters(design.spillArea)}</span>
            </div>
            <div class="metric-card">
              <strong>FCC reel</strong>
              <span>${formatFactor(design.coverageFactor)}</span>
            </div>
          </div>

          <div class="detail-list">
            <div class="detail-item">
              <strong>Montage</strong>
              <span>${design.mountMode.label}</span>
            </div>
            <div class="detail-item">
              <strong>Hauteur sous pales</strong>
              <span class="detail-value-stack">
                <span>${formatMeters(design.bladeHeight)}</span>
                <span class="detail-subtext">Plafond-pales: ${formatMeters(design.mountDistance)}</span>
              </span>
            </div>
            <div class="detail-item">
              <strong>Diametre theorique max</strong>
              <span>${formatMeters(design.theoreticalMaxDiameter)}</span>
            </div>
            <div class="detail-item">
              <strong>Mur limitant</strong>
              <span>${formatMeters(design.wallClearance)} &gt; ${formatMeters(design.diameter)}</span>
            </div>
            <div class="detail-item">
              <strong>Entraxe mini</strong>
              <span>${design.interFanSpacing ? `${formatMeters(design.interFanSpacing)} &gt; ${formatNumber(2.5, 1)} × D` : "Non applicable (un seul brasseur)"}</span>
            </div>
            <div class="detail-item">
              <strong>Surface cible</strong>
              <span>${formatSquareMeters(design.targetArea)}</span>
            </div>
            <div class="detail-item">
              <strong>Surface mobilisee</strong>
              <span>${formatSquareMeters(design.selectedArea)}</span>
            </div>
            <div class="detail-item detail-item-stack">
              <strong>Diametres BRASSE II admissibles (FCC &gt;= 0,2)</strong>
              <span>${formatDiameterCmList(design.compatibleRealDiameters)}</span>
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

      <div class="zone-results">
        ${design.zoneSummaries.map((zoneSummary) => renderVariabilityZoneSummary(zoneSummary)).join("")}
      </div>

      ${designBrasse2Models.length > 0 ? renderBrasse2Section(design, brasse2Models, realDiameters) : `
        <section class="models-shell">
          <div class="notice warning">
            <strong>Aucun modele BRASSE II compatible.</strong>
            Aucun modele de la base n'est disponible sur les diametres ${formatDiameterCmList(design.compatibleRealDiameters)}.
          </div>
        </section>
      `}
    </article>
  `;
}

export function renderVariabilitySummary(dom, room, zones, designs, brasse2Models) {
  const displayedDesigns = designs.slice(0, 5);
  const targetArea = zones.reduce((sum, zone) => sum + zone.length * zone.width, 0);
  const compatibleModels = getDistinctCompatibleModels(displayedDesigns, brasse2Models);
  const diameterSummary = getMaxDiameterSummary(displayedDesigns);
  const mountSummary = getNeutralMountSummary(displayedDesigns);

  dom.summaryGrid.innerHTML = [
    createSummaryCard(
      "Piece",
      `${formatMeters(room.length)} × ${formatMeters(room.width)}`,
      `${formatSquareMeters(room.length * room.width)} - HSP ${formatMeters(room.height)}`
    ),
    createSummaryCard(
      "Zones cibles",
      `${zones.length}`,
      `${formatSquareMeters(targetArea)} a couvrir`
    ),
    createSummaryCard(
      "Options valides",
      `${designs.length}`,
      `Montages visibles : ${mountSummary}`
    ),
    createSummaryCard(
      "Diametre max",
      diameterSummary.value,
      diameterSummary.detail
    ),
    createSummaryCard(
      "Base BRASSE II",
      compatibleModels.length > 0
        ? `${compatibleModels.length} modeles`
        : "Aucun modele compatible",
      "Compatibles avec les options affichees"
    )
  ].join("");
  dom.highlights.innerHTML = "";
}

export function renderVariabilityStatusNote(
  dom,
  room,
  zones,
  designs,
  modes,
  realDiameters
) {
  const notes = [];
  const heightRequirementMessage = buildHeightDiameterRequirementMessage(room, modes, realDiameters);

  const overlapPairs = [];
  for (let index = 0; index < zones.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < zones.length; otherIndex += 1) {
      if (zonesOverlap(zones[index], zones[otherIndex])) {
        overlapPairs.push(`${zones[index].name} / ${zones[otherIndex].name}`);
      }
    }
  }

  if (overlapPairs.length > 0) {
    notes.push(`
      <div class="notice warning">
        <strong>Zones cibles en recouvrement.</strong>
        ${overlapPairs.join(", ")}. Le moteur peut tout de meme proposer des cellules actives, mais les besoins ne
        sont plus totalement distincts.
      </div>
    `);
  }

  if (designs.length === 0) {
    notes.push(`
      <div class="notice danger">
        <strong>Aucune trame valide n'a ete trouvee.</strong>
        L'outil a teste des maillages reguliers jusqu'a ${MAX_GRID_FANS} cellules, avec les regles BRASSE de FCC,
        de distances et de hauteur.
        ${heightRequirementMessage}
      </div>
    `);
  } else {
    const bestDesign = designs[0];
    notes.push(`
      <div class="notice">
        <strong>Couverture de l'option de tete.</strong>
        La trame retenue mobilise <code>${bestDesign.fanCount}</code> cellule${bestDesign.fanCount > 1 ? "s" : ""}
        pour couvrir <code>${formatSquareMeters(bestDesign.targetArea)}</code> de zones cibles, avec un debordement
        de <code>${formatSquareMeters(bestDesign.spillArea)}</code> hors rectangles.
      </div>
    `);

    if (bestDesign.mountMode.id === "low-profile") {
      notes.push(`
        <div class="notice warning">
          <strong>La meilleure variante passe en low-profile.</strong>
          Le guide annonce alors une baisse de vitesse d'air d'environ 15 % par rapport au montage standard.
        </div>
      `);
    }
  }

  dom.statusNote.innerHTML = notes.join("");
}

export function renderVariabilityResults(
  dom,
  designs,
  brasse2Models,
  realDiameters,
  selectedOptionKeys = []
) {
  resetResultsModelSections();
  const selectedOptionKeySet = new Set(selectedOptionKeys);
  dom.resultsList.innerHTML = designs
    .slice(0, 5)
    .map((design, index) =>
      variabilityCard(design, index + 1, brasse2Models, realDiameters, selectedOptionKeySet)
    )
    .join("");
}
