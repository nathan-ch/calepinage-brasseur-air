import { BRASSE2_MODELS } from "../data/brasse2-data.js";
import { getDomRefs } from "./app/dom.js";
import {
  createAppState,
  createSelectedReportOptionKeys,
  createDefaultZoneDraft,
  ensureVariabilityZones,
  getCurrentRoomDraft,
  getSelectedReportOptions,
  normalizeAllZoneDrafts,
  removeZoneDraft,
  resetState,
  setLatestReportState,
  toggleLatestReportOptionSelection,
  updateZoneDraft
} from "./app/state.js";
import { MAX_GRID_FANS, MOUNT_MODES } from "./core/constants.js";
import {
  enumerateCandidates,
  enumerateVariabilityDesigns,
  getFallbackFlushCandidate,
  parseZoneDrafts
} from "./core/calepinage.js";
import { parseNumber, formatMeters } from "./core/formatters.js";
import { buildHeightDiameterRequirementMessage } from "./core/messages.js";
import {
  initializeCatalogFilters,
  renderCatalog,
  resetCatalogFilters
} from "./ui/catalog.js";
import {
  bindResultsInteractions,
  createSummaryCard,
  renderResults,
  resetResultsModelSections,
  renderStatusNote,
  renderSummary,
  renderVariabilityResults,
  renderVariabilityStatusNote,
  renderVariabilitySummary
} from "./ui/results.js";
import {
  refreshReportHeader,
  setExportAvailability,
  setExportSelectionSummary
} from "./ui/reportHeader.js";
import { renderZonesEditor, syncZoneCard } from "./ui/zonesEditor.js";
import { exportPdfReport } from "./report/pdf.js";

const dom = getDomRefs();
const state = createAppState();
const brasse2Models = BRASSE2_MODELS;
const realDiameters = [
  ...new Set(
    brasse2Models
      .map((model) => Number(model.diameterCm) / 100)
      .filter((value) => Number.isFinite(value) && value > 0)
  )
].sort((a, b) => a - b);

function getSimulationName() {
  const value = String(dom.simulationNameInput.value || "").trim();
  return value || "Simulation sans nom";
}

function getStrategyLabel(strategy) {
  return strategy === "variabilite" ? "Zones a couvrir" : "Recherche d'uniformite";
}

function getSelectedModes() {
  const modes = [];
  if (dom.allowStandardInput.checked) {
    modes.push(MOUNT_MODES[0]);
  }
  if (dom.allowLowInput.checked) {
    modes.push(MOUNT_MODES[1]);
  }
  return modes;
}

function getSelectedModesLabel(modes = getSelectedModes()) {
  const labels = modes.map((mode) => mode.label);
  return labels.length > 0 ? labels.join(" + ") : "Aucun";
}

function getRoomInputs() {
  return {
    length: parseNumber(dom.lengthInput),
    width: parseNumber(dom.widthInput),
    height: parseNumber(dom.heightInput)
  };
}

function toggleStrategyUI() {
  const isVariability = dom.strategyInput.value === "variabilite";
  dom.zonesConfig.classList.toggle("hidden", !isVariability);
  if (isVariability) {
    renderZonesPanel();
  }
}

function renderZonesPanel() {
  const roomDraft = getCurrentRoomDraft(dom);
  ensureVariabilityZones(state, roomDraft);
  normalizeAllZoneDrafts(state, roomDraft);
  renderZonesEditor(dom, state, roomDraft);
}

function updateHeader({ strategy, room, recommendation = "", generatedAt = new Date() }) {
  refreshReportHeader(dom, {
    simulationName: getSimulationName(),
    strategyLabel: getStrategyLabel(strategy),
    modesLabel: getSelectedModesLabel(),
    recommendation,
    generatedAt,
    room
  });
}

function validateInputs(values) {
  const issues = [];
  if (!(values.length > 0)) {
    issues.push("La longueur doit etre strictement positive.");
  }
  if (!(values.width > 0)) {
    issues.push("La largeur doit etre strictement positive.");
  }
  if (!(values.height > 0)) {
    issues.push("La hauteur sous plafond doit etre strictement positive.");
  }
  if (!dom.allowStandardInput.checked && !dom.allowLowInput.checked) {
    issues.push("Selectionnez au moins un type de montage.");
  }
  return issues;
}

