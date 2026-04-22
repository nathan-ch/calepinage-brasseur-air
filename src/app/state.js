import { formatInputValue } from "../core/formatters.js";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseZoneValue(value, fallback) {
  const parsed = Number.parseFloat(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeZoneDraft(zone, room) {
  const maxLength = Math.max(0.1, room.length);
  const maxWidth = Math.max(0.1, room.width);

  const length = clamp(parseZoneValue(zone.length, room.length / 2 || 1), 0.1, maxLength);
  const width = clamp(parseZoneValue(zone.width, room.width / 2 || 1), 0.1, maxWidth);
  const centerX = clamp(parseZoneValue(zone.centerX, room.length / 2 || 0.5), length / 2, room.length - length / 2);
  const centerY = clamp(parseZoneValue(zone.centerY, room.width / 2 || 0.5), width / 2, room.width - width / 2);

  return {
    id: zone.id,
    centerX,
    centerY,
    length,
    width
  };
}

export function createDefaultCeilingLayout() {
  return {
    enabled: false,
    tileSize: 0.6,
    xAnchorMode: "symmetric",
    yAnchorMode: "symmetric",
    luminaireTiles: new Set()
  };
}

export function createAppState() {
  return {
    nextZoneId: 1,
    variabilityZones: [],
    latestReportState: null,
    ceilingLayout: createDefaultCeilingLayout()
  };
}

export function getCurrentRoomDraft(dom) {
  return {
    length: Number.parseFloat(String(dom.lengthInput.value).replace(",", ".")) || 9,
    width: Number.parseFloat(String(dom.widthInput.value).replace(",", ".")) || 5
  };
}

export function createDefaultZoneDraft(state, room) {
  const zone = {
    id: state.nextZoneId,
    centerX: room.length / 2,
    centerY: room.width / 2,
    length: Math.max(1, room.length / 2),
    width: Math.max(1, room.width / 2)
  };
  state.nextZoneId += 1;
  return normalizeZoneDraft(zone, room);
}

export function ensureVariabilityZones(state, room) {
  if (state.variabilityZones.length === 0) {
    state.variabilityZones = [createDefaultZoneDraft(state, room)];
  }
}

export function updateZoneDraft(state, room, zoneId, field, value) {
  state.variabilityZones = state.variabilityZones.map((zone) => {
    if (zone.id !== zoneId) {
      return zone;
    }
    return normalizeZoneDraft(
      {
        ...zone,
        [field]: parseZoneValue(value, zone[field])
      },
      room
    );
  });
}

export function normalizeAllZoneDrafts(state, room) {
  state.variabilityZones = state.variabilityZones.map((zone) => normalizeZoneDraft(zone, room));
}

export function removeZoneDraft(state, zoneId) {
  if (state.variabilityZones.length <= 1) {
    return;
  }
  state.variabilityZones = state.variabilityZones.filter((zone) => zone.id !== zoneId);
}

export function setLatestReportState(state, latestReportState) {
  state.latestReportState = latestReportState;
}

export function updateCeilingLayout(state, patch) {
  state.ceilingLayout = {
    ...state.ceilingLayout,
    ...patch,
    luminaireTiles:
      patch.luminaireTiles instanceof Set
        ? patch.luminaireTiles
        : new Set(state.ceilingLayout.luminaireTiles)
  };
}

export function toggleCeilingLuminaireTile(state, tileKey) {
  const nextLuminaireTiles = new Set(state.ceilingLayout.luminaireTiles);

  if (nextLuminaireTiles.has(tileKey)) {
    nextLuminaireTiles.delete(tileKey);
  } else {
    nextLuminaireTiles.add(tileKey);
  }

  updateCeilingLayout(state, { luminaireTiles: nextLuminaireTiles });
}

export function clearCeilingLuminaires(state) {
  updateCeilingLayout(state, { luminaireTiles: new Set() });
}

export function createSelectedReportOptionKeys(items) {
  return items.map((item) => item.key);
}

export function getSelectableReportOptions(reportState) {
  if (!reportState) {
    return [];
  }

  if (reportState.kind === "uniformity-ok") {
    return reportState.candidates || [];
  }

  if (reportState.kind === "variability-ok") {
    return reportState.designs || [];
  }

  return [];
}

export function getSelectedReportOptions(reportState) {
  const selectableOptions = getSelectableReportOptions(reportState);
  if (selectableOptions.length === 0) {
    return [];
  }

  const selectedKeys = new Set(
    reportState.selectedOptionKeys?.length
      ? reportState.selectedOptionKeys
      : createSelectedReportOptionKeys(selectableOptions)
  );

  return selectableOptions.filter((item) => selectedKeys.has(item.key));
}

export function toggleLatestReportOptionSelection(state, optionKey, selected) {
  const reportState = state.latestReportState;
  const selectableOptions = getSelectableReportOptions(reportState);
  if (!reportState || selectableOptions.length === 0) {
    return;
  }

  const selectableKeys = selectableOptions.map((item) => item.key);
  if (!selectableKeys.includes(optionKey)) {
    return;
  }

  const nextSelectedKeys = new Set(
    reportState.selectedOptionKeys?.length
      ? reportState.selectedOptionKeys
      : createSelectedReportOptionKeys(selectableOptions)
  );

  if (selected) {
    nextSelectedKeys.add(optionKey);
  } else {
    nextSelectedKeys.delete(optionKey);
  }

  reportState.selectedOptionKeys = selectableKeys.filter((key) => nextSelectedKeys.has(key));
}

export function resetState(state) {
  state.variabilityZones = [];
  state.latestReportState = null;
  state.ceilingLayout = createDefaultCeilingLayout();
}

export function getZoneBounds(zone, room) {
  return {
    centerXMin: zone.length / 2,
    centerXMax: room.length - zone.length / 2,
    centerYMin: zone.width / 2,
    centerYMax: room.width - zone.width / 2,
    lengthMin: 0.1,
    lengthMax: room.length,
    widthMin: 0.1,
    widthMax: room.width
  };
}

export function getZoneInputSnapshot(zone) {
  return {
    centerX: formatInputValue(zone.centerX),
    centerY: formatInputValue(zone.centerY),
    length: formatInputValue(zone.length),
    width: formatInputValue(zone.width)
  };
}
