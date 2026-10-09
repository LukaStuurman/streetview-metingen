import {
  AHNClient, AHN_LAYER, AHN_SURFACE_LAYER, offsetLocation,
  terrainRayIntersection, horizontalDistance
} from "../src/ahn.mjs";
import {
  groundFromRay, pixelFromWorld, rayFromPixel,
  pointAtHorizontalDistance, rayDepressionDegrees, MAX_GROUND_DISTANCE_M
} from "../src/geometry.mjs";
import { pointCoordinates as rawPointCoordinates } from "../src/rd.mjs";
import { triangulatePanoramas } from "../src/triangulation.mjs";
import { mapSnapshot, MAP_COLORS } from "./aerial-map-model.mjs";
import { calibrationScope, fitCalibration, correctedCoordinates, addReference } from "./map-calibration.mjs";
import {
  parseEmbedHtml, inspectGoogleMapsViewUrl, cameraPoseChanged, viewFromFields, streetViewLink
} from "./measurement-helpers.mjs";

const $ = id => document.getElementById(id);
const ui = Object.fromEntries([
  "embed","open-maps","load","maps-browser","reload-maps","check-camera-url",
  "maps-url","maps-url-reason","use-iframe","google-browser","open-aerial-map","map-calibration-status","streetview-link","open-streetview-link",
  "lat","lng","heading","pitch","fov","fov-axis","height","camera-sync-status",
  "ahn","ahn-layer","ahn-status","refresh-ahn","point-results",
  "tri-start","tri-stop","tri-undo","tri-export","tri-results","tri-status",
  "navigate","measure","new-line","undo",
  "clear","export","results","viewer","google-frame","overlay","notice"
].map(id => [id, $(id)]));
const ctx = ui.overlay.getContext("2d");
const AHN = new AHNClient();
const colorSet = MAP_COLORS;
let lastMapSnapshot = "";
const calibrations = new Map();
let calibrationSaving = false;
let calibrationFeedback = "";
let lastCalibrationContext = null;
const state = {
  loaded:false, mode:"navigate", useAHN:true, cameraPositionConfirmed:true,
  surfaceLayer:AHN_LAYER, display:"embed",
  baseZ:null, lines:[[]], pending:null, epoch:0, terrainEpoch:0,
  lastGoogleViewUrl:null, lastGooglePose:null, canRender:false,
  triangulation:{active:false,observations:[],result:null}
};

