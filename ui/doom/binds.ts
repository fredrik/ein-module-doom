import { homePath } from '@ein/paths';
import { fileUrl, shq } from '@ein/ui/lib';
import { currentUser, execCommand } from '@ein/ui/signals';
import type { Kept, Written } from '@games/adapter';
import { useEffect, useSyncExternalStore } from 'react';
import type { Engine } from '../../lib/api.ts';
import { codeOf, settingOf } from './keys.ts';
import { type DoomInput, SETTINGS } from './start.ts';

/**
 * The keys and the mouse the player plays each game with, as its settings files have them: Crispy
 * Doom keeps a bound key as a number (`key_up 72`, `keys.ts`), and a mouse button as Doom's own
 * number for it (`mouseb_fire 0`), in the game's own file or in Crispy's (`SETTINGS`). They are the
 * player's whatever WAD they play, read from `~/.doom` once a page and again each time the game
 * writes them, and changed in the Keys dialog: written to the file, and to the game while it runs.
 */

/** A control the keys' drawing shows: its name, and the settings that bind it, the one shown and changed first (Crispy's WASD, beside the arrows). */
export type Control = { name: string; settings: string[] };

/** The controls each game's drawing shows on its keys: those all three share, then each one's own. */
export const CONTROLS: Record<Engine, Record<string, Control>> = (() => {
  const shared: Record<string, Control> = {
    forward: { name: 'Forward', settings: ['key_alt_up', 'key_up'] },
    back: { name: 'Back', settings: ['key_alt_down', 'key_down'] },
    left: { name: 'Left', settings: ['key_alt_strafeleft', 'key_strafeleft'] },
    right: {
      name: 'Right',
      settings: ['key_alt_straferight', 'key_straferight'],
    },
    fire: { name: 'Fire', settings: ['key_fire'] },
    use: { name: 'Use', settings: ['key_use'] },
    run: { name: 'Run', settings: ['key_speed'] },
  };
  const raven = {
    ...shared,
    artifact: { name: 'Artifact', settings: ['key_useartifact'] },
    fly: { name: 'Fly up', settings: ['key_flyup'] },
  };
  return {
    doom: shared,
    heretic: raven,
    hexen: { ...raven, jump: { name: 'Jump', settings: ['key_jump'] } },
  };
})();

/** The settings in Crispy's file rather than the game's own; the rest are in the game's. */
export const IN_CRISPY = new Set([
  'key_map_toggle',
  'mouseb_use',
  'mouseb_backward',
  'mouseb_prevweapon',
  'mouseb_nextweapon',
  'crispy_mouselook',
  'crispy_uncapped',
]);

/** Crispy Doom's own defaults for the settings the drawing shows, the same in all three games (`moduleDefaults` changes some). */
const DEFAULTS: Record<string, number> = {
  key_up: 72,
  key_alt_up: 17,
  key_down: 80,
  key_alt_down: 31,
  key_strafeleft: 51,
  key_alt_strafeleft: 30,
  key_straferight: 52,
  key_alt_straferight: 32,
  key_fire: 29,
  key_use: 57,
  key_speed: 54,
  key_jump: 53,
  key_flyup: 73,
  key_useartifact: 28,
  mouseb_fire: 0,
  mouseb_strafe: 1,
  mouseb_forward: 2,
  mouseb_speed: 3,
  mouseb_use: -1,
  mouseb_jump: -1,
  mouseb_backward: -1,
  mouseb_prevweapon: 4,
  mouseb_nextweapon: 3,
};

/**
 * The settings the module plays with where the player has none of their own, over Crispy's, with
 * the keys and the mouse as the quake module plays Quake where the game has the same: mouse look,
 * since the mouse is how the page plays; frames drawn as often as the screen shows them, the game's
 * movement drawn between its 35 tics a second; the right button runs forward, as Quake's does, the
 * middle strafes, and the wheel only changes weapons; and in Hexen, which jumps, Space jumps, as in
 * Quake, and E uses.
 */
