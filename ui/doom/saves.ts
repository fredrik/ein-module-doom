import { homePath } from '@ein/paths';
import { fileUrl, type NodeChildEntry, shq } from '@ein/ui/lib';
import { execCommand, execScript } from '@ein/ui/signals';

/**
 * Where `username` keeps their saved games of `wad`: a folder of their home's, one for each WAD
 * chosen, so a save is only ever loaded into the game it was made in. Nobody else sees it.
 */
export const savesFolder = (username: string, wad: string): string => `${homePath(username)}/.doom/saves/${wad}`;

/** A saved game: Doom's slot for it, 0 to 5 in its menu, and the bytes of its `doomsav<slot>.dsg`. */
export type Save = { slot: number; bytes: Uint8Array };

/**
 * A save's file in the folder. The shell's socket, which reads and writes it, carries text, so a
 * save is kept as its bytes in base64; `base64 -d` gives back the `.dsg` Chocolate Doom loads.
 */
const saveFile = (slot: number) => `doomsav${slot}.dsg.b64`;
const SAVE_FILE = /^doomsav(\d)\.dsg\.b64$/;

/** The saves in `folder`, which is made when it is not there yet, so a first save has somewhere to go. */
export async function loadSaves(folder: string): Promise<Save[]> {
  await execCommand(`mkdir -p ${shq(folder)}`);
  const entries = await execCommand<NodeChildEntry[]>(`ls -l ${shq(folder)}`);
  const slots = entries.flatMap((entry) => {
    const match = SAVE_FILE.exec(entry.name);
    return match ? [Number(match[1])] : [];
  });
  return await Promise.all(
    slots.map(async (slot) => ({
      slot,
      bytes: fromBase64(
        await execScript(`cat ${shq(`${folder}/${saveFile(slot)}`)}`),
      ),
    })),
  );
}

/**
 * Keep saves in `folder` one after the other, in the order Doom made them, so a slot saved twice in
 * quick succession ends with the later save. `onError` hears a save that could not be kept.
 */
export function saveKeeper(
  folder: string,
  onError: (error: unknown) => void,
): (save: Save) => void {
  let queue = Promise.resolve();
  return (save) => {
    queue = queue
      .then(() =>
        execCommand(`cat > ${shq(`${folder}/${saveFile(save.slot)}`)}`, {
          stdin: toBase64(save.bytes),
        })
      )
      .then(() => undefined, onError);
  };
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  // In pieces: spreading a whole save into one call would pass more arguments than a call takes.
  for (let at = 0; at < bytes.length; at += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text.trim());
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Where `username` keeps their settings of Doom's: one folder for every WAD, as Doom's own are. */
export const settingsFolder = (username: string): string => `${homePath(username)}/.doom`;

/**
 * Doom's settings files, as it writes them on Quit: `default.cfg`, its own
 * (keys, mouse, volumes, screen size, messages), and `doomgenericdoom.cfg`, Chocolate Doom's further
 * ones.
 */
export const SETTINGS_FILES = ['default.cfg', 'doomgenericdoom.cfg'];

/** One of Doom's settings files: its name and its text. */
export type Settings = { name: string; text: string };

/** The settings files in `folder` there are, which is made when it is not there yet. */
export async function loadSettings(folder: string): Promise<Settings[]> {
  await execCommand(`mkdir -p ${shq(folder)}`);
  const entries = await execCommand<NodeChildEntry[]>(`ls -l ${shq(folder)}`);
  const names = entries.map((entry) => entry.name).filter((name) => SETTINGS_FILES.includes(name));
  return await Promise.all(names.map(async (name) => {
    const response = await fetch(fileUrl(`${folder}/${name}`));
    if (!response.ok) throw new Error(`${name}: ${response.status} ${response.statusText}`);
    return { name, text: await response.text() };
  }));
}

/**
 * Keep settings in `folder`, which `loadSettings` made, one keeping after the other. The files of one
 * go out together with PUT, which stores the body as the file, and the browser finishes them even
 * when the page has gone (`keepalive`): the page keeps the settings as it is closed. `onError` hears
 * a file that could not be kept.
 */
export function settingsKeeper(folder: string, onError: (error: unknown) => void): (settings: Settings[]) => void {
  let queue = Promise.resolve();
  const put = async ({ name, text }: Settings) => {
    const response = await fetch(fileUrl(`${folder}/${name}`), { method: 'PUT', body: text, keepalive: true });
    if (!response.ok) throw new Error(`${name}: ${response.status} ${response.statusText}`);
  };
  return (settings) => {
    queue = queue.then(() => Promise.all(settings.map(put))).then(() => undefined, onError);
  };
}
