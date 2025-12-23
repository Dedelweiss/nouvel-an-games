// games/roulette.js

function initGame(room) {
  // La roulette n'a pas besoin de stocker beaucoup d'état côté serveur 
  // car c'est très événementiel (tourner -> résultat).
  // On pourrait stocker les scores ici si on voulait une persistance plus forte.
  room.rouletteScores = new Map();
}

function startGame(io, room) {
  // On récupère les 2 premiers joueurs (la roulette est souvent 1vs1 dans ton code)
  const players = Array.from(room.players.values());
  const player1 = players[0];
  const player2 = players[1];

  if (players.length < 2 && room.gameType === 'roulette') {
     // Gestion d'erreur ou attente
  }

  // Initialisation des scores
  players.forEach(p => room.rouletteScores.set(p.id, 0));

  io.to(room.code).emit('gameStarted', {
    gameType: 'roulette',
    player1Name: player1 ? player1.name : 'Joueur 1',
    player2Name: player2 ? player2.name : 'Joueur 2'
  });
}

function handleResult(io, socket, room, data) {
  // Data contient { segment, gage } envoyé par le client qui a tourné la roue
  // On le relaie à tout le monde dans la room pour que l'adversaire voie le résultat
  io.to(room.code).emit('rouletteSpinResult', {
    segment: data.segment,
    gage: data.gage,
    spinnerId: socket.odId
  });
}

module.exports = { initGame, startGame, handleResult };