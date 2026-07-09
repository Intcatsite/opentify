use serde::{Deserialize, Serialize};

use super::GenrePrediction;

#[derive(Serialize)]
struct ChatMessage<'a> {
    role: &'a str,
    content: &'a str,
}

#[derive(Serialize)]
struct ChatRequest<'a> {
    model: &'a str,
    messages: Vec<ChatMessage<'a>>,
    temperature: f32,
}

#[derive(Deserialize)]
struct ChatChoice {
    message: ChatResponseMessage,
}

#[derive(Deserialize)]
struct ChatResponseMessage {
    content: String,
}

#[derive(Deserialize)]
struct ChatResponse {
    choices: Vec<ChatChoice>,
}

/// Calls a user-supplied OpenAI-compatible `/chat/completions` endpoint to
/// guess a track's genre from its metadata. Only the title/artist text is
/// sent - the audio file itself never leaves the machine.
pub async fn classify_genre(
    endpoint: &str,
    api_key: &str,
    model: &str,
    title: &str,
    artist: &str,
) -> Result<GenrePrediction, String> {
    let client = reqwest::Client::new();
    let prompt = format!(
        "Reply with a single word: the most likely music genre for a track titled \"{title}\" by \"{artist}\". No punctuation, no explanation."
    );

    let body = ChatRequest {
        model,
        messages: vec![ChatMessage {
            role: "user",
            content: &prompt,
        }],
        temperature: 0.0,
    };

    let url = format!("{}/chat/completions", endpoint.trim_end_matches('/'));
    let response = client
        .post(url)
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("cloud AI request failed ({status}): {text}"));
    }

    let parsed: ChatResponse = response.json().await.map_err(|e| e.to_string())?;
    let genre = parsed
        .choices
        .first()
        .map(|c| c.message.content.trim().to_string())
        .ok_or("empty response from cloud provider")?;

    Ok(GenrePrediction {
        genre,
        confidence: 1.0,
        source: format!("cloud: {model}"),
    })
}
