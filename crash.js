/**
 * GamblingDen - Crash Game
 * Rising multiplier with cash-out mechanic
 */
(function () {
  "use strict";

  // ═══════════════════════════════════════════════════════════════════════════
  // DOM REFERENCES
  // ═══════════════════════════════════════════════════════════════════════════
  const balanceAmount = document.getElementById("balance-amount");
  const levelBadge = document.getElementById("level-badge");
  const xpBarFill = document.getElementById("xp-bar-fill");
  const xpText = document.getElementById("xp-text");
  const soundToggle = document.getElementById("sound-toggle");

  const canvas = document.getElementById("crash-canvas");
  const ctx = canvas.getContext("2d");
  const multiplierEl = document.getElementById("multiplier");
  const statusEl = document.getElementById("status");
  const historyEl = document.getElementById("crash-history");
  const potentialWinEl = document.getElementById("potential-win");

  const betInput = document.getElementById("bet-input");
  const betHalf = document.getElementById("bet-half");
  const betDouble = document.getElementById("bet-double");
  const autoCashoutToggle = document.getElementById("auto-cashout-toggle");
  const autoCashoutInput = document.getElementById("auto-cashout");
  const actionBtn = document.getElementById("action-btn");

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════
  let gameState = "waiting"; // waiting, betting, running, crashed
  let currentBet = 0;
  let currentMultiplier = 1.0;
  let crashPoint = 0;
  let startTime = 0;
  let animationId = null;
  let hasCashedOut = false;
  let cashOutMultiplier = 0;
  let graphPoints = [];
  let history = [];

  // Timing constants
  const BETTING_TIME = 3000; // 3 seconds to place bets
  const TICK_INTERVAL = 50; // Update every 50ms

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════
  init();

  function init() {
    resizeCanvas();
    updateUI();
    drawIdleGraph();

    // Event listeners
    GD.on("balance:change", updateBalanceUI);
    GD.on("xp:change", updateXPUI);

    window.addEventListener("resize", resizeCanvas);
    betHalf.addEventListener("click", () => adjustBet(0.5));
    betDouble.addEventListener("click", () => adjustBet(2));
    betInput.addEventListener("input", updatePotentialWin);
    autoCashoutToggle.addEventListener("change", toggleAutoCashout);
    actionBtn.addEventListener("click", handleAction);
    soundToggle.addEventListener("click", toggleSound);

    // Start the game loop
    startBettingPhase();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UI UPDATES
  // ═══════════════════════════════════════════════════════════════════════════
  function updateUI() {
    updateBalanceUI();
    updateXPUI();
    updateSoundUI();
    updatePotentialWin();
  }

  function updateBalanceUI() {
    balanceAmount.textContent = GD.formatEuro(GD.getBalance());
  }

  function updateXPUI() {
    const level = GD.getLevel();
    const { progress, needed, percent } = GD.getLevelProgress();
    levelBadge.textContent = `Lvl ${level}`;
    xpBarFill.style.width = `${percent}%`;
    xpText.textContent = `${GD.formatCompact(progress)} / ${GD.formatCompact(needed)} XP`;
  }

  function updateSoundUI() {
    document.body.classList.toggle("sound-off", !GD.isSoundEnabled());
  }

  function toggleSound() {
    GD.setSoundEnabled(!GD.isSoundEnabled());
    updateSoundUI();
    if (GD.isSoundEnabled()) GD.playSound("click");
  }

  function adjustBet(multiplier) {
    const current = parseFloat(betInput.value) || 10;
    betInput.value = Math.max(1, Math.floor(current * multiplier));
    updatePotentialWin();
    GD.playSound("click");
  }

  function toggleAutoCashout() {
    autoCashoutInput.disabled = !autoCashoutToggle.checked;
  }

  function updatePotentialWin() {
    const bet = parseFloat(betInput.value) || 0;
    if (gameState === "running" && currentBet > 0 && !hasCashedOut) {
      const potential = GD.round2(currentBet * currentMultiplier);
      potentialWinEl.innerHTML = `Potential win: <span class="amount">${GD.formatEuro(potential)}</span>`;
    } else if (bet > 0) {
      potentialWinEl.innerHTML = `At 2×: <span class="amount">${GD.formatEuro(bet * 2)}</span>`;
    } else {
      potentialWinEl.innerHTML = "";
    }
  }

  function updateMultiplierDisplay() {
    multiplierEl.textContent = `${currentMultiplier.toFixed(2)}×`;
    multiplierEl.classList.remove("rising", "crashed", "cashed-out");

    if (hasCashedOut) {
      multiplierEl.classList.add("cashed-out");
      multiplierEl.textContent = `${cashOutMultiplier.toFixed(2)}×`;
    } else if (gameState === "crashed") {
      multiplierEl.classList.add("crashed");
    } else if (gameState === "running") {
      multiplierEl.classList.add("rising");
    }
  }

  function updateActionButton() {
    const btnText = actionBtn.querySelector(".btn-text");

    actionBtn.classList.remove("cash-out", "waiting");

    switch (gameState) {
      case "waiting":
        btnText.textContent = "Waiting...";
        actionBtn.disabled = true;
        actionBtn.classList.add("waiting");
        break;

      case "betting":
        if (currentBet > 0) {
          btnText.textContent = "Bet Placed ✓";
          actionBtn.disabled = true;
        } else {
          btnText.textContent = "Place Bet";
          actionBtn.disabled = false;
        }
        break;

      case "running":
        if (currentBet > 0 && !hasCashedOut) {
          btnText.textContent = "💰 Cash Out";
          actionBtn.disabled = false;
          actionBtn.classList.add("cash-out");
        } else {
          btnText.textContent = hasCashedOut ? "Cashed Out ✓" : "Running...";
          actionBtn.disabled = true;
        }
        break;

      case "crashed":
        btnText.textContent = "Next Round...";
        actionBtn.disabled = true;
        break;
    }

    // Disable betting if insufficient funds
    if (gameState === "betting" && currentBet === 0) {
      const bet = parseFloat(betInput.value) || 0;
      actionBtn.disabled = bet > GD.getBalance();
    }
  }

  function addToHistory(crashPoint) {
    history.unshift(crashPoint);
    if (history.length > 10) history.pop();

    // Render history
    const historyItems = history
      .map((point) => {
        let cls = "low";
        if (point >= 2) cls = "medium";
        if (point >= 5) cls = "high";
        return `<span class="history-item ${cls}">${point.toFixed(2)}×</span>`;
      })
      .join("");

    historyEl.innerHTML = `<span class="history-label">Previous:</span>${historyItems}`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CANVAS
  // ═══════════════════════════════════════════════════════════════════════════
  function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = 300;
  }

  function drawIdleGraph() {
    ctx.fillStyle = "#0a0d14";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid
    drawGrid();
  }

  function drawGrid() {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;

    // Horizontal lines
    for (let i = 0; i <= 5; i++) {
      const y = (canvas.height / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Vertical lines
    for (let i = 0; i <= 10; i++) {
      const x = (canvas.width / 10) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
  }

  function drawGraph() {
    ctx.fillStyle = "#0a0d14";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawGrid();

    if (graphPoints.length < 2) return;

    // Draw the curve
    const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
    if (gameState === "crashed" && !hasCashedOut) {
      gradient.addColorStop(0, "rgba(239, 68, 68, 0.1)");
      gradient.addColorStop(1, "rgba(239, 68, 68, 0.4)");
    } else {
      gradient.addColorStop(0, "rgba(16, 185, 129, 0.1)");
      gradient.addColorStop(1, "rgba(16, 185, 129, 0.4)");
    }

    ctx.beginPath();
    ctx.moveTo(0, canvas.height);

    graphPoints.forEach((point, i) => {
      const x = (i / (graphPoints.length - 1 || 1)) * canvas.width;
      const y = canvas.height - (Math.log(point) / Math.log(10)) * canvas.height * 0.3;
      ctx.lineTo(x, Math.max(10, y));
    });

    ctx.lineTo(canvas.width, canvas.height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw the line
    ctx.beginPath();
    graphPoints.forEach((point, i) => {
      const x = (i / (graphPoints.length - 1 || 1)) * canvas.width;
      const y = canvas.height - (Math.log(point) / Math.log(10)) * canvas.height * 0.3;
      if (i === 0) ctx.moveTo(x, Math.max(10, y));
      else ctx.lineTo(x, Math.max(10, y));
    });

    ctx.strokeStyle = gameState === "crashed" && !hasCashedOut ? "#ef4444" : "#10b981";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw cash-out point if applicable
    if (hasCashedOut && cashOutMultiplier > 1) {
      const cashOutIndex = graphPoints.findIndex((p) => p >= cashOutMultiplier);
      if (cashOutIndex > 0) {
        const x = (cashOutIndex / (graphPoints.length - 1 || 1)) * canvas.width;
        const y = canvas.height - (Math.log(cashOutMultiplier) / Math.log(10)) * canvas.height * 0.3;

        ctx.beginPath();
        ctx.arc(x, Math.max(10, y), 8, 0, Math.PI * 2);
        ctx.fillStyle = "#fbbf24";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GAME LOGIC
  // ═══════════════════════════════════════════════════════════════════════════
  function generateCrashPoint() {
    // Provably fair-ish crash point generation
    // House edge of ~1% (was 3%)
    const e = 0.99;
    const h = GD.randomInt(0, 10000000) / 10000000;
    return Math.max(1.0, Math.floor((100 * e) / (h * 100)) / 100);
  }

  function startBettingPhase() {
    gameState = "betting";
    currentBet = 0;
    currentMultiplier = 1.0;
    hasCashedOut = false;
    cashOutMultiplier = 0;
    graphPoints = [1];

    statusEl.textContent = "Place your bet!";
    multiplierEl.textContent = "1.00×";
    multiplierEl.classList.remove("rising", "crashed", "cashed-out");

    betInput.disabled = false;
    updateActionButton();
    drawIdleGraph();

    // Countdown
    let countdown = 3;
    const countdownInterval = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        statusEl.textContent = `Starting in ${countdown}...`;
        GD.playSound("countdown");
      } else {
        clearInterval(countdownInterval);
        startRound();
      }
    }, 1000);
  }

  function startRound() {
    gameState = "running";
    crashPoint = generateCrashPoint();
    startTime = performance.now();
    graphPoints = [1];

    statusEl.textContent = "";
    betInput.disabled = true;
    updateActionButton();

    GD.playSound("spin");

    // Start animation
    animationId = requestAnimationFrame(updateRound);
  }

  function updateRound(timestamp) {
    const elapsed = timestamp - startTime;
    const t = elapsed / 1000; // time in seconds

    // Exponential growth formula
    // Slower growth: 0.04 coefficient (was 0.06)
    currentMultiplier = Math.pow(Math.E, 0.04 * t * t);
    currentMultiplier = Math.floor(currentMultiplier * 100) / 100;

    graphPoints.push(currentMultiplier);

    // Check for auto cash-out
    if (
      currentBet > 0 &&
      !hasCashedOut &&
      autoCashoutToggle.checked &&
      currentMultiplier >= parseFloat(autoCashoutInput.value)
    ) {
      cashOut();
    }

    // Check for crash
    if (currentMultiplier >= crashPoint) {
      crash();
      return;
    }

    updateMultiplierDisplay();
    updatePotentialWin();
    drawGraph();

    animationId = requestAnimationFrame(updateRound);
  }

  function crash() {
    gameState = "crashed";
    currentMultiplier = crashPoint;

    if (animationId) cancelAnimationFrame(animationId);

    updateMultiplierDisplay();
    drawGraph();

    if (currentBet > 0 && !hasCashedOut) {
      statusEl.textContent = `Crashed! You lost ${GD.formatEuro(currentBet)}`;
      GD.playSound("lose");
      GD.updateStats({ noWin: true, game: "crash" });
    } else if (hasCashedOut) {
      statusEl.textContent = `Crashed at ${crashPoint.toFixed(2)}× - You won!`;
    } else {
      statusEl.textContent = `Crashed at ${crashPoint.toFixed(2)}×`;
    }

    addToHistory(crashPoint);
    updateActionButton();

    // Start next round after delay
    setTimeout(startBettingPhase, 2500);
  }

  function cashOut() {
    if (gameState !== "running" || currentBet <= 0 || hasCashedOut) return;

    hasCashedOut = true;
    cashOutMultiplier = currentMultiplier;

    const winAmount = GD.round2(currentBet * cashOutMultiplier);
    GD.creditWin(winAmount);
    GD.updateStats({ game: "crash" });

    statusEl.textContent = `Cashed out at ${cashOutMultiplier.toFixed(2)}× for ${GD.formatEuro(winAmount)}!`;
    updateMultiplierDisplay();
    updateActionButton();
    potentialWinEl.innerHTML = `Won: <span class="amount">${GD.formatEuro(winAmount)}</span>`;

    GD.playSound("cashout");

    if (cashOutMultiplier >= 10) {
      GD.checkAchievement("crash_10x");
      GD.playSound("bigwin");
      GD.showToast(`🚀 ${cashOutMultiplier.toFixed(2)}× Cash Out: ${GD.formatEuro(winAmount)}!`, "success");
    } else {
      GD.showToast(`Cashed out: ${GD.formatEuro(winAmount)}!`, "success");
    }
  }

  function handleAction() {
    if (gameState === "betting" && currentBet === 0) {
      placeBet();
    } else if (gameState === "running" && currentBet > 0 && !hasCashedOut) {
      cashOut();
    }
  }

  function placeBet() {
    const bet = parseFloat(betInput.value) || 0;
    if (bet <= 0 || bet > GD.getBalance()) {
      GD.showToast("Invalid bet amount", "error");
      return;
    }

    if (!GD.placeBet(bet)) {
      GD.showToast("Insufficient balance", "error");
      return;
    }

    currentBet = bet;
    statusEl.textContent = `Bet placed: ${GD.formatEuro(bet)}`;
    updateActionButton();
    GD.playSound("click");
  }
})();