function notice(text, error=false) {
  ui.notice.textContent = text;
  ui.notice.classList.toggle("error",error);
}
function n(id) { return Number(ui[id].value); }
function validCalibration() {
  if(!state.cameraPositionConfirmed)return false;
  const lat=n("lat"),lng=n("lng"),h=n("height");
  const fov=n("fov"),pitch=n("pitch"),heading=n("heading");
  return ["lat","lng","heading","pitch","fov","height"].every(id=>ui[id].value.trim()!=="") &&
    Number.isFinite(lat)&&lat>=-90&&lat<=90 &&
    Number.isFinite(lng)&&lng>=-180&&lng<=180 &&
    Number.isFinite(h)&&h>=0.5&&h<=5 &&
    Number.isFinite(fov)&&fov>=10&&fov<=120 &&
    ["horizontal","vertical"].includes(ui["fov-axis"].value) &&
    Number.isFinite(pitch)&&Math.abs(pitch)<=90 &&
    Number.isFinite(heading)&&heading>=0&&heading<=360;
}
function cameraLocation() {return {lat:n("lat"),lng:n("lng")};}
function currentCalibrationKey() {
  return state.loaded && validCalibration()
    ? calibrationScope(state.lastGoogleViewUrl,cameraLocation(),
      state.useAHN?state.surfaceLayer:"flat",n("height"),ui["fov-axis"].value) : null;
}
function pointCoordinates(point,origin) {
  return correctedCoordinates(rawPointCoordinates(point,origin,offsetLocation),
    calibrations.get(currentCalibrationKey()),point.mapRD,origin);
}
function measuredDistances(a,b) {
  const ca=pointCoordinates(a,cameraLocation()),cb=pointCoordinates(b,cameraLocation());
  const plan=ca?.rd&&cb?.rd&&(ca.correction||cb.correction)
    ? Math.hypot(cb.rd.x-ca.rd.x,cb.rd.y-ca.rd.y) : horizontalDistance(a,b);
  return {plan,three:Math.hypot(plan,b.z-a.z)};
}
function view() {
  const rectangle=ui.overlay.getBoundingClientRect();
  return viewFromFields({
    width:rectangle.width,height:rectangle.height,
    heading:n("heading"),pitch:n("pitch"),fov:n("fov"),fovAxis:ui["fov-axis"].value
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
function renderTriangulation() {
  synchronizeAerialMap();
  const tri=state.triangulation;
  const dest=ui["tri-results"];
  dest.replaceChildren();
  const status=tri.result?.status;
  const count=tri.observations.length;
  if(!count){
    ui["tri-status"].textContent=tri.active
      ? "Doel actief. Ga naar Street View, kies Meetpunten zetten en klik het doelobject."
      : "Nog geen waarnemingen. Start een doel voor triangulatie.";
    return;
  }
  const info=document.createElement("p");
  info.className="tri-count";
  info.textContent=count+" camera-waarneming"+(count===1?"":"en")+" opgeslagen. "+
    (tri.active?"Navigeer naar een volgende panorama en klik hetzelfde object opnieuw.":"Doel afgesloten.");
  dest.append(info);
  if(tri.result?.status==="ok"){
    const result=tri.result;
    const fields=[
      ["RD X",result.point.rd?format(result.point.rd.x,2)+" m":"Buiten RD-gebied"],
      ["RD Y",result.point.rd?format(result.point.rd.y,2)+" m":"Buiten RD-gebied"],
      ["Latitude",result.point.lat.toFixed(7)],
      ["Longitude",result.point.lng.toFixed(7)],
      ["X lokaal t.o.v. camera 1",format(result.point.e,1)+" m"],
      ["Y lokaal t.o.v. camera 1",format(result.point.n,1)+" m"],
      ["Max. camerabasis",format(result.baselineM,1)+" m"],
      ["Snijhoek",format(result.angleDeg,1)+"°"],
      ["Lijnrestfout RMS",format(result.residualRmsM,2)+" m"],
      ["Indicatie bij 1° richtingsfout",format(result.sensitivityAtOneDegreeM,1)+" m"],
      ["Z uit kijklijnen",Number.isFinite(result.point.z)
        ?format(result.point.z,2)+" m NAP":"Niet beschikbaar"],
      ["Verschil tussen Z-schattingen",Number.isFinite(result.zSpreadM)
        ?format(result.zSpreadM,2)+" m":"Niet beschikbaar"],
      ["Betrouwbaarheid",result.quality==="low"?"Zwakke geometrie / hoge onzekerheid":
        "Indicatief; niet landmeetkundig betrouwbaar"]
    ];
    const table=document.createElement("div");
    table.className="tri-grid";
    for(const [label,value] of fields){
      const wrap=document.createElement("div");wrap.className="tri-pair";
      const key=document.createElement("span");key.textContent=label;
      const val=document.createElement("strong");val.textContent=value;
      wrap.append(key,val);table.append(wrap);
    }
    dest.append(table);
    ui["tri-status"].textContent=result.quality==="low"
      ? "Triangulatie zwak: vergroot de camerabasis of kies kijklijnen onder een andere hoek."
      : "Triangulatie berekend uit "+count+" onafhankelijke opnameposities. X/Y zijn indicatief.";
  }else{
    ui["tri-status"].textContent=tri.result?.message||
      "Markeer hetzelfde object vanuit minimaal twee verschillende camera's.";
  }
  const list=document.createElement("div");list.className="tri-observations";
  tri.observations.forEach((observation,index)=>{
    const item=document.createElement("div");
    item.textContent=(index+1)+". Camera "+observation.lat.toFixed(6)+", "+
      observation.lng.toFixed(6)+" · richting "+
      format((Math.atan2(observation.ray.e,observation.ray.n)*180/Math.PI+360)%360,1)+"°";
    list.append(item);
  });
  dest.append(list);
}
function synchronizeAerialMap(force = false) {
  if (!window.aerialMap) return;
  const snapshot = mapSnapshot({ lines: state.lines,
    origin: state.loaded && validCalibration() ? cameraLocation() : null,
    heading: n("heading"), triangulation: state.triangulation.result,
    coordinates:pointCoordinates });
  snapshot.contextKey=currentCalibrationKey();
  if(snapshot.contextKey!==lastCalibrationContext) {
    calibrationFeedback="";lastCalibrationContext=snapshot.contextKey;
  }
  const record=calibrations.get(snapshot.contextKey),model=fitCalibration(record?.references);
  snapshot.calibration={count:record?.references.length || 0,kind:model?.kind || null,saving:calibrationSaving,feedback:calibrationFeedback};
  ui["map-calibration-status"].textContent=record
    ? `Kaartkalibratie actief voor dit standpunt: ${record.references.length} referentiepunt${record.references.length===1?"":"en"}.`
    : "Verplaats meetpunten in de luchtfotokaart om dit standpunt te kalibreren.";
  const serialized = JSON.stringify(snapshot);
  if (force || serialized !== lastMapSnapshot) {
    lastMapSnapshot = serialized;
    window.aerialMap.publish(snapshot);
  }
}
async function correctFromAerialMap(correction) {
  const key=currentCalibrationKey();
  if(!key||correction.key!==key||calibrationSaving)return;
  let vertex=null,record=null;
  if(!correction.reset) {
    const match=/^P(\d+)\.(\d+)$/.exec(correction.id || "");
    vertex=match&&state.lines[Number(match[1])-1]?.[Number(match[2])-1];
    if(!vertex||!Number.isFinite(correction.x)||!Number.isFinite(correction.y))return;
    const raw=rawPointCoordinates(vertex.point,cameraLocation(),offsetLocation);
    if(!raw?.rd)return;
    record=addReference(calibrations.get(key),key,raw.rd,{x:correction.x,y:correction.y});
  }
  const epoch=state.epoch;
  calibrationFeedback="";calibrationSaving=true; synchronizeAerialMap();
  try {
    await window.aerialMap.saveCalibration(record,key);
    if(record)calibrations.set(key,record);else calibrations.delete(key);
    // The save may finish after navigation. Persist the calibration, but never
    // apply a stale correction to a different current panorama's points.
    if(currentCalibrationKey()===key&&state.epoch===epoch) {
      if(correction.reset)for(const line of state.lines)for(const item of line)delete item.point.mapRD;
      else vertex.point.mapRD={x:correction.x,y:correction.y};
      calibrationFeedback=correction.reset?"Kaartcorrecties voor dit standpunt gewist.":
        "Kaartcorrectie opgeslagen. Volgende meetpunten vanuit dit standpunt gebruiken de kalibratie.";
      notice(calibrationFeedback);
    }
  } catch(error) { calibrationFeedback="Kaartcorrectie niet opgeslagen: "+error.message;notice(calibrationFeedback,true); }
  finally {calibrationSaving=false;render();}
}
function solveTriangulation(){
  state.triangulation.result=triangulatePanoramas(
    state.triangulation.observations,{maxRange:MAX_GROUND_DISTANCE_M});
  renderTriangulation();
}
function beginTriangulation(){
  if(state.mode==="measure")switchMode("navigate");
  resetMeasurements();
  state.triangulation={active:true,observations:[],result:null};
  renderTriangulation();
  notice("Triangulatie: markeer hetzelfde object vanuit minimaal 2 Street View-posities.");
}
function captureTriangulation(ray){
  const tri=state.triangulation;
  if(Math.hypot(ray.e,ray.n)<0.01)
    return notice("Kijk bijna verticaal: deze straal levert geen bruikbare X/Y-richting.",true);
  const loc=cameraLocation();
  const origin=tri.observations[0];
  // A second observation from the same panorama adds no depth information.
  if(origin){
    for(const obs of tri.observations){
      const e=(loc.lng-obs.lng)*111412.84*Math.cos(obs.lat*Math.PI/180);
      const n=(loc.lat-obs.lat)*111132.92;
      if(Math.hypot(e,n)<2){
        notice("Kies een ander Street View-standpunt, minimaal 2 m verplaatst (liefst 5–10 m).",true);
        return;
      }
    }
  }
  tri.observations.push({
    lat:loc.lat,lng:loc.lng,ray:{e:ray.e,n:ray.n,u:ray.u},
    // Only AHN supplies an NAP camera reference; camera height alone is NOT Z in NAP.
    cameraZ:state.useAHN&&Number.isFinite(state.baseZ)?cameraZ():null
  });
  solveTriangulation();
  // The normal overlay freezes the Google browser. Release it so the user
  // can navigate to the NEXT panorama; retained rays stay in separate state.
  switchMode("navigate");
  renderTriangulation();
  notice("Kijkstraal "+tri.observations.length+
    " bewaard. Navigeer naar de volgende panorama, zet Meetpunten en klik hetzelfde doelobject.");
}
function exportTriangulation(){
  const tri=state.triangulation, result=tri.result;
  if(result?.status!=="ok")
    return notice("Voor export zijn minimaal twee niet-parallelle kijkstralen nodig.",true);
  const names=["type","index","camera_lat","camera_lng","doel_lat","doel_lng",
    "RD_X","RD_Y","lokaal_X_m","lokaal_Y_m",
    "Z_kijklijnen_NAP","baseline_m","snijhoek_deg","RMS_restfout_m",
    "gevoeligheid_1deg_m","betrouwbaarheid","bron"];
  const rows=[names.join(";")];
  const p=result.point;
  for(let i=0;i<tri.observations.length;i++){
    const o=tri.observations[i];
    rows.push(["triangulatie",i+1,o.lat.toFixed(8),o.lng.toFixed(8),
      p.lat.toFixed(8),p.lng.toFixed(8),
      p.rd?p.rd.x.toFixed(2):"",p.rd?p.rd.y.toFixed(2):"",
      p.e.toFixed(2),p.n.toFixed(2),
      Number.isFinite(p.z)?p.z.toFixed(2):"",
      result.baselineM.toFixed(2),result.angleDeg.toFixed(2),
      result.residualRmsM.toFixed(2),result.sensitivityAtOneDegreeM.toFixed(2),
      result.quality,"handmatige_correspondentie_panorama_kijklijnen"].join(";"));
  }
  const blob=new Blob(["\ufeff"+rows.join("\r\n")],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download="techbase-streetview-triangulatie-indicatief.csv";
  document.body.append(a);a.click();a.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),2000);
  notice("Triangulatiecoördinaten en kwaliteitsparameters geëxporteerd.");
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
      const distance=measuredDistances(line[i-1].point,line[i].point);
      plan+=distance.plan;
      three+=distance.three;
    }
  }
  rows.push(["Punten",count],["Segmenten",segments],
    ["Horizontale afstand",format(plan)+" m"]);
  if(state.useAHN) {
    rows.push(
      ["AHN-model",state.surfaceLayer===AHN_SURFACE_LAYER?"DSM (dak/object)":"DTM (maaiveld)"],
      ["Rechte 3D-lengte",format(three)+" m"],
      [last?.rangeManual?"Laatste Z kijkstraal (NAP, geen AHN-punthoogte)":
        state.surfaceLayer===AHN_SURFACE_LAYER?"Laatste DSM-hoogte NAP":"Laatste maaiveld NAP",
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
  // Show actual per-point local and Dutch national projected coordinates.
  // The reconstructed location is only as good as the Street View camera
  // pose and AHN ray intersection; never present it as measured survey data.
  const pointContainer=ui["point-results"];
  pointContainer.replaceChildren();
  let found=false;
  const origin=validCalibration()?cameraLocation():null;
  for(let li=0;li<state.lines.length;li++) {
    for(let pi=0;pi<state.lines[li].length;pi++) {
      const vertex=state.lines[li][pi].point;
      const coordinates=pointCoordinates(vertex,origin,offsetLocation);
      if(!coordinates)continue;
      found=true;
      const card=document.createElement("article");
      card.className="point-card";
      const heading=document.createElement("div");
      heading.className="point-card-title";
      heading.textContent="Punt "+(li+1)+"."+(pi+1);
      const grid=document.createElement("div");
      grid.className="point-coords";
      const fields=[
        ["X lokaal",format(coordinates.localX,1)+" m"],
        ["Y lokaal",format(coordinates.localY,1)+" m"],
        ["RD X",coordinates.rd?format(coordinates.rd.x,2)+" m":"Buiten RD-gebied"],
        ["RD Y",coordinates.rd?format(coordinates.rd.y,2)+" m":"Buiten RD-gebied"],
        [coordinates.correction?"Z oorspronkelijke positie":vertex.rangeManual?"Z kijkstraal (NAP)":"Z NAP",
          state.useAHN?format(vertex.z,2)+" m":"—"],
        ["Stelsel","RD New · EPSG:28992"],
        ["Afstand tot camera",format(Math.hypot(vertex.e,vertex.n),1)+" m"],
        ["Bepaling",vertex.rangeManual?"Zelf opgegeven afstand":
          state.useAHN?"Eerste AHN-snijpunt":"Vlakke grond"]
      ];
      if(coordinates.correction)fields.push(["Kaartcorrectie",vertex.mapRD?"Handmatig verplaatst":"Bewaarde kalibratie"]);
      for(const [label,value] of fields) {
        const cell=document.createElement("div");
        cell.className="coord";
        const key=document.createElement("span");
        key.className="key";key.textContent=label;
        const strong=document.createElement("strong");
        strong.textContent=value;
        cell.append(key,strong);grid.append(cell);
      }
      const detail=document.createElement("small");
      const depression=rayDepressionDegrees(state.lines[li][pi].ray);
      const nearHorizon=depression!==null&&Math.abs(depression)<3;
      detail.textContent="Lat "+coordinates.lat.toFixed(8)+
        " / lon "+coordinates.lng.toFixed(8)+
        (nearHorizon?" · Dicht bij horizon: zeer onzeker":"")+
        (coordinates.correction?" · X/Y kaartgecorrigeerd; Z niet herberekend":"")+
        " · Indicatieve coördinaten";
      card.append(heading,grid,detail);
      const correction=document.createElement("div");
      correction.className="range-correction";
      const note=document.createElement("p");
      note.className="range-explanation";
      note.textContent="Ligt het gekozen object verder weg? AHN geeft het eerste geraakte oppervlak, niet de zichtbare objectdiepte. Vul alleen een bekende horizontale afstand in (meter).";
      const line=document.createElement("div");
      line.className="range-actions";
      const rangeInput=document.createElement("input");
      rangeInput.type="number";
      rangeInput.min="0.5";
      rangeInput.max=String(MAX_GROUND_DISTANCE_M);
      rangeInput.step="0.1";
      rangeInput.value=Math.hypot(vertex.e,vertex.n).toFixed(1);
      rangeInput.setAttribute("aria-label","Horizontale afstand camera tot punt "+(li+1)+"."+(pi+1)+" in meter");
      const apply=document.createElement("button");
      apply.type="button";
      apply.className="range-apply";
      apply.textContent="Afstand corrigeren";
      apply.addEventListener("click",()=>correctPointRange(li,pi,rangeInput.value));
      line.append(rangeInput,apply);
      correction.append(note,line);
      if(vertex.rangeManual) {
        const status=document.createElement("p");
        status.className="manual-range-warning";
        const gap=vertex.ahnGap;
        status.textContent=Number.isFinite(gap)
          ? "Zelf opgegeven afstand; hoogteverschil t.o.v. AHN: "+
            format(Math.abs(gap),2)+" m. Z volgt de kijkstraal."
          : "Zelf opgegeven afstand; geen automatische dieptemeting. Z volgt de kijkstraal.";
        correction.append(status);
      }
      card.append(correction);
      pointContainer.append(card);
    }
  }
  if(!found) {
    const empty=document.createElement("p");
    empty.className="point-empty";
    empty.textContent="Nog geen meetpunten. Schakel naar Meetpunten zetten en klik in Street View.";
    pointContainer.append(empty);
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
  renderTriangulation();
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
      const {plan:pl,three}=measuredDistances(vertices[i-1].point,vertices[i].point);
      const label=state.useAHN
        ? format(pl)+" m • 3D "+format(three)+" m" : format(pl)+" m";
      drawTag(label,(a.x+b.x)/2,(a.y+b.y)/2-13,color,rect);
    }
    projected.forEach((p,i)=>{
      if(!p||p.x<0||p.x>rect.width||p.y<0||p.y>rect.height)return;
      ctx.beginPath();ctx.arc(p.x,p.y,6,0,Math.PI*2);
      ctx.fillStyle=color;ctx.fill();ctx.strokeStyle="#251b19";ctx.lineWidth=2;ctx.stroke();
      const coords=pointCoordinates(vertices[i].point,cameraLocation(),offsetLocation);
      const pointId="P"+(idx+1)+"."+(i+1);
      const rdText=coords?.rd
        ? " · RD "+Math.round(coords.rd.x)+" / "+Math.round(coords.rd.y)
        : " · X "+format(vertices[i].point.e,1)+" / Y "+format(vertices[i].point.n,1);
      drawTag(pointId+rdText,p.x,p.y-15,color,rect);
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
    if(!state.loaded)return notice("Open eerst Google Street View.",true);
    if(!validCalibration())return notice("Controleer alle cameravelden.",true);
    if(!state.triangulation.active && state.useAHN&&state.baseZ===null)
      return notice("Wacht tot AHN is geladen of zet AHN uit.",true);
    if(state.mode!=="measure")resetMeasurements(
      state.triangulation.active?"Triangulatie: klik het te volgen object aan.":
      state.surfaceLayer===AHN_SURFACE_LAYER && state.useAHN
        ? "Meetbeeld vergrendeld: klik op een zichtbaar dak of bovenvlak. DSM bevat ook bomen."
        : "Meetbeeld vergrendeld. Klik op de grond om punten te plaatsen."
    );
  } else if(state.mode==="measure") {
    resetMeasurements("Navigatiemodus: metingen gewist. Controleer de camerastand na draaien of verplaatsen.");
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
  if(state.triangulation.active)return captureTriangulation(ray);
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
          : "Geen AHN-terreinsnijpunt binnen "+MAX_GROUND_DISTANCE_M+" meter.";
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
    if(!p)return notice("Klik op maaiveld onder de horizon binnen "+MAX_GROUND_DISTANCE_M+" meter.",true);
    point={...p,z:0};
  }
  if(stamp!==state.epoch)return;
  state.lines[state.lines.length-1].push({ray,point});
  render();
  const range=Math.hypot(point.e,point.n);
  const depression=rayDepressionDegrees(ray);
  const condition=depression!==null&&Math.abs(depression)<3
    ? " Dicht bij de horizon: kleine hoekfouten veroorzaken grote afstandsfouten."
    : "";
  notice("Eerste "+(state.useAHN?"AHN-":"grond-")+"snijpunt op "+
    format(range,1)+" m. Controleer dit bij verre objecten; pas eventueel de afstand aan."+
    condition);
}

async function correctPointRange(lineIndex,pointIndex,rawInput) {
  const range=Number(rawInput);
  if(!rawInput.trim() || !Number.isFinite(range) ||
     range<0.5 || range>MAX_GROUND_DISTANCE_M)
    return notice("Geef een bekende afstand van 0,5 tot "+
      MAX_GROUND_DISTANCE_M+" meter in.",true);
  const vertex=state.lines[lineIndex]?.[pointIndex];
  const elevation=cameraZ();
  if(!vertex || !Number.isFinite(elevation) || state.pending)
    return notice("Meetpunt/camerahoogte niet beschikbaar of nog bezig.",true);
  const corrected=pointAtHorizontalDistance(vertex.ray,range,elevation);
  if(!corrected)return notice("Dit punt kan niet langs de kijkstraal worden berekend.",true);
  const epoch=state.epoch;
  const controller=new AbortController();
  state.pending=controller;
  notice("Nieuwe positie op "+format(range,1)+" m bepalen; AHN controleren…");
  let groundZ=null,surfaceZ=null;
  try {
    if(state.useAHN) {
      const position=offsetLocation(cameraLocation(),corrected.e,corrected.n);
      if(!position)throw new Error("Ongeldige doelcoördinaten");
      surfaceZ=await AHN.height(position.lat,position.lng,controller.signal,state.surfaceLayer);
      if(state.surfaceLayer===AHN_SURFACE_LAYER)
        groundZ=await AHN.height(position.lat,position.lng,controller.signal,AHN_LAYER);
      else groundZ=surfaceZ;
    }
    if(epoch!==state.epoch || controller.signal.aborted)return;
    vertex.point={
      ...corrected,
      rangeManual:true,
      ahnGap:Number.isFinite(surfaceZ)?corrected.z-surfaceZ:null,
      groundZ,
      objectHeight:Number.isFinite(surfaceZ)&&Number.isFinite(groundZ)
        ? Math.max(0,surfaceZ-groundZ) : null
    };
    render();
    const gap=vertex.point.ahnGap;
    notice("Afstand handmatig ingesteld op "+format(range,1)+" m. "+
      (Number.isFinite(gap) ?
        "Hoogteverschil kijkstraal/AHN: "+format(Math.abs(gap),2)+" m. " : "")+
      "RD X/Y zijn nu berekend op basis van jouw opgegeven afstand; "+
      "het beeld levert geen automatische objectdiepte.",Number.isFinite(gap)&&Math.abs(gap)>1);
  }catch(error){
    if(epoch===state.epoch&&!controller.signal.aborted)
      notice("Afstand niet aangepast: "+error.message,true);
  }finally{
    if(state.pending===controller)state.pending=null;
  }
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
    "AHN_model","maaiveld_DTM_NAP_m","DSM_min_DTM_m",
    "lokaal_X_meter","lokaal_Y_meter","RD_X_meter","RD_Y_meter","RD_EPSG",
    "afstand_camera_m","diepte_methode","AHN_hoogteverschil_m",
    "hoogtebron","kaartcorrectie","RD_X_origineel","RD_Y_origineel","kaartkalibratie_standpunt",
    "lokaal_X_origineel","lokaal_Y_origineel"].join(";")];
  const origin=cameraLocation();
  for(let line=0;line<state.lines.length;line++){
    for(let i=0;i<state.lines[line].length;i++){
      const p=state.lines[line][i].point;
      const coords=pointCoordinates(p,origin,offsetLocation);
      if(!coords)continue;
      lines.push([line+1,i+1,coords.lat.toFixed(8),coords.lng.toFixed(8),
        state.useAHN?p.z.toFixed(2):"",
        state.useAHN?state.surfaceLayer:"vlak",
        state.useAHN&&Number.isFinite(p.groundZ)?p.groundZ.toFixed(2):
          state.useAHN&&state.surfaceLayer===AHN_LAYER?p.z.toFixed(2):"",
        state.useAHN&&Number.isFinite(p.objectHeight)?p.objectHeight.toFixed(2):"",
        coords.localX.toFixed(2),coords.localY.toFixed(2),
        coords.rd?coords.rd.x.toFixed(2):"",
        coords.rd?coords.rd.y.toFixed(2):"",
        coords.rd?"EPSG:28992":"",
        Math.hypot(p.e,p.n).toFixed(2),
        p.rangeManual?"handmatige_afstand":
          state.useAHN?"eerste_AHN_snijding":"vlak_maaiveld",
        Number.isFinite(p.ahnGap)?p.ahnGap.toFixed(2):"",
        !state.useAHN?"geen_NAP":coords.correction?"oorspronkelijke_posities_Z_niet_herberekend":p.rangeManual?"kijkstraal_NAP_niet_AHN":"AHN",
        coords.correction || "",(coords.rawRD || coords.rd)?.x.toFixed(2) || "",
        (coords.rawRD || coords.rd)?.y.toFixed(2) || "",coords.correction?currentCalibrationKey():"",
        (coords.rawLocalX ?? coords.localX).toFixed(2),(coords.rawLocalY ?? coords.localY).toFixed(2)
        ].join(";"));
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
function showBrowser(initialUrl) {
  state.cameraPositionConfirmed=true;
  if(state.mode==="measure")switchMode("navigate");
  resetMeasurements("Google Maps geopend. Kies een Street View-foto in het kaartbeeld.");
  state.display="maps";
  state.loaded=true;
  // Never reuse coordinates left over from a different previously opened iframe.
  ui.lat.value="";
  ui.lng.value="";
  ui.heading.value="";
  ui.pitch.value="";
  ui.fov.value="";
  ui["fov-axis"].value="horizontal";
  state.lastGoogleViewUrl=null;
  state.lastGooglePose=null;
  ui["maps-url"].value="";
  ui["maps-url-reason"].textContent="Google Maps-browser opent…";
  ui["camera-sync-status"].textContent="URL-synchronisatie actief. Open Street View; Google bepaalt wanneer camerawijzigingen in de URL verschijnen.";
  ui["ahn-status"].textContent="Navigeer eerst naar Street View in Google Maps.";
  ui.viewer.classList.add("loaded","maps-browser");
  const guest=ui["google-browser"];
  if(typeof initialUrl==="string")guest.setAttribute("src",initialUrl);
  else if(!guest.getAttribute("src"))guest.setAttribute("src","https://www.google.com/maps");
  updateTerrain();
}

function showIframe() {
  state.cameraPositionConfirmed=true;
  if(state.mode==="measure")switchMode("navigate");
  resetMeasurements("Insluitmodus: plak de Google Maps-sharecode of laad eerder gebruikte iframe.");
  state.display="embed";
  ui["fov-axis"].value="horizontal";
  state.lastGoogleViewUrl=null;
  state.lastGooglePose=null;
  ui["camera-sync-status"].textContent="Insluitmodus: geen live camera-URL beschikbaar. Handmatige kalibratie vereist.";
  ui.viewer.classList.remove("maps-browser");
  state.loaded=Boolean(ui["google-frame"].getAttribute("src"));
  updateTerrain();
}

function googleUrlChanged(url) {
  if(state.display!=="maps" || !url)return;
  // Always show the real URL, even when no Street View pose is exposed.
  // No Google internals, panorama tiles, requests, or account data are read.
  ui["maps-url"].value=url;
  if(url===state.lastGoogleViewUrl)return;
  try {
    const u = new URL(url);
    if(["consent.google.com","consent.google.nl"].includes(u.hostname)) {
      ui["camera-sync-status"].textContent="Google-cookiepagina: camerastand niet beschikbaar.";
      notice("Kies zelf Alles accepteren of Alles weigeren. Je cookiekeuze wordt bewaard.",false);
      return;
    }
  } catch { /* An unrecognised URL cannot provide a camera pose. */ }
  state.lastGoogleViewUrl=url;

  const inspected=inspectGoogleMapsViewUrl(url);
  const hint=inspected.pose;
  ui["maps-url-reason"].textContent=inspected.reason;
  if(!hint) {
    // Leaving Street View invalidates any camera values previously read from it.
    if(state.lastGooglePose) {
      if(state.mode==="measure")switchMode("navigate");
      resetMeasurements();
      ui.lat.value="";ui.lng.value="";
      ui.heading.value="";ui.pitch.value="";ui.fov.value="";
      state.lastGooglePose=null;
      updateTerrain();
    }
    ui["camera-sync-status"].textContent=inspected.reason;
    return;
  }

  // Ignore unrelated Google URL changes (query strings, page metadata).
  if(!cameraPoseChanged(state.lastGooglePose,hint))return;
  const oldPose=state.lastGooglePose;
  const wasConfirmed=state.cameraPositionConfirmed;
  state.cameraPositionConfirmed=inspected.kind!=="pano-action";
  state.lastGooglePose=hint;
  if(state.mode==="measure")switchMode("navigate");
  resetMeasurements();
  // Missing parameters must never retain calibration from a previous view.
  ui.lat.value=String(hint.lat);
  ui.lng.value=String(hint.lng);
  ui.heading.value=hint.heading===null?"":String(hint.heading);
  ui.pitch.value=hint.pitch===null?"":String(hint.pitch);
  ui.fov.value=hint.fov===null?"":String(hint.fov);
  ui["fov-axis"].value=hint.fovAxis;

  const complete=[hint.heading,hint.pitch,hint.fov].every(Number.isFinite);
  ui["camera-sync-status"].textContent=complete
    ? "Camera bijgewerkt vanuit Google Maps-URL: richting, helling en beeldhoek. Niet gegarandeerd tijdens slepen; controleer voor meten."
    : "URL geeft slechts gedeeltelijke cameragegevens. Vul ontbrekende waarden handmatig in en controleer voor meten.";
  if(!state.cameraPositionConfirmed)ui["camera-sync-status"].textContent=
    "Deze zoeklink geeft een gewenste locatie, niet de bevestigde camerapositie. Draai het panorama kort zodat Google de opname-URL bijwerkt, of vul de werkelijke camera-coördinaten zelf in.";

  const moved=!oldPose ||
    Math.abs(oldPose.lat-hint.lat)>0.0000001 ||
    Math.abs(oldPose.lng-hint.lng)>0.0000001;
  if(moved||!wasConfirmed)updateTerrain();
  else render();
}

function pollGoogleCameraUrl() {
  if(state.display!=="maps")return;
  const guest=ui["google-browser"];
  if(typeof guest.getURL!=="function")return;
  try {
    const currentUrl=guest.getURL();
    if(currentUrl)googleUrlChanged(currentUrl);
  } catch {
    // The guest may not be ready immediately after app startup.
  }
}

ui["maps-browser"].addEventListener("click",showBrowser);
ui["open-streetview-link"].addEventListener("click",()=>{
  try {showBrowser(streetViewLink(ui["streetview-link"].value));}
  catch(error){notice(error.message,true);}
});
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
guest.addEventListener("did-navigate-in-page",event=>{
  if(event.isMainFrame)googleUrlChanged(event.url);
});
// Electron emits URL events on navigation, but Google Maps may update its
// address-bar orientation between these events. Poll ONLY guest.getURL();
// never inject scripts into Google's page or call undocumented Maps APIs.
window.setInterval(pollGoogleCameraUrl,250);
ui["check-camera-url"].addEventListener("click",()=>{
  state.lastGoogleViewUrl=null; // show up-to-date reason, even if URL unchanged
  pollGoogleCameraUrl();
  ui["maps-url"].focus();
  ui["maps-url"].select();
});
guest.addEventListener("did-fail-load",event=>{
  if(state.display==="maps" && event.isMainFrame)
    notice("Google Maps kon niet in de ingebouwde browser laden. Gebruik eventueel de insluitlink.",true);
});
guest.addEventListener("dom-ready",()=>{
  if(state.display==="maps") {
    notice("Google Maps geladen: open Street View met de blauwe lijnen of Street View-foto.",false);
    pollGoogleCameraUrl();
  }
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
  state.lastGoogleViewUrl=null;
  state.lastGooglePose=null;
  ui["camera-sync-status"].textContent="Insluitmodus: Google geeft geen live camera-URL door. Handmatig kalibreren.";
  ui.viewer.classList.remove("maps-browser");
  ui["google-frame"].src=parsed.url;
  ui["fov-axis"].value="horizontal";
  ui.viewer.classList.add("loaded");
  ui.lat.value=parsed.location ? String(parsed.location.lat) : "";
  ui.lng.value=parsed.location ? String(parsed.location.lng) : "";
  if(Number.isFinite(parsed.heading)) ui.heading.value=String(parsed.heading);
  // Pitch is deliberately NOT inferred from undocumented Google embed URL internals.
  switchMode("navigate");
  notice("Originele Google-insluiting geladen. Beweeg het panorama naar wens, kalibreer de camera en ga daarna meten.");
  updateTerrain();
});
ui["google-frame"].addEventListener("load",()=>{
  if(state.loaded)notice("Google-frame geopend. Controleer dat je Street View ziet, niet alleen de plattegrond.");
});
ui["tri-start"].addEventListener("click",beginTriangulation);
ui["open-aerial-map"].addEventListener("click",()=>{
  if (!window.aerialMap) return notice("Het kaartvenster is beschikbaar in de Windows-app.",true);
  synchronizeAerialMap(true);
  window.aerialMap.open();
});
ui["tri-stop"].addEventListener("click",()=>{
  state.triangulation.active=false;
  if(state.mode==="measure")switchMode("navigate");
  renderTriangulation();
  notice("Triangulatie afgesloten. Resultaat en CSV blijven beschikbaar.");
});
ui["tri-undo"].addEventListener("click",()=>{
  if(state.triangulation.observations.length){
    state.triangulation.observations.pop();
    solveTriangulation();
    notice("Laatste camerawaarneming verwijderd.");
  }
});
ui["tri-export"].addEventListener("click",exportTriangulation);
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
for(const id of ["lat","lng","height","heading","pitch","fov","fov-axis"]) {
  ui[id].addEventListener("change",()=>{
    if(["lat","lng"].includes(id))state.cameraPositionConfirmed=true;
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
if(window.aerialMap) {
  window.aerialMap.onCorrection(correctFromAerialMap);
  window.aerialMap.loadCalibrations().then(records=>{
    for(const record of records)calibrations.set(record.key,record);
    render();
  }).catch(error=>notice("Bewaarde kaartkalibraties niet geladen: "+error.message,true));
}
summary();
// Start directly in Google Maps. Copying an iframe is an optional fallback.
showBrowser();
