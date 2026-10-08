/**
 * License-neutral pixel matching for TWO authorized panorama image buffers.
 *
 * This module deliberately does not capture, navigate, fetch or inspect the
 * Google Maps website. The caller supplies rights-cleared images and camera
 * poses. No imagery or feature descriptors are stored by this module.
 *
 * Image format: ImageData-like {width,height,data:Uint8ClampedArray RGBA}.
 * Works with deterministic test images and data supplied by permitted sources.
 */
import {pointAtHorizontalDistance,pixelFromWorld,rayFromPixel} from "./geometry.mjs";

const RAD=Math.PI/180;
const validImage=image=>
  image&&Number.isInteger(image.width)&&Number.isInteger(image.height)&&
  image.width>=16&&image.height>=16&&image.width<=16384&&image.height<=16384&&
  image.data?.length===image.width*image.height*4;

function bilinearGray(image,x,y){
  if(x<0||y<0||x>=image.width-1||y>=image.height-1)return null;
  const xi=Math.floor(x),yi=Math.floor(y),fx=x-xi,fy=y-yi;
  function gray(ix,iy){
    const index=(iy*image.width+ix)*4;
    const alpha=image.data[index+3]/255;
    return alpha*(image.data[index]*0.2126+
      image.data[index+1]*0.7152+image.data[index+2]*0.0722);
  }
  const a=gray(xi,yi),b=gray(xi+1,yi),c=gray(xi,yi+1),d=gray(xi+1,yi+1);
  return a*(1-fx)*(1-fy)+b*fx*(1-fy)+c*(1-fx)*fy+d*fx*fy;
}

function patchPixels(image,x,y,radius,scale=1){
  const pixels=[];
  for(let row=-radius;row<=radius;row++)for(let col=-radius;col<=radius;col++){
    const v=bilinearGray(image,x+col*scale,y+row*scale);
    if(v===null)return null;
    pixels.push(v);
  }
  return pixels;
}

function correlation(a,b){
  if(!a||!b||a.length!==b.length)return null;
  let sumA=0,sumB=0;
  for(let i=0;i<a.length;i++){sumA+=a[i];sumB+=b[i];}
  const meanA=sumA/a.length,meanB=sumB/b.length;
  let cross=0,varianceA=0,varianceB=0;
  for(let i=0;i<a.length;i++){
    const av=a[i]-meanA,bv=b[i]-meanB;
    cross+=av*bv;varianceA+=av*av;varianceB+=bv*bv;
  }
  // A constant/featureless patch cannot be matched unambiguously.
  if(varianceA<a.length*36||varianceB<a.length*36)return null;
  return cross/Math.sqrt(varianceA*varianceB);
}

