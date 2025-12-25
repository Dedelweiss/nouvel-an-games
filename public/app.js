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
let wheelSegments = []
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
    // On ne change pas state.gameType ici, on attend la confirmation du serveur
    socket.emit('changeGameType', val);
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
  const inputs = document.querySelectorAll('.custom-q-input');
  const questions = [];

  inputs.forEach(input => {
    const val = input.value.trim();
    if (val) {
        // Ajoute le préfixe si l'utilisateur ne l'a pas mis (optionnel mais sympa)
        // const fullQ = val.toLowerCase().startsWith('qui') ? val : `Qui est le plus susceptible de ${val}`;
        questions.push(val);
    }
  });
  
  socket.emit('submitQuestions', { questions });
  
  // UI Feedback
  const btn = document.getElementById('submit-questions-btn');
  btn.disabled = true;
  btn.textContent = '✅ Questions envoyées !';
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
document.getElementById('spin-wheel-btn')?.addEventListener('click', () => {
  document.getElementById('spin-wheel-btn').disabled = true;
  socket.emit('requestSpin');
});
document.getElementById('spin-again-btn')?.addEventListener('click', () => {
  const btn = document.getElementById('spin-again-btn');
  // 1. Je désactive mon bouton tout de suite pour éviter le double-clic
  btn.disabled = true;
  btn.textContent = 'Attente...';
  
  // 2. Je demande au serveur de relancer pour tout le monde
  socket.emit('requestNextTurn');
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

// ==================== LOGIQUE ROULETTE (SYNC) ====================

// Cet événement est reçu par TOUS les joueurs en même temps
socket.on('rouletteSpinStart', (data) => {
  // SECURITE : Si wheelSegments est vide (bug de chargement), on évite le crash
  if (!wheelSegments || wheelSegments.length === 0) {
      console.error("Erreur critique : Données de la roue manquantes !");
      showToast("Erreur de chargement. Veuillez rafraîchir.", "error");
      return;
  }

  const wheel = document.getElementById('roulette-wheel');
  const btn = document.getElementById('spin-wheel-btn');
  
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'La roue tourne...';
  }

  const segmentAngle = 360 / wheelSegments.length;
  // Calcul protégé
  const stopAngle = 360 - ((data.segmentIndex * segmentAngle) + (segmentAngle / 2)); 
  const randomOffset = (Math.random() * 10) - 5; 
  const rotations = 360 * 5;
  const currentRot = state.currentWheelRotation % 360;
  const targetRotation = state.currentWheelRotation + rotations + (stopAngle - currentRot) + randomOffset;
  
  state.currentWheelRotation = targetRotation;
  wheel.style.transform = `rotate(${targetRotation}deg)`;

  setTimeout(() => {
    showRouletteResult(data.segment, data.gage);
    // On ne reset PAS le bouton ici, on attend le "Rejouer" ou le "Next Turn"
  }, 4000);
});

socket.on('rouletteResetUI', () => {
  // 1. Cacher les résultats
  document.getElementById('roulette-result').classList.add('hidden');
  document.getElementById('roulette-actions').classList.add('hidden');
  
  // 2. Réafficher le bouton Tourner
  const spinBtn = document.getElementById('spin-wheel-btn');
  spinBtn.classList.remove('hidden');
  spinBtn.disabled = false;
  spinBtn.textContent = '🎰 Tourner la roue !';
  
  // 3. Réinitialiser le bouton Rejouer (pour la prochaine fois)
  const replayBtn = document.getElementById('spin-again-btn');
  if (replayBtn) {
    replayBtn.disabled = false;
    replayBtn.textContent = '🔄 Rejouer';
  }
});

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
  handleRoomConnection(data);
});

socket.on('roomJoined', (data) => {
  handleRoomConnection(data);
});

