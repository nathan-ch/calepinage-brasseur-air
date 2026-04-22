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
  return warnings;
}

export function getVariabilityWarnings(design) {
  const warnings = [];
  if (!design.recommendedSmallHeightMet && design.fanClass === "small") {
    warnings.push(
      "La recommandation d'aisance sur la hauteur sous pales (> 1,4 D) n'est pas atteinte."
    );
  }
  if (design.mountMode.id === "low-profile") {
    warnings.push(design.mountMode.penaltyText);
  }
  if (design.selectedCentersOutsideCount > 0) {
    warnings.push(
      `${design.selectedCentersOutsideCount} centre${design.selectedCentersOutsideCount > 1 ? "s" : ""} de cellule reste${design.selectedCentersOutsideCount > 1 ? "nt" : ""} hors des rectangles cibles, ce qui traduit le debordement de la trame.`
    );
  }
  return warnings;
}
