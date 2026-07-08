import test from "node:test";
import assert from "node:assert/strict";

import {
  parseNumber,
  formatInputValue,
  formatNumber,
  formatMeters,
  formatSquareMeters,
  formatFactor,
  formatTemp,
  formatDb,
  formatWatts,
  formatDateTime,
  formatDiameterCm,
  formatDiameterCmList,
  formatDiameterList,
  joinWithOr
} from "../src/core/formatters.js";

test("formatters - parseNumber", () => {
  assert.equal(parseNumber("2,5"), 2.5);
  assert.equal(parseNumber("2.5"), 2.5);
  assert.equal(parseNumber({ value: "1,25" }), 1.25);
});

test("formatters - formatInputValue", () => {
  assert.equal(formatInputValue(2.5), "2,5");
  assert.equal(formatInputValue(2), "2");
  assert.equal(formatInputValue(Number.NaN), "");
  assert.equal(formatInputValue(null), "");
});

test("formatters - formatNumber", () => {
  // En fr-FR, les décimales sont séparées par une virgule
  assert.match(formatNumber(1250.5), /1\s?250,5/);
});

test("formatters - joinWithOr", () => {
  assert.equal(joinWithOr([]), "");
  assert.equal(joinWithOr(["A"]), "A");
  assert.equal(joinWithOr(["A", "B"]), "A ou B");
  assert.equal(joinWithOr(["A", "B", "C"]), "A, B ou C");
});

test("formatters - units and diameters formatting", () => {
  assert.equal(formatMeters(2.5), "2,5 m");
  assert.equal(formatSquareMeters(45), "45 m²");
  assert.equal(formatFactor(0.354), "0,35"); // 2 chiffres par défaut
  assert.equal(formatTemp(28.5), "28,5 °C");
  assert.equal(formatDb(45.2), "45,2 dBA");
  assert.equal(formatWatts(65), "65 W");
  assert.equal(formatDiameterCm(1.62), "162");
  assert.equal(formatDiameterCmList([1.62, { diameter: 1.42 }]), "162, 142");
  assert.equal(formatDiameterList([1.62, 1.42]), "1,62 m, 1,42 m");
});

test("formatters - formatDateTime", () => {
  const date = new Date("2026-07-08T11:47:00");
  assert.match(formatDateTime(date), /juil/i);
});
