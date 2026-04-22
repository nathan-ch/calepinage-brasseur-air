import { buildCeilingGrid } from "../core/ceilingGrid.js";
import { formatMeters, formatSquareMeters } from "../core/formatters.js";
import { getPlanCanvasMetrics } from "./planSvg.js";

const CEILING_EDITOR_ROOM_CORNER_RADIUS = 6;

function buildCeilingEditorGeometry(room) {
  const { rotateForFit, canvasWidth, canvasHeight } = getPlanCanvasMetrics({ room });
  const paddingX = 28;
  const paddingY = 28;
  const displayRoomLength = rotateForFit ? room.width : room.length;
  const displayRoomHeight = rotateForFit ? room.length : room.width;
  const scale = Math.min(
    (canvasWidth - paddingX * 2) / displayRoomLength,
    (canvasHeight - paddingY * 2) / displayRoomHeight
  );
  const roomWidth = displayRoomLength * scale;
  const roomHeight = displayRoomHeight * scale;
  const roomX = (canvasWidth - roomWidth) / 2;
  const roomY = (canvasHeight - roomHeight) / 2;

  return {
    rotateForFit,
    width: canvasWidth,
    height: canvasHeight,
    scale,
    roomWidth,
    roomHeight,
    roomX,
    roomY,
    projectRect(rectangle) {
      const minX = rotateForFit ? rectangle.minY : rectangle.minX;
      const maxX = rotateForFit ? rectangle.maxY : rectangle.maxX;
      const minY = rotateForFit ? rectangle.minX : rectangle.minY;
      const maxY = rotateForFit ? rectangle.maxX : rectangle.maxY;

      return {
        x: roomX + Math.min(minX, maxX) * scale,
        y: roomY + Math.min(minY, maxY) * scale,
        width: Math.abs(maxX - minX) * scale,
        height: Math.abs(maxY - minY) * scale
      };
    }
  };
}

function renderCeilingEditorSvg(room, ceilingGrid) {
  const geometry = buildCeilingEditorGeometry(room);
  const tileShapes = ceilingGrid.tiles
    .map((tile) => {
      const rectangle = geometry.projectRect(tile);
      const fill = tile.hasLuminaire
        ? "rgba(184,109,33,0.28)"
        : tile.isCut
          ? "rgba(29,47,44,0.06)"
          : "rgba(255,255,255,0.88)";
      const stroke = tile.hasLuminaire ? "rgba(184,109,33,0.72)" : "rgba(29,47,44,0.14)";

      return `
        <rect
          x="${rectangle.x}"
          y="${rectangle.y}"
          width="${rectangle.width}"
          height="${rectangle.height}"
          rx="6"
          fill="${fill}"
          stroke="${stroke}"
          stroke-width="${tile.hasLuminaire ? 1.4 : 1}"
          data-luminaire-tile-key="${tile.key}"
          class="ceiling-editor-tile${tile.hasLuminaire ? " is-luminaire" : ""}"
        />
      `;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${geometry.width} ${geometry.height}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <rect
        x="${geometry.roomX}"
        y="${geometry.roomY}"
        width="${geometry.roomWidth}"
        height="${geometry.roomHeight}"
        rx="${CEILING_EDITOR_ROOM_CORNER_RADIUS}"
        fill="#faf5eb"
        stroke="rgba(29,47,44,0.2)"
        stroke-width="2.5"
      />
      ${tileShapes}
    </svg>
  `;
}

export function renderCeilingEditor(dom, state, room) {
  const isEnabled = !!state.ceilingLayout.enabled;

  dom.ceilingConfig.classList.toggle("hidden", !isEnabled);
  dom.ceilingAnchorXInput.value = state.ceilingLayout.xAnchorMode;
  dom.ceilingAnchorYInput.value = state.ceilingLayout.yAnchorMode;

  if (!isEnabled) {
    dom.ceilingEditorSummary.textContent = "";
    dom.ceilingEditorCanvas.innerHTML = "";
    dom.clearCeilingLuminairesButton.disabled = true;
    return null;
  }

  const ceilingGrid = buildCeilingGrid(room, state.ceilingLayout);

  if (!ceilingGrid) {
    dom.ceilingEditorSummary.textContent = "";
    dom.ceilingEditorCanvas.innerHTML = "";
    dom.clearCeilingLuminairesButton.disabled = true;
    return null;
  }

  dom.ceilingEditorSummary.innerHTML = `
    ${ceilingGrid.tiles.length} dalles visibles, dont ${ceilingGrid.cutTilesCount} dalle${ceilingGrid.cutTilesCount > 1 ? "s" : ""} recoupée${ceilingGrid.cutTilesCount > 1 ? "s" : ""}.
    ${ceilingGrid.luminairesCount} luminaire${ceilingGrid.luminairesCount > 1 ? "s" : ""} placé${ceilingGrid.luminairesCount > 1 ? "s" : ""}.
    Piece ${formatMeters(room.length)} × ${formatMeters(room.width)} (${formatSquareMeters(room.length * room.width)}).
  `;
  dom.ceilingEditorCanvas.innerHTML = renderCeilingEditorSvg(room, ceilingGrid);
  dom.clearCeilingLuminairesButton.disabled = ceilingGrid.luminairesCount === 0;

  return ceilingGrid;
}
