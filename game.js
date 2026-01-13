const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 1. SETUP CANVAS SIZE
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// 2. GAME STATE
let gameState = {
    gold: 150,
    lives: 20,
    wave: 1
};

// 3. THE MAP (A simple path for enemies)
// We define "Waypoints" - X and Y percentages of the screen
const path = [
    {x: 0, y: 0.5},    // Start (Left middle)
    {x: 0.4, y: 0.5},  // Go to middle
    {x: 0.4, y: 0.2},  // Go up
    {x: 0.8, y: 0.2},  // Go right
    {x: 0.8, y: 0.8},  // Go down
    {x: 1, y: 0.8}     // End (Right bottom)
];

// 4. DRAW FUNCTIONS
function drawMap() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw the path line
    ctx.beginPath();
    ctx.lineWidth = 40;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111'; // Dark road color
    
    // Move to start
    ctx.moveTo(path[0].x * canvas.width, path[0].y * canvas.height);
    
    // Draw lines to each point
    for(let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x * canvas.width, path[i].y * canvas.height);
    }
    ctx.stroke();
    
    // Draw a border for the path
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#4CAF50'; // Green outline
    ctx.stroke();
}

function updateUI() {
    document.getElementById('displayGold').innerText = gameState.gold;
    document.getElementById('displayLives').innerText = gameState.lives;
    document.getElementById('displayWave').innerText = "WAVE " + gameState.wave;
}

// 5. THE GAME LOOP (Runs 60 times a second)
function gameLoop() {
    drawMap();
    updateUI();
    requestAnimationFrame(gameLoop);
}

// Start the game
gameLoop();