export function moduleDefaults(engine: Engine): Record<string, number> {
  return {
    crispy_mouselook: 1,
    crispy_uncapped: 1,
    mouseb_forward: 1,
    mouseb_strafe: 2,
    mouseb_speed: -1,
    ...(engine === 'hexen' ? { key_jump: 57, key_use: 18 } : {}),
  };
}

/** What a setting is for a player who has not set it: the module's, else Crispy's. */
const defaultOf = (engine: Engine, name: string): number | undefined => moduleDefaults(engine)[name] ?? DEFAULTS[name];

/** The mouse's settings the drawing shows. */
const MOUSE = Object.keys(DEFAULTS).filter((name) => name.startsWith('mouseb_'));

/** A settings file's lines, by setting. */
export function settingsOf(text: string): Map<string, string> {
  const settings = new Map<string, string>();
  for (const line of text.split('\n')) {
    const match = /^(\S+)\s+(.*?)\s*$/.exec(line);
    if (match) settings.set(match[1], match[2]);
  }
  return settings;
}

/** `text`, a settings file, with `name` set to `value`: its line changed, or one added at the end. */
export function withSetting(text: string, name: string, value: string): string {
  const line = `${name.padEnd(30)}${value}`;
  const pattern = new RegExp(`^${name}\\s.*$`, 'm');
  if (pattern.test(text)) return text.replace(pattern, line);
  return `${text}${text && !text.endsWith('\n') ? '\n' : ''}${line}\n`;
}

/** Each game's two settings files' text, `null` for one the player has none of yet. */
type Files = { main: string | null; crispy: string | null };

const files = new Map<Engine, Files>();
const loading = new Set<Engine>();
const listeners = new Set<() => void>();

const set = (engine: Engine, next: Files) => {
  files.set(engine, next);
  listeners.forEach((listener) => listener());
};

/** The game running, which a change goes to as well, as `engine.ts` started it. */
let running: { engine: Engine; post(input: DoomInput): void } | undefined;

/** `engine.ts` started a game of `engine`, which `post` hands input to; nothing once it ended. */
export function heardRunning(game: typeof running) {
  running = game;
}

/** Where the signed-in player keeps a settings file, the same for every WAD (the adapter's `kept.shared`). */
const pathOf = (name: string): string | undefined => {
  const username = currentUser.value?.username;
  return username ? `${homePath(username)}/.doom/${name}` : undefined;
};

/** Read the player's settings files of `engine`, once a page. */
function load(engine: Engine) {
  if (files.has(engine) || loading.has(engine)) return;
  loading.add(engine);
  const read = async (name: string): Promise<string | null> => {
    const path = pathOf(name);
    const response = path ? await fetch(fileUrl(path)).catch(() => undefined) : undefined;
    return response?.ok ? await response.text() : null;
  };
  Promise.all([read(SETTINGS[engine].main), read(SETTINGS[engine].crispy)])
    .then(([main, crispy]) => set(engine, { main, crispy }))
    .finally(() => loading.delete(engine));
}

/** The game started with the player's files `kept`: its settings among them, or none. */
export function heardKept(engine: Engine, kept: Kept[]) {
  const text = (name: string) => {
    const file = kept.find((each) => each.name === name);
    return file ? new TextDecoder().decode(file.data) : null;
  };
  set(engine, {
    main: text(SETTINGS[engine].main),
    crispy: text(SETTINGS[engine].crispy),
  });
}

/** The game wrote `written`: its settings among them, which its menus may have changed. */
export function heardWritten(engine: Engine, written: Written) {
  const now = files.get(engine) ?? { main: null, crispy: null };
  const text = (name: string, was: string | null) => {
    const file = written.files.find((each) => each.name === name);
    return file ? new TextDecoder().decode(file.data) : was;
  };
  set(engine, {
    main: text(SETTINGS[engine].main, now.main),
    crispy: text(SETTINGS[engine].crispy, now.crispy),
  });
}

/** The player's settings of `engine`, both files' merged, rendering again as they change; undefined while they are read. */
export function useSettings(engine: Engine): Map<string, string> | undefined {
  useEffect(() => load(engine), [engine]);
  const now = useSyncExternalStore(
    (listener) => (listeners.add(listener), () => listeners.delete(listener)),
    () => files.get(engine),
  );
  return now &&
    new Map([...settingsOf(now.main ?? ''), ...settingsOf(now.crispy ?? '')]);
}

