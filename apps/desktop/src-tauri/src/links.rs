//! Relative Markdown links and path containment rules.

use std::{fs, path::Path};

use crate::{files, models::ResolvedLink};

#[derive(Debug, PartialEq, Eq)]
pub struct ParsedMarkdownHref {
    pub anchor: Option<String>,
    pub relative_path: String,
}

fn hex_value(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

/// `decodeURIComponent` semantics: percent escapes are UTF-8 bytes, and a bad
/// escape or invalid UTF-8 rejects the whole input.
pub fn percent_decode(input: &str) -> Option<String> {
    let bytes = input.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;

    while index < bytes.len() {
        if bytes[index] == b'%' {
            let high = *bytes.get(index + 1)?;
            let low = *bytes.get(index + 2)?;
            decoded.push(hex_value(high)? * 16 + hex_value(low)?);
            index += 3;
        } else {
            decoded.push(bytes[index]);
            index += 1;
        }
    }

    String::from_utf8(decoded).ok()
}

/// Matches `^[a-z][a-z0-9+.-]*:` case-insensitively.
pub fn has_scheme(value: &str) -> bool {
    let bytes = value.as_bytes();

    // A Windows drive prefix is an absolute path, not a URL scheme.
    if bytes.get(1) == Some(&b':') && matches!(bytes.get(2), Some(b'\\' | b'/')) {
        return false;
    }

    match bytes.first() {
        Some(byte) if byte.is_ascii_alphabetic() => {}
        _ => return false,
    }

    for byte in &bytes[1..] {
        if *byte == b':' {
            return true;
        }

        if !byte.is_ascii_alphanumeric() && !matches!(byte, b'+' | b'-' | b'.') {
            return false;
        }
    }

    false
}

/// Whether a path starts with a Windows drive prefix such as `C:\` or `D:/`.
pub fn is_windows_absolute(value: &str) -> bool {
    let bytes = value.as_bytes();

    bytes.len() >= 3
        && bytes[0].is_ascii_alphabetic()
        && bytes[1] == b':'
        && matches!(bytes[2], b'\\' | b'/')
}

pub fn parse_markdown_href(href: &str) -> Option<ParsedMarkdownHref> {
    let value = href.trim();

    if value.is_empty() || value.starts_with('#') || value.starts_with("//") || has_scheme(value) {
        return None;
    }

    let (before_hash, fragment) = match value.find('#') {
        Some(index) => (&value[..index], Some(&value[index + 1..])),
        None => (value, None),
    };
    let pathname = match before_hash.find('?') {
        Some(index) => &before_hash[..index],
        None => before_hash,
    };

    if pathname.is_empty()
        || pathname.starts_with('/')
        || pathname.starts_with('\\')
        || is_windows_absolute(pathname)
    {
        return None;
    }

    let relative_path = percent_decode(pathname)?.replace('\\', "/");

    if relative_path.is_empty() || relative_path.contains('\0') {
        return None;
    }

    let anchor = fragment.filter(|fragment| !fragment.is_empty());
    let anchor = match anchor {
        Some(fragment) => Some(percent_decode(fragment)?),
        None => None,
    };

    Some(ParsedMarkdownHref {
        anchor,
        relative_path,
    })
}

/// Whether `target` is the folder `root` itself or lives inside it.
pub fn is_path_within(root: &Path, target: &Path) -> bool {
    // Normalize first: a raw `..` in the target must not slip past the prefix.
    let root = files::resolve_path(root);
    let target = files::resolve_path(target);
    target.strip_prefix(&root).is_ok()
}

/// Whether `target` is strictly below `root` (the root itself does not count).
pub fn is_path_inside(root: &Path, target: &Path) -> bool {
    let root = files::resolve_path(root);
    let target = files::resolve_path(target);

    match target.strip_prefix(&root) {
        Ok(relative) => !relative.as_os_str().is_empty(),
        Err(_) => false,
    }
}

pub fn resolve_markdown_link(
    current_path: &Path,
    href: &str,
    roots: &[std::path::PathBuf],
) -> Result<Option<ResolvedLink>, String> {
    let Some(parsed) = parse_markdown_href(href) else {
        return Ok(None);
    };

    let directory = current_path.parent().unwrap_or(current_path);
    let relative = parsed.relative_path.clone();
    let target = files::resolve_path(&directory.join(&relative));

    if !files::is_markdown_path(&target) {
        return Ok(None);
    }

    if !roots.iter().any(|root| is_path_inside(root, &target)) {
        return Err("这个链接指向的文件夹还没有打开".to_string());
    }

    let info = fs::metadata(&target)
        .map_err(|_| format!("找不到链接的文件：{}", relative))?;

    if !info.is_file() {
        return Err(format!("链接目标不是文件：{}", relative));
    }

    let name = target
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_default();

    Ok(Some(ResolvedLink {
        anchor: parsed.anchor,
        name,
        path: files::to_string(&target),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn parses_relative_targets_anchors_and_queries() {
        assert_eq!(
            parse_markdown_href("../b.md#章节"),
            Some(ParsedMarkdownHref {
                anchor: Some("章节".to_string()),
                relative_path: "../b.md".to_string(),
            })
        );
        assert_eq!(
            parse_markdown_href("0010-%E4%BA%A7%E5%93%81%E5%AE%9A%E4%BD%8D.md"),
            Some(ParsedMarkdownHref {
                anchor: None,
                relative_path: "0010-产品定位.md".to_string(),
            })
        );
        assert_eq!(
            parse_markdown_href("note.md?raw=1#top").unwrap().relative_path,
            "note.md"
        );
        assert_eq!(parse_markdown_href("my%20note.md").unwrap().relative_path, "my note.md");
    }

    #[test]
    fn rejects_external_absolute_and_anchor_only_links() {
        for href in [
            "https://example.com/note.md",
            "mailto:someone@example.com",
            "file:///C:/note.md",
            "/absolute.md",
            "\\absolute.md",
            "//example.com/note.md",
            "C:\\note.md",
            "#local",
        ] {
            assert_eq!(parse_markdown_href(href), None, "rejected: {href}");
        }
    }

    #[test]
    fn containment_distinguishes_parent_traversal_from_dot_names() {
        let root = Path::new("C:/notes");
        assert!(is_path_within(root, root));
        assert!(is_path_within(root, &root.join("..note.md")));
        assert!(!is_path_within(root, &root.join("..").join("note.md")));
        assert!(is_path_inside(root, &root.join("nested/b.md")));
        assert!(!is_path_inside(root, root));

        let inside: PathBuf = root.join("deep").join("note.md");
        assert!(is_path_inside(root, &inside));
        assert!(!is_path_inside(&root.join("other"), &inside));
    }

    #[test]
    fn has_scheme_follows_url_scheme_syntax() {
        assert!(has_scheme("HTTP://x"));
        assert!(has_scheme("a+b-c.d:x"));
        assert!(!has_scheme("C:\\notes"));
        assert!(!has_scheme("nested/note.md"));
    }
}
