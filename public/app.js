const socket = io();

// État de l'application
let state = {
  playerId: null,
  playerName: null,
  roomCode: null,
  isHost: false,
  gameType: 'hotseat',
  players: [],
  hasVoted: false,
  myWord: null,
  myRole: null
};

// Éléments DOM
const screens = {
  home: document.getElementById('home-screen'),
  lobby: document.getElementById('lobby-screen'),
  game: document.getElementById('game-screen'),
  results: document.getElementById('results-screen'),
  end: document.getElementById('end-screen'),
  // Undercover screens
  undercoverRole: document.getElementById('undercover-role-screen'),
  undercoverGame: document.getElementById('undercover-game-screen'),
  undercoverVote: document.getElementById('undercover-vote-screen'),
  undercoverElimination: document.getElementById('undercover-elimination-screen'),
  mrwhiteGuess: document.getElementById('mrwhite-guess-screen'),
  undercoverEnd: document.getElementById('undercover-end-screen')
};

// Avatars aléatoires
const avatars = ['😀', '😎', '🥳', '🤩', '😺', '🦊', '🐻', '🐼', '🐨', '🦁', '🐸', '🐙', '🦋', '🐢', '🦄', '🐳', '🦜', '🦔', '🐲', '🎃'];

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
      <p>🕵️ <strong>Undercover</strong> - Trouvez l'imposteur !</p>
      <ul>
        <li>Chaque joueur reçoit un mot secret</li>
        <li>Les Undercovers ont un mot légèrement différent</li>
        <li>À tour de rôle, donnez un indice sur votre mot</li>
        <li>Votez pour éliminer celui que vous pensez être l'imposteur</li>
        <li>Civils gagnent si tous les Undercovers sont éliminés</li>
        <li>Undercovers gagnent s'ils deviennent majoritaires</li>
      </ul>
    `;
  } else {
    rulesContent.innerHTML = `
      <p>🔥 <strong>Hot Seat</strong> - Qui est le plus susceptible de...?</p>
      <ul>
        <li>Une question apparaît</li>
        <li>Tout le monde vote pour la personne qui correspond le mieux</li>
        <li>Les résultats sont révélés quand tout le monde a voté</li>
      </ul>
    `;
  }
}

// ==================== SÉLECTION DU JEU (PAGE D'ACCUEIL) ====================

// Gestion de la sélection du jeu sur la page d'accueil
document.querySelectorAll('.game-option').forEach(option => {
  option.addEventListener('click', () => {
    // Retirer la classe selected de tous
    document.querySelectorAll('.game-option').forEach(opt => {
      opt.classList.remove('selected');
    });
    // Ajouter la classe selected à celui cliqué
    option.classList.add('selected');
    // Cocher le radio button
    const radio = option.querySelector('input[type="radio"]');
    if (radio) {
      radio.checked = true;
      state.gameType = radio.value;
    }
  });
});

// ==================== SÉLECTION DU JEU (LOBBY - HÔTE) ====================

document.querySelectorAll('.game-option-small').forEach(option => {
  option.addEventListener('click', () => {
    document.querySelectorAll('.game-option-small').forEach(opt => {
      opt.classList.remove('selected');
    });
    option.classList.add('selected');
    const radio = option.querySelector('input[type="radio"]');
    if (radio) {
      radio.checked = true;
      state.gameType = radio.value;
      socket.emit('changeGameType', radio.value);
      updateGameDisplay(radio.value);
      updateRulesDisplay(radio.value);
    }
  });
});

function updateGameDisplay(gameType) {
  const icon = document.getElementById('current-game-icon');
  const name = document.getElementById('current-game-name');
  if (gameType === 'undercover') {
    icon.textContent = '🕵️';
    name.textContent = 'Undercover';
  } else {
    icon.textContent = '🔥';
    name.textContent = 'Hot Seat';
  }
}

// ==================== ÉVÉNEMENTS DU FORMULAIRE ====================

document.getElementById('create-room-btn').addEventListener('click', () => {
  const name = document.getElementById('player-name').value.trim();
  if (! name) {
    showToast('Entre ton prénom ! ', 'error');
    return;
  }
  const selectedGame = document.querySelector('input[name="game"]:checked');
  state.gameType = selectedGame ?  selectedGame.value :  'hotseat';
  state.playerName = name;
  socket.emit('createRoom', { playerName: name, gameType: state.gameType });
});

document.getElementById('join-room-btn').addEventListener('click', () => {
  const joinForm = document.getElementById('join-form');
  joinForm.classList.toggle('hidden');
});

document.getElementById('confirm-join-btn').addEventListener('click', () => {
  const name = document.getElementById('player-name').value.trim();
  const code = document.getElementById('room-code').value.trim().toUpperCase();
  
  if (! name) {
    showToast('Entre ton prénom !', 'error');
    return;
  }
  if (!code) {
    showToast('Entre le code de la partie !', 'error');
    return;
  }
  
  state.playerName = name;
  socket.emit('joinRoom', { roomCode: code, playerName: name });
});

document.getElementById('copy-code-btn').addEventListener('click', () => {
  navigator.clipboard.writeText(state.roomCode);
  showToast('Code copié ! ', 'success');
});

document.getElementById('start-game-btn').addEventListener('click', () => {
  socket.emit('startGame');
});

document.getElementById('next-question-btn').addEventListener('click', () => {
  socket.emit('nextQuestion');
});

document.getElementById('restart-btn').addEventListener('click', () => {
  socket.emit('restartGame');
});

document.getElementById('home-btn').addEventListener('click', () => {
  location.reload();
});

// Undercover buttons
document.getElementById('ready-btn')?.addEventListener('click', () => {
  showScreen('undercoverGame');
});

document.getElementById('submit-hint-btn')?.addEventListener('click', () => {
  const hintInput = document.getElementById('hint-input');
  const hint = hintInput.value.trim();
  if (! hint) {
    showToast('Entre un indice !', 'error');
    return;
  }
  socket.emit('giveHint', hint);
  hintInput.value = '';
});

document.getElementById('hint-input')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('submit-hint-btn').click();
  }
});

document.getElementById('mrwhite-guess-btn')?.addEventListener('click', () => {
  const guessInput = document.getElementById('mrwhite-guess-input');
  const guess = guessInput.value.trim();
  if (!guess) {
    showToast('Entre un mot !', 'error');
    return;
  }
  socket.emit('mrWhiteGuessWord', guess);
});

document.getElementById('uc-restart-btn')?.addEventListener('click', () => {
  socket.emit('restartGame');
});

document.getElementById('uc-home-btn')?.addEventListener('click', () => {
  location.reload();
});

// ==================== SOCKET.IO - ÉVÉNEMENTS COMMUNS ====================

socket.on('roomCreated', ({ roomCode, playerId, gameType, players }) => {
  state.roomCode = roomCode;
  state.playerId = playerId;
  state.isHost = true;
  state.gameType = gameType;
  state.players = players;
  
  document.getElementById('display-room-code').textContent = roomCode;
  document.getElementById('host-controls').classList.remove('hidden');
  document.getElementById('waiting-message').classList.add('hidden');
  
  // Sélectionner le bon jeu dans le lobby
  document.querySelectorAll('.game-option-small').forEach(opt => {
    opt.classList.remove('selected');
    const radio = opt.querySelector('input[type="radio"]');
    if (radio && radio.value === gameType) {
      opt.classList.add('selected');
      radio.checked = true;
    }
  });
  
  updateGameDisplay(gameType);
  updateRulesDisplay(gameType);
  updatePlayersList();
  showScreen('lobby');
  showToast('Partie créée !', 'success');
});

socket.on('roomJoined', ({ roomCode, playerId, gameType, players }) => {
  state.roomCode = roomCode;
  state.playerId = playerId;
  state.isHost = false;
  state.gameType = gameType;
  state.players = players;
  
  document.getElementById('display-room-code').textContent = roomCode;
  document.getElementById('host-controls').classList.add('hidden');
  document.getElementById('waiting-message').classList.remove('hidden');
  
  updateGameDisplay(gameType);
  updateRulesDisplay(gameType);
  updatePlayersList();
  showScreen('lobby');
  showToast('Tu as rejoint la partie ! ', 'success');
});

socket.on('playerJoined', ({ players }) => {
  state.players = players;
  updatePlayersList();
});

socket.on('playerLeft', ({ players }) => {
  state.players = players;
  const me = players.find(p => p.id === state.playerId);
  if (me && me.isHost && ! state.isHost) {
    state.isHost = true;
    document.getElementById('host-controls').classList.remove('hidden');
    document.getElementById('waiting-message').classList.add('hidden');
    showToast('Tu es maintenant l\'hôte ! ', 'success');
  }
  updatePlayersList();
});

socket.on('gameTypeChanged', ({ gameType }) => {
  state.gameType = gameType;
  updateGameDisplay(gameType);
  updateRulesDisplay(gameType);
  
  document.querySelectorAll('.game-option-small').forEach(opt => {
    opt.classList.remove('selected');
    const radio = opt.querySelector('input[type="radio"]');
    if (radio && radio.value === gameType) {
      opt.classList.add('selected');
      radio.checked = true;
    }
  });
});

socket.on('gameStarted', (data) => {
  if (data.gameType === 'undercover') {
    startUndercoverGame(data);
  } else {
    startHotSeatGame(data);
  }
});

socket.on('gameRestarted', ({ players }) => {
  state.players = players;
  state.hasVoted = false;
  state.myWord = null;
  state.myRole = null;
  updatePlayersList();
  showScreen('lobby');
  showToast('Nouvelle partie ! ', 'success');
});

socket.on('error', ({ message }) => {
  showToast(message, 'error');
});

// ==================== HOT SEAT ====================

function startHotSeatGame(data) {
  state.players = data.players;
  state.hasVoted = false;
  showQuestion(data.question, data.questionNumber, data.totalQuestions);
  showScreen('game');
}

socket.on('newQuestion', ({ question, questionNumber, totalQuestions, players }) => {
  state.players = players;
  state.hasVoted = false;
  showQuestion(question, questionNumber, totalQuestions);
  showScreen('game');
});

socket.on('voteReceived', ({ totalVotes, totalPlayers }) => {
  document.getElementById('votes-count').textContent = totalVotes;
});

socket.on('questionResults', ({ winners, votes, voteDetails, isLastQuestion }) => {
  showResults(winners, votes, voteDetails, isLastQuestion);
  showScreen('results');
});

socket.on('gameEnded', ({ results }) => {
  showFinalResults(results);
  showScreen('end');
});

function updatePlayersList() {
  const list = document.getElementById('players-list');
  const count = document.getElementById('player-count');
  
  count.textContent = state.players.length;
  list.innerHTML = state.players.map((player, index) => `
    <li class="${player.isHost ? 'host' : ''} ${player.isAlive === false ? 'eliminated' : ''}">
      ${getAvatar(index)} ${player.name}
      ${player.id === state.playerId ? ' (toi)' : ''}
    </li>
  `).join('');
}

function showQuestion(question, number, total) {
  document.getElementById('question-number').textContent = `Question ${number}/${total}`;
  document.getElementById('question-text').textContent = question;
  document.getElementById('votes-count').textContent = '0';
  document.getElementById('total-players').textContent = state.players.length;
  document.getElementById('voted-message').classList.add('hidden');
  
  const grid = document.getElementById('players-vote-grid');
  grid.innerHTML = state.players.map((player, index) => `
    <div class="player-card" data-player-id="${player.id}">
      <div class="player-avatar">${getAvatar(index)}</div>
      <div class="player-name">${player.name}</div>
    </div>
  `).join('');
  
  grid.querySelectorAll('.player-card').forEach(card => {
    card.addEventListener('click', () => {
      if (state.hasVoted) return;
      
      const odId = card.dataset.playerId;
      state.hasVoted = true;
      
      grid.querySelectorAll('.player-card').forEach(c => c.classList.add('voted'));
      card.classList.add('selected');
      
      document.getElementById('voted-message').classList.remove('hidden');
      socket.emit('vote', odId);
    });
  });
}

function showResults(winners, votes, voteDetails, isLastQuestion) {
  const winnerDisplay = document.getElementById('winner-display');
  winnerDisplay.innerHTML = winners.map(w => `<div>🎉 ${w}</div>`).join('');
  
  const detailsDiv = document.getElementById('vote-details');
  detailsDiv.innerHTML = voteDetails.map(v => `
    <div class="vote-detail">
      ${v.voter} → ${v.votedFor}
    </div>
  `).join('');
  
  const nextBtn = document.getElementById('next-question-btn');
  const waitingNext = document.getElementById('waiting-next');
  
  if (isLastQuestion) {
    nextBtn.textContent = 'Voir les résultats finaux 🏆';
  } else {
    nextBtn.textContent = 'Question suivante ➡️';
  }
  
  if (state.isHost) {
    nextBtn.classList.remove('hidden');
    waitingNext.classList.add('hidden');
  } else {
    nextBtn.classList.add('hidden');
    waitingNext.classList.remove('hidden');
  }
}

function showFinalResults(results) {
  const container = document.getElementById('final-results');
  container.innerHTML = results.map((r, i) => `
    <div class="final-result-item">
      <h4>Q${i + 1}:  ${r.question}</h4>
      <div class="winner">🏆 ${r.winners.join(', ')} (${r.votes} votes)</div>
    </div>
  `).join('');
  
  if (state.isHost) {
    document.getElementById('restart-btn').classList.remove('hidden');
  }
}

// ==================== UNDERCOVER ====================

function startUndercoverGame(data) {
  state.players = data.players;
  state.myWord = data.yourWord;
  state.myRole = data.yourRole;
  state.hasVoted = false;
  
  // Afficher l'écran de rôle
  const roleCard = document.getElementById('role-card');
  const roleIcon = document.getElementById('role-icon');
  const roleName = document.getElementById('role-name');
  const secretWord = document.getElementById('secret-word');
  const roleTip = document.getElementById('role-tip');
  
  roleCard.className = 'role-card ' + data.yourRole;
  
  if (data.yourRole === 'civil') {
    roleIcon.textContent = '👤';
    roleName.textContent = 'Civil';
    roleTip.textContent = '💡 Donne des indices subtils pour prouver que tu as le bon mot, sans trop en révéler !';
  } else if (data.yourRole === 'undercover') {
    roleIcon.textContent = '🕵️';
    roleName.textContent = 'Undercover';
    roleTip.textContent = '💡 Fais semblant d\'avoir le même mot que les autres !  Sois discret...';
  } else {
    roleIcon.textContent = '🎭';
    roleName.textContent = 'Mr.White';
    roleTip.textContent = '💡 Tu ne connais pas le mot !  Écoute les indices et bluff...';
  }
  
  secretWord.textContent = data.yourWord;
  document.getElementById('reminder-word').textContent = data.yourWord;
  
  showScreen('undercoverRole');
}

socket.on('hintGiven', ({ playerId, playerName, hint, nextPlayerId, hints }) => {
  updateHintsList(hints);
  updateCurrentPlayer(nextPlayerId);
});

socket.on('undercoverVotePhase', ({ hints, players, roundNumber }) => {
  state.players = players;
  state.hasVoted = false;
  
  // Afficher les indices
  const hintsList = document.getElementById('vote-hints-list');
  hintsList.innerHTML = hints.map(h => `
    <li>
      <span class="hint-player">${h.playerName}</span>
      <span class="hint-text">"${h.hint}"</span>
    </li>
  `).join('');
  
  // Afficher la grille de vote
  document.getElementById('uc-votes-count').textContent = '0';
  document.getElementById('uc-total-players').textContent = players.length;
  document.getElementById('uc-voted-message').classList.add('hidden');
  
  const grid = document.getElementById('uc-players-vote-grid');
  grid.innerHTML = players.map((player, index) => `
    <div class="player-card" data-player-id="${player.id}">
      <div class="player-avatar">${getAvatar(index)}</div>
      <div class="player-name">${player.name}</div>
    </div>
  `).join('');
  
  grid.querySelectorAll('.player-card').forEach(card => {
    card.addEventListener('click', () => {
      if (state.hasVoted) return;
      
      const odId = card.dataset.playerId;
      state.hasVoted = true;
      
      grid.querySelectorAll('.player-card').forEach(c => c.classList.add('voted'));
      card.classList.add('selected');
      
      document.getElementById('uc-voted-message').classList.remove('hidden');
      socket.emit('vote', odId);
    });
  });
  
  showScreen('undercoverVote');
});

socket.on('undercoverVoteReceived', ({ totalVotes, totalPlayers }) => {
  document.getElementById('uc-votes-count').textContent = totalVotes;
});

socket.on('undercoverElimination', ({ eliminatedPlayer, wasUndercover, wasMrWhite, voteDetails, remainingPlayers }) => {
  state.players = remainingPlayers;
  
  const display = document.getElementById('eliminated-player-display');
  let roleText = 'Civil';
  let roleClass = 'civil';
  if (wasUndercover) {
    roleText = 'Undercover ! ';
    roleClass = 'undercover';
  } else if (wasMrWhite) {
    roleText = 'Mr.White ! ';
    roleClass = 'mrwhite';
  }
  
  display.innerHTML = `
    <div class="player-name">${eliminatedPlayer}</div>
    <div class="role-reveal ${roleClass}">était ${roleText}</div>
  `;
  
  const detailsDiv = document.getElementById('elimination-vote-details');
  detailsDiv.innerHTML = voteDetails.map(v => `
    <div class="vote-detail">
      ${v.voter} → ${v.votedFor}
    </div>
  `).join('');
  
  showScreen('undercoverElimination');
});

socket.on('undercoverTie', ({ message, tiedPlayers }) => {
  showToast(message, 'info');
});

socket.on('undercoverNewRound', ({ roundNumber, currentPlayerId, players }) => {
  state.players = players;
  state.hasVoted = false;
  
  document.getElementById('uc-round-number').textContent = roundNumber;
  document.getElementById('alive-count').textContent = players.length;
  document.getElementById('hints-list').innerHTML = '';
  
  updateCurrentPlayer(currentPlayerId);
  showScreen('undercoverGame');
});

socket.on('mrWhiteEliminated', ({ playerName, message }) => {
  showToast(message, 'info');
});

socket.on('mrWhiteGuess', ({ message }) => {
  showScreen('mrwhiteGuess');
});

socket.on('mrWhiteGuessFailed', ({ message }) => {
  showToast(message, 'error');
});

socket.on('undercoverGameEnd', ({ winner, message, wordPair, allPlayers }) => {
  document.getElementById('uc-end-title').textContent = 
    winner === 'civils' ? '🎉 Victoire des Civils !' : 
    winner === 'mrwhite' ? '🎭 Mr.White a gagné !' : 
    '🕵️ Victoire des Undercovers !';
  
  document.getElementById('uc-end-message').textContent = message;
  document.getElementById('civil-word').textContent = wordPair[0];
  document.getElementById('undercover-word').textContent = wordPair[1];
  
  const rolesList = document.getElementById('roles-list');
  rolesList.innerHTML = allPlayers.map(p => `
    <li>
      <span>${p.name}</span>
      <span class="role-badge ${p.role.toLowerCase().replace(' ', '')}">${p.role}</span>
    </li>
  `).join('');
  
  if (state.isHost) {
    document.getElementById('uc-restart-btn').classList.remove('hidden');
  }
  
  showScreen('undercoverEnd');
});

socket.on('playerDisconnected', ({ playerName, players }) => {
  state.players = players;
  showToast(`${playerName} a quitté la partie`, 'error');
});

function updateHintsList(hints) {
  const list = document.getElementById('hints-list');
  list.innerHTML = hints.map(h => `
    <li class="hint-item">
      <span class="player-name">${h.playerName}</span>
      <span class="hint-text">"${h.hint}"</span>
    </li>
  `).join('');
}

function updateCurrentPlayer(currentPlayerId) {
  const currentPlayer = state.players.find(p => p.id === currentPlayerId);
  const nameDisplay = document.getElementById('current-player-name');
  const hintSection = document.getElementById('hint-input-section');
  
  if (currentPlayer) {
    nameDisplay.textContent = currentPlayer.name;
    
    if (currentPlayerId === state.playerId) {
      nameDisplay.textContent = 'TOI ! ';
      nameDisplay.classList.add('you');
      hintSection.classList.remove('hidden');
    } else {
      nameDisplay.classList.remove('you');
      hintSection.classList.add('hidden');
    }
  }
  
  document.getElementById('alive-count').textContent = state.players.length;
}