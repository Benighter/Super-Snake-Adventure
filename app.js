const canvas = document.getElementById('game-board');
const ctx = canvas.getContext('2d');
const startButton = document.getElementById('start-button');
const leaderboardButton = document.getElementById('leaderboard-button');
const instructionsButton = document.getElementById('instructions-button');
const mainMenu = document.getElementById('main-menu');
const leaderboard = document.getElementById('leaderboard');
const leaderboardTable = document.getElementById('leaderboard-table');
const bossWarning = document.getElementById('boss-warning');
const countdownDisplay = document.getElementById('countdown');
const instructions = document.getElementById('instructions');

// Pause Functionality
let isPaused = false;
const pauseScreen = document.getElementById('pause-screen');
const resumeButton = document.getElementById('resume-button');
const quitButton = document.getElementById('quit-button');

const GRID_SIZE = 20;
const GAME_SIZE = 400;
canvas.width = GAME_SIZE;
canvas.height = GAME_SIZE;

let snake, direction, food, score, bossHealth, currentPower, boss, gameOver, gameLoop, powerUpTimer, countdownInterval;
let bullets = [];
let bombs = 3;
let powerUps = [];
let bossLevel = 1;
let bossSpawnTimer;
let plantedBombs = [];
let consecutiveBossDefeats = 0;
let bossSpawnLocation;

const powers = [
    { type: 'invincibility', color: '#f1c40f', duration: 10000 },
    { type: 'freeze', color: '#3498db', duration: 5000 },
    { type: 'reduce_size_50', color: '#27ae60', duration: 0 },
    { type: 'reduce_size_80', color: '#9b59b6', duration: 0 },
    { type: 'machine_gun', color: '#FF4500', duration: 10000 }
];

// --- Audio Context Initialization ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// --- Sound Effects ---

// Function to create a simple tone
function createTone(frequency, duration, volume = 0.5) {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sine'; 
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);

    gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration); // Fade out

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
}

// Example sound effects
function playEatFoodSound() {
    createTone(440, 0.1, 0.3); 
}

function playGameOverSound() {
    createTone(110, 0.5, 0.5); 
}

function playShootBulletSound() {
    createTone(880, 0.05, 0.4); 
}

function playBossHitSound() {
    createTone(220, 0.1, 0.6); 
}

function playBombExplosionSound() {
    const bufferSize = audioCtx.sampleRate * 0.5; 
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        noiseData[i] = Math.random() * 2 - 1;
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, audioCtx.currentTime);
    filter.frequency.linearRampToValueAtTime(440, audioCtx.currentTime + 0.2);

    noise.connect(filter);
    filter.connect(audioCtx.destination);

    noise.start();
    noise.stop(audioCtx.currentTime + 0.2);
}

function initGame() {
    // Reset game variables
    snake = [{ x: 200, y: 200 }];
    direction = { x: GRID_SIZE, y: 0 };
    food = getRandomPosition();
    score = 0;
    bossHealth = 100;
    currentPower = null;
    boss = null;
    gameOver = false;
    bullets = [];
    bombs = 3;
    powerUps = [];
    bossLevel = 1;
    plantedBombs = [];
    consecutiveBossDefeats = 0;
    isPaused = false;

    // Clear existing timeouts and intervals
    clearTimeout(gameLoop);
    clearTimeout(bossSpawnTimer);
    clearInterval(countdownInterval);
    clearInterval(powerUpTimer); // Clear any active power-up timers

    // Clear the canvas
    ctx.clearRect(0, 0, GAME_SIZE, GAME_SIZE);

    // Update UI elements
    document.getElementById('score').innerText = 'Score: 0';
    document.getElementById('boss-health').innerText = 'Boss: 100%';
    updatePowerLabel();
    document.getElementById('bombs').innerText = 'Bombs: 3';
    bossWarning.style.display = 'none';
    pauseScreen.style.display = 'none'; 

    // Schedule initial boss spawn
    scheduleBossSpawn();

    // Draw the initial snake and food
    drawSnake();
    drawFood();

    updateHighScoreDisplay();
    startCountdown(); // Start the countdown before the game loop
}

