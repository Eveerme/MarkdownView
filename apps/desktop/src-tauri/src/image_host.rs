//! PicGo / PicList HTTP image host (`POST <endpoint>/upload`).

use std::{fs, io::Read, time::Duration};

use serde_json::{json, Value};
use ureq::AgentBuilder;

use crate::{assets, models::UploadedImage};

fn is_http_url(value: &str) -> bool {
    (value.starts_with("http://") || value.starts_with("https://")) && value.len() > 8
}

fn endpoint_base(endpoint: &str) -> &str {
    endpoint.trim_end_matches('/')
}

fn agent(timeout: Duration) -> ureq::Agent {
    AgentBuilder::new().timeout(timeout).build()
}

pub fn is_image_host_reachable(endpoint: &str) -> bool {
    if !is_http_url(endpoint) {
        return false;
    }

    let url = format!("{}/upload", endpoint_base(endpoint));
    let response = agent(Duration::from_secs(5))
        .post(url.as_str())
        .set("Content-Type", "application/json")
        .send_json(json!({ "list": [] }));

    match response {
        Ok(response) if response.status() == 200 => match response.into_json::<Value>() {
            Ok(payload) => payload.get("success").and_then(Value::as_bool).unwrap_or(false),
            Err(_) => false,
        },
        _ => false,
    }
}

pub fn upload_to_image_host(endpoint: &str, path: &std::path::Path) -> Result<UploadedImage, String> {
    if !is_http_url(endpoint) {
        return Err("图床地址无效".to_string());
    }

    let data = fs::read(path).map_err(|error| error.to_string())?;

    if data.is_empty() {
        return Err("图片内容为空".to_string());
    }

    if data.len() > assets::MAX_IMAGE_BYTES {
        return Err("图片超过 25 MB".to_string());
    }

    let url = format!("{}/upload", endpoint_base(endpoint));
    let path_text = crate::files::to_string(path);

    // Only the local path is sent; the caller has already checked it sits in the note's folder.
    let response = agent(Duration::from_secs(20))
        .post(url.as_str())
        .set("Content-Type", "application/json")
        .send_json(json!({ "list": [path_text] }))
        .map_err(|error| format!("图床上传失败：{error}"))?;

    if response.status() != 200 {
        return Err(format!("图床上传失败（HTTP {}）", response.status()));
    }

    let mut body = String::new();
    response
        .into_reader()
        .read_to_string(&mut body)
        .map_err(|error| error.to_string())?;
    let payload: Value = serde_json::from_str(&body)
        .map_err(|_| "图床返回了无法识别的结果".to_string())?;

    if payload.get("success").and_then(Value::as_bool) != Some(true) {
        return Err("图床返回了无法识别的结果".to_string());
    }

    let url = payload
        .get("result")
        .and_then(Value::as_array)
        .and_then(|results| results.first())
        .and_then(Value::as_str)
        .ok_or_else(|| "图床没有返回图片地址".to_string())?;

    if !is_http_url(url) {
        return Err("图床返回了无法识别的结果".to_string());
    }

    Ok(UploadedImage { url: url.to_string() })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_endpoint_and_validates_urls() {
        assert_eq!(endpoint_base("http://localhost:36677/"), "http://localhost:36677");
        assert!(is_http_url("https://example.com/upload"));
        assert!(!is_http_url("file:///tmp/upload"));
    }
}
