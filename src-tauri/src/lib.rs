use std::io::{BufRead, BufReader};
use std::process::{Command as StdCommand, Stdio, Child};
use std::sync::Mutex;
use std::time::Instant;
use tauri::{Emitter, Manager, State};

// --- Bot State ---

struct BotState {
    running: Mutex<bool>,
    child: Mutex<Option<Child>>,
    last_heartbeat: Mutex<Option<Instant>>,
    last_error: Mutex<Option<String>>,
}

impl Default for BotState {
    fn default() -> Self {
        Self {
            running: Mutex::new(false),
            child: Mutex::new(None),
            last_heartbeat: Mutex::new(None),
            last_error: Mutex::new(None),
        }
    }
}

// --- Path Resolution ---

fn find_bot_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    // 1. Dev mode: project root bot/ with node_modules already installed
    if let Ok(cwd) = std::env::current_dir() {
        for base in &[cwd.clone(), cwd.join("..").canonicalize().unwrap_or(cwd.clone())] {
            let d = base.join("bot");
            if d.join("index.mjs").exists() && d.join("node_modules").exists() {
                return Ok(d);
            }
        }
    }

    // 2. Production: use a writable runtime directory with deps installed
    let runtime_dir = user_data_dir()?.join("bot");
    if runtime_dir.join("index.mjs").exists() && runtime_dir.join("node_modules").exists() {
        return Ok(runtime_dir);
    }

    // 3. Copy bundled bot files to the writable runtime dir and install deps
    let resource_bot = find_resource_bot_dir(app)?;
    provision_bot_runtime(&resource_bot, &runtime_dir)?;

    Ok(runtime_dir)
}

fn find_resource_bot_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            for base in &[dir.to_path_buf(), dir.join("../Resources")] {
                let d = base.join("bot");
                if d.join("index.mjs").exists() {
                    return Ok(d);
                }
            }
        }
    }
    if let Ok(res) = app.path().resource_dir() {
        let d = res.join("bot");
        if d.join("index.mjs").exists() {
            return Ok(d);
        }
    }
    Err("Cannot locate bundled bot files. Reinstall the app.".into())
}

fn provision_bot_runtime(
    source: &std::path::Path,
    target: &std::path::Path,
) -> Result<(), String> {
    std::fs::create_dir_all(target)
        .map_err(|e| format!("Cannot create bot runtime dir: {}", e))?;

    // Copy all .mjs, .json, and .example files
    if let Ok(entries) = std::fs::read_dir(source) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.ends_with(".mjs")
                || name.ends_with(".json")
                || name.ends_with(".example")
            {
                let dest = target.join(&name);
                let _ = std::fs::copy(entry.path(), &dest);
            }
        }
    }

    // Run npm install to get node_modules
    let node = find_node()?;
    let npm = find_npm(&node)?;

    let output = StdCommand::new(&npm)
        .arg("install")
        .arg("--production")
        .current_dir(target)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| format!("Failed to run npm install: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(format!("npm install failed: {}", err));
    }

    Ok(())
}

fn find_npm(node_path: &str) -> Result<String, String> {
    // npm is typically next to node
    let node = std::path::Path::new(node_path);
    if let Some(dir) = node.parent() {
        let npm = dir.join("npm");
        if npm.exists() {
            return Ok(npm.to_string_lossy().to_string());
        }
        // Windows
        let npm_cmd = dir.join("npm.cmd");
        if npm_cmd.exists() {
            return Ok(npm_cmd.to_string_lossy().to_string());
        }
    }
    // Fallback: just try "npm"
    Ok("npm".into())
}

/// Writable directory for user config (outside the app bundle).
/// Uses ~/.config/hl-signalbot/ on macOS/Linux, %APPDATA%/hl-signalbot/ on Windows.
fn user_data_dir() -> Result<std::path::PathBuf, String> {
    let base = dirs::config_dir().ok_or("Cannot determine config directory")?;
    let d = base.join("hl-signalbot");
    if !d.exists() {
        std::fs::create_dir_all(&d).map_err(|e| format!("Cannot create {}: {}", d.display(), e))?;
    }
    Ok(d)
}

/// Where user-writable bot config/data live (persists across reinstalls).
/// Always uses ~/.config/hl-signalbot/ so data survives uninstall/reinstall.
fn bot_config_dir(_app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    user_data_dir()
}

// --- Node.js Runtime ---

