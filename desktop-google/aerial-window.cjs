"use strict";
const path = require("node:path");
const MAIN_URL = "streetview://app/desktop-google/index.html";
const MAP_URL = "streetview://app/desktop-google/aerial-map.html";

function trustedSender(event, contents, url) {
  return contents && !contents.isDestroyed() && event.sender === contents &&
    event.senderFrame === contents.mainFrame && event.senderFrame.url === url;
}

function validSnapshot(snapshot) {
  const point = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) &&
    Math.abs(p.x) < 1000000 && Math.abs(p.y) < 1000000;
  if (!snapshot || !Array.isArray(snapshot.lines) || snapshot.lines.length > 500 ||
    (snapshot.camera !== null && (!point(snapshot.camera) || !Number.isFinite(snapshot.camera.heading))) ||
    (snapshot.target !== null && !point(snapshot.target))) return false;
  let count = 0;
  return snapshot.lines.every(line => Array.isArray(line.points) &&
    typeof line.id === "string" && line.id.length < 40 &&
    /^#[0-9a-f]{6}$/i.test(line.color) &&
    (count += line.points.length) <= 10000 && line.points.every(p => point(p) &&
      typeof p.id === "string" && p.id.length < 40));
}

function attachAerialWindow(main, { BrowserWindow, ipcMain, shell, calibrationStore }) {
  let popup = null, ready = false;
  let snapshot = { camera: null, lines: [], target: null };
  const send = () => {
    if (ready && popup && !popup.isDestroyed()) popup.webContents.send("aerial-map:update", snapshot);
  };
  const publish = (event, data) => {
    if (!trustedSender(event, main.webContents, MAIN_URL) || !validSnapshot(data)) return;
    snapshot = data;
    send();
  };
  const open = event => {
    if (!trustedSender(event, main.webContents, MAIN_URL)) return;
    if (popup && !popup.isDestroyed()) {
      if (popup.isMinimized()) popup.restore();
      popup.show(); popup.focus(); return;
    }
    ready = false;
    popup = new BrowserWindow({
      // Independent window for side-by-side use or another monitor. The main
      // window's closed handler still closes it and removes its IPC listeners.
      width: 1120, height: 820, minWidth: 740, minHeight: 520,
      title: "Streetview Metingen — PDOK luchtfoto", backgroundColor: "#15171b",
      autoHideMenuBar: true, show: false,
      webPreferences: { preload: path.join(__dirname, "aerial-preload.cjs"),
        contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true }
    });
    const created = popup;
    created.once("ready-to-show", () => { if (!created.isDestroyed()) created.show(); });
    created.webContents.on("will-navigate", (navigation, url) => {
      if (url !== MAP_URL) navigation.preventDefault();
    });
    created.webContents.setWindowOpenHandler(({ url }) => {
      // Only the static source/CC BY links from the local map page may open externally.
      if (["https://www.pdok.nl/introductie/-/article/pdok-luchtfoto-rgb-open-",
        "https://creativecommons.org/licenses/by/4.0/"].includes(url)) void shell.openExternal(url);
      return { action: "deny" };
    });
    created.on("closed", () => { if (popup === created) { popup = null; ready = false; } });
    void created.loadURL(MAP_URL);
  };
  const mapReady = event => {
    if (!trustedSender(event, popup?.webContents, MAP_URL)) return;
    ready = true; send();
  };
  const correct = (event, correction) => {
    if(!trustedSender(event,popup?.webContents,MAP_URL)||
      correction?.key!==snapshot.contextKey||!Number.isFinite(correction.x)||!Number.isFinite(correction.y)||
      !snapshot.lines.some(line=>line.points.some(point=>point.id===correction.id)))return;
    main.webContents.send("aerial-map:correction",correction);
  };
  const reset = (event,key) => {
    if(trustedSender(event,popup?.webContents,MAP_URL)&&key===snapshot.contextKey)
      main.webContents.send("aerial-map:correction",{key,reset:true});
  };
  ipcMain.handle("aerial-map:calibration-load",event=>{
    if(!trustedSender(event,main.webContents,MAIN_URL))throw new Error("Onbevoegde kaartaanvraag");
    return calibrationStore.load();
  });
  ipcMain.handle("aerial-map:calibration-save",(event,record,key)=>{
    if(!trustedSender(event,main.webContents,MAIN_URL))throw new Error("Onbevoegde kaartaanvraag");
    return calibrationStore.save(record,key);
  });
  ipcMain.on("aerial-map:publish", publish);
  ipcMain.on("aerial-map:open", open);
  ipcMain.on("aerial-map:ready", mapReady);
  ipcMain.on("aerial-map:correct",correct);
  ipcMain.on("aerial-map:reset",reset);
  main.once("closed", () => {
    ipcMain.removeListener("aerial-map:publish", publish);
    ipcMain.removeListener("aerial-map:open", open);
    ipcMain.removeListener("aerial-map:ready", mapReady);
    ipcMain.removeListener("aerial-map:correct",correct);
    ipcMain.removeListener("aerial-map:reset",reset);
    ipcMain.removeHandler("aerial-map:calibration-load");
    ipcMain.removeHandler("aerial-map:calibration-save");
    if (popup && !popup.isDestroyed()) popup.destroy();
  });
}

module.exports = { attachAerialWindow, validSnapshot, trustedSender };
