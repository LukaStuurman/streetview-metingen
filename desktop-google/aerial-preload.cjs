"use strict";
const { contextBridge, ipcRenderer } = require("electron");

// Only this small local map interface crosses the isolated renderer boundary.
contextBridge.exposeInMainWorld("aerialMap", {
  open: () => ipcRenderer.send("aerial-map:open"),
  publish: snapshot => ipcRenderer.send("aerial-map:publish", snapshot),
  ready: () => ipcRenderer.send("aerial-map:ready"),
  correct: correction => ipcRenderer.send("aerial-map:correct", correction),
  reset: key => ipcRenderer.send("aerial-map:reset", key),
  loadCalibrations: () => ipcRenderer.invoke("aerial-map:calibration-load"),
  saveCalibration: (record,key) => ipcRenderer.invoke("aerial-map:calibration-save",record,key),
  onCorrection: callback => {
    const listener = (_event, correction) => callback(correction);
    ipcRenderer.on("aerial-map:correction",listener);
    return () => ipcRenderer.removeListener("aerial-map:correction",listener);
  },
  onUpdate: callback => {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, snapshot) => callback(snapshot);
    ipcRenderer.on("aerial-map:update", listener);
    return () => ipcRenderer.removeListener("aerial-map:update", listener);
  }
});
