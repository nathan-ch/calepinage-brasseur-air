import test from "node:test";
import assert from "node:assert/strict";

import {
  findBestGridForFanCount,
  evaluateCustomCandidate
} from "../src/core/calepinage.js";
import { MOUNT_MODES, FLUSH_MODE } from "../src/core/constants.js";

test("custom - findBestGridForFanCount optimal shapes", () => {
  const room = { length: 9, width: 5 };

  // 1 fan -> 1x1
  assert.deepEqual(findBestGridForFanCount(room, 1), { nx: 1, ny: 1 });

  // 2 fans -> 2x1 cell is 4.5x5 (ratio 1.11) over 1x2 cell is 9x2.5 (ratio 3.6)
  assert.deepEqual(findBestGridForFanCount(room, 2), { nx: 2, ny: 1 });

  // 4 fans -> 2x2 cell is 4.5x2.5 (ratio 1.8) over 4x1 or 1x4
  assert.deepEqual(findBestGridForFanCount(room, 4), { nx: 2, ny: 2 });
});

test("custom - evaluateCustomCandidate conforming config", () => {
  // Conforming standard layout: 9m x 5m room, HSP 2.75m, 1 fan of diameter 1.42m
  const room = { length: 9, width: 5, height: 2.75 };
  const mockRealDiameters = [0.91, 1.22, 1.42, 1.62];

  const cand = evaluateCustomCandidate(room, 1, 1.42, MOUNT_MODES[0], mockRealDiameters);

  assert.ok(cand);
  assert.equal(cand.isCustom, true);
  assert.equal(cand.fanCount, 1);
  assert.equal(cand.diameter, 1.42);
  assert.equal(cand.nx, 1);
  assert.equal(cand.ny, 1);

  const c = cand.conformity;
  assert.equal(c.conforming, true);
  assert.equal(c.wallClearanceOk, true);
  assert.equal(c.spacingOk, true);
  assert.equal(c.coverageOk, true);
  assert.equal(c.safetyHeightOk, true);
  assert.equal(c.heightRangeOk, true);
});

test("custom - evaluateCustomCandidate non-conforming configuration (height conflict)", () => {
  // Room too low: 9m x 5m, height 2.20m, 1 fan of 1.32m (safety height is 2.13m)
  // standard mount distance is 0.35 * 1.32 = 0.462m.
  // bladeHeight = 2.20 - 0.462 = 1.738m < 2.13m safety limit.
  const room = { length: 9, width: 5, height: 2.2 };
  const cand = evaluateCustomCandidate(room, 1, 1.32, MOUNT_MODES[0], []);

  assert.ok(cand);
  assert.equal(cand.conformity.conforming, false);
  assert.equal(cand.conformity.safetyHeightOk, false); // height safety fails
});

test("custom - evaluateCustomCandidate flush mount validation", () => {
  const room = { length: 9, width: 5, height: 2.5 };
  const cand = evaluateCustomCandidate(room, 1, 1.32, FLUSH_MODE, []);

  assert.ok(cand);
  assert.equal(cand.mountMode.id, "flush");
  assert.equal(cand.mountDistance, 0.15 * 1.32);
});
