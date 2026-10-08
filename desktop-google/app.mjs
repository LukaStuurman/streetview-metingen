import {
  AHNClient, AHN_LAYER, AHN_SURFACE_LAYER, offsetLocation,
  terrainRayIntersection, horizontalDistance, spatialDistance
} from "../src/ahn.mjs";
import { groundFromRay, pixelFromWorld, rayFromPixel, MAX_GROUND_DISTANCE_M } from "../src/geometry.mjs";
import {
  parseEmbedHtml, parseGoogleMapsViewUrl, viewFromFields
} from "./measurement-helpers.mjs";

const $ = id => document.getElementById(id);
const ui = Object.fromEntries([
  "embed","open-maps","load","maps-browser","reload-maps","use-iframe","google-browser",
  "lat","lng","heading","pitch","fov","height",
  "ahn","ahn-layer","ahn-status","refresh-ahn","calibration-confirmed",
  "navigate","measure","new-line","undo",
  "clear","export","results","viewer","google-frame","overlay","notice"
].map(id => [id, $(id)]));
const ctx = ui.overlay.getContext("2d");
const AHN = new AHNClient();
const colorSet = ["#6febbc","#ffd28c","#9fbdff","#ffacc1"];
const state = {
  loaded:false, mode:"navigate", useAHN:true,
  surfaceLayer:AHN_LAYER, display:"embed",
  baseZ:null, lines:[[]], pending:null, epoch:0, terrainEpoch:0,
  lastGoogleViewUrl:null, canRender:false
};

