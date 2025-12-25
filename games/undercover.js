// games/undercover.js
const { wordPairs } = require('../utils/data');
const { shuffleArray, formatPlayersArray } = require('../utils/helpers');

function getUndercoverCount(playerCount) {
  if (playerCount <= 6) return 1;
  if (playerCount <= 12) return 2;
  if (playerCount <= 18) return 3;
  return 4;
}

function checkVictory(room) {
  const alivePlayers = Array.from(room.players.values()).filter(p => p.isAlive);
  const aliveUndercovers = alivePlayers.filter(p => p.isUndercover);
  const aliveCivils = alivePlayers.filter(p => !p.isUndercover && !p.isMrWhite);
  const aliveMrWhite = alivePlayers.filter(p => p.isMrWhite);

  if (aliveUndercovers.length === 0 && aliveMrWhite.length === 0) {
    return { gameOver: true, winner: 'civils', message: '🎉 Les Civils ont gagné !' };
  }
  if (aliveUndercovers.length + aliveMrWhite.length >= aliveCivils.length) {
    return { gameOver: true, winner: 'undercover', message: '🕵️ Les Undercovers ont gagné !' };
  }
  return { gameOver: false };
}

function initGame(room) {
  room.currentWordPair = null;
  room.currentPlayerIndex = 0;
  room.roundNumber = 1;
  room.hints = [];
  room.eliminatedPlayers = [];
  room.playerOrder = [];
  room.waitingForMrWhite = null;
}

function startGame(io, room, settings = {}) {
  const playerIds = Array.from(room.players.keys());
  const shuffledIds = shuffleArray(playerIds);
  const totalPlayers = playerIds.length;

  let hasMrWhite = false;
  if (settings.includeMrWhite !== undefined) {
    hasMrWhite = settings.includeMrWhite;
  } else {
    hasMrWhite = totalPlayers >= 5;
  }

  let undercoverCount = 1;
  if (settings.undercoverCount) {
    undercoverCount = settings.undercoverCount;
  } else {
    undercoverCount = Math.floor((totalPlayers - (hasMrWhite ? 1 : 0)) / 3) || 1;
  }
  
  const maxImpostors = totalPlayers - 1; // Il faut au moins 1 civil
  const totalImpostors = undercoverCount + (hasMrWhite ? 1 : 0);
  
  if (totalImpostors > maxImpostors) {
    undercoverCount = Math.max(1, maxImpostors - (hasMrWhite ? 1 : 0));
  }

  const pairIndex = Math.floor(Math.random() * wordPairs.length);
  room.currentWordPair = wordPairs[pairIndex];

  const undercoverIds = shuffledIds.slice(0, undercoverCount);
  let mrWhiteId = null;
  if (hasMrWhite) {
    mrWhiteId = shuffledIds[undercoverCount]; // Prend l'ID juste après les undercovers
  }

  room.players.forEach((player, odId) => {
    player.isAlive = true;
    player.hasGivenHint = false;
    
    if (undercoverIds.includes(odId)) {
      player.isUndercover = true;
      player.isMrWhite = false;
      player.word = room.currentWordPair[1];
    } else if (odId === mrWhiteId) {
      player.isUndercover = false;
      player.isMrWhite = true;
      player.word = "???"; // Pas de mot pour Mr White
    } else {
      player.isUndercover = false;
      player.isMrWhite = false;
      player.word = room.currentWordPair[0];
    }
  });

  room.playerOrder = shuffleArray(playerIds);
  room.currentPlayerIndex = 0;
  room.roundNumber = 1;
  room.votes.clear();
  room.eliminatedPlayers = [];

  room.players.forEach((player) => {
    const pSocket = io.sockets.sockets.get(player.socketId);
    if (pSocket) {
      
      let roleToSend = 'civil';

      if (player.isMrWhite) {
        roleToSend = 'mrwhite';
      } else if (player.isUndercover) {
        if (settings.revealUndercover) {
          roleToSend = 'undercover';
        } else {
          roleToSend = 'civil';
        }
      } else {
        roleToSend = 'civil';
      }
      // -------------------------------

      pSocket.emit('gameStarted', {
        gameType: 'undercover',
        yourWord: player.word,
        yourRole: roleToSend,
        undercoverCount: undercoverCount,
        hasMrWhite: mrWhiteId !== null,
        players: formatPlayersArray(room.players),
        currentPlayerId: room.playerOrder[0],
        roundNumber: 1
      });
    }
  });
}

function handleHint(io, socket, room) {
  const currentPlayerId = room.playerOrder[room.currentPlayerIndex];
  if (socket.odId !== currentPlayerId) return;

  const player = room.players.get(socket.odId);
  if (!player || !player.isAlive || player.hasGivenHint) return;

  player.hasGivenHint = true;
  room.currentPlayerIndex++;

  // Trouver prochain joueur vivant
  while (room.currentPlayerIndex < room.playerOrder.length) {
    const nextPlayerId = room.playerOrder[room.currentPlayerIndex];
    const nextPlayer = room.players.get(nextPlayerId);
    if (nextPlayer && nextPlayer.isAlive && !nextPlayer.hasGivenHint) break;
    room.currentPlayerIndex++;
  }

  const alivePlayers = Array.from(room.players.values()).filter(p => p.isAlive);
  const hintsCount = alivePlayers.filter(p => p.hasGivenHint).length;
  const allHintsGiven = alivePlayers.every(p => p.hasGivenHint);

  if (allHintsGiven || room.currentPlayerIndex >= room.playerOrder.length) {
    io.to(room.code).emit('undercoverVotePhase', {
      players: alivePlayers.map(p => ({ id: p.id, name: p.name })),
      roundNumber: room.roundNumber
    });
  } else {
    io.to(room.code).emit('hintGiven', {
      playerId: socket.odId,
      playerName: player.name,
      nextPlayerId: room.playerOrder[room.currentPlayerIndex],
      hintsCount: hintsCount,
      totalPlayers: alivePlayers.length
    });
  }
}

