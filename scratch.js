/**
 * GamblingDen - Scratch Cards
 * Scratch-off style instant win game
 */
(function () {
  "use strict";

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTANTS
  // ═══════════════════════════════════════════════════════════════════════════
  const SYMBOLS = ["🍒", "🍀", "🔔", "⭐", "💎"];
  const PRIZE_MULTIPLIERS = {
    "🍒": 2,
    "🍀": 5,
    "🔔": 10,
    "⭐": 20,
    "💎": 50,
  };

  // Symbol weights (more common symbols have higher weight)
  const SYMBOL_WEIGHTS = {
    "🍒": 40,
    "🍀": 30,
    "🔔": 18,
    "⭐": 9,
    "💎": 3,
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // DOM REFERENCES
  // ═══════════════════════════════════════════════════════════════════════════
  const balanceAmount = document.getElementById("balance-amount");
  const levelBadge = document.getElementById("level-badge");
  const xpBarFill = document.getElementById("xp-bar-fill");
  const xpText = document.getElementById("xp-text");
  const soundToggle = document.getElementById("sound-toggle");

  const cardSelection = document.getElementById("card-selection");
  const activeCard = document.getElementById("active-card");
  const scratchGrid = document.getElementById("scratch-grid");
  const scratchResult = document.getElementById("scratch-result");
  const cardTitle = document.getElementById("card-title");

  const revealAllBtn = document.getElementById("reveal-all-btn");
  const newCardBtn = document.getElementById("new-card-btn");
  const resultIcon = document.getElementById("result-icon");
  const resultText = document.getElementById("result-text");

  const cardOptions = document.querySelectorAll(".card-option");

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════
  let currentCost = 0;
  let grid = [];
  let revealed = [];
  let isScratching = false;
  let gameEnded = false;

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════
  init();

  function init() {
    updateUI();

    // Event listeners
    GD.on("balance:change", updateBalanceUI);
    GD.on("xp:change", updateXPUI);

    cardOptions.forEach((option) => {
      option.addEventListener("click", () => purchaseCard(parseInt(option.dataset.cost)));
    });

    revealAllBtn.addEventListener("click", revealAll);
    newCardBtn.addEventListener("click", showCardSelection);
    soundToggle.addEventListener("click", toggleSound);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UI UPDATES
  // ═══════════════════════════════════════════════════════════════════════════
  function updateUI() {
    updateBalanceUI();
    updateXPUI();
    updateSoundUI();
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

  function showCardSelection() {
    cardSelection.classList.remove("hidden");
    activeCard.classList.add("hidden");
    scratchResult.classList.add("hidden");
  }

  function showActiveCard() {
    cardSelection.classList.add("hidden");
    activeCard.classList.remove("hidden");
    scratchResult.classList.add("hidden");
  }

  function showResult(won, amount) {
    cardSelection.classList.add("hidden");
    activeCard.classList.add("hidden");
    scratchResult.classList.remove("hidden");

    if (won) {
      resultIcon.textContent = "🎉";
      resultText.textContent = `You won ${GD.formatEuro(amount)}!`;
      resultText.className = "result-text win";
    } else {
      resultIcon.textContent = "😢";
      resultText.textContent = "No match this time!";
      resultText.className = "result-text lose";
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GAME LOGIC
  // ═══════════════════════════════════════════════════════════════════════════
  function purchaseCard(cost) {
    if (!GD.placeBet(cost)) {
      GD.showToast("Insufficient balance", "error");
      return;
    }

    currentCost = cost;
    gameEnded = false;
    revealed = Array(9).fill(false);

    // Set card title
    const tierName = cost === 1 ? "Bronze" : cost === 5 ? "Silver" : "Gold";
    cardTitle.textContent = `${tierName} Card - €${cost}`;

    // Generate grid
    grid = generateGrid();

    // Build scratch cells
    buildScratchGrid();

    showActiveCard();
    GD.playSound("click");
  }

  function generateGrid() {
    // Create weighted array
    const weightedSymbols = [];
    for (const [symbol, weight] of Object.entries(SYMBOL_WEIGHTS)) {
      for (let i = 0; i < weight; i++) {
        weightedSymbols.push(symbol);
      }
    }

    // Generate 9 random symbols
    const result = [];
    for (let i = 0; i < 9; i++) {
      const idx = GD.randomInt(0, weightedSymbols.length - 1);
      result.push(weightedSymbols[idx]);
    }

    return result;
  }

  function buildScratchGrid() {
    scratchGrid.innerHTML = "";

    for (let i = 0; i < 9; i++) {
      const cell = document.createElement("div");
      cell.className = "scratch-cell";
      cell.dataset.index = i;

      // Prize layer
      const prize = document.createElement("div");
      prize.className = "prize";
      prize.textContent = grid[i];
      cell.appendChild(prize);

      // Canvas layer for scratching
      const canvas = document.createElement("canvas");
      canvas.width = 120;
      canvas.height = 120;
      cell.appendChild(canvas);

      // Draw scratch surface
      const ctx = canvas.getContext("2d");
      drawScratchSurface(ctx, canvas.width, canvas.height);

      // Event handlers
      let isMouseDown = false;

      const startScratch = (e) => {
        if (gameEnded) return;
        isMouseDown = true;
        scratch(e, canvas, ctx, i);
      };

      const moveScratch = (e) => {
        if (!isMouseDown || gameEnded) return;
        scratch(e, canvas, ctx, i);
      };

      const endScratch = () => {
        isMouseDown = false;
      };

      canvas.addEventListener("mousedown", startScratch);
      canvas.addEventListener("mousemove", moveScratch);
      canvas.addEventListener("mouseup", endScratch);
      canvas.addEventListener("mouseleave", endScratch);

      canvas.addEventListener("touchstart", (e) => {
        e.preventDefault();
        startScratch(e);
      });
      canvas.addEventListener("touchmove", (e) => {
        e.preventDefault();
        moveScratch(e);
      });
      canvas.addEventListener("touchend", endScratch);

      scratchGrid.appendChild(cell);
    }
  }

  function drawScratchSurface(ctx, width, height) {
    // Gold/silver gradient
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#d4af37");
    gradient.addColorStop(0.5, "#f5e6a3");
    gradient.addColorStop(1, "#d4af37");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Add texture pattern
    ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const size = Math.random() * 3 + 1;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Add "SCRATCH" text
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.font = "bold 14px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SCRATCH", width / 2, height / 2);
  }

  function scratch(e, canvas, ctx, index) {
    if (revealed[index]) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let x, y;
    if (e.touches) {
      x = (e.touches[0].clientX - rect.left) * scaleX;
      y = (e.touches[0].clientY - rect.top) * scaleY;
    } else {
      x = (e.clientX - rect.left) * scaleX;
      y = (e.clientY - rect.top) * scaleY;
    }

    // Erase in a circular area
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fill();

    // Check if enough is scratched
    checkRevealProgress(canvas, ctx, index);
  }

  function checkRevealProgress(canvas, ctx, index) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let transparent = 0;
    const total = imageData.data.length / 4;

    for (let i = 3; i < imageData.data.length; i += 4) {
      if (imageData.data[i] < 128) transparent++;
    }

    const percentRevealed = transparent / total;

    if (percentRevealed > 0.4 && !revealed[index]) {
      revealCell(index);
    }
  }

  function revealCell(index) {
    if (revealed[index]) return;

    revealed[index] = true;
    const cell = scratchGrid.children[index];
    const canvas = cell.querySelector("canvas");
    const prize = cell.querySelector(".prize");

    // Hide canvas
    canvas.style.opacity = "0";
    prize.classList.add("revealed");

    GD.playSound("click");

    // Check if all revealed
    if (revealed.every((r) => r)) {
      checkWin();
    }
  }

  function revealAll() {
    if (gameEnded) return;

    for (let i = 0; i < 9; i++) {
      revealCell(i);
    }
  }

  function checkWin() {
    if (gameEnded) return;
    gameEnded = true;

    // Count symbols
    const counts = {};
    for (const symbol of grid) {
      counts[symbol] = (counts[symbol] || 0) + 1;
    }

    // Find winning symbol (3 or more)
    let winSymbol = null;
    let winCount = 0;

    for (const [symbol, count] of Object.entries(counts)) {
      if (count >= 3 && (!winSymbol || PRIZE_MULTIPLIERS[symbol] > PRIZE_MULTIPLIERS[winSymbol])) {
        winSymbol = symbol;
        winCount = count;
      }
    }

    // Highlight winning cells
    if (winSymbol) {
      grid.forEach((symbol, i) => {
        if (symbol === winSymbol) {
          scratchGrid.children[i].classList.add("winner");
        }
      });
    }

    setTimeout(() => {
      if (winSymbol) {
        const multiplier = PRIZE_MULTIPLIERS[winSymbol];
        const winAmount = GD.round2(currentCost * multiplier);

        GD.creditWin(winAmount);
        GD.updateStats({ game: "scratch" });

        if (multiplier >= 50) {
          GD.checkAchievement("scratch_jackpot");
          GD.playSound("bigwin");
        } else {
          GD.playSound("win");
        }

        GD.showToast(`Matched ${winCount}× ${winSymbol} for ${GD.formatEuro(winAmount)}!`, "success");
        showResult(true, winAmount);
      } else {
        GD.updateStats({ noWin: true, game: "scratch" });
        GD.playSound("lose");
        showResult(false, 0);
      }
    }, 500);
  }
})();
