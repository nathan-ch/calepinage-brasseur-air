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
