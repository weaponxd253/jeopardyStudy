document.addEventListener('DOMContentLoaded', () => {
 
  // ─── Config ─────────────────────────────────────────────────────
  const BASE_URL     = 'https://weaponxd253.github.io/JeopardyApi/';
  const MANIFEST_URL = `${BASE_URL}topics.json`;

  // ─── State ─────────────────────────────────────────────────────
  const gameState = {
  const state = {
    // Game
    score: 0,
    questions: {},
    categories: [],
    timerInterval: null,
    activeQuestion: null,   // { category, value, element }
    activeQuestion: null,
    answeredCells: new Set(),
    // Browser
    allTopics: [],
    selectedTopic: null,
    activeFilter: 'All',
    searchQuery: '',
  };

  // ─── DOM Refs ───────────────────────────────────────────────────
  const el = {
    board:            document.getElementById('board'),
    score:            document.getElementById('score'),
    loadBtn:          document.getElementById('load-button'),
    resetBtn:         document.getElementById('reset-button'),
    // Game
    board:          document.getElementById('board'),
    score:          document.getElementById('score'),
    resetBtn:       document.getElementById('reset-button'),
    loadingState:   document.getElementById('loading-state'),
    modal:          document.getElementById('modal'),
    closeBtn:       document.getElementById('close-btn'),
    questionText:   document.getElementById('question-text'),
    modalCategory:  document.getElementById('modal-category-label'),
    modalValue:     document.getElementById('modal-value-label'),
    timerBar:       document.getElementById('timer-bar'),
    timeLeft:       document.getElementById('time-left'),
    answer:         document.getElementById('answer'),
    submitBtn:      document.getElementById('submit-answer'),
    resultArea:     document.getElementById('result-area'),
    // Topic browser
    topicBrowser:     document.getElementById('topic-browser'),
    topicSearch:      document.getElementById('topic-search'),
    categoryFilters:  document.getElementById('category-filters'),
    topicGrid:        document.getElementById('topic-grid'),
    topicCount:       document.getElementById('topic-count'),
    playBtn:          document.getElementById('play-button'),
    randomBtn:        document.getElementById('random-button'),
    topicSelect:      document.getElementById('topic'),
    modal:            document.getElementById('modal'),
    modalContent:     document.querySelector('.modal-content'),
    closeBtn:         document.getElementById('close-btn'),
    questionText:     document.getElementById('question-text'),
    modalCategory:    document.getElementById('modal-category-label'),
    modalValue:       document.getElementById('modal-value-label'),
    timerBar:         document.getElementById('timer-bar'),
    timeLeft:         document.getElementById('time-left'),
    answer:           document.getElementById('answer'),
    submitBtn:        document.getElementById('submit-answer'),
    resultArea:       document.getElementById('result-area'),
    loadingState:     document.getElementById('loading-state'),
    emptyState:       document.getElementById('empty-state'),
    selectedLabel:    document.getElementById('selected-label'),
    // Now playing
    nowPlaying:       document.getElementById('now-playing'),
    nowPlayingTopic:  document.getElementById('now-playing-topic'),
    changeTopicBtn:   document.getElementById('change-topic'),
  };

  // ─── Load Topic Manifest ────────────────────────────────────────
  // Fetches topics.json and populates the <select> dynamically.
  // To add a new topic: add a JSON file to your repo and add one
  // entry to topics.json — no HTML changes needed.
  // ─── Boot: Load Manifest ────────────────────────────────────────
  // topics.json drives everything. Adding a new topic = one JSON entry.
  loadManifest();

  function loadManifest() {
    fetch(MANIFEST_URL)
      .then(res => {
        if (!res.ok) throw new Error(`Manifest HTTP ${res.status}`);
        return res.json();
      })
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(topics => {
        if (!Array.isArray(topics) || topics.length === 0) {
          throw new Error('topics.json is empty or malformed');
        }

        // Clear the placeholder and populate options
        el.topicSelect.innerHTML = '';
        topics.forEach(topic => {
          const opt = document.createElement('option');
          opt.value       = topic.filename;
          opt.textContent = topic.label;
          el.topicSelect.appendChild(opt);
        });

        // Re-enable controls now that options exist
        el.topicSelect.disabled = false;
        el.loadBtn.disabled     = false;
        el.randomBtn.disabled   = false;
        state.allTopics = topics;
        buildCategoryFilters(topics);
        renderTopicGrid();
      })
      .catch(err => {
        console.error('Failed to load topic manifest:', err);
        el.topicSelect.innerHTML = '<option value="">Failed to load topics</option>';
        console.error('Manifest load failed:', err);
        el.topicGrid.innerHTML =
          '<p class="browser-error">⚠ Could not load topics — check your connection and try again.</p>';
      });
  }

  loadManifest();
  // ─── Category Filter Chips ──────────────────────────────────────
  function buildCategoryFilters(topics) {
    // Derive unique categories in the order they first appear
    const seen = new Set();
    const cats = ['All'];
    topics.forEach(t => {
      if (t.category && !seen.has(t.category)) {
        seen.add(t.category);
        cats.push(t.category);
      }
    });

  // ─── Load Topic ─────────────────────────────────────────────────
  el.loadBtn.addEventListener('click', loadTopic);
    el.categoryFilters.innerHTML = '';
    cats.forEach(cat => {
      const chip = document.createElement('button');
      chip.className   = 'filter-chip' + (cat === state.activeFilter ? ' active' : '');
      chip.textContent = cat;
      chip.addEventListener('click', () => {
        state.activeFilter = cat;
        el.categoryFilters.querySelectorAll('.filter-chip')
          .forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        renderTopicGrid();
      });
      el.categoryFilters.appendChild(chip);
    });
  }

  // ─── Topic Grid ─────────────────────────────────────────────────
  // Adding a new topic never requires touching JS or HTML —
  // just add an entry to topics.json and it appears here automatically.
  function renderTopicGrid() {
    const { allTopics, activeFilter, searchQuery, selectedTopic } = state;

    let filtered = allTopics;
    if (activeFilter !== 'All') {
      filtered = filtered.filter(t => t.category === activeFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t => t.label.toLowerCase().includes(q));
    }

    // Update count label
    el.topicCount.textContent = filtered.length === allTopics.length
      ? `${allTopics.length} topics`
      : `${filtered.length} of ${allTopics.length} topics`;

    el.topicGrid.innerHTML = '';

    if (filtered.length === 0) {
      el.topicGrid.innerHTML = '<p class="browser-empty">No topics match your search.</p>';
      return;
    }

  function loadTopic() {
    const filename = el.topicSelect.value;
    if (!filename) return;
    filtered.forEach(topic => {
      const card = document.createElement('div');
      const isSelected = selectedTopic?.filename === topic.filename;
      card.className = 'topic-card' + (isSelected ? ' selected' : '');
      card.innerHTML = `
        <span class="topic-card-icon">${topic.icon ?? '📚'}</span>
        <span class="topic-card-name">${topic.label}</span>
        <span class="topic-card-cat">${topic.category ?? ''}</span>
      `;
      card.addEventListener('click', () => selectTopic(topic));
      el.topicGrid.appendChild(card);
    });
  }

  function selectTopic(topic) {
    state.selectedTopic = topic;
    renderTopicGrid();
    el.selectedLabel.innerHTML = `Selected: <strong>${topic.label}</strong>`;
    el.playBtn.disabled = false;
  }

  // ─── Play & Random ──────────────────────────────────────────────
  el.playBtn.addEventListener('click', () => {
    if (state.selectedTopic) loadTopic(state.selectedTopic);
  });

  el.randomBtn.addEventListener('click', () => {
    if (!state.allTopics.length) return;
    const pick = state.allTopics[Math.floor(Math.random() * state.allTopics.length)];
    selectTopic(pick);
  });

    const jsonURL = `${BASE_URL}${filename}.json`;
  // ─── Load Topic ─────────────────────────────────────────────────
  function loadTopic(topic) {
    const jsonURL = `${BASE_URL}${topic.filename}.json`;

    showLoading(true);
    // Hide browser, show spinner
    el.topicBrowser.classList.add('hidden');
    el.nowPlaying.classList.add('hidden');
    el.board.classList.add('hidden');
    el.loadingState.classList.remove('hidden');

    fetch(jsonURL)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(data => {
        gameState.categories = data.categories;
        gameState.questions   = data.questions;
        gameState.answeredCells.clear();
        state.categories = data.categories;
        state.questions  = data.questions;
        state.answeredCells.clear();
        resetScore();
        buildBoard();
        showLoading(false);

        el.loadingState.classList.add('hidden');
        el.board.classList.remove('hidden');
        el.nowPlaying.classList.remove('hidden');
        el.nowPlayingTopic.textContent = topic.label;
      })
      .catch(err => {
        console.error('Failed to load topic:', err);
        showLoading(false);
        el.emptyState.classList.remove('hidden');
        el.emptyState.querySelector('p').innerHTML =
          '<strong>Failed to load — check your connection and try again.</strong>';
        console.error('Topic load failed:', err);
        el.loadingState.classList.add('hidden');
        el.topicBrowser.classList.remove('hidden');
        // Briefly flash an error in the grid
        el.topicGrid.insertAdjacentHTML('afterbegin',
          '<p class="browser-error">⚠ Failed to load that topic — try again.</p>');
        setTimeout(() => renderTopicGrid(), 3000);
      });
  }

  function showLoading(isLoading) {
    el.loadingState.classList.toggle('hidden', !isLoading);
    el.emptyState.classList.add('hidden');
  // ─── Change Topic ───────────────────────────────────────────────
  el.changeTopicBtn.addEventListener('click', () => {
    el.nowPlaying.classList.add('hidden');
    el.board.classList.add('hidden');
    if (!isLoading && gameState.categories.length) {
      el.board.classList.remove('hidden');
    }
  }
    el.topicBrowser.classList.remove('hidden');
    state.categories = [];
    state.answeredCells.clear();
    resetScore();
  });

  // ─── Random Category ────────────────────────────────────────────
  el.randomBtn.addEventListener('click', () => {
    const options = el.topicSelect.options;
    el.topicSelect.selectedIndex = Math.floor(Math.random() * options.length);
  // ─── Search ─────────────────────────────────────────────────────
  el.topicSearch.addEventListener('input', e => {
    state.searchQuery = e.target.value.trim();
    // Reset to All so search covers every category
    if (state.activeFilter !== 'All') {
      state.activeFilter = 'All';
      el.categoryFilters.querySelectorAll('.filter-chip').forEach((c, i) => {
        c.classList.toggle('active', i === 0);
      });
    }
    renderTopicGrid();
  });

  // ─── Reset ──────────────────────────────────────────────────────
  el.resetBtn.addEventListener('click', () => {
    if (!gameState.categories.length) return;
    gameState.answeredCells.clear();
    if (!state.categories.length) return;
    state.answeredCells.clear();
    resetScore();
    buildBoard();
  });

  function resetScore() {
    gameState.score = 0;
    state.score = 0;
    updateScoreDisplay();
  }

  function updateScoreDisplay() {
    const s = gameState.score;
    const s = state.score;
    el.score.textContent = (s < 0 ? '-$' : '$') + Math.abs(s).toLocaleString();
    el.score.classList.toggle('negative', s < 0);
  }

  // ─── Build Board ────────────────────────────────────────────────
  function buildBoard() {
    const { categories, questions } = gameState;
    const { categories, questions } = state;
    el.board.innerHTML = '';

    const colCount = categories.length;
    el.board.style.gridTemplateColumns = `repeat(${colCount}, 1fr)`;

    const firstCatId = categories[0]?.id;
    const values = firstCatId
      ? Object.keys(questions[firstCatId] ?? {})
          .map(Number)
          .sort((a, b) => a - b)
      ? Object.keys(questions[firstCatId] ?? {}).map(Number).sort((a, b) => a - b)
      : [100, 200, 300, 400, 500];

    // Row 1: Category headers
    // Row 1: headers
    categories.forEach(cat => {
      const div = document.createElement('div');
      div.className   = 'cat-header';
      div.textContent = cat.name;
      el.board.appendChild(div);
    });

    // Remaining rows: question cells per value
    // Rows 2+: question cells
    values.forEach((value, rowIndex) => {
      categories.forEach(cat => {
        const cell = document.createElement('div');
@@ -174,35 +266,33 @@ document.addEventListener('DOMContentLoaded', () => {
        cell.dataset.catName  = cat.name;

        const cellKey = `${cat.id}-${value}`;
        if (gameState.answeredCells.has(cellKey)) {
        if (state.answeredCells.has(cellKey)) {
          cell.classList.add('answered');
        } else {
          cell.textContent = `$${value.toLocaleString()}`;
        }

        cell.style.animationDelay = `${(rowIndex * categories.length + categories.indexOf(cat)) * 35}ms`;
        cell.style.animationDelay =
          `${(rowIndex * categories.length + categories.indexOf(cat)) * 35}ms`;
        cell.addEventListener('click', handleCellClick);
        el.board.appendChild(cell);
      });
    });
  }

  // ─── Handle Cell Click ──────────────────────────────────────────
  // ─── Cell Click ─────────────────────────────────────────────────
  function handleCellClick(event) {
    const cell = event.currentTarget;
    if (cell.classList.contains('answered')) return;

    const category    = cell.dataset.category;
    const value       = parseInt(cell.dataset.value);
    const catName     = cell.dataset.catName;
    const questionData = gameState.questions[category]?.[value];
    const category     = cell.dataset.category;
    const value        = parseInt(cell.dataset.value);
    const catName      = cell.dataset.catName;
    const questionData = state.questions[category]?.[value];

    if (!questionData) {
      console.warn('No question found for', category, value);
      return;
    }
    if (!questionData) { console.warn('No question for', category, value); return; }

    gameState.activeQuestion = { category, value, element: cell };
    state.activeQuestion = { category, value, element: cell };
    openModal(catName, value, questionData.question);
  }

@@ -222,110 +312,88 @@ document.addEventListener('DOMContentLoaded', () => {

    el.modal.classList.add('open');
    requestAnimationFrame(() => el.answer.focus());

    startTimer(30);
  }

  function closeModal() {
    clearTimer();
    el.modal.classList.remove('open');
    gameState.activeQuestion = null;
    state.activeQuestion = null;
  }

  el.closeBtn.addEventListener('click', closeModal);

  document.querySelector('.modal-backdrop').addEventListener('click', () => {
    if (!el.closeBtn.classList.contains('hidden')) {
      closeModal();
    }
    if (!el.closeBtn.classList.contains('hidden')) closeModal();
  });

  // ─── Timer ──────────────────────────────────────────────────────
  function startTimer(seconds) {
    let timeLeft = seconds;
    el.timeLeft.textContent     = timeLeft;
    el.timerBar.style.transform = 'scaleX(1)';
    el.timeLeft.textContent      = timeLeft;
    el.timerBar.style.transform  = 'scaleX(1)';
    el.timerBar.style.background = 'linear-gradient(90deg, var(--red), var(--gold))';
    el.timerBar.style.transition = 'none';

    void el.timerBar.offsetWidth;
    el.timerBar.style.transition = `transform ${seconds}s linear`;
    el.timerBar.style.transform  = 'scaleX(0)';

    gameState.timerInterval = setInterval(() => {
    state.timerInterval = setInterval(() => {
      timeLeft -= 1;
      el.timeLeft.textContent = timeLeft;

      if (timeLeft <= 5) {
        el.timerBar.style.background = 'var(--red)';
      }

      if (timeLeft <= 0) {
        clearTimer();
        handleTimeUp();
      }
      if (timeLeft <= 5) el.timerBar.style.background = 'var(--red)';
      if (timeLeft <= 0) { clearTimer(); handleTimeUp(); }
    }, 1000);
  }

  function clearTimer() {
    clearInterval(gameState.timerInterval);
    gameState.timerInterval = null;
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }

  function handleTimeUp() {
    const { category, value, element } = gameState.activeQuestion ?? {};
    const { category, value, element } = state.activeQuestion ?? {};
    if (!category) return;

    const questionData = gameState.questions[category]?.[value];
    const answers      = questionData?.answers ?? [];
    const explanation  = questionData?.explanation ?? '';

    const q = state.questions[category]?.[value];
    el.submitBtn.disabled = true;
    el.answer.disabled    = true;

    showResult('timeup', '⏰ Time\'s Up!', answers, explanation);
    showResult('timeup', "⏰ Time's Up!", q?.answers ?? [], q?.explanation ?? '');
    markAnswered(element, `${category}-${value}`);
    scheduleClose(5);
  }

  // ─── Submit Answer ──────────────────────────────────────────────
  // ─── Submit ─────────────────────────────────────────────────────
  el.submitBtn.addEventListener('click', submitAnswer);

  el.answer.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !el.submitBtn.disabled) submitAnswer();
  });

  function submitAnswer() {
    clearTimer();

    const { category, value, element } = gameState.activeQuestion ?? {};
    const { category, value, element } = state.activeQuestion ?? {};
    if (!category) return;
    const q = state.questions[category]?.[value];
    if (!q) return;

    const questionData = gameState.questions[category]?.[value];
    if (!questionData) return;

    const userAnswer  = el.answer.value.trim().toLowerCase();
    const accepted    = questionData.answers;
    const explanation = questionData.explanation ?? '';

    const isCorrect = accepted.some(a => userAnswer === a.toLowerCase());
    const userAnswer = el.answer.value.trim().toLowerCase();
    const isCorrect  = q.answers.some(a => userAnswer === a.toLowerCase());

    el.submitBtn.disabled = true;
    el.answer.disabled    = true;

    if (isCorrect) {
      gameState.score += value;
      showResult('correct', '✓ Correct!', accepted, explanation);
      state.score += value;
      showResult('correct', '✓ Correct!', q.answers, q.explanation ?? '');
    } else {
      gameState.score -= value;
      showResult('incorrect', '✗ Incorrect', accepted, explanation);
      state.score -= value;
      showResult('incorrect', '✗ Incorrect', q.answers, q.explanation ?? '');
    }

    updateScoreDisplay();
    markAnswered(element, `${category}-${value}`);
    scheduleClose(5);
  }

  // ─── Result Display ─────────────────────────────────────────────
  // ─── Result ─────────────────────────────────────────────────────
  function showResult(type, headline, answers, explanation) {
    el.resultArea.className = `result-area ${type}`;
    el.resultArea.innerHTML = `
@@ -355,23 +423,18 @@ document.addEventListener('DOMContentLoaded', () => {

  function markAnswered(element, key) {
    if (!element) return;
    gameState.answeredCells.add(key);
    state.answeredCells.add(key);
    element.classList.add('answered');
    element.textContent = '';
  }

  // ─── Auto-close modal after result ─────────────────────────────
  function scheduleClose(seconds) {
    el.closeBtn.classList.remove('hidden');
    let left = seconds;

    const interval = setInterval(() => {
      left -= 1;
      el.timeLeft.textContent = left;
      if (left <= 0) {
        clearInterval(interval);
        closeModal();
      }
      if (left <= 0) { clearInterval(interval); closeModal(); }
    }, 1000);
  }
