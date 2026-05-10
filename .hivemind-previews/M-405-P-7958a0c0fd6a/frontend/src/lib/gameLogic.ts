export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Point {
  x: number;
  y: number;
}

export interface GameState {
  snake: Point[];
  direction: Direction;
  food: Point;
  score: number;
}

export function createInitialState(gridSize: number): GameState {
  const center = Math.floor(gridSize / 2);
  return {
    snake: [
      { x: center, y: center },
      { x: center - 1, y: center },
      { x: center - 2, y: center },
    ],
    direction: 'right',
    food: randomFood(gridSize, [
      { x: center, y: center },
      { x: center - 1, y: center },
      { x: center - 2, y: center },
    ]),
    score: 0,
  };
}

export function randomFood(gridSize: number, snake: Point[]): Point {
  while (true) {
    const x = Math.floor(Math.random() * gridSize);
    const y = Math.floor(Math.random() * gridSize);
    if (!snake.some((s) => s.x === x && s.y === y)) {
      return { x, y };
    }
  }
}

export function step(state: GameState, gridSize: number, nextDirection: Direction): { state: GameState; dead: boolean; ate: boolean } {
  const dir = normalizeDirection(state.direction, nextDirection);
  const head = state.snake[0];
  const nextHead: Point = { ...head };

  if (dir === 'up') nextHead.y -= 1;
  if (dir === 'down') nextHead.y += 1;
  if (dir === 'left') nextHead.x -= 1;
  if (dir === 'right') nextHead.x += 1;

  // Wall collision
  if (nextHead.x < 0 || nextHead.x >= gridSize || nextHead.y < 0 || nextHead.y >= gridSize) {
    return { state, dead: true, ate: false };
  }

  const newSnake = [nextHead, ...state.snake];

  const ate = nextHead.x === state.food.x && nextHead.y === state.food.y;
  if (!ate) {
    newSnake.pop();
  }

  // Self collision (ignore last tail segment if we just moved into it and it will be removed)
  const [headAfter] = newSnake;
  const body = newSnake.slice(1);
  if (body.some((s) => s.x === headAfter.x && s.y === headAfter.y)) {
    return { state, dead: true, ate: false };
  }

  const newState: GameState = {
    snake: newSnake,
    direction: dir,
    food: ate ? randomFood(gridSize, newSnake) : state.food,
    score: state.score + (ate ? 10 : 0),
  };

  return { state: newState, dead: false, ate };
}

function normalizeDirection(current: Direction, next: Direction): Direction {
  if (current === 'up' && next === 'down') return current;
  if (current === 'down' && next === 'up') return current;
  if (current === 'left' && next === 'right') return current;
  if (current === 'right' && next === 'left') return current;
  return next;
}
