import { CONFIG, COLORS } from "./config.js";
import { clamp } from "./utils.js";
import { createGameContext } from "./state.js";
import { createGameplaySystems } from "./gameplay.js";
import { createRenderer } from "./render.js";
import { bindInput } from "./input.js";
import { setupStreamBridge } from "./streamBridge.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });
ctx.imageSmoothingEnabled = false;

const modePill = document.getElementById("modePill");
const herobrineBtn = document.getElementById("herobrineBtn");

const game = createGameContext({
  canvas,
  modePill,
  CONFIG,
  COLORS
});

const gameplay = createGameplaySystems(game);
const renderer = createRenderer(game, ctx);
let teardownStreamBridge = null;

function updateHerobrineButton() {
  const { poderActivo, herobrineControl } = game.state;
  herobrineBtn.classList.remove("ready", "active", "cooldown");

  if (poderActivo.tipo === gameplay.POWER_TYPES.HEROBRINE) {
    const secs = Math.ceil(poderActivo.tiempoRestante / 60);
    herobrineBtn.textContent = `👁 HEROBRINE ACTIVO (${secs}s)`;
    herobrineBtn.classList.add("active");
    herobrineBtn.disabled = true;
    return;
  }

  if (herobrineControl.cooldownFrames > 0) {
    const secs = Math.ceil(herobrineControl.cooldownFrames / 60);
    herobrineBtn.textContent = `👁 HEROBRINE CD (${secs}s)`;
    herobrineBtn.classList.add("cooldown");
    herobrineBtn.disabled = true;
    return;
  }

  if (herobrineControl.ready) {
    herobrineBtn.textContent = "👁 ACTIVAR HEROBRINE (H)";
    herobrineBtn.classList.add("ready");
    herobrineBtn.disabled = false;
    return;
  }

  herobrineBtn.textContent = "👁 HEROBRINE: BLOQUEADO";
  herobrineBtn.classList.add("cooldown");
  herobrineBtn.disabled = true;
}

function animationFrame(timestamp) {
  if (!game.state.lastTimestamp) {
    game.state.lastTimestamp = timestamp;
  }

  const dt = clamp(timestamp - game.state.lastTimestamp, 0, 34);
  game.state.lastTimestamp = timestamp;

  gameplay.updateWorld(dt, timestamp);
  updateHerobrineButton();
  renderer.render(timestamp);

  requestAnimationFrame(animationFrame);
}

function procesarComandoStream(comando) {
  const normalized = String(comando ?? "").trim();
  const cleaned = normalized.replace(/^!+/, "").toUpperCase();
  const token = cleaned.split(/\s+/)[0];
  if (token !== "HEROBRINE") return false;

  const activated = gameplay.activateHerobrineFromStream();
  if (!activated) return false;

  game.state.streamFx.text = "¡CHAT ACTIVÓ MODO HEROBRINE!";
  game.state.streamFx.timerFrames = CONFIG.streamAlertFrames;
  updateHerobrineButton();
  return true;
}

function boot() {
  game.createBackground();
  game.resetRun();
  game.updateModeIndicator();
  updateHerobrineButton();

  bindInput(game, {
    tryActivateHerobrine: gameplay.tryActivateHerobrine
  });

  herobrineBtn.addEventListener("click", () => {
    gameplay.tryActivateHerobrine();
    updateHerobrineButton();
  });

  window.procesarComandoStream = procesarComandoStream;
  teardownStreamBridge = setupStreamBridge({
    onCommand: procesarComandoStream
  });
  window.addEventListener("beforeunload", () => {
    if (teardownStreamBridge) teardownStreamBridge();
  });

  requestAnimationFrame(animationFrame);
}

boot();
