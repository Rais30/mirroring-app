import { useState } from "react";
import DeviceCard from "./components/DeviceCard";
import PairDialog from "./components/PairDialog";
import SessionBar from "./components/SessionBar";
import SettingsPanel from "./components/SettingsPanel";
import { useDevices } from "./hooks/useDevices";
import "./App.css";

export default function App() {
  const { devices, sessions, error, setError, refresh } = useDevices();
  const [showPair, setShowPair] = useState(false);
  const [tab, setTab] = useState<"devices" | "settings">("devices");

  return (
    <main className="app">
      <header className="topbar">
        <h1>Mirrorring</h1>
        <nav className="tabs">
          <button className={tab === "devices" ? "tab active" : "tab"}
            onClick={() => setTab("devices")}>
            Perangkat
          </button>
          <button className={tab === "settings" ? "tab active" : "tab"}
            onClick={() => setTab("settings")}>
            Pengaturan
          </button>
        </nav>
      </header>

      <SessionBar sessions={sessions} onError={setError} onChanged={refresh} />

      {error && (
        <div className="error-bar">
          <span>{error}</span>
          <button onClick={() => setError("")}>✕</button>
        </div>
      )}

      {tab === "devices" ? (
        <section className="content">
          <div className="content-head">
            <h2>Perangkat Android</h2>
            <button className="btn" onClick={() => setShowPair(true)}>
              + Sambungkan via WiFi
            </button>
          </div>

          {devices.length === 0 ? (
            <div className="empty">
              <p><b>Tidak ada perangkat terdeteksi.</b></p>
              <ol>
                <li>Aktifkan <b>Developer options</b> di HP (ketuk 7× "Build number").</li>
                <li>Aktifkan <b>USB debugging</b>.</li>
                <li>Colok kabel USB ke Mac, lalu terima prompt di HP.</li>
              </ol>
              <p className="muted">Atau sambungkan tanpa kabel lewat tombol "Sambungkan via WiFi".</p>
            </div>
          ) : (
            <div className="grid">
              {devices.map((d) => (
                <DeviceCard key={d.serial} device={d} sessions={sessions}
                  onError={setError} onChanged={refresh} />
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="content">
          <SettingsPanel onError={setError} />
        </section>
      )}

      {showPair && (
        <PairDialog onClose={() => setShowPair(false)} onError={setError} onChanged={refresh} />
      )}
    </main>
  );
}
