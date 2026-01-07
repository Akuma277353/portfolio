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

  // Open Notes + About by default
  openWin("win-notes");
  openWin("win-about");
  setWinRect("win-about", { width: 900, height: 700, left: 180, top: 60 });

  // pin Notes to right
  repositionNotesRight();
  window.addEventListener("resize", () => {
    if (isWinOpen("win-notes")) repositionNotesRight();
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

  // Close start menu on outside click
  document.addEventListener("click", (e) => {
    if (e.target.closest("#startMenu") || e.target.closest("#startBtn")) return;
    closeStartMenu();
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
      h: null
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

function initGlobalOpenButtons(){
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-open]");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();
    openWin(btn.dataset.open);
    closeStartMenu();
  });
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

  if (id === "win-notes") {
    requestAnimationFrame(() => repositionNotesRight());
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

function closeWin(id){
  const win = $("#"+id);
  const st = wins.get(id);
  if (!win || !st) return;

  st.open = false;
  st.minimized = false;
  win.classList.remove("open","minimized","active");

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

  zTop += 1;
  win.style.zIndex = zTop;

  $$(".win.active").forEach(w => w.classList.remove("active"));
  win.classList.add("active");

  renderTasks();
}

function renderTasks(){
  const tasksEl = $("#tasks");
  if (!tasksEl) return;

  tasksEl.innerHTML = "";
  const openWins = [...wins.values()].filter(w => w.open);

  openWins.forEach(w => {
    const btn = document.createElement("button");
    btn.className = "task";
    btn.type = "button";
    btn.dataset.win = w.id;

    if (isIconPath(w.icon)) {
      const img = document.createElement("img");
      img.className = "task-icn";
      img.src = w.icon;
      img.alt = "";
      img.onerror = () => img.remove();
      btn.appendChild(img);
    } else {
      const spanI = document.createElement("span");
      spanI.textContent = w.icon;
      btn.appendChild(spanI);
    }

    const spanT = document.createElement("span");
    spanT.className = "task-text";
    spanT.textContent = w.title;
    btn.appendChild(spanT);

    btn.addEventListener("click", () => {
      const win = $("#"+w.id);
      if (!win) return;
      if (win.classList.contains("minimized")) {
        openWin(w.id);
      } else if (win.classList.contains("active")) {
        minimizeWin(w.id);
      } else {
        focusWin(w.id);
      }
    });

    const winEl = $("#"+w.id);
    if (winEl?.classList.contains("active")) btn.classList.add("active");

    tasksEl.appendChild(btn);
  });
}

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
  }
}

/* Notes pinned right */
function repositionNotesRight(){
  const win = $("#win-notes");
  if (!win) return;

  const margin = 14;
  const top = 14;
  const vw = window.innerWidth;
  const vh = window.innerHeight - 40;

  const w = win.offsetWidth || 640;
  const h = win.offsetHeight || 380;

  win.style.left = Math.max(6, vw - w - margin) + "px";
  win.style.top  = Math.max(6, Math.min(top, vh - h - 6)) + "px";
}

/* Start menu */
function initStartMenu(){
  startBtnEl = $("#startBtn");
  startMenuEl = $("#startMenu");
  if (!startBtnEl || !startMenuEl) return;

  startBtnEl.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleStartMenu();
  });
}

function toggleStartMenu(){
  if (!startMenuEl) return;
  const hidden = startMenuEl.hasAttribute("hidden");
  if (hidden) openStartMenu();
  else closeStartMenu();
}
function openStartMenu(){ startMenuEl?.removeAttribute("hidden"); }
function closeStartMenu(){ startMenuEl?.setAttribute("hidden",""); }

/* Clock */
function initClock(){
  const el = $("#clock");
  if (!el) return;

  const tick = () => {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2,"0");
    const mm = String(d.getMinutes()).padStart(2,"0");
    el.textContent = `${hh}:${mm}`;
  };
  tick();
  setInterval(tick, 1000 * 10);
}

/* Popups (Info) - NON MODAL, works for all buttons with data-popup-title */
function initPopups(){
  // Event delegation: catches ALL current and future info buttons
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".info-btn[data-popup-title][data-popup-body]");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    showPopup(btn.dataset.popupTitle || "Info", btn.dataset.popupBody || "");
  });

  $("#popupClose")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeWin("popup");
  });
}

function showPopup(title, body){
  const titleEl = $("#popupTitle");
  const bodyEl = $("#popupBody");
  if (titleEl) titleEl.textContent = title;
  if (bodyEl) bodyEl.textContent = body;

  openWin("popup", { center: true });
}

/* Resume meta */
function initResumeMeta(){
  updateResumeMeta();
}

function hydrateResumeViewer(){
  const resumeWin = $("#win-resume");
  if (!resumeWin) return;

  const pdf = resumeWin.querySelector(".resume-body")?.dataset?.pdf || "assets/Abubakar_Shaikh_Resume.pdf";

  const frame = $("#resumeFrame");
  if (frame && frame.getAttribute("src") !== pdf) frame.setAttribute("src", pdf);

  const openBtn = $("#resumeOpenNewTab");
  const dlBtn = $("#resumeDownload");
  if (openBtn) openBtn.href = pdf;
  if (dlBtn) dlBtn.href = pdf;
}

async function updateResumeMeta(){
  const resumeWin = $("#win-resume");
  const pdf = resumeWin?.querySelector(".resume-body")?.dataset?.pdf || "assets/Abubakar_Shaikh_Resume.pdf";

  const last = safeDate(document.lastModified);
  const lastStr = last ? formatDateTime(last) : "Unknown";
  const statusRight = $("#resumeStatusRight");
  if (statusRight) statusRight.textContent = `Last updated: ${lastStr}`;

  let sizeStr = "…";
  try {
    const res = await fetch(pdf, { method: "HEAD", cache: "no-store" });
    const len = res.headers.get("content-length");
    if (len) sizeStr = humanBytes(Number(len));
  } catch {}

  const line = sizeStr === "…" ? "PDF" : `PDF • ${sizeStr}`;

  $("#resumeInfoLine") && ($("#resumeInfoLine").textContent = line);
  $("#resumeStatusLeft") && ($("#resumeStatusLeft").textContent = line);
  $("#resumeMeta") && ($("#resumeMeta").textContent = `(${line})`);
}

function humanBytes(bytes){
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B","KB","MB","GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  const digits = i === 0 ? 0 : (i === 1 ? 1 : 2);
  return `${n.toFixed(digits)} ${units[i]}`;
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
