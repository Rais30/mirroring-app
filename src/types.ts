export interface Device {
  serial: string;
  state: string; // "device" | "unauthorized" | "offline" | ...
  model: string;
  transport: "usb" | "tcpip";
}

export interface SessionInfo {
  id: string;
  serial: string;
  kind: "mirror" | "record";
  recordPath: string | null;
}

export interface Settings {
  videoBitRateMbps: number;
  maxSize: number; // 0 = resolusi asli
  audio: boolean;
  stayAwake: boolean;
  turnScreenOff: boolean;
  alwaysOnTop: boolean;
}

export interface SessionEnded {
  id: string;
  ok: boolean;
  error: string;
}
