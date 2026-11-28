//! Serves `mdview://asset/?from=<note>&src=<relative image>` requests.

use std::{fs, path::{Path, PathBuf}, sync::Arc};

use tauri::{AppHandle, Manager, Runtime};

use crate::{assets, files, links, state::AppState};

const MAX_SOURCE_LENGTH: usize = 4096;

fn not_found() -> http::Response<Vec<u8>> {
    http::Response::builder()
        .status(http::StatusCode::NOT_FOUND)
        .body(Vec::new())
        .unwrap()
}

fn query_value(query: &str, wanted: &str) -> Option<String> {
    query.split('&').find_map(|pair| {
        let (key, value) = pair.split_once('=')?;
        if links::percent_decode(key)? == wanted {
            links::percent_decode(value)
        } else {
            None
        }
    })
}

fn has_scheme_or_double_slash(value: &str) -> bool {
    value.starts_with("//") || links::has_scheme(value) || links::is_windows_absolute(value)
}

fn resolve_image_request<R: Runtime>(app: &AppHandle<R>, from: &str, src: &str) -> Option<PathBuf> {
    let Some(managed) = app.try_state::<Arc<AppState>>() else {
        return None;
    };
    let state = Arc::clone(managed.inner());
    let document = files::resolve_path(Path::new(from));

    if !state.is_allowed(&document) {
        return None;
    }

    let value = src.trim();

    if value.is_empty()
        || value.len() > MAX_SOURCE_LENGTH
        || value.contains('\0')
        || has_scheme_or_double_slash(value)
    {
        return None;
    }

    let without_fragment = value.split('#').next().unwrap_or("").split('?').next().unwrap_or("");

    if without_fragment.is_empty() || Path::new(without_fragment).is_absolute() {
        return None;
    }

    let document_directory = document.parent().unwrap_or(&document);
    let candidate = files::resolve_path(&document_directory.join(without_fragment));

    if assets::image_extension(&candidate).is_none() {
        return None;
    }

    let target = fs::canonicalize(&candidate).ok()?;
    let mut roots = state.roots();
    roots.push(document_directory.to_path_buf());

    let inside_root = roots.iter().any(|root| match fs::canonicalize(root) {
        Ok(real) => links::is_path_inside(&real, &target),
        Err(_) => false,
    });

    if !inside_root {
        return None;
    }

    let info = fs::metadata(&target).ok()?;

    if !info.is_file() || info.len() as usize > assets::MAX_IMAGE_BYTES {
        return None;
    }

    Some(target)
}

pub fn handle<R: Runtime>(app: &AppHandle<R>, request: http::Request<Vec<u8>>) -> http::Response<Vec<u8>> {
    let uri = request.uri();

    if uri.host() != Some("localhost") || !uri.path().starts_with("/asset") {
        return not_found();
    }

    let query = uri.query().unwrap_or("");
    let Some(from) = query_value(query, "from") else {
        return not_found();
    };
    let Some(src) = query_value(query, "src") else {
        return not_found();
    };

    let Some(target) = resolve_image_request(app, &from, &src) else {
        return not_found();
    };

    let Ok(data) = fs::read(&target) else {
        return not_found();
    };

    http::Response::builder()
        .status(http::StatusCode::OK)
        .header(http::header::CACHE_CONTROL, "no-store")
        .header(http::header::CONTENT_TYPE, assets::content_type_for(&target))
        .body(data)
        .unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_decoded_query_values() {
        let query = "from=C%3A%2Fnotes%2Fa.md&src=assets%2Fmy%20image.png";
        assert_eq!(query_value(query, "from").as_deref(), Some("C:/notes/a.md"));
        assert_eq!(query_value(query, "src").as_deref(), Some("assets/my image.png"));
        assert_eq!(query_value(query, "missing"), None);
    }

    #[test]
    fn rejects_remote_sources() {
        for src in ["//host/a.png", "http://host/a.png", "file:///a.png", "C:\\a.png", ""] {
            assert!(has_scheme_or_double_slash(src) || src.is_empty());
        }

        assert!(!has_scheme_or_double_slash("assets/a.png"));
    }
}
