"use strict";
const { app, BrowserWindow, protocol, net, shell, session } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

protocol.registerSchemesAsPrivileged([{
  scheme: "streetview",
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true }
}]);

async function launch() {
  const root = path.resolve(app.getAppPath());
  protocol.handle("streetview", request => {
    let parsed, requested;
    try {
      parsed = new URL(request.url);
      requested = decodeURIComponent(parsed.pathname);
    } catch {
      return new Response("Ongeldige URL", { status: 400 });
    }
    if (parsed.hostname !== "app") return new Response("Verboden", { status: 403 });
    const file = path.resolve(root, "." + requested);
    if (file !== root && !file.startsWith(root + path.sep)) {
      return new Response("Verboden", { status: 403 });
    }
    return net.fetch(pathToFileURL(file).toString());
  });
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.fromPartition("persist:google-maps").setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false)
  );
  const main = new BrowserWindow({
    width: 1530, height: 930, minWidth: 1120, minHeight: 690,
    backgroundColor: "#0b1823", autoHideMenuBar: true,
    title: "Streetview Metingen — Google zonder Cloud-account",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      sandbox: true,
      // Embedded Google Maps website as a normal guest browser tab, not a private Street View API.
      webviewTag: true
    }
  });
  main.webContents.on("will-attach-webview", (event, webPreferences, params) => {
    delete webPreferences.preload;
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;
    webPreferences.webSecurity = true;
    // Remote guest must be the ordinary public Google Maps website.
    try {
      const src = new URL(params.src);
      if (src.protocol !== "https:" || src.hostname !== "www.google.com" ||
          !src.pathname.startsWith("/maps")) event.preventDefault();
    } catch { event.preventDefault(); }
  });
  main.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const u = new URL(url);
      if (u.protocol === "https:" && ["www.google.com", "www.google.nl", "earth.google.com", "support.google.com"].includes(u.hostname)) {
        void shell.openExternal(url);
      }
    } catch { /* ignore invalid URLs */ }
    return { action: "deny" };
  });
  main.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("streetview://app/")) event.preventDefault();
  });
  await main.loadURL("streetview://app/desktop-google/index.html");
}
app.whenReady().then(launch);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void launch();
});
