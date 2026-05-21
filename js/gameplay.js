import { rand, clamp, aabbIntersects } from "./utils.js";

export const POWER_TYPES = {
  GOLDEN_APPLE: "MANZANA_DORADA",
  JUMP_POTION: "POCION_SALTO",
  HEROBRINE: "MODO_HEROBRINE"
};

class RedNeuronal {
  constructor(origen) {
    this.inputSize = 4;
    this.hiddenSize = 4;
    this.outputSize = 2;

    if (origen) {
      const sourceWih = origen.wIH.map((row) => row.slice());
      // Backward compatibility for old brains with 3 inputs.
      if (sourceWih.length === this.hiddenSize && sourceWih.every((row) => row.length === 3)) {
        for (const row of sourceWih) {
          row.push(rand(-0.35, 0.35));
        }
      }
      this.wIH = sourceWih;
      this.wHO = origen.wHO.map((row) => row.slice());
      this.bH = origen.bH.slice();
      this.bO = origen.bO.slice();
      return;
    }

    this.wIH = Array.from({ length: this.hiddenSize }, () =>
      Array.from({ length: this.inputSize }, () => rand(-1, 1))
    );
    this.wHO = Array.from({ length: this.outputSize }, () =>
      Array.from({ length: this.hiddenSize }, () => rand(-1, 1))
    );
    this.bH = Array.from({ length: this.hiddenSize }, () => rand(-1, 1));
    this.bO = Array.from({ length: this.outputSize }, () => rand(-1, 1));
  }

  static sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
  }

  predecir(entradas) {
    const hidden = new Array(this.hiddenSize);
    for (let h = 0; h < this.hiddenSize; h++) {
      let sum = this.bH[h];
      for (let i = 0; i < this.inputSize; i++) {
        sum += this.wIH[h][i] * (entradas[i] ?? 0);
      }
      hidden[h] = RedNeuronal.sigmoid(sum);
    }

    const out = new Array(this.outputSize);
    for (let o = 0; o < this.outputSize; o++) {
      let sum = this.bO[o];
      for (let h = 0; h < this.hiddenSize; h++) {
        sum += this.wHO[o][h] * hidden[h];
      }
      out[o] = RedNeuronal.sigmoid(sum);
    }
    return out;
  }

  clonar() {
    return new RedNeuronal(this);
  }

  mutar(tasa) {
    const mutateValue = (v) => (Math.random() < tasa ? v + rand(-0.25, 0.25) : v);

    for (let h = 0; h < this.hiddenSize; h++) {
      for (let i = 0; i < this.inputSize; i++) {
        this.wIH[h][i] = mutateValue(this.wIH[h][i]);
      }
      this.bH[h] = mutateValue(this.bH[h]);
    }

    for (let o = 0; o < this.outputSize; o++) {
      for (let h = 0; h < this.hiddenSize; h++) {
        this.wHO[o][h] = mutateValue(this.wHO[o][h]);
      }
      this.bO[o] = mutateValue(this.bO[o]);
    }
  }
}

function isNumberArray(arr, size) {
  return Array.isArray(arr) && arr.length === size && arr.every((v) => Number.isFinite(v));
}

function isNumberMatrix(matrix, rows, cols) {
  return Array.isArray(matrix) &&
    matrix.length === rows &&
    matrix.every((row) => isNumberArray(row, cols));
}

