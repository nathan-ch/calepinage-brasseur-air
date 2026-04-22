import { BRASSE2_MODELS } from "../data/brasse2-data.js";
import { getDomRefs } from "./app/dom.js";
import {
  createAppState,
  createSelectedReportOptionKeys,
  clearCeilingLuminaires,
  getSelectedReportOptions,
  resetState,
  setLatestReportState,
  toggleLatestReportOptionSelection,
  toggleCeilingLuminaireTile,
  updateCeilingLayout
} from "./app/state.js";
import { MAX_GRID_FANS, MOUNT_MODES } from "./core/constants.js";
import {
  enumerateCandidates,
  getFallbackFlushCandidate
} from "./core/calepinage.js";
import { buildCeilingAwareDisplayCandidates } from "./core/ceilingAdaptive.js";
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
  renderSummary
} from "./ui/results.js";
import {
  refreshReportHeader,
  setExportAvailability,
  setExportSelectionSummary
} from "./ui/reportHeader.js";
import { renderCeilingEditor } from "./ui/ceilingEditor.js";
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

function renderCeilingPanel() {
  dom.ceilingEnabledInput.checked = state.ceilingLayout.enabled;
  return renderCeilingEditor(dom, state, getRoomInputs());
}

function updateHeader({ room, recommendation = "", generatedAt = new Date() }) {
  refreshReportHeader(dom, {
    simulationName: getSimulationName(),
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
    setExportAvailability(dom, latestReportState.kind !== "uniformity-ok");
    setExportSelectionSummary(
      dom,
      latestReportState.kind === "uniformity-ok" ? "Aucune option selectionnee pour le PDF" : ""
    );
    return;
  }

  const selectableCount =
    latestReportState.kind === "uniformity-ok" ? latestReportState.candidates.length : 0;

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
    room: rawValues,
    recommendation: "Calcul impossible",
    generatedAt
  });
  setLatestReportState(state, {
    kind: "invalid",
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

function renderUniformityEmpty(room, fallbackFlush, generatedAt) {
  updateHeader({
    room,
    recommendation: "Aucune solution compatible",
    generatedAt
  });
  const modes = getSelectedModes();
  const heightRequirementMessage = buildHeightDiameterRequirementMessage(room, modes, realDiameters);
  setLatestReportState(state, {
    kind: "uniformity-empty",
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
  const ceilingGrid = renderCeilingPanel();

  const rawValues = getRoomInputs();
  const issues = validateInputs(rawValues);
  const generatedAt = new Date();

  resetResultsVisibility();

  if (issues.length > 0) {
    renderInvalidState(rawValues, issues, generatedAt);
    return;
  }

  const room = {
    length: rawValues.length,
    width: rawValues.width,
    height: rawValues.height
  };
  const modes = getSelectedModes();
  const strictCandidates = enumerateCandidates(room, MAX_GRID_FANS, modes, realDiameters);
  const fallbackFlush =
    strictCandidates.length === 0
      ? getFallbackFlushCandidate(room, MAX_GRID_FANS, realDiameters)
      : null;

  if (strictCandidates.length === 0) {
    renderUniformityEmpty(room, fallbackFlush, generatedAt);
    return;
  }

  const candidates = ceilingGrid
    ? buildCeilingAwareDisplayCandidates(
        strictCandidates,
        room,
        modes,
        realDiameters,
        ceilingGrid,
        MAX_GRID_FANS
      )
    : strictCandidates.slice(0, 5).map((candidate) => ({
        ...candidate,
        placementMode: "strict"
      }));

  updateHeader({
    room,
    recommendation: `Option recommandee : ${candidates[0].nx} × ${candidates[0].ny} - ${candidates[0].fanCount} brasseur${candidates[0].fanCount > 1 ? "s" : ""}`,
    generatedAt
  });
  setLatestReportState(state, {
    kind: "uniformity-ok",
    simulationName: getSimulationName(),
    room,
    candidates,
    selectedOptionKeys: createSelectedReportOptionKeys(candidates),
    modesLabel: getSelectedModesLabel(modes),
    generatedAt,
    context: `Recherche d'uniformite • option recommandee : ${candidates[0].nx} × ${candidates[0].ny}`
  });
  renderSummary(dom, room, candidates, brasse2Models, strictCandidates.length);
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

dom.resetButton.addEventListener("click", () => {
  dom.lengthInput.value = "9";
  dom.widthInput.value = "5";
  dom.heightInput.value = "2.5";
  dom.simulationNameInput.value = "";
  dom.allowStandardInput.checked = true;
  dom.allowLowInput.checked = true;
  resetState(state);
  render();
});

dom.simulationNameInput.addEventListener("input", () => {
  updateHeader({
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

dom.resultsList.addEventListener("change", (event) => {
  const target = event.target;
  if (!target?.matches?.("[data-export-option-key]")) {
    return;
  }

  toggleLatestReportOptionSelection(state, target.dataset.exportOptionKey, target.checked);
  updateExportControls();
});

dom.ceilingEnabledInput.addEventListener("change", () => {
  updateCeilingLayout(state, {
    enabled: dom.ceilingEnabledInput.checked
  });
  render();
});

[dom.ceilingAnchorXInput, dom.ceilingAnchorYInput].forEach((input) => {
  input.addEventListener("change", () => {
    updateCeilingLayout(state, {
      xAnchorMode: dom.ceilingAnchorXInput.value,
      yAnchorMode: dom.ceilingAnchorYInput.value
    });
    render();
  });
});

dom.ceilingEditorCanvas.addEventListener("click", (event) => {
  const tileElement =
    event.target && typeof event.target.closest === "function"
      ? event.target.closest("[data-luminaire-tile-key]")
      : null;

  if (!tileElement) {
    return;
  }

  toggleCeilingLuminaireTile(state, tileElement.dataset.luminaireTileKey);
  render();
});

dom.clearCeilingLuminairesButton.addEventListener("click", () => {
  clearCeilingLuminaires(state);
  render();
});

[dom.lengthInput, dom.widthInput, dom.heightInput, dom.allowStandardInput, dom.allowLowInput].forEach(
  (input) => {
    input.addEventListener("change", () => {
      render();
    });
  }
);

updateHeader({
  room: getRoomInputs()
});
setExportAvailability(dom, false);
setExportSelectionSummary(dom, "");
bindResultsInteractions(dom);
initializeCatalogFilters(dom, brasse2Models);
renderCatalog(dom, brasse2Models);
render();
