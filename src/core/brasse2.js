import { EPS } from "./constants.js";
import {
  getCoverageFactorForDiameter,
  isCoverageFactorValid
} from "./calepinage.js";

/**
 * Enrichit les modeles BRASSE II avec des indicateurs de compatibilite pour une
 * option (dimensionnement theorique, montage, FCC derive).
 */
export function getBrasse2ModelsForCandidate(candidate, brasse2Models) {
  const maxDiameterCm = Math.round(candidate.theoreticalMaxDiameter * 100);

  return brasse2Models.map((model) => {
    const modelDiameter = model.diameterCm / 100;
    const coverageFactor = getCoverageFactorForDiameter(candidate.cellArea, modelDiameter);
    const coverageValid = isCoverageFactorValid(coverageFactor);
    const sizeFits = model.diameterCm <= maxDiameterCm + 0.5;
    const targetCeilingDistanceCm = candidate.mountMode.factor * modelDiameter * 100;

    return {
      ...model,
      sizing: {
        diameter: modelDiameter,
        coverageFactor,
        coverageValid,
        sizeFits
      },
      mountFits: model.ceilingDistanceCm <= targetCeilingDistanceCm + 0.5,
      mountDeltaCm: Number((targetCeilingDistanceCm - model.ceilingDistanceCm).toFixed(1))
    };
  });
}

export function pickBestModel(models, comparator) {
  return [...models].sort(comparator)[0] || null;
}

export function compareComfort(a, b) {
  if (Math.abs(b.ceDirDeboutMax - a.ceDirDeboutMax) > EPS) {
    return b.ceDirDeboutMax - a.ceDirDeboutMax;
  }
  if (Math.abs(a.lwaMaxDbA - b.lwaMaxDbA) > EPS) {
    return a.lwaMaxDbA - b.lwaMaxDbA;
  }
  return a.powerMaxW - b.powerMaxW;
}

export function compareEfficiency(a, b) {
  if (Math.abs(b.cfeDirDeboutMax - a.cfeDirDeboutMax) > EPS) {
    return b.cfeDirDeboutMax - a.cfeDirDeboutMax;
  }
  if (Math.abs(a.lwaMaxDbA - b.lwaMaxDbA) > EPS) {
    return a.lwaMaxDbA - b.lwaMaxDbA;
  }
  return b.ceDirDeboutMax - a.ceDirDeboutMax;
}

export function compareAcoustics(a, b) {
  if (Math.abs(a.lwaMaxDbA - b.lwaMaxDbA) > EPS) {
    return a.lwaMaxDbA - b.lwaMaxDbA;
  }
  if (Math.abs(b.ceDirDeboutMax - a.ceDirDeboutMax) > EPS) {
    return b.ceDirDeboutMax - a.ceDirDeboutMax;
  }
  return a.powerMaxW - b.powerMaxW;
}

export function compareCoverage(a, b) {
  const coverageA = Number.isFinite(a.sizing?.coverageFactor) ? a.sizing.coverageFactor : -Infinity;
  const coverageB = Number.isFinite(b.sizing?.coverageFactor) ? b.sizing.coverageFactor : -Infinity;

  if (Math.abs(coverageB - coverageA) > EPS) {
    return coverageB - coverageA;
  }
  return compareComfort(a, b);
}

export function modelMountLabel(model) {
  return model.mountFits
    ? "Distance plafond/BA compatible"
    : "Distance plafond/BA a verifier";
}

export function buildModelPicks(models) {
  return [
    { title: "FCC", model: pickBestModel(models, compareCoverage) },
    { title: "Confort", model: pickBestModel(models, compareComfort) },
    { title: "Efficacite", model: pickBestModel(models, compareEfficiency) },
    { title: "Acoustique", model: pickBestModel(models, compareAcoustics) }
  ].filter((pick) => Boolean(pick.model));
}

export function getReportModelHighlights(candidate, brasse2Models) {
  return buildModelPicks(getBrasse2ModelsForCandidate(candidate, brasse2Models));
}
