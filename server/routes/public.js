'use strict';

const express = require('express');
const store = require('../store');
const db = require('../db');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({
    ok: true,
    mode: 'server',
    version: require('../../package.json').version,
    updatedAt: db.updatedAt(),
    time: new Date().toISOString(),
  });
});

router.get('/bootstrap', (req, res) => res.json(store.bootstrap()));

router.get('/home', (req, res) => res.json(store.homeFeed()));

router.get('/live', (req, res) =>
  res.json({ generatedAt: db.updatedAt(), matches: store.liveMatches() })
);

router.get('/competitions', (req, res) =>
  res.json({ generatedAt: db.updatedAt(), competitions: store.listCompetitions() })
);

router.get('/competition/:id', (req, res) => {
  const data = store.competitionDetail(req.params.id);
  if (!data) return res.status(404).json({ error: 'Competition not found' });
  res.json(data);
});

router.get('/scorers', (req, res) => {
  const { competition, limit } = req.query;
  res.json({
    generatedAt: db.updatedAt(),
    players: store.scorerBoard(competition || null, Number(limit) || 50),
  });
});

router.get('/match/:id', (req, res) => {
  const data = store.matchDetail(req.params.id);
  if (!data) return res.status(404).json({ error: 'Match not found' });
  res.json(data);
});

router.get('/team/:id', (req, res) => {
  const data = store.teamDetail(req.params.id);
  if (!data) return res.status(404).json({ error: 'Team not found' });
  res.json(data);
});

router.get('/player/:id', (req, res) => {
  const data = store.playerDetail(req.params.id);
  if (!data) return res.status(404).json({ error: 'Player not found' });
  res.json(data);
});

router.get('/search', (req, res) => res.json(store.searchIndex()));

router.get('/matches', (req, res) => {
  const { competition, team } = req.query;
  let matches;
  if (team) matches = store.matchesByTeam(team);
  else if (competition) matches = store.matchesByCompetition(competition);
  else matches = store.matchesByCompetition(store.listCompetitions()[0]?.id || '');
  res.json({ generatedAt: db.updatedAt(), matches });
});

module.exports = router;
