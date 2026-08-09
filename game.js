import {
  advanceGame,
  createGameState,
  pauseGame,
  queueDirection,
  speedLevelForScore,
  startGame,
} from "./game-core.js";

const BOARD_SIZE = 20;
const STORAGE_KEY = "snake-01-best-score";

const canvas = document.querySelector("#game-canvas");
const context = canvas.getContext("2d");
const arena = document.querySelector("#arena-frame");
const overlay = document.querySelector("#arena-overlay");
const overlayKicker = document.querySelector("#overlay-kicker");
const overlayTitle = document.querySelector("#overlay-title");
const overlayCopy = document.querySelector("#overlay-copy");
const overlayAction = document.querySelector("#overlay-action");
const primaryAction = document.querySelector("#primary-action");
const primaryActionLabel = document.querySelector("#primary-action-label");
const restartAction = document.querySelector("#restart-action");
const mobilePause = document.querySelector("#mobile-pause");
const scoreElement = document.querySelector("#score");
const bestElement = document.querySelector("#best-score");
const mobileScore = document.querySelector("#mobile-score");
const mobileBest = document.querySelector("#mobile-best");
const speedMeter = document.querySelector("#speed-meter");
const liveStatus = document.querySelector("#live-status");

let state = createGameState({ cols: BOARD_SIZE, rows: BOARD_SIZE });
let bestScore = readBestScore();
let timerId = null;
let touchStart = null;

