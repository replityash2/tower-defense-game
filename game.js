const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- 1. SETUP & RESIZE ---
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// --- 2. GAME VARIABLES ---
let gameState = {
    gold: 150,
    lives: 20,
    wave: 1,
    gameOver: false
};

const enemies = [];
const ENEMY_SPEED = 0.0015; // Speed (percentage of screen per tick)

// The Path (Points connected by lines)
const path = [
    {x: 0, y: 0.5},    // Start
    {x: 0.4, y: 0.5},
    {x: 0.4, y: 0.2},
    {x: 0.8, y: 0.2},
    {x: 0.8, y: 0.8},
    {x: 1, y: 0.8}     // End
];

// --- 3. THE ENEMY CLASS ---
class Enemy {
    constructor() {
        this.pathIndex = 0;
        // Start exactly at the first point
        this.x = path[0].x; 
        this.y = path[0].y;
        this.health = 100;
        this.maxHealth = 100;
        this.active = true;
        this.radius = 15; // Size of enemy
    }

    update() {
        if (!this.active) return;

        // Find target waypoint
        let target = path[this.pathIndex + 1];

        // If no target, we reached the end (Base)
        if (!target) {
            this.active = false;
            gameState.lives -= 1;
            return;
        }

        // Calculate distance to target
        let dx = target.x - this.x;
        let dy = target.y - this.y;
        let dist = Math.sqrt(dx*dx + dy*dy);

        // If close enough to waypoint, switch to next one
        if (dist < 0.01) {
            this.pathIndex++;
        } else {
            // Move toward target
            this.x += (dx / dist) * ENEMY_SPEED;
            this.y += (dy / dist) * ENEMY_SPEED;
        }
    }

    draw() {
        if (!this.active) return;
        
        let px = this.x * canvas.width;
        let py = this.y * canvas.height;

        // Draw Enemy Body (Red Square)
        ctx.fillStyle = '#ff3333';
        ctx.fillRect(px - 10, py - 10, 20, 20);

        // Draw Health Bar
        ctx.fillStyle = 'red';
        ctx.fillRect(px - 15, py - 20, 30, 4);
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(px - 15, py - 20, 30 * (this.health / this.maxHealth), 4);
    }
}

// --- 4. DRAWING FUNCTIONS ---
function drawMap() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw Path Line
    ctx.beginPath();
    ctx.lineWidth = 40;
    ctx.strokeStyle = '#1a1a1a'; // Dark Road
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.moveTo(path[0].x * canvas.width, path[0].y * canvas.height);
    for(let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x * canvas.width, path[i].y * canvas.height);
    }
    ctx.stroke();

    // Draw Path Border (Green)
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#4CAF50';
    ctx.stroke();
}

function updateUI() {
    document.getElementById('displayGold').innerText = Math.floor(gameState.gold);
    document.getElementById('displayLives').innerText = gameState.lives;
    
    // Game Over Check
    if (gameState.lives <= 0 && !gameState.gameOver) {
        gameState.gameOver = true;
        alert("GAME OVER! Refresh to restart.");
    }
}

// --- 5. MAIN GAME LOOP ---
function gameLoop() {
    if (gameState.gameOver) return;

    // 1. Clear & Draw Map
    drawMap();

    // 2. Update & Draw Enemies
    // Loop backwards so we can remove dead enemies safely
    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];
        e.update();
        e.draw();
        
        // Remove inactive enemies from array
        if (!e.active) {
            enemies.splice(i, 1);
        }
    }

    // 3. Update Text UI
    updateUI();

    requestAnimationFrame(gameLoop);
}

// Start the Loop
gameLoop();

// --- 6. SPAWNER ---
// Spawn a new enemy every 1.5 seconds
setInterval(() => {
    if (!gameState.gameOver) {
        enemies.push(new Enemy());
    }
}, 1500);
