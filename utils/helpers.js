// utils/helpers.js
const { v4: uuidv4 } = require('uuid');

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

function formatPlayerData(player) {
  return {
    id: player.id,
    name: player.name,
    isHost: player.isHost,
    isAlive: player.isAlive
  };
}

function formatPlayersArray(playersMap) {
  return Array.from(playersMap.values()).map(formatPlayerData);
}

function createPlayer(name, socketId, isHost) {
  const odId = uuidv4();
  return {
    id: odId,
    name: name,
    socketId: socketId,
    isHost: isHost,
    isAlive: true,
    isUndercover: false,
    isMrWhite: false,
    word: null,
    hasGivenHint: false,
    submittedQuestions: []
  };
}

module.exports = {
  generateRoomCode,
  shuffleArray,
  formatPlayersArray,
  createPlayer,
  formatPlayerData
};