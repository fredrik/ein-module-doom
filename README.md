# doom

A module for [EiN](https://einhq.eu) that plays Doom in the browser, with sound and music. Its games
are on EiN's **Games** page, which the games module gives: the module brings the engine and the
WADs, and the games module the page each is played on, the saves, the sound and the dropped files.

The engine is [doomgeneric](https://github.com/ozkl/doomgeneric) built to WebAssembly with
Emscripten, single-threaded, with a platform layer of its own (`engine/doomgeneric_ein.c`) and no
SDL. Its adapter (`ui/adapter.ts`) loads it at runtime from the module's `assets/` directory and
hands it to the games module's page, which drives it from `requestAnimationFrame` and draws its 320
by 200 frames on a canvas, shown at 4:3.

It is not one of EiN's own modules and has nothing to do with a family's archive.

## Install

It needs EiN's games module (`games`, 0.1 or later). As an administrator, open **Settings →
Modules**, choose **Install**, and give `https://github.com/fredrik/ein-module-doom` under **From a
repository**.

The games are on the **Games** page, under Browse in the sidebar, a card each. The module comes with
no game data. Until it is there, the Games page offers [Freedoom](https://freedoom.github.io), free
game data for Doom's engine, under **Free to fetch**: **Freedoom: Phase 1** plays as Doom,
**Freedoom: Phase 2** as Doom II. **Fetch**, for an administrator (EiN lets only the administrator
fetch from the internet), downloads Freedoom's release, checks it against the release's SHA-256 and
puts both its WADs in the folder, whichever of the two it was chosen on.

## Play

Each WAD's card on the Games page has its title screen, read out of the WAD, and under its title
its file's name and size, and for a PWAD the IWAD it is played with; the known games come first, in
the order they came out. Choose one to open its page, `/games/doom/<WAD>`, and **Play** to play it.

Click the game first, so it has the keyboard. Arrows move, Ctrl fires, Space opens doors, Shift
runs, Alt strafes, Escape opens Doom's menu, Enter picks. While the game has the focus it takes
these keys before EiN does, Alt+letter included; click outside it to give them back. The buttons in
the header turn the sound off and on and show the game full screen. Quit in Doom's menu leaves the
page as it was before **Play**.

## Saved games and settings

Doom's **Save Game** and **Load Game** keep your games in your home, in `.doom/<WAD>/`, one folder
for each WAD you play, so a save is loaded only into the game it was made in and nobody else sees
it. Each of the six slots is a file, `doomsav0.dsg` to `doomsav5.dsg`, as Chocolate Doom writes it.

Doom's settings are kept beside them, for each WAD: `default.cfg`, with the volumes, the screen
size, messages and the keys bound, and `doomgenericdoom.cfg`, with Chocolate Doom's further ones.
They are written when you quit the game, go to another page of EiN's or close the tab, and read when
the game starts, all but the sound's sample rate, which is the browser's.

Without an account, saves and settings last only as long as the page.

## On a dashboard

With EiN's Dashboards module, add the **Doom** card to a dashboard and choose its game, one of the
WADs there are. The card plays the game as Doom does when nobody plays: its title screen, and a few
seconds later the demos recorded in the WAD, one after the other. It makes no sound and takes no
keys.

## Add your own WADs

Drag one or more `.wad` files from your computer and drop them anywhere on the Games page. The
Games page knows a WAD by its first bytes, `IWAD` or `PWAD`; it is uploaded and appears as a card.

- An IWAD is a whole game: `doom.wad`, `doom2.wad`, `plutonia.wad`, `tnt.wad`, or the shareware
  `doom1.wad`. Its card calls a known one by its game's name.
- A PWAD adds levels or changes to a game. Playing one plays it over an IWAD with the same kind of
  maps: one with `MAP01` levels over Doom II (or Final Doom, or Freedoom: Phase 2), one with `E1M1`
  episodes over Doom (or Freedoom: Phase 1). Doom will not add a PWAD to the shareware IWAD.

The WADs are kept in `/groups/users/doom`, the household's shared folder, so everyone with an
account plays the same ones and may add to them, and they stay when the module is updated or
installed again. **Delete game**, in the ⋮ menu of a WAD's page, deletes it for everyone; Freedoom is
offered again once one of its WADs is gone. In EiN's terminal, `doom-fetch freedoom1.wad` (or
`freedoom2.wad`) fetches it, as **Fetch** does.

Heretic, Hexen and Strife run on Doom's engine too, but not on this build of it: their IWADs' cards
say they are not playable here.

In EiN's terminal, `doom-wads` lists the WADs with their titles, and Freedoom while it is not
fetched; `games-list` lists them with every other game module's games.

## Sound

The sound effects play through the browser's Web Audio, at the volume and side Doom gives each. The
music is Doom's own: its MUS tracks played on an emulated OPL3, the FM chip of the Sound Blaster and
AdLib cards, by [Chocolate Doom](https://www.chocolate-doom.org)'s OPL music code and the
[Nuked OPL3](https://github.com/nukeykt/Nuked-OPL3) emulator. Doom's **Options → Sound Volume**
sets both.

## Not yet

No mouse, no starting on a map, and no playing together.

## Layout

| Path                                 | What it is for                                                                                                                                            |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mod.json`                           | The manifest: the games module it needs, and the routes of a WAD's page and the dashboard card.                                                           |
| `etc/games.d/games.json`             | What the games module knows of the module: its title, icon and route, its list and fetch commands, its WAD folder, and the WADs it takes when dropped.    |
| `ui/pages/game.tsx`                  | A WAD's page, `/games/doom/<WAD>`: the games module's page for a game, with the module's adapter.                                                         |
| `ui/cards/demo.tsx`                  | The dashboard card, offered in `etc/dashboard.d/cards.json`: the games module's demo card, a game running its demos.                                      |
| `ui/adapter.ts`                      | The adapter the games module plays the WADs with: lists them, starts one, maps the keys, and names the saves and settings kept.                           |
| `ui/doom/engine.ts`                  | Loads the glue, the wasm and the WADs, wraps the engine's exports, and hands it the player's saves and settings and takes them back.                      |
| `ui/doom/sound.ts`                   | The sound effects on the games module's Web Audio; the music is pulled from the engine as its sound.                                                      |
| `ui/doom/keys.ts`                    | Browser key codes to Doom's.                                                                                                                              |
| `bin/doom-wads`                      | Lists the WADs with their titles and title screens, and Freedoom while it is not fetched, for the Games page, a WAD's page and the card's choice of game. |
| `lib/wads.ts`, `lib/api.ts`          | Where the WADs are, the games known by name, the IWAD a PWAD is played with, the game data offered, and the shape `doom-wads` answers in.                 |
| `lib/titlepic.ts`                    | Draws a WAD's title screen out of its `TITLEPIC` and palette, as a PNG.                                                                                   |
| `bin/doom-fetch`                     | Fetches Freedoom into the WAD folder when Fetch is chosen, checked against its release's SHA-256.                                                         |
| `engine/doomgeneric_ein.c`           | doomgeneric's platform layer for the page.                                                                                                                |
| `engine/ein_sound.c`                 | The sound module: hands each effect's samples to the page once, then plays them on its channels.                                                          |
| `engine/opl_ein.c`                   | Chocolate Doom's OPL library on Nuked OPL3, rendering music when the page asks for samples.                                                               |
| `engine/ein_chocolate.h`             | What Chocolate Doom's music code expects of its own headers that doomgeneric's lack.                                                                      |
| `engine/Containerfile`               | The build: pinned emsdk image, doomgeneric commit and Chocolate Doom release.                                                                             |
| `engine/nonblocking-wipe.patch`      | Runs the screen melt a frame at a time instead of in a loop that froze the page for a second.                                                             |
| `engine/quit.patch`                  | Makes Quit exit, and an exit function of the wrong type one of the right type, which WebAssembly traps on.                                                |
| `engine/save.patch`                  | Tells the page when Doom has saved a game, so it can keep it.                                                                                             |
| `engine/settings.patch`              | Puts back Chocolate Doom's reading and writing of the settings files, which doomgeneric had left out.                                                     |
| `assets/doom.js`, `assets/doom.wasm` | The built engine, committed, since a module is installed as its repository stands. `assets/doom-build.txt` says what built them.                          |
| `scripts/build-engine.sh`            | Rebuilds `assets/doom.js` and `assets/doom.wasm`.                                                                                                         |
| `test/smoke.mjs`                     | Signs in with headless Chrome, plays a little, saves screenshots.                                                                                         |
| `deno.jsonc`                         | Generated from `mod.json` by core's `deno task sync:modules`, for type-checking in a core checkout.                                                       |

## Building the engine

Needs only docker with buildx, or podman; nothing is installed on the host.

    scripts/build-engine.sh

It builds `engine/Containerfile` and exports the result into `assets/` with the local exporter. The
source of the committed `assets/doom.wasm` is doomgeneric at the commit `engine/Containerfile`
pins, with `engine/nonblocking-wipe.patch`, `engine/quit.patch`, `engine/save.patch` and
`engine/settings.patch` applied,
Chocolate Doom's `i_oplmusic.c`, `midifile.c`, `opl3.c` and `opl_queue.c` at the release it pins,
and the `engine/` files added.

## Developing

Mount the checkout read-only in EiN's container as `/modules-dev/doom` and set
`DEV_MODULES_PATH=/modules-dev`; EiN sets the module up when it starts, and it runs instead of an
installed one. The games module has to be there too, installed or mounted beside it. After a change
under `ui/`, run `ui-build doom` in EiN's terminal and reload the
browser; after a change to `mod.json`, `mod setup doom`. A file in `assets/` is read
as it is.

The smoke test wants a running EiN with the games module, this one and a WAD (`--game`,
`freedoom1.wad` when not given), Google Chrome, and Node 22 or later:

    EIN_PASSWORD=... node test/smoke.mjs --game freedoom1.wad --out /some/directory

## Licence

GPL-2.0-or-later, as doomgeneric and Chocolate Doom are: see `LICENSE`. Doom's source is © id
Software and the Chocolate Doom and doomgeneric authors; their notices are in the source the build
fetches. Nuked OPL3 (`opl3.c`) is LGPL-2.1-or-later, © Nuke.YKT. `assets/doom.js` is Emscripten's
runtime, under the MIT licence. Freedoom, which the module fetches when asked and does not ship, is under its
own BSD-style licence.
