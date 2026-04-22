import { formatMeters } from "../core/formatters.js";

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

export function getPlanCanvasMetrics(candidate) {
  const roomAspectRatio =
    Math.max(candidate.room.length, candidate.room.width) /
    Math.min(candidate.room.length, candidate.room.width);
  const rotateForFit = roomAspectRatio >= 2.2 && candidate.room.length > candidate.room.width;

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

export function planWrapStyle(candidate) {
  const { wrapMinHeight } = getPlanCanvasMetrics(candidate);
  return `--plan-min-height:${wrapMinHeight}px;`;
}

export function svgForCandidate(candidate) {
  const { roomAspectRatio, rotateForFit, canvasWidth, canvasHeight } = getPlanCanvasMetrics(candidate);
  const paddingX = 28;
  const paddingY = 28;
  const displayRoomLength = rotateForFit ? candidate.room.width : candidate.room.length;
  const displayRoomHeight = rotateForFit ? candidate.room.length : candidate.room.width;
  const scale = Math.min(
    (canvasWidth - paddingX * 2) / displayRoomLength,
    (canvasHeight - paddingY * 2) / displayRoomHeight
  );
  const width = canvasWidth;
  const height = canvasHeight;
  const roomWidth = displayRoomLength * scale;
  const roomHeight = displayRoomHeight * scale;
  const roomX = (canvasWidth - roomWidth) / 2;
  const roomY = (canvasHeight - roomHeight) / 2;
  const compactMode = roomAspectRatio >= 2.4;
  const labelFontSize = compactMode ? 9.2 : 10.5;
  const compactOffset = compactMode ? 2 : 0;
  const displayCoordinates = candidate.coordinates.map((point) =>
    rotateForFit ? { x: point.y, y: point.x } : { x: point.x, y: point.y }
  );
  const displayCellLength = rotateForFit ? candidate.cellWidth : candidate.cellLength;
  const displayCellHeight = rotateForFit ? candidate.cellLength : candidate.cellWidth;
  const displayNx = rotateForFit ? candidate.ny : candidate.nx;
  const displayNy = rotateForFit ? candidate.nx : candidate.ny;

  const gridLines = [];
  for (let i = 1; i < displayNx; i += 1) {
    const x = roomX + i * displayCellLength * scale;
    gridLines.push(
      `<line x1="${x}" y1="${roomY}" x2="${x}" y2="${roomY + roomHeight}" stroke="rgba(29,47,44,0.18)" stroke-dasharray="6 5" />`
    );
  }
  for (let j = 1; j < displayNy; j += 1) {
    const y = roomY + j * displayCellHeight * scale;
    gridLines.push(
      `<line x1="${roomX}" y1="${y}" x2="${roomX + roomWidth}" y2="${y}" stroke="rgba(29,47,44,0.18)" stroke-dasharray="6 5" />`
    );
  }

  const fans = displayCoordinates
    .map((point, index) => {
      const cx = roomX + point.x * scale;
      const cy = roomY + point.y * scale;
      const r = (candidate.diameter / 2) * scale;
      return svgFanSymbol(cx, cy, r, index);
    })
    .join("");

  const firstPoint = displayCoordinates[0];
  const firstCx = roomX + firstPoint.x * scale;
  const firstCy = roomY + firstPoint.y * scale;
  const radius = (candidate.diameter / 2) * scale;
  const measurements = [];

  measurements.push(
    svgDimensionLine(
      firstCx - radius,
      firstCy - radius - (compactMode ? 8 : 12),
      firstCx + radius,
      firstCy - radius - (compactMode ? 8 : 12),
      `D ${formatMeters(candidate.diameter)}`,
      "middle",
      0,
      compactMode ? -6 : -8,
      labelFontSize
    )
  );

  if (firstPoint.x <= firstPoint.y) {
    measurements.push(
      svgDimensionLine(
        roomX,
        Math.min(height - 14, firstCy + radius + (compactMode ? 12 : 16)),
        firstCx,
        Math.min(height - 14, firstCy + radius + (compactMode ? 12 : 16)),
        `Mur ${formatMeters(firstPoint.x)}`,
        "middle",
        0,
        compactMode ? -6 : -8,
        labelFontSize
      )
    );
  } else {
    measurements.push(
      svgDimensionLine(
        Math.min(width - 16, firstCx + radius + (compactMode ? 12 : 16)),
        roomY,
        Math.min(width - 16, firstCx + radius + (compactMode ? 12 : 16)),
        firstCy,
        `Mur ${formatMeters(firstPoint.y)}`,
        "start",
        8 + compactOffset,
        -2,
        labelFontSize
      )
    );
  }

  if (candidate.interFanSpacing) {
    const horizontalSpacing = displayNx > 1 ? displayCellLength : Number.POSITIVE_INFINITY;
    const verticalSpacing = displayNy > 1 ? displayCellHeight : Number.POSITIVE_INFINITY;

    if (horizontalSpacing <= verticalSpacing) {
      const secondCx = roomX + (firstPoint.x + displayCellLength) * scale;
      const lineY = Math.max(roomY + 10, firstCy - radius - (compactMode ? 26 : 34));
      measurements.push(
        svgDimensionLine(
          firstCx,
          lineY,
          secondCx,
          lineY,
          `Entraxe ${formatMeters(displayCellLength)}`,
          "middle",
          0,
          compactMode ? -6 : -8,
          labelFontSize
        )
      );
    } else {
      const secondCy = roomY + (firstPoint.y + displayCellHeight) * scale;
      const lineX = Math.min(width - 12, firstCx + radius + (compactMode ? 24 : 32));
      measurements.push(
        svgDimensionLine(
          lineX,
          firstCy,
          lineX,
          secondCy,
          `Entraxe ${formatMeters(displayCellHeight)}`,
          "start",
          8 + compactOffset,
          -2,
          labelFontSize
        )
      );
    }
  }

  return `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <rect x="${roomX}" y="${roomY}" width="${roomWidth}" height="${roomHeight}" rx="18" fill="#faf5eb" stroke="rgba(29,47,44,0.2)" stroke-width="2.5" />
      ${gridLines.join("")}
      ${fans}
      ${measurements.join("")}
    </svg>
  `;
}

export function svgForVariabilityDesign(design) {
  const { roomAspectRatio, rotateForFit, canvasWidth, canvasHeight } = getPlanCanvasMetrics(design);
  const paddingX = 28;
  const paddingY = 28;
  const displayRoomLength = rotateForFit ? design.room.width : design.room.length;
  const displayRoomHeight = rotateForFit ? design.room.length : design.room.width;
  const scale = Math.min(
    (canvasWidth - paddingX * 2) / displayRoomLength,
    (canvasHeight - paddingY * 2) / displayRoomHeight
  );
  const width = canvasWidth;
  const height = canvasHeight;
  const roomWidth = displayRoomLength * scale;
  const roomHeight = displayRoomHeight * scale;
  const roomX = (canvasWidth - roomWidth) / 2;
  const roomY = (canvasHeight - roomHeight) / 2;
  const compactMode = roomAspectRatio >= 2.4;
  const labelFontSize = compactMode ? 9.2 : 10.5;
  const compactOffset = compactMode ? 2 : 0;
  const displayCellLength = rotateForFit ? design.cellWidth : design.cellLength;
  const displayCellHeight = rotateForFit ? design.cellLength : design.cellWidth;
  const displayNx = rotateForFit ? design.ny : design.nx;
  const displayNy = rotateForFit ? design.nx : design.ny;
  const transformPoint = (point) => (rotateForFit ? { x: point.y, y: point.x } : { x: point.x, y: point.y });
  const transformRect = (rectangle) => {
    const minPoint = transformPoint({ x: rectangle.minX, y: rectangle.minY });
    const maxPoint = transformPoint({ x: rectangle.maxX, y: rectangle.maxY });

    return {
      x: roomX + Math.min(minPoint.x, maxPoint.x) * scale,
      y: roomY + Math.min(minPoint.y, maxPoint.y) * scale,
      width: Math.abs(maxPoint.x - minPoint.x) * scale,
      height: Math.abs(maxPoint.y - minPoint.y) * scale
    };
  };

  const displaySelectedCells = design.selectedCells.map((cell) => ({
    ...cell,
    displayCenter: transformPoint({ x: cell.centerX, y: cell.centerY }),
    displayRect: transformRect(cell)
  }));

  const gridLines = [];
  for (let i = 1; i < displayNx; i += 1) {
    const x = roomX + i * displayCellLength * scale;
    gridLines.push(
      `<line x1="${x}" y1="${roomY}" x2="${x}" y2="${roomY + roomHeight}" stroke="rgba(29,47,44,0.18)" stroke-dasharray="6 5" />`
    );
  }
  for (let j = 1; j < displayNy; j += 1) {
    const y = roomY + j * displayCellHeight * scale;
    gridLines.push(
      `<line x1="${roomX}" y1="${y}" x2="${roomX + roomWidth}" y2="${y}" stroke="rgba(29,47,44,0.18)" stroke-dasharray="6 5" />`
    );
  }

  const zoneShapes = design.targetZones
    .map((zone, index) => {
      const rectangle = transformRect(zone);
      return `
        <g>
          <rect x="${rectangle.x}" y="${rectangle.y}" width="${rectangle.width}" height="${rectangle.height}" rx="10"
            fill="rgba(31,79,130,0.08)" stroke="rgba(31,79,130,0.35)" stroke-width="1.5" />
          <text x="${rectangle.x + 8}" y="${rectangle.y + 14}" font-size="10" fill="#1f4f82" font-weight="700">Z${index + 1}</text>
        </g>
      `;
    })
    .join("");

  const selectedCellShapes = displaySelectedCells
    .map(
      (cell) => `
        <rect x="${cell.displayRect.x}" y="${cell.displayRect.y}" width="${cell.displayRect.width}" height="${cell.displayRect.height}" rx="8"
          fill="rgba(31,79,130,0.10)" stroke="rgba(31,79,130,0.38)" stroke-width="1.4" />
      `
    )
    .join("");

  const fans = displaySelectedCells
    .map((cell, index) => {
      const cx = roomX + cell.displayCenter.x * scale;
      const cy = roomY + cell.displayCenter.y * scale;
      const r = (design.diameter / 2) * scale;
      return svgFanSymbol(cx, cy, r, index);
    })
    .join("");

  const measurements = [];
  const firstCell = displaySelectedCells[0];
  if (firstCell) {
    const firstCx = roomX + firstCell.displayCenter.x * scale;
    const firstCy = roomY + firstCell.displayCenter.y * scale;
    const radius = (design.diameter / 2) * scale;
    measurements.push(
      svgDimensionLine(
        firstCx - radius,
        firstCy - radius - (compactMode ? 8 : 12),
        firstCx + radius,
        firstCy - radius - (compactMode ? 8 : 12),
        `D ${formatMeters(design.diameter)}`,
        "middle",
        0,
        compactMode ? -6 : -8,
        labelFontSize
      )
    );
  }

  if (design.minimumWallCellKey) {
    const wallCell = displaySelectedCells.find((cell) => cell.key === design.minimumWallCellKey);
    if (wallCell) {
      const cx = roomX + wallCell.displayCenter.x * scale;
      const cy = roomY + wallCell.displayCenter.y * scale;
      const distances = [
        { axis: "x", boundary: roomX, value: wallCell.displayCenter.x },
        { axis: "x", boundary: roomX + roomWidth, value: displayRoomLength - wallCell.displayCenter.x },
        { axis: "y", boundary: roomY, value: wallCell.displayCenter.y },
        { axis: "y", boundary: roomY + roomHeight, value: displayRoomHeight - wallCell.displayCenter.y }
      ].sort((a, b) => a.value - b.value);
      const nearest = distances[0];

      if (nearest.axis === "x") {
        measurements.push(
          svgDimensionLine(
            nearest.boundary,
            Math.min(height - 14, cy + (compactMode ? 20 : 24)),
            cx,
            Math.min(height - 14, cy + (compactMode ? 20 : 24)),
            `Mur ${formatMeters(design.wallClearance)}`,
            "middle",
            0,
            compactMode ? -6 : -8,
            labelFontSize
          )
        );
      } else {
        measurements.push(
          svgDimensionLine(
            Math.min(width - 12, cx + (compactMode ? 20 : 24)),
            nearest.boundary,
            Math.min(width - 12, cx + (compactMode ? 20 : 24)),
            cy,
            `Mur ${formatMeters(design.wallClearance)}`,
            "start",
            8 + compactOffset,
            -2,
            labelFontSize
          )
        );
      }
    }
  }

  if (design.minimumSpacingPair) {
    const firstSpacingCell = displaySelectedCells.find((cell) => cell.key === design.minimumSpacingPair[0]);
    const secondSpacingCell = displaySelectedCells.find((cell) => cell.key === design.minimumSpacingPair[1]);
    if (firstSpacingCell && secondSpacingCell) {
      measurements.push(
        svgDimensionLine(
          roomX + firstSpacingCell.displayCenter.x * scale,
          roomY + firstSpacingCell.displayCenter.y * scale,
          roomX + secondSpacingCell.displayCenter.x * scale,
          roomY + secondSpacingCell.displayCenter.y * scale,
          `Entraxe ${formatMeters(design.interFanSpacing)}`,
          "middle",
          0,
          compactMode ? -10 : -12,
          labelFontSize
        )
      );
    }
  }

  return `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <rect x="${roomX}" y="${roomY}" width="${roomWidth}" height="${roomHeight}" rx="18" fill="#faf5eb" stroke="rgba(29,47,44,0.2)" stroke-width="2.5" />
      ${gridLines.join("")}
      ${zoneShapes}
      ${selectedCellShapes}
      ${fans}
      ${measurements.join("")}
    </svg>
  `;
}
