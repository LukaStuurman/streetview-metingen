/**
 * Keyless, user-assisted multi-panorama intersection in a local east/north
 * tangent plane. No panorama discovery or Street View tile access.
 * Observations are { lat, lng, ray:{e,n,u}, cameraZ? } for THE SAME target.
 * Angles come from user-visible Google URL hints/manual camera calibration.
 */
import {offsetLocation} from "./ahn.mjs";
import {wgs84ToRD} from "./rd.mjs";

const RAD=Math.PI/180;
const LAT_M=lat=>111132.92-559.82*Math.cos(2*lat*RAD);
const LON_M=lat=>111412.84*Math.cos(lat*RAD)-93.5*Math.cos(3*lat*RAD);
const finite=(...values)=>values.every(Number.isFinite);

export function triangulatePanoramas(observations, {maxRange=500,minBaseline=2}={}) {
  if(!Array.isArray(observations)||observations.length<2)
    return {status:"need-two",message:"Markeer hetzelfde punt vanuit minimaal twee verschillende Street View-posities."};
  if(observations.length>30)return {status:"invalid",message:"Maximaal 30 waarnemingen per doel."};
  const first=observations[0];
  if(!finite(first?.lat,first?.lng)||Math.abs(first.lat)>90||Math.abs(first.lng)>180)
    return {status:"invalid"};
  const lat0=first.lat,lng0=first.lng;
  const cameras=[];
  for(const observation of observations){
    if(!finite(observation?.lat,observation?.lng,observation?.ray?.e,
      observation?.ray?.n,observation?.ray?.u)||
      Math.abs(observation.lat)>90||Math.abs(observation.lng)>180)
      return {status:"invalid",message:"Eén of meer camera's hebben ongeldige gegevens."};
    const e=(observation.lng-lng0)*LON_M(lat0);
    const n=(observation.lat-lat0)*LAT_M(lat0);
    const magnitude=Math.hypot(observation.ray.e,observation.ray.n);
    if(magnitude<1e-8)return {status:"invalid",message:"De kijkstraal wijst vrijwel verticaal."};
    cameras.push({e,n,de:observation.ray.e/magnitude,
      dn:observation.ray.n/magnitude,slope:observation.ray.u/magnitude,
      cameraZ:observation.cameraZ});
  }
  let baseline=0,maxAngle=0;
  for(let i=0;i<cameras.length;i++)for(let j=i+1;j<cameras.length;j++){
    const a=cameras[i],b=cameras[j];
    baseline=Math.max(baseline,Math.hypot(b.e-a.e,b.n-a.n));
    const cross=Math.abs(a.de*b.dn-a.dn*b.de);
    // angle between two infinite bearing lines, 0–90deg
    maxAngle=Math.max(maxAngle,Math.asin(Math.min(1,cross))/RAD);
  }
  if(baseline<minBaseline)
    return {status:"baseline",baselineM:baseline,
      message:"Kies een andere Street View-positie, liefst minstens 5–10 m verderop."};
  if(maxAngle<1)
    return {status:"parallel",angleDeg:maxAngle,baselineM:baseline,
      message:"De kijklijnen lopen vrijwel parallel. Kies een andere camerahoek."};
  let a=0,b=0,d=0,r=0,s=0;
  for(const c of cameras){
    // orthogonal vector to each camera-to-object line
    const nx=-c.dn,ny=c.de;
    const dot=nx*c.e+ny*c.n;
    a+=nx*nx;b+=nx*ny;d+=ny*ny;
    r+=nx*dot;s+=ny*dot;
  }
  const det=a*d-b*b;
  if(det<1e-8)return {status:"parallel",angleDeg:maxAngle,baselineM:baseline};
  const e=(d*r-b*s)/det,n=(a*s-b*r)/det;
  if(!finite(e,n))return {status:"invalid"};
  const ranges=[];
  let residualSq=0;
  const zEstimates=[];
  for(const c of cameras){
    const de=e-c.e,dn=n-c.n;
    const along=de*c.de+dn*c.dn;
    const lateral=Math.abs(de*c.dn-dn*c.de);
    if(along<0.5)return {status:"behind",message:"De berekende positie ligt achter minstens één camera. Controleer of je hetzelfde object aanklikt."};
    if(along>maxRange)return {status:"out-of-range",distanceM:along,
      message:"De berekende positie ligt verder dan "+maxRange+" m van een opname."};
    ranges.push(along);
    residualSq+=lateral*lateral;
    if(Number.isFinite(c.cameraZ))zEstimates.push(c.cameraZ+c.slope*along);
  }
  const location=offsetLocation({lat:lat0,lng:lng0},e,n);
  if(!location)return {status:"invalid"};
  const rd=wgs84ToRD(location.lat,location.lng);
  const rms=Math.sqrt(residualSq/cameras.length);
  const zMean=zEstimates.length>=2
    ? zEstimates.reduce((sum,x)=>sum+x,0)/zEstimates.length:null;
  const zSpread=zEstimates.length>=2
    ? Math.max(...zEstimates)-Math.min(...zEstimates):null;
  const angleRadians=Math.max(1,maxAngle)*RAD;
  // Sensitivity indication for 1 degree heading error, NOT a calibrated CI.
  const sensitivityM=Math.max(...ranges)*Math.sin(1*RAD)/Math.sin(angleRadians);
  const quality=maxAngle<5||baseline<5||rms>2||zSpread!==null&&zSpread>3
    ?"low":"indicative";
  return {status:"ok",point:{e,n,lat:location.lat,lng:location.lng,rd,z:zMean},
    count:cameras.length,baselineM:baseline,angleDeg:maxAngle,
    residualRmsM:rms,sensitivityAtOneDegreeM:sensitivityM,
    zSpreadM:zSpread,quality,rangesM:ranges};
}
