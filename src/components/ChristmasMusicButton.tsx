import React, { useEffect, useRef, useState } from 'react';
import { Music, Pause, Play, Snowflake } from 'lucide-react';

interface PianoNoteEvent {
  freq: number;
  beats: number;
  leftHand?: number[];
}

// Soft solo piano arrangement of "Noite Feliz" (Silent Night) in C major
const PIANO_SEQUENCE: PianoNoteEvent[] = [
  { freq: 392.0, beats: 1.5, leftHand: [130.81, 196.0, 261.63] },
  { freq: 440.0, beats: 0.5 },
  { freq: 392.0, beats: 1.0, leftHand: [329.63] },
  { freq: 329.63, beats: 3.0, leftHand: [130.81, 196.0, 261.63] },

  { freq: 392.0, beats: 1.5, leftHand: [130.81, 196.0, 261.63] },
  { freq: 440.0, beats: 0.5 },
  { freq: 392.0, beats: 1.0, leftHand: [329.63] },
  { freq: 329.63, beats: 3.0, leftHand: [130.81, 196.0, 261.63] },

  { freq: 587.33, beats: 2.0, leftHand: [98.0, 196.0, 246.94] },
  { freq: 587.33, beats: 1.0, leftHand: [293.66] },
  { freq: 493.88, beats: 3.0, leftHand: [98.0, 196.0, 246.94] },

  { freq: 523.25, beats: 2.0, leftHand: [130.81, 196.0, 261.63] },
  { freq: 523.25, beats: 1.0, leftHand: [329.63] },
  { freq: 392.0, beats: 3.0, leftHand: [130.81, 196.0, 261.63] },

  { freq: 440.0, beats: 2.0, leftHand: [174.61, 220.0, 261.63] },
  { freq: 440.0, beats: 1.0, leftHand: [349.23] },
  { freq: 523.25, beats: 1.5, leftHand: [174.61, 220.0] },
  { freq: 493.88, beats: 0.5 },
  { freq: 440.0, beats: 1.0, leftHand: [261.63] },

  { freq: 392.0, beats: 1.5, leftHand: [130.81, 196.0, 261.63] },
  { freq: 440.0, beats: 0.5 },
  { freq: 392.0, beats: 1.0, leftHand: [329.63] },
  { freq: 329.63, beats: 3.0, leftHand: [130.81, 196.0, 261.63] },

  { freq: 440.0, beats: 2.0, leftHand: [174.61, 220.0, 261.63] },
  { freq: 440.0, beats: 1.0, leftHand: [349.23] },
  { freq: 523.25, beats: 1.5, leftHand: [174.61, 220.0] },
  { freq: 493.88, beats: 0.5 },
  { freq: 440.0, beats: 1.0, leftHand: [261.63] },

  { freq: 392.0, beats: 1.5, leftHand: [130.81, 196.0, 261.63] },
  { freq: 440.0, beats: 0.5 },
  { freq: 392.0, beats: 1.0, leftHand: [329.63] },
  { freq: 329.63, beats: 3.0, leftHand: [130.81, 196.0, 261.63] },

  { freq: 587.33, beats: 2.0, leftHand: [98.0, 196.0, 246.94] },
  { freq: 587.33, beats: 1.0, leftHand: [293.66] },
  { freq: 698.46, beats: 1.5, leftHand: [98.0, 174.61, 246.94] },
  { freq: 587.33, beats: 0.5 },
  { freq: 493.88, beats: 1.0, leftHand: [196.0] },

  { freq: 523.25, beats: 3.0, leftHand: [130.81, 196.0, 261.63] },
  { freq: 659.25, beats: 3.0, leftHand: [130.81, 196.0, 329.63] },

  { freq: 523.25, beats: 1.5, leftHand: [130.81, 196.0, 261.63] },
  { freq: 392.0, beats: 0.5 },
  { freq: 329.63, beats: 1.0 },
  { freq: 392.0, beats: 1.5, leftHand: [98.0, 174.61, 246.94] },
  { freq: 349.23, beats: 0.5 },
  { freq: 293.66, beats: 1.0 },

  { freq: 261.63, beats: 4.5, leftHand: [130.81, 196.0, 261.63] },
];

