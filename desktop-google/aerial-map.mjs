import { aerialImageUrl, fitMap, mapBounds, pixelToRD, rdToPixel } from "./aerial-map-model.mjs";

const $ = id => document.getElementById(id);
const canvas = $("map"), ctx = canvas.getContext("2d");
const format = value => new Intl.NumberFormat("nl-NL", { minimumFractionDigits:2, maximumFractionDigits:2 }).format(value);
let scene = { camera:null, lines:[], target:null };
let view = { x:155000, y:463000, scale:400 };
let width = 1, height = 1, selected = null, lastGeometry = "";
let image = null, imageBounds = null, requestEpoch = 0, loadTimer = null, drag = null;

function points() { return scene.lines.flatMap(line => line.points).concat(scene.target ? [scene.target] : []); }
function editablePoints() { return scene.lines.flatMap(line => line.points); }
function nearestPoint(position, candidates = points()) {
  return candidates.map(point => ({point,pixel:rdToPixel(point,view,width,height)}))
    .filter(item=>Math.hypot(item.pixel.x-position.x,item.pixel.y-position.y)<=14)
    .sort((a,b)=>Math.hypot(a.pixel.x-position.x,a.pixel.y-position.y)-Math.hypot(b.pixel.x-position.x,b.pixel.y-position.y))[0]?.point;
}
function boundsPoints() { return points().concat(scene.camera ? [scene.camera] : []); }
function status(message, error = false) {
  $("image-status").textContent = message;
  $("image-status").hidden = !message;
  $("image-status").classList.toggle("error", error);
}

function requestImage() {
  clearTimeout(loadTimer);
  const epoch = ++requestEpoch;
  status("Luchtfoto laden…");
  loadTimer = setTimeout(() => {
    const bounds = mapBounds(view, width, height);
    const next = new Image();
    const timeout = setTimeout(() => {
      if (epoch === requestEpoch) {
        requestEpoch++;
        status("PDOK reageert niet. Kies Opnieuw laden om het nogmaals te proberen.", true);
      }
    }, 20000);
    next.onload = () => {
      clearTimeout(timeout);
      if (epoch !== requestEpoch) return;
      image = next; imageBounds = bounds; status(""); draw();
    };
    next.onerror = () => {
      clearTimeout(timeout);
      if (epoch === requestEpoch) status("Luchtfoto niet geladen. Controleer de verbinding en kies Opnieuw laden.", true);
    };
    next.src = aerialImageUrl(bounds, width, height);
  }, 180);
}

function changeView(next) { view = next; draw(); requestImage(); }
function fit() {
  const next = fitMap(boundsPoints(), width, height);
  if (next) changeView(next);
}

function tag(point, color) {
  const p = rdToPixel(point, view, width, height);
  if (p.x < -10 || p.y < -10 || p.x > width + 10 || p.y > height + 10) return;
  ctx.font = "600 11px Segoe UI, sans-serif";
  const text = `${point.id} · RD ${format(point.x)} / ${format(point.y)}`;
  const boxWidth = ctx.measureText(text).width + 14;
  const x = Math.max(4, Math.min(p.x + 10, width - boxWidth - 4));
  const y = Math.max(95, Math.min(p.y - 30, height - 75));
  ctx.fillStyle = "rgba(21,23,27,.94)";
  ctx.fillRect(x, y, boxWidth, 23);
  ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.strokeRect(x, y, boxWidth, 23);
  ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(x + 3, y + 22); ctx.stroke();
  ctx.fillStyle = color; ctx.fillText(text, x + 7, y + 16);
}

