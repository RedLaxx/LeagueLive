'use strict';

/**
 * Reference data for the demo database: competitions, clubs and name pools
 * used to generate believable squads.
 *
 * Everything here is fictional player/manager data attached to real clubs so
 * the app has something realistic to show on first run. Replace it from the
 * admin panel whenever you like.
 */

/* ------------------------------------------------------------------ */
/* competitions                                                        */
/* ------------------------------------------------------------------ */

const UCL_ZONES = [
  { from: 1, to: 8, color: '#2f7cf6', label: 'Round of 16' },
  { from: 9, to: 24, color: '#f6a723', label: 'Play-offs' },
];

const competitions = [
  {
    id: 'epl',
    name: 'Premier League',
    shortName: 'Premier League',
    country: 'England',
    season: '2026/27',
    type: 'league',
    stage: 'Season',
    color: '#3d195b',
    emblem: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    roundsPlayed: 9,
    intervalDays: 7,
    todayRound: true,
    doubleRound: true,
    zones: [
      { from: 1, to: 4, color: '#2f7cf6', label: 'Champions League' },
      { from: 5, to: 5, color: '#f6a723', label: 'Europa League' },
      { from: 6, to: 6, color: '#9b5de5', label: 'Conference League' },
      { from: 18, to: 20, color: '#ef4444', label: 'Relegation' },
    ],
    mix: { eng: 0.3, esp: 0.05, ita: 0.03, ger: 0.03, fra: 0.12, bra: 0.12, por: 0.07, ned: 0.06, misc: 0.14, nga: 0.08 },
  },
  {
    id: 'laliga',
    name: 'LaLiga',
    shortName: 'LaLiga',
    country: 'Spain',
    season: '2026/27',
    type: 'league',
    stage: 'Season',
    color: '#f5a623',
    emblem: '🇪🇸',
    roundsPlayed: 8,
    intervalDays: 7,
    todayRound: true,
    doubleRound: true,
    zones: [
      { from: 1, to: 4, color: '#2f7cf6', label: 'Champions League' },
      { from: 5, to: 6, color: '#f6a723', label: 'Europa League' },
      { from: 7, to: 7, color: '#9b5de5', label: 'Conference League' },
      { from: 8, to: 10, color: '#ef4444', label: 'Relegation' },
    ],
    mix: { esp: 0.55, bra: 0.12, por: 0.08, fra: 0.06, ita: 0.04, eng: 0.03, nga: 0.02, misc: 0.1 },
  },
  {
    id: 'seriea',
    name: 'Serie A',
    shortName: 'Serie A',
    country: 'Italy',
    season: '2026/27',
    type: 'league',
    stage: 'Season',
    color: '#0f8a5f',
    emblem: '🇮🇹',
    roundsPlayed: 7,
    intervalDays: 7,
    todayRound: true,
    doubleRound: true,
    zones: [
      { from: 1, to: 4, color: '#2f7cf6', label: 'Champions League' },
      { from: 5, to: 6, color: '#f6a723', label: 'Europa League' },
      { from: 8, to: 8, color: '#ef4444', label: 'Relegation' },
    ],
    mix: { ita: 0.5, esp: 0.06, fra: 0.08, bra: 0.1, por: 0.05, ger: 0.04, misc: 0.17 },
  },
  {
    id: 'bundesliga',
    name: 'Bundesliga',
    shortName: 'Bundesliga',
    country: 'Germany',
    season: '2026/27',
    type: 'league',
    stage: 'Season',
    color: '#d81f26',
    emblem: '🇩🇪',
    roundsPlayed: 7,
    intervalDays: 7,
    todayRound: true,
    doubleRound: true,
    zones: [
      { from: 1, to: 4, color: '#2f7cf6', label: 'Champions League' },
      { from: 5, to: 6, color: '#f6a723', label: 'Europa League' },
      { from: 7, to: 8, color: '#ef4444', label: 'Relegation' },
    ],
    mix: { ger: 0.48, fra: 0.08, ned: 0.08, esp: 0.05, ita: 0.04, bra: 0.06, misc: 0.21 },
  },
  {
    id: 'npfl',
    name: 'Nigeria Premier Football League',
    shortName: 'NPFL',
    country: 'Nigeria',
    season: '2026/27',
    type: 'league',
    stage: 'Season',
    color: '#0f9d58',
    emblem: '🇳🇬',
    roundsPlayed: 6,
    intervalDays: 7,
    todayRound: true,
    doubleRound: true,
    zones: [
      { from: 1, to: 2, color: '#2f7cf6', label: 'CAF Champions League' },
      { from: 3, to: 4, color: '#f6a723', label: 'CAF Confederation Cup' },
      { from: 9, to: 10, color: '#ef4444', label: 'Relegation' },
    ],
    mix: { nga: 0.92, misc: 0.08 },
  },
  {
    id: 'ucl',
    name: 'UEFA Champions League',
    shortName: 'UCL',
    country: 'Europe',
    season: '2026/27',
    type: 'cup',
    stage: 'League Phase',
    color: '#0a2a66',
    emblem: '⭐',
    roundsPlayed: 2,
    intervalDays: 14,
    todayRound: true,
    doubleRound: false,
    zones: UCL_ZONES,
    mix: { esp: 0.2, eng: 0.2, ger: 0.15, ita: 0.15, fra: 0.1, bra: 0.08, por: 0.06, misc: 0.06 },
  },
];

