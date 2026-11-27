//! Best-effort JSON stores and first-run migration from Electron's userData.

use std::{fs, path::{Path, PathBuf}};

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::files;

pub const RECENT_FILES_CAPACITY: usize = 50;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredRecent {
    pub name: String,
    pub path: String,
    #[serde(default)]
    pub opened_at: i64,
}

pub fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

fn create_parent(file: &Path) {
    if let Some(parent) = file.parent() {
        let _ = fs::create_dir_all(parent);
    }
}

fn text_field(value: &Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(Value::as_str)
        .filter(|text| !text.is_empty())
        .map(str::to_owned)
}

pub fn read_recent(file: &Path) -> Vec<StoredRecent> {
    let Ok(contents) = fs::read_to_string(file) else {
        return Vec::new();
    };
    let Ok(value) = serde_json::from_str::<Value>(&contents) else {
        return Vec::new();
    };

    let Some(entries) = value.as_array() else {
        return Vec::new();
    };

    entries
        .iter()
        .filter_map(|entry| {
            let name = text_field(entry, "name")?;
            let path = text_field(entry, "path")?;
            let opened_at = entry
                .get("openedAt")
                .and_then(Value::as_i64)
                .filter(|value| *value >= 0)
                .unwrap_or(0);

            Some(StoredRecent {
                name,
                path: files::to_string(&files::resolve_path(Path::new(&path))),
                opened_at,
            })
        })
        .collect()
}

pub fn write_recent(file: &Path, entries: &[StoredRecent]) -> Result<(), String> {
    create_parent(file);
    let json = serde_json::to_string_pretty(entries).map_err(|error| error.to_string())?;
    fs::write(file, format!("{json}\n")).map_err(|error| error.to_string())
}

pub fn read_folders(file: &Path) -> Vec<PathBuf> {
    let Ok(contents) = fs::read_to_string(file) else {
        return Vec::new();
    };
    let Ok(value) = serde_json::from_str::<Value>(&contents) else {
        return Vec::new();
    };

    let Some(entries) = value.as_array() else {
        return Vec::new();
    };

    let mut folders = Vec::new();

    for entry in entries.iter().filter_map(Value::as_str).filter(|text| !text.is_empty()) {
        let resolved = files::resolve_path(Path::new(entry));

        if !folders.contains(&resolved) {
            folders.push(resolved);
        }
    }

    folders
}

pub fn write_folders(file: &Path, folders: &[PathBuf]) -> Result<(), String> {
    let mut unique = Vec::<String>::new();

    for folder in folders {
        let resolved = files::to_string(&files::resolve_path(folder));

        if !unique.contains(&resolved) {
            unique.push(resolved);
        }
    }

    create_parent(file);
    let json = serde_json::to_string_pretty(&unique).map_err(|error| error.to_string())?;
    fs::write(file, format!("{json}\n")).map_err(|error| error.to_string())
}

fn copy_if_missing(target: &Path, source: &Path) {
    if target.exists() {
        return;
    }

    if let Ok(contents) = fs::read(source) {
        let _ = fs::write(target, contents);
    }
}

/// Electron kept its JSON stores in `%APPDATA%/markdownview`. Bring them over
/// the first time the Tauri app runs so open folders and recents survive.
pub fn migrate_from_electron(data_dir: &Path) {
    let mut roots = Vec::<PathBuf>::new();

    if let Ok(app_data) = std::env::var("APPDATA") {
        roots.push(PathBuf::from(app_data));
    }

    if let Some(config) = dirs::config_dir() {
        roots.push(config.clone());

        if let Some(parent) = config.parent() {
            roots.push(parent.to_path_buf());
        }
    }

    for root in roots {
        for candidate in [root.join("markdownview"), root.join("MarkdownView")] {
            copy_if_missing(
                &data_dir.join("folders.json"),
                &candidate.join("folders.json"),
            );
            copy_if_missing(
                &data_dir.join("recent-files.json"),
                &candidate.join("recent-files.json"),
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_and_prunes_recent_entries() {
        let root = std::env::temp_dir().join(format!("mdview-recent-{}", std::process::id()));
        let _ = fs::create_dir_all(&root);
        let file = root.join("recent-files.json");

        fs::write(
            &file,
            r#"[{"name":"a.md","path":"./a.md","openedAt":12},{"name":"bad.md"}]"#,
        )
        .unwrap();

        let entries = read_recent(&file);
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].name, "a.md");
        assert_eq!(entries[0].opened_at, 12);

        write_recent(&file, &entries).unwrap();
        let contents = fs::read_to_string(&file).unwrap();
        assert!(contents.contains("\"openedAt\": 12"));
        assert!(contents.ends_with('\n'));

        fs::remove_dir_all(&root).unwrap();
    }
}