export function createGameplaySystems(game) {
  const {
    CONFIG,
    COLORS,
    state,
    input,
    isNightPhase,
    resetCommonRunState,
    resetStreamSpeed,
    updateModeIndicator,
    updateSpeedIndicator
  } = game;

  function createSteve(cerebro) {
    return {
      x: 120,
      y: CONFIG.groundTop - 48,
      width: 28,
      heightStanding: 48,
      heightDucked: 31,
      height: 48,
      vy: 0,
      onGround: true,
      ducking: false,
      fitness: 0,
      vivo: true,
      cerebro: cerebro || new RedNeuronal()
    };
  }

  function resetStevePhysics(steve) {
    steve.y = CONFIG.groundTop - steve.heightStanding;
    steve.height = steve.heightStanding;
    steve.vy = 0;
    steve.onGround = true;
    steve.ducking = false;
    steve.fitness = 0;
    steve.vivo = true;
  }

  function setDuck(steve, active) {
    if (!steve.vivo) return;
    const wantHeight = active ? steve.heightDucked : steve.heightStanding;
    if (wantHeight === steve.height) {
      steve.ducking = active;
      return;
    }

    if (active) {
      steve.y += steve.heightStanding - steve.heightDucked;
    } else {
      steve.y -= steve.heightStanding - steve.heightDucked;
      steve.y = Math.min(steve.y, CONFIG.groundTop - steve.heightStanding);
    }

    steve.height = wantHeight;
    steve.ducking = active;
  }

  function jump(steve) {
    if (!steve.onGround || !steve.vivo) return;
    steve.vy = getJumpVelocity();
    steve.onGround = false;
    emitParticles(steve.x + steve.width * 0.5, steve.y + steve.height, 10, ["#d6d6d6", "#9d9d9d", "#f2f2f2"], 1.6, 1.1, 22, 4);
  }

  function applyPhysics(steve, step) {
    steve.vy += CONFIG.gravity * step;
    steve.vy = Math.min(steve.vy, CONFIG.maxFallVelocity);
    steve.y += steve.vy * step;

    if (steve.y + steve.height >= CONFIG.groundTop) {
      steve.y = CONFIG.groundTop - steve.height;
      steve.vy = 0;
      steve.onGround = true;
    } else {
      steve.onGround = false;
    }
  }

  function applyFastFallControl(steve, shouldFastFall, step) {
    if (!shouldFastFall || steve.onGround) return;
    steve.vy += CONFIG.gravity * CONFIG.fastFallMultiplier * step;
    steve.vy = Math.min(steve.vy, CONFIG.maxFallVelocity);
  }

  function getSteveAABB(steve) {
    return {
      x: steve.x,
      y: steve.y,
      width: steve.width,
      height: steve.height
    };
  }

  function getJumpVelocity() {
    if (state.poderActivo.tipo === POWER_TYPES.JUMP_POTION) {
      return CONFIG.jumpPotionVelocity;
    }
    return CONFIG.jumpVelocity;
  }

  function emitParticles(x, y, count, palette, spreadX, spreadY, life, size) {
    for (let i = 0; i < count; i++) {
      state.particles.push({
        x,
        y,
        vx: rand(-spreadX, spreadX),
        vy: rand(-spreadY, spreadY),
        life: rand(life * 0.6, life),
        maxLife: life,
        color: palette[(Math.random() * palette.length) | 0],
        size: rand(size * 0.6, size),
        gravity: rand(0.03, 0.16)
      });
    }
  }

  function spawnObstacle() {
    const night = isNightPhase();
    const r = Math.random();
    let type = "tree";

    if ((night && r < 0.42) || (!night && r < 0.08)) type = "phantom";
    else if (r < 0.18) type = "creeper";
    else if (r < 0.48) type = "cactus";

    if (type === "phantom") {
      const y = rand(CONFIG.groundTop - 84, CONFIG.groundTop - 58);
      state.obstacles.push({ type, x: CONFIG.width + 18, y, width: 46, height: 18, blinkMs: 0 });
      return;
    }

    if (type === "creeper") {
      const h = rand(40, 52);
      state.obstacles.push({ type, x: CONFIG.width + 18, y: CONFIG.groundTop - h, width: 30, height: h, blinkMs: 0 });
      return;
    }

    if (type === "cactus") {
      const h = rand(36, 56);
      const w = rand(20, 30);
      state.obstacles.push({ type, x: CONFIG.width + 18, y: CONFIG.groundTop - h, width: w, height: h, blinkMs: 0 });
      return;
    }

    const h = rand(62, 92);
    const w = rand(42, 64);
    state.obstacles.push({ type, x: CONFIG.width + 6, y: CONFIG.groundTop - h, width: w, height: h, blinkMs: 0 });
  }

  function trySpawnPowerItem() {
    if (state.itemPoder) return;

    const currentBlock = Math.floor(state.score / CONFIG.powerRollBlockSize);
    if (currentBlock === state.powerRollBlock) return;

    state.powerRollBlock = currentBlock;
    if (Math.random() >= CONFIG.powerSpawnChance) return;

    const roll = Math.random();
    let tipo = POWER_TYPES.GOLDEN_APPLE;
    if (roll < 0.5) {
      tipo = POWER_TYPES.GOLDEN_APPLE;
    } else {
      tipo = POWER_TYPES.JUMP_POTION;
    }

    state.itemPoder = {
      tipo,
      x: CONFIG.width + 22,
      y: rand(CONFIG.groundTop - 160, CONFIG.groundTop - 68),
      width: 18,
      height: 18,
      bob: rand(0, Math.PI * 2)
    };
  }

  function updateActivePower(step) {
    if (!state.poderActivo.tipo) return;
    state.poderActivo.tiempoRestante -= step;
    if (state.poderActivo.tiempoRestante > 0) return;
    state.poderActivo.tipo = null;
    state.poderActivo.tiempoRestante = 0;
  }

  function updateStreamFx(step) {
    if (state.streamFx.timerFrames <= 0) return;
    state.streamFx.timerFrames = Math.max(0, state.streamFx.timerFrames - step);
    if (state.streamFx.timerFrames === 0) {
      state.streamFx.text = "";
    }
  }

  function handlePowerItemCollision() {
    if (!state.itemPoder) return;

    const targets = state.aiTraining
      ? state.steves.filter((s) => s.vivo)
      : (state.manualSteve && state.manualSteve.vivo ? [state.manualSteve] : []);

    for (const steve of targets) {
      if (!aabbIntersects(getSteveAABB(steve), state.itemPoder)) continue;

      state.poderActivo.tipo = state.itemPoder.tipo;
      state.poderActivo.tiempoRestante = CONFIG.powerDurationFrames;

      const palette = state.itemPoder.tipo === POWER_TYPES.GOLDEN_APPLE
        ? ["#f4d25b", "#fff59a", "#ffe27c"]
        : ["#f95cff", "#ff99ec", "#da45ff"];
      const centerX = state.itemPoder.x + state.itemPoder.width * 0.5;
      const centerY = state.itemPoder.y + state.itemPoder.height * 0.5;
      emitParticles(centerX, centerY, 24, palette, 2.2, 2.2, 30, 4);
      state.itemPoder = null;
      break;
    }
  }

  function getNextObstacle(forX) {
    return state.obstacles.find((o) => o.x + o.width > forX) || null;
  }

  function getUpcomingObstacles(forX, count = 2) {
    return state.obstacles
      .filter((o) => o.x + o.width > forX)
      .sort((a, b) => a.x - b.x)
      .slice(0, count);
  }

  function inputForObstacle(steve, obstacle, secondObstacle) {
    if (!obstacle) return [1, state.speed / 20, 0, 0];
    const dist = clamp((obstacle.x - (steve.x + steve.width)) / 800, 0, 1);
    const speedNorm = clamp(state.speed / 20, 0, 1);
    const typeOrHeight = obstacle.type === "phantom" ? 90 : obstacle.height;
    const hNorm = clamp(typeOrHeight / 100, 0, 1);
    let pairTightness = 0;
    if (secondObstacle) {
      const gap = secondObstacle.x - (obstacle.x + obstacle.width);
      const gapNorm = clamp(gap / 220, 0, 1);
      pairTightness = 1 - gapNorm;
    }
    return [dist, speedNorm, hNorm, pairTightness];
  }

  function updateAI(step) {
    const upcoming = getUpcomingObstacles(120, 2);
    const next = upcoming[0] || null;
    const second = upcoming[1] || null;

    for (const steve of state.steves) {
      if (!steve.vivo) continue;
      steve.fitness += 1;

      const nnIn = inputForObstacle(steve, next, second);
      const out = steve.cerebro.predecir(nnIn);
      const controlledOut = [out[0], out[1]];

      if (!next) {
        controlledOut[0] = 0;
        controlledOut[1] = 0;
      } else {
        const distPx = next.x - (steve.x + steve.width);
        const reactionFrames = distPx / Math.max(0.001, state.speed);
        const isTallTree = next.type === "tree" && next.height >= 78;

        if (reactionFrames > 18 || distPx <= 0) {
          controlledOut[0] = 0;
        }

        if (isTallTree && steve.onGround) {
          const jumpWindow = state.speed * 17.5;
          if (distPx > 0 && distPx < jumpWindow) {
            controlledOut[0] = Math.max(controlledOut[0], 0.93);
          }
        }

        if (next.type === "phantom") {
          const phantomPrepDistance = state.speed * 24;
          const phantomDuckStart = state.speed * 15.5;
          const phantomTailX = next.x + next.width;
          const phantomSafeReleaseX = steve.x - 16;

          if (distPx < phantomPrepDistance) {
            controlledOut[0] = 0;
          }

          if (!steve.onGround && distPx < state.speed * 18 && distPx > -next.width && steve.vy < 5) {
            steve.vy += CONFIG.gravity * 2.2;
          }

          const shouldHoldDuck = distPx <= phantomDuckStart && phantomTailX > phantomSafeReleaseX;
          if (shouldHoldDuck) {
            controlledOut[1] = 1;
            setDuck(steve, true);
          } else if (steve.onGround) {
            setDuck(steve, false);
          }
        } else if (reactionFrames > 10) {
          controlledOut[1] = 0;
        }
      }

      if (controlledOut[0] > 0.8 && steve.onGround) {
        setDuck(steve, false);
        jump(steve);
      }

      if (controlledOut[1] > 0.8) {
        setDuck(steve, true);
      } else if (steve.onGround && (!next || next.type !== "phantom")) {
        setDuck(steve, false);
      }

      if (next && second && next.type !== "phantom" && second.type !== "phantom") {
        const gap = second.x - (next.x + next.width);
        const isTightPair = gap > 0 && gap < state.speed * 14;
        const distPx = next.x - (steve.x + steve.width);
        const nearFirstObstacle = distPx < state.speed * 12 && distPx > -next.width;

        if (isTightPair && nearFirstObstacle && !steve.onGround && controlledOut[1] > 0.8 && steve.vy > 0) {
          steve.fitness += 0.42;
        }
      }

      applyFastFallControl(steve, controlledOut[1] > 0.8, step);
      applyPhysics(steve, step);
    }

    state.aliveCount = state.steves.reduce((acc, s) => acc + (s.vivo ? 1 : 0), 0);
    if (state.aliveCount === 0) {
      nextGeneration();
    }
  }

  function updateManual(step) {
    const steve = state.manualSteve;
    if (!steve || !steve.vivo) {
      state.running = false;
      state.gameOverAlpha = clamp(state.gameOverAlpha + step * 0.05, 0, 0.85);
      return;
    }

    steve.fitness += 1;

    if (input.jumpPressed && steve.onGround) {
      jump(steve);
    }

    if (steve.onGround) {
      setDuck(steve, input.duckHeld);
    }

    applyFastFallControl(steve, input.duckHeld, step);
    applyPhysics(steve, step);
  }

  function killSteve(steve, obstacle) {
    if (state.poderActivo.tipo === POWER_TYPES.GOLDEN_APPLE) {
      const pal = obstacle.type === "tree"
        ? ["#6c4d32", "#4f8e35", "#2f6426"]
        : obstacle.type === "cactus"
        ? ["#6acb4c", "#3f8a29", "#86e26e"]
        : obstacle.type === "phantom"
        ? ["#90b9f4", "#5f7cb8", "#c4d6fa"]
        : ["#80f49f", "#4bb76b", "#c6ffd2"];
      emitParticles(obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2, 30, pal, 2.8, 2.4, 36, 4);
      return "break";
    }

    if (obstacle.type === "creeper") {
      obstacle.blinkMs = 18;
      emitParticles(obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2, 42, ["#ffe69f", "#ff925a", "#555"], 3.1, 2.7, 40, 5);
    } else {
      emitParticles(obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2, 24, ["#d8d8d8", "#8f8f8f", "#f6f6f6"], 2.2, 2.2, 30, 4);
    }

    steve.vivo = false;
    return "dead";
  }

  function handleCollisions() {
    const targets = state.aiTraining
      ? state.steves
      : (state.manualSteve ? [state.manualSteve] : []);

    for (const steve of targets) {
      if (!steve.vivo) continue;
      const hero = getSteveAABB(steve);

      for (let i = state.obstacles.length - 1; i >= 0; i--) {
        const obstacle = state.obstacles[i];
        if (!aabbIntersects(hero, obstacle)) continue;

        const result = killSteve(steve, obstacle);
        if (result === "break") {
          state.obstacles.splice(i, 1);
          state.score += CONFIG.powerCrashBonus;
        }
        if (!steve.vivo) break;
      }
    }

    if (!state.aiTraining && state.manualSteve && !state.manualSteve.vivo) {
      state.running = false;
      if (state.score > state.highScore) {
        state.highScore = Math.floor(state.score);
        localStorage.setItem(CONFIG.highScoreKey, String(state.highScore));
      }
    }
  }

  function updateBiome() {
    state.biome = Math.floor(state.score / 1000) % 2 === 0 ? "plains" : "desert";
  }

  function rollNextObstacleInterval() {
    const speedPressure = clamp(state.speed / CONFIG.maxSpeed, 0, 1);
    let interval = rand(36, 84) - speedPressure * 16;

    // Sometimes spawn in tighter clusters.
    if (Math.random() < 0.24) {
      interval *= rand(0.52, 0.78);
    }

    // Sometimes create a larger breathing gap.
    if (Math.random() < 0.16) {
      interval *= rand(1.15, 1.42);
    }

    return clamp(interval, 18, 92);
  }

  function serializarCerebro(cerebro) {
    return {
      wIH: cerebro.wIH.map((row) => row.slice()),
      wHO: cerebro.wHO.map((row) => row.slice()),
      bH: cerebro.bH.slice(),
      bO: cerebro.bO.slice()
    };
  }

  function hidratarCerebro(data) {
    if (!data) return null;
    if (!Array.isArray(data.wIH) || data.wIH.length !== 4) return null;
    const wihCols = data.wIH[0]?.length;
    if (wihCols !== 3 && wihCols !== 4) return null;
    if (!isNumberMatrix(data.wIH, 4, wihCols)) return null;
    if (!isNumberMatrix(data.wHO, 2, 4)) return null;
    if (!isNumberArray(data.bH, 4)) return null;
    if (!isNumberArray(data.bO, 2)) return null;
    return new RedNeuronal(data);
  }

  function getChampion(steves) {
    if (!steves || steves.length === 0) return null;
    let champion = steves[0];
    for (let i = 1; i < steves.length; i++) {
      if (steves[i].fitness > champion.fitness) champion = steves[i];
    }
    return champion;
  }

  function createPopulation(championBrain = null) {
    const steves = [];

    if (championBrain) {
      steves.push(createSteve(championBrain.clonar()));
      for (let i = 1; i < CONFIG.population; i++) {
        const child = championBrain.clonar();
        child.mutar(0.1);
        steves.push(createSteve(child));
      }
    } else {
      for (let i = 0; i < CONFIG.population; i++) {
        steves.push(createSteve());
      }
    }

    state.steves = steves;
    state.aliveCount = steves.length;
    state.manualSteve = steves[0];
  }

  function saveTraining(championOverride = null) {
    const champion = championOverride || getChampion(state.steves);
    if (!champion || !champion.cerebro) return;

    const serializedBrain = serializarCerebro(champion.cerebro);
    const payload = {
      version: 1,
      generation: state.generation,
      generacion: state.generation,
      highScore: Math.floor(state.highScore),
      bestScore: Math.floor(state.highScore),
      brain: serializedBrain,
      cerebro: serializedBrain,
      savedAt: Date.now()
    };

    try {
      localStorage.setItem(CONFIG.trainingStorageKey, JSON.stringify(payload));
    } catch {
      // Ignore storage errors.
    }
  }

  function loadTraining() {
    const candidateKeys = [CONFIG.trainingStorageKey];
    const keySeen = new Set(candidateKeys);

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || keySeen.has(key)) continue;
        keySeen.add(key);
        candidateKeys.push(key);
      }
    } catch {
      return false;
    }

    const toFiniteNumber = (value) => {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    };

    const pickFirstDefined = (...values) => values.find((v) => v !== undefined && v !== null);

    for (const key of candidateKeys) {
      let raw = null;
      try {
        raw = localStorage.getItem(key);
      } catch {
        continue;
      }
      if (!raw) continue;

      let parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }

      const brainSource = pickFirstDefined(
        parsed?.brain,
        parsed?.cerebro,
        parsed?.bestBrain,
        parsed?.data?.brain,
        parsed?.data?.cerebro,
        parsed
      );
      const brain = hidratarCerebro(brainSource);
      if (!brain) continue;

      const generationValue = toFiniteNumber(pickFirstDefined(
        parsed?.generation,
        parsed?.generacion,
        parsed?.gen,
        parsed?.data?.generation,
        parsed?.data?.generacion,
        parsed?.data?.gen
      ));
      const highScoreValue = toFiniteNumber(pickFirstDefined(
        parsed?.highScore,
        parsed?.bestScore,
        parsed?.best_score,
        parsed?.record,
        parsed?.data?.highScore,
        parsed?.data?.bestScore
      ));

      state.generation = generationValue !== null && generationValue > 0
        ? Math.floor(generationValue)
        : 1;
      if (highScoreValue !== null && highScoreValue >= 0) {
        state.highScore = Math.floor(highScoreValue);
      }

      createPopulation(brain);

      if (key !== CONFIG.trainingStorageKey) {
        saveTraining(state.steves[0]);
      }
      return true;
    }

    return false;
  }

  function nextGeneration() {
    const champion = getChampion(state.steves);
    if (!champion) return;

    state.generation += 1;
    createPopulation(champion.cerebro);
    resetCommonRunState();
    saveTraining(state.steves[0]);
  }

  function switchToManual() {
    const champion = getChampion(state.steves);
    const brain = champion ? champion.cerebro.clonar() : new RedNeuronal();

    resetCommonRunState();
    state.obstacleInterval = rand(30, 70);
    state.aiTraining = false;
    state.steves = [createSteve(brain)];
    state.manualSteve = state.steves[0];
    state.aliveCount = 1;
    updateModeIndicator();
  }

  function resetManualRun() {
    const brain = state.manualSteve?.cerebro ? state.manualSteve.cerebro.clonar() : new RedNeuronal();
    resetCommonRunState();
    state.obstacleInterval = rand(30, 70);
    state.aiTraining = false;
    state.steves = [createSteve(brain)];
    state.manualSteve = state.steves[0];
    state.aliveCount = 1;
    state.running = true;
  }

  function initializeTraining() {
    resetCommonRunState();
    resetStreamSpeed();
    state.obstacleInterval = rand(30, 70);
    state.aiTraining = true;
    if (!loadTraining()) {
      createPopulation();
      saveTraining();
    }
    updateModeIndicator();
    updateSpeedIndicator();
  }

  function getSimulationMultiplier() {
    return state.streamSpeed.levels[state.streamSpeed.levelIndex] || 1;
  }

  function showSpeedToast(direction) {
    state.streamSpeed.toastText = `x${getSimulationMultiplier()}`;
    state.streamSpeed.toastColor = direction === "down" ? "#ff6767" : "#8fff9b";
    state.streamSpeed.toastMs = state.streamSpeed.toastDurationMs;
  }

  function boostSimulationSpeedFromStream() {
    if (!state.aiTraining) return false;
    const prev = state.streamSpeed.levelIndex;
    state.streamSpeed.levelIndex = Math.min(state.streamSpeed.levels.length - 1, prev + 1);
    state.streamSpeed.silenceMs = 0;
    if (state.streamSpeed.levelIndex !== prev) {
      showSpeedToast("up");
    }
    updateSpeedIndicator();
    return true;
  }

  function reduceSimulationSpeedFromStream() {
    if (!state.aiTraining) return false;
    const prev = state.streamSpeed.levelIndex;
    state.streamSpeed.levelIndex = Math.max(0, prev - 1);
    state.streamSpeed.silenceMs = 0;
    if (state.streamSpeed.levelIndex !== prev) {
      showSpeedToast("down");
    }
    updateSpeedIndicator();
    return true;
  }

  function updateStreamSpeedDecay(dtMs) {
    state.streamSpeed.toastMs = Math.max(0, state.streamSpeed.toastMs - dtMs);
    if (!state.aiTraining) {
      state.streamSpeed.silenceMs = 0;
      return;
    }

    state.streamSpeed.silenceMs += dtMs;
    while (state.streamSpeed.silenceMs >= CONFIG.streamSpeedDecayMs && state.streamSpeed.levelIndex > 0) {
      state.streamSpeed.levelIndex -= 1;
      state.streamSpeed.silenceMs -= CONFIG.streamSpeedDecayMs;
      showSpeedToast("down");
      updateSpeedIndicator();
    }
  }

  function updateWorld(dt) {
    if (!state.running) {
      state.gameOverAlpha = clamp(state.gameOverAlpha + dt * 0.0024, 0, 0.85);
      state.impactFlashMs = Math.max(0, state.impactFlashMs - dt);

      if (!state.aiTraining) {
        if (!state.gameOverHasInput) {
          state.gameOverTimerMs += dt;
          if (state.gameOverTimerMs >= CONFIG.autoRestartDelayMs) {
            resetManualRun();
          }
        }
      }
      return;
    }

    const step = dt / 16.6667;

    state.score += state.speed * CONFIG.scoreRate * step;
    state.speed = clamp(CONFIG.baseSpeed + state.score * CONFIG.speedRamp, CONFIG.baseSpeed, CONFIG.maxSpeed);
    state.highScore = Math.max(state.highScore, Math.floor(state.score));

    updateBiome();
    updateActivePower(step);
    updateStreamFx(step);

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

    state.obstacleTimer += step;
    if (state.obstacleTimer > state.obstacleInterval) {
      spawnObstacle();
      state.obstacleTimer = 0;
      state.obstacleInterval = rollNextObstacleInterval();
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

    if (state.aiTraining) {
      updateAI(step);
    } else {
      updateManual(step);
    }

    handlePowerItemCollision();
    handleCollisions();

    state.dustTimer += dt;
    if (state.dustTimer > 55) {
      const runner = state.aiTraining
        ? state.steves.find((s) => s.vivo && s.onGround)
        : (state.manualSteve && state.manualSteve.vivo && state.manualSteve.onGround ? state.manualSteve : null);
      if (runner) {
        emitParticles(runner.x + rand(4, runner.width - 4), runner.y + runner.height - 2, 2, [COLORS.dirt, COLORS.grass, COLORS.grassDark], 0.8, 0.3, 18, 3);
      }
      state.dustTimer = 0;
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
  }

  function tryActivateHerobrine() {
    return false;
  }

  function activateHerobrineFromStream() {
    return false;
  }

  return {
    initializeTraining,
    updateWorld,
    updateStreamSpeedDecay,
    getSimulationMultiplier,
    boostSimulationSpeedFromStream,
    reduceSimulationSpeedFromStream,
    switchToManual,
    resetManualRun,
    tryActivateHerobrine,
    activateHerobrineFromStream,
    POWER_TYPES
  };
}
