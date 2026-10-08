import test from "node:test";
import assert from "node:assert/strict";
import { parseEmbedHtml,parseGoogleMapsViewUrl,inspectGoogleMapsViewUrl,cameraPoseChanged,viewFromFields } from "../desktop-google/measurement-helpers.mjs";
import { groundFromRay, pixelFromWorld, rayFromPixel } from "../src/geometry.mjs";
import { terrainRayIntersection } from "../src/ahn.mjs";

const sample='https://www.google.com/maps/embed?pb=!4v10!6m8!1m7!1sgooglePanoId!2m2!1d51.4416!2d5.4697!3f110.5!4f0!5f0.78';
test("parses only a direct Google-generated embed link",()=>{
  assert.deepEqual(parseEmbedHtml(sample).location,{lat:51.4416,lng:5.4697});
  assert.equal(parseEmbedHtml(sample).heading,110.5);
  assert.equal(parseEmbedHtml('<iframe width="600" src="'+sample.replace("?pb=","?other=1&amp;pb=")+'"></iframe>').location.lat,51.4416);
});
test("rejects malicious untrusted iframe sources",()=>{
  for(const s of ["","http://www.google.com/maps/embed?pb=a","https://evil.com/maps/embed?pb=a",
    "https://www.google.com/maps?pb=a","javascript:alert(1)","https://www.google.com/maps/embed"]) {
    assert.throws(()=>parseEmbedHtml(s));
  }
});
test("does not guess coordinates if absent",()=>{
  assert.equal(parseEmbedHtml("https://www.google.com/maps/embed?pb=!4v10").location,null);
});
test("calibrated FOV is correctly mapped to camera projection",()=>{
  const v=viewFromFields({width:800,height:600,heading:90,pitch:-45,fov:90});
  assert.equal(v.zoom,1);
  const ray=rayFromPixel(400,300,v);
  assert.ok(ray.e>0.5);
  assert.ok(ray.u<0);
  assert.equal(viewFromFields({width:0,height:600,heading:0,pitch:0,fov:90}),null);
});

test("Google Maps Street View URL hints include heading, pitch and horizontal FOV",()=>{
  const p = parseGoogleMapsViewUrl("https://www.google.com/maps/@51.4416,5.4697,3a,75y,123.5h,100t/data=!3m1!1e3");
  assert.deepEqual(p, { lat:51.4416, lng:5.4697, heading:123.5, pitch:10, fov:75 });
  const up=parseGoogleMapsViewUrl("https://www.google.nl/maps/@51.4416,5.4697,3a,40y,270h,110t/data=example");
  assert.equal(up.pitch,20);
  assert.equal(up.heading,270);
  assert.equal(up.fov,40);
  assert.equal(parseGoogleMapsViewUrl("https://www.google.com/maps/@51.44,5.47,17z"),null);
  assert.equal(parseGoogleMapsViewUrl("https://fakegoogle.com/maps/@51.44,5.47,3a"),null);
  assert.equal(parseGoogleMapsViewUrl("javascript:alert(1)"),null);
  assert.deepEqual(
    parseGoogleMapsViewUrl("https://www.google.com/maps/@51.44,5.47,3a"),
    {lat:51.44,lng:5.47,heading:null,pitch:null,fov:null}
  );
});
test("Google Maps URL camera changes are detected without needless resets",()=>{
  const base = parseGoogleMapsViewUrl("https://www.google.com/maps/@51.4416,5.4697,3a,75y,120h,90t");
  const same = parseGoogleMapsViewUrl("https://www.google.com/maps/@51.4416,5.4697,3a,75y,120h,90t?hl=nl");
  const rotated = parseGoogleMapsViewUrl("https://www.google.com/maps/@51.4416,5.4697,3a,75y,150h,90t");
  const tilted = parseGoogleMapsViewUrl("https://www.google.com/maps/@51.4416,5.4697,3a,75y,120h,105t");
  const zoomed = parseGoogleMapsViewUrl("https://www.google.com/maps/@51.4416,5.4697,3a,30y,120h,90t");
  const moved = parseGoogleMapsViewUrl("https://www.google.com/maps/@51.4417,5.4699,3a,75y,120h,90t");
  assert.equal(cameraPoseChanged(base,same),false);
  for (const pose of [rotated,tilted,zoomed,moved]) assert.equal(cameraPoseChanged(base,pose),true);
  assert.equal(cameraPoseChanged(null,base),true);
});

test("Maps path tilt and documented pitch use the same positive-up convention",()=>{
  for(const pitch of [-90,-20,0,20,90]){
    for(const marker of ["1a","2a","3a"]){
      const path=parseGoogleMapsViewUrl(
        `https://www.google.com/maps/@51.44,5.47,${marker},75y,120h,${pitch+90}t`);
      const action=parseGoogleMapsViewUrl(
        `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=51.44,5.47&heading=120&pitch=${pitch}&fov=75`);
      assert.deepEqual(path,action);
    }
  }
});