/* ------------------------------------------------------------------ */
/* clubs                                                               */
/* ------------------------------------------------------------------ */

const clubs = [
  // ---------------- Premier League ----------------
  { comp: 'epl', name: 'Arsenal', code: 'ARS', color: '#ef0107', venue: 'Emirates Stadium', city: 'London', country: 'England', founded: 1886 },
  { comp: 'epl', name: 'Manchester City', code: 'MCI', color: '#6cabdd', venue: 'Etihad Stadium', city: 'Manchester', country: 'England', founded: 1880 },
  { comp: 'epl', name: 'Liverpool', code: 'LIV', color: '#c8102e', venue: 'Anfield', city: 'Liverpool', country: 'England', founded: 1892 },
  { comp: 'epl', name: 'Chelsea', code: 'CHE', color: '#034694', venue: 'Stamford Bridge', city: 'London', country: 'England', founded: 1905 },
  { comp: 'epl', name: 'Manchester United', code: 'MUN', color: '#da291c', venue: 'Old Trafford', city: 'Manchester', country: 'England', founded: 1878 },
  { comp: 'epl', name: 'Tottenham Hotspur', code: 'TOT', color: '#132257', venue: 'Tottenham Hotspur Stadium', city: 'London', country: 'England', founded: 1882 },
  { comp: 'epl', name: 'Newcastle United', code: 'NEW', color: '#241f20', venue: "St James' Park", city: 'Newcastle', country: 'England', founded: 1892 },
  { comp: 'epl', name: 'Aston Villa', code: 'AVL', color: '#670e36', venue: 'Villa Park', city: 'Birmingham', country: 'England', founded: 1874 },
  { comp: 'epl', name: 'Brighton & Hove Albion', code: 'BHA', color: '#0057b8', venue: 'American Express Stadium', city: 'Brighton', country: 'England', founded: 1901 },
  { comp: 'epl', name: 'West Ham United', code: 'WHU', color: '#7a263a', venue: 'London Stadium', city: 'London', country: 'England', founded: 1895 },
  { comp: 'epl', name: 'Crystal Palace', code: 'CRY', color: '#1b458f', venue: 'Selhurst Park', city: 'London', country: 'England', founded: 1905 },
  { comp: 'epl', name: 'Everton', code: 'EVE', color: '#003399', venue: 'Hill Dickinson Stadium', city: 'Liverpool', country: 'England', founded: 1878 },
  { comp: 'epl', name: 'Brentford', code: 'BRE', color: '#e30613', venue: 'Gtech Community Stadium', city: 'Brentford', country: 'England', founded: 1889 },
  { comp: 'epl', name: 'Nottingham Forest', code: 'NFO', color: '#dd0000', venue: 'The City Ground', city: 'Nottingham', country: 'England', founded: 1865 },
  { comp: 'epl', name: 'Fulham', code: 'FUL', color: '#cccccc', venue: 'Craven Cottage', city: 'London', country: 'England', founded: 1879 },
  { comp: 'epl', name: 'AFC Bournemouth', code: 'BOU', color: '#da291c', venue: 'Vitality Stadium', city: 'Bournemouth', country: 'England', founded: 1899 },
  { comp: 'epl', name: 'Wolverhampton Wanderers', code: 'WOL', color: '#fdb913', venue: 'Molineux Stadium', city: 'Wolverhampton', country: 'England', founded: 1877 },
  { comp: 'epl', name: 'Leeds United', code: 'LEE', color: '#ffcd00', venue: 'Elland Road', city: 'Leeds', country: 'England', founded: 1919 },
  { comp: 'epl', name: 'Sunderland', code: 'SUN', color: '#eb172b', venue: 'Stadium of Light', city: 'Sunderland', country: 'England', founded: 1879 },
  { comp: 'epl', name: 'Burnley', code: 'BUR', color: '#6c1d45', venue: 'Turf Moor', city: 'Burnley', country: 'England', founded: 1882 },

  // ---------------- LaLiga ----------------
  { comp: 'laliga', name: 'Real Madrid', code: 'RMA', color: '#febe10', venue: 'Santiago Bernabéu', city: 'Madrid', country: 'Spain', founded: 1902 },
  { comp: 'laliga', name: 'FC Barcelona', code: 'BAR', color: '#a50044', venue: 'Spotify Camp Nou', city: 'Barcelona', country: 'Spain', founded: 1899 },
  { comp: 'laliga', name: 'Atlético de Madrid', code: 'ATM', color: '#cb3524', venue: 'Riyadh Air Metropolitano', city: 'Madrid', country: 'Spain', founded: 1903 },
  { comp: 'laliga', name: 'Real Betis', code: 'BET', color: '#00954c', venue: 'Benito Villamarín', city: 'Seville', country: 'Spain', founded: 1907 },
  { comp: 'laliga', name: 'Villarreal CF', code: 'VIL', color: '#ffe667', venue: 'Estadio de la Cerámica', city: 'Villarreal', country: 'Spain', founded: 1923 },
  { comp: 'laliga', name: 'Athletic Club', code: 'ATH', color: '#ee2523', venue: 'San Mamés', city: 'Bilbao', country: 'Spain', founded: 1898 },
  { comp: 'laliga', name: 'Real Sociedad', code: 'RSO', color: '#0067b1', venue: 'Reale Arena', city: 'San Sebastián', country: 'Spain', founded: 1909 },
  { comp: 'laliga', name: 'Sevilla FC', code: 'SEV', color: '#d9042b', venue: 'Ramón Sánchez-Pizjuán', city: 'Seville', country: 'Spain', founded: 1890 },
  { comp: 'laliga', name: 'Valencia CF', code: 'VAL', color: '#f4b223', venue: 'Mestalla', city: 'Valencia', country: 'Spain', founded: 1919 },
  { comp: 'laliga', name: 'Girona FC', code: 'GIR', color: '#cd2534', venue: 'Estadi Montilivi', city: 'Girona', country: 'Spain', founded: 1930 },

  // ---------------- Serie A ----------------
  { comp: 'seriea', name: 'Inter', code: 'INT', color: '#0068a8', venue: 'San Siro', city: 'Milan', country: 'Italy', founded: 1908 },
  { comp: 'seriea', name: 'AC Milan', code: 'MIL', color: '#fb090b', venue: 'San Siro', city: 'Milan', country: 'Italy', founded: 1899 },
  { comp: 'seriea', name: 'Juventus', code: 'JUV', color: '#2b2b2b', venue: 'Allianz Stadium', city: 'Turin', country: 'Italy', founded: 1897 },
  { comp: 'seriea', name: 'Napoli', code: 'NAP', color: '#12a0d7', venue: 'Diego Armando Maradona Stadium', city: 'Naples', country: 'Italy', founded: 1926 },
  { comp: 'seriea', name: 'Atalanta', code: 'ATA', color: '#1f1f1f', venue: 'Gewiss Stadium', city: 'Bergamo', country: 'Italy', founded: 1907 },
  { comp: 'seriea', name: 'AS Roma', code: 'ROM', color: '#8e1f2f', venue: 'Stadio Olimpico', city: 'Rome', country: 'Italy', founded: 1927 },
  { comp: 'seriea', name: 'Lazio', code: 'LAZ', color: '#87d8f7', venue: 'Stadio Olimpico', city: 'Rome', country: 'Italy', founded: 1900 },
  { comp: 'seriea', name: 'Fiorentina', code: 'FIO', color: '#592c82', venue: 'Artemio Franchi', city: 'Florence', country: 'Italy', founded: 1926 },

  // ---------------- Bundesliga ----------------
  { comp: 'bundesliga', name: 'Bayern München', code: 'BAY', color: '#dc052d', venue: 'Allianz Arena', city: 'Munich', country: 'Germany', founded: 1900 },
  { comp: 'bundesliga', name: 'Borussia Dortmund', code: 'BVB', color: '#fde100', venue: 'Signal Iduna Park', city: 'Dortmund', country: 'Germany', founded: 1909 },
  { comp: 'bundesliga', name: 'Bayer Leverkusen', code: 'B04', color: '#e32219', venue: 'BayArena', city: 'Leverkusen', country: 'Germany', founded: 1904 },
  { comp: 'bundesliga', name: 'RB Leipzig', code: 'RBL', color: '#dd0741', venue: 'Red Bull Arena', city: 'Leipzig', country: 'Germany', founded: 2009 },
  { comp: 'bundesliga', name: 'Eintracht Frankfurt', code: 'SGE', color: '#e1000f', venue: 'Deutsche Bank Park', city: 'Frankfurt', country: 'Germany', founded: 1899 },
  { comp: 'bundesliga', name: 'VfB Stuttgart', code: 'VFB', color: '#e32219', venue: 'MHPArena', city: 'Stuttgart', country: 'Germany', founded: 1893 },
  { comp: 'bundesliga', name: "Borussia Mönchengladbach", code: 'BMG', color: '#00a650', venue: 'Borussia-Park', city: 'Mönchengladbach', country: 'Germany', founded: 1900 },
  { comp: 'bundesliga', name: 'Werder Bremen', code: 'SVW', color: '#1d9053', venue: 'Weserstadion', city: 'Bremen', country: 'Germany', founded: 1899 },

  // ---------------- NPFL ----------------
  { comp: 'npfl', name: 'Enyimba International', code: 'ENY', color: '#0b6b3a', venue: 'Enyimba International Stadium', city: 'Aba', country: 'Nigeria', founded: 1976 },
  { comp: 'npfl', name: 'Kano Pillars', code: 'KAN', color: '#f5c518', venue: 'Sani Abacha Stadium', city: 'Kano', country: 'Nigeria', founded: 1990 },
  { comp: 'npfl', name: 'Rangers International', code: 'RAN', color: '#e4002b', venue: 'Nnamdi Azikiwe Stadium', city: 'Enugu', country: 'Nigeria', founded: 1970 },
  { comp: 'npfl', name: 'Remo Stars', code: 'REM', color: '#1b75bb', venue: 'Remo Stars Stadium', city: 'Ikenne', country: 'Nigeria', founded: 1990 },
  { comp: 'npfl', name: 'Rivers United', code: 'RIV', color: '#0072bc', venue: 'Adokiye Amiesimaka Stadium', city: 'Port Harcourt', country: 'Nigeria', founded: 2016 },
  { comp: 'npfl', name: 'Shooting Stars', code: 'SHO', color: '#0f5c3f', venue: 'Lekan Salami Stadium', city: 'Ibadan', country: 'Nigeria', founded: 1960 },
  { comp: 'npfl', name: 'Bendel Insurance', code: 'BEN', color: '#1e6f50', venue: 'Samuel Ogbemudia Stadium', city: 'Benin City', country: 'Nigeria', founded: 1972 },
  { comp: 'npfl', name: 'Akwa United', code: 'AKW', color: '#c8102e', venue: 'Godswill Akpabio Stadium', city: 'Uyo', country: 'Nigeria', founded: 1996 },
  { comp: 'npfl', name: 'Plateau United', code: 'PLA', color: '#f4a300', venue: 'New Jos Stadium', city: 'Jos', country: 'Nigeria', founded: 1975 },
  { comp: 'npfl', name: 'Niger Tornadoes', code: 'TOR', color: '#3f7f3f', venue: 'Bako Kontagora Stadium', city: 'Minna', country: 'Nigeria', founded: 1979 },
];

