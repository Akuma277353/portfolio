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
  openWin("win-notes");
  openWin("win-notes");

  const notesEl = document.getElementById("win-notes");
  if (notesEl) {
    // Force layout recalculation so height fits content
    notesEl.style.height = "auto";
  }

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
      const active = getActiveWin();
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

  // single-click selects, double-click opens
  $$(".desk-icon[data-open]").forEach(icon => {
    icon.addEventListener("click", (e) => {
      e.stopPropagation();
      selectIcon(icon);
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

function initStartMenu(){
  startBtnEl = $("#startBtn");
  startMenuEl = $("#startMenu");

  // start menu starts hidden by default
  startMenuEl?.setAttribute("hidden", "");

  startBtnEl?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleStartMenu();
  });
}

function toggleStartMenu(){
  if (!startMenuEl) return;
  const isHidden = startMenuEl.hasAttribute("hidden");
  if (isHidden) startMenuEl.removeAttribute("hidden");
  else startMenuEl.setAttribute("hidden", "");
}

function closeStartMenu(){
  if (!startMenuEl) return;
  startMenuEl.setAttribute("hidden", "");
}

function initClock(){
  const el = $("#clock");
  if (!el) return;

  const pad2 = n => String(n).padStart(2,"0");
  const tick = () => {
    const d = new Date();
    el.textContent = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  };
  tick();
  setInterval(tick, 1000);
}

function initPopups(){
  document.querySelectorAll("[data-popup-title][data-popup-body]").forEach(btn => {
    btn.addEventListener("click", () => {
      showPopup(btn.dataset.popupTitle, btn.dataset.popupBody);
    });
  });

  $("#popupClose")?.addEventListener("click", () => closeWin("popup"));

  // allow clicking backdrop to close popup
  $("#modalBackdrop")?.addEventListener("click", () => closeWin("popup"));
}

function showPopup(title, body){
  const popup = wins.get("popup");
  if (!popup) return;

  $("#popupTitle").textContent = title || "Message";
  $("#popupBody").textContent = body || "";

  $("#modalBackdrop").hidden = false;
  $("#modalBackdrop").setAttribute("aria-hidden", "false");

  openWin("popup", { center:true, modal:true });
}

function hidePopupBackdrop(){
  const b = $("#modalBackdrop");
  if (!b) return;
  b.hidden = true;
  b.setAttribute("aria-hidden", "true");
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
  if (!win) return;

  // set z-index
  zTop += 1;
  win.style.zIndex = zTop;

  // active class
  $$(".win").forEach(w => w.classList.remove("active"));
  win.classList.add("active");

  renderTasks(id);
}

function getActiveWin(){
  const el = $(".win.active");
  if (!el) return null;
  return wins.get(el.id) || null;
}

function renderTasks(activeId){
  const tasks = $("#tasks");
  if (!tasks) return;
  tasks.innerHTML = "";

  const openWins = [...wins.values()].filter(w => w.open);
  openWins.forEach(w => {
    // Hide popup from taskbar (feels like a modal)
    if (w.id === "popup") return;

    const btn = document.createElement("button");
    btn.className = "task";
    btn.type = "button";

    // Task button content (icon + title)
    btn.innerHTML = "";
    if (isIconPath(w.icon)) {
      const img = document.createElement("img");
      img.className = "task-icn";
      img.src = w.icon;
      img.alt = "";
      img.onerror = () => { img.remove(); };
      btn.appendChild(img);
    } else {
      // Fallback to text icon if it's not a path
      const tIcn = document.createElement("span");
      tIcn.className = "task-emoji";
      tIcn.textContent = w.icon;
      btn.appendChild(tIcn);
    }

    const text = document.createElement("span");
    text.className = "task-text";
    text.textContent = w.title;
    btn.appendChild(text);

    if (w.id === activeId) btn.classList.add("active");

    btn.addEventListener("click", () => {
      const win = $("#"+w.id);
      if (!win) return;

      // if minimized, restore
      if (w.minimized) {
        w.minimized = false;
        win.classList.remove("minimized");
        focusWin(w.id);
        renderTasks(w.id);
        return;
      }

      // if already active, minimize
      if (win.classList.contains("active")) {
        minimizeWin(w.id);
        return;
      }

      focusWin(w.id);
      renderTasks(w.id);
    });

    tasks.appendChild(btn);
  });
}

function clearIconSelection(){
  $$(".desk-icon.selected").forEach(i => i.classList.remove("selected"));
}

function selectIcon(iconEl){
  clearIconSelection();
  iconEl.classList.add("selected");
}

function makeDraggable(win, handle){
  let dragging = false;
  let startX = 0, startY = 0;
  let origX = 0, origY = 0;

  const onDown = (e) => {
    dragging = true;
    focusWin(win.id);
    handle.style.cursor = "grabbing";
    startX = e.clientX;
    startY = e.clientY;
    origX = parseInt(win.style.left || "0", 10);
    origY = parseInt(win.style.top  || "0", 10);

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const onMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    const vw = window.innerWidth;
    const vh = window.innerHeight - 40;

    const rect = win.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    let nx = origX + dx;
    let ny = origY + dy;

    // clamp inside viewport a bit
    nx = Math.min(vw - 60, Math.max(6, nx));
    ny = Math.min(vh - 40, Math.max(6, ny));

    win.style.left = nx + "px";
    win.style.top  = ny + "px";
  };

  const onUp = () => {
    dragging = false;
    handle.style.cursor = "grab";
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
  };

  handle.addEventListener("mousedown", onDown);
}

window.addEventListener("load", init);
