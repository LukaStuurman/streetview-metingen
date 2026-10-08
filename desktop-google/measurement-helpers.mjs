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
 * Best-effort hints from the user-visible Google Maps Street View URL.
 * Google does not promise this URL representation; never treat it as
 * a calibrated camera or click-ray/depth API.
 */
export function parseGoogleMapsViewUrl(urlText) {
  let url;
  try { url = new URL(urlText); } catch { return null; }
  if (url.protocol !== "https:" ||
      !["www.google.com", "www.google.nl", "google.com"].includes(url.hostname) ||
      !url.pathname.startsWith("/maps")) return null;
  // Example: /maps/@51.44,5.47,3a,75y,240h,90t/data=...
  const match = url.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),3a(?:,\d+(?:\.\d+)?y)?(?:,(-?\d+(?:\.\d+)?)h)?/);
  if (!match) return null;
  const lat = Number(match[1]), lng = Number(match[2]), heading = Number(match[3]);
  if (![lat,lng].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return {
    lat, lng,
    heading: match[3] && Number.isFinite(heading) && heading >= 0 && heading <= 360
      ? heading : null
  };
}
