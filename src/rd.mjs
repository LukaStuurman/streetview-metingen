/**
 * Lightweight approximate WGS84 geographic -> Dutch RD New (EPSG:28992).
 *
 * Dutch inverse polynomial approximation (Schreutelkamp/Strang van Hees).
 * This is deliberately NOT the official grid-based RDNAPTRANS transformation.
 * Suitable for indicative display only, not a survey / cable positioning.
 *
 * Input is geographic latitude / longitude in decimal degrees.
 * Output X=easting, Y=northing in metres (RD New).
 */
const RD_ORIGIN = Object.freeze({
  lat: 52.15517440, lng: 5.38720621, x: 155000, y: 463000
});

const X_COEFFICIENTS = Object.freeze([
  [0,1,190094.945], [1,1,-11832.228], [2,1,-114.221],
  [0,3,-32.391], [1,0,-0.705], [3,1,-2.340],
  [1,3,-0.608], [0,2,-0.008], [2,3,0.148]
]);

const Y_COEFFICIENTS = Object.freeze([
  [1,0,309056.544], [0,2,3638.893], [2,0,73.077],
  [1,2,-157.984], [3,0,59.788], [0,1,0.433],
  [2,2,-6.439], [1,1,-0.032], [4,0,0.092],
  [1,4,-0.054]
]);

export function wgs84ToRD(lat, lng) {
  if (![lat,lng].every(Number.isFinite) ||
      lat < 50.7 || lat > 53.8 || lng < 3 || lng > 7.5) return null;
  const dLat = 0.36 * (lat - RD_ORIGIN.lat);
  const dLng = 0.36 * (lng - RD_ORIGIN.lng);
  const polynomial = coeffs => coeffs.reduce((sum,[p,q,v]) =>
    sum + v * dLat ** p * dLng ** q, 0);
  const x = RD_ORIGIN.x + polynomial(X_COEFFICIENTS);
  const y = RD_ORIGIN.y + polynomial(Y_COEFFICIENTS);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

/**
 * For one reconstructed panorama point.
 * east/north are local metre offsets from the current camera location.
 * A separate RD conversion is performed from the approximate geographic
 * location: local and RD coordinates are not interchangeable.
 */
export function pointCoordinates(point, location, offsetLocationFn) {
  if (!point || !location || typeof offsetLocationFn !== "function" ||
      ![point.e,point.n].every(Number.isFinite)) return null;
  const geo = offsetLocationFn(location,point.e,point.n);
  if (!geo) return null;
  return {
    lat: geo.lat,
    lng: geo.lng,
    localX: point.e,
    localY: point.n,
    rd: wgs84ToRD(geo.lat,geo.lng)
  };
}
