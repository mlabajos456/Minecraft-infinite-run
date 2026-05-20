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
    if (payload.request === "Hello" || payload.request === "Authenticate") return "";
    if (payload.status === "ok" || payload.status === "error") return "";

    if (payload.event && payload.data) {
      const { event, data } = payload;
      if (event.source === "Command" && event.type === "Triggered") {
        const candidates = [data.command, data.message, data.name];
        for (const value of candidates) {
          if (typeof value === "string" && value.trim()) return value.trim();
        }
      }
    }

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
  const clientOptions = {
    host: "127.0.0.1",
    port: 8080,
    endpoint: "/",
  };
  let client = null;
  let detachClientHandler = null;

  function dispatch(raw) {
    const command = extractCommandFromPayload(raw);
    if (!command) return;
    console.log("[streamBridge] command", command);
    onCommand(command);
  }

  function connect() {
    if (typeof window.StreamerbotClient === "undefined") {
      console.warn("[streamBridge] StreamerbotClient not found.");
      return;
    }

    console.log("[streamBridge] connecting", clientOptions);
    client = new window.StreamerbotClient(clientOptions);
    const handler = ({ event, data }) => {
      console.log("[streamBridge] event", event);
      dispatch({ event, data });
    };

    if (typeof client.on === "function") {
      client.on("Command.Triggered", handler);
      detachClientHandler = () => {
        if (typeof client.off === "function") {
          client.off("Command.Triggered", handler);
        }
      };
    }
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

    if (detachClientHandler) detachClientHandler();

    if (client) {
      try {
        if (typeof client.disconnect === "function") {
          client.disconnect();
        } else if (typeof client.close === "function") {
          client.close();
        }
      } catch {
        // no-op
      }
    }
  };
}
