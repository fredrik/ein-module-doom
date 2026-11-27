// What Crispy Doom's build system writes into config.h (cmake/config.h.cin),
// for the module's build (build.sh): no FluidSynth, libsamplerate or libpng,
// and the paletted renderer, not the true-colour one.

#define PACKAGE_NAME "Crispy Doom"
#define PACKAGE_TARNAME "crispy-doom"
#define PACKAGE_VERSION "7.2"
#define PACKAGE_STRING "Crispy Doom 7.2"
#define PROGRAM_PREFIX "crispy-"

#define HAVE_DIRENT_H
#define HAVE_DECL_STRCASECMP 1
#define HAVE_DECL_STRNCASECMP 1
