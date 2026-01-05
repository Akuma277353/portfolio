// Win95-ish window manager: open/close/minimize, drag, z-index focus, desktop selection, start menu, taskbar.
const wins = new Map(); // id -> state
let zTop = 20;

const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];

function init() {
  initWindows();
  initDesktopIcons();
  initStartMenu();
  initClock();
  initClipboard();
  // open About by default
  openWin("win-about");
}

function initWindows() {
  $$(".win").forEach((el, idx) => {
    const id = el.id;
    const title = el.dataset.title || $(".win-title-text", el)?.textContent?.trim() || id;
    const icon = el.dataset.icon || "🪟";

    // initial placement
    el.style.left = (140 + idx * 28) + "px";
    el.style.top  = (70 + idx * 22) + "px";
    el.style.zIndex = String(zTop + idx);

    wins.set(id, {
      el, id, title, icon,
      open: false,
      minimized: false,
      taskBtn: null
    });

    // focus on click
    el.addEventListener("mousedown", () => focusWin(id));

    // controls
    $$("[data-action]", el).forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        if (action === "close") closeWin(id);
        if (action === "minimize") minimizeWin(id);
      });
    });

    // drag
    const handle = $("[data-drag-handle]", el);
    if (handle) enableDrag(el, handle, id);
  });
}

function enableDrag(winEl, handleEl, id) {
  let dragging = false;
  let startX = 0, startY = 0;
  let origLeft = 0, origTop = 0;

  handleEl.addEventListener("mousedown", (e) => {
    if (e.target.closest("button")) return;
    dragging = true;
    focusWin(id);
    handleEl.style.cursor = "grabbing";
    startX = e.clientX; startY = e.clientY;

    const rect = winEl.getBoundingClientRect();
    origLeft = rect.left; origTop = rect.top;
    e.preventDefault();
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    let left = origLeft + dx;
    let top  = origTop + dy;

    // keep within bounds (desktop area)
    const pad = 6;
    const maxLeft = window.innerWidth - winEl.offsetWidth - pad;
    const maxTop  = window.innerHeight - 40 - winEl.offsetHeight - pad;

    left = Math.max(pad, Math.min(maxLeft, left));
    top  = Math.max(pad, Math.min(maxTop, top));

    winEl.style.left = left + "px";
    winEl.style.top  = top + "px";
  });

  window.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    handleEl.style.cursor = "grab";
  });
}

function initDesktopIcons() {
  // single click selects; double click opens
  const icons = $$(".desk-icon");
  let lastClickTime = 0;
  let lastIcon = null;

  function clearSelection() {
    icons.forEach(i => i.classList.remove("selected"));
  }

  icons.forEach(icon => {
    icon.addEventListener("click", () => {
      clearSelection();
      icon.classList.add("selected");

      const now = Date.now();
      const isDouble = lastIcon === icon && (now - lastClickTime) < 350;
      lastClickTime = now;
      lastIcon = icon;

      if (isDouble) {
        openWin(icon.dataset.open);
      }
    });
  });

  // clicking desktop background clears selection + closes start menu
  $("#desktop").addEventListener("mousedown", (e) => {
    if (e.target.closest(".desk-icon")) return;
    clearSelection();
    hideStartMenu();
  });

  // start menu items can open too
  $$("[data-open]").forEach(btn => {
    if (btn.classList.contains("menu-item") || btn.classList.contains("desk-icon")) {
      btn.addEventListener("click", (e) => {
        // for menu items, single click opens
        if (btn.classList.contains("menu-item")) {
          openWin(btn.dataset.open);
          hideStartMenu();
        }
      });
    }
  });
}

function createTaskBtn(id) {
  const w = wins.get(id);
  const tasks = $("#tasks");
  const btn = document.createElement("button");
  btn.className = "task";
  btn.textContent = `${w.icon} ${w.title}`;
  btn.addEventListener("click", () => {
    const ww = wins.get(id);
    if (!ww.open) openWin(id);
    else if (ww.minimized) restoreWin(id);
    else {
      const isActive = btn.classList.contains("active");
      if (isActive) minimizeWin(id);
      else focusWin(id);
    }
  });
  tasks.appendChild(btn);
  w.taskBtn = btn;
}

function setActiveTask(id) {
  wins.forEach(w => w.taskBtn?.classList.remove("active"));
  const w = wins.get(id);
  w?.taskBtn?.classList.add("active");
}

function focusWin(id) {
  const w = wins.get(id);
  if (!w || !w.open || w.minimized) return;

  zTop += 1;
  w.el.style.zIndex = String(zTop);
  $$(".win").forEach(x => x.classList.remove("active"));
  w.el.classList.add("active");
  setActiveTask(id);
}

function openWin(id) {
  const w = wins.get(id);
  if (!w) return;

  if (!w.taskBtn) createTaskBtn(id);

  w.open = true;
  w.minimized = false;
  w.el.classList.add("open");
  w.el.classList.remove("minimized");
  w.el.style.display = "block";

  focusWin(id);
}

function closeWin(id) {
  const w = wins.get(id);
  if (!w) return;

  w.open = false;
  w.minimized = false;
  w.el.classList.remove("open", "minimized", "active");
  w.el.style.display = "none";

  if (w.taskBtn) {
    w.taskBtn.remove();
    w.taskBtn = null;
  }
}

function minimizeWin(id) {
  const w = wins.get(id);
  if (!w || !w.open) return;
  w.minimized = true;
  w.el.classList.add("minimized");
  w.el.classList.remove("active");
  w.el.style.display = "none";
  if (w.taskBtn) w.taskBtn.classList.remove("active");
}

function restoreWin(id) {
  const w = wins.get(id);
  if (!w || !w.open) return;
  w.minimized = false;
  w.el.classList.remove("minimized");
  w.el.style.display = "block";
  focusWin(id);
}

/* Start menu */
function initStartMenu() {
  const btn = $("#startBtn");
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleStartMenu();
  });

  window.addEventListener("mousedown", (e) => {
    if (e.target.closest("#startMenu") || e.target.closest("#startBtn")) return;
    hideStartMenu();
  });
}

function toggleStartMenu() {
  const menu = $("#startMenu");
  menu.hidden = !menu.hidden;
}
function hideStartMenu() {
  const menu = $("#startMenu");
  if (!menu.hidden) menu.hidden = true;
}

/* Clock */
function initClock() {
  const clock = $("#clock");
  const tick = () => {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2,"0");
    const mm = String(d.getMinutes()).padStart(2,"0");
    clock.textContent = `${hh}:${mm}`;
  };
  tick();
  setInterval(tick, 10000);
}

/* Clipboard helpers */
function initClipboard() {
  $("#copy-resume-link")?.addEventListener("click", async () => {
    try {
      const url = new URL("resume.pdf", location.href).href;
      await navigator.clipboard.writeText(url);
      alert("Resume link copied!");
    } catch {
      alert("Clipboard blocked by browser.");
    }
  });

  $("#copy-email")?.addEventListener("click", async () => {
    const email = $('a[href^="mailto:"]')?.textContent?.trim() || "";
    try { await navigator.clipboard.writeText(email); alert("Email copied!"); }
    catch { alert("Could not copy email."); }
  });

  $("#copy-github")?.addEventListener("click", async () => {
    const gh = "https://github.com/Akuma277353";
    try { await navigator.clipboard.writeText(gh); alert("GitHub copied!"); }
    catch { alert("Could not copy GitHub."); }
  });
}

init();
