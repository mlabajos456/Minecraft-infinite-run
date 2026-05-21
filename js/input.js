export function bindInput(game, actions) {
  const { state, input, disableTrainingMode } = game;
  const { switchToManual, resetManualRun, tryActivateHerobrine } = actions;

  function forceManualMode() {
    if (!state.aiTraining) return;
    disableTrainingMode();
    switchToManual();
  }

  function onKeyDown(event) {
    const code = event.code;

    if (!state.running) {
      state.gameOverHasInput = true;
    }

    if (code === "Space") {
      event.preventDefault();
      if (!state.running && !state.aiTraining) {
        resetManualRun();
        return;
      }
      forceManualMode();
      input.jumpPressed = true;
      return;
    }

    if (code === "ArrowUp" || code === "KeyW") {
      forceManualMode();
      input.jumpPressed = true;
      return;
    }

    if (code === "ArrowDown" || code === "KeyS") {
      forceManualMode();
      input.duckHeld = true;
      return;
    }

    if (code === "ArrowLeft" || code === "ArrowRight") {
      forceManualMode();
      return;
    }

    if (code === "KeyH") {
      tryActivateHerobrine();
    }
  }

  function onKeyUp(event) {
    const code = event.code;

    if (code === "Space" || code === "ArrowUp" || code === "KeyW") {
      input.jumpPressed = false;
    }

    if (code === "ArrowDown" || code === "KeyS") {
      input.duckHeld = false;
    }
  }

  window.addEventListener("keydown", onKeyDown, { passive: false });
  window.addEventListener("keyup", onKeyUp);
}
