(function () {
  "use strict";

  const SYMBOLS = ["CHERRY", "LEMON", "BELL", "SEVEN", "WILD"];
  const SYMBOL_TO_EMOJI = {
    CHERRY: "🍒",
    LEMON: "🍋",
    BELL: "🔔",
    SEVEN: "7️⃣",
    WILD: "⭐",
  };
  const PAYTABLE = { CHERRY: 2, LEMON: 3, BELL: 5, SEVEN: 10, WILD: 20 };

  // DOM references
  const balanceEl = document.getElementById("balance");
  const lastWinEl = document.getElementById("lastWin");
  const messageEl = document.getElementById("message");
  const betSelect = document.getElementById("betAmount");
  const spinButton = document.getElementById("spinButton");
  const resetButton = document.getElementById("resetButton");
  const reelEls = [
    document.getElementById("reel-0"),
    document.getElementById("reel-1"),
    document.getElementById("reel-2"),
  ];

  // State
  let balance = loadBalance();

  // Build weighted reel strips (24 stops): 8/7/5/3/1 composition
  const REELS = [buildReelStrip(), buildReelStrip(), buildReelStrip()];

  // Initialize UI
  updateBalanceUI();
  updateLastWin(0);
  randomizeInitialFaces();
  updateSpinAvailability();

  // Events
  spinButton.addEventListener("click", onSpin);
  resetButton.addEventListener("click", onResetBalance);
  betSelect.addEventListener("change", updateSpinAvailability);

  function onSpin() {
    clearMessage();
    const bet = parseFloat(betSelect.value);
    if (!Number.isFinite(bet) || bet <= 0) return;
    if (balance < bet) {
      showMessage("Insufficient funds", true);
      return;
    }

    // Lock inputs and pre-deduct bet
    setControlsEnabled(false);
    balance = round2(balance - bet);
    updateBalanceUI();

    // Random stops per reel represent the CENTER row
    const stops = REELS.map((reel) => randomInt(0, reel.length - 1));
    const centerLine = stops.map((idx, r) => REELS[r][idx]);

    // Compute top/middle/bottom symbols for UI fill
    const tmb = [0, 1, 2].map((r) => {
      const idx = stops[r];
      const reel = REELS[r];
      const top = reel[(idx - 1 + reel.length) % reel.length];
      const mid = reel[idx];
      const bot = reel[(idx + 1) % reel.length];
      return [top, mid, bot];
    });

    // Start animations with staggered durations per reel
    const durations = [900, 1100, 1300];
    reelEls.forEach((reelEl, i) => {
      reelEl.style.setProperty("--spin-duration", `${durations[i]}ms`);
      reelEl.classList.add("spinning");
    });

    // Schedule reel face updates and stop animations
    reelEls.forEach((reelEl, i) => {
      setTimeout(() => {
        setReelFaces(i, tmb[i]);
        reelEl.classList.remove("spinning");
      }, durations[i]);
    });

    // Finalize after last reel stops
    setTimeout(() => {
      const mult = evaluateCenterLine(centerLine);
      const win = round2(bet * mult);
      if (win > 0) {
        flashWin();
        showMessage(`You won ${formatEuro(win)}!`);
      } else {
        showMessage("No win this time.");
      }
      balance = round2(balance + win);
      saveBalance(balance);
      updateBalanceUI();
      updateLastWin(win);
      setControlsEnabled(true);
      updateSpinAvailability();
    }, Math.max(...durations) + 20);
  }

  function evaluateCenterLine([a, b, c]) {
    // Wild substitutes to complete exactly a 3-of-a-kind
    const target = a === "WILD" ? (b === "WILD" ? c : b) : a;
    if (
      (a === target || a === "WILD") &&
      (b === target || b === "WILD") &&
      (c === target || c === "WILD")
    ) {
      return PAYTABLE[target === "WILD" ? "WILD" : target] || 0;
    }
    return 0;
  }

  function setReelFaces(reelIndex, [top, mid, bot]) {
    const reelEl = reelEls[reelIndex];
    const cells = reelEl.querySelectorAll(".cell");
    if (cells.length < 3) return;
    cells[0].textContent = SYMBOL_TO_EMOJI[top];
    cells[1].textContent = SYMBOL_TO_EMOJI[mid];
    cells[2].textContent = SYMBOL_TO_EMOJI[bot];
  }

  function flashWin() {
    // Highlight the center row across reels briefly
    reelEls.forEach((reelEl) => {
      const mid = reelEl.querySelector('.cell.center');
      if (!mid) return;
      mid.classList.remove('win-flash');
      // restart animation
      void mid.offsetWidth; // reflow
      mid.classList.add('win-flash');
    });
  }

  function randomizeInitialFaces() {
    for (let r = 0; r < 3; r++) {
      const idx = randomInt(0, REELS[r].length - 1);
      const reel = REELS[r];
      const t = reel[(idx - 1 + reel.length) % reel.length];
      const m = reel[idx];
      const b = reel[(idx + 1) % reel.length];
      setReelFaces(r, [t, m, b]);
    }
  }

  function updateBalanceUI() {
    balanceEl.textContent = `Balance: ${formatEuro(balance)}`;
  }
  function updateLastWin(amount) {
    lastWinEl.textContent = `Last win: ${formatEuro(amount)}`;
  }
  function showMessage(text, isError = false) {
    messageEl.textContent = text;
    messageEl.className = `message ${isError ? "error" : "success"}`;
  }
  function clearMessage() {
    messageEl.textContent = "";
    messageEl.className = "message";
  }

  function updateSpinAvailability() {
    const bet = parseFloat(betSelect.value);
    spinButton.disabled = !Number.isFinite(bet) || bet <= 0 || balance < bet;
  }
  function setControlsEnabled(enabled) {
    spinButton.disabled = !enabled || balance < parseFloat(betSelect.value);
    betSelect.disabled = !enabled;
    resetButton.disabled = !enabled;
  }

  function onResetBalance() {
    balance = 10.0;
    saveBalance(balance);
    updateBalanceUI();
    updateLastWin(0);
    clearMessage();
    updateSpinAvailability();
  }

  // --- Persistence ---
  function loadBalance() {
    const saved = Number(localStorage.getItem("gd_balance"));
    return Number.isFinite(saved) && saved > 0 ? round2(saved) : 10.0;
  }
  function saveBalance(value) {
    localStorage.setItem("gd_balance", round2(value).toFixed(2));
  }

  // --- RNG helpers ---
  function randomInt(min, max) {
    // inclusive of both min and max
    const range = max - min + 1;
    if (range <= 0) return min;
    const maxUnbiased = Math.floor(0xffffffff / range) * range - 1;
    let x = 0xffffffff;
    const arr = new Uint32Array(1);
    while (x > maxUnbiased) {
      crypto.getRandomValues(arr);
      x = arr[0];
    }
    return min + (x % range);
  }

  function buildReelStrip() {
    const counts = { CHERRY: 8, LEMON: 7, BELL: 5, SEVEN: 3, WILD: 1 };
    const strip = [];
    for (const sym of SYMBOLS) {
      for (let i = 0; i < counts[sym]; i++) strip.push(sym);
    }
    // Fisher-Yates shuffle with crypto
    for (let i = strip.length - 1; i > 0; i--) {
      const j = randomInt(0, i);
      const t = strip[i];
      strip[i] = strip[j];
      strip[j] = t;
    }
    return strip;
  }

  // --- Utils ---
  function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
  function formatEuro(n) { return `€${round2(n).toFixed(2)}`; }
})();


