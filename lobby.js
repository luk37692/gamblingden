/**
 * GamblingDen Lobby
 * Initializes global UI, stats display, achievements, and daily bonus wheel
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
  const dailyBonusBtn = document.getElementById("daily-bonus-btn");
  const bonusPing = document.getElementById("bonus-ping");
  const dailyModal = document.getElementById("daily-modal");
  const dailyModalClose = document.getElementById("daily-modal-close");
  const spinWheelBtn = document.getElementById("spin-wheel-btn");
  const bonusWheel = document.getElementById("bonus-wheel");
  const dailyStatus = document.getElementById("daily-status");
  const achievementsGrid = document.getElementById("achievements-grid");

  // Stats
  const statWagered = document.getElementById("stat-wagered");
  const statWon = document.getElementById("stat-won");
  const statBiggest = document.getElementById("stat-biggest");
  const statAchievements = document.getElementById("stat-achievements");

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════
  updateBalanceUI();
  updateXPUI();
  updateSoundUI();
  updateStats();
  renderAchievements();
  checkDailyBonus();
  // initParticles();

  // Event listeners
  GD.on("balance:change", updateBalanceUI);
  GD.on("xp:change", updateXPUI);
  GD.on("level:up", onLevelUp);
  GD.on("stats:update", updateStats);

  soundToggle.addEventListener("click", toggleSound);
  dailyBonusBtn.addEventListener("click", openDailyModal);
  dailyModalClose.addEventListener("click", closeDailyModal);
  dailyModal.addEventListener("click", (e) => {
    if (e.target === dailyModal) closeDailyModal();
  });
  spinWheelBtn.addEventListener("click", spinWheel);

  // Game card hover sounds
  document.querySelectorAll(".game-card").forEach((card) => {
    card.addEventListener("mouseenter", () => GD.playSound("click"));
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // UI UPDATES
  // ═══════════════════════════════════════════════════════════════════════════
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

  function onLevelUp(level) {
    GD.showToast(`🎉 Level Up! You're now level ${level}`, "success", 4000);
    levelBadge.classList.add("level-up-flash");
    setTimeout(() => levelBadge.classList.remove("level-up-flash"), 600);
  }

  function updateSoundUI() {
    document.body.classList.toggle("sound-off", !GD.isSoundEnabled());
  }

  function toggleSound() {
    GD.setSoundEnabled(!GD.isSoundEnabled());
    updateSoundUI();
    if (GD.isSoundEnabled()) GD.playSound("click");
  }

  function updateStats() {
    const stats = GD.getStats();
    statWagered.textContent = GD.formatEuro(stats.totalWagered);
    statWon.textContent = GD.formatEuro(stats.totalWon);
    statBiggest.textContent = GD.formatEuro(stats.biggestWin);

    const achievements = GD.getAllAchievements();
    const unlocked = achievements.filter((a) => a.unlocked).length;
    statAchievements.textContent = `${unlocked} / ${achievements.length}`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACHIEVEMENTS
  // ═══════════════════════════════════════════════════════════════════════════
  function renderAchievements() {
    const achievements = GD.getAllAchievements();
    achievementsGrid.innerHTML = achievements
      .map(
        (a) => `
      <div class="achievement-card ${a.unlocked ? "unlocked" : "locked"}">
        <div class="achievement-icon">${a.unlocked ? "🏆" : "🔒"}</div>
        <div class="achievement-info">
          <div class="achievement-name">${a.name}</div>
          <div class="achievement-desc">${a.desc}</div>
        </div>
        <div class="achievement-reward">${a.unlocked ? "✓" : `+${GD.formatEuro(a.reward)}`}</div>
      </div>
    `
      )
      .join("");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DAILY BONUS
  // ═══════════════════════════════════════════════════════════════════════════
  let wheelSpinning = false;
  const PRIZES = [10, 25, 50, 15, 100, 20, 35, 75];
  const SEGMENT_ANGLE = 360 / PRIZES.length;

  function checkDailyBonus() {
    const canClaim = GD.canClaimDailyBonus();
    bonusPing.style.display = canClaim ? "block" : "none";
    spinWheelBtn.disabled = !canClaim;
    dailyStatus.textContent = canClaim
      ? "Spin to claim your daily bonus!"
      : "Come back tomorrow for another spin!";
  }

  function openDailyModal() {
    dailyModal.classList.add("open");
    GD.playSound("click");
  }

  function closeDailyModal() {
    dailyModal.classList.remove("open");
  }

  function spinWheel() {
    if (wheelSpinning || !GD.canClaimDailyBonus()) return;

    wheelSpinning = true;
    spinWheelBtn.disabled = true;

    // Pick random prize
    const prizeIndex = GD.randomInt(0, PRIZES.length - 1);
    const prize = PRIZES[prizeIndex];

    // Calculate final rotation (5 full spins + landing on prize)
    const baseRotation = 360 * 5;
    const prizeAngle = prizeIndex * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
    const finalRotation = baseRotation + (360 - prizeAngle);

    bonusWheel.style.transition = "transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)";
    bonusWheel.style.transform = `rotate(${finalRotation}deg)`;

    GD.playSound("spin");

    setTimeout(() => {
      GD.claimDailyBonus();
      GD.adjustBalance(prize);
      GD.playSound("bigwin");

      dailyStatus.textContent = `🎉 You won ${GD.formatEuro(prize)}!`;
      GD.showToast(`Daily bonus: ${GD.formatEuro(prize)}!`, "success", 3000);

      wheelSpinning = false;
      checkDailyBonus();
      updateStats();
    }, 4200);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PARTICLES (Ambient effect)
  // ═══════════════════════════════════════════════════════════════════════════
  function initParticles() {
    const container = document.querySelector(".hero-particles");
    if (!container) return;

    for (let i = 0; i < 20; i++) {
      const particle = document.createElement("div");
      particle.className = "particle";
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.animationDelay = `${Math.random() * 5}s`;
      particle.style.animationDuration = `${3 + Math.random() * 4}s`;
      container.appendChild(particle);
    }
  }
})();
