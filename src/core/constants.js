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
    penaltyText: "En raison de la faible distance pales/plafond, la vitesse d'air au sol subit une reduction d'environ 15 % selon le guide.",
    severity: "warn"
  }
];

export const FLUSH_MODE = {
  id: "flush",
  label: "Montage flush",
  factor: 0.15,
  penaltyText:
    "En raison de la tres faible distance pales/plafond, la perte de vitesse d'air au sol depasse 40 % ; le guide recommande d'eviter ce montage au maximum.",
  severity: "alert"
};
