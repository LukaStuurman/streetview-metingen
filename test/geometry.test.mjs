import test from "node:test";
import assert from "node:assert/strict";
import {
  focalPixels, groundFromRay, horizontalFov,
  lineLength, pixelFromGround, pixelFromWorld, rayFromPixel,
  pointAtHorizontalDistance, rayDepressionDegrees, MAX_GROUND_DISTANCE_M
} from "../src/geometry.mjs";

const view = { width: 800, height: 600, heading: 0, pitch: -45, zoom: 1 };
const approx = (actual, expected, tolerance = 1e-8) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≠ ${expected}`);

test("documented Street View zoom-to-horizontal-FOV model", () => {
  assert.equal(horizontalFov(1), 90);
  assert.equal(horizontalFov(2), 45);
  assert.equal(horizontalFov(0), null);
  approx(focalPixels(800, 1), 400);
});

test("vertical FOV uses image height and keeps landmark rays stable when width changes",()=>{
  // A 90-degree vertical camera has focal length h/2. These image locations
  // are analytically known for a point 2m east, 10m north, 2m below the camera.
  // Fixtures do not use our forward projection to manufacture the clicks.
  for(const [width,height] of [[800,600],[1600,600],[1530,1010],[1126,892]]){
    const camera={width,height,heading:0,pitch:0,zoom:1,fovAxis:"vertical"};
    approx(focalPixels(width,1,height,"vertical"),height/2);
    const x=width/2+height/10,y=height/2+height/10;
    const ray=rayFromPixel(x,y,camera);
    approx(ray.e/ray.n,0.2);
    approx(ray.u/ray.n,-0.2);
    const hit=groundFromRay(ray,2);
    approx(hit.e,2);approx(hit.n,10);
    const pixel=pixelFromWorld({e:2,n:10,z:0},2,camera);
    approx(pixel.x,x);approx(pixel.y,y);
  }
});

test("vertical FOV does not replace default horizontal API projection",()=>{
  const camera={width:1600,height:600,heading:0,pitch:0,zoom:1};
  approx(focalPixels(1600,1,600),800);
  const ray=rayFromPixel(960,460,camera);
  approx(ray.e/ray.n,0.2);approx(ray.u/ray.n,-0.2);
  assert.equal(focalPixels(1600,1,600,"unknown"),null);
  assert.equal(focalPixels(1600,1,0,"vertical"),null);
});

test("a central downward ray hits the ground ahead of the camera", () => {
  const ray = rayFromPixel(400, 300, view);
  const point = groundFromRay(ray, 2);
  approx(point.e, 0);
  approx(point.n, 2);
});

test("heading changes orientation of the ground intersection", () => {
  const ray = rayFromPixel(400, 300, { ...view, heading: 90 });
  const point = groundFromRay(ray, 2);
  approx(point.e, 2);
  approx(point.n, 0);
});

test("pixel-ground-pixel round trip survives rotation and zoom", () => {
  const ray = rayFromPixel(600, 420, view);
  const point = groundFromRay(ray, 2.5);
  const pixel = pixelFromGround(point, 2.5, view);
  approx(pixel.x, 600);
  approx(pixel.y, 420);
  const movedView = { ...view, heading: 12, pitch: -40, zoom: 2 };
  const pixel2 = pixelFromGround(point, 2.5, movedView);
  const ray2 = rayFromPixel(pixel2.x, pixel2.y, movedView);
  const point2 = groundFromRay(ray2, 2.5);
  approx(point2.e, point.e);
  approx(point2.n, point.n);
});

test("sky, horizon and very distant ground intersections are rejected", () => {
  const skyRay = rayFromPixel(400, 300, { ...view, pitch: 20 });
  assert.equal(groundFromRay(skyRay, 2.5), null);
  const horizonRay = rayFromPixel(400, 300, { ...view, pitch: 0 });
  assert.equal(groundFromRay(horizonRay, 2.5), null);
  const farRay = rayFromPixel(400, 300, { ...view, pitch: -0.1 });
  assert.equal(groundFromRay(farRay, 2.5), null);
  assert.equal(rayFromPixel(400, 300, { ...view, zoom: 0 }), null);
});

test("height calibration scales polyline lengths", () => {
  const rays = [
    rayFromPixel(400, 300, view),
    rayFromPixel(600, 300, view),
    rayFromPixel(600, 400, view)
  ];
  const length = lineLength(rays, 2);
  assert.ok(length > 0);
  approx(lineLength(rays, 3), length * 1.5);
  assert.equal(lineLength([], 2), 0);
});

test("points behind camera are not drawn", () => {
  assert.equal(pixelFromGround({ e: 0, n: -8 }, 2, view), null);
});

test("distant Street View pixel can represent 200m ground with a shallow depression", () => {
  const camera={width:800,height:600,heading:90,pitch:0,zoom:1};
  const ray=rayFromPixel(400,305,camera); // just below the horizon
  const hit=groundFromRay(ray,2.5);
  assert.ok(hit,"distant ray should be allowed beyond previous 150m cap");
  assert.ok(hit.e>190&&hit.e<210,`Expected ~200m, got ${hit.e}`);
  assert.ok(Math.abs(hit.n)<1e-6);
});

test("manual range correction shifts a far object without changing its clicked pixel",()=>{
  const camera={width:800,height:600,heading:45,pitch:-8,zoom:1.3};
  const ray=rayFromPixel(540,310,camera);
  const near=pointAtHorizontalDistance(ray,12,5.5);
  const far=pointAtHorizontalDistance(ray,110,5.5);
  approx(Math.hypot(near.e,near.n),12,1e-8);
  approx(Math.hypot(far.e,far.n),110,1e-8);
  const nearPix=pixelFromWorld(near,5.5,camera);
  const farPix=pixelFromWorld(far,5.5,camera);
  approx(nearPix.x,540,1e-6);approx(nearPix.y,310,1e-6);
  approx(farPix.x,540,1e-6);approx(farPix.y,310,1e-6);
  assert.ok(Math.abs(far.z-near.z)>2,"Z must follow camera ray, not remain at closer terrain");
});

test("far target range limits and near-horizon warnings are explicit",()=>{
  assert.equal(MAX_GROUND_DISTANCE_M,500);
  const ray=rayFromPixel(400,300,{width:800,height:600,heading:0,pitch:-1,zoom:1});
  approx(rayDepressionDegrees(ray),1,0.001);
  const sky=rayFromPixel(400,300,{width:800,height:600,heading:0,pitch:3,zoom:1});
  assert.ok(rayDepressionDegrees(sky)<0);
  for(const distance of [-1,0,0.1,MAX_GROUND_DISTANCE_M+1]) {
    assert.equal(pointAtHorizontalDistance(ray,distance,3),null);
  }
  assert.equal(pointAtHorizontalDistance(ray,500,NaN),null);
  assert.equal(pointAtHorizontalDistance({e:0,n:0,u:1},10,3),null);
});
