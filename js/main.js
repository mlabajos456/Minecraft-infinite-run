import { CONFIG, COLORS } from "./config.js";
import { clamp } from "./utils.js";
import { createGameContext } from "./state.js";
import { createGameplaySystems, POWER_TYPES } from "./gameplay.js";
import { createRenderer } from "./render.js";
import { bindInput } from "./input.js";
import { setupStreamBridge } from "./streamBridge.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });
ctx.imageSmoothingEnabled = false;

CONFIG.width = canvas.width;
CONFIG.height = canvas.height;
if (CONFIG.groundTop >= CONFIG.height - 20) {
  CONFIG.groundTop = Math.floor(CONFIG.height * 0.79);
}

const modePill = document.getElementById("modePill");
const speedPill = document.getElementById("speedPill");
const herobrineBtn = document.getElementById("herobrineBtn");

const game = createGameContext({
  canvas,
  modePill,
  speedPill,
  CONFIG,
  COLORS
});

const gameplay = createGameplaySystems(game);
const renderer = createRenderer(game, ctx);
let teardownStreamBridge = null;

function updateHerobrineButton() {
  const { poderActivo, herobrineControl } = game.state;
  herobrineBtn.classList.remove("ready", "active", "cooldown");

  if (poderActivo.tipo === POWER_TYPES.HEROBRINE) {
    const secs = Math.ceil(poderActivo.tiempoRestante / 60);
    herobrineBtn.textContent = `HEROBRINE ACTIVO (${secs}s)`;
    herobrineBtn.classList.add("active");
    herobrineBtn.disabled = true;
    return;
  }

  if (herobrineControl.cooldownFrames > 0) {
    const secs = Math.ceil(herobrineControl.cooldownFrames / 60);
    herobrineBtn.textContent = `HEROBRINE CD (${secs}s)`;
    herobrineBtn.classList.add("cooldown");
    herobrineBtn.disabled = true;
    return;
  }

  if (herobrineControl.ready) {
    herobrineBtn.textContent = "ACTIVAR HEROBRINE (H)";
    herobrineBtn.classList.add("ready");
    herobrineBtn.disabled = false;
    return;
  }

  herobrineBtn.textContent = "HEROBRINE: BLOQUEADO";
  herobrineBtn.classList.add("cooldown");
  herobrineBtn.disabled = true;
}

function animationFrame(timestamp) {
  if (!game.state.lastTimestamp) {
    game.state.lastTimestamp = timestamp;
  }

  const dt = clamp(timestamp - game.state.lastTimestamp, 0, 34);
  game.state.lastTimestamp = timestamp;

  gameplay.updateStreamSpeedDecay(dt);

  const updates = game.state.aiTraining ? gameplay.getSimulationMultiplier() : 1;
  for (let i = 0; i < updates; i++) {
    gameplay.updateWorld(dt, timestamp);
  }

  updateHerobrineButton();
  game.updateSpeedIndicator();
  renderer.render(timestamp);

  requestAnimationFrame(animationFrame);
}

function procesarComandoStream(comando) {
  const normalized = String(comando ?? "").trim();
  const cleaned = normalized.replace(/^!+/, "").toUpperCase();
  const token = cleaned.split(/\s+/)[0];

  if (token === "SPEED") {
    const changed = gameplay.boostSimulationSpeedFromStream();
    if (changed) {
      game.state.streamFx.text = "CHAT ACELERO LA SIMULACION";
      game.state.streamFx.timerFrames = CONFIG.streamAlertFrames;
    }
    return changed;
  }

  if (token === "SLOW") {
    const changed = gameplay.reduceSimulationSpeedFromStream();
    if (changed) {
      game.state.streamFx.text = "CHAT FRENO LA SIMULACION";
      game.state.streamFx.timerFrames = CONFIG.streamAlertFrames;
    }
    return changed;
  }

  if (token !== "HEROBRINE") return false;

  const activated = gameplay.activateHerobrineFromStream();
  if (!activated) return false;

  game.state.streamFx.text = "CHAT ACTIVO MODO HEROBRINE";
  game.state.streamFx.timerFrames = CONFIG.streamAlertFrames;
  updateHerobrineButton();
  return true;
}

function boot() {
  game.createBackground();
  gameplay.initializeTraining();
  updateHerobrineButton();
  game.updateSpeedIndicator();

  bindInput(game, {
    switchToManual: gameplay.switchToManual,
    resetManualRun: gameplay.resetManualRun,
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
