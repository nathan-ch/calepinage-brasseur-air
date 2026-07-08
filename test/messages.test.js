import test from "node:test";
import assert from "node:assert/strict";

import {
  buildHeightDiameterRequirementMessage,
  getCandidateWarnings
} from "../src/core/messages.js";

const mockModes = [
  { id: "standard", factor: 0.35, label: "Montage standard" },
  { id: "low-profile", factor: 0.25, label: "Montage low-profile" }
];

const mockRealDiameters = [0.91, 1.22, 1.62];

test("messages - buildHeightDiameterRequirementMessage when blocked", () => {
  // room.height = 4.0m, standard mode: minimum diameter is 4 / 2.35 = 1.70m
  // low-profile mode: minimum diameter is 4 / 2.25 = 1.78m
  // Both are > maxRealDiameter (1.62m)
  const room = { height: 4 };
  const message = buildHeightDiameterRequirementMessage(room, mockModes, mockRealDiameters);

  assert.match(message, /1,62 m/);
  assert.match(message, /162 cm/);
  assert.match(message, /1,7 m en montage standard/);
  assert.match(message, /1,78 m en montage low-profile/);
});

test("messages - buildHeightDiameterRequirementMessage when not blocked", () => {
  // room.height = 2.5m, standard min diameter is 2.5 / 2.35 = 1.06m <= 1.62m
  const room = { height: 2.5 };
  const message = buildHeightDiameterRequirementMessage(room, mockModes, mockRealDiameters);
  assert.equal(message, "");
});

test("messages - buildHeightDiameterRequirementMessage edge cases", () => {
  assert.equal(buildHeightDiameterRequirementMessage(null, mockModes, mockRealDiameters), "");
  assert.equal(buildHeightDiameterRequirementMessage({ height: Number.NaN }, mockModes, mockRealDiameters), "");
  assert.equal(buildHeightDiameterRequirementMessage({ height: 3 }, [], mockRealDiameters), "");
  assert.equal(buildHeightDiameterRequirementMessage({ height: 3 }, mockModes, []), "");
});

test("messages - getCandidateWarnings", () => {
  // Small fan (D = 1.32m < 2.13m), bladeHeight = 1.5m, recommended small height is 1.4 * 1.32 = 1.848m
  // So recommendedSmallHeightMet is false.
  const candidateSmallAlert = {
    fanClass: "small",
    recommendedSmallHeightMet: false,
    mountMode: { id: "standard" }
  };

  const warningsSmall = getCandidateWarnings(candidateSmallAlert);
  assert.equal(warningsSmall.length, 1);
  assert.match(warningsSmall[0], /recommandation d'aisance/);

  // Low-profile mount mode alert
  const candidateLowProfileAlert = {
    fanClass: "large",
    recommendedSmallHeightMet: true,
    mountMode: { id: "low-profile", penaltyText: "Baisse de vitesse de 15%" }
  };

  const warningsLow = getCandidateWarnings(candidateLowProfileAlert);
  assert.equal(warningsLow.length, 1);
  assert.match(warningsLow[0], /Baisse de vitesse/);

  // Both alerts
  const candidateBothAlerts = {
    fanClass: "small",
    recommendedSmallHeightMet: false,
    mountMode: { id: "low-profile", penaltyText: "Baisse de vitesse de 15%" }
  };

  const warningsBoth = getCandidateWarnings(candidateBothAlerts);
  assert.equal(warningsBoth.length, 2);
});
