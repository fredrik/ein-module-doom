import { fileUrl } from '@ein/ui/lib';
import { type Kept, quitted, type StartOptions } from '@games/adapter';
import type { Wad } from '../../lib/api.ts';
import { sfxSink } from './sound.ts';

/** Where the module's built engine sits in EiN's tree. */
const ASSETS = '/usr/modules/doom/assets';

/** What `assets/doom.js` (Emscripten's glue, `engine/Containerfile`) gives back once the wasm runs. */
type DoomModule = {
  FS: {
    writeFile(path: string, data: Uint8Array | string): void;
    readFile(path: string): Uint8Array<ArrayBuffer>;
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
type Engine = {
  width: number;
  height: number;
  /**
   * Run the tics that are due; throws when the game ends: what `quitted` recognises when the player
   * chose Quit, which has written the settings and kept them, anything else when it failed (Doom's
   * `I_Error`).
   */
  tick(): void;
  /** How many frames the game has drawn: a new number means a new frame to copy. */
  frames(): number;
  /** Copy the current frame into `image`, which is `width` by `height`. */
  draw(image: ImageData): void;
  key(pressed: boolean, key: number): void;
  /** Write Doom's settings now, as Quit does, and keep them; nothing once the game has ended. */
  keepSettings(): void;
};

/**
 * Where Doom keeps its saves in its file system: doomgeneric's `.savegame/` under the working
 * directory, which is `/`, as `doomsav<slot>.dsg`. The player keeps them in their saves folder as
 * `doomsav<slot>.dsg`.
 */
const SAVES = '/.savegame';
const SAVE_FILE = /^doomsav\d\.dsg$/;

/**
 * Doom's settings files, as it writes them on Quit: `default.cfg`, its own (keys, volumes, screen
 * size, messages), and `doomgenericdoom.cfg`, Chocolate Doom's further ones. The player keeps them
 * in their saves folder under these names.
 */
const SETTINGS_FILES = ['default.cfg', 'doomgenericdoom.cfg'];

/**
 * The files the player keeps of a game, by their paths in their saves folder of it: its saves and
 * its settings files (the adapter's `kept`).
 */
export const KEPT = /^(doomsav\d\.dsg|default\.cfg|doomgenericdoom\.cfg)$/;

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
 * Load the engine and `game`'s WAD, and the IWAD under it when it is a PWAD, and start the game.
 * `log` gets what Doom prints, line by line, and `sound` the game's sound effects and music; without
 * it the game is silent. `kept` are the player's saved games of the WAD, which Doom's Load Game
 * lists, and their settings files, which Doom reads as it starts; `onKeep` hears each game Doom saves
 * and its settings when it writes them.
 *
 * The glue is imported from a URL held in a variable, so core's bundler leaves it alone and the
 * browser loads it at runtime. The wasm is fetched here and handed over as bytes, so how `/file/`
 * labels a `.wasm` does not matter.
 */
export async function startEngine({ game, sound, log, kept, onKeep }: Pick<StartOptions<Wad>, 'game' | 'sound' | 'log' | 'kept' | 'onKeep'>): Promise<Engine> {
  if (game.otherGame) {
    throw new Error(`${game.id} is ${game.otherGame}, not Doom. Doom plays Doom's games only: Doom, Doom II, Final Doom and Freedoom, and WADs made for them.`);
  }
  if (game.kind === 'PWAD' && !game.iwad) {
    throw new Error(`${game.id} adds to a game, and there is no IWAD here for it: drop doom2.wad or doom.wad on the Games page, or have Freedoom fetched again`);
  }
  const folder = game.path.slice(0, game.path.lastIndexOf('/'));
  const glueUrl = fileUrl(`${ASSETS}/doom.js`);
  const [glue, wasmBinary, bytes, iwadBytes] = await Promise.all([
    import(glueUrl) as Promise<{ default: (options: object) => Promise<DoomModule> }>,
    fetchFile(`${ASSETS}/doom.wasm`),
    fetchFile(game.path),
    game.iwad ? fetchFile(`${folder}/${game.iwad}`) : undefined,
  ]);

  const einSound = sound && sfxSink(sound);
  // Called by `ein_saved` once Doom has written the slot's file; `doom` is set by then.
  const einSaved = (slot: number) => onKeep?.({ files: [{ name: `doomsav${slot}.dsg`, data: doom.FS.readFile(`${SAVES}/doomsav${slot}.dsg`) }] });
  const doom = await glue.default({ wasmBinary, print: log, printErr: log, einSound, einSaved });
  // Without sound the music is made at a rate nothing asks for, and never pulled.
  const sampleRate = sound?.context.sampleRate ?? 48000;
  doom.FS.mkdir(SAVES);
  const settingsText = (file: Kept) => new TextDecoder().decode(file.data);
  for (const file of kept) {
    if (SAVE_FILE.test(file.name)) doom.FS.writeFile(`${SAVES}/${file.name}`, file.data);
    // The settings go where Doom reads them, its working directory, but for the sample rate, which is
    // this browser's (ein_start), not that of the one they were written in.
    else if (SETTINGS_FILES.includes(file.name)) doom.FS.writeFile(settingsAt(file.name), settingsText(file).replace(/^snd_samplerate\s.*$/m, ''));
  }
  // The engine's file system is its own, in memory: the WADs go in under their own names, which
  // is what Doom tells its games apart by.
  doom.FS.writeFile(`/${game.id}`, bytes);
  if (game.iwad && iwadBytes) {
    doom.FS.writeFile(`/${game.iwad}`, iwadBytes);
    doom.ccall('ein_start', null, ['string', 'string', 'number'], [`/${game.iwad}`, `/${game.id}`, sampleRate]);
  } else {
    doom.ccall('ein_start', null, ['string', 'string', 'number'], [`/${game.id}`, '', sampleRate]);
  }

  // The music: interleaved 16-bit stereo from the emulated OPL, into a buffer kept for it, pulled as
  // the effects an engine mixes are.
  let musicFrames = 0;
  let musicBuffer = 0;
  sound?.effects((left, right) => {
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

  // The settings files as the game has them, kept together.
  const keepWritten = () => {
    const files = SETTINGS_FILES.filter((name) => doom.FS.analyzePath(settingsAt(name)).exists)
      .map((name) => ({ name, data: doom.FS.readFile(settingsAt(name)) }));
    if (files.length > 0) onKeep?.({ files });
  };
  let ended = false;
  const width = doom._ein_width();
  const height = doom._ein_height();
  return {
    width,
    height,
    tick() {
      try {
        doom._ein_tick();
      } catch (error) {
        ended = true;
        // Quit has written the settings.
        if (quitted(error)) keepWritten();
        throw error;
      }
    },
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
    keepSettings() {
      if (ended) return;
      doom._ein_save_config();
      keepWritten();
    },
  };
}
