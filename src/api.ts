import { invoke } from "@tauri-apps/api/core";
import type { Device, SessionInfo, Settings } from "./types";

export const listDevices = () => invoke<Device[]>("list_devices");

export const pairWireless = (hostPort: string, code: string) =>
  invoke<string>("pair_wireless", { hostPort, code });

export const connectWireless = (hostPort: string) =>
  invoke<string>("connect_wireless", { hostPort });

export const disconnectWireless = (serial: string) =>
  invoke<string>("disconnect_wireless", { serial });

export const enableWireless = (serial: string) =>
  invoke<string>("enable_wireless", { serial });

export const takeScreenshot = (serial: string) =>
  invoke<string>("take_screenshot", { serial });

export const startMirror = (serial: string, title: string, record: boolean) =>
  invoke<SessionInfo>("start_mirror", { serial, title, record });

export const stopSession = (id: string) => invoke<void>("stop_session", { id });

export const listSessions = () => invoke<SessionInfo[]>("list_sessions");

export const getSettings = () => invoke<Settings>("get_settings");

export const saveSettings = (settings: Settings) =>
  invoke<void>("save_settings", { settings });
