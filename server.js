const { wordPairs } = require('../utils/data');
const { shuffleArray, formatPlayersArray } = require('../utils/helpers');

function getUndercoverCount(playerCount) {
  if (playerCount <= 6) return 1;
  if (playerCount <= 12) return 2;
  return 3;
}

function checkVictory(room) {
  const alivePlayers = Array.from(room.players.values()).filter(p => p.isAlive);
  
  const civilsCount = alivePlayers.filter(p => !p.isUndercover && !p.isMrWhite).length;
  const impostorsCount = alivePlayers.filter(p => p.isUndercover || p.isMrWhite).length;

  console.log(`[CHECK] ${civilsCount} Civils vs ${impostorsCount} Imposteurs`);

  if (impostorsCount === 0) {
    return { 
      gameOver: true, 
      winner: 'civils', 
      message: '🎉 Les Civils ont gagné ! Tous les imposteurs sont éliminés.' 
    };
  }

  let impostorsWin = false;

  if (impostorsCount === 1) {
    if (civilsCount <= 1) {
      impostorsWin = true;
    }
  } else {
    if (impostorsCount > civilsCount) {
      impostorsWin = true;
    }
  }

  if (impostorsWin) {
    return { 
      gameOver: true, 
      winner: 'impostors', 
      message: '🕵️ Les Imposteurs ont pris le contrôle !' 
    };
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
  
  const maxImpostors = totalPlayers - 1;
  const totalImpostors = undercoverCount + (hasMrWhite ? 1 : 0);
  if (totalImpostors > maxImpostors) {
    undercoverCount = Math.max(1, maxImpostors - (hasMrWhite ? 1 : 0));
  }

  const pairIndex = Math.floor(Math.random() * wordPairs.length);
  room.currentWordPair = wordPairs[pairIndex];

  const undercoverIds = shuffledIds.slice(0, undercoverCount);
  let mrWhiteId = null;
  if (hasMrWhite) {
    mrWhiteId = shuffledIds[undercoverCount]; 
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
      player.word = "???";
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
      if (player.isMrWhite) roleToSend = 'mrwhite';
      else if (player.isUndercover) {
        roleToSend = settings.revealUndercover ? 'undercover' : 'civil';
      }

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
  const voter = room.players.get(socket.odId);
  if (!voter || !voter.isAlive) return;

  room.votes.set(socket.odId, votedPlayerId);
  
  const alivePlayers = Array.from(room.players.values()).filter(p => p.isAlive);

  io.to(room.code).emit('undercoverVoteReceived', {
    odId: socket.odId,
    totalVotes: room.votes.size,
    totalPlayers: alivePlayers.length
  });

  if (room.votes.size >= alivePlayers.length) {
    processElimination(io, room);
  }
}

function processElimination(io, room) {
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

  io.to(room.code).emit('undercoverElimination', {
    eliminatedPlayer: eliminatedPlayer.name,
    wasUndercover: eliminatedPlayer.isUndercover,
    wasMrWhite: eliminatedPlayer.isMrWhite,
    remainingPlayers: Array.from(room.players.values()).filter(p => p.isAlive).map(p => ({ id: p.id, name: p.name }))
  });

  if (eliminatedPlayer.isMrWhite) {
    const pSocket = io.sockets.sockets.get(eliminatedPlayer.socketId);
    if (pSocket) pSocket.emit('mrWhiteGuess', { message: 'Devine le mot !' });
    
    room.waitingForMrWhite = eliminatedId;
    return;
  }

  const victory = checkVictory(room);

  if (victory.gameOver) {
    endGame(io, room, victory);
  } else {
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
        winner: 'impostors', 
        message: `🎭 Mr.White a gagné en devinant "${room.currentWordPair[0]}" !` 
    });
  } else {
    io.to(room.code).emit('mrWhiteGuessFailed', { message: `Raté ! C'était pas "${guessedWord}".` });
    
    const victory = checkVictory(room);
    
    if (victory.gameOver) {
      endGame(io, room, victory);
    } else {
      setTimeout(() => startNewRound(io, room), 2000);
    }
  }
}

function startNewRound(io, room) {
  room.roundNumber++;
  room.votes.clear();
  room.currentPlayerIndex = 0;
  
  room.players.forEach(p => { 
      if(p.isAlive) p.hasGivenHint = false; 
  });
  
  const alivePlayers = Array.from(room.players.entries()).filter(([, p]) => p.isAlive).map(([id]) => id);
  room.playerOrder = shuffleArray(alivePlayers);

  io.to(room.code).emit('undercoverNewRound', {
    roundNumber: room.roundNumber,
    currentPlayerId: room.playerOrder[0],
    players: Array.from(room.players.values()).filter(p => p.isAlive).map(p => ({ id: p.id, name: p.name }))
  });
}

function endGame(io, room, victory, voteDetails = []) {
  room.gameStarted = false;
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