import { EPS } from "./constants.js";

/**
 * Retourne tous les modeles BRASSE II compatibles avec les diametres admissibles
 * d'une option de calepinage.
 */
export function getBrasse2ModelsForCandidate(candidate, brasse2Models) {
  const optionsByDiameterCm = new Map(
    candidate.compatibleRealDiameters.map((option) => [Math.round(option.diameter * 100), option])
  );

  return brasse2Models
    .filter((model) => optionsByDiameterCm.has(model.diameterCm))
    .map((model) => ({
      ...model,
      compatibleOption: optionsByDiameterCm.get(model.diameterCm),
      mountFits:
        model.ceilingDistanceCm <=
        candidate.mountMode.factor * optionsByDiameterCm.get(model.diameterCm).diameter * 100 + 0.5,
      mountDeltaCm: Number(
        (
          candidate.mountMode.factor * optionsByDiameterCm.get(model.diameterCm).diameter * 100 -
          model.ceilingDistanceCm
        ).toFixed(1)
      ),
      isSelectedDiameter: Math.abs(model.diameterCm - Math.round(candidate.diameter * 100)) <= 0.5
    }));
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
  const coverageA = Number.isFinite(a.compatibleOption?.coverageFactor)
    ? a.compatibleOption.coverageFactor
    : -Infinity;
  const coverageB = Number.isFinite(b.compatibleOption?.coverageFactor)
    ? b.compatibleOption.coverageFactor
    : -Infinity;

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
