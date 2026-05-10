import { useEffect, useRef, useState } from "react";

export type Direction = "up" | "down" | "left" | "right";

export interface GameConfig {
  speedMs: number;
  gridSize: number;
}

export interface GameStateSnapshot {
  score: number;
  bestScore: number;
  isGameOver: boolean;
}

interface GameCanvasProps {
  running: boolean;
  onGameOver: (score: number) => void;
  difficulty: "easy" | "normal" | "hard";
  soundEnabled: boolean;
}

interface Point {
  x: number;
  y: number;
}

const DIFFICULTY_CONFIG: Record<string, GameConfig> = {
  easy: { speedMs: 180, gridSize: 18 },
  normal: { speedMs: 140, gridSize: 20 },
  hard: { speedMs: 100, gridSize: 22 },
};

export function GameCanvas({ running, onGameOver, difficulty, soundEnabled }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [direction, setDirection] = useState<Direction>("right");
  const [pendingDirection, setPendingDirection] = useState<Direction | null>(null);
  const [snake, setSnake] = useState<Point[]>([{ x: 5, y: 10 }, { x: 4, y: 10 }, { x: 3, y: 10 }]);
  const [food, setFood] = useState<Point>({ x: 12, y: 10 });
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(() => {
    const stored = window.localStorage.getItem("snake-best-score");
    return stored ? Number(stored) || 0 : 0;
  });
  const [isGameOver, setIsGameOver] = useState(false);

  const eatSoundRef = useRef<HTMLAudioElement | null>(null);
  const gameOverSoundRef = useRef<HTMLAudioElement | null>(null);

  const config = DIFFICULTY_CONFIG[difficulty] ?? DIFFICULTY_CONFIG.normal;

  useEffect(() => {
    eatSoundRef.current = new Audio("/sounds/eat.mp3");
    gameOverSoundRef.current = new Audio("/sounds/gameover.mp3");
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD"].includes(e.code)) {
        e.preventDefault();
      }
      let next: Direction | null = null;
      if (e.code === "ArrowUp" || e.code === "KeyW") next = "up";
      if (e.code === "ArrowDown" || e.code === "KeyS") next = "down";
      if (e.code === "ArrowLeft" || e.code === "KeyA") next = "left";
      if (e.code === "ArrowRight" || e.code === "KeyD") next = "right";
      if (!next) return;
      setPendingDirection((current) => {
        const base = current ?? direction;
        if (
          (base === "up" && next === "down") ||
          (base === "down" && next === "up") ||
          (base === "left" && next === "right") ||
          (base === "right" && next === "left")
        ) {
          return current;
        }
        return next;
      });
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [direction]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = config.gridSize;
    const cell = canvas.width / size;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        if ((x + y) % 2 === 0) {
          ctx.fillStyle = "#020617";
        } else {
          ctx.fillStyle = "#030712";
        }
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }

    ctx.fillStyle = "#f97316";
    ctx.shadowColor = "rgba(248, 171, 84, 0.9)";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.roundRect(food.x * cell + 2, food.y * cell + 2, cell - 4, cell - 4, 6);
    ctx.fill();
    ctx.shadowBlur = 0;

    snake.forEach((segment, index) => {
      const isHead = index === 0;
      const gradient = ctx.createLinearGradient(
        segment.x * cell,
        segment.y * cell,
        segment.x * cell + cell,
        segment.y * cell + cell
      );
      gradient.addColorStop(0, isHead ? "#4ade80" : "#22c55e");
      gradient.addColorStop(1, isHead ? "#22c55e" : "#16a34a");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(segment.x * cell + 1.5, segment.y * cell + 1.5, cell - 3, cell - 3, 6);
      ctx.fill();

      if (isHead) {
        ctx.fillStyle = "#022c22";
        const eyeSize = cell * 0.12;
        const offset = cell * 0.18;
        ctx.beginPath();
        ctx.arc(segment.x * cell + offset + eyeSize, segment.y * cell + offset + eyeSize, eyeSize, 0, Math.PI * 2);
        ctx.arc(
          segment.x * cell + cell - offset - eyeSize,
          segment.y * cell + offset + eyeSize,
          eyeSize,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    });
  }, [snake, food, config.gridSize]);

  useEffect(() => {
    if (!running || isGameOver) return;

    const interval = window.setInterval(() => {
      setSnake((currentSnake) => {
        const size = config.gridSize;
        const dir = pendingDirection ?? direction;
        setDirection(dir);
        setPendingDirection(null);

        const head = currentSnake[0];
        let nextHead: Point = { ...head };
        if (dir === "up") nextHead.y -= 1;
        if (dir === "down") nextHead.y += 1;
        if (dir === "left") nextHead.x -= 1;
        if (dir === "right") nextHead.x += 1;

        if (
          nextHead.x < 0 ||
          nextHead.y < 0 ||
          nextHead.x >= size ||
          nextHead.y >= size ||
          currentSnake.some((seg) => seg.x === nextHead.x && seg.y === nextHead.y)
        ) {
          setIsGameOver(true);
          if (soundEnabled && gameOverSoundRef.current) {
            gameOverSoundRef.current.currentTime = 0;
            gameOverSoundRef.current.play().catch(() => undefined);
          }
          onGameOver(score);
          const newBest = Math.max(score, bestScore);
          if (newBest !== bestScore) {
            setBestScore(newBest);
            window.localStorage.setItem("snake-best-score", String(newBest));
          }
          return currentSnake;
        }

        const newSnake = [nextHead, ...currentSnake];

        if (nextHead.x === food.x && nextHead.y === food.y) {
          const nextScore = score + 10;
          setScore(nextScore);
          if (soundEnabled && eatSoundRef.current) {
            eatSoundRef.current.currentTime = 0;
            eatSoundRef.current.play().catch(() => undefined);
          }
          let newFood: Point;
          do {
            newFood = {
              x: Math.floor(Math.random() * size),
              y: Math.floor(Math.random() * size),
            };
          } while (newSnake.some((seg) => seg.x === newFood.x && seg.y === newFood.y));
          setFood(newFood);
          return newSnake;
        }

        newSnake.pop();
        return newSnake;
      });
    }, config.speedMs);

    return () => window.clearInterval(interval);
  }, [running, isGameOver, config.speedMs, config.gridSize, direction, pendingDirection, food, score, bestScore, onGameOver, soundEnabled]);

  useEffect(() => {
    if (!running) return;
    setIsGameOver(false);
  }, [running]);

  useEffect(() => {
    setSnake([{ x: 5, y: 10 }, { x: 4, y: 10 }, { x: 3, y: 10 }]);
    setFood({ x: 12, y: 10 });
    setScore(0);
    setDirection("right");
    setPendingDirection(null);
    setIsGameOver(false);
  }, [difficulty]);

  return (
    <div className="relative w-full max-w-xl mx-auto aspect-square">
      <canvas
        ref={canvasRef}
        width={480}
        height={480}
        className="w-full h-full rounded-3xl border border-slate-800 shadow-[0_0_40px_rgba(15,23,42,0.9)] bg-slate-950"
        aria-label="Snake game canvas"
      />
      {isGameOver && (
        <div className="pointer-events-none absolute inset-0 rounded-3xl bg-red-950/20" />
      )}
    </div>
  );
}
