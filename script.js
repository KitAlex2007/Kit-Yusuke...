const canvas = document.querySelector("#canvas");
const ctx = canvas.getContext("2d");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let cols = 64, rows = 36, spread = 42, camHeight = 3.2, speed = 2.4, isPlaying = true;
let width, height, horizon, fovX, fovY, offset = 0, lastTime = 0, starsArr = [];

const colorThemes = [
  { name: "Neon Cyan", baseHue: 190, range: 120 },
  { name: "Sunset Gold", baseHue: 10, range: 60 },
  { name: "Deep Purple", baseHue: 270, range: 80 }
];
let currentThemeIdx = 0;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  horizon = height * 0.42;
  fovX = (width * 0.43 * rows) / spread;
  fovY = height * 0.95;
  createStars();
  if (reduceMotion.matches || !isPlaying) draw(0);
}

function createStars() {
  starsArr = [];
  const count = Math.round((width * horizon) / 2500);
  for (let i = 0; i < count; i++) {
    starsArr.push({
      x: Math.random() * width,
      y: Math.random() * horizon * 0.95,
      size: Math.random() * 1.2 + 0.3,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 1.5 + 0.5
    });
  }
}

function terrain(x, z) {
  let edge = Math.min(1, Math.max(0, (Math.abs(x) - 5) / 20));
  edge = edge * edge * (3 - 2 * edge);
  const n =
    Math.sin(x * 0.31 + z * 0.17) * 0.9 +
    Math.sin(x * 0.13 - z * 0.29 + 1.7) * 1.1 +
    Math.sin((x + z) * 0.071 + 4.2) * 1.3 +
    Math.sin(x * 0.83 + z * 0.61) * 0.25;
  const peaks = (n + 3.55) / 7.1;
  const ripple = Math.sin(x * 0.45 + z * 0.35) * 0.12;
  return peaks * peaks * 8 * edge + ripple * (1 - edge);
}

function project(x, y, z) {
  return [
    width / 2 + (x / z) * fovX,
    horizon + ((camHeight - y) / z) * fovY
  ];
}

function drawSky(time) {
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, "#05030a");
  sky.addColorStop(0.6, "#12061f");
  sky.addColorStop(1, "#2a0b3d");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, horizon + 1);
  ctx.fillStyle = "#07040d";
  ctx.fillRect(0, horizon, width, height - horizon);

  starsArr.forEach((star) => {
    const blink = 0.55 + 0.45 * Math.sin(time * star.speed + star.phase);
    ctx.fillStyle = `rgba(255, 220, 255, ${blink * 0.7})`;
    ctx.fillRect(star.x, star.y, star.size, star.size);
  });

  ctx.save();
  ctx.translate(width / 2, horizon);
  ctx.scale(1, 0.16);
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, width * 0.55);
  glow.addColorStop(0, "rgba(255, 60, 200, 0.45)");
  glow.addColorStop(0.5, "rgba(140, 40, 255, 0.15)");
  glow.addColorStop(1, "rgba(140, 40, 255, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, width * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function strokeLines(far, near, hue, alpha, lineW) {
  ctx.beginPath();
  far.points.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  if (near) {
    for (let k = 0; k < far.points.length; k++) {
      ctx.moveTo(far.points[k][0], far.points[k][1]);
      ctx.lineTo(near.points[k][0], near.points[k][1]);
    }
  }
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = `hsla(${hue}, 100%, 60%, ${alpha * 0.18})`;
  ctx.lineWidth = lineW * 4;
  ctx.stroke();
  ctx.strokeStyle = `hsla(${hue}, 100%, 70%, ${alpha})`;
  ctx.lineWidth = lineW;
  ctx.stroke();
  ctx.globalCompositeOperation = "source-over";
}

