/* ==========================================================================
   WHEELO - Web Audio API Synthetic Sound Engine
   ========================================================================== */

const WheeloAudio = (function () {
  let audioCtx = null;
  let isMuted = false;

  function initAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function toggleMute() {
    isMuted = !isMuted;
    return isMuted;
  }

  function playTone(freq, type = 'sine', duration = 0.2, gainValue = 0.15) {
    if (isMuted) return;
    try {
      initAudioContext();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

      gain.gain.setValueAtTime(gainValue, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.warn('Audio synthesis warning:', e);
    }
  }

  // Sound Cue 1: Booking Confirmed (Ascending Arpeggio)
  function playBookingChime() {
    if (isMuted) return;
    [440, 554, 659, 880].forEach((freq, idx) => {
      setTimeout(() => playTone(freq, 'sine', 0.25, 0.2), idx * 80);
    });
  }

  // Sound Cue 2: Driver Incoming Alert (Notification Ping)
  function playIncomingAlert() {
    if (isMuted) return;
    playTone(587.33, 'triangle', 0.2, 0.25);
    setTimeout(() => playTone(880, 'sine', 0.3, 0.25), 150);
  }

  // Sound Cue 3: OTP PIN Success (Harmonic Chord)
  function playOtpSuccess() {
    if (isMuted) return;
    [523.25, 659.25, 783.99].forEach(freq => playTone(freq, 'sine', 0.35, 0.15));
  }

  // Sound Cue 4: Trip Completion Fanfare
  function playTripCompleteSound() {
    if (isMuted) return;
    [659, 659, 659, 523, 659, 783].forEach((freq, idx) => {
      setTimeout(() => playTone(freq, 'sine', 0.2, 0.2), idx * 120);
    });
  }

  // Sound Cue 5: Emergency SOS Siren (Oscillating Frequency)
  function playSiren() {
    if (isMuted) return;
    try {
      initAudioContext();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sawtooth';
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);

      osc.frequency.setValueAtTime(600, audioCtx.currentTime);
      osc.frequency.linearRampToValueAtTime(1200, audioCtx.currentTime + 0.4);
      osc.frequency.linearRampToValueAtTime(600, audioCtx.currentTime + 0.8);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.8);
    } catch (e) {}
  }

  return {
    toggleMute,
    isMuted: () => isMuted,
    playBookingChime,
    playIncomingAlert,
    playOtpSuccess,
    playTripCompleteSound,
    playSiren
  };
})();
