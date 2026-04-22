import {
  EPS,
  LARGE_SAFETY_HEIGHT,
  SMALL_FAN_LIMIT,
  SMALL_SAFETY_HEIGHT
} from "./constants.js";
import {
  buildHeightFeasibility,
  getCoverageFactorForDiameter,
  isCoverageFactorValid
} from "./calepinage.js";
import { assessOptionCeilingCompatibility } from "./ceilingAssessment.js";

const TILE_SAMPLE_FRACTIONS = [0.15, 0.35, 0.5, 0.65, 0.85];
const AXIS_SLOT_CANDIDATES = 9;
const AXIS_BEAM_WIDTH = 60;
const AXIS_LAYOUT_LIMIT = 18;
const DISPLAY_LIMIT = 5;

function ceilingValueKey(value) {
  return value.toFixed(6);
}

function getCandidateSignature(candidate) {
  return `${candidate.nx}x${candidate.ny}-${candidate.mountMode.id}-${Math.round(candidate.diameter * 100)}`;
}

function getFanClassForDiameter(diameter) {
  return diameter >= SMALL_FAN_LIMIT - EPS ? "large" : "small";
}

function isDiameterHeightCompatible(room, mountMode, diameter) {
  const mountDistance = mountMode.factor * diameter;
  const bladeHeight = room.height - mountDistance;
  const fanClass = getFanClassForDiameter(diameter);

  if (fanClass === "small") {
    return bladeHeight >= SMALL_SAFETY_HEIGHT - EPS && bladeHeight <= 2 * diameter + EPS;
  }

  return (
    bladeHeight >= LARGE_SAFETY_HEIGHT - EPS &&
    bladeHeight >= 0.8 * diameter - EPS &&
    bladeHeight <= 2 * diameter + EPS
  );
}

function getUniformTemplateMetrics(room, nx, ny, mountMode) {
  const cellLength = room.length / nx;
  const cellWidth = room.width / ny;
  const cellArea = cellLength * cellWidth;
  const cellShort = Math.min(cellLength, cellWidth);
  const cellLong = Math.max(cellLength, cellWidth);
  const formFactor = cellLong / cellShort;
  const coverageMinDiameter = 0.2 * Math.sqrt(cellArea);
  const coverageMaxDiameter = 0.4 * Math.sqrt(cellArea);
  const wallMaxDiameter = cellShort / 2;
  const spacingCaps = [];

  if (nx > 1) {
    spacingCaps.push(cellLength / 2.5);
  }
  if (ny > 1) {
    spacingCaps.push(cellWidth / 2.5);
  }

  const interFanMaxDiameter =
    spacingCaps.length > 0 ? Math.min(...spacingCaps) : Number.POSITIVE_INFINITY;
  const dGeoMax = Math.min(coverageMaxDiameter, wallMaxDiameter, interFanMaxDiameter);
  const intervals =
    dGeoMax > coverageMinDiameter + EPS
      ? buildHeightFeasibility(room.height, mountMode.factor, coverageMinDiameter, dGeoMax)
      : [];
  const theoreticalMaxDiameter = intervals.reduce(
    (best, interval) => Math.max(best, interval.upper),
    0
  );

  return {
    cellLength,
    cellWidth,
    cellArea,
    cellShort,
    cellLong,
    formFactor,
    coverageMinDiameter,
    coverageMaxDiameter,
    wallMaxDiameter,
    interFanMaxDiameter,
    theoreticalMaxDiameter: theoreticalMaxDiameter > EPS ? theoreticalMaxDiameter : null
  };
}

function isAxisPackingFeasible(length, count, diameter) {
  if (count === 1) {
    return length > diameter * 2 + EPS;
  }

  const minimumSpan = diameter * 2 + (count - 1) * 2.5 * diameter;
  return length > minimumSpan + EPS;
}

