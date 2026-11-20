import { fileUrl, shq } from '@ein/ui/lib';
import { execCommand } from '@ein/ui/signals';

/** Where the module's built engine and game data sit in EiN's tree. */
export const ASSETS = '/usr/modules/doom/assets';

/** IWADs in the order the page prefers them when there are several; any other `.wad` comes last. */
const IWAD_PREFERENCE = ['doom2.wad', 'doom.wad', 'doom1.wad', 'plutonia.wad', 'tnt.wad', 'freedoom2.wad', 'freedoom1.wad', 'freedm.wad'];

/** What `assets/doom.js` (Emscripten's glue, `engine/Containerfile`) gives back once the wasm runs. */
type DoomModule = {
  FS: { writeFile(path: string, data: Uint8Array): void };
  HEAPU8: Uint8Array;
  ccall(name: string, returns: null, types: string[], args: unknown[]): void;
  _ein_tick(): void;
  _ein_key(pressed: number, key: number): void;
  _ein_screen(): number;
  _ein_width(): number;
  _ein_height(): number;
  _ein_frames(): number;
};

/** A running game: tick it, read its frame, hand it keys. */
export type Engine = {
  /** The IWAD it plays, by file name. */
  iwad: string;
  width: number;
  height: number;
  /** Run the tics that are due; throws when the game exits or fails (Doom's `I_Error`). */
  tick(): void;
  /** How many frames the game has drawn: a new number means a new frame to copy. */
  frames(): number;
  /** Copy the current frame into `image`, which is `width` by `height`. */
  draw(image: ImageData): void;
  key(pressed: boolean, key: number): void;
};

/** The IWAD to play out of the names in the assets directory, or undefined when there is none. */
export function chooseIwad(names: string[]): string | undefined {
  const wads = names.filter((name) => /\.wad$/i.test(name));
  const rank = (name: string) => {
    const at = IWAD_PREFERENCE.indexOf(name.toLowerCase());
    return at === -1 ? IWAD_PREFERENCE.length : at;
  };
  return wads.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))[0];
}

/** Fetch a file of the module's assets as bytes; `/file/` needs the session's cookie, which a same-origin fetch sends. */
async function fetchAsset(name: string): Promise<Uint8Array> {
  const response = await fetch(fileUrl(`${ASSETS}/${name}`));
  if (!response.ok) throw new Error(`${name}: ${response.status} ${response.statusText}`);
  return new Uint8Array(await response.arrayBuffer());
}

/**
 * Load the engine and the IWAD and start the game. `log` gets what Doom prints, line by line.
 *
 * The glue is imported from a URL held in a variable, so core's bundler leaves it alone and the
 * browser loads it at runtime. The wasm is fetched here and handed over as bytes, so how `/file/`
 * labels a `.wasm` does not matter.
 */
export async function startEngine(log: (line: string) => void): Promise<Engine> {
  const names = await execCommand<string[]>(`ls ${shq(ASSETS)}`);
  const iwad = chooseIwad(names);
  if (!iwad) throw new Error(`no game data: put an IWAD such as doom1.wad or freedoom1.wad in ${ASSETS} (the module's README says how)`);

  const glueUrl = fileUrl(`${ASSETS}/doom.js`);
  const [glue, wasmBinary, wad] = await Promise.all([
    import(glueUrl) as Promise<{ default: (options: object) => Promise<DoomModule> }>,
    fetchAsset('doom.wasm'),
    fetchAsset(iwad),
  ]);
  const doom = await glue.default({ wasmBinary, print: log, printErr: log });
  doom.FS.writeFile(`/${iwad}`, wad);
  doom.ccall('ein_start', null, ['string'], [`/${iwad}`]);

  const width = doom._ein_width();
  const height = doom._ein_height();
  return {
    iwad,
    width,
    height,
    tick: () => doom._ein_tick(),
    frames: () => doom._ein_frames(),
    draw(image) {
      // Doom's pixels are 0x00RRGGBB words; ImageData wants R, G, B, A bytes, which read as one
      // little-endian word is 0xAABBGGRR. HEAPU8 is looked up each time: memory growth replaces it.
      const screen = new Uint32Array(doom.HEAPU8.buffer, doom._ein_screen(), width * height);
      const out = new Uint32Array(image.data.buffer);
      for (let i = 0; i < screen.length; i++) {
        const pixel = screen[i];
        out[i] = 0xff000000 | ((pixel & 0xff) << 16) | (pixel & 0xff00) | ((pixel >>> 16) & 0xff);
      }
    },
    key: (pressed, key) => doom._ein_key(pressed ? 1 : 0, key),
  };
}
