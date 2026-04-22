import { formatMeters } from "../core/formatters.js";

const ROOM_CORNER_RADIUS = 6;

function svgLabelBox(x, y, label, anchor = "middle", fontSize = 10.5) {
  const textWidth = Math.max(54, label.length * (fontSize * 0.6));
  let rectX = x - textWidth / 2 - 6;

  if (anchor === "start") {
    rectX = x - 6;
  } else if (anchor === "end") {
    rectX = x - textWidth - 6;
  }

  return `
    <g>
      <rect x="${rectX}" y="${y - 12}" width="${textWidth + 12}" height="18" rx="9"
        fill="rgba(255,250,242,0.96)" stroke="rgba(29,47,44,0.12)" />
      <text x="${x}" y="${y + 1.5}" text-anchor="${anchor}" font-size="${fontSize}" fill="#163531" font-weight="700">${label}</text>
    </g>
  `;
}

function svgDimensionLine(
  x1,
  y1,
  x2,
  y2,
  label,
  anchor = "middle",
  offsetX = 0,
  offsetY = -8,
  fontSize = 10.5
) {
  const labelX = (x1 + x2) / 2 + offsetX;
  const labelY = (y1 + y2) / 2 + offsetY;
  const isHorizontal = Math.abs(x2 - x1) >= Math.abs(y2 - y1);
  const startTick = isHorizontal
    ? `<line x1="${x1}" y1="${y1 - 5}" x2="${x1}" y2="${y1 + 5}" stroke="#b86d21" stroke-width="2" />`
    : `<line x1="${x1 - 5}" y1="${y1}" x2="${x1 + 5}" y2="${y1}" stroke="#b86d21" stroke-width="2" />`;
  const endTick = isHorizontal
    ? `<line x1="${x2}" y1="${y2 - 5}" x2="${x2}" y2="${y2 + 5}" stroke="#b86d21" stroke-width="2" />`
    : `<line x1="${x2 - 5}" y1="${y2}" x2="${x2 + 5}" y2="${y2}" stroke="#b86d21" stroke-width="2" />`;

  return `
    <g>
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#b86d21" stroke-width="2" />
      ${startTick}
      ${endTick}
      ${svgLabelBox(labelX, labelY, label, anchor, fontSize)}
    </g>
  `;
}

function svgFanSymbol(cx, cy, radius, index) {
  const bladeLength = radius * 0.78;
  const bladeWidth = Math.max(7, radius * 0.24);
  const hubRadius = Math.max(6, radius * 0.16);
  const bladeShape = `
    <path d="
      M ${hubRadius * 0.35} ${-bladeWidth / 2}
      Q ${bladeLength * 0.48} ${-bladeWidth * 0.72} ${bladeLength} 0
      Q ${bladeLength * 0.48} ${bladeWidth * 0.72} ${hubRadius * 0.35} ${bladeWidth / 2}
      Z
    " fill="#c9d3df" stroke="#6b7280" stroke-width="1.2" />
  `;

  return `
    <g>
      <circle cx="${cx}" cy="${cy}" r="${radius}" fill="rgba(31,79,130,0.06)" stroke="rgba(31,79,130,0.45)" stroke-width="1.6" stroke-dasharray="5 4" />
      <g transform="translate(${cx} ${cy})">
        <g transform="rotate(0)">${bladeShape}</g>
        <g transform="rotate(120)">${bladeShape}</g>
        <g transform="rotate(240)">${bladeShape}</g>
        <circle cx="0" cy="0" r="${hubRadius}" fill="#4b5563" />
        <circle cx="0" cy="0" r="${Math.max(2.6, hubRadius * 0.35)}" fill="#f9fafb" />
      </g>
      <circle cx="${cx}" cy="${cy}" r="5" fill="#111827" />
      <text x="${cx}" y="${cy + 3.8}" text-anchor="middle" font-size="9" fill="#ffffff" font-weight="700">${index + 1}</text>
    </g>
  `;
}

