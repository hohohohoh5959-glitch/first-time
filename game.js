const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const restartButton = document.getElementById("restart");
const statusText = document.getElementById("status");

const gameWidth = canvas.width;
const gameHeight = canvas.height;

const paddle = {
  width: 16,
  height: 100,
  speed: 7,
};

const ball = {
  size: 14,
  speed: 6,
  maxSpeed: 12,
};

const state = {
  leftY: gameHeight / 2 - paddle.height / 2,
  rightY: gameHeight / 2 - paddle.height / 2,
  leftScore: 0,
  rightScore: 0,
  paused: false,
  keys: new Set(),
  ballX: gameWidth / 2,
  ballY: gameHeight / 2,
  velX: ball.speed,
  velY: ball.speed * (Math.random() > 0.5 ? 1 : -1),
};

function resetBall(direction = 1) {
  state.ballX = gameWidth / 2;
  state.ballY = gameHeight / 2;

  const angle = (Math.random() * Math.PI) / 3 - Math.PI / 6;
  state.velX = Math.cos(angle) * ball.speed * direction;
  state.velY = Math.sin(angle) * ball.speed;
}

function restartGame() {
  state.leftScore = 0;
  state.rightScore = 0;
  state.leftY = gameHeight / 2 - paddle.height / 2;
  state.rightY = gameHeight / 2 - paddle.height / 2;
  state.paused = false;
  statusText.textContent = "게임 재시작!";
  resetBall(Math.random() > 0.5 ? 1 : -1);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function updatePaddles() {
  if (state.keys.has("KeyW")) {
    state.leftY -= paddle.speed;
  }
  if (state.keys.has("KeyS")) {
    state.leftY += paddle.speed;
  }
  if (state.keys.has("ArrowUp")) {
    state.rightY -= paddle.speed;
  }
  if (state.keys.has("ArrowDown")) {
    state.rightY += paddle.speed;
  }

  state.leftY = clamp(state.leftY, 0, gameHeight - paddle.height);
  state.rightY = clamp(state.rightY, 0, gameHeight - paddle.height);
}

function bounceFromPaddle(paddleY, isLeftPaddle) {
  const paddleCenter = paddleY + paddle.height / 2;
  const ballCenter = state.ballY + ball.size / 2;
  const distanceFromCenter = (ballCenter - paddleCenter) / (paddle.height / 2);

  const bounceAngle = distanceFromCenter * (Math.PI / 3);
  const speed = Math.min(
    Math.hypot(state.velX, state.velY) + 0.35,
    ball.maxSpeed,
  );

  const direction = isLeftPaddle ? 1 : -1;
  state.velX = Math.cos(bounceAngle) * speed * direction;
  state.velY = Math.sin(bounceAngle) * speed;
}

function updateBall() {
  state.ballX += state.velX;
  state.ballY += state.velY;

  if (state.ballY <= 0 || state.ballY + ball.size >= gameHeight) {
    state.velY *= -1;
    state.ballY = clamp(state.ballY, 0, gameHeight - ball.size);
  }

  const leftPaddleX = 24;
  const rightPaddleX = gameWidth - 24 - paddle.width;

  const hitLeft =
    state.ballX <= leftPaddleX + paddle.width &&
    state.ballX >= leftPaddleX &&
    state.ballY + ball.size >= state.leftY &&
    state.ballY <= state.leftY + paddle.height;

  const hitRight =
    state.ballX + ball.size >= rightPaddleX &&
    state.ballX + ball.size <= rightPaddleX + paddle.width &&
    state.ballY + ball.size >= state.rightY &&
    state.ballY <= state.rightY + paddle.height;

  if (hitLeft && state.velX < 0) {
    state.ballX = leftPaddleX + paddle.width;
    bounceFromPaddle(state.leftY, true);
  }

  if (hitRight && state.velX > 0) {
    state.ballX = rightPaddleX - ball.size;
    bounceFromPaddle(state.rightY, false);
  }

  if (state.ballX < 0) {
    state.rightScore += 1;
    statusText.textContent = `오른쪽 플레이어 득점! (${state.leftScore} : ${state.rightScore})`;
    resetBall(1);
  }

  if (state.ballX + ball.size > gameWidth) {
    state.leftScore += 1;
    statusText.textContent = `왼쪽 플레이어 득점! (${state.leftScore} : ${state.rightScore})`;
    resetBall(-1);
  }
}

function drawCenterLine() {
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.setLineDash([12, 14]);
  ctx.beginPath();
  ctx.moveTo(gameWidth / 2, 0);
  ctx.lineTo(gameWidth / 2, gameHeight);
  ctx.stroke();
  ctx.setLineDash([]);
}

function draw() {
  ctx.clearRect(0, 0, gameWidth, gameHeight);

  drawCenterLine();

  ctx.fillStyle = "#f2f6ff";
  ctx.fillRect(24, state.leftY, paddle.width, paddle.height);
  ctx.fillRect(
    gameWidth - 24 - paddle.width,
    state.rightY,
    paddle.width,
    paddle.height,
  );

  ctx.beginPath();
  ctx.arc(
    state.ballX + ball.size / 2,
    state.ballY + ball.size / 2,
    ball.size / 2,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  ctx.font = "bold 56px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(state.leftScore, gameWidth / 2 - 90, 76);
  ctx.fillText(state.rightScore, gameWidth / 2 + 90, 76);

  if (state.paused) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.48)";
    ctx.fillRect(0, 0, gameWidth, gameHeight);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 42px system-ui, sans-serif";
    ctx.fillText("PAUSED", gameWidth / 2, gameHeight / 2);
  }
}

function loop() {
  updatePaddles();
  if (!state.paused) {
    updateBall();
  }
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    state.paused = !state.paused;
    statusText.textContent = state.paused
      ? "일시정지됨 (Space로 재개)"
      : "게임 진행 중";
    return;
  }

  state.keys.add(event.code);
});

window.addEventListener("keyup", (event) => {
  state.keys.delete(event.code);
});

restartButton.addEventListener("click", restartGame);

restartGame();
requestAnimationFrame(loop);
