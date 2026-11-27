//
// Copyright(C) 2026 The ein-module-doom authors
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License
// as published by the Free Software Foundation; either version 2
// of the License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// DESCRIPTION:
//	doomgeneric's platform layer for the module's engine worker
//	(ui/doom/engine-worker.ts): no SDL, no window, no DOM and no loop
//	of its own. The worker drives the game: it puts the WADs in
//	Emscripten's file system, calls ein_start once, then ein_tick
//	each time the page asks for a frame, takes the frame from
//	ein_screen whenever ein_frames moves on, and hands over keys with
//	ein_key, already in Doom's key codes. Saves are files in
//	.savegame/ under the working directory, /, and settings are
//	.default.cfg and .doomgenericdoom.cfg in it: the worker writes the
//	player's there before ein_start, and ein_wrote tells it each time
//	Doom has written one, a save as it is made and the settings on
//	Quit and ein_save_config. Sound is ein_sound.c and opl_ein.c,
//	mixed by ein_audio_render.
//

#include <stdint.h>
#include <stdlib.h>

#include <emscripten.h>

#include "doomgeneric.h"
#include "doomstat.h"
#include "i_sound.h"
#include "i_system.h"
#include "m_config.h"
#include "m_misc.h"
#include "p_saveg.h"

// Where Doom's settings files are: its configuration directory
// (m_config.c), joined to their names as M_SetConfigFilenames is.
extern char *configdir;
static const char *settings_files[] = { "default.cfg", "doomgenericdoom.cfg" };

// Keys the worker handed over that the game has not read yet. A frame
// reads them all, so this only needs to hold one frame's worth.
#define KEY_QUEUE_SIZE 64

static uint16_t key_queue[KEY_QUEUE_SIZE];
static unsigned int key_write = 0;
static unsigned int key_read = 0;

// How many frames the game has finished: the worker takes the frame
// when it moves.
static uint32_t frames = 0;

// The last frame, as R, G, B, A bytes.
static uint32_t screen[DOOMGENERIC_RESX * DOOMGENERIC_RESY];

void DG_Init()
{
}

// Doom's pixels are 0x00RRGGBB words; the frame is R, G, B, A bytes,
// which read as one little-endian word are 0xAABBGGRR.
void DG_DrawFrame()
{
    for (int i = 0; i < DOOMGENERIC_RESX * DOOMGENERIC_RESY; ++i)
    {
        uint32_t pixel = DG_ScreenBuffer[i];
        screen[i] = 0xff000000u | ((pixel & 0xff) << 16) | (pixel & 0xff00) | ((pixel >> 16) & 0xff);
    }
    frames++;
}

// The worker owns the loop, so there is nothing to sleep for: Doom's own
// waits are short spins on DG_GetTicksMs, which keeps moving.
void DG_SleepMs(uint32_t ms)
{
}

uint32_t DG_GetTicksMs()
{
    return (uint32_t) emscripten_get_now();
}

int DG_GetKey(int *pressed, unsigned char *key)
{
    if (key_read == key_write)
    {
        return 0;
    }
    uint16_t data = key_queue[key_read];
    key_read = (key_read + 1) % KEY_QUEUE_SIZE;
    *pressed = data >> 8;
    *key = data & 0xff;
    return 1;
}

void DG_SetWindowTitle(const char *title)
{
}

// Doom has written the file at `path`, for the player to keep.
EM_JS(void, ein_wrote, (const char *path), {
    if (Module.einWrote) Module.einWrote(UTF8ToString(path));
});

// Doom has saved the game in `slot`, in its file (save.patch calls
// this).
void ein_saved(int slot)
{
    ein_wrote(P_SaveGameFile(slot));
}

// Doom has written its settings files (M_SaveDefaults).
static void WroteSettings(void)
{
    for (unsigned int i = 0; i < arrlen(settings_files); ++i)
    {
        char *path = M_StringJoin(configdir, settings_files[i], NULL);
        ein_wrote(path);
        free(path);
    }
}

// Start the game with the command line `argv` (-iwad and -file name
// the WADs in the file system), its sound mixed at `samplerate`, the
// page's. It returns after the first tick; ein_tick runs the rest.
EMSCRIPTEN_KEEPALIVE
void ein_start(int argc, char **argv, int samplerate)
{
    snd_samplerate = samplerate;
    // Quit runs the exit functions last registered first, so this one,
    // registered before Doom's own, runs after M_SaveDefaults has
    // written the settings.
    I_AtExit(WroteSettings, false);
    doomgeneric_Create(argc, argv);
}

// Write Doom's settings now, as Quit does, so the player keeps them
// when the game is stopped without it or a menu closes.
EMSCRIPTEN_KEEPALIVE
void ein_save_config()
{
    M_SaveDefaults();
    WroteSettings();
}

// Whether Doom's menu is up.
EMSCRIPTEN_KEEPALIVE
int ein_menu()
{
    return menuactive ? 1 : 0;
}

// Run whatever tics are due and draw a frame.
EMSCRIPTEN_KEEPALIVE
void ein_tick()
{
    doomgeneric_Tick();
}

// A key went down (`pressed` 1) or up (0); `key` is a Doom key code. A
// full queue drops the key rather than overwrite one not yet read.
EMSCRIPTEN_KEEPALIVE
void ein_key(int pressed, int key)
{
    unsigned int next = (key_write + 1) % KEY_QUEUE_SIZE;
    if (next == key_read)
    {
        return;
    }
    key_queue[key_write] = (uint16_t) (((pressed ? 1 : 0) << 8) | (key & 0xff));
    key_write = next;
}

// Where the last frame is: DOOMGENERIC_RESX by DOOMGENERIC_RESY pixels
// of R, G, B, A bytes.
EMSCRIPTEN_KEEPALIVE
uint32_t *ein_screen()
{
    return screen;
}

EMSCRIPTEN_KEEPALIVE
int ein_width()
{
    return DOOMGENERIC_RESX;
}

EMSCRIPTEN_KEEPALIVE
int ein_height()
{
    return DOOMGENERIC_RESY;
}

EMSCRIPTEN_KEEPALIVE
uint32_t ein_frames()
{
    return frames;
}
