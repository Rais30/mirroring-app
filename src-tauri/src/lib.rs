mod adb;
mod files;
mod scrcpy;
mod settings;

use scrcpy::Sessions;
use tauri::{AppHandle, State};

#[tauri::command]
fn list_devices() -> Result<Vec<adb::Device>, String> {
    adb::list_devices()
}

#[tauri::command]
fn pair_wireless(host_port: String, code: String) -> Result<String, String> {
    adb::pair(&host_port, &code)
}

#[tauri::command]
fn connect_wireless(host_port: String) -> Result<String, String> {
    adb::connect(&host_port)
}

#[tauri::command]
fn disconnect_wireless(serial: String) -> Result<String, String> {
    adb::disconnect(&serial)
}

#[tauri::command]
fn enable_wireless(serial: String) -> Result<String, String> {
    adb::enable_wireless(&serial)
}

#[tauri::command]
fn take_screenshot(serial: String) -> Result<String, String> {
    adb::screenshot(&serial)
}

#[tauri::command]
fn start_mirror(
    app: AppHandle,
    sessions: State<Sessions>,
    serial: String,
    title: String,
    record: bool,
) -> Result<scrcpy::SessionInfo, String> {
    let s = settings::load(&app);
    scrcpy::start(app.clone(), &sessions, serial, title, s, record)
}

#[tauri::command]
fn stop_session(sessions: State<Sessions>, id: String) -> Result<(), String> {
    scrcpy::stop(&sessions, &id)
}

#[tauri::command]
fn list_sessions(sessions: State<Sessions>) -> Vec<scrcpy::SessionInfo> {
    scrcpy::list(&sessions)
}

#[tauri::command]
fn get_settings(app: AppHandle) -> settings::Settings {
    settings::load(&app)
}

#[tauri::command]
fn save_settings(app: AppHandle, settings: settings::Settings) -> Result<(), String> {
    settings::save(&app, &settings)
}

#[tauri::command]
fn fs_list(serial: String, path: String) -> Result<Vec<files::FsEntry>, String> {
    files::list(&serial, &path)
}

#[tauri::command]
fn fs_push(
    serial: String,
    local_paths: Vec<String>,
    remote_dir: String,
) -> Vec<files::PushResult> {
    files::push(&serial, local_paths, &remote_dir)
}

#[tauri::command]
fn fs_pull(serial: String, remote_path: String) -> Result<String, String> {
    files::pull(&serial, &remote_path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(Sessions::default())
        .setup(|app| {
            adb::spawn_tracker(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_devices,
            pair_wireless,
            connect_wireless,
            disconnect_wireless,
            enable_wireless,
            take_screenshot,
            start_mirror,
            stop_session,
            list_sessions,
            get_settings,
            save_settings,
            fs_list,
            fs_push,
            fs_pull,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
