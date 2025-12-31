// games/roulette.js

// 1. Définition des segments (Catégories génériques)
const wheelSegments = [
  { color: '#e74c3c', name: 'Cul sec', gages: ['Tout le monde boit !', 'Cul sec pour {player}'], count: 1 },
  { color: '#3498db', name: 'Vérité', gages: ['{player} doit raconter une honte', '{player} montre sa dernière photo', 'Vérité pour {player} : Ton dernier SMS ?'], count: 0 },
  { color: '#f1c40f', name: 'Distribue', gages: ['{player} distribue 2 gorgées', '{player} distribue 5 gorgées'], count: 0 },
  { color: '#2ecc71', name: 'Jeu', gages: ['"Je n\'ai jamais..." lancé par {player}', 'Action ou Vérité pour {player}'], count: 0 },
  { color: '#9b59b6', name: 'Shot', gages: ['Shot pour {player} !', 'Les voisins de {player} boivent'], count: 0 },
  { color: '#e67e22', name: 'Défi', gages: ['{player} fait 10 pompes', '{player} ne dit plus oui ni non'], count: 0 }
];

function initGame(room) {
  // On ne stocke plus les scores individuels complexes pour l'instant
  room.rouletteSpinCount = 0;
}

function getWheelConfig() {
  return wheelSegments;
}

function startGame(io, room) {
  // On envoie juste le signal de départ
  io.to(room.code).emit('gameStarted', {
    gameType: 'roulette',
    wheelConfig: wheelSegments
  });
}

function handleSpinRequest(io, socket, room) {
  // 1. Choisir le segment de la roue
  const segmentIndex = Math.floor(Math.random() * wheelSegments.length);
  const segment = wheelSegments[segmentIndex];
  
  // 2. Choisir un gage brut
  const rawGage = segment.gages[Math.floor(Math.random() * segment.gages.length)];

  // 3. CHOISIR UNE VICTIME (Parmi tous les joueurs vivants/connectés)
  const playersArray = Array.from(room.players.values());
  const victim = playersArray[Math.floor(Math.random() * playersArray.length)];
  const victimName = victim ? victim.name : "Quelqu'un";

  // 4. Remplacer {player} par le nom de la victime
  // On remplace aussi {player1} ou {player2} au cas où il en reste dans les textes
  const finalGage = rawGage
    .replace(/{player}/g, `<span class="highlight">${victimName}</span>`)
    .replace(/{player1}/g, `<span class="highlight">${victimName}</span>`)
    .replace(/{player2}/g, `<span class="highlight">${victimName}</span>`);

  // 5. Envoyer l'animation à tout le monde
  io.to(room.code).emit('rouletteSpinStart', {
    segmentIndex: segmentIndex,
    segment: segment,
    gage: finalGage, // Le texte est déjà formaté par le serveur
    spinnerId: socket.odId
  });
}

function handleNextTurn(io, room) {
  io.to(room.code).emit('rouletteResetUI');
}

module.exports = { 
  initGame, 
  startGame, 
  handleSpinRequest, 
  handleNextTurn, 
  getWheelConfig 
};