export function getPlanCanvasMetrics(item) {
  const roomAspectRatio =
    Math.max(item.room.length, item.room.width) / Math.min(item.room.length, item.room.width);
  const rotateForFit = roomAspectRatio >= 2.2 && item.room.length > item.room.width;

  if (rotateForFit) {
    return {
      roomAspectRatio,
      rotateForFit,
      canvasWidth: 320,
      canvasHeight: 400,
      wrapMinHeight: 392
    };
  }

  if (roomAspectRatio >= 1.55) {
    return {
      roomAspectRatio,
      rotateForFit,
      canvasWidth: 360,
      canvasHeight: 290,
      wrapMinHeight: 320
    };
  }

  return {
    roomAspectRatio,
    rotateForFit,
    canvasWidth: 360,
    canvasHeight: 250,
    wrapMinHeight: 280
  };
}

export function planWrapStyle(item) {
  const { wrapMinHeight } = getPlanCanvasMetrics(item);
  return `--plan-min-height:${wrapMinHeight}px;`;
}

function buildPlanGeometry(room) {
  const { roomAspectRatio, rotateForFit, canvasWidth, canvasHeight } = getPlanCanvasMetrics({ room });
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
    roomAspectRatio,
    rotateForFit,
    width: canvasWidth,
    height: canvasHeight,
    roomX,
    roomY,
    roomWidth,
    roomHeight,
    scale,
    displayRoomLength,
    displayRoomHeight,
    compactMode: roomAspectRatio >= 2.4,
    labelFontSize: roomAspectRatio >= 2.4 ? 9.2 : 10.5,
    compactOffset: roomAspectRatio >= 2.4 ? 2 : 0,
    projectPoint(point) {
      const displayPoint = rotateForFit ? { x: point.y, y: point.x } : point;
      return {
        x: roomX + displayPoint.x * scale,
        y: roomY + displayPoint.y * scale
      };
    },
    projectRect(rectangle) {
      const minPoint = rotateForFit
        ? { x: rectangle.minY, y: rectangle.minX }
        : { x: rectangle.minX, y: rectangle.minY };
      const maxPoint = rotateForFit
        ? { x: rectangle.maxY, y: rectangle.maxX }
        : { x: rectangle.maxX, y: rectangle.maxY };

      return {
        x: roomX + Math.min(minPoint.x, maxPoint.x) * scale,
        y: roomY + Math.min(minPoint.y, maxPoint.y) * scale,
        width: Math.abs(maxPoint.x - minPoint.x) * scale,
        height: Math.abs(maxPoint.y - minPoint.y) * scale
      };
    }
  };
}

function getRenderedCoordinates(item) {
  const ceilingAssessment = item.ceilingAssessment;

  if (ceilingAssessment?.enabled && ceilingAssessment.compatible && ceilingAssessment.appliedCoordinates) {
    return ceilingAssessment.appliedCoordinates;
  }

  return item.coordinates;
}

function renderCeilingOverlay(geometry, ceilingGrid) {
  if (!ceilingGrid) {
    return "";
  }

  return ceilingGrid.tiles
    .map((tile) => {
      const rectangle = geometry.projectRect(tile);
      const fill = tile.hasLuminaire
        ? "rgba(184,109,33,0.22)"
        : tile.isCut
          ? "rgba(29,47,44,0.05)"
          : "rgba(255,255,255,0.28)";
      const stroke = tile.hasLuminaire ? "rgba(184,109,33,0.64)" : "rgba(29,47,44,0.12)";

      return `
        <rect
          x="${rectangle.x}"
          y="${rectangle.y}"
          width="${rectangle.width}"
          height="${rectangle.height}"
          rx="6"
          fill="${fill}"
          stroke="${stroke}"
          stroke-width="${tile.hasLuminaire ? 1.3 : 1}"
        />
      `;
    })
    .join("");
}

