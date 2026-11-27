/// <reference lib="webworker" />
/**
 * The module's engine worker (`engine.ts` starts it): Doom, Emscripten's build in `assets/`, runs
 * here rather than in the page, on the games module's kit (`@games/engine`). The WADs are read from
 * EiN as Doom asks for them, a piece at a time with range requests, so a level is downloaded as it
 * is played; the player's saves and settings are given whole. Each tick runs Doom's tics that are
 * due and answers with its frame, the sound effects mixed over the music for the time since the
 * last tick, and whether Doom's menu is up. The saves Doom makes and its settings, written on Quit
 * and as its menu closes, go back to the page.
 */
import { argv, type EmscriptenModule, type Engine, FrameCanvas, heapSound, keptPath, serveEngine, startEmscripten } from '@games/engine';
import { type DoomStart, keptName } from './start.ts';

/** What the engine's platform layer exports (`engine/doomgeneric_ein.c`, `engine/ein_sound.c`), beside Emscripten's own. */
type DoomModule = EmscriptenModule & {
  _ein_start(argc: number, argv: number, sampleRate: number): void;
  _ein_tick(): void;
  _ein_key(pressed: number, key: number): void;
  _ein_save_config(): void;
  _ein_menu(): number;
  _ein_screen(): number;
  _ein_width(): number;
  _ein_height(): number;
  _ein_frames(): number;
  _ein_audio_render(at: number, frames: number): void;
};

let doom: DoomModule;
let drawn = 0;
const frames = new FrameCanvas(320, 200);
let sound: ((count: number) => Int16Array<ArrayBuffer>) | undefined;

const engine: Engine<DoomStart> = {
  async boot(boot) {
    doom = await startEmscripten<DoomModule>(boot, boot.payload, {
      // Doom names the files it writes relative to its working directory, `/`.
      written(path) {
        const at = `/${keptPath(path)}`;
        const name = keptName(at);
        return name ? { path: at, name } : undefined;
      },
    });
    // Without sound the music is made at a rate nothing asks for, and never pulled.
    if (boot.sampleRate) sound = heapSound(doom, (at, count) => doom._ein_audio_render(at, count));
    doom._ein_start(boot.payload.args.length, argv(doom, boot.payload.args), boot.sampleRate ?? 48000);
  },
  tick: () => doom._ein_tick(),
  frame() {
    if (doom._ein_frames() === drawn) return undefined;
    drawn = doom._ein_frames();
    return frames.rgba(new Uint8Array(doom.HEAPU8.buffer, doom._ein_screen()), doom._ein_width(), doom._ein_height());
  },
  sound: (count) => sound?.(count),
  key: (pressed, key) => doom._ein_key(pressed ? 1 : 0, key),
  menu: () => doom._ein_menu() !== 0,
  keep: () => doom._ein_save_config(),
};

serveEngine(engine);
