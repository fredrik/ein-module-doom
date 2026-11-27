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
//	The few calls into SDL that Crispy Doom makes outside its video,
//	sound and joystick, which this build replaces: the time, the
//	configuration directory, the input state i_input.c reads, and the
//	rest of what i_system.c, i_timer.c, m_argv.c and m_config.c call.
//	The build compiles against SDL's headers (build.sh) and links no
//	SDL; whatever SDL call is left over fails the link.
//

#include <stdlib.h>
#include <string.h>

#include <emscripten.h>

#include "SDL.h"

// The input as the worker handed it over (ein_video.c).
SDL_Keymod EIN_GetModState(void);
void EIN_GetRelativeMouseState(int *x, int *y);

int SDL_Init(Uint32 flags)
{
    return 0;
}

int SDL_InitSubSystem(Uint32 flags)
{
    return 0;
}

void SDL_QuitSubSystem(Uint32 flags)
{
}

Uint32 SDL_WasInit(Uint32 flags)
{
    return flags;
}

void SDL_Quit(void)
{
}

const char *SDL_GetError(void)
{
    return "";
}

SDL_bool SDL_SetHint(const char *name, const char *value)
{
    return SDL_TRUE;
}

void SDL_GetVersion(SDL_version *ver)
{
    SDL_VERSION(ver);
}

const char *SDL_GetPlatform(void)
{
    return "EiN";
}

const char *SDL_GetCurrentAudioDriver(void)
{
    return "EiN";
}

// The page shows what the game prints, its errors included.
int SDL_ShowSimpleMessageBox(Uint32 flags, const char *title, const char *message, SDL_Window *window)
{
    return 0;
}

// The time from the worker's clock, which keeps moving while the game
// runs.
Uint32 SDL_GetTicks(void)
{
    return (Uint32) emscripten_get_now();
}

Uint64 SDL_GetTicks64(void)
{
    return (Uint64) emscripten_get_now();
}

Uint64 SDL_GetPerformanceCounter(void)
{
    return (Uint64) (emscripten_get_now() * 1000.0);
}

Uint64 SDL_GetPerformanceFrequency(void)
{
    return 1000000;
}

// The worker owns the loop, so there is nothing to sleep for: the
// game's waits are short spins on the time, which keeps moving.
void SDL_Delay(Uint32 ms)
{
}

// The configuration directory, where the settings files are: the root
// of the engine's file system, where the worker puts the player's.
char *SDL_GetPrefPath(const char *org, const char *app)
{
    return SDL_strdup("/");
}

char *SDL_strdup(const char *str)
{
    return strdup(str);
}

void SDL_free(void *mem)
{
    free(mem);
}

void SDL_qsort(void *base, size_t nmemb, size_t size, int (*compare)(const void *, const void *))
{
    qsort(base, nmemb, size, compare);
}

SDL_Keymod SDL_GetModState(void)
{
    return EIN_GetModState();
}

Uint32 SDL_GetRelativeMouseState(int *x, int *y)
{
    EIN_GetRelativeMouseState(x, y);
    return 0;
}

// Text input comes as the keys' events, as vanilla Doom read it.
void SDL_StartTextInput(void)
{
}

void SDL_StopTextInput(void)
{
}

int SDL_PeepEvents(SDL_Event *events, int numevents, SDL_eventaction action, Uint32 minType, Uint32 maxType)
{
    return 0;
}

void SDL_PumpEvents(void)
{
}