function updateExportControls() {
  const latestReportState = state.latestReportState;
  if (!latestReportState) {
    setExportAvailability(dom, false);
    setExportSelectionSummary(dom, "");
    return;
  }

  const selectedOptions = getSelectedReportOptions(latestReportState);
  if (selectedOptions.length === 0) {
    setExportAvailability(dom, latestReportState.kind !== "uniformity-ok" && latestReportState.kind !== "variability-ok");
    setExportSelectionSummary(
      dom,
      latestReportState.kind === "uniformity-ok" || latestReportState.kind === "variability-ok"
        ? "Aucune option selectionnee pour le PDF"
        : ""
    );
    return;
  }

  const selectableCount =
    latestReportState.kind === "uniformity-ok"
      ? latestReportState.candidates.length
      : latestReportState.kind === "variability-ok"
        ? latestReportState.designs.length
        : 0;

  setExportAvailability(dom, true);
  setExportSelectionSummary(
    dom,
    selectableCount > 0
      ? `${selectedOptions.length} option${selectedOptions.length > 1 ? "s" : ""} selectionnee${selectedOptions.length > 1 ? "s" : ""} sur ${selectableCount}`
      : ""
  );
}

function resetResultsVisibility() {
  dom.emptyState.classList.add("hidden");
  dom.resultsContent.classList.add("hidden");
  setExportAvailability(dom, false);
  setExportSelectionSummary(dom, "");
  setLatestReportState(state, null);
  resetResultsModelSections();
}

function renderInvalidState(rawValues, issues, generatedAt) {
  updateHeader({
    strategy: rawValues.strategy,
    room: rawValues,
    recommendation: "Calcul impossible",
    generatedAt
  });
  setLatestReportState(state, {
    kind: "invalid",
    strategy: rawValues.strategy,
    simulationName: getSimulationName(),
    room: rawValues,
    modesLabel: getSelectedModesLabel(),
    generatedAt,
    context: "Calcul impossible",
    issues
  });
  dom.statusNote.innerHTML = `
    <div class="notice danger">
      <strong>Calcul impossible.</strong><br>
      ${issues.join(" ")}
    </div>
  `;
  dom.summaryGrid.innerHTML = "";
  dom.highlights.innerHTML = "";
  dom.resultsList.innerHTML = "";
  dom.resultsContent.classList.remove("hidden");
}

function renderVariabilityInvalidZones(room, zones, zoneIssues, generatedAt) {
  updateHeader({
    strategy: dom.strategyInput.value,
    room,
    recommendation: "Zones invalides",
    generatedAt
  });
  setLatestReportState(state, {
    kind: "variability-empty",
    strategy: dom.strategyInput.value,
    simulationName: getSimulationName(),
    room,
    zones,
    modesLabel: getSelectedModesLabel(),
    generatedAt,
    context: "Zones invalides",
    issues: zoneIssues
  });
  dom.summaryGrid.innerHTML = [
    createSummaryCard("Strategie", "Zones a couvrir", "Corrigez les rectangles cibles"),
    createSummaryCard("Local", `${formatMeters(room.length)} × ${formatMeters(room.width)}`, `HSP ${formatMeters(room.height)}`),
    createSummaryCard("Zones", `${zones.length}`, "Chaque rectangle doit rester dans le local"),
    createSummaryCard("Resultat", "Calcul bloque", "Impossible d'evaluer les zones a couvrir")
  ].join("");
  dom.highlights.innerHTML = "";
  dom.statusNote.innerHTML = `
    <div class="notice danger">
      <strong>Zones invalides.</strong>
      ${zoneIssues.join(" ")}
    </div>
  `;
  dom.resultsList.innerHTML = "";
  dom.resultsContent.classList.remove("hidden");
}

function renderUniformityEmpty(room, fallbackFlush, generatedAt) {
  updateHeader({
    strategy: dom.strategyInput.value,
    room,
    recommendation: "Aucune solution compatible",
    generatedAt
  });
  const modes = getSelectedModes();
  const heightRequirementMessage = buildHeightDiameterRequirementMessage(room, modes, realDiameters);
  setLatestReportState(state, {
    kind: "uniformity-empty",
    strategy: dom.strategyInput.value,
    simulationName: getSimulationName(),
    room,
    modesLabel: getSelectedModesLabel(modes),
    generatedAt,
    context: "Aucune solution compatible",
    fallbackFlush,
    issues: [
      "Aucun cas standard ou low-profile n'a respecte les regles BRASSE de FCC, de distances et de hauteur.",
      ...(heightRequirementMessage ? [heightRequirementMessage] : [])
    ]
  });
  dom.summaryGrid.innerHTML = [
    createSummaryCard("Local", `${formatMeters(room.length)} × ${formatMeters(room.width)}`, `HSP ${formatMeters(room.height)}`),
    createSummaryCard("Resultat", "Aucune solution", "Aucun cas standard ou low-profile compatible"),
    createSummaryCard("Base BRASSE II", `${brasse2Models.length} modeles integres`, "Sans effet ici tant que la geometrie bloque")
  ].join("");
  dom.highlights.innerHTML = "";
  renderStatusNote(dom, room, [], fallbackFlush, modes, realDiameters);
  dom.resultsList.innerHTML = "";
  setExportAvailability(dom, true);
  dom.resultsContent.classList.remove("hidden");
}

