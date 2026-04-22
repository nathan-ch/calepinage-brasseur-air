import { EPS } from "./constants.js";

export const CEILING_TILE_SIZE = 0.6;
export const CEILING_ANCHOR_MODES = ["min_side", "max_side", "symmetric"];

function ceilingGridRound(value) {
  return Number(value.toFixed(6));
}

function buildCeilingAxisTiles(length, tileSize, anchorMode, axisName) {
  const safeLength = Math.max(0, length);
  const fullTileCount = Math.floor((safeLength + EPS) / tileSize);
  const rawRemainder = safeLength - fullTileCount * tileSize;
  const remainder = rawRemainder > EPS ? rawRemainder : 0;
  const tiles = [];
  let cursor = 0;

  const pushTile = (min, max, kind) => {
    if (max - min <= EPS) {
      return;
    }

    tiles.push({
      axis: axisName,
      index: tiles.length,
      key: `${axisName}-${tiles.length}`,
      min: ceilingGridRound(min),
      max: ceilingGridRound(max),
      size: ceilingGridRound(max - min),
      center: ceilingGridRound((min + max) / 2),
      isCut: kind === "cut"
    });
  };

  if (remainder === 0 || anchorMode === "min_side") {
    for (let index = 0; index < fullTileCount; index += 1) {
      pushTile(cursor, cursor + tileSize, "full");
      cursor += tileSize;
    }
    if (remainder > 0) {
      pushTile(cursor, safeLength, "cut");
    }
  } else if (anchorMode === "max_side") {
    pushTile(0, remainder, "cut");
    cursor = remainder;
    for (let index = 0; index < fullTileCount; index += 1) {
      pushTile(cursor, cursor + tileSize, "full");
      cursor += tileSize;
    }
  } else {
    const sideCut = remainder / 2;
    pushTile(0, sideCut, "cut");
    cursor = sideCut;
    for (let index = 0; index < fullTileCount; index += 1) {
      pushTile(cursor, cursor + tileSize, "full");
      cursor += tileSize;
    }
    pushTile(cursor, safeLength, "cut");
  }

  const boundaries = [...new Set([0, ...tiles.flatMap((tile) => [tile.min, tile.max]), safeLength])].sort(
    (a, b) => a - b
  );

  return {
    axis: axisName,
    length: safeLength,
    tileSize,
    anchorMode,
    tiles,
    boundaries,
    centers: tiles.map((tile) => ({
      index: tile.index,
      key: tile.key,
      center: tile.center,
      min: tile.min,
      max: tile.max,
      isCut: tile.isCut
    })),
    fullTilesCount: tiles.filter((tile) => !tile.isCut).length,
    cutTilesCount: tiles.filter((tile) => tile.isCut).length
  };
}

export function buildCeilingGrid(room, ceilingLayout) {
  if (!room || !(room.length > 0) || !(room.width > 0)) {
    return null;
  }

  const tileSize = ceilingLayout?.tileSize || CEILING_TILE_SIZE;
  const xAxis = buildCeilingAxisTiles(
    room.length,
    tileSize,
    ceilingLayout?.xAnchorMode || "symmetric",
    "x"
  );
  const yAxis = buildCeilingAxisTiles(
    room.width,
    tileSize,
    ceilingLayout?.yAnchorMode || "symmetric",
    "y"
  );
  const luminaireTiles =
    ceilingLayout?.luminaireTiles instanceof Set ? ceilingLayout.luminaireTiles : new Set();
  const tiles = [];
  const tileMap = new Map();

  xAxis.tiles.forEach((xTile) => {
    yAxis.tiles.forEach((yTile) => {
      const key = `${xTile.index}:${yTile.index}`;
      const tile = {
        key,
        xIndex: xTile.index,
        yIndex: yTile.index,
        minX: xTile.min,
        maxX: xTile.max,
        minY: yTile.min,
        maxY: yTile.max,
        width: xTile.size,
        height: yTile.size,
        centerX: xTile.center,
        centerY: yTile.center,
        isCut: xTile.isCut || yTile.isCut,
        hasLuminaire: luminaireTiles.has(key)
      };

      tiles.push(tile);
      tileMap.set(key, tile);
    });
  });

  return {
    room,
    tileSize,
    xAnchorMode: xAxis.anchorMode,
    yAnchorMode: yAxis.anchorMode,
    xAxis,
    yAxis,
    tiles,
    tileMap,
    luminaireTiles,
    luminairesCount: tiles.filter((tile) => tile.hasLuminaire).length,
    fullTilesCount: tiles.filter((tile) => !tile.isCut).length,
    cutTilesCount: tiles.filter((tile) => tile.isCut).length
  };
}
