use serde::Serialize;
use std::path::PathBuf;
use std::process::Command;
use tauri::{AppHandle, Emitter};

/// GUI apps on macOS don't inherit the shell PATH, so probe the common
/// Homebrew locations before falling back to `which`.
const BIN_DIRS: &[&str] = &["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"];

pub fn find_bin(name: &str) -> Result<PathBuf, String> {
    for dir in BIN_DIRS {
        let p = PathBuf::from(dir).join(name);
        if p.is_file() {
            return Ok(p);
        }
    }
    let out = Command::new("which")
        .arg(name)
        .output()
        .map_err(|e| e.to_string())?;
    if out.status.success() {
        let path = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if !path.is_empty() {
            return Ok(PathBuf::from(path));
        }
    }
    Err(format!(
        "'{name}' tidak ditemukan. Install dengan: brew install {name}"
    ))
}

fn adb() -> Result<Command, String> {
    Ok(Command::new(find_bin("adb")?))
}

fn run(mut cmd: Command) -> Result<String, String> {
    let out = cmd.output().map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
    let stderr = String::from_utf8_lossy(&out.stderr).to_string();
    if out.status.success() {
        Ok(stdout)
    } else {
        Err(if stderr.trim().is_empty() { stdout } else { stderr })
    }
}

#[derive(Serialize, Clone, Debug)]
pub struct Device {
    pub serial: String,
    pub state: String,
    pub model: String,
    pub transport: String, // "usb" | "tcpip"
}

pub fn list_devices() -> Result<Vec<Device>, String> {
    let out = run({
        let mut c = adb()?;
        c.args(["devices", "-l"]);
        c
    })?;

    let mut devices = Vec::new();
    for line in out.lines().skip(1) {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let mut parts = line.split_whitespace();
        let serial = match parts.next() {
            Some(s) => s.to_string(),
            None => continue,
        };
        let state = parts.next().unwrap_or("unknown").to_string();
        let rest: Vec<&str> = parts.collect();
        let model = rest
            .iter()
            .find_map(|p| p.strip_prefix("model:"))
            .unwrap_or("")
            .replace('_', " ");
        let transport = if serial.contains(':') { "tcpip" } else { "usb" };
        devices.push(Device {
            serial,
            state,
            model,
            transport: transport.to_string(),
        });
    }
    Ok(devices)
}

pub fn pair(host_port: &str, code: &str) -> Result<String, String> {
    run({
        let mut c = adb()?;
        c.args(["pair", host_port, code]);
        c
    })
}

pub fn connect(host_port: &str) -> Result<String, String> {
    let out = run({
        let mut c = adb()?;
        c.args(["connect", host_port]);
        c
    })?;
    // `adb connect` exits 0 even on failure; inspect the message.
    if out.contains("failed") || out.contains("cannot") {
        Err(out)
    } else {
        Ok(out)
    }
}

pub fn disconnect(serial: &str) -> Result<String, String> {
    run({
        let mut c = adb()?;
        c.args(["disconnect", serial]);
        c
    })
}

/// Switch a USB device to TCP/IP mode and connect to it over WiFi.
pub fn enable_wireless(serial: &str) -> Result<String, String> {
    run({
        let mut c = adb()?;
        c.args(["-s", serial, "tcpip", "5555"]);
        c
    })?;
    std::thread::sleep(std::time::Duration::from_millis(1500));

    let route = run({
        let mut c = adb()?;
        c.args(["-s", serial, "shell", "ip", "route"]);
        c
    })?;
    // "192.168.1.0/24 dev wlan0 proto kernel scope link src 192.168.1.42"
    let ip = route
        .lines()
        .find(|l| l.contains("wlan"))
        .and_then(|l| {
            let mut it = l.split_whitespace();
            while let Some(tok) = it.next() {
                if tok == "src" {
                    return it.next();
                }
            }
            None
        })
        .ok_or("IP WiFi HP tidak ditemukan. Pastikan HP terhubung ke WiFi.")?;

    connect(&format!("{ip}:5555"))
}

pub fn screenshot(serial: &str) -> Result<String, String> {
    let home = std::env::var("HOME").map_err(|e| e.to_string())?;
    let dir = PathBuf::from(home).join("Pictures").join("Mirrorring");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let ts = chrono_timestamp();
    let path = dir.join(format!("screenshot-{ts}.png"));

    let out = adb()?
        .args(["-s", serial, "exec-out", "screencap", "-p"])
        .output()
        .map_err(|e| e.to_string())?;
    if !out.status.success() || out.stdout.is_empty() {
        return Err(String::from_utf8_lossy(&out.stderr).to_string());
    }
    std::fs::write(&path, &out.stdout).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

pub fn chrono_timestamp() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    // Local-enough unique name without pulling in chrono.
    format!("{now}")
}

/// Long-lived `adb track-devices` process; any output means the device list
/// changed, so notify the frontend to re-query.
pub fn spawn_tracker(app: AppHandle) {
    std::thread::spawn(move || loop {
        let Ok(bin) = find_bin("adb") else {
            std::thread::sleep(std::time::Duration::from_secs(5));
            continue;
        };
        let child = Command::new(&bin)
            .arg("track-devices")
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::null())
            .spawn();
        let Ok(mut child) = child else {
            std::thread::sleep(std::time::Duration::from_secs(5));
            continue;
        };
        if let Some(stdout) = child.stdout.take() {
            use std::io::Read;
            let mut reader = std::io::BufReader::new(stdout);
            let mut buf = [0u8; 1024];
            while let Ok(n) = reader.read(&mut buf) {
                if n == 0 {
                    break;
                }
                let _ = app.emit("devices-changed", ());
            }
        }
        let _ = child.wait();
        // adb server died; retry after a pause.
        std::thread::sleep(std::time::Duration::from_secs(3));
    });
}
