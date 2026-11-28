//
// Copyright(C) 2005-2014 Simon Howard
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
//	Crispy Doom's video and input for the module's engine worker, in
//	place of i_video.c: no window, no SDL renderer and no DOM. The game
//	draws its 8-bit frame in I_VideoBuffer as ever; I_FinishUpdate
//	turns it into R, G, B, A bytes in its own buffer, with Crispy's
//	aspect ratio correction done there, a row in five drawn twice, so
//	the frame the worker takes (ein_screen, ein_width, ein_height)
//	has square pixels: 320 by 240, 640 by 480 in high resolution, wider
//	in widescreen. The worker hands over the keys as SDL scancodes and
//	the mouse as SDL's buttons and movement; they wait in a queue for
//	I_StartTic, which hands them to i_input.c as the SDL events it
//	reads, and the movement for SDL_GetRelativeMouseState (ein_sdl.c).
//

#include <limits.h>
#include <math.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#include <emscripten.h>

#include "SDL.h"

#include "crispy.h"
#include "config.h"
#include "d_loop.h"
#include "deh_str.h"
#include "doomtype.h"
#include "i_input.h"
#include "i_joystick.h"
#include "i_system.h"
#include "i_timer.h"
#include "i_video.h"
#include "m_argv.h"
#include "m_config.h"
#include "m_misc.h"
#include "tables.h"
#include "v_diskicon.h"
#include "v_video.h"
#include "w_wad.h"
#include "z_zone.h"

int SCREENWIDTH, SCREENHEIGHT, SCREENHEIGHT_4_3;
int NONWIDEWIDTH;
int WIDESCREENDELTA;

// The settings i_video.c had, which the game and its menus still
// name: only those bound in I_BindVideoVariables are kept in the
// configuration file.
int usemouse = 1;
int png_screenshots = 0;
char *video_driver = "";
char *window_position = "center";
int fullscreen = false;
int aspect_ratio_correct = true;
int smooth_pixel_scaling = false;
int integer_scaling = false;
int vga_porch_flash = false;
int force_software_renderer = true;
int screen_width = 0;
int screen_height = 0;
pixel_t *I_VideoBuffer = NULL;
boolean screensaver_mode = false;
boolean screenvisible = true;
int usegamma = 0;
unsigned int joywait = 0;
fixed_t fractionaltic;

static boolean initialized = false;
static boolean nomouse = false;
static boolean display_fps_dots;
static boolean noblit;

// The size of the page's screen, which Crispy's widescreen "match
// screen" takes the shape of (ein_start sets it).
int ein_display_width = 1920;
int ein_display_height = 1080;

// The game's frame in 8 bits; I_VideoBuffer is it.
static pixel_t *screenbuffer = NULL;

// Each palette index as R, G, B, A bytes, read as one little-endian
// word: 0xAABBGGRR.
static uint32_t palette[256];

// The last frame, as R, G, B, A bytes, at most MAXWIDTH by
// MAXHEIGHT_4_3, and its size.
static uint32_t screen[MAXWIDTH * MAXHEIGHT_4_3];
static int screen_w = ORIGWIDTH;
static int screen_h = ORIGHEIGHT_4_3;

// How many frames the game has finished: the worker takes the frame
// when it moves.
static uint32_t frames = 0;

// Input the worker handed over that the game has not read yet: keys
// (an SDL scancode), mouse buttons (SDL's numbering) and the wheel.
// A tic reads them all, so this only needs to hold a tic's worth.
#define INPUT_QUEUE_SIZE 128

typedef enum
{
    INPUT_KEY,
    INPUT_BUTTON,
    INPUT_WHEEL,
} input_kind_t;

typedef struct
{
    input_kind_t kind;
    int pressed;
    int value;
} input_t;

static input_t input_queue[INPUT_QUEUE_SIZE];
static unsigned int input_write = 0;
static unsigned int input_read = 0;

// Which modifiers are down, for SDL_GetModState.
static SDL_Keymod modstate = KMOD_NONE;

// The mouse's movement since SDL_GetRelativeMouseState last took it.
static int mouse_dx = 0;
static int mouse_dy = 0;

void I_SetGrabMouseCallback(grabmouse_callback_t func)
{
}

void I_DisplayFPSDots(boolean dots_on)
{
    display_fps_dots = dots_on;
}

void I_ShutdownGraphics(void)
{
    initialized = false;
}

void I_StartFrame (void)
{
}

