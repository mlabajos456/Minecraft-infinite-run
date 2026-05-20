export function bindInput(game, actions) {
  const { state, input, disableAutopilot, resetRun } = game;
  const { tryActivateHerobrine } = actions;

  function onKeyDown(event) {
    const code = event.code;

    if (!state.running) {
      state.gameOverHasInput = true;
    }

    if (code === "Space") {
      event.preventDefault();
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
