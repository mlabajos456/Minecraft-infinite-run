import { rand, clamp, aabbIntersects } from "./utils.js";

const POWER_TYPES = {
  GOLDEN_APPLE: "MANZANA_DORADA",
  JUMP_POTION: "POCION_SALTO",
  HEROBRINE: "MODO_HEROBRINE"
};

export function createGameplaySystems(game) {
  const { CONFIG, COLORS, state, player, input, isNightPhase } = game;

  function emitParticles(x, y, count, palette, spreadX, spreadY, speed, life, size) {
    for (let i = 0; i < count; i++) {
      state.particles.push({
        x,
        y,
        vx: rand(-spreadX, spreadX) * speed,
        vy: rand(-spreadY, spreadY) * speed,
        life: rand(life * 0.6, life),
        maxLife: life,
        color: palette[(Math.random() * palette.length) | 0],
        size: rand(size * 0.6, size),
        gravity: rand(0.05, 0.2)
      });
    }
  }

  function spawnRunDust() {
    const footY = player.y + player.height - 2;
    emitParticles(
      player.x + rand(4, player.width - 4),
      footY,
      2,
      [COLORS.dirt, COLORS.grass, COLORS.grassDark],
      0.8,
      0.3,
      1.2,
      18,
      3
    );
  }

  function spawnLandingDust(strength) {
    emitParticles(
      player.x + player.width / 2,
      CONFIG.groundTop - 2,
      Math.floor(clamp(6 + strength * 1.8, 6, 12)),
      ["#c4c4c4", "#9c9c9c", "#d2d2d2"],
      2.6,
      0.8,
      1.4,
      30,
      4
    );
  }

  function spawnObstacleBurst(obstacle, colorSet) {
    emitParticles(
      obstacle.x + obstacle.width / 2,
      obstacle.y + obstacle.height / 2,
      26,
      colorSet,
      3,
      2.6,
      1.8,
      40,
      4
    );
  }

  function spawnExplosion(x, y) {
    emitParticles(
      x,
      y,
      54,
      ["#f7f7f7", "#ffd270", "#ff8f6b", "#6f6f6f"],
      3.5,
      3,
      2.2,
      46,
      5
    );
  }

  function spawnObstacle() {
    const night = isNightPhase();
    const r = Math.random();
    let type = "tree";

    if (night && r < 0.24) {
      type = "phantom";
    } else if (r < 0.18) {
      type = "creeper";
    } else if (state.biome === "desert" && r < 0.62) {
      type = "cactus";
    }

    if (type === "phantom") {
      state.obstacles.push({
        type,
        x: CONFIG.width + 20,
        y: rand(CONFIG.groundTop - 62, CONFIG.groundTop - 50),
        width: 34,
        height: 16,
        blinkMs: 0
      });
      return;
    }

    if (type === "creeper") {
      const h = rand(38, 46);
      state.obstacles.push({
        type,
        x: CONFIG.width + 20,
        y: CONFIG.groundTop - h,
        width: 22,
        height: h,
        blinkMs: 0
      });
      return;
    }

    if (type === "cactus") {
      const w = rand(16, 24);
      const h = rand(32, 46);
      state.obstacles.push({
        type,
        x: CONFIG.width + 20,
        y: CONFIG.groundTop - h,
        width: w,
        height: h,
        blinkMs: 0
      });
      return;
    }

    const w = rand(20, 30);
    const h = rand(40, 56);
    state.obstacles.push({
      type: "tree",
      x: CONFIG.width + 20,
      y: CONFIG.groundTop - h,
      width: w,
      height: h,
      blinkMs: 0
    });
  }

  function trySpawnPowerItem() {
    if (state.itemPoder) return;

    const currentBlock = Math.floor(state.score / CONFIG.powerRollBlockSize);
    if (currentBlock === state.powerRollBlock) return;

    state.powerRollBlock = currentBlock;
    if (Math.random() >= CONFIG.powerSpawnChance) return;

    const roll = Math.random();
    let tipo = POWER_TYPES.GOLDEN_APPLE;
    if (roll < 0.45) {
      tipo = POWER_TYPES.GOLDEN_APPLE;
    } else if (roll < 0.9) {
      tipo = POWER_TYPES.JUMP_POTION;
    } else {
      tipo = POWER_TYPES.HEROBRINE;
    }
    state.itemPoder = {
      tipo,
      x: CONFIG.width + 22,
      y: rand(CONFIG.groundTop - 170, CONFIG.groundTop - 72),
      width: 14,
      height: 14,
      bob: rand(0, Math.PI * 2)
    };
  }

  function activatePower(tipo) {
    state.poderActivo.tipo = tipo;
    state.poderActivo.tiempoRestante = tipo === POWER_TYPES.HEROBRINE
      ? CONFIG.herobrineDurationFrames
      : CONFIG.powerDurationFrames;
  }

  function isHerobrineActive() {
    return state.poderActivo.tipo === POWER_TYPES.HEROBRINE;
  }

  function updateActivePower(step) {
    if (!state.poderActivo.tipo) return;

    state.poderActivo.tiempoRestante -= step;
    if (state.poderActivo.tiempoRestante > 0) return;

    state.poderActivo.tipo = null;
    state.poderActivo.tiempoRestante = 0;
  }

  function getJumpVelocity() {
    if (state.poderActivo.tipo === POWER_TYPES.JUMP_POTION) {
      return CONFIG.jumpPotionVelocity;
    }
    return CONFIG.jumpVelocity;
  }

  function triggerJump() {
    if (!player.canJump()) return;
    player.vy = getJumpVelocity();
    player.onGround = false;
    spawnLandingDust(3);
  }

  function setDuck(active) {
    const wantHeight = active ? player.heightDucked : player.heightStanding;
    if (wantHeight === player.height) return;

    if (active) {
      player.y += player.heightStanding - player.heightDucked;
    } else {
      player.y -= player.heightStanding - player.heightDucked;
      if (player.y < CONFIG.groundTop - player.heightStanding) {
        player.y = CONFIG.groundTop - player.heightStanding;
      }
    }

    player.height = wantHeight;
  }

  function runAutopilot() {
    if (!state.autopilot || !state.running) return;

    const next = state.obstacles.find((o) => o.x + o.width > player.x);
    if (!next) {
      player.forcedDuckUntilX = null;
      input.duckHeld = false;
      return;
    }

    const distance = next.x - (player.x + player.width);

    if (next.type === "phantom") {
      const duckStart = clamp(92 + state.speed * 7, 90, 160);
      if (distance < duckStart && distance > -next.width - 4) {
        player.forcedDuckUntilX = next.x + next.width + 8;
      }
    } else {
      if (isHerobrineActive() && (next.type === "tree" || next.type === "creeper")) {
        player.forcedDuckUntilX = null;
        input.duckHeld = false;
        return;
      }
      const jumpRange = clamp(74 + state.speed * 9 + next.width * 0.45, 92, 200);
      if (distance > 0 && distance < jumpRange && player.onGround) {
        triggerJump();
      }
    }

    if (player.forcedDuckUntilX !== null && next.type === "phantom" && next.x + next.width > player.x - 6) {
      input.duckHeld = true;
    } else if (player.forcedDuckUntilX !== null && next.x + next.width <= player.x - 6) {
      player.forcedDuckUntilX = null;
      input.duckHeld = false;
    }
  }

  function handlePowerItemCollision() {
    if (!state.itemPoder) return;

    const hero = player.getAABB();
    if (!aabbIntersects(hero, state.itemPoder)) return;

    const item = state.itemPoder;
    activatePower(item.tipo);

    const colors = item.tipo === POWER_TYPES.GOLDEN_APPLE
      ? ["#f4d25b", "#fff59a", "#ffe27c"]
      : item.tipo === POWER_TYPES.JUMP_POTION
      ? ["#f95cff", "#ff99ec", "#da45ff"]
      : ["#ffffff", "#c7b7ff", "#8b77ff"];

    emitParticles(item.x + item.width / 2, item.y + item.height / 2, 24, colors, 2.2, 2.2, 1.6, 34, 4);
    state.itemPoder = null;
  }

  function handleCollisions() {
    const hero = player.getAABB();
    const invulnerable = state.poderActivo.tipo === POWER_TYPES.GOLDEN_APPLE;

    for (let i = state.obstacles.length - 1; i >= 0; i--) {
      const obstacle = state.obstacles[i];
      if (!aabbIntersects(hero, obstacle)) continue;

      if (invulnerable) {
        const palette = obstacle.type === "phantom"
          ? ["#2f394f", "#7ca6df", "#9ac3ff"]
          : obstacle.type === "cactus"
          ? ["#62bb42", "#3f8a29", "#83df5f"]
          : obstacle.type === "creeper"
          ? ["#60dd78", "#327a46", "#a2f2b2"]
          : ["#6c4d32", "#4c8e36", "#336b29"];

        spawnObstacleBurst(obstacle, palette);
        state.obstacles.splice(i, 1);
        state.score += CONFIG.powerCrashBonus;
        continue;
      }

      if (obstacle.type === "creeper") {
        obstacle.blinkMs = 280;
        player.blinkTimer = 280;
        state.impactFlashMs = 150;
        spawnExplosion(
          obstacle.x + obstacle.width / 2,
          obstacle.y + obstacle.height / 2
        );
      }

      state.running = false;
      if (state.score > state.highScore) {
        state.highScore = Math.floor(state.score);
        localStorage.setItem(CONFIG.highScoreKey, String(state.highScore));
      }
      break;
    }
  }

  function processHerobrineField() {
    if (!isHerobrineActive()) return;

    for (let i = state.obstacles.length - 1; i >= 0; i--) {
      const obstacle = state.obstacles[i];
      if (obstacle.type !== "tree" && obstacle.type !== "creeper") continue;

      const distanceX = obstacle.x - (player.x + player.width);
      const inFront = obstacle.x + obstacle.width >= player.x - 2;
      if (!inFront || distanceX > CONFIG.herobrineDestroyDistance) continue;

      emitParticles(
        obstacle.x + obstacle.width / 2,
        obstacle.y + obstacle.height * 0.5,
        30,
        ["#8d8d8d", "#b9b9b9", "#6f6f6f"],
        3.3,
        2.4,
        1.9,
        42,
        4
      );
      emitParticles(
        obstacle.x + obstacle.width / 2,
        obstacle.y + obstacle.height * 0.45,
        18,
        ["#ffffff", "#f2f2f2", "#d8d8d8"],
        2.4,
        2,
        1.5,
        26,
        3
      );

      state.obstacles.splice(i, 1);
      state.score += CONFIG.herobrineDestroyBonus;
    }
  }

  function updateBiome() {
    state.biome = Math.floor(state.score / 1000) % 2 === 0 ? "plains" : "desert";
  }

  function updateWorld(dt) {
    if (!state.running) {
      state.gameOverAlpha = clamp(state.gameOverAlpha + dt * 0.0024, 0, 0.85);
      state.impactFlashMs = Math.max(0, state.impactFlashMs - dt);
      player.blinkTimer = Math.max(0, player.blinkTimer - dt);
      return;
    }

    const step = dt / 16.666;

    state.score += state.speed * CONFIG.scoreRate * step;
    state.speed = clamp(CONFIG.baseSpeed + state.score * 0.0026, CONFIG.baseSpeed, CONFIG.maxSpeed);

    updateBiome();
    updateActivePower(step);

    state.clouds.forEach((cloud) => {
      cloud.x -= cloud.speed * step;
      if (cloud.x + cloud.w < -8) {
        cloud.x = CONFIG.width + rand(15, 60);
        cloud.y = rand(25, 100);
      }
    });

    state.mountains.forEach((mountain) => {
      mountain.x -= mountain.speed * step;
      if (mountain.x + mountain.w < -10) {
        mountain.x = CONFIG.width + rand(20, 80);
        mountain.w = rand(90, 150);
        mountain.h = rand(30, 70);
        mountain.speed = rand(0.65, 1.2);
      }
    });

    runAutopilot();

    if (input.jumpPressed && player.onGround) {
      triggerJump();
    }

    setDuck(input.duckHeld && player.onGround);

    const vyBefore = player.vy;
    player.vy += CONFIG.gravity * step;
    player.y += player.vy * step;

    if (player.y + player.height >= CONFIG.groundTop) {
      player.y = CONFIG.groundTop - player.height;
      if (!player.onGround && vyBefore > 6) {
        spawnLandingDust(vyBefore);
      }
      player.vy = 0;
      player.onGround = true;
    } else {
      player.onGround = false;
    }

    if (player.onGround && !input.duckHeld) {
      player.runFrameTimer += dt;
      if (player.runFrameTimer > 90) {
        player.runFrame = (player.runFrame + 1) % 2;
        player.runFrameTimer = 0;
      }
      state.dustTimer += dt;
      if (state.dustTimer > 55) {
        spawnRunDust();
        state.dustTimer = 0;
      }
    }

    state.obstacleTimer += dt * (0.06 + state.speed * 0.0085);
    if (state.obstacleTimer > state.obstacleInterval) {
      spawnObstacle();
      state.obstacleTimer = 0;
      state.obstacleInterval = rand(58, 92) - clamp(state.speed * 1.2, 0, 10);
    }

    trySpawnPowerItem();

    for (let i = state.obstacles.length - 1; i >= 0; i--) {
      const obstacle = state.obstacles[i];
      obstacle.x -= state.speed * step;
      obstacle.blinkMs = Math.max(0, obstacle.blinkMs - dt);
      if (obstacle.x + obstacle.width < -40) {
        state.obstacles.splice(i, 1);
      }
    }

    if (state.itemPoder) {
      state.itemPoder.x -= state.speed * step;
      state.itemPoder.bob += 0.07 * step;
      if (state.itemPoder.x + state.itemPoder.width < -20) {
        state.itemPoder = null;
      }
    }

    for (let i = state.particles.length - 1; i >= 0; i--) {
      const particle = state.particles[i];
      particle.life -= step;
      particle.vy += particle.gravity * step;
      particle.x += particle.vx * step;
      particle.y += particle.vy * step;
      if (particle.life <= 0) {
        state.particles.splice(i, 1);
      }
    }

    handlePowerItemCollision();
    processHerobrineField();
    handleCollisions();

    player.blinkTimer = Math.max(0, player.blinkTimer - dt);
    state.impactFlashMs = Math.max(0, state.impactFlashMs - dt);

    if (state.score > state.highScore) {
      state.highScore = Math.floor(state.score);
    }
  }

  return {
    updateWorld,
    POWER_TYPES
  };
}
