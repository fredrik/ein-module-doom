# doom

A module for [EiN](https://einhq.eu) that plays Doom in the browser, on a page of its own at
`/doom`.

The engine is [doomgeneric](https://github.com/ozkl/doomgeneric) built to WebAssembly with
Emscripten, single-threaded, with a platform layer of its own (`engine/doomgeneric_ein.c`) and no
SDL. The page loads it at runtime from the module's `assets/` directory, drives it from
`requestAnimationFrame` and draws its 320 by 200 frames on a canvas, shown at 4:3.

It is not one of EiN's own modules and has nothing to do with a family's archive.

## Install

In EiN's terminal, as an administrator:

    mod install https://github.com/fredrik/ein-module-doom

Then give it game data, below. Without an IWAD the page says so and plays nothing.

## Game data

The game's data, an IWAD, is not part of this repository: it is id Software's. Put one in the
module's `assets/` directory on the server and the page plays it; when there are several it prefers
`doom2.wad`, `doom.wad` and `doom1.wad`, in that order, to the others.

- The shareware `doom1.wad` (v1.9, the first episode) is the one this was tried with.
  `scripts/fetch-wad.sh` fetches it out of Debian's `doom-wad-shareware` package and checks it
  against the SHA-1 Debian's game-data-packager lists for it.
- [Freedoom](https://freedoom.github.io) (`freedoom1.wad`, `freedoom2.wad`) is free game data for
  the same engine.

Where `assets/` is depends on how the module got there. One that `mod install` installed is in
the modules directory of the installation, `modules/doom/assets/` under its data directory, which
the container has as `/modules-installed/doom/assets/`:

    docker cp doom1.wad ein-core-1:/modules-installed/doom/assets/

A checkout mounted for development has it in the checkout, where `scripts/fetch-wad.sh` puts the
file.

## Keys

Click the game first, so it has the keyboard. Arrows move, Ctrl fires, Space opens doors, Shift
runs, Alt strafes, Escape opens Doom's menu, Enter picks. While the game has the focus it takes
these keys before EiN does, Alt+letter included; click outside it to give them back.

## Not yet

No sound or music, no mouse, and saved games last only as long as the page.

## Layout

| Path                                 | What it is for                                                                                                                   |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `mod.json`, `ui/nav.json`            | The manifest and the sidebar entry.                                                                                              |
| `ui/pages/doom.tsx`                  | The page: Play button, game loop, keyboard, fullscreen.                                                                          |
| `ui/doom/engine.ts`                  | Finds the IWAD, loads the glue, the wasm and the IWAD, and wraps the engine's exports.                                           |
| `ui/doom/keys.ts`                    | Browser key codes to Doom's.                                                                                                     |
| `engine/doomgeneric_ein.c`           | doomgeneric's platform layer for the page.                                                                                       |
| `engine/Containerfile`               | The build: pinned emsdk image and doomgeneric commit.                                                                            |
| `engine/nonblocking-wipe.patch`      | Runs the screen melt a frame at a time instead of in a loop that froze the page for a second.                                    |
| `assets/doom.js`, `assets/doom.wasm` | The built engine, committed, since a module is installed as its repository stands. `assets/doom-build.txt` says what built them. |
| `scripts/build-engine.sh`            | Rebuilds `assets/doom.js` and `assets/doom.wasm`.                                                                                |
| `scripts/fetch-wad.sh`               | Fetches and checks the shareware IWAD.                                                                                           |
| `test/smoke.mjs`                     | Signs in with headless Chrome, plays a little, saves screenshots.                                                                |
| `deno.jsonc`                         | Generated from `mod.json` by core's `deno task sync:modules`, for type-checking in a core checkout.                              |

## Building the engine

Needs only docker with buildx; nothing is installed on the host.

    scripts/build-engine.sh

It builds `engine/Containerfile` and exports the result into `assets/` with buildx's local
exporter. The source of the committed `assets/doom.wasm` is doomgeneric at the commit
`engine/Containerfile` pins, with `engine/nonblocking-wipe.patch` applied and
`engine/doomgeneric_ein.c` added.

## Developing

Mount the checkout read-only in EiN's container as `/modules-dev/doom` and set
`DEV_MODULES_PATH=/modules-dev`; EiN sets the module up when it starts, and it runs instead of an
installed one. After a change to a page, run `ui-build doom` in EiN's terminal and reload the
browser; after a change to `mod.json`, `mod setup doom`. A file in `assets/` is read as it is.

The smoke test wants a running EiN with the module and an IWAD, Google Chrome, and Node 22 or
later:

    EIN_PASSWORD=... node test/smoke.mjs --out /some/directory

## Licence

GPL-2.0-or-later, as doomgeneric is: see `LICENSE`. Doom's source is © id Software and the
Chocolate Doom and doomgeneric authors; their notices are in the source the build fetches.
`assets/doom.js` is Emscripten's runtime, under the MIT licence.
