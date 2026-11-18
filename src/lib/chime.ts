"use client";

/**
 * Plays a pleasant, non-startling two-tone clinical notification chime
 * using the Web Audio API (no external audio assets required).
 */
export function playClaimChime(): void {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const notes = [
      { freq: 587.33, start: 0, duration: 0.18 }, // D5
      { freq: 880.0, start: 0.14, duration: 0.32 }, // A5
    ];

    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(note.freq, now + note.start);

      gain.gain.setValueAtTime(0.001, now + note.start);
      gain.gain.exponentialRampToValueAtTime(0.18, now + note.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        now + note.start + note.duration
      );

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + note.start);
      osc.stop(now + note.start + note.duration + 0.02);
    }

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 800);
  } catch {
    // Browser autoplay policy may block audio before first user gesture.
  }
}
