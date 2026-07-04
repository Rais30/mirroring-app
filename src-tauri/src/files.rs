use crate::adb;
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FsEntry {
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PushResult {
    pub file: String,
    pub ok: bool,
    pub message: String,
}

fn adb_cmd() -> Result<Command, String> {
    Ok(Command::new(adb::find_bin("adb")?))
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

/// Single-quote a path for the on-device shell (`adb shell` runs through sh).
fn shell_quote(path: &str) -> String {
    format!("'{}'", path.replace('\'', r"'\''"))
}

pub fn list(serial: &str, path: &str) -> Result<Vec<FsEntry>, String> {
    let out = run({
        let mut c = adb_cmd()?;
        c.args(["-s", serial, "shell", "ls", "-lA"]);
        c.arg(shell_quote(path));
        c
    })?;

    // toybox ls -lA:
    // -rw-rw---- 1 u0_a123 media_rw   12345 2026-07-01 10:00 laporan.pdf
    // drwxrwx--x 2 root    everybody   3452 2026-06-30 09:12 Download
    // lrw-r--r-- 1 root    root          21 2009-01-01 07:00 sdcard -> /storage/self/primary
    let mut entries = Vec::new();
    for line in out.lines() {
        let line = line.trim_end();
        if line.is_empty() || line.starts_with("total ") {
            continue;
        }
        let mode = match line.split_whitespace().next() {
            Some(m) if m.len() >= 10 => m,
            _ => continue,
        };
        let kind = mode.chars().next().unwrap_or('-');
        let cols: Vec<&str> = line.split_whitespace().collect();
        if cols.len() < 8 {
            continue;
        }
        let size: u64 = cols[4].parse().unwrap_or(0);
        // Name = everything after the time column (index 7+), keeps spaces.
        let time_col = cols[6];
        let name_start = line.find(time_col).map(|i| i + time_col.len()).unwrap_or(0);
        let mut name = line[name_start..].trim().to_string();
        if kind == 'l' {
            if let Some(idx) = name.find(" -> ") {
                name.truncate(idx);
            }
        }
        if name.is_empty() || name == "." || name == ".." {
            continue;
        }
        entries.push(FsEntry {
            name,
            // Symlinks on /sdcard-style paths are almost always directories.
            is_dir: kind == 'd' || kind == 'l',
            size,
        });
    }

    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(entries)
}

pub fn push(serial: &str, local_paths: Vec<String>, remote_dir: &str) -> Vec<PushResult> {
    local_paths
        .into_iter()
        .map(|local| {
            let file = Path::new(&local)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| local.clone());
            let res = adb_cmd().and_then(|mut c| {
                c.args(["-s", serial, "push", &local]);
                c.arg(format!("{}/", remote_dir.trim_end_matches('/')));
                run(c)
            });
            match res {
                Ok(_) => PushResult {
                    file,
                    ok: true,
                    message: String::new(),
                },
                Err(e) => PushResult {
                    file,
                    ok: false,
                    message: e.trim().to_string(),
                },
            }
        })
        .collect()
}

pub fn pull(serial: &str, remote_path: &str) -> Result<String, String> {
    let home = std::env::var("HOME").map_err(|e| e.to_string())?;
    let downloads = PathBuf::from(home).join("Downloads");
    std::fs::create_dir_all(&downloads).map_err(|e| e.to_string())?;

    let base = Path::new(remote_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .ok_or("Path tidak valid.")?;

    // Avoid clobbering an existing download: name.ext, name-1.ext, name-2.ext…
    let mut dest = downloads.join(&base);
    let stem = Path::new(&base)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| base.clone());
    let ext = Path::new(&base)
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();
    let mut n = 1;
    while dest.exists() {
        dest = downloads.join(format!("{stem}-{n}{ext}"));
        n += 1;
    }

    run({
        let mut c = adb_cmd()?;
        c.args(["-s", serial, "pull", remote_path]);
        c.arg(&dest);
        c
    })?;
    Ok(dest.to_string_lossy().to_string())
}
