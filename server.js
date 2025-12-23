const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Questions aléatoires
const questions = [
  "Qui est le plus susceptible de danser sur la table ce soir ?",
  "Qui va s'endormir en premier ? ",
  "Qui est le plus bavard du groupe ?",
  "Qui ferait le meilleur discours de minuit ?",
  "Qui est le plus susceptible d'oublier ses bonnes résolutions ?",
  "Qui est le roi/la reine des selfies ?",
  "Qui arriverait en retard à son propre mariage ?",
  "Qui survivrait le plus longtemps sur une île déserte ?",
  "Qui est le plus susceptible de devenir célèbre ?",
  "Qui a le rire le plus contagieux ?",
  "Qui est le plus gourmand ? ",
  "Qui est le pire menteur ?",
  "Qui serait le meilleur super-héros ?",
  "Qui est le plus susceptible de gagner au loto et de tout dépenser en une semaine ?",
  "Qui est le plus romantique ?",
  "Qui ferait le meilleur détective ?",
  "Qui est le plus susceptible de pleurer devant un film ?",
  "Qui est le plus chanceux ?",
  "Qui est le plus susceptible de faire une bêtise ce soir ?",
  "Qui a le meilleur sens de l'humour ?",
  "Qui est le plus susceptible de perdre son téléphone ?",
  "Qui serait le pire coloc ?",
  "Qui est le plus créatif ?",
  "Qui est le plus susceptible de lancer un nouveau trend ?",
  "Qui est le meilleur cuisinier ?",
  "Qui est le plus compétitif ?",
  "Qui est le plus susceptible de finir les restes ?",
  "Qui donnerait les meilleurs conseils ? ",
  "Qui est le plus susceptible de faire un road trip spontané ?",
  "Qui est le plus têtu ?"
];

