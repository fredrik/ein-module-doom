import type { Command, NodeAttrs } from '@ein/client';
import type { Game, OfferedWad, Wad } from './api.ts';
import { titlePng } from './titlepic.ts';

/**
 * Where the game data is: a folder in the household's shared home, so everyone signed in plays
 * the same WADs and may add to them. The game data offered (`OFFERS`) is fetched here by
 * `doom-fetch`, and what is dropped on the Games page is uploaded here.
 */
export const WADS = '/groups/users/doom';

/** Free game data `doom-fetch` fetches, offered while one of its WADs is not here. */
type Offer = { about: string; wads: string[]; download: number };

const OFFERS: Offer[] = [
  {
    about: "Free game data for Doom's engine: Phase 1 plays as Doom, Phase 2 as Doom II. Fetching one fetches both.",
    wads: ['freedoom1.wad', 'freedoom2.wad'],
    download: 24_143_781,
  },
];

/**
 * The IWADs known by name, with their titles, in the order they came out, which is the list's, and
 * the order an IWAD for a PWAD is looked for in.
 */
const IWADS: { name: string; title: string; maps: 'episodes' | 'levels'; description: string }[] = [
  {
    name: 'doom1.wad',
    title: 'Doom (shareware)',
    maps: 'episodes',
    description:
      "Knee-Deep in the Dead, the first episode of id Software's Doom (1993): a marine alone against the demons of Hell on Mars's moon Phobos, free to play and pass on.",
  },
  {
    name: 'doom.wad',
    title: 'Doom',
    maps: 'episodes',
    description: "id Software's 1993 first-person shooter: a marine alone against the demons of Hell on Mars's moons Phobos and Deimos, and beyond.",
  },
  {
    name: 'doom2.wad',
    title: 'Doom II',
    maps: 'levels',
    description: 'Doom II: Hell on Earth (1994): the demons have reached Earth, and the marine fights through thirty levels of a ruined city and back into Hell.',
  },
  {
    name: 'tnt.wad',
    title: 'Final Doom: TNT: Evilution',
    maps: 'levels',
    description: "Half of Final Doom (1996): thirty-two levels by TeamTNT, a research base on Jupiter's moon Io overrun by Hell, on Doom II's engine.",
  },
  {
    name: 'plutonia.wad',
    title: 'Final Doom: The Plutonia Experiment',
    maps: 'levels',
    description: "Half of Final Doom (1996): thirty-two hard levels by Dario and Milo Casali, on Doom II's engine.",
  },
  {
    name: 'freedoom1.wad',
    title: 'Freedoom: Phase 1',
    maps: 'episodes',
    description: "Free game data for Doom's engine, made by its community: four episodes of new levels, monsters and music, played as the first Doom is.",
  },
  {
    name: 'freedoom2.wad',
    title: 'Freedoom: Phase 2',
    maps: 'levels',
    description: "Free game data for Doom's engine, made by its community: thirty-two levels of new maps, monsters and music, played as Doom II is.",
  },
  { name: 'freedm.wad', title: 'FreeDM', maps: 'levels', description: "Freedoom's deathmatch levels, made for playing against each other." },
];

/**
 * IWADs of the other games on Doom's engine, which doomgeneric does not play: each needs an engine
 * of its own. The list leaves them out.
 */
const OTHER_GAMES: Record<string, string> = {
  'heretic.wad': 'Heretic',
  'heretic1.wad': 'Heretic (shareware)',
  'hexen.wad': 'Hexen',
  'hexdd.wad': 'Hexen: Deathkings of the Dark Citadel',
  'strife1.wad': 'Strife',
  'voices.wad': 'Strife voices',
};

const known = (name: string) => IWADS.find((iwad) => iwad.name === name.toLowerCase());

/** Known IWADs first, then the other WADs. */
const rank = (name: string) => {
  const at = IWADS.findIndex((iwad) => iwad.name === name.toLowerCase());
  return at !== -1 ? at : IWADS.length;
};

/** In `rank`'s order, and by name within it. */
const byRank = (a: Wad, b: Wad): number => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id);

/** `bytes` as a person reads a size: `28 MB`. */
const sizeText = (bytes: number): string =>
  bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : bytes >= 1e6 ? `${Math.round(bytes / 1e6)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} kB`;

/** Where a lump's bytes are in its WAD. */
type Lump = { at: number; size: number };

/** A WAD's header and directory: an IWAD is a whole game, a PWAD adds to one; its lumps by name, the last of a name the one Doom uses. */
type WadDirectory = { path: string; kind: 'IWAD' | 'PWAD'; lumps: Map<string, Lump> };

/** `length` bytes of the file at `path` from `at` on, fewer when it ends sooner. */
async function readRange(cmd: Command, path: string, at: number, length: number): Promise<Uint8Array> {
  const handle = await cmd.sys.vfs.open(cmd.access, path, { mode: 'r' });
  try {
    // 0 is SEEK_SET: from the start of the file.
    await handle.seek(at, 0);
    const bytes = new Uint8Array(length);
    let filled = 0;
    while (filled < length) {
      const chunk = await handle.read(length - filled);
      if (chunk.length === 0) break;
      bytes.set(chunk, filled);
      filled += chunk.length;
    }
    return bytes.subarray(0, filled);
  } finally {
    await handle.close();
  }
}

