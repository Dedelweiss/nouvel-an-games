const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Stockage des parties en mémoire
const rooms = new Map();

// ==================== FONCTIONS UTILITAIRES ====================

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getRandomQuestions(count, exclude = []) {
  const available = hotSeatQuestions.filter(q => !exclude.includes(q));
  const shuffled = shuffleArray(available);
  return shuffled.slice(0, count);
}

function getUndercoverCount(playerCount) {
  if (playerCount <= 6) return 1;
  if (playerCount <= 12) return 2;
  if (playerCount <= 18) return 3;
  return 4;
}

function checkUndercoverVictory(room) {
  const alivePlayers = Array.from(room.players.values()).filter(p => p.isAlive);
  const aliveUndercovers = alivePlayers.filter(p => p.isUndercover);
  const aliveCivils = alivePlayers.filter(p => ! p.isUndercover && ! p.isMrWhite);
  const aliveMrWhite = alivePlayers.filter(p => p.isMrWhite);

  if (aliveUndercovers.length === 0 && aliveMrWhite.length === 0) {
    return {
      gameOver: true,
      winner: 'civils',
      message: '🎉 Les Civils ont gagné ! Tous les imposteurs ont été démasqués !'
    };
  }

  if (aliveUndercovers.length + aliveMrWhite.length >= aliveCivils.length) {
    return {
      gameOver: true,
      winner: 'undercover',
      message: '🕵️ Les Undercovers ont gagné !  Ils ont infiltré le groupe !'
    };
  }

  return { gameOver: false };
}

function formatPlayerData(player) {
  return {
    id: player.id,
    name:  player.name,
    isHost: player.isHost,
    isAlive: player.isAlive
  };
}

function formatPlayersArray(playersMap) {
  return Array.from(playersMap.values()).map(formatPlayerData);
}

// ==================== SOCKET.IO ====================

