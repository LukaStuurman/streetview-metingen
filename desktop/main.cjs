"use strict";
const { app, BrowserWindow, protocol, net, shell, session } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

// Give ES modules and local Panoramax assets a normal, secure origin.
protocol.registerSchemesAsPrivileged([{
  scheme: "streetview",
  privileges: {
    standard: true, secure: true, supportFetchAPI: true,
    corsEnabled: true, stream: true
  }
}]);

let window;
async function createWindow() {
  protocol.handle("streetview", request => {
    const url = new URL(request.url);
    if (url.hostname !== "app") return new Response("Forbidden", { status: 403 });
    let requested;
    try { requested = decodeURIComponent(url.pathname); }
    catch { return new Response("Invalid path", { status: 400 }); }
    const root = path.resolve(app.getAppPath());
    const file = path.resolve(root, "." + requested);
    if (file !== root && !file.startsWith(root + path.sep)) {
      return new Response("Forbidden", { status: 403 });
    }
    return net.fetch(pathToFileURL(file).toString());
  });

  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, cb) => cb(false));
  window = new BrowserWindow({
    width: 1440, height: 920, minWidth: 940, minHeight: 650,
    title: "Streetview Metingen — Panoramax + AHN",
    autoHideMenuBar: true, backgroundColor: "#101820",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const link = new URL(url);
      if (link.protocol === "https:" && /(^|\.)(openstreetmap\.org|panoramax\.fr|panoramax\.xyz|pdok\.nl)$/.test(link.hostname)) {
        shell.openExternal(link.toString());
      }
    } catch {}
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("streetview://app/")) event.preventDefault();
  });
  await window.loadURL("streetview://app/desktop/index.html");
}
app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
