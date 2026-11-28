import { Box, Group, Text, UnstyledButton } from '@mantine/core';
import { notify } from '@ein/ui/signals';
import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useState } from 'react';
import type { Engine, Game } from '../../lib/api.ts';
import { bindKey, changed, type Control, controlKey, CONTROLS, resetKeys, useSettings, valueOf } from './binds.ts';
import { keyLabel, keyName, settingOf } from './keys.ts';

/**
 * The keyboard and the mouse a game is played with, drawn with the player's keys on them: those
 * that move, fire, use and run, and Heretic's and Hexen's own, and what the mouse's buttons and
 * wheel do. Doom has no menu to change its keys in, so the Keys dialog is where they change: a click
 * on a key and then a key gives it that key (`bindKey`), in the game running too.
 */

/** Where each control's key cap is: `x`, `y` and its width, in the drawing's 320 by 124; Space's and Use's are `capAt`'s. */
const CAPS: Record<string, { x: number; y: number; w: number }> = {
  fire: { x: 0, y: 2, w: 60 },
  forward: { x: 78, y: 2, w: 34 },
  artifact: { x: 120, y: 2, w: 44 },
  left: { x: 40, y: 42, w: 34 },
  back: { x: 78, y: 42, w: 34 },
  right: { x: 116, y: 42, w: 34 },
  fly: { x: 158, y: 42, w: 44 },
  run: { x: 0, y: 82, w: 60 },
};

/** Each game's control on Space, the wide cap: what goes up, as Quake's Space does. Use is then a key of its own. */
const SPACE: Record<Engine, string> = { doom: 'jump', heretic: 'fly', hexen: 'jump' };

/** Where a control's cap is in `engine`'s drawing. */
function capAt(engine: Engine, id: string): { x: number; y: number; w: number } {
  if (id === SPACE[engine]) return { x: 66, y: 82, w: 118 };
  if (id === 'use') return { x: 168, y: 2, w: 34 };
  return CAPS[id];
}

/** What each of the game's mouse settings does, as the drawing names it. */
const MOUSE_ACTIONS: Record<string, string> = {
  // The wheel's weapons first: Crispy also binds Run to the wheel turning up, which a turn holds for no time.
  mouseb_nextweapon: 'Next weapon',
  mouseb_prevweapon: 'Prev weapon',
  mouseb_fire: 'Fire',
  mouseb_strafe: 'Strafe',
  mouseb_forward: 'Forward',
  mouseb_backward: 'Back',
  mouseb_speed: 'Run',
  mouseb_use: 'Use',
  mouseb_jump: 'Jump',
};

/** The keys that are never a control's: Escape, which lets go of a change, and F11, fullscreen. */
const RESERVED = new Set(['Escape', 'F11']);

/** What the mouse's button `button`, in Doom's numbering (0 the left, 1 the right, 2 the middle, 3 and 4 the wheel up and down), does: the first setting bound to it. */
function mouseAction(settings: Map<string, string> | undefined, button: number, engine: Engine): string {
  for (const [setting, action] of Object.entries(MOUSE_ACTIONS)) {
    if (valueOf(settings, setting, engine) === button) return action;
  }
  return '';
}

/** A control's key cap: its key, the control's name under it, dim when no key plays it; lit while it waits for its new key. Without `onPick` it only shows its key. */
function Cap(
  { id, engine, control, code, waiting, onPick }: {
    id: string;
    engine: Engine;
    control: Control;
    code: string | undefined;
    waiting: boolean;
    onPick?(): void;
  },
) {
  const { x, y, w } = capAt(engine, id);
  const label = waiting ? '?' : code ? keyLabel(code) : '—';
  const size = label.length > 2 ? 9 : 13;
  const picks = onPick
    ? {
      role: 'button',
      tabIndex: 0,
      style: { cursor: 'pointer', outline: 'none' },
      onClick: onPick,
      onKeyDown: (event: ReactKeyboardEvent<SVGGElement>) => {
        if (!waiting && (event.code === 'Enter' || event.code === 'Space')) {
          event.preventDefault();
          onPick();
        }
      },
    }
    : {};
  const named = code ? `${control.name}: ${keyName(code)}` : `${control.name}: no key`;
  return (
    <g
      data-doom-pad-key={id}
      opacity={code || waiting ? 1 : 0.5}
      aria-label={named}
      {...picks}
    >
      <title>{onPick ? `${named}, click to change` : named}</title>
      <rect
        className='doom-pad-shape'
        x={x}
        y={y}
        width={w}
        height={24}
        rx={4}
        fill='#2b2b30'
        stroke={waiting ? 'var(--mantine-primary-color-filled)' : '#55555e'}
        strokeWidth={waiting ? 3 : 1.5}
      />
      <text
        x={x + w / 2}
        y={y + 12}
        dy='0.36em'
        textAnchor='middle'
        fontSize={size}
        fontWeight={700}
        fill='#fff'
        style={{
          pointerEvents: 'none',
          fontFamily: 'var(--mantine-font-family-monospace)',
        }}
      >
        {label}
      </text>
      <Name x={x + w / 2} y={y + 33}>{control.name}</Name>
    </g>
  );
}

/** A control's or a button's name in the drawing. */
function Name({ x, y, children }: { x: number; y: number; children: string }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor='middle'
      fontSize={8}
      fontWeight={700}
      fill='#c4c4d0'
      style={{
        pointerEvents: 'none',
        letterSpacing: 0.4,
        paintOrder: 'stroke',
        stroke: 'rgba(0,0,0,0.55)',
        strokeWidth: 2.5,
      }}
    >
      {children.toUpperCase()}
    </text>
  );
}

