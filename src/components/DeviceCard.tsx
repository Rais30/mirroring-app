import { useState } from "react";
import * as api from "../api";
import type { Device, SessionInfo } from "../types";

interface Props {
  device: Device;
  sessions: SessionInfo[];
  onError: (msg: string) => void;
  onChanged: () => void;
}

export default function DeviceCard({ device, sessions, onError, onChanged }: Props) {
  const [busy, setBusy] = useState<string>("");
  const [flash, setFlash] = useState<string>("");

  const mirror = sessions.find((s) => s.serial === device.serial && s.kind === "mirror");
  const record = sessions.find((s) => s.serial === device.serial && s.kind === "record");
  const ready = device.state === "device";
  const name = device.model || device.serial;

  const run = async (label: string, fn: () => Promise<unknown>, doneMsg?: string) => {
    setBusy(label);
    try {
      await fn();
      if (doneMsg) {
        setFlash(doneMsg);
        setTimeout(() => setFlash(""), 4000);
      }
      onChanged();
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="device-name">{name}</div>
          <div className="device-serial">{device.serial}</div>
        </div>
        <span className={`badge ${device.transport}`}>
          {device.transport === "usb" ? "USB" : "WiFi"}
        </span>
      </div>

      {device.state === "unauthorized" && (
        <div className="hint warn">
          Terima prompt "Allow USB debugging" di layar HP, lalu tunggu sebentar.
        </div>
      )}
      {device.state === "offline" && (
        <div className="hint warn">Device offline. Cabut-colok kabel atau reconnect WiFi.</div>
      )}
      {flash && <div className="hint ok">{flash}</div>}

      <div className="card-actions">
        {mirror ? (
          <button className="btn danger" disabled={!!busy}
            onClick={() => run("mirror", () => api.stopSession(mirror.id))}>
            Stop Mirror
          </button>
        ) : (
          <button className="btn primary" disabled={!ready || !!busy}
            onClick={() => run("mirror", () => api.startMirror(device.serial, name, false))}>
            {busy === "mirror" ? "Memulai…" : "Mirror"}
          </button>
        )}

        {record ? (
          <button className="btn danger" disabled={!!busy}
            onClick={() =>
              run("record", () => api.stopSession(record.id),
                record.recordPath ? `Rekaman disimpan: ${record.recordPath}` : undefined)
            }>
            ⏺ Stop Rekam
          </button>
        ) : (
          <button className="btn" disabled={!ready || !!busy}
            onClick={() => run("record", () => api.startMirror(device.serial, `${name} (rekam)`, true))}>
            {busy === "record" ? "Memulai…" : "Rekam"}
          </button>
        )}

        <button className="btn" disabled={!ready || !!busy}
          onClick={() =>
            run("shot", async () => {
              const path = await api.takeScreenshot(device.serial);
              setFlash(`Screenshot disimpan: ${path}`);
              setTimeout(() => setFlash(""), 4000);
            })
          }>
          {busy === "shot" ? "…" : "Screenshot"}
        </button>

        {device.transport === "usb" && ready && (
          <button className="btn" disabled={!!busy}
            onClick={() =>
              run("wifi", () => api.enableWireless(device.serial),
                "Mode WiFi aktif — kabel USB boleh dicabut.")
            }>
            {busy === "wifi" ? "Mengaktifkan…" : "Aktifkan WiFi"}
          </button>
        )}

        {device.transport === "tcpip" && (
          <button className="btn" disabled={!!busy}
            onClick={() => run("disc", () => api.disconnectWireless(device.serial))}>
            Putuskan
          </button>
        )}
      </div>
    </div>
  );
}
