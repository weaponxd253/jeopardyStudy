# Jeopardy Study Game

Try it here → https://weaponxd253.github.io/jeopardyStudy/

A web-based Jeopardy-style study game with a searchable topic library,
a countdown timer, and score tracking.

## Features

- 31 study topics across Tech & CS, Health Sciences, Natural Science, Math,
  Humanities, Social Science, Aviation, Sports, Pop Culture, and Movies & TV
- Topic browser with search, category filter chips, and a Random pick
- 30-second countdown timer per question with visual progress bar
- Score tracking — correct answers add points, wrong answers deduct them
  (running out of time costs nothing)
- Forgiving answer checking: "What is…" phrasing, leading articles,
  punctuation, accents, and small typos in longer answers are all accepted
- Instant feedback showing accepted answers and explanations
- Keyboard friendly: Enter submits, Escape closes the result, focus returns
  to the board
- Responsive layout for desktop and mobile

## How to Play

1. Browse or search the topic cards (or hit **Random**), then click **Play**
2. Click any dollar value on the board to reveal a question
3. Type your answer and press **Submit** or **Enter**
4. Your score updates automatically — use **Change Topic** to pick another board

## File Structure

- `index.html` — Game structure and layout
- `style.css` — Styling and animations
- `script.js` — Topic browser, game logic, timer, and scoring
- `topics.json` — Backup copy of the topic manifest

## Question Data

Topics and questions are loaded at runtime from the companion
[JeopardyApi](https://github.com/weaponxd253/JeopardyApi) repo
(`https://weaponxd253.github.io/JeopardyApi/`):

- `topics.json` — the manifest of topics (`label`, `filename`, `category`, `icon`)
- `<filename>.json` — one file per topic with a `categories` array and a
  `questions` object keyed by category, then by dollar value

To add a topic, add its JSON file and a manifest entry in JeopardyApi. The
`topics.json` in this repo is not read by the app.

## Roadmap

- Backend for saving high scores
- Custom question editor so users can add their own categories
- Multiplayer / buzzer mode
