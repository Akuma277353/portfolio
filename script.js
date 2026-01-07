const wins = new Map();
let zTop = 20;

let startBtnEl = null;
let startMenuEl = null;

const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];

function isIconPath(s){
  return typeof s === "string" && (s.includes("/") || s.includes(".")) && !/\p{Extended_Pictographic}/u.test(s);
}

function init() {
  initWindows();
  initDesktopIcons();
  initStartMenu();
  initClock();
  initPopups();
  initGlobalOpenButtons();
  initResumeMeta();

  // Open Notes by default (startup layout)
  openWin("win-notes");
  // Pin Notes to top-left like the Win95 desktop
  setWinRect("win-notes", { left: 14, top: 14, width: 640, height: 380 });
  repositionNotesLeft();

  window.addEventListener("resize", () => {
    if (isWinOpen("win-notes")) repositionNotesLeft();
  });

  // Notes chips open windows
  $$("#win-notes [data-open]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      if (btn.tagName !== "BUTTON") return;
      e.preventDefault();
      e.stopPropagation();
      openWin(btn.dataset.open);
      closeStartMenu();
    });
  });

  // ESC closes start menu or active window
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;

    if (!$("#startMenu")?.hasAttribute("hidden")) {
      closeStartMenu();
      return;
    }
    const active = $(".win.active");
    if (active) closeWin(active.id);
  });
}

function initWindows(){
  $$(".win").forEach(win => {
    const id = win.id;
    const title = win.dataset.title || id;
    const icon = win.dataset.icon || "🗔";

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

    win.style.left = wins.get(id).x + "px";
    win.style.top  = wins.get(id).y + "px";

    // focus when clicked
    win.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      focusWin(id);
    });

    win.querySelectorAll("[data-action]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        if (action === "close") closeWin(id);
        if (action === "minimize") minimizeWin(id);
      });
    });

    const handle = win.querySelector("[data-drag-handle]");
    if (handle) makeDraggable(win, handle);
  });

  renderTasks();
}

function initDesktopIcons(){
  const desktop = $("#desktop");

  desktop.addEventListener("click", (e) => {
    if (e.target.closest(".win") || e.target.closest(".taskbar") || e.target.closest(".start-menu")) return;
    clearIconSelection();
    closeStartMenu();
  });

  $$(".desk-icon[data-open]").forEach(icon => {
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
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const selected = $(".desk-icon.selected");
    if (selected?.dataset.open) openWin(selected.dataset.open);
  });
}

function initStartMenu(){
  startBtnEl = $("#startBtn");
  startMenuEl = $("#startMenu");

  startBtnEl.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleStartMenu();
  });

  document.addEventListener("click", (e) => {
    if (e.target.closest("#startMenu") || e.target.closest("#startBtn")) return;
    closeStartMenu();
  });

  // start menu buttons that open internal windows
  $$("#startMenu [data-open]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openWin(btn.dataset.open);
      closeStartMenu();
    });
  });
}

function toggleStartMenu(){
  if (!startMenuEl) return;
  if (startMenuEl.hasAttribute("hidden")) startMenuEl.removeAttribute("hidden");
  else startMenuEl.setAttribute("hidden", "");
}

function closeStartMenu(){
  if (!startMenuEl) return;
  startMenuEl.setAttribute("hidden", "");
}

function clearIconSelection(){
  $$(".desk-icon.selected").forEach(el => el.classList.remove("selected"));
}

function isWinOpen(id){
  const win = $("#"+id);
  return !!(win && win.classList.contains("open") && !win.classList.contains("minimized"));
}

