import { useState } from "react";
import * as api from "../api";

interface Props {
  onClose: () => void;
  onError: (msg: string) => void;
  onChanged: () => void;
}

export default function PairDialog({ onClose, onError, onChanged }: Props) {
  const [pairAddr, setPairAddr] = useState("");
  const [code, setCode] = useState("");
  const [connectAddr, setConnectAddr] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const doPair = async () => {
    setBusy(true);
    try {
      const out = await api.pairWireless(pairAddr.trim(), code.trim());
      setMsg(out.trim() || "Pairing berhasil. Lanjut ke langkah 2.");
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const doConnect = async () => {
    setBusy(true);
    try {
      const out = await api.connectWireless(connectAddr.trim());
      setMsg(out.trim());
      onChanged();
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Sambungkan Device WiFi</h2>
        <p className="muted">
          Di HP: <b>Settings → Developer options → Wireless debugging</b>.
          Aktifkan, lalu pilih <b>Pair device with pairing code</b>.
        </p>

        <h3>1. Pairing (sekali saja per Mac)</h3>
        <div className="row">
          <input placeholder="IP:port pairing (mis. 192.168.1.42:37831)"
            value={pairAddr} onChange={(e) => setPairAddr(e.target.value)} />
          <input placeholder="Kode (6 digit)" className="short"
            value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn primary" disabled={busy || !pairAddr || !code} onClick={doPair}>
            Pair
          </button>
        </div>

        <h3>2. Connect</h3>
        <p className="muted">
          Gunakan IP:port dari layar utama Wireless debugging (port berbeda dari pairing).
        </p>
        <div className="row">
          <input placeholder="IP:port (mis. 192.168.1.42:40217)"
            value={connectAddr} onChange={(e) => setConnectAddr(e.target.value)} />
          <button className="btn primary" disabled={busy || !connectAddr} onClick={doConnect}>
            Connect
          </button>
        </div>

        {msg && <div className="hint ok">{msg}</div>}

        <div className="dialog-foot">
          <button className="btn" onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>
  );
}
