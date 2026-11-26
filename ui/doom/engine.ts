import { fileUrl } from '@ein/ui/lib';
import { type Save, type Settings, SETTINGS_FILES } from './saves.ts';
import type { SfxSink, Sound } from './sound.ts';
import { iwadFor, readWad, type Wad, WADS } from './wads.ts';

/** Where the module's built engine sits in EiN's tree. */
const ASSETS = '/usr/modules/doom/assets';

/** What `assets/doom.js` (Emscripten's glue, `engine/Containerfile`) gives back once the wasm runs. */
type DoomModule = {
  FS: {
    writeFile(path: string, data: Uint8Array | string): void;
    readFile(path: string): Uint8Array;
    readFile(path: string, options: { encoding: 'utf8' }): string;
    analyzePath(path: string): { exists: boolean };
    mkdir(path: string): void;
  };
  HEAP16: Int16Array;
  ccall(name: string, returns: null, types: string[], args: unknown[]): void;
  _malloc(bytes: number): number;
  _ein_tick(): void;
  _ein_key(pressed: number, key: number): void;
  _ein_save_config(): void;
  _ein_screen(): number;
  _ein_width(): number;
  _ein_height(): number;
  _ein_frames(): number;
  _ein_music_render(buffer: number, frames: number): void;
};

/** A running game: tick it, read its frame, hand it keys. */
export type Engine = {
  /** What it plays: the WAD chosen, and the IWAD under it when that is a PWAD. */
  wad: string;
  iwad?: string;
  width: number;
  height: number;
  /**
   * Run the tics that are due; throws when the game ends: what `quitted` recognises when the player
   * chose Quit, anything else when it failed (Doom's `I_Error`).
   */
  tick(): void;
  /** How many frames the game has drawn: a new number means a new frame to copy. */
  frames(): number;
  /** Copy the current frame into `image`, which is `width` by `height`. */
  draw(image: ImageData): void;
  key(pressed: boolean, key: number): void;
  /** Doom's settings files as the game has them: what Quit wrote, or with `write`, written now. */
  settings(write?: boolean): Settings[];
};

/** Whether `error`, thrown by `tick`, is the game ending on Quit: Emscripten's `ExitStatus` for exit(0). */
export function quitted(error: unknown): boolean {
  const exit = error as { name?: string; status?: number } | null;
  return exit?.name === 'ExitStatus' && exit.status === 0;
}

/**
 * Where Doom keeps its saves in its file system: doomgeneric's `.savegame/` under the working
 * directory, which is `/`, as `doomsav<slot>.dsg`.
 */
const SAVES = '/.savegame';

/**
 * Where Doom keeps a settings file in its file system: doomgeneric joins its configuration directory,
 * `.`, to the file's name as it does to `savegame/`, so `default.cfg` is `/.default.cfg`.
 */
const settingsAt = (name: string) => `/.${name}`;

/** Fetch a file as bytes; `/file/` needs the session's cookie, which a same-origin fetch sends. */
async function fetchFile(path: string): Promise<Uint8Array> {
  const response = await fetch(fileUrl(path));
  if (!response.ok) throw new Error(`${path}: ${response.status} ${response.statusText}`);
  return new Uint8Array(await response.arrayBuffer());
}

/**
 * Load the engine and `wad` and start the game; `wads` are the others there are, to find the
 * IWAD a PWAD is played with. `log` gets what Doom prints, line by line, and `sound` the game's
 * sound effects and music; without it the game is silent. `saves` are the player's saved games of
 * `wad`, which Doom's Load Game lists, and `onSave` hears each game Doom saves. `settings` are the
 * player's settings files, which Doom reads as it starts.
 *
 * The glue is imported from a URL held in a variable, so core's bundler leaves it alone and the
 * browser loads it at runtime. The wasm is fetched here and handed over as bytes, so how `/file/`
 * labels a `.wasm` does not matter.
 */