// Stockage des parties en mémoire
const rooms = new Map();

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled. length - 1; i > 0; i--) {
    const j = Math.floor(Math. random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

io.on('connection', (socket) => {
  console.log('Utilisateur connecté:', socket.id);

  // Créer une nouvelle partie
  socket. on('createRoom', (playerName) => {
    const roomCode = generateRoomCode();
    const playerId = uuidv4();
    
    const room = {
      code: roomCode,
      host: playerId,
      players: new Map(),
      gameStarted: false,
      currentQuestionIndex: 0,
      questions: shuffleArray(questions),
      votes: new Map(),
      results: []
    };
    
    room.players.set(playerId, {
      id: playerId,
      name: playerName,
      socketId: socket.id,
      isHost: true
    });
    
    rooms.set(roomCode, room);
    socket.join(roomCode);
    socket.roomCode = roomCode;
    socket.playerId = playerId;
    
    socket.emit('roomCreated', {
      roomCode,
      playerId,
      players: Array.from(room. players.values())
    });
    
    console.log(`Partie créée:  ${roomCode} par ${playerName}`);
  });

  // Rejoindre une partie
  socket.on('joinRoom', ({ roomCode, playerName }) => {
    const room = rooms.get(roomCode. toUpperCase());
    
    if (! room) {
      socket.emit('error', { message: 'Code de partie invalide' });
      return;
    }
    
    if (room.gameStarted) {
      socket.emit('error', { message: 'La partie a déjà commencé' });
      return;
    }
    
    const playerId = uuidv4();
    room.players.set(playerId, {
      id: playerId,
      name:  playerName,
      socketId: socket. id,
      isHost:  false
    });
    
    socket. join(roomCode. toUpperCase());
    socket.roomCode = roomCode.toUpperCase();
    socket.playerId = playerId;
    
    socket.emit('roomJoined', {
      roomCode:  room.code,
      playerId,
      players: Array.from(room.players. values())
    });
    
    socket.to(room.code).emit('playerJoined', {
      players: Array.from(room.players.values())
    });
    
    console. log(`${playerName} a rejoint la partie ${roomCode}`);
  });

  // Démarrer la partie
  socket. on('startGame', () => {
    const room = rooms.get(socket.roomCode);
    
    if (!room || room.host !== socket.playerId) {
      socket.emit('error', { message: 'Seul l\'hôte peut démarrer la partie' });
      return;
    }
    
    if (room.players.size < 2) {
      socket.emit('error', { message:  'Il faut au moins 2 joueurs' });
      return;
    }
    
    room.gameStarted = true;
    room.currentQuestionIndex = 0;
    room.votes. clear();
    
    io.to(room.code).emit('gameStarted', {
      question: room.questions[0],
      questionNumber: 1,
      totalQuestions: Math.min(10, room.questions. length),
      players: Array.from(room.players.values())
    });
    
    console. log(`Partie ${room.code} démarrée! `);
  });

  // Voter pour un joueur
  socket. on('vote', (votedPlayerId) => {
    const room = rooms.get(socket. roomCode);
    
    if (!room || ! room.gameStarted) return;
    
    room.votes.set(socket.playerId, votedPlayerId);
    
    // Notifier les autres qu'un vote a été fait (sans révéler le choix)
    io.to(room. code).emit('voteReceived', {
      voterId: socket.playerId,
      totalVotes: room. votes.size,
      totalPlayers: room.players.size
    });
    
    // Vérifier si tout le monde a voté
    if (room.votes.size === room. players.size) {
      // Calculer les résultats
      const voteCount = new Map();
      room.votes.forEach((votedId) => {
        voteCount.set(votedId, (voteCount.get(votedId) || 0) + 1);
      });
      
      let maxVotes = 0;
      let winners = [];
      
      voteCount.forEach((count, playerId) => {
        if (count > maxVotes) {
          maxVotes = count;
          winners = [playerId];
        } else if (count === maxVotes) {
          winners.push(playerId);
        }
      });
      
      const winnerNames = winners.map(id => room.players.get(id)?.name || 'Inconnu');
      
      // Détails des votes
      const voteDetails = [];
      room.votes.forEach((votedId, odId) => {
        voteDetails.push({
          voter: room.players. get(odId)?.name,
          votedFor: room.players. get(votedId)?.name
        });
      });
      
      room.results.push({
        question: room.questions[room.currentQuestionIndex],
        winners: winnerNames,
        votes: maxVotes,
        details: voteDetails
      });
      
      io.to(room. code).emit('questionResults', {
        winners: winnerNames,
        votes: maxVotes,
        voteDetails,
        isLastQuestion: room.currentQuestionIndex >= Math.min(9, room.questions. length - 1)
      });
    }
  });

  // Question suivante
  socket.on('nextQuestion', () => {
    const room = rooms.get(socket. roomCode);
    
    if (!room || room.host !== socket.playerId) return;
    
    room.currentQuestionIndex++;
    room.votes.clear();
    
    if (room.currentQuestionIndex >= Math.min(10, room.questions. length)) {
      // Fin de la partie
      io.to(room. code).emit('gameEnded', {
        results: room.results
      });
      return;
    }
    
    io. to(room.code).emit('newQuestion', {
      question: room.questions[room.currentQuestionIndex],
      questionNumber: room. currentQuestionIndex + 1,
      totalQuestions: Math.min(10, room.questions.length),
      players: Array.from(room. players.values())
    });
  });

  // Nouvelle partie
  socket.on('restartGame', () => {
    const room = rooms.get(socket.roomCode);
    
    if (!room || room. host !== socket.playerId) return;
    
    room. gameStarted = false;
    room. currentQuestionIndex = 0;
    room.questions = shuffleArray(questions);
    room.votes.clear();
    room.results = [];
    
    io.to(room.code).emit('gameRestarted', {
      players: Array.from(room.players.values())
    });
  });

  // Déconnexion
  socket.on('disconnect', () => {
    const room = rooms.get(socket.roomCode);
    
    if (room) {
      room. players.delete(socket.playerId);
      
      if (room.players. size === 0) {
        rooms.delete(socket. roomCode);
        console.log(`Partie ${socket.roomCode} supprimée (plus de joueurs)`);
      } else {
        // Si l'hôte part, transférer à un autre joueur
        if (room.host === socket.playerId) {
          const newHost = room.players.values().next().value;
          if (newHost) {
            room.host = newHost.id;
            newHost.isHost = true;
          }
        }
        
        io.to(room.code).emit('playerLeft', {
          players: Array.from(room.players.values())
        });
      }
    }
    
    console.log('Utilisateur déconnecté:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server. listen(PORT, () => {
  console.log(`🎉 Serveur lancé sur http://localhost:${PORT}`);
});