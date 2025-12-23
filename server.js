const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// Imports locaux
const { generateRoomCode, formatPlayersArray, createPlayer } = require('./utils/helpers');
const hotSeatGame = require('./games/hotseat');
const undercoverGame = require('./games/undercover');
const rouletteGame = require('./games/roulette');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Stockage des parties
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('Utilisateur connecté:', socket.id);

  // --- CRÉATION DE PARTIE ---
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
    
    // Objet Room
    const room = {
      code: roomCode,
      host: null,
      gameType: gameType,
      questionMode: 'default',
      players: new Map(),
      gameStarted: false,
    };

    // Initialisation des modules
    hotSeatGame.initGame(room);
    undercoverGame.initGame(room);
    rouletteGame.initGame(room);

    // Création Host
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
      players: formatPlayersArray(room.players)
    });
    console.log(`Partie ${gameType} créée: ${roomCode}`);
  });

  // --- REJOINDRE UNE PARTIE ---
  socket.on('joinRoom', ({ roomCode, playerName }) => {
    const room = rooms.get(roomCode.toUpperCase());
    
    if (!room) {
      return socket.emit('error', { message: 'Code de partie invalide' });
    }

    // Validation Roulette : Max 2 joueurs
    if (room.gameType === 'roulette' && room.players.size >= 2) {
      return socket.emit('error', { message: 'La partie de Roulette est complète (2 max)' });
    }

    if (room.gameStarted) {
      return socket.emit('error', { message: 'La partie a déjà commencé' });
    }

    const player = createPlayer(playerName, socket.id, false);
    room.players.set(player.id, player);

    socket.join(room.code);
    socket.roomCode = room.code;
    socket.odId = player.id;

    const playersData = formatPlayersArray(room.players);
    socket.emit('roomJoined', {
      roomCode: room.code,
      playerId: player.id,
      gameType: room.gameType,
      questionMode: room.questionMode,
      players: playersData
    });
    socket.to(room.code).emit('playerJoined', { players: playersData });
  });

  // --- CONFIGURATION (CORRECTION ICI POUR LE CHANGEMENT DE JEU) ---
  socket.on('changeGameType', (gameType) => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.host !== socket.odId) return;

    // --- CORRECTION : Validation avant de changer de jeu ---
    if (gameType === 'undercover' && room.players.size < 4) {
      // On remet le type précédent pour l'hôte visuellement s'il a forcé le changement
      io.to(room.hostSocketId).emit('gameTypeChanged', { gameType: room.gameType }); 
      return socket.emit('error', { message: 'Il faut au moins 4 joueurs pour passer en Undercover' });
    }
    
    if (gameType === 'roulette' && room.players.size > 2) {
       return socket.emit('error', { message: 'Trop de joueurs pour la Roulette (Max 2)' });
    }
    // -------------------------------------------------------

    room.gameType = gameType;
    io.to(room.code).emit('gameTypeChanged', { gameType });
  });

  socket.on('changeQuestionMode', (mode) => {
    const room = rooms.get(socket.roomCode);
    if (room && room.host === socket.odId) {
      room.questionMode = mode;
      io.to(room.code).emit('questionModeChanged', { questionMode: mode });
    }
  });

  // --- DÉMARRAGE (CORRECTION DES VALIDATIONS) ---
  socket.on('startGame', (data) => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.host !== socket.odId) return;

    if (data && data.questionMode) room.questionMode = data.questionMode;

    // 1. Validation Hot Seat
    if (room.gameType === 'hotseat') {
      if (room.players.size < 2) {
        return socket.emit('error', { message: 'Il faut au moins 2 joueurs pour Hot Seat !' });
      }
      
      if (room.questionMode === 'custom') {
        io.to(room.code).emit('collectQuestions', { totalPlayers: room.players.size });
      } else {
        room.gameStarted = true;
        hotSeatGame.startGame(io, room);
      }
    } 
    // 2. Validation Undercover
    else if (room.gameType === 'undercover') {
      if (room.players.size < 4) {
        return socket.emit('error', { message: 'Il faut au moins 4 joueurs pour Undercover !' });
      }
      room.gameStarted = true;
      undercoverGame.startGame(io, room);
    } 
    // 3. Validation Roulette
    else if (room.gameType === 'roulette') {
      if (room.players.size < 2) {
        return socket.emit('error', { message: 'Il faut exactement 2 joueurs pour la Roulette !' });
      }
      room.gameStarted = true;
      rouletteGame.startGame(io, room);
    }
  });

  // --- ÉVÉNEMENTS HOT SEAT ---
  socket.on('submitQuestions', ({ questions }) => {
    const room = rooms.get(socket.roomCode);
    if (room && room.gameType === 'hotseat') {
      hotSeatGame.submitQuestions(io, socket, room, questions);
    }
  });

  socket.on('vote', (votedId) => {
    const room = rooms.get(socket.roomCode);
    if (!room || !room.gameStarted) return;
    
    if (room.gameType === 'hotseat') {
      hotSeatGame.handleVote(io, socket, room, votedId);
    } else if (room.gameType === 'undercover') {
      undercoverGame.handleVote(io, socket, room, votedId);
    }
  });

  socket.on('nextQuestion', () => {
    const room = rooms.get(socket.roomCode);
    if (room && room.gameType === 'hotseat') hotSeatGame.nextQuestion(io, room);
  });

  // --- ÉVÉNEMENTS UNDERCOVER ---
  socket.on('hintDone', () => {
    const room = rooms.get(socket.roomCode);
    if (room && room.gameType === 'undercover') undercoverGame.handleHint(io, socket, room);
  });

  socket.on('mrWhiteGuessWord', (word) => {
    const room = rooms.get(socket.roomCode);
    if (room && room.gameType === 'undercover') undercoverGame.handleMrWhiteGuess(io, socket, room, word);
  });

  // --- ÉVÉNEMENTS ROULETTE ---
  socket.on('rouletteResult', (data) => {
    const room = rooms.get(socket.roomCode);
    if (room && room.gameType === 'roulette') rouletteGame.handleResult(io, socket, room, data);
  });

  // --- RESTART ---
  socket.on('restartGame', () => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.host !== socket.odId) return;

    room.gameStarted = false;
    // Réinitialiser les états
    hotSeatGame.initGame(room);
    undercoverGame.initGame(room);
    rouletteGame.initGame(room);

    // Reset joueurs
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

  // --- DÉCONNEXION ---
  socket.on('disconnect', () => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;

    const player = room.players.get(socket.odId);
    
    // Gestion spécifique déconnexion Undercover
    if (room.gameStarted && room.gameType === 'undercover' && player) {
       player.isAlive = false;
       io.to(room.code).emit('playerDisconnected', { 
         playerName: player.name, 
         players: formatPlayersArray(room.players) 
       });
       // Note : Pour une gestion parfaite de l'undercover (passer le tour si c'est à lui),
       // il faudrait appeler une fonction dans undercoverGame.js ici.
    } else {
      room.players.delete(socket.odId);
    }

    if (room.players.size === 0) {
      rooms.delete(socket.roomCode);
      console.log(`Partie ${socket.roomCode} supprimée`);
    } else {
      // Transfert d'hôte si nécessaire
      if (room.host === socket.odId) {
        const newHost = Array.from(room.players.values()).find(p => p.isAlive !== false);
        if (newHost) {
          room.host = newHost.id;
          newHost.isHost = true;
        }
      }
      
      if (room.gameType === 'roulette') {
          io.to(room.code).emit('roulettePlayerLeft');
      } else {
          io.to(room.code).emit('playerLeft', { players: formatPlayersArray(room.players) });
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎉 Serveur modulaire lancé sur http://localhost:${PORT}`);
});