function handleVote(io, socket, room, votedPlayerId) {
  // Logique de vote, élimination et vérification de victoire
  // (Code identique à l'original mais encapsulé)
  const voter = room.players.get(socket.odId);
  if (!voter || !voter.isAlive) return;

  room.votes.set(socket.odId, votedPlayerId);
  const alivePlayers = Array.from(room.players.values()).filter(p => p.isAlive);

  io.to(room.code).emit('undercoverVoteReceived', {
    odId: socket.odId,
    totalVotes: room.votes.size,
    totalPlayers: alivePlayers.length
  });

  if (room.votes.size === alivePlayers.length) {
    processElimination(io, room);
  }
}

function processElimination(io, room) {
  // Calcul des votes
  const voteCount = new Map();
  room.votes.forEach((votedId) => {
    voteCount.set(votedId, (voteCount.get(votedId) || 0) + 1);
  });

  let maxVotes = 0;
  let eliminated = [];
  voteCount.forEach((count, odId) => {
    if (count > maxVotes) {
      maxVotes = count;
      eliminated = [odId];
    } else if (count === maxVotes) {
      eliminated.push(odId);
    }
  });

  if (eliminated.length > 1) {
    io.to(room.code).emit('undercoverTie', { message: 'Égalité ! Personne n\'est éliminé.' });
    startNewRound(io, room);
    return;
  }

  const eliminatedId = eliminated[0];
  const eliminatedPlayer = room.players.get(eliminatedId);
  eliminatedPlayer.isAlive = false;
  room.eliminatedPlayers.push({
    id: eliminatedId,
    name: eliminatedPlayer.name,
    wasUndercover: eliminatedPlayer.isUndercover,
    wasMrWhite: eliminatedPlayer.isMrWhite
  });

  // Gestion Mr White
  if (eliminatedPlayer.isMrWhite) {
    const pSocket = io.sockets.sockets.get(eliminatedPlayer.socketId);
    if (pSocket) pSocket.emit('mrWhiteGuess', { message: 'Devine le mot !' });
    io.to(room.code).emit('mrWhiteEliminated', { 
        playerName: eliminatedPlayer.name, 
        message: `${eliminatedPlayer.name} était Mr.White !` 
    });
    room.waitingForMrWhite = eliminatedId;
    return;
  }

  // Vérif victoire
  const victory = checkVictory(room);
  const voteDetails = [];
  room.votes.forEach((votedId, odId) => {
    voteDetails.push({
      voter: room.players.get(odId)?.name,
      votedFor: room.players.get(votedId)?.name
    });
  });

  if (victory.gameOver) {
    endGame(io, room, victory, voteDetails);
  } else {
    io.to(room.code).emit('undercoverElimination', {
      eliminatedPlayer: eliminatedPlayer.name,
      wasUndercover: eliminatedPlayer.isUndercover,
      wasMrWhite: eliminatedPlayer.isMrWhite,
      voteDetails,
      remainingPlayers: Array.from(room.players.values()).filter(p => p.isAlive).map(p => ({ id: p.id, name: p.name }))
    });
    setTimeout(() => startNewRound(io, room), 3000);
  }
}

function handleMrWhiteGuess(io, socket, room, guessedWord) {
  if (room.waitingForMrWhite !== socket.odId) return;

  const correctWord = room.currentWordPair[0].toLowerCase();
  const guess = guessedWord.toLowerCase().trim();
  room.waitingForMrWhite = null;

  if (guess === correctWord) {
    endGame(io, room, { 
        winner: 'mrwhite', 
        message: `🎭 Mr.White a gagné en devinant "${room.currentWordPair[0]}" !` 
    });
  } else {
    const victory = checkVictory(room);
    if (victory.gameOver) {
      endGame(io, room, victory);
    } else {
      io.to(room.code).emit('mrWhiteGuessFailed', { message: `Raté ! C'était pas "${guessedWord}".` });
      startNewRound(io, room);
    }
  }
}

function startNewRound(io, room) {
  room.roundNumber++;
  room.votes.clear();
  room.currentPlayerIndex = 0;
  room.players.forEach(p => { if(p.isAlive) p.hasGivenHint = false; });
  
  const alivePlayers = Array.from(room.players.entries()).filter(([, p]) => p.isAlive).map(([id]) => id);
  room.playerOrder = shuffleArray(alivePlayers);

  io.to(room.code).emit('undercoverNewRound', {
    roundNumber: room.roundNumber,
    currentPlayerId: room.playerOrder[0],
    players: Array.from(room.players.values()).filter(p => p.isAlive).map(p => ({ id: p.id, name: p.name }))
  });
}

function endGame(io, room, victory, voteDetails = []) {
  io.to(room.code).emit('undercoverGameEnd', {
    winner: victory.winner,
    message: victory.message,
    wordPair: room.currentWordPair,
    voteDetails,
    allPlayers: Array.from(room.players.values()).map(p => ({
      name: p.name,
      role: p.isMrWhite ? 'Mr.White' : (p.isUndercover ? 'Undercover' : 'Civil'),
      word: p.word
    }))
  });
}

module.exports = { initGame, startGame, handleHint, handleVote, handleMrWhiteGuess };