// utils/helpers.js
const { v4: uuidv4 } = require('uuid');

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const easterEggs = {
  "soeur de lucas": "Maman de Sacha",
  "lise": "Maman de Maxim",
  "soeur lucas": "Maman de Simon",
  "maxim": "J'ai disparu depuis que je suis en couple (Maxim)",
  "lucas": "Beau gosse Ultime omg (Lucas)",
  "charlotte": "Reviens stp tu me manques",
  "sacha": "Futur papa (Sacha)",
  "mathéo": "30cm (Matheo)",
  "titouan": "Salut je fais le DJ pour draguer (Titouan)",
  "simon": "Miam pied omg (Simon)",
  "tom": "Meilleur pote de Nao (Tom)",
  "oliver": "Aller demain je suis sérieux Muscu ! (Oliver)",
  "guex": "30 ans bientot hein (Guex)",
  "nao": "La meilleure pote de Lucas (Nao)",
  "axel": "J'ai 100k sur mon compte bonjour (Axel)",
  "lea": "Sauvez moi de Maxim aled (Lea)",
  "john": "Je chante une 30eme fois ce soir (John)",
  "pierre": "Je suis moins fort en math que Lucas (Pierre)",
  "olivier": "Grosse merde humaine (Olivier)",
};


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
  const cleanName = name.trim();
  const lowerName = cleanName.toLowerCase();
  
  let finalName = cleanName;

  if (easterEggs[lowerName]) {
    finalName = easterEggs[lowerName];
  }

  const odId = uuidv4();
  return {
    id: odId,
    name: finalName,
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