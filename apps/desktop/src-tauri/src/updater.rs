//! Static-manifest updater: cached checks, SHA-256 verified download, installer handoff.

use std::{fs, io::Read, path::Path, time::Duration};

use serde_json::Value;
use sha2::{Digest, Sha256};
use ureq::AgentBuilder;

use crate::{models::{DownloadedUpdate, UpdateInfo}, persistence};

const MANIFEST_URL: &str = "https://eveerme.github.io/MarkdownView/latest.json";
pub const CACHE_MS: i64 = 6 * 60 * 60 * 1000;
pub const REQUEST_GAP_MS: i64 = 60 * 1000;

fn version_numbers(value: &str) -> Option<(u64, u64, u64)> {
    let value = value.strip_prefix('v').unwrap_or(value);
    let mut parts = value.split('.');
    let parse = |part: &str| -> Option<u64> {
        let digits: String = part.chars().take_while(char::is_ascii_digit).collect();

        if digits.is_empty() {
            None
        } else {
            digits.parse().ok()
        }
    };

    let major = parse(parts.next()?)?;
    let minor = parse(parts.next()?)?;
    let patch = parse(parts.next()?)?;

    Some((major, minor, patch))
}

/// Compares only the numeric `major.minor.patch` prefix; a prerelease of the
/// same numbers is therefore not newer than the released version.
pub fn is_newer(candidate: &str, current: &str) -> bool {
    match (version_numbers(candidate), version_numbers(current)) {
        (Some(next), Some(base)) => next > base,
        _ => false,
    }
}

fn required_text(value: &Value, key: &str) -> Result<String, String> {
    value
        .get(key)
        .and_then(Value::as_str)
        .filter(|text| !text.is_empty())
        .map(str::to_owned)
        .ok_or_else(|| format!("更新信息缺少 {key}"))
}

fn parse_update_info(value: &Value) -> Result<UpdateInfo, String> {
    let sha256 = required_text(value, "sha256")?;

    if sha256.len() != 64 || !sha256.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err("更新信息的校验值无效".to_string());
    }

    let size = value
        .get("size")
        .and_then(Value::as_i64)
        .filter(|size| *size >= 0)
        .ok_or_else(|| "更新信息缺少 size".to_string())?;

    let url = required_text(value, "url")?;

    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return Err("更新信息的下载地址无效".to_string());
    }

    let version = required_text(value, "version")?;

    if version.chars().any(|c| matches!(c, '/' | '\\' | ':')) {
        return Err("更新信息的版本号无效".to_string());
    }

    Ok(UpdateInfo {
        date: value
            .get("date")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        notes: value
            .get("notes")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        sha256: sha256.to_lowercase(),
        size,
        url,
        version,
    })
}

pub fn fetch_manifest() -> Result<UpdateInfo, String> {
    let agent = AgentBuilder::new().timeout(Duration::from_secs(10)).build();
    let response = agent
        .get(MANIFEST_URL)
        .call()
        .map_err(|error| format!("检查更新失败：{error}"))?;

    if response.status() != 200 {
        return Err(format!("检查更新失败（HTTP {}）", response.status()));
    }

    let payload: Value = response
        .into_json()
        .map_err(|error| format!("检查更新失败：{error}"))?;

    parse_update_info(&payload)
}

pub fn download_update_blocking(
    info: &UpdateInfo,
    data_dir: &Path,
) -> Result<DownloadedUpdate, String> {
    let agent = AgentBuilder::new()
        .timeout(Duration::from_secs(120))
        .build();
    let response = agent
        .get(info.url.as_str())
        .call()
        .map_err(|error| format!("下载更新失败：{error}"))?;

    if response.status() != 200 {
        return Err(format!("下载更新失败（HTTP {}）", response.status()));
    }

    let mut bytes = Vec::new();
    response
        .into_reader()
        .read_to_end(&mut bytes)
        .map_err(|error| error.to_string())?;

    let digest = hex::encode(Sha256::digest(&bytes));

    if digest != info.sha256.to_lowercase() {
        return Err("安装包校验失败，请稍后重试".to_string());
    }

    let directory = data_dir.join("updates");
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let target = directory.join(format!("MarkdownView-{}.exe", info.version));
    fs::write(&target, &bytes).map_err(|error| error.to_string())?;

    Ok(DownloadedUpdate {
        path: crate::files::to_string(&target),
    })
}

pub fn now_ms() -> i64 {
    persistence::now_ms()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compares_only_numeric_version_prefixes() {
        assert!(is_newer("0.5.0", "0.4.2"));
        assert!(is_newer("1.0.0-beta.1", "0.9.9"));
        assert!(!is_newer("0.4.2", "0.4.2"));
        assert!(!is_newer("0.4.2-beta.1", "0.4.2"));
        assert!(!is_newer("0.3.9", "0.4.2"));
        assert!(is_newer("v1.2.3", "0.4.2"));
        assert_eq!(version_numbers("1.2.3-rc.1"), Some((1, 2, 3)));
    }
}
