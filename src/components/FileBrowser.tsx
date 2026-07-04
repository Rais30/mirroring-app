import { useCallback, useEffect, useState } from "react";
import * as api from "../api";
import type { FsEntry } from "../types";

interface Props {
  serial: string;
  onError: (msg: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

export default function FileBrowser({ serial, onError }: Props) {
  const [path, setPath] = useState("/sdcard");
  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [pulling, setPulling] = useState("");
  const [flash, setFlash] = useState("");

  const load = useCallback(
    async (p: string) => {
      setLoading(true);
      try {
        setEntries(await api.fsList(serial, p));
        setPath(p);
      } catch (e) {
        onError(String(e));
      } finally {
        setLoading(false);
      }
    },
    [serial, onError],
  );

  useEffect(() => {
    load("/sdcard");
  }, [load]);

  const up = () => {
    if (path === "/sdcard" || path === "/") return;
    const parent = path.slice(0, path.lastIndexOf("/")) || "/sdcard";
    load(parent);
  };

  const pull = async (name: string) => {
    const remote = `${path}/${name}`;
    setPulling(name);
    try {
      const dest = await api.fsPull(serial, remote);
      setFlash(`Tersimpan: ${dest}`);
      setTimeout(() => setFlash(""), 5000);
    } catch (e) {
      onError(String(e));
    } finally {
      setPulling("");
    }
  };

  return (
    <div className="browser">
      <div className="browser-head">
        <button className="btn" onClick={up} disabled={path === "/sdcard" || loading}>
          ↑ Naik
        </button>
        <span className="browser-path">{path}</span>
        <button className="btn" onClick={() => load(path)} disabled={loading}>
          ⟳
        </button>
      </div>

      {flash && <div className="hint ok">{flash}</div>}

      {loading ? (
        <div className="muted browser-empty">Memuat…</div>
      ) : entries.length === 0 ? (
        <div className="muted browser-empty">Folder kosong.</div>
      ) : (
        <ul className="file-list">
          {entries.map((e) => (
            <li key={e.name} className="file-row">
              {e.isDir ? (
                <button className="file-name dir" onClick={() => load(`${path}/${e.name}`)}>
                  📁 {e.name}
                </button>
              ) : (
                <>
                  <span className="file-name">📄 {e.name}</span>
                  <span className="file-size">{formatSize(e.size)}</span>
                  <button className="btn small" disabled={pulling === e.name}
                    onClick={() => pull(e.name)}>
                    {pulling === e.name ? "Mengambil…" : "⬇ Ambil"}
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