/** A setting's number in `engine`: the player's, else its default. A key from before Crispy (above 127), which the game is started without (`engine.ts`), is the default. */
export function valueOf(settings: Map<string, string> | undefined, name: string, engine: Engine): number | undefined {
  const own = settings?.get(name);
  const value = own !== undefined && /^-?\d+$/.test(own) ? Number(own) : defaultOf(engine, name);
  return name.startsWith('key_') && value !== undefined && value > 127 ? defaultOf(engine, name) : value;
}

/** The physical key a control of `engine` is played with: the first of its settings bound to one. */
export function controlKey(settings: Map<string, string> | undefined, control: Control, engine: Engine): { setting: string; code: string } | undefined {
  for (const setting of control.settings) {
    const value = valueOf(settings, setting, engine);
    const code = value ? codeOf(value) : undefined;
    if (code) return { setting, code };
  }
  return undefined;
}

/**
 * Give `control` of `engine` the physical key `code`: the setting it shows (or its first) takes the
 * key's number. Another control of the drawing's that had the key takes the one it had, so no key
 * plays two. Each change is written to the player's settings file and handed to the game running.
 */
export async function bindKey(
  engine: Engine,
  control: Control,
  code: string,
): Promise<void> {
  const number = settingOf(code);
  if (number === undefined) {
    throw new Error(`${code} is not a key the game takes`);
  }
  const settings = new Map([
    ...settingsOf(files.get(engine)?.main ?? ''),
    ...settingsOf(files.get(engine)?.crispy ?? ''),
  ]);
  const setting = controlKey(settings, control, engine)?.setting ?? control.settings[0];
  const old = valueOf(settings, setting, engine) ?? 0;
  const changes: [string, number][] = [[setting, number]];
  for (const other of Object.values(CONTROLS[engine])) {
    if (other === control) continue;
    for (const each of other.settings) {
      if (valueOf(settings, each, engine) === number) changes.push([each, old]);
    }
  }
  await change(engine, changes);
}

/** The settings the drawing of `engine`'s keys shows, its controls' and the mouse's, which Reset sets back. */
const shown = (engine: Engine): string[] => [...Object.values(CONTROLS[engine]).flatMap((control) => control.settings), ...MOUSE];

/** Back to the default keys and mouse buttons for what `engine`'s drawing shows. */
export async function resetKeys(engine: Engine): Promise<void> {
  await change(engine, shown(engine).map((setting) => [setting, defaultOf(engine, setting) ?? -1]));
}

/** Whether anything `engine`'s drawing shows is set other than by default. */
export function changed(settings: Map<string, string> | undefined, engine: Engine): boolean {
  return shown(engine).some((setting) => valueOf(settings, setting, engine) !== defaultOf(engine, setting));
}

/** Set each setting of `changes`: in the game running, and in the player's settings files. */
async function change(
  engine: Engine,
  changes: [string, number][],
): Promise<void> {
  const now = files.get(engine) ?? { main: null, crispy: null };
  let { main, crispy } = now;
  for (const [name, value] of changes) {
    if (IN_CRISPY.has(name)) {
      crispy = withSetting(crispy ?? '', name, String(value));
    } else main = withSetting(main ?? '', name, String(value));
    if (running?.engine === engine) {
      running.post({ set: { name, value: String(value) } });
    }
  }
  set(engine, { main, crispy });
  const write = async (
    name: string,
    text: string | null,
    was: string | null,
  ) => {
    const path = pathOf(name);
    if (!path || text === null || text === was) return;
    await execCommand(`mkdir -p ${shq(path.slice(0, path.lastIndexOf('/')))}`);
    const response = await fetch(fileUrl(path), { method: 'PUT', body: text });
    if (!response.ok) {
      throw new Error(`${path}: ${response.status} ${response.statusText}`);
    }
  };
  await Promise.all([
    write(SETTINGS[engine].main, main, now.main),
    write(SETTINGS[engine].crispy, crispy, now.crispy),
  ]);
}