function notice(text, error=false) {
  ui.notice.textContent = text;
  ui.notice.classList.toggle("error",error);
}
function n(id) { return Number(ui[id].value); }
function validCalibration() {
  const lat=n("lat"),lng=n("lng"),h=n("height");
  const fov=n("fov"),pitch=n("pitch"),heading=n("heading");
  return ui.lat.value.trim()!==""&&ui.lng.value.trim()!=="" &&
    Number.isFinite(lat)&&lat>=-90&&lat<=90 &&
    Number.isFinite(lng)&&lng>=-180&&lng<=180 &&
    Number.isFinite(h)&&h>=0.5&&h<=5 &&
    Number.isFinite(fov)&&fov>=15&&fov<=120 &&
    Number.isFinite(pitch)&&Math.abs(pitch)<=85 &&
    Number.isFinite(heading)&&heading>=0&&heading<=360;
}
function cameraLocation() {return {lat:n("lat"),lng:n("lng")};}
function view() {
  const rectangle=ui.overlay.getBoundingClientRect();
  return viewFromFields({
    width:rectangle.width,height:rectangle.height,
    heading:n("heading"),pitch:n("pitch"),fov:n("fov")
  });
}
function cameraZ() {
  return state.useAHN ? (Number.isFinite(state.baseZ) ? state.baseZ+n("height") : null) : n("height");
}
const format = (value,decimal=1)=>new Intl.NumberFormat("nl-NL",{
  minimumFractionDigits:decimal,maximumFractionDigits:decimal
}).format(value);
function resetMeasurements(reason) {
  state.epoch++;
  if(state.pending)state.pending.abort();
  state.pending=null;
  state.lines=[[]];
  render();
  if(reason)notice(reason);
}
function summary() {
  const rows=[];
  let count=0,segments=0,plan=0,three=0;
  let first=null,last=null;
  for(const line of state.lines) {
    count+=line.length;
    segments+=Math.max(0,line.length-1);
    if(!first&&line[0])first=line[0].point;
    if(line.length)last=line[line.length-1].point;
    for(let i=1;i<line.length;i++) {
      plan+=horizontalDistance(line[i-1].point,line[i].point);
      three+=spatialDistance(line[i-1].point,line[i].point);
    }
  }
  rows.push(["Punten",count],["Segmenten",segments],
    ["Horizontale afstand",format(plan)+" m"]);
  if(state.useAHN) {
    rows.push(
      ["AHN-model",state.surfaceLayer===AHN_SURFACE_LAYER?"DSM (dak/object)":"DTM (maaiveld)"],
      ["Rechte 3D-lengte",format(three)+" m"],
      [state.surfaceLayer===AHN_SURFACE_LAYER?"Laatste DSM-hoogte NAP":"Laatste maaiveld NAP",
        last ? format(last.z,2)+" m":"—"],
      ["Hoogteverschil",last&&first ? format(last.z-first.z,2)+" m":"—"]
    );
    if(state.surfaceLayer===AHN_SURFACE_LAYER) rows.push(
      ["Laatste DSM–DTM (objectindicatie)",
        last && Number.isFinite(last.objectHeight)
          ? format(last.objectHeight,2)+" m":"—"]
    );
  }
  ui.results.replaceChildren();
  for(const [key,value] of rows) {
    const node=document.createElement("div");
    node.className="result";
    const name=document.createElement("span");
    const v=document.createElement("strong");
    name.textContent=String(key);
    v.textContent=String(value);
    node.append(name,v);
    ui.results.append(node);
  }
}
function drawTag(text,x,y,color,height) {
  ctx.save();
  ctx.font="600 12px system-ui";
  const textW=ctx.measureText(text).width;
  const width=Math.max(38,textW+14);
  const px=Math.max(width/2+4,Math.min(x,height.width-width/2-4));
  const py=Math.max(27,Math.min(y,height.height-4));
  ctx.fillStyle="rgba(9,27,38,.92)";
  ctx.beginPath();
  ctx.roundRect(px-width/2,py-20,width,22,6);ctx.fill();
  ctx.fillStyle=color;ctx.textAlign="center";
  ctx.fillText(text,px,py-5);
  ctx.restore();
}
function render() {
  const v=view(),rect=ui.overlay.getBoundingClientRect();
  const ratio=window.devicePixelRatio||1;
  const w=Math.max(1,Math.round(rect.width*ratio));
  const h=Math.max(1,Math.round(rect.height*ratio));
  if(ui.overlay.width!==w)ui.overlay.width=w;
  if(ui.overlay.height!==h)ui.overlay.height=h;
  ctx.setTransform(ratio,0,0,ratio,0,0);
  ctx.clearRect(0,0,rect.width,rect.height);
  summary();
  const z=cameraZ();
  if(!state.loaded||!validCalibration()||z===null||!v)return;
  for(let idx=0;idx<state.lines.length;idx++) {
    const vertices=state.lines[idx];
    const color=colorSet[idx%colorSet.length];
    const projected=vertices.map(vertex=>pixelFromWorld(vertex.point,z,v));
    ctx.strokeStyle=color;ctx.lineWidth=3;ctx.lineCap="round";
    for(let i=1;i<projected.length;i++) {
      const a=projected[i-1],b=projected[i];if(!a||!b)continue;
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
      const pl=horizontalDistance(vertices[i-1].point,vertices[i].point);
      const three=spatialDistance(vertices[i-1].point,vertices[i].point);
      const label=state.useAHN
        ? format(pl)+" m • 3D "+format(three)+" m" : format(pl)+" m";
      drawTag(label,(a.x+b.x)/2,(a.y+b.y)/2-13,color,rect);
    }
    projected.forEach((p,i)=>{
      if(!p||p.x<0||p.x>rect.width||p.y<0||p.y>rect.height)return;
      ctx.beginPath();ctx.arc(p.x,p.y,6,0,Math.PI*2);
      ctx.fillStyle=color;ctx.fill();ctx.strokeStyle="#0b202a";ctx.lineWidth=2;ctx.stroke();
      if(state.useAHN) {
        const vertex=vertices[i].point;
        const objectLabel=state.surfaceLayer===AHN_SURFACE_LAYER &&
          Number.isFinite(vertex.objectHeight)
          ? " • +"+format(vertex.objectHeight,1)+" m"
          : "";
        drawTag(format(vertex.z,2)+" m NAP"+objectLabel,p.x,p.y+38,color,rect);
      }
    });
  }
}
async function updateTerrain() {
  const epoch=++state.terrainEpoch;
  state.baseZ=null;render();
  if(!state.useAHN) {
    ui["ahn-status"].textContent="AHN uit. Vlak maaiveld aangenomen.";
    return;
  }
  if(!state.loaded||!validCalibration()) {
    ui["ahn-status"].textContent="Laad een Street View en vul geldige camera-gegevens in.";
    return;
  }
  ui["ahn-status"].textContent="Maaiveldhoogte ophalen bij PDOK…";
  try {
    const {lat,lng}=cameraLocation();
    // Camera height is ALWAYS relative to true ground (DTM), never a roof (DSM).
    const z=await AHN.height(lat,lng,undefined,AHN_LAYER);
    if(epoch!==state.terrainEpoch)return;
    if(z===null) {
      ui["ahn-status"].textContent="Geen AHN-maaiveld beschikbaar op deze positie.";
      notice("Geen AHN-waarde. Kies een punt op het Nederlandse maaiveld of schakel AHN uit.",true);
      return;
    }
    state.baseZ=z;
    ui["ahn-status"].textContent="AHN-terrein bij camera: "+format(z,2)+" m NAP";
    render();
  } catch(error) {
    if(epoch!==state.terrainEpoch)return;
    const detail = error instanceof Error ? error.message : String(error);
    ui["ahn-status"].textContent="AHN-verzoek mislukt: "+detail;
    notice("AHN-service niet beschikbaar: "+detail,true);
  }
}
function switchMode(target) {
  if(target==="measure") {
    if(!state.loaded)return notice("Open eerst een gedeelde Google Street View-link.",true);
    if(!validCalibration())return notice("Controleer alle cameravelden.",true);
    if(!ui["calibration-confirmed"].checked)
      return notice("Bevestig eerst de handmatige camerakalibratie.",true);
    if(state.useAHN&&state.baseZ===null)return notice("Wacht tot AHN is geladen of zet AHN uit.",true);
    if(state.mode!=="measure")resetMeasurements(
      state.surfaceLayer===AHN_SURFACE_LAYER && state.useAHN
        ? "Meetbeeld vergrendeld: klik op een zichtbaar dak of bovenvlak. DSM bevat ook bomen."
        : "Meetbeeld vergrendeld. Klik op de grond om punten te plaatsen."
    );
  } else if(state.mode==="measure") {
    ui["calibration-confirmed"].checked=false;
    resetMeasurements("Navigatiemodus: metingen gewist. Kalibreer opnieuw na draaien, zoomen of verplaatsen.");
  }
  state.mode=target;
  const isMeasure=target==="measure";
  ui.viewer.classList.toggle("locked",isMeasure);
  ui.measure.classList.toggle("selected",isMeasure);
  ui.navigate.classList.toggle("selected",!isMeasure);
  ui.measure.setAttribute("aria-pressed",String(isMeasure));
  ui.navigate.setAttribute("aria-pressed",String(!isMeasure));
  if(isMeasure)document.activeElement?.blur?.();
}
async function addClick(event) {
  if(state.mode!=="measure"||state.pending||!validCalibration())return;
  const rect=ui.overlay.getBoundingClientRect();
  const ray=rayFromPixel(event.clientX-rect.left,event.clientY-rect.top,view());
  if(!ray)return notice("Onbekende perspectiefprojectie.",true);
  const stamp=state.epoch;
  const original=cameraLocation();
  let point;
  if(state.useAHN) {
    const controller=new AbortController();
    state.pending=controller;
    notice("Kijkstraal kruisen met AHN-terrein…");
    try {
      const result=await terrainRayIntersection({
        ray,origin:original,cameraBaseZ:state.baseZ,cameraHeight:n("height"),
        sampleHeight:(lat,lng,signal)=>AHN.height(lat,lng,signal,state.surfaceLayer),
        signal:controller.signal,maxDistance:MAX_GROUND_DISTANCE_M
      });
      if(controller.signal.aborted||stamp!==state.epoch)return;
      if(result.status!=="ok") {
        const why=result.status==="no-data"
          ? "AHN heeft hier geen terreinwaarde."
          : "Geen AHN-terreinsnijpunt binnen 150 meter.";
        notice(why,true);return;
      }
      point=result.point;
      if(state.surfaceLayer===AHN_SURFACE_LAYER) {
        // Sample the underlying terrain at the same XY to estimate object height.
        // DSM includes vegetation and overhead objects; never claim it is definitely a building.
        const location=offsetLocation(original,point.e,point.n);
        if(location) {
          const ground=await AHN.height(location.lat,location.lng,controller.signal,AHN_LAYER);
          if(stamp!==state.epoch || controller.signal.aborted)return;
          point.groundZ=ground;
          point.objectHeight=Number.isFinite(ground)?Math.max(0,point.z-ground):null;
        }
      }
    } catch(error) {
      if(!controller.signal.aborted&&stamp===state.epoch)
        notice("AHN-metingen mislukt: "+error.message,true);
      return;
    } finally {
      if(state.pending===controller)state.pending=null;
    }
  } else {
    const p=groundFromRay(ray,n("height"));
    if(!p)return notice("Klik op maaiveld onder de horizon binnen 150 meter.",true);
    point={...p,z:0};
  }
  if(stamp!==state.epoch)return;
  state.lines[state.lines.length-1].push({ray,point});
  render();
  notice("Meetpunt geplaatst. Houd de camera stil voor volgende punten.");
}
function newLine() {
  if(state.lines[state.lines.length-1]?.length)state.lines.push([]);
  render();
}
function undo() {
  while(state.lines.length>1&&state.lines[state.lines.length-1].length===0)
    state.lines.pop();
  state.lines[state.lines.length-1].pop();
  render();
}
function exportCsv() {
  const lines=[["lijn","punt","breedtegraad","lengtegraad","NAP_hoogte_m",
    "AHN_model","maaiveld_DTM_NAP_m","DSM_min_DTM_m","oost_meter","noord_meter"].join(";")];
  const origin=cameraLocation();
  for(let line=0;line<state.lines.length;line++){
    for(let i=0;i<state.lines[line].length;i++){
      const p=state.lines[line][i].point;
      const loc=offsetLocation(origin,p.e,p.n);
      if(!loc)continue;
      lines.push([line+1,i+1,loc.lat.toFixed(8),loc.lng.toFixed(8),
        state.useAHN?p.z.toFixed(3):"",
        state.useAHN?state.surfaceLayer:"vlak",
        state.useAHN&&Number.isFinite(p.groundZ)?p.groundZ.toFixed(3):
          state.useAHN&&state.surfaceLayer===AHN_LAYER?p.z.toFixed(3):"",
        state.useAHN&&Number.isFinite(p.objectHeight)?p.objectHeight.toFixed(3):"",
        p.e.toFixed(3),p.n.toFixed(3)].join(";"));
    }
  }
  if(lines.length===1)return notice("Plaats eerst meetpunten om te exporteren.",true);
  const csv="\ufeff"+lines.join("\r\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download="streetview-meting-indicatief.csv";
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
  notice("Indicatieve meetpunten geëxporteerd; geen Google-beelden opgeslagen.");
}

/**
 * Google Maps is loaded as an isolated, regular browser guest, NOT as a Google
 * Street View API. No tile interception, internal Google endpoints or scraping.
 * An ordinary Google website may still reject embedded browsers on some machines.
 */
function showBrowser() {
  if(state.mode==="measure")switchMode("navigate");
  resetMeasurements("Google Maps geopend. Kies een Street View-foto in het kaartbeeld.");
  state.display="maps";
  state.loaded=true;
  // Never reuse coordinates left over from a different previously opened iframe.
  ui.lat.value="";
  ui.lng.value="";
  ui["ahn-status"].textContent="Navigeer eerst naar Street View in Google Maps.";
  ui.viewer.classList.add("loaded","maps-browser");
  const guest=ui["google-browser"];
  if(!guest.getAttribute("src"))guest.setAttribute("src","https://www.google.com/maps");
  ui["calibration-confirmed"].checked=false;
  updateTerrain();
}

function showIframe() {
  if(state.mode==="measure")switchMode("navigate");
  resetMeasurements("Insluitmodus: plak de Google Maps-sharecode of laad eerder gebruikte iframe.");
  state.display="embed";
  ui.viewer.classList.remove("maps-browser");
  state.loaded=Boolean(ui["google-frame"].getAttribute("src"));
  ui["calibration-confirmed"].checked=false;
  updateTerrain();
}

function googleUrlChanged(url) {
  if(state.display!=="maps" || !url || url===state.lastGoogleViewUrl)return;
  try {
    const u = new URL(url);
    if(["consent.google.com","consent.google.nl"].includes(u.hostname)) {
      notice("Google-cookiekeuze: kies zelf Alles accepteren of Alles weigeren. Je keuze wordt bewaard.",false);
      return;
    }
  } catch { /* invalid guest URL; handled below */ }
  state.lastGoogleViewUrl=url;
  // Every navigation invalidates our manually entered camera model, even
  // if the Google URL contains no parseable camera metadata.
  if(state.mode==="measure")switchMode("navigate");
  resetMeasurements();
  ui["calibration-confirmed"].checked=false;
  const hint=parseGoogleMapsViewUrl(url);
  if(!hint) {
    notice("Navigeer in Google Maps naar Street View. Vul daarna de cameragegevens in.",false);
    return;
  }
  ui.lat.value=String(hint.lat);
  ui.lng.value=String(hint.lng);
  if(hint.heading!==null)ui.heading.value=String(hint.heading);
  notice("Street View-herkenning: coördinaten/richting als voorstel ingevuld. Controleer de camerahoek en beeldhoek.",false);
  updateTerrain();
}

ui["maps-browser"].addEventListener("click",showBrowser);
ui["reload-maps"].addEventListener("click",()=>{
  if(state.display!=="maps")showBrowser();
  const guest=ui["google-browser"];
  if(typeof guest.reload==="function" && guest.getAttribute("src")) {
    guest.reload();
    notice("Google Maps opnieuw laden. Je cookiekeuze blijft in de app bewaard.");
  } else guest.setAttribute("src","https://www.google.com/maps");
});
ui["use-iframe"].addEventListener("click",showIframe);
const guest=ui["google-browser"];
guest.addEventListener("did-navigate",event=>googleUrlChanged(event.url));
guest.addEventListener("did-navigate-in-page",event=>googleUrlChanged(event.url));
guest.addEventListener("did-fail-load",event=>{
  if(state.display==="maps" && event.isMainFrame)
    notice("Google Maps kon niet in de ingebouwde browser laden. Gebruik eventueel de insluitlink.",true);
});
guest.addEventListener("dom-ready",()=>{
  if(state.display==="maps") notice("Google Maps geladen: open Street View met de blauwe lijnen of Street View-foto.",false);
});

ui["open-maps"].addEventListener("click",()=>window.open("https://www.google.com/maps","_blank","noopener"));
ui.load.addEventListener("click",()=>{
  let parsed;
  try{parsed=parseEmbedHtml(ui.embed.value);}
  catch(e){return notice(e.message,true);}
  if(state.mode==="measure")switchMode("navigate");
  resetMeasurements();
  state.loaded=true;
  state.display="embed";
  ui.viewer.classList.remove("maps-browser");
  ui["google-frame"].src=parsed.url;
  ui.viewer.classList.add("loaded");
  ui.lat.value=parsed.location ? String(parsed.location.lat) : "";
  ui.lng.value=parsed.location ? String(parsed.location.lng) : "";
  ui["calibration-confirmed"].checked=false;
  if(Number.isFinite(parsed.heading)) ui.heading.value=String(parsed.heading);
  // Pitch is deliberately NOT inferred from undocumented Google embed URL internals.
  switchMode("navigate");
  notice("Originele Google-insluiting geladen. Beweeg het panorama naar wens, kalibreer de camera en ga daarna meten.");
  updateTerrain();
});
ui["google-frame"].addEventListener("load",()=>{
  if(state.loaded)notice("Google-frame geopend. Controleer dat je Street View ziet, niet alleen de plattegrond.");
});
ui.navigate.addEventListener("click",()=>switchMode("navigate"));
ui.measure.addEventListener("click",()=>switchMode("measure"));
ui.overlay.addEventListener("click",addClick);
ui["new-line"].addEventListener("click",newLine);
ui.undo.addEventListener("click",undo);
ui.clear.addEventListener("click",()=>resetMeasurements("Alle metingen gewist."));
ui.export.addEventListener("click",exportCsv);
ui.ahn.addEventListener("change",()=>{
  state.useAHN=ui.ahn.checked;
  resetMeasurements("Meetmodel veranderd: plaats punten opnieuw.");
  updateTerrain();
});
ui["ahn-layer"].addEventListener("change",()=>{
  state.surfaceLayer=ui["ahn-layer"].value===AHN_SURFACE_LAYER?AHN_SURFACE_LAYER:AHN_LAYER;
  if(state.mode==="measure")switchMode("navigate");
  resetMeasurements(state.surfaceLayer===AHN_SURFACE_LAYER
    ? "DSM actief: meting op bovenoppervlakken, inclusief daken en bomen."
    : "DTM actief: meting op maaiveld zonder gebouwen.");
  render();
});
for(const id of ["lat","lng","height","heading","pitch","fov"]) {
  ui[id].addEventListener("change",()=>{
    ui["calibration-confirmed"].checked=false;
    if(state.mode==="measure")switchMode("navigate");
    resetMeasurements("Camerakalibratie gewijzigd: oude meetpunten gewist.");
    if(["lat","lng"].includes(id))updateTerrain();
    else render();
  });
}
ui["refresh-ahn"].addEventListener("click",()=>{
  resetMeasurements("AHN wordt opnieuw opgehaald.");
  AHN.clear();
  updateTerrain();
});
new ResizeObserver(render).observe(ui.viewer);
summary();
// Start directly in Google Maps. Copying an iframe is an optional fallback.
showBrowser();
