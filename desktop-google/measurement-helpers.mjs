/** Validate a Google-generated Share -> Embed HTML snippet; never fetch private tiles. */
export function parseEmbedHtml(text) {
  if(typeof text!=="string"||!text.trim())throw new Error("Plak een door Google gegenereerde insluitlink.");
  const snippet=text.trim();
  const match=snippet.match(/<iframe\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/i);
  const raw=(match?match[1]:snippet).replaceAll("&amp;","&");
  let url;
  try{url=new URL(raw);}catch{throw new Error("Ongeldige Google Maps-insluitlink.");}
  if(url.protocol!=="https:"||!["www.google.com","www.google.nl"].includes(url.hostname)||
      url.pathname!=="/maps/embed"||!url.searchParams.get("pb")) {
    throw new Error("Alleen officiële Google Maps → Delen → Insluiten-links zijn toegestaan.");
  }
  // Google may alter the private pb format. Coordinates and heading are
  // best-effort hints, never proof of the embedded iframe's live camera state.
  const pb=url.searchParams.get("pb");
  const loc=pb.match(/!2m2!1d(-?\d+(?:\.\d+)?)!2d(-?\d+(?:\.\d+)?)/);
  const heading=pb.match(/!3f(-?\d+(?:\.\d+)?)/);
  const lat=loc?Number(loc[1]):NaN,lng=loc?Number(loc[2]):NaN;
  const result={url:url.toString(),location:null,heading:null};
  if(Number.isFinite(lat)&&Math.abs(lat)<=90&&Number.isFinite(lng)&&Math.abs(lng)<=180) {
    result.location={lat,lng};
  }
  if(heading&&Number.isFinite(Number(heading[1]))&&Number(heading[1])>=0&&Number(heading[1])<=360)
    result.heading=Number(heading[1]);
  return result;
}

/** Perspective estimate; calibration does not read the cross-origin Google iframe. */
export function viewFromFields({width,height,heading,pitch,fov}) {
  if(![width,height,heading,pitch,fov].every(Number.isFinite)||
    !(width>0&&height>0&&fov>=15&&fov<=120&&Math.abs(pitch)<=85))return null;
  return {width,height,heading,pitch,zoom:Math.log2(180/fov)};
}

/**
 * Parse ONLY the address-bar URL of the ordinary Google Maps webpage.
 *
 * Typical example:
 * /maps/@51.4416,5.4697,3a,75y,123.5h,100t/data=...
 * - y = approximate horizontal FOV
 * - h = compass heading clockwise from north
 * - t = tilt measured downward from vertical, with 90 = horizon
 *
 * These are UNDOCUMENTED website URL hints and are not the supported
 * Street View camera API. URL may lag behind actual mouse movements.
 */
export function parseGoogleMapsViewUrl(urlText) {
  let url;
  try { url = new URL(urlText); } catch { return null; }
  if (url.protocol !== "https:" ||
      !["www.google.com", "www.google.nl", "google.com", "google.nl"].includes(url.hostname) ||
      !/^\/maps(?:\/|$)/.test(url.pathname)) return null;

  // The tokens must come directly after 3a (not in an embedded image URL).
  const match = url.pathname.match(
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),3a(?:,([^/]+))?/
  );
  if (!match) return null;
  const lat = Number(match[1]), lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) ||
      Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  const tokens = (match[3] || "").split(",");
  let heading = null, pitch = null, fov = null;
  for (const token of tokens) {
    const m = token.match(/^(-?\d+(?:\.\d+)?)([yht])$/);
    if (!m) continue;
    const value = Number(m[1]);
    if (!Number.isFinite(value)) continue;
    if (m[2] === "y" && value >= 15 && value <= 120) fov = value;
    if (m[2] === "h" && value >= 0 && value <= 360) heading = value;
    if (m[2] === "t" && value >= 5 && value <= 175)
      pitch = 90 - value;  // positive up, negative down (our camera convention)
  }
  return {lat, lng, heading, pitch, fov};
}

/** Track changes to actual encoded camera pose, not unrelated query strings. */
export function cameraPoseChanged(previous, next, epsilon = 0.00001) {
  if (!previous || !next) return true;
  const fields = ["lat", "lng", "heading", "pitch", "fov"];
  return fields.some(field => {
    if (next[field] == null && previous[field] == null) return false;
    if (next[field] == null || previous[field] == null) return true;
    return Math.abs(next[field] - previous[field]) > epsilon;
  });
}
