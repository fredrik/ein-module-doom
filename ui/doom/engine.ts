import { fileUrl } from '@ein/ui/lib';
import type { RunningGame, StartOptions } from '@games/adapter';
import { keyControls, startWorkerGame } from '@games/worker';
import type { Wad } from '../../lib/api.ts';
import { doomKey } from './keys.ts';
import { type DoomStart, enginePath, SHARED } from './start.ts';

/** Where the module's built engine sits in EiN's tree. */
const ASSETS = '/usr/modules/doom/assets';

/**
 * Start `game`'s WAD, and the IWAD under it when it is a PWAD, in the module's engine worker
 * (`engine-worker.ts`, `mod.json` `ui.workers`). Doom's file system has the WADs under their own
 * names, which is what Doom tells its games apart by, read from EiN as it asks for them; and the
 * player's `kept` files where Doom reads them, its saves listed by Load Game and its settings read
 * as it starts. `sound` plays what the engine mixes; without it the game is silent. `onKeep` hears
 * each game Doom saves, and its settings when it writes them, on Quit and as its menu closes.
 */
export async function startDoom({ game, sound, log, kept, onKeep }: StartOptions<Wad>): Promise<RunningGame> {
  if (game.kind === 'PWAD' && !game.iwad) {
    throw new Error(`${game.id} adds to a game, and there is no IWAD here for it: drop doom2.wad or doom.wad on the Games page, or have Freedoom fetched again`);
  }
  const folder = game.path.slice(0, game.path.lastIndexOf('/'));
  const wads = game.iwad ? ['-iwad', `/${game.iwad}`, '-file', `/${game.id}`] : ['-iwad', `/${game.id}`];
  return await startWorkerGame<DoomStart>('doom', 'engine', {
    payload: { glue: fileUrl(`${ASSETS}/doom.js`), wasm: fileUrl(`${ASSETS}/doom.wasm`), args: ['doom', ...wads] },
    lazy: [
      { path: `/${game.id}`, url: fileUrl(game.path), size: game.size },
      ...(game.iwad ? [{ path: `/${game.iwad}`, url: fileUrl(`${folder}/${game.iwad}`) }] : []),
    ],
    // The settings are read but for the sample rate, which is this browser's (ein_start), not that
    // of the one they were written in.
    files: kept.map(({ name, data }) => ({
      path: enginePath(name),
      data: SHARED.test(name) ? new TextEncoder().encode(new TextDecoder().decode(data).replace(/^snd_samplerate\s.*$/m, '')) : data,
    })),
    // Doom here takes no mouse.
    controls: (post) => ({ ...keyControls(post, { key: doomKey }), mouse: () => undefined }),
  }, { sound, log, onKeep });
}
