import { BRASSE2_MODELS } from "../data/brasse2-data.js";
import { getDomRefs } from "./app/dom.js";
import {
  createAppState,
  createSelectedReportOptionKeys,
  getSelectedReportOptions,
  resetState,
  setLatestReportState,
  toggleLatestReportOptionSelection
} from "./app/state.js";
import { MAX_GRID_FANS, MOUNT_MODES, FLUSH_MODE } from "./core/constants.js";
import {
  enumerateCandidates,
  getFallbackFlushCandidate,
  evaluateCustomCandidate
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
  renderSummary
} from "./ui/results.js";
import {
  refreshReportHeader,
  setExportAvailability,
  setExportSelectionSummary
} from "./ui/reportHeader.js";
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

  if (state.mode === "auto") {
    if (!dom.allowStandardInput.checked && !dom.allowLowInput.checked) {
      issues.push("Selectionnez au moins un type de montage.");
    }
  } else {
    const diameter = parseNumber(dom.manualDiameterInput);
    if (!(diameter > 0)) {
      issues.push("Le diametre du brasseur doit etre strictement positif.");
    }
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

  if (state.mode === "manual") {
    const diameter = parseNumber(dom.manualDiameterInput);
    const fanCount = Number(dom.fanCountSelect.value);
    const mountModeId = dom.manualMountSelect.value;
    let mountMode = MOUNT_MODES.find((m) => m.id === mountModeId);
    if (!mountMode && mountModeId === "flush") {
      mountMode = FLUSH_MODE;
    }

    const candidate = evaluateCustomCandidate(room, fanCount, diameter, mountMode, realDiameters);
    const recommendation = `Configuration personnalisee : ${candidate.nx} × ${candidate.ny} - ${candidate.fanCount} brasseur${candidate.fanCount > 1 ? "s" : ""} (${candidate.conformity.conforming ? "conforme" : "non conforme"})`;

    updateHeader({
      room,
      recommendation,
      generatedAt
    });

    setLatestReportState(state, {
      kind: "uniformity-ok",
      simulationName: getSimulationName(),
      room,
      candidates: [candidate],
      selectedOptionKeys: createSelectedReportOptionKeys([candidate]),
      modesLabel: candidate.mountMode.label,
      generatedAt,
      context: `Configuration personnalisee • trame : ${candidate.nx} × ${candidate.ny}`
    });

    renderSummary(dom, room, [candidate], brasse2Models);
    dom.statusNote.innerHTML = "";
    renderResults(
      dom,
      [candidate],
      brasse2Models,
      realDiameters,
      state.latestReportState?.selectedOptionKeys || []
    );
    updateExportControls();
    dom.resultsContent.classList.remove("hidden");
    return;
  }

  const modes = getSelectedModes();
  const candidates = enumerateCandidates(room, MAX_GRID_FANS, modes, realDiameters);
  const fallbackFlush =
    candidates.length === 0 ? getFallbackFlushCandidate(room, MAX_GRID_FANS, realDiameters) : null;

  if (candidates.length === 0) {
    renderUniformityEmpty(room, fallbackFlush, generatedAt);
    return;
  }

  updateHeader({
    room,
    recommendation: `Option recommandee : ${candidates[0].nx} × ${candidates[0].ny} - ${candidates[0].fanCount} brasseur${candidates[0].fanCount > 1 ? "s" : ""}`,
    generatedAt
  });
  setLatestReportState(state, {
    kind: "uniformity-ok",
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

function switchTab(mode) {
  if (state.mode === mode) {
    return;
  }
  state.mode = mode;

  if (mode === "auto") {
    dom.tabAuto.classList.add("active");
    dom.tabManual.classList.remove("active");
    dom.autoFields.classList.add("active");
    dom.manualFields.classList.remove("active");
  } else {
    dom.tabAuto.classList.remove("active");
    dom.tabManual.classList.add("active");
    dom.autoFields.classList.remove("active");
    dom.manualFields.classList.add("active");
  }
  render();
}

dom.tabAuto.addEventListener("click", () => switchTab("auto"));
dom.tabManual.addEventListener("click", () => switchTab("manual"));

dom.resetButton.addEventListener("click", () => {
  dom.lengthInput.value = "9";
  dom.widthInput.value = "5";
  dom.heightInput.value = "2.5";
  dom.simulationNameInput.value = "";
  dom.allowStandardInput.checked = true;
  dom.allowLowInput.checked = true;
  dom.fanCountSelect.value = "4";
  dom.manualDiameterInput.value = "1.32";
  dom.manualMountSelect.value = "standard";

  state.mode = "auto";
  dom.tabAuto.classList.add("active");
  dom.tabManual.classList.remove("active");
  dom.autoFields.classList.add("active");
  dom.manualFields.classList.remove("active");

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

[
  dom.lengthInput,
  dom.widthInput,
  dom.heightInput,
  dom.allowStandardInput,
  dom.allowLowInput,
  dom.fanCountSelect,
  dom.manualDiameterInput,
  dom.manualMountSelect
].forEach(
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
