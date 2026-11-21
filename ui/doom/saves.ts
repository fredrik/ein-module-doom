import { homePath } from '@ein/paths';
import { type NodeChildEntry, shq } from '@ein/ui/lib';
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
