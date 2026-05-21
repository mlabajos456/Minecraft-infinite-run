import { clamp } from "./utils.js";

const POWER_TYPES = {
  GOLDEN_APPLE: "MANZANA_DORADA",
  JUMP_POTION: "POCION_SALTO",
  HEROBRINE: "MODO_HEROBRINE"
};

export function createRenderer(game, ctx) {
  const { CONFIG, COLORS, state, getSkyColors } = game;

  function drawPixelCloud(x, y, w, h) {
    ctx.fillStyle = COLORS.cloud;
    ctx.fillRect(x, y, w, h);
    ctx.fillRect(x - 6, y + 4, 12, h - 2);
    ctx.fillRect(x + w - 6, y + 3, 10, h - 3);
    ctx.fillRect(x + 6, y - 3, w - 12, 4);
  }

  function drawSky() {
    const { top, bottom, tod } = getSkyColors();
    const grad = ctx.createLinearGradient(0, 0, 0, CONFIG.groundTop);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CONFIG.width, CONFIG.groundTop);

    if (tod.phase === "night" || tod.phase === "dawn") {
      const alpha = tod.phase === "night" ? 0.95 : 1 - tod.t;
      ctx.fillStyle = `rgba(245, 245, 210, ${0.55 * alpha})`;
      for (const star of state.stars) {
        const twinkle = (Math.sin(star.twinkle + state.score * 0.04) + 1) * 0.5;
        if (twinkle > 0.32) {
          ctx.fillRect(Math.round(star.x), Math.round(star.y), 2, 2);
        }
      }
    }
  }

  function drawParallax() {
    state.mountains.forEach((mountain, idx) => {
      ctx.fillStyle = idx % 2 ? COLORS.mountainA : COLORS.mountainB;
      const baseY = CONFIG.groundTop - 15;
      ctx.fillRect(mountain.x, baseY - mountain.h, mountain.w, mountain.h);
      ctx.fillRect(mountain.x + 8, baseY - mountain.h - 8, mountain.w - 16, 8);
    });

    state.clouds.forEach((cloud) => {
      drawPixelCloud(
        Math.round(cloud.x),
        Math.round(cloud.y),
        Math.round(cloud.w),
        Math.round(cloud.h)
      );
    });
  }

  function drawGround() {
    const stripY = CONFIG.groundTop;
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(0, stripY, CONFIG.width, 10);

    for (let x = -((state.score * 1.5) % 16); x < CONFIG.width + 16; x += 16) {
      ctx.fillStyle = COLORS.grassDark;
      ctx.fillRect(x + 10, stripY + 2, 4, 3);
      ctx.fillStyle = COLORS.grass;
      ctx.fillRect(x + 4, stripY + 1, 3, 2);
    }

    ctx.fillStyle = COLORS.dirt;
    ctx.fillRect(0, stripY + 10, CONFIG.width, CONFIG.height - stripY - 10);

    for (let x = 0; x < CONFIG.width; x += 14) {
      ctx.fillStyle = x % 28 ? "#7c5b3f" : "#714f35";
      ctx.fillRect(x, stripY + 14, 10, 8);
      ctx.fillStyle = "#8f6d4d";
      ctx.fillRect(x + 2, stripY + 22, 8, 7);
    }
  }

  function drawTree(obstacle) {
    const trunkX = obstacle.x + Math.floor(obstacle.width / 2) - 4;
    ctx.fillStyle = "#654328";
    ctx.fillRect(trunkX, obstacle.y + obstacle.height * 0.45, 8, obstacle.height * 0.55);
    ctx.fillStyle = "#3e7c2e";
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height * 0.55);
    ctx.fillStyle = "#5baa3e";
    ctx.fillRect(obstacle.x + 4, obstacle.y + 4, obstacle.width - 8, obstacle.height * 0.2);
  }

  function drawCactus(obstacle) {
    ctx.fillStyle = "#4baa2f";
    ctx.fillRect(obstacle.x + 6, obstacle.y, obstacle.width - 12, obstacle.height);
    ctx.fillRect(obstacle.x, obstacle.y + obstacle.height * 0.35, 8, 12);
    ctx.fillRect(obstacle.x + obstacle.width - 8, obstacle.y + obstacle.height * 0.48, 8, 12);
    ctx.fillStyle = "#78db54";
    ctx.fillRect(obstacle.x + 8, obstacle.y + 3, 2, obstacle.height - 8);
  }

  function drawPhantom(obstacle) {
    const flap = Math.sin((state.score + obstacle.x) * 0.06) > 0 ? 2 : -1;
    ctx.fillStyle = "#4f607d";
    ctx.fillRect(obstacle.x + 8, obstacle.y + 6, obstacle.width - 16, obstacle.height - 6);
    ctx.fillRect(obstacle.x + 2, obstacle.y + 8 + flap, 10, 4);
    ctx.fillRect(obstacle.x + obstacle.width - 12, obstacle.y + 8 - flap, 10, 4);
    ctx.fillStyle = "#8cb2ff";
    ctx.fillRect(obstacle.x + 14, obstacle.y + 4, obstacle.width - 28, 3);
    ctx.fillStyle = "#d7ebff";
    ctx.fillRect(obstacle.x + obstacle.width - 10, obstacle.y + 8, 2, 2);
  }

  function drawCreeper(obstacle) {
    ctx.fillStyle = obstacle.blinkMs > 0 && ((performance.now() / 90) | 0) % 2 === 0 ? "#f9f7a8" : "#58b15f";
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    ctx.fillStyle = "#1d381f";
    ctx.fillRect(obstacle.x + 5, obstacle.y + 10, 4, 4);
    ctx.fillRect(obstacle.x + obstacle.width - 9, obstacle.y + 10, 4, 4);
    ctx.fillRect(obstacle.x + obstacle.width * 0.42, obstacle.y + 18, 6, 10);
  }

  function drawObstacle(obstacle) {
    if (obstacle.type === "tree") return drawTree(obstacle);
    if (obstacle.type === "cactus") return drawCactus(obstacle);
    if (obstacle.type === "phantom") return drawPhantom(obstacle);
    drawCreeper(obstacle);
  }

  function drawPowerItem() {
    if (!state.itemPoder) return;

    const item = state.itemPoder;
    const bobY = Math.sin(item.bob) * 2.4;
    const y = item.y + bobY;

    if (item.tipo === POWER_TYPES.GOLDEN_APPLE) {
      ctx.fillStyle = "#f4d65c";
      ctx.fillRect(item.x, y, item.width, item.height);
      ctx.fillStyle = "#ffe98a";
      ctx.fillRect(item.x + 2, y + 2, item.width - 4, 4);
      return;
    }

    ctx.fillStyle = "#f05eff";
    ctx.fillRect(item.x, y, item.width, item.height);
    ctx.fillStyle = "#ff9ef2";
    ctx.fillRect(item.x + 2, y + 2, item.width - 4, 4);
  }

  function drawSteve(steve) {
    if (!steve || !steve.vivo) return;

    const x = Math.round(steve.x);
    const y = Math.round(steve.y);

    if (state.poderActivo.tipo) {
      const auraColor = state.poderActivo.tipo === POWER_TYPES.GOLDEN_APPLE
        ? "rgba(244, 214, 88, 0.24)"
        : "rgba(240, 94, 255, 0.24)";
      ctx.fillStyle = auraColor;
      ctx.fillRect(x - 8, y - 8, steve.width + 16, steve.height + 16);
    }

    ctx.fillStyle = "#e7b088";
    ctx.fillRect(x + 5, y, 14, 12);
    ctx.fillStyle = "#5f3f24";
    ctx.fillRect(x + 5, y, 14, 4);

    ctx.fillStyle = "#4aa9c7";
    ctx.fillRect(x + 2, y + 12, 20, 16);

    ctx.fillStyle = "#3a53b5";
    const legTop = y + 28;
    ctx.fillRect(x + 4, legTop, 7, steve.height - 28);
    ctx.fillRect(x + 13, legTop, 7, steve.height - 28);
  }

  function drawSteves() {
    if (state.aiTraining) {
      for (const steve of state.steves) {
        drawSteve(steve);
      }
      return;
    }
    drawSteve(state.manualSteve);
  }

  function drawParticles() {
    for (const particle of state.particles) {
      const alpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawUI() {
    const panelWidth = Math.min(360, CONFIG.width - 20);

    ctx.fillStyle = "rgba(12, 18, 16, 0.58)";
    ctx.fillRect(10, 10, panelWidth, 88);
    ctx.strokeStyle = "rgba(155, 190, 175, 0.65)";
    ctx.strokeRect(10, 10, panelWidth, 88);

    ctx.fillStyle = "#effff6";
    ctx.font = "bold 14px monospace";
    ctx.fillText(`SCORE: ${Math.floor(state.score)}`, 20, 31);
    ctx.fillText(`BEST: ${Math.max(state.highScore, Math.floor(state.score))}`, 20, 51);

    if (state.aiTraining) {
      ctx.fillStyle = "#97f08a";
      ctx.fillText(`GEN: ${state.generation} | VIVOS: ${state.aliveCount}/${CONFIG.population}`, 20, 71);
    } else {
      ctx.fillStyle = "#ffb2b2";
      ctx.fillText("MODO MANUAL", 20, 71);
    }

    const powerText = state.poderActivo.tipo
      ? `PODER: ${state.poderActivo.tipo}`
      : "PODER: NINGUNO";
    ctx.fillStyle = "#d8e4db";
    ctx.font = "bold 12px monospace";
    ctx.fillText(powerText, 20, 89);
  }

  function drawGameOver() {
    if (state.running || state.aiTraining) return;

    ctx.fillStyle = `rgba(0, 0, 0, ${Math.max(0.45, state.gameOverAlpha)})`;
    ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);

    ctx.textAlign = "center";
    ctx.fillStyle = "#ff7b7b";
    ctx.font = "bold 32px monospace";
    ctx.fillText("GAME OVER", CONFIG.width / 2, CONFIG.height * 0.44);

    ctx.fillStyle = "#f5f5f5";
    ctx.font = "bold 15px monospace";
    ctx.fillText("ESPACIO PARA REINICIAR", CONFIG.width / 2, CONFIG.height * 0.56);
    ctx.textAlign = "start";
  }

  function drawStreamAlert() {
    if (state.streamFx.timerFrames <= 0 || !state.streamFx.text) return;

    ctx.textAlign = "center";
    ctx.font = "bold 15px monospace";
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#3a004f";
    ctx.lineWidth = 3;
    ctx.strokeText(state.streamFx.text, CONFIG.width / 2, 126);
    ctx.fillText(state.streamFx.text, CONFIG.width / 2, 126);
    ctx.textAlign = "start";
  }

  function drawSpeedToast() {
    const toast = state.streamSpeed;
    if (!toast || toast.toastMs <= 0 || !toast.toastText) return;

    const progress = 1 - toast.toastMs / toast.toastDurationMs;
    const alpha = clamp(1 - progress * 1.25, 0, 1);
    const zoom = progress < 0.34
      ? 0.7 + (progress / 0.34) * 0.58
      : 1.28 - ((progress - 0.34) / 0.66) * 0.25;

    ctx.save();
    ctx.translate(CONFIG.width * 0.5, CONFIG.height * 0.44);
    ctx.scale(zoom, zoom);
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 54px monospace";
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillText(toast.toastText, 3, 3);
    ctx.fillStyle = toast.toastColor;
    ctx.fillText(toast.toastText, 0, 0);
    ctx.restore();

    ctx.globalAlpha = 1;
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }

  function render() {
    drawSky();
    drawParallax();
    drawGround();

    state.obstacles.forEach(drawObstacle);
    drawPowerItem();
    drawSteves();
    drawParticles();
    drawUI();
    drawStreamAlert();
    drawSpeedToast();
    drawGameOver();
  }

  return {
    render
  };
}
