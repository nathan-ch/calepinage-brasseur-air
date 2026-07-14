import {
  EPS,
  FLUSH_MODE,
  LARGE_SAFETY_HEIGHT,
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
  const intervals = [];

  const smallUpper = Math.min(
    SMALL_FAN_LIMIT - EPS,
    (height - SMALL_SAFETY_HEIGHT) / mountFactor
  );
  const smallLower = dGeoMin;
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
  const largeLower = Math.max(dGeoMin, SMALL_FAN_LIMIT);
  if (largeUpper > largeLower + EPS) {
    intervals.push({
      fanClass: "large",
      lower: largeLower,
      upper: largeUpper
    });
  }

  return intervals.filter((interval) => interval.upper > interval.lower + EPS);
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
  const compatibleRealDiameters = Array.isArray(realDiameters)
    ? getCompatibleRealDiameters(realDiameters, intervals, cellArea)
    : [];

  // Le dimensionnement retourne un diamètre théorique recommandé indépendant d'une liste de modèles.
  // La sélection d'un modèle réel (et donc d'un diamètre nominal) est laissée à l'utilisateur.
  const diameter = theoreticalMaxDiameter;
  const mountDistance = mountMode.factor * diameter;
  const bladeHeight = room.height - mountDistance;
  const coverageFactor = getCoverageFactorForDiameter(cellArea, diameter);
  const recommendedSmallHeight = 1.4 * diameter;
  const recommendedSmallHeightMet =
    bestInterval.fanClass === "small"
      ? bladeHeight >= recommendedSmallHeight - EPS
      : true;

  const isSmall = diameter < 2.13;
  let heightRangeOk = false;
  if (isSmall) {
    heightRangeOk = bladeHeight <= 2 * diameter + EPS;
  } else {
    heightRangeOk = bladeHeight >= 0.8 * diameter - EPS && bladeHeight <= 2 * diameter + EPS;
  }

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
    heightRangeOk,
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
    fanClass: bestInterval.fanClass,
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

export function findBestGridForFanCount(room, fanCount) {
  let bestNx = 1;
  let bestNy = fanCount;
  let minFormFactor = Number.POSITIVE_INFINITY;

  for (let nx = 1; nx <= fanCount; nx += 1) {
    if (fanCount % nx !== 0) {
      continue;
    }
    const ny = fanCount / nx;
    const cellLength = room.length / nx;
    const cellWidth = room.width / ny;
    const formFactor = Math.max(cellLength, cellWidth) / Math.min(cellLength, cellWidth);

    if (formFactor < minFormFactor) {
      minFormFactor = formFactor;
      bestNx = nx;
      bestNy = ny;
    }
  }

  return { nx: bestNx, ny: bestNy };
}

export function evaluateCustomCandidate(room, fanCount, diameter, mountMode, realDiameters) {
  const { nx, ny } = findBestGridForFanCount(room, fanCount);

  const cellLength = room.length / nx;
  const cellWidth = room.width / ny;
  const cellArea = cellLength * cellWidth;
  const cellShort = Math.min(cellLength, cellWidth);
  const cellLong = Math.max(cellLength, cellWidth);
  const formFactor = cellLong / cellShort;

  const coverageMinDiameter = 0.2 * Math.sqrt(cellArea);
  const coverageMaxDiameter = 0.4 * Math.sqrt(cellArea);

  const spacings = [];
  if (nx > 1) {
    spacings.push(cellLength);
  }
  if (ny > 1) {
    spacings.push(cellWidth);
  }
  const interFanSpacing = spacings.length > 0 ? Math.min(...spacings) : null;

  // Calculs hauteurs
  const mountDistance = mountMode.factor * diameter;
  const bladeHeight = room.height - mountDistance;
  const recommendedSmallHeight = 1.4 * diameter;

  // Validations individuelles des règles de conformité BRASSE
  const wallClearanceOk = cellShort / 2 >= diameter - EPS;
  const spacingOk = interFanSpacing === null || interFanSpacing >= 2.5 * diameter - EPS;
  const coverageFactor = diameter / Math.sqrt(cellArea);
  const coverageOk = coverageFactor >= 0.2 - EPS && coverageFactor <= 0.4 + EPS;

  const isSmall = diameter < 2.13;
  const safetyHeightLimit = isSmall ? 2.13 : 3.05;
  const safetyHeightOk = bladeHeight >= safetyHeightLimit - EPS;

  let heightRangeOk = false;
  if (isSmall) {
    heightRangeOk = bladeHeight <= 2 * diameter + EPS;
  } else {
    heightRangeOk = bladeHeight >= 0.8 * diameter - EPS && bladeHeight <= 2 * diameter + EPS;
  }

  const recommendedSmallHeightMet = isSmall ? bladeHeight >= recommendedSmallHeight - EPS : true;
  const conforming = wallClearanceOk && spacingOk && coverageOk && safetyHeightOk;

  // Calcul des diamètres réels compatibles pour information complémentaire
  const intervals = buildHeightFeasibility(room.height, mountMode.factor, coverageMinDiameter, Math.min(coverageMaxDiameter, cellShort / 2, spacings.length > 0 ? interFanSpacing / 2.5 : Number.POSITIVE_INFINITY));
  const compatibleRealDiameters = getCompatibleRealDiameters(realDiameters, intervals, cellArea);

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
    key: `custom-${nx}x${ny}-${mountMode.id}`,
    nx,
    ny,
    fanCount,
    room,
    mountMode,
    cellLength,
    cellWidth,
    cellArea,
    cellShort,
    cellLong,
    formFactor,
    diameter,
    theoreticalMaxDiameter: diameter,
    coverageFactor,
    mountDistance,
    bladeHeight,
    recommendedSmallHeightMet,
    recommendedSmallHeight,
    wallClearance: cellShort / 2,
    interFanSpacing,
    geometryCaps: {
      coverageMinDiameter,
      coverageMaxDiameter,
      wallMaxDiameter: cellShort / 2,
      interFanMaxDiameter: spacings.length > 0 ? interFanSpacing / 2.5 : Number.POSITIVE_INFINITY
    },
    compatibleRealDiameters,
    coordinates,
    fanClass: isSmall ? "small" : "large",
    isCustom: true,
    conformity: {
      conforming,
      wallClearanceOk,
      spacingOk,
      coverageOk,
      safetyHeightOk,
      heightRangeOk
    },
    strictAdvice: "Veuillez vérifier la conformité physique avec le fabricant de l'appareil choisi."
  };
}

