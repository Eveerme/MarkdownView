//! Storage for pasted/dropped note images.

use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::Path,
};

use crate::models::SavedImage;

pub const MAX_IMAGE_BYTES: usize = 25 * 1024 * 1024;

fn extension_for_mime(mime_type: &str) -> Option<&'static str> {
    let mime = mime_type.split(';').next().unwrap_or("").trim().to_lowercase();

    match mime.as_str() {
        "image/avif" => Some("avif"),
        "image/bmp" => Some("bmp"),
        "image/gif" => Some("gif"),
        "image/jpeg" => Some("jpg"),
        "image/png" => Some("png"),
        "image/svg+xml" => Some("svg"),
        "image/webp" => Some("webp"),
        _ => None,
    }
}

pub fn image_extension(path: &Path) -> Option<&'static str> {
    match path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(str::to_lowercase)
        .as_deref()
    {
        Some("avif") => Some("avif"),
        Some("bmp") => Some("bmp"),
        Some("gif") => Some("gif"),
        Some("jpeg" | "jpg") => Some("jpg"),
        Some("png") => Some("png"),
        Some("svg") => Some("svg"),
        Some("webp") => Some("webp"),
        _ => None,
    }
}

pub fn content_type_for(path: &Path) -> &'static str {
    match image_extension(path) {
        Some("avif") => "image/avif",
        Some("bmp") => "image/bmp",
        Some("gif") => "image/gif",
        Some("jpg") => "image/jpeg",
        Some("png") => "image/png",
        Some("svg") => "image/svg+xml",
        Some("webp") => "image/webp",
        _ => "application/octet-stream",
    }
}

pub fn save_image_asset(data: &[u8], from: &Path, mime_type: &str) -> Result<SavedImage, String> {
    let Some(extension) = extension_for_mime(mime_type) else {
        return Err("不支持的图片格式".to_string());
    };

    if data.is_empty() {
        return Err("图片内容为空".to_string());
    }

    if data.len() > MAX_IMAGE_BYTES {
        return Err("图片超过 25 MB".to_string());
    }

    let directory = from.parent().unwrap_or(from).join("assets");
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;

    for _ in 0..5 {
        let stamp = chrono::Utc::now().format("%Y%m%d%H%M%S").to_string();
        let id = format!("{:08x}", rand::random::<u32>());
        let name = format!("image-{stamp}-{id}.{extension}");
        let target = directory.join(&name);

        let result = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&target)
            .and_then(|mut file| file.write_all(data));

        match result {
            Ok(()) => return Ok(SavedImage { relative_path: format!("assets/{name}") }),
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error.to_string()),
        }
    }

    Err("无法生成唯一的图片文件名".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_supported_mime_types() {
        assert_eq!(extension_for_mime("image/jpeg"), Some("jpg"));
        assert_eq!(extension_for_mime("IMAGE/SVG+XML; charset=utf-8"), Some("svg"));
        assert_eq!(extension_for_mime("image/heic"), None);
        assert_eq!(content_type_for(Path::new("assets/a.jpg")), "image/jpeg");
    }
}
