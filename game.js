const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const levelEl = document.getElementById("level");
const restartButton = document.getElementById("restart");

const W = canvas.width;
const H = canvas.height;
const BALL_RADIUS = 9;
const GROWTH_TIME = 3000;
const BACKGROUND_SRC = "face-fixed.jpg";

const levelConfigs = [
  { speed: 4.2, blinkMs: 820, name: "Level 1" },
  { speed: 5.3, blinkMs: 620, name: "Level 2" },
  { speed: 6.5, blinkMs: 450, name: "Level 3" },
];

const holes = [
  { id: "eyeLeft", x: 250, y: 365, r: 13, growth: "eyebrow" },
  { id: "eyeRight", x: 470, y: 365, r: 13, growth: "eyebrow" },
  { id: "noseLeft", x: 340, y: 484, r: 10, growth: "nosehair" },
  { id: "noseRight", x: 387, y: 484, r: 10, growth: "nosehair" },
  { id: "mouth", x: 360, y: 605, r: 13, growth: "beard" },
  { id: "earLeft", x: 90, y: 505, r: 12, growth: "eyelash" },
  { id: "earRight", x: 630, y: 505, r: 12, growth: "eyelash" },
  { id: "forehead", x: 360, y: 150, r: 14, growth: "hair" },
];

const state = {
  phase: "countdown",
  countdownValue: 3,
  countdownUntil: 0,
  blinkPhase: "open",
  blinkStart: 0,
  blinkUntil: 0,
  balls: [],
  level: 1,
  rounds: 0,
  score: 0,
  drops: 0,
  message: "3",
  background: null,
  backgroundReady: false,
  strandsByHole: Object.fromEntries(holes.map((h) => [h.id, []])),
  lip: {
    x: 305,
    y: 620,
    width: 110,
    height: 28,
    speed: 9,
    sourceX: 300,
    sourceY: 610,
    sourceW: 120,
    sourceH: 36,
  },
  leftPressed: false,
  rightPressed: false,
};

let audioContext;

function getAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

