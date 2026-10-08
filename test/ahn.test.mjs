import test from "node:test";
import assert from "node:assert/strict";
import {
  AHNClient, buildAHNUrl, mercatorMeters, offsetLocation,
  parseAHNElevation, terrainRayIntersection, horizontalDistance, spatialDistance
} from "../src/ahn.mjs";
import { pixelFromWorld, rayFromPixel } from "../src/geometry.mjs";

const near = (actual, expected, tolerance = 0.1) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

test("PDOK WMS GetFeatureInfo produces EPSG:3857 center-point query", () => {
  const url = new URL(buildAHNUrl(52.0907, 5.1214));
  assert.equal(url.origin, "https://service.pdok.nl");
  assert.equal(url.searchParams.get("QUERY_LAYERS"), "dtm_05m");
  assert.equal(url.searchParams.get("INFO_FORMAT"), "application/json");
  assert.equal(url.searchParams.get("CRS"), "EPSG:3857");
  assert.equal(url.searchParams.get("I"), "1");
  assert.equal(url.searchParams.get("J"), "1");
  const bbox = url.searchParams.get("BBOX").split(",").map(Number);
  const center = mercatorMeters(52.0907, 5.1214);
  near((bbox[0] + bbox[2]) / 2, center.x, 1e-6);
  near((bbox[1] + bbox[3]) / 2, center.y, 1e-6);
});

test("AHN point heights decode valid zero and negative NAP, reject NoData", () => {
  const feature = v => ({ features: [{ properties: { GRAY_INDEX: v } }] });
  assert.equal(parseAHNElevation(feature(0)), 0);
  assert.equal(parseAHNElevation(feature(-4.55)), -4.55);
  assert.equal(parseAHNElevation(feature("12.4")), 12.4);
  assert.equal(parseAHNElevation(feature(-9999)), null);
  assert.equal(parseAHNElevation(feature(-3.4e38)), null);
  assert.equal(parseAHNElevation({ features: [] }), null);
  assert.equal(parseAHNElevation(feature(null)), null);
});

test("AHNClient caches valid and missing elevation without hiding HTTP errors", async () => {
  let calls = 0;
  const client = new AHNClient(async () => {
    calls++;
    return { ok: true, json: async () => ({
      features: [{ properties: { GRAY_INDEX: -1.2 } }]
    }) };
  });
  assert.equal(await client.height(51, 4), -1.2);
  assert.equal(await client.height(51, 4), -1.2);
  assert.equal(calls, 1);
  const unavailable = new AHNClient(async () => ({ ok: false, status: 503 }));
  await assert.rejects(unavailable.height(51, 4), /503/);
});

test("offset conversion keeps approximate metric offsets near Dutch latitudes", () => {
  const origin = { lat: 52.09, lng: 5.12 };
  const p = offsetLocation(origin, 100, 100);
  const dy = (p.lat - origin.lat) * 111132.92;
  near(dy, 100, 2);
  assert.ok(p.lng > origin.lng);
});

const origin = { lat: 52, lng: 5 };
const ray = { e: 0, n: 1, u: -0.2 };
const flat = async () => 3;

test("a DTM at 3m NAP intersects downward ray at 12.5m with 2.5m camera", async () => {
  const result = await terrainRayIntersection({
    ray, origin, cameraBaseZ: 3, cameraHeight: 2.5, sampleHeight: flat
  });
  assert.equal(result.status, "ok");
  near(result.point.n, 12.5, 0.01);
  near(result.point.z, 3, 0.01);
});

test("sloping up terrain moves ray hit closer, reports elevation and 3D distance", async () => {
  const uphill = async (lat, lng) => {
    const dy = (lat - origin.lat) * (111132.92 - 559.82 * Math.cos(2 * origin.lat * Math.PI / 180));
    return 3 + dy * 0.1; // 1m climb over 10m north.
  };
  const result = await terrainRayIntersection({
    ray, origin, cameraBaseZ: 3, cameraHeight: 2.5, sampleHeight: uphill
  });
  assert.equal(result.status, "ok");
  near(result.point.n, 2.5 / 0.3, 0.15);
  near(result.point.z, 3 + result.point.n * 0.1, 0.05);
  const fromCamera = { e: 0, n: 0, z: 5.5 };
  assert.ok(spatialDistance(fromCamera, result.point) > horizontalDistance(fromCamera, result.point));
});

test("upward ray can intersect uphill ground, unlike a flat-ground ray", async () => {
  const rising = async (lat, lng) => {
    const p = (lat - origin.lat) * 111132;
    return 3 + p * 0.2;
  };
  const result = await terrainRayIntersection({
    ray: { e: 0, n: 1, u: 0.05 }, origin, cameraBaseZ: 3,
    cameraHeight: 2.5, sampleHeight: rising
  });
  assert.equal(result.status, "ok");
  near(result.point.n, 2.5 / 0.15, 1);
});

test("no-data, out of range and abort never manufacture a height", async () => {
  const common = { ray, origin, cameraBaseZ: 3, cameraHeight: 2.5 };
  assert.equal((await terrainRayIntersection({
    ...common, sampleHeight: async () => null
  })).status, "no-data");
  assert.equal((await terrainRayIntersection({
    ...common, sampleHeight: flat, maxDistance: 3
  })).status, "out-of-range");
  const controller = new AbortController();
  controller.abort();
  assert.equal((await terrainRayIntersection({
    ...common, sampleHeight: flat, signal: controller.signal
  })).status, "aborted");
});

test("terrain intersection point reprojects to the same pixel", async () => {
  const view = { width: 800, height: 600, heading: 0, pitch: -20, zoom: 1 };
  const measuredRay = rayFromPixel(420, 310, view);
  const result = await terrainRayIntersection({
    ray: measuredRay, origin, cameraBaseZ: 3, cameraHeight: 2.5,
    sampleHeight: flat
  });
  assert.equal(result.status, "ok");
  const pixel = pixelFromWorld(result.point, 5.5, view);
  near(pixel.x, 420, 0.0001);
  near(pixel.y, 310, 0.0001);
});
