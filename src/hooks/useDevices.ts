import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { listDevices, listSessions } from "../api";
import type { Device, SessionEnded, SessionInfo } from "../types";

export function useDevices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [error, setError] = useState<string>("");

  const refresh = useCallback(async () => {
    try {
      const [d, s] = await Promise.all([listDevices(), listSessions()]);
      setDevices(d);
      setSessions(s);
      setError("");
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    refresh();
    const unDevices = listen("devices-changed", refresh);
    const unSession = listen<SessionEnded>("session-ended", (ev) => {
      refresh();
      if (!ev.payload.ok && ev.payload.error) {
        setError(`Sesi berakhir dengan error: ${ev.payload.error}`);
      }
    });
    // Safety net in case track-devices misses an event.
    const timer = setInterval(refresh, 5000);
    return () => {
      unDevices.then((f) => f());
      unSession.then((f) => f());
      clearInterval(timer);
    };
  }, [refresh]);

  return { devices, sessions, error, setError, refresh };
}