function startCountdown() {
    let countdown = 3;
    countdownDisplay.innerText = countdown;
    countdownDisplay.style.display = 'block';

    countdownInterval = setInterval(() => { // Assign to global variable
        countdown--;
        countdownDisplay.innerText = countdown;

        if (countdown === 0) {
            clearInterval(countdownInterval);
            countdownDisplay.style.display = 'none';
            gameLoopFunction();
        }
    }, 1000);

    // Add event listener for skipping countdown (using a named function)
    document.addEventListener('keydown', skipCountdown);
}

function skipCountdown(e) {
    if (countdownDisplay.style.display === 'block' &&
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {

        clearInterval(countdownInterval); // Clear interval when skipping
        countdownDisplay.style.display = 'none';
        gameLoopFunction();

        // Remove the skipCountdown listener as soon as it's used
        document.removeEventListener('keydown', skipCountdown);
    }
}

function getRandomPosition() {
    return {
        x: Math.floor(Math.random() * (GAME_SIZE / GRID_SIZE)) * GRID_SIZE,
        y: Math.floor(Math.random() * (GAME_SIZE / GRID_SIZE)) * GRID_SIZE
    };
}

function drawSnake() {
    ctx.fillStyle = '#2ecc71';
    snake.forEach((segment, index) => {
        if (index === 0) {
            ctx.fillStyle = '#27ae60';
        } else {
            ctx.fillStyle = '#2ecc71';
        }

        ctx.fillRect(segment.x, segment.y, GRID_SIZE, GRID_SIZE);

        if (index === 0) {
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(segment.x + GRID_SIZE / 4, segment.y + GRID_SIZE / 4, GRID_SIZE / 8, 0, 2 * Math.PI);
            ctx.fill();
            ctx.arc(segment.x + GRID_SIZE * 3 / 4, segment.y + GRID_SIZE / 4, GRID_SIZE / 8, 0, 2 * Math.PI);
            ctx.fill();
        }
    });
}

function drawFood() {
    ctx.clearRect(food.x, food.y, GRID_SIZE, GRID_SIZE);

    const svgString = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${GRID_SIZE}" height="${GRID_SIZE}">
        <ellipse cx="50" cy="60" rx="30" ry="20" fill="#A9A9A9"/>
        <circle cx="75" cy="50" r="15" fill="#A9A9A9"/>
        <circle cx="70" cy="38" r="7" fill="#FFC0CB"/>
        <circle cx="80" cy="38" r="7" fill="#FFC0CB"/>
        <circle cx="80" cy="48" r="3" fill="black"/>
        <circle cx="88" cy="50" r="3" fill="#FFA07A"/>
        <path d="M20,60 Q10,70 5,50" stroke="#A9A9A9" stroke-width="5" fill="none"/>
        <line x1="85" y1="45" x2="95" y2="40" stroke="black" stroke-width="1"/>
        <line x1="85" y1="50" x2="95" y2="50" stroke="black" stroke-width="1"/>
        <line x1="85" y1="55" x2="95" y2="60" stroke="black" stroke-width="1"/>
        <circle cx="40" cy="55" r="8" fill="white" opacity="0.3"/>
    </svg>`;

    const img = new Image();
    img.onload = () => {
        ctx.drawImage(img, food.x, food.y);
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(svgString);
}

function drawBoss() {
    if (boss) {
        ctx.clearRect(boss.x, boss.y, GRID_SIZE * 2, GRID_SIZE * 2);

        const svgString = `
        <svg width="${GRID_SIZE * 2}" height="${GRID_SIZE * 2}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(50, 50)">
            <ellipse cx="0" cy="0" rx="40" ry="30" fill="#333"/>
            <polygon points="-40,0 -30,-15 -20,0" fill="#666"/>
            <polygon points="-20,0 -10,-15 0,0" fill="#666"/>
            <polygon points="0,0 10,-15 20,0" fill="#666"/>
            <polygon points="20,0 30,-15 40,0" fill="#666"/>
            <ellipse cx="0" cy="-40" rx="20" ry="15" fill="#333"/>
            <circle cx="-10" cy="-45" r="5" fill="#f00"/>
            <circle cx="10" cy="-45" r="5" fill="#f00"/>
            <circle cx="-10" cy="-45" r="2" fill="#000"/>
            <circle cx="10" cy="-45" r="2" fill="#000"/>
            <path d="M -15 -35 A 10 10 0 0 1 15 -35" stroke="#f00" stroke-width="3" fill="none"/>
            <line x1="-10" y1="-30" x2="-5" y2="-25" stroke="#f00" stroke-width="2"/>
            <line x1="10" y1="-30" x2="5" y2="-25" stroke="#f00" stroke-width="2"/>
            <polygon points="-15,-35 -12,-30 -10,-35" fill="#fff"/>
            <polygon points="-10,-35 -7,-30 -5,-35" fill="#fff"/>
            <polygon points="-5,-35 -2,-30 0,-35" fill="#fff"/>
            <polygon points="0,-35 2,-30 5,-35" fill="#fff"/>
            <polygon points="5,-35 7,-30 10,-35" fill="#fff"/>
            <polygon points="10,-35 12,-30 15,-35" fill="#fff"/>
            <path d="M -40 10 Q -30 20 -20 10" stroke="#666" stroke-width="5" fill="none"/>
            <path d="M -20 10 Q -10 20 0 10" stroke="#666" stroke-width="5" fill="none"/>
            <path d="M 0 10 Q 10 20 20 10" stroke="#666" stroke-width="5" fill="none"/>
            <path d="M 20 10 Q 30 20 40 10" stroke="#666" stroke-width="5" fill="none"/>
            <ellipse cx="0" cy="15" rx="30" ry="10" fill="#000" opacity="0.3"/>
          </g>
        </svg>`;

        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, boss.x, boss.y);
        };
        img.src = 'data:image/svg+xml;base64,' + btoa(svgString);
    }
}

function drawBullets() {
    bullets.forEach(bullet => {
        ctx.clearRect(bullet.x, bullet.y, GRID_SIZE, GRID_SIZE); // Clear previous bullet

        // Draw the new SVG bullet
        const svgString = `
        <svg width="${GRID_SIZE}" height="${GRID_SIZE}" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <radialGradient id="bulletGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stop-color="#f8d766" stop-opacity="1"/>
                    <stop offset="100%" stop-color="#f5b041" stop-opacity="0"/>
                </radialGradient>
                <linearGradient id="fireTrail" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#f0932b" />
                    <stop offset="30%" stop-color="#ed7f11" />
                    <stop offset="70%" stop-color="#e56b0f" />
                    <stop offset="100%" stop-color="#d6550c" />
                </linearGradient>
            </defs>
            <g transform="translate(30, 30)">
                <path d="M -15 -3 L -3 -3 L 0 -10 L 3 -3 L 15 -3 L 10 3 L 3 10 L 0 15 L -3 10 L -10 3 Z" 
                      fill="url(#fireTrail)" stroke="#e67e22" stroke-width="1"/>
                <circle cx="0" cy="0" r="10" fill="#d35400" stroke="#e67e22" stroke-width="2" />
                <circle cx="0" cy="0" r="5" fill="#e74c3c" />
                <circle cx="0" cy="0" r="18" fill="url(#bulletGlow)" /> 
            </g>
        </svg>`;

        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, bullet.x, bullet.y);
        };
        img.src = 'data:image/svg+xml;base64,' + btoa(svgString);
    });
}

function drawPowerUps() {
    powerUps.forEach(powerUp => {
        ctx.fillStyle = powerUp.color;
        ctx.beginPath();
        ctx.arc(powerUp.x + GRID_SIZE / 2, powerUp.y + GRID_SIZE / 2, GRID_SIZE / 2, 0, 2 * Math.PI);
        ctx.fill();
    });
}

function drawPlantedBombs() {
    plantedBombs.forEach(bomb => {
        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, bomb.x, bomb.y);
        };
        img.src = 'data:image/svg+xml;base64,' + btoa(`
            <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <g transform="translate(10,10)">
                <ellipse cx="0" cy="0" rx="8" ry="6" fill="#333" stroke="#000" stroke-width="1"/>
                <path d="M -1 -5 L 1 -5 L 0 -8 Z" fill="#f00"/>
                <circle cx="0" cy="-5" r="2" fill="#f00" stroke="#000" stroke-width="1"/>
                <path d="M -6 -2 A 2 2 0 0 1 -6 2" stroke="#fff" stroke-width="1" fill="none"/>
                <path d="M -3 -2 A 2 2 0 0 1 -3 2" stroke="#fff" stroke-width="1" fill="none"/>
                <path d="M 0 -2 A 2 2 0 0 1 0 2" stroke="#fff" stroke-width="1" fill="none"/>
                <path d="M 3 -2 A 2 2 0 0 1 3 2" stroke="#fff" stroke-width="1" fill="none"/>
                <path d="M 6 -2 A 2 2 0 0 1 6 2" stroke="#fff" stroke-width="1" fill="none"/>
              </g>
            </svg>
        `);
    });
}

function moveSnake() {
    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

    if (head.x < 0) {
        head.x = GAME_SIZE - GRID_SIZE;
    } else if (head.x >= GAME_SIZE) {
        head.x = 0;
    } else if (head.y < 0) {
        head.y = GAME_SIZE - GRID_SIZE;
    } else if (head.y >= GAME_SIZE) {
        head.y = 0;
    }

    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
        score += 10;
        document.getElementById('score').innerText = `Score: ${score}`;
        food = getRandomPosition();
        playEatFoodSound();

        const originalHeadSize = GRID_SIZE;
        const enlargedHeadSize = GRID_SIZE * 1.2;
        const head = snake[0];

        ctx.fillStyle = '#27ae60';
        ctx.fillRect(head.x - (enlargedHeadSize - originalHeadSize) / 2, head.y - (enlargedHeadSize - originalHeadSize) / 2, enlargedHeadSize, enlargedHeadSize);

        setTimeout(() => {
            ctx.clearRect(head.x, head.y, originalHeadSize, originalHeadSize);
            drawSnake();
        }, 100);

        if (Math.random() < 0.2 && !boss) {
            spawnPowerUp();
        }
        if (!boss) {
            return;
        }
    }

    snake.pop();

    powerUps = powerUps.filter(powerUp => {
        if (head.x === powerUp.x && head.y === powerUp.y) {
            if (powerUp.type === 'bomb') {
                bombs++;
                document.getElementById('bombs').innerText = `Bombs: ${bombs}`;
            } else {
                currentPower = powerUp.type;
                updatePowerLabel(currentPower); 
            }
            return false;
        }
        return true;
    });
}

function showBossWarning() {
    bossSpawnLocation = getRandomPosition();

    bossWarning.innerHTML = '<span style="color: red;">!!!</span> Boss Incoming!';
    bossWarning.style.display = 'block';

    drawSpawnEffect(bossSpawnLocation.x, bossSpawnLocation.y);

    setTimeout(() => {
        bossWarning.style.display = 'none'; 
        spawnBoss(bossSpawnLocation);
    }, 3000);
}

function spawnBoss(location) {
    boss = location;
    boss.moveCounter = 0;
    bossHealth = 100 + (bossLevel - 1) * 50;
    updateBossHealthDisplay(); 

    // Hide the boss warning as soon as the boss spawns
    bossWarning.style.display = 'none';
}

function moveBoss() {
    if (boss && snake.length > 0 && !boss.frozen) {
        const head = snake[0];
        const dx = head.x - boss.x;
        const dy = head.y - boss.y;

        const angle = Math.atan2(dy, dx);

        const speed = GRID_SIZE / 4;

        const moveX = Math.cos(angle) * speed;
        const moveY = Math.sin(angle) * speed;

        boss.x += moveX;
        boss.y += moveY;
    }
}

function moveBullets() {
    bullets = bullets.filter(bullet => {
        bullet.x += bullet.dx;
        bullet.y += bullet.dy;
        return bullet.x >= 0 && bullet.x < GAME_SIZE && bullet.y >= 0 && bullet.y < GAME_SIZE;
    });
}

function checkCollision() {
    const head = snake[0];

    // Check for self-collision only if not invincible
    if (currentPower !== 'invincibility') {
        for (let i = 1; i < snake.length; i++) {
            if (head.x === snake[i].x && head.y === snake[i].y) {
                endGame();
            }
        }
    }

    // Check for collision with the boss
    if (boss && head.x >= boss.x && head.x < boss.x + GRID_SIZE * 2 &&
        head.y >= boss.y && head.y < boss.y + GRID_SIZE * 2) {
        if (currentPower !== 'invincibility') {
            endGame();
        }
    }

    // Check for collision between bullets and the boss (with improved hitbox)
    bullets.forEach((bullet, bulletIndex) => {
        if (boss && bullet.x < boss.x + GRID_SIZE * 2 &&
            bullet.x + GRID_SIZE / 2 > boss.x &&
            bullet.y < boss.y + GRID_SIZE * 2 &&
            bullet.y + GRID_SIZE / 2 > boss.y) {

            bossHealth -= 10;
            updateBossHealthDisplay();
            if (bossHealth <= 0) {
                defeatedBoss();
            } else {
                createImpactEffect(bullet.x, bullet.y);
                playBossHitSound();
            }
            bullets.splice(bulletIndex, 1);
        }
    });

    // Check for collision between planted bombs and the boss
    plantedBombs.forEach((bomb, index) => {
        if (boss && Math.abs(boss.x - bomb.x) < GRID_SIZE * 2 && Math.abs(boss.y - bomb.y) < GRID_SIZE * 2) {
            bossHealth -= 50;
            updateBossHealthDisplay();
            if (bossHealth <= 0) {
                defeatedBoss();
            } else {
                createImpactEffect(bomb.x, bomb.y, '#f39c12');
                playBombExplosionSound();
            }
            plantedBombs.splice(index, 1);
        }
    });
}

function defeatedBoss() {
    boss = null;
    score += 100 * bossLevel;
    document.getElementById('score').innerText = `Score: ${score}`;
    updateBossHealthDisplay();

    const reductionAmount50 = Math.floor(snake.length / 2);
    powerUps.push({
        x: getRandomPosition().x,
        y: getRandomPosition().y,
        type: 'reduce_size_50',
        color: '#27ae60',
        amount: reductionAmount50
    });

    consecutiveBossDefeats++;
    if (consecutiveBossDefeats >= 2) {
        const reductionAmount80 = Math.floor(snake.length * 0.8);
        powerUps.push({
            x: getRandomPosition().x,
            y: getRandomPosition().y,
            type: 'reduce_size_80',
            color: '#9b59b6',
            amount: reductionAmount80
        });
        consecutiveBossDefeats = 0;
    }

    snake.push(...Array(5).fill().map(() => ({ ...snake[snake.length - 1] })));
    bombs += 2;
    document.getElementById('bombs').innerText = `Bombs: ${bombs}`;

    plantedBombs.forEach(bomb => {
        powerUps.push({
            x: bomb.x,
            y: bomb.y,
            type: 'bomb',
            color: '#f39c12'
        });
    });
    plantedBombs = [];

    // Check if no bombs were used to defeat the boss
    if (bombs === 3) {
        spawnPowerUp('machine_gun'); // Spawn rapid-fire power-up
    }

    bossLevel++;
    clearTimeout(bossSpawnTimer);
    scheduleBossSpawn();
}

function scheduleBossSpawn() {
    const spawnTime = Math.max(10000, 30000 - bossLevel * 2000);
    bossSpawnTimer = setTimeout(showBossWarning, spawnTime);
}

function endGame() {
    gameOver = true;
    clearTimeout(gameLoop);
    clearTimeout(bossSpawnTimer);
    updateLeaderboard(score);
    playGameOverSound();

    const gameOverScreen = document.createElement('div');
    gameOverScreen.classList.add('game-over');
    gameOverScreen.innerHTML = `
        <h2>GAME OVER</h2>
        <p>Your Score: ${score}</p>
        <button id="restart-button">Restart</button>
        <button id="menu-button">Menu</button>
    `;
    document.getElementById('game-container').appendChild(gameOverScreen);

    document.getElementById('restart-button').addEventListener('click', () => {
        document.getElementById('game-container').removeChild(gameOverScreen);
        initGame(); // Start a new game
    });

    document.getElementById('menu-button').addEventListener('click', () => {
        document.getElementById('game-container').removeChild(gameOverScreen);
        showMainMenu();
    });
}

function spawnPowerUp(specificType = null) {
    let powerUpType;
    if (specificType) {
        powerUpType = specificType;
    } else {
        // Adjust the probabilities here:
        if (Math.random() < 0.3) { // 30% chance of machine gun
            powerUpType = 'machine_gun';
        } else {
            powerUpType = powers[Math.floor(Math.random() * (powers.length - 1))].type; // Choose from other powers
        }
    }

    const powerUp = {
        x: getRandomPosition().x,
        y: getRandomPosition().y,
        type: powerUpType
    };
    if (powerUpType !== 'bomb') {
        powerUp.color = powers.find(p => p.type === powerUpType).color;
    }

    // Add a timeout to remove the power-up after 5 seconds
    powerUp.timeoutId = setTimeout(() => {
        powerUps = powerUps.filter(p => p !== powerUp);
    }, 5000); // 5 seconds in milliseconds

    powerUps.push(powerUp);
}

function gameLoopFunction() {
    if (gameOver) {
        return; // Stop the loop if game over
    }

    if (!isPaused) { // Only execute game logic if not paused
        ctx.clearRect(0, 0, GAME_SIZE, GAME_SIZE); // Clear the canvas
        moveSnake();                             // Move the snake
        if (boss) moveBoss();                  // Move the boss (if it exists)
        moveBullets();                          // Move the bullets
        checkCollision();                       // Check for collisions
        drawSnake();                             // Draw the snake
        drawFood();                             // Draw the food
        drawBoss();                             // Draw the boss (if it exists)
        drawBullets();                          // Draw the bullets
        drawPowerUps();                         // Draw any power-ups
        drawPlantedBombs();                    // Draw any planted bombs
    }

    gameLoop = setTimeout(gameLoopFunction, 100); // Schedule the next frame
}

document.addEventListener('keydown', (e) => {
    if (gameOver) return; // Don't process keys if game is over

    if (e.key === 'Escape') {
        if (isPaused) {
            resumeGame();
        } else {
            pauseGame();
        }
    } else if (!isPaused) { // Only process game keys if not paused
        switch (e.key) {
            case 'ArrowUp':
                if (direction.y === 0) direction = { x: 0, y: -GRID_SIZE };
                break;
            case 'ArrowDown':
                if (direction.y === 0) direction = { x: 0, y: GRID_SIZE };
                break;
            case 'ArrowLeft':
                if (direction.x === 0) direction = { x: -GRID_SIZE, y: 0 };
                break;
            case 'ArrowRight':
                if (direction.x === 0) direction = { x: GRID_SIZE, y: 0 };
                break;
            case ' ':
                shootBullet(); // Shoot a single bullet
                break;
            case 'b':
            case 'B':
                if (boss && bombs > 0) {
                    plantBomb();
                }
                break;
            case 'x':
            case 'X':
                if (currentPower) {
                    activatePower();
                }
                break;
        }
    }
});

function activatePower() {
    const powerUpObject = powers.find(p => p.type === currentPower);

    switch (currentPower) {
        case 'invincibility':
            snake.invincible = true;
            // Intentional fallthrough to apply timer logic
        case 'freeze':
            if (boss) {
                boss.frozen = true;
            }
            // Intentional fallthrough to apply timer logic
        case 'machine_gun':
            if (powerUpObject.duration > 0) {
                let timeRemaining = powerUpObject.duration / 1000;
                updatePowerLabel(powerUpObject.type, timeRemaining);

                powerUpTimer = setInterval(() => {
                    timeRemaining--;
                    updatePowerLabel(powerUpObject.type, timeRemaining);

                    if (timeRemaining <= 0) {
                        clearInterval(powerUpTimer);

                        if (powerUpObject.type === 'freeze' && boss) {
                            boss.frozen = false;
                        }

                        if (powerUpObject.type === 'machine_gun') {
                            isFiring = false;
                        }

                        currentPower = null; // Reset currentPower after the timer ends
                        updatePowerLabel();
                    }
                }, 1000);
            }

            if (currentPower === 'machine_gun') {
                let isFiring = false;
                const fireRate = 50;

                const startFiring = () => {
                    if (!isFiring && !gameOver && !isPaused) {
                        isFiring = true;
                        const firingInterval = setInterval(() => {
                            if (!isFiring || gameOver || isPaused) {
                                clearInterval(firingInterval);
                                return;
                            }
                            shootBullet();
                        }, fireRate);
                    }
                };

                const stopFiring = () => {
                    isFiring = false;
                };

                window.addEventListener('keydown', (e) => {
                    if (e.key === ' ' && currentPower === 'machine_gun') {
                        startFiring();
                    }
                });

                window.addEventListener('keyup', (e) => {
                    if (e.key === ' ') {
                        stopFiring();
                    }
                });
            }
            break;

        case 'reduce_size_50':
        case 'reduce_size_80':
            const reductionAmount = Math.floor(snake.length * (powerUpObject.type === 'reduce_size_50' ? 0.5 : 0.8));
            const segmentsToRemove = Math.min(reductionAmount, snake.length - 1);
            snake.splice(1, segmentsToRemove);
            currentPower = null; // These power-ups don't need a timer
            updatePowerLabel();
            break;
    }
}

function updatePowerLabel(powerType = null, time = null) {
    const powerUpLabel = document.getElementById('power-up');
    const powerUpTimerLabel = document.getElementById('power-up-timer');

    if (powerType) {
        const powerUpObject = powers.find(p => p.type === powerType);
        powerUpLabel.innerText = `Power: ${powerUpObject.type}`;
        powerUpLabel.style.color = powerUpObject.color;

        // Update the timer label (if applicable)
        if (time !== null) {
            powerUpTimerLabel.innerText = `(${time}s)`;
            powerUpTimerLabel.style.display = 'block';
        } else {
            powerUpTimerLabel.style.display = 'none';
        }
    } else {
        powerUpLabel.innerText = 'Power: None';
        powerUpLabel.style.color = '#3498db';
        powerUpTimerLabel.style.display = 'none';
    }
}

function shootBullet(angleOffset = 0) {
    const head = snake[0];
    const angle = Math.atan2(direction.y, direction.x) + angleOffset;

    // Increased bullet speed 
    const speed = GRID_SIZE * 2; 

    // Bullet starting position 
    const bulletX = head.x + GRID_SIZE / 2;
    const bulletY = head.y + GRID_SIZE / 2;

    bullets.push({
        x: bulletX,
        y: bulletY,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed
    });

    // Add shooting animation (muzzle flash)
    const muzzleFlashSize = GRID_SIZE / 2;
    ctx.fillStyle = '#f1c40f'; 
    ctx.beginPath();
    ctx.arc(head.x + GRID_SIZE / 2, head.y + GRID_SIZE / 2, muzzleFlashSize, 0, 2 * Math.PI);
    ctx.fill();

    // Briefly show the muzzle flash
    setTimeout(() => {
        ctx.clearRect(head.x, head.y, GRID_SIZE, GRID_SIZE);
        drawSnake(); // Redraw the head without the muzzle flash
    }, 50); 

    playShootBulletSound();
}

function plantBomb() {
    if (bombs > 0) {
        const head = snake[0];
        plantedBombs.push({ x: head.x, y: head.y });
        bombs--;
        document.getElementById('bombs').innerText = `Bombs: ${bombs}`;
    }
}

function updateBossHealthDisplay() {
    const bossHealthElement = document.getElementById('boss-health');
    if (boss) {
        bossHealthElement.innerText = `Boss: ${bossHealth}%`;
        bossHealthElement.style.display = 'block'; 
    } else {
        bossHealthElement.style.display = 'none'; 
    }
}

function createImpactEffect(x, y, color = '#f1c40f') {
    const impactRadius = GRID_SIZE / 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, impactRadius, 0, 2 * Math.PI);
    ctx.fill();

    setTimeout(() => {
        ctx.clearRect(x - impactRadius, y - impactRadius, impactRadius * 2, impactRadius * 2);
    }, 100);
}

function getLeaderboardData() {
    let leaderboardData = localStorage.getItem('leaderboard');
    if (leaderboardData) {
        return JSON.parse(leaderboardData);
    } else {
        return [];
    }
}

function saveLeaderboardData(data) {
    localStorage.setItem('leaderboard', JSON.stringify(data));
}

function updateLeaderboard(newScore) {
    let leaderboardData = getLeaderboardData();
    const isHighScore = leaderboardData.length < 10 || newScore > leaderboardData[leaderboardData.length - 1].score;

    if (isHighScore) {
        // Show the name entry modal
        const modal = document.getElementById('name-entry-modal');
        modal.style.display = 'flex';

        document.getElementById('submit-name-button').addEventListener('click', () => {
            const playerName = document.getElementById('player-name-input').value || "Anonymous";
            leaderboardData.push({ name: playerName, score: newScore });
            leaderboardData.sort((a, b) => b.score - a.score);
            leaderboardData = leaderboardData.slice(0, 10);
            saveLeaderboardData(leaderboardData);
            displayLeaderboard();
            modal.style.display = 'none'; // Hide the modal after submitting

            // Remove the high score display if the new score is higher
            if (newScore > leaderboardData[0].score) {
                document.getElementById('high-score').style.display = 'none';
            }
        });
    }
}

function updateHighScoreDisplay() {
    const leaderboardData = getLeaderboardData();
    const highScore = leaderboardData.length > 0 ? leaderboardData[0].score : 0;
    document.getElementById('high-score').innerText = `High Score: ${highScore}`;
}

function displayLeaderboard() {
    let leaderboardData = getLeaderboardData();
    const tbody = leaderboardTable.querySelector('tbody');
    tbody.innerHTML = '';
    leaderboardData.forEach((entry, index) => {
        const row = tbody.insertRow();
        const rankCell = row.insertCell();
        const nameCell = row.insertCell(); 
        const scoreCell = row.insertCell();
        rankCell.innerText = index + 1;
        nameCell.innerText = entry.name; 
        scoreCell.innerText = entry.score;
    });
}

function showInstructions() {
    mainMenu.style.display = 'none';
    instructions.style.display = 'block';
    instructions.classList.add('fade-in');

    // Add event listener for Esc key to go back to main menu
    document.addEventListener('keydown', handleEscKey);
}

function showMainMenu() {
    mainMenu.style.display = 'block';
    mainMenu.classList.add('fade-in');
    leaderboard.style.display = 'none';
    instructions.style.display = 'none';
    document.getElementById('game-container').style.display = 'none';

    document.removeEventListener('keydown', handleEscKey);
}

function showGame() {
    mainMenu.style.display = 'none';
    leaderboard.style.display = 'none';
    instructions.style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
    document.getElementById('game-container').classList.add('fade-in');
}

function showLeaderboard() {
    mainMenu.style.display = 'none';
    leaderboard.style.display = 'block';
    leaderboard.classList.add('fade-in');
    displayLeaderboard();

    document.addEventListener('keydown', handleEscKey);
}

function handleEscKey(e) {
    if (e.key === 'Escape') {
        showMainMenu();
    }
}

startButton.addEventListener('click', () => {
    showGame();
    initGame();
});

leaderboardButton.addEventListener('click', showLeaderboard);
instructionsButton.addEventListener('click', showInstructions);

showMainMenu();

function drawSpawnEffect(x, y) {
    const radius = GRID_SIZE * 2;
    let opacity = 1;
    let animationInterval = setInterval(() => {
        ctx.beginPath();
        ctx.arc(x + GRID_SIZE, y + GRID_SIZE, radius, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(255, 0, 0, ${opacity})`;
        ctx.fill();
        opacity -= 0.05;
        if (opacity <= 0) {
            clearInterval(animationInterval);
            ctx.clearRect(x, y, GRID_SIZE * 2, GRID_SIZE * 2);
        }
    }, 50);
}

document.addEventListener('DOMContentLoaded', () => {
    const categoryButtons = document.querySelectorAll('.category-button');
    const instructionCategories = document.querySelectorAll('.instruction-category');

    categoryButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetCategory = button.dataset.target;

            instructionCategories.forEach(category => {
                category.style.display = 'none';
            });

            document.getElementById(targetCategory).style.display = 'block';
        });
    });
});

function pauseGame() {
    isPaused = true;
    clearTimeout(gameLoop); // Clear the existing timeout when pausing
    pauseScreen.style.display = 'block';
}

function resumeGame() {
    isPaused = false;
    pauseScreen.style.display = 'none';
    gameLoopFunction(); // Restart the loop when resuming
}

resumeButton.addEventListener('click', resumeGame);

quitButton.addEventListener('click', () => {
    pauseScreen.style.display = 'none';
    gameOver = true; // Set gameOver to true to stop the game loop
    clearTimeout(gameLoop);
    showMainMenu();
});