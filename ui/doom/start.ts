/**
 * What the page and the engine's worker share: what the engine is started with, and where the
 * player's kept files are in its file system. Free of the DOM and of the shell's kit, as a file the
 * worker imports must be.
 */

/** What the engine's worker is started with: the URLs of the glue and the wasm, and Doom's command line, `-iwad` and `-file` naming the WADs in its file system. */
export type DoomStart = { glue: string; wasm: string; args: string[] };

/**
 * The files the player keeps of a game, by their names in their saves folder of it (the adapter's
 * `kept`): its saves, `doomsav<slot>.dsg`, and Doom's settings files, `default.cfg`, its own (keys,
 * volumes, screen size, messages), and `doomgenericdoom.cfg`, Chocolate Doom's further ones. The
 * settings are the player's whatever WAD they play, kept once in `~/.doom` (`SHARED`).
 */
export const KEPT = /^(doomsav\d\.dsg|default\.cfg|doomgenericdoom\.cfg)$/;
export const SHARED = /^(default\.cfg|doomgenericdoom\.cfg)$/;

/**
 * Where a kept file is in Doom's file system: a save in doomgeneric's `.savegame/` under the working
 * directory, `/`, and a settings file in its configuration directory, `.`, joined to its name as
 * Doom joins it, so `default.cfg` is `/.default.cfg`.
 */
export const enginePath = (name: string): string => SHARED.test(name) ? `/.${name}` : `/.savegame/${name}`;

/** A file's name among the kept ones by its path in Doom's file system, which is absolute; nothing for one that is not kept. */
export function keptName(path: string): string | undefined {
  const name = path.slice(path.lastIndexOf('/') + 1).replace(/^\./, '');
  return KEPT.test(name) && enginePath(name) === path ? name : undefined;
}
