/** Optional integration smoke test: HTTP availability + CORS + actual AHN height. */
import { buildAHNUrl, parseAHNElevation } from "../src/ahn.mjs";

const url = buildAHNUrl(52.0907, 5.1214); // Utrecht, Netherlands
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 15000);
try {
  const response = await fetch(url, {
    signal: controller.signal,
    headers: { Origin: "https://example.com" }
  });
  console.log("PDOK HTTP status:", response.status);
  console.log("Content-Type:", response.headers.get("content-type"));
  console.log("Access-Control-Allow-Origin:", response.headers.get("access-control-allow-origin"));
  const body = await response.text();
  console.log("Response excerpt:", body.slice(0, 250));
  if (!response.ok) throw new Error("PDOK returned HTTP " + response.status);
  let json;
  try { json = JSON.parse(body); }
  catch { throw new Error("AHN response is not JSON"); }
  const elevation = parseAHNElevation(json);
  if (elevation === null) throw new Error("AHN returned no valid elevation for test position");
  console.log("Verified AHN terrain elevation (m NAP):", elevation);
  const cors = response.headers.get("access-control-allow-origin");
  if (cors !== "*" && cors !== "https://example.com") {
    throw new Error("Missing CORS permission for a browser client");
  }
  console.log("Live PDOK AHN smoke test succeeded.");
} finally {
  clearTimeout(timeout);
}
