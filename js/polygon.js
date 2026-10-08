// Convex polygons, as arrays of [x, y] points, cut by straight lines. The
// ruins are built from nothing else: Voronoi cells are a square cut by the
// bisectors to nearby sites, and city blocks are cut from those.

// The part of a polygon where a * x + b * y <= c.
export function clip(polygon, a, b, c) {
  const out = [];
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i];
    const q = polygon[(i + 1) % polygon.length];
    const fp = a * p[0] + b * p[1] - c;
    const fq = a * q[0] + b * q[1] - c;
    if (fp <= 0) out.push(p);
    if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) {
      const t = fp / (fp - fq);
      out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
    }
  }
  return out;
}

// Signed area: positive when the points run counter-clockwise (with y up).
export function area(polygon) {
  let sum = 0;
  for (let i = 0; i < polygon.length; i++) {
    const [x0, y0] = polygon[i];
    const [x1, y1] = polygon[(i + 1) % polygon.length];
    sum += x0 * y1 - x1 * y0;
  }
  return sum / 2;
}

// The average of the corners, which lies inside a convex polygon.
export function middleOf(polygon) {
  let x = 0;
  let y = 0;
  for (const p of polygon) {
    x += p[0];
    y += p[1];
  }
  return [x / polygon.length, y / polygon.length];
}

// The part of a polygon nearer to point a than to point b ({ x, y } each).
export function bisect(polygon, a, b) {
  return clip(polygon, 2 * (b.x - a.x), 2 * (b.y - a.y), b.x * b.x + b.y * b.y - a.x * a.x - a.y * a.y);
}

// Cuts `polygon` by the line through p and q, `offset` inside `convex`, whose edge it is.
function clipInside(polygon, convex, p, q, offset) {
  const sign = area(convex) > 0 ? 1 : -1;
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  const length = Math.hypot(dx, dy);
  if (length < 1e-9) return polygon;
  // The inward normal: the interior is on the left of counter-clockwise edges.
  const nx = (sign * -dy) / length;
  const ny = (sign * dx) / length;
  return clip(polygon, -nx, -ny, -(nx * p[0] + ny * p[1]) - offset);
}

// A convex polygon shrunk by `distance` on every side, or [] if nothing is left.
export function inset(polygon, distance) {
  let out = polygon;
  for (let i = 0; i < polygon.length && out.length >= 3; i++) {
    out = clipInside(out, polygon, polygon[i], polygon[(i + 1) % polygon.length], distance);
  }
  return out.length >= 3 ? out : [];
}

// Whether every point lies inside (or on the edge of) a convex polygon.
export function containsAll(convex, points) {
  const sign = area(convex) > 0 ? 1 : -1;
  for (let i = 0; i < convex.length; i++) {
    const [px, py] = convex[i];
    const [qx, qy] = convex[(i + 1) % convex.length];
    for (const [x, y] of points) {
      if (sign * ((qx - px) * (y - py) - (qy - py) * (x - px)) < 0) return false;
    }
  }
  return true;
}

// The overlap of any polygon with a convex one, or [] if they don't overlap.
export function intersect(polygon, convex) {
  let out = polygon;
  for (let i = 0; i < convex.length && out.length >= 3; i++) {
    out = clipInside(out, convex, convex[i], convex[(i + 1) % convex.length], 0);
  }
  return out.length >= 3 ? out : [];
}
