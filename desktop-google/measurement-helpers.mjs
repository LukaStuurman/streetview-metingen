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
    !(width>0&&height>0&&fov>=10&&fov<=120&&Math.abs(pitch)<=90))return null;
  return {width,height,heading,pitch,zoom:Math.log2(180/fov)};
}

/**
 * Interpret only user-visible Google Maps URL information.
 * Official Maps URLs can also be /maps/@?api=1&map_action=pano&viewpoint=...
 * Google's own website URLs are undocumented and sometimes stay unchanged
 * while Street View rotates: missing data must NEVER be synthesized.
 */
export function inspectGoogleMapsViewUrl(urlText) {
  let url;
  try { url=new URL(urlText); }
  catch { return {pose:null,reason:"Ongeldige Google Maps-URL.",kind:"invalid"}; }

  if (url.protocol!=="https:" ||
      !["www.google.com","www.google.nl","google.com","google.nl"].includes(url.hostname) ||
      !/^\/maps(?:\/|$)/.test(url.pathname)) {
    return {pose:null,reason:"Geen vertrouwde Google Maps-URL.",kind:"invalid"};
  }
  const validCoords=(lat,lng)=>Number.isFinite(lat)&&Number.isFinite(lng)&&
    Math.abs(lat)<=90&&Math.abs(lng)<=180;
  const normalizeHeading=value=>((value%360)+360)%360;

  // Ordinary Google Maps webpage: the panorama type may be 1a, 2a or 3a.
  // Some special panoramas use 2a; the previous parser only accepted 3a.
  const match=url.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),\d+a(?:,([^/]+))?/);
  if(match){
    const lat=Number(match[1]),lng=Number(match[2]);
    if(!validCoords(lat,lng))
      return {pose:null,reason:"Ongeldige Street View-coördinaten.",kind:"invalid"};
    let heading=null,pitch=null,fov=null;
    for(const token of (match[3]||"").split(",")){
      const m=token.match(/^(-?\d+(?:\.\d+)?)([yht])$/);
      if(!m)continue;
      const number=Number(m[1]);
      if(!Number.isFinite(number))continue;
      if(m[2]==="y"&&number>=10&&number<=120)fov=number;
      if(m[2]==="h"&&number>=0&&number<=360)heading=number;
      if(m[2]==="t"&&number>=0&&number<=180)pitch=90-number;
    }
    return {pose:{lat,lng,heading,pitch,fov},kind:"streetview-path",reason:"Street View-cameragegevens in Google Maps-adres gevonden."};
  }

  // Google's documented Maps URL action, not a private tile/metadata API.
  if(url.searchParams.get("api")==="1" &&
     url.searchParams.get("map_action")==="pano"){
    const coords=url.searchParams.get("viewpoint")?.split(",");
    if(!coords||coords.length!==2)
      return {pose:null,kind:"pano-no-position",reason:"Street View is geopend met alleen een panorama-ID; deze URL bevat geen camerapositie."};
    const lat=Number(coords[0]),lng=Number(coords[1]);
    if(!validCoords(lat,lng))
      return {pose:null,kind:"invalid",reason:"Ongeldige viewpoint-coördinaten in de Street View-URL."};
    const q=(key,min,max)=> {
      const raw=url.searchParams.get(key);
      if(raw===null||raw.trim()==="")return null;
      const n=Number(raw);
      return Number.isFinite(n)&&n>=min&&n<=max?n:null;
    };
    const rawHeading=q("heading",-180,360);
    return {
      pose:{lat,lng,heading:rawHeading===null?null:normalizeHeading(rawHeading),
        pitch:q("pitch",-90,90),fov:q("fov",10,120)},
      kind:"pano-action",reason:"Google Maps-panoramalink gevonden (de camerastand is niet altijd actueel)."
    };
  }

  return {
    pose:null,kind:"no-pano-in-url",
    reason:"Google Maps toont geen herkenbare panoramacamera in het huidige adres. Het Street View-beeld kan intern geopend zijn zonder de browser-URL bij te werken."
  };
}
export function parseGoogleMapsViewUrl(urlText) {
  return inspectGoogleMapsViewUrl(urlText).pose;
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
