use crate::{adb, settings::Settings};
use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub id: String,
    pub serial: String,
    pub kind: String, // "mirror" | "record"
    pub record_path: Option<String>,
}

struct Session {
    info: SessionInfo,
    pid: u32,
}

#[derive(Default)]
pub struct Sessions(Mutex<HashMap<String, Session>>);

pub fn list(sessions: &Sessions) -> Vec<SessionInfo> {
    sessions
        .0
        .lock()
        .unwrap()
        .values()
        .map(|s| s.info.clone())
        .collect()
}

pub fn start(
    app: AppHandle,
    sessions: &Sessions,
    serial: String,
    title: String,
    settings: Settings,
    record: bool,
) -> Result<SessionInfo, String> {
    let kind = if record { "record" } else { "mirror" };
    let id = format!("{serial}:{kind}");
    if sessions.0.lock().unwrap().contains_key(&id) {
        return Err(format!("Sesi {kind} untuk device ini sudah berjalan."));
    }

    let scrcpy_bin = adb::find_bin("scrcpy")?;
    let adb_bin = adb::find_bin("adb")?;

    let mut cmd = Command::new(&scrcpy_bin);
    // scrcpy locates adb via $ADB; a GUI app's PATH won't include Homebrew.
    cmd.env("ADB", &adb_bin);
    cmd.args(["-s", &serial]);
    cmd.args([
        "--video-bit-rate",
        &format!("{}M", settings.video_bit_rate_mbps),
    ]);
    if settings.max_size > 0 {
        cmd.args(["--max-size", &settings.max_size.to_string()]);
    }
    if !settings.audio {
        cmd.arg("--no-audio");
    }
    if settings.stay_awake {
        cmd.arg("--stay-awake");
    }
    if settings.turn_screen_off {
        cmd.arg("--turn-screen-off");
    }
    if settings.always_on_top {
        cmd.arg("--always-on-top");
    }
    let window_title = if title.is_empty() { serial.clone() } else { title };
    cmd.args(["--window-title", &window_title]);

    let mut record_path = None;
    if record {
        let home = std::env::var("HOME").map_err(|e| e.to_string())?;
        let dir = PathBuf::from(home).join("Movies").join("Mirrorring");
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let path = dir.join(format!("rec-{}.mp4", adb::chrono_timestamp()));
        cmd.args(["--record", &path.to_string_lossy()]);
        record_path = Some(path.to_string_lossy().to_string());
    }

    cmd.stdout(std::process::Stdio::null());
    cmd.stderr(std::process::Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("Gagal menjalankan scrcpy: {e}"))?;
    let pid = child.id();
    let stderr = child.stderr.take();

    let info = SessionInfo {
        id: id.clone(),
        serial: serial.clone(),
        kind: kind.to_string(),
        record_path,
    };
    sessions.0.lock().unwrap().insert(
        id.clone(),
        Session {
            info: info.clone(),
            pid,
        },
    );

    // Monitor thread: reap the child, surface its last stderr lines on
    // abnormal exit, and tell the frontend the session ended.
    let app2 = app.clone();
    let id2 = id.clone();
    std::thread::spawn(move || {
        let mut err_tail = String::new();
        if let Some(stderr) = stderr {
            use std::io::BufRead;
            for line in std::io::BufReader::new(stderr).lines().map_while(Result::ok) {
                err_tail = line; // keep last line only
            }
        }
        let status = child.wait();
        let ok = status.map(|s| s.success()).unwrap_or(false);
        if let Some(state) = app2.try_state::<Sessions>() {
            state.0.lock().unwrap().remove(&id2);
        }
        let _ = app2.emit(
            "session-ended",
            serde_json::json!({
                "id": id2,
                "ok": ok,
                "error": if ok { String::new() } else { err_tail },
            }),
        );
    });

    Ok(info)
}

pub fn stop(sessions: &Sessions, id: &str) -> Result<(), String> {
    let pid = {
        let map = sessions.0.lock().unwrap();
        map.get(id).map(|s| s.pid)
    }
    .ok_or("Sesi tidak ditemukan.")?;

    // SIGTERM (not SIGKILL) so scrcpy finalizes the MP4 when recording.
    let status = Command::new("kill")
        .args(["-TERM", &pid.to_string()])
        .status()
        .map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err("Gagal menghentikan sesi.".into())
    }
}