/** Return high-confidence correspondence or an explicit failure code. */
export function matchImagePatch({
  source,target,sourcePoint,candidates,radius=5,
  scales=[0.85,1,1.15],minScore=0.8,minMargin=0.055
}={}){
  if(!validImage(source)||!validImage(target)||
    !Number.isFinite(sourcePoint?.x)||!Number.isFinite(sourcePoint?.y)||
    !Array.isArray(candidates)||candidates.length>2500||
    !Number.isInteger(radius)||radius<3||radius>15)
    return {status:"invalid"};
  const template=patchPixels(source,sourcePoint.x,sourcePoint.y,radius);
  if(!template)return {status:"edge",reason:"Doelpunt ligt te dicht bij de rand."};
  // Reject textureless source before scanning.
  if(correlation(template,template)===null)
    return {status:"textureless",reason:"Dit beeldgebied bevat te weinig unieke details."};

  const ranked=[];
  for(const candidate of candidates){
    if(!Number.isFinite(candidate?.x)||!Number.isFinite(candidate?.y))continue;
    let highest=null,chosenScale=null;
    for(const scale of scales){
      if(!(scale>=0.5&&scale<=2))continue;
      const comparison=patchPixels(target,candidate.x,candidate.y,radius,scale);
      const score=correlation(template,comparison);
      if(score!==null&&(highest===null||score>highest)){
        highest=score;chosenScale=scale;
      }
    }
    if(highest!==null)ranked.push({
      x:candidate.x,y:candidate.y,score:highest,
      rangeM:candidate.rangeM??null,scale:chosenScale
    });
  }
  if(!ranked.length)return {status:"not-found",reason:"Geen beeldkenmerken gevonden op de zoeklijn."};
  ranked.sort((a,b)=>b.score-a.score);
  const best=ranked[0];
  if(best.score<minScore)return {status:"low-confidence",score:best.score,
    reason:"De beeldgebieden lijken onvoldoende op elkaar."};
  // Nearby candidate positions along the SAME epipolar line naturally
  // correlate; they are not independent competing matches.
  const minSeparation=Math.max(radius*2.5,9);
  const alternate=ranked.find(c=>Math.hypot(c.x-best.x,c.y-best.y)>minSeparation);
  const margin=alternate?best.score-alternate.score:1;
  if(alternate&&margin<minMargin)return {status:"ambiguous",score:best.score,
    margin,alternativeScore:alternate.score,
    reason:"Meer dan één beeldgebied lijkt op het doel. Geen automatische coördinaten toepassen."};
  return {status:"ok",...best,margin,
    examined:ranked.length,reason:"Beeldmatch, nog geen nauwkeurigheidsbewijs."};
}

/**
 * Geometrically constrain matching to the epipolar locus of the clicked ray.
 * Coordinates are relative to the FIRST camera's tangent plane.
 *
 * A/B camera: {lat,lng,cameraZ,view:{width,height,heading,pitch,zoom}}.
 * cameraZ is a common vertical datum (e.g., AHN+camera height); it must
 * NOT silently become "2.5m NAP" when the AHN height is unknown.
 */
export function epipolarCandidates({
  cameraA,cameraB,sourcePoint,minRange=5,maxRange=500,samples=160
}={}){
  const positions=[
    cameraA?.lat,cameraA?.lng,cameraA?.cameraZ,
    cameraB?.lat,cameraB?.lng,cameraB?.cameraZ
  ];
  if(!positions.every(Number.isFinite)||!cameraA?.view||!cameraB?.view||
    !Number.isFinite(sourcePoint?.x)||!Number.isFinite(sourcePoint?.y)||
    !(minRange>0)&&!Number.isFinite(minRange)||
    !(maxRange>minRange)||!Number.isInteger(samples)||samples<2||samples>1000)
    return [];
  const ray=rayFromPixel(sourcePoint.x,sourcePoint.y,cameraA.view);
  if(!ray)return [];
  const lat0=cameraA.lat;
  const dNorth=(cameraB.lat-cameraA.lat)*
    (111132.92-559.82*Math.cos(2*lat0*RAD));
  const dEast=(cameraB.lng-cameraA.lng)*
    (111412.84*Math.cos(lat0*RAD)-93.5*Math.cos(3*lat0*RAD));
  const result=[],already=new Set();
  for(let i=0;i<samples;i++){
    // Sample in log depth, with denser samples for near objects.
    const range=minRange*Math.pow(maxRange/minRange,i/(samples-1));
    const target=pointAtHorizontalDistance(ray,range,cameraA.cameraZ,maxRange);
    if(!target)continue;
    const pixel=pixelFromWorld({
      e:target.e-dEast,n:target.n-dNorth,z:target.z
    },cameraB.cameraZ,cameraB.view);
    if(!pixel||pixel.x<0||pixel.y<0||
       pixel.x>=cameraB.view.width||pixel.y>=cameraB.view.height)continue;
    const key=Math.round(pixel.x*2)+","+Math.round(pixel.y*2);
    if(already.has(key))continue;
    already.add(key);
    result.push({x:pixel.x,y:pixel.y,rangeM:range});
  }
  return result;
}