test("downward Maps URL keeps distant ground clickable with flat ground and AHN",async()=>{
  // Generate image pixels from an independently specified downward camera,
  // then reconstruct them through the URL -> fields -> ray -> terrain pipeline.
  const width=1124,height=892,cameraHeight=2.5,baseZ=14;
  const expectedView=viewFromFields({width,height,heading:147.78,pitch:-12.38,fov:55.4});
  const pose=parseGoogleMapsViewUrl(
    "https://www.google.com/maps/@51.5333444,5.6342537,3a,55.4y,147.78h,77.62t/data=example");
  const parsedView=viewFromFields({width,height,...pose});
  const heading=expectedView.heading*Math.PI/180;
  for(const distance of [10,25,75,200,450]){
    const target={e:Math.sin(heading)*distance,n:Math.cos(heading)*distance,z:baseZ};
    const pixel=pixelFromWorld(target,baseZ+cameraHeight,expectedView);
    assert.ok(pixel.x>=0&&pixel.x<=width&&pixel.y>=0&&pixel.y<=height);
    const ray=rayFromPixel(pixel.x,pixel.y,parsedView);
    const flat=groundFromRay(ray,cameraHeight);
    assert.ok(flat,`visible ground at ${distance}m must not be rejected as sky`);
    assert.ok(Math.abs(Math.hypot(flat.e,flat.n)-distance)<1e-7);
    const ahn=await terrainRayIntersection({
      ray,origin:pose,cameraBaseZ:baseZ,cameraHeight,sampleHeight:async()=>baseZ
    });
    assert.equal(ahn.status,"ok");
    assert.ok(Math.abs(ahn.distance-distance)<1e-7);
    const projected=pixelFromWorld(ahn.point,baseZ+cameraHeight,parsedView);
    assert.ok(Math.hypot(projected.x-pixel.x,projected.y-pixel.y)<1e-7);
  }
});

test("upward Maps URL still rejects a sky click as flat ground",()=>{
  const pose=parseGoogleMapsViewUrl(
    "https://www.google.com/maps/@51.44,5.47,3a,75y,120h,110t");
  const camera=viewFromFields({width:800,height:600,...pose});
  assert.equal(groundFromRay(rayFromPixel(400,300,camera),2.5),null);
});
test("invalid or unavailable URL values never fabricate camera calibration",()=>{
  const incomplete = parseGoogleMapsViewUrl("https://www.google.com/maps/@51.44,5.47,3a,0y,400h,200t");
  assert.deepEqual(incomplete,{lat:51.44,lng:5.47,heading:null,pitch:null,fov:null});
  assert.equal(parseGoogleMapsViewUrl("https://www.google.com/maps/@100,5.47,3a,75y,120h,90t"),null);
  assert.equal(parseGoogleMapsViewUrl("https://www.google.com.evil.com/maps/@51,5,3a,75y,120h,90t"),null);
});

test("Google panorama with 2a or 1a marker is still recognized",()=>{
  const src="https://www.google.com/maps/@52.0907,5.1214,2a,60y,165h,85t/data=!4m1";
  assert.deepEqual(parseGoogleMapsViewUrl(src),{
    lat:52.0907,lng:5.1214,heading:165,pitch:-5,fov:60
  });
  assert.equal(parseGoogleMapsViewUrl(src.replace(",2a,",",1a,")).fov,60);
});
test("official Google Maps URLs with map_action=pano are recognized",()=>{
  const url="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=48.857832%2C2.295226&heading=-45&pitch=38&fov=80";
  const inspection=inspectGoogleMapsViewUrl(url);
  assert.equal(inspection.kind,"pano-action");
  assert.deepEqual(inspection.pose,{lat:48.857832,lng:2.295226,heading:315,pitch:38,fov:80});
  assert.equal(parseGoogleMapsViewUrl("https://www.google.com/maps/@?api=1&map_action=pano&pano=someId"),null);
  assert.match(inspectGoogleMapsViewUrl("https://www.google.com/maps/@?api=1&map_action=pano&pano=someId").reason,/geen camerapositie/i);
});
test("diagnostic explains Maps homepage rather than pretending a Street View pose exists",()=>{
  const d=inspectGoogleMapsViewUrl("https://www.google.com/maps/search/Made+Noord-Brabant");
  assert.equal(d.pose,null);
  assert.equal(d.kind,"no-pano-in-url");
  assert.match(d.reason,/zonder de browser-URL bij te werken/i);
  assert.equal(inspectGoogleMapsViewUrl("https://evil.google.com/maps/@51,5,3a,70y").kind,"invalid");
});