export async function startEngine({ wad, wads, sound, log, saves = [], onSave, settings = [] }: {
  wad: Wad;
  wads: Wad[];
  sound?: Sound;
  log: (line: string) => void;
  saves?: Save[];
  onSave?: (save: Save) => void;
  settings?: Settings[];
}): Promise<Engine> {
  const glueUrl = fileUrl(`${ASSETS}/doom.js`);
  const [glue, wasmBinary, bytes] = await Promise.all([
    import(glueUrl) as Promise<{ default: (options: object) => Promise<DoomModule> }>,
    fetchFile(`${ASSETS}/doom.wasm`),
    fetchFile(`${WADS}/${wad.name}`),
  ]);

  const header = readWad(bytes);
  let iwad: Wad | undefined;
  let iwadBytes: Uint8Array | undefined;
  if (header.kind === 'PWAD') {
    iwad = iwadFor(header, wads);
    if (!iwad) throw new Error(`${wad.name} adds to a game, and there is no IWAD here for it: drop doom2.wad or doom.wad on the page, or have Freedoom fetched again`);
    iwadBytes = await fetchFile(`${WADS}/${iwad.name}`);
  }

  const einSound: SfxSink | undefined = sound?.sfx;
  // Called by `ein_saved` once Doom has written the slot's file; `doom` is set by then.
  const einSaved = (slot: number) => onSave?.({ slot, bytes: doom.FS.readFile(`${SAVES}/doomsav${slot}.dsg`) });
  const doom = await glue.default({ wasmBinary, print: log, printErr: log, einSound, einSaved });
  // Without sound the music is made at a rate nothing asks for, and never pulled.
  const sampleRate = sound?.context.sampleRate ?? 48000;
  doom.FS.mkdir(SAVES);
  for (const save of saves) doom.FS.writeFile(`${SAVES}/doomsav${save.slot}.dsg`, save.bytes);
  // The settings go where Doom reads them, its working directory, but for the sample rate, which is
  // this browser's (ein_start), not that of the one they were written in.
  for (const file of settings) doom.FS.writeFile(settingsAt(file.name), file.text.replace(/^snd_samplerate\s.*$/m, ''));
  // The engine's file system is its own, in memory: the WADs go in under their own names, which
  // is what Doom tells its games apart by.
  if (iwad && iwadBytes) {
    doom.FS.writeFile(`/${iwad.name}`, iwadBytes);
    doom.FS.writeFile(`/${wad.name}`, bytes);
    doom.ccall('ein_start', null, ['string', 'string', 'number'], [`/${iwad.name}`, `/${wad.name}`, sampleRate]);
  } else {
    doom.FS.writeFile(`/${wad.name}`, bytes);
    doom.ccall('ein_start', null, ['string', 'string', 'number'], [`/${wad.name}`, '', sampleRate]);
  }

  // The music: interleaved 16-bit stereo from the emulated OPL, into a buffer kept for it.
  let musicFrames = 0;
  let musicBuffer = 0;
  sound?.music((left, right) => {
    if (left.length > musicFrames) {
      musicFrames = left.length;
      musicBuffer = doom._malloc(musicFrames * 4);
    }
    doom._ein_music_render(musicBuffer, left.length);
    // HEAP16 is looked up each time: memory growth replaces it.
    const samples = doom.HEAP16.subarray(musicBuffer >> 1, (musicBuffer >> 1) + left.length * 2);
    for (let i = 0; i < left.length; i++) {
      left[i] = samples[i * 2] / 32768;
      right[i] = samples[i * 2 + 1] / 32768;
    }
  });

  const width = doom._ein_width();
  const height = doom._ein_height();
  return {
    wad: wad.name,
    ...(iwad ? { iwad: iwad.name } : {}),
    width,
    height,
    tick: () => doom._ein_tick(),
    frames: () => doom._ein_frames(),
    draw(image) {
      // Doom's pixels are 0x00RRGGBB words; ImageData wants R, G, B, A bytes, which read as one
      // little-endian word is 0xAABBGGRR. The heap is looked up each time: memory growth replaces it.
      const screen = new Uint32Array(doom.HEAP16.buffer, doom._ein_screen(), width * height);
      const out = new Uint32Array(image.data.buffer);
      for (let i = 0; i < screen.length; i++) {
        const pixel = screen[i];
        out[i] = 0xff000000 | ((pixel & 0xff) << 16) | (pixel & 0xff00) | ((pixel >>> 16) & 0xff);
      }
    },
    key: (pressed, key) => doom._ein_key(pressed ? 1 : 0, key),
    settings(write) {
      if (write) doom._ein_save_config();
      return SETTINGS_FILES.filter((name) => doom.FS.analyzePath(settingsAt(name)).exists)
        .map((name) => ({ name, text: doom.FS.readFile(settingsAt(name), { encoding: 'utf8' }) }));
    },
  };
}
