// Win95-ish desktop UI (window manager, taskbar, start menu, popups)

const wins = new Map();
let zTop = 20;
let rightSpawnIndex = 0;

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const isIconPath = (v) =>
  typeof v === "string" && (v.includes("/") || v.includes(".")) && !/\p{Extended_Pictographic}/u.test(v);

let startBtnEl = null;
let startMenuEl = null;

function clearIconSelection(){
  $$(".desk-icon.selected").forEach(el => el.classList.remove("selected"));
}

function closeStartMenu(){
  if (startMenuEl) startMenuEl.setAttribute("hidden", "");
}

function toggleStartMenu(){
  if (!startMenuEl) return;
  startMenuEl.toggleAttribute("hidden");
}

function isWinOpen(id){
  const el = document.getElementById(id);
  return !!(el && el.classList.contains("open") && !el.classList.contains("minimized"));
}

function setWinRect(id, { left, top, width, height } = {}) {
  const win = document.getElementById(id);
  const st = wins.get(id);
  if (!win || !st) return;

  if (typeof width === "number")  win.style.width  = `${width}px`;
  if (typeof height === "number") win.style.height = `${height}px`;
  if (typeof left === "number")   win.style.left   = `${left}px`;
  if (typeof top === "number")    win.style.top    = `${top}px`;

  st.x = parseFloat(win.style.left) || st.x;
  st.y = parseFloat(win.style.top)  || st.y;
  st.w = win.offsetWidth;
  st.h = win.offsetHeight;
}

function focusWin(id){
  const win = document.getElementById(id);
  if (!win) return;

  $$(".win.active").forEach(w => w.classList.remove("active"));
  win.classList.add("active");
  win.style.zIndex = String(++zTop);

  renderTasks();
}

function closeWin(id){
  const win = document.getElementById(id);
  const st = wins.get(id);
  if (!win || !st) return;

  st.open = false;
  st.minimized = false;
  win.classList.remove("open", "minimized", "active");

  renderTasks();
}

function minimizeWin(id){
  const win = document.getElementById(id);
  const st = wins.get(id);
  if (!win || !st) return;

  st.minimized = true;
  win.classList.add("minimized");
  win.classList.remove("active");

  renderTasks();
}

function repositionNotesLeft(){
  const id = "win-notes";
  const win = document.getElementById(id);
  const st = wins.get(id);
  if (!win || !st) return;

  // If the user dragged Notes, stop pinning it.
  if (st.userMoved) return;

  const left = 120;
  const top  = 70;

  win.style.left = `${left}px`;
  win.style.top  = `${top}px`;

  st.x = left;
  st.y = top;
}

function spawnOnRight(id){
  const win = document.getElementById(id);
  const st = wins.get(id);
  if (!win || !st) return;

  // If user already positioned it, don't override.
  if (st.userMoved) return;

  const margin = 24;
  const vw = window.innerWidth;
  const vh = window.innerHeight - 40; // taskbar

  const w = win.offsetWidth;
  const h = win.offsetHeight;

  // Stagger down the right side
  const step = 34;
  const maxSteps = Math.max(1, Math.floor((vh - 20) / step));
  const k = rightSpawnIndex % maxSteps;
  rightSpawnIndex++;

  const left = Math.max(margin, vw - w - margin);
  const top  = Math.max(margin, Math.min(margin + k * step, vh - h - margin));

  win.style.left = `${left}px`;
  win.style.top  = `${top}px`;

  st.x = left;
  st.y = top;
}

function hydrateResumeViewer(){
  const frame = $("#resumeFrame");
  const wrap = $(".resume-body");
  if (!frame || !wrap) return;

  const pdf = wrap.dataset.pdf;
  if (pdf && frame.getAttribute("src") !== pdf) frame.setAttribute("src", pdf);
}