fn find_node() -> Result<String, String> {
    let home = std::env::var("HOME").unwrap_or_default();

    // Hardcoded paths: system installs, Homebrew, pnpm, nvm, fnm, Volta, n
    let mut candidates: Vec<String> = vec![
        "/usr/local/bin/node".into(),
        "/opt/homebrew/bin/node".into(),
        format!("{}/Library/pnpm/node", home),
        format!("{}/.local/share/pnpm/node", home),
        format!("{}/.volta/bin/node", home),
        format!("{}/.local/bin/node", home),
        format!("{}/n/bin/node", home),
    ];

    // nvm: detect current default version
    let nvm_dir = std::env::var("NVM_DIR").unwrap_or_else(|_| format!("{}/.nvm", home));
    let nvm_default = std::path::Path::new(&nvm_dir).join("alias/default");
    if let Ok(ver) = std::fs::read_to_string(&nvm_default) {
        let ver = ver.trim().to_string();
        // Look for exact version or glob first matching entry
        let versions_dir = std::path::Path::new(&nvm_dir).join("versions/node");
        if let Ok(entries) = std::fs::read_dir(&versions_dir) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.starts_with(&format!("v{}", ver)) || name == format!("v{}", ver) {
                    candidates.push(format!("{}/bin/node", entry.path().display()));
                }
            }
        }
    }

    // fnm: check common install location
    let fnm_dir = format!("{}/.local/share/fnm/node-versions", home);
    if let Ok(entries) = std::fs::read_dir(&fnm_dir) {
        for entry in entries.flatten() {
            candidates.push(format!("{}/installation/bin/node", entry.path().display()));
        }
    }

    for path in &candidates {
        if std::path::Path::new(path).exists() {
            if StdCommand::new(path).arg("--version").stdout(Stdio::null()).stderr(Stdio::null()).status().is_ok() {
                return Ok(path.clone());
            }
        }
    }

    // Fallback: ask the user's login shell for the PATH
    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(output) = StdCommand::new("/bin/bash")
            .args(["-lc", "which node"])
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .output()
        {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path.is_empty() && std::path::Path::new(&path).exists() {
                    return Ok(path);
                }
            }
        }
        if let Ok(output) = StdCommand::new("/bin/zsh")
            .args(["-lc", "which node"])
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .output()
        {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path.is_empty() && std::path::Path::new(&path).exists() {
                    return Ok(path);
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        for path in &[
            r"C:\Program Files\nodejs\node.exe",
            r"C:\Program Files (x86)\nodejs\node.exe",
        ] {
            if std::path::Path::new(path).exists() {
                return Ok(path.to_string());
            }
        }
        if let Ok(output) = StdCommand::new("where").arg("node").output() {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout).lines().next().unwrap_or("").trim().to_string();
                if !path.is_empty() {
                    return Ok(path);
                }
            }
        }
    }

    Err("Node.js is not installed. Download it from https://nodejs.org (LTS version).".into())
}

// --- Tauri Commands ---

#[tauri::command]
fn is_bot_running(state: State<BotState>) -> bool {
    *state.running.lock().unwrap()
}

#[tauri::command]
async fn validate_license(key: String) -> Result<bool, String> {
    let key = key.trim().to_uppercase();
    if key.is_empty() {
        return Ok(false);
    }

    // Try online validation first
    let api_url = option_env!("LICENSE_API_URL").unwrap_or("https://hlsignalbot.netlify.app");
    let url = format!("{}/api/validate", api_url);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .unwrap_or_default();

    match client
        .post(&url)
        .json(&serde_json::json!({ "key": &key }))
        .send()
        .await
    {
        Ok(resp) => {
            if let Ok(body) = resp.json::<serde_json::Value>().await {
                return Ok(body["valid"].as_bool().unwrap_or(false));
            }
        }
        Err(_) => {}
    }

    // Offline fallback: accept properly formatted keys (SB-XXXX-XXXX-XXXX-XXXX)
    let valid_format = key.starts_with("SB-")
        && key.len() == 22
        && key.split('-').count() == 5
        && key.split('-').skip(1).all(|s| s.len() == 4 && s.chars().all(|c| c.is_ascii_alphanumeric()));

    Ok(valid_format)
}

#[tauri::command]
fn check_node() -> Result<String, String> {
    find_node()
}

#[tauri::command]
fn get_bot_dir(app: tauri::AppHandle) -> Result<String, String> {
    find_bot_dir(&app).map(|d| d.to_string_lossy().to_string())
}

