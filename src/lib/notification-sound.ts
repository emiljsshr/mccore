/**
 * A short, synthesized two-tone chime for live activity notifications — no
 * external audio asset (nothing to license, nothing to fetch), generated
 * on the fly with the Web Audio API. Browsers that block audio without a
 * prior user gesture, or don't support AudioContext at all, just get no
 * sound; that's not worth surfacing as an error.
 */
let audioContext: AudioContext | null = null;

export function playNotificationSound(): void {
  if (typeof window === "undefined") return;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audioContext ??= new Ctor();
    const ctx = audioContext;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1318.5, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  } catch {
    // Autoplay restrictions, a suspended context, etc. — non-fatal.
  }
}
