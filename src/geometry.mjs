/**
 * Perspective camera model for points on a locally FLAT ground plane.
 * Street View supplies heading, pitch and zoom but NO per-pixel depth.
 * All values are estimates; not suitable for survey/cadastral measurements.
 */
export const MAX_GROUND_DISTANCE_M = 150;
const DEG = Math.PI / 180;

export function horizontalFov(zoom) {
  if (!Number.isFinite(zoom) || zoom <= 0.5) return null;
  return 180 / Math.pow(2, zoom);
}

export function focalPixels(width, zoom) {
  const fov = horizontalFov(zoom);
  if (!fov || !Number.isFinite(width) || width <= 0) return null;
  return width / (2 * Math.tan((fov * DEG) / 2));
}

function basis(heading, pitch) {
  const h = heading * DEG;
  const p = pitch * DEG;
  const sh = Math.sin(h), ch = Math.cos(h);
  const sp = Math.sin(p), cp = Math.cos(p);
  // World axes: east, north, up. Image axes: right, up, forward.
  return {
    forward: { e: sh * cp, n: ch * cp, u: sp },
    right: { e: ch, n: -sh, u: 0 },
    up: { e: -sh * sp, n: -ch * sp, u: cp }
  };
}

function dot(a, b) {
  return a.e * b.e + a.n * b.n + a.u * b.u;
}

/** Convert a click (CSS pixels, relative to panorama) to a WORLD ray. */
export function rayFromPixel(x, y, view) {
  const { width, height, heading, pitch, zoom } = view;
  const f = focalPixels(width, zoom);
  if (!f || !Number.isFinite(height) || height <= 0) return null;
  const { forward, right, up } = basis(heading, pitch);
  const sx = (x - width / 2) / f;
  const sy = (height / 2 - y) / f;
  const d = {
    e: forward.e + sx * right.e + sy * up.e,
    n: forward.n + sx * right.n + sy * up.n,
    u: forward.u + sx * right.u + sy * up.u
  };
  return Object.values(d).every(Number.isFinite) ? d : null;
}

/** Intersect a camera ray with ground z=0, given camera z=height. */
export function groundFromRay(ray, cameraHeight, maxDistance = MAX_GROUND_DISTANCE_M) {
  if (!ray || !(cameraHeight > 0) || !Number.isFinite(cameraHeight)) return null;
  if (!(ray.u < -1e-5)) return null; // Horizon/sky does not hit the ground.
  const t = -cameraHeight / ray.u;
  const point = { e: t * ray.e, n: t * ray.n };
  const distance = Math.hypot(point.e, point.n);
  if (!Number.isFinite(distance) || distance > maxDistance) return null;
  return point;
}

/** Reproject a local point (east, north, elevation) given camera NAP elevation. */
export function pixelFromWorld(point, cameraZ, view) {
  const { width, height, heading, pitch, zoom } = view;
  const f = focalPixels(width, zoom);
  if (!f || !Number.isFinite(cameraZ) || !point || !Number.isFinite(point.z)) return null;
  const b = basis(heading, pitch);
  const delta = { e: point.e, n: point.n, u: point.z - cameraZ };
  const depth = dot(delta, b.forward);
  if (!(depth > 1e-5)) return null; // Behind the camera.
  const x = width / 2 + (f * dot(delta, b.right)) / depth;
  const y = height / 2 - (f * dot(delta, b.up)) / depth;
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

/** Backwards-compatible flat-ground projection. */
export function pixelFromGround(point, cameraHeight, view) {
  return point && pixelFromWorld({ ...point, z: 0 }, cameraHeight, view);
}

export function segmentDistance(a, b) {
  return Math.hypot(a.e - b.e, a.n - b.n);
}

/** Null for invalid line vertices; no silently truncated distances. */
export function lineLength(rays, cameraHeight) {
  const points = rays.map(ray => groundFromRay(ray, cameraHeight));
  if (points.some(p => p === null)) return null;
  return points.slice(1).reduce((sum, p, i) => sum + segmentDistance(points[i], p), 0);
}
