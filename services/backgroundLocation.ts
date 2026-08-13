// services/backgroundLocation.ts

let audioContext: AudioContext | null = null;
let silentOscillator: OscillatorNode | null = null;
let locationWorker: Worker | null = null;

/**
 * Starts background audio keep-alive and a dedicated Web Worker timer.
 * On mobile operating systems (iOS Safari & Android Chrome), maintaining an active
 * background audio media session prevents CPU/JS suspension when the device is locked or app is in background.
 */
export const startBackgroundKeepAlive = (onTick?: () => void) => {
  if (typeof window === 'undefined') return;

  // 1. Silent Web Audio Engine to keep mobile CPU and JS event loop alive when locked
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      if (!audioContext || audioContext.state === 'closed') {
        audioContext = new AudioCtx();
      }
      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {});
      }

      if (!silentOscillator && audioContext) {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        gain.gain.value = 0.00001; // Virtually silent
        osc.type = 'sine';
        osc.frequency.value = 440;
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.start();
        silentOscillator = osc;
      }

      // Configure MediaSession API to prevent OS background suspension
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: 'Downey Cleaning - Active Shift',
          artist: 'GPS Location Tracking Active',
          album: 'Background Geofence Monitoring'
        });
        navigator.mediaSession.playbackState = 'playing';
      }
    }
  } catch (err) {
    console.warn("Background Audio Keep-Alive error:", err);
  }

  // 2. Off-Thread Dedicated Web Worker for background timing ticks (immune to main-thread DOM throttling)
  try {
    if (!locationWorker) {
      const workerBlob = new Blob([`
        let intervalId = null;
        self.onmessage = function(e) {
          if (e.data === 'start') {
            if (intervalId) clearInterval(intervalId);
            intervalId = setInterval(function() {
              self.postMessage('tick');
            }, 5000); // 5-second location check interval
          } else if (e.data === 'stop') {
            if (intervalId) {
              clearInterval(intervalId);
              intervalId = null;
            }
          }
        };
      `], { type: 'application/javascript' });

      locationWorker = new Worker(URL.createObjectURL(workerBlob));
      locationWorker.onmessage = (e) => {
        if (e.data === 'tick' && onTick) {
          onTick();
        }
      };
    }
    locationWorker.postMessage('start');
  } catch (err) {
    console.warn("Location Web Worker error:", err);
  }
};

/**
 * Stops background keep-alive audio and worker timers.
 */
export const stopBackgroundKeepAlive = () => {
  if (typeof window === 'undefined') return;

  try {
    if (silentOscillator) {
      silentOscillator.stop();
      silentOscillator.disconnect();
      silentOscillator = null;
    }
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close();
      audioContext = null;
    }
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'none';
    }
  } catch (err) {
    console.warn("Stop background audio error:", err);
  }

  try {
    if (locationWorker) {
      locationWorker.postMessage('stop');
      locationWorker.terminate();
      locationWorker = null;
    }
  } catch (err) {
    console.warn("Stop worker error:", err);
  }
};
