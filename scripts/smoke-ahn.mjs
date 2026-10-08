/** Check both public PDOK AHN DTM and DSM layers, and browser CORS. */
import { buildAHNUrl, parseAHNElevation, AHN_LAYER, AHN_SURFACE_LAYER } from "../src/ahn.mjs";
const places = [
  ["Eindhoven", 51.4416, 5.4697],
  ["Amersfoort", 52.15, 5.386]
];
const timer = new AbortController();
const timeout = setTimeout(() => timer.abort(), 20000);
try {
  for (const layer of [AHN_LAYER, AHN_SURFACE_LAYER]) {
    let worked = false;
    for (const [name, lat, lng] of places) {
      const response = await fetch(buildAHNUrl(lat,lng,layer), {
        signal: timer.signal, headers: { Origin: "https://example.com" }
      });
      const cors = response.headers.get("access-control-allow-origin");
      if (!response.ok || (cors !== "*" && cors !== "https://example.com")) {
        throw new Error("PDOK HTTP/CORS " + response.status + ", " + cors + " for " + layer);
      }
      const height = parseAHNElevation(await response.json());
      if (height === null) continue;
      console.log(layer + " " + name + ": " + height + " m NAP, CORS " + cors);
      worked = true;
      break;
    }
    if (!worked) throw new Error("PDOK has no usable " + layer + " elevation at smoke test locations");
  }
  console.log("Live AHN DTM + DSM smoke tests succeeded");
} finally {
  clearTimeout(timeout);
}