function buildAxisSamples(axis, length, diameter) {
  const seen = new Set();
  const samples = [];

  axis.tiles.forEach((tile) => {
    TILE_SAMPLE_FRACTIONS.forEach((fraction) => {
      const value = tile.min + tile.size * fraction;
      if (value <= diameter + EPS || value >= length - diameter - EPS) {
        return;
      }

      const key = `${tile.index}:${ceilingValueKey(value)}`;
      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      samples.push({
        value: Number(value.toFixed(6)),
        tileIndex: tile.index,
        tileKey: tile.key,
        tileIsCut: tile.isCut
      });
    });
  });

  return samples.sort((a, b) => a.value - b.value);
}

function buildIdealAxisPositions(length, count) {
  return Array.from({ length: count }, (_, index) => ((index + 0.5) * length) / count);
}

function buildAxisSlotCandidates(samples, idealPositions) {
  return idealPositions.map((ideal) =>
    [...samples]
      .sort((a, b) => {
        const distanceDelta = Math.abs(a.value - ideal) - Math.abs(b.value - ideal);
        if (Math.abs(distanceDelta) > EPS) {
          return distanceDelta;
        }
        return a.value - b.value;
      })
      .slice(0, AXIS_SLOT_CANDIDATES)
  );
}

function buildAxisBoundaries(length, positions) {
  const boundaries = [0];

  for (let index = 0; index < positions.length - 1; index += 1) {
    boundaries.push((positions[index] + positions[index + 1]) / 2);
  }

  boundaries.push(length);
  return boundaries.map((value) => Number(value.toFixed(6)));
}

function getAxisCellSpans(boundaries) {
  const spans = [];

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    spans.push(Number((boundaries[index + 1] - boundaries[index]).toFixed(6)));
  }

  return spans;
}

function getAxisSymmetryScore(length, positions, idealPositions) {
  const centeredPenalty = positions.reduce((sum, position, index) => {
    const mirrorIndex = positions.length - 1 - index;
    if (index > mirrorIndex) {
      return sum;
    }
    if (index === mirrorIndex) {
      return sum + Math.abs(position - length / 2) / length;
    }
    return sum + Math.abs(position + positions[mirrorIndex] - length) / length;
  }, 0);

  const idealPenalty = positions.reduce(
    (sum, position, index) => sum + Math.abs(position - idealPositions[index]) / length,
    0
  );

  const idealGap = length / positions.length;
  const gapPenalty =
    positions.length > 1
      ? positions.slice(1).reduce((sum, position, index) => {
          const gap = position - positions[index];
          return sum + Math.abs(gap - idealGap) / length;
        }, 0)
      : 0;

  return Number((centeredPenalty * 2 + idealPenalty + gapPenalty).toFixed(6));
}

function buildAxisLayouts(axis, length, count, diameter) {
  if (count <= 0) {
    return [];
  }

  const samples = buildAxisSamples(axis, length, diameter);
  if (samples.length < count) {
    return [];
  }

  const idealPositions = buildIdealAxisPositions(length, count);
  const slotCandidates = buildAxisSlotCandidates(samples, idealPositions);
  const minSpacing = count > 1 ? 2.5 * diameter : 0;
  let beam = [{ picks: [], roughScore: 0 }];

  for (let slotIndex = 0; slotIndex < count; slotIndex += 1) {
    const nextBeam = [];
    const remainingCount = count - slotIndex - 1;

    beam.forEach((partial) => {
      slotCandidates[slotIndex].forEach((candidate) => {
        const previous = partial.picks[partial.picks.length - 1];

        if (previous && candidate.value <= previous.value + minSpacing - EPS) {
          return;
        }

        const maxAllowed = length - diameter - remainingCount * minSpacing;
        if (candidate.value > maxAllowed + EPS) {
          return;
        }

        const nextPicks = [...partial.picks, candidate];
        const roughScore =
          partial.roughScore + Math.abs(candidate.value - idealPositions[slotIndex]) / length;

        nextBeam.push({
          picks: nextPicks,
          roughScore
        });
      });
    });

    const deduped = new Map();
    nextBeam
      .sort((a, b) => a.roughScore - b.roughScore)
      .forEach((state) => {
        const key = state.picks.map((pick) => ceilingValueKey(pick.value)).join("|");
        if (!deduped.has(key)) {
          deduped.set(key, state);
        }
      });

    beam = [...deduped.values()].slice(0, AXIS_BEAM_WIDTH);
    if (beam.length === 0) {
      return [];
    }
  }

  return beam
    .map((state) => {
      const positions = state.picks.map((pick) => pick.value);
      const boundaries = buildAxisBoundaries(length, positions);
      const spans = getAxisCellSpans(boundaries);
      const minClearance = Math.min(positions[0], length - positions[positions.length - 1]);
      const minSpacingValue =
        positions.length > 1
          ? positions.slice(1).reduce(
              (best, position, index) => Math.min(best, position - positions[index]),
              Number.POSITIVE_INFINITY
            )
          : null;

      return {
        positions,
        picks: state.picks,
        boundaries,
        spans,
        minClearance,
        minSpacing: minSpacingValue,
        symmetryScore: getAxisSymmetryScore(length, positions, idealPositions)
      };
    })
    .sort((a, b) => a.symmetryScore - b.symmetryScore)
    .slice(0, AXIS_LAYOUT_LIMIT);
}