/** The mouse at `x`,`y`: what its buttons do on them, its wheel's two ways and its click under them, and that moving it looks around. */
function Mouse(
  { x, y, settings, engine }: {
    x: number;
    y: number;
    settings: Map<string, string> | undefined;
    engine: Engine;
  },
) {
  const w = 86;
  const h = 116;
  const mid = x + w / 2;
  const [left, right, middle, up, down] = [0, 1, 2, 3, 4].map((button) => mouseAction(settings, button, engine));
  const look = valueOf(settings, 'crispy_mouselook', engine) !== 0;
  return (
    <g data-doom-pad-mouse>
      <title>
        {`Left button: ${left || 'nothing'}. Right button: ${right || 'nothing'}. Wheel up: ${up || 'nothing'}, down: ${down || 'nothing'}. Moving it ${
          look ? 'looks around' : 'turns'
        }.`}
      </title>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={40}
        fill='#1f1f23'
        stroke='#55555e'
        strokeWidth={1.5}
      />
      <path
        d={`M ${x} ${y + 50} H ${x + w} M ${mid} ${y} V ${y + 50}`}
        stroke='#55555e'
        strokeWidth={1.5}
      />
      <rect
        x={mid - 5}
        y={y + 12}
        width={10}
        height={24}
        rx={5}
        fill='#55555e'
      />
      <Name x={x + 21} y={y + 32}>{left}</Name>
      <Name x={x + w - 21} y={y + 32}>{right}</Name>
      {up && <Name x={mid} y={y + 66}>{`▲ ${up}`}</Name>}
      {down && <Name x={mid} y={y + 79}>{`▼ ${down}`}</Name>}
      {middle && <Name x={mid} y={y + 95}>{`● ${middle}`}</Name>}
      <Name x={mid} y={y + 109}>{look ? 'Look' : 'Turn'}</Name>
    </g>
  );
}

/** A notice of what failed and why, for a `.catch`. */
const failed = (what: string) => (error: unknown) =>
  notify({
    message: `${what}: ${error instanceof Error ? error.message : String(error)}`,
    color: 'red',
  });

/**
 * The keys and the mouse `game` is played with, the player's keys on them. An `editable` one, in the
 * Keys dialog, has under it what a click does: the line says which control a waiting key is for,
 * and Reset goes back to Crispy Doom's keys once any differ. While a key waits the next key pressed
 * is its own, kept from the game and the page; Escape lets go.
 */
export function DoomPad({ game, editable }: { game: Game; editable: boolean }) {
  const engine: Engine = game.state === 'installed' ? game.engine : 'doom';
  const settings = useSettings(engine);
  const controls = CONTROLS[engine];
  const [waiting, setWaiting] = useState<string>();

  useEffect(() => {
    if (!waiting) return;
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.code === 'Escape') return setWaiting(undefined);
      if (RESERVED.has(event.code) || settingOf(event.code) === undefined) {
        return;
      }
      setWaiting(undefined);
      bindKey(engine, controls[waiting], event.code).catch(
        failed('The key was not kept'),
      );
    };
    const onDown = (event: MouseEvent) => {
      if (!(event.target as Element).closest?.('[data-doom-pad-key]')) {
        setWaiting(undefined);
      }
    };
    globalThis.addEventListener('keydown', onKey, { capture: true });
    globalThis.addEventListener('mousedown', onDown, { capture: true });
    return () => {
      globalThis.removeEventListener('keydown', onKey, { capture: true });
      globalThis.removeEventListener('mousedown', onDown, { capture: true });
    };
  }, [waiting, engine, controls]);

  const current = waiting && controlKey(settings, controls[waiting], engine);
  return (
    <Box
      data-doom-pad
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <style>
        {'[data-doom-pad-key][role=button]:hover .doom-pad-shape, [data-doom-pad-key][role=button]:focus-visible .doom-pad-shape { filter: brightness(1.35); }'}
      </style>
      <svg
        viewBox='0 0 320 124'
        width='100%'
        style={{
          display: 'block',
          overflow: 'visible',
          filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.45))',
        }}
      >
        {Object.entries(controls).map(([id, control]) => (
          <Cap
            key={id}
            id={id}
            engine={engine}
            control={control}
            code={controlKey(settings, control, engine)?.code}
            waiting={waiting === id}
            onPick={editable ? () => setWaiting(id) : undefined}
          />
        ))}
        <Mouse x={222} y={4} settings={settings} engine={engine} />
      </svg>
      {editable && (
        <Group gap={8} wrap='nowrap' justify='center' style={{ minHeight: 18 }}>
          <Text
            size='xs'
            c={waiting ? 'white' : 'gray.3'}
            fw={waiting ? 600 : undefined}
            style={{
              whiteSpace: 'nowrap',
              textShadow: '0 1px 3px rgba(0,0,0,0.9)',
            }}
            data-doom-pad-hint
          >
            {waiting ? `Press the key for ${controls[waiting].name}. Escape keeps ${current ? keyName(current.code) : 'none'}.` : 'Click a key to change it'}
          </Text>
          {changed(settings, engine) && !waiting && (
            <UnstyledButton
              onClick={() => resetKeys(engine).catch(failed('The keys were not reset'))}
              data-doom-pad-reset
            >
              <Text size='xs' c='blue.3' td='underline'>Reset</Text>
            </UnstyledButton>
          )}
        </Group>
      )}
    </Box>
  );
}
