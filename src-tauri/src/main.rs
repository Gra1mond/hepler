#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

#[cfg(windows)]
fn disable_swipe_navigation(window: &tauri::WebviewWindow) {
    use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Settings6;
    use windows_core::Interface;

    let result = window.with_webview(|webview| {
        // The controller is accessed on the WebView thread provided by Tauri.
        let result = unsafe {
            webview
                .controller()
                .CoreWebView2()
                .and_then(|view| view.Settings())
                .and_then(|settings| settings.cast::<ICoreWebView2Settings6>())
                .and_then(|settings| settings.SetIsSwipeNavigationEnabled(false))
        };
        if let Err(error) = result {
            eprintln!("Could not disable WebView2 swipe navigation: {error}");
        }
    });
    if let Err(error) = result {
        eprintln!("Could not access WebView2: {error}");
    }
}

fn show_window(
    app: &AppHandle,
    label: &str,
    title: &str,
    route: &str,
    width: f64,
    height: f64,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(label) {
        window.unminimize().map_err(|error| error.to_string())?;
        window.set_focus().map_err(|error| error.to_string())?;
        return Ok(());
    }

    let window = WebviewWindowBuilder::new(app, label, WebviewUrl::App(route.into()))
        .title(title)
        .decorations(label != "register")
        .inner_size(width, height)
        .min_inner_size(320.0, 360.0)
        .center()
        .build()
        .map_err(|error| error.to_string())?;
    #[cfg(windows)]
    disable_swipe_navigation(&window);
    #[cfg(not(windows))]
    let _ = window;
    Ok(())
}

#[tauri::command]
async fn open_compact_chat(app: AppHandle) -> Result<(), String> {
    show_window(
        &app,
        "compact",
        "Реплика · Компактный чат",
        "index.html#compact",
        460.0,
        680.0,
    )
}

#[tauri::command]
async fn open_registration(app: AppHandle) -> Result<(), String> {
    show_window(
        &app,
        "register",
        "Реплика · Регистрация",
        "index.html#register",
        444.0,
        472.0,
    )
}

#[tauri::command]
async fn focus_main_window(app: AppHandle, view: &str) -> Result<(), String> {
    let script = match view {
        "chat" => "window.location.hash = 'chat'",
        "settings" => "window.location.hash = 'settings'",
        "materials" => "window.location.hash = 'materials'",
        _ => return Err("Unsupported view".into()),
    };
    let window = app
        .get_webview_window("main")
        .ok_or("Main window is unavailable")?;
    window.unminimize().map_err(|error| error.to_string())?;
    window.eval(script).map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

#[tauri::command]
async fn close_registration(window: tauri::WebviewWindow) -> Result<(), String> {
    if window.label() != "register" {
        return Err("Unexpected window".into());
    }
    window.close().map_err(|error| error.to_string())
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(windows)]
            if let Some(window) = app.get_webview_window("main") {
                disable_swipe_navigation(&window);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_compact_chat,
            open_registration,
            focus_main_window,
            close_registration
        ])
        .run(tauri::generate_context!())
        .expect("Ошибка запуска Реплики");
}
