(() => {
  const $ = id => document.getElementById(id);
  const tg = window.Telegram?.WebApp;
  tg?.ready();
  tg?.expand();

  const storageKey = "kbRealGamesMiniAppV1";
  let data;
  try {
    data = JSON.parse(localStorage.getItem(storageKey)) || {};
  } catch {
    data = {};
  }

  data.points = Number.isFinite(data.points) ? data.points : 100;
  data.games = Number.isFinite(data.games) ? data.games : 0;
  data.wins = Number.isFinite(data.wins) ? data.wins : 0;
  data.best = Number.isFinite(data.best) ? data.best : 0;

  let reactionTimer = null;
  let reactionStarted = 0;
  let reactionReady = false;
  let memorySequence = [];
  let memoryIndex = 0;

  const save = () => {
    localStorage.setItem(storageKey, JSON.stringify(data));
    renderStats();
  };

  function renderStats() {
    $("points").textContent = data.points;
    $("gamesPlayed").textContent = data.games;
    $("wins").textContent = data.wins;
    $("bestScore").textContent = data.best;
    $("playerName").textContent = tg?.initDataUnsafe?.user?.first_name || "Guest Player";
    const name = tg?.initDataUnsafe?.user?.first_name || "";
    $("avatar").textContent = name ? [...name][0].toUpperCase() : "🎮";
  }

  function award(points, win = true) {
    data.points = Math.max(0, data.points + points);
    data.games++;
    if (win) data.wins++;
    data.best = Math.max(data.best, Math.max(0, points));
    save();
  }

  function openGame(title, message) {
    $("gamePanel").classList.remove("hidden");
    $("gameTitle").textContent = title;
    $("gameMessage").textContent = message;
    $("gameArea").replaceChildren();
    $("gamePanel").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function button(label, onClick) {
    const b = document.createElement("button");
    b.className = "game-action";
    b.textContent = label;
    b.addEventListener("click", onClick);
    $("gameArea").appendChild(b);
    return b;
  }

  function result(message) {
    $("gameMessage").textContent = message;
  }

  function playSpin() {
    openGame("🎡 Lucky Spin", "Press spin. You can win 0, 5, 10, or 20 points.");
    const wheel = document.createElement("div");
    wheel.className = "wheel";
    wheel.textContent = "🎁";
    $("gameArea").appendChild(wheel);
    button("🎡 SPIN NOW", () => {
      if (wheel.classList.contains("spinning")) return;
      wheel.classList.add("spinning");
      result("Spinning...");
      setTimeout(() => {
        const reward = [0, 5, 10, 20][Math.floor(Math.random() * 4)];
        award(reward, reward > 0);
        wheel.classList.remove("spinning");
        wheel.textContent = reward ? `+${reward}` : "🙂";
        result(reward ? `🎉 You won ${reward} points!` : "No points this time. Try again!");
      }, 850);
    });
  }

  function playTap() {
    openGame("👆 Tap Challenge", "Tap the button as many times as you can in 10 seconds!");
    let count = 0;
    let active = false;
    let timer;
    const counter = document.createElement("div");
    counter.className = "wheel";
    counter.textContent = "0";
    $("gameArea").appendChild(counter);

    button("▶ START", event => {
      if (active) return;
      active = true;
      count = 0;
      counter.textContent = "0";
      event.currentTarget.textContent = "👆 TAP!";
      result("Go! Tap quickly!");
      timer = setTimeout(() => {
        active = false;
        award(count, count > 0);
        result(`Time! You tapped ${count} times and earned ${count} points.`);
        event.currentTarget.textContent = "▶ PLAY AGAIN";
      }, 10000);
    }).addEventListener("click", () => {
      if (active) {
        count++;
        counter.textContent = count;
      }
    });
  }

  function playMemory() {
    openGame("🧠 Memory Match", "Memorize the emoji sequence, then repeat it in order.");
    const icons = ["🚀", "🍎", "🐱", "⚽", "🌟", "🐸"];
    memorySequence = Array.from({ length: 3 }, () => icons[Math.floor(Math.random() * icons.length)]);
    memoryIndex = 0;
    const display = document.createElement("div");
    display.className = "wheel";
    display.style.fontSize = "30px";
    display.textContent = memorySequence.join(" ");
    $("gameArea").appendChild(display);

    setTimeout(() => {
      display.textContent = "❓ ❓ ❓";
      result("Now tap the emojis in the same order.");
      icons.forEach(icon => button(icon, () => {
        if (icon !== memorySequence[memoryIndex]) {
          result("Not quite! Try another round.");
          $("gameArea").querySelectorAll("button").forEach(b => b.disabled = true);
          data.games++;
          save();
          return;
        }
        memoryIndex++;
        if (memoryIndex === memorySequence.length) {
          award(10, true);
          display.textContent = "🏆";
          result("Perfect memory! +10 points.");
          $("gameArea").querySelectorAll("button").forEach(b => b.disabled = true);
        } else {
          result(`Correct! ${memorySequence.length - memoryIndex} left.`);
        }
      }));
    }, 1800);
  }

  function playGuess() {
    const target = Math.floor(Math.random() * 10) + 1;
    let attempts = 0;
    openGame("🔢 Number Guess", "Guess a number from 1 to 10. You have 3 tries.");
    const input = document.createElement("input");
    input.className = "game-input";
    input.type = "number";
    input.min = "1";
    input.max = "10";
    input.placeholder = "Enter 1–10";
    $("gameArea").appendChild(input);
    button("CHECK", () => {
      const guess = Number(input.value);
      if (!Number.isInteger(guess) || guess < 1 || guess > 10) {
        result("Enter a whole number from 1 to 10.");
        return;
      }
      attempts++;
      if (guess === target) {
        award(10, true);
        result("🎉 Correct! +10 points.");
        input.disabled = true;
      } else if (attempts >= 3) {
        data.games++;
        save();
        result(`Out of tries! The number was ${target}.`);
        input.disabled = true;
      } else {
        result(guess < target ? "⬆️ Try higher!" : "⬇️ Try lower!");
      }
    });
  }

  function playReaction() {
    clearTimeout(reactionTimer);
    reactionReady = false;
    openGame("⚡ Reaction Test", "Tap start and wait until the screen says TAP NOW. Don't tap too early!");
    const pad = document.createElement("div");
    pad.className = "wheel";
    pad.style.fontSize = "23px";
    pad.textContent = "READY?";
    $("gameArea").appendChild(pad);

    button("START", () => {
      clearTimeout(reactionTimer);
      reactionReady = false;
      pad.textContent = "WAIT...";
      result("Wait for the signal...");
      reactionTimer = setTimeout(() => {
        reactionReady = true;
        reactionStarted = performance.now();
        pad.textContent = "TAP NOW!";
        result("Quick! Tap the circle!");
      }, 1000 + Math.random() * 3000);
    });
    button("⚡ TAP!", () => {
      if (!reactionReady) {
        clearTimeout(reactionTimer);
        pad.textContent = "TOO SOON";
        result("Too soon! Press START to try again.");
        return;
      }
      reactionReady = false;
      const ms = Math.round(performance.now() - reactionStarted);
      const points = ms < 350 ? 10 : ms < 600 ? 5 : 2;
      award(points, true);
      pad.textContent = `${ms} ms`;
      result(`Reaction time: ${ms} ms. +${points} points!`);
    });
  }

  function openProfile() {
    openGame("👤 Player Profile", "Your current local game statistics.");
    const info = document.createElement("p");
    info.textContent = `Player: ${tg?.initDataUnsafe?.user?.first_name || "Guest Player"} · Points: ${data.points} · Games: ${data.games} · Wins: ${data.wins}`;
    $("gameArea").appendChild(info);
  }

  function openNamedGame(game) {
    const games = {
      spin: playSpin,
      tap: playTap,
      memory: playMemory,
      guess: playGuess,
      reaction: playReaction,
    };
    (games[game] || playSpin)();
  }

  document.querySelectorAll("[data-game]").forEach(card => {
    card.addEventListener("click", () => openNamedGame(card.dataset.game));
  });

  $("closeGame").addEventListener("click", () => {
    clearTimeout(reactionTimer);
    $("gamePanel").classList.add("hidden");
  });

  $("dailyBtn").addEventListener("click", () => {
    const today = new Date().toISOString().slice(0, 10);
    if (data.daily === today) {
      result("You already claimed today's bonus.");
      $("gamePanel").classList.remove("hidden");
      $("gameTitle").textContent = "🎁 Daily Bonus";
      $("gameArea").replaceChildren();
      return;
    }
    data.daily = today;
    award(10, true);
    openGame("🎁 Daily Bonus", "You collected 10 points today!");
  });

  document.querySelectorAll("[data-tab]").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll("[data-tab]").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      if (tab.dataset.tab === "profile") openProfile();
      else if (tab.dataset.tab === "games") $("gamePanel").scrollIntoView({ behavior: "smooth" });
      else window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  $("profileBtn").addEventListener("click", openProfile);
  renderStats();
  save();
})();
