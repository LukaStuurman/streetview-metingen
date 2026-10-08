import test from "node:test";
import assert from "node:assert/strict";
import {matchImagePatch,epipolarCandidates} from "../src/image-correspondence.mjs";
import {offsetLocation} from "../src/ahn.mjs";
import {rayFromPixel,pointAtHorizontalDistance,pixelFromWorld} from "../src/geometry.mjs";

const W=160,H=110;
const sample=(x,y)=>(
  (x*77+y*131+x*y*19+
    (Math.imul(x+13,y+7)&255)*7+(x*x*3+y*y*5))%170+30
);
function image(fn){
  const data=new Uint8ClampedArray(W*H*4);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const gray=fn(x,y);
    const i=(y*W+x)*4;
    data[i]=gray;data[i+1]=gray;data[i+2]=gray;data[i+3]=255;
  }
  return {width:W,height:H,data};
}
const make=(dx=0,dy=0)=>image((x,y)=>{
  const val=sample(x-dx,y-dy);
  return Math.max(0,Math.min(255,Math.round(val*0.8+25)));
});

test("one clicked texture patch matches another camera's shifted pixels",()=>{
  const first=image(sample),next=make(11,-4);
  const candidates=[];
  for(let y=28;y<60;y+=2)for(let x=35;x<95;x+=2)candidates.push({x,y});
  candidates.push({x:73,y:38});
  const m=matchImagePatch({
    source:first,target:next,sourcePoint:{x:62,y:42},
    candidates,minScore:.85
  });
  assert.equal(m.status,"ok",JSON.stringify(m));
  assert.ok(Math.abs(m.x-73)<1);
  assert.ok(Math.abs(m.y-38)<1);
  assert.ok(m.score>.96);
});

test("textureless grass/sky-like areas cannot claim reliable matches",()=>{
  const flat=image(()=>120);
  const x=matchImagePatch({
    source:flat,target:flat,sourcePoint:{x:60,y:40},
    candidates:[{x:60,y:40}]
  });
  assert.equal(x.status,"textureless");
});

test("duplicated object texture is marked ambiguous rather than inventing RD",()=>{
  const source=image(sample);
  const target=image((x,y)=>sample(x,y));
  const r=5;
  for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
    const a=((42+dy)*W+(68+dx))*4;
    const b=((42+dy)*W+(108+dx))*4;
    for(let k=0;k<4;k++)target.data[b+k]=target.data[a+k];
  }
  const result=matchImagePatch({
    source,target,sourcePoint:{x:68,y:42},
    candidates:[{x:68,y:42},{x:108,y:42}]
  });
  assert.equal(result.status,"ambiguous");
});

test("unrelated images fail score check",()=>{
  const source=image(sample);
  const target=image((x,y)=>sample((x*17)%W,(y*13)%H));
  const matched=matchImagePatch({
    source,target,sourcePoint:{x:67,y:43},minScore:.93,
    candidates:[{x:20,y:45},{x:60,y:60},{x:100,y:30}]
  });
  assert.equal(matched.status,"low-confidence");
});

test("epipolar search includes projection of same target from shifted camera",()=>{
  const origin={lat:52.1551744,lng:5.38720621};
  const next=offsetLocation(origin,12,0);
  const view={width:640,height:480,heading:0,pitch:-5,zoom:1};
  const A={...origin,cameraZ:6,view};
  const B={...next,cameraZ:6,view};
  const sourcePoint={x:320,y:240};
  const ray=rayFromPixel(sourcePoint.x,sourcePoint.y,view);
  const world=pointAtHorizontalDistance(ray,90,6);
  const fromB=pixelFromWorld({...world,e:world.e-12},6,view);
  const candidates=epipolarCandidates({
    cameraA:A,cameraB:B,sourcePoint,minRange:10,maxRange:400,samples:300
  });
  assert.ok(candidates.length>10);
  const nearest=Math.min(...candidates.map(p=>Math.hypot(p.x-fromB.x,p.y-fromB.y)));
  assert.ok(nearest<1.1,"Expected position along epipolar locus, got "+nearest);
});

test("no second camera height, invalid images or out of range are rejected",()=>{
  const img=image(sample);
  assert.equal(matchImagePatch({
    source:img,target:{width:1,height:1,data:new Uint8ClampedArray(4)},
    sourcePoint:{x:50,y:50},candidates:[{x:20,y:20}]
  }).status,"invalid");
  assert.equal(matchImagePatch({
    source:img,target:img,sourcePoint:{x:2,y:2},candidates:[{x:40,y:40}]
  }).status,"edge");
  const cam={lat:52,lng:5,view:{width:640,height:480,heading:0,pitch:0,zoom:1}};
  assert.deepEqual(epipolarCandidates({
    cameraA:{...cam,cameraZ:5},cameraB:cam,
    sourcePoint:{x:320,y:240}
  }),[]);
});
