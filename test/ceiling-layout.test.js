import test from "node:test";
import assert from "node:assert/strict";

import { assessOptionCeilingCompatibility } from "../src/core/ceilingAssessment.js";
import { buildCeilingGrid } from "../src/core/ceilingGrid.js";

test("la trame faux plafond gere les decoupes min_side, max_side et symmetric", () => {
  const room = { length: 5, width: 4.2 };

  const minSideGrid = buildCeilingGrid(room, {
    tileSize: 0.6,
    xAnchorMode: "min_side",
    yAnchorMode: "min_side",
    luminaireTiles: new Set()
  });
  const maxSideGrid = buildCeilingGrid(room, {
    tileSize: 0.6,
    xAnchorMode: "max_side",
    yAnchorMode: "min_side",
    luminaireTiles: new Set()
  });
  const symmetricGrid = buildCeilingGrid(room, {
    tileSize: 0.6,
    xAnchorMode: "symmetric",
    yAnchorMode: "min_side",
    luminaireTiles: new Set()
  });

  assert.equal(minSideGrid.xAxis.tiles[0].size, 0.6);
  assert.equal(minSideGrid.xAxis.tiles.at(-1).size, 0.2);

  assert.equal(maxSideGrid.xAxis.tiles[0].size, 0.2);
  assert.equal(maxSideGrid.xAxis.tiles.at(-1).size, 0.6);

  assert.equal(symmetricGrid.xAxis.tiles[0].size, 0.1);
  assert.equal(symmetricGrid.xAxis.tiles.at(-1).size, 0.1);
});

test("une trame reguliere peut trouver un decalage global compatible sur les centres de dalles", () => {
  const room = { length: 9, width: 5, height: 2.75 };
  const ceilingGrid = buildCeilingGrid(room, {
    tileSize: 0.6,
    xAnchorMode: "symmetric",
    yAnchorMode: "symmetric",
    luminaireTiles: new Set()
  });
  const option = {
    room,
    diameter: 1.2,
    wallClearance: 2.1,
    coordinates: [
      { x: 2.15, y: 2.25 },
      { x: 5.75, y: 2.25 }
    ]
  };

  const assessment = assessOptionCeilingCompatibility(option, ceilingGrid);

  assert.equal(assessment.enabled, true);
  assert.equal(assessment.compatible, true);
  assert.equal(assessment.shiftApplied, true);
  assert.equal(assessment.luminaireConflict, false);
  assert.deepEqual(assessment.appliedCoordinates, [
    { x: 2.1, y: 2.2 },
    { x: 5.7, y: 2.2 }
  ]);
});

test("une trame incompatible avec les pas de 60 cm reste non compatible faux plafond", () => {
  const room = { length: 9, width: 5, height: 2.75 };
  const ceilingGrid = buildCeilingGrid(room, {
    tileSize: 0.6,
    xAnchorMode: "symmetric",
    yAnchorMode: "symmetric",
    luminaireTiles: new Set()
  });
  const option = {
    room,
    diameter: 1.2,
    wallClearance: 2.25,
    coordinates: [
      { x: 2.25, y: 2.5 },
      { x: 6.75, y: 2.5 }
    ]
  };

  const assessment = assessOptionCeilingCompatibility(option, ceilingGrid);

  assert.equal(assessment.compatible, false);
  assert.equal(assessment.reasonCode, "rail-alignment");
});

test("une occupation de luminaire peut bloquer toutes les variantes alignees", () => {
  const room = { length: 9, width: 5, height: 2.75 };
  const baseGrid = buildCeilingGrid(room, {
    tileSize: 0.6,
    xAnchorMode: "symmetric",
    yAnchorMode: "symmetric",
    luminaireTiles: new Set()
  });
  const ceilingGrid = buildCeilingGrid(room, {
    tileSize: 0.6,
    xAnchorMode: "symmetric",
    yAnchorMode: "symmetric",
    luminaireTiles: new Set(baseGrid.tiles.map((tile) => tile.key))
  });
  const option = {
    room,
    diameter: 1.2,
    wallClearance: 2.1,
    coordinates: [
      { x: 2.15, y: 2.25 },
      { x: 5.75, y: 2.25 }
    ]
  };

  const assessment = assessOptionCeilingCompatibility(option, ceilingGrid);

  assert.equal(assessment.compatible, false);
  assert.equal(assessment.reasonCode, "luminaire-conflict");
  assert.equal(assessment.luminaireConflict, true);
});
