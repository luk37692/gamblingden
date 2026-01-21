/**
 * GamblingDen - Enhanced Slot Machine
 * Features: 5 paylines, wild symbols, scatter, free spins, auto-spin
 */
(function () {
  "use strict";

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTANTS
  // ═══════════════════════════════════════════════════════════════════════════
  const SYMBOLS = ["CHERRY", "LEMON", "BELL", "SEVEN", "WILD", "SCATTER"];
  const SYMBOL_TO_EMOJI = {
    CHERRY: "🍒",
    LEMON: "🍋",
    BELL: "🔔",
    SEVEN: "7️⃣",
    WILD: "⭐",
    SCATTER: "💎",
  };
  const PAYTABLE = {
    CHERRY: 2,
    LEMON: 3,
    BELL: 5,
    SEVEN: 10,
    WILD: 20,
    SCATTER: 50,
  };

  // Reel weights: common symbols more frequent, special symbols rare
  const SYMBOL_WEIGHTS = {
    CHERRY: 10,
    LEMON: 8,
    BELL: 6,
    SEVEN: 4,
    WILD: 2,
    SCATTER: 2,
  };

  // Paylines: arrays of [reel0row, reel1row, reel2row] (0=top, 1=center, 2=bottom)
  const PAYLINES = [
    [0, 0, 0], // Line 1: Top row
    [1, 1, 1], // Line 2: Center row
    [2, 2, 2], // Line 3: Bottom row
    [0, 1, 2], // Line 4: Diagonal ↘
    [2, 1, 0], // Line 5: Diagonal ↗
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // DOM REFERENCES
  // ═══════════════════════════════════════════════════════════════════════════
  const balanceAmount = document.getElementById("balance-amount");
  const levelBadge = document.getElementById("level-badge");
  const xpBarFill = document.getElementById("xp-bar-fill");
  const xpText = document.getElementById("xp-text");
  const soundToggle = document.getElementById("sound-toggle");

  const reelEls = [
    document.getElementById("reel-0"),
    document.getElementById("reel-1"),
    document.getElementById("reel-2"),
  ];

  const betSelect = document.getElementById("bet-select");
  const linesSelect = document.getElementById("lines-select");
  const spinBtn = document.getElementById("spin-btn");
  const autoSpinBtn = document.getElementById("auto-spin-btn");
  const autoSpinCount = document.getElementById("auto-spin-count");

  const betPerLineEl = document.getElementById("bet-per-line");
  const activeLinesEl = document.getElementById("active-lines");
  const totalBetEl = document.getElementById("total-bet");
  const lastWinEl = document.getElementById("last-win");

  const freeSpinsBanner = document.getElementById("free-spins-banner");
  const freeSpinsCount = document.getElementById("free-spins-count");

  const paylineDots = document.querySelectorAll(".payline-dot");

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════
  let spinning = false;
  let autoSpinning = false;
  let autoSpinsRemaining = 0;
  let freeSpins = 0;
  let freeSpinMultiplier = 1;

  // Build weighted reel strips
  const REELS = [buildReelStrip(), buildReelStrip(), buildReelStrip()];

  // Current visible grid: 3 reels × 3 rows
  let grid = [
    ["CHERRY", "LEMON", "BELL"],
    ["CHERRY", "LEMON", "BELL"],
    ["CHERRY", "LEMON", "BELL"],
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════
  updateBalanceUI();
  updateSpinAvailability();
  
  // Initialize 3D Scene
  if (typeof Slots3D !== 'undefined') {
    Slots3D.init('slots-canvas-container');
  } else {
    renderGrid(); // Fallback
  }

  spinBtn.addEventListener("click", onSpin);
  autoSpinBtn.addEventListener("click", toggleAutoSpin);
  soundToggle.addEventListener("click", toggleSound);
  betSelect.addEventListener("change", updateUI);
  linesSelect.addEventListener("change", () => {
    updateUI();
    updatePaylineIndicators();
  });
  // ═══════════════════════════════════════════════════════════════════════════
  // UI UPDATES
  // ═══════════════════════════════════════════════════════════════════════════
  function updateUI() {
    updateBalanceUI();
    updateXPUI();
    updateBetUI();
    updateSoundUI();
    updateSpinAvailability();
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

  function updateBetUI() {
    const bet = parseFloat(betSelect.value);
    const lines = parseInt(linesSelect.value);
    const total = GD.round2(bet * lines);

    betPerLineEl.textContent = GD.formatEuro(bet);
    activeLinesEl.textContent = lines;
    totalBetEl.textContent = GD.formatEuro(total);
  }

  function updateLastWin(amount) {
    lastWinEl.textContent = GD.formatEuro(amount);
    if (amount > 0) {
      lastWinEl.classList.add("win");
    }
  }

  function updateSoundUI() {
    document.body.classList.toggle("sound-off", !GD.isSoundEnabled());
  }

  function toggleSound() {
    GD.setSoundEnabled(!GD.isSoundEnabled());
    updateSoundUI();
    if (GD.isSoundEnabled()) GD.playSound("click");
  }

  function updateSpinAvailability() {
    const bet = parseFloat(betSelect.value);
    const lines = parseInt(linesSelect.value);
    const totalBet = bet * lines;
    const canAfford = freeSpins > 0 || GD.getBalance() >= totalBet;

    spinBtn.disabled = spinning || !canAfford;
    betSelect.disabled = spinning || freeSpins > 0;
    linesSelect.disabled = spinning || freeSpins > 0;
  }

  function updatePaylineIndicators() {
    const activeLines = parseInt(linesSelect.value);
    paylineDots.forEach((dot, i) => {
      dot.classList.toggle("active", i < activeLines);
    });
  }

  function updateFreeSpinsBanner() {
    if (freeSpins > 0) {
      freeSpinsBanner.classList.add("active");
      freeSpinsCount.textContent = freeSpins;
    } else {
      freeSpinsBanner.classList.remove("active");
      freeSpinMultiplier = 1;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REEL BUILDING
  // ═══════════════════════════════════════════════════════════════════════════
  function buildReelStrip() {
    const strip = [];
    for (const sym of SYMBOLS) {
      for (let i = 0; i < SYMBOL_WEIGHTS[sym]; i++) {
        strip.push(sym);
      }
    }
    // Fisher-Yates shuffle
    for (let i = strip.length - 1; i > 0; i--) {
      const j = GD.randomInt(0, i);
      [strip[i], strip[j]] = [strip[j], strip[i]];
    }
    return strip;
  }

  function randomizeInitialGrid() {
    for (let r = 0; r < 3; r++) {
      const idx = GD.randomInt(0, REELS[r].length - 1);
      grid[r] = getReelWindow(r, idx);
    }
  }

  function getReelWindow(reelIndex, centerIdx) {
    const reel = REELS[reelIndex];
    const len = reel.length;
    return [
      reel[(centerIdx - 1 + len) % len], // Top
      reel[centerIdx], // Center
      reel[(centerIdx + 1) % len], // Bottom
    ];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDERING
  // ═══════════════════════════════════════════════════════════════════════════
  function renderGrid() {
    for (let r = 0; r < 3; r++) {
      const symbolEls = reelEls[r].querySelectorAll(".symbol");
      for (let row = 0; row < 3; row++) {
        symbolEls[row].textContent = SYMBOL_TO_EMOJI[grid[r][row]];
        symbolEls[row].classList.remove("winning");
      }
    }
  }

  function highlightWinningSymbols(winningPositions) {
    winningPositions.forEach(([reel, row]) => {
      const symbolEls = reelEls[reel].querySelectorAll(".symbol");
      symbolEls[row].classList.add("winning");
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SPIN LOGIC
  // ═══════════════════════════════════════════════════════════════════════════
  async function onSpin() {
    if (spinning) return;

    const bet = parseFloat(betSelect.value);
    const lines = parseInt(linesSelect.value);
    const totalBet = GD.round2(bet * lines);

    // Deduct bet (unless free spin)
    if (freeSpins > 0) {
      freeSpins--;
      updateFreeSpinsBanner();
    } else {
      if (!GD.placeBet(totalBet)) {
        GD.showToast("Insufficient balance!", "error");
        return;
      }
    }

    spinning = true;
    updateSpinAvailability();
    GD.playSound("spin");

    // Clear previous win highlights
    document.querySelectorAll(".symbol.winning").forEach((el) => {
      el.classList.remove("winning");
    });

    // Generate new stops
    const stops = REELS.map((reel) => GD.randomInt(0, reel.length - 1));

    // Animate reels with stagger
    if (typeof Slots3D !== 'undefined') {
       await Slots3D.spinTo(stops, REELS);
    } else {
       // Old 2D Animation Fallback
       const durations = [800, 1000, 1200];
       await animateReels(stops, durations);
    }

    // Update grid with final results
    for (let r = 0; r < 3; r++) {
      grid[r] = getReelWindow(r, stops[r]);
    }
    // renderGrid(); // 3D doesn't need this, but we might want to keep it to update invisible DOM for accessibility/logic if needed

    // Evaluate wins
    const { totalWin, winningPositions, scatterCount } = evaluateWins(bet, lines);

    // Handle results
    if (totalWin > 0) {
      const finalWin = GD.round2(totalWin * freeSpinMultiplier);
      GD.creditWin(finalWin);
      updateLastWin(finalWin);
      highlightWinningSymbols(winningPositions);
      GD.updateStats({ game: "slots" });

      if (finalWin >= bet * 10) {
        GD.playSound("bigwin");
        GD.showToast(`🎉 BIG WIN: ${GD.formatEuro(finalWin)}!`, "success", 4000);
        if (finalWin >= bet * 20) {
          GD.checkAchievement("jackpot");
        }
      } else {
        GD.playSound("win");
        GD.showToast(`Won ${GD.formatEuro(finalWin)}!`, "success");
      }
    } else {
      GD.updateStats({ noWin: true, game: "slots" });
      GD.playSound("lose");
    }

    // Check for free spins trigger
    if (scatterCount >= 3 && freeSpins === 0) {
      triggerFreeSpins();
    }

    spinning = false;
    updateSpinAvailability();

    // Continue auto-spin if active
    if (autoSpinning && autoSpinsRemaining > 0) {
      autoSpinsRemaining--;
      updateAutoSpinUI();
      if (autoSpinsRemaining > 0 && GD.getBalance() >= totalBet) {
        setTimeout(onSpin, 600);
      } else {
        stopAutoSpin();
      }
    }
  }

  async function animateReels(stops, durations) {
    // Start all reel animations
    const promises = reelEls.map((reel, i) => {
      return new Promise((resolve) => {
        const symbolEls = reel.querySelectorAll(".symbol");
        const duration = durations[i];
        const startTime = performance.now();
        
        // Add blurring effect
        reel.classList.add("spinning");

        // Rapidly change symbols to simulate spinning
        const interval = setInterval(() => {
          for (let row = 0; row < 3; row++) {
            const randomSymbol = SYMBOLS[GD.randomInt(0, SYMBOLS.length - 1)];
            symbolEls[row].textContent = SYMBOL_TO_EMOJI[randomSymbol];
          }
        }, 50); // Change every 50ms

        // Stop after duration
        setTimeout(() => {
          clearInterval(interval);
          reel.classList.remove("spinning");
          
          // Set final symbols
          grid[i] = getReelWindow(i, stops[i]);
          for (let row = 0; row < 3; row++) {
            symbolEls[row].textContent = SYMBOL_TO_EMOJI[grid[i][row]];
          }

          // Add landing bounce effect
          reel.classList.add("bounce");
          setTimeout(() => reel.classList.remove("bounce"), 300);

          GD.playSound("click");
          resolve();
        }, duration);
      });
    });

    await Promise.all(promises);
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WIN EVALUATION
  // ═══════════════════════════════════════════════════════════════════════════
  function evaluateWins(betPerLine, activeLines) {
    let totalWin = 0;
    const winningPositions = [];
    let scatterCount = 0;

    // Count scatters across entire grid
    for (let r = 0; r < 3; r++) {
      for (let row = 0; row < 3; row++) {
        if (grid[r][row] === "SCATTER") {
          scatterCount++;
        }
      }
    }

    // Check each active payline
    for (let lineIdx = 0; lineIdx < activeLines; lineIdx++) {
      const payline = PAYLINES[lineIdx];
      const lineSymbols = payline.map((row, reelIdx) => grid[reelIdx][row]);

      const { win, matchedSymbol } = evaluateLine(lineSymbols);

      if (win > 0) {
        totalWin += win * betPerLine;
        // Track winning positions for highlighting
        payline.forEach((row, reelIdx) => {
          winningPositions.push([reelIdx, row]);
        });
      }
    }

    return { totalWin: GD.round2(totalWin), winningPositions, scatterCount };
  }

  function evaluateLine([a, b, c]) {
    // Wild substitution logic
    const isWild = (s) => s === "WILD";
    const getEffective = (s1, s2, s3) => {
      // Find the non-wild symbol (if any)
      if (!isWild(s1)) return s1;
      if (!isWild(s2)) return s2;
      if (!isWild(s3)) return s3;
      return "WILD"; // All wilds
    };

    // Ignore scatters in line evaluation (they pay separately via free spins)
    if (a === "SCATTER" || b === "SCATTER" || c === "SCATTER") {
      // Check if we still have a 3-of-a-kind without scatters
      const nonScatter = [a, b, c].filter((s) => s !== "SCATTER");
      if (nonScatter.length < 3) return { win: 0, matchedSymbol: null };
    }

    const target = getEffective(a, b, c);

    // Check if all three match (or are wild)
    const matches =
      (a === target || isWild(a)) &&
      (b === target || isWild(b)) &&
      (c === target || isWild(c));

    if (matches && target !== "SCATTER") {
      return { win: PAYTABLE[target] || 0, matchedSymbol: target };
    }

    return { win: 0, matchedSymbol: null };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FREE SPINS
  // ═══════════════════════════════════════════════════════════════════════════
  function triggerFreeSpins() {
    freeSpins = 5;
    freeSpinMultiplier = 2;
    updateFreeSpinsBanner();

    GD.playSound("bigwin");
    GD.showToast("💎 FREE SPINS! 5 spins with 2× multiplier!", "success", 5000);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTO-SPIN
  // ═══════════════════════════════════════════════════════════════════════════
  function toggleAutoSpin() {
    if (autoSpinning) {
      stopAutoSpin();
    } else {
      startAutoSpin();
    }
  }

  function startAutoSpin() {
    autoSpinning = true;
    autoSpinsRemaining = 10;
    autoSpinBtn.classList.add("active");
    updateAutoSpinUI();
    GD.playSound("click");

    if (!spinning) {
      onSpin();
    }
  }

  function stopAutoSpin() {
    autoSpinning = false;
    autoSpinsRemaining = 0;
    autoSpinBtn.classList.remove("active");
    updateAutoSpinUI();
  }

  function updateAutoSpinUI() {
    autoSpinCount.textContent = autoSpinning ? `(${autoSpinsRemaining})` : "";
  }
})();
