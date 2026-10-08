import test from "node:test";
import assert from "node:assert/strict";
import { parseEmbedHtml,parseGoogleMapsViewUrl,viewFromFields } from "../desktop-google/measurement-helpers.mjs";
import { rayFromPixel } from "../src/geometry.mjs";

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

test("Google Maps browser URL supplies only approximate street-view camera hints",()=>{
  const p = parseGoogleMapsViewUrl("https://www.google.com/maps/@51.4416,5.4697,3a,75y,123.5h,90t/data=!3m1!1e3");
  assert.deepEqual(p, { lat:51.4416, lng:5.4697, heading:123.5 });
  assert.equal(parseGoogleMapsViewUrl("https://www.google.com/maps/@51.44,5.47,17z"),null);
  assert.equal(parseGoogleMapsViewUrl("https://fakegoogle.com/maps/@51.44,5.47,3a"),null);
  assert.equal(parseGoogleMapsViewUrl("javascript:alert(1)"),null);
  const withoutHeading = parseGoogleMapsViewUrl("https://www.google.com/maps/@51.44,5.47,3a");
  assert.equal(withoutHeading.heading,null);
});
