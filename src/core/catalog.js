import {
  compareAcoustics,
  compareComfort,
  compareEfficiency
} from "./brasse2.js";

export function compareCatalogIdentity(a, b) {
  const brandDiff = String(a.brand).localeCompare(String(b.brand), "fr", {
    sensitivity: "base"
  });
  if (brandDiff !== 0) {
    return brandDiff;
  }
  const modelDiff = String(a.model).localeCompare(String(b.model), "fr", {
    sensitivity: "base"
  });
  if (modelDiff !== 0) {
    return modelDiff;
  }
  return String(a.id).localeCompare(String(b.id), "fr", {
    sensitivity: "base",
    numeric: true
  });
}

export const CATALOG_SORTS = {
  "diameter-asc": (a, b) => a.diameterCm - b.diameterCm || compareCatalogIdentity(a, b),
  "diameter-desc": (a, b) => b.diameterCm - a.diameterCm || compareCatalogIdentity(a, b),
  comfort: (a, b) => compareComfort(a, b) || compareCatalogIdentity(a, b),
  efficiency: (a, b) => compareEfficiency(a, b) || compareCatalogIdentity(a, b),
  acoustics: (a, b) => compareAcoustics(a, b) || compareCatalogIdentity(a, b),
  power: (a, b) => a.powerMaxW - b.powerMaxW || compareCatalogIdentity(a, b),
  brand: compareCatalogIdentity
};

export function normalizeCatalogSearch(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "");
}

export function getCatalogFilterOptions(brasse2Models) {
  return {
    brands: [...new Set(brasse2Models.map((model) => model.brand))].sort((a, b) =>
      String(a).localeCompare(String(b), "fr", { sensitivity: "base" })
    ),
    diameters: [...new Set(brasse2Models.map((model) => model.diameterCm))].sort((a, b) => a - b),
    motors: [...new Set(brasse2Models.map((model) => model.motor))].sort(),
    fixations: [...new Set(brasse2Models.map((model) => model.fixation))].sort((a, b) =>
      String(a).localeCompare(String(b), "fr", { sensitivity: "base" })
    )
  };
}

export function getCatalogActiveFilterLabels(filters) {
  const labels = [];
  if (filters.search) {
    labels.push(`recherche: ${filters.search}`);
  }
  if (filters.brand) {
    labels.push(`marque: ${filters.brand}`);
  }
  if (Number.isFinite(filters.diameterCm)) {
    labels.push(`diametre: ${filters.diameterCm} cm`);
  }
  if (filters.motor) {
    labels.push(`moteur: ${filters.motor}`);
  }
  if (filters.fixation) {
    labels.push(`fixation: ${filters.fixation}`);
  }
  return labels;
}

export function getFilteredCatalogModels(brasse2Models, filters) {
  const search = normalizeCatalogSearch(filters.search);
  const comparator = CATALOG_SORTS[filters.sort] || CATALOG_SORTS["diameter-asc"];

  return brasse2Models
    .filter((model) => {
      if (search) {
        const haystack = normalizeCatalogSearch(
          `${model.id} ${model.brand} ${model.model} ${model.motor} ${model.fixation} ${model.diameterCm}`
        );
        if (!haystack.includes(search)) {
          return false;
        }
      }

      if (filters.brand && model.brand !== filters.brand) {
        return false;
      }
      if (Number.isFinite(filters.diameterCm) && model.diameterCm !== filters.diameterCm) {
        return false;
      }
      if (filters.motor && model.motor !== filters.motor) {
        return false;
      }
      if (filters.fixation && model.fixation !== filters.fixation) {
        return false;
      }
      return true;
    })
    .sort(comparator);
}
