import { clamp } from "./utils.js";

const POWER_TYPES = {
  GOLDEN_APPLE: "MANZANA_DORADA",
  JUMP_POTION: "POCION_SALTO",
  HEROBRINE: "MODO_HEROBRINE"
};

export function createRenderer(game, ctx) {
  const { CONFIG, COLORS, state, player, getSkyColors } = game;

  function drawPixelCloud(x, y, w, h) {
    ctx.fillStyle = COLORS.cloud;
    ctx.fillRect(x, y, w, h);
    ctx.fillRect(x - 6, y + 4, 12, h - 2);
    ctx.fillRect(x + w - 6, y + 3, 10, h - 3);
    ctx.fillRect(x + 6, y - 3, w - 12, 4);
  }

  function drawPhantom(obstacle) {
    const flap = Math.sin((state.score + obstacle.x) * 0.06) > 0 ? 2 : -1;
    ctx.fillStyle = obstacle.blinkMs > 0 && Math.floor(obstacle.blinkMs / 35) % 2 ? "#ffffff" : "#4f607d";
    ctx.fillRect(obstacle.x + 8, obstacle.y + 6, obstacle.width - 16, obstacle.height - 6);
    ctx.fillRect(obstacle.x + 2, obstacle.y + 8 + flap, 10, 4);
    ctx.fillRect(obstacle.x + obstacle.width - 12, obstacle.y + 8 - flap, 10, 4);
    ctx.fillStyle = "#8cb2ff";
    ctx.fillRect(obstacle.x + 14, obstacle.y + 4, obstacle.width - 28, 3);
    ctx.fillStyle = "#d7ebff";
    ctx.fillRect(obstacle.x + obstacle.width - 10, obstacle.y + 8, 2, 2);
  }

  function drawTree(obstacle) {
    ctx.fillStyle = obstacle.blinkMs > 0 && Math.floor(obstacle.blinkMs / 35) % 2 ? "#ffffff" : "#654328";
    const trunkX = obstacle.x + Math.floor(obstacle.width / 2) - 4;
    ctx.fillRect(trunkX, obstacle.y + obstacle.height * 0.45, 8, obstacle.height * 0.55);
    ctx.fillStyle = "#3e7c2e";
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height * 0.55);
    ctx.fillStyle = "#5baa3e";
    ctx.fillRect(obstacle.x + 4, obstacle.y + 4, obstacle.width - 8, obstacle.height * 0.2);
  }

  function drawCactus(obstacle) {
    ctx.fillStyle = obstacle.blinkMs > 0 && Math.floor(obstacle.blinkMs / 35) % 2 ? "#ffffff" : "#4baa2f";
    ctx.fillRect(obstacle.x + 6, obstacle.y, obstacle.width - 12, obstacle.height);
    ctx.fillRect(obstacle.x, obstacle.y + obstacle.height * 0.35, 8, 12);
    ctx.fillRect(obstacle.x + obstacle.width - 8, obstacle.y + obstacle.height * 0.48, 8, 12);
    ctx.fillStyle = "#78db54";
    ctx.fillRect(obstacle.x + 8, obstacle.y + 3, 2, obstacle.height - 8);
  }

  function drawCreeper(obstacle) {
    const blink = obstacle.blinkMs > 0 && Math.floor(obstacle.blinkMs / 40) % 2 === 0;
    ctx.fillStyle = blink ? "#ffffff" : "#58b15f";
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    ctx.fillStyle = blink ? "#d9d9d9" : "#75d37a";
    ctx.fillRect(obstacle.x + 2, obstacle.y + 3, obstacle.width - 4, obstacle.height * 0.35);
    ctx.fillStyle = "#1c2c1f";
    ctx.fillRect(obstacle.x + 5, obstacle.y + 12, 4, 4);
    ctx.fillRect(obstacle.x + obstacle.width - 9, obstacle.y + 12, 4, 4);
    ctx.fillRect(obstacle.x + 8, obstacle.y + 18, 6, 8);
    ctx.fillRect(obstacle.x + 6, obstacle.y + obstacle.height - 9, 4, 9);
    ctx.fillRect(obstacle.x + obstacle.width - 10, obstacle.y + obstacle.height - 9, 4, 9);
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
    if (item.tipo === POWER_TYPES.JUMP_POTION) {
      ctx.fillStyle = "#f05eff";
      ctx.fillRect(item.x, y, item.width, item.height);
      ctx.fillStyle = "#ff9ef2";
      ctx.fillRect(item.x + 2, y + 2, item.width - 4, 4);
      return;
    }

    ctx.fillStyle = "#1a0033";
    ctx.fillRect(item.x, y, item.width, item.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(item.x + 4, y + 4, 2, 2);
    ctx.fillRect(item.x + 8, y + 4, 2, 2);
  }

  function drawSteve(now) {
    const blink = player.blinkTimer > 0 && Math.floor(player.blinkTimer / 45) % 2 === 0;
    if (blink) return;

    const x = Math.round(player.x);
    const y = Math.round(player.y);
    const crouch = player.height === player.heightDucked;
    const legShift = !player.onGround || crouch ? 0 : (player.runFrame === 0 ? 1 : -1);

    if (state.poderActivo.tipo) {
      const pulse = (Math.sin(now * 0.03) + 1) * 0.5;
      const auraAlpha = 0.18 + pulse * 0.24;
      const auraColor = state.poderActivo.tipo === POWER_TYPES.GOLDEN_APPLE
        ? `rgba(244, 214, 88, ${auraAlpha})`
        : state.poderActivo.tipo === POWER_TYPES.JUMP_POTION
        ? `rgba(240, 94, 255, ${auraAlpha})`
        : `rgba(225, 225, 255, ${auraAlpha})`;
      ctx.fillStyle = auraColor;
      ctx.fillRect(x - 8, y - 8, player.width + 16, player.height + 16);
    }

    ctx.fillStyle = "#e7b088";
    ctx.fillRect(x + 5, y, 14, 12);
    ctx.fillStyle = "#5f3f24";
    ctx.fillRect(x + 5, y, 14, 4);

    if (state.poderActivo.tipo === POWER_TYPES.HEROBRINE) {
      ctx.save();
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 10;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x + 8, y + 6, 3, 2);
      ctx.fillRect(x + 13, y + 6, 3, 2);
      ctx.restore();
    }

    ctx.fillStyle = "#4aa9c7";
    ctx.fillRect(x + 2, y + 12, 20, 16);

    ctx.fillStyle = "#3a53b5";
    const legTop = y + 28;
    ctx.fillRect(x + 4, legTop, 7, player.height - 28);
    ctx.fillRect(x + 13, legTop, 7, player.height - 28);

    if (!crouch) {
      ctx.fillStyle = "#3347a2";
      ctx.fillRect(x + 4 + legShift, legTop + 10, 7, player.height - 38);
      ctx.fillRect(x + 13 - legShift, legTop + 10, 7, player.height - 38);
    }
  }

  function drawSky() {
    if (state.poderActivo.tipo === POWER_TYPES.HEROBRINE) {
      ctx.fillStyle = "#1a0033";
      ctx.fillRect(0, 0, CONFIG.width, CONFIG.groundTop);

      if (Math.random() < 0.1) {
        const boltX = Math.random() * (CONFIG.width - 30) + 15;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(boltX, 18, 2, 26);
        ctx.fillRect(boltX - 3, 38, 6, 2);
        ctx.fillRect(boltX + 4, 40, 2, 18);
      }
      return;
    }

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

      const moonX = CONFIG.width - 58;
      ctx.fillStyle = `rgba(235, 236, 215, ${0.7 * alpha})`;
      ctx.fillRect(moonX, 36, 18, 18);
      ctx.fillStyle = `rgba(156, 176, 215, ${0.5 * alpha})`;
      ctx.fillRect(moonX + 8, 40, 8, 8);
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

  function drawObstacle(obstacle) {
    if (obstacle.type === "phantom") {
      drawPhantom(obstacle);
      return;
    }
    if (obstacle.type === "tree") {
      drawTree(obstacle);
      return;
    }
    if (obstacle.type === "cactus") {
      drawCactus(obstacle);
      return;
    }
    drawCreeper(obstacle);
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
    const panelWidth = Math.min(320, CONFIG.width - 20);

    ctx.fillStyle = "rgba(12, 18, 16, 0.55)";
    ctx.fillRect(10, 10, panelWidth, 74);
    ctx.strokeStyle = "rgba(155, 190, 175, 0.65)";
    ctx.strokeRect(10, 10, panelWidth, 74);

    ctx.fillStyle = "#effff6";
    ctx.font = "bold 14px monospace";
    ctx.fillText(`SCORE: ${Math.floor(state.score)}`, 20, 31);
    ctx.fillText(`HIGHSCORE: ${Math.max(state.highScore, Math.floor(state.score))}`, 20, 51);

    if (state.poderActivo.tipo) {
      const secs = Math.ceil(state.poderActivo.tiempoRestante / 60);
      const isApple = state.poderActivo.tipo === POWER_TYPES.GOLDEN_APPLE;
      const isHerobrine = state.poderActivo.tipo === POWER_TYPES.HEROBRINE;
      ctx.fillStyle = isApple ? "#ffe28f" : isHerobrine ? "#ffffff" : "#ffb8f8";
      ctx.font = "bold 12px monospace";
      ctx.fillText(`PODER: ${state.poderActivo.tipo} (${secs}s)`, 20, 72);
    } else {
      ctx.fillStyle = "#a3b3ab";
      ctx.font = "bold 12px monospace";
      ctx.fillText("PODER: NINGUNO", 20, 72);
    }

    ctx.font = "bold 12px monospace";
    ctx.fillStyle = state.biome === "desert" ? "#ffdf95" : "#97f08a";
    ctx.fillText(`BIOMA: ${state.biome === "desert" ? "DESIERTO" : "PRADERA"}`, CONFIG.width - 142, 96);
  }

  function drawGameOver() {
    if (state.running && state.gameOverAlpha <= 0) return;

    ctx.fillStyle = `rgba(0, 0, 0, ${state.gameOverAlpha})`;
    ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);

    const centerY = CONFIG.height * 0.5;
    ctx.textAlign = "center";
    ctx.fillStyle = "#ff7b7b";
    ctx.font = "bold 32px monospace";
    ctx.fillText("GAME OVER", CONFIG.width / 2, centerY - 62);

    ctx.fillStyle = "#f5f5f5";
    ctx.font = "bold 15px monospace";
    ctx.fillText(`PUNTAJE FINAL: ${Math.floor(state.score)}`, CONFIG.width / 2, centerY - 16);
    ctx.fillText(`HIGHSCORE: ${state.highScore}`, CONFIG.width / 2, centerY + 12);

    ctx.fillStyle = "#d2ffd7";
    ctx.font = "bold 14px monospace";
    ctx.fillText("ESPACIO PARA REINICIAR", CONFIG.width / 2, centerY + 52);
    ctx.textAlign = "start";
  }

  function render(now) {
    drawSky();
    drawParallax();
    drawGround();

    state.obstacles.forEach(drawObstacle);
    drawPowerItem();

    drawSteve(now);
    drawParticles();
    drawUI();

    if (state.impactFlashMs > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${state.impactFlashMs / 300})`;
      ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
    }

    drawGameOver();
  }

  return {
    render
  };
}
