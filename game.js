    (() => {
      "use strict";

      const CONFIG = {
        width: 800,
        height: 300,
        groundTop: 232,
        gravity: 0.72,
        jumpVelocity: -12.2,
        baseSpeed: 5.2,
        maxSpeed: 12,
        scoreRate: 0.095,
        highScoreKey: "minecraft_runner_highscore",
        invulnMs: 5000
      };

      const COLORS = {
        dirt: "#866043",
        grass: "#55a82e",
        grassDark: "#457f26",
        dust: "#b0b0b0",
        cloud: "#e9f3ff",
        mountainA: "#597777",
        mountainB: "#395157",
        day: [112, 183, 255],
        sunsetA: [255, 150, 98],
        sunsetB: [162, 95, 179],
        night: [18, 34, 66]
      };

      const canvas = document.getElementById("game");
      const ctx = canvas.getContext("2d", { alpha: false });
      ctx.imageSmoothingEnabled = false;

      const modePill = document.getElementById("modePill");

      const state = {
        running: true,
        autopilot: true,
        score: 0,
        highScore: Number(localStorage.getItem(CONFIG.highScoreKey) || 0),
        speed: CONFIG.baseSpeed,
        lastTimestamp: 0,
        obstacleTimer: 0,
        obstacleInterval: 72,
        powerupTimer: 0,
        powerupInterval: 6800,
        dustTimer: 0,
        stars: [],
        clouds: [],
        mountains: [],
        obstacles: [],
        powerups: [],
        particles: [],
        gameOverAlpha: 0,
        impactFlashMs: 0,
        biome: "plains"
      };

      const input = {
        jumpPressed: false,
        duckHeld: false
      };

      const player = {
        x: 96,
        y: CONFIG.groundTop - 48,
        width: 24,
        heightStanding: 48,
        heightDucked: 34,
        height: 48,
        vy: 0,
        onGround: true,
        runFrame: 0,
        runFrameTimer: 0,
        invulnerableUntil: 0,
        swordCharges: 0,
        blinkTimer: 0,
        forcedDuckUntilX: null,
        canJump() {
          return this.onGround;
        },
        getAABB() {
          return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
          };
        }
      };

      function rand(min, max) {
        return Math.random() * (max - min) + min;
      }

      function clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
      }

      function lerp(a, b, t) {
        return a + (b - a) * t;
      }

      function aabbIntersects(a, b) {
        return a.x < b.x + b.width &&
          a.x + a.width > b.x &&
          a.y < b.y + b.height &&
          a.y + a.height > b.y;
      }

      function rgbString(rgb) {
        return `rgb(${rgb[0] | 0}, ${rgb[1] | 0}, ${rgb[2] | 0})`;
      }

      function updateModeIndicator() {
        if (state.autopilot) {
          modePill.textContent = "🤖 IA AUTOPILOTO";
          modePill.classList.remove("manual");
          modePill.style.color = "#93ffb8";
        } else {
          modePill.textContent = "🎮 MANUAL";
          modePill.classList.add("manual");
          modePill.style.color = "#ff9f9f";
        }
      }

      function disableAutopilot() {
        if (!state.autopilot) return;
        state.autopilot = false;
        player.forcedDuckUntilX = null;
        updateModeIndicator();
      }

      function resetRun() {
        state.running = true;
        state.score = 0;
        state.speed = CONFIG.baseSpeed;
        state.obstacleTimer = 0;
        state.obstacleInterval = 70;
        state.powerupTimer = 0;
        state.powerupInterval = 6800;
        state.particles.length = 0;
        state.obstacles.length = 0;
        state.powerups.length = 0;
        state.gameOverAlpha = 0;
        state.impactFlashMs = 0;
        state.biome = "plains";

        player.y = CONFIG.groundTop - player.heightStanding;
        player.height = player.heightStanding;
        player.vy = 0;
        player.onGround = true;
        player.runFrame = 0;
        player.runFrameTimer = 0;
        player.invulnerableUntil = 0;
        player.swordCharges = 0;
        player.blinkTimer = 0;
        player.forcedDuckUntilX = null;

        input.jumpPressed = false;
        input.duckHeld = false;
      }

      function createBackground() {
        state.clouds = Array.from({ length: 6 }, () => ({
          x: rand(0, CONFIG.width),
          y: rand(28, 100),
          w: rand(24, 44),
          h: rand(10, 18),
          speed: rand(0.15, 0.35)
        }));

        state.mountains = Array.from({ length: 7 }, (_, i) => ({
          x: i * 140 + rand(-20, 40),
          w: rand(90, 150),
          h: rand(30, 70),
          speed: rand(0.65, 1.2)
        }));

        state.stars = Array.from({ length: 45 }, () => ({
          x: rand(0, CONFIG.width),
          y: rand(10, 158),
          twinkle: rand(0, Math.PI * 2)
        }));
      }

      function getTimeOfDay(score) {
        const cycle = (score / 1800) % 1;
        if (cycle < 0.35) {
          return { phase: "day", t: cycle / 0.35 };
        }
        if (cycle < 0.57) {
          return { phase: "sunset", t: (cycle - 0.35) / 0.22 };
        }
        if (cycle < 0.9) {
          return { phase: "night", t: (cycle - 0.57) / 0.33 };
        }
        return { phase: "dawn", t: (cycle - 0.9) / 0.1 };
      }

      function isNightPhase() {
        const tod = getTimeOfDay(state.score);
        return tod.phase === "night";
      }

      function getSkyColors() {
        const tod = getTimeOfDay(state.score);
        let top = COLORS.day;
        let bottom = [182, 225, 255];

        if (tod.phase === "day") {
          top = COLORS.day;
          bottom = [184, 230, 255];
        } else if (tod.phase === "sunset") {
          top = [
            lerp(COLORS.day[0], COLORS.sunsetA[0], tod.t),
            lerp(COLORS.day[1], COLORS.sunsetA[1], tod.t),
            lerp(COLORS.day[2], COLORS.sunsetA[2], tod.t)
          ];
          bottom = [
            lerp(184, COLORS.sunsetB[0], tod.t),
            lerp(230, COLORS.sunsetB[1], tod.t),
            lerp(255, COLORS.sunsetB[2], tod.t)
          ];
        } else if (tod.phase === "night") {
          top = COLORS.night;
          bottom = [28, 52, 98];
        } else if (tod.phase === "dawn") {
          top = [
            lerp(COLORS.night[0], COLORS.day[0], tod.t),
            lerp(COLORS.night[1], COLORS.day[1], tod.t),
            lerp(COLORS.night[2], COLORS.day[2], tod.t)
          ];
          bottom = [
            lerp(28, 184, tod.t),
            lerp(52, 230, tod.t),
            lerp(98, 255, tod.t)
          ];
        }

        return { top: rgbString(top), bottom: rgbString(bottom), tod };
      }

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
          const w = 34;
          const h = 16;
          state.obstacles.push({
            type,
            x: CONFIG.width + 20,
            y: rand(150, 190),
            width: w,
            height: h,
            blinkMs: 0
          });
          return;
        }

        if (type === "creeper") {
          const w = 22;
          const h = rand(42, 50);
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

        if (type === "cactus") {
          const w = rand(16, 24);
          const h = rand(36, 58);
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
        const h = rand(48, 72);
        state.obstacles.push({
          type: "tree",
          x: CONFIG.width + 20,
          y: CONFIG.groundTop - h,
          width: w,
          height: h,
          blinkMs: 0
        });
      }

      function spawnPowerup() {
        const roll = Math.random();
        const kind = roll < 0.5 ? "apple" : "sword";
        const y = rand(132, 180);
        state.powerups.push({
          kind,
          x: CONFIG.width + 24,
          y,
          width: kind === "apple" ? 14 : 18,
          height: kind === "apple" ? 14 : 10,
          bob: rand(0, Math.PI * 2)
        });
      }

      function triggerJump() {
        if (!player.canJump()) return;
        player.vy = CONFIG.jumpVelocity;
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

      function consumeSwordAttack() {
        if (player.swordCharges <= 0 || !state.running) return;

        const hitZone = {
          x: player.x + player.width,
          y: player.y + 4,
          width: 70,
          height: player.height - 6
        };

        let targetIndex = -1;
        for (let i = 0; i < state.obstacles.length; i++) {
          const obstacle = state.obstacles[i];
          if (obstacle.type === "phantom") continue;
          if (aabbIntersects(hitZone, obstacle)) {
            targetIndex = i;
            break;
          }
        }

        if (targetIndex >= 0) {
          const target = state.obstacles[targetIndex];
          const palette = target.type === "cactus"
            ? ["#64c83e", "#3d8f24", "#7ce45b"]
            : target.type === "creeper"
            ? ["#3faa4d", "#6eda7a", "#2e6d39"]
            : ["#6c4a2f", "#2f6e2f", "#4f8f3e"];

          spawnObstacleBurst(target, palette);
          state.obstacles.splice(targetIndex, 1);
          player.swordCharges--;
        }
      }

      function runAutopilot() {
        if (!state.autopilot || !state.running) return;

        const next = state.obstacles.find(o => o.x + o.width > player.x);
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
          const jumpRange = clamp(58 + state.speed * 8 + next.width * 0.35, 75, 170);
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

      function handleCollisions(now) {
        const hero = player.getAABB();

        for (let i = state.powerups.length - 1; i >= 0; i--) {
          const p = state.powerups[i];
          if (aabbIntersects(hero, p)) {
            if (p.kind === "apple") {
              player.invulnerableUntil = now + CONFIG.invulnMs;
              emitParticles(p.x + p.width / 2, p.y + p.height / 2, 26,
                ["#f4d25b", "#fff59a", "#ffe27c"], 2.5, 2, 1.4, 34, 4);
            } else {
              player.swordCharges = Math.min(player.swordCharges + 1, 2);
              emitParticles(p.x + p.width / 2, p.y + p.height / 2, 20,
                ["#9ae5ff", "#55b3ff", "#3f7ddb"], 2.2, 2, 1.3, 32, 3.5);
            }
            state.powerups.splice(i, 1);
          }
        }

        for (let i = state.obstacles.length - 1; i >= 0; i--) {
          const obstacle = state.obstacles[i];
          if (!aabbIntersects(hero, obstacle)) continue;

          const invulnerable = now < player.invulnerableUntil;

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

      function updateBiome() {
        const phase = Math.floor(state.score / 1000) % 2;
        state.biome = phase === 0 ? "plains" : "desert";
      }

      function updateWorld(dt, now) {
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

        state.clouds.forEach(cloud => {
          cloud.x -= cloud.speed * step;
          if (cloud.x + cloud.w < -8) {
            cloud.x = CONFIG.width + rand(15, 60);
            cloud.y = rand(25, 100);
          }
        });

        state.mountains.forEach(m => {
          m.x -= m.speed * step;
          if (m.x + m.w < -10) {
            m.x = CONFIG.width + rand(20, 80);
            m.w = rand(90, 150);
            m.h = rand(30, 70);
            m.speed = rand(0.65, 1.2);
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

        state.powerupTimer += dt;
        if (state.powerupTimer > state.powerupInterval) {
          if (Math.random() < 0.85) {
            spawnPowerup();
          }
          state.powerupTimer = 0;
          state.powerupInterval = rand(6200, 9800) / clamp(state.speed / 3.2, 1, 2.4);
        }

        for (let i = state.obstacles.length - 1; i >= 0; i--) {
          const o = state.obstacles[i];
          o.x -= state.speed * step;
          o.blinkMs = Math.max(0, o.blinkMs - dt);
          if (o.x + o.width < -40) {
            state.obstacles.splice(i, 1);
          }
        }

        for (let i = state.powerups.length - 1; i >= 0; i--) {
          const p = state.powerups[i];
          p.x -= state.speed * step;
          p.bob += 0.06 * step;
          if (p.x + p.width < -20) {
            state.powerups.splice(i, 1);
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

        handleCollisions(now);

        player.blinkTimer = Math.max(0, player.blinkTimer - dt);
        state.impactFlashMs = Math.max(0, state.impactFlashMs - dt);

        if (state.score > state.highScore) {
          state.highScore = Math.floor(state.score);
        }
      }

      function drawPixelCloud(x, y, w, h) {
        const c = COLORS.cloud;
        ctx.fillStyle = c;
        ctx.fillRect(x, y, w, h);
        ctx.fillRect(x - 6, y + 4, 12, h - 2);
        ctx.fillRect(x + w - 6, y + 3, 10, h - 3);
        ctx.fillRect(x + 6, y - 3, w - 12, 4);
      }

      function drawPhantom(o) {
        const flap = Math.sin((state.score + o.x) * 0.06) > 0 ? 2 : -1;
        ctx.fillStyle = o.blinkMs > 0 && Math.floor(o.blinkMs / 35) % 2 ? "#ffffff" : "#4f607d";
        ctx.fillRect(o.x + 8, o.y + 6, o.width - 16, o.height - 6);
        ctx.fillRect(o.x + 2, o.y + 8 + flap, 10, 4);
        ctx.fillRect(o.x + o.width - 12, o.y + 8 - flap, 10, 4);
        ctx.fillStyle = "#8cb2ff";
        ctx.fillRect(o.x + 14, o.y + 4, o.width - 28, 3);
        ctx.fillStyle = "#d7ebff";
        ctx.fillRect(o.x + o.width - 10, o.y + 8, 2, 2);
      }

      function drawTree(o) {
        ctx.fillStyle = o.blinkMs > 0 && Math.floor(o.blinkMs / 35) % 2 ? "#ffffff" : "#654328";
        const trunkX = o.x + Math.floor(o.width / 2) - 4;
        ctx.fillRect(trunkX, o.y + o.height * 0.45, 8, o.height * 0.55);
        ctx.fillStyle = "#3e7c2e";
        ctx.fillRect(o.x, o.y, o.width, o.height * 0.55);
        ctx.fillStyle = "#5baa3e";
        ctx.fillRect(o.x + 4, o.y + 4, o.width - 8, o.height * 0.2);
      }

      function drawCactus(o) {
        ctx.fillStyle = o.blinkMs > 0 && Math.floor(o.blinkMs / 35) % 2 ? "#ffffff" : "#4baa2f";
        ctx.fillRect(o.x + 6, o.y, o.width - 12, o.height);
        ctx.fillRect(o.x, o.y + o.height * 0.35, 8, 12);
        ctx.fillRect(o.x + o.width - 8, o.y + o.height * 0.48, 8, 12);
        ctx.fillStyle = "#78db54";
        ctx.fillRect(o.x + 8, o.y + 3, 2, o.height - 8);
      }

      function drawCreeper(o) {
        const blink = o.blinkMs > 0 && Math.floor(o.blinkMs / 40) % 2 === 0;
        ctx.fillStyle = blink ? "#ffffff" : "#58b15f";
        ctx.fillRect(o.x, o.y, o.width, o.height);
        ctx.fillStyle = blink ? "#d9d9d9" : "#75d37a";
        ctx.fillRect(o.x + 2, o.y + 3, o.width - 4, o.height * 0.35);
        ctx.fillStyle = "#1c2c1f";
        ctx.fillRect(o.x + 5, o.y + 12, 4, 4);
        ctx.fillRect(o.x + o.width - 9, o.y + 12, 4, 4);
        ctx.fillRect(o.x + 8, o.y + 18, 6, 8);
        ctx.fillRect(o.x + 6, o.y + o.height - 9, 4, 9);
        ctx.fillRect(o.x + o.width - 10, o.y + o.height - 9, 4, 9);
      }

      function drawGoldenApple(p) {
        const bobY = Math.sin(p.bob) * 3;
        ctx.fillStyle = "#f4d65c";
        ctx.fillRect(p.x, p.y + bobY, p.width, p.height);
        ctx.fillStyle = "#ffe98a";
        ctx.fillRect(p.x + 3, p.y + 3 + bobY, p.width - 6, 4);
        ctx.fillStyle = "#8d5f1f";
        ctx.fillRect(p.x + p.width / 2 - 1, p.y - 2 + bobY, 2, 3);
      }

      function drawSwordPowerup(p) {
        const bobY = Math.sin(p.bob) * 3;
        ctx.fillStyle = "#8be1ff";
        ctx.fillRect(p.x + 4, p.y + bobY, 10, 3);
        ctx.fillStyle = "#5da8de";
        ctx.fillRect(p.x + 6, p.y + 3 + bobY, 6, 3);
        ctx.fillStyle = "#7e4f2d";
        ctx.fillRect(p.x + 8, p.y + 6 + bobY, 2, 4);
      }

      function drawSteve(now) {
        const blink = player.blinkTimer > 0 && Math.floor(player.blinkTimer / 45) % 2 === 0;
        if (blink) return;

        const x = Math.round(player.x);
        const y = Math.round(player.y);
        const crouch = player.height === player.heightDucked;
        const legShift = !player.onGround || crouch ? 0 : (player.runFrame === 0 ? 1 : -1);

        if (now < player.invulnerableUntil) {
          const glow = 14 + Math.sin(now * 0.02) * 2;
          ctx.fillStyle = "rgba(244, 214, 88, 0.35)";
          ctx.fillRect(x - glow / 2, y - 4, player.width + glow, player.height + 8);
        }

        ctx.fillStyle = "#e7b088";
        ctx.fillRect(x + 5, y, 14, 12);
        ctx.fillStyle = "#5f3f24";
        ctx.fillRect(x + 5, y, 14, 4);

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

        if (player.swordCharges > 0) {
          ctx.fillStyle = "#8be1ff";
          ctx.fillRect(x + 20, y + 16, 10, 3);
          ctx.fillStyle = "#5da8de";
          ctx.fillRect(x + 22, y + 19, 6, 3);
          ctx.fillStyle = "#7e4f2d";
          ctx.fillRect(x + 24, y + 22, 2, 4);
        }
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
          for (const s of state.stars) {
            const tw = (Math.sin(s.twinkle + state.score * 0.04) + 1) * 0.5;
            if (tw > 0.32) {
              ctx.fillRect(Math.round(s.x), Math.round(s.y), 2, 2);
            }
          }

          ctx.fillStyle = `rgba(235, 236, 215, ${0.7 * alpha})`;
          ctx.fillRect(662, 36, 18, 18);
          ctx.fillStyle = `rgba(156, 176, 215, ${0.5 * alpha})`;
          ctx.fillRect(670, 40, 8, 8);
        }
      }

      function drawParallax() {
        state.mountains.forEach((m, idx) => {
          ctx.fillStyle = idx % 2 ? COLORS.mountainA : COLORS.mountainB;
          const baseY = CONFIG.groundTop - 15;
          ctx.fillRect(m.x, baseY - m.h, m.w, m.h);
          ctx.fillRect(m.x + 8, baseY - m.h - 8, m.w - 16, 8);
        });

        state.clouds.forEach(c => drawPixelCloud(Math.round(c.x), Math.round(c.y), Math.round(c.w), Math.round(c.h)));
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

      function drawObstacle(o) {
        if (o.type === "phantom") {
          drawPhantom(o);
        } else if (o.type === "tree") {
          drawTree(o);
        } else if (o.type === "cactus") {
          drawCactus(o);
        } else if (o.type === "creeper") {
          drawCreeper(o);
        }
      }

      function drawParticles() {
        for (const p of state.particles) {
          const alpha = clamp(p.life / p.maxLife, 0, 1);
          ctx.globalAlpha = alpha;
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x, p.y, p.size, p.size);
        }
        ctx.globalAlpha = 1;
      }

      function drawUI(now) {
        ctx.fillStyle = "rgba(12, 18, 16, 0.55)";
        ctx.fillRect(10, 10, 248, 56);
        ctx.strokeStyle = "rgba(155, 190, 175, 0.65)";
        ctx.strokeRect(10, 10, 248, 56);

        ctx.fillStyle = "#effff6";
        ctx.font = "bold 16px monospace";
        ctx.fillText(`SCORE: ${Math.floor(state.score)}`, 20, 33);
        ctx.fillText(`HIGHSCORE: ${Math.max(state.highScore, Math.floor(state.score))}`, 20, 55);

        ctx.font = "bold 12px monospace";
        ctx.fillStyle = state.biome === "desert" ? "#ffdf95" : "#97f08a";
        ctx.fillText(`BIOMA: ${state.biome === "desert" ? "DESIERTO" : "PRADERA"}`, 610, 26);

        if (player.swordCharges > 0) {
          ctx.fillStyle = "rgba(27, 43, 80, 0.7)";
          ctx.fillRect(610, 34, 178, 22);
          ctx.strokeStyle = "#79cfff";
          ctx.strokeRect(610, 34, 178, 22);
          ctx.fillStyle = "#b7edff";
          ctx.fillText(`ESPADA LISTA: ${player.swordCharges}`, 620, 49);
        }

        if (now < player.invulnerableUntil) {
          const secs = ((player.invulnerableUntil - now) / 1000).toFixed(1);
          ctx.fillStyle = "rgba(95, 70, 20, 0.75)";
          ctx.fillRect(300, 12, 204, 24);
          ctx.strokeStyle = "#f4d55b";
          ctx.strokeRect(300, 12, 204, 24);
          ctx.fillStyle = "#ffe88f";
          ctx.font = "bold 12px monospace";
          ctx.fillText(`MODO DIOS ${secs}s`, 314, 28);
        }
      }

      function drawGameOver() {
        if (state.running && state.gameOverAlpha <= 0) return;

        const a = state.gameOverAlpha;
        ctx.fillStyle = `rgba(0, 0, 0, ${a})`;
        ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);

        ctx.textAlign = "center";
        ctx.fillStyle = "#ff7b7b";
        ctx.font = "bold 42px monospace";
        ctx.fillText("GAME OVER", CONFIG.width / 2, 120);

        ctx.fillStyle = "#f5f5f5";
        ctx.font = "bold 16px monospace";
        ctx.fillText(`PUNTAJE FINAL: ${Math.floor(state.score)}`, CONFIG.width / 2, 165);
        ctx.fillText(`HIGHSCORE: ${state.highScore}`, CONFIG.width / 2, 192);

        ctx.fillStyle = "#d2ffd7";
        ctx.font = "bold 15px monospace";
        ctx.fillText("ESPACIO PARA REINICIAR", CONFIG.width / 2, 232);

        ctx.textAlign = "start";
      }

      function render(now) {
        drawSky();
        drawParallax();
        drawGround();

        for (const obstacle of state.obstacles) {
          drawObstacle(obstacle);
        }

        for (const p of state.powerups) {
          if (p.kind === "apple") {
            drawGoldenApple(p);
          } else {
            drawSwordPowerup(p);
          }
        }

        drawSteve(now);
        drawParticles();
        drawUI(now);

        if (state.impactFlashMs > 0) {
          ctx.fillStyle = `rgba(255, 255, 255, ${state.impactFlashMs / 300})`;
          ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
        }

        drawGameOver();
      }

      function animationFrame(timestamp) {
        if (!state.lastTimestamp) state.lastTimestamp = timestamp;
        const dt = clamp(timestamp - state.lastTimestamp, 0, 34);
        state.lastTimestamp = timestamp;

        updateWorld(dt, timestamp);
        render(timestamp);

        requestAnimationFrame(animationFrame);
      }

      function onKeyDown(e) {
        const code = e.code;

        if (code === "Space") {
          e.preventDefault();
          if (!state.running) {
            resetRun();
            return;
          }
          disableAutopilot();
          input.jumpPressed = true;
        }

        if (code === "ArrowUp" || code === "KeyW") {
          disableAutopilot();
          input.jumpPressed = true;
        }

        if (code === "ArrowDown" || code === "KeyS") {
          disableAutopilot();
          input.duckHeld = true;
        }

        if (code === "ArrowLeft" || code === "ArrowRight") {
          disableAutopilot();
        }

        if (code === "KeyF" || code === "KeyX") {
          consumeSwordAttack();
        }
      }

      function onKeyUp(e) {
        const code = e.code;
        if (code === "Space" || code === "ArrowUp" || code === "KeyW") {
          input.jumpPressed = false;
        }

        if (code === "ArrowDown" || code === "KeyS") {
          input.duckHeld = false;
        }
      }

      function boot() {
        createBackground();
        resetRun();
        updateModeIndicator();
        window.addEventListener("keydown", onKeyDown, { passive: false });
        window.addEventListener("keyup", onKeyUp);
        requestAnimationFrame(animationFrame);
      }

      boot();
    })();