function marker(point, color, camera = false) {
  const p = rdToPixel(point, view, width, height);
  ctx.beginPath(); ctx.arc(p.x, p.y, selected === point.id ? 9 : 6, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = "#17191e"; ctx.lineWidth = 2; ctx.stroke();
  if (!camera) tag(point, color);
}

function draw() {
  const ratio = window.devicePixelRatio || 1;
  const w = Math.round(width * ratio), h = Math.round(height * ratio);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  // Keep the previous image attached to its own RD bounds while the next
  // request is loading. Stretching it to the new bounds would misplace points.
  if (image && imageBounds) {
    const topLeft = rdToPixel({ x:imageBounds.minX, y:imageBounds.maxY }, view, width, height);
    ctx.drawImage(image, topLeft.x, topLeft.y,
      (imageBounds.maxX - imageBounds.minX) / view.scale,
      (imageBounds.maxY - imageBounds.minY) / view.scale);
  }
  for (const line of scene.lines) {
    ctx.beginPath();
    line.points.forEach((point, index) => {
      const p = rdToPixel(point, view, width, height);
      if (index === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    });
    ctx.strokeStyle = "rgba(21,23,27,.9)"; ctx.lineWidth = 6; ctx.stroke();
    ctx.strokeStyle = line.color; ctx.lineWidth = 3; ctx.stroke();
    line.points.forEach(point => marker(point, line.color));
  }
  if (scene.target) marker(scene.target, "#72f3dc");
  if (scene.camera) {
    const p = rdToPixel(scene.camera, view, width, height);
    const angle = scene.camera.heading * Math.PI / 180;
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.sin(angle - 0.45) * 27, p.y - Math.cos(angle - 0.45) * 27);
    ctx.lineTo(p.x + Math.sin(angle + 0.45) * 27, p.y - Math.cos(angle + 0.45) * 27);
    ctx.closePath(); ctx.fillStyle = "rgba(91,172,255,.5)"; ctx.fill();
    marker(scene.camera, "#8cc8ff", true);
  }
  const raw = view.scale * 100, magnitude = 10 ** Math.floor(Math.log10(raw));
  const distance = [1, 2, 5, 10].map(n => n * magnitude).find(n => n >= raw);
  $("scale").textContent = `${distance >= 1000 ? distance / 1000 + " km" : distance + " m"} ↔ ${Math.round(distance / view.scale)} px · noord ↑`;
}

function list() {
  const host = $("point-list"); host.replaceChildren();
  $("count").textContent = String(points().length);
  const chosen=editablePoints().find(p=>p.id===selected);
  $("correction-editor").hidden=!chosen;
  if(chosen) {
    $("selected-title").textContent=`${chosen.id} corrigeren`;
    $("correct-x").value=chosen.x.toFixed(2);$("correct-y").value=chosen.y.toFixed(2);
  }
  const calibration=scene.calibration;
  $("save-correction").disabled=!scene.contextKey||calibration?.saving;
  $("reset-calibration").disabled=!calibration?.count||calibration?.saving;
  $("calibration-info").textContent=calibration?.count
    ? `${calibration.count} bewaard referentiepunt${calibration.count===1?"":"en"} · ${calibration.kind==="similarity"?"verschuiving, schaal en richting":"verschuiving"}`
    : "Nog geen kalibratie voor dit standpunt.";
  if(calibration?.saving)$("correction-status").textContent="Kaartcorrectie opslaan…";
  else if(calibration?.feedback)$("correction-status").textContent=calibration.feedback;
  if (scene.camera) {
    const camera = document.createElement("p"); camera.className = "intro camera-key";
    camera.textContent = `Camera · RD ${format(scene.camera.x)} / ${format(scene.camera.y)}`;
    host.append(camera);
  }
  if (!points().length) {
    const empty = document.createElement("p"); empty.className = "empty";
    empty.textContent = "Nog geen meetpunten. Open Street View en plaats punten of lijnen. Ze verschijnen hier automatisch zodra RD-coördinaten beschikbaar zijn.";
    host.append(empty); return;
  }
  const groups = scene.lines.concat(scene.target ? [{ id:"Triangulatie", color:"#72f3dc", points:[scene.target] }] : []);
  for (const line of groups) {
    const label = document.createElement("p"); label.className = "line-label";
    label.textContent = line.id === "Triangulatie" ? "Triangulatiedoel" : `Lijn ${line.id.slice(1)} · ${line.points.length} punt${line.points.length === 1 ? "" : "en"}`;
    host.append(label);
    for (const point of line.points) {
      const button = document.createElement("button"); button.type = "button";
      button.className = "point-row" + (selected === point.id ? " selected" : "");
      button.style.borderLeftColor = line.color;
      button.setAttribute("aria-label", `${point.id} · RD X ${format(point.x)} · RD Y ${format(point.y)}`);
      const title = document.createElement("strong"); title.textContent = point.id;
      button.append(title);
      const rows = [`RD X ${format(point.x)} m`, `RD Y ${format(point.y)} m`];
      if(point.correction)rows.push(point.correction==="handmatige_kaartcorrectie"?"Handmatig kaartgecorrigeerd":"Bewaarde kalibratie toegepast");
      if (Number.isFinite(point.lat) && Number.isFinite(point.lng)) rows.push(`${point.lat.toFixed(8)}, ${point.lng.toFixed(8)}`);
      for (const text of rows) { const span = document.createElement("span"); span.className = "coordinate"; span.textContent = text; button.append(span); }
      button.addEventListener("click", () => {
        selected = point.id; $("follow").checked = false;
        changeView({ ...view, x:point.x, y:point.y }); list();
      });
      host.append(button);
    }
  }
}

function update(next) {
  if(drag&&next.contextKey!==scene.contextKey) {drag=null;canvas.classList.remove("dragging");}
  scene = next;
  if (!points().some(point => point.id === selected)) selected = null;
  const geometry = JSON.stringify({ camera:scene.camera && { x:scene.camera.x, y:scene.camera.y },
    points:points().map(p => [p.id, p.x, p.y]) });
  list();
  if ($("follow").checked && geometry !== lastGeometry) fit(); else draw();
  lastGeometry = geometry;
}

function zoom(factor, anchor = { x:width / 2, y:height / 2 }) {
  const before = pixelToRD(anchor, view, width, height);
  const scale = Math.max(0.04, Math.min(1000, view.scale * factor));
  changeView({ x:before.x - (anchor.x - width / 2) * scale,
    y:before.y + (anchor.y - height / 2) * scale, scale });
}
function pointer(event) {
  const rect = canvas.getBoundingClientRect();
  return { x:event.clientX - rect.left, y:event.clientY - rect.top };
}
canvas.addEventListener("wheel", event => { event.preventDefault(); $("follow").checked = false; zoom(Math.exp(Math.max(-1, Math.min(1, event.deltaY * 0.002))), pointer(event)); }, { passive:false });
canvas.addEventListener("pointerdown", event => {
  if (event.button !== 0) return;
  canvas.setPointerCapture(event.pointerId);
  const position=pointer(event);
  const point=$("correct-mode").checked&&!scene.calibration?.saving&&scene.contextKey
    ? nearestPoint(position,editablePoints()) : null;
  drag = { start:position, view:{ ...view }, moved:false,point,
    original:point&&{x:point.x,y:point.y} };
  if(point) {selected=point.id;$("follow").checked=false;list();}
});
canvas.addEventListener("pointermove", event => {
  const position = pointer(event), rd = pixelToRD(position, view, width, height);
  $("cursor").textContent = `RD ${format(rd.x)} / ${format(rd.y)}`;
  if (!drag) return;
  const dx = position.x - drag.start.x, dy = position.y - drag.start.y;
  if (Math.hypot(dx, dy) > 3) drag.moved = true;
  if (!drag.moved) return;
  if(drag.point) {
    const rd=pixelToRD(position,view,width,height);
    drag.point.x=rd.x;drag.point.y=rd.y;
    $("correct-x").value=rd.x.toFixed(2);$("correct-y").value=rd.y.toFixed(2);
    draw();return;
  }
  $("follow").checked = false; canvas.classList.add("dragging");
  view = { ...drag.view, x:drag.view.x - dx * drag.view.scale, y:drag.view.y + dy * drag.view.scale }; draw();
});
canvas.addEventListener("pointerup", event => {
  if (!drag) return;
  if(drag.moved&&drag.point) {
    if(!saveCorrection(drag.point.id,drag.point.x,drag.point.y)) {
      Object.assign(drag.point,drag.original);draw();list();
    }
  }
  else if (drag.moved) requestImage();
  else {
    const position = pointer(event);
    selected=nearestPoint(position)?.id || null;
    draw(); list();
  }
  canvas.releasePointerCapture(event.pointerId); drag = null; canvas.classList.remove("dragging");
});
canvas.addEventListener("pointercancel", () => {
  if(drag?.point)Object.assign(drag.point,drag.original);
  drag = null; canvas.classList.remove("dragging");draw();list();requestImage();
});
function saveCorrection(id,x,y) {
  if(!scene.contextKey||!window.aerialMap||scene.calibration?.saving)return false;
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<-30000||x>330000||y<280000||y>650000) {
    $("correction-status").textContent="Vul geldige RD-coördinaten binnen Nederland in.";return false;
  }
  $("correction-status").textContent="Kaartcorrectie opslaan…";
  window.aerialMap.correct({id,key:scene.contextKey,x,y});
  return true;
}
$("save-correction").addEventListener("click",()=>{
  const x=$("correct-x"),y=$("correct-y");
  if(!x.value.trim()||!y.value.trim())return;
  saveCorrection(selected,Number(x.value),Number(y.value));
});
$("reset-calibration").addEventListener("click",()=>window.aerialMap?.reset(scene.contextKey));
$("correct-mode").addEventListener("change",()=>{
  canvas.classList.toggle("correcting",$("correct-mode").checked);
  document.querySelector(".map-hint").textContent=$("correct-mode").checked
    ? "Sleep een meetpunt naar de juiste locatie · de correctie wordt automatisch bewaard"
    : "Sleep om te verschuiven · scroll om te zoomen · klik een meetpunt voor coördinaten";
});
canvas.addEventListener("keydown", event => {
  if (["+", "=", "-"].includes(event.key)) { event.preventDefault(); $("follow").checked = false; zoom(event.key === "-" ? 1.5 : 1 / 1.5); }
  const delta = { ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,1], ArrowDown:[0,-1] }[event.key];
  if (delta) { event.preventDefault(); $("follow").checked = false; changeView({ ...view, x:view.x + delta[0] * 80 * view.scale, y:view.y + delta[1] * 80 * view.scale }); }
});
$("zoom-in").addEventListener("click", () => { $("follow").checked = false; zoom(1 / 1.5); });
$("zoom-out").addEventListener("click", () => { $("follow").checked = false; zoom(1.5); });
$("fit").addEventListener("click", fit);
$("retry").addEventListener("click", requestImage);
$("follow").addEventListener("change", () => { if ($("follow").checked) fit(); });
new ResizeObserver(() => {
  const rect = canvas.getBoundingClientRect(); width = Math.max(1, rect.width); height = Math.max(1, rect.height);
  if ($("follow").checked && boundsPoints().length) fit(); else { draw(); requestImage(); }
}).observe($("map-area"));
list();
if (window.aerialMap) { window.aerialMap.onUpdate(update); window.aerialMap.ready(); }
else status("Open dit kaartvenster via de Windows-app.", true);
