import { EPS } from "./constants.js";

function ceilingAssessmentValueKey(value) {
  return value.toFixed(6);
}

function getUniqueCoordinateValues(values) {
  const seen = new Set();
  const uniqueValues = [];

  values.forEach((value) => {
    const key = ceilingAssessmentValueKey(value);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    uniqueValues.push(value);
  });

  return uniqueValues;
}

function findCenterMatch(axisCenters, value) {
  return axisCenters.find((center) => Math.abs(center.center - value) <= EPS) || null;
}

function buildAxisShiftCandidates(axisValues, axisCenters) {
  if (axisValues.length === 0 || axisCenters.length === 0) {
    return [];
  }

  const referenceValue = axisValues[0];
  const seenShifts = new Set();
  const candidates = [];

  axisCenters.forEach((center) => {
    const delta = center.center - referenceValue;
    const deltaKey = ceilingAssessmentValueKey(delta);

    if (seenShifts.has(deltaKey)) {
      return;
    }

    const centerByValueKey = new Map();
    let valid = true;

    axisValues.forEach((value) => {
      const shiftedValue = value + delta;
      const match = findCenterMatch(axisCenters, shiftedValue);

      if (!match) {
        valid = false;
        return;
      }

      centerByValueKey.set(ceilingAssessmentValueKey(value), match);
    });

    if (!valid) {
      return;
    }

    seenShifts.add(deltaKey);
    candidates.push({
      delta,
      centerByValueKey
    });
  });

  return candidates.sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta));
}

function getMinimumClearanceForCoordinates(room, coordinates) {
  return coordinates.reduce((bestDistance, point) => {
    const nextDistance = Math.min(point.x, room.length - point.x, point.y, room.width - point.y);
    return Math.min(bestDistance, nextDistance);
  }, Number.POSITIVE_INFINITY);
}

function createIncompatibleAssessment(reasonCode, reasonText, extra = {}) {
  return {
    enabled: true,
    compatible: false,
    reasonCode,
    reasonText,
    dx: 0,
    dy: 0,
    luminaireConflict: false,
    wallClearance: null,
    appliedCoordinates: extra.appliedCoordinates || null,
    shiftApplied: false,
    visualCheckNote: "Verifier visuellement la proximite luminaire / brasseur.",
    ...extra
  };
}

export function assessOptionCeilingCompatibility(option, ceilingGrid) {
  if (!ceilingGrid) {
    return {
      enabled: false,
      compatible: true,
      reasonCode: null,
      reasonText: "",
      dx: 0,
      dy: 0,
      luminaireConflict: false,
      wallClearance: option.wallClearance,
      appliedCoordinates: option.coordinates,
      shiftApplied: false,
      visualCheckNote: ""
    };
  }

  const uniqueXValues = getUniqueCoordinateValues(option.coordinates.map((point) => point.x));
  const uniqueYValues = getUniqueCoordinateValues(option.coordinates.map((point) => point.y));
  const xShiftCandidates = buildAxisShiftCandidates(uniqueXValues, ceilingGrid.xAxis.centers);
  const yShiftCandidates = buildAxisShiftCandidates(uniqueYValues, ceilingGrid.yAxis.centers);

  if (xShiftCandidates.length === 0 || yShiftCandidates.length === 0) {
    return createIncompatibleAssessment(
      "rail-alignment",
      "Aucun decalage global ne permet de faire tomber tous les centres sur des dalles du faux plafond.",
      {
        appliedCoordinates: option.coordinates
      }
    );
  }

  const combinedCandidates = [];
  xShiftCandidates.forEach((xShift) => {
    yShiftCandidates.forEach((yShift) => {
      combinedCandidates.push({
        dx: xShift.delta,
        dy: yShift.delta,
        distance: Math.hypot(xShift.delta, yShift.delta),
        xShift,
        yShift
      });
    });
  });
  combinedCandidates.sort((a, b) => a.distance - b.distance);

  let sawLuminaireConflict = false;
  let sawWallConflict = false;

  for (const combinedCandidate of combinedCandidates) {
    const appliedCoordinates = option.coordinates.map((point) => ({
      x: point.x + combinedCandidate.dx,
      y: point.y + combinedCandidate.dy
    }));
    const wallClearance = getMinimumClearanceForCoordinates(option.room, appliedCoordinates);

    if (wallClearance + EPS < option.diameter) {
      sawWallConflict = true;
      continue;
    }

    let hasLuminaireConflict = false;

    for (const point of option.coordinates) {
      const xCenter =
        combinedCandidate.xShift.centerByValueKey.get(ceilingAssessmentValueKey(point.x)) || null;
      const yCenter =
        combinedCandidate.yShift.centerByValueKey.get(ceilingAssessmentValueKey(point.y)) || null;

      if (!xCenter || !yCenter) {
        hasLuminaireConflict = true;
        break;
      }

      const tileKey = `${xCenter.index}:${yCenter.index}`;
      const tile = ceilingGrid.tileMap.get(tileKey);

      if (tile?.hasLuminaire) {
        hasLuminaireConflict = true;
        break;
      }
    }

    if (hasLuminaireConflict) {
      sawLuminaireConflict = true;
      continue;
    }

    return {
      enabled: true,
      compatible: true,
      reasonCode: null,
      reasonText:
        Math.abs(combinedCandidate.dx) > EPS || Math.abs(combinedCandidate.dy) > EPS
          ? "Les centres peuvent etre decales globalement pour tomber dans des dalles du faux plafond."
          : "Les centres theoriques tombent deja dans des dalles du faux plafond.",
      dx: combinedCandidate.dx,
      dy: combinedCandidate.dy,
      luminaireConflict: false,
      wallClearance,
      appliedCoordinates,
      shiftApplied:
        Math.abs(combinedCandidate.dx) > EPS || Math.abs(combinedCandidate.dy) > EPS,
      visualCheckNote: "Verifier visuellement la proximite luminaire / brasseur."
    };
  }

  if (sawLuminaireConflict) {
    return createIncompatibleAssessment(
      "luminaire-conflict",
      "Les positions alignees sur les dalles disponibles tombent sur une ou plusieurs dalles de luminaire existantes.",
      {
        appliedCoordinates: option.coordinates,
        luminaireConflict: true
      }
    );
  }

  if (sawWallConflict) {
    return createIncompatibleAssessment(
      "wall-conflict",
      "Le decalage necessaire pour suivre le faux plafond fait passer au moins un centre trop pres d'un mur.",
      {
        appliedCoordinates: option.coordinates
      }
    );
  }

  return createIncompatibleAssessment(
    "incompatible",
    "Le faux plafond ne permet pas de trouver une variante globale compatible sur cette trame.",
    {
      appliedCoordinates: option.coordinates
    }
  );
}
