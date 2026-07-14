import { EPS } from "./constants.js";
import { formatDiameterCm, formatMeters, joinWithOr } from "./formatters.js";

export function buildHeightDiameterRequirementMessage(room, modes, realDiameters) {
  const maxRealDiameter = realDiameters.length > 0 ? realDiameters[realDiameters.length - 1] : null;
  if (!room || !Number.isFinite(room.height) || !Number.isFinite(maxRealDiameter) || modes.length === 0) {
    return "";
  }

  const blockedModes = modes
    .map((mode) => ({
      mode,
      minimumDiameter: room.height / (2 + mode.factor)
    }))
    .filter((entry) => entry.minimumDiameter > maxRealDiameter + EPS);

  if (blockedModes.length === 0) {
    return "";
  }

  const requiredText = joinWithOr(
    blockedModes.map(
      (entry) => `${formatMeters(entry.minimumDiameter)} en ${entry.mode.label.toLowerCase()}`
    )
  );

  return `La base BRASSE II embarquee s'arrete a ${formatMeters(maxRealDiameter)} (${formatDiameterCm(maxRealDiameter)} cm). Avec ${formatMeters(room.height)} de HSP, il faudrait ici en theorie au moins ${requiredText}.`;
}

export function getCandidateWarnings(candidate) {
  const warnings = [];
  if (!candidate.recommendedSmallHeightMet && candidate.fanClass === "small") {
    warnings.push(
      "La recommandation d'aisance sur la hauteur sous pales (> 1,4 D) n'est pas atteinte."
    );
  }
  if (candidate.mountMode.id === "low-profile") {
    warnings.push(candidate.mountMode.penaltyText);
  }

  const heightRangeOk = candidate.isCustom
    ? candidate.conformity?.heightRangeOk
    : candidate.heightRangeOk;

  if (heightRangeOk === false) {
    if (candidate.bladeHeight > 2 * candidate.diameter + EPS) {
      const targetBladeHeight = 2 * candidate.diameter;
      const targetMountDistance = candidate.room.height - targetBladeHeight;
      warnings.push(
        `Recommandation pour garantir la performance : la hauteur sous pales (${formatMeters(candidate.bladeHeight)}) est trop importante par rapport au diametre (regle pour assurer la vitesse d'air au sol : hauteur sous pales < 2 × diametre, soit ${formatMeters(2 * candidate.diameter)}). Il est recommande d'utiliser une suspension (hauteur pales/plafond) de ${formatMeters(targetMountDistance)} pour obtenir une hauteur sous pales optimale de ${formatMeters(targetBladeHeight)}.`
      );
    } else if (candidate.bladeHeight < 0.8 * candidate.diameter - EPS) {
      warnings.push(
        `La hauteur sous pales (${formatMeters(candidate.bladeHeight)}) est trop faible pour assurer un bon fonctionnement (minimum de 0,8 D, soit ${formatMeters(0.8 * candidate.diameter)}).`
      );
    }
  }

  if (candidate.diameter > 1.62 + EPS) {
    warnings.push(
      "Diametre hors gamme courante (> 1,62 m). Les modeles de cette taille sont plus difficiles a trouver sur le marche actuellement."
    );
  }

  return warnings;
}
