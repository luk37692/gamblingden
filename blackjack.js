/**
 * GamblingDen - Blackjack
 * Classic 21 with hit, stand, double, split
 */
(function () {
  "use strict";

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTANTS
  // ═══════════════════════════════════════════════════════════════════════════
  const SUITS = ["♠", "♥", "♦", "♣"];
  const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const RANK_VALUES = {
    A: 11,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
    7: 7,
    8: 8,
    9: 9,
    10: 10,
    J: 10,
    Q: 10,
    K: 10,
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // DOM REFERENCES
  // ═══════════════════════════════════════════════════════════════════════════
  const balanceAmount = document.getElementById("balance-amount");
  const levelBadge = document.getElementById("level-badge");
  const xpBarFill = document.getElementById("xp-bar-fill");
  const xpText = document.getElementById("xp-text");
  const soundToggle = document.getElementById("sound-toggle");

  const dealerCardsEl = document.getElementById("dealer-cards");
  const playerCardsEl = document.getElementById("player-cards");
  const dealerValueEl = document.getElementById("dealer-value");
  const playerValueEl = document.getElementById("player-value");
  const gameMessageEl = document.getElementById("game-message");

  const bettingControls = document.getElementById("betting-controls");
  const gameControls = document.getElementById("game-controls");
  const resultControls = document.getElementById("result-controls");

  const currentBetEl = document.getElementById("current-bet");
  const clearBetBtn = document.getElementById("clear-bet-btn");
  const dealBtn = document.getElementById("deal-btn");

  const hitBtn = document.getElementById("hit-btn");
  const standBtn = document.getElementById("stand-btn");
  const doubleBtn = document.getElementById("double-btn");
  const splitBtn = document.getElementById("split-btn");
  const newHandBtn = document.getElementById("new-hand-btn");

  const chips = document.querySelectorAll(".chip");

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════
  let deck = [];
  let playerHand = [];
  let dealerHand = [];
  let currentBet = 0;
  let gamePhase = "betting"; // betting, playing, dealer, ended

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════
  init();

  function init() {
    updateUI();

    // Event listeners
    GD.on("balance:change", updateBalanceUI);
    GD.on("xp:change", updateXPUI);

    chips.forEach((chip) => {
      chip.addEventListener("click", () => addToBet(parseFloat(chip.dataset.value)));
    });

    clearBetBtn.addEventListener("click", clearBet);
    dealBtn.addEventListener("click", deal);
    hitBtn.addEventListener("click", hit);
    standBtn.addEventListener("click", stand);
    doubleBtn.addEventListener("click", doubleDown);
    splitBtn.addEventListener("click", split);
    newHandBtn.addEventListener("click", newHand);
    soundToggle.addEventListener("click", toggleSound);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UI UPDATES
  // ═══════════════════════════════════════════════════════════════════════════
  function updateUI() {
    updateBalanceUI();
    updateXPUI();
    updateSoundUI();
    updateBetUI();
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

  function updateBetUI() {
    currentBetEl.textContent = GD.formatEuro(currentBet);
    dealBtn.disabled = currentBet <= 0;
  }

  function showMessage(text, type = "") {
    gameMessageEl.innerHTML = `<span class="message-text ${type}">${text}</span>`;
  }

  function clearMessage() {
    gameMessageEl.innerHTML = "";
  }

  function showControls(phase) {
    bettingControls.classList.toggle("hidden", phase !== "betting");
    gameControls.classList.toggle("hidden", phase !== "playing");
    resultControls.classList.toggle("hidden", phase !== "ended");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DECK MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════
  function createDeck(numDecks = 4) {
    const d = [];
    for (let n = 0; n < numDecks; n++) {
      for (const suit of SUITS) {
        for (const rank of RANKS) {
          d.push({ suit, rank });
        }
      }
    }
    return shuffle(d);
  }

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = GD.randomInt(0, i);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function drawCard() {
    if (deck.length < 20) {
      deck = createDeck();
    }
    return deck.pop();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HAND CALCULATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  function calculateHand(hand) {
    let total = 0;
    let aces = 0;

    for (const card of hand) {
      total += RANK_VALUES[card.rank];
      if (card.rank === "A") aces++;
    }

    // Convert aces from 11 to 1 as needed
    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }

    return total;
  }

  function isBlackjack(hand) {
    return hand.length === 2 && calculateHand(hand) === 21;
  }

  function isBust(hand) {
    return calculateHand(hand) > 21;
  }

  function canSplit(hand) {
    return hand.length === 2 && hand[0].rank === hand[1].rank;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDERING
  // ═══════════════════════════════════════════════════════════════════════════
  function renderCard(card, faceDown = false) {
    if (faceDown) {
      return `<div class="card face-down dealing"></div>`;
    }

    const isRed = card.suit === "♥" || card.suit === "♦";
    const colorClass = isRed ? "red" : "black";

    return `
      <div class="card ${colorClass} dealing">
        <div class="card-corner">
          <span class="card-rank">${card.rank}</span>
          <span class="card-suit">${card.suit}</span>
        </div>
        <div class="card-center">${card.suit}</div>
        <div class="card-corner bottom">
          <span class="card-rank">${card.rank}</span>
          <span class="card-suit">${card.suit}</span>
        </div>
      </div>
    `;
  }

  function renderHand(container, hand, hideFirst = false) {
    container.innerHTML = hand
      .map((card, i) => renderCard(card, hideFirst && i === 0))
      .join("");
  }

  function updateHandValues(showDealerHidden = false) {
    const playerValue = calculateHand(playerHand);
    playerValueEl.textContent = playerValue;
    playerValueEl.classList.toggle("bust", playerValue > 21);
    playerValueEl.classList.toggle("blackjack", isBlackjack(playerHand));

    if (showDealerHidden) {
      const dealerValue = calculateHand(dealerHand);
      dealerValueEl.textContent = dealerValue;
      dealerValueEl.classList.toggle("bust", dealerValue > 21);
      dealerValueEl.classList.toggle("blackjack", isBlackjack(dealerHand));
    } else if (dealerHand.length > 0) {
      // Show only the visible card's value
      dealerValueEl.textContent = RANK_VALUES[dealerHand[1].rank];
    } else {
      dealerValueEl.textContent = "";
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BETTING
  // ═══════════════════════════════════════════════════════════════════════════
  function addToBet(amount) {
    if (gamePhase !== "betting") return;
    if (GD.getBalance() < currentBet + amount) {
      GD.showToast("Insufficient balance", "error");
      return;
    }

    currentBet = GD.round2(currentBet + amount);
    updateBetUI();
    GD.playSound("click");
  }

  function clearBet() {
    currentBet = 0;
    updateBetUI();
    GD.playSound("click");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GAME FLOW
  // ═══════════════════════════════════════════════════════════════════════════
  async function deal() {
    if (currentBet <= 0 || gamePhase !== "betting") return;

    // Place bet
    if (!GD.placeBet(currentBet)) {
      GD.showToast("Insufficient balance", "error");
      return;
    }

    gamePhase = "playing";
    showControls("playing");
    clearMessage();

    // Reset deck if needed
    if (deck.length < 20) {
      deck = createDeck();
    }

    // Deal initial cards
    playerHand = [];
    dealerHand = [];

    // Deal cards with animation delays
    playerHand.push(drawCard());
    renderHand(playerCardsEl, playerHand);
    GD.playSound("click");
    await delay(200);

    dealerHand.push(drawCard());
    renderHand(dealerCardsEl, dealerHand, true);
    GD.playSound("click");
    await delay(200);

    playerHand.push(drawCard());
    renderHand(playerCardsEl, playerHand);
    GD.playSound("click");
    await delay(200);

    dealerHand.push(drawCard());
    renderHand(dealerCardsEl, dealerHand, true);
    GD.playSound("click");

    updateHandValues(false);

    // Check for blackjack
    if (isBlackjack(playerHand)) {
      await delay(500);
      await dealerPlay();
      return;
    }

    // Update controls
    updateGameControls();
  }

  function updateGameControls() {
    const canDouble = playerHand.length === 2 && GD.getBalance() >= currentBet;
    const canSplitHand = canSplit(playerHand) && GD.getBalance() >= currentBet;

    doubleBtn.disabled = !canDouble;
    splitBtn.disabled = !canSplitHand;
  }

  async function hit() {
    if (gamePhase !== "playing") return;

    playerHand.push(drawCard());
    renderHand(playerCardsEl, playerHand);
    updateHandValues(false);
    GD.playSound("click");

    if (isBust(playerHand)) {
      await delay(300);
      endHand("bust");
    } else if (calculateHand(playerHand) === 21) {
      await delay(300);
      await stand();
    } else {
      // Disable double/split after hitting
      doubleBtn.disabled = true;
      splitBtn.disabled = true;
    }
  }

  async function stand() {
    if (gamePhase !== "playing") return;
    gamePhase = "dealer";
    await dealerPlay();
  }

  async function doubleDown() {
    if (gamePhase !== "playing" || playerHand.length !== 2) return;
    if (!GD.placeBet(currentBet)) {
      GD.showToast("Insufficient balance", "error");
      return;
    }

    currentBet *= 2;
    updateBetUI();

    // Draw one card and stand
    playerHand.push(drawCard());
    renderHand(playerCardsEl, playerHand);
    updateHandValues(false);
    GD.playSound("click");

    await delay(300);

    if (isBust(playerHand)) {
      endHand("bust");
    } else {
      await stand();
    }
  }

  async function split() {
    // Simplified: no split implementation for now
    GD.showToast("Split coming soon!", "info");
  }

  async function dealerPlay() {
    gamePhase = "dealer";

    // Reveal hole card
    renderHand(dealerCardsEl, dealerHand, false);
    updateHandValues(true);
    await delay(600);

    // Check for immediate results
    const playerValue = calculateHand(playerHand);
    const playerBJ = isBlackjack(playerHand);
    const dealerBJ = isBlackjack(dealerHand);

    if (playerBJ && dealerBJ) {
      endHand("push");
      return;
    }

    if (playerBJ) {
      endHand("blackjack");
      return;
    }

    if (dealerBJ) {
      endHand("dealer_blackjack");
      return;
    }

    // Dealer draws
    while (calculateHand(dealerHand) < 17) {
      await delay(600);
      dealerHand.push(drawCard());
      renderHand(dealerCardsEl, dealerHand, false);
      updateHandValues(true);
      GD.playSound("click");
    }

    await delay(400);
    determineWinner();
  }

  function determineWinner() {
    const playerValue = calculateHand(playerHand);
    const dealerValue = calculateHand(dealerHand);

    if (dealerValue > 21) {
      endHand("dealer_bust");
    } else if (playerValue > dealerValue) {
      endHand("win");
    } else if (playerValue < dealerValue) {
      endHand("lose");
    } else {
      endHand("push");
    }
  }

  function endHand(result) {
    gamePhase = "ended";
    showControls("ended");

    let winAmount = 0;
    let message = "";
    let messageType = "";

    switch (result) {
      case "blackjack":
        winAmount = GD.round2(currentBet * 2.5); // 3:2 payout
        message = "🎉 BLACKJACK! You win " + GD.formatEuro(winAmount);
        messageType = "blackjack";
        GD.checkAchievement("blackjack_21");
        GD.playSound("bigwin");
        break;

      case "win":
        winAmount = currentBet * 2;
        message = "You win " + GD.formatEuro(winAmount) + "!";
        messageType = "win";
        GD.playSound("win");
        break;

      case "dealer_bust":
        winAmount = currentBet * 2;
        message = "Dealer busts! You win " + GD.formatEuro(winAmount) + "!";
        messageType = "win";
        GD.playSound("win");
        break;

      case "push":
        winAmount = currentBet; // Return bet
        message = "Push - bet returned";
        messageType = "push";
        GD.playSound("click");
        break;

      case "bust":
        message = "Bust! You lose " + GD.formatEuro(currentBet);
        messageType = "lose";
        GD.playSound("lose");
        break;

      case "dealer_blackjack":
        message = "Dealer has Blackjack!";
        messageType = "lose";
        GD.playSound("lose");
        break;

      case "lose":
        message = "Dealer wins. You lose " + GD.formatEuro(currentBet);
        messageType = "lose";
        GD.playSound("lose");
        break;
    }

    showMessage(message, messageType);

    if (winAmount > 0) {
      GD.creditWin(winAmount);
    }

    GD.updateStats({ game: "blackjack" });
    updateBalanceUI();
  }

  function newHand() {
    gamePhase = "betting";
    currentBet = 0;
    playerHand = [];
    dealerHand = [];

    dealerCardsEl.innerHTML = "";
    playerCardsEl.innerHTML = "";
    dealerValueEl.textContent = "";
    playerValueEl.textContent = "";
    playerValueEl.classList.remove("bust", "blackjack");
    dealerValueEl.classList.remove("bust", "blackjack");

    clearMessage();
    showControls("betting");
    updateBetUI();
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
})();
