import test from "node:test";
import assert from "node:assert/strict";

import { BRASSE2_MODELS } from "../data/brasse2-data.js";
import {
  enumerateCandidates,
  enumerateVariabilityDesigns
} from "../src/core/calepinage.js";
import { MOUNT_MODES, MAX_GRID_FANS } from "../src/core/constants.js";
import { buildHeightDiameterRequirementMessage } from "../src/core/messages.js";

const realDiameters = [
  ...new Set(BRASSE2_MODELS.map((model) => Number(model.diameterCm) / 100))
].sort((a, b) => a - b);

test("le cas 9 x 5 x 2,75 priorise bien 2x1 standard avant low-profile", () => {
  const room = { length: 9, width: 5, height: 2.75 };
  const candidates = enumerateCandidates(room, MAX_GRID_FANS, MOUNT_MODES, realDiameters);

  assert.ok(candidates.length > 0);
  assert.equal(candidates[0].key, "2x1-standard");
  assert.equal(candidates[1].key, "2x1-low-profile");
});

test("le message de hauteur explicite la limite BRASSE II a 4 m de HSP", () => {
  const room = { length: 9, width: 5, height: 4 };
  const candidates = enumerateCandidates(room, MAX_GRID_FANS, MOUNT_MODES, realDiameters);

  assert.equal(candidates.length, 0);

  const message = buildHeightDiameterRequirementMessage(room, MOUNT_MODES, realDiameters);
  assert.match(message, /162 cm/);
  assert.match(message, /1,7 m/);
  assert.match(message, /1,78 m/);
});

test("le mode zones a couvrir retourne une trame valide sur un cas simple", () => {
  const room = { length: 9, width: 5, height: 2.5 };
  const zones = [
    {
      id: 1,
      name: "Zone 1",
      centerX: 2.25,
      centerY: 2.5,
      length: 3,
      width: 2.2,
      minX: 0.75,
      maxX: 3.75,
      minY: 1.4,
      maxY: 3.6,
      area: 6.6
    },
    {
      id: 2,
      name: "Zone 2",
      centerX: 6.75,
      centerY: 2.5,
      length: 3,
      width: 2.2,
      minX: 5.25,
      maxX: 8.25,
      minY: 1.4,
      maxY: 3.6,
      area: 6.6
    }
  ];

  const designs = enumerateVariabilityDesigns(
    room,
    zones,
    MOUNT_MODES,
    realDiameters,
    MAX_GRID_FANS
  );

  assert.ok(designs.length > 0);
  assert.ok(designs[0].fanCount >= 1);
});
