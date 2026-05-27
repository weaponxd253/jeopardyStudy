const TEAM_COLORS = [
  '#ff3b3b', '#4da6ff', '#ffd700', '#4dff91',
  '#ff7c4d', '#c97bff', '#ff9ec8', '#00e5d4'
];

const TYPE_COLORS = {
  normal:   '#A8A8A8', fire:     '#F08030', water:    '#6890F0',
  grass:    '#78C850', electric: '#F8D030', ice:      '#98D8D8',
  fighting: '#C03028', poison:   '#A040A0', ground:   '#E0C068',
  flying:   '#A890F0', psychic:  '#F85888', bug:      '#A8B820',
  rock:     '#B8A038', ghost:    '#705898', dragon:   '#7038F8',
  dark:     '#705848', steel:    '#B8B8D0', fairy:    '#EE99AC'
};

const DEFAULT_NAMES = [
  'Red Bulls', 'Blue Jays', 'Gold Rush', 'Green Wave',
  'Blaze Squad', 'Purple Haze', 'Pink Tide', 'Teal Force'
];

const GENS = [
  { num: 1, label: 'Gen 1 — Kanto',  short: 'G1', start: 1,   end: 151, color: '#ff6b6b' },
  { num: 2, label: 'Gen 2 — Johto',  short: 'G2', start: 152, end: 251, color: '#ffd93d' },
  { num: 3, label: 'Gen 3 — Hoenn',  short: 'G3', start: 252, end: 386, color: '#6bcb77' },
  { num: 4, label: 'Gen 4 — Sinnoh', short: 'G4', start: 387, end: 493, color: '#4d96ff' },
];

// ── State ──
let allPokemon = [];
let teams = [];
let numTeams = 4, numRounds = 4;
let currentRound = 0, currentPickInRound = 0;
let draftedIds = new Set();
let snakeOrder = [];
let draftOrderIndices = [];  // team indices in pick order for current draft
let currentGenIdx = 0;
let draftNumber = 1;
let curSort = 'bst-desc', curSearch = '', curType = '';
let cpuThinking = false;

