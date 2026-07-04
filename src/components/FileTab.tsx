import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import * as api from "../api";
import type { Device } from "../types";
import FileBrowser from "./FileBrowser";

const REMOTE_DIR = "/sdcard/Download";

interface Props {
  devices: Device[];
  onError: (msg: string) => void;
}

export default function FileTab({ devices, onError }: Props) {
  const ready = devices.filter((d) => d.state === "device");
  const [serial, setSerial] = useState("");
  const [sending, setSending] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [flash, setFlash] = useState("");

  const active = ready.find((d) => d.serial === serial) ?? ready[0];

  useEffect(() => {
    if (active && active.serial !== serial) setSerial(active.serial);
  }, [active, serial]);

  const send = async (paths: string[]) => {
    if (!active || paths.length === 0) return;
    setSending(true);
    try {
      const results = await api.fsPush(active.serial, paths, REMOTE_DIR);
      const ok = results.filter((r) => r.ok).length;
      const failed = results.filter((r) => !r.ok);
      let msg = `${ok} file terkirim ke Download HP.`;
      if (failed.length > 0) {
        msg += ` Gagal: ${failed.map((f) => `${f.file} (${f.message})`).join(", ")}`;
        onError(msg);
      } else {
        setFlash(msg);
        setTimeout(() => setFlash(""), 5000);
      }
    } catch (e) {
      onError(String(e));
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!active) return;
    const un = getCurrentWebview().onDragDropEvent((ev) => {
      if (ev.payload.type === "over") setDragOver(true);
      else if (ev.payload.type === "leave") setDragOver(false);
      else if (ev.payload.type === "drop") {
        setDragOver(false);
        send(ev.payload.paths);
      }
    });
    return () => {
      un.then((f) => f());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.serial]);

  const pick = async () => {
    const picked = await open({ multiple: true, title: "Pilih file untuk dikirim ke HP" });
    if (picked) send(Array.isArray(picked) ? picked : [picked]);
  };

  if (ready.length === 0) {
    return (
      <div className="empty">
        <p><b>Tidak ada perangkat siap.</b></p>
        <p className="muted">
          Colok HP (atau sambungkan via WiFi) dulu untuk transfer file.
        </p>
      </div>
    );
  }

  return (
    <div className="file-tab">
      <div className="file-toolbar">
        {ready.length > 1 && (
          <select value={active?.serial ?? ""} onChange={(e) => setSerial(e.target.value)}>
            {ready.map((d) => (
              <option key={d.serial} value={d.serial}>
                {d.model || d.serial}
              </option>
            ))}
          </select>
        )}
        <button className="btn primary" onClick={pick} disabled={sending}>
          {sending ? "Mengirim…" : "⬆ Kirim File ke HP"}
        </button>
        <span className="muted">tujuan: {REMOTE_DIR}</span>
      </div>

      <div className={dragOver ? "dropzone over" : "dropzone"}>
        {dragOver
          ? "Lepaskan untuk mengirim ke HP"
          : "…atau tarik & lepas file ke sini"}
      </div>

      {flash && <div className="hint ok">{flash}</div>}

      {active && <FileBrowser serial={active.serial} onError={onError} />}
    </div>
  );
}
