const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const levelEl = document.getElementById("level");
const restartButton = document.getElementById("restart");
const photoInput = document.getElementById("photoInput");

const W = canvas.width;
const H = canvas.height;

const levelConfigs = [
  { speed: 4.3, blinkMs: 900, name: "Level 1" },
  { speed: 5.5, blinkMs: 620, name: "Level 2" },
  { speed: 6.8, blinkMs: 420, name: "Level 3" },
];

const state = {
  balls: [],
  lip: { x: W / 2 - 84, y: 760, width: 168, height: 16, speed: 10 },
  leftPressed: false,
  rightPressed: false,
  level: 1,
  rounds: 0,
  score: 0,
  phase: "countdown",
  countdownValue: 3,
  countdownUntil: 0,
  blinkUntil: 0,
  respawnAt: 0,
  blinkClosed: false,
  image: null,
  imageReady: false,
  gameOverFalls: 0,
  message: "3",
  growth: {
    noseLeft: 0,
    noseRight: 0,
    earLeft: 0,
    earRight: 0,
    pupilLeft: 0,
    pupilRight: 0,
    forehead: 0,
  },
};

const holes = [
  { id: "noseLeft", x: 333, y: 550, r: 10, type: "nose" },
  { id: "noseRight", x: 386, y: 550, r: 10, type: "nose" },
  { id: "earLeft", x: 105, y: 500, r: 11, type: "ear" },
  { id: "earRight", x: 614, y: 500, r: 11, type: "ear" },
  { id: "pupilLeft", x: 269, y: 423, r: 13, type: "pupil" },
  { id: "pupilRight", x: 452, y: 423, r: 13, type: "pupil" },
  { id: "forehead", x: 360, y: 260, r: 15, type: "forehead" },
];

const blinkEyes = {
  left: { x: 270, y: 430 },
  right: { x: 452, y: 430 },
};

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function currentLevelConfig() {
  return levelConfigs[state.level - 1];
}

function updateHud() {
  const cfg = currentLevelConfig();
  statusEl.textContent = `${state.message} | 점수 ${state.score} | 놓친 볼 ${state.gameOverFalls}`;
  levelEl.textContent = `${cfg.name} · Round ${state.rounds}`;
}

function spawnBallsFromEyes() {
  const cfg = currentLevelConfig();
  const base = cfg.speed;
  state.balls = [
    {
      x: blinkEyes.left.x,
      y: blinkEyes.left.y,
      vx: -base * 0.55,
      vy: base,
      r: 9,
    },
    {
      x: blinkEyes.right.x,
      y: blinkEyes.right.y,
      vx: base * 0.55,
      vy: base,
      r: 9,
    },
  ];
  state.message = "눈에서 어둠 볼 생성!";
  state.phase = "playing";
}

function enterBlinkPhase() {
  const cfg = currentLevelConfig();
  state.phase = "blink";
  state.blinkClosed = true;
  state.blinkUntil = performance.now() + cfg.blinkMs;
  state.message = "눈 깜빡임...";
}

function scheduleRespawn() {
  state.rounds += 1;
  state.level = clamp(1 + Math.floor((state.rounds - 1) / 3), 1, 3);
  enterBlinkPhase();
}

function startCountdown() {
  state.phase = "countdown";
  state.countdownValue = 3;
  state.countdownUntil = performance.now() + 1000;
  state.message = "3";
}

function restartGame() {
  state.level = 1;
  state.rounds = 0;
  state.score = 0;
  state.gameOverFalls = 0;
  state.balls = [];
  state.growth = {
    noseLeft: 0,
    noseRight: 0,
    earLeft: 0,
    earRight: 0,
    pupilLeft: 0,
    pupilRight: 0,
    forehead: 0,
  };
  startCountdown();
}

