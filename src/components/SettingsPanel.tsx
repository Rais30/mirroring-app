import { useEffect, useState } from "react";
import * as api from "../api";
import type { Settings } from "../types";

interface Props {
  onError: (msg: string) => void;
}

export default function SettingsPanel({ onError }: Props) {
  const [s, setS] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getSettings().then(setS).catch((e) => onError(String(e)));
  }, [onError]);

  if (!s) return null;

  const update = async (patch: Partial<Settings>) => {
    const next = { ...s, ...patch };
    setS(next);
    try {
      await api.saveSettings(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      onError(String(e));
    }
  };

  return (
    <div className="settings">
      <h2>Pengaturan {saved && <span className="saved">✓ tersimpan</span>}</h2>

      <label className="field">
        <span>Bitrate video</span>
        <select value={s.videoBitRateMbps}
          onChange={(e) => update({ videoBitRateMbps: Number(e.target.value) })}>
          {[2, 4, 8, 12, 16, 24].map((v) => (
            <option key={v} value={v}>{v} Mbps</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Resolusi maksimal</span>
        <select value={s.maxSize}
          onChange={(e) => update({ maxSize: Number(e.target.value) })}>
          <option value={0}>Asli (tanpa batas)</option>
          <option value={2560}>2560 px</option>
          <option value={1920}>1920 px</option>
          <option value={1280}>1280 px</option>
          <option value={1024}>1024 px</option>
        </select>
      </label>

      <label className="field check">
        <input type="checkbox" checked={s.audio}
          onChange={(e) => update({ audio: e.target.checked })} />
        <span>Audio ke Mac (Android 11+)</span>
      </label>

      <label className="field check">
        <input type="checkbox" checked={s.stayAwake}
          onChange={(e) => update({ stayAwake: e.target.checked })} />
        <span>HP tetap menyala selama mirror</span>
      </label>

      <label className="field check">
        <input type="checkbox" checked={s.turnScreenOff}
          onChange={(e) => update({ turnScreenOff: e.target.checked })} />
        <span>Matikan layar HP saat mirror</span>
      </label>

      <label className="field check">
        <input type="checkbox" checked={s.alwaysOnTop}
          onChange={(e) => update({ alwaysOnTop: e.target.checked })} />
        <span>Jendela mirror selalu di depan</span>
      </label>
    </div>
  );
}
