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
//	Crispy Doom's sound module for the module's engine worker: the
//	sound effects are mixed here, each on its channel at the volume,
//	side and pitch the game gives it, over the music, Crispy's OPL
//	music (i_oplmusic.c) on opl_ein.c. ein_audio_render hands the
//	worker both as interleaved 16-bit stereo at the page's sample rate,
//	snd_samplerate. i_sound.c knows it by the name of the PC speaker's
//	module, which the build renames to sound_ein_module (build.sh): the
//	only module in its list once SDL_mixer's is left out.
//

#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <emscripten.h>

#include "doomtype.h"
#include "d_mode.h"
#include "i_sound.h"
#include "m_misc.h"
#include "w_wad.h"
#include "z_zone.h"
#include "deh_str.h"

// Settings Crispy's SDL sound and music had, which the configuration
// file still names: the mixer resamples as it plays, and the music is
// the OPL's.
int use_libsamplerate = 0;
float libsamplerate_scale = 0.65f;
char *timidity_cfg_path = "";
char *music_pack_path = "";

void I_InitTimidityConfig(void)
{
}

// Music packs replace the music with recordings, which SDL_mixer
// played: i_sound.c tries them first, and this build has none.
static boolean NoMusicPack(void)
{
    return false;
}

const music_module_t music_pack_module =
{
    NULL,
    0,
    NoMusicPack,
};

// More than Doom's snd_channels can be set to.
#define NUM_CHANNELS 16

// An effect's samples, unsigned 8-bit, 128 the silence, at `rate`.
typedef struct
{
    uint8_t *samples;
    unsigned int length;
    unsigned int rate;
} clip_t;

// A clip playing on a channel: where it is, in the clip's samples,
// how far it moves on in a frame of the output, and its gain on each
// side.
typedef struct
{
    const clip_t *clip;
    double position;
    double step;
    float left;
    float right;
} voice_t;

static voice_t voices[NUM_CHANNELS];

static boolean use_sfx_prefix;

// The music, ahead of the effects (opl_ein.c).
void ein_music_render(int16_t *buffer, unsigned int frames);

// Doom's volume is 0 to 127, its separation 0 (left) to 254 (right),
// 128 the middle; the sides share the sound at equal power, as Web
// Audio's stereo panner shares it.
static void SetGains(voice_t *voice, int vol, int sep)
{
    float level = (vol < 0 ? 0 : vol > 127 ? 127 : vol) / 127.0f;
    float pan = (sep - 128) / 127.0f;
    float angle;

    pan = pan < -1 ? -1 : pan > 1 ? 1 : pan;
    angle = (pan + 1) * (float) M_PI / 4;
    voice->left = cosf(angle) * level;
    voice->right = sinf(angle) * level;
}

static void GetSfxLumpName(sfxinfo_t *sfx, char *buf, size_t buf_len)
{
    // A linked effect plays the lump of the one it links to.
    if (sfx->link != NULL)
    {
        sfx = sfx->link;
    }

    // Doom's effects are the lumps named DS<name>; Heretic's and
    // Hexen's are named as they are.
    if (use_sfx_prefix)
    {
        M_snprintf(buf, buf_len, "ds%s", DEH_String(sfx->name));
    }
    else
    {
        M_StringCopy(buf, DEH_String(sfx->name), buf_len);
    }
}

// Read an effect's samples out of its lump, once. A DMX sound lump is
// a format word (3), the sample rate, the length, then that many
// unsigned 8-bit samples, of which DMX skipped the first and the last
// 16; so does this, as Chocolate Doom does.
static const clip_t *LoadSfx(sfxinfo_t *sfxinfo)
{
    int lumpnum = sfxinfo->lumpnum;
    const uint8_t *data;
    unsigned int lumplen, rate, length;
    clip_t *clip;

    if (sfxinfo->driver_data != NULL)
    {
        return sfxinfo->driver_data;
    }

    data = W_CacheLumpNum(lumpnum, PU_STATIC);
    lumplen = W_LumpLength(lumpnum);

    if (lumplen < 8 || data[0] != 0x03 || data[1] != 0x00)
    {
        W_ReleaseLumpNum(lumpnum);
        return NULL;
    }

    rate = (data[3] << 8) | data[2];
    length = (data[7] << 24) | (data[6] << 16) | (data[5] << 8) | data[4];

    if (length > lumplen - 8 || length <= 48 || rate == 0)
    {
        W_ReleaseLumpNum(lumpnum);
        return NULL;
    }

    clip = malloc(sizeof(*clip));
    clip->length = length - 32;
    clip->samples = malloc(clip->length);
    clip->rate = rate;
    memcpy(clip->samples, data + 8 + 16, clip->length);
    W_ReleaseLumpNum(lumpnum);

    sfxinfo->driver_data = clip;
    return clip;
}

