import {
  EPS,
  FLUSH_MODE,
  LARGE_SAFETY_HEIGHT,
  MAX_GRID_FANS,
  SMALL_FAN_LIMIT,
  SMALL_SAFETY_HEIGHT
} from "./constants.js";

export function getRealDiametersForIntervals(realDiameters, intervals) {
  return realDiameters
    .map((diameter) => {
      const matchingInterval = intervals.find(
        (interval) => diameter >= interval.lower - EPS && diameter <= interval.upper + EPS
      );

      if (!matchingInterval) {
        return null;
      }

      return {
        diameter,
        fanClass: matchingInterval.fanClass
      };
    })
    .filter(Boolean);
}

export function getCoverageFactorForDiameter(cellArea, diameter) {
  return diameter / Math.sqrt(cellArea);
}

export function isCoverageFactorValid(coverageFactor) {
  return coverageFactor >= 0.2 - EPS && coverageFactor <= 0.4 + EPS;
}

export function getCompatibleRealDiameters(realDiameters, intervals, cellArea) {
  return getRealDiametersForIntervals(realDiameters, intervals)
    .map((option) => {
      const coverageFactor = getCoverageFactorForDiameter(cellArea, option.diameter);
      if (!isCoverageFactorValid(coverageFactor)) {
        return null;
      }

      return {
        diameter: option.diameter,
        fanClass: option.fanClass,
        coverageFactor
      };
    })
    .filter(Boolean);
}

/**
 * Calcule les intervalles de diametres encore compatibles avec les contraintes
 * de hauteur pour un mode de montage donne.
 */
export function buildHeightFeasibility(height, mountFactor, dGeoMin, dGeoMax) {
  const lowerHeightBound = height / (2 + mountFactor);
  const intervals = [];

  const smallUpper = Math.min(
    SMALL_FAN_LIMIT - EPS,
    (height - SMALL_SAFETY_HEIGHT) / mountFactor
  );
  const smallLower = Math.max(dGeoMin, lowerHeightBound);
  if (smallUpper > smallLower + EPS) {
    intervals.push({
      fanClass: "small",
      lower: smallLower,
      upper: Math.min(dGeoMax, smallUpper)
    });
  }

  const largeUpper = Math.min(
    (height - LARGE_SAFETY_HEIGHT) / mountFactor,
    height / (0.8 + mountFactor),
    dGeoMax
  );
  const largeLower = Math.max(dGeoMin, lowerHeightBound, SMALL_FAN_LIMIT);
  if (largeUpper > largeLower + EPS) {
    intervals.push({
      fanClass: "large",
      lower: largeLower,
      upper: largeUpper
    });
  }

  return intervals.filter((interval) => interval.upper > interval.lower + EPS);
}

export function parseZoneDrafts(room, variabilityZones) {
  const issues = [];
  const zones = variabilityZones
    .map((zone, index) => {
      const centerX = Number.parseFloat(String(zone.centerX).replace(",", "."));
      const centerY = Number.parseFloat(String(zone.centerY).replace(",", "."));
      const length = Number.parseFloat(String(zone.length).replace(",", "."));
      const width = Number.parseFloat(String(zone.width).replace(",", "."));

      if (!(centerX > 0) || !(centerY > 0) || !(length > 0) || !(width > 0)) {
        issues.push(`Zone ${index + 1} : renseignez des valeurs strictement positives.`);
        return null;
      }

      const minX = centerX - length / 2;
      const maxX = centerX + length / 2;
      const minY = centerY - width / 2;
      const maxY = centerY + width / 2;

      if (
        minX < -EPS ||
        maxX > room.length + EPS ||
        minY < -EPS ||
        maxY > room.width + EPS
      ) {
        issues.push(`Zone ${index + 1} : le rectangle cible doit rester entierement dans le local.`);
        return null;
      }

      return {
        id: zone.id,
        name: `Zone ${index + 1}`,
        centerX,
        centerY,
        length,
        width,
        minX,
        maxX,
        minY,
        maxY,
        area: length * width
      };
    })
    .filter(Boolean);

  if (zones.length === 0) {
    issues.push("Ajoutez au moins une zone cible.");
  }

  return { zones, issues };
}