// ── Helpers ──
function getGen(id) {
  return GENS.find(g => id >= g.start && id <= g.end) ?? GENS[0];
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function teamTotalBst(team) {
  return team.picks.reduce((s, p) => s + (p?.bst ?? 0), 0);
}

// ── Setup ──
function updateTeamCount(val) {
  numTeams = parseInt(val);
  document.getElementById('numTeamsVal').textContent = val;
  renderNameInputs();
}

function updateRounds(val) {
  numRounds = parseInt(val);
  document.getElementById('numRoundsVal').textContent = val;
}

function renderNameInputs() {
  const grid = document.getElementById('teamNamesGrid');
  const existing = [...grid.querySelectorAll('.team-name-field')].map(i => i.value);
  const existingCpu = [...grid.querySelectorAll('.cpu-toggle')].map(b => b.dataset.cpu === 'true');
  grid.innerHTML = '';
  for (let i = 0; i < numTeams; i++) {
    const row = document.createElement('div');
    row.className = 'team-name-row';

    const dot = document.createElement('div');
    dot.className = 'team-dot';
    dot.style.background = TEAM_COLORS[i];

    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'team-name-field';
    inp.value = existing[i] !== undefined ? existing[i] : DEFAULT_NAMES[i];
    inp.placeholder = `Team ${i + 1}`;

    const cpuBtn = document.createElement('button');
    cpuBtn.type = 'button';
    cpuBtn.className = 'cpu-toggle';
    cpuBtn.textContent = 'CPU';
    const isCpu = existingCpu[i] ?? false;
    cpuBtn.dataset.cpu = String(isCpu);
    if (isCpu) cpuBtn.classList.add('active');
    cpuBtn.addEventListener('click', () => {
      const nowCpu = cpuBtn.dataset.cpu !== 'true';
      cpuBtn.dataset.cpu = String(nowCpu);
      cpuBtn.classList.toggle('active', nowCpu);
    });

    row.appendChild(dot);
    row.appendChild(inp);
    row.appendChild(cpuBtn);
    grid.appendChild(row);
  }
}

async function startDraft() {
  currentGenIdx = parseInt(document.getElementById('genSelect').value);
  draftNumber = 1;
  currentRound = 0;
  currentPickInRound = 0;
  draftedIds = new Set();
  numTeams = parseInt(document.getElementById('numTeamsRange').value);
  numRounds = parseInt(document.getElementById('numRoundsRange').value);

  const nameFields = document.querySelectorAll('.team-name-field');
  const cpuToggles = document.querySelectorAll('.cpu-toggle');
  teams = Array.from({ length: numTeams }, (_, i) => ({
    name: nameFields[i]?.value.trim() || `Team ${i + 1}`,
    color: TEAM_COLORS[i],
    isCpu: cpuToggles[i]?.dataset.cpu === 'true',
    picks: []
  }));

  // Randomise first draft order
  draftOrderIndices = shuffleArray(Array.from({ length: numTeams }, (_, i) => i));

  document.getElementById('setupScreen').style.display = 'none';
  await loadGen(currentGenIdx);

  buildSnakeOrder();
  populateTypeFilter();

  document.getElementById('loadingScreen').style.display = 'none';
  document.getElementById('draftScreen').style.display = 'flex';

  refreshHeader();
  refreshSnakeBar();
  refreshGrid();
  refreshTeams();
  triggerCpuIfNeeded();
}

// ── Data Loading ──
async function loadGen(genIdx) {
  const gen = GENS[genIdx];
  document.getElementById('loadLabel').textContent = `Loading ${gen.label}`;
  document.getElementById('loadingScreen').style.display = 'flex';
  document.getElementById('progressFill').style.width = '0%';
  document.getElementById('loadCount').textContent = '0 / 0';
  document.getElementById('loadName').textContent = '';

  await loadPokemonData(gen.start, gen.end);
}

async function loadPokemonData(start, end) {
  allPokemon = [];
  const count = end - start + 1;

  // Try to serve entirely from IndexedDB
  const cached = await getCachedRange(start, end);
  if (cached.length === count) {
    allPokemon = cached;
    return;
  }

  // Partial or no cache — fetch missing with progress
  const cachedMap = new Map(cached.map(p => [p.id, p]));
  const allIds = Array.from({ length: count }, (_, i) => start + i);
  let loaded = 0;
  document.getElementById('loadCount').textContent = `0 / ${count}`;
  const BATCH = 60;

  for (let i = 0; i < allIds.length; i += BATCH) {
    const batchIds = allIds.slice(i, i + BATCH);
    const results = await Promise.all(batchIds.map(async (id) => {
      if (cachedMap.has(id)) { loaded++; return cachedMap.get(id); }

      const data = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`).then(r => r.json());
      const parsed = parsePokemon(data);
      await putCachedPokemon(parsed);

      loaded++;
      const pct = Math.round((loaded / count) * 100);
      document.getElementById('progressFill').style.width = `${pct}%`;
      document.getElementById('loadCount').textContent = `${loaded} / ${count}`;
      document.getElementById('loadName').textContent = parsed.name;
      return parsed;
    }));
    allPokemon.push(...results);
  }
}

function parsePokemon(data) {
  let bst = 0;
  const stats = {};
  for (const s of data.stats) {
    stats[s.stat.name] = s.base_stat;
    bst += s.base_stat;
  }
  return {
    id: data.id,
    name: data.name,
    sprite: data.sprites.front_default ||
      `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${data.id}.png`,
    types: data.types.map(t => t.type.name),
    stats, bst
  };
}

// ── Snake Logic ──
function buildSnakeOrder() {
  snakeOrder = [];
  const order = draftOrderIndices.length
    ? draftOrderIndices
    : Array.from({ length: numTeams }, (_, i) => i);
  for (let r = 0; r < numRounds; r++) {
    for (let p = 0; p < numTeams; p++) {
      snakeOrder.push(r % 2 === 0 ? order[p] : order[numTeams - 1 - p]);
    }
  }
}

function currentPickNum() { return currentRound * numTeams + currentPickInRound; }
function currentTeamIdx() { return snakeOrder[currentPickNum()]; }

// ── CPU Logic ──
function cpuScore(poke, team) {
  const typesOwned = new Set(team.picks.flatMap(p => p.types));
  const newTypeBonus = poke.types.some(t => !typesOwned.has(t)) ? 55 : 0;
  const jitter = (Math.random() - 0.5) * 80;
  return poke.bst + newTypeBonus + jitter;
}

function cpuPick() {
  const team = teams[currentTeamIdx()];
  const available = allPokemon.filter(p => !draftedIds.has(p.id));
  if (!available.length) return;

  const scored = available
    .map(p => ({ poke: p, score: cpuScore(p, team) }))
    .sort((a, b) => b.score - a.score);

  const topN = Math.min(3, scored.length);
  const choice = scored[Math.floor(Math.random() * topN)].poke;
  setCpuThinking(false);
  draftPokemon(choice);
}

function setCpuThinking(on) {
  cpuThinking = on;
  const picker = document.getElementById('dhPicker');
  const sub = document.getElementById('dhSub');
  if (on) {
    picker.classList.add('thinking');
    sub.textContent = 'CPU is thinking...';
  } else {
    picker.classList.remove('thinking');
  }
}

function triggerCpuIfNeeded() {
  if (currentRound >= numRounds) return;
  const ti = currentTeamIdx();
  if (!teams[ti].isCpu) return;
  setCpuThinking(true);
  setTimeout(cpuPick, 800 + Math.random() * 800);
}

// ── Rendering ──
function populateTypeFilter() {
  const types = new Set();
  allPokemon.forEach(p => p.types.forEach(t => types.add(t)));
  const sel = document.getElementById('typeFilter');
  [...types].sort().forEach(t => {
    const o = document.createElement('option');
    o.value = t;
    o.textContent = t[0].toUpperCase() + t.slice(1);
    sel.appendChild(o);
  });
}

function refreshHeader() {
  if (cpuThinking) return;
  const total = numRounds * numTeams;
  const pick = currentPickNum();
  const team = teams[currentTeamIdx()];
  const gen = GENS[currentGenIdx];
  const picker = document.getElementById('dhPicker');
  picker.textContent = team.name + (team.isCpu ? ' (CPU)' : '') + "'s Pick";
  picker.style.color = team.color;
  document.getElementById('dhSub').textContent =
    `${gen.short} · Round ${currentRound + 1} · Pick ${currentPickInRound + 1} of ${numTeams}`;
  document.getElementById('dhRight').textContent =
    `${total - pick} pick${total - pick !== 1 ? 's' : ''} remaining`;
}

function refreshSnakeBar() {
  const bar = document.getElementById('snakeBar');
  bar.innerHTML = '';
  const cur = currentPickNum();
  snakeOrder.forEach((ti, i) => {
    if (i > 0 && i % numTeams === 0) {
      const sep = document.createElement('div');
      sep.className = 's-sep';
      sep.textContent = '|';
      bar.appendChild(sep);
    }
    const pip = document.createElement('div');
    pip.className = 's-pip ' + (i < cur ? 'done' : i === cur ? 'current' : 'upcoming');
    pip.style.background = teams[ti].color;
    pip.title = teams[ti].name + (teams[ti].isCpu ? ' (CPU)' : '');
    pip.textContent = ti + 1;
    bar.appendChild(pip);
  });
  bar.querySelector('.current')?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

function isLight(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

function typePills(types) {
  return types.map(t => {
    const bg = TYPE_COLORS[t] || '#888';
    const fg = isLight(bg) ? '#000' : '#fff';
    return `<span class="type-pill" style="background:${bg};color:${fg}">${t}</span>`;
  }).join('');
}

function getDisplayList() {
  let list = [...allPokemon];
  if (curSearch) {
    const q = curSearch.toLowerCase();
    list = list.filter(p => p.name.includes(q) || String(p.id).includes(q));
  }
  if (curType) list = list.filter(p => p.types.includes(curType));
  if (curSort === 'bst-desc')     list.sort((a, b) => b.bst - a.bst);
  else if (curSort === 'bst-asc') list.sort((a, b) => a.bst - b.bst);
  else if (curSort === 'name')    list.sort((a, b) => a.name.localeCompare(b.name));
  else                            list.sort((a, b) => a.id - b.id);
  return list;
}

function refreshGrid() {
  const grid = document.getElementById('pokeGrid');
  grid.innerHTML = '';
  getDisplayList().forEach(poke => {
    const card = document.createElement('div');
    card.className = 'poke-card' + (draftedIds.has(poke.id) ? ' drafted' : '');
    card.dataset.id = poke.id;
    card.innerHTML = `
      <img src="${poke.sprite}" alt="${poke.name}" onerror="this.style.visibility='hidden'">
      <div class="pc-num">#${String(poke.id).padStart(3, '0')}</div>
      <div class="pc-name">${poke.name}</div>
      <div class="pc-types">${typePills(poke.types)}</div>
      <div class="pc-bst-lbl">BASE STAT TOTAL</div>
      <div class="pc-bst">${poke.bst}</div>
    `;
    if (!draftedIds.has(poke.id)) {
      card.addEventListener('click', () => {
        if (cpuThinking) return;
        draftPokemon(poke);
      });
    }
    grid.appendChild(card);
  });
}

function refreshTeams() {
  const list = document.getElementById('teamsList');
  list.innerHTML = '';
  const curIdx = currentTeamIdx();
  teams.forEach((team, i) => {
    const tile = document.createElement('div');
    tile.className = 'team-tile' + (i === curIdx ? ' current' : '');
    const isMultiGen = draftNumber > 1;
    const picks = team.picks.length
      ? team.picks.map(p => {
          const gen = getGen(p.id);
          const isCurGen = gen.num === GENS[currentGenIdx].num;
          const genTag = isMultiGen
            ? `<span class="mini-gen-tag" style="background:${gen.color}">${gen.short}</span>`
            : '';
          return `
            <div class="mini-chip${isCurGen ? '' : ' prev-gen'}">
              <img src="${p.sprite}" alt="${p.name}">
              ${genTag}
              <span>${p.name}</span>
            </div>`;
        }).join('')
      : '<span class="tt-empty">No picks yet</span>';
    const cpuBadge = team.isCpu ? '<span class="tt-cpu-badge">CPU</span>' : '';
    tile.innerHTML = `
      <div class="tt-head">
        <div class="tt-dot" style="background:${team.color}"></div>
        <div class="tt-name">${team.name}</div>
        ${cpuBadge}
        <div class="tt-count">${team.picks.length}/${numRounds * draftNumber}</div>
      </div>
      <div class="tt-picks">${picks}</div>
    `;
    list.appendChild(tile);
  });
}

// ── Drafting ──
function draftPokemon(poke) {
  const ti = currentTeamIdx();
  teams[ti].picks.push(poke);
  draftedIds.add(poke.id);

  const card = document.querySelector(`.poke-card[data-id="${poke.id}"]`);
  if (card) card.classList.add('drafted');

  currentPickInRound++;
  if (currentPickInRound >= numTeams) {
    currentPickInRound = 0;
    currentRound++;
  }

  if (currentRound >= numRounds) {
    saveSeason(buildSeasonState());
    const hasMoreGens = currentGenIdx < GENS.length - 1;
    if (hasMoreGens) {
      showLobby();
    } else {
      showComplete();
    }
    return;
  }

  refreshHeader();
  refreshSnakeBar();
  refreshTeams();
  saveSeason(buildSeasonState());
  triggerCpuIfNeeded();
}

function buildSeasonState() {
  return {
    version: 2,
    currentGenIdx,
    draftNumber,
    numTeams, numRounds,
    teams: teams.map(t => ({ ...t, picks: t.picks.map(p => p.id ?? p) })),
    draftedIds: [...draftedIds],
    snakeOrder,
    draftOrderIndices,
    currentRound,
    currentPickInRound,
    status: 'drafting',
  };
}

// ── Lobby (between gens) ──
function showLobby() {
  document.getElementById('draftScreen').style.display = 'none';
  document.getElementById('lobbyScreen').style.display = 'flex';

  const gen = GENS[currentGenIdx];
  const nextGen = GENS[currentGenIdx + 1];

  document.getElementById('lobbyGenComplete').textContent = `${gen.label} Complete`;
  document.getElementById('lobbyDraftNum').textContent =
    `Draft ${draftNumber} · Season continues`;

  // Rank teams by cumulative BST descending
  const ranked = [...teams]
    .map((t, idx) => ({ team: t, idx, bst: teamTotalBst(t) }))
    .sort((a, b) => b.bst - a.bst);

  // Next draft order = reverse standings (worst BST picks first)
  const nextOrder = [...ranked].reverse();

  // Order pills
  const pillsEl = document.getElementById('lobbyOrderPills');
  pillsEl.innerHTML = nextOrder.map((entry, i) => `
    <div class="order-pill">
      <span class="order-num">${i + 1}</span>
      <span class="order-dot" style="background:${entry.team.color}"></span>
      <span class="order-name">${entry.team.name}${entry.team.isCpu ? ' (CPU)' : ''}</span>
    </div>
  `).join('');

  // Standings cards
  const MEDALS = ['🏆', '🥈', '🥉'];
  document.getElementById('lobbyStandings').innerHTML = ranked.map(({ team, bst }, rank) => {
    const picks = team.picks.map(p => {
      const g = getGen(p.id);
      return `
        <div class="lobby-pick" title="${p.name} (${g.label})">
          <img src="${p.sprite}" alt="${p.name}">
          <span class="lobby-gen-tag" style="background:${g.color}">${g.short}</span>
        </div>`;
    }).join('');
    const cpuBadge = team.isCpu ? '<span class="tt-cpu-badge">CPU</span>' : '';
    return `
      <div class="lobby-team-card">
        <div class="lobby-team-head">
          <span class="lobby-rank">${MEDALS[rank] || rank + 1}</span>
          <span class="lobby-team-dot" style="background:${team.color}"></span>
          <span class="lobby-team-name">${team.name} ${cpuBadge}</span>
          <span class="lobby-bst">BST ${bst}</span>
        </div>
        <div class="lobby-picks-grid">${picks || '<span class="tt-empty" style="padding:8px">No picks</span>'}</div>
      </div>`;
  }).join('');

  document.getElementById('btnContinue').textContent = `Continue to ${nextGen.label} →`;
}

async function continueToNextGen() {
  currentGenIdx++;
  draftNumber++;
  currentRound = 0;
  currentPickInRound = 0;
  cpuThinking = false;

  // Worst total BST picks first in next snake
  draftOrderIndices = [...teams]
    .map((t, i) => ({ i, bst: teamTotalBst(t) }))
    .sort((a, b) => a.bst - b.bst)
    .map(t => t.i);

  document.getElementById('lobbyScreen').style.display = 'none';
  await loadGen(currentGenIdx);

  buildSnakeOrder();
  document.getElementById('typeFilter').innerHTML = '<option value="">All Types</option>';
  populateTypeFilter();

  document.getElementById('loadingScreen').style.display = 'none';
  document.getElementById('draftScreen').style.display = 'flex';

  refreshHeader();
  refreshSnakeBar();
  refreshGrid();
  refreshTeams();
  saveSeason(buildSeasonState());
  triggerCpuIfNeeded();
}

function endSeason() {
  document.getElementById('lobbyScreen').style.display = 'none';
  showComplete();
}

// ── Filters / Sort ──
function filterSearch(val) { curSearch = val.toLowerCase(); refreshGrid(); }
function filterType(val)   { curType = val; refreshGrid(); }
function sortBy(val)       { curSort = val; refreshGrid(); }

// ── Complete Screen (final) ──
function showComplete() {
  document.getElementById('draftScreen').style.display = 'none';
  document.getElementById('lobbyScreen').style.display = 'none';
  document.getElementById('completeScreen').style.display = 'flex';
  clearSeason();

  const ranked = [...teams].sort((a, b) => teamTotalBst(b) - teamTotalBst(a));
  const MEDALS = ['🏆', '🥈', '🥉'];
  const grid = document.getElementById('compGrid');
  grid.innerHTML = '';

  ranked.forEach((team, rank) => {
    const totalBst = teamTotalBst(team);
    const cpuLabel = team.isCpu ? ' <span style="font-size:10px;opacity:0.6">(CPU)</span>' : '';
    const picks = team.picks.map(p => {
      const g = getGen(p.id);
      return `
        <div class="comp-pick">
          <img src="${p.sprite}" alt="${p.name}">
          <div class="comp-pick-info">
            <div class="comp-pick-name">${p.name}</div>
            <div class="comp-pick-types">${typePills(p.types)}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
            <div class="comp-pick-bst-val">${p.bst}</div>
            <span style="font-size:9px;font-weight:700;padding:2px 5px;border-radius:4px;background:${g.color};color:#000">${g.short}</span>
          </div>
        </div>`;
    }).join('');

    const el = document.createElement('div');
    el.className = 'comp-team';
    el.innerHTML = `
      <div class="comp-team-head">
        <div style="width:13px;height:13px;border-radius:50%;background:${team.color};flex-shrink:0"></div>
        ${MEDALS[rank] ? MEDALS[rank] + ' ' : ''}${team.name}${cpuLabel}
        <div class="comp-bst-total">TOTAL ${totalBst}</div>
      </div>
      <div class="comp-picks">${picks}</div>
    `;
    grid.appendChild(el);
  });
}

// ── Restart ──
function restart() {
  allPokemon = []; teams = []; draftedIds.clear(); snakeOrder = [];
  draftOrderIndices = []; currentGenIdx = 0; draftNumber = 1;
  currentRound = 0; currentPickInRound = 0; cpuThinking = false;
  _savedForResume = null;
  curSort = 'bst-desc'; curSearch = ''; curType = '';
  document.getElementById('typeFilter').innerHTML = '<option value="">All Types</option>';
  document.getElementById('progressFill').style.width = '0%';
  document.getElementById('completeScreen').style.display = 'none';
  document.getElementById('lobbyScreen').style.display = 'none';
  document.getElementById('resumeScreen').style.display = 'none';
  document.getElementById('setupScreen').style.display = 'flex';
  renderNameInputs();
}

// ── Init ──
// ── Resume Screen ──
let _savedForResume = null;

async function init() {
  await openDB();

  const saved = loadSeason();
  if (saved) {
    _savedForResume = saved;
    showResumeScreen(saved);
    return;
  }

  updateTeamCount(4);
  renderNameInputs();
  document.getElementById('setupScreen').style.display = 'flex';
}

function showResumeScreen(saved) {
  const gen = GENS[saved.currentGenIdx ?? 0];
  const round = saved.currentRound + 1;
  const totalRounds = saved.numRounds;

  const badge = document.getElementById('resumeGenBadge');
  badge.textContent = gen.short;
  badge.style.background = gen.color;

  document.getElementById('resumeMetaTitle').textContent =
    'Draft ' + (saved.draftNumber ?? 1) + ' · ' + gen.label;
  document.getElementById('resumeMetaSub').textContent =
    'Round ' + round + ' of ' + totalRounds + '  ·  ' + saved.numTeams + ' teams';

  const teamsEl = document.getElementById('resumeTeams');
  teamsEl.innerHTML = saved.teams.map(t => {
    const pickCount = t.picks.length;
    const spriteSlots = t.picks.slice(0, 8).map(id =>
      '<img class="resume-sprite" ' +
      'src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/' + id + '.png" ' +
      'alt="" onerror="this.style.opacity=0">'
    ).join('');
    const cpuBadge = t.isCpu
      ? '<span class="tt-cpu-badge" style="font-size:6px">CPU</span>'
      : '';
    return '<div class="resume-team-row">' +
      '<div class="resume-team-dot" style="background:' + t.color + '"></div>' +
      '<div class="resume-team-name">' + t.name + ' ' + cpuBadge + '</div>' +
      '<div class="resume-sprites">' + spriteSlots + '</div>' +
      '<div class="resume-pick-count">' + pickCount + ' pick' + (pickCount !== 1 ? 's' : '') + '</div>' +
      '</div>';
  }).join('');

  document.getElementById('setupScreen').style.display = 'none';
  document.getElementById('setupScreen').style.display = 'none';
  document.getElementById('resumeScreen').style.display = 'flex';
}

function resumeDraft() {
  document.getElementById('resumeScreen').style.display = 'none';
  if (_savedForResume) restoreSeason(_savedForResume);
}

function discardAndNew() {
  clearSeason();
  _savedForResume = null;
  document.getElementById('resumeScreen').style.display = 'none';
  document.getElementById('setupScreen').style.display = 'flex';
  updateTeamCount(4);
}

async function restoreSeason(saved) {
  currentGenIdx = saved.currentGenIdx ?? 0;
  draftNumber = saved.draftNumber ?? 1;
  numTeams = saved.numTeams;
  numRounds = saved.numRounds;
  currentRound = saved.currentRound;
  currentPickInRound = saved.currentPickInRound;
  snakeOrder = saved.snakeOrder;
  draftOrderIndices = saved.draftOrderIndices ?? [];
  draftedIds = new Set(saved.draftedIds);

  teams = await Promise.all(saved.teams.map(async (t) => ({
    ...t,
    picks: await Promise.all(t.picks.map(id => getCachedPokemon(id))),
  })));

  await loadGen(currentGenIdx);
  buildSnakeOrder();
  populateTypeFilter();

  document.getElementById('setupScreen').style.display = 'none';
  document.getElementById('loadingScreen').style.display = 'none';

  // If the draft for this gen was already finished when the page closed,
  // go to lobby (more gens remain) or the final complete screen.
  if (currentRound >= numRounds) {
    const hasMoreGens = currentGenIdx < GENS.length - 1;
    if (hasMoreGens) {
      showLobby();
    } else {
      showComplete();
    }
    return;
  }

  document.getElementById('draftScreen').style.display = 'flex';

  refreshHeader();
  refreshSnakeBar();
  refreshGrid();
  refreshTeams();
  triggerCpuIfNeeded();
}

init();
