// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const { generateRoomCode, formatPlayersArray, createPlayer } = require('./utils/helpers');
const hotSeatGame = require('./games/hotseat');
const undercoverGame = require('./games/undercover');
const rouletteGame = require('./games/roulette'); // Import du module

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const rooms = new Map();

io.on('connection', (socket) => {
  console.log('Utilisateur connecté:', socket.id);

  // --- CRÉATION ---
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
    const room = {
      code: roomCode,
      host: null,
      gameType: gameType,
      questionMode: 'default',
      players: new Map(),
      gameStarted: false,
    };

    hotSeatGame.initGame(room);
    undercoverGame.initGame(room);
    rouletteGame.initGame(room);

    console.log(`Creating room with code: ${roomCode} and game type: ${gameType}, nom du joueur: ${playerName}`);

    const player = createPlayer(playerName, socket.id, true);
    room.host = player.id;
    room.players.set(player.id, player);

    rooms.set(roomCode, room);
    socket.join(roomCode);
    socket.roomCode = roomCode;
    socket.odId = player.id;

    socket.emit('roomCreated', {
      roomCode,
      playerId: player.id,
      gameType: room.gameType,
      players: formatPlayersArray(room.players),
      // Si on crée une roulette direct, on envoie la config
      wheelConfig: (gameType === 'roulette') ? rouletteGame.getWheelConfig() : null
    });
    console.log(`Partie ${gameType} créée: ${roomCode}`);
  });

  // --- REJOINDRE ---
  socket.on('joinRoom', ({ roomCode, playerName }) => {
    const room = rooms.get(roomCode.toUpperCase());
    if (!room) return socket.emit('error', { message: 'Code invalide' });

    // Validation stricte Roulette (Max 2)
    if (room.gameType === 'roulette' && room.players.size >= 2) {
      return socket.emit('error', { message: 'La partie est complète (Max 2 joueurs)' });
    }

    if (room.gameStarted) return socket.emit('error', { message: 'La partie a déjà commencé' });

    // Annuler suppression si salle vide
    if (room.deleteTimeout) {
      clearTimeout(room.deleteTimeout);
      room.deleteTimeout = null;
    }

    const player = createPlayer(playerName, socket.id, false);
    room.players.set(player.id, player);

    socket.join(room.code);
    socket.roomCode = room.code;
    socket.odId = player.id;

    const playersData = formatPlayersArray(room.players);
    
    // REFACTOR IMPORTANT : On envoie la config de la roue ici aussi
    socket.emit('roomJoined', {
      roomCode: room.code,
      playerId: player.id,
      gameType: room.gameType,
      questionMode: room.questionMode,
      players: playersData,
      wheelConfig: (room.gameType === 'roulette') ? rouletteGame.getWheelConfig() : null
    });
    
    socket.to(room.code).emit('playerJoined', { players: playersData });
  });

  // --- CONFIGURATION ---
  socket.on('changeGameType', (gameType) => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.host !== socket.odId) return;

    // Validation avant changement
    if (gameType === 'undercover' && room.players.size < 4) {
      return socket.emit('error', { message: 'Il faut 4 joueurs min. pour Undercover' });
    }
    if (gameType === 'roulette' && room.players.size > 2) {
      return socket.emit('error', { message: 'Max 2 joueurs pour la Roulette' });
    }

    room.gameType = gameType;
    
    // On notifie tout le monde et on envoie la config si c'est roulette
    io.to(room.code).emit('gameTypeChanged', { 
      gameType,
      wheelConfig: (gameType === 'roulette') ? rouletteGame.getWheelConfig() : null
    });
  });

  socket.on('changeQuestionMode', (mode) => {
    const room = rooms.get(socket.roomCode);
    if (room && room.host === socket.odId) {
      room.questionMode = mode;
      io.to(room.code).emit('questionModeChanged', { questionMode: mode });
    }
  });

  // --- DÉMARRAGE ---
  socket.on('startGame', (data) => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.host !== socket.odId) return;

    if (data && data.questionMode) room.questionMode = data.questionMode;

    if (room.gameType === 'hotseat') {
      if (room.players.size < 2) return socket.emit('error', { message: 'Il faut au moins 2 joueurs' });
      
      if (room.questionMode === 'custom') {
        io.to(room.code).emit('collectQuestions', { totalPlayers: room.players.size });
      } else {
        room.gameStarted = true;
        hotSeatGame.startGame(io, room);
      }
    } 
    else if (room.gameType === 'undercover') {
      if (room.players.size < 4) return socket.emit('error', { message: 'Il faut au moins 4 joueurs' });
      room.gameStarted = true;
      undercoverGame.startGame(io, room, data);
    } 
    else if (room.gameType === 'roulette') {
      if (room.players.size < 2) return socket.emit('error', { message: 'Il faut 2 joueurs' });
      room.gameStarted = true;
      rouletteGame.startGame(io, room);
    }
  });

  // --- ROUTAGE JEUX ---
  socket.on('submitQuestions', (d) => {
    const r = rooms.get(socket.roomCode);
    if (r?.gameType === 'hotseat') hotSeatGame.submitQuestions(io, socket, r, d.questions);
  });
  
  socket.on('vote', (id) => {
    const r = rooms.get(socket.roomCode);
    if (!r?.gameStarted) return;
    if (r.gameType === 'hotseat') hotSeatGame.handleVote(io, socket, r, id);
    else if (r.gameType === 'undercover') undercoverGame.handleVote(io, socket, r, id);
  });

  socket.on('nextQuestion', () => {
    const r = rooms.get(socket.roomCode);
    if (r?.gameType === 'hotseat') hotSeatGame.nextQuestion(io, r);
  });

  socket.on('hintDone', () => {
    const r = rooms.get(socket.roomCode);
    if (r?.gameType === 'undercover') undercoverGame.handleHint(io, socket, r);
  });

  socket.on('mrWhiteGuessWord', (w) => {
    const r = rooms.get(socket.roomCode);
    if (r?.gameType === 'undercover') undercoverGame.handleMrWhiteGuess(io, socket, r, w);
  });

  // Roulette Events
  socket.on('requestSpin', () => {
    const r = rooms.get(socket.roomCode);
    if (r?.gameType === 'roulette') rouletteGame.handleSpinRequest(io, socket, r);
  });

  socket.on('requestNextTurn', () => {
    const r = rooms.get(socket.roomCode);
    if (r?.gameType === 'roulette') rouletteGame.handleNextTurn(io, r);
  });

  // --- SYSTÈME ---
  socket.on('restartGame', () => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.host !== socket.odId) return;

    room.gameStarted = false;
    hotSeatGame.initGame(room);
    undercoverGame.initGame(room);
    rouletteGame.initGame(room);

    room.players.forEach(p => {
      p.isAlive = true;
      p.isUndercover = false;
      p.isMrWhite = false;
      p.word = null;
      p.hasGivenHint = false;
      p.submittedQuestions = [];
    });

    io.to(room.code).emit('gameRestarted', { players: formatPlayersArray(room.players) });
  });

  socket.on('disconnect', () => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;

    const player = room.players.get(socket.odId);
    if (room.gameStarted && room.gameType === 'undercover' && player) {
       player.isAlive = false;
       io.to(room.code).emit('playerDisconnected', { 
         playerName: player.name, 
         players: formatPlayersArray(room.players) 
       });
    } else {
      room.players.delete(socket.odId);
    }

    if (room.players.size === 0) {
      console.log(`Salle ${socket.roomCode} vide. Suppression dans 5 min...`);
      room.deleteTimeout = setTimeout(() => {
        if (rooms.has(socket.roomCode)) rooms.delete(socket.roomCode);
      }, 5 * 60 * 1000);
    } else {
      if (room.host === socket.odId) {
        const newHost = Array.from(room.players.values()).find(p => p.isAlive !== false);
        if (newHost) {
          room.host = newHost.id;
          newHost.isHost = true;
        }
      }
      if (room.gameType === 'roulette') io.to(room.code).emit('roulettePlayerLeft');
      else io.to(room.code).emit('playerLeft', { players: formatPlayersArray(room.players) });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎉 Serveur lancé sur http://localhost:${PORT}`);
});