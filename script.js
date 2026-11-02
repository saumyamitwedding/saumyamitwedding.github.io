"use strict";

const invitation = document.getElementById("invitation");
const scenes = [...invitation.querySelectorAll(".scene")];
const opening = document.getElementById("opening");
const nextButton = document.getElementById("next-chapter");
const saveButton = document.getElementById("save-dates");
const replayButton = document.getElementById("reopen-invitation");
const themeButton = document.getElementById("theme-toggle");
const music = document.getElementById("background-music");
const musicButton = document.getElementById("music-toggle");
const musicLabel = document.getElementById("music-label");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const announcer = document.getElementById("announcer");

let currentChapter = 0;
let displayedChapter = -1;
let openingTimer;
let scrollFrame = 0;
let layoutDirty = true;
let scenePositions = [];
let viewportHeight = 0;
let musicPreference = null;
music.volume = 0.22;

function updateMusicControl() {
  const playing = !music.paused && !music.error;
  musicButton.setAttribute("aria-pressed", String(playing));
  if (!musicButton.hasAttribute("data-error")) {
    musicLabel.textContent = playing ? "Music on" : "Music off";
    musicButton.setAttribute("aria-label", playing ? "Turn background music off" : "Turn background music on");
    musicButton.title = playing ? "Pause the background piano" : "Play the background piano";
  }
}

function reportMusicError(message, error) {
  musicButton.dataset.error = message;
  musicLabel.textContent = "Retry music";
  musicButton.setAttribute("aria-label", `${message} Tap to try again.`);
  musicButton.setAttribute("aria-pressed", "false");
  musicButton.title = message;
  announcer.textContent = message;
  console.error(message, error);
}

async function startMusic() {
  if (!music.paused) return;
  musicButton.removeAttribute("data-error");
  if (music.error) music.load();
  try {
    await music.play();
  } catch (error) {
    // Pausing while the MP3 is buffering intentionally cancels play().
    if (error.name === "AbortError" && music.paused) return;
    if (error.name === "NotAllowedError") {
      updateMusicControl();
      announcer.textContent = "Tap the Music control to allow background piano playback.";
      return;
    }
    reportMusicError("The background piano could not be played. Check the MP3 in the assets folder.", error);
  }
}

music.addEventListener("play", updateMusicControl);
music.addEventListener("pause", updateMusicControl);
music.addEventListener("error", () => {
  reportMusicError("The background piano could not be loaded. Check the MP3 in the assets folder.", music.error);
});
musicButton.addEventListener("click", () => {
  if (music.paused) {
    musicPreference = true;
    startMusic();
  } else {
    musicPreference = false;
    music.pause();
  }
});

function closeOpening(animate) {
  if (!opening.open || opening.classList.contains("is-opening")) return;
  if (musicPreference !== false) startMusic();
  const finish = () => opening.close();
  if (animate && !reducedMotion.matches) {
    opening.classList.add("is-opening");
    openingTimer = window.setTimeout(finish, 760);
  } else {
    finish();
  }
}

opening.addEventListener("close", () => {
  window.clearTimeout(openingTimer);
  opening.classList.remove("is-opening");
  document.getElementById("couple-names").focus({ preventScroll: true });
});

document.getElementById("open-invitation").addEventListener("click", () => closeOpening(true));
document.getElementById("skip-opening").addEventListener("click", () => closeOpening(false));
replayButton.addEventListener("click", () => {
  invitation.scrollTo({ top: 0, behavior: "instant" });
  opening.showModal();
});

function renderInvitation() {
  scrollFrame = 0;
  if (layoutDirty) {
    scenePositions = scenes.map((scene) => scene.offsetTop);
    viewportHeight = invitation.clientHeight;
    layoutDirty = false;
  }
  const top = invitation.scrollTop;
  const readingLine = top + viewportHeight * 0.42;
  currentChapter = scenePositions.reduce((current, position, index) =>
    position <= readingLine ? index : current, 0);
  if (displayedChapter !== currentChapter) {
    displayedChapter = currentChapter;
    document.getElementById("chapter-count").replaceChildren(
      document.createTextNode(String(currentChapter + 1).padStart(2, "0")),
      Object.assign(document.createElement("span"), { textContent: `/ ${String(scenes.length).padStart(2, "0")}` })
    );
    document.getElementById("reading-progress").value = currentChapter + 1;
    document.querySelectorAll("[data-chapter]").forEach((link) => {
      if (link.dataset.chapter === scenes[currentChapter].dataset.group) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    });
    const isLast = currentChapter === scenes.length - 1;
    nextButton.classList.toggle("is-last", isLast);
    nextButton.setAttribute("aria-label", isLast ? "Back to the beginning" : "Next chapter");
  }
}

