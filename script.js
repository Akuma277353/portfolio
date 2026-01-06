// Win95-ish window manager: open/close/minimize, drag, z-index focus,
// desktop selection, start menu, taskbar, + double-click to open icons.
const wins = new Map(); // id -> state
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
  openWin("win-notes", { right: true, top: 14 });

  const notesEl = document.getElementById("win-notes");
  if (notesEl) {
    // Force layout recalculation so height fits content
    notesEl.style.height = "auto";
  }

  // Notes shortcuts (single-click)
  $$("#win-notes .notes-chip[data-open]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openWin(btn.dataset.open);
    });
  });

  // close start menu on global click (but not when clicking inside it)
  document.addEventListener("click", (e) => {
    if (e.target.closest("#startMenu") || e.target.closest("#startBtn")) return;
    closeStartMenu();
  });

  // keyboard: Esc closes active window or start menu
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!$("#startMenu")?.hasAttribute("hidden")) {
        closeStartMenu();
        return;
      }
      const active = $(".win.active");
      if (active) closeWin(active.id);
    }
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

    // init position
    win.style.left = wins.get(id).x + "px";
    win.style.top  = wins.get(id).y + "px";

    // control buttons
    win.addEventListener("click", () => focusWin(id));

    win.querySelectorAll("[data-action]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        if (action === "close") closeWin(id);
        if (action === "minimize") minimizeWin(id);
      });
    });

    // drag
    const handle = win.querySelector("[data-drag-handle]");
    if (handle) makeDraggable(win, handle);
  });

  renderTasks();
}

function initDesktopIcons(){
  const desktop = $("#desktop");

  // clear selection when clicking empty desktop space
  desktop.addEventListener("click", (e) => {
    if (e.target.closest(".win") || e.target.closest(".taskbar") || e.target.closest(".start-menu")) return;
    clearIconSelection();
    closeStartMenu();
  });

  // icon select / open
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

  // keyboard: Enter opens selected icon
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const selected = $(".desk-icon.selected");
    if (selected?.dataset.open) openWin(selected.dataset.open);
  });
}

function clearIconSelection(){
  $$(".desk-icon.selected").forEach(el => el.classList.remove("selected"));
}

function openWin(id, opts={}){
  const win = $("#"+id);
  const st = wins.get(id);
  if (!win || !st) return;

  st.open = true;
  st.minimized = false;
  win.classList.add("open");
  win.classList.remove("minimized");

  // initial sizing capture (optional)
  if (!st.w) st.w = win.offsetWidth;
  if (!st.h) st.h = win.offsetHeight;

  // ensure on-screen
  if (opts.center) {
    const vw = window.innerWidth;
    const vh = window.innerHeight - 40;
    const w = win.offsetWidth;
    const h = win.offsetHeight;
    win.style.left = Math.max(6, (vw - w)/2) + "px";
    win.style.top  = Math.max(6, (vh - h)/2) + "px";
  }

  if (opts.right) {
    const margin = (typeof opts.margin === "number") ? opts.margin : 14;
    const top = (typeof opts.top === "number") ? opts.top : 14;
    const vw = window.innerWidth;
    const vh = window.innerHeight - 40;
    const w = win.offsetWidth;
    const h = win.offsetHeight;
    win.style.left = Math.max(6, vw - w - margin) + "px";
    win.style.top  = Math.max(6, Math.min(top, vh - h - 6)) + "px";
  }

  focusWin(id);

  // modal behavior: hide from taskbar already handled, but we show backdrop here
  if (opts.modal) {
    $("#modalBackdrop").hidden = false;
    $("#modalBackdrop").setAttribute("aria-hidden","false");
  }

  renderTasks();
}

function closeWin(id){
  const win = $("#"+id);
  const st = wins.get(id);
  if (!win || !st) return;

  st.open = false;
  st.minimized = false;
  win.classList.remove("open","minimized","active");

  if (id === "popup") hidePopupBackdrop();

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

  // bring to front
  zTop += 1;
  win.style.zIndex = zTop;

  // active class
  $$(".win.active").forEach(w => w.classList.remove("active"));
  win.classList.add("active");

  renderTasks();
}

function renderTasks(){
  const tasksEl = $("#tasks");
  if (!tasksEl) return;

  tasksEl.innerHTML = "";

  // only non-popup windows go into taskbar
  const openWins = [...wins.values()].filter(w => w.open && w.id !== "popup");
  openWins.forEach(w => {
    const btn = document.createElement("button");
    btn.className = "task";
    btn.type = "button";
    btn.dataset.win = w.id;

    // icon (path or emoji)
    if (isIconPath(w.icon)) {
      const img = document.createElement("img");
      img.className = "task-icn";
      img.src = w.icon;
      img.alt = "";
      img.onerror = () => img.remove();
      btn.appendChild(img);
    } else {
      const spanI = document.createElement("span");
      spanI.className = "task-emoji";
      spanI.textContent = w.icon;
      btn.appendChild(spanI);
    }

    const spanT = document.createElement("span");
    spanT.className = "task-text";
    spanT.textContent = w.title;
    btn.appendChild(spanT);

    // click: toggle minimize/focus
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

    // mark active
    const winEl = $("#"+w.id);
    if (winEl?.classList.contains("active")) btn.classList.add("active");

    tasksEl.appendChild(btn);
  });
}

/* Dragging */
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

function openStartMenu(){
  if (!startMenuEl) return;
  startMenuEl.removeAttribute("hidden");
}

function closeStartMenu(){
  if (!startMenuEl) return;
  startMenuEl.setAttribute("hidden","");
}

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

/* Popups from Projects info buttons */
function initPopups(){
  // buttons with data-popup-title/body open modal popup
  $$(".list-item-btn[data-popup-title]").forEach(btn => {
    btn.addEventListener("click", () => {
      const title = btn.dataset.popupTitle || "Message";
      const body  = btn.dataset.popupBody  || "";
      showPopup(title, body);
    });
  });

  $("#popupClose")?.addEventListener("click", () => closeWin("popup"));
  $("#modalBackdrop")?.addEventListener("click", () => closeWin("popup"));
}

function showPopup(title, body){
  $("#popupTitle").textContent = title;
  $("#popupBody").textContent = body;
  openWin("popup", { center: true, modal: true });
}

function hidePopupBackdrop(){
  const bd = $("#modalBackdrop");
  if (!bd) return;
  bd.hidden = true;
  bd.setAttribute("aria-hidden","true");
}

document.addEventListener("DOMContentLoaded", init);
