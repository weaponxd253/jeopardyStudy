document.addEventListener('DOMContentLoaded', () => {

  // ─── State ─────────────────────────────────────────────────────
  const gameState = {
    score: 0,
    questions: {},
    categories: [],
    timerInterval: null,
    activeQuestion: null,   // { category, value, element }
    answeredCells: new Set(),
  };

  // ─── DOM Refs ───────────────────────────────────────────────────
  const el = {
    board:            document.getElementById('board'),
    score:            document.getElementById('score'),
    loadBtn:          document.getElementById('load-button'),
    resetBtn:         document.getElementById('reset-button'),
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
  };

  // ─── Load Topic ─────────────────────────────────────────────────
  el.loadBtn.addEventListener('click', loadTopic);

  function loadTopic() {
    const topic = el.topicSelect.value;
    const jsonURL = `https://weaponxd253.github.io/JeopardyApi/${topicToFilename(topic)}.json`;

    showLoading(true);

    fetch(jsonURL)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        gameState.categories = data.categories;
        gameState.questions   = data.questions;
        gameState.answeredCells.clear();
        resetScore();
        buildBoard();
        showLoading(false);
      })
      .catch(err => {
        console.error('Failed to load topic:', err);
        showLoading(false);
        el.emptyState.classList.remove('hidden');
        el.emptyState.querySelector('p').innerHTML =
          '<strong>Failed to load — check your connection and try again.</strong>';
      });
  }


  function topicToFilename(topic) {
    const overrides = {
      gaming: 'gamingConsoles',
    };
    return overrides[topic] ?? topic;
  }

  function showLoading(isLoading) {
    el.loadingState.classList.toggle('hidden', !isLoading);
    el.emptyState.classList.add('hidden');
    el.board.classList.add('hidden');
    if (!isLoading && gameState.categories.length) {
      el.board.classList.remove('hidden');
    }
  }

  // ─── Random Category ────────────────────────────────────────────
  el.randomBtn.addEventListener('click', () => {
    const options = el.topicSelect.options;
    el.topicSelect.selectedIndex = Math.floor(Math.random() * options.length);
  });

  // ─── Reset ──────────────────────────────────────────────────────
  el.resetBtn.addEventListener('click', () => {
    if (!gameState.categories.length) return;
    gameState.answeredCells.clear();
    resetScore();
    buildBoard();
  });

  function resetScore() {
    gameState.score = 0;
    updateScoreDisplay();
  }

  function updateScoreDisplay() {
    const s = gameState.score;
    el.score.textContent = (s < 0 ? '-$' : '$') + Math.abs(s).toLocaleString();
    el.score.classList.toggle('negative', s < 0);
  }

  // ─── Build Board ────────────────────────────────────────────────
  function buildBoard() {
    const { categories, questions } = gameState;
    el.board.innerHTML = '';

    // Dynamically set grid columns from actual category count
    const colCount = categories.length;
    el.board.style.gridTemplateColumns = `repeat(${colCount}, 1fr)`;

    // Derive the dollar values from the first category's question keys
    const firstCatId = categories[0]?.id;
    const values = firstCatId
      ? Object.keys(questions[firstCatId] ?? {})
          .map(Number)
          .sort((a, b) => a - b)
      : [100, 200, 300, 400, 500]; // fallback

    // Row 1: Category headers
    categories.forEach(cat => {
      const div = document.createElement('div');
      div.className = 'cat-header';
      div.textContent = cat.name;
      el.board.appendChild(div);
    });

    // Remaining rows: question cells per value
    values.forEach((value, rowIndex) => {
      categories.forEach(cat => {
        const cell = document.createElement('div');
        cell.className = 'question-cell';
        cell.dataset.category = cat.id;
        cell.dataset.value = value;
        cell.dataset.catName = cat.name;

        const cellKey = `${cat.id}-${value}`;
        if (gameState.answeredCells.has(cellKey)) {
          cell.classList.add('answered');
        } else {
          cell.textContent = `$${value.toLocaleString()}`;
        }

        // Stagger reveal animation
        cell.style.animationDelay = `${(rowIndex * categories.length + categories.indexOf(cat)) * 35}ms`;
        cell.addEventListener('click', handleCellClick);
        el.board.appendChild(cell);
      });
    });
  }

  // ─── Handle Cell Click ──────────────────────────────────────────
  function handleCellClick(event) {
    const cell = event.currentTarget;
    if (cell.classList.contains('answered')) return;

    const category = cell.dataset.category;
    const value    = parseInt(cell.dataset.value);
    const catName  = cell.dataset.catName;
    const questionData = gameState.questions[category]?.[value];

    if (!questionData) {
      console.warn('No question found for', category, value);
      return;
    }

    gameState.activeQuestion = { category, value, element: cell };
    openModal(catName, value, questionData.question);
  }

  // ─── Modal ──────────────────────────────────────────────────────
  function openModal(catName, value, questionText) {
    clearTimer();
    el.modalCategory.textContent = catName.toUpperCase();
    el.modalValue.textContent    = `$${value.toLocaleString()}`;
    el.questionText.textContent  = questionText;
    el.answer.value              = '';           // Clear previous answer
    el.resultArea.classList.add('hidden');
    el.resultArea.className      = 'result-area hidden';
    el.resultArea.innerHTML      = '';
    el.submitBtn.disabled        = false;
    el.answer.disabled           = false;
    el.closeBtn.classList.add('hidden');         // Hide close during active question

    el.modal.classList.add('open');
    requestAnimationFrame(() => el.answer.focus());

    startTimer(30);
  }

  function closeModal() {
    clearTimer();
    el.modal.classList.remove('open');
    gameState.activeQuestion = null;
  }

  // Close button (only visible after answer revealed)
  el.closeBtn.addEventListener('click', closeModal);

  // Clicking the backdrop also closes (after answer phase)
  document.querySelector('.modal-backdrop').addEventListener('click', () => {
    if (!el.closeBtn.classList.contains('hidden')) {
      closeModal();
    }
  });

  // ─── Timer ──────────────────────────────────────────────────────
  function startTimer(seconds) {
    let timeLeft = seconds;
    el.timeLeft.textContent = timeLeft;
    el.timerBar.style.transform = 'scaleX(1)';
    el.timerBar.style.transition = 'none';

    // Trigger reflow so the transition reset takes effect
    void el.timerBar.offsetWidth;
    el.timerBar.style.transition = `transform ${seconds}s linear`;
    el.timerBar.style.transform  = 'scaleX(0)';

    gameState.timerInterval = setInterval(() => {
      timeLeft -= 1;
      el.timeLeft.textContent = timeLeft;

      if (timeLeft <= 5) {
        el.timerBar.style.background = 'var(--red)';
      }

      if (timeLeft <= 0) {
        clearTimer();
        handleTimeUp();
      }
    }, 1000);
  }

  function clearTimer() {
    clearInterval(gameState.timerInterval);
    gameState.timerInterval = null;
  }

  function handleTimeUp() {
    const { category, value, element } = gameState.activeQuestion ?? {};
    if (!category) return;

    const questionData = gameState.questions[category]?.[value];
    const answers      = questionData?.answers ?? [];
    const explanation  = questionData?.explanation ?? '';

    el.submitBtn.disabled = true;
    el.answer.disabled    = true;

    showResult('timeup', '⏰ Time\'s Up!', answers, explanation);
    markAnswered(element, `${category}-${value}`);
    scheduleClose(5);
  }

  // ─── Submit Answer ──────────────────────────────────────────────
  el.submitBtn.addEventListener('click', submitAnswer);

  // Enter key submits
  el.answer.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !el.submitBtn.disabled) submitAnswer();
  });

  function submitAnswer() {
    clearTimer();

    const { category, value, element } = gameState.activeQuestion ?? {};
    if (!category) return;

    const questionData = gameState.questions[category]?.[value];
    if (!questionData) return;

    const userAnswer  = el.answer.value.trim().toLowerCase();
    const accepted    = questionData.answers;
    const explanation = questionData.explanation ?? '';

    const isCorrect = accepted.some(a => userAnswer === a.toLowerCase());

    el.submitBtn.disabled = true;
    el.answer.disabled    = true;

    if (isCorrect) {
      gameState.score += value;
      showResult('correct', '✓ Correct!', accepted, explanation);
    } else {
      gameState.score -= value;
      showResult('incorrect', '✗ Incorrect', accepted, explanation);
    }

    updateScoreDisplay();
    markAnswered(element, `${category}-${value}`);
    scheduleClose(5);
  }

  // ─── Result Display ─────────────────────────────────────────────
  function showResult(type, headline, answers, explanation) {
    el.resultArea.className = `result-area ${type}`;
    el.resultArea.innerHTML = `
      <div class="result-headline">${headline}</div>
      ${type !== 'correct'
        ? `<div class="result-answers">Accepted: ${answers.join(', ')}</div>`
        : ''}
      ${explanation
        ? `<div class="result-explanation">${explanation}</div>`
        : ''}
      <div class="result-closing-bar">
        <div class="result-closing-fill" id="closing-fill"></div>
      </div>
    `;
    el.resultArea.classList.remove('hidden');

    // Animate the closing progress bar
    const fill = document.getElementById('closing-fill');
    if (fill) {
      fill.style.transform        = 'scaleX(1)';
      fill.style.transition       = 'none';
      void fill.offsetWidth;
      fill.style.transition       = 'transform 5s linear';
      fill.style.transformOrigin  = 'left';
      fill.style.transform        = 'scaleX(0)';
    }
  }

  function markAnswered(element, key) {
    if (!element) return;
    gameState.answeredCells.add(key);
    element.classList.add('answered');
    element.textContent = '';
  }

  // ─── Auto-close modal after result ─────────────────────────────
  function scheduleClose(seconds) {
    el.closeBtn.classList.remove('hidden'); // Allow manual close during countdown
    let left = seconds;

    const interval = setInterval(() => {
      left -= 1;
      el.timeLeft.textContent = left;
      if (left <= 0) {
        clearInterval(interval);
        closeModal();
      }
    }, 1000);
  }

});
