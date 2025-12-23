// utils/data.js

const hotSeatQuestions = [
  "Qui est le plus susceptible de finir en prison ?",
  "Qui est le plus susceptible de devenir millionnaire ?",
  "Qui est le plus susceptible d'oublier l'anniversaire de son partenaire ?",
  "Qui est le plus susceptible de survivre à une apocalypse zombie ?",
  "Qui est le plus susceptible de pleurer devant un film ?",
  "Qui est le plus susceptible de s'endormir en soirée ?",
  "Qui est le plus susceptible de faire une scène en public ?",
  "Qui est le plus susceptible de gagner un concours de mangeurs de hot-dogs ?",
  "Qui est le plus susceptible de se marier à Las Vegas sur un coup de tête ?",
  "Qui est le plus susceptible de perdre son téléphone ?",
  "Qui est le plus susceptible de devenir influenceur ?",
  "Qui est le plus susceptible de rire au mauvais moment ?",
  "Qui est le plus susceptible d'avoir un tatouage honteux ?",
  "Qui est le plus susceptible de mentir sur son CV ?",
  "Qui est le plus susceptible de tromper son partenaire ?",
  "Qui chante le plus mal sous la douche ?",
  "Qui passe le plus de temps aux toilettes ?",
  "Qui est le plus susceptible de casser quelque chose ce soir ?",
  "Qui a les pires goûts musicaux ?",
  "Qui est le plus susceptible de rejoindre une secte ?"
];

const wordPairs = [
  ["Pizza", "Tarte"], ["Facebook", "Instagram"], ["Batman", "Superman"],
  ["Coca-Cola", "Pepsi"], ["McDonald's", "Burger King"], ["Chat", "Chien"],
  ["Paris", "Londres"], ["Plage", "Piscine"], ["Ski", "Snowboard"],
  ["Bière", "Vin"], ["Café", "Thé"], ["Netflix", "YouTube"],
  ["iPhone", "Samsung"], ["Chocolat", "Caramel"], ["Dentiste", "Médecin"],
  ["Bus", "Métro"], ["Guitare", "Piano"], ["Football", "Rugby"],
  ["Croissant", "Pain au chocolat"], ["Noël", "Nouvel An"],
  ["Mariage", "Anniversaire"], ["Livre", "Film"], ["Lunettes", "Lentilles"],
  ["Tatouage", "Piercing"], ["Fromage", "Beurre"], ["Champagne", "Prosecco"],
  ["TikTok", "Instagram Reels"], ["Uber", "Taxi"], ["Airbnb", "Hôtel"],
  ["Google", "Bing"], ["WhatsApp", "Messenger"], ["Mario", "Sonic"],
  ["Harry Potter", "Seigneur des Anneaux"], ["Star Wars", "Star Trek"],
  ["Stranger Things", "Black Mirror"], ["Spotify", "Apple Music"],
  ["Jean", "Pantalon"], ["Baskets", "Chaussures"], ["Sushi", "Maki"],
  ["Hamburger", "Hot-dog"], ["Crêpe", "Gaufre"], ["Glace", "Sorbet"],
  ["Mojito", "Caïpirinha"], ["Vodka", "Rhum"], ["Karaoké", "Blind test"],
  ["Poker", "Blackjack"], ["Monopoly", "Uno"], ["Escape Game", "Laser Game"],
  ["Camping", "Glamping"], ["Vélo", "Trottinette"], ["Avion", "Train"],
  ["Montagne", "Mer"], ["Été", "Printemps"], ["Lundi", "Mardi"],
  ["Matin", "Soir"], ["Douche", "Bain"], ["Canapé", "Fauteuil"],
  ["Coussin", "Oreiller"], ["Couverture", "Plaid"], ["Bougie", "Encens"]
];

// Si tu veux gérer la logique de roue côté serveur (optionnel mais propre)
const wheelSegments = [
  { color: '#e74c3c', name: '{player1} prend chère', count: 1, target: 'player1' },
  { color: '#f39c12', name: '{player2} prend chère', count: 1, target: 'player2' },
  { color: '#2ecc71', name: 'Tranquillou', count: 0, target: 'none' },
  { color: '#3498db', name: 'Collectif', count: 1, target: 'both' },
  { color: '#9b59b6', name: '{player1} le master', count: 0, target: 'player1_gives' },
  { color: '#1abc9c', name: '{player2} le master', count: 0, target: 'player2_gives' },
  { color: '#e67e22', name: 'Défi du destin', count: 1, target: 'game' },
  { color: '#34495e', name: 'Jackpot ou malchance!', count: 3, target: 'jackpot' }
];

module.exports = { hotSeatQuestions, wordPairs, wheelSegments };