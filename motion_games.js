(() => {
  const $ = id => document.getElementById(id);
  const grid = document.querySelector(".games-grid");
  if (!grid) return;

  const modes = [
    ["aviator", "✈️", "Aviator Flight", "Fly and dodge clouds"],
    ["racing", "🏎️", "Car Racing", "Dodge traffic"],
    ["runner", "🏃", "Runner Game", "Jump over obstacles"],
    ["snake", "🐍", "Snake", "Collect the food"],
    ["space", "🚀", "Space Shooter", "Dodge and shoot"]
  ];

  modes.forEach(([id, icon, title, description]) => {
    const card = document.createElement("button");
    card.className = "game-card motion-card";
    card.dataset.motionGame = id;
    card.innerHTML =
      `<span class="game-icon">${icon}</span>
       <strong>${title}</strong>
       <small>${description}</small>
       <span class="play-tag">PLAY ›</span>`;
    grid.appendChild(card);
  });

  const css = document.createElement("style");
  css.textContent = `
    .motion-card { background:linear-gradient(145deg,#27345d,#17172a); }
    .motion-board { width:100%; max-width:360px; margin:12px auto; }
    .motion-canvas { display:block;width:100%;height:auto;border-radius:16px;
      background:#101b35;border:1px solid #45406a;touch-action:none; }
    .motion-controls { display:grid;grid-template-columns:repeat(3,1fr);
      gap:8px;margin-top:12px; }
    .motion-controls button { min-height:48px;border:1px solid #45406a;
      border-radius:13px;background:#252545;color:white;font-size:19px;
      font-weight:bold;touch-action:manipulation; }
    .motion-controls button:active { background:#6741a5; }
    .motion-help { text-align:center;font-size:12px;color:#c4c4df; }
  `;
  document.head.appendChild(css);

  let stopGame = null;

  function startGame(mode) {
    if (stopGame) stopGame();
    stopGame = null;

    $("gamePanel").classList.remove("hidden");
    $("gameTitle").textContent =
      modes.find(m => m[0] === mode)?.[2] || "Motion Game";
    $("gameMessage").textContent = "Press START to play!";
    $("gameArea").replaceChildren();
    $("gamePanel").scrollIntoView({ behavior: "smooth", block: "start" });

    const board = document.createElement("div");
    board.className = "motion-board";

    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 420;
    canvas.className = "motion-canvas";
    canvas.setAttribute("aria-label", "Animated game screen");

    const controls = document.createElement("div");
    controls.className = "motion-controls";

    const help = document.createElement("p");
    help.className = "motion-help";
    help.textContent = "Points are for fun only.";

    const start = document.createElement("button");
    start.className = "game-action";
    start.textContent = "▶ START";

    board.append(canvas, controls, help, start);
    $("gameArea").appendChild(board);

    const ctx = canvas.getContext("2d");
    let running = false;
    let ended = false;
    let frame = 0;
    let score = 0;
    let animation = 0;
    let last = 0;
    const keys = { left: false, right: false, up: false, down: false, fire: false };
    const player = { x: 150, y: 340, vx: 0, vy: 0 };
    let obstacles = [];
    let bullets = [];
    let food = { x: 10, y: 10 };
    let snake = [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }];
    let direction = { x: 1, y: 0 };
    let nextDirection = { x: 1, y: 0 };
    let tick = 0;
    let jump = false;

    function text(str, x, y, size = 18, color = "#ffffff") {
      ctx.fillStyle = color;
      ctx.font = `bold ${size}px system-ui`;
      ctx.fillText(str, x, y);
    }

    function rounded(x, y, w, h, color, r = 7) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fill();
    }

    function background() {
      ctx.fillStyle = mode === "space" ? "#090d25" :
        mode === "aviator" ? "#142b50" : "#12253a";
      ctx.fillRect(0, 0, 320, 420);

      if (mode === "aviator") {
        for (let i = 0; i < 7; i++) {
          const x = ((i * 71 - frame * 1.1) % 380 + 380) % 380 - 30;
          const y = 55 + (i * 49) % 240;
          text("☁️", x, y, 25);
        }
      }

      if (mode === "racing" || mode === "runner") {
        ctx.fillStyle = "#293b42";
        ctx.fillRect(45, 0, 230, 420);
        ctx.fillStyle = "#e4e6eb";
        for (let y = -50 + (frame * 5) % 70; y < 430; y += 70) {
          ctx.fillRect(155, y, 6, 34);
        }
        ctx.fillStyle = "#53bb81";
        ctx.fillRect(0, 0, 40, 420);
        ctx.fillRect(280, 0, 40, 420);
      }

      if (mode === "space") {
        for (let i = 0; i < 45; i++) {
          const x = (i * 79 + 17) % 320;
          const y = ((i * 53 + frame * (1 + i % 3)) % 420);
          ctx.fillStyle = "#b8d7ff";
          ctx.fillRect(x, y, 2, 2);
        }
      }
    }

    function drawPlayer() {
      if (mode === "aviator") {
        text("✈️", player.x, player.y, 34);
      } else if (mode === "racing") {
        rounded(player.x, player.y, 30, 46, "#28d9ee", 8);
        rounded(player.x + 5, player.y + 6, 20, 13, "#d9f7ff", 4);
        rounded(player.x + 5, player.y + 27, 20, 10, "#12617c", 3);
      } else if (mode === "runner") {
        text("🏃", player.x, player.y, 34);
      } else if (mode === "space") {
        text("🚀", player.x, player.y, 31);
      }
    }

    function drawSnake() {
      ctx.fillStyle = "#0d1926";
      ctx.fillRect(0, 0, 320, 420);
      rounded(food.x * 16, food.y * 16, 14, 14, "#ff6384", 6);
      snake.forEach((part, i) =>
        rounded(part.x * 16, part.y * 16, 14, 14,
          i === 0 ? "#83ffb1" : "#27c879", 4));
    }

    function draw() {
      if (mode === "snake") {
        drawSnake();
        text("Score: " + score, 10, 22, 15);
        return;
      }

      background();
      text("SCORE: " + score, 12, 25, 15, "#ffe58a");

      if (mode === "aviator") {
        player.y += (keys.up ? -3.4 : 0) + (keys.down ? 3.4 : 0);
        player.y = Math.max(45, Math.min(380, player.y));
      } else if (mode === "racing") {
        player.x += (keys.left ? -4 : 0) + (keys.right ? 4 : 0);
        player.x = Math.max(52, Math.min(238, player.x));
      } else if (mode === "runner") {
        player.x = 140;
        if (jump) {
          player.vy = -10;
          jump = false;
        }
        player.y += player.vy;
        player.vy += 0.48;
        if (player.y > 340) {
          player.y = 340;
          player.vy = 0;
        }
      } else if (mode === "space") {
        player.x += (keys.left ? -4 : 0) + (keys.right ? 4 : 0);
        player.x = Math.max(10, Math.min(275, player.x));
        if (keys.fire && frame % 10 === 0) {
          bullets.push({ x: player.x + 12, y: player.y });
        }
        bullets.forEach(b => b.y -= 7);
        bullets = bullets.filter(b => b.y > 0);
        bullets.forEach(b => text("•", b.x, b.y, 24, "#ffe66d"));
      }

      if (mode !== "runner") drawPlayer();

      if (mode === "runner") drawPlayer();

      obstacles.forEach(o => {
        o.y += o.speed;
        if (mode === "racing") {
          rounded(o.x, o.y, 30, 42, "#ff5d75", 7);
          text("🚗", o.x - 2, o.y + 28, 24);
        } else if (mode === "runner") {
          text("🪨", o.x, o.y, 28);
        } else if (mode === "aviator") {
          text("⛈️", o.x, o.y, 27);
        } else if (mode === "space") {
          text("👾", o.x, o.y, 25);
        }
      });

      obstacles = obstacles.filter(o => o.y < 450);
    }

    function endGame(message) {
      if (ended) return;
      ended = true;
      running = false;
      cancelAnimationFrame(animation);
      start.textContent = "↻ PLAY AGAIN";
      $("gameMessage").textContent = message + " Final score: " + score;

      try {
        const key = "kbRealGamesMiniAppV1";
        const data = JSON.parse(localStorage.getItem(key) || "{}");
        data.points = Math.max(0, Number(data.points) || 0) + score;
        data.games = (Number(data.games) || 0) + 1;
        if (score > 0) data.wins = (Number(data.wins) || 0) + 1;
        data.best = Math.max(Number(data.best) || 0, score);
        localStorage.setItem(key, JSON.stringify(data));

        if ($("points")) $("points").textContent = data.points;
        if ($("gamesPlayed")) $("gamesPlayed").textContent = data.games;
        if ($("wins")) $("wins").textContent = data.wins;
        if ($("bestScore")) $("bestScore").textContent = data.best;
      } catch (_) {}
    }

    function collide(a, b, size = 24) {
      return Math.abs(a.x - b.x) < size && Math.abs(a.y - b.y) < size;
    }

    function updateSnake() {
      if (frame % 7 !== 0) return;
      direction = nextDirection;
      const head = {
        x: snake[0].x + direction.x,
        y: snake[0].y + direction.y
      };

      if (head.x < 0 || head.x >= 20 || head.y < 0 || head.y >= 26 ||
          snake.some(p => p.x === head.x && p.y === head.y)) {
        endGame("🐍 Game over!");
        return;
      }

      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) {
        score += 5;
        food = { x: Math.floor(Math.random() * 20),
          y: Math.floor(Math.random() * 26) };
      } else {
        snake.pop();
      }
    }

    function update() {
      if (!running) return;
      frame++;

      if (mode === "snake") {
        updateSnake();
      } else {
        if (frame % 48 === 0) {
          const laneX = [65, 105, 145, 185, 225, 250];
          obstacles.push({
            x: laneX[Math.floor(Math.random() * laneX.length)],
            y: -35,
            speed: mode === "aviator" ? 2.5 : 3.5
          });
        }

        if (frame % 30 === 0) score++;

        for (const o of obstacles) {
          if (mode === "space") {
            const hit = bullets.some(b => collide(
              { x: b.x, y: b.y }, { x: o.x, y: o.y }, 22
            ));
            if (hit) {
              o.y = 500;
              bullets = bullets.filter(b => !collide(
                { x: b.x, y: b.y }, { x: o.x, y: o.y }, 22
              ));
              score += 5;
            }
          }

          if (mode === "aviator" && collide(
            { x: player.x + 10, y: player.y - 10 }, o, 24
          )) return endGame("✈️ Flight ended!");

          if (mode === "racing" && Math.abs(player.x - o.x) < 28 &&
              Math.abs(player.y - o.y) < 40)
            return endGame("🏎️ Race ended!");

          if (mode === "runner" && player.y > 320 &&
              Math.abs(player.x - o.x) < 28 && Math.abs(player.y - o.y) < 30)
            return endGame("🏃 Run ended!");

          if (mode === "space" && collide(
            { x: player.x, y: player.y - 8 }, o, 23
          )) return endGame("🚀 Ship hit!");
        }
      }

      draw();
      animation = requestAnimationFrame(update);
    }

    function addControl(label, key, col) {
      const b = document.createElement("button");
      b.textContent = label;
      b.style.gridColumn = col || "auto";
      b.addEventListener("pointerdown", e => {
        e.preventDefault();
        if (key === "jump") jump = true;
        else if (key.startsWith("turn")) {
          const d = key.endsWith("left") ? -1 : 1;
          nextDirection = d === -1
            ? { x: -direction.y, y: direction.x }
            : { x: direction.y, y: -direction.x };
        } else keys[key] = true;
      });
      const release = () => { if (key in keys) keys[key] = false; };
      b.addEventListener("pointerup", release);
      b.addEventListener("pointerleave", release);
      b.addEventListener("pointercancel", release);
      controls.appendChild(b);
    }

    if (mode === "snake") {
      addControl("⬆️", "turnleft", "2");
      addControl("⬅️", "turnleft", "1");
      addControl("⬇️", "turnright", "2");
      addControl("➡️", "turnright", "3");
      help.textContent = "Use the arrows to turn and collect food.";
    } else {
      addControl("⬅️", "left", "1");
      addControl("⬆️", mode === "runner" ? "jump" : "up", "2");
      addControl("➡️", "right", "3");
      if (mode === "space") addControl("🔥 FIRE", "fire", "1 / 4");
      if (mode === "aviator") {
        addControl("⬇️", "down", "2");
        help.textContent = "Use UP and DOWN to steer the plane.";
      } else if (mode === "racing") {
        help.textContent = "Move left and right to dodge cars.";
      } else if (mode === "runner") {
        help.textContent = "Tap UP to jump over rocks.";
      } else {
        help.textContent = "Move and hold FIRE to shoot.";
      }
    }

    const keyMap = {
      ArrowLeft: "left", ArrowRight: "right",
      ArrowUp: mode === "runner" ? "jump" : "up",
      ArrowDown: "down", " ": "fire"
    };

    function keydown(e) {
      if (!(e.key in keyMap)) return;
      e.preventDefault();
      const k = keyMap[e.key];
      if (k === "jump") jump = true;
      else keys[k] = true;
    }
    function keyup(e) {
      if (e.key in keyMap) {
        const k = keyMap[e.key];
        if (k in keys) keys[k] = false;
      }
    }
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);

    start.addEventListener("click", () => {
      if (running) return;
      if (ended) {
        startGame(mode);
        return;
      }
      running = true;
      ended = false;
      frame = 0;
      score = 0;
      last = 0;
      obstacles = [];
      bullets = [];
      player.x = mode === "racing" ? 145 : 150;
      player.y = mode === "runner" ? 340 : 330;
      player.vy = 0;
      snake = [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }];
      direction = { x: 1, y: 0 };
      nextDirection = { x: 1, y: 0 };
      food = { x: 14, y: 10 };
      start.textContent = "▶ PLAYING";
      $("gameMessage").textContent = "Play! Avoid obstacles and score points.";
      draw();
      animation = requestAnimationFrame(update);
    });

    stopGame = () => {
      running = false;
      cancelAnimationFrame(animation);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
    };
    draw();
  }

  grid.addEventListener("click", e => {
    const card = e.target.closest("[data-motion-game]");
    if (card) startGame(card.dataset.motionGame);
  });

  $("closeGame")?.addEventListener("click", () => {
    if (stopGame) stopGame();
    stopGame = null;
  });
})();
