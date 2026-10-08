import test from "node:test";
import assert from "node:assert/strict";
import {triangulatePanoramas} from "../src/triangulation.mjs";
import {offsetLocation} from "../src/ahn.mjs";

const origin={lat:52.1551744,lng:5.38720621};
const observe=(cameraE,cameraN,targetE,targetN,extra={})=>{
  const p=offsetLocation(origin,cameraE,cameraN);
  return {lat:p.lat,lng:p.lng,ray:{e:targetE-cameraE,n:targetN-cameraN,u:0},
    ...extra};
};
const close=(actual,expected,range)=>assert.ok(Math.abs(actual-expected)<range,
  `${actual} should be within ${range} of ${expected}`);

test("two distinct Street View cameras triangulate far target without AHN collision",()=>{
  const obs=[observe(0,0,25,180),observe(15,0,25,180)];
  const x=triangulatePanoramas(obs);
  assert.equal(x.status,"ok");
  close(x.point.e,25,0.1);close(x.point.n,180,0.1);
  assert.equal(x.count,2);
  close(x.point.rd.x,155025,1);
  close(x.point.rd.y,463180,1);
  assert.ok(x.angleDeg>4);
});

test("three Street View cameras improve and expose disagreement",()=>{
  const obs=[observe(0,0,18,70),observe(12,0,18,70),observe(-3,11,18,70)];
  const x=triangulatePanoramas(obs);
  assert.equal(x.status,"ok");
  assert.equal(x.count,3);
  close(x.point.e,18,0.05);close(x.point.n,70,0.05);
  assert.ok(x.residualRmsM<0.1);
});

test("triangulation estimates optional Z only if ground heights are available twice",()=>{
  const a=observe(0,0,20,60,{cameraZ:7});
  const b=observe(15,0,20,60,{cameraZ:7});
  const initial=triangulatePanoramas([a,b]);
  assert.equal(initial.point.z,7);
  close(initial.zSpreadM,0,1e-10);
  delete b.cameraZ;
  assert.equal(triangulatePanoramas([a,b]).point.z,null);
});

test("reject same camera, nearly parallel lines, looking behind and farther than 500m",()=>{
  assert.equal(triangulatePanoramas([]).status,"need-two");
  const a=observe(0,0,10,70);
  const same=observe(0,0,10,70);
  assert.equal(triangulatePanoramas([a,same]).status,"baseline");
  const parallel=triangulatePanoramas([
    observe(0,0,5,1000),observe(5,0,5,1000)
  ]);
  assert.equal(parallel.status,"parallel");
  const behind=triangulatePanoramas([
    observe(0,0,10,40),observe(10,0,10,40)
      // one points elsewhere
  ].map((p,i)=>i===1?{...p,ray:{e:-1,n:-1,u:0}}:p));
  assert.ok(["behind","parallel","out-of-range"].includes(behind.status));
  assert.equal(triangulatePanoramas([
    observe(0,0,10,700),observe(12,0,10,700)
  ],{maxRange:800}).status,"ok");
  assert.equal(triangulatePanoramas([
    observe(0,0,10,700),observe(12,0,10,700)
  ]).status,"out-of-range");
});

test("near-parallel triangulation reports weak geometry and one-degree sensitivity",()=>{
  const x=triangulatePanoramas([
    observe(0,0,0,360),observe(8,0,0,360)
  ]);
  assert.equal(x.status,"ok");
  assert.equal(x.quality,"low");
  assert.ok(x.sensitivityAtOneDegreeM>100);
});

test("invalid positions and degenerate rays do not yield invented coordinates",()=>{
  const a=observe(0,0,15,55),b=observe(10,0,15,55);
  assert.equal(triangulatePanoramas([a,{...b,lat:NaN}]).status,"invalid");
  assert.equal(triangulatePanoramas([a,{...b,ray:{e:0,n:0,u:1}}]).status,"invalid");
});
