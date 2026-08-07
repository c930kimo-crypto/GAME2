/* ==========================================
   English Vocabulary Matching Game - Logic
   ========================================== */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Vocabulary & Image Dataset (4 Core Words)
    const vocabularyList = [
        { id: 'apple', word: 'Apple', image: 'images/apple.jpg', label: '蘋果' },
        { id: 'rocket', word: 'Rocket', image: 'images/rocket.jpg', label: '火箭' },
        { id: 'panda', word: 'Panda', image: 'images/panda.jpg', label: '貓熊' },
        { id: 'guitar', word: 'Guitar', image: 'images/guitar.jpg', label: '吉他' }
    ];

    // DOM Elements
    const gridContainer = document.getElementById('grid-container');
    const timerDisplay = document.getElementById('timer-display');
    const scoreDisplay = document.getElementById('score-display');
    const highScoreDisplay = document.getElementById('high-score-display');
    const btnRestart = document.getElementById('btn-restart');
    const victoryModal = document.getElementById('victory-modal');
    const welcomeModal = document.getElementById('welcome-modal');
    const qrLoginBtn = document.getElementById('qr-login-btn');
    const btnOpenCamera = document.getElementById('btn-open-camera');
    const btnCloseCamera = document.getElementById('btn-close-camera');
    const cameraScannerBox = document.getElementById('camera-scanner-box');
    const loginActions = document.getElementById('login-actions');
    const btnPlayAgain = document.getElementById('btn-play-again');

    // Modal Stat Elements
    const finalTime = document.getElementById('final-time');
    const finalFlips = document.getElementById('final-flips');
    const finalScore = document.getElementById('final-score');
    const newRecordBadge = document.getElementById('new-record-badge');
    const starsContainer = document.getElementById('stars-container');

    // Game State Variables
    let cards = [];
    let flippedCards = [];
    let matchedPairs = 0;
    let flipCount = 0;
    let wrongMatches = 0;
    let isBoardLocked = false;
    let timerInterval = null;
    let startTime = null;
    let elapsedTime = 0;
    let score = 1000;
    let gameStarted = false;
    let isLoggedIn = false;
    let html5QrScanner = null;

    // Load High Score from LocalStorage
    let highScore = parseInt(localStorage.getItem('wordMatch_highScore')) || 0;
    highScoreDisplay.textContent = highScore;

    // ==========================================
    // Web Audio Synthesizer Sound Effects
    // ==========================================
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playSound(type) {
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        const now = audioCtx.currentTime;

        if (type === 'flip') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.08);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
            osc.start(now);
            osc.stop(now + 0.08);
        } else if (type === 'match' || type === 'login') {
            // Ascending Arpeggio (C5 - E5 - G5 - C6)
            const notes = [523.25, 659.25, 783.99, 1046.50];
            notes.forEach((freq, idx) => {
                const noteOsc = audioCtx.createOscillator();
                const noteGain = audioCtx.createGain();
                noteOsc.type = 'triangle';
                noteOsc.frequency.setValueAtTime(freq, now + idx * 0.08);
                noteGain.gain.setValueAtTime(0.25, now + idx * 0.08);
                noteGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);
                noteOsc.connect(noteGain);
                noteGain.connect(audioCtx.destination);
                noteOsc.start(now + idx * 0.08);
                noteOsc.stop(now + idx * 0.08 + 0.25);
            });
        } else if (type === 'wrong') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.linearRampToValueAtTime(140, now + 0.25);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
            osc.start(now);
            osc.stop(now + 0.25);
        } else if (type === 'victory') {
            const fanfare = [523.25, 659.25, 783.99, 1046.50, 1318.51];
            fanfare.forEach((freq, idx) => {
                const noteOsc = audioCtx.createOscillator();
                const noteGain = audioCtx.createGain();
                noteOsc.type = 'sine';
                noteOsc.frequency.setValueAtTime(freq, now + idx * 0.1);
                noteGain.gain.setValueAtTime(0.3, now + idx * 0.1);
                noteGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.4);
                noteOsc.connect(noteGain);
                noteGain.connect(audioCtx.destination);
                noteOsc.start(now + idx * 0.1);
                noteOsc.stop(now + idx * 0.1 + 0.4);
            });
        }
    }

    // Speech Synthesis for English Words
    function speakWord(text) {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            utterance.rate = 0.9;
            window.speechSynthesis.speak(utterance);
        }
    }

    // Perform Login Trigger
    function triggerLoginSuccess(method = 'click') {
        if (isLoggedIn) return;
        isLoggedIn = true;

        playSound('login');

        // Stop camera if running
        stopCamera();

        // Animate Login Screen Dismissal
        welcomeModal.classList.remove('active');

        // Speak Welcome Voice
        speakWord("Welcome! Let's match the words!");

        // Initialize Game Board
        initGame();
    }

    // ==========================================
    // QR Code Login Listeners (Click & Scan)
    // ==========================================
    if (qrLoginBtn) {
        qrLoginBtn.addEventListener('click', () => triggerLoginSuccess('click'));
    }

    // Open Camera Scanner
    if (btnOpenCamera) {
        btnOpenCamera.addEventListener('click', () => {
            qrLoginBtn.classList.add('hidden');
            loginActions.classList.add('hidden');
            cameraScannerBox.classList.remove('hidden');

            if (typeof Html5QrcodeScanner !== 'undefined') {
                html5QrScanner = new Html5QrcodeScanner(
                    "qr-reader",
                    { fps: 10, qrbox: { width: 180, height: 180 } },
                    false
                );
                html5QrScanner.render((decodedText, decodedResult) => {
                    console.log(`QR Code Scanned: ${decodedText}`);
                    triggerLoginSuccess('scan');
                }, (error) => {
                    // Ignore scanning frame errors
                });
            } else {
                alert("相機掃描元件載入中，請直接點擊上方 QR Code 圖片登入！");
                stopCamera();
            }
        });
    }

    // Close Camera Scanner
    if (btnCloseCamera) {
        btnCloseCamera.addEventListener('click', stopCamera);
    }

    function stopCamera() {
        if (html5QrScanner) {
            try {
                html5QrScanner.clear();
            } catch (e) {}
            html5QrScanner = null;
        }
        cameraScannerBox.classList.add('hidden');
        qrLoginBtn.classList.remove('hidden');
        loginActions.classList.remove('hidden');
    }

    // Auto Check URL Parameters for Scan Login
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('scan') || urlParams.has('login') || window.location.hash === '#login') {
        triggerLoginSuccess('url');
    }

    // ==========================================
    // Game Initialization & Shuffle
    // ==========================================
    function initGame() {
        // Reset Variables
        stopTimer();
        gameStarted = false;
        elapsedTime = 0;
        matchedPairs = 0;
        flipCount = 0;
        wrongMatches = 0;
        score = 1000;
        flippedCards = [];
        isBoardLocked = false;

        timerDisplay.innerHTML = '0.0<span class="unit">s</span>';
        scoreDisplay.textContent = '1000';
        victoryModal.classList.remove('active');

        // Create 8 Cards (4 Word cards + 4 Image cards)
        cards = [];
        vocabularyList.forEach(item => {
            // Card 1: Image Card
            cards.push({
                key: item.id,
                type: 'image',
                image: item.image,
                word: item.word
            });
            // Card 2: Word Card
            cards.push({
                key: item.id,
                type: 'word',
                word: item.word,
                label: item.label
            });
        });

        // Fisher-Yates Shuffle
        cards.sort(() => Math.random() - 0.5);

        // Render Grid
        renderBoard();
    }

    // Render HTML Cards into Grid
    function renderBoard() {
        gridContainer.innerHTML = '';
        cards.forEach((cardData, index) => {
            const cardEl = document.createElement('div');
            cardEl.classList.add('card');
            cardEl.dataset.key = cardData.key;
            cardEl.dataset.index = index;

            let cardBackHTML = '';
            if (cardData.type === 'image') {
                cardBackHTML = `
                    <div class="card-content-img">
                        <img src="${cardData.image}" alt="${cardData.word}">
                        <span class="card-type-badge">🖼️ 圖片</span>
                    </div>
                `;
            } else {
                cardBackHTML = `
                    <div class="card-content-word">
                        <span class="word-text">${cardData.word}</span>
                        <span class="word-type-badge">🔊 點擊發音</span>
                    </div>
                `;
            }

            cardEl.innerHTML = `
                <div class="card-inner">
                    <div class="card-front">
                        <div class="card-pattern">❓</div>
                        <span class="card-hint">FLIP CARD</span>
                    </div>
                    <div class="card-back">
                        ${cardBackHTML}
                    </div>
                </div>
            `;

            cardEl.addEventListener('click', () => handleCardClick(cardEl, cardData));
            gridContainer.appendChild(cardEl);
        });
    }

    // ==========================================
    // Timer & Dynamic Scoring
    // ==========================================
    function startTimer() {
        if (gameStarted) return;
        gameStarted = true;
        startTime = Date.now();

        timerInterval = setInterval(() => {
            elapsedTime = (Date.now() - startTime) / 1000;
            timerDisplay.innerHTML = `${elapsedTime.toFixed(1)}<span class="unit">s</span>`;

            // Calculate Dynamic Score (Decays with time & wrong attempts)
            // Base 1000 - (seconds * 15) - (wrongMatches * 50)
            const timeDeduction = Math.floor(elapsedTime * 15);
            const penaltyDeduction = wrongMatches * 50;
            score = Math.max(100, 1000 - timeDeduction - penaltyDeduction);

            scoreDisplay.textContent = score;
        }, 100);
    }

    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    // ==========================================
    // Card Interaction Logic
    // ==========================================
    function handleCardClick(cardEl, cardData) {
        // Prevent click if board is locked or card already flipped/matched
        if (isBoardLocked) return;
        if (cardEl.classList.contains('flipped') || cardEl.classList.contains('matched')) return;

        // Start timer on first card interaction
        if (!gameStarted) {
            startTimer();
        }

        // Play flip audio sound & speak if it's a word card
        playSound('flip');
        if (cardData.type === 'word') {
            speakWord(cardData.word);
        }

        cardEl.classList.add('flipped');
        flippedCards.push({ element: cardEl, data: cardData });

        if (flippedCards.length === 2) {
            flipCount++;
            checkMatch();
        }
    }

    function checkMatch() {
        isBoardLocked = true;
        const [card1, card2] = flippedCards;

        const isMatch = card1.data.key === card2.data.key;

        if (isMatch) {
            // Match Success!
            setTimeout(() => {
                playSound('match');
                card1.element.classList.add('matched');
                card2.element.classList.add('matched');

                // If matched pair contains word, pronounce it clearly
                speakWord(card1.data.word);

                flippedCards = [];
                isBoardLocked = false;
                matchedPairs++;

                // Check Victory Condition (All 4 pairs matched)
                if (matchedPairs === 4) {
                    setTimeout(handleVictory, 600);
                }
            }, 300);
        } else {
            // Match Failed
            wrongMatches++;
            setTimeout(() => {
                playSound('wrong');
                card1.element.classList.add('shake');
                card2.element.classList.add('shake');
            }, 300);

            setTimeout(() => {
                card1.element.classList.remove('flipped', 'shake');
                card2.element.classList.remove('flipped', 'shake');
                flippedCards = [];
                isBoardLocked = false;
            }, 1000);
        }
    }

    // ==========================================
    // Victory & Completion Modal
    // ==========================================
    function handleVictory() {
        stopTimer();
        playSound('victory');

        // Final score calculation
        const timeDeduction = Math.floor(elapsedTime * 15);
        const penaltyDeduction = wrongMatches * 50;
        const finalScoreVal = Math.max(100, 1000 - timeDeduction - penaltyDeduction);

        // Update Modal UI
        finalTime.textContent = `${elapsedTime.toFixed(1)} 秒`;
        finalFlips.textContent = `${flipCount} 次`;
        finalScore.textContent = finalScoreVal;

        // Calculate Stars Rating (1 ~ 3 Stars)
        let starsCount = 1;
        if (elapsedTime <= 12 && wrongMatches <= 1) {
            starsCount = 3;
        } else if (elapsedTime <= 22 && wrongMatches <= 3) {
            starsCount = 2;
        }

        const starElements = starsContainer.querySelectorAll('.star');
        starElements.forEach((star, idx) => {
            if (idx < starsCount) {
                star.classList.add('lit');
            } else {
                star.classList.remove('lit');
            }
        });

        // High Score Handling
        if (finalScoreVal > highScore) {
            highScore = finalScoreVal;
            localStorage.setItem('wordMatch_highScore', highScore);
            highScoreDisplay.textContent = highScore;
            newRecordBadge.classList.remove('hidden');
        } else {
            newRecordBadge.classList.add('hidden');
        }

        // Show Modal
        victoryModal.classList.add('active');
    }

    // Event Listeners for Restart & Replay Buttons
    btnRestart.addEventListener('click', initGame);
    btnPlayAgain.addEventListener('click', initGame);

    // Initialize Board on Startup
    initGame();
});
