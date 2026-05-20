export function bindInput(game) {
  const { state, input, disableAutopilot, resetRun } = game;

  function onKeyDown(event) {
    const code = event.code;

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
