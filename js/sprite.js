// Pictures that do not change from frame to frame, drawn once into their own small canvas and
// then just copied each frame: clips and gradients are expensive in a TV's browser. One canvas
// per picture, redrawn when its size or the pixel ratio changes, so dragging the window does not
// pile up old sizes.

const cache = new Map();

// Paints `draw(g)` into a canvas `w` × `h` CSS pixels (scaled for the pixel ratio) the first time,
// then copies it to `x`, `y`. Snapped to device pixels and copied at its own size, so it stays as
// sharp as if drawn directly.
export function drawSprite(ctx, key, x, y, w, h, draw) {
  if (!(w > 0 && h > 0)) return;
  const dpr = devicePixelRatio || 1;
  const size = `${w}|${h}|${dpr}`;
  let entry = cache.get(key);
  if (entry?.size !== size) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(w * dpr);
    canvas.height = Math.ceil(h * dpr);
    const g = canvas.getContext('2d');
    g.scale(dpr, dpr);
    draw(g);
    entry = { size, canvas };
    cache.set(key, entry);
  }
  const snap = v => Math.round(v * dpr) / dpr;
  ctx.drawImage(entry.canvas, snap(x), snap(y), entry.canvas.width / dpr, entry.canvas.height / dpr);
}

// A soft round blob of colour 'r, g, b', opaque in the middle and gone at the edge: drawn scaled
// with globalAlpha in place of a fresh radial gradient for every puff of every frame.
const blobs = new Map();

export function softBlob(rgb) {
  let blob = blobs.get(rgb);
  if (!blob) {
    blob = document.createElement('canvas');
    blob.width = blob.height = 64;
    const g = blob.getContext('2d');
    const fill = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    fill.addColorStop(0, `rgba(${rgb}, 1)`);
    fill.addColorStop(0.5, `rgba(${rgb}, 0.6)`);
    fill.addColorStop(1, `rgba(${rgb}, 0)`);
    g.fillStyle = fill;
    g.fillRect(0, 0, 64, 64);
    blobs.set(rgb, blob);
  }
  return blob;
}
