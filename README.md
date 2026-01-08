# Win95/98 Portfolio Website

A personal portfolio website built to behave like a small desktop operating system, inspired by Windows 95/98.  
The goal is to present projects and experience in an interactive, system-like interface while keeping everything readable, predictable, and fast.

This site is built entirely with vanilla HTML, CSS, and JavaScript.

## Live Demo

GitHub Pages (if enabled):  
https://akuma277353.github.io/portfolio/

## Why This Exists

Most portfolio sites look the same and reduce projects to static cards.  
This project explores a different idea: treating the portfolio itself as a system.

Each section (About, Skills, Projects, Experience, Resume, Contact) behaves like a real window:
- It can be opened, closed, minimized, focused, and layered
- It appears in a taskbar when active
- It preserves state while the page is open

The result is something playful, but still practical to navigate and read.

## Features

### Desktop & Window System
- Desktop icons that open windows
- Draggable and resizable windows
- Active window focus with z-index management
- Minimize and close behavior tied to a taskbar
- Non-modal info windows (no background dimming or scroll locking)

### Taskbar & Start Menu
- Taskbar buttons for each open window
- Start menu with external links (GitHub, LinkedIn, Instagram)
- Internal shortcuts (Resume window)

### Content Windows
- Notes: landing hub and navigation
- About Me: personal background and approach to building
- Skills: languages, tools, systems, and AI foundations
- Projects: selected projects with short descriptions and optional GitHub links
- Experience: timeline-style overview of applied work and coursework
- Resume: embedded PDF viewer with download option
- Contact: email and social links

### Responsive Behavior
- On smaller screens, windows switch to full-screen mode
- Desktop layout collapses into a mobile-friendly flow
- No separate mobile site required

## Tech Stack

- HTML5
- CSS3 (custom styling, no frameworks)
- Vanilla JavaScript (no libraries or frameworks)

No build step. No dependencies.

## Project Structure  

|
├─ index.html # Main markup and window layout
├─ styles.css # All styling (Win95/98 look and layout)
├─ script.js # Window manager, interactions, state
├─ assets/
  ├─ Abubakar_Shaikh_Resume.pdf
  ├─ images/ # Wallpaper and profile image
  ├─ icons/ # Desktop, menu, and UI icons
  └─ fonts/ #font


## How It Works (High Level)

- Each window is a `<section>` with metadata (`data-title`, `data-icon`)
- JavaScript tracks open windows, active window, and z-order
- Dragging uses pointer events on the title bar
- Resizing is handled via CSS `resize` with guardrails
- Taskbar buttons are generated dynamically based on open windows
- Info popups are non-modal to avoid breaking scroll or focus

The logic favors explicit state tracking over implicit DOM behavior to keep interactions predictable.

## Running Locally

Clone the repository:

git clone https://github.com/akuma277353/portfolio.git

cd portfolio


Open `index.html` directly in your browser, or use a simple local server:

python -m http.server