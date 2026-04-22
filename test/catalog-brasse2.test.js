import test from "node:test";
import assert from "node:assert/strict";

import { BRASSE2_MODELS } from "../data/brasse2-data.js";
import { getFilteredCatalogModels } from "../src/core/catalog.js";
import { getBrasse2ModelsForCandidate, buildModelPicks } from "../src/core/brasse2.js";
import { enumerateCandidates } from "../src/core/calepinage.js";
import { MOUNT_MODES, MAX_GRID_FANS } from "../src/core/constants.js";

const realDiameters = [
  ...new Set(BRASSE2_MODELS.map((model) => Number(model.diameterCm) / 100))
].sort((a, b) => a - b);

test("le catalogue filtre par marque et trie par diametre croissant", () => {
  const models = getFilteredCatalogModels(BRASSE2_MODELS, {
    search: "",
    brand: "Hunter",
    diameterCm: Number.NaN,
    motor: "",
    fixation: "",
    sort: "diameter-asc"
  });

  assert.ok(models.length > 0);
  assert.ok(models.every((model) => model.brand === "Hunter"));
  assert.ok(models[0].diameterCm <= models.at(-1).diameterCm);
});

test("les modeles BRASSE II compatibles sont derives de l'option de calepinage", () => {
  const room = { length: 9, width: 5, height: 2.75 };
  const candidates = enumerateCandidates(room, MAX_GRID_FANS, MOUNT_MODES, realDiameters);
  const models = getBrasse2ModelsForCandidate(candidates[0], BRASSE2_MODELS);

  assert.ok(models.length > 0);
  assert.ok(models.some((model) => model.isSelectedDiameter));
  assert.ok(buildModelPicks(models).length > 0);
});
