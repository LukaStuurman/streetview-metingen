import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {EventEmitter} from "node:events";
import {mkdtempSync,rmSync,rmdirSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {mapSnapshot,mapBounds,rdToPixel,pixelToRD,fitMap,aerialImageUrl} from "../desktop-google/aerial-map-model.mjs";
import {calibrationKey,calibrationScope,fitCalibration,applyCalibration,correctedCoordinates,addReference} from "../desktop-google/map-calibration.mjs";
import {pointCoordinates,wgs84ToRD} from "../src/rd.mjs";
import {offsetLocation} from "../src/ahn.mjs";
const require=createRequire(import.meta.url);
const {attachAerialWindow}=require("../desktop-google/aerial-window.cjs");
const {CalibrationStore}=require("../desktop-google/calibration-store.cjs");
const close=(a,b,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);

test("map snapshot uses the exact national coordinates of point output, separate lines and target",()=>{
  const origin={lat:52.1551744,lng:5.38720621};
  const point={e:8.5,n:-3.75,z:7};
  const coordinates=pointCoordinates(point,origin,offsetLocation);
  const scene=mapSnapshot({origin,heading:45,lines:[[{point}],[{point:{e:12,n:9,z:6}}]],
    triangulation:{status:"ok",point:{...coordinates,rd:coordinates.rd}}});
  assert.equal(scene.lines.length,2);
  assert.equal(scene.lines[0].points[0].id,"P1.1");
  assert.equal(scene.lines[1].points[0].id,"P2.1");
  assert.equal(scene.lines[0].points[0].x,coordinates.rd.x);
  assert.equal(scene.lines[0].points[0].y,coordinates.rd.y);
  assert.notEqual(scene.lines[0].points[0].x,point.e);
  close(scene.camera.x,155000);close(scene.camera.y,463000);
  assert.equal(scene.target.id,"T1");
  assert.deepEqual(mapSnapshot({lines:[[{point}]],origin:null}).lines,[]);
});

test("RD raster and overlays share north-up bounding box at multiple sizes",()=>{
  for(const [width,height] of [[800,600],[1600,900]]) {
    const view={x:155000,y:463000,scale:.2};
    const bounds=mapBounds(view,width,height);
    assert.deepEqual(rdToPixel({x:bounds.minX,y:bounds.maxY},view,width,height),{x:0,y:0});
    assert.deepEqual(rdToPixel({x:bounds.maxX,y:bounds.minY},view,width,height),{x:width,y:height});
    const pointer=pixelToRD({x:width/2+10,y:height/2+10},view,width,height);
    assert.deepEqual(pointer,{x:155002,y:462998});
    const url=new URL(aerialImageUrl(bounds,width,height));
    assert.equal(url.origin,"https://service.pdok.nl");
    assert.equal(url.searchParams.get("LAYERS"),"Actueel_orthoHR");
    assert.equal(url.searchParams.get("CRS"),"EPSG:28992");
    assert.equal(url.searchParams.get("BBOX"),[bounds.minX,bounds.minY,bounds.maxX,bounds.maxY].join(","));
  }
  assert.throws(()=>aerialImageUrl({minX:1,maxX:0,minY:0,maxY:1},800,600));
});

test("fit preserves margins for widely spaced targets and a single point",()=>{
  const points=[{x:150000,y:460000},{x:155000,y:463000}];
  const view=fitMap(points,800,600);
  for(const point of points) {
    const pixel=rdToPixel(point,view,800,600);
    assert.ok(pixel.x>=85&&pixel.x<=715&&pixel.y>=85&&pixel.y<=515);
  }
  assert.ok(fitMap([points[0]],800,600).scale>0);
  assert.equal(fitMap([],800,600),null);
});

test("one saved map reference improves a future point without overwriting its raw coordinates",()=>{
  const raw=pointCoordinates({e:8.5,n:3,z:6},{lat:52.1551744,lng:5.38720621},offsetLocation);
  const record=addReference(null,"standpoint",{x:155000,y:463000},{x:155001.2,y:462999.4});
  const result=correctedCoordinates(raw,record);
  close(result.rd.x,raw.rd.x+1.2);close(result.rd.y,raw.rd.y-.6);
  assert.equal(result.rawRD,raw.rd);
  assert.equal(result.correction,"kaartkalibratie_translation");
  const reconverted=wgs84ToRD(result.lat,result.lng);
  close(reconverted.x,result.rd.x,.0001);close(reconverted.y,result.rd.y,.0001);
  const manual=correctedCoordinates(raw,record,{x:155020,y:463009});
  assert.deepEqual(manual.rd,{x:155020,y:463009});
  assert.equal(manual.correction,"handmatige_kaartcorrectie");
  assert.equal(correctedCoordinates(raw,null),raw);
});

test("corrected local, geographic and RD coordinates describe the same point across the Netherlands",()=>{
  for(const origin of [{lat:51.53,lng:5.63},{lat:52.15,lng:5.38},{lat:51.92,lng:4.48},{lat:53.22,lng:6.56}]) {
    const raw=pointCoordinates({e:12,n:-7},origin,offsetLocation);
    const target=pointCoordinates({e:12.4,n:-7.3},origin,offsetLocation);
    const record=addReference(null,"scope",raw.rd,target.rd);
    const corrected=correctedCoordinates(raw,record,null,origin);
    close(corrected.localX,12.4,.0001);close(corrected.localY,-7.3,.0001);
    assert.equal(corrected.rawLocalX,12);assert.equal(corrected.rawLocalY,-7);
    const geo=offsetLocation(origin,corrected.localX,corrected.localY);
    const rd=wgs84ToRD(geo.lat,geo.lng);
    close(rd.x,corrected.rd.x,.0001);close(rd.y,corrected.rd.y,.0001);
  }
});

test("four well-spaced references validate scale and angle before predicting a fifth",()=>{
  const transform=(x,y)=>({x:155001+1.04*Math.cos(.04)*x-1.04*Math.sin(.04)*y,
    y:462999+1.04*Math.sin(.04)*x+1.04*Math.cos(.04)*y});
  const references=[[0,0],[12,0],[0,16],[12,16]].map(([x,y])=>({rawX:155000+x,rawY:463000+y,...transform(x,y)}));
  const model=fitCalibration(references);
  assert.equal(model.kind,"similarity");
  assert.equal(model.validation.method,"leave-one-out");
  assert.ok(model.validation.validationErrorM<.000001);
  const future=applyCalibration(155007,463011,model),expected=transform(7,11);
  close(future.x,expected.x);close(future.y,expected.y);
  assert.equal(fitCalibration(references.slice(0,2)).kind,"translation");
  assert.equal(fitCalibration(references.slice(0,3)).kind,"translation");
  const bad=references.map(r=>({...r,x:155000+(r.rawX-155000)*3,y:463000+(r.rawY-463000)*3}));
  assert.equal(fitCalibration(bad).kind,"translation");
  const median=fitCalibration([{rawX:0,rawY:0,x:1,y:-1},{rawX:1,rawY:1,x:2,y:0},{rawX:2,rawY:2,x:100,y:100}]);
  assert.equal(median.kind,"translation");close(median.tx,1);close(median.ty,-1);
});

test("a misleading far reference cannot introduce scale that fits training but worsens unseen points",()=>{
  const references=[0,10,20,40].map(x=>({rawX:155000+x,rawY:463000,
    x:155000+x+(x===40?4:0),y:463000}));
  const model=fitCalibration(references);
  assert.equal(model.kind,"translation");
  const unseen=applyCalibration(155015,463008,model);
  close(unseen.x,155015);close(unseen.y,463008);
});

test("calibration persists across sessions, updates an existing reference and stays scoped to the panorama",()=>{
  const origin={lat:51.44,lng:5.47};
  const url="https://www.google.com/maps/@51.44,5.47,3a,75y,120h,90t/data=!1simageA!2e0";
  const key=calibrationKey(url,origin);
  assert.equal(calibrationKey(url.replace("120h","240h"),origin),key);
  assert.notEqual(calibrationKey(url.replace("imageA","imageB"),origin),key);
  assert.notEqual(calibrationKey(url,{lat:51.4401,lng:5.47}),key);
  assert.notEqual(calibrationScope(url,origin,"flat",2.5),calibrationScope(url,origin,"dtm_05m",2.5));
  assert.notEqual(calibrationScope(url,origin,"flat",2.5),calibrationScope(url,origin,"flat",3));
  assert.notEqual(calibrationScope(url,origin,"flat",2.5,"vertical"),calibrationScope(url,origin,"flat",2.5,"horizontal"));
  assert.equal(calibrationScope(url,origin,"flat",2.5,"unknown"),null);
  const directory=mkdtempSync(join(tmpdir(),"streetview-map-test-")),file=join(directory,"calibration.json");
  try {
    const record=addReference(null,key,{x:155000,y:463000},{x:155001,y:463002});
    new CalibrationStore(file).save(record);
    const restarted=new CalibrationStore(file);
    assert.deepEqual(restarted.load(),[record]);
    const updated=addReference(record,key,{x:155000,y:463000},{x:155003,y:463004});
    assert.equal(updated.references.length,1);
    restarted.save(updated);assert.deepEqual(restarted.load(),[updated]);
    assert.throws(()=>restarted.save({...record,references:[{rawX:NaN,rawY:1,x:2,y:3}]}));
    restarted.save(null,key);assert.deepEqual(restarted.load(),[]);
  } finally {rmSync(file,{force:true});rmdirSync(directory);}
});

test("native popup reuses one window, receives buffered/live points, rejects stale/remote corrections and cleans up",()=>{
  const url="streetview://app/desktop-google/index.html",mapUrl="streetview://app/desktop-google/aerial-map.html";
  const main=new EventEmitter();
  const contents=address=>Object.assign(new EventEmitter(),{mainFrame:{url:address},isDestroyed:()=>false,
    sent:[],send(channel,data){this.sent.push({channel,data});},setWindowOpenHandler(){}});
  main.webContents=contents(url);
  const windows=[];
  class Popup extends EventEmitter {
    constructor(options){super();this.options=options;this.webContents=contents(mapUrl);this.dead=false;windows.push(this);}
    isDestroyed(){return this.dead;}isMinimized(){return false;}show(){}focus(){}loadURL(){return Promise.resolve();}
    destroy(){this.dead=true;this.emit("closed");}
  }
  const ipcMain=Object.assign(new EventEmitter(),{handlers:new Map(),handle(name,fn){this.handlers.set(name,fn);},removeHandler(name){this.handlers.delete(name);}});
  const event=wc=>({sender:wc,senderFrame:wc.mainFrame});
  attachAerialWindow(main,{BrowserWindow:Popup,ipcMain,shell:{openExternal(){}},calibrationStore:{load:()=>[],save:()=>true}});
  const scene={camera:null,target:null,contextKey:"scope",lines:[{id:"L1",color:"#f28c28",points:[{id:"P1.1",x:155000,y:463000}]}]};
  ipcMain.emit("aerial-map:publish",event(main.webContents),scene);
  ipcMain.emit("aerial-map:open",event(contents("https://www.google.com/maps")));
  assert.equal(windows.length,0);
  ipcMain.emit("aerial-map:open",event(main.webContents));
  ipcMain.emit("aerial-map:open",event(main.webContents));assert.equal(windows.length,1);
  const popup=windows[0];
  ipcMain.emit("aerial-map:ready",event(popup.webContents));
  assert.equal(popup.webContents.sent[0].data,scene);
  const correction={id:"P1.1",key:"scope",x:155001,y:463001};
  ipcMain.emit("aerial-map:correct",event(popup.webContents),{...correction,key:"old"});
  assert.equal(main.webContents.sent.length,0);
  ipcMain.emit("aerial-map:correct",event(popup.webContents),correction);
  assert.equal(main.webContents.sent[0].channel,"aerial-map:correction");
  const cleared={camera:null,target:null,lines:[],contextKey:"scope"};
  ipcMain.emit("aerial-map:publish",event(main.webContents),cleared);
  assert.equal(popup.webContents.sent.at(-1).data,cleared);
  assert.throws(()=>ipcMain.handlers.get("aerial-map:calibration-load")(event(popup.webContents)));
  popup.destroy();ipcMain.emit("aerial-map:open",event(main.webContents));assert.equal(windows.length,2);
  ipcMain.emit("aerial-map:ready",event(windows[1].webContents));assert.equal(windows[1].webContents.sent[0].data,cleared);
  main.emit("closed");assert.equal(windows[1].dead,true);
  assert.equal(ipcMain.listenerCount("aerial-map:publish"),0);assert.equal(ipcMain.handlers.size,0);
});
