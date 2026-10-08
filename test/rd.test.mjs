import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { wgs84ToRD, pointCoordinates } from "../src/rd.mjs";
import { offsetLocation } from "../src/ahn.mjs";
import { pointAtHorizontalDistance } from "../src/geometry.mjs";

const approx=(actual,expected,delta=0.1)=>assert.ok(
  Math.abs(actual-expected)<=delta,
  `Expected ${actual} to be within ${delta} m of ${expected}`
);

test("RD origin at Amersfoort maps to Dutch RD easting/northing",()=>{
  const rd=wgs84ToRD(52.15517440,5.38720621);
  approx(rd.x,155000,0.0001);
  approx(rd.y,463000,0.0001);
});

test("Dutch RD New values have east and north orientation",()=>{
  const base=wgs84ToRD(51.6,4.8);
  const east=wgs84ToRD(51.6,4.81);
  const north=wgs84ToRD(51.61,4.8);
  assert.ok(base.x>0 && base.x<300000);
  assert.ok(base.y>300000 && base.y<620000);
  assert.ok(east.x>base.x);
  assert.ok(north.y>base.y);
});

test("invalid, world and overseas coordinates do not fabricate RD XY",()=>{
  for(const [lat,lng] of [[NaN,5],[52,Infinity],[40,5],[52,15],[0,0],[54,5]]){
    assert.equal(wgs84ToRD(lat,lng),null);
  }
});

test("local XY offsets are distinct from projected national RD XY",()=>{
  const camera={lat:52.15517440,lng:5.38720621};
  const origin=pointCoordinates({e:0,n:0},camera,offsetLocation);
  assert.deepEqual(
    {x:origin.localX,y:origin.localY},
    {x:0,y:0}
  );
  approx(origin.rd.x,155000,0.0001);
  approx(origin.rd.y,463000,0.0001);
  const moved=pointCoordinates({e:8.5,n:-3.75},camera,offsetLocation);
  approx(moved.localX,8.5,0.00001);
  approx(moved.localY,-3.75,0.00001);
  assert.ok(moved.rd.x>origin.rd.x+7);
  assert.ok(moved.rd.y<origin.rd.y-3);
});

test("no remote/camera location produces no invented national coordinates",()=>{
  assert.equal(pointCoordinates(null,{lat:52,lng:5},offsetLocation),null);
  assert.equal(pointCoordinates({e:5,n:10},null,offsetLocation),null);
  assert.equal(pointCoordinates({e:NaN,n:1},{lat:52,lng:5},offsetLocation),null);
});

test("desktop removes calibration checkbox and includes Techbase and RD export",()=>{
  const app=readFileSync(new URL("../desktop-google/app.mjs",import.meta.url),"utf8");
  const html=readFileSync(new URL("../desktop-google/index.html",import.meta.url),"utf8");
  const css=readFileSync(new URL("../desktop-google/styles.css",import.meta.url),"utf8");
  const pack=JSON.parse(readFileSync(new URL("../package.json",import.meta.url),"utf8"));
  assert.ok(!app.includes("calibration-confirmed"),"no confirmation gate");
  assert.ok(!html.includes("id=\"calibration-confirmed\""));
  assert.ok(app.includes("pointCoordinates("));
  for(const token of ["lokaal_X_meter","lokaal_Y_meter","RD_X_meter","RD_Y_meter","EPSG:28992"]){
    assert.ok(app.includes(token),token);
  }
  assert.ok(html.includes('id="point-results"'));
  assert.ok(css.includes("--tb-orange:"));
  assert.ok(css.includes("--tb-red:"));
  assert.ok(pack.build.files.includes("src/rd.mjs"),"RD helper must ship in EXE");
});

test("far manual range shifts RD X/Y away from panorama origin instead of retaining near coordinates",()=>{
  const origin={lat:52.1551744,lng:5.38720621};
  const ray={e:1,n:0,u:-0.03};
  const near=pointCoordinates(pointAtHorizontalDistance(ray,12,4.5),origin,offsetLocation);
  const far=pointCoordinates(pointAtHorizontalDistance(ray,180,4.5),origin,offsetLocation);
  assert.ok(far.rd.x > near.rd.x + 165);
  assert.ok(Math.abs(far.rd.y-near.rd.y) < 1);
});

test("desktop CSV preserves provenance for manually ranged points",()=>{
  const app=readFileSync(new URL("../desktop-google/app.mjs",import.meta.url),"utf8");
  for(const field of ["afstand_camera_m","diepte_methode","AHN_hoogteverschil_m","hoogtebron"]){
    assert.ok(app.includes(field),field);
  }
  assert.ok(app.includes('pointAtHorizontalDistance('));
  assert.ok(app.includes('correctPointRange('));
});