function renderTheoreticalGhostCenters(geometry, item, displayCoordinates) {
  const assessment = item.ceilingAssessment;

  if (!assessment?.compatible || !assessment.shiftApplied) {
    return "";
  }

  return item.coordinates
    .map((point, index) => {
      const renderedPoint = geometry.projectPoint(point);
      const shiftedPoint = geometry.projectPoint(displayCoordinates[index]);
      return `
        <g>
          <line
            x1="${renderedPoint.x}"
            y1="${renderedPoint.y}"
            x2="${shiftedPoint.x}"
            y2="${shiftedPoint.y}"
            stroke="rgba(107,114,128,0.5)"
            stroke-width="1.2"
            stroke-dasharray="4 4"
          />
          <circle cx="${renderedPoint.x}" cy="${renderedPoint.y}" r="3.2" fill="rgba(107,114,128,0.65)" />
        </g>
      `;
    })
    .join("");
}

function renderUniformGrid(geometry, item) {
  const displayCellLength = geometry.rotateForFit ? item.cellWidth : item.cellLength;
  const displayCellHeight = geometry.rotateForFit ? item.cellLength : item.cellWidth;
  const displayNx = geometry.rotateForFit ? item.ny : item.nx;
  const displayNy = geometry.rotateForFit ? item.nx : item.ny;
  const gridLines = [];

  for (let index = 1; index < displayNx; index += 1) {
    const x = geometry.roomX + index * displayCellLength * geometry.scale;
    gridLines.push(
      `<line x1="${x}" y1="${geometry.roomY}" x2="${x}" y2="${geometry.roomY + geometry.roomHeight}" stroke="rgba(29,47,44,0.18)" stroke-dasharray="6 5" />`
    );
  }

  for (let index = 1; index < displayNy; index += 1) {
    const y = geometry.roomY + index * displayCellHeight * geometry.scale;
    gridLines.push(
      `<line x1="${geometry.roomX}" y1="${y}" x2="${geometry.roomX + geometry.roomWidth}" y2="${y}" stroke="rgba(29,47,44,0.18)" stroke-dasharray="6 5" />`
    );
  }

  return gridLines.join("");
}

function renderFans(geometry, item, displayCoordinates) {
  return displayCoordinates
    .map((point, index) => {
      const renderedPoint = geometry.projectPoint(point);
      const radius = (item.diameter / 2) * geometry.scale;
      return svgFanSymbol(renderedPoint.x, renderedPoint.y, radius, index);
    })
    .join("");
}

function getNearestWallMeasurement(room, point) {
  return [
    { axis: "x", boundary: 0, clearance: point.x },
    { axis: "x", boundary: room.length, clearance: room.length - point.x },
    { axis: "y", boundary: 0, clearance: point.y },
    { axis: "y", boundary: room.width, clearance: room.width - point.y }
  ].sort((a, b) => a.clearance - b.clearance)[0];
}

