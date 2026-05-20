import { CONFIG, COLORS } from "./config.js";
import { clamp } from "./utils.js";
import { createGameContext } from "./state.js";
import { createGameplaySystems } from "./gameplay.js";
import { createRenderer } from "./render.js";
import { bindInput } from "./input.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });
ctx.imageSmoothingEnabled = false;

const modePill = document.getElementById("modePill");

const game = createGameContext({
  canvas,
  modePill,
  CONFIG,
  COLORS
});

const gameplay = createGameplaySystems(game);
const renderer = createRenderer(game, ctx);

function animationFrame(timestamp) {
  if (!game.state.lastTimestamp) {
    game.state.lastTimestamp = timestamp;
  }

  const dt = clamp(timestamp - game.state.lastTimestamp, 0, 34);
  game.state.lastTimestamp = timestamp;

  gameplay.updateWorld(dt, timestamp);
  renderer.render(timestamp);

  requestAnimationFrame(animationFrame);
}

function boot() {
  game.createBackground();
  game.resetRun();
  game.updateModeIndicator();

  bindInput(game);

  requestAnimationFrame(animationFrame);
}

boot();
