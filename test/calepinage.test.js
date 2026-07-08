import test from "node:test";
import assert from "node:assert/strict";

import { BRASSE2_MODELS } from "../data/brasse2-data.js";
import {
  enumerateCandidates,
  buildHeightFeasibility,
  evaluateCandidate,
  compareCandidates,
  getFallbackFlushCandidate
} from "../src/core/calepinage.js";
import { MOUNT_MODES, MAX_GRID_FANS } from "../src/core/constants.js";
import { buildHeightDiameterRequirementMessage } from "../src/core/messages.js";

const realDiameters = [
  ...new Set(BRASSE2_MODELS.map((model) => Number(model.diameterCm) / 100))
].sort((a, b) => a - b);

test("le cas 9 x 5 x 2,75 priorise bien 1x1 low-profile avant 2x1 low-profile", () => {
  const room = { length: 9, width: 5, height: 2.75 };
  const candidates = enumerateCandidates(room, MAX_GRID_FANS, MOUNT_MODES, realDiameters);

  assert.ok(candidates.length > 0);
  assert.equal(candidates[0].key, "1x1-low-profile");
  assert.equal(candidates[1].key, "2x1-low-profile");
});

test("le message de hauteur explicite la limite BRASSE II a 4 m de HSP", () => {
  const room = { length: 9, width: 5, height: 4 };
  const candidates = enumerateCandidates(room, MAX_GRID_FANS, MOUNT_MODES, realDiameters);

  assert.ok(candidates.length > 0);
  assert.ok(candidates.every((c) => c.compatibleRealDiameters.length === 0));

  const message = buildHeightDiameterRequirementMessage(room, MOUNT_MODES, realDiameters);
  assert.match(message, /162 cm/);
  assert.match(message, /1,7 m/);
  assert.match(message, /1,78 m/);
});

test("calepinage - buildHeightFeasibility boundary values", () => {
  // HSP = 2.13m (safety height of small fans)
  // smallUpper: (2.13 - 2.13) / 0.35 = 0.
  // Since 0 < smallLower (which is > 0.2*sqrt(cellArea)), small interval will be empty.
  // largeUpper: (2.13 - 3.05) / 0.35 = -2.62. Empty too.
  // So no intervals at 2.13m HSP.
  const emptyIntervals = buildHeightFeasibility(2.13, 0.35, 1.0, 2.5);
  assert.equal(emptyIntervals.length, 0);

  // HSP = 3.2m, standard mode (factor = 0.35)
  // For small fans (D < 2.13m): safety is 2.13m.
  // smallUpper = min(2.13 - EPS, (3.2 - 2.13)/0.35) = min(2.13, 3.05) = 2.13.
  const standardIntervals = buildHeightFeasibility(3.2, 0.35, 1.0, 2.5);
  assert.ok(standardIntervals.length > 0);
  assert.ok(standardIntervals.some((i) => i.fanClass === "small"));
});

test("calepinage - evaluateCandidate geometric constraints", () => {
  const room = { length: 9, width: 5, height: 2.75 };
  const standardMode = MOUNT_MODES[0]; // factor = 0.35

  // Evaluates successfully for 1x1
  const cand1 = evaluateCandidate(room, 1, 1, standardMode, realDiameters);
  assert.ok(cand1);
  assert.equal(cand1.nx, 1);
  assert.equal(cand1.ny, 1);
  assert.ok(cand1.diameter > 0);
  assert.ok(cand1.coordinates.length === 1);
  assert.equal(cand1.coordinates[0].x, 4.5);
  assert.equal(cand1.coordinates[0].y, 2.5);

  // Checks wall distance restriction: short cell side center-to-wall is 2.5m
  assert.ok(cand1.diameter <= cand1.cellShort / 2 + 1e-5);
});

test("calepinage - compareCandidates sorting logic", () => {
  const a = {
    key: "A",
    diameter: 2.1,
    formFactor: 1.2,
    coverageFactor: 0.35,
    mountMode: { id: "standard" },
    fanCount: 2
  };
  const b = {
    key: "B",
    diameter: 1.8,
    formFactor: 1.1,
    coverageFactor: 0.38,
    mountMode: { id: "standard" },
    fanCount: 1
  };
  const c = {
    key: "C",
    diameter: 1.8,
    formFactor: 1.05,
    coverageFactor: 0.38,
    mountMode: { id: "standard" },
    fanCount: 1
  };
  const d = {
    key: "D",
    diameter: 1.8,
    formFactor: 1.05,
    coverageFactor: 0.39,
    mountMode: { id: "standard" },
    fanCount: 1
  };
  const e = {
    key: "E",
    diameter: 1.8,
    formFactor: 1.05,
    coverageFactor: 0.39,
    mountMode: { id: "low-profile" },
    fanCount: 1
  };
  const f = {
    key: "F",
    diameter: 1.8,
    formFactor: 1.05,
    coverageFactor: 0.39,
    mountMode: { id: "low-profile" },
    fanCount: 2
  };

  // 1. Diameter desc
  assert.ok(compareCandidates(a, b) < 0); // a has larger diameter, ranks first

  // 2. Form factor close to 1
  assert.ok(compareCandidates(b, c) > 0); // c formFactor (1.05) is closer to 1 than b (1.1)

  // 3. Coverage factor close to 0.4
  assert.ok(compareCandidates(c, d) > 0); // d coverageFactor (0.39) is closer to 0.4 than c (0.38)

  // 4. Mount standard before low-profile
  assert.ok(compareCandidates(d, e) < 0); // d is standard, e is low-profile

  // 5. Fan count asc
  assert.ok(compareCandidates(e, f) < 0); // e has 1 fan, f has 2 fans
});

