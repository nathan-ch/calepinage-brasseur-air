import { getZoneBounds, getZoneInputSnapshot } from "../app/state.js";
import { escapeHtml, formatInputValue } from "../core/formatters.js";

export function syncZoneCard(dom, zone, room) {
  if (!zone || typeof dom.zonesList.querySelectorAll !== "function") {
    return;
  }

  const bounds = getZoneBounds(zone, room);
  const inputs = dom.zonesList.querySelectorAll(`[data-zone-id="${zone.id}"]`);
  const fieldMap = {
    centerX: { min: bounds.centerXMin, max: bounds.centerXMax },
    centerY: { min: bounds.centerYMin, max: bounds.centerYMax },
    length: { min: bounds.lengthMin, max: bounds.lengthMax },
    width: { min: bounds.widthMin, max: bounds.widthMax }
  };

  inputs.forEach((input) => {
    const field = input.dataset.field;
    const fieldBounds = fieldMap[field];
    if (!fieldBounds) {
      return;
    }
    input.min = formatInputValue(fieldBounds.min);
    input.max = formatInputValue(fieldBounds.max);
    input.value = formatInputValue(zone[field]);
  });
}

export function renderZonesEditor(dom, state, room) {
  dom.zonesList.innerHTML = state.variabilityZones
    .map((zone, index) => {
      const bounds = getZoneBounds(zone, room);
      const values = getZoneInputSnapshot(zone);
      const renderSliderField = (label, field, min, max) => `
        <div class="field slider-field">
          <label>${escapeHtml(label)}</label>
          <div class="slider-row">
            <input
              type="range"
              min="${formatInputValue(min)}"
              max="${formatInputValue(max)}"
              step="0.01"
              value="${values[field]}"
              data-zone-id="${zone.id}"
              data-field="${field}"
            >
            <input
              type="number"
              min="${formatInputValue(min)}"
              max="${formatInputValue(max)}"
              step="0.01"
              value="${values[field]}"
              data-zone-id="${zone.id}"
              data-field="${field}"
            >
          </div>
        </div>
      `;

      return `
        <article class="zone-card">
          <div class="zone-card-head">
            <strong>Zone ${index + 1}</strong>
            <button
              class="secondary"
              type="button"
              data-remove-zone="${zone.id}"
              ${state.variabilityZones.length <= 1 ? "disabled" : ""}
            >
              Supprimer
            </button>
          </div>
          <div class="zone-grid">
            ${renderSliderField("Centre X (m)", "centerX", bounds.centerXMin, bounds.centerXMax)}
            ${renderSliderField("Centre Y (m)", "centerY", bounds.centerYMin, bounds.centerYMax)}
            ${renderSliderField("Longueur cible (m)", "length", bounds.lengthMin, bounds.lengthMax)}
            ${renderSliderField("Largeur cible (m)", "width", bounds.widthMin, bounds.widthMax)}
          </div>
        </article>
      `;
    })
    .join("");
}
