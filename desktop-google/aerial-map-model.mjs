import { pointCoordinates, wgs84ToRD } from "../src/rd.mjs";
import { offsetLocation } from "../src/ahn.mjs";

export const AERIAL_WMS = "https://service.pdok.nl/hwh/luchtfotorgb/wms/v1_0";
export const AERIAL_LAYER = "Actueel_orthoHR";
export const MAP_COLORS = ["#f28c28", "#d83c36", "#ffb451", "#ed695c"];

/** Same RD conversion as the point cards/CSV; never mistake local metres for RD. */
export function mapSnapshot({ lines = [], origin, heading, triangulation,
  coordinates = (point,location) => pointCoordinates(point,location,offsetLocation) }) {
  const camera = origin && wgs84ToRD(origin.lat, origin.lng);
  const mapped = lines.map((vertices, line) => ({
    id: `L${line + 1}`, color: MAP_COLORS[line % MAP_COLORS.length],
    points: vertices.flatMap((vertex, index) => {
      const coords = coordinates(vertex.point, origin);
      return coords?.rd ? [{ id: `P${line + 1}.${index + 1}`, ...coords.rd,
        lat: coords.lat, lng: coords.lng,
        correction:coords.correction || null,
        rawX:coords.rawRD?.x ?? coords.rd.x,rawY:coords.rawRD?.y ?? coords.rd.y,
        z: Number.isFinite(vertex.point.z) ? vertex.point.z : null }] : [];
    })
  })).filter(line => line.points.length);
  const target = triangulation?.status === "ok" ? triangulation.point : null;
  return {
    camera: camera ? { ...camera, heading: Number.isFinite(heading) ? heading : 0 } : null,
    lines: mapped,
    target: target?.rd ? { id: "T1", ...target.rd, lat: target.lat, lng: target.lng,
      z: Number.isFinite(target.z) ? target.z : null } : null
  };
}

export function mapBounds(view, width, height) {
  const halfW = width * view.scale / 2, halfH = height * view.scale / 2;
  return { minX: view.x - halfW, minY: view.y - halfH,
    maxX: view.x + halfW, maxY: view.y + halfH };
}

export function rdToPixel(point, view, width, height) {
  return { x: width / 2 + (point.x - view.x) / view.scale,
    y: height / 2 - (point.y - view.y) / view.scale };
}

export function pixelToRD(pixel, view, width, height) {
  return { x: view.x + (pixel.x - width / 2) * view.scale,
    y: view.y - (pixel.y - height / 2) * view.scale };
}

export function fitMap(points, width, height, padding = 85) {
  const valid = points.filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y));
  if (!valid.length) return null;
  const xs = valid.map(p => p.x), ys = valid.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2,
    scale: Math.max(0.08, Math.min(1000, Math.max(
      Math.max(40, maxX - minX) / Math.max(1, width - padding * 2),
      Math.max(40, maxY - minY) / Math.max(1, height - padding * 2)))) };
}

/** WMS 1.3.0 RD uses easting/northing; the image's top edge is north. */
export function aerialImageUrl(bounds, width, height) {
  if (![bounds?.minX, bounds?.minY, bounds?.maxX, bounds?.maxY, width, height]
    .every(Number.isFinite) || bounds.minX >= bounds.maxX || bounds.minY >= bounds.maxY ||
    width < 1 || height < 1) throw new RangeError("Ongeldig kaartgebied");
  const params = new URLSearchParams({ SERVICE: "WMS", VERSION: "1.3.0",
    REQUEST: "GetMap", LAYERS: AERIAL_LAYER, STYLES: "", CRS: "EPSG:28992",
    BBOX: [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY].join(","),
    WIDTH: String(Math.min(2048, Math.round(width))),
    HEIGHT: String(Math.min(2048, Math.round(height))), FORMAT: "image/jpeg" });
  return `${AERIAL_WMS}?${params}`;
}
