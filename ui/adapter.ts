import { execCommand } from '@ein/ui/signals';
import type { GameAdapter } from '@games/adapter';
import type { Game } from '../lib/api.ts';
import { KEPT, startEngine } from './doom/engine.ts';
import { doomKey } from './doom/keys.ts';

/** Doom on the games module's page for a game and its dashboard card: a game is a WAD. */
export const adapter: GameAdapter<Game> = {
  module: 'doom',
  title: 'Doom',
  list: () => execCommand<Game[]>('doom-wads'),
  async start({ game, ...options }) {
    if (game.state !== 'installed') throw new Error(`${game.title} is not here yet`);
    const engine = await startEngine({ game, ...options });
    return {
      width: () => engine.width,
      height: () => engine.height,
      frames: engine.frames,
      draw: engine.draw,
      step: engine.tick,
      key(pressed, code) {
        const key = doomKey(code);
        if (key === undefined) return false;
        engine.key(pressed, key);
        return true;
      },
      // Doom here takes no mouse.
      button: () => false,
      mouse: () => undefined,
      wheel: () => undefined,
      keep: engine.keepSettings,
    };
  },
  help: 'Arrows move, Ctrl fires, Space opens doors, Shift runs, Alt strafes, Escape is the menu.',
  kept: { pattern: KEPT, depth: 0 },
  // 320 by 200, drawn at 4:3, the shape Doom's pixels had on a CRT.
  frame: { width: 640, height: 480 },
};