#[tauri::command]
fn get_config_dir(app: tauri::AppHandle) -> Result<String, String> {
    bot_config_dir(&app).map(|d| d.to_string_lossy().to_string())
}

#[tauri::command]
fn write_bot_file(app: tauri::AppHandle, filename: String, contents: String) -> Result<(), String> {
    let dir = bot_config_dir(&app)?;
    let path = dir.join(&filename);
    std::fs::write(&path, &contents).map_err(|e| format!("Failed to write {}: {}", path.display(), e))?;

    // Restrict permissions on sensitive files
    #[cfg(unix)]
    if filename.contains("private") || filename == ".env" {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

#[tauri::command]
fn read_bot_file(app: tauri::AppHandle, filename: String) -> Result<String, String> {
    let dir = bot_config_dir(&app)?;
    let path = dir.join(&filename);
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read {}: {}", path.display(), e))
}

#[tauri::command]
fn bot_file_exists(app: tauri::AppHandle, filename: String) -> bool {
    bot_config_dir(&app)
        .map(|dir| dir.join(&filename).exists())
        .unwrap_or(false)
}

/// Write a secret file with restrictive permissions (600 on Unix).
#[tauri::command]
fn write_secret_file(path: String, contents: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("mkdir failed: {}", e))?;
    }
    std::fs::write(&p, &contents).map_err(|e| format!("write failed: {}", e))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&p, std::fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

#[tauri::command]
fn get_health(state: State<BotState>) -> (bool, Option<u64>, Option<String>) {
    let running = *state.running.lock().unwrap();
    let heartbeat_secs = state.last_heartbeat.lock().unwrap().map(|t| t.elapsed().as_secs());
    let last_err = state.last_error.lock().unwrap().clone();
    (running, heartbeat_secs, last_err)
}

#[tauri::command]
fn start_bot(app: tauri::AppHandle, state: State<BotState>) -> Result<(), String> {
    let mut running = state.running.lock().unwrap();
    if *running {
        return Err("Bot is already running".into());
    }

    let node = find_node()?;
    let bot_dir = find_bot_dir(&app)?;
    let config_dir = bot_config_dir(&app)?;

    let cli = bot_dir.join("cli.mjs");
    if !cli.exists() {
        return Err(format!("Bot CLI not found at: {}", cli.display()));
    }

    let cfg_path = config_dir.join("config.json");
    let env_path = config_dir.join(".env");
    if !cfg_path.exists() {
        return Err("config.json not found. Complete setup first.".into());
    }

    let mut cmd = StdCommand::new(&node);
    cmd.arg(cli.to_str().unwrap())
        .arg("--config")
        .arg(cfg_path.to_str().unwrap())
        .env("TAURI", "1")
        .current_dir(&bot_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Point dotenv at the config dir's .env if it exists
    if env_path.exists() {
        cmd.env("DOTENV_CONFIG_PATH", env_path.to_str().unwrap());
    }
    cmd.env("DATA_DIR", config_dir.to_str().unwrap());

    let mut child = cmd.spawn().map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            format!("Node.js not found at '{}'. Install from https://nodejs.org", node)
        } else {
            format!("Failed to start bot: {}", e)
        }
    })?;

    *running = true;
    *state.last_heartbeat.lock().unwrap() = Some(Instant::now());
    *state.last_error.lock().unwrap() = None;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    *state.child.lock().unwrap() = Some(child);
    drop(running);

    // Stream stdout
    if let Some(out) = stdout {
        let h = app.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(out);
            for line in reader.lines().flatten() {
                // Update heartbeat on any output
                let _ = h.state::<BotState>().last_heartbeat.lock().map(|mut hb| *hb = Some(Instant::now()));
                let _ = h.emit("bot-event", &line);
            }
        });
    }

    // Stream stderr
    if let Some(err) = stderr {
        let h = app.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(err);
            let mut error_lines: Vec<String> = Vec::new();
            for line in reader.lines().flatten() {
                error_lines.push(line.clone());
                let escaped = line.replace('\\', "\\\\").replace('"', "\\\"");
                let _ = h.emit("bot-event", &format!("{{\"type\":\"log\",\"message\":\"{}\"}}", escaped));
            }
            if !error_lines.is_empty() {
                let full = error_lines.join(" | ").replace('\\', "\\\\").replace('"', "\\\"");
                let _ = h.state::<BotState>().last_error.lock().map(|mut e| *e = Some(error_lines.join("\n")));
                let _ = h.emit("bot-event", &format!("{{\"type\":\"error\",\"message\":\"{}\"}}", full));
            }
        });
    }

    // Monitor child exit
    let h2 = app.clone();
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_secs(1));
            let st = h2.state::<BotState>();
            let mut child_lock = st.child.lock().unwrap();
            if let Some(ref mut c) = *child_lock {
                match c.try_wait() {
                    Ok(Some(status)) => {
                        let code = status.code().unwrap_or(-1);
                        let _ = h2.emit("bot-event", &format!("{{\"type\":\"stopped\",\"code\":{}}}", code));
                        *st.running.lock().unwrap() = false;
                        *child_lock = None;
                        break;
                    }
                    Ok(None) => {}
                    Err(_) => {
                        *st.running.lock().unwrap() = false;
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
        // Graceful shutdown: SIGTERM first, then SIGKILL after timeout
        #[cfg(unix)]
        {
            unsafe {
                libc::kill(child.id() as i32, libc::SIGTERM);
            }
            // Give it 3 seconds to shut down gracefully
            for _ in 0..30 {
                std::thread::sleep(std::time::Duration::from_millis(100));
                if let Ok(Some(_)) = child.try_wait() {
                    *state.running.lock().unwrap() = false;
                    *child_lock = None;
                    return Ok(());
                }
            }
        }
        // Force kill if still running
        let _ = child.kill();
        let _ = child.wait();
        *state.running.lock().unwrap() = false;
        *child_lock = None;
        Ok(())
    } else {
        *state.running.lock().unwrap() = false;
        Ok(())
    }
}

fn run_close_script(app: &tauri::AppHandle, check_only: bool) -> Result<String, String> {
    let node = find_node()?;
    let bot_dir = find_bot_dir(app)?;
    let config_dir = bot_config_dir(app)?;
    let close_script = bot_dir.join("close.mjs");
    if !close_script.exists() {
        return Err("close.mjs not found in bot directory".into());
    }
    let cfg_path = config_dir.join("config.json");
    let env_path = config_dir.join(".env");

    let mut cmd = StdCommand::new(&node);
    cmd.arg(close_script.to_str().unwrap())
        .arg(cfg_path.to_str().unwrap())
        .current_dir(&bot_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if check_only {
        cmd.arg("--check-only");
    }
    if env_path.exists() {
        cmd.env("DOTENV_CONFIG_PATH", env_path.to_str().unwrap());
    }
    cmd.env("DOTENV_CONFIG_QUIET", "true");
    cmd.env("DATA_DIR", config_dir.to_str().unwrap());

    let output = cmd.output().map_err(|e| format!("Failed to run script: {}", e))?;
    let raw_stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stdout = raw_stdout
        .lines()
        .rev()
        .find(|l| l.starts_with('{'))
        .unwrap_or("")
        .to_string();
    if stdout.is_empty() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(format!("Script failed: {}", stderr));
    }
    Ok(stdout)
}

#[tauri::command]
async fn check_position(app: tauri::AppHandle) -> Result<String, String> {
    run_close_script(&app, true)
}

#[tauri::command]
async fn close_position(app: tauri::AppHandle) -> Result<String, String> {
    run_close_script(&app, false)
}

#[tauri::command]
async fn restart_bot(app: tauri::AppHandle, state: State<'_, BotState>) -> Result<(), String> {
    // Stop if running
    {
        let mut child_lock = state.child.lock().unwrap();
        if let Some(ref mut child) = *child_lock {
            #[cfg(unix)]
            unsafe { libc::kill(child.id() as i32, libc::SIGTERM); }
            std::thread::sleep(std::time::Duration::from_secs(2));
            let _ = child.kill();
            let _ = child.wait();
            *state.running.lock().unwrap() = false;
            *child_lock = None;
        }
    }
    // Small delay then start
    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    start_bot(app, state)
}

// --- App Entry ---

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .manage(BotState::default())
        .invoke_handler(tauri::generate_handler![
            is_bot_running,
            validate_license,
            check_node,
            start_bot,
            stop_bot,
            restart_bot,
            close_position,
            check_position,
            get_bot_dir,
            get_config_dir,
            get_health,
            write_bot_file,
            read_bot_file,
            bot_file_exists,
            write_secret_file,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Ensure user config directory exists on startup
            let _ = user_data_dir();

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