function requestRender() {
  if (!scrollFrame) scrollFrame = window.requestAnimationFrame(renderInvitation);
}

function refreshLayout() {
  layoutDirty = true;
  requestRender();
}

invitation.addEventListener("scroll", requestRender, { passive: true });
const resizeObserver = new ResizeObserver(refreshLayout);
resizeObserver.observe(invitation);
scenes.forEach((scene) => resizeObserver.observe(scene));

function navigateTo(id, { instant = false, focus = true, updateHash = false } = {}) {
  const target = document.getElementById(id);
  const scene = target?.closest(".scene");
  if (!scene) return false;
  if (updateHash && window.location.hash !== `#${id}`) {
    window.history.pushState(null, "", `#${id}`);
  }
  invitation.scrollTo({
    top: scene.offsetTop,
    behavior: instant || reducedMotion.matches ? "instant" : "smooth"
  });
  if (focus) scene.querySelector("h1, h2").focus({ preventScroll: true });
  requestRender();
  return true;
}

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    const id = link.getAttribute("href").slice(1);
    if (document.getElementById(id)?.closest(".scene")) {
      event.preventDefault();
      navigateTo(id, { updateHash: true });
    }
  });
});
window.addEventListener("hashchange", () => navigateTo(window.location.hash.slice(1)));

nextButton.addEventListener("click", () => {
  navigateTo(scenes[(currentChapter + 1) % scenes.length].id, { updateHash: true });
});

for (const image of invitation.querySelectorAll("img")) {
  image.addEventListener("error", () => {
    console.error("Could not load invitation artwork:", image.getAttribute("src"));
    announcer.textContent = "Some artwork could not be loaded. Keep the assets folder alongside index.html.";
  });
}

function updateThemeControl() {
  const dark = document.documentElement.dataset.theme === "dark";
  themeButton.setAttribute("aria-pressed", String(dark));
  themeButton.setAttribute("aria-label", dark ? "Switch to light appearance" : "Switch to dark appearance");
}

themeButton.addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme === "dark";
  document.documentElement.dataset.theme = dark ? "light" : "dark";
  updateThemeControl();
});

const countdownTarget = new Date(document.querySelector("#wedding time").dateTime).getTime();
const countdown = document.getElementById("countdown");

function updateCountdown() {
  const remaining = Math.max(0, Math.floor((countdownTarget - Date.now()) / 1000));
  const values = {
    days: Math.floor(remaining / 86400),
    hours: Math.floor(remaining / 3600) % 24,
    minutes: Math.floor(remaining / 60) % 60,
    seconds: remaining % 60
  };
  for (const [unit, value] of Object.entries(values)) {
    countdown.querySelector(`[data-unit="${unit}"]`).textContent = String(value).padStart(2, "0");
  }
  if (remaining === 0) {
    document.getElementById("countdown-title").textContent = "Celebrating 2 December 2026";
  }
}

function calendarTimestamp(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeCalendarText(value) {
  return value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/[,;]/g, "\\$&");
}

function foldCalendarLine(line) {
  // RFC 5545 folds at 75 UTF-8 octets, including the continuation's leading space.
  const encoder = new TextEncoder();
  const parts = [];
  let part = "";
  let size = 0;
  for (const character of line) {
    const bytes = encoder.encode(character).length;
    if (size + bytes > 75) {
      parts.push(part);
      part = " ";
      size = 1;
    }
    part += character;
    size += bytes;
  }
  parts.push(part);
  return parts.join("\r\n");
}

saveButton.addEventListener("click", () => {
  const stamp = calendarTimestamp(new Date());
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Saumya and Amit//Wedding Invitation//EN", "CALSCALE:GREGORIAN"];
  for (const scene of scenes.filter((section) => section.hasAttribute("data-calendar-title"))) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:saumya-amit-2026-${scene.id}@wedding.invalid`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${calendarTimestamp(new Date(scene.querySelector("time").dateTime))}`,
      `SUMMARY:${escapeCalendarText(scene.dataset.calendarTitle)}`,
      `LOCATION:${escapeCalendarText(scene.dataset.calendarLocation)}`,
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  const file = new Blob([lines.map(foldCalendarLine).join("\r\n") + "\r\n"], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = "Saumya-and-Amit-Wedding.ics";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  announcer.textContent = "Calendar file prepared. Open the downloaded file to add all five celebrations.";
});

for (const button of [nextButton, saveButton, replayButton, themeButton, musicButton]) button.hidden = false;
countdown.hidden = false;
document.getElementById("reading-progress").max = scenes.length;
updateThemeControl();
updateMusicControl();
renderInvitation();
updateCountdown();
window.setInterval(updateCountdown, 1000);

if (!navigateTo(window.location.hash.slice(1), { instant: true, focus: false })) opening.showModal();
document.fonts.ready.then(refreshLayout);