function readBestScore() {
  try {
    const value = Number.parseInt(localStorage.getItem(STORAGE_KEY) ?? "0", 10);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

function storeBestScore(score) {
  try {
    localStorage.setItem(STORAGE_KEY, String(score));
  } catch {
    // The game remains fully usable when storage is unavailable.
  }
}

function formatScore(score) {
  return String(score).padStart(2, "0");
}

function resizeCanvas() {
  const size = Math.max(1, Math.round(canvas.getBoundingClientRect().width));
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const pixelSize = Math.round(size * ratio);
  if (canvas.width !== pixelSize || canvas.height !== pixelSize) {
    canvas.width = pixelSize;
    canvas.height = pixelSize;
  }
  drawBoard();
}

function roundedRect(ctx, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
  ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
  ctx.arcTo(x, y + height, x, y, safeRadius);
  ctx.arcTo(x, y, x + width, y, safeRadius);
  ctx.closePath();
}

function drawBoard() {
  const width = canvas.width;
  const height = canvas.height;
  const cellWidth = width / state.cols;
  const cellHeight = height / state.rows;

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#07110e";
  context.fillRect(0, 0, width, height);

  context.strokeStyle = "rgba(200, 255, 86, 0.055)";
  context.lineWidth = Math.max(1, width / 900);
  context.beginPath();
  for (let index = 1; index < state.cols; index += 1) {
    const coordinate = Math.round(index * cellWidth) + 0.5;
    context.moveTo(coordinate, 0);
    context.lineTo(coordinate, height);
  }
  for (let index = 1; index < state.rows; index += 1) {
    const coordinate = Math.round(index * cellHeight) + 0.5;
    context.moveTo(0, coordinate);
    context.lineTo(width, coordinate);
  }
  context.stroke();

  if (state.food) {
    const centerX = (state.food.x + 0.5) * cellWidth;
    const centerY = (state.food.y + 0.5) * cellHeight;
    const radius = Math.min(cellWidth, cellHeight) * 0.21;
    context.save();
    context.shadowColor = "#ff6f87";
    context.shadowBlur = radius * 2.3;
    context.fillStyle = "#ff6f87";
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  state.snake.forEach((segment, index) => {
    const gap = Math.max(2, cellWidth * 0.11);
    const x = segment.x * cellWidth + gap;
    const y = segment.y * cellHeight + gap;
    const segmentWidth = cellWidth - gap * 2;
    const segmentHeight = cellHeight - gap * 2;
    const alpha = Math.max(0.42, 1 - index * 0.045);

    context.save();
    context.fillStyle = index === 0 ? "#dfff92" : `rgba(200, 255, 86, ${alpha})`;
    if (index === 0) {
      context.shadowColor = "rgba(200, 255, 86, 0.55)";
      context.shadowBlur = gap * 3;
    }
    roundedRect(context, x, y, segmentWidth, segmentHeight, gap * 1.2);
    context.fill();

    if (index === 0) {
      const eyeRadius = Math.max(1.2, cellWidth * 0.045);
      const horizontalOffset = state.direction.x * cellWidth * 0.16;
      const verticalOffset = state.direction.y * cellHeight * 0.16;
      context.fillStyle = "#07110e";
      context.beginPath();
      context.arc(
        x + segmentWidth * 0.38 + horizontalOffset,
        y + segmentHeight * 0.38 + verticalOffset,
        eyeRadius,
        0,
        Math.PI * 2,
      );
      context.arc(
        x + segmentWidth * 0.62 + horizontalOffset,
        y + segmentHeight * 0.62 + verticalOffset,
        eyeRadius,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
    context.restore();
  });
}

function setOverlayContent() {
  const content = {
    ready: {
      kicker: "SNAKE 01",
      title: "准备好了吗？",
      copy: "使用方向键、WASD 或触屏按钮控制方向",
      action: "开始游戏",
    },
    paused: {
      kicker: "PAUSED",
      title: "游戏已暂停",
      copy: "休息一下。准备好后继续保持移动。",
      action: "继续游戏",
    },
    gameover: {
      kicker: "RUN COMPLETE",
      title: "本局结束",
      copy: `最终得分 ${formatScore(state.score)} · 再试一次，刷新你的记录。`,
      action: "再来一局",
    },
    won: {
      kicker: "BOARD COMPLETE",
      title: "你占领了全场！",
      copy: `满分通关 · 最终得分 ${formatScore(state.score)}`,
      action: "再来一局",
    },
  };

  const selected = content[state.status];
  if (!selected) {
    overlay.classList.add("is-hidden");
    return;
  }

  overlayKicker.textContent = selected.kicker;
  overlayTitle.textContent = selected.title;
  overlayCopy.textContent = selected.copy;
  overlayAction.firstChild.textContent = `${selected.action} `;
  overlay.classList.remove("is-hidden");
}

function render() {
  if (state.score > bestScore) {
    bestScore = state.score;
    storeBestScore(bestScore);
  }

  const formattedScore = formatScore(state.score);
  const formattedBest = formatScore(bestScore);
  scoreElement.textContent = formattedScore;
  bestElement.textContent = formattedBest;
  mobileScore.textContent = formattedScore;
  mobileBest.textContent = formattedBest;

  const speedLevel = speedLevelForScore(state.score);
  speedMeter.setAttribute("aria-label", `速度等级 ${speedLevel}`);
  [...speedMeter.children].forEach((bar, index) => {
    bar.classList.toggle("is-on", index < speedLevel);
  });

  const labels = {
    ready: "开始游戏",
    running: "暂停游戏",
    paused: "继续游戏",
    gameover: "再来一局",
    won: "再来一局",
  };
  const statusText = {
    ready: "等待开始",
    running: `游戏进行中，当前得分 ${state.score}`,
    paused: `游戏已暂停，当前得分 ${state.score}`,
    gameover: `游戏结束，最终得分 ${state.score}`,
    won: `完成全场，最终得分 ${state.score}`,
  };

  primaryActionLabel.textContent = labels[state.status];
  mobilePause.textContent = state.status === "running" ? "暂停" : labels[state.status].replace("游戏", "");
  liveStatus.textContent = statusText[state.status];
  setOverlayContent();
  drawBoard();
}

function clearTimer() {
  if (timerId !== null) {
    window.clearTimeout(timerId);
    timerId = null;
  }
}

function scheduleTick() {
  clearTimer();
  if (state.status === "running") {
    timerId = window.setTimeout(runTick, state.tickMs);
  }
}

function runTick() {
  state = advanceGame(state);
  render();
  scheduleTick();
}

function resetAndStart() {
  state = startGame(createGameState({ cols: BOARD_SIZE, rows: BOARD_SIZE }));
  render();
  scheduleTick();
}

function handlePrimaryAction() {
  if (state.status === "gameover" || state.status === "won") {
    resetAndStart();
    return;
  }

  if (state.status === "ready") {
    state = startGame(state);
  } else {
    state = pauseGame(state);
  }
  render();
  scheduleTick();
}

function handleDirection(directionName) {
  state = queueDirection(state, directionName);
}

const keyMap = {
  ArrowUp: "up",
  w: "up",
  W: "up",
  ArrowDown: "down",
  s: "down",
  S: "down",
  ArrowLeft: "left",
  a: "left",
  A: "left",
  ArrowRight: "right",
  d: "right",
  D: "right",
};

document.addEventListener("keydown", (event) => {
  const direction = keyMap[event.key];
  if (direction) {
    event.preventDefault();
    handleDirection(direction);
    return;
  }

  if (event.code === "Space") {
    event.preventDefault();
    handlePrimaryAction();
  } else if (event.key === "Enter" && state.status !== "running") {
    event.preventDefault();
    handlePrimaryAction();
  }
});

primaryAction.addEventListener("click", handlePrimaryAction);
overlayAction.addEventListener("click", handlePrimaryAction);
mobilePause.addEventListener("click", handlePrimaryAction);
restartAction.addEventListener("click", resetAndStart);

document.querySelectorAll("[data-direction]").forEach((button) => {
  button.addEventListener("click", () => handleDirection(button.dataset.direction));
});

arena.addEventListener(
  "touchstart",
  (event) => {
    const touch = event.changedTouches[0];
    touchStart = { x: touch.clientX, y: touch.clientY };
  },
  { passive: true },
);

arena.addEventListener(
  "touchend",
  (event) => {
    if (!touchStart) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;
    touchStart = null;

    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 24) return;
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      handleDirection(deltaX > 0 ? "right" : "left");
    } else {
      handleDirection(deltaY > 0 ? "down" : "up");
    }
  },
  { passive: true },
);

window.addEventListener("resize", resizeCanvas);
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state.status === "running") {
    state = pauseGame(state);
    render();
    clearTimer();
  }
});

resizeCanvas();
render();