export function zonesOverlap(zoneA, zoneB) {
  return (
    zoneA.minX < zoneB.maxX - EPS &&
    zoneA.maxX > zoneB.minX + EPS &&
    zoneA.minY < zoneB.maxY - EPS &&
    zoneA.maxY > zoneB.minY + EPS
  );
}

export function rectangleIntersectionArea(rectA, rectB) {
  const overlapX = Math.max(0, Math.min(rectA.maxX, rectB.maxX) - Math.max(rectA.minX, rectB.minX));
  const overlapY = Math.max(0, Math.min(rectA.maxY, rectB.maxY) - Math.max(rectA.minY, rectB.minY));
  return overlapX * overlapY;
}

export function pointInZones(x, y, zones) {
  return zones.some(
    (zone) =>
      x >= zone.minX - EPS &&
      x <= zone.maxX + EPS &&
      y >= zone.minY - EPS &&
      y <= zone.maxY + EPS
  );
}

export function computeRectanglesUnionArea(rectangles) {
  if (rectangles.length === 0) {
    return 0;
  }

  const xs = [...new Set(rectangles.flatMap((rectangle) => [rectangle.minX, rectangle.maxX]))].sort(
    (a, b) => a - b
  );
  let area = 0;

  for (let index = 0; index < xs.length - 1; index += 1) {
    const x1 = xs[index];
    const x2 = xs[index + 1];
    const sliceWidth = x2 - x1;

    if (sliceWidth <= EPS) {
      continue;
    }

    const intervals = rectangles
      .filter((rectangle) => rectangle.minX < x2 - EPS && rectangle.maxX > x1 + EPS)
      .map((rectangle) => ({ minY: rectangle.minY, maxY: rectangle.maxY }))
      .sort((a, b) => a.minY - b.minY);

    if (intervals.length === 0) {
      continue;
    }

    let coveredHeight = 0;
    let currentStart = intervals[0].minY;
    let currentEnd = intervals[0].maxY;

    for (let intervalIndex = 1; intervalIndex < intervals.length; intervalIndex += 1) {
      const interval = intervals[intervalIndex];
      if (interval.minY <= currentEnd + EPS) {
        currentEnd = Math.max(currentEnd, interval.maxY);
      } else {
        coveredHeight += currentEnd - currentStart;
        currentStart = interval.minY;
        currentEnd = interval.maxY;
      }
    }

    coveredHeight += currentEnd - currentStart;
    area += sliceWidth * coveredHeight;
  }

  return area;
}

/**
 * Evalue une trame uniforme et retourne une option complete si elle respecte
 * toutes les contraintes geometriques et de hauteur.
 */