static boolean EIN_InitSound(GameMission_t mission)
{
    use_sfx_prefix = (mission == doom || mission == strife);
    return true;
}

static void EIN_ShutdownSound(void)
{
}

static int EIN_GetSfxLumpNum(sfxinfo_t *sfx)
{
    char namebuf[9];

    GetSfxLumpName(sfx, namebuf, sizeof(namebuf));

    // A WAD without the lump plays nothing rather than stopping the game.
    return W_CheckNumForName(namebuf);
}

static void EIN_UpdateSound(void)
{
}

static void EIN_UpdateSoundParams(int channel, int vol, int sep)
{
    if (channel < 0 || channel >= NUM_CHANNELS)
    {
        return;
    }
    SetGains(&voices[channel], vol, sep);
}

static int EIN_StartSound(sfxinfo_t *sfxinfo, int channel, int vol, int sep, int pitch)
{
    const clip_t *clip;
    voice_t *voice;

    if (channel < 0 || channel >= NUM_CHANNELS || sfxinfo->lumpnum < 0)
    {
        return -1;
    }
    clip = LoadSfx(sfxinfo);
    if (clip == NULL)
    {
        return -1;
    }

    voice = &voices[channel];
    voice->clip = clip;
    voice->position = 0;
    voice->step = (double) clip->rate / (snd_samplerate > 0 ? snd_samplerate : 48000);
    // A pitch above NORM_PITCH plays the effect faster, below slower,
    // by as much as Crispy's SDL mixer shortens or lengthens it.
    if (snd_pitchshift && pitch != NORM_PITCH && pitch > 0)
    {
        voice->step /= 2 - (double) pitch / NORM_PITCH;
    }
    SetGains(voice, vol, sep);
    return channel;
}

static void EIN_StopSound(int channel)
{
    if (channel >= 0 && channel < NUM_CHANNELS)
    {
        voices[channel].clip = NULL;
    }
}

static boolean EIN_SoundIsPlaying(int channel)
{
    return channel >= 0 && channel < NUM_CHANNELS && voices[channel].clip != NULL;
}

static void EIN_CacheSounds(sfxinfo_t *sounds, int num_sounds)
{
}

static snddevice_t sound_ein_devices[] =
{
    SNDDEVICE_SB,
    SNDDEVICE_PAS,
    SNDDEVICE_GUS,
    SNDDEVICE_WAVEBLASTER,
    SNDDEVICE_SOUNDCANVAS,
    SNDDEVICE_AWE32,
};

const sound_module_t sound_ein_module =
{
    sound_ein_devices,
    arrlen(sound_ein_devices),
    EIN_InitSound,
    EIN_ShutdownSound,
    EIN_GetSfxLumpNum,
    EIN_UpdateSound,
    EIN_UpdateSoundParams,
    EIN_StartSound,
    EIN_StopSound,
    EIN_SoundIsPlaying,
    EIN_CacheSounds,
};

// Fill `buffer` with `frames` frames of interleaved 16-bit stereo:
// the music, and each effect playing over it, its samples between
// two of the clip's drawn on a line between them. An effect that has
// played to its end leaves its channel free.
EMSCRIPTEN_KEEPALIVE
void ein_audio_render(int16_t *buffer, unsigned int frames)
{
    ein_music_render(buffer, frames);

    for (unsigned int i = 0; i < frames; ++i)
    {
        float left = buffer[i * 2];
        float right = buffer[i * 2 + 1];

        for (int channel = 0; channel < NUM_CHANNELS; ++channel)
        {
            voice_t *voice = &voices[channel];
            const clip_t *clip = voice->clip;
            unsigned int at;
            float fraction, sample;

            if (clip == NULL)
            {
                continue;
            }
            at = (unsigned int) voice->position;
            if (at >= clip->length)
            {
                voice->clip = NULL;
                continue;
            }
            fraction = (float) (voice->position - at);
            sample = clip->samples[at];
            if (at + 1 < clip->length)
            {
                sample += (clip->samples[at + 1] - sample) * fraction;
            }
            // 128 is the silence, and 128 either side the loudest.
            sample = (sample - 128) * 256;
            left += sample * voice->left;
            right += sample * voice->right;
            voice->position += voice->step;
        }

        buffer[i * 2] = (int16_t) (left < -32768 ? -32768 : left > 32767 ? 32767 : left);
        buffer[i * 2 + 1] = (int16_t) (right < -32768 ? -32768 : right > 32767 ? 32767 : right);
    }
}