function render() {
  toggleStrategyUI();

  const rawValues = {
    strategy: dom.strategyInput.value,
    ...getRoomInputs()
  };
  const issues = validateInputs(rawValues);
  const generatedAt = new Date();

  resetResultsVisibility();

  if (issues.length > 0) {
    renderInvalidState(rawValues, issues, generatedAt);
    return;
  }

  if (rawValues.strategy === "variabilite") {
    const room = {
      length: rawValues.length,
      width: rawValues.width,
      height: rawValues.height
    };
    const { zones, issues: zoneIssues } = parseZoneDrafts(room, state.variabilityZones);

    if (zoneIssues.length > 0) {
      renderVariabilityInvalidZones(room, zones, zoneIssues, generatedAt);
      return;
    }

    const modes = getSelectedModes();
    const designs = enumerateVariabilityDesigns(room, zones, modes, realDiameters, MAX_GRID_FANS);
    updateHeader({
      strategy: rawValues.strategy,
      room,
      recommendation: designs[0]
        ? `Option recommandee : ${designs[0].fanCount} brasseur${designs[0].fanCount > 1 ? "s" : ""} sur ${designs[0].nx} × ${designs[0].ny}`
        : "Aucune trame valide",
      generatedAt
    });
    const heightRequirementMessage = buildHeightDiameterRequirementMessage(room, modes, realDiameters);
    setLatestReportState(
      state,
      designs.length > 0
        ? {
            kind: "variability-ok",
            strategy: rawValues.strategy,
            simulationName: getSimulationName(),
            room,
            zones,
            designs: designs.slice(0, 5),
            selectedOptionKeys: createSelectedReportOptionKeys(designs.slice(0, 5)),
            modesLabel: getSelectedModesLabel(modes),
            generatedAt,
            context: `Zones a couvrir • option recommandee : ${designs[0].fanCount} brasseur${designs[0].fanCount > 1 ? "s" : ""} sur ${designs[0].nx} × ${designs[0].ny}`
          }
        : {
            kind: "variability-empty",
            strategy: rawValues.strategy,
            simulationName: getSimulationName(),
            room,
            zones,
            modesLabel: getSelectedModesLabel(modes),
            generatedAt,
            context: "Aucune trame valide",
            issues: [
              "Aucune trame reguliere n'a respecte les regles BRASSE avec les rectangles saisis.",
              ...(heightRequirementMessage ? [heightRequirementMessage] : [])
            ]
          }
    );
    renderVariabilitySummary(dom, room, zones, designs, brasse2Models);
    renderVariabilityStatusNote(dom, room, zones, designs, modes, realDiameters);
    renderVariabilityResults(
      dom,
      designs,
      brasse2Models,
      realDiameters,
      state.latestReportState?.selectedOptionKeys || []
    );
    updateExportControls();
    dom.resultsContent.classList.remove("hidden");
    return;
  }

  const room = {
    length: rawValues.length,
    width: rawValues.width,
    height: rawValues.height
  };
  const modes = getSelectedModes();
  const candidates = enumerateCandidates(room, MAX_GRID_FANS, modes, realDiameters);
  const fallbackFlush = candidates.length === 0 ? getFallbackFlushCandidate(room, MAX_GRID_FANS, realDiameters) : null;

  if (candidates.length === 0) {
    renderUniformityEmpty(room, fallbackFlush, generatedAt);
    return;
  }

  updateHeader({
    strategy: rawValues.strategy,
    room,
    recommendation: `Option recommandee : ${candidates[0].nx} × ${candidates[0].ny} - ${candidates[0].fanCount} brasseur${candidates[0].fanCount > 1 ? "s" : ""}`,
    generatedAt
  });
  setLatestReportState(state, {
    kind: "uniformity-ok",
    strategy: rawValues.strategy,
    simulationName: getSimulationName(),
    room,
    candidates: candidates.slice(0, 5),
    selectedOptionKeys: createSelectedReportOptionKeys(candidates.slice(0, 5)),
    modesLabel: getSelectedModesLabel(modes),
    generatedAt,
    context: `Recherche d'uniformite • option recommandee : ${candidates[0].nx} × ${candidates[0].ny}`
  });
  renderSummary(dom, room, candidates, brasse2Models);
  renderStatusNote(dom, room, candidates, fallbackFlush, modes, realDiameters);
  renderResults(
    dom,
    candidates,
    brasse2Models,
    realDiameters,
    state.latestReportState?.selectedOptionKeys || []
  );
  updateExportControls();
  dom.resultsContent.classList.remove("hidden");
}

