# doom

A module for [EiN](https://einhq.eu) that plays Doom, Heretic and Hexen in the browser, with sound
and music, mouse look and the keys you choose: the 1993 one, shotgun and all, a click away from the
family's recipes. Its games are on EiN's **Games** page, which the games module gives: this module
brings the engines and the WADs, and the games module the page each is played on, the saves, the
sound and the dropped files.

The engines are [Crispy Doom](https://github.com/fabiangreffrath/crispy-doom)'s Doom, Heretic and
Hexen, each built to WebAssembly with Emscripten, single-threaded, with a platform layer of their
own (`engine/ein_*.c`) and no SDL. A game runs in the module's Web Worker, on the games module's kit
for an engine in a worker, not on the page: the worker loads its engine at runtime from the
module's `assets/` directory and reads the WADs from EiN a piece at a time as the game asks for
them, so a level is downloaded as it is played. Crispy draws at 640 by 400, wider to fit a wide
screen, and as often as the screen shows a frame, its movement drawn between the game's 35 tics a
second; the frames come out at the shape they had on a 4:3 CRT.

It is not one of EiN's own modules and has nothing to do with a family's archive.

## How it fits together

```
  the Games page (games module)                   the engine's worker (this module)
 ┌────────────────────────────────┐ tick, input  ┌──────────────────────────────────┐
 │ the canvas, the keyboard and   │ ───────────▶ │ doom.wasm, heretic.wasm or       │
 │ the mouse, Web Audio, and the  │              │ hexen.wasm: Crispy Doom, its     │
 │ player's saves and settings in │ ◀─────────── │ effects mixed over OPL3 music    │
 │ ~/.doom                        │  the frame,  └──────────────────────────────────┘
 └────────────────────────────────┘  the sound,           │ a piece of a WAD,
                                     files it wrote       ▼ as the game asks for it
                                                   /groups/users/doom/*.wad
```

The page and the worker talk by `postMessage` only, with no shared memory. Each animation frame the
page sends a tick; the worker runs the game's frame and answers with it, the sound for the time
since the last tick, and whether the game's menu is up. Nothing of the game's runs on the page's
thread.

## Install

It needs an EiN whose core has module API 0.15.77 or later, which gives a module its Web Workers,
and EiN's games module (`games`, 0.1.2-dev.8 or later). As an administrator, open **Settings → Modules**,
choose **Install**, and give `https://github.com/fredrik/ein-module-doom` under **From a
repository**.

The games are on the **Games** page, under Browse in the sidebar, a card each. The module comes with
no game data. Until it is there, the Games page offers free game data under **Free downloads**:
[Freedoom](https://freedoom.github.io), whose **Phase 1** plays as Doom and **Phase 2** as Doom II,
**Heretic (shareware)**, its first episode, and **Hexen (demo)**, its first four levels, which
Raven Software let anyone play and pass on. **Download**, for an administrator (EiN lets only the
administrator fetch from the internet), downloads Freedoom's release or the game's from the
[idgames archive](https://www.doomworld.com/idgames/), checks it against its SHA-256 and puts its
WADs in the folder; Freedoom's are both, whichever of the two it was chosen on. Nothing is
downloaded when the module is installed.

## Play

Each WAD's card on the Games page has its title screen, read out of the WAD, and under its title
its file's name and size, and for a PWAD the IWAD it is played with; the known games come first, in
the order they came out. Choose one to open its page, `/games/doom/<WAD>`, and **Play** to play it.

Click the game, so it has the keyboard and the mouse. The mouse looks around, up and down too, and
its left button fires; WASD or the arrows move, Space opens doors, Shift runs, the wheel changes
weapons, Escape opens the game's menu and gives the mouse back, Tab shows the map. Heretic and
Hexen also fly, look and use their artifacts from the keyboard, and Hexen jumps. While the game has
the focus it takes these keys before EiN does, Alt+letter included; click outside it to give them
back.

Where a keyboard plays, the page's header shows the keys and the mouse the game is played with. The
game has no menu to change them in, so **Keys**, in the ⋮ menu, is where they change: click a key,
then press the one it is to be. A change is kept in your settings, and the game running takes it at
once. Crispy's own menu, **Crispness** in the options, sets the rest: mouse look, the resolution,
the widescreen and how many frames are drawn. The buttons in
the header turn the sound off and on, which the browser remembers for next time, and show the game
full screen, as F11 does. A tab that is hidden holds the game and its sound until it shows again.
Quit in Doom's menu leaves the page as it was before **Play**.

## Saved games and settings

**Save Game** and **Load Game** keep your games in your home, in `.doom/<WAD>/`, one folder for
each WAD you play, so a save is loaded only into the game it was made in and nobody else sees it.
Crispy has pages of six slots each. A Doom slot is a file, `doomsav<slot>.dsg`, and a Heretic slot
`hticsav<slot>.hsg`; a Hexen slot is a folder, `slot<slot>/`, of the files Hexen keeps for it, one
for the slot and one for each map of the hub it remembers.

The settings are yours whatever WAD you play, kept once in `.doom/`, above the saves, two files for
each game: the game's own, `default.cfg`, `heretic.cfg` or `hexen.cfg`, with the volumes, the screen
size, messages and the keys bound, and Crispy's, `crispy-doom.cfg`, `crispy-heretic.cfg` or
`crispy-hexen.cfg`, with Crispy's further ones. Mouse look and drawing as many frames as the screen
shows are on until you turn them off. The settings are written when you close the game's menu,
quit, go to another page of EiN's or close the tab, and read when the game starts, all but the
sound's sample rate, which is the browser's.

Without an account, saves and settings last only as long as the page.

## On a dashboard

With EiN's Dashboards module, add the **Doom** card to a dashboard and choose its game, one of the
WADs there are; without a choice it is the first of them. The card plays the game as Doom does when
nobody plays: its title screen, and a few seconds later the demos recorded in the WAD, one after the
other. It makes no sound and takes no keys.

## Add your own WADs

Drag one or more `.wad` files from your computer and drop them anywhere on the Games page. The
Games page knows a WAD by its first bytes, `IWAD` or `PWAD`; it is uploaded and appears as a card.

- An IWAD is a whole game: `doom.wad`, `doom2.wad`, `plutonia.wad`, `tnt.wad`, the shareware
  `doom1.wad`; `heretic.wad` or the shareware `heretic1.wad`; `hexen.wad`, the full game or its
  demo. Its card calls a known one by its game's name; an IWAD by another name is played as the game
  its lumps say.
- A PWAD adds levels or changes to a game. Playing one plays it over an IWAD it fits: one whose maps
  have scripts over Hexen (`hexdd.wad`, Deathkings of the Dark Citadel, is one), one with `MAP01`
  levels over Doom II (or Final Doom, or Freedoom: Phase 2), one with `E1M1` episodes over Doom (or
  Freedoom: Phase 1), or over Heretic where there is no Doom with episodes. The games will not add a
  PWAD to a shareware or demo IWAD.

The WADs are kept in `/groups/users/doom`, the household's shared folder, so everyone with an
account plays the same ones and may add to them, and they stay when the module is updated or
installed again. **Delete game**, in the ⋮ menu of a WAD's page, deletes it for everyone; the free
game data is offered again once one of its WADs is gone. In EiN's terminal, `doom-fetch` with
`freedoom1.wad`, `freedoom2.wad`, `heretic1.wad` or `hexen.wad` fetches it, as **Download** does.

Strife runs on Crispy Doom too, but this module does not build it: its WADs are left off the Games
page.

In EiN's terminal, `doom-wads` lists the WADs with their titles and the game each is played on, and
the free game data not fetched yet; `games-list` lists them with every other game module's games.

## Sound

The sound effects are mixed in the engine, each at the volume, side and pitch the game gives it,
over the music, and played through the browser's Web Audio: a worker has no Web Audio of its own,
so the engine hands the page the finished mix. The music is the game's own: its MUS tracks played on
an emulated OPL3, the FM chip of the Sound Blaster and AdLib cards, by Crispy Doom's OPL music code
and the [Nuked OPL3](https://github.com/nukeykt/Nuked-OPL3) emulator, so E1M1 sounds much as it
did out of a Sound Blaster in 1993. The game's sound volume menu sets both.

## Not yet

No starting on a map, and no playing together. The games module has both for a game module that
asks for them; the module does not ask yet.

## Layout

| Path                                     | What it is for                                                                                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `mod.json`                               | The manifest: the games module it needs, the engine's worker, and the routes of a WAD's page and the dashboard card.                                               |
| `etc/games.d/games.json`                 | What the games module knows of the module: its title, icon and route, its list and fetch commands, its WAD folder, and the WADs it takes when dropped.             |
| `etc/games.d/help.md`                    | What the Games page's help says of the WADs to drop.                                                                                                               |
| `ui/pages/game.tsx`                      | A WAD's page, `/games/doom/<WAD>`: the games module's page for a game, with the module's adapter.                                                                  |
| `ui/cards/demo.tsx`                      | The dashboard card, offered in `etc/dashboard.d/cards.json`: the games module's demo card, a game running its demos.                                               |
| `ui/adapter.ts`                          | The adapter the games module plays the WADs with: lists them, starts one, says how it is played, draws its keys, and names the saves and settings kept.            |
| `ui/doom/engine.ts`                      | Starts a WAD on its engine in the worker: the build, the command line, the WADs to read from EiN, the player's saves and settings, the keys and the mouse.         |
| `ui/doom/engine-worker.ts`               | The engine's worker: loads the game's build, starts it, and answers each frame with its picture and sound, and the saves and settings the game writes.             |
| `ui/doom/start.ts`                       | What the page and the worker share: what the engine is started with, and where the player's files are in the game's file system.                                   |
| `ui/doom/keys.ts`                        | Browser key codes to SDL's scancodes, which the engine takes, and to the numbers the settings files keep keys as.                                                  |
| `ui/doom/binds.ts`                       | The player's keys and mouse buttons out of the settings files, and a key changed in the Keys dialog, written back and handed to the game.                          |
| `ui/doom/pad.tsx`                        | The drawing of the keyboard and the mouse with the player's keys, in the page's header and the Keys dialog, where a click and a key change one.                    |
| `bin/doom-wads`                          | Lists the WADs with their titles, title screens and games, and the free game data not fetched yet, for the Games page, a WAD's page and the card's choice of game. |
| `lib/wads.ts`, `lib/api.ts`              | Where the WADs are, the games known by name, the game a WAD is played on and the IWAD a PWAD is, the game data offered, and the shape `doom-wads` answers in.      |
| `lib/titlepic.ts`                        | Draws a WAD's title screen out of Doom's `TITLEPIC` or Heretic's and Hexen's `TITLE` and its palette, as a PNG.                                                    |
| `bin/doom-fetch`                         | Fetches Freedoom, Heretic's shareware or Hexen's demo into the WAD folder when Download is chosen, checked against its SHA-256.                                    |
| `engine/ein_main.c`                      | The engine's start and tick for the worker, in place of Crispy's `i_main.c`.                                                                                       |
| `engine/ein_video.c`                     | The frame and the input for the worker, in place of Crispy's `i_video.c`: the 8-bit frame as R, G, B, A bytes, the keys and the mouse as SDL's events.             |
| `engine/ein_sound.c`                     | The sound module: mixes the effects on their channels over the music, as the worker asks for samples.                                                              |
| `engine/opl_ein.c`                       | Crispy's OPL library on Nuked OPL3, rendering the music under the effects.                                                                                         |
| `engine/ein_sdl.c`                       | The few SDL calls left outside video, sound and the joystick: the time, the configuration directory, the input's state.                                            |
| `engine/ein_stubs.c`                     | What the engine has no use for: the joystick, ENDOOM, the startup screens, SDL_net.                                                                                |
| `engine/config.h`                        | What Crispy's build system would write into `config.h`.                                                                                                            |
| `engine/loop.patch`                      | Makes each game's loop hand its frame to the worker rather than run forever, and Doom's screen melt wait by returning rather than spinning.                        |
| `engine/actions.patch`                   | Calls each of Doom's state actions with as many arguments as it takes, which WebAssembly holds it to.                                                              |
| `engine/build.sh`                        | Compiles and links the three games.                                                                                                                                |
| `engine/Containerfile`                   | The build: pinned emsdk image, Crispy Doom release and SDL headers.                                                                                                |
| `assets/<game>.js`, `assets/<game>.wasm` | The built engines, `doom`, `heretic` and `hexen`, committed, since a module is installed as its repository stands. `assets/doom-build.txt` says what built them.   |
| `scripts/build-engine.sh`                | Rebuilds the engines in `assets/`.                                                                                                                                 |
| `test/smoke.mjs`                         | Signs in with headless Chrome, plays a little, saves screenshots.                                                                                                  |
| `deno.jsonc`                             | Generated from `mod.json` by core's `deno task sync:modules`, for type-checking in a core checkout.                                                                |

## Building the engine

Needs only docker with buildx, or podman; nothing is installed on the host.

    scripts/build-engine.sh

It builds `engine/Containerfile` and exports the result into `assets/` with the local exporter. The
source of the committed engines is Crispy Doom at the release `engine/Containerfile` pins, with
`engine/loop.patch` and `engine/actions.patch` applied, compiled against SDL 2's headers at the
release it pins, with the `engine/` files in place of Crispy's platform files (`engine/build.sh`
names those left out). Each is built for a Web Worker (`-sENVIRONMENT=worker`), as an ES module
that runs nothing by itself (`-sINVOKE_RUN=0`) and touches no DOM: the worker starts the game.

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
