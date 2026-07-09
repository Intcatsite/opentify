use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Track {
    pub id: String,
    pub path: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub genre: Option<String>,
    pub duration_secs: f64,
    pub track_no: Option<u32>,
    pub year: Option<u32>,
    pub cover_data_url: Option<String>,
    /// Genre predicted by the local/cloud AI classifier, kept separate from
    /// tag-embedded genre so the user can tell the two apart in the UI.
    pub ai_genre: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TrackMetadataUpdate {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub genre: Option<String>,
    /// A `data:` URL for a newly picked cover image, if the user chose
    /// one; `None` leaves the existing cover art untouched. Callers
    /// convert the picked file to a data URL themselves (see the
    /// `read_image_as_data_url` command) so this type doesn't care
    /// whether the image came from a filesystem path or a browser File.
    pub cover_data_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Playlist {
    pub id: String,
    pub name: String,
    pub track_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Library {
    pub tracks: Vec<Track>,
    pub playlists: Vec<Playlist>,
    pub watched_folders: Vec<String>,
}
