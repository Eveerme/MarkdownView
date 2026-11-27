//! The complete command surface used by `window.desktop` in the renderer.
//!
//! Every JS payload key maps to a separate Rust parameter, so flat payloads
//! such as `{ path, content }` are declared as individual parameters.

use std::{
    path::{Path, PathBuf},
    sync::Arc,
};

use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

use crate::{
    assets, files, links,
    models::{
        DownloadedUpdate, MarkdownDocument, MarkdownFolder, MarkdownOpenRequest, MarkdownSavedFile,
        RecentFile, ResolvedLink, SavedImage, UpdateInfo, Versions,
    },
    state::{AppState, UpdaterState},
    updater,
};

fn state(app: &AppHandle) -> Arc<AppState> {
    Arc::clone(app.state::<Arc<AppState>>().inner())
}

async fn blocking<F, R>(task: F) -> Result<R, String>
where
    F: FnOnce() -> R + Send + 'static,
    R: Send + 'static,
{
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(|error| error.to_string())
}

fn open_folder_root(shared: &Arc<AppState>, path: &Path) -> Result<MarkdownFolder, String> {
    let absolute = files::resolve_path(path);
    let listing = files::list_markdown_files(&absolute).map_err(|error| error.to_string())?;

    shared.opened_folders.lock().unwrap().insert(absolute.clone());

    for file in &listing.files {
        shared.allow(Path::new(&file.path));
    }

    Ok(files::folder_for(&absolute, listing))
}

