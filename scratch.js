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

  function checkWin() {
    if (gameEnded) return;
    gameEnded = true;

    // Define win lines (indices)
    // 0 1 2
    // 3 4 5
    // 6 7 8
    const lines = [
      [0, 1, 2], // Rows
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6], // Cols
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8], // Diagonals
      [2, 4, 6],
    ];

    let winningLine = null;
    let winSymbol = null;

    // Check for 3 matching symbols in a line
    for (const line of lines) {
      const [a, b, c] = line;
      const sA = grid[a];
      const sB = grid[b];
      const sC = grid[c];

      if (sA === sB && sB === sC) {
        // Found a win!
        // If multiple wins, take the highest value (rare)
        if (!winSymbol || PRIZE_MULTIPLIERS[sA] > PRIZE_MULTIPLIERS[winSymbol]) {
          winSymbol = sA;
          winningLine = line;
        }
      }
    }

    // Highlight winning cells
    if (winningLine) {
      winningLine.forEach((index) => {
        scratchGrid.children[index].classList.add("winner");
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

        GD.showToast(`Line Match! ${winSymbol} for ${GD.formatEuro(winAmount)}!`, "success");
        showResult(true, winAmount);
      } else {
        GD.updateStats({ noWin: true, game: "scratch" });
        GD.playSound("lose");
        showResult(false, 0);
      }
    }, 500);
  }
})();
