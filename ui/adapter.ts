import { execCommand } from '@ein/ui/signals';
import type { GameAdapter } from '@games/adapter';
import type { Game } from '../lib/api.ts';
import { startDoom } from './doom/engine.ts';
import { KEPT, SHARED } from './doom/start.ts';

/** Doom on the games module's page for a game and its dashboard card: a game is a WAD. */
export const adapter: GameAdapter<Game> = {
  module: 'doom',
  title: 'Doom',
  list: () => execCommand<Game[]>('doom-wads'),
  async start({ game, ...options }) {
    if (game.state !== 'installed') throw new Error(`${game.title} is not here yet`);
    return await startDoom({ game, ...options });
  },
  help: 'Arrows move, Ctrl fires, Space opens doors, Shift runs, Alt strafes, Escape is the menu.',
  kept: { pattern: KEPT, depth: 0, shared: SHARED },
  // 320 by 200, drawn at 4:3, the shape Doom's pixels had on a CRT.
  frame: { width: 640, height: 480 },
};
