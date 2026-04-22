import {
  getCatalogActiveFilterLabels,
  getCatalogFilterOptions,
  getFilteredCatalogModels
} from "../core/catalog.js";
import {
  escapeHtml,
  formatDb,
  formatNumber,
  formatTemp,
  formatWatts
} from "../core/formatters.js";

function setCatalogSelectOptions(select, options, emptyLabel, formatter = (value) => value) {
  select.innerHTML = [
    `<option value="">${escapeHtml(emptyLabel)}</option>`,
    ...options.map(
      (value) =>
        `<option value="${escapeHtml(String(value))}">${escapeHtml(formatter(value))}</option>`
    )
  ].join("");
}

export function initializeCatalogFilters(dom, brasse2Models) {
  const options = getCatalogFilterOptions(brasse2Models);
  setCatalogSelectOptions(dom.catalogBrandInput, options.brands, "Toutes les marques");
  setCatalogSelectOptions(dom.catalogDiameterInput, options.diameters, "Tous les diametres", (value) => `${value} cm`);
  setCatalogSelectOptions(dom.catalogMotorInput, options.motors, "Tous les moteurs");
  setCatalogSelectOptions(dom.catalogFixationInput, options.fixations, "Toutes les fixations");
  dom.catalogSortInput.value = "diameter-asc";
}

export function resetCatalogFilters(dom) {
  dom.catalogSearchInput.value = "";
  dom.catalogBrandInput.value = "";
  dom.catalogDiameterInput.value = "";
  dom.catalogMotorInput.value = "";
  dom.catalogFixationInput.value = "";
  dom.catalogSortInput.value = "diameter-asc";
}

export function getCatalogFilterState(dom) {
  return {
    search: String(dom.catalogSearchInput.value || "").trim(),
    brand: dom.catalogBrandInput.value,
    diameterCm: Number.parseInt(dom.catalogDiameterInput.value, 10),
    motor: dom.catalogMotorInput.value,
    fixation: dom.catalogFixationInput.value,
    sort: dom.catalogSortInput.value || "diameter-asc"
  };
}

function renderCatalogTable(models) {
  if (models.length === 0) {
    return `
      <div class="notice warning">
        <strong>Aucun modele ne correspond aux filtres actifs.</strong>
        Ajustez les criteres ou reinitialisez les filtres pour retrouver la base complete.
      </div>
    `;
  }

  return `
    <div class="table-wrap catalog-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Ref.</th>
            <th>Marque</th>
            <th>Modele</th>
            <th>Diam.</th>
            <th>Moteur</th>
            <th>Fixation</th>
            <th>Plafond/BA</th>
            <th>H test</th>
            <th>CE dir debout</th>
            <th>CFE dir debout</th>
            <th>CE moyen</th>
            <th>LwA</th>
            <th>P max</th>
          </tr>
        </thead>
        <tbody>
          ${models
            .map(
              (model) => `
                <tr>
                  <td>${escapeHtml(model.id)}</td>
                  <td>${escapeHtml(model.brand)}</td>
                  <td>${escapeHtml(model.model)}</td>
                  <td>${escapeHtml(String(model.diameterCm))}</td>
                  <td>${escapeHtml(model.motor)}</td>
                  <td>${escapeHtml(model.fixation)}</td>
                  <td>${formatNumber(model.ceilingDistanceCm, 1)} cm</td>
                  <td>${formatNumber(model.testHeightCm, 1)} cm</td>
                  <td>${formatTemp(model.ceDirDeboutMax)}</td>
                  <td>${formatNumber(model.cfeDirDeboutMax, 4)} °C/W</td>
                  <td>${formatTemp(model.ceAvgMax)}</td>
                  <td>${formatDb(model.lwaMaxDbA)}</td>
                  <td>${formatWatts(model.powerMaxW, 0)}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function renderCatalog(dom, brasse2Models) {
  const filters = getCatalogFilterState(dom);
  const models = getFilteredCatalogModels(brasse2Models, filters);
  const activeFilters = getCatalogActiveFilterLabels(filters);

  dom.catalogSummary.innerHTML = `
    <strong>${models.length}</strong> modele${models.length > 1 ? "s" : ""} affiche${models.length > 1 ? "s" : ""}
    sur ${brasse2Models.length}
    ${activeFilters.length > 0 ? ` • Filtres actifs : ${escapeHtml(activeFilters.join(" • "))}` : ""}
  `;
  dom.catalogTableHost.innerHTML = renderCatalogTable(models);
}
