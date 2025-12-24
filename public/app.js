const socket = io();

// ==================== ÉTAT GLOBAL ====================
let state = {
  playerId: null,
  playerName: null,
  roomCode: null,
  isHost: false,
  gameType: 'hotseat', // hotseat, undercover, roulette
  questionMode: 'default',
  players: [],
  hasVoted: false,
  hasSubmittedQuestions: false,
  // Undercover specific
  myWord: null,
  myRole: null,
  // Roulette specific
  rouletteMode: null, // 'local' ou 'online'
  roulettePlayer1: null,
  roulettePlayer2: null,
  rouletteScores: { player1: 0, player2: 0 },
  currentWheelRotation: 0
};

// ==================== DONNÉES STATIQUES ====================

const avatars = ['😀', '😎', '🥳', '🤩', '😺', '🦊', '🐻', '🐼', '🐨', '🦁', '🐸', '🐙', '🦋', '🐢', '🦄', '🐳', '🦜', '🦔', '🐲', '🎃'];

// Segments de la roue (identiques au backend pour la cohérence visuelle)
const wheelSegments = [
  { color: '#e74c3c', name: '{player1} prend cher', count: 1, target: 'player1', gages: ["{player1} boit un verre !", "{player1} cul sec !"] },
  { color: '#f39c12', name: '{player2} prend cher', count: 1, target: 'player2', gages: ["{player2} boit un verre !", "{player2} cul sec !"] },
  { color: '#2ecc71', name: 'Tranquillou', count: 0, target: 'none', gages: ["Personne ne boit !", "Pause générale !"] },
  { color: '#3498db', name: 'Collectif', count: 1, target: 'both', gages: ["Santé ! Tout le monde boit !", "Les deux trinquent !"] },
  { color: '#9b59b6', name: '{player1} le master', count: 0, target: 'player1_gives', gages: ["{player1} distribue 2 gorgées !", "{player1} invente une règle !"] },
  { color: '#1abc9c', name: '{player2} le master', count: 0, target: 'player2_gives', gages: ["{player2} distribue 2 gorgées !", "{player2} invente une règle !"] },
  { color: '#e67e22', name: 'Défi du destin', count: 1, target: 'game', gages: ["Pierre-Feuille-Ciseaux : le perdant boit !", "Bras de fer !"] },
  { color: '#34495e', name: 'Jackpot ou Crash', count: 3, target: 'jackpot', gages: ["JACKPOT ! {player1} boit 3 verres !", "CATASTROPHE ! Tout le monde finit son verre !"] }
];

// ==================== DOM ELEMENTS ====================
const screens = {
  home: document.getElementById('home-screen'),
  rouletteMode: document.getElementById('roulette-mode-screen'),
  rouletteLocalSetup: document.getElementById('roulette-local-setup-screen'),
  rouletteOnlineLobby: document.getElementById('roulette-online-lobby-screen'),
  rouletteGame: document.getElementById('roulette-game-screen'),
  lobby: document.getElementById('lobby-screen'),
  questionsSubmit: document.getElementById('questions-submit-screen'),
  game: document.getElementById('game-screen'), // Hot Seat Game
  results: document.getElementById('results-screen'), // Hot Seat Results
  end: document.getElementById('end-screen'),
  undercoverRole: document.getElementById('undercover-role-screen'),
  undercoverGame: document.getElementById('undercover-game-screen'),
  undercoverVote: document.getElementById('undercover-vote-screen'),
  undercoverElimination: document.getElementById('undercover-elimination-screen'),
  mrwhiteGuess: document.getElementById('mrwhite-guess-screen'),
  undercoverEnd: document.getElementById('undercover-end-screen')
};

// ==================== FONCTIONS UTILITAIRES ====================

