use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "mode", rename_all = "snake_case")]
pub enum AiProviderConfig {
    /// AI features (genre tagging, recommendations) are disabled entirely.
    None,
    /// Genre classification runs fully offline via the embedded/trained
    /// local model - no network calls, no data ever leaves the machine.
    Local,
    /// User brings their own OpenAI-compatible endpoint (OpenAI, a local
    /// Ollama server, OpenRouter, etc). The API key never leaves the
    /// request made directly from this app to that endpoint.
    Cloud {
        endpoint: String,
        api_key: String,
        model: String,
    },
}

impl Default for AiProviderConfig {
    fn default() -> Self {
        AiProviderConfig::None
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppSettings {
    pub ai_provider: AiProviderConfig,
    pub theme: Option<String>,
}

pub struct SettingsState {
    pub inner: Mutex<AppSettings>,
    pub data_file: PathBuf,
}

impl SettingsState {
    pub fn new(data_dir: &Path) -> Self {
        let data_file = data_dir.join("settings.json");
        let inner = fs::read_to_string(&data_file)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();
        Self {
            inner: Mutex::new(inner),
            data_file,
        }
    }

    pub fn persist(&self) -> Result<(), String> {
        let settings = self.inner.lock().map_err(|e| e.to_string())?;
        if let Some(parent) = self.data_file.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let json = serde_json::to_string_pretty(&*settings).map_err(|e| e.to_string())?;
        fs::write(&self.data_file, json).map_err(|e| e.to_string())
    }
}
