/**
 * Doom's key codes (doomgeneric `doomkeys.h`) for the browser's physical keys
 * (`KeyboardEvent.code`), so a key goes up as the same Doom key it went down as, whatever the
 * keyboard layout makes of it.
 */

const KEY_RIGHTARROW = 0xae;
const KEY_LEFTARROW = 0xac;
const KEY_UPARROW = 0xad;
const KEY_DOWNARROW = 0xaf;
const KEY_USE = 0xa2;
const KEY_FIRE = 0xa3;
const KEY_ESCAPE = 27;
const KEY_ENTER = 13;
const KEY_TAB = 9;
const KEY_BACKSPACE = 0x7f;
const KEY_PAUSE = 0xff;
const KEY_RSHIFT = 0x80 + 0x36;
const KEY_RALT = 0x80 + 0x38;

/** F1 to F10 are 0x80 + 0x3b onwards; F11 and F12 sit apart, as on the PC keyboard's scan codes. */
const FUNCTION_KEYS: Record<string, number> = {
  F1: 0x80 + 0x3b,
  F2: 0x80 + 0x3c,
  F3: 0x80 + 0x3d,
  F4: 0x80 + 0x3e,
  F5: 0x80 + 0x3f,
  F6: 0x80 + 0x40,
  F7: 0x80 + 0x41,
  F8: 0x80 + 0x42,
  F9: 0x80 + 0x43,
  F10: 0x80 + 0x44,
  F11: 0x80 + 0x57,
  F12: 0x80 + 0x58,
};

/** Keys that are not a character: the controls, as the doomgeneric Emscripten port binds them. */
const SPECIAL: Record<string, number> = {
  ArrowUp: KEY_UPARROW,
  ArrowDown: KEY_DOWNARROW,
  ArrowLeft: KEY_LEFTARROW,
  ArrowRight: KEY_RIGHTARROW,
  Enter: KEY_ENTER,
  NumpadEnter: KEY_ENTER,
  Escape: KEY_ESCAPE,
  Tab: KEY_TAB,
  Backspace: KEY_BACKSPACE,
  Pause: KEY_PAUSE,
  Space: KEY_USE,
  ControlLeft: KEY_FIRE,
  ControlRight: KEY_FIRE,
  ShiftLeft: KEY_RSHIFT,
  ShiftRight: KEY_RSHIFT,
  AltLeft: KEY_RALT,
  AltRight: KEY_RALT,
  ...FUNCTION_KEYS,
};

/** Punctuation keys as the character they make unshifted on a US keyboard, which Doom expects. */
const PUNCTUATION: Record<string, string> = {
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Backquote: '`',
  Comma: ',',
  Period: '.',
  Slash: '/',
  NumpadAdd: '=',
  NumpadSubtract: '-',
};

/** The Doom key for a physical key, or undefined for one Doom has no use for. */
export function doomKey(code: string): number | undefined {
  if (code in SPECIAL) return SPECIAL[code];
  if (code in PUNCTUATION) return PUNCTUATION[code].charCodeAt(0);
  const letter = code.match(/^Key([A-Z])$/);
  if (letter) return letter[1].toLowerCase().charCodeAt(0);
  const digit = code.match(/^(?:Digit|Numpad)([0-9])$/);
  if (digit) return digit[1].charCodeAt(0);
  return undefined;
}