/** The header and directory of the WAD at `path`, reading only those; undefined when it is not a WAD. */
async function readDirectory(cmd: Command, path: string): Promise<WadDirectory | undefined> {
  const header = await readRange(cmd, path, 0, 12);
  const magic = String.fromCharCode(...header.subarray(0, 4));
  if (header.length < 12 || (magic !== 'IWAD' && magic !== 'PWAD')) return undefined;
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  const count = view.getInt32(4, true);
  const offset = view.getInt32(8, true);
  if (count < 0 || offset < 12) return undefined;
  const directory = await readRange(cmd, path, offset, count * 16);
  if (directory.length < count * 16) return undefined;
  const entries = new DataView(directory.buffer, directory.byteOffset, directory.byteLength);
  const lumps = new Map<string, Lump>();
  for (let i = 0; i < count; i++) {
    const name = String.fromCharCode(...directory.subarray(i * 16 + 8, i * 16 + 16)).replace(/\0.*$/s, '').toUpperCase();
    lumps.set(name, { at: entries.getInt32(i * 16, true), size: entries.getInt32(i * 16 + 4, true) });
  }
  return { path, kind: magic, lumps };
}

/**
 * The IWAD a PWAD is played with, out of the IWADs `here`: one with the same kind of maps, `MAP01`
 * for Doom II's levels or `E1M1` for Doom's episodes, in `IWADS`' order. The shareware IWAD is
 * never one, since Doom refuses to add a PWAD to it.
 */
function iwadFor(pwad: WadDirectory, here: string[]): string | undefined {
  const lumps = [...pwad.lumps.keys()];
  const levels = lumps.some((lump) => /^MAP\d\d$/.test(lump));
  const episodes = lumps.some((lump) => /^E\dM\d$/.test(lump));
  const fits = IWADS.filter((iwad) => iwad.name !== 'doom1.wad' && (levels === episodes || iwad.maps === (levels ? 'levels' : 'episodes')));
  for (const iwad of fits) {
    const found = here.find((name) => name.toLowerCase() === iwad.name);
    if (found) return found;
  }
  return undefined;
}

/**
 * A WAD's title screen as Doom shows it (`titlePng`), out of `wads`, the WADs it is played with, an
 * IWAD and a PWAD over it, in the order Doom loads them: the last that has a lump is the one Doom
 * uses, so a PWAD without a title screen or a palette of its own shows its IWAD's. Only the two
 * lumps are read; undefined when there is no title screen or no palette.
 */
async function titlePicture(cmd: Command, wads: WadDirectory[]): Promise<string | undefined> {
  const find = (name: string) => wads.map((wad) => wad.lumps.has(name) ? { path: wad.path, ...wad.lumps.get(name)! } : undefined).filter((lump) => lump !== undefined).at(-1);
  const title = find('TITLEPIC');
  const palette = find('PLAYPAL');
  if (!title || !palette) return undefined;
  const [picture, colours] = await Promise.all([readRange(cmd, title.path, title.at, title.size), readRange(cmd, palette.path, palette.at, 768)]);
  return await titlePng(picture, colours);
}

/**
 * The WADs in `WADS`, known IWADs first, then the free game data offered whose WADs are not there,
 * as `doom-wads` lists them. A file that is not a WAD, and a WAD of a game other than Doom's
 * (`OTHER_GAMES`), which this engine cannot play, are left out.
 */
export async function findWads(cmd: Command): Promise<Game[]> {
  // No folder yet is no WADs yet: a fetch or a drop makes it.
  const children = await cmd.sys.vfs.children(cmd.access, WADS).catch(() => []);
  const names = children.filter((child) => child.node.type === 'file' && /\.wad$/i.test(child.name) && !OTHER_GAMES[child.name.toLowerCase()]).map((child) => child.name);
  const read = await Promise.all(names.map(async (name) => {
    const path = `${WADS}/${name}`;
    const [node, directory] = await Promise.all([
      cmd.sys.vfs.get<NodeAttrs & { size?: number }>(cmd.access, path),
      readDirectory(cmd, path).catch(() => undefined),
    ]);
    return directory && { name, size: node.attrs.size ?? 0, directory };
  }));
  const wads = read.filter((wad) => wad !== undefined);
  const iwads = wads.filter((wad) => wad.directory.kind === 'IWAD');
  const installed = await Promise.all(wads.map(async ({ name, size, directory }): Promise<Wad> => {
    const iwad = directory.kind === 'PWAD' ? iwadFor(directory, iwads.map((each) => each.name)) : undefined;
    // What Doom shows: the IWAD's lumps, and the PWAD's over them.
    const under = iwads.find((each) => each.name === iwad)?.directory;
    const cover = await titlePicture(cmd, under ? [under, directory] : [directory]).catch(() => undefined);
    const title = known(name)?.title ?? name;
    const description = known(name)?.description;
    const played = directory.kind === 'PWAD' ? iwad ? `on ${known(iwad)?.title ?? iwad}` : 'no IWAD here for it' : undefined;
    const detail = [title === name ? undefined : name, sizeText(size), played].filter(Boolean).join(' · ');
    return {
      id: name,
      title,
      state: 'installed',
      path: `${WADS}/${name}`,
      detail,
      ...(description ? { description } : {}),
      size,
      ...(cover ? { cover } : {}),
      kind: directory.kind,
      ...(iwad ? { iwad } : {}),
    };
  }));
  const offered = OFFERS.flatMap((offer) =>
    offer.wads.filter((wad) => !names.includes(wad)).map((wad): OfferedWad => ({
      id: wad,
      title: known(wad)?.title ?? wad,
      state: 'offered',
      about: offer.about,
      download: offer.download,
    }))
  );
  return [...installed.sort(byRank), ...offered];
}
