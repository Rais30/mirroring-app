import * as api from "../api";
import type { SessionInfo } from "../types";

interface Props {
  sessions: SessionInfo[];
  onError: (msg: string) => void;
  onChanged: () => void;
}

export default function SessionBar({ sessions, onError, onChanged }: Props) {
  if (sessions.length === 0) return null;

  const stop = async (id: string) => {
    try {
      await api.stopSession(id);
      onChanged();
    } catch (e) {
      onError(String(e));
    }
  };

  return (
    <div className="session-bar">
      {sessions.map((s) => (
        <div key={s.id} className="session-chip">
          <span className={`dot ${s.kind}`} />
          <span>
            {s.kind === "record" ? "Merekam" : "Mirror"} · {s.serial}
          </span>
          <button className="chip-stop" onClick={() => stop(s.id)} title="Hentikan">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
