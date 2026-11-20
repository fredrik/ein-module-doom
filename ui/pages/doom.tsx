import { Alert, Box, Button, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { TablerIcon } from '@ein/ui/components';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type Engine, startEngine } from '../doom/engine.ts';
import { doomKey } from '../doom/keys.ts';

/** Where the game is: waiting for the click that starts it, loading, playing, or stopped by an error. */
type State = { kind: 'idle' } | { kind: 'loading' } | { kind: 'running'; iwad: string } | { kind: 'error'; message: string };

/** How many of Doom's last printed lines an error shows, since `I_Error` prints its reason before it exits. */
const LOG_TAIL = 6;

/**
 * The module's one page: Doom on a canvas. Nothing loads until Play, which is also the click a
 * browser wants before a page may make sound. While the game has focus it takes every key it knows
 * before the shell does, so Alt (strafe), Escape (Doom's menu) and the rest reach the game rather
 * than the shell's shortcuts.
 */
export default function Doom() {
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<Engine | null>(null);
  const log = useRef<string[]>([]);
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [fullscreen, setFullscreen] = useState(false);

  const play = useCallback(async () => {
    setState({ kind: 'loading' });
    frame.current?.focus();
    try {
      const started = await startEngine((line) => {
        log.current = [...log.current.slice(-(LOG_TAIL - 1)), line];
        console.info(`[doom] ${line}`);
      });
      engine.current = started;
      setState({ kind: 'running', iwad: started.iwad });
      frame.current?.focus();
    } catch (error) {
      setState({ kind: 'error', message: describe(error, log.current) });
    }
  }, []);

  // The loop: as many tics as are due on every animation frame, and a blit when Doom drew.
  useEffect(() => {
    const game = engine.current;
    const context = canvas.current?.getContext('2d');
    if (state.kind !== 'running' || !game || !context) return;
    const image = context.createImageData(game.width, game.height);
    let drawn = -1;
    let request = 0;
    const step = () => {
      try {
        game.tick();
      } catch (error) {
        engine.current = null;
        setState({ kind: 'error', message: describe(error, log.current) });
        return;
      }
      if (game.frames() !== drawn) {
        drawn = game.frames();
        game.draw(image);
        context.putImageData(image, 0, 0);
      }
      request = requestAnimationFrame(step);
    };
    request = requestAnimationFrame(step);
    return () => cancelAnimationFrame(request);
  }, [state]);

  // Keys, in the capture phase on the window so the shell's own listeners (on the document, and
  // the window's bubbling phase) never see them while the game has focus.
  useEffect(() => {
    if (state.kind !== 'running') return;
    const held = new Set<number>();
    const focused = () => !!frame.current && frame.current.contains(document.activeElement);
    const onKey = (event: KeyboardEvent) => {
      const game = engine.current;
      if (!game || !focused() || event.metaKey) return;
      const key = doomKey(event.code);
      if (key === undefined) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const pressed = event.type === 'keydown';
      if (pressed && event.repeat) return;
      if (pressed) held.add(key);
      else held.delete(key);
      game.key(pressed, key);
    };
    // A key held while focus leaves would never come up for the game: let go of them all.
    const release = () => {
      for (const key of held) engine.current?.key(false, key);
      held.clear();
    };
    const node = frame.current;
    globalThis.addEventListener('keydown', onKey, { capture: true });
    globalThis.addEventListener('keyup', onKey, { capture: true });
    globalThis.addEventListener('blur', release);
    node?.addEventListener('focusout', release);
    return () => {
      globalThis.removeEventListener('keydown', onKey, { capture: true });
      globalThis.removeEventListener('keyup', onKey, { capture: true });
      globalThis.removeEventListener('blur', release);
      node?.removeEventListener('focusout', release);
    };
  }, [state]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === frame.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void frame.current?.requestFullscreen().catch(() => undefined);
    frame.current?.focus();
  };

  return (
    <Stack>
      <Group justify='space-between'>
        <Title order={2}>Doom</Title>
        <Button
          variant='default'
          leftSection={<TablerIcon name='maximize' size={16} />}
          disabled={state.kind !== 'running'}
          onClick={toggleFullscreen}
          data-doom-fullscreen
        >
          Fullscreen
        </Button>
      </Group>
      {state.kind === 'error' && (
        <Alert color='red' title='Doom stopped'>
          <Text size='sm' style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{state.message}</Text>
        </Alert>
      )}
      <Box
        ref={frame}
        tabIndex={0}
        data-doom-state={state.kind}
        onMouseDown={() => frame.current?.focus()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: fullscreen ? undefined : 960,
          background: '#000',
          outline: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* 320 by 200 drawn at 4:3, the shape Doom's pixels had on a CRT. */}
        <canvas
          ref={canvas}
          width={320}
          height={200}
          style={{
            width: fullscreen ? 'min(100vw, 133.333vh)' : '100%',
            aspectRatio: '4 / 3',
            imageRendering: 'pixelated',
            display: 'block',
          }}
        />
        {state.kind !== 'running' && (
          <Stack pos='absolute' inset={0} align='center' justify='center' gap='xs'>
            {state.kind === 'loading'
              ? <Loader color='red' />
              : (
                <Button size='lg' color='red' leftSection={<TablerIcon name='player-play' size={18} />} onClick={play} data-doom-play>
                  {state.kind === 'error' ? 'Play again' : 'Play'}
                </Button>
              )}
          </Stack>
        )}
      </Box>
      <Text c='dimmed' size='sm'>
        {state.kind === 'running' ? `Playing ${state.iwad}. ` : ''}
        Click the game to give it the keyboard. Arrows move, Ctrl fires, Space opens doors, Shift runs, Alt strafes, Escape is the menu.
      </Text>
    </Stack>
  );
}

/** An error and the last lines Doom printed, which say why when the game itself gave up. */
function describe(error: unknown, lines: string[]): string {
  const message = error instanceof Error ? error.message : String(error);
  return [message, ...lines].join('\n');
}