/// A file from argv, a second instance, or a file association: remember it for
/// `take_open_request` and also tell the renderer right away.
pub fn request_open<R: Runtime>(app: &AppHandle<R>, shared: &AppState, path: &Path) {
    let absolute = files::resolve_path(path);

    if !files::is_markdown_path(&absolute) {
        return;
    }

    shared.allow(&absolute);
    let request = MarkdownOpenRequest {
        path: files::to_string(&absolute),
        name: absolute
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_default(),
    };

    {
        let mut pending = shared.pending_open_requests.lock().unwrap();

        if !pending.iter().any(|item| item.path == request.path) {
            pending.push_back(request.clone());
        }
    }

    let _ = app.emit("open-request", request);

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[tauri::command(rename_all = "camelCase")]
pub fn versions() -> Versions {
    let platform = std::env::consts::OS;
    let webview = match platform {
        "windows" => "WebView2",
        "macos" => "WKWebView",
        "linux" => "WebKitGTK",
        _ => "unknown",
    };

    Versions {
        platform: match platform {
            "windows" => "Windows",
            "macos" => "macOS",
            "linux" => "Linux",
            other => other,
        }
        .to_string(),
        tauri: tauri::VERSION.to_string(),
        webview: webview.to_string(),
    }
}

#[tauri::command(rename_all = "camelCase")]
pub async fn open_file(app: AppHandle) -> Result<Option<MarkdownDocument>, String> {
    let shared = state(&app);
    let picked = blocking(move || {
        app.dialog()
            .file()
            .add_filter("Markdown", &["md", "markdown"])
            .set_title("打开 Markdown 文件")
            .blocking_pick_file()
            .and_then(|file| file.into_path().ok())
    })
    .await?;

    let Some(path) = picked else {
        return Ok(None);
    };

    let path = shared.allow(&path);
    let target = path.clone();
    let document = blocking(move || files::read_markdown_document(&target)).await??;
    shared.remember(&path);

    Ok(Some(document))
}

#[tauri::command(rename_all = "camelCase")]
pub fn take_open_request(app: AppHandle) -> Option<MarkdownOpenRequest> {
    state(&app).pending_open_requests.lock().unwrap().pop_front()
}

#[tauri::command(rename_all = "camelCase")]
pub async fn open_folder(app: AppHandle) -> Result<Option<Vec<MarkdownFolder>>, String> {
    let shared = state(&app);
    let picked = blocking(move || {
        app.dialog()
            .file()
            .set_title("打开文件夹")
            .blocking_pick_folders()
    })
    .await?;

    let Some(paths) = picked else {
        return Ok(None);
    };

    if paths.is_empty() {
        return Ok(None);
    }

    let mut folders = Vec::new();

    for picked in paths {
        let path = picked.into_path().map_err(|error| error.to_string())?;
        let task_state = Arc::clone(&shared);
        let folder = blocking(move || open_folder_root(&task_state, &path)).await??;
        folders.push(folder);
    }

    let mut stored = shared.stored_folders.lock().unwrap().clone();

    for folder in &folders {
        stored.push(PathBuf::from(folder.path.clone()));
    }

    shared.persist_folders(&stored);

    Ok(Some(folders))
}

#[tauri::command(rename_all = "camelCase")]
pub async fn list_folders(app: AppHandle) -> Result<Vec<MarkdownFolder>, String> {
    let shared = state(&app);
    let task_state = Arc::clone(&shared);

    let folders = blocking(move || {
        let paths = task_state.stored_folders.lock().unwrap().clone();

        paths
            .iter()
            .filter_map(|path| open_folder_root(&task_state, path).ok())
            .collect::<Vec<_>>()
    })
    .await?;

    Ok(folders)
}

#[tauri::command(rename_all = "camelCase")]
pub fn close_folder(app: AppHandle, path: String) -> Result<(), String> {
    let shared = state(&app);
    let absolute = files::resolve_path(Path::new(&path));

    shared.opened_folders.lock().unwrap().remove(&absolute);
    let remaining: Vec<PathBuf> = shared
        .stored_folders
        .lock()
        .unwrap()
        .iter()
        .filter(|stored| **stored != absolute)
        .cloned()
        .collect();
    shared.persist_folders(&remaining);

    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
pub async fn refresh_folder(app: AppHandle, path: String) -> Result<MarkdownFolder, String> {
    let shared = state(&app);
    let absolute = files::resolve_path(Path::new(&path));

    let opened = shared.opened_folders.lock().unwrap().contains(&absolute);

    if !opened {
        return Err("The folder was not opened through the app".to_string());
    }

    let task_state = Arc::clone(&shared);
    let target = absolute.clone();
    let folder = blocking(move || open_folder_root(&task_state, &target)).await??;

    Ok(folder)
}

#[tauri::command(rename_all = "camelCase")]
pub async fn read_file(app: AppHandle, path: String) -> Result<MarkdownDocument, String> {
    let shared = state(&app);
    let absolute = shared.assert_allowed(&path)?;
    let target = absolute.clone();
    let document = blocking(move || files::read_markdown_document(&target)).await??;
    shared.remember(&absolute);

    Ok(document)
}

#[tauri::command(rename_all = "camelCase")]
pub fn reveal_file(app: AppHandle, path: String) -> Result<(), String> {
    let shared = state(&app);
    let absolute = shared.assert_allowed(&path)?;

    app.opener()
        .reveal_item_in_dir(&absolute)
        .map_err(|error| error.to_string())
}

#[tauri::command(rename_all = "camelCase")]
pub fn reveal_folder(app: AppHandle, path: String) -> Result<(), String> {
    let shared = state(&app);
    let absolute = shared.assert_folder_in_workspace(&path)?;

    app.opener()
        .open_path(files::to_string(&absolute), None::<&str>)
        .map_err(|error| error.to_string())
}

#[tauri::command(rename_all = "camelCase")]
pub fn resolve_link(
    app: AppHandle,
    from: String,
    href: String,
) -> Result<Option<ResolvedLink>, String> {
    let shared = state(&app);
    let current = shared.assert_allowed(&from)?;

    let mut roots = Vec::<PathBuf>::new();

    if let Some(parent) = current.parent() {
        roots.push(parent.to_path_buf());
    }

    roots.extend(shared.opened_folders.lock().unwrap().iter().cloned());
    roots.extend(shared.stored_folders.lock().unwrap().iter().cloned());

    let target = links::resolve_markdown_link(&current, &href, &roots)?;

    if let Some(link) = &target {
        shared.allow(Path::new(&link.path));
    }

    Ok(target)
}

#[tauri::command(rename_all = "camelCase")]
pub async fn save_file(
    app: AppHandle,
    path: String,
    content: String,
) -> Result<MarkdownSavedFile, String> {
    let shared = state(&app);
    let absolute = shared.assert_allowed(&path)?;
    let target = absolute.clone();

    Ok(blocking(move || files::write_markdown_document(&target, &content)).await??)
}

#[tauri::command(rename_all = "camelCase")]
pub async fn save_file_as(
    app: AppHandle,
    content: String,
    suggested_name: String,
) -> Result<Option<MarkdownSavedFile>, String> {
    let shared = state(&app);

    let picked = blocking(move || {
        app.dialog()
            .file()
            .set_directory(dirs::document_dir().unwrap_or_else(|| PathBuf::from(".")))
            .set_file_name(suggested_name)
            .add_filter("Markdown", &["md", "markdown"])
            .set_title("另存为")
            .blocking_save_file()
            .and_then(|file| file.into_path().ok())
    })
    .await?;

    let Some(picked) = picked else {
        return Ok(None);
    };

    let mut path = picked;

    if !files::is_markdown_path(&path) {
        path = PathBuf::from(format!("{}.md", files::to_string(&path)));
    }

    let path = shared.allow(&path);
    let target = path.clone();
    let saved = blocking(move || files::write_markdown_document(&target, &content)).await??;
    shared.remember(&path);

    Ok(Some(saved))
}

#[tauri::command(rename_all = "camelCase")]
pub fn recent_files(app: AppHandle) -> Vec<RecentFile> {
    state(&app).list_recent()
}

#[tauri::command(rename_all = "camelCase")]
pub fn clear_recent_files(app: AppHandle) {
    state(&app).clear_recent();
}

#[tauri::command(rename_all = "camelCase")]
pub async fn save_image(
    app: AppHandle,
    data: Vec<u8>,
    from: String,
    mime_type: String,
) -> Result<SavedImage, String> {
    let shared = state(&app);
    let from = shared.assert_allowed(&from)?;

    Ok(blocking(move || assets::save_image_asset(&data, &from, &mime_type)).await??)
}

#[tauri::command(rename_all = "camelCase")]
pub async fn check_update(app: AppHandle) -> Result<Option<UpdateInfo>, String> {
    let shared = state(&app);
    let mut guard: tokio::sync::MutexGuard<'_, UpdaterState> = shared.updater.lock().await;
    let now = updater::now_ms();

    if let Some((cached_at, result)) = &guard.cached {
        if now - cached_at < updater::CACHE_MS {
            return Ok(result.clone());
        }
    }

    if guard.last_request_at > 0 && now - guard.last_request_at < updater::REQUEST_GAP_MS {
        return Ok(guard.cached.as_ref().and_then(|cached| cached.1.clone()));
    }

    // Holding the async mutex across the fetch makes concurrent checks single-flight.
    guard.last_request_at = updater::now_ms();
    let manifest = blocking(updater::fetch_manifest).await.and_then(|value| value);
    let result = match manifest {
        Ok(info) if updater::is_newer(&info.version, env!("CARGO_PKG_VERSION")) => Some(info),
        _ => None,
    };

    guard.cached = Some((updater::now_ms(), result.clone()));
    Ok(result)
}

#[tauri::command(rename_all = "camelCase")]
pub async fn download_update(
    app: AppHandle,
    info: UpdateInfo,
) -> Result<DownloadedUpdate, String> {
    let data_dir = app.path().app_data_dir().map_err(|error| error.to_string())?;

    Ok(blocking(move || updater::download_update_blocking(&info, &data_dir)).await??)
}

#[tauri::command(rename_all = "camelCase")]
pub fn install_update(app: AppHandle, path: String) -> Result<(), String> {
    let target = PathBuf::from(&path);

    if !target.is_file() {
        return Err("安装包不存在".to_string());
    }

    app.opener()
        .open_path(files::to_string(&target), None::<&str>)
        .map_err(|error| error.to_string())
}

#[tauri::command(rename_all = "camelCase")]
pub async fn export_document(
    app: AppHandle,
    format: String,
    html: String,
    suggested_name: String,
) -> Result<Option<MarkdownSavedFile>, String> {
    if !format.eq_ignore_ascii_case("html") {
        return Err("仅支持导出 HTML".to_string());
    }

    let suggested_file_name = format!("{suggested_name}.html");
    let picked = blocking(move || {
        app.dialog()
            .file()
            .set_directory(dirs::document_dir().unwrap_or_else(|| PathBuf::from(".")))
            .set_file_name(suggested_file_name)
            .add_filter("HTML", &["html"])
            .set_title("导出 HTML")
            .blocking_save_file()
            .and_then(|file| file.into_path().ok())
    })
    .await?;

    let Some(picked) = picked else {
        return Ok(None);
    };

    let mut path = picked;

    if !path.to_string_lossy().to_lowercase().ends_with(".html") {
        path = PathBuf::from(format!("{}.html", files::to_string(&path)));
    }

    let target = path.clone();
    blocking(move || files::write_markdown_document(&target, &html)).await??;
    let name = path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_default();

    Ok(Some(MarkdownSavedFile {
        path: files::to_string(&path),
        name,
    }))
}
