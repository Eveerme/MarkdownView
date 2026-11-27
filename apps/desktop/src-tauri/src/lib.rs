mod assets;
mod commands;
mod files;
mod image_protocol;
mod links;
mod models;
mod persistence;
mod state;
mod updater;

use std::sync::Arc;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            if let Some(state) = app.try_state::<Arc<state::AppState>>() {
                if let Some(path) = files::find_markdown_path(&args, std::path::Path::new(&cwd)) {
                    commands::request_open(app, state.inner().as_ref(), &path);
                }
            }
        }))
        .register_uri_scheme_protocol("mdview", |context, request| {
            image_protocol::handle(context.app_handle(), request)
        })
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            persistence::migrate_from_electron(&data_dir);

            let shared = Arc::new(state::AppState::new(&data_dir));
            app.manage(Arc::clone(&shared));

            let args: Vec<String> = std::env::args().collect();
            let cwd = std::env::current_dir().unwrap_or_default();

            if let Some(path) = files::find_markdown_path(&args, &cwd) {
                commands::request_open(app.handle(), shared.as_ref(), &path);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::versions,
            commands::open_file,
            commands::take_open_request,
            commands::open_folder,
            commands::list_folders,
            commands::close_folder,
            commands::refresh_folder,
            commands::read_file,
            commands::reveal_file,
            commands::reveal_folder,
            commands::resolve_link,
            commands::save_file,
            commands::save_file_as,
            commands::recent_files,
            commands::clear_recent_files,
            commands::save_image,
            commands::check_update,
            commands::download_update,
            commands::install_update,
            commands::export_document,
        ])
        .run(tauri::generate_context!())
        .expect("error while running MarkdownView");
}
