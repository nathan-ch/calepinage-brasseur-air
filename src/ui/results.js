import { MAX_GRID_FANS, EPS } from "../core/constants.js";
import {
  buildModelPicks,
  compareComfort,
  getBrasse2ModelsForCandidate,
  modelMountLabel
} from "../core/brasse2.js";
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
import { compareCandidates, compareVariabilityDesigns, zonesOverlap } from "../core/calepinage.js";
import { planWrapStyle, svgForCandidate, svgForVariabilityDesign } from "./planSvg.js";

export function createSummaryCard(label, value, detail) {
  return `
    <article class="summary-card">
      <strong>${label}</strong>
      <span>${value}</span>
      <div class="hint">${detail}</div>
    </article>
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

function renderBrasse2Section(candidate, brasse2Models, realDiameters) {
  const models = getBrasse2ModelsForCandidate(candidate, brasse2Models);

  if (models.length === 0) {
    return `
      <section class="models-shell">
        <div>
          <h4 class="section-title">Modeles BRASSE II</h4>
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

  const sortedModels = [...models].sort((a, b) => {
    if (a.isSelectedDiameter !== b.isSelectedDiameter) {
      return a.isSelectedDiameter ? -1 : 1;
    }
    if (Math.abs(b.compatibleOption.diameter - a.compatibleOption.diameter) > EPS) {
      return b.compatibleOption.diameter - a.compatibleOption.diameter;
    }
    return compareComfort(a, b);
  });
  const modelPicks = buildModelPicks(models);

  return `
    <section class="models-shell">
      <div>
        <h4 class="section-title">Modeles BRASSE II</h4>
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
        ${renderModelsTable(sortedModels)}
      </details>
    </section>
  `;
}

function candidateCard(candidate, rank, brasse2Models, realDiameters) {
  const warnings = getCandidateWarnings(candidate);

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

function uniqueBest(candidates, picker) {
  const candidate = picker(candidates);
  return candidate || null;
}

export function renderSummary(dom, room, candidates, brasse2Models) {
  const roomArea = room.length * room.width;
  const best = candidates[0];
  const bestBrasse2Matches = getBrasse2ModelsForCandidate(best, brasse2Models);
  const bestStandard = uniqueBest(
    candidates.filter((candidate) => candidate.mountMode.id === "standard"),
    (items) => items[0]
  );
  const biggest = uniqueBest([...candidates], (items) =>
    items.sort((a, b) => {
      if (Math.abs(b.diameter - a.diameter) > EPS) {
        return b.diameter - a.diameter;
      }
      return compareCandidates(a, b);
    })[0]
  );

  dom.summaryGrid.innerHTML = [
    createSummaryCard(
      "Piece",
      `${formatMeters(room.length)} × ${formatMeters(room.width)}`,
      `${formatSquareMeters(roomArea)} - HSP ${formatMeters(room.height)}`
    ),
    createSummaryCard(
      "Recommandation uniformite",
      `${best.fanCount} brasseur${best.fanCount > 1 ? "s" : ""}`,
      `${best.nx} × ${best.ny} cellules - ${best.mountMode.label}`
    ),
    createSummaryCard(
      "Diametre réel retenu",
      formatMeters(best.diameter),
      `Theorique max ${formatMeters(best.theoreticalMaxDiameter)} - FCC reel ${formatFactor(best.coverageFactor)}`
    ),
    createSummaryCard(
      "Base BRASSE II",
      bestBrasse2Matches.length > 0
        ? `${bestBrasse2Matches.length} modeles compatibles`
        : "Aucun modele compatible",
      "Selection sur CE, CFE et LwA a Vmax"
    )
  ].join("");

  const highlightCards = [];

  if (biggest && biggest.key !== best.key) {
    highlightCards.push(
      createSummaryCard(
        "Diametre maximal absolu",
        formatMeters(biggest.diameter),
        `${biggest.fanCount} brasseur${biggest.fanCount > 1 ? "s" : ""} - theorique ${formatMeters(biggest.theoreticalMaxDiameter)}`
      )
    );
  }

  if (bestStandard && bestStandard.key !== best.key) {
    highlightCards.push(
      createSummaryCard(
        "Meilleure variante standard",
        `${bestStandard.nx} × ${bestStandard.ny}`,
        `${formatMeters(bestStandard.diameter)} retenu - theorique ${formatMeters(bestStandard.theoreticalMaxDiameter)}`
      )
    );
  }

  dom.highlights.innerHTML = highlightCards.join("");
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

export function renderResults(dom, candidates, brasse2Models, realDiameters) {
  dom.resultsList.innerHTML = candidates
    .slice(0, 5)
    .map((candidate, index) => candidateCard(candidate, index + 1, brasse2Models, realDiameters))
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

function variabilityCard(design, rank, brasse2Models, realDiameters) {
  const warnings = getVariabilityWarnings(design);
  const designBrasse2Models = getBrasse2ModelsForCandidate(design, brasse2Models);

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
  const bestDesign = designs[0] || null;
  const lowestFanCount = designs[0]
    ? [...designs].sort((a, b) => a.fanCount - b.fanCount || compareVariabilityDesigns(a, b))[0]
    : null;
  const bestBrasse2Matches = bestDesign
    ? getBrasse2ModelsForCandidate(bestDesign, brasse2Models)
    : [];

  dom.summaryGrid.innerHTML = [
    createSummaryCard(
      "Strategie",
      "Zones a couvrir",
      `${zones.length} rectangle${zones.length > 1 ? "s" : ""} cible${zones.length > 1 ? "s" : ""}`
    ),
    createSummaryCard(
      "Recommandation",
      bestDesign
        ? `${bestDesign.fanCount} brasseur${bestDesign.fanCount > 1 ? "s" : ""}`
        : "Aucune solution",
      bestDesign
        ? `${bestDesign.nx} × ${bestDesign.ny} trame - ${bestDesign.mountMode.label}`
        : "Aucune trame valide"
    ),
    createSummaryCard(
      "Cellules actives",
      bestDesign ? `${bestDesign.fanCount} / ${bestDesign.totalCells}` : "0",
      bestDesign
        ? `${formatMeters(bestDesign.cellLength)} × ${formatMeters(bestDesign.cellWidth)}`
        : "Trame non validee"
    ),
    createSummaryCard(
      "Base BRASSE II",
      bestBrasse2Matches.length > 0
        ? `${bestBrasse2Matches.length} modeles compatibles`
        : "Aucun modele compatible",
      bestDesign ? `Diametre retenu ${formatMeters(bestDesign.diameter)}` : "Sans effet tant qu'aucune trame ne passe"
    )
  ].join("");

  const highlightCards = [];

  if (lowestFanCount) {
    highlightCards.push(
      createSummaryCard(
        "Moins de brasseurs",
        `${lowestFanCount.fanCount}`,
        `${lowestFanCount.nx} × ${lowestFanCount.ny} - ${formatMeters(lowestFanCount.diameter)}`
      )
    );
  }

  dom.highlights.innerHTML = highlightCards.join("");
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

export function renderVariabilityResults(dom, designs, brasse2Models, realDiameters) {
  dom.resultsList.innerHTML = designs
    .slice(0, 5)
    .map((design, index) => variabilityCard(design, index + 1, brasse2Models, realDiameters))
    .join("");
}
