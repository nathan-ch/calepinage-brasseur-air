import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeCatalogSearch,
  getCatalogFilterOptions,
  getCatalogActiveFilterLabels,
  getFilteredCatalogModels,
  compareCatalogIdentity
} from "../src/core/catalog.js";

// Mock models for catalog testing
const mockModels = [
  {
    id: "H01",
    brand: "Hunter",
    model: "Zephyr",
    motor: "DC",
    fixation: "Tige",
    diameterCm: 132,
    powerMaxW: 30,
    ceDirDeboutMax: 2.5,
    cfeDirDeboutMax: 0.0833,
    lwaMaxDbA: 40
  },
  {
    id: "H02",
    brand: "Hunter",
    model: "Classic",
    motor: "AC",
    fixation: "Plafonnier",
    diameterCm: 122,
    powerMaxW: 60,
    ceDirDeboutMax: 1.8,
    cfeDirDeboutMax: 0.03,
    lwaMaxDbA: 45
  },
  {
    id: "F01",
    brand: "Fanimation",
    model: "Windward",
    motor: "DC",
    fixation: "Tige",
    diameterCm: 162,
    powerMaxW: 35,
    ceDirDeboutMax: 3.2,
    cfeDirDeboutMax: 0.0914,
    lwaMaxDbA: 38
  }
];

test("catalog - normalizeCatalogSearch", () => {
  assert.equal(normalizeCatalogSearch(" Hunter  "), "hunter");
  assert.equal(normalizeCatalogSearch("Éléctricité"), "electricite");
  assert.equal(normalizeCatalogSearch(null), "");
});

test("catalog - getCatalogFilterOptions", () => {
  const options = getCatalogFilterOptions(mockModels);
  assert.deepEqual(options.brands, ["Fanimation", "Hunter"]);
  assert.deepEqual(options.diameters, [122, 132, 162]);
  assert.deepEqual(options.motors, ["AC", "DC"]);
  assert.deepEqual(options.fixations, ["Plafonnier", "Tige"]);
});

test("catalog - getCatalogActiveFilterLabels", () => {
  const filters = {
    search: "Hunter",
    brand: "Hunter",
    diameterCm: 122,
    motor: "AC",
    fixation: "Plafonnier"
  };
  const labels = getCatalogActiveFilterLabels(filters);
  assert.deepEqual(labels, [
    "recherche: Hunter",
    "marque: Hunter",
    "diametre: 122 cm",
    "moteur: AC",
    "fixation: Plafonnier"
  ]);

  assert.deepEqual(getCatalogActiveFilterLabels({}), []);
});

test("catalog - compareCatalogIdentity", () => {
  const a = { brand: "A", model: "B", id: "1" };
  const b = { brand: "A", model: "B", id: "2" };
  const c = { brand: "B", model: "A", id: "1" };

  assert.ok(compareCatalogIdentity(a, b) < 0); // sorted by id if brand and model are identical
  assert.ok(compareCatalogIdentity(a, c) < 0); // sorted by brand
});

test("catalog - getFilteredCatalogModels filtering", () => {
  // Search filter
  let results = getFilteredCatalogModels(mockModels, { search: "zeph" });
  assert.equal(results.length, 1);
  assert.equal(results[0].id, "H01");

  // Brand filter
  results = getFilteredCatalogModels(mockModels, { brand: "Fanimation" });
  assert.equal(results.length, 1);
  assert.equal(results[0].id, "F01");

  // Diameter filter
  results = getFilteredCatalogModels(mockModels, { diameterCm: 122 });
  assert.equal(results.length, 1);
  assert.equal(results[0].id, "H02");

  // Combined filters
  results = getFilteredCatalogModels(mockModels, { motor: "DC", fixation: "Tige" });
  assert.equal(results.length, 2);
});

test("catalog - getFilteredCatalogModels sorting", () => {
  // diameter-asc
  let results = getFilteredCatalogModels(mockModels, { sort: "diameter-asc" });
  assert.equal(results[0].id, "H02"); // 122
  assert.equal(results[2].id, "F01"); // 162

  // diameter-desc
  results = getFilteredCatalogModels(mockModels, { sort: "diameter-desc" });
  assert.equal(results[0].id, "F01"); // 162
  assert.equal(results[2].id, "H02"); // 122

  // comfort (CE max desc)
  results = getFilteredCatalogModels(mockModels, { sort: "comfort" });
  assert.equal(results[0].id, "F01"); // 3.2
  assert.equal(results[1].id, "H01"); // 2.5
  assert.equal(results[2].id, "H02"); // 1.8

  // efficiency (CFE max desc)
  results = getFilteredCatalogModels(mockModels, { sort: "efficiency" });
  assert.equal(results[0].id, "F01"); // 0.0914
  assert.equal(results[1].id, "H01"); // 0.0833

  // acoustics (LwA asc)
  results = getFilteredCatalogModels(mockModels, { sort: "acoustics" });
  assert.equal(results[0].id, "F01"); // 38
  assert.equal(results[1].id, "H01"); // 40
  assert.equal(results[2].id, "H02"); // 45

  // power (W max asc)
  results = getFilteredCatalogModels(mockModels, { sort: "power" });
  assert.equal(results[0].id, "H01"); // 30
  assert.equal(results[1].id, "F01"); // 35
  assert.equal(results[2].id, "H02"); // 60
});