function playTone(freq, durationMs, type, volume) {
  const ac = getAudioContext();
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(now);
  osc.stop(now + durationMs / 1000);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function levelConfig() {
  return levelConfigs[state.level - 1];
}

function updateHud() {
  statusEl.textContent = `${state.message} | 점수 ${state.score} | 낙하 ${state.drops}`;
  levelEl.textContent = `${levelConfig().name} · Round ${state.rounds}`;
}

function resetBallsFromEyes() {
  const speed = levelConfig().speed;
  state.balls = [
    { x: 250, y: 365, vx: -speed * 0.55, vy: speed, r: BALL_RADIUS },
    { x: 470, y: 365, vx: speed * 0.55, vy: speed, r: BALL_RADIUS },
  ];
  state.phase = "playing";
  state.message = "검은 공 생성";
}

function scheduleBlink() {
  state.rounds += 1;
  state.level = clamp(1 + Math.floor((state.rounds - 1) / 3), 1, 3);
  state.phase = "blink";
  state.blinkPhase = "closing";
  state.blinkStart = performance.now();
  state.blinkUntil = performance.now() + levelConfig().blinkMs;
  state.message = "눈 깜빡임";
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
  state.drops = 0;
  state.balls = [];
  state.strandsByHole = Object.fromEntries(holes.map((h) => [h.id, []]));
  startCountdown();
}

function loadBackground() {
  const img = new Image();
  img.onload = () => {
    state.background = img;
    state.backgroundReady = true;
  };
  img.onerror = () => {
    state.backgroundReady = false;
    state.message = "face-fixed.jpg 파일을 프로젝트 루트에 넣어주세요";
  };
  img.src = BACKGROUND_SRC;
}

function drawBackground() {
  if (state.backgroundReady && state.background) {
    ctx.drawImage(state.background, 0, 0, W, H);
    return;
  }

  ctx.fillStyle = "#b6a186";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.font = "24px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("face-fixed.jpg를 같은 폴더에 두세요", W / 2, 70);
}

function drawBlinkOverlay(now) {
  if (state.phase !== "blink") {
    return;
  }

  const duration = levelConfig().blinkMs;
  const t = clamp((now - state.blinkStart) / duration, 0, 1);
  const closeAmount = t < 0.5 ? t * 2 : (1 - t) * 2;

  const drawEyeLid = (cx, cy) => {
    const h = 28 * closeAmount;
    ctx.fillStyle = "#b58f76";
    ctx.beginPath();
    ctx.ellipse(cx, cy, 50, h + 2, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  drawEyeLid(250, 365);
  drawEyeLid(470, 365);
}

function drawHoles() {
  holes.forEach((hole) => {
    ctx.fillStyle = "rgba(0,0,0,0.8)";
    ctx.beginPath();
    ctx.arc(hole.x, hole.y, hole.r, 0, Math.PI * 2);
    ctx.fill();
  });
}

function createStrand(hole) {
  const length = BALL_RADIUS * 4;
  const now = performance.now();
  let angle = -Math.PI / 2;

  if (hole.growth === "nosehair") {
    angle = Math.PI / 2 + (Math.random() - 0.5) * 0.7;
  } else if (hole.growth === "beard") {
    angle = Math.PI / 2 + (Math.random() - 0.5) * 0.5;
  } else if (hole.growth === "eyebrow") {
    angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.4;
  } else if (hole.growth === "eyelash") {
    angle = hole.id === "earLeft" ? Math.PI : 0;
    angle += (Math.random() - 0.5) * 0.4;
  } else if (hole.growth === "hair") {
    angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
  }

  return { start: now, angle, maxLength: length };
}

function drawStrands(now) {
  holes.forEach((hole) => {
    const strands = state.strandsByHole[hole.id];
    strands.forEach((strand) => {
      const elapsed = now - strand.start;
      const progress = clamp(elapsed / GROWTH_TIME, 0, 1);
      const len = strand.maxLength * progress;
      const x2 = hole.x + Math.cos(strand.angle) * len;
      const y2 = hole.y + Math.sin(strand.angle) * len;

      ctx.strokeStyle = "#111";
      ctx.lineWidth = 2.1;
      ctx.beginPath();
      ctx.moveTo(hole.x, hole.y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });
  });
}

function drawLipPaddle() {
  const lip = state.lip;

  if (state.backgroundReady && state.background) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(lip.x, lip.y, lip.width, lip.height, 13);
    ctx.clip();
    ctx.drawImage(
      state.background,
      lip.sourceX,
      lip.sourceY,
      lip.sourceW,
      lip.sourceH,
      lip.x,
      lip.y,
      lip.width,
      lip.height,
    );
    ctx.restore();
  } else {
    const g = ctx.createLinearGradient(lip.x, lip.y, lip.x, lip.y + lip.height);
    g.addColorStop(0, "#8f2f3e");
    g.addColorStop(1, "#cc5b68");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(lip.x, lip.y, lip.width, lip.height, 13);
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(lip.x, lip.y, lip.width, lip.height, 13);
  ctx.stroke();
}

function drawBalls() {
  ctx.fillStyle = "#000";
  state.balls.forEach((ball) => {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawCountdownOverlay() {
  if (state.phase !== "countdown") {
    return;
  }

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 120px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(String(state.countdownValue), W / 2, H / 2);
}

function addStrand(holeId) {
  const hole = holes.find((h) => h.id === holeId);
  state.strandsByHole[holeId].push(createStrand(hole));
  state.score += 12;
  state.message = `${holeId} 성공`;
}

function updateBall(ball) {
  ball.x += ball.vx;
  ball.y += ball.vy;

  if (ball.x - ball.r <= 0 || ball.x + ball.r >= W) {
    ball.vx *= -1;
    ball.x = clamp(ball.x, ball.r, W - ball.r);
    playTone(190, 80, "triangle", 0.04);
  }

  if (ball.y - ball.r <= 0) {
    ball.vy *= -1;
    ball.y = ball.r;
    playTone(200, 70, "triangle", 0.04);
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
    ball.vy = -Math.max(3.7, speed * (1 - Math.abs(offset) * 0.15));
    ball.y = lip.y - ball.r;
    playTone(320, 95, "square", 0.05);
  }

  for (const hole of holes) {
    const d = Math.hypot(ball.x - hole.x, ball.y - hole.y);
    if (d <= hole.r - 1) {
      addStrand(hole.id);
      playTone(520, 140, "sine", 0.05);
      return "absorbed";
    }
  }

  if (ball.y - ball.r > H) {
    state.drops += 1;
    state.message = "볼 낙하";
    return "lost";
  }

  return "alive";
}

function updatePlaying() {
  const survivors = [];
  state.balls.forEach((ball) => {
    if (updateBall(ball) === "alive") {
      survivors.push(ball);
    }
  });

  state.balls = survivors;
  if (state.balls.length === 0) {
    state.phase = "respawnWait";
    state.blinkUntil = performance.now() + 220;
  }
}

function updatePaddle() {
  if (state.leftPressed) {
    state.lip.x -= state.lip.speed;
  }
  if (state.rightPressed) {
    state.lip.x += state.lip.speed;
  }
  state.lip.x = clamp(state.lip.x, 40, W - 40 - state.lip.width);
}

function updateGame(now) {
  updatePaddle();

  if (state.phase === "countdown" && now >= state.countdownUntil) {
    state.countdownValue -= 1;
    if (state.countdownValue <= 0) {
      scheduleBlink();
    } else {
      state.message = String(state.countdownValue);
      state.countdownUntil = now + 1000;
    }
  }

  if (state.phase === "respawnWait" && now >= state.blinkUntil) {
    scheduleBlink();
  }

  if (state.phase === "blink" && now >= state.blinkUntil) {
    resetBallsFromEyes();
  }

  if (state.phase === "playing") {
    updatePlaying();
  }
}

function render(now) {
  drawBackground();
  drawBlinkOverlay(now);
  drawHoles();
  drawStrands(now);
  drawLipPaddle();
  drawBalls();
  drawCountdownOverlay();
}

function loop(now) {
  updateGame(now);
  render(now);
  updateHud();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "Space", "KeyA", "KeyD"].includes(event.code)) {
    event.preventDefault();
  }

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
  state.lip.x = clamp(x - state.lip.width / 2, 40, W - 40 - state.lip.width);
});

canvas.addEventListener("pointerdown", () => {
  getAudioContext();
});

restartButton.addEventListener("click", restartGame);

loadBackground();
restartGame();
requestAnimationFrame(loop);
