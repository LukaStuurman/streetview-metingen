/**
 * Dutch AHN DTM (maaiveld) point-height queries using PDOK WMS GetFeatureInfo.
 * AHN measures terrain elevation (metres NAP); it is NOT per-pixel Street View depth.
 * WMS and browser CORS availability depend on PDOK and network settings.
 */
export const AHN_WMS = "https://service.pdok.nl/rws/ahn/wms/v1_0";
export const AHN_LAYER = "dtm_05m";
export const AHN_SURFACE_LAYER = "dsm_05m";
export const AHN_LAYERS = Object.freeze([AHN_LAYER, AHN_SURFACE_LAYER]);
const EARTH_RADIUS = 6378137;
const RAD = Math.PI / 180;

export function offsetLocation(location, east, north) {
  if (![location?.lat, location?.lng, east, north].every(Number.isFinite)) return null;
  const lat = location.lat + north / (111132.92 - 559.82 * Math.cos(2 * location.lat * RAD));
  const cosLat = Math.cos(location.lat * RAD);
  if (Math.abs(cosLat) < 1e-7) return null;
  const lng = location.lng + east / (111412.84 * cosLat - 93.5 * Math.cos(3 * location.lat * RAD));
  return { lat, lng };
}

export function mercatorMeters(lat, lng) {
  if (![lat, lng].every(Number.isFinite) || Math.abs(lat) >= 85 || Math.abs(lng) > 180) return null;
  return {
    x: EARTH_RADIUS * lng * RAD,
    y: EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + lat * RAD / 2))
  };
}

/** Query a ~1m square surrounding one pixel, in CRS EPSG:3857 (no axis-order trap). */
export function buildAHNUrl(lat, lng, layer = AHN_LAYER) {
  if (!AHN_LAYERS.includes(layer)) throw new RangeError("Ongeldige AHN-laag");
  const p = mercatorMeters(lat, lng);
  if (!p) return null;
  const qs = new URLSearchParams({
    SERVICE: "WMS", VERSION: "1.3.0", REQUEST: "GetFeatureInfo",
    LAYERS: layer, QUERY_LAYERS: layer,
    STYLES: "", FORMAT: "image/png", INFO_FORMAT: "application/json",
    CRS: "EPSG:3857", WIDTH: "3", HEIGHT: "3", I: "1", J: "1",
    BBOX: [p.x - 1, p.y - 1, p.x + 1, p.y + 1].join(",")
  });
  return AHN_WMS + "?" + qs.toString();
}

export function parseAHNElevation(json) {
  const props = json?.features?.[0]?.properties;
  // Current PDOK AHN WMS supplies 'value_list' as a numeric string.
  // Older GeoServer AHN instances supplied 'GRAY_INDEX'.
  const value = props?.value_list ?? props?.GRAY_INDEX;
  if (value === undefined || value === null || value === "") return null;
  const z = Number(value);
  // Reject common raster no-data sentinels, infinity and corrupt responses.
  return Number.isFinite(z) && z > -1000 && z < 1000 ? z : null;
}

export class AHNClient {
  constructor(fetchFn = (...args) => globalThis.fetch(...args)) {
    // The browser's Window.fetch may reject method calls with a foreign
    // receiver (e.g. this.fetchFn(...)) as an "Illegal invocation".
    // Call through globalThis so Window remains the receiver.
    this.fetchFn = fetchFn;
    this.cache = new Map();
  }
  clear() { this.cache.clear(); }
  async height(lat, lng, signal, layer = AHN_LAYER) {
    if (signal?.aborted) throw new DOMException("AHN-opvraag afgebroken", "AbortError");
    if (!AHN_LAYERS.includes(layer)) throw new RangeError("Ongeldige AHN-laag");
    const key = layer + "/" + lat.toFixed(6) + "/" + lng.toFixed(6);
    if (this.cache.has(key)) return this.cache.get(key);
    const url = buildAHNUrl(lat, lng, layer);
    if (!url) return null;
    const response = await this.fetchFn(url, { signal, mode: "cors" });
    if (!response.ok) throw new Error("AHN HTTP " + response.status);
    const json = await response.json();
    const z = parseAHNElevation(json);
    if (this.cache.size > 1500) this.cache.clear();
    this.cache.set(key, z); // Cache NoData too; never invent a height.
    return z;
  }
}

/**
 * Trace a world ray through a sampled AHN terrain profile.
 * cameraBaseZ = DTM elevation at the panorama camera ground.
 * cameraHeight = assumed camera height above THAT ground.
 * Returns a point {e,n,z} in local metres / NAP, or a failure code.
 * Sampling is adaptive, and deliberately not claimed to catch every small obstacle.
 */
export async function terrainRayIntersection({
  ray, origin, cameraBaseZ, cameraHeight, sampleHeight, signal,
  maxDistance = 500
}) {
  if (!ray || !origin || !Number.isFinite(cameraBaseZ) ||
      !(cameraHeight > 0) || typeof sampleHeight !== "function") {
    return { status: "invalid" };
  }
  const horizontal = Math.hypot(ray.e, ray.n);
  if (!(horizontal > 1e-7) || !Number.isFinite(ray.u)) {
    return { status: "invalid" };
  }
  const eastUnit = ray.e / horizontal;
  const northUnit = ray.n / horizontal;
  const raySlope = ray.u / horizontal;
  const cameraZ = cameraBaseZ + cameraHeight;
  let previous = { distance: 0, delta: cameraHeight };
  const stops = [2, 4, 6, 8, 10, 15, 20, 30, 40, 55, 70, 90, 115, 150,
    200, 250, 300, 375, 450, 500]
    .filter(d => d <= maxDistance);
  if (stops[stops.length - 1] !== maxDistance) stops.push(maxDistance);
  async function sampleAt(distance) {
    if (signal?.aborted) return { status: "aborted" };
    const e = eastUnit * distance;
    const n = northUnit * distance;
    const coords = offsetLocation(origin, e, n);
    if (!coords) return { status: "invalid" };
    const z = await sampleHeight(coords.lat, coords.lng, signal);
    if (z === null || !Number.isFinite(z)) return { status: "no-data" };
    return {
      status: "ok", distance, e, n, z,
      delta: cameraZ + raySlope * distance - z
    };
  }

  for (const distance of stops) {
    const next = await sampleAt(distance);
    if (next.status !== "ok") return { status: next.status };
    if (next.delta <= 0) {
      let left = previous, right = next;
      // Tighten the ray/terrain intersection to roughly 0.5m along the ground.
      for (let i = 0; i < 8 && right.distance - left.distance > 0.5; i++) {
        const mid = await sampleAt((left.distance + right.distance) / 2);
        if (mid.status !== "ok") return { status: mid.status };
        if (mid.delta > 0) left = mid;
        else right = mid;
      }
      // Interpolate along the bracket so the 3D point remains exactly on the
      // original Street View ray. z is the interpolated AHN-derived height.
      const den = left.delta - right.delta;
      const fraction = den > 0 ? Math.min(1, Math.max(0, left.delta / den)) : 0.5;
      const r = left.distance + fraction * (right.distance - left.distance);
      return {
        status: "ok",
        point: { e: eastUnit * r, n: northUnit * r, z: cameraZ + raySlope * r },
        distance: r
      };
    }
    previous = next;
  }
  return { status: "out-of-range" };
}

export function horizontalDistance(a, b) {
  return Math.hypot(b.e - a.e, b.n - a.n);
}
export function spatialDistance(a, b) {
  return Math.hypot(b.e - a.e, b.n - a.n, b.z - a.z);
}
