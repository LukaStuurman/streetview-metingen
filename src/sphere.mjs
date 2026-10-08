/**
 * Panoramax uses Photo Sphere Viewer under the hood.
 * Use PSV spherical conversions instead of guessing its camera field-of-view.
 * Panoramax getXY().x is geographic north-clockwise heading; PSV yaw is radians.
 */
const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

export function wrapRadians(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
export function wrapDegrees(angle) {
  return ((angle % 360) + 360) % 360;
}
export function rayFromBearing(headingDeg, pitchDeg) {
  if (![headingDeg,pitchDeg].every(Number.isFinite)) return null;
  const h = headingDeg * RAD, p = pitchDeg * RAD;
  return { e: Math.sin(h) * Math.cos(p), n: Math.cos(h) * Math.cos(p), u: Math.sin(p) };
}
export function bearingFromRay(ray) {
  if (!ray || ![ray.e,ray.n,ray.u].every(Number.isFinite)) return null;
  const horizontal = Math.hypot(ray.e, ray.n);
  if (horizontal < 1e-8 && Math.abs(ray.u) < 1e-8) return null;
  return {
    heading: wrapDegrees(Math.atan2(ray.e, ray.n) * DEG),
    pitch: Math.atan2(ray.u, horizontal) * DEG
  };
}
export function panToRay({ centerYaw, centerHeading, selectedYaw, selectedPitch }) {
  const delta = wrapRadians(selectedYaw - centerYaw) * DEG;
  return rayFromBearing(centerHeading + delta, selectedPitch * DEG);
}
export function rayToPan(ray, centerYaw, centerHeading) {
  const angles = bearingFromRay(ray);
  if (!angles) return null;
  const delta = wrapRadians((angles.heading - centerHeading) * RAD);
  return { yaw: centerYaw + delta, pitch: angles.pitch * RAD };
}
export function cameraToPointRay(point, cameraZ) {
  if (!point || !Number.isFinite(cameraZ)) return null;
  const delta = { e: point.e, n: point.n, u: point.z - cameraZ };
  const distance = Math.hypot(delta.e, delta.n, delta.u);
  if (distance < 1e-8) return null;
  return { e: delta.e / distance, n: delta.n / distance, u: delta.u / distance };
}