function safeDate(v){
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateTime(d){
  const date = d.toLocaleDateString(undefined, { year:"numeric", month:"short", day:"numeric" });
  const time = d.toLocaleTimeString(undefined, { hour:"2-digit", minute:"2-digit" });
  return `${date} ${time}`;
}

async function updateResumeMeta(){
  const metaEl = $("#resumeMeta");
  const statusLeft = $("#resumeStatusLeft");
  const statusRight = $("#resumeStatusRight");
  const infoLine = $("#resumeInfoLine");
  const resumeBody = $(".resume-body");
  if (!resumeBody) return;

  const pdf = resumeBody.dataset.pdf;
  if (!pdf) return;

  const setMeta = (meta, last) => {
    if (metaEl) metaEl.textContent = `(${meta})`;
    if (statusLeft) statusLeft.textContent = meta;
    if (infoLine) infoLine.textContent = meta;
    if (statusRight) statusRight.textContent = last ? `Last updated: ${formatDateTime(last)}` : "Last updated: …";
  };

  try{
    const r = await fetch(pdf, { method:"HEAD", cache:"no-cache" });
    const len = r.headers.get("content-length");
    const lm  = r.headers.get("last-modified");

    const sizeKb = len ? Math.round(Number(len)/1024) : null;
    const last = lm ? safeDate(lm) : null;

    setMeta(`PDF • ${sizeKb ? `${sizeKb} KB` : "…"}`
    , last);
  } catch {
    setMeta("PDF • …", null);
  }
}

function openWin(id, opts = {}){
  const win = document.getElementById(id);
  const st = wins.get(id);
  if (!win || !st) return;

  st.open = true;
  st.minimized = false;
  win.classList.add("open");
  win.classList.remove("minimized");

  if (!st.w) st.w = win.offsetWidth;
  if (!st.h) st.h = win.offsetHeight;

  // First open: place it.
  if (!st.everOpened) {
    st.everOpened = true;
    requestAnimationFrame(() => {
      if (id === "win-notes") repositionNotesLeft();
      else spawnOnRight(id);
    });
  }

  if (id === "win-resume") {
    requestAnimationFrame(() => {
      hydrateResumeViewer();
      updateResumeMeta();
    });
  }

  if (opts.center) {
    const vw = window.innerWidth;
    const vh = window.innerHeight - 40;
    const w = win.offsetWidth;
    const h = win.offsetHeight;
    win.style.left = `${Math.max(6, (vw - w)/2)}px`;
    win.style.top  = `${Math.max(6, (vh - h)/2)}px`;
  }

  focusWin(id);
  renderTasks();
}

function renderTasks(){
  const tasksEl = $("#tasks");
  if (!tasksEl) return;

  tasksEl.innerHTML = "";

  for (const w of wins.values()) {
    if (!w.open) continue;
    const winEl = document.getElementById(w.id);
    if (!winEl) continue;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "task" + (winEl.classList.contains("active") ? " active" : "");

    const icon = w.icon || "🗔";
    if (isIconPath(icon)) {
      const img = document.createElement("img");
      img.className = "task-icn";
      img.src = icon;
      img.alt = "";
      btn.appendChild(img);
    } else {
      const span = document.createElement("span");
      span.textContent = icon;
      btn.appendChild(span);
    }

    const text = document.createElement("span");
    text.className = "task-text";
    text.textContent = w.title;
    btn.appendChild(text);

    btn.addEventListener("click", (e) => {
      e.stopPropagation();

      if (w.minimized) {
        w.minimized = false;
        winEl.classList.remove("minimized");
        focusWin(w.id);
      } else if (winEl.classList.contains("active")) {
        minimizeWin(w.id);
      } else {
        focusWin(w.id);
      }

      closeStartMenu();
    });

    tasksEl.appendChild(btn);
  }
}

/* Draggable windows */
function makeDraggable(win, handle){
  let dragging = false;
  let startX = 0, startY = 0, startLeft = 0, startTop = 0;

  const onMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    win.style.left = `${startLeft + dx}px`;
    win.style.top  = `${startTop + dy}px`;
  };

  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    handle.style.cursor = "grab";
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);

    const st = wins.get(win.id);
    if (st) {
      st.userMoved = true;
      st.x = parseInt(win.style.left || "0", 10);
      st.y = parseInt(win.style.top  || "0", 10);
      st.w = win.offsetWidth;
      st.h = win.offsetHeight;
    }
  };

  handle.addEventListener("mousedown", (e) => {
    // don't drag when clicking window controls
    if (e.target.closest("[data-action]")) return;

    e.preventDefault();
    dragging = true;
    focusWin(win.id);
    handle.style.cursor = "grabbing";

    startX = e.clientX;
    startY = e.clientY;
    startLeft = parseInt(win.style.left || "0", 10);
    startTop  = parseInt(win.style.top  || "0", 10);

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
}

function initWindows(){
  for (const win of $$(".win")) {
    const id = win.id;
    const title = win.dataset.title || id;
    const icon  = win.dataset.icon || "🗔";

    wins.set(id, {
      id, title, icon,
      open: false,
      minimized: false,
      x: 80 + Math.floor(Math.random()*40),
      y: 60 + Math.floor(Math.random()*40),
      w: null,
      h: null,
      everOpened: false,
      userMoved: false
    });

    const st = wins.get(id);
    win.style.left = `${st.x}px`;
    win.style.top  = `${st.y}px`;

    win.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      focusWin(id);
    });

    // window controls (minimize / close)
    for (const btn of win.querySelectorAll("[data-action]")) {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        if (action === "close") closeWin(id);
        if (action === "minimize") minimizeWin(id);
      });
    }

    const handle = win.querySelector("[data-drag-handle]");
    if (handle) makeDraggable(win, handle);
  }

  renderTasks();
}

