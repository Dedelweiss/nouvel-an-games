const socket = io();

// État de l'application
let state = {
  playerId: null,
  playerName: null,
  roomCode: null,
  isHost: false,
  gameType: 'hotseat',
  questionMode: 'default',
  players:   [],
  hasVoted: false,
  hasSubmittedQuestions: false,
  myWord: null,
  myRole: null,
  // Roulette
  rouletteMode: null,
  roulettePlayer1: null,
  roulettePlayer2: null,
  rouletteScores: { player1: 0, player2: 0 },
  currentWheelRotation: 0
};

// Couleurs de la roue et leurs gages associés
const wheelSegments = [
  { 
    color: '#e74c3c', 
    name: '{player1} prend chère',
    gages: [
      "{player1} boit un verre !  🍺",
      "{player1} boit cul sec ! 🍾",
      "{player1} boit 2 gorgées ! 🍺🍺"
    ],
    target: 'player1',
    count: 1
  },
  { 
    color: '#f39c12', 
    name: '{player2} prend chère',
    gages: [
      "{player2} boit un verre ! 🍺",
      "{player2} boit cul sec ! 🍾",
      "{player2} boit 2 gorgées ! 🍺🍺"
    ],
    target: 'player2',
    count:  1
  },
  { 
    color: '#2ecc71', 
    name: 'Tranquillou',
    gages:  [
      "Personne ne boit !  😇 Chanceux !",
      "Tout le monde fait une pause ! ⏸️",
      "Zone libre !  Trinquez sans boire ! 🥂"
    ],
    target: 'none',
    count:  0
  },
  { 
    color: '#3498db', 
    name: 'Collectif',
    gages: [
      "Les deux boivent ensemble ! 🍻",
      "Trinquez et buvez cul sec ! 🥂",
      "Santé ! Les deux boivent !  🍺🍺"
    ],
    target: 'both',
    count: 1
  },
  { 
    color: '#9b59b6', 
    name: '{player1} le master',
    gages: [
      "{player1} distribue 2 gorgées à {player2} !  🎁",
      "{player1} choisit :  boire ou faire boire !  👆",
      "{player1} donne un gage à {player2} ! 🎭"
    ],
    target: 'player1_gives',
    count:  0
  },
  { 
    color: '#1abc9c', 
    name: '{player2} le master',
    gages: [
      "{player2} distribue 2 gorgées à {player1} !  🎁",
      "{player2} choisit :  boire ou faire boire ! 👆",
      "{player2} donne un gage à {player1} ! 🎭"
    ],
    target:  'player2_gives',
    count: 0
  },
  { 
    color: '#e67e22', 
    name:  'Défi du destin',
    gages: [
      "Pierre-feuille-ciseaux !  Le perdant boit ! ✊✋✌️",
      "Bras de fer ! Le perdant boit ! 💪",
      "Concours de regards ! Premier qui rit boit ! 👀",
      "Pile ou face ! {player1} = Pile, {player2} = Face 🪙"
    ],
    target: 'game',
    count: 1
  },
  { 
    color: '#34495e', 
    name: 'Jackpot ou malchance!',
    gages: [
      "JACKPOT ! {player1} boit 3 verres ! 🎰🍺🍺🍺",
      "MALCHANCE ! {player2} boit 3 verres !  😱🍺🍺🍺",
      "CATASTROPHE ! Les deux boivent 2 verres ! 💀🍺🍺",
      "EXPLOSION !  Tout le monde autour boit ! 💥"
    ],
    target: 'jackpot',
    count: 3
  }
];