export function evaluateCandidate(room, nx, ny, mountMode, realDiameters) {
  const cellLength = room.length / nx;
  const cellWidth = room.width / ny;
  const cellArea = cellLength * cellWidth;
  const cellShort = Math.min(cellLength, cellWidth);
  const cellLong = Math.max(cellLength, cellWidth);
  const formFactor = cellLong / cellShort;
  const coverageMinDiameter = 0.2 * Math.sqrt(cellArea);
  const coverageMaxDiameter = 0.4 * Math.sqrt(cellArea);
  const wallMaxDiameter = cellShort / 2;

  const spacings = [];
  if (nx > 1) {
    spacings.push(cellLength);
  }
  if (ny > 1) {
    spacings.push(cellWidth);
  }

  const interFanMaxDiameter =
    spacings.length > 0 ? Math.min(...spacings) / 2.5 : Number.POSITIVE_INFINITY;

  const dGeoMax = Math.min(coverageMaxDiameter, wallMaxDiameter, interFanMaxDiameter);
  if (dGeoMax <= coverageMinDiameter + EPS) {
    return null;
  }

  const intervals = buildHeightFeasibility(room.height, mountMode.factor, coverageMinDiameter, dGeoMax);
  if (intervals.length === 0) {
    return null;
  }

  const bestInterval = intervals.reduce(
    (best, current) => (!best || current.upper > best.upper ? current : best),
    null
  );
  const theoreticalMaxDiameter = bestInterval.upper;
  const compatibleRealDiameters = getCompatibleRealDiameters(realDiameters, intervals, cellArea);
  if (compatibleRealDiameters.length === 0) {
    return null;
  }

  const selectedRealDiameter = compatibleRealDiameters[compatibleRealDiameters.length - 1];
  const diameter = selectedRealDiameter.diameter;
  const mountDistance = mountMode.factor * diameter;
  const bladeHeight = room.height - mountDistance;
  const coverageFactor = selectedRealDiameter.coverageFactor;
  const recommendedSmallHeight = 1.4 * diameter;
  const recommendedSmallHeightMet =
    selectedRealDiameter.fanClass === "small"
      ? bladeHeight >= recommendedSmallHeight - EPS
      : true;

  const coordinates = [];
  for (let ix = 0; ix < nx; ix += 1) {
    for (let iy = 0; iy < ny; iy += 1) {
      coordinates.push({
        x: (ix + 0.5) * cellLength,
        y: (iy + 0.5) * cellWidth
      });
    }
  }

  return {
    key: `${nx}x${ny}-${mountMode.id}`,
    nx,
    ny,
    fanCount: nx * ny,
    room,
    mountMode,
    cellLength,
    cellWidth,
    cellArea,
    cellShort,
    cellLong,
    formFactor,
    diameter,
    theoreticalMaxDiameter,
    coverageFactor,
    mountDistance,
    bladeHeight,
    recommendedSmallHeightMet,
    recommendedSmallHeight,
    wallClearance: cellShort / 2,
    interFanSpacing: spacings.length > 0 ? Math.min(...spacings) : null,
    geometryCaps: {
      coverageMinDiameter,
      coverageMaxDiameter,
      wallMaxDiameter,
      interFanMaxDiameter
    },
    compatibleRealDiameters,
    coordinates,
    fanClass: selectedRealDiameter.fanClass,
    strictAdvice:
      "Verifier la fiche du modele retenu si son diametre nominal est proche d'une limite geometrique ou d'une limite de hauteur du guide."
  };
}

export function compareCandidates(a, b) {
  if (Math.abs(b.diameter - a.diameter) > EPS) {
    return b.diameter - a.diameter;
  }

  const ffA = Math.abs(a.formFactor - 1);
  const ffB = Math.abs(b.formFactor - 1);
  if (Math.abs(ffA - ffB) > EPS) {
    return ffA - ffB;
  }

  const covA = Math.abs(0.4 - a.coverageFactor);
  const covB = Math.abs(0.4 - b.coverageFactor);
  if (Math.abs(covA - covB) > EPS) {
    return covA - covB;
  }

  if (a.mountMode.id !== b.mountMode.id) {
    return a.mountMode.id === "standard" ? -1 : 1;
  }

  return a.fanCount - b.fanCount;
}

export function enumerateCandidates(room, maxFans, modes, realDiameters) {
  const candidates = [];

  for (let nx = 1; nx <= maxFans; nx += 1) {
    for (let ny = 1; ny <= maxFans; ny += 1) {
      if (nx * ny > maxFans) {
        continue;
      }

      for (const mode of modes) {
        const candidate = evaluateCandidate(room, nx, ny, mode, realDiameters);
        if (candidate) {
          candidates.push(candidate);
        }
      }
    }
  }

  return candidates.sort(compareCandidates);
}

export function getFallbackFlushCandidate(room, maxFans, realDiameters) {
  const candidates = [];

  for (let nx = 1; nx <= maxFans; nx += 1) {
    for (let ny = 1; ny <= maxFans; ny += 1) {
      if (nx * ny > maxFans) {
        continue;
      }
      const candidate = evaluateCandidate(room, nx, ny, FLUSH_MODE, realDiameters);
      if (candidate) {
        candidates.push(candidate);
      }
    }
  }

  return candidates.sort(compareCandidates)[0] || null;
}

