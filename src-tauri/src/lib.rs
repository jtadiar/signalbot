use std::sync::Mutex;
use std::process::{Command as StdCommand, Stdio, Child};
use std::io::{BufRead, BufReader};
use tauri::{Emitter, Manager, State};

struct BotState {
    running: Mutex<bool>,
    child: Mutex<Option<Child>>,
}

impl Default for BotState {
    fn default() -> Self {
        Self {
            running: Mutex::new(false),
            child: Mutex::new(None),
        }
    }
}

#[tauri::command]
fn is_bot_running(state: State<BotState>) -> bool {
    *state.running.lock().unwrap()
}

#[tauri::command]
fn validate_license(key: String) -> Result<bool, String> {
    if key.trim().is_empty() {
        return Ok(false);
    }
    Ok(true)
}

fn find_project_root(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    // In dev, cwd is the project root. In production, look relative to the binary.
    let cwd = std::env::current_dir().map_err(|e| e.to_string())?;
    if cwd.join("bot/index.mjs").exists() {
        return Ok(cwd);
    }
    let resource_dir = app.path().resource_dir().map_err(|e| e.to_string())?;
    for ancestor in resource_dir.ancestors() {
        if ancestor.join("bot/index.mjs").exists() {
            return Ok(ancestor.to_path_buf());
        }
    }
    Err(format!("Cannot find bot/index.mjs from cwd={} or resources={}", cwd.display(), resource_dir.display()))
}

#[tauri::command]
fn get_bot_dir(app: tauri::AppHandle) -> Result<String, String> {
    let root = find_project_root(&app)?;
    Ok(root.join("bot").to_string_lossy().to_string())
}

#[tauri::command]
fn write_bot_file(app: tauri::AppHandle, filename: String, contents: String) -> Result<(), String> {
    let root = find_project_root(&app)?;
    let path = root.join("bot").join(&filename);
    std::fs::write(&path, &contents).map_err(|e| format!("Failed to write {}: {}", path.display(), e))
}

#[tauri::command]
fn read_bot_file(app: tauri::AppHandle, filename: String) -> Result<String, String> {
    let root = find_project_root(&app)?;
    let path = root.join("bot").join(&filename);
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read {}: {}", path.display(), e))
}

#[tauri::command]
fn bot_file_exists(app: tauri::AppHandle, filename: String) -> bool {
    find_project_root(&app)
        .map(|root| root.join("bot").join(&filename).exists())
        .unwrap_or(false)
}

#[tauri::command]
fn start_bot(app: tauri::AppHandle, state: State<BotState>) -> Result<(), String> {
    let mut running = state.running.lock().unwrap();
    if *running {
        return Err("Bot is already running".into());
    }

    let project_root = find_project_root(&app)?;
    let bot_script = project_root.join("bot/cli.mjs");
    if !bot_script.exists() {
        return Err(format!("Bot script not found at: {}", bot_script.display()));
    }

    let config_path = project_root.join("bot/config.json");
    if !config_path.exists() {
        return Err("bot/config.json not found. Run setup first.".into());
    }

    let mut child = StdCommand::new("node")
        .arg(bot_script.to_str().unwrap())
        .arg("--config")
        .arg(config_path.to_str().unwrap())
        .env("TAURI", "1")
        .current_dir(&project_root.join("bot"))
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start bot: {}", e))?;

    *running = true;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    *state.child.lock().unwrap() = Some(child);

    let handle = app.clone();
    drop(running);

    // Stream stdout in a background thread
    if let Some(out) = stdout {
        let h = handle.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(out);
            for line in reader.lines() {
                if let Ok(text) = line {
                    let _ = h.emit("bot-event", &text);
                }
            }
        });
    }

    // Stream stderr in a background thread — accumulate lines into a single error
    if let Some(err) = stderr {
        let h = handle.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(err);
            let mut error_lines: Vec<String> = Vec::new();
            for line in reader.lines() {
                if let Ok(text) = line {
                    error_lines.push(text.clone());
                    // Also emit as log so it appears in the log panel
                    let _ = h.emit("bot-event", &format!("{{\"type\":\"log\",\"message\":\"{}\"}}", text.replace('"', "\\\"")));
                }
            }
            // When stderr closes, emit the full accumulated error
            if !error_lines.is_empty() {
                let full_error = error_lines.join(" | ").replace('"', "\\\"");
                let _ = h.emit("bot-event", &format!("{{\"type\":\"error\",\"message\":\"{}\"}}", full_error));
            }
        });
    }

    // Monitor child exit in background
    let h2 = app.clone();
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_secs(1));
            let state = h2.state::<BotState>();
            let mut child_lock = state.child.lock().unwrap();
            if let Some(ref mut c) = *child_lock {
                match c.try_wait() {
                    Ok(Some(status)) => {
                        let code = status.code().unwrap_or(-1);
                        let _ = h2.emit("bot-event", &format!("{{\"type\":\"stopped\",\"code\":{}}}", code));
                        *state.running.lock().unwrap() = false;
                        *child_lock = None;
                        break;
                    }
                    Ok(None) => {} // still running
                    Err(_) => {
                        *state.running.lock().unwrap() = false;
                        *child_lock = None;
                        break;
                    }
                }
            } else {
                break;
            }
        }
    });

    Ok(())
}

#[tauri::command]
fn stop_bot(state: State<BotState>) -> Result<(), String> {
    let mut child_lock = state.child.lock().unwrap();
    if let Some(ref mut child) = *child_lock {
        child.kill().map_err(|e| format!("Failed to kill bot: {}", e))?;
        *state.running.lock().unwrap() = false;
        *child_lock = None;
        Ok(())
    } else {
        *state.running.lock().unwrap() = false;
        Err("Bot is not running".into())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .manage(BotState::default())
        .invoke_handler(tauri::generate_handler![
            is_bot_running,
            validate_license,
            start_bot,
            stop_bot,
            get_bot_dir,
            write_bot_file,
            read_bot_file,
            bot_file_exists,
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
