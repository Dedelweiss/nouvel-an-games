const socket = io();

// État de l'application
let state = {
  playerId: null,
  playerName: null,
  roomCode: null,
  isHost: false,
  players: [],
  hasVoted: false
};

// Éléments DOM
const screens = {
  home: document.getElementById('home-screen'),
  lobby: document. getElementById('lobby-screen'),
  game: document.getElementById('game-screen'),
  results: document.getElementById('results-screen'),
  end: document.getElementById('end-screen')
};

// Fonction pour changer d'écran
function showScreen(screenName) {
  Object.values(screens).forEach(s => s.classList. remove('active'));
  screens[screenName].classList.add('active');
}

// Fonction pour afficher un toast
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast. classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

// Avatars aléatoires
const avatars = ['😀', '😎', '🥳', '🤩', '😺', '🦊', '🐻', '🐼', '🐨', '🦁', '🐸', '🐙'];
function getAvatar(index) {
  return avatars[index % avatars.length];
}

// === Événements du formulaire ===

document.getElementById('create-room-btn').addEventListener('click', () => {
  const name = document.getElementById('player-name').value. trim();
  if (! name) {
    showToast('Entre ton prénom ! ');
    return;
  }
  state.playerName = name;
  socket.emit('createRoom', name);
});

document.getElementById('join-room-btn').addEventListener('click', () => {
  const joinForm = document.getElementById('join-form');
  joinForm.classList.toggle('hidden');
});

document.getElementById('confirm-join-btn').addEventListener('click', () => {
  const name = document.getElementById('player-name').value.trim();
  const code = document.getElementById('room-code').value. trim().toUpperCase();
  
  if (! name) {
    showToast('Entre ton prénom !');
    return;
  }
  if (! code) {
    showToast('Entre le code de la partie !');
    return;
  }
  
  state.playerName = name;
  socket.emit('joinRoom', { roomCode: code, playerName: name });
});

document.getElementById('copy-code-btn').addEventListener('click', () => {
  navigator.clipboard.writeText(state.roomCode);
  showToast('Code copié ! ');
});

document.getElementById('start-game-btn').addEventListener('click', () => {
  socket. emit('startGame');
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

// === Événements Socket.IO ===

socket.on('roomCreated', ({ roomCode, playerId, players }) => {
  state.roomCode = roomCode;
  state.playerId = playerId;
  state.isHost = true;
  state. players = players;
  
  document.getElementById('display-room-code').textContent = roomCode;
  document. getElementById('start-game-btn').classList.remove('hidden');
  document.getElementById('waiting-message').classList.add('hidden');
  
  updatePlayersList();
  showScreen('lobby');
  showToast('Partie créée !');
});

socket.on('roomJoined', ({ roomCode, playerId, players }) => {
  state.roomCode = roomCode;
  state.playerId = playerId;
  state.isHost = false;
  state. players = players;
  
  document. getElementById('display-room-code').textContent = roomCode;
  
  updatePlayersList();
  showScreen('lobby');
  showToast('Tu as rejoint la partie ! ');
});

socket.on('playerJoined', ({ players }) => {
  state.players = players;
  updatePlayersList();
});

socket.on('playerLeft', ({ players }) => {
  state.players = players;
  // Vérifier si on est devenu l'hôte
  const me = players.find(p => p.id === state.playerId);
  if (me && me.isHost && ! state.isHost) {
    state.isHost = true;
    document.getElementById('start-game-btn').classList.remove('hidden');
    document.getElementById('waiting-message').classList.add('hidden');
    showToast('Tu es maintenant l\'hôte !');
  }
  updatePlayersList();
});

socket.on('gameStarted', ({ question, questionNumber, totalQuestions, players }) => {
  state.players = players;
  state.hasVoted = false;
  showQuestion(question, questionNumber, totalQuestions);
  showScreen('game');
});

socket.on('newQuestion', ({ question, questionNumber, totalQuestions, players }) => {
  state. players = players;
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

socket.on('gameRestarted', ({ players }) => {
  state.players = players;
  state.hasVoted = false;
  updatePlayersList();
  showScreen('lobby');
  showToast('Nouvelle partie ! ');
});

socket.on('error', ({ message }) => {
  showToast(message);
});

// === Fonctions d'affichage ===

function updatePlayersList() {
  const list = document.getElementById('players-list');
  const count = document.getElementById('player-count');
  
  count.textContent = state.players.length;
  list.innerHTML = state.players.map((player, index) => `
    <li class="${player.isHost ? 'host' : ''}">
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
  
  // Ajouter les événements de vote
  grid.querySelectorAll('.player-card').forEach(card => {
    card.addEventListener('click', () => {
      if (state.hasVoted) return;
      
      const playerId = card.dataset.playerId;
      state.hasVoted = true;
      
      // Marquer comme sélectionné
      grid.querySelectorAll('.player-card').forEach(c => c.classList. add('voted'));
      card.classList.add('selected');
      
      document.getElementById('voted-message').classList.remove('hidden');
      
      socket.emit('vote', playerId);
    });
  });
}

function showResults(winners, votes, voteDetails, isLastQuestion) {
  const winnerDisplay = document.getElementById('winner-display');
  winnerDisplay.innerHTML = winners.map(w => `<div>🎉 ${w}</div>`).join('');
  
  const detailsDiv = document.getElementById('vote-details');
  detailsDiv.innerHTML = voteDetails. map(v => `
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