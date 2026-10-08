import {
  MAX_GROUND_DISTANCE_M, groundFromRay, lineLength,
  pixelFromGround, rayFromPixel, segmentDistance
} from "./geometry.mjs";

const $ = id => document.getElementById(id);
const elements = {
  key: $("api-key"), load: $("load-map"), lat: $("latitude"), lng: $("longitude"),
  go: $("go-location"), viewer: $("viewer"), panorama: $("panorama"),
  overlay: $("measurement-canvas"), status: $("status"), notice: $("notice"),
  navigate: $("navigate-mode"), measure: $("measure-mode"),
  height: $("camera-height"), newLine: $("new-line"), undo: $("undo"),
  clear: $("clear"), summary: $("summary"), modeLabel: $("mode-label")
};
const ctx = elements.overlay.getContext("2d");
const colors = ["#60d9b2", "#ffc76c", "#98b8ff", "#ffa2ae"];
const state = {
  panorama: null, mode: "navigate", lines: [[]],
  cameraHeight: 2.5, panoId: null, position: null, drawRequested: false
};

function message(text, error = false) {
  elements.notice.textContent = text;
  elements.notice.classList.toggle("error", error);
}

function setMode(mode) {
  state.mode = mode;
  const measuring = mode === "measure";
  elements.overlay.classList.toggle("interactive", measuring);
  elements.measure.classList.toggle("selected", measuring);
  elements.navigate.classList.toggle("selected", !measuring);
  elements.measure.setAttribute("aria-pressed", String(measuring));
  elements.navigate.setAttribute("aria-pressed", String(!measuring));
  elements.modeLabel.textContent = measuring ? "Meetmodus" : "Navigatiemodus";
  if (state.panorama) state.panorama.setOptions({ clickToGo: !measuring });
  message(measuring
    ? "Klik op zichtbare grond om meetpunten te zetten. Wissel naar Navigeren om rond te kijken."
    : "Draai of verplaats het panorama; schakel daarna Meetlijn in.");
}

function clearLines(note) {
  state.lines = [[]];
  redraw();
  if (note) message(note);
}

function getView() {
  if (!state.panorama) return null;
  const pov = state.panorama.getPov();
  const rect = elements.overlay.getBoundingClientRect();
  return {
    width: rect.width, height: rect.height, heading: pov.heading,
    pitch: pov.pitch, zoom: state.panorama.getZoom()
  };
}

function scheduleDraw() {
  if (state.drawRequested) return;
  state.drawRequested = true;
  window.requestAnimationFrame(() => {
    state.drawRequested = false;
    redraw();
  });
}

function renderSummary() {
  let count = 0, total = 0, segments = 0;
  let valid = true;
  for (const line of state.lines) {
    count += line.length;
    segments += Math.max(0, line.length - 1);
    const distance = lineLength(line, state.cameraHeight);
    if (distance === null) valid = false;
    else total += distance;
  }
  elements.summary.innerHTML = "";
  for (const [label, value] of [
    ["Meetpunten", String(count)],
    ["Lijnsegmenten", String(segments)],
    ["Totale lengte", valid ? formatMeters(total) : "—"]
  ]) {
    const row = document.createElement("div");
    row.className = "stat-row";
    const name = document.createElement("span");
    name.textContent = label;
    const number = document.createElement("strong");
    number.textContent = value;
    row.append(name, number);
    elements.summary.append(row);
  }
}

function formatMeters(meters) {
  return new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: 1, maximumFractionDigits: 1
  }).format(meters) + " m";
}