function draw(time) {
  drawSky(time);
  const first = Math.floor(offset) + 1;
  const linesArr = [];

  for (let i = rows; i >= 0; i--) {
    const zWorld = first + i;
    const z = zWorld - offset;
    if (z < 0.3) continue;
    const points = [];
    for (let c = 0; c <= cols; c++) {
      const x = -spread + (c * 2 * spread) / cols;
      points.push(project(x, terrain(x, zWorld), z));
    }
    linesArr.push({ z, points });
  }

  const activeTheme = colorThemes[currentThemeIdx];
  for (let i = 0; i < linesArr.length; i++) {
    const far = linesArr[i];
    const near = linesArr[i + 1];
    const t = Math.min(1, far.z / (rows + 1));
    const alpha = Math.pow(1 - t, 1.3);
    const hue = activeTheme.baseHue + t * activeTheme.range;

    if (near) {
      const r = Math.round(7 + 35 * t);
      const g = Math.round(4 + 7 * t);
      const b = Math.round(13 + 48 * t);
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.beginPath();
      far.points.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      for (let k = near.points.length - 1; k >= 0; k--) ctx.lineTo(near.points[k][0], near.points[k][1]);
      ctx.closePath();
      ctx.fill();
    }
    strokeLines(far, near, hue, alpha, 0.6 + (1 - t) * 1.4);
  }
}

function loop(now) {
  if (!isPlaying) return;
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  offset += speed * dt;
  draw(now / 1000);
  requestAnimationFrame(loop);
}

resize();
window.addEventListener("resize", resize);

if (!reduceMotion.matches) {
  requestAnimationFrame((now) => {
    lastTime = now;
    loop(now);
  });
}

document.getElementById("playPauseBtn").addEventListener("click", () => {
  isPlaying = !isPlaying;
  document.getElementById("playIcon").className = isPlaying ? "fa-solid fa-pause" : "fa-solid fa-play";
  document.getElementById("playText").textContent = isPlaying ? "Pause" : "Play";
  if (isPlaying) {
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }
});

const speeds = [
  { l: "Slow", v: 1.0 },
  { l: "Fast", v: 2.4 },
  { l: "Hyper", v: 4.8 }
];
let speedIdx = 1;

document.getElementById("speedBtn").addEventListener("click", () => {
  speedIdx = (speedIdx + 1) % speeds.length;
  speed = speeds[speedIdx].v;
  document.getElementById("speedVal").textContent = speeds[speedIdx].l;
});

document.getElementById("themeBtn").addEventListener("click", () => {
  currentThemeIdx = (currentThemeIdx + 1) % colorThemes.length;
  document.getElementById("themeName").textContent = colorThemes[currentThemeIdx].name;
  if (!isPlaying) draw(lastTime / 1000);
});

const loveMessages = ["I love u", "I love u babe", "Kit & Yusuke"];
let loveMsgIdx = 0;
const lovePhrase = document.getElementById("lovePhrase");
const loveArea = document.getElementById("loveArea");

document.getElementById("expressLoveBtn").addEventListener("click", (event) => {
  loveMsgIdx = (loveMsgIdx + 1) % loveMessages.length;
  lovePhrase.style.opacity = "0";
  lovePhrase.style.transform = "scale(0.8)";

  setTimeout(() => {
    lovePhrase.textContent = `${loveMessages[loveMsgIdx]} ❤️`;
    lovePhrase.style.opacity = "1";
    lovePhrase.style.transform = "scale(1)";
  }, 150);

  const heart = document.createElement("i");
  heart.className = "fa-solid fa-heart floating-heart";
  const rect = loveArea.getBoundingClientRect();
  heart.style.left = `${event.clientX - rect.left - 12}px`;
  heart.style.top = `${event.clientY - rect.top - 12}px`;
  loveArea.appendChild(heart);
  setTimeout(() => heart.remove(), 1200);
});

const modal = document.getElementById("msgModal");
const modalContent = document.getElementById("modalContent");
const openMsgBtn = document.getElementById("openMsgBtn");
const closeMsgBtn = document.getElementById("closeMsgBtn");
const backBtn = document.getElementById("backBtn");
const stayBtn = document.getElementById("stayBtn");

function openModal() {
  modal.classList.remove("pointer-events-none", "opacity-0");
  modal.classList.add("opacity-100");
  modalContent.classList.remove("scale-95");
  modalContent.classList.add("scale-100");
}

function closeModal() {
  modal.classList.add("opacity-0", "pointer-events-none");
  modal.classList.remove("opacity-100");
  modalContent.classList.add("scale-95");
  modalContent.classList.remove("scale-100");
}

openMsgBtn.addEventListener("click", openModal);
closeMsgBtn.addEventListener("click", closeModal);
backBtn.addEventListener("click", closeModal);

stayBtn.addEventListener("click", () => {
  alert("Forever & Always Together! ❤️");
  closeModal();
});

modal.addEventListener("click", (event) => {
  if (event.target === modal) closeModal();
});
