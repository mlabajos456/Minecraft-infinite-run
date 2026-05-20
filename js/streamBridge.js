function extractCommandFromPayload(payload) {
  if (payload == null) return "";

  if (typeof payload === "string") {
    const raw = payload.trim();
    if (!raw) return "";

    try {
      const parsed = JSON.parse(raw);
      return extractCommandFromPayload(parsed);
    } catch {
      return raw;
    }
  }

  if (typeof payload === "object") {
    const directKeys = ["comando", "command", "cmd", "message", "text"];
    for (const key of directKeys) {
      if (typeof payload[key] === "string") {
        return payload[key].trim();
      }
    }

    if (payload.data !== undefined) {
      return extractCommandFromPayload(payload.data);
    }
  }

  return "";
}

export function setupStreamBridge({ onCommand }) {
  const wsUrls = ["ws://127.0.0.1:8080", "ws://localhost:8080"];
  let ws = null;
  let retryTimer = null;
  let wsIndex = 0;

  function dispatch(raw) {
    const command = extractCommandFromPayload(raw);
    if (!command) return;
    onCommand(command);
  }

  function scheduleReconnect() {
    if (retryTimer !== null) return;
    retryTimer = window.setTimeout(() => {
      retryTimer = null;
      connect();
    }, 3000);
  }

  function connect() {
    if (typeof WebSocket === "undefined") return;

    const url = wsUrls[wsIndex % wsUrls.length];
    wsIndex += 1;

    try {
      ws = new WebSocket(url);
    } catch {
      scheduleReconnect();
      return;
    }

    ws.onmessage = (event) => {
      dispatch(event.data);
    };

    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        // no-op
      }
    };

    ws.onclose = () => {
      scheduleReconnect();
    };
  }

  function onStorage(event) {
    if (!event.key) return;
    if (event.key !== "streamerbot_command" && event.key !== "stream.command") return;
    dispatch(event.newValue);
  }

  function onCustomEvent(event) {
    dispatch(event.detail);
  }

  window.addEventListener("storage", onStorage);
  window.addEventListener("stream-command", onCustomEvent);
  connect();

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("stream-command", onCustomEvent);

    if (retryTimer !== null) {
      window.clearTimeout(retryTimer);
      retryTimer = null;
    }

    if (ws) {
      try {
        ws.close();
      } catch {
        // no-op
      }
    }
  };
}