function initClock(){
  const clock = $("#clock");
  if (!clock) return;

  const tick = () => {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    clock.textContent = `${hh}:${mm}`;
  };

  tick();
  setInterval(tick, 1000);
}

function initDesktopIcons(){
  const desktop = $("#desktop");

  desktop?.addEventListener("click", (e) => {
    if (e.target.closest(".win, .taskbar, .start-menu")) return;
    clearIconSelection();
    closeStartMenu();
  });

  for (const icon of $$(".desk-icon[data-open]")) {
    icon.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearIconSelection();
      icon.classList.add("selected");
      closeStartMenu();
    });

    icon.addEventListener("dblclick", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openWin(icon.dataset.open);
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const selected = $(".desk-icon.selected");
    if (selected?.dataset.open) openWin(selected.dataset.open);
  });
}

function initStartMenu(){
  startBtnEl = $("#startBtn");
  startMenuEl = $("#startMenu");

  startBtnEl?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleStartMenu();
  });

  document.addEventListener("click", (e) => {
    if (e.target.closest("#startMenu, #startBtn")) return;
    closeStartMenu();
  });
}

function initPopups(){
  const popupTitle = $("#popupTitle");
  const popupBody  = $("#popupBody");
  const popupClose = $("#popupClose");

  popupClose?.addEventListener("click", () => closeWin("popup"));

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".info-btn");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    if (popupTitle) popupTitle.textContent = btn.dataset.popupTitle || "Info";
    if (popupBody)  popupBody.textContent  = btn.dataset.popupBody || "";

    openWin("popup", { center: true });
  });
}

function initGlobalOpenHandler(){
  // Handles Start menu internal buttons, Notes chips, etc.
  document.addEventListener("click", (e) => {
    const opener = e.target.closest("[data-open]");
    if (!opener) return;

    // Desktop icons: handled separately for selection + dblclick
    if (opener.classList.contains("desk-icon")) return;

    e.preventDefault();
    e.stopPropagation();

    openWin(opener.dataset.open);
    closeStartMenu();
  });
}

function initResumeMeta(){
  updateResumeMeta();
}

function init(){
  initWindows();
  initDesktopIcons();
  initStartMenu();
  initClock();
  initPopups();
  initGlobalOpenHandler();
  initResumeMeta();

  // Startup layout: open Notes and pin it.
  openWin("win-notes");
  setWinRect("win-notes", { left: 14, top: 14, width: 640, height: 380 });
  repositionNotesLeft();

  window.addEventListener("resize", () => {
    if (isWinOpen("win-notes")) repositionNotesLeft();
  });

  // ESC closes start menu or active window
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;

    if (startMenuEl && !startMenuEl.hasAttribute("hidden")) {
      closeStartMenu();
      return;
    }

    const active = $(".win.active");
    if (active) closeWin(active.id);
  });
}

document.addEventListener("DOMContentLoaded", init);
