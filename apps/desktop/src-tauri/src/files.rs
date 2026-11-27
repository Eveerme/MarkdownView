//! Markdown discovery and document I/O.

use std::{
    fs,
    io,
    path::{Component, Path, PathBuf},
};

use crate::models::{MarkdownDocument, MarkdownFile, MarkdownFolder, MarkdownSavedFile};

const MAX_DEPTH: usize = 16;
const MAX_FILES: usize = 5000;
const IGNORED_DIRECTORIES: [&str; 3] = ["node_modules", "dist", "release"];

/// A lexically normalized absolute path. Unlike `canonicalize`, this works for
/// files that have not been created yet (Save As and pasted images).
pub fn resolve_path(path: &Path) -> PathBuf {
    let absolute = if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir()
            .unwrap_or_else(|_| PathBuf::from("."))
            .join(path)
    };

    let mut normalized = PathBuf::new();

    for component in absolute.components() {
        match component {
            Component::Prefix(prefix) => normalized.push(prefix.as_os_str()),
            Component::RootDir => normalized.push(std::path::MAIN_SEPARATOR.to_string()),
            Component::CurDir => {}
            Component::ParentDir => {
                normalized.pop();
            }
            Component::Normal(part) => normalized.push(part),
        }
    }

    if normalized.as_os_str().is_empty() {
        PathBuf::from(".")
    } else {
        normalized
    }
}

pub fn is_markdown_path(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|extension| extension.to_str())
            .map(str::to_lowercase)
            .as_deref(),
        Some("md" | "markdown")
    )
}

pub fn to_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

#[derive(Debug, Default)]
pub struct MarkdownListing {
    pub files: Vec<MarkdownFile>,
    pub truncated: bool,
}

struct WalkState {
    files: Vec<MarkdownFile>,
    truncated: bool,
}

fn relative_key(root: &Path, path: &Path) -> String {
    let relative = path.strip_prefix(root).unwrap_or(path);

    relative
        .components()
        .filter_map(|component| match component {
            Component::Normal(part) => Some(part.to_string_lossy().into_owned()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/")
}

fn walk(root: &Path, directory: &Path, depth: usize, state: &mut WalkState) {
    if depth > MAX_DEPTH {
        state.truncated = true;
        return;
    }

    if state.truncated {
        return;
    }

    let entries = match fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(_) => return,
    };

    let mut subdirectories = Vec::new();

    for entry in entries.flatten() {
        let name = entry.file_name();
        let name = name.to_string_lossy();

        if name.starts_with('.') {
            continue;
        }

        let path = entry.path();
        let file_type = match entry.file_type() {
            Ok(file_type) => file_type,
            Err(_) => continue,
        };

        if file_type.is_dir() {
            if !IGNORED_DIRECTORIES.contains(&name.to_lowercase().as_str()) {
                subdirectories.push(path);
            }

            continue;
        }

        if file_type.is_file() && is_markdown_path(&path) {
            if state.files.len() >= MAX_FILES {
                state.truncated = true;
                return;
            }

            state.files.push(MarkdownFile {
                path: to_string(&path),
                name: name.into_owned(),
                relative_path: relative_key(root, &path),
            });
        }
    }

    for subdirectory in subdirectories {
        walk(root, &subdirectory, depth + 1, state);
        if state.truncated {
            return;
        }
    }
}

pub fn list_markdown_files(root: &Path) -> io::Result<MarkdownListing> {
    // A missing directory yields an empty listing; callers report unreadable roots itself.
    if !root.is_dir() {
        return Ok(MarkdownListing::default());
    }

    let mut state = WalkState {
        files: Vec::new(),
        truncated: false,
    };

    walk(root, root, 0, &mut state);
    state
        .files
        .sort_by(|left, right| left.relative_path.cmp(&right.relative_path));

    Ok(MarkdownListing {
        files: state.files,
        truncated: state.truncated,
    })
}

pub fn folder_for(path: &Path, listing: MarkdownListing) -> MarkdownFolder {
    let name = path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| to_string(path));

    MarkdownFolder {
        path: to_string(path),
        name,
        files: listing.files,
        truncated: listing.truncated,
    }
}

pub fn read_markdown_document(path: &Path) -> Result<MarkdownDocument, String> {
    let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
    let name = path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_default();

    Ok(MarkdownDocument {
        path: to_string(path),
        name,
        content,
    })
}

pub fn write_markdown_document(path: &Path, content: &str) -> Result<MarkdownSavedFile, String> {
    fs::write(path, content).map_err(|error| error.to_string())?;
    let name = path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_default();

    Ok(MarkdownSavedFile {
        path: to_string(path),
        name,
    })
}

/// The first existing Markdown file among the operating system's arguments.
pub fn find_markdown_path(args: &[String], working_directory: &Path) -> Option<PathBuf> {
    for arg in args.iter().skip(1) {
        if arg.starts_with('-') || arg.contains("://") {
            continue;
        }

        let candidate = resolve_path(&working_directory.join(arg));

        if !is_markdown_path(&candidate) {
            continue;
        }

        if candidate.is_file() {
            return Some(candidate);
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recognizes_markdown_extensions() {
        assert!(is_markdown_path(Path::new("C:/notes/a.md")));
        assert!(is_markdown_path(Path::new("C:/notes/a.MARKDOWN")));
        assert!(!is_markdown_path(Path::new("C:/notes/a.txt")));
        assert!(!is_markdown_path(Path::new("C:/notes/a.md.bak")));
    }

    #[test]
    fn finds_only_existing_markdown_arguments() {
        let cwd = Path::new("C:/notes");
        let args = vec![
            "markdownview.exe".to_string(),
            "--flag".to_string(),
            "mdview://open".to_string(),
            "missing.md".to_string(),
        ];

        assert_eq!(find_markdown_path(&args, cwd), None);
    }

    #[test]
    fn scanning_skips_hidden_and_generated_folders_and_sorts() {
        let root = std::env::temp_dir().join(format!("mdview-scan-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);

        for directory in ["node_modules", "dist", "release", ".git", "notes"] {
            fs::create_dir_all(root.join(directory)).unwrap();
        }

        for file in ["b.md", "a.markdown", "image.png", ".hidden.md", "notes/c.md", "dist/d.md"] {
            fs::write(root.join(file), "# note").unwrap();
        }

        let listing = list_markdown_files(&root).unwrap();
        let keys: Vec<_> = listing.files.iter().map(|file| file.relative_path.as_str()).collect();

        assert_eq!(keys, vec!["a.markdown", "b.md", "notes/c.md"]);
        assert!(!listing.truncated);

        fs::remove_dir_all(&root).unwrap();
    }
}
