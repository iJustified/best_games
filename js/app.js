const STORAGE_KEY = "best_games_tournament";

const elements = {
  tournament: document.querySelector(".tournament"),
  startSection: document.querySelector(".tournament__start"),
  startBtn: document.querySelector(".tournament__start-btn"),
  gamesCount: document.querySelector(".tournament__games-count"),
  roundsCount: document.querySelector(".tournament__rounds-count"),
  resumeNotice: document.querySelector(".tournament__resume"),
  statusSection: document.querySelector(".tournament__status"),
  arenaSection: document.querySelector(".tournament__arena"),
  roundCurrent: document.querySelector(".tournament__round-current"),
  roundTotal: document.querySelector(".tournament__round-total"),
  pairCurrent: document.querySelector(".tournament__pair-current"),
  pairTotal: document.querySelector(".tournament__pair-total"),
  barFill: document.querySelector(".tournament__bar-fill"),
  leftCard: document.querySelector(".game-card--left"),
  rightCard: document.querySelector(".game-card--right"),
  leftName: document.querySelector(".game-card--left .game-card__name"),
  rightName: document.querySelector(".game-card--right .game-card__name"),
  // leftImg: document.querySelector(".game-card--left .game-card__img"),
  // rightImg: document.querySelector(".game-card--right .game-card__img"),
  leftImgContainer: document.querySelector(".game-card--left .game-card__img-container"),
  rightImgContainer: document.querySelector(".game-card--right .game-card__img-container"),
  winnerSection: document.querySelector(".tournament__winner"),
  winnerName: document.querySelector(".tournament__winner-name"),
  winnerImgContainer: document.querySelector(".tournament__winner-img-container"),
  restartBtn: document.querySelector(".tournament__restart"),
  resetWrap: document.querySelector(".tournament__reset-wrap"),
  resetBtn: document.querySelector(".tournament__reset"),
  error: document.querySelector(".tournament__error"),
};

let allGames = [];
let gamesById = new Map();

let state = {
  round: 1,
  participants: [],
  winners: [],
  pairIndex: 0,
  totalRounds: 0,
  isSelecting: false,
  isFinished: false,
  champion: null,
};

console.log(state.participants);

function isPowerOfTwo(value) {
  return value > 0 && (value & (value - 1)) === 0;
}

function getTotalRounds(gamesCount) {
  return Math.log2(gamesCount);
}

function shuffle(array) {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

function getPairsCount() {
  return state.participants.length / 2;
}

function getCurrentPair() {
  const leftIndex = state.pairIndex * 2;
  return [state.participants[leftIndex], state.participants[leftIndex + 1]];
}

function hideError() {
  elements.error.classList.add("tournament__error--hidden");
}

function showError(message) {
  elements.error.textContent = message;
  elements.error.classList.remove("tournament__error--hidden");
}

function updateStartInfo() {
  elements.gamesCount.textContent = allGames.length;
  elements.roundsCount.textContent = getTotalRounds(allGames.length);
}

function showIdleScreen() {
  elements.tournament.classList.remove("tournament--playing", "tournament--finished");
  elements.startSection.classList.remove("tournament__start--hidden");
  elements.statusSection.classList.add("tournament__status--hidden");
  elements.arenaSection.classList.add("tournament__arena--hidden");
  elements.winnerSection.classList.add("tournament__winner--hidden");
  elements.resetWrap.classList.add("tournament__reset-wrap--hidden");
  elements.resumeNotice.classList.add("tournament__resume--hidden");
  updateStartInfo();
}

function showPlayingScreen(showResumeNotice = false) {
  elements.tournament.classList.add("tournament--playing");
  elements.tournament.classList.remove("tournament--finished");
  elements.startSection.classList.add("tournament__start--hidden");
  elements.statusSection.classList.remove("tournament__status--hidden");
  elements.arenaSection.classList.remove("tournament__arena--hidden");
  elements.winnerSection.classList.add("tournament__winner--hidden");
  elements.resetWrap.classList.remove("tournament__reset-wrap--hidden");
  elements.resumeNotice.classList.toggle("tournament__resume--hidden", !showResumeNotice);
}

function showWinnerScreen(game) {
  elements.tournament.classList.remove("tournament--playing");
  elements.tournament.classList.add("tournament--finished");
  elements.startSection.classList.add("tournament__start--hidden");
  elements.resetWrap.classList.add("tournament__reset-wrap--hidden");
  elements.winnerSection.classList.remove("tournament__winner--hidden");
  elements.winnerName.textContent = game.name;
  elements.winnerImgContainer.innerHTML = "";
  const winnerImgTag = document.createElement("img");
  winnerImgTag.src = `./covers/${game.name}.jpg`;
  winnerImgTag.alt = game.name;
  elements.winnerImgContainer.appendChild(winnerImgTag);
}

function serializeState() {
  return {
    gamesCount: allGames.length,
    round: state.round,
    participantIds: state.participants.map((game) => game.id),
    winnerIds: state.winners.map((game) => game.id),
    pairIndex: state.pairIndex,
    totalRounds: state.totalRounds,
    isFinished: state.isFinished,
    championId: state.champion?.id ?? null,
  };
}

function mapIdsToGames(ids) {
  return ids.map((id) => gamesById.get(id)).filter(Boolean);
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeState()));
  } catch {
    // localStorage может быть недоступен — турнир продолжит работать без сохранения
  }
}

function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}

function loadSavedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function isValidSavedState(saved) {
  if (!saved || saved.gamesCount !== allGames.length) {
    return false;
  }

  if (saved.isFinished) {
    return saved.championId !== null && gamesById.has(saved.championId);
  }

  const participants = mapIdsToGames(saved.participantIds);

  if (participants.length !== saved.participantIds.length) {
    return false;
  }

  if (!isPowerOfTwo(participants.length)) {
    return false;
  }

  const winners = mapIdsToGames(saved.winnerIds);

  if (winners.length !== saved.winnerIds.length) {
    return false;
  }

  const pairsTotal = participants.length / 2;

  return saved.pairIndex >= 0 && saved.pairIndex < pairsTotal;
}

function applySavedState(saved) {
  state = {
    round: saved.round,
    participants: mapIdsToGames(saved.participantIds),
    winners: mapIdsToGames(saved.winnerIds),
    pairIndex: saved.pairIndex,
    totalRounds: saved.totalRounds,
    isSelecting: false,
    isFinished: saved.isFinished,
    champion: saved.championId ? gamesById.get(saved.championId) : null,
  };
}

function updateStatus() {
  const pairsTotal = getPairsCount();

  elements.roundCurrent.textContent = state.round;
  elements.roundTotal.textContent = state.totalRounds;
  elements.pairCurrent.textContent = state.pairIndex + 1;
  elements.pairTotal.textContent = pairsTotal;
  elements.barFill.style.width = `${((state.pairIndex + 1) / pairsTotal) * 100}%`;
}

function renderPair() {
  const [left, right] = getCurrentPair();

  elements.leftName.textContent = left.name;
  elements.rightName.textContent = right.name;
  elements.leftImgContainer.innerHTML = "";
  elements.rightImgContainer.innerHTML = "";
  const leftImgTag = document.createElement("img");
  leftImgTag.src = `./covers/${left.name}.jpg`;
  leftImgTag.alt = left.name;
  elements.leftImgContainer.appendChild(leftImgTag);
  const rightImgTag = document.createElement("img");
  rightImgTag.src = `./covers/${right.name}.jpg`;
  rightImgTag.alt = right.name;
  elements.rightImgContainer.appendChild(rightImgTag);
  elements.leftCard.classList.remove("game-card--selected");
  elements.rightCard.classList.remove("game-card--selected");
  elements.leftCard.disabled = false;
  elements.rightCard.disabled = false;

  updateStatus();
}

function showWinner(game) {
  state.isFinished = true;
  state.champion = game;
  saveState();
  showWinnerScreen(game);
}

function startRound() {
  state.winners = [];
  state.pairIndex = 0;
  state.isFinished = false;
  state.champion = null;
  renderPair();
  saveState();
}

function startNextRound() {
  state.round += 1;
  state.participants = state.winners;
  console.log(state.winners);
  startRound();
}

function finishRound() {
  if (state.winners.length === 1) {
    showWinner(state.winners[0]);
    return;
  }

  startNextRound();
}

function selectGame(game, card) {
  if (state.isSelecting) {
    return;
  }

  state.isSelecting = true;
  card.classList.add("game-card--selected");
  elements.leftCard.disabled = true;
  elements.rightCard.disabled = true;

  state.winners.push(game);
  state.pairIndex += 1;
  saveState();

  setTimeout(() => {
    state.isSelecting = false;

    if (state.pairIndex >= getPairsCount()) {
      finishRound();
      return;
    }

    renderPair();
    saveState();
  }, 300);
}

function handleCardClick(event) {
  const card = event.currentTarget;
  const [left, right] = getCurrentPair();
  const game = card.dataset.side === "left" ? left : right;

  selectGame(game, card);
}

function validateGames(games) {
  if (games.length < 2) {
    showError("Нужно минимум 2 игры для турнира.");
    return false;
  }

  if (!isPowerOfTwo(games.length)) {
    showError(
      `Количество игр должно быть степенью двойки (2, 4, 8, 16…). Сейчас: ${games.length}.`,
    );
    return false;
  }

  return true;
}

function startNewTournament() {
  if (!validateGames(allGames)) {
    return;
  }

  hideError();

  state = {
    round: 1,
    participants: shuffle(allGames),
    winners: [],
    pairIndex: 0,
    totalRounds: getTotalRounds(allGames.length),
    isSelecting: false,
    isFinished: false,
    champion: null,
  };

  showPlayingScreen();
  startRound();
}

function resetToIdle() {
  clearState();

  state = {
    round: 1,
    participants: [],
    winners: [],
    pairIndex: 0,
    totalRounds: 0,
    isSelecting: false,
    isFinished: false,
    champion: null,
  };

  hideError();
  showIdleScreen();
}

function restoreTournament() {
  const saved = loadSavedState();

  if (!saved || !isValidSavedState(saved)) {
    clearState();
    showIdleScreen();
    return;
  }

  hideError();
  applySavedState(saved);

  if (state.isFinished && state.champion) {
    showWinnerScreen(state.champion);
    return;
  }

  showPlayingScreen(true);
  renderPair();
}

async function loadGamesData() {
  const response = await fetch("./final-list-v2.json");

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  allGames = await response.json();
  gamesById = new Map(allGames.map((game) => [game.id, game]));
}

async function bootstrap() {
  try {
    await loadGamesData();

    if (!validateGames(allGames)) {
      showIdleScreen();
      return;
    }

    restoreTournament();
  } catch {
    showError(
      "Не удалось загрузить final-list-v2.json. Запустите локальный сервер (например: npx serve .).",
    );
  }
}

elements.leftCard.addEventListener("click", handleCardClick);
elements.rightCard.addEventListener("click", handleCardClick);
elements.startBtn.addEventListener("click", startNewTournament);
elements.restartBtn.addEventListener("click", resetToIdle);
elements.resetBtn.addEventListener("click", resetToIdle);

bootstrap();
