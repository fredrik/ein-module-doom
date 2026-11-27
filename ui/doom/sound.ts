import type { Sound } from '@games/adapter';

/**
 * Doom's sound effects on the games module's `Sound`. They are short 8-bit clips in the WAD; the
 * engine hands each over once (`load`) and then plays it on one of its channels with a volume and a
 * stereo separation, as the DOS sound card did. The music is the engine's own, pulled as the
 * game's effects are (`Sound.effects`, `engine.ts`).
 */

/** What the engine calls (`engine/ein_sound.c`); handed to the Emscripten module as `einSound`. */
type SfxSink = {
  load(lump: number, samples: Uint8Array, rate: number): void;
  start(channel: number, lump: number, volume: number, separation: number): void;
  update(channel: number, volume: number, separation: number): void;
  stop(channel: number): void;
  playing(channel: number): boolean;
};

/** A clip on a channel: its source, and the nodes that set its volume and side. */
type Voice = { source: AudioBufferSourceNode; gain: GainNode; pan: StereoPannerNode; done: boolean };

/** The sink the engine plays its effects into: each clip a source of `sound`'s, through `sound.output`, which mutes and holds them with the rest. */
export function sfxSink({ context, output }: Sound): SfxSink {
  const clips = new Map<number, AudioBuffer>();
  const voices = new Map<number, Voice>();

  // Doom's volume is 0 to 127; its separation 0 (left) to 254 (right), 128 the middle.
  const level = (volume: number) => Math.max(0, Math.min(127, volume)) / 127;
  const side = (separation: number) => Math.max(-1, Math.min(1, (separation - 128) / 127));

  const stop = (channel: number) => {
    const voice = voices.get(channel);
    if (!voice) return;
    voices.delete(channel);
    voice.source.onended = null;
    try {
      voice.source.stop();
    } catch {
      // Stopping a source that already ended throws in some browsers; it is stopped either way.
    }
    voice.source.disconnect();
    voice.gain.disconnect();
  };

  return {
    load(lump, samples, rate) {
      // Unsigned 8-bit, 128 the silence.
      const buffer = context.createBuffer(1, Math.max(1, samples.length), rate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) data[i] = (samples[i] - 128) / 128;
      clips.set(lump, buffer);
    },
    start(channel, lump, volume, separation) {
      stop(channel);
      const buffer = clips.get(lump);
      if (!buffer) return;
      const source = context.createBufferSource();
      source.buffer = buffer;
      const gain = context.createGain();
      gain.gain.value = level(volume);
      const pan = context.createStereoPanner();
      pan.pan.value = side(separation);
      source.connect(gain).connect(pan).connect(output);
      const voice: Voice = { source, gain, pan, done: false };
      source.onended = () => {
        voice.done = true;
        if (voices.get(channel) === voice) stop(channel);
      };
      voices.set(channel, voice);
      source.start();
    },
    update(channel, volume, separation) {
      const voice = voices.get(channel);
      if (!voice) return;
      voice.gain.gain.value = level(volume);
      voice.pan.pan.value = side(separation);
    },
    stop,
    playing: (channel) => {
      const voice = voices.get(channel);
      return !!voice && !voice.done;
    },
  };
}