function openWin(id, opts={}){
  const win = $("#"+id);
  const st = wins.get(id);
  if (!win || !st) return;

  st.open = true;
  st.minimized = false;
  win.classList.add("open");
  win.classList.remove("minimized");

  if (!st.w) st.w = win.offsetWidth;
  if (!st.h) st.h = win.offsetHeight;

  // First time a window opens: place it.
  if (!st.everOpened) {
    st.everOpened = true;
    if (id === "win-notes") {
      requestAnimationFrame(() => repositionNotesLeft());
    } else {
      requestAnimationFrame(() => spawnOnRight(id));
    }
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
    win.style.left = Math.max(6, (vw - w)/2) + "px";
    win.style.top  = Math.max(6, (vh - h)/2) + "px";
  }

  focusWin(id);
  renderTasks();
}

function minimizeWin(id){
  const win = $("#"+id);
  const st = wins.get(id);
  if (!win || !st) return;

  st.minimized = true;
  win.classList.add("minimized");
  win.classList.remove("active");
  renderTasks();
}

function focusWin(id){
  const win = $("#"+id);
  const st = wins.get(id);
  if (!win || !st) return;

  $$(".win.active").forEach(w => w.classList.remove("active"));

  win.classList.add("active");
  zTop += 1;
  win.style.zIndex = zTop;

  renderTasks();
}

function closeWin(id){
  const win = $("#"+id);
  const st = wins.get(id);
  if (!win || !st) return;

  st.open = false;
  st.minimized = false;
  win.classList.remove("open","minimized","active");

  renderTasks();
}

/* Force a window size + position (and keep internal state synced) */
function setWinRect(id, { left, top, width, height } = {}) {
  const win = document.getElementById(id);
  const st = wins.get(id);
  if (!win || !st) return;

  if (typeof width === "number")  win.style.width  = width + "px";
  if (typeof height === "number") win.style.height = height + "px";
  if (typeof left === "number")   win.style.left   = left + "px";
  if (typeof top === "number")    win.style.top    = top + "px";

  st.x = parseFloat(win.style.left) || st.x;
  st.y = parseFloat(win.style.top)  || st.y;
  st.w = win.offsetWidth;
  st.h = win.offsetHeight;
}

/* Draggable windows */
function makeDraggable(win, handle){
  let dragging = false;
  let startX = 0, startY = 0;
  let startLeft = 0, startTop = 0;

  handle.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
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

  function onMove(e){
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    win.style.left = (startLeft + dx) + "px";
    win.style.top  = (startTop + dy) + "px";
  }

  function onUp(){
    dragging = false;
    handle.style.cursor = "grab";
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);

    // persist position + stop any "pinning" behavior
    const st = wins.get(win.id);
    if (st) {
      st.userMoved = true;
      st.x = parseInt(win.style.left || "0", 10);
      st.y = parseInt(win.style.top  || "0", 10);
    }
  }
}

/* Notes pinned (left) */
function repositionNotesLeft(){
  const win = document.getElementById("win-notes");
  const st = wins.get("win-notes");
  if (!win || !st) return;

  // If the user has dragged Notes, don't keep pinning it.
  if (st.userMoved) return;

  const margin = 120;
  const top = 70;

  win.style.left = margin + "px";
  win.style.top  = top + "px";

  // keep state synced
  st.x = margin;
  st.y = top;
}

let rightSpawnIndex = 0;

function spawnOnRight(id){
  const win = document.getElementById(id);
  const st = wins.get(id);
  if (!win || !st) return;

  const margin = 14;
  const taskbarH = 40;
  const vw = window.innerWidth;
  const vh = window.innerHeight - taskbarH;

  const w = win.offsetWidth || st.w || 520;
  const h = win.offsetHeight || st.h || 320;

  // Stagger new windows down the right side
  const step = 34;
  const maxSteps = Math.max(1, Math.floor((vh - 20) / step));
  const k = rightSpawnIndex % maxSteps;
  rightSpawnIndex++;

  const left = Math.max(margin, vw - w - margin);
  const top  = Math.max(margin, Math.min(margin + k * step, vh - h - margin));

  win.style.left = left + "px";
  win.style.top  = top + "px";

  st.x = left;
  st.y = top;
}

