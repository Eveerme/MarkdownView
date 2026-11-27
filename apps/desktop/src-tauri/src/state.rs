//! In-memory workspace state and the stores behind it.

use std::{
    collections::{HashSet, VecDeque},
    path::{Path, PathBuf},
    sync::Mutex,
};

use crate::{
    files,
    models::{MarkdownOpenRequest, RecentFile, UpdateInfo},
    persistence::{self, StoredRecent},
};

pub struct UpdaterState {
    pub cached: Option<(i64, Option<UpdateInfo>)>,
    pub last_request_at: i64,
}

/// Files the user picked and folders the user opened are the only paths the
/// renderer may reach through commands and the image protocol.
pub struct AppState {
    pub opened_files: Mutex<HashSet<PathBuf>>,
    pub opened_folders: Mutex<HashSet<PathBuf>>,
    pub pending_open_requests: Mutex<VecDeque<MarkdownOpenRequest>>,
    pub stored_folders: Mutex<Vec<PathBuf>>,
    pub recent: Mutex<Vec<StoredRecent>>,
    pub folders_file: PathBuf,
    pub recent_file: PathBuf,
    pub updater: tokio::sync::Mutex<UpdaterState>,
}

impl AppState {
    pub fn new(data_dir: &Path) -> Self {
        Self {
            opened_files: Mutex::new(HashSet::new()),
            opened_folders: Mutex::new(HashSet::new()),
            pending_open_requests: Mutex::new(VecDeque::new()),
            stored_folders: Mutex::new(persistence::read_folders(&data_dir.join("folders.json"))),
            recent: Mutex::new(persistence::read_recent(&data_dir.join("recent-files.json"))),
            folders_file: data_dir.join("folders.json"),
            recent_file: data_dir.join("recent-files.json"),
            updater: tokio::sync::Mutex::new(UpdaterState {
                cached: None,
                last_request_at: 0,
            }),
        }
    }

    pub fn allow(&self, path: &Path) -> PathBuf {
        let absolute = files::resolve_path(path);
        self.opened_files.lock().unwrap().insert(absolute.clone());
        absolute
    }

    pub fn is_allowed(&self, path: &Path) -> bool {
        let resolved = files::resolve_path(path);
        self.opened_files.lock().unwrap().contains(&resolved)
    }

    pub fn assert_allowed(&self, input: &str) -> Result<PathBuf, String> {
        let absolute = files::resolve_path(Path::new(input));

        if !files::is_markdown_path(&absolute) {
            return Err("Only Markdown files can be opened".to_string());
        }

        let allowed = self.opened_files.lock().unwrap().contains(&absolute);

        if !allowed && !self.recent_contains(&absolute) {
            return Err("The file was not opened through the app".to_string());
        }

        self.opened_files.lock().unwrap().insert(absolute.clone());
        Ok(absolute)
    }

    pub fn assert_folder_in_workspace(&self, input: &str) -> Result<PathBuf, String> {
        let absolute = files::resolve_path(Path::new(input));

        if !self.roots().iter().any(|root| crate::links::is_path_within(root, &absolute)) {
            return Err("The folder is not part of an opened workspace".to_string());
        }

        Ok(absolute)
    }

    pub fn roots(&self) -> Vec<PathBuf> {
        let mut roots: Vec<PathBuf> = self.opened_folders.lock().unwrap().iter().cloned().collect();
        roots.extend(self.stored_folders.lock().unwrap().iter().cloned());
        roots
    }

    pub fn persist_folders(&self, paths: &[PathBuf]) {
        let mut unique = Vec::<PathBuf>::new();

        for path in paths {
            let absolute = files::resolve_path(path);

            if !unique.contains(&absolute) {
                unique.push(absolute);
            }
        }

        *self.stored_folders.lock().unwrap() = unique.clone();
        let _ = persistence::write_folders(&self.folders_file, &unique);
    }

    pub fn remember(&self, path: &Path) {
        let absolute = files::resolve_path(path);
        let name = absolute
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_default();

        let entry = StoredRecent {
            name,
            path: files::to_string(&absolute),
            opened_at: persistence::now_ms(),
        };

        let mut entries = self.recent.lock().unwrap();
        entries.retain(|item| files::resolve_path(Path::new(&item.path)) != absolute);
        entries.insert(0, entry);
        entries.truncate(persistence::RECENT_FILES_CAPACITY);
        let snapshot = entries.clone();
        drop(entries);

        let _ = persistence::write_recent(&self.recent_file, &snapshot);
    }

    pub fn recent_contains(&self, path: &Path) -> bool {
        let resolved = files::resolve_path(path);

        self.recent
            .lock()
            .unwrap()
            .iter()
            .any(|item| files::resolve_path(Path::new(&item.path)) == resolved)
    }

    pub fn list_recent(&self) -> Vec<RecentFile> {
        let mut entries = self.recent.lock().unwrap();
        let existing: Vec<StoredRecent> = entries
            .iter()
            .filter(|item| Path::new(&item.path).is_file())
            .cloned()
            .collect();

        if existing.len() != entries.len() {
            *entries = existing.clone();
            let snapshot = entries.clone();
            drop(entries);
            let _ = persistence::write_recent(&self.recent_file, &snapshot);
        } else {
            drop(entries);
        }

        existing
            .into_iter()
            .map(|item| {
                let path = PathBuf::from(&item.path);
                let directory = path
                    .parent()
                    .map(files::to_string)
                    .unwrap_or_default();

                RecentFile {
                    directory,
                    opened_at: item.opened_at,
                    path: item.path,
                    name: item.name,
                }
            })
            .collect()
    }

    pub fn clear_recent(&self) {
        *self.recent.lock().unwrap() = Vec::new();
        let _ = persistence::write_recent(&self.recent_file, &[]);
    }
}