// Éléments DOM
const screens = {
  home: document.getElementById('home-screen'),
  rouletteMode: document.getElementById('roulette-mode-screen'),
  rouletteLocalSetup: document.getElementById('roulette-local-setup-screen'),
  rouletteOnlineLobby: document.getElementById('roulette-online-lobby-screen'),
  rouletteGame: document.getElementById('roulette-game-screen'),
  lobby: document.getElementById('lobby-screen'),
  questionsSubmit: document.getElementById('questions-submit-screen'),
  game: document.getElementById('game-screen'),
  results: document.getElementById('results-screen'),
  end: document.getElementById('end-screen'),
  undercoverRole: document.getElementById('undercover-role-screen'),
  undercoverGame: document.getElementById('undercover-game-screen'),
  undercoverVote: document.getElementById('undercover-vote-screen'),
  undercoverElimination: document.getElementById('undercover-elimination-screen'),
  mrwhiteGuess: document.getElementById('mrwhite-guess-screen'),
  undercoverEnd: document.getElementById('undercover-end-screen')
};

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
        <li>À tour de rôle, donnez un indice <strong>à l'oral</strong></li>
        <li>Votez pour éliminer l'imposteur</li>
      </ul>
    `;
  } else {
    rulesContent.innerHTML = `
      <p>🔥 <strong>Hot Seat</strong> - Qui est le plus susceptible de... ? </p>
      <ul>
        <li>Une question apparaît</li>
        <li>Tout le monde vote pour la personne qui correspond</li>
        <li>Les résultats sont révélés quand tout le monde a voté</li>
      </ul>
    `;
  }
}

// ==================== SÉLECTION DU JEU ====================

document.querySelectorAll('.game-option').forEach(option => {
  option.addEventListener('click', () => {
    document.querySelectorAll('.game-option').forEach(opt => opt.classList.remove('selected'));
    option.classList.add('selected');
    const radio = option.querySelector('input[type="radio"]');
    if (radio) {
      radio.checked = true;
      state.gameType = radio.value;
    }
  });
});

document.querySelectorAll('.game-option-small').forEach(option => {
  option.addEventListener('click', () => {
    document.querySelectorAll('.game-option-small').forEach(opt => opt.classList.remove('selected'));
    option.classList.add('selected');
    const radio = option.querySelector('input[type="radio"]');
    if (radio) {
      radio.checked = true;
      state.gameType = radio.value;
      socket.emit('changeGameType', radio.value);
      updateGameDisplay(radio.value);
      updateRulesDisplay(radio.value);
      updateHotSeatOptionsVisibility(radio.value);
    }
  });
});

// ==================== SÉLECTION DU MODE DE QUESTIONS ====================

document.querySelectorAll('.mode-option').forEach(option => {
  option.addEventListener('click', () => {
    document.querySelectorAll('.mode-option').forEach(opt => opt.classList.remove('selected'));
    option.classList.add('selected');
    const radio = option.querySelector('input[type="radio"]');
    if (radio) {
      radio.checked = true;
      state.questionMode = radio.value;
      socket.emit('changeQuestionMode', radio.value);
    }
  });
});

function updateHotSeatOptionsVisibility(gameType) {
  const hotSeatOptions = document.getElementById('hotseat-options');
  if (gameType === 'hotseat' && state.isHost) {
    hotSeatOptions.classList.remove('hidden');
  } else {
    hotSeatOptions.classList.add('hidden');
  }
}

function updateGameDisplay(gameType) {
  const icon = document.getElementById('current-game-icon');
  const name = document.getElementById('current-game-name');
  if (gameType === 'undercover') {
    icon.textContent = '🕵️';
    name.textContent = 'Undercover';
  } else if (gameType === 'roulette') {
    icon.textContent = '🎰';
    name.textContent = 'Roulette';
  } else {
    icon.textContent = '🔥';
    name.textContent = 'Hot Seat';
  }
}

// ==================== ÉVÉNEMENTS DU FORMULAIRE ====================

document.getElementById('create-room-btn').addEventListener('click', () => {
  const name = document.getElementById('player-name').value.trim();
  if (!  name) {
    showToast('Entre ton prénom !  ', 'error');
    return;
  }
  
  const selectedGame = document.querySelector('input[name="game"]:checked');
  state.gameType = selectedGame ?   selectedGame.value :   'hotseat';
  state.playerName = name;
  
  // Si c'est la roulette, afficher l'écran de choix de mode
  if (state.gameType === 'roulette') {
    showScreen('rouletteMode');
    return;
  }
  
  socket.emit('createRoom', { playerName:   name, gameType:   state.gameType });
});

document.getElementById('join-room-btn').addEventListener('click', () => {
  document.getElementById('join-form').classList.toggle('hidden');
});

document.getElementById('confirm-join-btn').addEventListener('click', () => {
  const name = document.getElementById('player-name').value.trim();
  const code = document.getElementById('room-code').value.trim().toUpperCase();
  
  if (!  name) {
    showToast('Entre ton prénom ! ', 'error');
    return;
  }
  if (! code) {
    showToast('Entre le code de la partie !', 'error');
    return;
  }
  
  state.playerName = name;
  socket.emit('joinRoom', { roomCode: code, playerName: name });
});

document.getElementById('copy-code-btn').addEventListener('click', () => {
  navigator.clipboard.writeText(state.roomCode);
  showToast('Code copié !  ', 'success');
});

document.getElementById('start-game-btn').addEventListener('click', () => {
  socket.emit('startGame', { questionMode: state.questionMode });
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

// ==================== ROULETTE - ÉVÉNEMENTS ====================

// Choix du mode
document.getElementById('roulette-local-btn')?.addEventListener('click', () => {
  state.rouletteMode = 'local';
  showScreen('rouletteLocalSetup');
});

document.getElementById('roulette-online-btn')?.addEventListener('click', () => {
  state.rouletteMode = 'online';
  socket.emit('createRoom', { playerName: state.playerName, gameType: 'roulette' });
});

document.getElementById('roulette-back-btn')?.addEventListener('click', () => {
  showScreen('home');
});

// Mode local - Setup
document.getElementById('roulette-local-start-btn')?.addEventListener('click', () => {
  const p1 = document.getElementById('roulette-player1-name').value.trim();
  const p2 = document.getElementById('roulette-player2-name').value.trim();
  
  if (! p1 || ! p2) {
    showToast('Entre les deux noms ! ', 'error');
    return;
  }
  
  state.roulettePlayer1 = p1;
  state.roulettePlayer2 = p2;
  state.rouletteScores = { player1: 0, player2: 0 };
  
  startRouletteGame();
});

document.getElementById('roulette-local-back-btn')?.addEventListener('click', () => {
  showScreen('rouletteMode');
});

// Mode online - Lobby
document.getElementById('roulette-copy-code-btn')?.addEventListener('click', () => {
  const code = document.getElementById('roulette-room-code').textContent;
  navigator.clipboard.writeText(code);
  showToast('Code copié ! ', 'success');
});

document.getElementById('roulette-online-start-btn')?.addEventListener('click', () => {
  socket.emit('startGame', { gameType: 'roulette' });
});

document.getElementById('roulette-online-back-btn')?.addEventListener('click', () => {
  location.reload();
});

// Jeu - Tourner la roue
document.getElementById('spin-wheel-btn')?.addEventListener('click', () => {
  spinWheel();
});

document.getElementById('spin-again-btn')?.addEventListener('click', () => {
  document.getElementById('roulette-result').classList.add('hidden');
  document.getElementById('roulette-actions').classList.add('hidden');
  document.getElementById('spin-wheel-btn').classList.remove('hidden');
  document.getElementById('spin-wheel-btn').disabled = false;
  document.getElementById('spin-wheel-btn').textContent = '🎰 Tourner la roue ! ';
});

document.getElementById('roulette-quit-btn')?.addEventListener('click', () => {
  location.reload();
});

// ==================== ROULETTE - FONCTIONS ====================

function startRouletteGame() {
  document.getElementById('roulette-p1-name').textContent = state.roulettePlayer1;
  document.getElementById('roulette-p2-name').textContent = state.roulettePlayer2;
  document.getElementById('roulette-p1-score').textContent = '0 verre';
  document.getElementById('roulette-p2-score').textContent = '0 verre';
  
  document.getElementById('roulette-result').classList.add('hidden');
  document.getElementById('roulette-actions').classList.add('hidden');
  document.getElementById('spin-wheel-btn').classList.remove('hidden');
  document.getElementById('spin-wheel-btn').disabled = false;
  document.getElementById('spin-wheel-btn').textContent = '🎰 Tourner la roue !';
  
  // Reset wheel
  state.currentWheelRotation = 0;
  const wheel = document.getElementById('roulette-wheel');
  wheel.style.transition = 'none';
  wheel.style.transform = 'rotate(0deg)';
  setTimeout(() => {
    wheel.style.transition = 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
  }, 100);
  
  // Générer la légende des couleurs
  generateWheelLegend();
  
  showScreen('rouletteGame');
}

function generateWheelLegend() {
  const legend = document.getElementById('wheel-legend');
  if (! legend) return;
  
  legend.innerHTML = wheelSegments.map(segment => `
    <div class="legend-item">
      <span class="legend-color" style="background:  ${segment.color}"></span>
      <span class="legend-name">${segment.name.replaceAll(/{player1}/g, state.roulettePlayer1).replaceAll(/{player2}/g, state.roulettePlayer2)}</span>
    </div>
  `).join('');
}

function spinWheel() {
  const wheel = document.getElementById('roulette-wheel');
  const spinBtn = document.getElementById('spin-wheel-btn');
  
  // Désactiver le bouton pendant que ça tourne
  spinBtn.disabled = true;
  spinBtn.textContent = '🎰 La roue tourne... ';
  
  // --- 1. CALCUL DU GAGNANT ---
  const segmentCount = wheelSegments.length; // 8 segments
  const segmentAngle = 360 / segmentCount;   // 45° par segment
  const winningSegmentIndex = Math.floor(Math.random() * segmentCount);
  
  // --- 2. CALCUL DE L'ANGLE (Correction Mathématique) ---
  
  // Centre du segment par rapport à 0°
  const segmentCenter = (winningSegmentIndex * segmentAngle) + (segmentAngle / 2);
  
  // Petite variation aléatoire (facteur 0.7 pour rester prudent)
  const randomOffset = (Math.random() - 0.5) * (segmentAngle * 0.7);
  
  // La cible : 360 - la position du segment pour l'amener en haut (à 0°)
  const targetAngle = 360 - segmentCenter + randomOffset;
  
  // --- 3. ANIMATION ---
  
  // Nombre de tours complets (entre 5 et 8)
  const rotations = 5 + Math.floor(Math.random() * 3);
  
  // Calcul final en conservant la rotation actuelle pour éviter les sauts
  const totalDegrees = state.currentWheelRotation + (rotations * 360) + targetAngle - (state.currentWheelRotation % 360);
  
  state.currentWheelRotation = totalDegrees;
  wheel.style.transform = `rotate(${totalDegrees}deg)`;
  
  // --- 4. AFFICHAGE DU RÉSULTAT (C'est cette partie qui manquait) ---
  
  setTimeout(() => {
    // Récupérer le segment gagnant grâce à l'index calculé au début
    const segment = wheelSegments[winningSegmentIndex];
    
    // Choisir un gage aléatoire
    const randomGage = segment.gages[Math.floor(Math.random() * segment.gages.length)];
    
    // AFFICHER LE RESULTAT
    showRouletteResult(segment, randomGage);
    
    // Si mode online, envoyer au serveur
    if (state.rouletteMode === 'online') {
      socket.emit('rouletteResult', { segment, gage: randomGage });
    }
  }, 4000); // 4000ms correspond à la durée de transition CSS
}

function showRouletteResult(segment, gage) {
  const resultDiv = document.getElementById('roulette-result');
  const resultText = document.getElementById('roulette-result-text');
  const resultColor = document.getElementById('roulette-result-color');
  const spinBtn = document.getElementById('spin-wheel-btn');
  const actions = document.getElementById('roulette-actions');
  
  // Afficher la couleur
  if (resultColor) {
    resultColor.style.background = segment.color;
    resultColor.textContent = segment.name.replaceAll(/{player1}/g, state.roulettePlayer1).replaceAll(/{player2}/g, state.roulettePlayer2);
  }
  
  // Remplacer les placeholders
  let text = gage
    .replaceAll(/{player1}/g, `<span class="highlight">${state.roulettePlayer1}</span>`)
    .replaceAll(/{player2}/g, `<span class="highlight">${state.roulettePlayer2}</span>`);
  
  resultText.innerHTML = text;
  
  // Mettre à jour les scores selon le target
  const count = segment.count || 1;
  
  switch (segment.target) {
    case 'player1':
      state.rouletteScores.player1 += count;
      break;
    case 'player2': 
      state.rouletteScores.player2 += count;
      break;
    case 'both': 
      state.rouletteScores.player1 += count;
      state.rouletteScores.player2 += count;
      break;
    case 'jackpot':
      // Le jackpot peut affecter l'un ou l'autre selon le gage
      if (gage.includes('{player1}') || gage.includes(state.roulettePlayer1)) {
        state.rouletteScores.player1 += count;
      }
      if (gage.includes('{player2}') || gage.includes(state.roulettePlayer2)) {
        state.rouletteScores.player2 += count;
      }
      if (gage.includes('Les deux') || gage.includes('Tout le monde')) {
        state.rouletteScores.player1 += 2;
        state.rouletteScores.player2 += 2;
      }
      break;
    // 'none', 'game', 'player1_gives', 'player2_gives' n'ajoutent pas de score automatique
  }
  
  // Mettre à jour l'affichage des scores
  const p1Score = state.rouletteScores.player1;
  const p2Score = state.rouletteScores.player2;
  document.getElementById('roulette-p1-score').textContent = `${p1Score} verre${p1Score > 1 ? 's' : ''}`;
  document.getElementById('roulette-p2-score').textContent = `${p2Score} verre${p2Score > 1 ? 's' : ''}`;
  
  // Afficher le résultat avec la couleur
  resultDiv.style.borderColor = segment.color;
  resultDiv.style.background = `linear-gradient(135deg, ${segment.color}33, ${segment.color}11)`;
  
  spinBtn.classList.add('hidden');
  resultDiv.classList.remove('hidden');
  actions.classList.remove('hidden');
}

// ==================== QUESTIONS PERSONNALISÉES ====================

document.getElementById('submit-questions-btn')?.addEventListener('click', () => {
  const q1 = document.getElementById('custom-question-1').value.trim();
  const q2 = document.getElementById('custom-question-2').value.trim();
  
  const questions = [];
  
  if (q1) {
    const fullQ1 = q1.toLowerCase().startsWith('qui') ? q1 : `Qui est le plus susceptible de ${q1}`;
    questions.push(fullQ1);
  }
  
  if (q2) {
    const fullQ2 = q2.toLowerCase().startsWith('qui') ? q2 : `Qui est le plus susceptible de ${q2}`;
    questions.push(fullQ2);
  }
  
  socket.emit('submitQuestions', { questions });
  
  state.hasSubmittedQuestions = true;
  document.getElementById('submit-questions-btn').disabled = true;
  document.getElementById('submit-questions-btn').textContent = '✅ Envoyé !';
  document.getElementById('questions-submitted-message').classList.remove('hidden');
  
  const count = questions.length;
  let message = '';
  if (count === 0) {
    message = '2 questions aléatoires seront ajoutées pour toi';
  } else if (count === 1) {
    message = '1 question aléatoire sera ajoutée pour compléter';
  } else {
    message = 'Tes 2 questions ont été ajoutées ! ';
  }
  document.getElementById('questions-submitted-detail').textContent = message;
});

function resetQuestionsForm() {
  const submitBtn = document.getElementById('submit-questions-btn');
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = '📤 Valider mes questions';
  }
  document.getElementById('questions-submitted-message')?.classList.add('hidden');
  const q1 = document.getElementById('custom-question-1');
  const q2 = document.getElementById('custom-question-2');
  if (q1) q1.value = '';
  if (q2) q2.value = '';
}

// ==================== UNDERCOVER - ÉVÉNEMENTS ====================

document.getElementById('ready-btn')?.addEventListener('click', () => {
  showScreen('undercoverGame');
});

document.getElementById('hint-done-btn')?.addEventListener('click', () => {
  socket.emit('hintDone');
  document.getElementById('hint-done-btn').disabled = true;
  document.getElementById('hint-done-btn').textContent = '✅ Indice donné !';
});

document.getElementById('mrwhite-guess-btn')?.addEventListener('click', () => {
  const guess = document.getElementById('mrwhite-guess-input').value.trim();
  if (!  guess) {
    showToast('Entre un mot !  ', 'error');
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
  // Si c'est une roulette online
  if (gameType === 'roulette') {
    state.roomCode = roomCode;
    state.playerId = playerId;
    state.isHost = true;
    state.gameType = 'roulette';
    state.roulettePlayer1 = state.playerName;
    
    document.getElementById('roulette-room-code').textContent = roomCode;
    document.getElementById('roulette-slot-1').classList.add('ready');
    document.getElementById('roulette-slot-1-name').textContent = state.playerName;
    
    showScreen('rouletteOnlineLobby');
    showToast('Partie créée ! ', 'success');
    return;
  }
  
  state.roomCode = roomCode;
  state.playerId = playerId;
  state.isHost = true;
  state.gameType = gameType;
  state.players = players;
  
  document.getElementById('display-room-code').textContent = roomCode;
  document.getElementById('host-controls').classList.remove('hidden');
  document.getElementById('waiting-message').classList.add('hidden');
  
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
  updateHotSeatOptionsVisibility(gameType);
  updatePlayersList();
  showScreen('lobby');
  showToast('Partie créée !', 'success');
});

socket.on('roomJoined', ({ roomCode, playerId, gameType, questionMode, players }) => {
  // Si c'est une roulette online
  if (gameType === 'roulette') {
    state.roomCode = roomCode;
    state.playerId = playerId;
    state.isHost = false;
    state.gameType = 'roulette';
    state.rouletteMode = 'online';
    state.roulettePlayer2 = state.playerName;
    
    if (players && players.length >= 1) {
      state.roulettePlayer1 = players[0].name;
    }
    
    document.getElementById('roulette-room-code').textContent = roomCode;
    document.getElementById('roulette-slot-1').classList.add('ready');
    document.getElementById('roulette-slot-1-name').textContent = state.roulettePlayer1;
    document.getElementById('roulette-slot-2').classList.add('ready');
    document.getElementById('roulette-slot-2-name').textContent = state.playerName;
    document.getElementById('roulette-waiting-message').textContent = 'En attente du lancement...';
    
    showScreen('rouletteOnlineLobby');
    showToast('Tu as rejoint la partie !  ', 'success');
    return;
  }
  
  state.roomCode = roomCode;
  state.playerId = playerId;
  state.isHost = false;
  state.gameType = gameType;
  state.questionMode = questionMode || 'default';
  state.players = players;
  
  document.getElementById('display-room-code').textContent = roomCode;
  document.getElementById('host-controls').classList.add('hidden');
  document.getElementById('hotseat-options').classList.add('hidden');
  document.getElementById('waiting-message').classList.remove('hidden');
  
  updateGameDisplay(gameType);
  updateRulesDisplay(gameType);
  updatePlayersList();
  showScreen('lobby');
  showToast('Tu as rejoint la partie ! ', 'success');
});

socket.on('playerJoined', ({ players }) => {
  state.players = players;
  
  // Si c'est une roulette, mettre à jour le slot 2
  if (state.gameType === 'roulette' && players.length === 2) {
    state.roulettePlayer2 = players[1].name;
    document.getElementById('roulette-slot-2').classList.add('ready');
    document.getElementById('roulette-slot-2-name').textContent = players[1].name;
    document.getElementById('roulette-waiting-message').classList.add('hidden');
    
    if (state.isHost) {
      document.getElementById('roulette-online-start-btn').classList.remove('hidden');
    }
    return;
  }
  
  updatePlayersList();
});

socket.on('playerLeft', ({ players }) => {
  state.players = players;
  const me = players.find(p => p.id === state.playerId);
  if (me && me.isHost && !  state.isHost) {
    state.isHost = true;
    document.getElementById('host-controls').classList.remove('hidden');
    document.getElementById('hotseat-options').classList.remove('hidden');
    document.getElementById('waiting-message').classList.add('hidden');
    showToast('Tu es maintenant l\'hôte !  ', 'success');
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

socket.on('questionModeChanged', ({ questionMode }) => {
  state.questionMode = questionMode;
  document.querySelectorAll('.mode-option').forEach(opt => {
    opt.classList.remove('selected');
    const radio = opt.querySelector('input[type="radio"]');
    if (radio && radio.value === questionMode) {
      opt.classList.add('selected');
      radio.checked = true;
    }
  });
});

socket.on('gameStarted', (data) => {
  if (data.gameType === 'undercover') {
    startUndercoverGame(data);
  } else if (data.gameType === 'roulette') {
    state.roulettePlayer1 = data.player1Name;
    state.roulettePlayer2 = data.player2Name;
    state.rouletteScores = { player1: 0, player2: 0 };
    startRouletteGame();
  } else {
    startHotSeatGame(data);
  }
});

socket.on('gameRestarted', ({ players }) => {
  state.players = players;
  state.hasVoted = false;
  state.hasSubmittedQuestions = false;
  state.myWord = null;
  state.myRole = null;
  
  resetQuestionsForm();
  updatePlayersList();
  showScreen('lobby');
  showToast('Nouvelle partie !  ', 'success');
});

socket.on('error', ({ message }) => {
  showToast(message, 'error');
});

// ==================== SOCKET.IO - QUESTIONS ====================

socket.on('collectQuestions', ({ totalPlayers }) => {
  state.hasSubmittedQuestions = false;
  resetQuestionsForm();
  
  document.getElementById('questions-total-players').textContent = totalPlayers;
  document.getElementById('questions-submitted-count').textContent = '0';
  document.getElementById('submitted-players-list').innerHTML = '';
  
  showScreen('questionsSubmit');
});

socket.on('playerSubmittedQuestions', ({ playerName, submittedCount, totalPlayers, customCount }) => {
  document.getElementById('questions-submitted-count').textContent = submittedCount;
  
  const list = document.getElementById('submitted-players-list');
  const playerIndex = state.players.findIndex(p => p.name === playerName);
  
  let detail = '';
  if (customCount === 0) {
    detail = '(2 aléatoires)';
  } else if (customCount === 1) {
    detail = '(1 perso + 1 aléatoire)';
  } else {
    detail = '(2 perso)';
  }
  
  list.innerHTML += `
    <li>
      ${getAvatar(playerIndex >= 0 ? playerIndex : 0)} ${playerName} ✅ <span class="question-detail">${detail}</span>
    </li>
  `;
});

socket.on('allQuestionsCollected', ({ totalQuestions }) => {
  showToast(`${totalQuestions} questions prêtes !   Lancement...`, 'success');
});

// ==================== SOCKET.IO - ROULETTE ====================

socket.on('rouletteSpinResult', ({ segment, gage }) => {
  showRouletteResult(segment, gage);
});

socket.on('roulettePlayerLeft', () => {
  showToast('L\'adversaire a quitté la partie', 'error');
  setTimeout(() => location.reload(), 2000);
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
  
  if (!  list || ! count) return;
  
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
  
  nextBtn.textContent = isLastQuestion ? 'Voir les résultats finaux 🏆' :   'Question suivante ➡️';
  
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
      <h4>Q${i + 1}:   ${r.question}</h4>
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
  
  const roleCard = document.getElementById('role-card');
  const roleIcon = document.getElementById('role-icon');
  const roleName = document.getElementById('role-name');
  const secretWord = document.getElementById('secret-word');
  const roleTip = document.getElementById('role-tip');
  
  roleCard.className = 'role-card ' + data.yourRole;
  
  if (data.yourRole === 'civil') {
    roleIcon.textContent = '👤';
    roleName.textContent = 'Civil';
    roleTip.textContent = '💡 Donne des indices subtils à l\'oral pour prouver que tu as le bon mot !  ';
  } else if (data.yourRole === 'undercover') {
    roleIcon.textContent = '🕵️';
    roleName.textContent = 'Undercover';
    roleTip.textContent = '💡 Fais semblant d\'avoir le même mot que les autres !   Sois discret...';
  } else {
    roleIcon.textContent = '🎭';
    roleName.textContent = 'Mr.White';
    roleTip.textContent = '💡 Tu ne connais pas le mot !   Écoute les indices et bluff...';
  }
  
  secretWord.textContent = data.yourWord;
  document.getElementById('reminder-word').textContent = data.yourWord;
  
  document.getElementById('uc-round-number').textContent = '1';
  document.getElementById('alive-count').textContent = data.players.length;
  document.getElementById('hints-given-list').innerHTML = '';
  document.getElementById('hints-count').textContent = '0';
  document.getElementById('hints-total').textContent = data.players.length;
  
  // Reset hint button
  const hintBtn = document.getElementById('hint-done-btn');
  if (hintBtn) {
    hintBtn.disabled = false;
    hintBtn.textContent = '✅ J\'ai donné mon indice';
  }
  
  updateCurrentPlayer(data.currentPlayerId);
  showScreen('undercoverRole');
}

socket.on('hintGiven', ({ playerId, playerName, nextPlayerId, hintsCount, totalPlayers }) => {
  const list = document.getElementById('hints-given-list');
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  list.innerHTML += `
    <li class="hint-done-item">
      ${getAvatar(playerIndex >= 0 ? playerIndex : 0)} ${playerName} a donné son indice ✅
    </li>
  `;
  
  document.getElementById('hints-count').textContent = hintsCount;
  document.getElementById('hints-total').textContent = totalPlayers;
  
  updateCurrentPlayer(nextPlayerId);
});

socket.on('undercoverVotePhase', ({ players, roundNumber }) => {
  state.players = players;
  state.hasVoted = false;
  
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
    <div class="eliminated-name">${eliminatedPlayer}</div>
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

socket.on('undercoverTie', ({ message }) => {
  showToast(message, 'info');
});

socket.on('undercoverNewRound', ({ roundNumber, currentPlayerId, players }) => {
  state.players = players;
  state.hasVoted = false;
  
  document.getElementById('uc-round-number').textContent = roundNumber;
  document.getElementById('alive-count').textContent = players.length;
  document.getElementById('hints-given-list').innerHTML = '';
  document.getElementById('hints-count').textContent = '0';
  document.getElementById('hints-total').textContent = players.length;
  
  const hintBtn = document.getElementById('hint-done-btn');
  if (hintBtn) {
    hintBtn.disabled = false;
    hintBtn.textContent = '✅ J\'ai donné mon indice';
  }
  
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
    '🕵️ Victoire des Undercovers ! ';
  
  document.getElementById('uc-end-message').textContent = message;
  document.getElementById('civil-word').textContent = wordPair[0];
  document.getElementById('undercover-word').textContent = wordPair[1];
  
  const rolesList = document.getElementById('roles-list');
  rolesList.innerHTML = allPlayers.map(p => `
    <li>
      <span>${p.name}</span>
      <span class="role-badge ${p.role.toLowerCase().replace('. ', '').replace(' ', '')}">${p.role}</span>
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

function updateCurrentPlayer(currentPlayerId) {
  const currentPlayer = state.players.find(p => p.id === currentPlayerId);
  const nameDisplay = document.getElementById('current-player-name');
  const hintSection = document.getElementById('hint-action-section');
  const waitingSection = document.getElementById('waiting-hint-section');
  
  if (!  nameDisplay || ! hintSection || ! waitingSection) return;
  
  if (currentPlayer) {
    if (currentPlayerId === state.playerId) {
      nameDisplay.textContent = '🎯 C\'est à TOI !';
      nameDisplay.classList.add('you');
      hintSection.classList.remove('hidden');
      waitingSection.classList.add('hidden');
    } else {
      nameDisplay.textContent = currentPlayer.name;
      nameDisplay.classList.remove('you');
      hintSection.classList.add('hidden');
      waitingSection.classList.remove('hidden');
    }
  }
  
  document.getElementById('alive-count').textContent = state.players.length;
}