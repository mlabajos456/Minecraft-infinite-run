import { rand, lerp, rgbString } from "./utils.js";

export function createGameContext({ canvas, modePill, speedPill, CONFIG, COLORS }) {
  const state = {
    running: true,
    aiTraining: true,
    score: 0,
    highScore: Number(localStorage.getItem(CONFIG.highScoreKey) || 0),
    speed: CONFIG.baseSpeed,
    generation: 1,
    aliveCount: CONFIG.population,
    lastTimestamp: 0,
    obstacleTimer: 0,
    obstacleInterval: CONFIG.obstacleBaseInterval,
    dustTimer: 0,
    stars: [],
    clouds: [],
    mountains: [],
    obstacles: [],
    particles: [],
    gameOverAlpha: 0,
    impactFlashMs: 0,
    biome: "plains",
    poderActivo: {
      tipo: null,
      tiempoRestante: 0
    },
    herobrineControl: {
      ready: false,
      cooldownFrames: 0
    },
    streamFx: {
      text: "",
      timerFrames: 0
    },
    streamSpeed: {
      levelIndex: 0,
      silenceMs: 0,
      levels: CONFIG.streamSpeedLevels.slice(),
      toastMs: 0,
      toastDurationMs: CONFIG.streamSpeedToastMs,
      toastText: "",
      toastColor: "#8fff9b"
    },
    gameOverTimerMs: 0,
    gameOverHasInput: false,
    itemPoder: null,
    powerRollBlock: -1,
    steves: [],
    manualSteve: null
  };

  const input = {
    jumpPressed: false,
    duckHeld: false
  };

  function updateModeIndicator() {
    if (state.aiTraining) {
      modePill.textContent = "IA ENTRENAMIENTO";
      modePill.classList.remove("manual");
      modePill.style.color = "#93ffb8";
      return;
    }

    modePill.textContent = "MODO MANUAL";
    modePill.classList.add("manual");
    modePill.style.color = "#ff9f9f";
  }

  function updateSpeedIndicator() {
    const level = state.streamSpeed.levels[state.streamSpeed.levelIndex] || 1;
    speedPill.textContent = `SIM x${level}`;
    speedPill.style.color = level > 1 ? "#9cffaa" : "#d8e9dd";
  }

  function disableTrainingMode() {
    if (!state.aiTraining) return;
    state.aiTraining = false;
    updateModeIndicator();
  }

  function resetCommonRunState() {
    state.running = true;
    state.score = 0;
    state.speed = CONFIG.baseSpeed;
    state.obstacleTimer = 0;
    state.obstacleInterval = CONFIG.obstacleBaseInterval;
    state.particles.length = 0;
    state.obstacles.length = 0;
    state.gameOverAlpha = 0;
    state.impactFlashMs = 0;
    state.biome = "plains";
    state.poderActivo.tipo = null;
    state.poderActivo.tiempoRestante = 0;
    state.herobrineControl.ready = false;
    state.herobrineControl.cooldownFrames = 0;
    state.streamFx.text = "";
    state.streamFx.timerFrames = 0;
    state.gameOverTimerMs = 0;
    state.gameOverHasInput = false;
    state.itemPoder = null;
    state.powerRollBlock = -1;
    state.dustTimer = 0;
  }

  function resetStreamSpeed() {
    state.streamSpeed.levelIndex = 0;
    state.streamSpeed.silenceMs = 0;
    state.streamSpeed.toastMs = 0;
    state.streamSpeed.toastText = "";
    state.streamSpeed.toastColor = "#8fff9b";
    updateSpeedIndicator();
  }

  function createBackground() {
    state.clouds = Array.from({ length: 8 }, () => ({
      x: rand(0, CONFIG.width),
      y: rand(24, 120),
      w: rand(26, 54),
      h: rand(12, 18),
      speed: rand(0.18, 0.45)
    }));

    state.mountains = Array.from({ length: 7 }, (_, i) => ({
      x: i * 160 + rand(-28, 24),
      y: CONFIG.groundTop - rand(80, 126),
      w: rand(120, 200),
      h: rand(48, 92),
      speed: rand(0.35, 0.85)
    }));

    state.stars = Array.from({ length: 54 }, () => ({
      x: rand(0, CONFIG.width),
      y: rand(12, 170),
      twinkle: rand(0, Math.PI * 2)
    }));
  }

  function getTimeOfDay(score) {
    const cycle = (score / 2400) % 1;
    if (cycle < 0.33) {
      return { phase: "day", t: cycle / 0.33 };
    }
    if (cycle < 0.57) {
      return { phase: "sunset", t: (cycle - 0.33) / 0.24 };
    }
    if (cycle < 0.87) {
      return { phase: "night", t: (cycle - 0.57) / 0.3 };
    }
    return { phase: "dawn", t: (cycle - 0.87) / 0.13 };
  }

  function isNightPhase() {
    return getTimeOfDay(state.score).phase === "night";
  }

  function getSkyColors() {
    const tod = getTimeOfDay(state.score);
    let top = COLORS.day;
    let bottom = [186, 229, 255];

    if (tod.phase === "sunset") {
      top = [
        lerp(COLORS.day[0], COLORS.sunsetA[0], tod.t),
        lerp(COLORS.day[1], COLORS.sunsetA[1], tod.t),
        lerp(COLORS.day[2], COLORS.sunsetA[2], tod.t)
      ];
      bottom = [
        lerp(186, COLORS.sunsetB[0], tod.t),
        lerp(229, COLORS.sunsetB[1], tod.t),
        lerp(255, COLORS.sunsetB[2], tod.t)
      ];
    } else if (tod.phase === "night") {
      top = COLORS.night;
      bottom = [34, 58, 102];
    } else if (tod.phase === "dawn") {
      top = [
        lerp(COLORS.night[0], COLORS.day[0], tod.t),
        lerp(COLORS.night[1], COLORS.day[1], tod.t),
        lerp(COLORS.night[2], COLORS.day[2], tod.t)
      ];
      bottom = [
        lerp(34, 186, tod.t),
        lerp(58, 229, tod.t),
        lerp(102, 255, tod.t)
      ];
    }

    return { top: rgbString(top), bottom: rgbString(bottom), tod };
  }

  return {
    canvas,
    CONFIG,
    COLORS,
    state,
    input,
    updateModeIndicator,
    updateSpeedIndicator,
    disableTrainingMode,
    resetCommonRunState,
    resetStreamSpeed,
    createBackground,
    getSkyColors,
    isNightPhase
  };
}