// The character an SDL scancode makes on a US keyboard, unshifted,
// for SDL's key symbol: i_input.c reads it only when the game does
// not map the keys as vanilla Doom did.
static SDL_Keycode KeycodeOf(SDL_Scancode scancode)
{
    static const char *const row = "1234567890";

    if (scancode >= SDL_SCANCODE_A && scancode <= SDL_SCANCODE_Z)
    {
        return SDLK_a + (scancode - SDL_SCANCODE_A);
    }
    if (scancode >= SDL_SCANCODE_1 && scancode <= SDL_SCANCODE_0)
    {
        return row[scancode - SDL_SCANCODE_1];
    }
    switch (scancode)
    {
        case SDL_SCANCODE_RETURN:    return SDLK_RETURN;
        case SDL_SCANCODE_ESCAPE:    return SDLK_ESCAPE;
        case SDL_SCANCODE_BACKSPACE: return SDLK_BACKSPACE;
        case SDL_SCANCODE_TAB:       return SDLK_TAB;
        case SDL_SCANCODE_SPACE:     return SDLK_SPACE;
        default:                     return SDL_SCANCODE_TO_KEYCODE(scancode);
    }
}

static SDL_Keymod ModifierOf(SDL_Scancode scancode)
{
    switch (scancode)
    {
        case SDL_SCANCODE_LSHIFT: return KMOD_LSHIFT;
        case SDL_SCANCODE_RSHIFT: return KMOD_RSHIFT;
        case SDL_SCANCODE_LCTRL:  return KMOD_LCTRL;
        case SDL_SCANCODE_RCTRL:  return KMOD_RCTRL;
        case SDL_SCANCODE_LALT:   return KMOD_LALT;
        case SDL_SCANCODE_RALT:   return KMOD_RALT;
        default:                  return KMOD_NONE;
    }
}

// Hand the input waiting to i_input.c, as SDL's events.
static void I_GetEvent(void)
{
    while (input_read != input_write)
    {
        const input_t *input = &input_queue[input_read];
        SDL_Event event;

        input_read = (input_read + 1) % INPUT_QUEUE_SIZE;
        memset(&event, 0, sizeof(event));

        switch (input->kind)
        {
            case INPUT_KEY:
                event.type = input->pressed ? SDL_KEYDOWN : SDL_KEYUP;
                event.key.keysym.scancode = input->value;
                event.key.keysym.sym = KeycodeOf(input->value);
                if (input->pressed)
                {
                    modstate |= ModifierOf(input->value);
                }
                else
                {
                    modstate &= ~ModifierOf(input->value);
                }
                event.key.keysym.mod = modstate;
                I_HandleKeyboardEvent(&event);
                break;

            case INPUT_BUTTON:
                event.type = input->pressed ? SDL_MOUSEBUTTONDOWN : SDL_MOUSEBUTTONUP;
                event.button.button = input->value;
                I_HandleMouseEvent(&event);
                break;

            case INPUT_WHEEL:
                event.type = SDL_MOUSEWHEEL;
                event.wheel.y = input->value;
                I_HandleMouseEvent(&event);
                break;
        }
    }
}

void I_StartTic (void)
{
    if (!initialized)
    {
        return;
    }

    I_GetEvent();

    if (usemouse && !nomouse)
    {
        I_ReadMouse();
    }
}

void I_UpdateFracTic(void)
{
    fractionaltic = I_GetFracRealTime();
}

void I_StartDisplay(void)
{
    if (usemouse && !nomouse)
    {
        I_ReadMouseUncapped();
    }
}

void I_UpdateNoBlit (void)
{
}

// The 8-bit frame as R, G, B, A bytes, with a row in five drawn twice
// when the aspect ratio is corrected, as a 320 by 200 screen was shown
// at 4:3.
static void Blit(void)
{
    int height = aspect_ratio_correct ? SCREENHEIGHT * 6 / 5 : SCREENHEIGHT;

    for (int y = 0; y < height; ++y)
    {
        const pixel_t *from = &I_VideoBuffer[(y * SCREENHEIGHT / height) * SCREENWIDTH];
        uint32_t *to = &screen[y * SCREENWIDTH];

        for (int x = 0; x < SCREENWIDTH; ++x)
        {
            to[x] = palette[from[x]];
        }
    }
    screen_w = SCREENWIDTH;
    screen_h = height;
}

void I_FinishUpdate (void)
{
    static int lasttic;
    static int lastmili;
    static int fpscount;
    int tics;
    int i;

    if (!initialized || noblit)
    {
        return;
    }

    // Draws little dots on the bottom of the screen.
    if (display_fps_dots)
    {
        i = I_GetTime();
        tics = i - lasttic;
        lasttic = i;
        if (tics > 20) tics = 20;

        for (i = 0; i < tics * 4; i += 4)
            I_VideoBuffer[(SCREENHEIGHT - 1) * SCREENWIDTH + i] = 0xff;
        for ( ; i < 20 * 4; i += 4)
            I_VideoBuffer[(SCREENHEIGHT - 1) * SCREENWIDTH + i] = 0x0;
    }

    // Crispy's frames a second, which its FPS counter shows.
    fpscount++;
    i = I_GetTimeMS();
    if (i - lastmili >= 1000)
    {
        crispy->fps = (fpscount * 1000) / (i - lastmili);
        fpscount = 0;
        lastmili = i;
    }

    V_DrawDiskIcon();
    Blit();
    frames++;
    V_RestoreDiskBackground();
}