/* Taskbar tasks */
function renderTasks(){
  const tasksEl = $("#tasks");
  if (!tasksEl) return;

  tasksEl.innerHTML = "";
  const openWins = [...wins.values()].filter(w => w.open);

  openWins.forEach(w => {
    const winEl = $("#"+w.id);
    if (!winEl) return;

    const btn = document.createElement("button");
    btn.className = "task" + (winEl.classList.contains("active") ? " active" : "");
    btn.type = "button";

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
  });
}

/* Global open buttons */
function initGlobalOpenButtons(){
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-open]");
    if (!btn) return;

    // ignore desktop icons and notes chips (they have their own handlers)
    if (btn.classList.contains("desk-icon")) return;
    if (btn.classList.contains("notes-chip")) return;

    e.preventDefault();
    e.stopPropagation();
    openWin(btn.dataset.open);
    closeStartMenu();
  });
}

/* Clock */
function initClock(){
  const clock = $("#clock");
  if (!clock) return;

  function tick(){
    const d = new Date();
    const hh = String(d.getHours()).padStart(2,"0");
    const mm = String(d.getMinutes()).padStart(2,"0");
    clock.textContent = `${hh}:${mm}`;
  }
  tick();
  setInterval(tick, 1000);
}

/* Popup info window */
function initPopups(){
  const popup = $("#popup");
  const popupTitle = $("#popupTitle");
  const popupBody = $("#popupBody");
  const popupClose = $("#popupClose");

  if (popupClose) popupClose.addEventListener("click", () => closeWin("popup"));

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".info-btn");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();

    if (popupTitle) popupTitle.textContent = btn.dataset.popupTitle || "Info";
    if (popupBody) popupBody.textContent = btn.dataset.popupBody || "";

    openWin("popup", { center: true });
  });
}

/* Resume meta */
function initResumeMeta(){
  updateResumeMeta();
}

async function updateResumeMeta(){
  const el = $("#resumeMeta");
  const statusLeft = $("#resumeStatusLeft");
  const statusRight = $("#resumeStatusRight");
  const infoLine = $("#resumeInfoLine");
  const resumeBody = $(".resume-body");
  if (!resumeBody) return;

  const pdf = resumeBody.dataset.pdf;
  if (!pdf) return;

  try{
    const r = await fetch(pdf, { method:"HEAD", cache:"no-cache" });
    const len = r.headers.get("content-length");
    const lm = r.headers.get("last-modified");

    const sizeKB = len ? Math.round(parseInt(len,10)/1024) : null;
    const last = lm ? safeDate(lm) : null;

    const meta = [
      "PDF",
      sizeKB ? `${sizeKB} KB` : null
    ].filter(Boolean).join(" • ");

    if (el) el.textContent = `(${meta})`;
    if (statusLeft) statusLeft.textContent = meta;
    if (infoLine) infoLine.textContent = meta;

    if (statusRight) {
      statusRight.textContent = last ? `Last updated: ${formatDateTime(last)}` : "Last updated: …";
    }
  } catch {
    if (el) el.textContent = "(PDF • …)";
    if (statusLeft) statusLeft.textContent = "PDF • …";
    if (infoLine) infoLine.textContent = "PDF • …";
    if (statusRight) statusRight.textContent = "Last updated: …";
  }
}

/* Make sure resume iframe is pointed to the pdf */
function hydrateResumeViewer(){
  const frame = $("#resumeFrame");
  const wrap = $(".resume-body");
  if (!frame || !wrap) return;

  const pdf = wrap.dataset.pdf;
  if (pdf && frame.getAttribute("src") !== pdf) {
    frame.setAttribute("src", pdf);
  }
}

function safeDate(v){
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function formatDateTime(d){
  const date = d.toLocaleDateString(undefined, { year:"numeric", month:"short", day:"numeric" });
  const time = d.toLocaleTimeString(undefined, { hour:"2-digit", minute:"2-digit" });
  return `${date} ${time}`;
}

document.addEventListener("DOMContentLoaded", init);