export function findBestMarketAlternative(candidates) {
  const compatible = candidates.filter((c) => c.compatibleRealDiameters?.length > 0);
  if (compatible.length === 0) {
    return null;
  }

  return [...compatible].sort((a, b) => {
    const maxA = Math.max(...a.compatibleRealDiameters.map((d) => d.diameter));
    const maxB = Math.max(...b.compatibleRealDiameters.map((d) => d.diameter));
    if (Math.abs(maxA - maxB) > 1e-5) {
      return maxB - maxA; // larger diameter first
    }
    if (a.fanCount !== b.fanCount) {
      return a.fanCount - b.fanCount; // fewer fans first
    }
    return compareCandidates(a, b);
  })[0];
}

export function convertCandidateToMarketDiameter(candidate) {
  if (!candidate.compatibleRealDiameters || candidate.compatibleRealDiameters.length === 0) {
    return candidate;
  }

  const marketDiameter = Math.max(...candidate.compatibleRealDiameters.map((d) => d.diameter));
  const cellArea = candidate.cellArea;
  const coverageFactor = marketDiameter / Math.sqrt(cellArea);
  const mountDistance = candidate.mountMode.factor * marketDiameter;
  const bladeHeight = candidate.room.height - mountDistance;
  const recommendedSmallHeight = 1.4 * marketDiameter;
  const isSmall = marketDiameter < 2.13;
  const recommendedSmallHeightMet = isSmall ? bladeHeight >= recommendedSmallHeight - 1e-9 : true;

  return {
    ...candidate,
    diameter: marketDiameter,
    coverageFactor,
    mountDistance,
    bladeHeight,
    recommendedSmallHeight,
    recommendedSmallHeightMet,
    fanClass: isSmall ? "small" : "large",
    isMarketAlternative: true
  };
}
