/**
 * GamblingDen Shared Utilities
 * Core systems: Balance, XP, Sound, Achievements, Storage
 */
(function (global) {
  "use strict";

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTANTS
  // ═══════════════════════════════════════════════════════════════════════════
  const STORAGE_KEYS = {
    BALANCE: "gd_balance",
    XP: "gd_xp",
    LEVEL: "gd_level",
    ACHIEVEMENTS: "gd_achievements",
    STATS: "gd_stats",
    DAILY_LAST: "gd_daily_last",
    SETTINGS: "gd_settings",
  };

  const XP_PER_EURO_WAGERED = 10; // 10 XP per €1 wagered
  const STARTING_BALANCE = 100.0;

  // Level thresholds (cumulative XP needed)
  const LEVEL_THRESHOLDS = [
    0, 100, 250, 500, 800, 1200, 1700, 2300, 3000, 4000, 5200, 6600, 8200,
    10000, 12500, 15500, 19000, 23000, 28000, 34000, 41000, 49000, 58000, 68000,
    80000, 95000, 112000, 132000, 155000, 182000, 215000, 255000, 302000,
    358000, 425000, 505000, 600000, 715000, 850000, 1010000, 1200000, 1430000,
    1700000, 2020000, 2400000, 2850000, 3400000, 4050000, 4820000, 5750000,
  ];

  // Achievement definitions
  const ACHIEVEMENTS = {
    first_spin: {
      name: "First Timer",
      desc: "Place your first bet",
      reward: 5,
    },
    first_win: { name: "Winner!", desc: "Win for the first time", reward: 10 },
    high_roller: {
      name: "High Roller",
      desc: "Place a bet of €10 or more",
      reward: 25,
    },
    jackpot: {
      name: "Jackpot!",
      desc: "Hit a 20× or higher multiplier",
      reward: 100,
    },
    lucky_streak: {
      name: "Lucky Streak",
      desc: "Win 5 times in a row",
      reward: 50,
    },
    night_owl: {
      name: "Night Owl",
      desc: "Play between midnight and 4am",
      reward: 15,
    },
    marathon: {
      name: "Marathon",
      desc: "Play for 30 minutes in one session",
      reward: 30,
    },
    diversified: {
      name: "Diversified",
      desc: "Play all available games",
      reward: 40,
    },
    comeback: {
      name: "Comeback Kid",
      desc: "Recover from under €10 to over €100",
      reward: 75,
    },
    whale: {
      name: "Whale",
      desc: "Accumulate €1000 total winnings",
      reward: 200,
    },
    level_10: { name: "Rising Star", desc: "Reach level 10", reward: 50 },
    level_25: { name: "Veteran", desc: "Reach level 25", reward: 150 },
    level_50: { name: "Legend", desc: "Reach level 50", reward: 500 },
    daily_streak_7: {
      name: "Dedicated",
      desc: "Claim daily bonus 7 days in a row",
      reward: 100,
    },
    blackjack_21: {
      name: "Blackjack!",
      desc: "Get a natural blackjack",
      reward: 25,
    },
    crash_10x: {
      name: "Diamond Hands",
      desc: "Cash out at 10× or higher in Crash",
      reward: 50,
    },
    scratch_jackpot: {
      name: "Golden Ticket",
      desc: "Win the top prize on scratch cards",
      reward: 75,
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════
  const listeners = {};

  function on(event, callback) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(callback);
    return () => off(event, callback);
  }

  function off(event, callback) {
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter((cb) => cb !== callback);
  }

  function emit(event, data) {
    if (!listeners[event]) return;
    listeners[event].forEach((cb) => cb(data));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════
  function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function formatEuro(n) {
    return `€${round2(n).toFixed(2)}`;
  }

  function formatCompact(n) {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  }

  function randomInt(min, max) {
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

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STORAGE
  // ═══════════════════════════════════════════════════════════════════════════
  function loadJSON(key, defaultValue) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      console.warn("Storage unavailable");
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BALANCE MANAGER
  // ═══════════════════════════════════════════════════════════════════════════
  let _balance = loadBalance();

  function loadBalance() {
    const saved = Number(localStorage.getItem(STORAGE_KEYS.BALANCE));
    return Number.isFinite(saved) && saved >= 0
      ? round2(saved)
      : STARTING_BALANCE;
  }

  function saveBalance(value) {
    localStorage.setItem(STORAGE_KEYS.BALANCE, round2(value).toFixed(2));
  }

  function getBalance() {
    return _balance;
  }

  function setBalance(value) {
    _balance = round2(Math.max(0, value));
    saveBalance(_balance);
    emit("balance:change", _balance);
  }

  function adjustBalance(delta) {
    setBalance(_balance + delta);
    return _balance;
  }

  function placeBet(amount) {
    if (amount <= 0 || amount > _balance) return false;
    adjustBalance(-amount);
    addXP(amount * XP_PER_EURO_WAGERED);
    updateStats({ totalWagered: amount });
    emit("bet:placed", amount);
    checkAchievement("first_spin");
    if (amount >= 10) checkAchievement("high_roller");
    return true;
  }

  function creditWin(amount) {
    if (amount <= 0) return;
    adjustBalance(amount);
    updateStats({ totalWon: amount });
    emit("win", amount);
    if (_balance >= 100) {
      const stats = getStats();
      if (stats.lowestBalance && stats.lowestBalance < 10) {
        checkAchievement("comeback");
      }
    }
    checkAchievement("first_win");
  }

  function resetBalance() {
    setBalance(STARTING_BALANCE);
    emit("balance:reset");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // XP & LEVELING
  // ═══════════════════════════════════════════════════════════════════════════
  let _xp = Number(localStorage.getItem(STORAGE_KEYS.XP)) || 0;
  let _level = Number(localStorage.getItem(STORAGE_KEYS.LEVEL)) || 1;

  function getXP() {
    return _xp;
  }

  function getLevel() {
    return _level;
  }

  function getLevelProgress() {
    const currentThreshold = LEVEL_THRESHOLDS[_level - 1] || 0;
    const nextThreshold =
      LEVEL_THRESHOLDS[_level] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
    const progress = _xp - currentThreshold;
    const needed = nextThreshold - currentThreshold;
    return {
      progress,
      needed,
      percent: clamp((progress / needed) * 100, 0, 100),
    };
  }

  function addXP(amount) {
    if (amount <= 0) return;
    _xp += Math.floor(amount);
    localStorage.setItem(STORAGE_KEYS.XP, _xp);

    // Check for level ups
    while (
      _level < LEVEL_THRESHOLDS.length &&
      _xp >= LEVEL_THRESHOLDS[_level]
    ) {
      _level++;
      localStorage.setItem(STORAGE_KEYS.LEVEL, _level);
      emit("level:up", _level);
      playSound("levelup");

      // Level achievements
      if (_level === 10) checkAchievement("level_10");
      if (_level === 25) checkAchievement("level_25");
      if (_level === 50) checkAchievement("level_50");
    }

    emit("xp:change", { xp: _xp, level: _level });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACHIEVEMENTS
  // ═══════════════════════════════════════════════════════════════════════════
  let _unlockedAchievements = loadJSON(STORAGE_KEYS.ACHIEVEMENTS, []);

  function getUnlockedAchievements() {
    return [..._unlockedAchievements];
  }

  function isAchievementUnlocked(id) {
    return _unlockedAchievements.includes(id);
  }

  function checkAchievement(id) {
    if (_unlockedAchievements.includes(id)) return false;
    if (!ACHIEVEMENTS[id]) return false;

    _unlockedAchievements.push(id);
    saveJSON(STORAGE_KEYS.ACHIEVEMENTS, _unlockedAchievements);

    const achievement = ACHIEVEMENTS[id];
    adjustBalance(achievement.reward);
    emit("achievement:unlock", { id, ...achievement });
    playSound("achievement");

    return true;
  }

  function getAllAchievements() {
    return Object.entries(ACHIEVEMENTS).map(([id, data]) => ({
      id,
      ...data,
      unlocked: _unlockedAchievements.includes(id),
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATISTICS
  // ═══════════════════════════════════════════════════════════════════════════
  const DEFAULT_STATS = {
    totalWagered: 0,
    totalWon: 0,
    biggestWin: 0,
    gamesPlayed: { slots: 0, blackjack: 0, crash: 0, scratch: 0 },
    sessionStart: Date.now(),
    lowestBalance: STARTING_BALANCE,
    consecutiveWins: 0,
    dailyStreak: 0,
  };

  let _stats = loadJSON(STORAGE_KEYS.STATS, DEFAULT_STATS);

  function getStats() {
    return { ..._stats };
  }

  function updateStats(updates) {
    if (updates.totalWagered) {
      _stats.totalWagered = round2(_stats.totalWagered + updates.totalWagered);
    }
    if (updates.totalWon) {
      _stats.totalWon = round2(_stats.totalWon + updates.totalWon);
      if (updates.totalWon > _stats.biggestWin) {
        _stats.biggestWin = round2(updates.totalWon);
      }
      _stats.consecutiveWins++;
      if (_stats.consecutiveWins >= 5) checkAchievement("lucky_streak");
      if (_stats.totalWon >= 1000) checkAchievement("whale");
    }
    if (updates.noWin) {
      _stats.consecutiveWins = 0;
    }
    if (updates.game) {
      _stats.gamesPlayed[updates.game] =
        (_stats.gamesPlayed[updates.game] || 0) + 1;
    }

    // Track lowest balance
    const currentBalance = getBalance();
    if (currentBalance < _stats.lowestBalance) {
      _stats.lowestBalance = currentBalance;
    }

    saveJSON(STORAGE_KEYS.STATS, _stats);
    emit("stats:update", _stats);
  }

  function checkTimeAchievements() {
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 4) checkAchievement("night_owl");

    const sessionMinutes = (Date.now() - _stats.sessionStart) / 60000;
    if (sessionMinutes >= 30) checkAchievement("marathon");
  }

  // Check time achievements periodically
  setInterval(checkTimeAchievements, 60000);

  // ═══════════════════════════════════════════════════════════════════════════
  // DAILY BONUS
  // ═══════════════════════════════════════════════════════════════════════════
  function canClaimDailyBonus() {
    const lastClaim = localStorage.getItem(STORAGE_KEYS.DAILY_LAST);
    if (!lastClaim) return true;

    const lastDate = new Date(lastClaim);
    const now = new Date();
    return (
      now.getFullYear() !== lastDate.getFullYear() ||
      now.getMonth() !== lastDate.getMonth() ||
      now.getDate() !== lastDate.getDate()
    );
  }

  function claimDailyBonus() {
    if (!canClaimDailyBonus()) return null;

    localStorage.setItem(STORAGE_KEYS.DAILY_LAST, new Date().toISOString());

    // Check streak
    const lastClaim = localStorage.getItem(STORAGE_KEYS.DAILY_LAST);
    if (lastClaim) {
      const lastDate = new Date(lastClaim);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (
        lastDate.getFullYear() === yesterday.getFullYear() &&
        lastDate.getMonth() === yesterday.getMonth() &&
        lastDate.getDate() === yesterday.getDate()
      ) {
        _stats.dailyStreak++;
        if (_stats.dailyStreak >= 7) checkAchievement("daily_streak_7");
      } else {
        _stats.dailyStreak = 1;
      }
      saveJSON(STORAGE_KEYS.STATS, _stats);
    }

    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SOUND SYSTEM (Web Audio API)
  // ═══════════════════════════════════════════════════════════════════════════
  let audioCtx = null;
  let _soundEnabled = loadJSON(STORAGE_KEYS.SETTINGS, { sound: true }).sound;

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    return audioCtx;
  }

  // Resume context on user interaction if needed
  function resumeAudioContext() {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  document.addEventListener('click', () => {
    initAudio(); // Ensure created on first click if not already
    resumeAudioContext();
  }, { once: false, passive: true });

  document.addEventListener('keydown', () => {
     initAudio();
     resumeAudioContext();
  }, { once: false, passive: true });

  function setSoundEnabled(enabled) {
    _soundEnabled = !!enabled;
    saveJSON(STORAGE_KEYS.SETTINGS, { sound: _soundEnabled });
    if (_soundEnabled) resumeAudioContext();
  }

  function isSoundEnabled() {
    return _soundEnabled;
  }

  function playSound(type) {
    if (!_soundEnabled) return;

    try {
      const ctx = initAudio();
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume();

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      const now = ctx.currentTime;

      switch (type) {
        case "spin":
          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(200, now);
          oscillator.frequency.exponentialRampToValueAtTime(400, now + 0.1);
          gainNode.gain.setValueAtTime(0.15, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
          oscillator.start(now);
          oscillator.stop(now + 0.15);
          break;

        case "win":
          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(523, now); // C5
          gainNode.gain.setValueAtTime(0.2, now);
          oscillator.frequency.setValueAtTime(659, now + 0.1); // E5
          oscillator.frequency.setValueAtTime(784, now + 0.2); // G5
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
          oscillator.start(now);
          oscillator.stop(now + 0.4);
          break;

        case "bigwin":
          playChord([523, 659, 784, 1047], 0.6); // C major with octave
          break;

        case "lose":
          oscillator.type = "sawtooth";
          oscillator.frequency.setValueAtTime(200, now);
          oscillator.frequency.exponentialRampToValueAtTime(100, now + 0.2);
          gainNode.gain.setValueAtTime(0.08, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
          oscillator.start(now);
          oscillator.stop(now + 0.25);
          break;

        case "click":
          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(800, now);
          gainNode.gain.setValueAtTime(0.1, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
          oscillator.start(now);
          oscillator.stop(now + 0.05);
          break;

        case "levelup":
          playArpeggio([523, 659, 784, 1047, 1319], 0.08); // C E G C E
          break;

        case "achievement":
          playArpeggio([784, 988, 1175, 1568], 0.1); // G B D G
          break;

        case "countdown":
          oscillator.type = "square";
          oscillator.frequency.setValueAtTime(440, now);
          gainNode.gain.setValueAtTime(0.1, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
          oscillator.start(now);
          oscillator.stop(now + 0.1);
          break;

        case "cashout":
          oscillator.type = "triangle";
          oscillator.frequency.setValueAtTime(600, now);
          oscillator.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
          gainNode.gain.setValueAtTime(0.2, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
          oscillator.start(now);
          oscillator.stop(now + 0.2);
          break;

        default:
          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(440, now);
          gainNode.gain.setValueAtTime(0.1, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
          oscillator.start(now);
          oscillator.stop(now + 0.1);
      }
    } catch (e) {
      console.warn("Sound playback failed:", e);
    }
  }

  function playChord(frequencies, duration) {
    if (!_soundEnabled) return;
    try {
      const ctx = initAudio();
      const now = ctx.currentTime;
      frequencies.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
        osc.start(now);
        osc.stop(now + duration);
      });
    } catch (e) {
      console.warn("Chord playback failed:", e);
    }
  }

  function playArpeggio(frequencies, noteLength) {
    if (!_soundEnabled) return;
    try {
      const ctx = initAudio();
      const now = ctx.currentTime;
      frequencies.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + i * noteLength);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.15, now + i * noteLength);
        gain.gain.exponentialRampToValueAtTime(
          0.01,
          now + (i + 1) * noteLength + 0.1
        );
        osc.start(now + i * noteLength);
        osc.stop(now + (i + 1) * noteLength + 0.15);
      });
    } catch (e) {
      console.warn("Arpeggio playback failed:", e);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UI HELPERS
  // ═══════════════════════════════════════════════════════════════════════════
  function showToast(message, type = "info", duration = 3000) {
    const container =
      document.getElementById("toast-container") || createToastContainer();

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-msg">${message}</span>`;

    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => toast.classList.add("show"));

    setTimeout(() => {
      toast.classList.remove("show");
      toast.addEventListener("transitionend", () => toast.remove());
    }, duration);
  }

  function createToastContainer() {
    const container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
    return container;
  }

  function showAchievementPopup(achievement) {
    const popup = document.createElement("div");
    popup.className = "achievement-popup";
    popup.innerHTML = `
      <div class="achievement-icon">🏆</div>
      <div class="achievement-content">
        <div class="achievement-title">${achievement.name}</div>
        <div class="achievement-desc">${achievement.desc}</div>
        <div class="achievement-reward">+${formatEuro(achievement.reward)}</div>
      </div>
    `;
    document.body.appendChild(popup);

    requestAnimationFrame(() => popup.classList.add("show"));

    setTimeout(() => {
      popup.classList.remove("show");
      popup.addEventListener("transitionend", () => popup.remove());
    }, 4000);
  }

  // Listen for achievements
  on("achievement:unlock", showAchievementPopup);

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════════════════
  global.GD = {
    // Events
    on,
    off,
    emit,

    // Balance
    getBalance,
    setBalance,
    adjustBalance,
    placeBet,
    creditWin,
    resetBalance,
    formatEuro,
    formatCompact,

    // XP & Leveling
    getXP,
    getLevel,
    getLevelProgress,
    addXP,

    // Achievements
    getUnlockedAchievements,
    isAchievementUnlocked,
    checkAchievement,
    getAllAchievements,

    // Stats
    getStats,
    updateStats,

    // Daily Bonus
    canClaimDailyBonus,
    claimDailyBonus,

    // Sound
    playSound,
    setSoundEnabled,
    isSoundEnabled,

    // UI
    showToast,

    // Utils
    round2,
    randomInt,
    clamp,
  };
})(window);