function handleRoomConnection(data) {
  state.roomCode = data.roomCode;
  state.playerId = data.playerId;
  state.gameType = data.gameType;
  state.players = data.players;
  state.isHost = (data.players[0].id === state.playerId);

  if (data.wheelConfig) {
    wheelSegments = data.wheelConfig;
  }
  if (state.gameType === 'undercover' && state.isHost) {
    document.getElementById('undercover-options').classList.remove('hidden');
  } else {
    document.getElementById('undercover-options').classList.add('hidden');
  }

  // === LOGIQUE ROULETTE ===
  if (data.gameType === 'roulette') {
     state.rouletteMode = 'online';
     document.getElementById('roulette-room-code').textContent = data.roomCode;
     
     // 1. Mise à jour des Noms (Slots)
     const p1 = data.players[0];
     const p2 = data.players[1];

     if (p1) {
       state.roulettePlayer1 = p1.name;
       document.getElementById('roulette-slot-1-name').textContent = p1.name;
       document.getElementById('roulette-slot-1').classList.add('ready');
     }
     if (p2) {
       state.roulettePlayer2 = p2.name;
       document.getElementById('roulette-slot-2-name').textContent = p2.name;
       document.getElementById('roulette-slot-2').classList.add('ready');
     } else {
       document.getElementById('roulette-slot-2-name').textContent = 'En attente...';
       document.getElementById('roulette-slot-2').classList.remove('ready');
     }

     // 2. Gestion du Message d'attente et du Bouton Start
     const waitingMsg = document.getElementById('roulette-waiting-message');
     const startBtn = document.getElementById('roulette-online-start-btn');

     if (data.players.length >= 2) {
       // --- IL Y A 2 JOUEURS ---
       if (state.isHost) {
         // Je suis l'hôte : Je vois le bouton Start, pas de message
         startBtn.classList.remove('hidden');
         waitingMsg.classList.add('hidden');
       } else {
         // Je suis l'invité : Je ne vois pas le bouton, je vois le message d'attente hôte
         startBtn.classList.add('hidden');
         waitingMsg.textContent = "En attente de l'hôte pour démarrer la partie...";
         waitingMsg.classList.remove('hidden');
       }
     } else {
       // --- IL MANQUE UN JOUEUR ---
       startBtn.classList.add('hidden');
       waitingMsg.textContent = "En attente d'un adversaire...";
       waitingMsg.classList.remove('hidden');
     }

     showScreen('rouletteOnlineLobby');
     return; 
  }
  // ============================

  // ... (Le reste du code pour HotSeat/Undercover reste inchangé)
  document.getElementById('display-room-code').textContent = data.roomCode;
  if (state.isHost) {
      document.getElementById('host-controls').classList.remove('hidden');
      document.getElementById('waiting-message').classList.add('hidden');
  } else {
      document.getElementById('host-controls').classList.add('hidden');
      document.getElementById('waiting-message').classList.remove('hidden');
  }
  if (state.gameType === 'hotseat' && state.isHost) {
      document.getElementById('hotseat-options').classList.remove('hidden');
  } else {
      document.getElementById('hotseat-options').classList.add('hidden');
  }
  updatePlayersList();
  updateRulesDisplay(data.gameType);
  checkGameAvailability();
  showScreen('lobby');
}

socket.on('playerJoined', ({ players }) => {
  state.players = players;
  updatePlayersList();
  checkGameAvailability();
  
  // === LOGIQUE ROULETTE ===
  if (state.gameType === 'roulette' && state.rouletteMode === 'online') {
      const waitingMsg = document.getElementById('roulette-waiting-message');
      const startBtn = document.getElementById('roulette-online-start-btn');
      
      // Mise à jour du Slot 2
      if (players[1]) {
          state.roulettePlayer2 = players[1].name;
          document.getElementById('roulette-slot-2-name').textContent = players[1].name;
          document.getElementById('roulette-slot-2').classList.add('ready');
          
          // PARTIE COMPLÈTE (2 JOUEURS)
          if(state.isHost) {
            startBtn.classList.remove('hidden');
            waitingMsg.classList.add('hidden');
          } else {
            startBtn.classList.add('hidden');
            waitingMsg.textContent = "En attente de l'hôte pour démarrer la partie...";
            waitingMsg.classList.remove('hidden');
          }
      } else {
          // JOUEUR 2 PARTI
          document.getElementById('roulette-slot-2-name').textContent = 'En attente...';
          document.getElementById('roulette-slot-2').classList.remove('ready');
          
          startBtn.classList.add('hidden');
          waitingMsg.textContent = "En attente d'un adversaire...";
          waitingMsg.classList.remove('hidden');
      }
  }
  // ============================
});

