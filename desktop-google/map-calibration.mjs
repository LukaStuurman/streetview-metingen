import { wgs84ToRD } from "../src/rd.mjs";
import { localOffsetFromLocation } from "../src/ahn.mjs";

export function calibrationKey(urlText, origin) {
  if (!origin || ![origin.lat, origin.lng].every(Number.isFinite)) return null;
  const position = `${origin.lat.toFixed(7)},${origin.lng.toFixed(7)}`;
  try {
    const url = new URL(urlText);
    const id = url.searchParams.get("pano") || /!1s([^!/?]+)/.exec(url.pathname)?.[1];
    if (id) return `pano:${id.slice(0,160)}@${position}`;
  } catch { /* Manual/embed calibration is scoped to its supplied camera position. */ }
  return `camera:${position}`;
}

const median = values => {
  const sorted = [...values].sort((a,b) => a-b), middle = Math.floor(sorted.length/2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle-1]+sorted[middle])/2;
};

export function calibrationScope(url,origin,mode,height,fovAxis="vertical") {
  const key=calibrationKey(url,origin);
  if(!key||!Number.isFinite(height)||!["horizontal","vertical"].includes(fovAxis))return null;
  // Preserve existing website (vertical) references. Horizontal calibration
  // uses a separate scope so changing projection cannot reuse those offsets.
  const scope=`${key}/model:${mode}/height:${height.toFixed(3)}`;
  return fovAxis==="vertical"?scope:`${scope}/axis:horizontal`;
}

function translationFit(references) {
  return {
    kind:"translation", count:references.length, a:1, b:0, cx:0, cy:0,
    tx:median(references.map(r => r.x-r.rawX)),
    ty:median(references.map(r => r.y-r.rawY))
  };
}
function similarityFit(references) {
  if (references.length >= 3) {
    const mean = key => references.reduce((sum,r) => sum+r[key],0)/references.length;
    const cx=mean("rawX"),cy=mean("rawY"),tx=mean("x"),ty=mean("y");
    let denominator=0,numeratorA=0,numeratorB=0;
    for(const r of references) {
      const px=r.rawX-cx,py=r.rawY-cy,qx=r.x-tx,qy=r.y-ty;
      denominator+=px*px+py*py;
      numeratorA+=px*qx+py*qy; numeratorB+=px*qy-py*qx;
    }
    if (denominator/references.length >= 9) {
      const a=numeratorA/denominator,b=numeratorB/denominator;
      const scale=Math.hypot(a,b),angle=Math.atan2(b,a)*180/Math.PI;
      const candidate={kind:"similarity",count:references.length,a,b,cx,cy,tx,ty};
      const candidateErrors=references.map(r=>referenceError(r,candidate));
      if(scale>=0.7&&scale<=1.3&&Math.abs(angle)<=10&&
        Math.max(...candidateErrors)<=2)return candidate;
    }
  }
  return null;
}
const rms=values=>Math.sqrt(values.reduce((sum,n)=>sum+n*n,0)/values.length);
function referenceError(reference,model) {
  const p=applyCalibration(reference.rawX,reference.rawY,model);
  return Math.hypot(p.x-reference.x,p.y-reference.y);
}

/** Learn the registration for any panorama, without a country-wide offset.
 * Extra parameters must predict references excluded from their own fit.
 * Three fitted points alone cannot prove that scale/angle helps future points.
 */
export function fitCalibration(references = []) {
  if (!references.length) return null;
  const translation=translationFit(references);
  if(references.length<4)return translation;
  const candidate=similarityFit(references);
  if(!candidate || rms(references.map(r=>referenceError(r,candidate)))>=
      rms(references.map(r=>referenceError(r,translation)))*0.8)return translation;
  const predicted=[],baseline=[];
  for(let index=0;index<references.length;index++) {
    const training=references.filter((_,i)=>i!==index);
    const heldOut=references[index],model=similarityFit(training);
    // An unstable fit or insufficient spacing retains the simpler model.
    if(!model)return translation;
    predicted.push(referenceError(heldOut,model));
    baseline.push(referenceError(heldOut,translationFit(training)));
  }
  const validationErrorM=rms(predicted),baselineErrorM=rms(baseline);
  if(validationErrorM>=baselineErrorM*0.8)return translation;
  return {...candidate,validation:{method:"leave-one-out",validationErrorM,baselineErrorM}};
}

export function applyCalibration(x,y,model) {
  if (!model) return {x,y};
  return {x:model.tx+model.a*(x-model.cx)-model.b*(y-model.cy),
    y:model.ty+model.b*(x-model.cx)+model.a*(y-model.cy)};
}

/** Numerically invert the SAME approximate RD polynomial used for CSV output. */
export function geographicFromRD(x,y,seed) {
  let lat=seed.lat,lng=seed.lng;
  for(let step=0;step<6;step++) {
    const p=wgs84ToRD(lat,lng),north=wgs84ToRD(lat+0.000001,lng),east=wgs84ToRD(lat,lng+0.000001);
    if(!p||!north||!east)return null;
    const dx=x-p.x,dy=y-p.y;
    if(Math.hypot(dx,dy)<0.0001)return {lat,lng};
    const j11=(north.x-p.x)/0.000001,j12=(east.x-p.x)/0.000001;
    const j21=(north.y-p.y)/0.000001,j22=(east.y-p.y)/0.000001;
    const determinant=j11*j22-j12*j21;
    if(!Number.isFinite(determinant)||Math.abs(determinant)<1)return null;
    lat+=(dx*j22-j12*dy)/determinant; lng+=(j11*dy-dx*j21)/determinant;
  }
  return null;
}

export function correctedCoordinates(coords,record,override,origin) {
  if(!coords?.rd)return coords;
  const model=fitCalibration(record?.references);
  if(!override&&!model)return coords;
  const rd=override || applyCalibration(coords.rd.x,coords.rd.y,model);
  const geo=geographicFromRD(rd.x,rd.y,coords);
  if(!geo)return coords;
  const local=localOffsetFromLocation(origin,geo);
  return {...coords,...geo,...(local?{localX:local.e,localY:local.n}:{}),rd,rawRD:coords.rd,
    rawLocalX:coords.localX,rawLocalY:coords.localY,
    correction:override?"handmatige_kaartcorrectie":`kaartkalibratie_${model.kind}`};
}

export function addReference(record,key,raw,corrected) {
  const references=(record?.references || []).filter(r => Math.hypot(r.rawX-raw.x,r.rawY-raw.y)>0.03);
  references.push({rawX:raw.x,rawY:raw.y,x:corrected.x,y:corrected.y});
  return {key,references:references.slice(-30)};
}
