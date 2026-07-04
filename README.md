# Mirrorring

Aplikasi macOS untuk mirroring HP Android ke MacBook. Dibangun dengan **Tauri 2 + React (TypeScript)** sebagai GUI di atas [scrcpy](https://github.com/Genymobile/scrcpy) dan adb.

## Fitur

- **Mirror USB + kontrol** — lihat layar HP, kendalikan dengan mouse/keyboard Mac (latency rendah via scrcpy)
- **Audio forwarding** — suara HP keluar di speaker Mac (Android 11+)
- **Wireless (WiFi)** — pairing Android 11+ dengan kode, atau tombol "Aktifkan WiFi" dari koneksi USB lalu cabut kabel
- **Rekam layar** — MP4 ke `~/Movies/Mirrorring/`
- **Screenshot** — PNG ke `~/Pictures/Mirrorring/`
- **Pengaturan tersimpan** — bitrate, resolusi maksimal, audio, stay-awake, matikan layar HP saat mirror, always-on-top
- Deteksi device real-time (`adb track-devices`), petunjuk bila device `unauthorized`/offline

## Prasyarat

```bash
brew install scrcpy android-platform-tools
```

Di HP Android:
1. Aktifkan **Developer options** (ketuk 7× "Build number")
2. Aktifkan **USB debugging**
3. Colok USB ke Mac, terima prompt "Allow USB debugging"

## Menjalankan (development)

```bash
npm install
npm run tauri dev
```

Butuh Rust toolchain (`rustup`) dan Node.js 18+.

## Build

```bash
npm run tauri build
```

Hasil:
- `src-tauri/target/release/bundle/macos/Mirrorring.app`
- `src-tauri/target/release/bundle/dmg/Mirrorring_<versi>_aarch64.dmg`

## Cara pakai

| Aksi | Langkah |
|---|---|
| Mirror | Colok HP → kartu device muncul → klik **Mirror** |
| Wireless dari USB | Klik **Aktifkan WiFi** → cabut kabel → device muncul sebagai `ip:5555` |
| Wireless tanpa kabel | **+ Sambungkan via WiFi** → ikuti langkah pairing (Wireless debugging di HP) |
| Rekam | Klik **Rekam** → sesi scrcpy dengan `--record` → **Stop Rekam** menyimpan MP4 |
| Screenshot | Klik **Screenshot** → PNG tersimpan otomatis |

## Arsitektur

```
src/                  React frontend (UI bahasa Indonesia, tema gelap)
  api.ts              typed wrapper invoke() Tauri
  hooks/useDevices.ts event devices-changed + session-ended
  components/         DeviceCard, PairDialog, SettingsPanel, SessionBar
src-tauri/src/
  adb.rs              deteksi device, pairing WiFi, screenshot, tracker
  scrcpy.rs           kelola sesi mirror/record (SIGTERM agar MP4 ter-finalize)
  settings.rs         persist pengaturan (JSON di app config dir)
  lib.rs              registrasi Tauri commands
```

Catatan: app mencari `adb`/`scrcpy` di `/opt/homebrew/bin` dan `/usr/local/bin` (GUI macOS tidak mewarisi PATH shell).