io.on('connection', (socket) => {
  console.log('Utilisateur connecté:', socket.id);

  // ==================== CRÉATION DE PARTIE ====================
  socket.on('createRoom', (data) => {
    let playerName, gameType;

    if (typeof data === 'string') {
      playerName = data;
      gameType = 'hotseat';
    } else {
      playerName = data.playerName;
      gameType = data.gameType || 'hotseat';
    }

    const roomCode = generateRoomCode();
    const odId = uuidv4();

    const room = {
      code: roomCode,
      host: odId,
      gameType: gameType,
      questionMode: 'default',
      players:  new Map(),
      gameStarted: false,
      // Hot Seat
      currentQuestionIndex: 0,
      questions: shuffleArray(hotSeatQuestions),
      customQuestions: [],
      submittedPlayers: new Set(),
      votes: new Map(),
      results: [],
      // Undercover
      currentWordPair: null,
      currentPlayerIndex: 0,
      roundNumber: 1,
      hints: [],
      eliminatedPlayers: [],
      playerOrder: [],
      waitingForMrWhite: null
    };

    room.players.set(odId, {
      id: odId,
      name: playerName,
      socketId: socket.id,
      isHost: true,
      isAlive: true,
      isUndercover: false,
      isMrWhite: false,
      word: null,
      hasGivenHint: false,
      submittedQuestions: []
    });

    rooms.set(roomCode, room);
    socket.join(roomCode);
    socket.roomCode = roomCode;
    socket.odId = odId;

    socket.emit('roomCreated', {
      roomCode,
      playerId: odId,
      gameType:  room.gameType,
      players: formatPlayersArray(room.players)
    });

    console.log(`Partie ${gameType} créée:  ${roomCode} par ${playerName}`);
  });

  // ==================== REJOINDRE UNE PARTIE ====================
  socket.on('joinRoom', ({ roomCode, playerName }) => {
    const room = rooms.get(roomCode.toUpperCase());

    if (!room) {
      socket.emit('error', { message: 'Code de partie invalide' });
      return;
    }

    if (room.gameStarted) {
      socket.emit('error', { message: 'La partie a déjà commencé' });
      return;
    }

    const odId = uuidv4();
    room.players.set(odId, {
      id: odId,
      name:  playerName,
      socketId: socket.id,
      isHost: false,
      isAlive: true,
      isUndercover: false,
      isMrWhite: false,
      word: null,
      hasGivenHint: false,
      submittedQuestions: []
    });

    socket.join(roomCode.toUpperCase());
    socket.roomCode = roomCode.toUpperCase();
    socket.odId = odId;

    const playersData = formatPlayersArray(room.players);

    socket.emit('roomJoined', {
      roomCode:  room.code,
      playerId: odId,
      gameType: room.gameType,
      questionMode: room.questionMode,
      players: playersData
    });

    socket.to(room.code).emit('playerJoined', {
      players: playersData
    });

    console.log(`${playerName} a rejoint la partie ${roomCode}`);
  });

  // ==================== CHANGER LE TYPE DE JEU ====================
  socket.on('changeGameType', (gameType) => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.host !== socket.odId) return;

    room.gameType = gameType;
    io.to(room.code).emit('gameTypeChanged', { gameType });
  });

  // ==================== CHANGER LE MODE DE QUESTIONS ====================
  socket.on('changeQuestionMode', (questionMode) => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.host !== socket.odId) return;

    room.questionMode = questionMode;
    io.to(room.code).emit('questionModeChanged', { questionMode });
  });

  // ==================== DÉMARRER LA PARTIE ====================
  socket.on('startGame', (data) => {
    const room = rooms.get(socket.roomCode);

    if (!room || room.host !== socket.odId) {
      socket.emit('error', { message: 'Seul l\'hôte peut démarrer la partie' });
      return;
    }

    const minPlayers = room.gameType === 'undercover' ? 4 : 2;
    if (room.players.size < minPlayers) {
      socket.emit('error', { message: `Il faut au moins ${minPlayers} joueurs` });
      return;
    }

    if (data && data.questionMode) {
      room.questionMode = data.questionMode;
    }

    if (room.gameType === 'hotseat' && room.questionMode === 'custom') {
      // Mode questions personnalisées :  collecter les questions
      room.submittedPlayers.clear();
      room.customQuestions = [];

      io.to(room.code).emit('collectQuestions', {
        totalPlayers: room.players.size
      });
    } else if (room.gameType === 'undercover') {
      room.gameStarted = true;
      startUndercoverGame(room);
    } else {
      room.gameStarted = true;
      startHotSeatGame(room);
    }
  });

  // ==================== SOUMETTRE DES QUESTIONS ====================
  socket.on('submitQuestions', ({ questions }) => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.gameType !== 'hotseat') return;

    const player = room.players.get(socket.odId);
    if (!player || room.submittedPlayers.has(socket.odId)) return;

    // Nombre de questions custom soumises (0, 1 ou 2)
    const customCount = questions ?  questions.length : 0;

    // Ajouter les questions custom
    if (questions && questions.length > 0) {
      questions.forEach(q => {
        if (q && q.trim()) {
          room.customQuestions.push(q.trim());
        }
      });
    }

    // Compléter avec des questions aléatoires pour arriver à 2
    const randomNeeded = 2 - customCount;
    if (randomNeeded > 0) {
      const randomQuestions = getRandomQuestions(randomNeeded, room.customQuestions);
      room.customQuestions.push(...randomQuestions);
    }

    room.submittedPlayers.add(socket.odId);
    player.submittedQuestions = questions || [];

    // Notifier tout le monde
    io.to(room.code).emit('playerSubmittedQuestions', {
      playerName: player.name,
      submittedCount: room.submittedPlayers.size,
      totalPlayers: room.players.size,
      customCount:  customCount
    });

    // Vérifier si tout le monde a soumis
    if (room.submittedPlayers.size === room.players.size) {
      // Mélanger les questions et démarrer
      room.questions = shuffleArray(room.customQuestions);
      room.gameStarted = true;

      io.to(room.code).emit('allQuestionsCollected', {
        totalQuestions: room.questions.length
      });

      // Petit délai pour le feedback
      setTimeout(() => {
        startHotSeatGame(room);
      }, 1500);
    }
  });

  // ==================== HOT SEAT LOGIC ====================
  function startHotSeatGame(room) {
    room.currentQuestionIndex = 0;
    room.votes.clear();
    room.results = [];

    const totalQuestions = Math.min(room.questions.length, room.players.size * 2);

    io.to(room.code).emit('gameStarted', {
      gameType: 'hotseat',
      question: room.questions[0],
      questionNumber: 1,
      totalQuestions:  totalQuestions,
      players: formatPlayersArray(room.players)
    });
  }

  socket.on('vote', (votedPlayerId) => {
    const room = rooms.get(socket.roomCode);
    if (!room || ! room.gameStarted) return;

    if (room.gameType === 'undercover') {
      handleUndercoverVote(room, socket.odId, votedPlayerId);
    } else {
      handleHotSeatVote(room, socket.odId, votedPlayerId);
    }
  });

  function handleHotSeatVote(room, odId, votedPlayerId) {
    room.votes.set(odId, votedPlayerId);

    io.to(room.code).emit('voteReceived', {
      odId:  odId,
      totalVotes: room.votes.size,
      totalPlayers: room.players.size
    });

    if (room.votes.size === room.players.size) {
      const voteCount = new Map();
      room.votes.forEach((votedId) => {
        voteCount.set(votedId, (voteCount.get(votedId) || 0) + 1);
      });

      let maxVotes = 0;
      let winners = [];

      voteCount.forEach((count, odId) => {
        if (count > maxVotes) {
          maxVotes = count;
          winners = [odId];
        } else if (count === maxVotes) {
          winners.push(odId);
        }
      });

      const winnerNames = winners.map(id => room.players.get(id)?.name || 'Inconnu');

      const voteDetails = [];
      room.votes.forEach((votedId, odId) => {
        voteDetails.push({
          voter: room.players.get(odId)?.name,
          votedFor: room.players.get(votedId)?.name
        });
      });

      room.results.push({
        question: room.questions[room.currentQuestionIndex],
        winners: winnerNames,
        votes: maxVotes,
        details: voteDetails
      });

      const totalQuestions = Math.min(room.questions.length, room.players.size * 2);

      io.to(room.code).emit('questionResults', {
        winners: winnerNames,
        votes: maxVotes,
        voteDetails,
        isLastQuestion: room.currentQuestionIndex >= totalQuestions - 1
      });
    }
  }

  socket.on('nextQuestion', () => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.host !== socket.odId) return;

    if (room.gameType === 'hotseat') {
      room.currentQuestionIndex++;
      room.votes.clear();

      const totalQuestions = Math.min(room.questions.length, room.players.size * 2);

      if (room.currentQuestionIndex >= totalQuestions) {
        io.to(room.code).emit('gameEnded', { results: room.results });
        return;
      }

      io.to(room.code).emit('newQuestion', {
        question: room.questions[room.currentQuestionIndex],
        questionNumber: room.currentQuestionIndex + 1,
        totalQuestions: totalQuestions,
        players: formatPlayersArray(room.players)
      });
    }
  });

  // ==================== UNDERCOVER LOGIC ====================
  function startUndercoverGame(room) {
    const playerIds = Array.from(room.players.keys());
    const shuffledIds = shuffleArray(playerIds);
    const undercoverCount = getUndercoverCount(playerIds.length);

    const pairIndex = Math.floor(Math.random() * wordPairs.length);
    room.currentWordPair = wordPairs[pairIndex];

    const undercoverIds = shuffledIds.slice(0, undercoverCount);

    let mrWhiteId = null;
    if (playerIds.length >= 10) {
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
        player.word = "??? ";
      } else {
        player.isUndercover = false;
        player.isMrWhite = false;
        player.word = room.currentWordPair[0];
      }
    });

    room.playerOrder = shuffleArray(playerIds);
    room.currentPlayerIndex = 0;
    room.roundNumber = 1;
    room.hints = [];
    room.votes.clear();
    room.eliminatedPlayers = [];

    room.players.forEach((player, odId) => {
      const playerSocket = io.sockets.sockets.get(player.socketId);
      if (playerSocket) {
        playerSocket.emit('gameStarted', {
          gameType: 'undercover',
          yourWord: player.word,
          yourRole: player.isMrWhite ?  'mrwhite' : (player.isUndercover ? 'undercover' : 'civil'),
          undercoverCount: undercoverCount,
          hasMrWhite:  mrWhiteId !== null,
          players: formatPlayersArray(room.players),
          currentPlayerId: room.playerOrder[0],
          roundNumber: 1
        });
      }
    });

    console.log(`Undercover démarré:  ${undercoverCount} imposteurs, Mr. White: ${mrWhiteId !== null}`);
  }

  socket.on('hintDone', () => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.gameType !== 'undercover') return;

    const currentPlayerId = room.playerOrder[room.currentPlayerIndex];
    if (socket.odId !== currentPlayerId) {
      socket.emit('error', { message: 'Ce n\'est pas ton tour !' });
      return;
    }

    const player = room.players.get(socket.odId);
    if (!player || !player.isAlive || player.hasGivenHint) return;

    player.hasGivenHint = true;

    room.currentPlayerIndex++;

    while (room.currentPlayerIndex < room.playerOrder.length) {
      const nextPlayerId = room.playerOrder[room.currentPlayerIndex];
      const nextPlayer = room.players.get(nextPlayerId);
      if (nextPlayer && nextPlayer.isAlive && !nextPlayer.hasGivenHint) {
        break;
      }
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
  });

  function handleUndercoverVote(room, odId, votedPlayerId) {
    const voter = room.players.get(odId);
    if (!voter || !voter.isAlive) return;

    room.votes.set(odId, votedPlayerId);

    const alivePlayers = Array.from(room.players.values()).filter(p => p.isAlive);

    io.to(room.code).emit('undercoverVoteReceived', {
      odId: odId,
      totalVotes: room.votes.size,
      totalPlayers:  alivePlayers.length
    });

    if (room.votes.size === alivePlayers.length) {
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
        io.to(room.code).emit('undercoverTie', {
          message: 'Égalité !  Personne n\'est éliminé ce tour.',
          tiedPlayers: eliminated.map(id => room.players.get(id)?.name)
        });
        startNewUndercoverRound(room);
        return;
      }

      const eliminatedId = eliminated[0];
      const eliminatedPlayer = room.players.get(eliminatedId);
      eliminatedPlayer.isAlive = false;
      room.eliminatedPlayers.push({
        id: eliminatedId,
        name: eliminatedPlayer.name,
        wasUndercover: eliminatedPlayer.isUndercover,
        wasMrWhite:  eliminatedPlayer.isMrWhite
      });

      if (eliminatedPlayer.isMrWhite) {
        const playerSocket = io.sockets.sockets.get(eliminatedPlayer.socketId);
        if (playerSocket) {
          playerSocket.emit('mrWhiteGuess', {
            message: 'Tu as été éliminé !  Tu peux tenter de deviner le mot des Civils pour gagner.'
          });
        }

        io.to(room.code).emit('mrWhiteEliminated', {
          playerName: eliminatedPlayer.name,
          message: `${eliminatedPlayer.name} était Mr.White !  Il peut tenter de deviner le mot...`
        });

        room.waitingForMrWhite = eliminatedId;
        return;
      }

      const victory = checkUndercoverVictory(room);

      const voteDetails = [];
      room.votes.forEach((votedId, odId) => {
        voteDetails.push({
          voter: room.players.get(odId)?.name,
          votedFor: room.players.get(votedId)?.name
        });
      });

      if (victory.gameOver) {
        io.to(room.code).emit('undercoverGameEnd', {
          winner: victory.winner,
          message: victory.message,
          eliminatedPlayer: eliminatedPlayer.name,
          wasUndercover: eliminatedPlayer.isUndercover,
          wasMrWhite: eliminatedPlayer.isMrWhite,
          wordPair: room.currentWordPair,
          voteDetails,
          allPlayers: Array.from(room.players.values()).map(p => ({
            name: p.name,
            role: p.isMrWhite ?  'Mr.White' : (p.isUndercover ? 'Undercover' : 'Civil'),
            word: p.word
          }))
        });
      } else {
        io.to(room.code).emit('undercoverElimination', {
          eliminatedPlayer: eliminatedPlayer.name,
          wasUndercover: eliminatedPlayer.isUndercover,
          wasMrWhite: eliminatedPlayer.isMrWhite,
          voteDetails,
          remainingPlayers: alivePlayers
            .filter(p => p.isAlive)
            .map(p => ({ id: p.id, name: p.name }))
        });

        setTimeout(() => startNewUndercoverRound(room), 3000);
      }
    }
  }

  socket.on('mrWhiteGuessWord', (guessedWord) => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.waitingForMrWhite !== socket.odId) return;

    const correctWord = room.currentWordPair[0].toLowerCase();
    const guess = guessedWord.toLowerCase().trim();

    room.waitingForMrWhite = null;

    if (guess === correctWord) {
      io.to(room.code).emit('undercoverGameEnd', {
        winner: 'mrwhite',
        message: `🎭 Mr.White a deviné le mot "${room.currentWordPair[0]}" !  Il gagne la partie !`,
        wordPair: room.currentWordPair,
        allPlayers: Array.from(room.players.values()).map(p => ({
          name: p.name,
          role:  p.isMrWhite ? 'Mr.White' :  (p.isUndercover ? 'Undercover' :  'Civil'),
          word: p.word
        }))
      });
    } else {
      const victory = checkUndercoverVictory(room);

      if (victory.gameOver) {
        io.to(room.code).emit('undercoverGameEnd', {
          winner:  victory.winner,
          message: victory.message + ` (Mr.White a deviné "${guessedWord}" - incorrect)`,
          wordPair: room.currentWordPair,
          allPlayers: Array.from(room.players.values()).map(p => ({
            name:  p.name,
            role: p.isMrWhite ? 'Mr. White' : (p.isUndercover ? 'Undercover' : 'Civil'),
            word: p.word
          }))
        });
      } else {
        io.to(room.code).emit('mrWhiteGuessFailed', {
          message: `Mr.White a deviné "${guessedWord}" - C'est incorrect !  La partie continue.`
        });
        startNewUndercoverRound(room);
      }
    }
  });

  function startNewUndercoverRound(room) {
    room.roundNumber++;
    room.votes.clear();
    room.currentPlayerIndex = 0;

    room.players.forEach(player => {
      if (player.isAlive) {
        player.hasGivenHint = false;
      }
    });

    const alivePlayers = Array.from(room.players.entries())
      .filter(([, p]) => p.isAlive)
      .map(([id]) => id);
    room.playerOrder = shuffleArray(alivePlayers);

    io.to(room.code).emit('undercoverNewRound', {
      roundNumber: room.roundNumber,
      currentPlayerId: room.playerOrder[0],
      players: Array.from(room.players.values())
        .filter(p => p.isAlive)
        .map(p => ({ id: p.id, name: p.name }))
    });
  }

  // ==================== NOUVELLE PARTIE ====================
  socket.on('restartGame', () => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.host !== socket.odId) return;

    room.gameStarted = false;
    room.currentQuestionIndex = 0;
    room.questions = shuffleArray(hotSeatQuestions);
    room.customQuestions = [];
    room.submittedPlayers.clear();
    room.votes.clear();
    room.results = [];
    room.hints = [];
    room.eliminatedPlayers = [];
    room.roundNumber = 1;
    room.waitingForMrWhite = null;

    room.players.forEach(player => {
      player.isAlive = true;
      player.isUndercover = false;
      player.isMrWhite = false;
      player.word = null;
      player.hasGivenHint = false;
      player.submittedQuestions = [];
    });

    io.to(room.code).emit('gameRestarted', {
      players: formatPlayersArray(room.players)
    });
  });

  // ==================== DÉCONNEXION ====================
  socket.on('disconnect', () => {
    const room = rooms.get(socket.roomCode);

    if (room) {
      const player = room.players.get(socket.odId);

      if (room.gameStarted && room.gameType === 'undercover' && player) {
        player.isAlive = false;

        io.to(room.code).emit('playerDisconnected', {
          playerName: player.name,
          players: Array.from(room.players.values())
            .filter(p => p.isAlive)
            .map(p => ({ id: p.id, name: p.name }))
        });

        if (room.playerOrder[room.currentPlayerIndex] === socket.odId) {
          room.currentPlayerIndex++;
          // Trouver le prochain joueur vivant
          while (room.currentPlayerIndex < room.playerOrder.length) {
            const nextPlayerId = room.playerOrder[room.currentPlayerIndex];
            const nextPlayer = room.players.get(nextPlayerId);
            if (nextPlayer && nextPlayer.isAlive) {
              io.to(room.code).emit('hintGiven', {
                playerId:  socket.odId,
                playerName:  player.name,
                nextPlayerId:  nextPlayerId,
                hintsCount:  Array.from(room.players.values()).filter(p => p.isAlive && p.hasGivenHint).length,
                totalPlayers: Array.from(room.players.values()).filter(p => p.isAlive).length
              });
              break;
            }
            room.currentPlayerIndex++;
          }
        }

        // Vérifier la victoire après déconnexion
        const victory = checkUndercoverVictory(room);
        if (victory.gameOver) {
          io.to(room.code).emit('undercoverGameEnd', {
            winner:  victory.winner,
            message: victory.message,
            wordPair: room.currentWordPair,
            allPlayers: Array.from(room.players.values()).map(p => ({
              name:  p.name,
              role: p.isMrWhite ? 'Mr. White' : (p.isUndercover ? 'Undercover' : 'Civil'),
              word: p.word
            }))
          });
        }
      } else {
        room.players.delete(socket.odId);
      }

      if (room.players.size === 0 || Array.from(room.players.values()).every(p => ! p.isAlive)) {
        rooms.delete(socket.roomCode);
        console.log(`Partie ${socket.roomCode} supprimée`);
      } else {
        if (room.host === socket.odId) {
          const newHost = Array.from(room.players.values()).find(p => p.isAlive !== false);
          if (newHost) {
            room.host = newHost.id;
            newHost.isHost = true;
          }
        }

        io.to(room.code).emit('playerLeft', {
          players: formatPlayersArray(room.players)
        });
      }
    }

    console.log('Utilisateur déconnecté:', socket.id);
  });
});

// ==================== DÉMARRAGE DU SERVEUR ====================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎉 Serveur lancé sur http://localhost:${PORT}`);
});