/**
 * The browser's physical keys (`KeyboardEvent.code`) as the engine and Crispy Doom's settings know
 * them: the engine takes a key as SDL's scancode, its USB usage, which Crispy turns into its own key
 * (`SCANCODE_TO_KEYS_ARRAY`); the settings files keep a bound key as the PC keyboard's scancode
 * that makes it (`scantokey` in `m_config.c`), `key_up 72` for the up arrow. A key goes up as the
 * same key it went down as, whatever the keyboard layout makes of it.
 */

/** Each key the game takes: its SDL scancode, and its number in the settings files. Generated from Crispy Doom 7.2's two tables. */
const KEYS: Record<string, [scancode: number, setting: number]> = {
  KeyA: [4, 30],
  KeyB: [5, 48],
  KeyC: [6, 46],
  KeyD: [7, 32],
  KeyE: [8, 18],
  KeyF: [9, 33],
  KeyG: [10, 34],
  KeyH: [11, 35],
  KeyI: [12, 23],
  KeyJ: [13, 36],
  KeyK: [14, 37],
  KeyL: [15, 38],
  KeyM: [16, 50],
  KeyN: [17, 49],
  KeyO: [18, 24],
  KeyP: [19, 25],
  KeyQ: [20, 16],
  KeyR: [21, 19],
  KeyS: [22, 31],
  KeyT: [23, 20],
  KeyU: [24, 22],
  KeyV: [25, 47],
  KeyW: [26, 17],
  KeyX: [27, 45],
  KeyY: [28, 21],
  KeyZ: [29, 44],
  Digit1: [30, 2],
  Digit2: [31, 3],
  Digit3: [32, 4],
  Digit4: [33, 5],
  Digit5: [34, 6],
  Digit6: [35, 7],
  Digit7: [36, 8],
  Digit8: [37, 9],
  Digit9: [38, 10],
  Digit0: [39, 11],
  Enter: [40, 28],
  Escape: [41, 1],
  Backspace: [42, 14],
  Tab: [43, 15],
  Space: [44, 57],
  Minus: [45, 12],
  Equal: [46, 13],
  BracketLeft: [47, 26],
  BracketRight: [48, 27],
  Backslash: [49, 43],
  Semicolon: [51, 39],
  Quote: [52, 40],
  Backquote: [53, 41],
  Comma: [54, 51],
  Period: [55, 52],
  Slash: [56, 53],
  CapsLock: [57, 58],
  F1: [58, 59],
  F2: [59, 60],
  F3: [60, 61],
  F4: [61, 62],
  F5: [62, 63],
  F6: [63, 64],
  F7: [64, 65],
  F8: [65, 66],
  F9: [66, 67],
  F10: [67, 68],
  F11: [68, 87],
  F12: [69, 88],
  PrintScreen: [70, 126],
  ScrollLock: [71, 70],
  Pause: [72, 69],
  Insert: [73, 82],
  Home: [74, 71],
  PageUp: [75, 73],
  Delete: [76, 83],
  End: [77, 79],
  PageDown: [78, 81],
  ArrowRight: [79, 77],
  ArrowLeft: [80, 75],
  ArrowDown: [81, 80],
  ArrowUp: [82, 72],
  NumpadDivide: [84, 53],
  NumpadMultiply: [85, 55],
  NumpadSubtract: [86, 12],
  NumpadAdd: [87, 78],
  NumpadEnter: [88, 28],
  Numpad1: [89, 79],
  Numpad2: [90, 80],
  Numpad3: [91, 81],
  Numpad4: [92, 75],
  Numpad5: [93, 76],
  Numpad6: [94, 77],
  Numpad7: [95, 71],
  Numpad8: [96, 72],
  Numpad9: [97, 73],
  Numpad0: [98, 82],
  IntlBackslash: [100, 43],
  NumpadEqual: [103, 13],
  ControlLeft: [224, 29],
  ShiftLeft: [225, 42],
  AltLeft: [226, 56],
  ControlRight: [228, 29],
  ShiftRight: [229, 42],
  AltRight: [230, 56],
};

/** The SDL scancode the engine takes for a physical key, or undefined for one the game has no use for. */
export const scancode = (code: string): number | undefined => KEYS[code]?.[0];

/** A physical key's number in the settings files, or undefined for one that cannot be bound. */
export const settingOf = (code: string): number | undefined => KEYS[code]?.[1];

/** The physical key a number in the settings files is: the first that makes it, so the up arrow rather than the keypad's 8. */
export function codeOf(setting: number): string | undefined {
  for (const [code, [, number]] of Object.entries(KEYS)) if (number === setting) return code;
  return undefined;
}

/** A key's name short enough for a key cap: `W` for `KeyW`, `↑` for `ArrowUp`, `Ctrl`. */
export function keyLabel(code: string): string {
  const named: Record<string, string> = {
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Enter: '⏎',
    NumpadEnter: '⏎',
    Space: 'Space',
    ShiftLeft: '⇧',
    ShiftRight: '⇧',
    ControlLeft: 'Ctrl',
    ControlRight: 'Ctrl',
    AltLeft: 'Alt',
    AltRight: 'Alt',
    Backspace: '⌫',
    Tab: '⇥',
    Escape: 'Esc',
    CapsLock: 'Caps',
    PageUp: 'PgUp',
    PageDown: 'PgDn',
    Insert: 'Ins',
    Delete: 'Del',
    Minus: '-',
    Equal: '=',
    BracketLeft: '[',
    BracketRight: ']',
    Backslash: '\\',
    IntlBackslash: '\\',
    Semicolon: ';',
    Quote: "'",
    Backquote: '`',
    Comma: ',',
    Period: '.',
    Slash: '/',
  };
  if (code in named) return named[code];
  const key = /^(?:Key|Digit)(.)$/.exec(code);
  if (key) return key[1];
  const numpad = /^Numpad(.+)$/.exec(code);
  if (numpad) return `N${numpad[1].slice(0, 3)}`;
  return code.slice(0, 5);
}

/** A key's name in full, for a tooltip and the Keys dialog's line: `W`, `up arrow`, `Ctrl`. */
export function keyName(code: string): string {
  const arrow = /^Arrow(Up|Down|Left|Right)$/.exec(code);
  if (arrow) return `${arrow[1].toLowerCase()} arrow`;
  const label = keyLabel(code);
  return label === code.slice(0, 5) ? code : label;
}