socket.on('playerLeft', ({ players }) => {
  state.players = players;
  updatePlayersList();
  checkGameAvailability();
});

socket.on('gameTypeChanged', (data) => {
  state.gameType = data.gameType;
  
  if (data.wheelConfig) {
    wheelSegments = data.wheelConfig;
  }

  updateRulesDisplay(data.gameType);
  checkGameAvailability();

  document.querySelectorAll('.game-option-small input').forEach(input => {
    if (input.value === data.gameType) input.parentElement.classList.add('selected');
    else input.parentElement.classList.remove('selected');
  });

  if (state.gameType === 'undercover' && state.isHost) {
    document.getElementById('undercover-options').classList.remove('hidden');
  } else {
    document.getElementById('undercover-options').classList.add('hidden');
  }

  if (data.gameType === 'hotseat' && state.isHost) {
      document.getElementById('hotseat-options').classList.remove('hidden');
  } else {
      document.getElementById('hotseat-options').classList.add('hidden');
  }
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
    if (data.wheelConfig) {
      wheelSegments = data.wheelConfig;
    }
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
  
  document.getElementById('alive-count').textContent = data.players.length;
  document.getElementById('hints-given-list').innerHTML = '';
  document.getElementById('hint-done-btn').disabled = false;
  
  updateUndercoverTurn(data.currentPlayerId);
  showScreen('undercoverGame');
});

socket.on('playerDisconnected', ({ playerName, players }) => {
  state.players = players;
  
  if (state.gameType === 'undercover' && document.getElementById('undercover-game-screen').classList.contains('active')) {
      const aliveCount = players.filter(p => p.isAlive).length;
      document.getElementById('alive-count').textContent = aliveCount;
  }
  
  showToast(`${playerName} a quitté la partie`, 'error');
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

socket.on('roulettePlayerLeft', () => {
  showToast("L'adversaire est parti", 'error');
  setTimeout(() => location.reload(), 2000);
});

socket.on('gameRestarted', ({ players }) => {
  state.players = players;
  state.hasVoted = false;
  state.hasSubmittedQuestions = false;
  
  // --- CORRECTION 1 : Réinitialiser le formulaire de questions ---
  const submitBtn = document.getElementById('submit-questions-btn');
  if(submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = '📤 Valider mes 3 questions';
  }
  
  // Vider les champs de texte
  document.querySelectorAll('.custom-q-input').forEach(input => input.value = '');

  // --- CORRECTION 2 : Vider la liste des joueurs qui ont validé ---
  const list = document.getElementById('submitted-players-list');
  if (list) list.innerHTML = ''; // <--- C'est la ligne qui manquait !
  
  document.getElementById('questions-submitted-count').textContent = '0';

  // Mise à jour classique
  updatePlayersList();
  showScreen('lobby');
  showToast("🔄 Une nouvelle partie va commencer !", "success");
});

// public/app.js

// Gestion du nombre d'Undercovers
let desiredUcCount = 1;

document.getElementById('btn-less-uc')?.addEventListener('click', () => {
  if (desiredUcCount > 1) {
    desiredUcCount--;
    document.getElementById('uc-count-display').textContent = desiredUcCount;
  }
});

document.getElementById('btn-more-uc')?.addEventListener('click', () => {
  // Règle : Max la moitié des joueurs moins 1 (pour laisser de la place aux civils)
  const maxUc = Math.max(1, Math.floor((state.players.length - 1) / 2));
  
  if (desiredUcCount < maxUc) {
    desiredUcCount++;
    document.getElementById('uc-count-display').textContent = desiredUcCount;
  } else {
    showToast(`Maximum ${maxUc} imposteurs pour ${state.players.length} joueurs`, 'info');
  }
});

// MODIFIER LE START GAME pour envoyer les réglages
document.getElementById('start-game-btn').addEventListener('click', () => {
  const settings = {
    questionMode: state.questionMode, // pour HotSeat
    undercoverCount: desiredUcCount,  // Nouveau
    includeMrWhite: document.getElementById('mr-white-check').checked // Nouveau
  };
  socket.emit('startGame', settings);
});

socket.on('error', ({ message }) => showToast(message, 'error'));