import { DemoCard } from '@games/card';
import { adapter } from '../adapter.ts';

/**
 * `/cards/doom/demo`: a game (`game`, else the first one there is) on its own, as Doom runs when
 * nobody plays: its title screen, then the demos recorded in the WAD, one after the other, for ever.
 * Doom starts the first demo a few seconds after its title screen.
 */
export default function Demo() {
  return <DemoCard adapter={adapter} />;
}
