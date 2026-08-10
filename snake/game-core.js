export const DIRECTIONS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1 }),
  down: Object.freeze({ x: 0, y: 1 }),
  left: Object.freeze({ x: -1, y: 0 }),
  right: Object.freeze({ x: 1, y: 0 }),
});

const STARTING_TICK_MS = 150;
const FASTEST_TICK_MS = 70;

export function positionsEqual(a, b) {
  return a.x === b.x && a.y === b.y;
}
export function isOpposite(first, second) {
  return first.x + second.x === 0 && first.y + second.y === 0;
}

export function speedForScore(score) {
  return Math.max(FASTEST_TICK_MS, STARTING_TICK_MS - Math.floor(score / 3) * 10);
}

export function speedLevelForScore(score) {
  return Math.min(5, Math.floor(score / 3) + 1);
}

export function placeFood(snake, cols, rows, rng = Math.random) {
  const occupied = new Set(snake.map(({ x, y }) => `${x},${y}`));
  const available = [];

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (!occupied.has(`${x},${y}`)) {
        available.push({ x, y });
      }
    }
  }

  if (available.length === 0) {
    return null;
  }

  const rawIndex = Math.floor(rng() * available.length);
  const safeIndex = Math.max(0, Math.min(available.length - 1, rawIndex));
  return available[safeIndex];
}

export function createGameState({ cols = 20, rows = 20, rng = Math.random } = {}) {
  if (cols < 6 || rows < 6) {
    throw new RangeError("The board must be at least 6 × 6.");
  }

  const headX = Math.floor(cols / 2);
  const headY = Math.floor(rows / 2);
  const snake = [
    { x: headX, y: headY },
    { x: headX - 1, y: headY },
    { x: headX - 2, y: headY },
  ];

  return {
    cols,
    rows,
    snake,
    direction: DIRECTIONS.right,
    pendingDirection: null,
    food: placeFood(snake, cols, rows, rng),
    score: 0,
    status: "ready",
    tickMs: STARTING_TICK_MS,
  };
}

export function startGame(state) {
  if (state.status === "ready" || state.status === "paused") {
    return { ...state, status: "running" };
  }
  return state;
}

export function pauseGame(state) {
  if (state.status === "running") {
    return { ...state, status: "paused" };
  }
  if (state.status === "paused") {
    return { ...state, status: "running" };
  }
  return state;
}

export function queueDirection(state, directionName) {
  const requested = DIRECTIONS[directionName];
  if (!requested || state.pendingDirection || isOpposite(state.direction, requested)) {
    return state;
  }

  return { ...state, pendingDirection: requested };
}

export function advanceGame(state, rng = Math.random) {
  if (state.status !== "running") {
    return state;
  }

  const direction = state.pendingDirection ?? state.direction;
  const head = state.snake[0];
  const nextHead = {
    x: head.x + direction.x,
    y: head.y + direction.y,
  };
  const hitWall =
    nextHead.x < 0 ||
    nextHead.x >= state.cols ||
    nextHead.y < 0 ||
    nextHead.y >= state.rows;
  const willGrow = state.food !== null && positionsEqual(nextHead, state.food);
  const collisionBody = willGrow ? state.snake : state.snake.slice(0, -1);
  const hitSelf = collisionBody.some((segment) => positionsEqual(segment, nextHead));

  if (hitWall || hitSelf) {
    return {
      ...state,
      direction,
      pendingDirection: null,
      status: "gameover",
    };
  }

  const snake = [nextHead, ...state.snake];
  if (!willGrow) {
    snake.pop();
  }

  const score = state.score + (willGrow ? 1 : 0);
  const food = willGrow ? placeFood(snake, state.cols, state.rows, rng) : state.food;

  return {
    ...state,
    snake,
    direction,
    pendingDirection: null,
    food,
    score,
    status: willGrow && food === null ? "won" : "running",
    tickMs: speedForScore(score),
  };
}
