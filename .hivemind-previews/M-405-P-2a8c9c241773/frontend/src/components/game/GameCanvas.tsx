import { useEffect, useRef, useState } from 'react';
import { createInitialState, Direction, GameState, step } from '../../lib/gameLogic';
import type { Difficulty } from '../../routes/Game';
import { useSound } from '../../hooks/useSound';

interface GameCanvasProps {
  difficulty: Difficulty;
  soundEnabled: boolean;
  onScoreChange: (score: number) => void;
  onStatusChange: (status: 'idle' | 'running' | 'paused' | 'over') => void;
}

const CELL_SIZE = 18;
const GRID_SIZE = 24;

function difficultyToSpeed(difficulty: Difficulty): number {
  switch (difficulty) {
    case 'easy':
      return 7;
    case 'hard':
      return 14;
    case 'normal':
    default:
      return 10;
  }
}

export function GameCanvas({ difficulty, soundEnabled, onScoreChange, onStatusChange }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [state, setState] = useState<GameState>(() => createInitialState(GRID_SIZE));
  const [nextDirection, setNextDirection] = useState<Direction>('right');
  const [status, setStatus] = useState<'idle' | 'running' | 'paused' | 'over'>('idle');

  const eatSound = useSound({ src: '/sounds/eat.mp3', volume: 0.4 });
  const gameOverSound = useSound({ src: '/sounds/gameover.mp3', volume: 0.6 });

  useEffect(() => {
    onStatusChange(status);
  }, [status, onStatusChange]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setStatus((prev) => {
          if (prev === 'idle' || prev === 'over') return 'running';
          if (prev === 'running') return 'paused';
          if (prev === 'paused') return 'running';
          return prev;
        });
        return;
      }

      let dir: Direction | null = null;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') dir = 'up';
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') dir = 'down';
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') dir = 'left';
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') dir = 'right';
      if (dir) {
        e.preventDefault();
        setNextDirection(dir);
        if (status === 'idle') setStatus('running');
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [status]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrame: number;
    let lastTime = performance.now();
    let accumulator = 0;
    const speed = difficultyToSpeed(difficulty); // cells per second
    const stepInterval = 1000 / speed;

    const loop = (time: number) => {
      const delta = time - lastTime;
      lastTime = time;
      accumulator += delta;

      if (status === 'running') {
        while (accumulator >= stepInterval) {
          accumulator -= stepInterval;
          const result = step(stateRef.current, GRID_SIZE, nextDirectionRef.current);
          stateRef.current = result.state;
          setState(result.state);
          onScoreChange(result.state.score);

          if (result.ate && soundEnabled) eatSound();

          if (result.dead) {
            if (soundEnabled) gameOverSound();
            setStatus('over');
            onStatusChange('over');
            break;
          }
        }
      }

      draw(ctx, stateRef.current);
      animationFrame = requestAnimationFrame(loop);
    };

    const stateRef = { current: state } as { current: GameState };
    const nextDirectionRef = { current: nextDirection } as { current: Direction };

    const unsubState = () => {
      // placeholder to satisfy TS; stateRef is updated in setState callback below
    };

    const unsubscribe = () => {
      unsubState();
    };

    animationFrame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrame);
      unsubscribe();
    };
  }, [difficulty, eatSound, gameOverSound, nextDirection, onScoreChange, onStatusChange, soundEnabled, status]);

  // Reset when status goes back to idle
  useEffect(() => {
    if (status === 'idle') {
      const initial = createInitialState(GRID_SIZE);
      setState(initial);
      setNextDirection('right');
      onScoreChange(0);
    }
  }, [status, onScoreChange]);

  return (
    <div className="relative aspect-[4/3] w-full">
      <canvas
        ref={canvasRef}
        width={GRID_SIZE * CELL_SIZE}
        height={GRID_SIZE * CELL_SIZE}
        className="w-full h-full rounded-2xl bg-slate-950 border border-slate-800"
      />
    </div>
  );
}

function draw(ctx: CanvasRenderingContext2D, state: GameState) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const gridSize = GRID_SIZE;

  ctx.clearRect(0, 0, width, height);

  // Background grid
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, width, height);

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const isDark = (x + y) % 2 === 0;
      ctx.fillStyle = isDark ? '#020617' : '#020617';
      ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }
  }

  // Food
  ctx.fillStyle = '#F59E42';
  ctx.beginPath();
  ctx.arc(
    state.food.x * CELL_SIZE + CELL_SIZE / 2,
    state.food.y * CELL_SIZE + CELL_SIZE / 2,
    CELL_SIZE / 2.4,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // Snake
  state.snake.forEach((segment, index) => {
    const x = segment.x * CELL_SIZE;
    const y = segment.y * CELL_SIZE;
    const radius = 6;

    const gradient = ctx.createLinearGradient(x, y, x + CELL_SIZE, y + CELL_SIZE);
    gradient.addColorStop(0, index === 0 ? '#4ADE80' : '#22C55E');
    gradient.addColorStop(1, '#16A34A');
    ctx.fillStyle = gradient;

    roundRect(ctx, x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2, radius);
    ctx.fill();

    if (index === 0) {
      // eyes
      ctx.fillStyle = '#022c22';
      const eyeOffsetX = CELL_SIZE / 4;
      const eyeOffsetY = CELL_SIZE / 4;
      ctx.beginPath();
      ctx.arc(x + eyeOffsetX, y + eyeOffsetY, 2, 0, Math.PI * 2);
      ctx.arc(x + CELL_SIZE - eyeOffsetX, y + eyeOffsetY, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