function resizeCanvas(width, height) {
  const ratio = window.devicePixelRatio || 1;
  const targetWidth = Math.round(width * ratio);
  const targetHeight = Math.round(height * ratio);
  if (elements.overlay.width !== targetWidth || elements.overlay.height !== targetHeight) {
    elements.overlay.width = targetWidth;
    elements.overlay.height = targetHeight;
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
}

function labelAt(text, x, y, color) {
  ctx.save();
  ctx.font = "600 13px system-ui, sans-serif";
  const w = ctx.measureText(text).width + 16;
  const px = Math.min(Math.max(x, w / 2 + 5), elements.overlay.clientWidth - w / 2 - 5);
  const py = Math.max(24, y);
  ctx.fillStyle = "rgba(17, 28, 37, 0.92)";
  ctx.beginPath();
  ctx.roundRect(px - w / 2, py - 22, w, 23, 7);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.fillText(text, px, py - 6);
  ctx.restore();
}

function redraw() {
  const view = getView();
  const width = view?.width || elements.overlay.clientWidth;
  const height = view?.height || elements.overlay.clientHeight;
  resizeCanvas(width, height);
  renderSummary();
  if (!view || view.zoom <= 0.5) return;
  for (let lineNumber = 0; lineNumber < state.lines.length; lineNumber++) {
    const rays = state.lines[lineNumber];
    const color = colors[lineNumber % colors.length];
    const points = rays.map(ray => groundFromRay(ray, state.cameraHeight));
    const projected = points.map(point => point
      ? pixelFromGround(point, state.cameraHeight, view) : null);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.shadowBlur = 8;
    ctx.shadowColor = "rgba(0, 0, 0, .7)";
    for (let i = 1; i < points.length; i++) {
      const a = projected[i - 1], b = projected[i];
      if (!a || !b || !points[i - 1] || !points[i]) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
    for (let i = 0; i < projected.length; i++) {
      const p = projected[i];
      if (!p || p.x < -15 || p.x > width + 15 || p.y < -15 || p.y > height + 15) continue;
      ctx.fillStyle = color;
      ctx.strokeStyle = "#14222d";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      if (i > 0 && projected[i - 1] && points[i] && points[i - 1]) {
        const prev = projected[i - 1];
        labelAt(
          formatMeters(segmentDistance(points[i - 1], points[i])),
          (prev.x + p.x) / 2, (prev.y + p.y) / 2 - 8, color
        );
      }
    }
  }
}

function addMeasurement(event) {
  if (state.mode !== "measure" || !state.panorama) return;
  const view = getView();
  if (!view || view.zoom <= 0.5) {
    message("Zoom eerst verder in om betrouwbaar punten te kunnen plaatsen.", true);
    return;
  }
  const rect = elements.overlay.getBoundingClientRect();
  const ray = rayFromPixel(event.clientX - rect.left, event.clientY - rect.top, view);
  const ground = groundFromRay(ray, state.cameraHeight);
  if (!ground) {
    message("Geen grondpunt gevonden. Klik onder de horizon, maximaal " +
      MAX_GROUND_DISTANCE_M + " meter van de camera.", true);
    return;
  }
  if (!state.lines.length) state.lines.push([]);
  state.lines[state.lines.length - 1].push(ray);
  redraw();
  message("Meetpunt toegevoegd. Klik nogmaals voor een afstand, of kies Nieuwe lijn.");
}

function startNewLine() {
  const last = state.lines[state.lines.length - 1];
  if (last?.length) {
    state.lines.push([]);
    redraw();
    message("Nieuwe meetlijn gestart. De vorige lijn blijft zichtbaar.");
  }
}

function undo() {
  while (state.lines.length && !state.lines[state.lines.length - 1].length) {
    state.lines.pop();
  }
  if (state.lines.length) state.lines[state.lines.length - 1].pop();
  if (!state.lines.length) state.lines = [[]];
  redraw();
  message("Laatste meetpunt verwijderd.");
}

function trackPanoramaPosition() {
  const position = state.panorama.getPosition();
  if (!position) return;
  const next = { lat: position.lat(), lng: position.lng() };
  const prev = state.position;
  state.position = next;
  elements.status.textContent = next.lat.toFixed(6) + ", " + next.lng.toFixed(6);
  if (prev && Math.hypot(prev.lat - next.lat, prev.lng - next.lng) > 1e-7) {
    clearLines("Street View-positie gewijzigd. Oude metingen zijn gewist; de grondhoogte kan hier anders zijn.");
  }
}

function attachPanorama() {
  const location = {
    lat: Number(elements.lat.value), lng: Number(elements.lng.value)
  };
  state.panorama = new google.maps.StreetViewPanorama(elements.panorama, {
    position: location, pov: { heading: 0, pitch: -12 }, zoom: 1,
    fullscreenControl: true, addressControl: true,
    linksControl: true, clickToGo: true, motionTracking: false
  });
  state.panorama.addListener("pov_changed", scheduleDraw);
  state.panorama.addListener("zoom_changed", scheduleDraw);
  state.panorama.addListener("position_changed", () => {
    trackPanoramaPosition();
    scheduleDraw();
  });
  state.panorama.addListener("pano_changed", () => {
    const id = state.panorama.getPano();
    if (state.panoId && id && state.panoId !== id) {
      clearLines("Nieuw panorama geopend. De oude meting is gewist om fouten door hoogteverschil te voorkomen.");
    }
    state.panoId = id;
    trackPanoramaPosition();
    scheduleDraw();
  });
  state.panorama.addListener("status_changed", () => {
    const status = state.panorama.getStatus();
    if (status !== google.maps.StreetViewStatus.OK) {
      message("Er is op deze locatie geen Street View-panorama gevonden (" + status + ").", true);
    }
  });
  setMode("navigate");
  elements.go.disabled = false;
  elements.measure.disabled = false;
  elements.navigate.disabled = false;
  elements.load.disabled = true;
  elements.key.disabled = true;
  message("Street View geladen. Kies Meetlijn om punten op de grond te plaatsen.");
  scheduleDraw();
}

elements.load.addEventListener("click", () => {
  const key = elements.key.value.trim();
  if (!key) {
    message("Vul eerst een Google Maps JavaScript API-sleutel in.", true);
    return;
  }
  if (window.google?.maps?.StreetViewPanorama) {
    attachPanorama();
    return;
  }
  elements.load.disabled = true;
  message("Google Street View wordt geladen…");
  window.__streetviewMeasurementsInit = () => {
    delete window.__streetviewMeasurementsInit;
    attachPanorama();
  };
  const script = document.createElement("script");
  script.src = "https://maps.googleapis.com/maps/api/js?key=" +
    encodeURIComponent(key) + "&v=weekly&loading=async&callback=__streetviewMeasurementsInit";
  script.async = true;
  script.onerror = () => {
    elements.load.disabled = false;
    message("Google Maps kon niet worden geladen. Controleer API-sleutel, restricties en facturering.", true);
  };
  document.head.append(script);
});

elements.go.addEventListener("click", () => {
  if (!state.panorama) return;
  const lat = Number(elements.lat.value), lng = Number(elements.lng.value);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    message("Voer geldige breedte- en lengtegraden in.", true);
    return;
  }
  clearLines();
  state.panorama.setPosition({ lat, lng });
  message("Street View zoekt het dichtstbijzijnde beschikbare panorama.");
});

elements.navigate.addEventListener("click", () => setMode("navigate"));
elements.measure.addEventListener("click", () => setMode("measure"));
elements.newLine.addEventListener("click", startNewLine);
elements.undo.addEventListener("click", undo);
elements.clear.addEventListener("click", () => clearLines("Alle meetlijnen gewist."));
elements.height.addEventListener("input", () => {
  const h = Number(elements.height.value);
  if (Number.isFinite(h) && h >= 0.5 && h <= 5) {
    state.cameraHeight = h;
    redraw();
  }
});
elements.overlay.addEventListener("click", addMeasurement);
elements.overlay.addEventListener("wheel", event => {
  if (!state.panorama || state.mode !== "measure") return;
  event.preventDefault();
  const zoom = state.panorama.getZoom();
  state.panorama.setZoom(Math.max(0.75, Math.min(4, zoom + (event.deltaY < 0 ? 0.25 : -0.25))));
}, { passive: false });
window.addEventListener("keydown", event => {
  if (event.target instanceof HTMLInputElement) return;
  if (event.key === "Escape" && state.panorama) setMode("navigate");
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    undo();
  }
});
new ResizeObserver(scheduleDraw).observe(elements.viewer);
setMode("navigate");
redraw();