const BEAT_DURATION_SEC = 0.66;

export const ChristmasMusicButton: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const timerRef = useRef<number | null>(null);
  const noteIndexRef = useRef(0);
  const isPlayingRef = useRef(false);
  const userPausedRef = useRef(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const stopAudioLoop = () => {
    isPlayingRef.current = false;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (masterGainRef.current && audioCtxRef.current) {
      const now = audioCtxRef.current.currentTime;
      masterGainRef.current.gain.cancelScheduledValues(now);
      masterGainRef.current.gain.setTargetAtTime(0.0001, now, 0.12);
    }
  };

  const playPianoNote = (
    ctx: AudioContext,
    destination: AudioNode,
    freq: number,
    delayOffsetSec: number,
    sustainSec: number,
    velocity: number
  ) => {
    const start = ctx.currentTime + delayOffsetSec;
    const releaseTail = Math.max(1.2, sustainSec + 0.85);

    const stringFilter = ctx.createBiquadFilter();
    stringFilter.type = 'lowpass';
    stringFilter.frequency.setValueAtTime(Math.min(4800, freq * 7.5), start);
    stringFilter.frequency.exponentialRampToValueAtTime(
      Math.max(420, freq * 1.9),
      start + Math.min(1.1, sustainSec * 0.8)
    );

    const voiceGain = ctx.createGain();
    voiceGain.gain.setValueAtTime(0.0001, start);
    voiceGain.gain.linearRampToValueAtTime(velocity, start + 0.011);
    voiceGain.gain.exponentialRampToValueAtTime(velocity * 0.42, start + 0.28);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, start + releaseTail);

    const partials: Array<{ mult: number; amp: number; type: OscillatorType; detune: number }> = [
      { mult: 1, amp: 0.62, type: 'triangle', detune: -1.5 },
      { mult: 1, amp: 0.45, type: 'sine', detune: 1.5 },
      { mult: 2, amp: 0.28, type: 'sine', detune: 0.8 },
      { mult: 3, amp: 0.14, type: 'sine', detune: -0.6 },
      { mult: 4, amp: 0.06, type: 'sine', detune: 0 },
    ];

    partials.forEach((p) => {
      const osc = ctx.createOscillator();
      const partialGain = ctx.createGain();
      osc.type = p.type;
      osc.frequency.setValueAtTime(freq * p.mult, start);
      osc.detune.setValueAtTime(p.detune, start);

      partialGain.gain.setValueAtTime(p.amp, start);
      if (p.mult > 1) {
        partialGain.gain.exponentialRampToValueAtTime(
          0.01,
          start + releaseTail / (p.mult * 0.85)
        );
      }

      osc.connect(partialGain);
      partialGain.connect(stringFilter);
      osc.start(start);
      osc.stop(start + releaseTail + 0.08);
    });

    stringFilter.connect(voiceGain);
    voiceGain.connect(destination);
  };

  const scheduleNextNote = () => {
    if (!isPlayingRef.current || !audioCtxRef.current || !masterGainRef.current) return;

    const ctx = audioCtxRef.current;
    const note = PIANO_SEQUENCE[noteIndexRef.current];
    const durationSec = note.beats * BEAT_DURATION_SEC;

    playPianoNote(ctx, masterGainRef.current, note.freq, 0, durationSec, 0.15);

    if (note.leftHand) {
      note.leftHand.forEach((bassFreq, i) => {
        playPianoNote(
          ctx,
          masterGainRef.current!,
          bassFreq,
          i * 0.035,
          durationSec * 1.45,
          0.075
        );
      });
    }

    noteIndexRef.current = (noteIndexRef.current + 1) % PIANO_SEQUENCE.length;

    timerRef.current = window.setTimeout(() => {
      scheduleNextNote();
    }, durationSec * 1000);
  };

  const ensureAudioContext = () => {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!audioCtxRef.current) {
      const ctx = new AudioCtx();
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.9, ctx.currentTime);

      const delay = ctx.createDelay(0.5);
      delay.delayTime.setValueAtTime(0.11, ctx.currentTime);
      const delayFeedback = ctx.createGain();
      delayFeedback.gain.setValueAtTime(0.18, ctx.currentTime);
      const wetFilter = ctx.createBiquadFilter();
      wetFilter.type = 'lowpass';
      wetFilter.frequency.setValueAtTime(1400, ctx.currentTime);

      master.connect(ctx.destination);
      master.connect(delay);
      delay.connect(wetFilter);
      wetFilter.connect(delayFeedback);
      delayFeedback.connect(delay);
      wetFilter.connect(ctx.destination);

      audioCtxRef.current = ctx;
      masterGainRef.current = master;
    }

    return audioCtxRef.current;
  };

  const startAudioLoop = async () => {
    if (isPlayingRef.current) return true;
    const ctx = ensureAudioContext();
    if (!ctx) return false;

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        return false;
      }
    }

    if ((ctx.state as string) !== 'running') {
      return false;
    }

    if (masterGainRef.current) {
      const now = ctx.currentTime;
      masterGainRef.current.gain.cancelScheduledValues(now);
      masterGainRef.current.gain.setTargetAtTime(0.9, now, 0.05);
    }

    isPlayingRef.current = true;
    setIsPlaying(true);
    scheduleNextNote();
    return true;
  };

  // Attempt automatic playback on page load; if blocked by browser policy, start on first interaction anywhere
  useEffect(() => {
    let unlocked = false;

    const removeUnlockListeners = () => {
      window.removeEventListener('pointerdown', handleFirstInteraction, true);
      window.removeEventListener('keydown', handleFirstInteraction, true);
      window.removeEventListener('touchstart', handleFirstInteraction, true);
    };

    const handleFirstInteraction = async (event: Event) => {
      if (unlocked || userPausedRef.current) return;
      if (buttonRef.current && event.target instanceof Node && buttonRef.current.contains(event.target)) {
        return;
      }
      const started = await startAudioLoop();
      if (started) {
        unlocked = true;
        removeUnlockListeners();
      }
    };

    (async () => {
      const startedImmediately = await startAudioLoop();
      if (startedImmediately) {
        unlocked = true;
      } else {
        window.addEventListener('pointerdown', handleFirstInteraction, { capture: true, passive: true });
        window.addEventListener('keydown', handleFirstInteraction, { capture: true, passive: true });
        window.addEventListener('touchstart', handleFirstInteraction, { capture: true, passive: true });
      }
    })();

    return () => {
      removeUnlockListeners();
      stopAudioLoop();
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const togglePlay = async () => {
    if (isPlaying) {
      userPausedRef.current = true;
      stopAudioLoop();
      setIsPlaying(false);
    } else {
      userPausedRef.current = false;
      await startAudioLoop();
    }
  };

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={togglePlay}
      aria-label={isPlaying ? 'Pausar piano natalino' : 'Tocar piano natalino'}
      aria-pressed={isPlaying}
      title={isPlaying ? 'Pausar piano de Natal' : 'Tocar piano de Natal'}
      className="fixed bottom-20 left-3 z-40 inline-flex items-center gap-2 rounded-full border border-[#F9A8D4]/75 bg-[#3A140A]/90 px-3 py-2 text-xs font-medium text-[#FFF5F8] shadow-lg backdrop-blur-sm transition-transform duration-200 hover:scale-105 hover:bg-[#4F2012] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D81B60] lg:bottom-4 lg:left-4 lg:px-3.5"
    >
      <Snowflake
        className={`h-3.5 w-3.5 text-[#F9A8D4] ${isPlaying ? 'animate-spin' : ''}`}
        style={isPlaying ? { animationDuration: '6s' } : undefined}
        aria-hidden="true"
      />
      <Music className="h-3.5 w-3.5 text-[#FEF08A]" aria-hidden="true" />
      <span className="hidden sm:inline whitespace-nowrap">
        {isPlaying ? 'Piano de Natal' : 'Som Natalino'}
      </span>
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#D81B60] text-white">
        {isPlaying ? (
          <Pause className="h-3 w-3" aria-hidden="true" />
        ) : (
          <Play className="h-3 w-3 translate-x-[0.5px]" aria-hidden="true" />
        )}
      </span>
    </button>
  );
};
