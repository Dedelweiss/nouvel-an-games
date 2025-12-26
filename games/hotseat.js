// games/hotseat.js
const { hotSeatQuestions } = require('../utils/data');
const { shuffleArray, formatPlayersArray } = require('../utils/helpers');

function initGame(room) {
  room.currentQuestionIndex = 0;
  room.questions = shuffleArray(hotSeatQuestions);
  room.customQuestions = [];
  room.submittedPlayers = new Set();
  room.votes = new Map();
  room.results = [];
}

function calculateTotal(room) {
  if (room.questionMode === 'custom') {
    return room.questions.length;
  }
  return Math.min(room.questions.length, room.players.size * 5);
}

function submitQuestions(io, socket, room, questions) {
  const player = room.players.get(socket.odId);
  if (!player || room.submittedPlayers.has(socket.odId)) return;

  const validQuestions = questions ? questions.filter(q => q && q.trim().length > 0) : [];
  
  if (validQuestions.length > 0) {
    room.customQuestions.push(...validQuestions);
  }

  room.submittedPlayers.add(socket.odId);
  player.submittedQuestions = questions || [];

  io.to(room.code).emit('playerSubmittedQuestions', {
    playerName: player.name,
    submittedCount: room.submittedPlayers.size,
    totalPlayers: room.players.size
  });

  if (room.submittedPlayers.size === room.players.size) {
    if (room.customQuestions.length === 0) {
        room.customQuestions = getRandomQuestions(room.players.size * 3);
    }
    room.questions = shuffleArray(room.customQuestions);
    room.gameStarted = true;
    io.to(room.code).emit('allQuestionsCollected', { totalQuestions: room.questions.length });
    
    setTimeout(() => {
      startGame(io, room);
    }, 1500);
  }
}

function getRandomQuestions(count) {
  return hotSeatQuestions.slice(0, count);
}

function startGame(io, room) {
  room.currentQuestionIndex = 0;
  room.votes.clear();
  room.results = [];

  if (room.questionMode === 'default') {
      room.questions = shuffleArray(hotSeatQuestions);
  }

  const totalQuestions = calculateTotal(room);

  io.to(room.code).emit('gameStarted', {
    gameType: 'hotseat',
    question: room.questions[0],
    questionNumber: 1,
    totalQuestions: totalQuestions,
    players: formatPlayersArray(room.players)
  });
}

function handleVote(io, socket, room, votedPlayerId) {
  console.log(`[DEBUG] Vote reçu de ${socket.odId} (${room.players.get(socket.odId)?.name})`);

  room.votes.set(socket.odId, votedPlayerId);

  const totalPlayers = room.players.size;
  const currentVotes = room.votes.size;

  console.log(`[DEBUG] État des votes : ${currentVotes} votes / ${totalPlayers} joueurs`);
  console.log(`[DEBUG] Votants :`, Array.from(room.votes.keys()));
  console.log(`[DEBUG] Joueurs :`, Array.from(room.players.keys()));

  io.to(room.code).emit('voteReceived', {
    totalVotes: currentVotes
  });

  if (currentVotes >= totalPlayers) {
    console.log("[DEBUG] ✅ Tous les votes sont là ! Calcul des résultats...");
    processResults(io, room);
  } else {
    console.log(`[DEBUG] ⏳ En attente... Manque ${totalPlayers - currentVotes} votes.`);
  }
}

function processResults(io, room) {
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
  
  room.votes.forEach((votedId, voterId) => {
    const voterName = room.players.get(voterId)?.name || 'Inconnu';
    const votedName = room.players.get(votedId)?.name || 'Inconnu';
    voteDetails.push({ voter: voterName, votedFor: votedName });
  });

  const isUnanimous = (maxVotes === room.players.size) && (room.players.size > 1);

  room.results.push({
    question: room.questions[room.currentQuestionIndex],
    winners: winnerNames,
    votes: maxVotes,
    details: voteDetails
  });

  const totalQuestions = calculateTotal(room);

  io.to(room.code).emit('questionResults', {
    winners: winnerNames,
    votes: maxVotes,
    voteDetails,
    isLastQuestion: room.currentQuestionIndex >= totalQuestions - 1,
    unanimous: isUnanimous
  });
}

function nextQuestion(io, room) {
  room.currentQuestionIndex++;
  room.votes.clear();

  const totalQuestions = calculateTotal(room);

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

module.exports = { initGame, startGame, submitQuestions, handleVote, nextQuestion };