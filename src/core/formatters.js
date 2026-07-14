export function parseNumber(input) {
  const raw = typeof input === "string" ? input : input.value;
  return Number.parseFloat(String(raw).replace(",", "."));
}

export function formatInputValue(value) {
  return Number.isFinite(value) ? String(value).replace(".", ",") : "";
}

export function formatNumber(value, digits = 2) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits
  }).format(value);
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatMeters(value, digits = 2) {
  return `${formatNumber(value, digits)} m`;
}

export function formatDiameterCm(value) {
  return `${Math.round(value * 100)}`;
}

export function formatDiameterCmList(values) {
  return values
    .map((value) => formatDiameterCm(typeof value === "number" ? value : value.diameter))
    .join(", ");
}

export function formatSquareMeters(value, digits = 2) {
  return `${formatNumber(value, digits)} m²`;
}

export function formatFactor(value, digits = 2) {
  return formatNumber(value, digits);
}

export function formatTemp(value, digits = 2) {
  return `${formatNumber(value, digits)} °C`;
}

export function formatDb(value, digits = 1) {
  return `${formatNumber(value, digits)} dBA`;
}

export function formatWatts(value, digits = 0) {
  return `${formatNumber(value, digits)} W`;
}

export function formatSpeed(value, digits = 2) {
  if (value === null || value === undefined) {
    return "—";
  }
  return `${formatNumber(value, digits)} m/s`;
}

export function formatDateTime(value = new Date()) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}

export function formatDiameterList(values) {
  return values.map((diameter) => formatMeters(diameter)).join(", ");
}

export function joinWithOr(values) {
  if (values.length <= 1) {
    return values[0] || "";
  }
  if (values.length === 2) {
    return `${values[0]} ou ${values[1]}`;
  }
  return `${values.slice(0, -1).join(", ")} ou ${values[values.length - 1]}`;
}
