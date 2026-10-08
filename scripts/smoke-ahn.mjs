/** Diagnose supported AHN endpoints and real browser CORS; non-blocking CI step. */
import { AHN_WMS, buildAHNUrl, parseAHNElevation } from "../src/ahn.mjs";
const controller = new AbortController();
setTimeout(() => controller.abort(), 25000).unref();
const locations = [
  ["Utrecht", 52.0907, 5.1214],
  ["Breda", 51.5875, 4.775],
  ["Eindhoven", 51.4416, 5.4697],
  ["Amersfoort", 52.15, 5.386]
];
let found = false;
async function get(url) {
  const r = await fetch(url, { signal: controller.signal, headers: {Origin:"https://example.com"} });
  const raw = await r.text();
  return { status:r.status, cors:r.headers.get("access-control-allow-origin"), raw };
}
try {
  const caps = await get(AHN_WMS+"?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0");
  console.log("PDOK WMS capabilities:", caps.status, caps.raw.length, caps.raw.slice(0, 100));
  const layers = [...caps.raw.matchAll(/<Name>([^<]+)<\/Name>/g)].map(m=>m[1]);
  console.log("Layer names:", layers.slice(0,30));
  for (const [name, lat,lng] of locations) {
    const url = buildAHNUrl(lat,lng);
    const query = new URL(url);
    const merc = query.searchParams.get("BBOX").split(",").map(Number);
    const scenarios = [
      ["small",url],
      ["large",(()=>{
        const centerX=(merc[0]+merc[2])/2, centerY=(merc[1]+merc[3])/2;
        query.searchParams.set("WIDTH","101");query.searchParams.set("HEIGHT","101");
        query.searchParams.set("I","50");query.searchParams.set("J","50");
        query.searchParams.set("BBOX",[centerX-1000,centerY-1000,centerX+1000,centerY+1000].join(","));
        return query.toString();
      })()]
    ];
    for (const [variant, q] of scenarios) {
      const u=variant==="large"?AHN_WMS+"?"+q:q;
      const result=await get(u);
      let z=null;try{z=parseAHNElevation(JSON.parse(result.raw));}catch{}
      console.log("PDOK",name,variant,result.status,"CORS",result.cors,"NAP",z,"data",result.raw.slice(0,200));
      found ||= z !== null;
    }
  }
  // Known Esri AHN ImageServer: check alternative point-height service.
  for (const version of ["AHN4_DTM_50cm","AHN5_DTM_50cm"]) {
    const root="https://ahn.arcgisonline.nl/arcgis/rest/services/Hoogtebestand/"+version+"/ImageServer";
    const qs=new URLSearchParams({
      f:"json",geometryType:"esriGeometryPoint",
      geometry:JSON.stringify({x:5.1214,y:52.0907,spatialReference:{wkid:4326}}),
      returnGeometry:"false",returnCatalogItems:"false"
    });
    const result=await get(root+"/identify?"+qs);
    console.log("Esri",version,result.status,"CORS",result.cors,"data",result.raw.slice(0,250));
  }
  if (!found) throw Error("No usable PDOK elevation from queried sample locations");
  console.log("Live AHN smoke validation succeeded.");
} catch(e) {
  console.error(e);
  process.exitCode=1;
}
