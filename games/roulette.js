// games/roulette.js
const { wheelSegments } = require('../utils/data');

function initGame(room) {
  room.rouletteScores = new Map();
}

function getWheelConfig() {
  return wheelSegments;
}

function startGame(io, room) {
  const players = Array.from(room.players.values());
  const player1 = players[0];
  const player2 = players[1];

  players.forEach(p => room.rouletteScores.set(p.id, 0));

  io.to(room.code).emit('gameStarted', {
    gameType: 'roulette',
    player1Name: player1 ? player1.name : 'Joueur 1',
    player2Name: player2 ? player2.name : 'Joueur 2',
    wheelConfig: wheelSegments
  });
}

function handleSpinRequest(io, socket, room) {
  // Sécurité : Si la roue tourne déjà, on ignore (optionnel mais recommandé)
  
  const segmentIndex = Math.floor(Math.random() * wheelSegments.length);
  const segment = wheelSegments[segmentIndex];
  const gage = segment.gages[Math.floor(Math.random() * segment.gages.length)];

  io.to(room.code).emit('rouletteSpinStart', {
    segmentIndex: segmentIndex,
    segment: segment,
    gage: gage,
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
  getWheelConfig // <--- Important : on exporte ça
};