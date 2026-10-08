/** Optional live check: a real PDOK DTM sample and browser CORS permissions. */
import { buildAHNUrl, parseAHNElevation } from "../src/ahn.mjs";

const locations = [
  ["Eindhoven", 51.4416, 5.4697],
  ["Amersfoort", 52.15, 5.386]
];
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 15000);
try {
  let succeeded = false;
  for (const [name, lat, lng] of locations) {
    const response = await fetch(buildAHNUrl(lat, lng), {
      signal: controller.signal,
      headers: { Origin: "https://example.com" }
    });
    const cors = response.headers.get("access-control-allow-origin");
    if (!response.ok || (cors !== "*" && cors !== "https://example.com")) {
      throw new Error("PDOK AHN HTTP/CORS error: " + response.status + ", " + cors);
    }
    const json = await response.json();
    const elevation = parseAHNElevation(json);
    if (elevation === null) {
      console.log(name + ": geen AHN DTM-waarde; volgende locatie proberen.");
      continue;
    }
    console.log(name + ": " + elevation + " m NAP, CORS: " + cors);
    succeeded = true;
    break;
  }
  if (!succeeded) throw new Error("PDOK heeft geen geldige hoogte voor testlocaties.");
  console.log("Live PDOK AHN smoke test geslaagd.");
} finally {
  clearTimeout(timer);
}
