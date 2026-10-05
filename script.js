document.addEventListener('DOMContentLoaded', () => {
  // ─── Config ─────────────────────────────────────────────────────
  const BASE_URL = 'https://weaponxd253.github.io/JeopardyApi/';
  const MANIFEST_URL = `${BASE_URL}topics.json`;

  // ─── State ──────────────────────────────────────────────────────
  const state = {
    score: 0,
    questions: {},
    categories: [],
    timerInterval: null,
    closeInterval: null,
    activeQuestion: null,
    answeredCells: new Set(),

    allTopics: [],
    selectedTopic: null,
    activeFilter: 'All',
    searchQuery: '',
    browserMessage: '',
    browserMessageType: 'error',
    topicErrorTimeout: null,
  };

  // ─── DOM Refs ───────────────────────────────────────────────────
  const el = {
    // Game
    board: document.getElementById('board'),
    score: document.getElementById('score'),
    resetBtn: document.getElementById('reset-button'),
    loadingState: document.getElementById('loading-state'),

    // Modal
    modal: document.getElementById('modal'),
    modalBackdrop: document.querySelector('.modal-backdrop'),
    closeBtn: document.getElementById('close-btn'),
    questionText: document.getElementById('question-text'),
    modalCategory: document.getElementById('modal-category-label'),
    modalValue: document.getElementById('modal-value-label'),
    timerBar: document.getElementById('timer-bar'),
    timeLeft: document.getElementById('time-left'),
    answer: document.getElementById('answer'),
    submitBtn: document.getElementById('submit-answer'),
    resultArea: document.getElementById('result-area'),

    // Topic browser
    topicBrowser: document.getElementById('topic-browser'),
    topicSearch: document.getElementById('topic-search'),
    categoryFilters: document.getElementById('category-filters'),
    topicGrid: document.getElementById('topic-grid'),
    topicCount: document.getElementById('topic-count'),
    selectedLabel: document.getElementById('selected-label'),
    randomBtn: document.getElementById('random-button'),
    playBtn: document.getElementById('play-button'),

    // Now playing
    nowPlaying: document.getElementById('now-playing'),
    nowPlayingTopic: document.getElementById('now-playing-topic'),
    changeTopicBtn: document.getElementById('change-topic'),
  };

  // ─── Boot ───────────────────────────────────────────────────────
  loadManifest();

  // ─── Manifest / Topic Browser ───────────────────────────────────
  async function loadManifest() {
    try {
      setBrowserMessage('');
      setPlayEnabled(false);

      const res = await fetch(MANIFEST_URL);
      if (!res.ok) throw new Error(`Manifest HTTP ${res.status}`);

      const manifest = await res.json();
      const topics = normalizeManifest(manifest);

      if (!topics.length) {
        throw new Error('topics.json is empty or malformed');
      }

      state.allTopics = topics;
      state.selectedTopic = null;
      state.activeFilter = 'All';
      state.searchQuery = '';

      if (el.topicSearch) el.topicSearch.value = '';
      if (el.selectedLabel) el.selectedLabel.textContent = '';

      buildCategoryFilters();
      renderTopicGrid();
    } catch (err) {
      console.error('Manifest load failed:', err);
      if (el.topicCount) el.topicCount.textContent = '0 topics';
      setBrowserMessage('Could not load topics. Check topics.json, the GitHub Pages URL, or your connection.');
      renderTopicGrid();
    }
  }

  function normalizeManifest(manifest) {
    if (Array.isArray(manifest)) {
      return manifest
        .map((topic, index) => normalizeTopicEntry(topic, index))
        .filter(Boolean);
    }

    if (manifest && typeof manifest === 'object') {
      if (Array.isArray(manifest.topics)) {
        return manifest.topics
          .map((topic, index) => normalizeTopicEntry(topic, index))
          .filter(Boolean);
      }

      if (Array.isArray(manifest.categories) && manifest.questions) {
        return [{
          label: manifest.label ?? manifest.name ?? 'Programming',
          filename: manifest.filename ?? 'programming',
          category: manifest.category ?? 'Study Set',
          inlineData: manifest,
        }];
      }
    }

    return [];
  }

  function normalizeTopicEntry(topic, index) {
    if (typeof topic === 'string') {
      return {
        label: toTitleLabel(topic),
        filename: topic,
        category: '',
      };
    }

    if (!topic || typeof topic !== 'object') return null;

    const filename = topic.filename ?? topic.slug ?? topic.id;
    const inlineData = Array.isArray(topic.categories) && topic.questions ? topic : null;

    if (!filename && !inlineData) return null;

    return {
      ...topic,
      label: topic.label ?? topic.name ?? (toTitleLabel(filename) || `Topic ${index + 1}`),
      filename: filename ? String(filename) : `topic-${index + 1}`,
      category: topic.category ?? topic.group ?? '',
      inlineData,
    };
  }

  function buildCategoryFilters() {
    if (!el.categoryFilters) return;

    const categories = ['All'];
    const seen = new Set();

    state.allTopics.forEach(topic => {
      if (topic.category && !seen.has(topic.category)) {
        seen.add(topic.category);
        categories.push(topic.category);
      }
    });

    el.categoryFilters.innerHTML = '';

    categories.forEach(category => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `filter-chip${category === state.activeFilter ? ' active' : ''}`;
      chip.textContent = category;

      chip.addEventListener('click', () => {
        state.activeFilter = category;
        renderCategoryFilterState();
        renderTopicGrid();
      });

      el.categoryFilters.appendChild(chip);
    });
  }

  function renderCategoryFilterState() {
    if (!el.categoryFilters) return;

    el.categoryFilters.querySelectorAll('.filter-chip').forEach(chip => {
      chip.classList.toggle('active', chip.textContent === state.activeFilter);
    });
  }

  function renderTopicGrid() {
    if (!el.topicGrid) return;

    const filtered = getFilteredTopics();

    if (el.topicCount) {
      el.topicCount.textContent = filtered.length === state.allTopics.length
        ? `${state.allTopics.length} topics`
        : `${filtered.length} of ${state.allTopics.length} topics`;
    }

    el.topicGrid.innerHTML = '';

    if (state.browserMessage) {
      const message = document.createElement('p');
      message.className = state.browserMessageType === 'empty' ? 'browser-empty' : 'browser-error';
      message.textContent = state.browserMessage;
      el.topicGrid.appendChild(message);
      return;
    }

    if (filtered.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'browser-empty';
      empty.textContent = 'No topics match your search.';
      el.topicGrid.appendChild(empty);
      return;
    }

    filtered.forEach(topic => {
      const card = document.createElement('button');
      const isSelected = state.selectedTopic?.filename === topic.filename;

      card.type = 'button';
      card.className = `topic-card${isSelected ? ' selected' : ''}`;
      card.innerHTML = `
        <span class="topic-card-icon">${escapeHTML(topic.icon ?? '📚')}</span>
        <span class="topic-card-name">${escapeHTML(topic.label ?? topic.filename)}</span>
        <span class="topic-card-cat">${escapeHTML(topic.category ?? '')}</span>
      `;

      card.addEventListener('click', () => selectTopic(topic));
      el.topicGrid.appendChild(card);
    });
  }

  function getFilteredTopics() {
    let filtered = [...state.allTopics];

    if (state.activeFilter !== 'All') {
      filtered = filtered.filter(topic => topic.category === state.activeFilter);
    }

    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      filtered = filtered.filter(topic => {
        const label = topic.label?.toLowerCase() ?? '';
        const category = topic.category?.toLowerCase() ?? '';
        return label.includes(query) || category.includes(query);
      });
    }

    return filtered;
  }

  function selectTopic(topic) {
    setBrowserMessage('');
    state.selectedTopic = topic;

    if (el.selectedLabel) {
      el.selectedLabel.innerHTML = `Selected: <strong>${escapeHTML(topic.label ?? topic.filename)}</strong>`;
    }

    setPlayEnabled(true);
    renderTopicGrid();
  }

  function setPlayEnabled(enabled) {
    if (el.playBtn) el.playBtn.disabled = !enabled;
    if (el.randomBtn) el.randomBtn.disabled = state.allTopics.length === 0;
  }

  function setBrowserMessage(message, type = 'error') {
    state.browserMessage = message;
    state.browserMessageType = type;
  }

  // ─── Topic Browser Events ───────────────────────────────────────
  el.topicSearch?.addEventListener('input', event => {
    state.searchQuery = event.target.value.trim();
    setBrowserMessage('');

    // Search should cover all topics, not just the current chip.
    if (state.searchQuery && state.activeFilter !== 'All') {
      state.activeFilter = 'All';
      renderCategoryFilterState();
    }

    renderTopicGrid();
  });

  el.randomBtn?.addEventListener('click', () => {
    if (!state.allTopics.length) return;

    const filtered = getFilteredTopics();
    const source = filtered.length ? filtered : state.allTopics;
    const randomTopic = source[Math.floor(Math.random() * source.length)];

    selectTopic(randomTopic);
  });

  el.playBtn?.addEventListener('click', () => {
    if (!state.selectedTopic) return;
    loadTopic(state.selectedTopic);
  });

  el.changeTopicBtn?.addEventListener('click', () => {
    clearTimer();
    clearCloseInterval();
    closeModal({ restoreFocus: false });

    state.categories = [];
    state.questions = {};
    state.activeQuestion = null;
    state.answeredCells.clear();
    resetScore();

    el.nowPlaying?.classList.add('hidden');
    el.board?.classList.add('hidden');
    el.loadingState?.classList.add('hidden');
    el.topicBrowser?.classList.remove('hidden');
  });

  // ─── Load Topic / Board ─────────────────────────────────────────
  async function loadTopic(topic) {
    if (!topic?.filename && !topic?.inlineData) return;

    try {
      showLoading(true);
      el.topicBrowser?.classList.add('hidden');
      el.nowPlaying?.classList.add('hidden');
      el.board?.classList.add('hidden');

      const data = topic.inlineData ?? await fetchTopicData(topic.filename);
      const normalizedData = normalizeTopicData(data);

      state.categories = normalizedData.categories;
      state.questions = normalizedData.questions;
      state.answeredCells.clear();
      state.activeQuestion = null;

      resetScore();
      buildBoard();

      el.nowPlayingTopic.textContent = topic.label ?? topic.filename;
      el.nowPlaying?.classList.remove('hidden');
      el.board?.classList.remove('hidden');
    } catch (err) {
      console.error('Topic load failed:', err);

      el.topicBrowser?.classList.remove('hidden');
      const failMessage = `Failed to load ${topic.label ?? topic.filename}. Check that ${topic.filename}.json exists and is valid.`;
      setBrowserMessage(failMessage);
      renderTopicGrid();

      clearTimeout(state.topicErrorTimeout);
      state.topicErrorTimeout = setTimeout(() => {
        // Only clear our own message, not one set after it.
        if (state.browserMessage !== failMessage) return;
        setBrowserMessage('');
        renderTopicGrid();
      }, 3500);
    } finally {
      showLoading(false);
    }
  }

  async function fetchTopicData(filename) {
    // 'no-cache' revalidates with the server, so edited files show up right
    // away but unchanged ones come back as a cheap 304 instead of a full download.
    const jsonURL = `${BASE_URL}${filename}.json`;
    const res = await fetch(jsonURL, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Topic HTTP ${res.status}`);
    const text = await res.text();
    return parseTopicJSON(text, filename);
  }

  function parseTopicJSON(text, filename) {
    try {
      return JSON.parse(text);
    } catch (err) {
      const trimmed = String(text ?? '').trim();

      if (trimmed.startsWith('"categories"') || trimmed.startsWith('"questions"')) {
        try {
          return JSON.parse(`{${trimmed}}`);
        } catch {
          // Fall through to the original error so the console points at the real parse failure.
        }
      }

      throw new Error(`Topic JSON for ${filename} is malformed: ${err.message}`);
    }
  }

  function normalizeTopicData(data) {
    if (!Array.isArray(data.categories)) {
      throw new Error('Topic JSON is missing a categories array');
    }

    if (!data.questions || typeof data.questions !== 'object') {
      throw new Error('Topic JSON is missing a questions object');
    }

    const questionKeys = Object.keys(data.questions);

    return {
      categories: data.categories.map((rawCategory, index) => {
        const category = typeof rawCategory === 'object' && rawCategory !== null
          ? rawCategory
          : { name: rawCategory };

        return {
          id: resolveCategoryKey(category, index, data.questions, questionKeys),
          name: category.name ?? category.label ?? `Category ${index + 1}`,
        };
      }),
      questions: data.questions,
    };
  }

  // Questions may be keyed by id, by name, or by position. Pick whichever key
  // actually exists so a category never ends up pointing at nothing.
  function resolveCategoryKey(category, index, questions, questionKeys) {
    const candidates = [
      category.id,
      category.name,
      category.label,
      index + 1,
      index,
      questionKeys[index],
    ]
      .filter(key => key !== undefined && key !== null && key !== '')
      .map(String);

    return candidates.find(key => Object.hasOwn(questions, key)) ?? candidates[0];
  }

  function showLoading(isLoading) {
    el.loadingState?.classList.toggle('hidden', !isLoading);
  }

  function buildBoard() {
    if (!el.board) return;

    const { categories, questions } = state;
    el.board.innerHTML = '';

    if (!categories.length) {
      el.board.classList.add('hidden');
      return;
    }

    el.board.style.setProperty('--category-count', categories.length);

    // Rows are the union of every category's values, so a category with a
    // different value ladder still gets all of its questions on the board.
    const valueSet = new Set();
    categories.forEach(category => {
      Object.keys(questions[category.id] ?? {}).forEach(key => {
        const value = Number(key);
        if (Number.isFinite(value)) valueSet.add(value);
      });
    });

    const values = valueSet.size
      ? [...valueSet].sort((a, b) => a - b)
      : [100, 200, 300, 400, 500];

    categories.forEach(category => {
      const header = document.createElement('div');
      header.className = 'cat-header';
      header.textContent = category.name ?? category.id;
      el.board.appendChild(header);
    });

    values.forEach((value, rowIndex) => {
      categories.forEach((category, colIndex) => {
        const cell = document.createElement('button');
        const cellKey = getCellKey(category.id, value);

        cell.type = 'button';
        cell.className = 'question-cell';
        cell.dataset.category = category.id;
        cell.dataset.value = String(value);
        cell.dataset.catName = category.name ?? category.id;
        cell.style.animationDelay = `${(rowIndex * categories.length + colIndex) * 35}ms`;

        if (state.answeredCells.has(cellKey)) {
          cell.classList.add('answered');
          cell.disabled = true;
        } else if (!state.questions[category.id]?.[value]) {
          cell.classList.add('unavailable');
          cell.disabled = true;
          cell.textContent = '—';
        } else {
          cell.textContent = `$${value.toLocaleString()}`;
        }

        cell.addEventListener('click', handleCellClick);
        el.board.appendChild(cell);
      });
    });
  }

  function handleCellClick(event) {
    const cell = event.currentTarget;
    if (cell.classList.contains('answered')) return;

    const category = cell.dataset.category;
    const value = Number(cell.dataset.value);
    const catName = cell.dataset.catName;
    const questionData = state.questions[category]?.[value];

    if (!questionData) {
      console.warn('No question found for', category, value);
      return;
    }

    state.activeQuestion = { category, value, element: cell };
    openModal(catName, value, questionData.question);
  }

  // ─── Modal ──────────────────────────────────────────────────────
  const QUESTION_SECONDS = 30;
  const CLOSE_SECONDS = 5;

  function openModal(categoryName, value, question) {
    clearTimer();
    clearCloseInterval();

    el.modalCategory.textContent = categoryName;
    el.modalValue.textContent = `$${value.toLocaleString()}`;
    el.questionText.textContent = question;
    el.answer.value = '';
    el.answer.disabled = false;
    el.submitBtn.disabled = false;
    el.resultArea.className = 'result-area hidden';
    el.resultArea.innerHTML = '';
    el.closeBtn.classList.add('hidden');
    el.timeLeft.textContent = String(QUESTION_SECONDS);

    el.modal.classList.add('open');
    requestAnimationFrame(() => el.answer.focus());

    startTimer(QUESTION_SECONDS);
  }

  function closeModal({ restoreFocus = true } = {}) {
    const wasOpen = el.modal?.classList.contains('open');
    const cell = state.activeQuestion?.element;

    clearTimer();
    clearCloseInterval();

    el.modal?.classList.remove('open');
    state.activeQuestion = null;

    if (wasOpen && restoreFocus) focusNextCell(cell);
  }

  // Send focus back to the board: the cell just played if it is still
  // clickable, otherwise the next open cell after it.
  function focusNextCell(cell) {
    if (!el.board || el.board.classList.contains('hidden')) return;

    const cells = [...el.board.querySelectorAll('.question-cell')];
    const start = Math.max(0, cells.indexOf(cell));
    const ordered = [...cells.slice(start), ...cells.slice(0, start)];
    const target = ordered.find(candidate => !candidate.disabled) ?? el.resetBtn;

    target?.focus();
  }

  function canDismissModal() {
    return el.modal.classList.contains('open') && !el.closeBtn.classList.contains('hidden');
  }

  el.closeBtn?.addEventListener('click', () => closeModal());

  el.modalBackdrop?.addEventListener('click', () => {
    if (canDismissModal()) closeModal();
  });

  document.addEventListener('keydown', event => {
    if (!el.modal.classList.contains('open')) return;

    if (event.key === 'Escape') {
      if (canDismissModal()) {
        event.preventDefault();
        closeModal();
      }
      return;
    }

    if (event.key === 'Tab') trapFocus(event);
  });

  // Keep Tab / Shift+Tab cycling inside the dialog while it is open.
  function trapFocus(event) {
    const focusable = [...el.modal.querySelectorAll('button, input')]
      .filter(node => !node.disabled && node.offsetParent !== null);

    if (!focusable.length) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const current = document.activeElement;

    if (!el.modal.contains(current)) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && current === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && current === last) {
      event.preventDefault();
      first.focus();
    }
  }

  // ─── Timer ──────────────────────────────────────────────────────
  // Countdowns are measured against a wall-clock deadline rather than by
  // counting ticks, so throttled background tabs stay in sync with the bar.
  function startCountdown(seconds, onTick, onDone) {
    const deadline = Date.now() + seconds * 1000;
    let lastShown = seconds;

    return setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));

      if (remaining !== lastShown) {
        lastShown = remaining;
        onTick(remaining);
      }

      if (remaining <= 0) onDone();
    }, 200);
  }

  function startTimer(seconds) {
    el.timeLeft.textContent = String(seconds);
    el.timerBar.style.transition = 'none';
    el.timerBar.style.transform = 'scaleX(1)';
    el.timerBar.style.background = 'linear-gradient(90deg, var(--red), var(--gold))';

    // Force reflow so the animation restarts every question.
    void el.timerBar.offsetWidth;

    el.timerBar.style.transition = `transform ${seconds}s linear`;
    el.timerBar.style.transform = 'scaleX(0)';

    state.timerInterval = startCountdown(
      seconds,
      timeLeft => {
        el.timeLeft.textContent = String(timeLeft);
        if (timeLeft <= 5) el.timerBar.style.background = 'var(--red)';
      },
      () => {
        clearTimer();
        handleTimeUp();
      },
    );
  }

  // Stop the bar where it is; clearing the interval alone leaves the CSS
  // transition draining to zero after the player has already answered.
  function freezeTimerBar() {
    const current = getComputedStyle(el.timerBar).transform;
    el.timerBar.style.transition = 'none';
    el.timerBar.style.transform = current && current !== 'none' ? current : 'scaleX(1)';
  }

  function clearTimer() {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
  }

  function clearCloseInterval() {
    if (state.closeInterval) {
      clearInterval(state.closeInterval);
      state.closeInterval = null;
    }
  }

  function handleTimeUp() {
    const active = state.activeQuestion;
    if (!active) return;

    const questionData = state.questions[active.category]?.[active.value];

    freezeTimerBar();
    el.timeLeft.textContent = '0';
    el.submitBtn.disabled = true;
    el.answer.disabled = true;

    showResult('timeup', "⏰ Time's Up!", questionData?.answers ?? [], questionData?.explanation ?? '');
    markAnswered(active.element, getCellKey(active.category, active.value));
    scheduleClose(CLOSE_SECONDS);
  }

  // ─── Submit Answer ──────────────────────────────────────────────
  el.submitBtn?.addEventListener('click', submitAnswer);

  el.answer?.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !el.submitBtn.disabled) {
      // Without this, the same Enter press also "clicks" the close button that
      // submitAnswer() moves focus to, closing the result immediately.
      event.preventDefault();
      submitAnswer();
    }
  });

  function submitAnswer() {
    const active = state.activeQuestion;
    if (!active) return;

    const questionData = state.questions[active.category]?.[active.value];
    if (!questionData) return;

    clearTimer();
    freezeTimerBar();

    const userAnswer = normalizeAnswer(el.answer.value);
    const acceptedAnswers = Array.isArray(questionData.answers) ? questionData.answers : [];
    const isCorrect = acceptedAnswers.some(answer => isAnswerMatch(userAnswer, normalizeAnswer(answer)));

    el.submitBtn.disabled = true;
    el.answer.disabled = true;

    if (isCorrect) {
      state.score += active.value;
      showResult('correct', '✓ Correct!', acceptedAnswers, questionData.explanation ?? '');
    } else {
      state.score -= active.value;
      showResult('incorrect', '✗ Incorrect', acceptedAnswers, questionData.explanation ?? '');
    }

    updateScoreDisplay();
    markAnswered(active.element, getCellKey(active.category, active.value));
    scheduleClose(CLOSE_SECONDS);
  }

  const ANSWER_PREFIX = /^(?:(?:what|who|where|when)\s+(?:is|are|was|were)\s+|(?:what|who|where)'s\s+)/;
  const LEADING_ARTICLE = /^(?:a|an|the)\s+/;

  function normalizeAnswer(value) {
    return String(value ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')        // é → e, so "Pokemon" matches "Pokémon"
      .replace(/[‘’`]/g, "'")
      .trim()
      .replace(ANSWER_PREFIX, '')
      .replace(LEADING_ARTICLE, '')
      .replace(/[-–—_/]+/g, ' ')
      .replace(/[^\p{L}\p{N}\s+#]/gu, '')      // keep + and # for C++ / C#
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Both arguments are already normalized. Longer word answers forgive a
  // small typo; numbers and short answers must match exactly, since a near
  // miss there ("1991" vs "1990", "cat" vs "car") is a different answer.
  function isAnswerMatch(userAnswer, acceptedAnswer) {
    if (!userAnswer || !acceptedAnswer) return false;
    if (userAnswer === acceptedAnswer) return true;
    if (/\d/.test(acceptedAnswer) || acceptedAnswer.length < 5) return false;

    const allowed = acceptedAnswer.length < 9 ? 1 : 2;
    if (Math.abs(userAnswer.length - acceptedAnswer.length) > allowed) return false;

    return editDistance(userAnswer, acceptedAnswer) <= allowed;
  }

  function editDistance(a, b) {
    let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

    for (let i = 1; i <= a.length; i += 1) {
      const current = [i];
      for (let j = 1; j <= b.length; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      }
      previous = current;
    }

    return previous[b.length];
  }

  // ─── Result Display ─────────────────────────────────────────────
  function showResult(type, headline, answers, explanation) {
    const answerList = Array.isArray(answers) && answers.length
      ? answers.map(answer => escapeHTML(answer)).join(', ')
      : 'No answer listed';

    el.resultArea.className = `result-area ${type}`;
    el.resultArea.innerHTML = `
      <div class="result-headline">${escapeHTML(headline)}</div>
      <div class="result-answers"><strong>Answer:</strong> ${answerList}</div>
      ${explanation ? `<div class="result-explanation">${escapeHTML(explanation)}</div>` : ''}
      <div class="result-closing-bar">
        <div class="result-closing-fill"></div>
      </div>
      <div class="result-closing-text">Closing in <span class="result-closing-count"></span>s</div>
    `;
  }

  function markAnswered(element, key) {
    if (!element) return;

    state.answeredCells.add(key);
    element.classList.add('answered');
    element.textContent = '';
    element.disabled = true;
  }

  function scheduleClose(seconds) {
    clearCloseInterval();

    el.closeBtn.classList.remove('hidden');
    // The answer input is disabled now, so give focus somewhere useful.
    el.closeBtn.focus();

    // The close countdown lives in the result area; the question timer keeps
    // showing where it stopped.
    const count = el.resultArea.querySelector('.result-closing-count');
    if (count) count.textContent = String(seconds);

    const fill = el.resultArea.querySelector('.result-closing-fill');
    if (fill) {
      fill.style.transition = 'none';
      fill.style.transform = 'scaleX(1)';
      void fill.offsetWidth;
      fill.style.transition = `transform ${seconds}s linear`;
      fill.style.transform = 'scaleX(0)';
    }

    state.closeInterval = startCountdown(
      seconds,
      left => {
        if (count) count.textContent = String(left);
      },
      () => closeModal(),
    );
  }

  // ─── Score / Reset ──────────────────────────────────────────────
  el.resetBtn?.addEventListener('click', () => {
    if (!state.categories.length) return;

    clearTimer();
    clearCloseInterval();
    closeModal({ restoreFocus: false });

    state.answeredCells.clear();
    resetScore();
    buildBoard();
  });

  function resetScore() {
    state.score = 0;
    updateScoreDisplay();
  }

  function updateScoreDisplay() {
    const score = state.score;
    el.score.textContent = `${score < 0 ? '-$' : '$'}${Math.abs(score).toLocaleString()}`;
    el.score.classList.toggle('negative', score < 0);
  }

  function getCellKey(categoryId, value) {
    return `${categoryId}-${value}`;
  }

  function escapeHTML(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function toTitleLabel(value) {
    if (!value) return '';

    return String(value)
      .replace(/[_-]+/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, char => char.toUpperCase());
  }
});
