use std::sync::Mutex;
use tauri::{Manager, State};

#[derive(Default)]
struct BotState {
    running: Mutex<bool>,
    child_id: Mutex<Option<u32>>,
}

#[tauri::command]
fn is_bot_running(state: State<BotState>) -> bool {
    *state.running.lock().unwrap()
}

#[tauri::command]
fn set_bot_running(state: State<BotState>, running: bool) {
    *state.running.lock().unwrap() = running;
}

#[tauri::command]
fn set_bot_pid(state: State<BotState>, pid: Option<u32>) {
    *state.child_id.lock().unwrap() = pid;
}

#[tauri::command]
fn get_bot_pid(state: State<BotState>) -> Option<u32> {
    *state.child_id.lock().unwrap()
}

#[tauri::command]
fn validate_license(key: String) -> Result<bool, String> {
    // For now, accept any non-empty key. Replace with real API call later.
    if key.trim().is_empty() {
        return Ok(false);
    }
    Ok(true)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .manage(BotState::default())
        .invoke_handler(tauri::generate_handler![
            is_bot_running,
            set_bot_running,
            set_bot_pid,
            get_bot_pid,
            validate_license,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let handle = app.handle().clone();
            let _tray = tauri::tray::TrayIconBuilder::new()
                .tooltip("HL Signalbot")
                .icon(app.default_window_icon().unwrap().clone())
                .on_tray_icon_event(move |_tray, event| {
                    if let tauri::tray::TrayIconEvent::Click { .. } = event {
                        if let Some(window) = handle.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