export function buildVariabilitySelection(room, zones, nx, ny) {
  const cellLength = room.length / nx;
  const cellWidth = room.width / ny;
  const cellArea = cellLength * cellWidth;
  const selectedCells = [];
  const zoneSummaries = zones.map((zone) => ({
    ...zone,
    cellsCount: 0,
    mobilizedArea: 0,
    cellRefs: []
  }));

  for (let ix = 0; ix < nx; ix += 1) {
    for (let iy = 0; iy < ny; iy += 1) {
      const cell = {
        key: `${ix}-${iy}`,
        ix,
        iy,
        minX: ix * cellLength,
        maxX: (ix + 1) * cellLength,
        minY: iy * cellWidth,
        maxY: (iy + 1) * cellWidth,
        centerX: (ix + 0.5) * cellLength,
        centerY: (iy + 0.5) * cellWidth
      };

      const overlappingZoneIds = [];
      zoneSummaries.forEach((zoneSummary) => {
        if (rectangleIntersectionArea(cell, zoneSummary) > EPS) {
          overlappingZoneIds.push(zoneSummary.id);
          zoneSummary.cellsCount += 1;
          zoneSummary.cellRefs.push(`${ix + 1} × ${iy + 1}`);
        }
      });

      if (overlappingZoneIds.length > 0) {
        selectedCells.push({
          ...cell,
          overlappingZoneIds
        });
      }
    }
  }

  return {
    cellLength,
    cellWidth,
    cellArea,
    selectedCells,
    zoneSummaries: zoneSummaries.map((zoneSummary) => ({
      ...zoneSummary,
      mobilizedArea: zoneSummary.cellsCount * cellArea
    }))
  };
}

export function getMinimumWallClearance(room, selectedCells) {
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestCellKey = null;

  for (const cell of selectedCells) {
    const distance = Math.min(
      cell.centerX,
      room.length - cell.centerX,
      cell.centerY,
      room.width - cell.centerY
    );

    if (distance < bestDistance) {
      bestDistance = distance;
      bestCellKey = cell.key;
    }
  }

  return {
    distance: bestDistance,
    cellKey: bestCellKey
  };
}

export function getMinimumCenterDistance(selectedCells) {
  if (selectedCells.length < 2) {
    return null;
  }

  let bestDistance = Number.POSITIVE_INFINITY;
  let bestPair = null;

  for (let index = 0; index < selectedCells.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < selectedCells.length; otherIndex += 1) {
      const distance = Math.hypot(
        selectedCells[index].centerX - selectedCells[otherIndex].centerX,
        selectedCells[index].centerY - selectedCells[otherIndex].centerY
      );

      if (distance < bestDistance) {
        bestDistance = distance;
        bestPair = [selectedCells[index].key, selectedCells[otherIndex].key];
      }
    }
  }

  return {
    distance: bestDistance,
    pair: bestPair
  };
}

/**
 * Evalue une trame reguliere sur des zones cibles et retourne une variante si
 * les contraintes BRASSE restent satisfaites.
 */
