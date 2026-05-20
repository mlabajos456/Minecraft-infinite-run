import { rand, lerp, rgbString } from "./utils.js";

export function createGameContext({ canvas, modePill, CONFIG, COLORS }) {
  const state = {
    running: true,
    autopilot: true,
    score: 0,
    highScore: Number(localStorage.getItem(CONFIG.highScoreKey) || 0),
    speed: CONFIG.baseSpeed,
    lastTimestamp: 0,
    obstacleTimer: 0,
    obstacleInterval: 72,
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
    gameOverTimerMs: 0,
    gameOverHasInput: false,
    itemPoder: null,
    powerRollBlock: -1
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

  function updateModeIndicator() {
    if (state.autopilot) {
      modePill.textContent = "🤖 IA AUTOPILOTO";
      modePill.classList.remove("manual");
      modePill.style.color = "#93ffb8";
      return;
    }

    modePill.textContent = "🎮 MANUAL";
    modePill.classList.add("manual");
    modePill.style.color = "#ff9f9f";
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

    player.y = CONFIG.groundTop - player.heightStanding;
    player.height = player.heightStanding;
    player.vy = 0;
    player.onGround = true;
    player.runFrame = 0;
    player.runFrameTimer = 0;
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
    return getTimeOfDay(state.score).phase === "night";
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

  return {
    canvas,
    CONFIG,
    COLORS,
    state,
    player,
    input,
    updateModeIndicator,
    disableAutopilot,
    resetRun,
    createBackground,
    getSkyColors,
    isNightPhase
  };
}