/** Champions League entrants (reuses the clubs above). */
const uclEntrants = [
  'Real Madrid',
  'Manchester City',
  'Bayern München',
  'Inter',
  'FC Barcelona',
  'Liverpool',
  'Arsenal',
  'Bayer Leverkusen',
];

/* ------------------------------------------------------------------ */
/* name pools                                                          */
/* ------------------------------------------------------------------ */

const POOLS = {
  eng: {
    nationality: 'England',
    first: ['Jack', 'Harry', 'Callum', 'Oliver', 'Reece', 'Mason', 'Ethan', 'Josh', 'Tyler', 'Ryan', 'Declan', 'Jude', 'Marcus', 'Ben', 'James', 'Luke', 'Sam', 'Nathan', 'Ollie', 'Alfie', 'Levi', 'Curtis', 'Emile', 'Eberechi', 'Noni', 'Harvey', 'Morgan', 'Dominic', 'Charlie', 'Lewis'],
    last: ['Smith', 'Wilson', 'Walker', 'Palmer', 'Fletcher', 'Bennett', 'Hughes', 'Clarke', 'Abbott', 'Pearson', 'Marshall', 'Dawson', 'Richardson', 'Griffiths', 'Holmes', 'Chandler', 'Whitaker', 'Ashworth', 'Radcliffe', 'Kershaw', 'Bromley', 'Hargreaves', 'Winslow', 'Ellison', 'Fairhurst', 'Milburn', 'Stanhope', 'Carraway', 'Dunstan', 'Halstead', 'Merrick', 'Osgood', 'Pemberton', 'Rushden', 'Staveley', 'Underwood', 'Bramwell', 'Coldwell', 'Draycott', 'Elmhurst'],
  },
  esp: {
    nationality: 'Spain',
    first: ['Álvaro', 'Sergio', 'Iker', 'Dani', 'Pablo', 'Marco', 'Alejandro', 'Hugo', 'Adrián', 'Rubén', 'Iván', 'Jorge', 'Unai', 'Mikel', 'Aitor', 'Gorka', 'Iñaki', 'Nacho', 'Brais', 'Ferrán', 'Pau', 'Arnau', 'Carlos', 'David', 'Javi', 'Víctor', 'Óscar', 'Manu', 'Ángel', 'Raúl'],
    last: ['Alcázar', 'Ballester', 'Cabrera', 'Domínguez', 'Espinosa', 'Ferrándiz', 'Gallego', 'Herrán', 'Ibáñez', 'Jarque', 'Lozano', 'Marchena', 'Nogueira', 'Ontiveros', 'Pacheco', 'Quintana', 'Requena', 'Salcedo', 'Trujillo', 'Ureña', 'Valdivia', 'Velasco', 'Zaldua', 'Arratia', 'Bermejo', 'Cifuentes', 'Delgado', 'Estévez', 'Fontán', 'Guzmán'],
  },
  ita: {
    nationality: 'Italy',
    first: ['Alessandro', 'Matteo', 'Lorenzo', 'Federico', 'Andrea', 'Gianluca', 'Marco', 'Davide', 'Simone', 'Nicolò', 'Salvatore', 'Vincenzo', 'Antonio', 'Fabio', 'Riccardo', 'Emanuele', 'Giorgio', 'Paolo', 'Stefano', 'Christian'],
    last: ['Bellini', 'Caruso', 'Donati', 'Ferrara', 'Greco', 'Lombardi', 'Moretti', 'Napolitano', 'Orsini', 'Pagano', 'Rinaldi', 'Santoro', 'Toscano', 'Valentini', 'Ambrogini', 'Barzetti', 'Castellani', 'Farina', 'Giuliani', 'Manfredi', 'Neri', 'Olivieri', 'Pieroni', 'Quaranta', 'Ruggiero', 'Sarnataro', 'Testa', 'Venditti', 'Zingale', 'Bertolucci'],
  },
  ger: {
    nationality: 'Germany',
    first: ['Leon', 'Finn', 'Jonas', 'Niklas', 'Maximilian', 'Tim', 'Lukas', 'Moritz', 'Paul', 'Felix', 'Jan', 'Erik', 'Noah', 'Marius', 'Anton', 'David', 'Elias', 'Julian', 'Luca', 'Tobias'],
    last: ['Abt', 'Brandauer', 'Dahlmann', 'Engelhardt', 'Fuchslocher', 'Grote', 'Hollmann', 'Isermeyer', 'Jungbluth', 'Kraft', 'Langhoff', 'Menzel', 'Niedermeier', 'Ostermann', 'Pfister', 'Quast', 'Reuter', 'Sommer', 'Tiedemann', 'Ulbricht', 'Vogelsang', 'Wagemann', 'Zeidler', 'Bartels', 'Drewes', 'Eisenberg', 'Frommann', 'Gerlach', 'Haubold', 'Kranz'],
  },
  nga: {
    nationality: 'Nigeria',
    first: ['Chidera', 'Kelechi', 'Samuel', 'Emmanuel', 'Ifeanyi', 'Chukwuemeka', 'Obinna', 'Musa', 'Uche', 'Emeka', 'Nnamdi', 'Sunday', 'Ibrahim', 'Victor', 'Tobi', 'Chinedu', 'Olawale', 'Sadiq', 'Yusuf', 'Ekene', 'Chidi', 'Ifedayo', 'Ayodeji', 'Michael', 'Daniel', 'Olamide', 'Segun', 'Fatai', 'Kingsley', 'Chigozie'],
    last: ['Okonkwo', 'Ezeh', 'Balogun', 'Adeyemi', 'Nwankwo', 'Okafor', 'Chukwu', 'Adebayo', 'Olatunji', 'Abubakar', 'Chukwuma', 'Dimgba', 'Etim', 'Igwe', 'Nwosu', 'Obasi', 'Ogunleye', 'Okoro', 'Onuoha', 'Umeh', 'Adeniran', 'Amoo', 'Bello', 'Dogo', 'Ekwueme', 'Gbadamosi', 'Idowu', 'Lawal', 'Nwachukwu', 'Odumosu', 'Oyelaran', 'Ugwu'],
  },
  fra: {
    nationality: 'France',
    first: ['Lucas', 'Hugo', 'Théo', 'Antoine', 'Youssef', 'Amine', 'Ilyes', 'Mathis', 'Enzo', 'Nolan', 'Rayan', 'Bilal', 'Clément', 'Dorian', 'Étienne', 'Farid', 'Gaël', 'Ilan', 'Jonathan', 'Karim', 'Loïc', 'Moussa', 'Nathan', 'Olivier', 'Pierre', 'Quentin', 'Rémy', 'Sofiane', 'Tristan', 'Valentin'],
    last: ['Aubert', 'Bonnefoy', 'Chevalier', 'Delacroix', 'Fontaine', 'Girard', 'Hubert', 'Joubert', 'Lacroix', 'Marchand', 'Noiret', 'Pichon', 'Renard', 'Salomon', 'Thibault', 'Vaillant', 'Yvon', 'Zeller', 'Beaumont', 'Cassagne', 'Devereux', 'Evrard', 'Ferrand', 'Garnier', 'Jourdan', 'Lemoine', 'Mercier', 'Navarre', 'Perrin', 'Vasseur'],
  },
  bra: {
    nationality: 'Brazil',
    first: ['Lucas', 'Gabriel', 'Matheus', 'Bruno', 'Rodrigo', 'Thiago', 'Rafael', 'Felipe', 'Gustavo', 'Vinícius', 'Anderson', 'Diego', 'Eduardo', 'Alan', 'Caio', 'Danilo', 'Everton', 'Guilherme', 'Igor', 'João', 'Léo', 'Murilo', 'Kauã', 'Pedro'],
    last: ['Alves', 'Barbosa', 'Cardoso', 'Duarte', 'Ferreira', 'Gomes', 'Henrique', 'Júnior', 'Lima', 'Macedo', 'Nogueira', 'Oliveira', 'Pereira', 'Queiroz', 'Ribeiro', 'Souza', 'Teixeira', 'Vasconcelos', 'Xavier', 'Bandeira', 'Coelho', 'Dantas', 'Espíndola', 'Furtado', 'Galvão', 'Itapará', 'Jardim', 'Lobato', 'Mangueira', 'Nascimento'],
  },
  por: {
    nationality: 'Portugal',
    first: ['Diogo', 'João', 'Rui', 'Bruno', 'André', 'Ricardo', 'Miguel', 'Tomás', 'Gonçalo', 'Pedro', 'Vasco', 'Afonso', 'Bernardo', 'Carlos', 'Duarte', 'Fábio', 'Hélder', 'Ivo', 'Jorge', 'Nuno'],
    last: ['Almeida', 'Barbosa', 'Coelho', 'Dias', 'Esteves', 'Fonseca', 'Guedes', 'Henriques', 'Leal', 'Matos', 'Neves', 'Paiva', 'Pinheiro', 'Resende', 'Sarmento', 'Tavares', 'Varela', 'Cardoso', 'Freitas', 'Mourão'],
  },
  ned: {
    nationality: 'Netherlands',
    first: ['Daan', 'Luuk', 'Sem', 'Thijs', 'Ruben', 'Joep', 'Milan', 'Niels', 'Bart', 'Stijn', 'Casper', 'Joris', 'Kees', 'Rens', 'Sven', 'Timon', 'Wout', 'Yannick', 'Jesse', 'Bram'],
    last: ['Bakker', 'de Wit', 'Jansen', 'Visser', 'Smit', 'Meijer', 'Mulder', 'de Boer', 'Dijkstra', 'Kuiper', 'Vandenberg', 'Hoekstra', 'Postma', 'Reinders', 'Schipper', 'Timmermans', 'Wolfs', 'Brandsma', 'Groeneveld', 'Haanstra'],
  },
  misc: {
    nationality: 'Croatia',
    first: ['Luka', 'Ivan', 'Marko', 'Duje', 'Nikola', 'Andrija', 'Marcel', 'Tobias', 'Yann', 'Kenan', 'Omar', 'Hamza', 'Tarek', 'Elias', 'Gustav', 'Mads', 'Kristian', 'Emil', 'Viktor', 'Andrei', 'Sergej', 'Tomas', 'Jakub', 'Marek', 'Petar', 'Stefan', 'Aleksandar', 'Edin', 'Armin', 'Giorgi'],
    last: ['Kovačević', 'Babić', 'Marković', 'Petrović', 'Horvat', 'Novak', 'Jovanović', 'Tomić', 'Šarić', 'Zorić', 'Hoxha', 'Berisha', 'Dervishi', 'Kastrati', 'Demir', 'Yalçın', 'Aydın', 'Kaya', 'Özdemir', 'Haddad', 'Mansour', 'Nasser', 'Rahmani', 'Cohen', 'Mizrahi', 'Levine', 'Rosenberg', 'Halvorsen', 'Nyberg', 'Sjöberg', 'Virtanen', 'Lehtinen', 'Dvorak', 'Havel', 'Kowalczyk', 'Zielinski', 'Nowicki', 'Balogh', 'Farkas', 'Nagy', 'Popescu', 'Ionescu', 'Dumitrescu', 'Kostov', 'Dimitrov', 'Iliev', 'Tsiklauri', 'Mchedlidze', 'Yamamoto', 'Tanaka', 'Nakamura', 'Park', 'Kim'],
    nationalities: ['Croatia', 'Serbia', 'Slovenia', 'Albania', 'Türkiye', 'Morocco', 'Egypt', 'Algeria', 'Israel', 'Norway', 'Sweden', 'Finland', 'Czechia', 'Poland', 'Hungary', 'Romania', 'Bulgaria', 'Georgia', 'Japan', 'South Korea', 'Switzerland', 'Austria', 'Belgium', 'Denmark', 'Greece', 'Scotland', 'Wales', 'Republic of Ireland', 'Argentina', 'Uruguay', 'Colombia', 'Mexico', 'Ghana', 'Senegal', 'Ivory Coast', 'Cameroon', 'Egypt', 'Morocco', 'Australia', 'USA', 'Canada'],
  },
};

