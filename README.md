# doom

A module for [EiN](https://einhq.eu) that plays Doom in the browser, with sound and music: the 1993
one, shotgun and all, a click away from the family's recipes. Its games are on EiN's **Games** page,
which the games module gives: this module brings the engine and the WADs, and the games module the
page each is played on, the saves, the sound and the dropped files.

The engine is [doomgeneric](https://github.com/ozkl/doomgeneric) built to WebAssembly with
Emscripten, single-threaded, with a platform layer of its own (`engine/doomgeneric_ein.c`) and no
SDL. It runs in the module's Web Worker, on the games module's kit for an engine in a worker, not on
the page: the worker loads it at runtime from the module's `assets/` directory and reads the WADs
from EiN a piece at a time as Doom asks for them, so a level is downloaded as it is played. The
games module's page asks the worker for a frame each time it draws, and shows Doom's 320 by 200
frames at 4:3, the shape its pixels had on a CRT.

It is not one of EiN's own modules and has nothing to do with a family's archive.

## How it fits together

```
  the Games page (games module)                   the engine's worker (this module)
 ┌────────────────────────────────┐  tick, keys  ┌──────────────────────────────────┐
 │ the canvas, the keyboard,      │ ───────────▶ │ doom.wasm: doomgeneric, its      │
 │ Web Audio, and the player's    │              │ effects mixed over OPL3 music    │
 │ saves and settings in ~/.doom  │ ◀─────────── │                                  │
 └────────────────────────────────┘  the frame,  └──────────────────────────────────┘
                                     the sound,           │ a piece of a WAD,
                                     files Doom wrote     ▼ as Doom asks for it
                                                   /groups/users/doom/*.wad
```

The page and the worker talk by `postMessage` only, with no shared memory. Each animation frame the
page sends a tick; the worker runs the tics of Doom's that are due and answers with the frame, the
sound for the time since the last tick, and whether Doom's menu is up. Nothing of Doom's runs on the
page's thread.

## Install

It needs an EiN whose core has module API 0.15.77 or later, which gives a module its Web Workers,
and EiN's games module (`games`, 0.1.1 or later). As an administrator, open **Settings → Modules**,
choose **Install**, and give `https://github.com/fredrik/ein-module-doom` under **From a
repository**.

The games are on the **Games** page, under Browse in the sidebar, a card each. The module comes with
no game data. Until it is there, the Games page offers [Freedoom](https://freedoom.github.io), free
game data for Doom's engine, under **Free downloads**: **Freedoom: Phase 1** plays as Doom,
**Freedoom: Phase 2** as Doom II. **Download**, for an administrator (EiN lets only the
administrator fetch from the internet), downloads Freedoom's release, checks it against the
release's SHA-256 and puts both its WADs in the folder, whichever of the two it was chosen on.
Nothing is downloaded when the module is installed.

## Play

Each WAD's card on the Games page has its title screen, read out of the WAD, and under its title
its file's name and size, and for a PWAD the IWAD it is played with; the known games come first, in
the order they came out. Choose one to open its page, `/games/doom/<WAD>`, and **Play** to play it.

Click the game first, so it has the keyboard. Arrows move, Ctrl fires, Space opens doors, Shift
runs, Alt strafes, Escape opens Doom's menu, Enter picks. While the game has the focus it takes
these keys before EiN does, Alt+letter included; click outside it to give them back. The buttons in
the header turn the sound off and on, which the browser remembers for next time, and show the game
full screen, as F11 does. A tab that is hidden holds the game and its sound until it shows again.
Quit in Doom's menu leaves the page as it was before **Play**.

## Saved games and settings

Doom's **Save Game** and **Load Game** keep your games in your home, in `.doom/<WAD>/`, one folder
for each WAD you play, so a save is loaded only into the game it was made in and nobody else sees
it. Each of the six slots is a file, `doomsav0.dsg` to `doomsav5.dsg`, as Chocolate Doom writes it.

Doom's settings are yours whatever WAD you play, kept once in `.doom/`, above the saves:
`default.cfg`, with the volumes, the screen size, messages and the keys bound, and
`doomgenericdoom.cfg`, with Chocolate Doom's further ones. They are written when you close Doom's
menu, quit the game, go to another page of EiN's or close the tab, and read when the game starts,
all but the sound's sample rate, which is the browser's.

Without an account, saves and settings last only as long as the page.

## On a dashboard

With EiN's Dashboards module, add the **Doom** card to a dashboard and choose its game, one of the
WADs there are; without a choice it is the first of them. The card plays the game as Doom does when
nobody plays: its title screen, and a few seconds later the demos recorded in the WAD, one after the
other. It makes no sound and takes no keys.

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
installed again. **Delete game**, in the ⋮ menu of a WAD's page, deletes it for everyone; Freedoom
is offered again once one of its WADs is gone. In EiN's terminal, `doom-fetch freedoom1.wad` (or
`freedoom2.wad`) fetches it, as **Download** does.

Heretic, Hexen and Strife run on Doom's engine too, but not on this build of it: their IWADs are
left off the Games page.

In EiN's terminal, `doom-wads` lists the WADs with their titles, and Freedoom while it is not
fetched; `games-list` lists them with every other game module's games.

## Sound

The sound effects are mixed in the engine, each at the volume and side Doom gives it, over the
music, and played through the browser's Web Audio: a worker has no Web Audio of its own, so the
engine hands the page the finished mix. The music is Doom's own: its MUS tracks played on an
emulated OPL3, the FM chip of the Sound Blaster and AdLib cards, by
[Chocolate Doom](https://www.chocolate-doom.org)'s OPL music code and the
[Nuked OPL3](https://github.com/nukeykt/Nuked-OPL3) emulator, so E1M1 sounds much as it did out
of a Sound Blaster in 1993. Doom's **Options → Sound Volume** sets both.

## Not yet

No mouse, no starting on a map, and no playing together. The games module has all three for a game
module that asks for them; Doom here does not ask yet.

## Layout

| Path                                 | What it is for                                                                                                                                            |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mod.json`                           | The manifest: the games module it needs, the engine's worker, and the routes of a WAD's page and the dashboard card.                                      |
| `etc/games.d/games.json`             | What the games module knows of the module: its title, icon and route, its list and fetch commands, its WAD folder, and the WADs it takes when dropped.    |
| `ui/pages/game.tsx`                  | A WAD's page, `/games/doom/<WAD>`: the games module's page for a game, with the module's adapter.                                                         |
| `ui/cards/demo.tsx`                  | The dashboard card, offered in `etc/dashboard.d/cards.json`: the games module's demo card, a game running its demos.                                      |
| `ui/adapter.ts`                      | The adapter the games module plays the WADs with: lists them, starts one, says how it is played, and names the saves and settings kept.                   |
| `ui/doom/engine.ts`                  | Starts a WAD in the engine's worker: the build, Doom's command line, the WADs to read from EiN, the player's saves and settings, the keys.                |
| `ui/doom/engine-worker.ts`           | The engine's worker: loads the glue and the wasm, starts Doom, and answers each frame with its picture and sound, and the saves and settings Doom writes. |
| `ui/doom/start.ts`                   | What the page and the worker share: what the engine is started with, and where the player's files are in Doom's file system.                              |
| `ui/doom/keys.ts`                    | Browser key codes to Doom's.                                                                                                                              |
| `bin/doom-wads`                      | Lists the WADs with their titles and title screens, and Freedoom while it is not fetched, for the Games page, a WAD's page and the card's choice of game. |
| `lib/wads.ts`, `lib/api.ts`          | Where the WADs are, the games known by name, the IWAD a PWAD is played with, the game data offered, and the shape `doom-wads` answers in.                 |
| `lib/titlepic.ts`                    | Draws a WAD's title screen out of its `TITLEPIC` and palette, as a PNG.                                                                                   |
| `bin/doom-fetch`                     | Fetches Freedoom into the WAD folder when Download is chosen, checked against its release's SHA-256.                                                      |
| `engine/doomgeneric_ein.c`           | doomgeneric's platform layer for the worker.                                                                                                              |
| `engine/ein_sound.c`                 | The sound module: mixes the effects on their channels over the music, as the worker asks for samples.                                                     |
| `engine/opl_ein.c`                   | Chocolate Doom's OPL library on Nuked OPL3, rendering the music under the effects.                                                                        |
| `engine/ein_chocolate.h`             | What Chocolate Doom's music code expects of its own headers that doomgeneric's lack.                                                                      |
| `engine/Containerfile`               | The build: pinned emsdk image, doomgeneric commit and Chocolate Doom release.                                                                             |
| `engine/nonblocking-wipe.patch`      | Runs the screen melt a frame at a time instead of in a loop of its own, which did not return until the melt was over.                                     |
| `engine/quit.patch`                  | Makes Quit exit, and an exit function of the wrong type one of the right type, which WebAssembly traps on.                                                |
| `engine/save.patch`                  | Tells the worker when Doom has saved a game, so the page can keep it.                                                                                     |
| `engine/settings.patch`              | Puts back Chocolate Doom's reading and writing of the settings files, keys above 127 included.                                                            |
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
`engine/settings.patch` applied, Chocolate Doom's `i_oplmusic.c`, `midifile.c`, `opl3.c` and
`opl_queue.c` at the release it pins, and the `engine/` files added. It is built for a Web Worker
(`-sENVIRONMENT=worker`), as an ES module that runs nothing by itself (`-sINVOKE_RUN=0`) and touches
no DOM: the worker starts the game.

## Developing

Mount the checkout read-only in EiN's container as `/modules-dev/doom` and set
`DEV_MODULES_PATH=/modules-dev`; EiN sets the module up when it starts, and it runs instead of an
installed one. The games module has to be there too, installed or mounted beside it. After a change
under `ui/`, run `ui-build doom` in EiN's terminal and reload the browser; after a change to
`mod.json`, `mod setup doom`. A file in `assets/` is read as it is.

`deno.jsonc` reaches core and the games module by relative paths, so for type-checking the checkout
sits in a checkout of EiN core as `modules/doom`, with the games module beside it as
`modules/games`. Core's `deno task sync:modules` writes `deno.jsonc` again after a change to
`mod.json`.

The smoke test wants a running EiN with the games module, this one and a WAD (`--game`,
`freedoom1.wad` when not given), Google Chrome, and Node 22 or later:

    EIN_PASSWORD=... node test/smoke.mjs --game freedoom1.wad --out /some/directory

`--url` and `--user` say which EiN and who (`http://localhost:8080` and `admin` when not given), and
`CHROME` where Chrome is when it is not where macOS has it.

## Releases

A release is the version in `mod.json` and a tag of the same name, `v0.3.2`; EiN installs the
repository as it stands.

- **0.3.2**: this README, brought up to date with the two releases before it.
- **0.3.1**: the engine runs in the module's Web Worker, on the games module's kit, not on the
  page. The WADs are read from EiN with range requests as Doom asks for them, where they were
  downloaded whole before the game started. The sound effects are mixed in the engine with the
  music, since a worker has no Web Audio. The settings are also written each time Doom's menu
  closes. Needs core's module API 0.15.77 and games 0.1.1.
- **0.3.0**: Doom is played on the games module's pages: its WADs are cards on the Games page,
  `/games/doom/<WAD>` is the page of each, and the page of its own the module had is gone. Doom's
  settings are kept in the player's home, as its saves are. Freedoom is downloaded from the Games
  page when an administrator asks for it, not by a service when the module is installed. Needs the
  games module.
- **0.2.1**: saved games are kept in the player's home, and the last frame is dimmed after Quit.
- **0.2.0**: the list of WADs with their title screens, dropping a WAD to upload it, Freedoom
  fetched at install, sound, and the dashboard card.
- **0.1.0**: Doom as an EiN module.

## Licence

GPL-2.0-or-later, as doomgeneric and Chocolate Doom are: see `LICENSE`. Doom's source is © id
Software and the Chocolate Doom and doomgeneric authors; their notices are in the source the build
fetches. Nuked OPL3 (`opl3.c`) is LGPL-2.1-or-later, © Nuke.YKT. `assets/doom.js` is Emscripten's
runtime, under the MIT licence. Freedoom, which the module fetches when asked and does not ship, is
under its own BSD-style licence.