export function evaluateVariabilityDesign(room, zones, nx, ny, mountMode, realDiameters) {
  const { cellLength, cellWidth, cellArea, selectedCells, zoneSummaries } = buildVariabilitySelection(
    room,
    zones,
    nx,
    ny
  );

  if (selectedCells.length === 0) {
    return null;
  }

  const cellShort = Math.min(cellLength, cellWidth);
  const cellLong = Math.max(cellLength, cellWidth);
  const formFactor = cellLong / cellShort;
  const coverageMinDiameter = 0.2 * Math.sqrt(cellArea);
  const coverageMaxDiameter = 0.4 * Math.sqrt(cellArea);
  const wallInfo = getMinimumWallClearance(room, selectedCells);
  const spacingInfo = getMinimumCenterDistance(selectedCells);
  const interFanMaxDiameter = spacingInfo ? spacingInfo.distance / 2.5 : Number.POSITIVE_INFINITY;
  const dGeoMax = Math.min(coverageMaxDiameter, wallInfo.distance, interFanMaxDiameter);

  if (dGeoMax <= coverageMinDiameter + EPS) {
    return null;
  }

  const intervals = buildHeightFeasibility(room.height, mountMode.factor, coverageMinDiameter, dGeoMax);
  if (intervals.length === 0) {
    return null;
  }

  const compatibleRealDiameters = getCompatibleRealDiameters(realDiameters, intervals, cellArea);
  if (compatibleRealDiameters.length === 0) {
    return null;
  }

  const bestInterval = intervals.reduce(
    (best, current) => (!best || current.upper > best.upper ? current : best),
    null
  );
  const theoreticalMaxDiameter = bestInterval.upper;
  const selectedRealDiameter = compatibleRealDiameters[compatibleRealDiameters.length - 1];
  const diameter = selectedRealDiameter.diameter;
  const mountDistance = mountMode.factor * diameter;
  const bladeHeight = room.height - mountDistance;
  const coverageFactor = selectedRealDiameter.coverageFactor;
  const recommendedSmallHeight = 1.4 * diameter;
  const recommendedSmallHeightMet =
    selectedRealDiameter.fanClass === "small"
      ? bladeHeight >= recommendedSmallHeight - EPS
      : true;
  const targetArea = computeRectanglesUnionArea(zones);
  const selectedArea = selectedCells.length * cellArea;
  const spillArea = Math.max(0, selectedArea - targetArea);
  const spillRatio = targetArea > EPS ? spillArea / targetArea : 0;
  const selectedCentersInsideCount = selectedCells.filter((cell) =>
    pointInZones(cell.centerX, cell.centerY, zones)
  ).length;
  const selectedCentersOutsideCount = selectedCells.length - selectedCentersInsideCount;

  return {
    key: `variability-${nx}x${ny}-${mountMode.id}`,
    room,
    mountMode,
    nx,
    ny,
    totalCells: nx * ny,
    fanCount: selectedCells.length,
    cellLength,
    cellWidth,
    cellArea,
    cellShort,
    cellLong,
    formFactor,
    diameter,
    theoreticalMaxDiameter,
    coverageFactor,
    mountDistance,
    bladeHeight,
    recommendedSmallHeightMet,
    recommendedSmallHeight,
    wallClearance: wallInfo.distance,
    interFanSpacing: spacingInfo ? spacingInfo.distance : null,
    geometryCaps: {
      coverageMinDiameter,
      coverageMaxDiameter,
      wallMaxDiameter: wallInfo.distance,
      interFanMaxDiameter
    },
    compatibleRealDiameters,
    coordinates: selectedCells.map((cell) => ({ x: cell.centerX, y: cell.centerY })),
    fanClass: selectedRealDiameter.fanClass,
    targetZones: zones,
    selectedCells,
    zoneSummaries,
    targetArea,
    selectedArea,
    spillArea,
    spillRatio,
    selectedCentersInsideCount,
    selectedCentersOutsideCount,
    minimumWallCellKey: wallInfo.cellKey,
    minimumSpacingPair: spacingInfo ? spacingInfo.pair : null
  };
}

export function compareVariabilityDesigns(a, b) {
  if (Math.abs(a.spillArea - b.spillArea) > EPS) {
    return a.spillArea - b.spillArea;
  }

  if (a.selectedCentersOutsideCount !== b.selectedCentersOutsideCount) {
    return a.selectedCentersOutsideCount - b.selectedCentersOutsideCount;
  }

  if (a.fanCount !== b.fanCount) {
    return a.fanCount - b.fanCount;
  }

  const ffA = Math.abs(a.formFactor - 1);
  const ffB = Math.abs(b.formFactor - 1);
  if (Math.abs(ffA - ffB) > EPS) {
    return ffA - ffB;
  }

  if (a.mountMode.id !== b.mountMode.id) {
    return a.mountMode.id === "standard" ? -1 : 1;
  }

  if (Math.abs(b.diameter - a.diameter) > EPS) {
    return b.diameter - a.diameter;
  }

  return a.totalCells - b.totalCells;
}

export function enumerateVariabilityDesigns(
  room,
  zones,
  modes,
  realDiameters,
  maxFans = MAX_GRID_FANS
) {
  const designs = [];

  for (let nx = 1; nx <= maxFans; nx += 1) {
    for (let ny = 1; ny <= maxFans; ny += 1) {
      if (nx * ny > maxFans) {
        continue;
      }

      for (const mode of modes) {
        const design = evaluateVariabilityDesign(room, zones, nx, ny, mode, realDiameters);
        if (design) {
          designs.push(design);
        }
      }
    }
  }

  return designs.sort(compareVariabilityDesigns);
}