function renderCandidateMeasurements(geometry, candidate, displayCoordinates) {
  if (displayCoordinates.length === 0) {
    return "";
  }

  const firstPoint = displayCoordinates[0];
  const firstRenderedPoint = geometry.projectPoint(firstPoint);
  const radius = (candidate.diameter / 2) * geometry.scale;
  const measurements = [];

  measurements.push(
    svgDimensionLine(
      firstRenderedPoint.x - radius,
      firstRenderedPoint.y - radius - (geometry.compactMode ? 8 : 12),
      firstRenderedPoint.x + radius,
      firstRenderedPoint.y - radius - (geometry.compactMode ? 8 : 12),
      `D ${formatMeters(candidate.diameter)}`,
      "middle",
      0,
      geometry.compactMode ? -6 : -8,
      geometry.labelFontSize
    )
  );

  const nearestWall = getNearestWallMeasurement(candidate.room, firstPoint);
  const displayedWallClearance =
    candidate.ceilingAssessment?.wallClearance || candidate.wallClearance;

  if (nearestWall.axis === "x") {
    const wallX = nearestWall.boundary === 0 ? geometry.roomX : geometry.roomX + geometry.roomWidth;
    const lineY = Math.min(
      geometry.height - 14,
      firstRenderedPoint.y + radius + (geometry.compactMode ? 12 : 16)
    );

    measurements.push(
      svgDimensionLine(
        wallX,
        lineY,
        firstRenderedPoint.x,
        lineY,
        `Mur ${formatMeters(displayedWallClearance)}`,
        "middle",
        0,
        geometry.compactMode ? -6 : -8,
        geometry.labelFontSize
      )
    );
  } else {
    const wallY = nearestWall.boundary === 0 ? geometry.roomY : geometry.roomY + geometry.roomHeight;
    const lineX = Math.min(
      geometry.width - 16,
      firstRenderedPoint.x + radius + (geometry.compactMode ? 12 : 16)
    );

    measurements.push(
      svgDimensionLine(
        lineX,
        wallY,
        lineX,
        firstRenderedPoint.y,
        `Mur ${formatMeters(displayedWallClearance)}`,
        "start",
        8 + geometry.compactOffset,
        -2,
        geometry.labelFontSize
      )
    );
  }

  if (candidate.interFanSpacing) {
    const displayCellLength = geometry.rotateForFit ? candidate.cellWidth : candidate.cellLength;
    const displayCellHeight = geometry.rotateForFit ? candidate.cellLength : candidate.cellWidth;
    const displayNx = geometry.rotateForFit ? candidate.ny : candidate.nx;
    const displayNy = geometry.rotateForFit ? candidate.nx : candidate.ny;
    const horizontalSpacing = displayNx > 1 ? displayCellLength : Number.POSITIVE_INFINITY;
    const verticalSpacing = displayNy > 1 ? displayCellHeight : Number.POSITIVE_INFINITY;

    if (horizontalSpacing <= verticalSpacing) {
      const secondRenderedPoint = geometry.projectPoint({
        x: firstPoint.x + displayCellLength,
        y: firstPoint.y
      });
      const lineY = Math.max(
        geometry.roomY + 10,
        firstRenderedPoint.y - radius - (geometry.compactMode ? 26 : 34)
      );
      measurements.push(
        svgDimensionLine(
          firstRenderedPoint.x,
          lineY,
          secondRenderedPoint.x,
          lineY,
          `Entraxe ${formatMeters(candidate.interFanSpacing)}`,
          "middle",
          0,
          geometry.compactMode ? -6 : -8,
          geometry.labelFontSize
        )
      );
    } else {
      const secondRenderedPoint = geometry.projectPoint({
        x: firstPoint.x,
        y: firstPoint.y + displayCellHeight
      });
      const lineX = Math.min(
        geometry.width - 12,
        firstRenderedPoint.x + radius + (geometry.compactMode ? 24 : 32)
      );
      measurements.push(
        svgDimensionLine(
          lineX,
          firstRenderedPoint.y,
          lineX,
          secondRenderedPoint.y,
          `Entraxe ${formatMeters(candidate.interFanSpacing)}`,
          "start",
          8 + geometry.compactOffset,
          -2,
          geometry.labelFontSize
        )
      );
    }
  }

  return measurements.join("");
}

export function svgForCandidate(candidate) {
  const geometry = buildPlanGeometry(candidate.room);
  const displayCoordinates = getRenderedCoordinates(candidate);
  const fans = renderFans(geometry, candidate, displayCoordinates);
  const theoreticalGhosts = renderTheoreticalGhostCenters(geometry, candidate, displayCoordinates);
  const measurements = renderCandidateMeasurements(geometry, candidate, displayCoordinates);

  return `
    <svg viewBox="0 0 ${geometry.width} ${geometry.height}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <rect x="${geometry.roomX}" y="${geometry.roomY}" width="${geometry.roomWidth}" height="${geometry.roomHeight}" rx="${ROOM_CORNER_RADIUS}" fill="#faf5eb" stroke="rgba(29,47,44,0.2)" stroke-width="2.5" />
      ${renderCeilingOverlay(geometry, candidate.ceilingGrid)}
      ${renderUniformGrid(geometry, candidate)}
      ${theoreticalGhosts}
      ${fans}
      ${measurements}
    </svg>
  `;
}