dom.form.addEventListener("submit", (event) => {
  event.preventDefault();
  render();
});

dom.strategyInput.addEventListener("change", () => {
  toggleStrategyUI();
  render();
});

dom.resetButton.addEventListener("click", () => {
  dom.lengthInput.value = "9";
  dom.widthInput.value = "5";
  dom.heightInput.value = "2.5";
  dom.simulationNameInput.value = "";
  dom.strategyInput.value = "uniformite";
  dom.allowStandardInput.checked = true;
  dom.allowLowInput.checked = true;
  resetState(state);
  renderZonesPanel();
  render();
});

dom.addZoneButton.addEventListener("click", () => {
  state.variabilityZones.push(createDefaultZoneDraft(state, getCurrentRoomDraft(dom)));
  renderZonesPanel();
  if (dom.strategyInput.value === "variabilite") {
    render();
  }
});

dom.simulationNameInput.addEventListener("input", () => {
  updateHeader({
    strategy: dom.strategyInput.value,
    room: getRoomInputs()
  });
});

dom.exportPdfButton.addEventListener("click", () => {
  exportPdfReport(state.latestReportState, brasse2Models);
});

dom.catalogSearchInput.addEventListener("input", () => {
  renderCatalog(dom, brasse2Models);
});

[
  dom.catalogBrandInput,
  dom.catalogDiameterInput,
  dom.catalogMotorInput,
  dom.catalogFixationInput,
  dom.catalogSortInput
].forEach((input) => {
  input.addEventListener("change", () => {
    renderCatalog(dom, brasse2Models);
  });
});

dom.catalogResetButton.addEventListener("click", () => {
  resetCatalogFilters(dom);
  renderCatalog(dom, brasse2Models);
});

dom.zonesList.addEventListener("input", (event) => {
  const target = event.target;
  if (!target?.dataset || target.type !== "range") {
    return;
  }
  const zoneId = Number(target.dataset.zoneId);
  const field = target.dataset.field;
  if (!Number.isFinite(zoneId) || !field) {
    return;
  }

  const roomDraft = getCurrentRoomDraft(dom);
  updateZoneDraft(state, roomDraft, zoneId, field, target.value);
  const zone = state.variabilityZones.find((item) => item.id === zoneId);
  syncZoneCard(dom, zone, roomDraft);
});

dom.zonesList.addEventListener("change", (event) => {
  const target = event.target;
  if (!target?.dataset) {
    return;
  }
  const zoneId = Number(target.dataset.zoneId);
  const field = target.dataset.field;
  if (!Number.isFinite(zoneId) || !field) {
    return;
  }

  const roomDraft = getCurrentRoomDraft(dom);
  updateZoneDraft(state, roomDraft, zoneId, field, target.value);
  const zone = state.variabilityZones.find((item) => item.id === zoneId);
  syncZoneCard(dom, zone, roomDraft);
  if (dom.strategyInput.value === "variabilite") {
    render();
  }
});

dom.zonesList.addEventListener("click", (event) => {
  const removeButton =
    event.target && typeof event.target.closest === "function"
      ? event.target.closest("[data-remove-zone]")
      : null;
  if (!removeButton) {
    return;
  }
  const zoneId = Number(removeButton.dataset.removeZone);
  if (!Number.isFinite(zoneId)) {
    return;
  }
  removeZoneDraft(state, zoneId);
  renderZonesPanel();
  if (dom.strategyInput.value === "variabilite") {
    render();
  }
});

dom.resultsList.addEventListener("change", (event) => {
  const target = event.target;
  if (!target?.matches?.("[data-export-option-key]")) {
    return;
  }

  toggleLatestReportOptionSelection(state, target.dataset.exportOptionKey, target.checked);
  updateExportControls();
});

[dom.lengthInput, dom.widthInput].forEach((input) => {
  input.addEventListener("change", () => {
    if (dom.strategyInput.value !== "variabilite") {
      return;
    }
    normalizeAllZoneDrafts(state, getCurrentRoomDraft(dom));
    renderZonesPanel();
    render();
  });
});

[dom.heightInput, dom.allowStandardInput, dom.allowLowInput].forEach((input) => {
  input.addEventListener("change", () => {
    render();
  });
});

updateHeader({
  strategy: dom.strategyInput.value,
  room: getRoomInputs()
});
setExportAvailability(dom, false);
setExportSelectionSummary(dom, "");
bindResultsInteractions(dom);
initializeCatalogFilters(dom, brasse2Models);
renderCatalog(dom, brasse2Models);
toggleStrategyUI();
render();