function getMinimumSpacingPair(coordinates) {
  if (coordinates.length < 2) {
    return null;
  }

  let bestPair = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let firstIndex = 0; firstIndex < coordinates.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < coordinates.length; secondIndex += 1) {
      const distance = Math.hypot(
        coordinates[firstIndex].x - coordinates[secondIndex].x,
        coordinates[firstIndex].y - coordinates[secondIndex].y
      );

      if (distance + EPS < bestDistance) {
        bestDistance = distance;
        bestPair = [firstIndex, secondIndex];
      }
    }
  }

  return bestPair;
}

function getMinimumWallPointIndex(room, coordinates) {
  let bestIndex = 0;
  let bestClearance = Number.POSITIVE_INFINITY;

  coordinates.forEach((point, index) => {
    const clearance = Math.min(point.x, room.length - point.x, point.y, room.width - point.y);
    if (clearance + EPS < bestClearance) {
      bestClearance = clearance;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function evaluateAdaptedCombination(room, ceilingGrid, nx, ny, diameter, xLayout, yLayout) {
  const fanClass = getFanClassForDiameter(diameter);
  const coordinates = [];
  const adaptedCells = [];
  let fccMin = Number.POSITIVE_INFINITY;
  let fccMax = Number.NEGATIVE_INFINITY;
  let ffMin = Number.POSITIVE_INFINITY;
  let ffMax = Number.NEGATIVE_INFINITY;
  let luminaireConflict = false;

  for (let xIndex = 0; xIndex < nx; xIndex += 1) {
    for (let yIndex = 0; yIndex < ny; yIndex += 1) {
      const tileKey = `${xLayout.picks[xIndex].tileIndex}:${yLayout.picks[yIndex].tileIndex}`;
      if (ceilingGrid.tileMap.get(tileKey)?.hasLuminaire) {
        luminaireConflict = true;
        break;
      }

      const point = {
        x: xLayout.positions[xIndex],
        y: yLayout.positions[yIndex]
      };
      const width = xLayout.spans[xIndex];
      const height = yLayout.spans[yIndex];
      const area = width * height;
      const coverageFactor = getCoverageFactorForDiameter(area, diameter);
      const formFactor = Math.max(width, height) / Math.min(width, height);

      if (!isCoverageFactorValid(coverageFactor)) {
        return null;
      }

      coordinates.push(point);
      adaptedCells.push({
        key: `${xIndex}:${yIndex}`,
        minX: xLayout.boundaries[xIndex],
        maxX: xLayout.boundaries[xIndex + 1],
        minY: yLayout.boundaries[yIndex],
        maxY: yLayout.boundaries[yIndex + 1],
        width,
        height,
        coverageFactor,
        formFactor
      });

      fccMin = Math.min(fccMin, coverageFactor);
      fccMax = Math.max(fccMax, coverageFactor);
      ffMin = Math.min(ffMin, formFactor);
      ffMax = Math.max(ffMax, formFactor);
    }

    if (luminaireConflict) {
      break;
    }
  }

  if (luminaireConflict) {
    return null;
  }

  const wallClearanceMin = coordinates.reduce((bestClearance, point) => {
    const clearance = Math.min(point.x, room.length - point.x, point.y, room.width - point.y);
    return Math.min(bestClearance, clearance);
  }, Number.POSITIVE_INFINITY);

  if (wallClearanceMin <= diameter + EPS) {
    return null;
  }

  const xSpacing = xLayout.minSpacing ?? Number.POSITIVE_INFINITY;
  const ySpacing = yLayout.minSpacing ?? Number.POSITIVE_INFINITY;
  const interFanSpacingMin = Math.min(xSpacing, ySpacing);

  if (Number.isFinite(interFanSpacingMin) && interFanSpacingMin <= 2.5 * diameter + EPS) {
    return null;
  }

  return {
    nx,
    ny,
    fanCount: nx * ny,
    diameter,
    fanClass,
    coordinates,
    adaptedCells,
    cellBoundariesX: xLayout.boundaries,
    cellBoundariesY: yLayout.boundaries,
    xPositions: xLayout.positions,
    yPositions: yLayout.positions,
    adaptedMetrics: {
      fccMin: Number(fccMin.toFixed(6)),
      fccMax: Number(fccMax.toFixed(6)),
      ffMin: Number(ffMin.toFixed(6)),
      ffMax: Number(ffMax.toFixed(6)),
      wallClearanceMin: Number(wallClearanceMin.toFixed(6)),
      interFanSpacingMin: Number.isFinite(interFanSpacingMin)
        ? Number(interFanSpacingMin.toFixed(6))
        : null,
      symmetryScore: Number((xLayout.symmetryScore + yLayout.symmetryScore).toFixed(6))
    },
    minimumWallPointIndex: getMinimumWallPointIndex(room, coordinates),
    minimumSpacingPairIndices: getMinimumSpacingPair(coordinates)
  };
}

function compareAdaptedLayouts(a, b) {
  if (Math.abs(a.adaptedMetrics.symmetryScore - b.adaptedMetrics.symmetryScore) > EPS) {
    return a.adaptedMetrics.symmetryScore - b.adaptedMetrics.symmetryScore;
  }

  if (Math.abs(b.diameter - a.diameter) > EPS) {
    return b.diameter - a.diameter;
  }

  if (Math.abs(a.adaptedMetrics.ffMax - b.adaptedMetrics.ffMax) > EPS) {
    return a.adaptedMetrics.ffMax - b.adaptedMetrics.ffMax;
  }

  if (Math.abs(b.adaptedMetrics.fccMin - a.adaptedMetrics.fccMin) > EPS) {
    return b.adaptedMetrics.fccMin - a.adaptedMetrics.fccMin;
  }

  if (a.fanCount !== b.fanCount) {
    return a.fanCount - b.fanCount;
  }

  if (a.mountMode.id !== b.mountMode.id) {
    return a.mountMode.id === "standard" ? -1 : 1;
  }

  return a.nx - b.nx || a.ny - b.ny;
}

function buildAdaptedVariantForTopology(room, ceilingGrid, nx, ny, mountMode, realDiameters) {
  const templateMetrics = getUniformTemplateMetrics(room, nx, ny, mountMode);
  const candidateDiameters = [...realDiameters]
    .filter(
      (diameter) =>
        diameter >= templateMetrics.coverageMinDiameter - EPS &&
        diameter <= templateMetrics.coverageMaxDiameter + EPS &&
        isDiameterHeightCompatible(room, mountMode, diameter) &&
        isAxisPackingFeasible(room.length, nx, diameter) &&
        isAxisPackingFeasible(room.width, ny, diameter)
    )
    .sort((a, b) => b - a);

  if (candidateDiameters.length === 0) {
    return null;
  }

  const successfulLayouts = [];

  candidateDiameters.forEach((diameter) => {
    const xLayouts = buildAxisLayouts(ceilingGrid.xAxis, room.length, nx, diameter);
    const yLayouts = buildAxisLayouts(ceilingGrid.yAxis, room.width, ny, diameter);

    if (xLayouts.length === 0 || yLayouts.length === 0) {
      return;
    }

    const layoutCandidates = [];

    xLayouts.forEach((xLayout) => {
      yLayouts.forEach((yLayout) => {
        const combination = evaluateAdaptedCombination(
          room,
          ceilingGrid,
          nx,
          ny,
          diameter,
          xLayout,
          yLayout
        );

        if (combination) {
          layoutCandidates.push({
            ...combination,
            mountMode
          });
        }
      });
    });

    if (layoutCandidates.length === 0) {
      return;
    }

    layoutCandidates.sort(compareAdaptedLayouts);
    successfulLayouts.push(layoutCandidates[0]);
  });

  if (successfulLayouts.length === 0) {
    return null;
  }

  const selectedLayout = successfulLayouts[0];
  const recommendedSmallHeight = 1.4 * selectedLayout.diameter;
  const mountDistance = mountMode.factor * selectedLayout.diameter;
  const bladeHeight = room.height - mountDistance;

  return {
    key: `adapted-${nx}x${ny}-${mountMode.id}-${Math.round(selectedLayout.diameter * 100)}`,
    placementMode: "adapted-ceiling",
    sourceStrictKey: null,
    strictReference: null,
    nx,
    ny,
    fanCount: nx * ny,
    room,
    mountMode,
    cellLength: templateMetrics.cellLength,
    cellWidth: templateMetrics.cellWidth,
    cellArea: templateMetrics.cellArea,
    cellShort: templateMetrics.cellShort,
    cellLong: templateMetrics.cellLong,
    formFactor: selectedLayout.adaptedMetrics.ffMax,
    diameter: selectedLayout.diameter,
    theoreticalMaxDiameter: templateMetrics.theoreticalMaxDiameter ?? selectedLayout.diameter,
    coverageFactor: selectedLayout.adaptedMetrics.fccMin,
    mountDistance,
    bladeHeight,
    recommendedSmallHeightMet:
      selectedLayout.fanClass === "small"
        ? bladeHeight >= recommendedSmallHeight - EPS
        : true,
    recommendedSmallHeight,
    wallClearance: selectedLayout.adaptedMetrics.wallClearanceMin,
    interFanSpacing: selectedLayout.adaptedMetrics.interFanSpacingMin,
    geometryCaps: {
      coverageMinDiameter: templateMetrics.coverageMinDiameter,
      coverageMaxDiameter: templateMetrics.coverageMaxDiameter,
      wallMaxDiameter: templateMetrics.wallMaxDiameter,
      interFanMaxDiameter: templateMetrics.interFanMaxDiameter
    },
    compatibleRealDiameters: successfulLayouts
      .map((layout) => ({
        diameter: layout.diameter,
        fanClass: layout.fanClass,
        coverageFactor: layout.adaptedMetrics.fccMin,
        coverageFactorMax: layout.adaptedMetrics.fccMax
      }))
      .sort((a, b) => a.diameter - b.diameter),
    coordinates: selectedLayout.coordinates,
    cellBoundariesX: selectedLayout.cellBoundariesX,
    cellBoundariesY: selectedLayout.cellBoundariesY,
    adaptedCells: selectedLayout.adaptedCells,
    adaptedMetrics: selectedLayout.adaptedMetrics,
    minimumWallPointIndex: selectedLayout.minimumWallPointIndex,
    minimumSpacingPairIndices: selectedLayout.minimumSpacingPairIndices,
    fanClass: selectedLayout.fanClass,
    strictAdvice:
      "Verifier la faisabilite chantier du support dans les dalles retenues et la proximite visuelle avec les luminaires.",
    ceilingGrid,
    ceilingAssessment: {
      enabled: true,
      compatible: true,
      reasonCode: "adapted",
      reasonText:
        "La trame stricte n'etait pas compatible avec le faux plafond. Une variante adaptee a ete calculee avec des centres ajustes dans les dalles disponibles.",
      dx: 0,
      dy: 0,
      luminaireConflict: false,
      wallClearance: selectedLayout.adaptedMetrics.wallClearanceMin,
      appliedCoordinates: selectedLayout.coordinates,
      shiftApplied: false,
      adjustmentMode: "individual-fit",
      adjustmentLabel: "Ajustement individuel",
      visualCheckNote: "Verifier visuellement la proximite luminaire / brasseur."
    }
  };
}

function buildAdaptedCandidatePool(room, ceilingGrid, modes, realDiameters, maxFans) {
  const pool = [];

  for (let nx = 1; nx <= maxFans; nx += 1) {
    for (let ny = 1; ny <= maxFans; ny += 1) {
      if (nx * ny > maxFans) {
        continue;
      }

      modes.forEach((mountMode) => {
        const candidate = buildAdaptedVariantForTopology(
          room,
          ceilingGrid,
          nx,
          ny,
          mountMode,
          realDiameters
        );

        if (candidate) {
          pool.push(candidate);
        }
      });
    }
  }

  return pool.sort(compareAdaptedLayouts);
}

function createStrictReference(candidate) {
  return {
    key: candidate.key,
    nx: candidate.nx,
    ny: candidate.ny,
    mountModeId: candidate.mountMode.id,
    mountLabel: candidate.mountMode.label,
    label: `${candidate.nx} × ${candidate.ny} • ${candidate.mountMode.label}`,
    cellLength: candidate.cellLength,
    cellWidth: candidate.cellWidth,
    coordinates: candidate.coordinates
  };
}

function decorateStrictCandidate(candidate, ceilingGrid) {
  return {
    ...candidate,
    placementMode: "strict",
    ceilingGrid,
    ceilingAssessment: assessOptionCeilingCompatibility(candidate, ceilingGrid)
  };
}

function decorateAdaptedDisplayCandidate(candidate, strictReference, sourceStrictKey) {
  return {
    ...candidate,
    sourceStrictKey,
    strictReference
  };
}

function isSameStrictTopology(adaptedCandidate, strictCandidate) {
  return (
    adaptedCandidate.nx === strictCandidate.nx &&
    adaptedCandidate.ny === strictCandidate.ny &&
    adaptedCandidate.mountMode.id === strictCandidate.mountMode.id
  );
}

export function buildCeilingAwareDisplayCandidates(
  strictCandidates,
  room,
  modes,
  realDiameters,
  ceilingGrid,
  maxFans
) {
  if (!ceilingGrid) {
    return strictCandidates.slice(0, DISPLAY_LIMIT);
  }

  const displayCandidates = [];
  const usedSignatures = new Set();
  const usedAdaptedKeys = new Set();
  let adaptedPool = null;

  for (const strictCandidate of strictCandidates) {
    if (displayCandidates.length >= DISPLAY_LIMIT) {
      break;
    }

    const assessedStrict = decorateStrictCandidate(strictCandidate, ceilingGrid);
    const strictSignature = getCandidateSignature(assessedStrict);
    const strictReference = createStrictReference(assessedStrict);
    const strictIsUsable =
      assessedStrict.ceilingAssessment.compatible && !usedSignatures.has(strictSignature);

    if (strictIsUsable) {
      displayCandidates.push(assessedStrict);
      usedSignatures.add(strictSignature);
      continue;
    }

    if (!adaptedPool) {
      adaptedPool = buildAdaptedCandidatePool(room, ceilingGrid, modes, realDiameters, maxFans);
    }

    const replacement = adaptedPool.find(
      (candidate) =>
        isSameStrictTopology(candidate, assessedStrict) &&
        !usedAdaptedKeys.has(candidate.key) &&
        !usedSignatures.has(getCandidateSignature(candidate))
    );

    if (replacement) {
      const displayCandidate = decorateAdaptedDisplayCandidate(
        replacement,
        strictReference,
        assessedStrict.key
      );
      displayCandidates.push(displayCandidate);
      usedAdaptedKeys.add(replacement.key);
      usedSignatures.add(getCandidateSignature(displayCandidate));
      continue;
    }

    if (!usedSignatures.has(strictSignature)) {
      displayCandidates.push(assessedStrict);
      usedSignatures.add(strictSignature);
    }
  }

  return displayCandidates;
}
