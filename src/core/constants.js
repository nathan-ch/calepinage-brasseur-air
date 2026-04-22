export const EPS = 1e-9;
export const SMALL_FAN_LIMIT = 2.13;
export const SMALL_SAFETY_HEIGHT = 2.13;
export const LARGE_SAFETY_HEIGHT = 3.05;
export const MAX_GRID_FANS = 36;

export const MOUNT_MODES = [
  {
    id: "standard",
    label: "Montage standard",
    factor: 0.35,
    penaltyText: "Pas de reduction explicite dans le guide.",
    severity: "ok"
  },
  {
    id: "low-profile",
    label: "Montage low-profile",
    factor: 0.25,
    penaltyText: "Reduction de vitesse d'air d'environ 15 % selon le guide.",
    severity: "warn"
  }
];

export const FLUSH_MODE = {
  id: "flush",
  label: "Montage flush",
  factor: 0.15,
  penaltyText:
    "Perte de performance de plus de 40 % ; le guide demande de l'eviter au maximum.",
  severity: "alert"
};