void I_ReadScreen (pixel_t* scr)
{
    memcpy(scr, I_VideoBuffer, SCREENWIDTH*SCREENHEIGHT*sizeof(*scr));
}

// Crispy's intermediate gamma levels.
byte gamma2table[18][256];

static const float gammalevels[9] =
{
    // Darker
    0.50f, 0.55f, 0.60f, 0.65f, 0.70f, 0.75f, 0.80f, 0.85f, 0.90f,
};

void I_SetGammaTable (void)
{
    int i, j, k;

    for (i = 0; i < 9; ++i)
    {
        for (j = 0; j < 256; ++j)
        {
            gamma2table[i][j] = (byte)(pow(j / 255.0, 1.0 / gammalevels[i]) * 255.0 + 0.5);
        }
    }

    // The 5 original gamma levels.
    for (i = 9, k = 0; i < 18 && k < 5; i += 2, k++)
    {
        memcpy(gamma2table[i], gammatable[k], 256);
    }

    // 4 intermediate gamma levels.
    for (i = 10, k = 0; i < 18 && k < 4; i += 2, k++)
    {
        for (j = 0; j < 256; j++)
        {
            gamma2table[i][j] = (gammatable[k][j] + gammatable[k + 1][j]) / 2;
        }
    }
}

void I_SetPalette (byte *doompalette)
{
    for (int i = 0; i < 256; ++i)
    {
        // Zero out the bottom two bits of each channel: the PC VGA
        // controller only supports 6 bits of accuracy.
        uint32_t r = gamma2table[crispy->gamma][*doompalette++] & ~3;
        uint32_t g = gamma2table[crispy->gamma][*doompalette++] & ~3;
        uint32_t b = gamma2table[crispy->gamma][*doompalette++] & ~3;

        palette[i] = 0xff000000u | (b << 16) | (g << 8) | r;
    }
}

// Given an RGB value, find the closest matching palette index.
int I_GetPaletteIndex(int r, int g, int b)
{
    int best = 0, best_diff = INT_MAX;

    for (int i = 0; i < 256; ++i)
    {
        int pr = palette[i] & 0xff;
        int pg = (palette[i] >> 8) & 0xff;
        int pb = (palette[i] >> 16) & 0xff;
        int diff = (r - pr) * (r - pr) + (g - pg) * (g - pg) + (b - pb) * (b - pb);

        if (diff < best_diff)
        {
            best = i;
            best_diff = diff;
        }
        if (diff == 0)
        {
            break;
        }
    }

    return best;
}

void I_SetWindowTitle(const char *title)
{
}

void I_InitWindowTitle(void)
{
}

void I_RegisterWindowIcon(const unsigned int *icon, int width, int height)
{
}

void I_InitWindowIcon(void)
{
}

void I_GraphicsCheckCommandLine(void)
{
    //!
    // @category video
    // @vanilla
    //
    // Disable blitting the screen.
    //
    noblit = M_CheckParm("-noblit");

    //!
    // @category video
    //
    // Disable the mouse.
    //
    nomouse = M_CheckParm("-nomouse") > 0;
}

void I_CheckIsScreensaver(void)
{
}

void I_GetWindowPosition(int *x, int *y, int w, int h)
{
    *x = 0;
    *y = 0;
}

// Work out SCREENWIDTH, SCREENHEIGHT, NONWIDEWIDTH and WIDESCREENDELTA
// from Crispy's high resolution and widescreen settings, the page's
// screen standing for the display.
void I_GetScreenDimensions (void)
{
    int w = 16, h = 10;
    int ah;

    SCREENWIDTH = ORIGWIDTH << crispy->hires;
    SCREENHEIGHT = ORIGHEIGHT << crispy->hires;
    SCREENHEIGHT_4_3 = ORIGHEIGHT_4_3 << crispy->hires;

    NONWIDEWIDTH = SCREENWIDTH;

    ah = (aspect_ratio_correct == 1) ? (6 * SCREENHEIGHT / 5) : SCREENHEIGHT;

    // A display that is really wider than the frame.
    if (ein_display_width * ah >= ein_display_height * SCREENWIDTH)
    {
        w = ein_display_width;
        h = ein_display_height;
    }

    // Widescreen rendering makes no sense without aspect ratio
    // correction.
    if (crispy->widescreen && aspect_ratio_correct == 1)
    {
        switch (crispy->widescreen)
        {
            case RATIO_16_10:
                w = 16;
                h = 10;
                break;
            case RATIO_16_9:
                w = 16;
                h = 9;
                break;
            case RATIO_21_9:
                w = 21;
                h = 9;
                break;
            default:
                break;
        }

        SCREENWIDTH = w * ah / h;
        // An integer multiple of 4, never more than MAXWIDTH.
        SCREENWIDTH = (SCREENWIDTH + (crispy->hires ? 0 : 3)) & (int)~3;
        SCREENWIDTH = MIN(SCREENWIDTH, MAXWIDTH);
    }

    WIDESCREENDELTA = ((SCREENWIDTH - NONWIDEWIDTH) >> crispy->hires) / 2;
}

