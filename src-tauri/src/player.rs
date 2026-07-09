use std::fs::File;
use std::io::BufReader;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{mpsc, Arc};
use std::time::Duration;

use rodio::{Decoder, OutputStream, Sink};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Serialize, Clone)]
pub struct PlaybackProgress {
    pub position_secs: f64,
    pub is_playing: bool,
}

enum PlayerCommand {
    Play(String),
    Pause,
    Resume,
    Stop,
    Seek(f64),
    SetVolume(f32),
}

/// `rodio`/`cpal`'s `OutputStream` holds a raw platform handle and is not
/// `Send`/`Sync`, so it can never live inside Tauri's managed `State`
/// directly. Instead a dedicated thread owns the stream + sink for its
/// entire lifetime, and this handle - which is just channels and atomics -
/// is what gets shared across command invocations.
pub struct Player {
    commands: mpsc::Sender<PlayerCommand>,
    position_millis: Arc<AtomicU64>,
    is_playing: Arc<AtomicBool>,
    just_finished: Arc<AtomicBool>,
    watcher_started: AtomicBool,
}

impl Player {
    pub fn new() -> Result<Self, String> {
        let (tx, rx) = mpsc::channel::<PlayerCommand>();
        let position_millis = Arc::new(AtomicU64::new(0));
        let is_playing = Arc::new(AtomicBool::new(false));
        let just_finished = Arc::new(AtomicBool::new(false));

        let thread_position = Arc::clone(&position_millis);
        let thread_is_playing = Arc::clone(&is_playing);
        let thread_just_finished = Arc::clone(&just_finished);

        std::thread::spawn(move || {
            audio_thread_main(rx, thread_position, thread_is_playing, thread_just_finished)
        });

        Ok(Self {
            commands: tx,
            position_millis,
            is_playing,
            just_finished,
            watcher_started: AtomicBool::new(false),
        })
    }

    fn send(&self, cmd: PlayerCommand) -> Result<(), String> {
        self.commands.send(cmd).map_err(|e| e.to_string())
    }

    pub fn play_path(&self, path: &str) -> Result<(), String> {
        self.send(PlayerCommand::Play(path.to_string()))
    }

    pub fn pause(&self) -> Result<(), String> {
        self.send(PlayerCommand::Pause)
    }

    pub fn resume(&self) -> Result<(), String> {
        self.send(PlayerCommand::Resume)
    }

    pub fn stop(&self) -> Result<(), String> {
        self.send(PlayerCommand::Stop)
    }

    pub fn seek(&self, position_secs: f64) -> Result<(), String> {
        self.send(PlayerCommand::Seek(position_secs))
    }

    pub fn set_volume(&self, volume: f32) -> Result<(), String> {
        self.send(PlayerCommand::SetVolume(volume))
    }

    pub fn progress(&self) -> Result<PlaybackProgress, String> {
        Ok(PlaybackProgress {
            position_secs: self.position_millis.load(Ordering::Relaxed) as f64 / 1000.0,
            is_playing: self.is_playing.load(Ordering::Relaxed),
        })
    }

    /// Starts a background thread (once) that forwards position + playback
    /// state to the frontend as events, since the audio thread has no
    /// direct handle back into the webview.
    pub fn ensure_watcher(self: &Arc<Self>, app: AppHandle) {
        if self.watcher_started.swap(true, Ordering::SeqCst) {
            return;
        }
        let player = Arc::clone(self);
        std::thread::spawn(move || loop {
            std::thread::sleep(Duration::from_millis(250));
            if let Ok(progress) = player.progress() {
                let _ = app.emit("player://progress", progress);
            }
            if player.just_finished.swap(false, Ordering::Relaxed) {
                let _ = app.emit("player://ended", ());
            }
        });
    }
}

/// Runs on its own OS thread for the app's whole lifetime. Owns the rodio
/// output stream/sink (neither of which can cross threads) and drains
/// commands from the channel, updating the shared atomics so other
/// threads can read position/playing-state without touching the sink.
fn audio_thread_main(
    rx: mpsc::Receiver<PlayerCommand>,
    position_millis: Arc<AtomicU64>,
    is_playing: Arc<AtomicBool>,
    just_finished: Arc<AtomicBool>,
) {
    let (_stream, stream_handle) = match OutputStream::try_default() {
        Ok(s) => s,
        Err(e) => {
            eprintln!("no audio output device available ({e}); playback commands will be no-ops");
            // Keep draining the channel forever instead of dropping `rx`:
            // dropping it would close the channel and turn every future
            // play/pause/etc. call into a confusing "sending on a closed
            // channel" error instead of a silent no-op.
            while rx.recv().is_ok() {}
            return;
        }
    };
    let mut sink: Option<Sink> = None;
    let mut volume: f32 = 1.0;
    // Tracks whether `sink` currently holds a track that was intentionally
    // stopped, so we don't mistake that for the track finishing on its own.
    let mut expect_playback = false;

    loop {
        match rx.recv_timeout(Duration::from_millis(100)) {
            Ok(PlayerCommand::Play(path)) => {
                if let Ok(file) = File::open(&path) {
                    if let Ok(source) = Decoder::new(BufReader::new(file)) {
                        if let Ok(new_sink) = Sink::try_new(&stream_handle) {
                            new_sink.set_volume(volume);
                            new_sink.append(source);
                            sink = Some(new_sink);
                            is_playing.store(true, Ordering::Relaxed);
                            position_millis.store(0, Ordering::Relaxed);
                            expect_playback = true;
                        }
                    }
                }
            }
            Ok(PlayerCommand::Pause) => {
                if let Some(s) = &sink {
                    s.pause();
                    is_playing.store(false, Ordering::Relaxed);
                }
            }
            Ok(PlayerCommand::Resume) => {
                if let Some(s) = &sink {
                    s.play();
                    is_playing.store(true, Ordering::Relaxed);
                }
            }
            Ok(PlayerCommand::Stop) => {
                if let Some(s) = sink.take() {
                    s.stop();
                }
                expect_playback = false;
                is_playing.store(false, Ordering::Relaxed);
                position_millis.store(0, Ordering::Relaxed);
            }
            Ok(PlayerCommand::Seek(secs)) => {
                if let Some(s) = &sink {
                    if s.try_seek(Duration::from_secs_f64(secs.max(0.0))).is_ok() {
                        position_millis.store((secs.max(0.0) * 1000.0) as u64, Ordering::Relaxed);
                    }
                }
            }
            Ok(PlayerCommand::SetVolume(v)) => {
                volume = v.clamp(0.0, 1.0);
                if let Some(s) = &sink {
                    s.set_volume(volume);
                }
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {}
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        }

        if let Some(s) = &sink {
            if s.empty() {
                is_playing.store(false, Ordering::Relaxed);
                if expect_playback {
                    expect_playback = false;
                    just_finished.store(true, Ordering::Relaxed);
                }
            } else if !s.is_paused() {
                position_millis.store(s.get_pos().as_millis() as u64, Ordering::Relaxed);
            }
        }
    }
}