/** Fictional managers, one per club, chosen by country. */
const MANAGERS = {
  England: ['Gareth Whitmore', 'Alan Redmond', 'Steve Ballard', 'Neil Fotheringay', 'Craig Donnelly', 'Paul Ashgrove', 'Ian Pickering', 'Danny Sillitoe', 'Mark Cresswell', 'Tony Braithwaite'],
  Spain: ['Xabier Etxarri', 'Diego Salvatierra', 'Manolo Ibarguren', 'Juan Carlos Bellver', 'Aitor Zubiaurre', 'Rafa Peñalver'],
  Italy: ['Gianni Belluti', 'Maurizio Sarnelli', 'Paolo Governale', 'Stefano Marchetti', 'Renato Fumagalli'],
  Germany: ['Jürgen Halstenberg', 'Tobias Grundmann', 'Markus Vetter', 'Sven Altenburg'],
  Nigeria: ['Coach Emeka Nwabueze', 'Coach Bala Mohammed', 'Coach Fidelis Obi', 'Coach Tunde Ajayi', 'Coach Monday Ogar'],
  Europe: ['Xabier Etxarri', 'Gianni Belluti', 'Jürgen Halstenberg', 'Gareth Whitmore'],
};

module.exports = { competitions, clubs, uclEntrants, POOLS, MANAGERS };