// The page shows each frame as it comes: there is no vsync to set.
void I_ToggleVsync (void)
{
}

static void CreateFramebuffer(void)
{
    free(screenbuffer);
    screenbuffer = calloc(SCREENWIDTH * SCREENHEIGHT, sizeof(*screenbuffer));
    I_VideoBuffer = screenbuffer;
    V_RestoreBuffer();
}

void I_InitGraphics(void)
{
    byte *doompal;

    I_GetScreenDimensions();
    V_Init();
    CreateFramebuffer();

    doompal = W_CacheLumpName(DEH_String("PLAYPAL"), PU_CACHE);
    I_SetPalette(doompal);

    initialized = true;
    I_AtExit(I_ShutdownGraphics, true);
}

// Crispy's menus change the resolution, widescreen and aspect ratio
// as the game runs: only the frame's buffer depends on them here.
void I_ReInitGraphics (int reinit)
{
    if (reinit & REINIT_FRAMEBUFFERS)
    {
        I_GetScreenDimensions();
        V_Init();
        CreateFramebuffer();
    }
}

// The last frame as R, G, B bytes, for Crispy's screenshots.
void I_RenderReadPixels(byte **data, int *w, int *h, int *p)
{
    byte *pixels = malloc(screen_w * screen_h * 3);

    for (int i = 0; i < screen_w * screen_h; ++i)
    {
        pixels[i * 3] = screen[i] & 0xff;
        pixels[i * 3 + 1] = (screen[i] >> 8) & 0xff;
        pixels[i * 3 + 2] = (screen[i] >> 16) & 0xff;
    }
    *data = pixels;
    *w = screen_w;
    *h = screen_h;
    *p = screen_w * 3;
}

void I_BindVideoVariables(void)
{
    M_BindIntVariable("use_mouse",            &usemouse);
    M_BindIntVariable("aspect_ratio_correct", &aspect_ratio_correct);
    M_BindIntVariable("usegamma",             &usegamma);
}

// SDL's view of the input, for i_input.c (ein_sdl.c).
SDL_Keymod EIN_GetModState(void)
{
    return modstate;
}

void EIN_GetRelativeMouseState(int *x, int *y)
{
    if (x != NULL)
    {
        *x = mouse_dx;
    }
    if (y != NULL)
    {
        *y = mouse_dy;
    }
    mouse_dx = 0;
    mouse_dy = 0;
}

static void Queue(input_kind_t kind, int pressed, int value)
{
    unsigned int next = (input_write + 1) % INPUT_QUEUE_SIZE;

    // A full queue drops the input rather than overwrite some not yet
    // read.
    if (next == input_read)
    {
        return;
    }
    input_queue[input_write].kind = kind;
    input_queue[input_write].pressed = pressed;
    input_queue[input_write].value = value;
    input_write = next;
}

// A key went down (`pressed` 1) or up (0); `scancode` is SDL's.
EMSCRIPTEN_KEEPALIVE
void ein_key(int pressed, int scancode)
{
    Queue(INPUT_KEY, pressed, scancode);
}

// A mouse button went down or up, in SDL's numbering: 1 the left, 2
// the middle, 3 the right.
EMSCRIPTEN_KEEPALIVE
void ein_button(int pressed, int button)
{
    Queue(INPUT_BUTTON, pressed, button);
}

// The wheel turned: `y` above 0 up, below down.
EMSCRIPTEN_KEEPALIVE
void ein_wheel(int y)
{
    Queue(INPUT_WHEEL, 1, y);
}

// The mouse moved by `dx`, `dy` pixels, down being positive.
EMSCRIPTEN_KEEPALIVE
void ein_mouse(int dx, int dy)
{
    mouse_dx += dx;
    mouse_dy += dy;
}

// Where the last frame is: ein_width by ein_height pixels of R, G, B,
// A bytes.
EMSCRIPTEN_KEEPALIVE
uint32_t *ein_screen(void)
{
    return screen;
}

EMSCRIPTEN_KEEPALIVE
int ein_width(void)
{
    return screen_w;
}

EMSCRIPTEN_KEEPALIVE
int ein_height(void)
{
    return screen_h;
}

EMSCRIPTEN_KEEPALIVE
uint32_t ein_frames(void)
{
    return frames;
}
