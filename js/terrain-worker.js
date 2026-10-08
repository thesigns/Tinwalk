// Renders terrain tiles off the page's thread, so the map keeps panning
// smoothly while they are drawn. See TerrainTiles in terrain-tiles.js.
//
// Messages in: { type: 'world', settings } and { type: 'render', key,
// generation, level, tx, ty, ratio }. Out: { key, generation, bitmap }.

import { renderTile, setTerrainWorld, TILE_SIZE } from './terrain-render.js';

self.onmessage = ({ data }) => {
  if (data.type === 'world') {
    setTerrainWorld(data.settings);
    return;
  }
  const { key, generation, level, tx, ty, ratio } = data;
  const pixels = Math.round(TILE_SIZE * ratio);
  const canvas = new OffscreenCanvas(pixels, pixels);
  renderTile(canvas.getContext('2d'), level, tx, ty, ratio);
  const bitmap = canvas.transferToImageBitmap();
  self.postMessage({ key, generation, bitmap }, [bitmap]);
};