test("calepinage - getFallbackFlushCandidate fallback option", () => {
  // A room with very low height where no standard or low-profile mounts pass (HSP = 2.3m)
  const room = { length: 5, width: 5, height: 2.3 };
  const standardModesOnly = [MOUNT_MODES[0]]; // standard only
  const candidates = enumerateCandidates(room, MAX_GRID_FANS, standardModesOnly, realDiameters);

  // If standard candidates is empty, check fallback flush
  if (candidates.length === 0) {
    const fallback = getFallbackFlushCandidate(room, MAX_GRID_FANS, realDiameters);
    assert.ok(fallback);
    assert.equal(fallback.mountMode.id, "flush");
  }
});

test("calepinage - extreme geometry / wall clearance conflict (narrow room)", () => {
  // Narrow room: 10m x 1.5m, height 3m (HSP is high enough).
  // cellShort = 1.5m -> wallMaxDiameter = 1.5 / 2 = 0.75m.
  // cellArea = 15m² -> coverageMinDiameter = 0.2 * sqrt(15) = 0.7746m.
  // Since wallMaxDiameter (0.75) < coverageMinDiameter (0.7746), no diameter satisfies both.
  // So evaluateCandidate should return null.
  const room = { length: 10, width: 1.5, height: 3 };
  const cand = evaluateCandidate(room, 1, 1, MOUNT_MODES[0], realDiameters);
  assert.equal(cand, null);
});

test("calepinage - elongated room wall clearance capping", () => {
  // Elongated room: 10m x 4m, height 4.5m (HSP high enough, standard mount = 0.35 factor).
  // cellShort = 4m -> wallMaxDiameter = 2.0m.
  // cellArea = 40m² -> coverageMaxDiameter = 0.4 * sqrt(40) = 2.53m.
  // Sizing should be capped exactly by wall clearance at 2.0m.
  const room = { length: 10, width: 4, height: 4.5 };
  const cand = evaluateCandidate(room, 1, 1, MOUNT_MODES[0], realDiameters);
  assert.ok(cand);
  assert.equal(cand.diameter, 2.0); // exactly limited by wallMaxDiameter
});

test("calepinage - inter-fan spacing capping", () => {
  // Spacing capped: 9m x 5m, height 4m (standard mount = 0.35 factor).
  // In 2x1 grid, cellLength = 4.5m, cellWidth = 5m.
  // spacing = 4.5m -> interFanMaxDiameter = 4.5 / 2.5 = 1.8m.
  // wallMaxDiameter = 4.5 / 2 = 2.25m.
  // coverageMaxDiameter = 0.4 * sqrt(22.5) = 1.897m.
  // Sizing should be capped exactly by inter-fan spacing at 1.8m.
  const room = { length: 9, width: 5, height: 4 };
  const cand = evaluateCandidate(room, 2, 1, MOUNT_MODES[0], realDiameters);
  assert.ok(cand);
  assert.equal(cand.diameter, 1.8); // exactly limited by interFanMaxDiameter
});

test("calepinage - safety height boundaries", () => {
  // 1. Ceiling height strictly below small fan safety limit (HSP = 2.12m)
  // No fan (even small) can be placed because safety height must be >= 2.13m.
  const roomVeryLow = { length: 5, width: 5, height: 2.12 };
  const candVeryLow = enumerateCandidates(roomVeryLow, MAX_GRID_FANS, MOUNT_MODES, realDiameters);
  assert.equal(candVeryLow.length, 0);

  // 2. Ceiling height strictly below large fan safety limit but above small limit (HSP = 3.04m, standard mount)
  // Small fans are allowed (safety >= 2.13m), but large fans (D >= 2.13m) are strictly forbidden
  // because large fan safety height is 3.05m.
  const roomMid = { length: 5, width: 5, height: 3.04 };
  const candidatesMid = enumerateCandidates(roomMid, MAX_GRID_FANS, MOUNT_MODES, realDiameters);
  assert.ok(candidatesMid.length > 0);
  assert.ok(candidatesMid.every((c) => c.fanClass === "small" && c.diameter < 2.13));
});