function drawFaceBackground() {
  if (state.imageReady && state.image) {
    ctx.drawImage(state.image, 0, 0, W, H);
    return;
  }

  ctx.fillStyle = "#cbb79b";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#b49e85";
  ctx.beginPath();
  ctx.arc(W / 2, 270, 260, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "26px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("사진을 선택하면 배경으로 적용됩니다", W / 2, 70);
}

function drawEyes() {
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  if (state.blinkClosed) {
    ctx.fillRect(220, 420, 100, 4);
    ctx.fillRect(402, 420, 100, 4);
  } else {
    ctx.beginPath();
    ctx.ellipse(269, 423, 42, 18, 0, 0, Math.PI * 2);
    ctx.ellipse(452, 423, 42, 18, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLipsPaddle() {
  const lip = state.lip;
  const gradient = ctx.createLinearGradient(lip.x, lip.y, lip.x, lip.y + lip.height);
  gradient.addColorStop(0, "#8c2d3a");
  gradient.addColorStop(1, "#c44f62");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(lip.x, lip.y, lip.width, lip.height, 9);
  ctx.fill();
}

function drawHoles() {
  holes.forEach((hole) => {
    ctx.beginPath();
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.arc(hole.x, hole.y, hole.r, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawHairGrowth() {
  // Nose hair
  ["noseLeft", "noseRight"].forEach((id) => {
    const hole = holes.find((h) => h.id === id);
    const count = state.growth[id];
    for (let i = 0; i < count; i += 1) {
      const x = hole.x - 8 + i * 2;
      const height = 6 + (i % 3) * 4;
      ctx.strokeStyle = "#121212";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x, hole.y);
      ctx.lineTo(x + (i % 2 === 0 ? 2 : -2), hole.y + height);
      ctx.stroke();
    }
  });

  // Ear hair
  ["earLeft", "earRight"].forEach((id) => {
    const hole = holes.find((h) => h.id === id);
    const count = state.growth[id];
    for (let i = 0; i < count; i += 1) {
      const y = hole.y - 8 + i * 2;
      const dir = id === "earLeft" ? -1 : 1;
      ctx.strokeStyle = "#181818";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(hole.x, y);
      ctx.lineTo(hole.x + dir * (5 + (i % 4) * 2), y - (i % 2));
      ctx.stroke();
    }
  });

  // Eyebrows (pupil holes)
  ["pupilLeft", "pupilRight"].forEach((id) => {
    const hole = holes.find((h) => h.id === id);
    const count = state.growth[id];
    for (let i = 0; i < count; i += 1) {
      const x = hole.x - 18 + i * 2;
      const y = hole.y - 30 - (i % 2) * 2;
      ctx.strokeStyle = "#201a17";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(x, y + 5);
      ctx.lineTo(x + 1, y);
      ctx.stroke();
    }
  });

  // Forehead grass hair
  const fh = holes.find((h) => h.id === "forehead");
  for (let i = 0; i < state.growth.forehead; i += 1) {
    const x = fh.x - 22 + i * 2;
    const h = 10 + (i % 3) * 4;
    ctx.strokeStyle = "#141414";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(x, fh.y - 2);
    ctx.lineTo(x + (i % 2 ? 2 : -2), fh.y - h);
    ctx.stroke();
  }
}

function drawBalls() {
  ctx.fillStyle = "#0a0a0a";
  state.balls.forEach((ball) => {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawOverlayText() {
  if (state.phase === "countdown") {
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 120px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(state.countdownValue), W / 2, H / 2);
  }
}

function growHairForHole(id) {
  state.growth[id] = clamp(state.growth[id] + 2, 0, 30);
  state.score += 10;
  state.message = `${id}에 털 성장!`;
}

function handleBallPhysics(ball) {
  ball.x += ball.vx;
  ball.y += ball.vy;

  if (ball.x - ball.r <= 0 || ball.x + ball.r >= W) {
    ball.vx *= -1;
    ball.x = clamp(ball.x, ball.r, W - ball.r);
  }

  if (ball.y - ball.r <= 0) {
    ball.vy *= -1;
    ball.y = ball.r;
  }

  const lip = state.lip;
  const hitLip =
    ball.y + ball.r >= lip.y &&
    ball.y - ball.r <= lip.y + lip.height &&
    ball.x >= lip.x &&
    ball.x <= lip.x + lip.width &&
    ball.vy > 0;

  if (hitLip) {
    const offset = (ball.x - (lip.x + lip.width / 2)) / (lip.width / 2);
    const speed = Math.hypot(ball.vx, ball.vy) + 0.15;
    ball.vx = speed * offset;
    ball.vy = -Math.max(3.5, speed * (1 - Math.abs(offset) * 0.2));
    ball.y = lip.y - ball.r;
  }

  for (const hole of holes) {
    const d = Math.hypot(ball.x - hole.x, ball.y - hole.y);
    if (d <= hole.r - 1) {
      growHairForHole(hole.id);
      return "absorbed";
    }
  }

  if (ball.y - ball.r > H) {
    state.gameOverFalls += 1;
    state.message = "볼이 아래로 떨어짐!";
    return "lost";
  }

  return "alive";
}

function updatePlaying() {
  const nextBalls = [];
  state.balls.forEach((ball) => {
    const result = handleBallPhysics(ball);
    if (result === "alive") {
      nextBalls.push(ball);
    }
  });
  state.balls = nextBalls;

  if (state.balls.length === 0) {
    state.respawnAt = performance.now() + 250;
    state.phase = "waitingRespawn";
  }
}

function updateLip() {
  if (state.leftPressed) {
    state.lip.x -= state.lip.speed;
  }
  if (state.rightPressed) {
    state.lip.x += state.lip.speed;
  }
  state.lip.x = clamp(state.lip.x, 34, W - 34 - state.lip.width);
}

function tick() {
  const now = performance.now();
  updateLip();

  if (state.phase === "countdown" && now >= state.countdownUntil) {
    state.countdownValue -= 1;
    if (state.countdownValue <= 0) {
      scheduleRespawn();
    } else {
      state.message = String(state.countdownValue);
      state.countdownUntil = now + 1000;
    }
  }

  if (state.phase === "waitingRespawn" && now >= state.respawnAt) {
    scheduleRespawn();
  }

  if (state.phase === "blink" && now >= state.blinkUntil) {
    state.blinkClosed = false;
    spawnBallsFromEyes();
  }

  if (state.phase === "playing") {
    updatePlaying();
  }

  render();
  updateHud();
  requestAnimationFrame(tick);
}

function render() {
  drawFaceBackground();
  drawHairGrowth();
  drawHoles();
  drawEyes();
  drawLipsPaddle();
  drawBalls();
  drawOverlayText();
}

function loadPhotoFromFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      state.image = img;
      state.imageReady = true;
      state.message = "사진 배경 적용 완료";
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

window.addEventListener("keydown", (event) => {
  if (event.code === "ArrowLeft" || event.code === "KeyA") {
    state.leftPressed = true;
  }
  if (event.code === "ArrowRight" || event.code === "KeyD") {
    state.rightPressed = true;
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code === "ArrowLeft" || event.code === "KeyA") {
    state.leftPressed = false;
  }
  if (event.code === "ArrowRight" || event.code === "KeyD") {
    state.rightPressed = false;
  }
});

canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * W;
  state.lip.x = clamp(x - state.lip.width / 2, 34, W - 34 - state.lip.width);
});

photoInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file) {
    loadPhotoFromFile(file);
  }
});

restartButton.addEventListener("click", restartGame);

restartGame();
requestAnimationFrame(tick);