function showScreen(screenName) {
  Object.values(screens).forEach(s => {
    if (s) s.classList.remove('active');
  });
  if (screens[screenName]) {
    screens[screenName].classList.add('active');
  }
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast';
  if (type === 'error') toast.classList.add('error');
  if (type === 'success') toast.classList.add('success');
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

function getAvatar(index) {
  return avatars[index % avatars.length];
}

function updateRulesDisplay(gameType) {
  const rulesContent = document.getElementById('rules-content');
  if (gameType === 'undercover') {
    rulesContent.innerHTML = `
      <p>🕵️ <strong>Undercover</strong></p>
      <ul><li>Chaque joueur reçoit un mot secret.</li><li>Les Undercovers ont un mot différent.</li><li>Démasquez l'imposteur !</li></ul>`;
  } else if (gameType === 'hotseat') {
    rulesContent.innerHTML = `
      <p>🔥 <strong>Hot Seat</strong></p>
      <ul><li>Une question s'affiche.</li><li>Votez pour la personne qui correspond le plus.</li><li>Découvrez ce que vos amis pensent de vous !</li></ul>`;
  }
}

function updatePlayersList() {
  const list = document.getElementById('players-list');
  const count = document.getElementById('player-count');
  if (!list || !count) return;

  count.textContent = state.players.length;
  list.innerHTML = state.players.map((player, index) => `
    <li class="${player.isHost ? 'host' : ''} ${player.isAlive === false ? 'eliminated' : ''}">
      ${getAvatar(index)} ${player.name} ${player.id === state.playerId ? ' (toi)' : ''}
    </li>
  `).join('');
}

function checkGameAvailability() {
  const playerCount = state.players.length;
  const undercoverOption = document.querySelector('.game-option-small input[value="undercover"]')?.parentElement;
  
  if (undercoverOption) {
    if (playerCount < 4) {
      undercoverOption.style.opacity = '0.5';
      undercoverOption.style.pointerEvents = 'none'; // Rend in-cliquable côté client
      // Si on est déjà sur Undercover (bug visuel), on force l'affichage Hot Seat
      if (state.gameType === 'undercover') {
         // Optionnel: dire au client de re-sélectionner Hot Seat visuellement
      }
    } else {
      undercoverOption.style.opacity = '1';
      undercoverOption.style.pointerEvents = 'auto';
    }
  }
}

// ==================== GESTION DES ÉVÉNEMENTS DOM ====================

// --- Navigation & Setup ---
document.querySelectorAll('.game-option').forEach(option => {
  option.addEventListener('click', () => {
    document.querySelectorAll('.game-option').forEach(opt => opt.classList.remove('selected'));
    option.classList.add('selected');
    state.gameType = option.querySelector('input').value;
  });
});

document.querySelectorAll('.game-option-small').forEach(option => {
  option.addEventListener('click', () => {
    const val = option.querySelector('input').value;
    state.gameType = val;
    socket.emit('changeGameType', val);
    // UI Update handled by socket event
  });
});

// Création partie
document.getElementById('create-room-btn').addEventListener('click', () => {
  const name = document.getElementById('player-name').value.trim();
  if (!name) return showToast('Entre ton prénom !', 'error');
  state.playerName = name;

  if (state.gameType === 'roulette') {
    showScreen('rouletteMode');
  } else {
    socket.emit('createRoom', { playerName: name, gameType: state.gameType });
  }
});

// Rejoindre partie
document.getElementById('join-room-btn').addEventListener('click', () => {
  document.getElementById('join-form').classList.toggle('hidden');
});

document.getElementById('confirm-join-btn').addEventListener('click', () => {
  const name = document.getElementById('player-name').value.trim();
  const code = document.getElementById('room-code').value.trim().toUpperCase();
  if (!name || !code) return showToast('Remplis tous les champs !', 'error');
  
  state.playerName = name;
  socket.emit('joinRoom', { roomCode: code, playerName: name });
});

// Lobby
document.getElementById('copy-code-btn').addEventListener('click', () => {
  navigator.clipboard.writeText(state.roomCode);
  showToast('Code copié !', 'success');
});

document.getElementById('start-game-btn').addEventListener('click', () => {
  socket.emit('startGame', { questionMode: state.questionMode });
});

// --- Hot Seat ---
document.querySelectorAll('.mode-option').forEach(option => {
  option.addEventListener('click', () => {
    const val = option.querySelector('input').value;
    state.questionMode = val;
    socket.emit('changeQuestionMode', val);
  });
});

document.getElementById('submit-questions-btn')?.addEventListener('click', () => {
  const q1 = document.getElementById('custom-question-1').value.trim();
  const q2 = document.getElementById('custom-question-2').value.trim();
  const q3 = document.getElementById('custom-question-3').value.trim();
  const questions = [];
  if (q1) questions.push(q1);
  if (q2) questions.push(q2);
  if (q3) questions.push(q3);
  
  socket.emit('submitQuestions', { questions });
  document.getElementById('submit-questions-btn').disabled = true;
  document.getElementById('submit-questions-btn').textContent = '✅ Envoyé';
});

document.getElementById('next-question-btn').addEventListener('click', () => {
  socket.emit('nextQuestion');
});

// --- Undercover ---
document.getElementById('ready-btn')?.addEventListener('click', () => {
  showScreen('undercoverGame');
});

document.getElementById('hint-done-btn')?.addEventListener('click', () => {
  socket.emit('hintDone');
  document.getElementById('hint-done-btn').disabled = true;
});

document.getElementById('mrwhite-guess-btn')?.addEventListener('click', () => {
  const guess = document.getElementById('mrwhite-guess-input').value.trim();
  if (guess) socket.emit('mrWhiteGuessWord', guess);
});

// --- Navigation Globale ---
document.getElementById('home-btn').addEventListener('click', () => location.reload());
document.getElementById('restart-btn').addEventListener('click', () => socket.emit('restartGame'));
document.getElementById('uc-home-btn')?.addEventListener('click', () => location.reload());
document.getElementById('uc-restart-btn')?.addEventListener('click', () => socket.emit('restartGame'));

// ==================== LOGIQUE ROULETTE ====================

// Setup Local
document.getElementById('roulette-back-btn')?.addEventListener('click', () => {
  showScreen('home');
});
document.getElementById('roulette-local-back-btn')?.addEventListener('click', () => {
  showScreen('rouletteMode');
});
document.getElementById('roulette-online-back-btn')?.addEventListener('click', () => {
  showScreen('rouletteMode');
});
document.getElementById('hotseat-back-btn')?.addEventListener('click', () => {
  showScreen('home');
});

document.getElementById('roulette-local-btn')?.addEventListener('click', () => {
  state.rouletteMode = 'local';
  showScreen('rouletteLocalSetup');
});
document.getElementById('roulette-local-start-btn')?.addEventListener('click', () => {
  const p1 = document.getElementById('roulette-player1-name').value || 'Joueur 1';
  const p2 = document.getElementById('roulette-player2-name').value || 'Joueur 2';
  state.roulettePlayer1 = p1;
  state.roulettePlayer2 = p2;
  startRouletteGame();
});

// Setup Online
document.getElementById('roulette-online-btn')?.addEventListener('click', () => {
  state.rouletteMode = 'online';
  socket.emit('createRoom', { playerName: state.playerName, gameType: 'roulette' });
});
document.getElementById('roulette-online-start-btn')?.addEventListener('click', () => {
  socket.emit('startGame', { gameType: 'roulette' });
});
document.getElementById('roulette-copy-code-btn')?.addEventListener('click', () => {
  navigator.clipboard.writeText(state.roomCode);
  showToast('Code copié !', 'success');
});

// Jeu
document.getElementById('spin-wheel-btn')?.addEventListener('click', spinWheel);
document.getElementById('spin-again-btn')?.addEventListener('click', () => {
  document.getElementById('roulette-result').classList.add('hidden');
  document.getElementById('roulette-actions').classList.add('hidden');
  document.getElementById('spin-wheel-btn').classList.remove('hidden');
  document.getElementById('spin-wheel-btn').disabled = false;
  document.getElementById('spin-wheel-btn').textContent = '🎰 Tourner la roue !';
});
document.getElementById('roulette-quit-btn')?.addEventListener('click', () => location.reload());

function startRouletteGame() {
  // Update UI noms
  document.getElementById('roulette-p1-name').textContent = state.roulettePlayer1;
  document.getElementById('roulette-p2-name').textContent = state.roulettePlayer2;
  document.getElementById('roulette-p1-score').textContent = '0 verre';
  document.getElementById('roulette-p2-score').textContent = '0 verre';

  // Reset UI
  document.getElementById('roulette-result').classList.add('hidden');
  document.getElementById('roulette-actions').classList.add('hidden');
  document.getElementById('spin-wheel-btn').classList.remove('hidden');
  document.getElementById('spin-wheel-btn').disabled = false;

  // Légende
  const legend = document.getElementById('wheel-legend');
  legend.innerHTML = wheelSegments.map(s => `
    <div class="legend-item">
      <span class="legend-color" style="background:${s.color}"></span>
      <span>${s.name.replace('{player1}', state.roulettePlayer1).replace('{player2}', state.roulettePlayer2)}</span>
    </div>
  `).join('');

  showScreen('rouletteGame');
}

function spinWheel() {
  const wheel = document.getElementById('roulette-wheel');
  const btn = document.getElementById('spin-wheel-btn');
  btn.disabled = true;

  // Calcul du résultat (Calcul côté client pour l'animation locale)
  const segmentIndex = Math.floor(Math.random() * wheelSegments.length);
  const segmentAngle = 360 / wheelSegments.length;
  // Calcul pour arriver au centre du segment
  const stopAngle = 360 - ((segmentIndex * segmentAngle) + (segmentAngle / 2)); 
  // Ajout de tours aléatoires (min 5 tours)
  const rotations = 360 * (5 + Math.floor(Math.random() * 3));
  
  // Ajustement par rapport à la rotation actuelle pour éviter les retours en arrière visuels
  const currentRot = state.currentWheelRotation % 360;
  const targetRotation = state.currentWheelRotation + rotations + (stopAngle - currentRot);
  
  state.currentWheelRotation = targetRotation;
  
  wheel.style.transform = `rotate(${targetRotation}deg)`;

  setTimeout(() => {
    const result = wheelSegments[segmentIndex];
    const gage = result.gages[Math.floor(Math.random() * result.gages.length)];
    
    // Si online, on notifie le serveur du résultat
    if (state.rouletteMode === 'online') {
      socket.emit('rouletteResult', { segment: result, gage: gage });
    }
    
    showRouletteResult(result, gage);
  }, 4000); // Durée de la transition CSS
}

function showRouletteResult(segment, gage) {
  const resultDiv = document.getElementById('roulette-result');
  const resultText = document.getElementById('roulette-result-text');
  const resultColor = document.getElementById('roulette-result-color');
  
  // Mise à jour scores
  if (segment.target.includes('player1') || segment.target === 'both') state.rouletteScores.player1 += segment.count;
  if (segment.target.includes('player2') || segment.target === 'both') state.rouletteScores.player2 += segment.count;
  
  document.getElementById('roulette-p1-score').textContent = `${state.rouletteScores.player1} verres`;
  document.getElementById('roulette-p2-score').textContent = `${state.rouletteScores.player2} verres`;

  // Affichage
  resultColor.style.background = segment.color;
  resultColor.textContent = segment.name.replace('{player1}', state.roulettePlayer1).replace('{player2}', state.roulettePlayer2);
  
  resultText.innerHTML = gage
    .replace('{player1}', `<span class="highlight">${state.roulettePlayer1}</span>`)
    .replace('{player2}', `<span class="highlight">${state.roulettePlayer2}</span>`);

  document.getElementById('spin-wheel-btn').classList.add('hidden');
  resultDiv.classList.remove('hidden');
  document.getElementById('roulette-actions').classList.remove('hidden');
}

// ==================== SOCKET EVENTS ====================

// --- Room Events ---
socket.on('roomCreated', (data) => {
  // Cas spécifique Roulette Online Host
  if (data.gameType === 'roulette') {
    state.roomCode = data.roomCode;
    state.playerId = data.playerId;
    state.isHost = true;
    state.roulettePlayer1 = state.playerName;
    state.rouletteMode = 'online';
    
    document.getElementById('roulette-room-code').textContent = data.roomCode;
    document.getElementById('roulette-slot-1-name').textContent = state.playerName;
    showScreen('rouletteOnlineLobby');
    return;
  }

  // Autres jeux
  state.roomCode = data.roomCode;
  state.playerId = data.playerId;
  state.isHost = true;
  state.gameType = data.gameType;
  state.players = data.players;
  
  document.getElementById('display-room-code').textContent = data.roomCode;
  document.getElementById('host-controls').classList.remove('hidden');
  document.getElementById('hotseat-options').classList.remove('hidden'); // Par défaut
  updatePlayersList();
  updateRulesDisplay(data.gameType);
  showScreen('lobby');
});

socket.on('roomJoined', (data) => {
  // Cas spécifique Roulette Online Joiner
  if (data.gameType === 'roulette') {
    state.roomCode = data.roomCode;
    state.playerId = data.playerId;
    state.gameType = 'roulette';
    state.rouletteMode = 'online';
    state.roulettePlayer2 = state.playerName;
    // Si le host est déjà là
    if (data.players[0]) state.roulettePlayer1 = data.players[0].name;

    document.getElementById('roulette-room-code').textContent = data.roomCode;
    document.getElementById('roulette-slot-1-name').textContent = state.roulettePlayer1 || '...';
    document.getElementById('roulette-slot-2-name').textContent = state.playerName;
    showScreen('rouletteOnlineLobby');
    return;
  }

  state.roomCode = data.roomCode;
  state.playerId = data.playerId;
  state.gameType = data.gameType;
  state.questionMode = data.questionMode || 'default';
  state.players = data.players;

  document.getElementById('display-room-code').textContent = data.roomCode;
  document.getElementById('host-controls').classList.add('hidden');
  document.getElementById('hotseat-options').classList.add('hidden');
  document.getElementById('waiting-message').classList.remove('hidden');
  updatePlayersList();
  updateRulesDisplay(data.gameType);
  showScreen('lobby');
});

socket.on('playerJoined', ({ players }) => {
  state.players = players;
  if (state.gameType === 'roulette' && players.length >= 2) {
    state.roulettePlayer2 = players[1].name;
    document.getElementById('roulette-slot-2-name').textContent = players[1].name;
    if (state.isHost) document.getElementById('roulette-online-start-btn').classList.remove('hidden');
  } else {
    updatePlayersList();
    checkGameAvailability();
  }
});

socket.on('playerLeft', ({ players }) => {
  state.players = players;
  updatePlayersList();
  checkGameAvailability();
});

socket.on('gameTypeChanged', ({ gameType }) => {
  state.gameType = gameType;
  updateRulesDisplay(gameType);
  // Met à jour la sélection visuelle pour les clients non-host
  document.querySelectorAll('.game-option-small input').forEach(input => {
    if (input.value === gameType) input.parentElement.classList.add('selected');
    else input.parentElement.classList.remove('selected');
  });
});

socket.on('questionModeChanged', ({ questionMode }) => {
  state.questionMode = questionMode;
  document.querySelectorAll('.mode-option input').forEach(input => {
    if (input.value === questionMode) input.parentElement.classList.add('selected');
    else input.parentElement.classList.remove('selected');
  });
});

socket.on('gameStarted', (data) => {
  if (data.gameType === 'roulette') {
    state.roulettePlayer1 = data.player1Name;
    state.roulettePlayer2 = data.player2Name;
    startRouletteGame();
  } else if (data.gameType === 'undercover') {
    // Setup Undercover UI
    state.myWord = data.yourWord;
    state.myRole = data.yourRole;
    document.getElementById('secret-word').textContent = data.yourWord;
    document.getElementById('reminder-word').textContent = data.yourWord;
    
    // UI Rôle
    const roleCard = document.getElementById('role-card');
    roleCard.className = `role-card ${data.yourRole}`;
    document.getElementById('role-name').textContent = data.yourRole === 'mrwhite' ? 'Mr. White' : (data.yourRole === 'undercover' ? 'Undercover' : 'Civil');
    
    // Init infos tour
    document.getElementById('uc-round-number').textContent = '1';
    document.getElementById('alive-count').textContent = data.players.length;
    document.getElementById('hints-given-list').innerHTML = '';
    
    // Check turn
    updateUndercoverTurn(data.currentPlayerId);
    showScreen('undercoverRole');

  } else {
    // Hot Seat
    setupHotSeatQuestion(data);
    showScreen('game');
  }
});

// --- Hot Seat Logic ---
socket.on('collectQuestions', ({ totalPlayers }) => {
  document.getElementById('questions-submitted-count').textContent = '0';
  document.getElementById('questions-total-players').textContent = totalPlayers;
  showScreen('questionsSubmit');
});

socket.on('playerSubmittedQuestions', ({ playerName, submittedCount }) => {
  document.getElementById('questions-submitted-count').textContent = submittedCount;
  const list = document.getElementById('submitted-players-list');
  list.innerHTML += `<li>✅ ${playerName} a validé</li>`;
});

socket.on('newQuestion', (data) => {
  setupHotSeatQuestion(data);
  showScreen('game');
});

function setupHotSeatQuestion(data) {
  state.hasVoted = false;
  document.getElementById('question-number').textContent = `Question ${data.questionNumber}/${data.totalQuestions}`;
  document.getElementById('question-text').textContent = data.question;
  document.getElementById('votes-count').textContent = '0';
  document.getElementById('total-players').textContent = data.players.length;
  document.getElementById('voted-message').classList.add('hidden');

  const grid = document.getElementById('players-vote-grid');
  grid.innerHTML = data.players.map((p, i) => `
    <div class="player-card" data-id="${p.id}">
      <div class="player-avatar">${getAvatar(i)}</div>
      <div class="player-name">${p.name}</div>
    </div>
  `).join('');

  grid.querySelectorAll('.player-card').forEach(card => {
    card.addEventListener('click', () => {
      if (state.hasVoted) return;
      state.hasVoted = true;
      socket.emit('vote', card.dataset.id);
      card.classList.add('selected');
      document.getElementById('voted-message').classList.remove('hidden');
    });
  });
}

socket.on('voteReceived', ({ totalVotes }) => {
  document.getElementById('votes-count').textContent = totalVotes;
});

socket.on('questionResults', ({ winners, votes, voteDetails, isLastQuestion }) => {
  document.getElementById('winner-display').innerHTML = winners.map(w => `<div>🏆 ${w}</div>`).join('');
  document.getElementById('vote-details').innerHTML = voteDetails.map(v => `<div>${v.voter} ➔ ${v.votedFor}</div>`).join('');
  
  const btn = document.getElementById('next-question-btn');
  btn.textContent = isLastQuestion ? 'Fin de partie' : 'Suivante';
  btn.classList.toggle('hidden', !state.isHost);
  document.getElementById('waiting-next').classList.toggle('hidden', state.isHost);
  
  showScreen('results');
});

socket.on('gameEnded', ({ results }) => {
  const container = document.getElementById('final-results');
  container.innerHTML = results.map((r, i) => `
    <div class="final-result-item">
      <h4>Q${i+1}: ${r.question}</h4>
      <div>Gagnant: ${r.winners.join(', ')} (${r.votes} votes)</div>
    </div>
  `).join('');
  document.getElementById('restart-btn').classList.toggle('hidden', !state.isHost);
  showScreen('end');
});

// --- Undercover Logic ---
function updateUndercoverTurn(playerId) {
  const isMe = playerId === state.playerId;
  const player = state.players.find(p => p.id === playerId);
  
  document.getElementById('current-player-name').textContent = isMe ? "C'est à TOI !" : player.name;
  document.getElementById('hint-action-section').classList.toggle('hidden', !isMe);
  document.getElementById('waiting-hint-section').classList.toggle('hidden', isMe);
}

socket.on('hintGiven', (data) => {
  const list = document.getElementById('hints-given-list');
  list.innerHTML += `<li>💬 ${data.playerName} a donné son indice</li>`;
  document.getElementById('hints-count').textContent = data.hintsCount;
  document.getElementById('hints-total').textContent = data.totalPlayers;
  updateUndercoverTurn(data.nextPlayerId);
});

socket.on('undercoverVotePhase', ({ players }) => {
  state.hasVoted = false;
  document.getElementById('uc-votes-count').textContent = '0';
  document.getElementById('uc-total-players').textContent = players.length;
  document.getElementById('uc-voted-message').classList.add('hidden');
  
  const grid = document.getElementById('uc-players-vote-grid');
  grid.innerHTML = players.map((p, i) => `
    <div class="player-card" data-id="${p.id}">
      <div class="player-avatar">${getAvatar(i)}</div>
      <div class="player-name">${p.name}</div>
    </div>
  `).join('');

  grid.querySelectorAll('.player-card').forEach(card => {
    card.addEventListener('click', () => {
      if (state.hasVoted) return;
      state.hasVoted = true;
      socket.emit('vote', card.dataset.id);
      card.classList.add('selected');
      document.getElementById('uc-voted-message').classList.remove('hidden');
    });
  });
  
  showScreen('undercoverVote');
});

socket.on('undercoverVoteReceived', ({ totalVotes }) => {
  document.getElementById('uc-votes-count').textContent = totalVotes;
});

socket.on('undercoverElimination', (data) => {
  const display = document.getElementById('eliminated-player-display');
  const roleText = data.wasMrWhite ? 'Mr. White' : (data.wasUndercover ? 'Undercover' : 'Civil');
  display.innerHTML = `<div class="eliminated-name">${data.eliminatedPlayer}</div><div>était ${roleText}</div>`;
  showScreen('undercoverElimination');
});

socket.on('mrWhiteGuess', () => {
  showScreen('mrwhiteGuess');
});

socket.on('undercoverNewRound', (data) => {
  document.getElementById('uc-round-number').textContent = data.roundNumber;
  document.getElementById('hints-given-list').innerHTML = '';
  document.getElementById('hint-done-btn').disabled = false;
  updateUndercoverTurn(data.currentPlayerId);
  showScreen('undercoverGame');
});

socket.on('undercoverGameEnd', (data) => {
  document.getElementById('uc-end-title').textContent = data.winner === 'civils' ? '🎉 Victoire des Civils' : '🕵️ Victoire des Imposteurs';
  document.getElementById('uc-end-message').textContent = data.message;
  
  document.getElementById('civil-word').textContent = data.wordPair[0];
  document.getElementById('undercover-word').textContent = data.wordPair[1];
  
  const list = document.getElementById('roles-list');
  list.innerHTML = data.allPlayers.map(p => `<li>${p.name} - <strong>${p.role}</strong> (${p.word})</li>`).join('');
  
  document.getElementById('uc-restart-btn').classList.toggle('hidden', !state.isHost);
  showScreen('undercoverEnd');
});

// --- Roulette Online Logic ---
socket.on('rouletteSpinResult', (data) => {
  // Si c'est moi qui ai tourné, j'ai déjà vu l'animation
  if (data.spinnerId === state.playerId) return;

  // Animation pour l'adversaire
  // On doit trouver l'angle pour atterrir sur le bon segment envoyé par le serveur
  const wheel = document.getElementById('roulette-wheel');
  const segmentIndex = wheelSegments.findIndex(s => s.name === data.segment.name); // Simple match by name
  
  const segmentAngle = 360 / wheelSegments.length;
  const stopAngle = 360 - ((segmentIndex * segmentAngle) + (segmentAngle / 2));
  const rotations = 360 * 5;
  const currentRot = state.currentWheelRotation % 360;
  const targetRotation = state.currentWheelRotation + rotations + (stopAngle - currentRot);
  
  state.currentWheelRotation = targetRotation;
  wheel.style.transform = `rotate(${targetRotation}deg)`;
  
  setTimeout(() => {
    showRouletteResult(data.segment, data.gage);
  }, 4000);
});

socket.on('roulettePlayerLeft', () => {
  showToast("L'adversaire est parti", 'error');
  setTimeout(() => location.reload(), 2000);
});

// --- Restart ---
socket.on('gameRestarted', ({ players }) => {
  state.players = players;
  state.hasVoted = false;
  state.hasSubmittedQuestions = false;
  
  // Reset forms UI
  const submitBtn = document.getElementById('submit-questions-btn');
  if(submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Envoyer';
  }
  
  updatePlayersList();
  showScreen('lobby');
});

socket.on('error', ({ message }) => showToast(message, 'error'));