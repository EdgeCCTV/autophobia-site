var canvas = document.getElementById("c");
var ctx = canvas.getContext("2d");

var currentGame = "";
var score = 0;
var gameTimer = null;
var gameRunning = false;

// ==========================================
// FIREBASE CONFIG (Connected to Autophobia Project)
// ==========================================
var firebaseConfig = {
    apiKey: "AIzaSyDntowtTBTyLFFzO_nVRZvxXNdtgB3J4uk",
    authDomain: "autophobia-project.firebaseapp.com",
    databaseURL: "https://autophobia-project-default-rtdb.firebaseio.com",
    projectId: "autophobia-project",
    storageBucket: "autophobia-project.appspot.com",
    messagingSenderId: "839741928303",
    appId: "1:839741928303:web:7ac2f083ec042108da6e9a"
};

var db = null;
try {
    if (typeof firebase !== "undefined" && firebaseConfig.apiKey !== "PASTE_API_KEY_HERE") {
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        // console.log("firebase connected!");
    }
} catch(err) {
    // console.log("firebase not initialized yet");
}

// helper: firebase keys cannot have certain characters
function dbKey(name) {
    return name.replace(/[.#$\[\]\/]/g, '_');
}

// ACCOUNTS
var currentUser = localStorage.getItem("game_user") || "Guest";

// accounts that can open the radio log
var RADIO_USERS = [
    "Fish",
    "leonardowe9s",
    "Eight Handled Sword Divergent Sila Divine General, Arcangel and World Slayer Reality Destroyer Judgemental: Radio",
    "Player4" // 4th future user
];

function isRadioUser() {
    return RADIO_USERS.indexOf(currentUser) !== -1;
}

updateUserDisplay();
if (db) {
    loadCloudScores();
    initRadioListener();
}

function updateUserDisplay() {
    document.getElementById("user-status").innerText = "User: " + currentUser;
    updateBestDisplay();

    // only show radio room button to authorized users
    var secretBtn = document.getElementById("secret-btn");
    if (secretBtn) {
        if (isRadioUser()) {
            secretBtn.style.display = "inline-block";
        } else {
            secretBtn.style.display = "none";
            if (currentGame === "chat") {
                play("snake");
            }
        }
    }
}

function signup() {
    var u = document.getElementById("uname").value.trim();
    var p = document.getElementById("pword").value.trim();
    if (u === "" || p === "") {
        alert("Enter username and password first!");
        return;
    }

    if (db) {
        var key = dbKey(u);
        db.ref("users/" + key).once("value", function(snap) {
            if (snap.exists()) {
                alert("This username is already taken!");
            } else {
                db.ref("users/" + key).set({
                    username: u,
                    password: p,
                    scores: { snake: 0, tetris: 0, breakout: 0, memory: 0, mines: 0 }
                }, function(err) {
                    if (err) {
                        alert("Error creating account: " + err.message);
                    } else {
                        currentUser = u;
                        localStorage.setItem("game_user", u);
                        updateUserDisplay();
                        alert("Account created and logged in!");
                    }
                });
            }
        });
    } else {
        // fallback to local storage
        var users = JSON.parse(localStorage.getItem("game_accounts") || "{}");
        if (users[u]) {
            alert("Username already taken!");
            return;
        }
        users[u] = p;
        localStorage.setItem("game_accounts", JSON.stringify(users));
        currentUser = u;
        localStorage.setItem("game_user", u);
        updateUserDisplay();
        alert("Account created locally!");
    }
}

function login() {
    var u = document.getElementById("uname").value.trim();
    var p = document.getElementById("pword").value.trim();
    if (u === "" || p === "") {
        alert("Enter username and password first!");
        return;
    }

    if (db) {
        var key = dbKey(u);
        db.ref("users/" + key).once("value", function(snap) {
            if (snap.exists() && snap.val().password === p) {
                currentUser = u;
                localStorage.setItem("game_user", u);
                updateUserDisplay();
                loadCloudScores();
                alert("Logged in!");
            } else {
                alert("Wrong username or password!");
            }
        });
    } else {
        // fallback to local storage
        var users = JSON.parse(localStorage.getItem("game_accounts") || "{}");
        if (users[u] && users[u] === p) {
            currentUser = u;
            localStorage.setItem("game_user", u);
            updateUserDisplay();
            alert("Logged in!");
        } else {
            alert("Wrong username or password!");
        }
    }
}

function logout() {
    currentUser = "Guest";
    localStorage.removeItem("game_user");
    updateUserDisplay();
}

function loadCloudScores() {
    if (db && currentUser !== "Guest") {
        var key = dbKey(currentUser);
        db.ref("users/" + key + "/scores").once("value", function(snap) {
            var cloudScores = snap.val() || {};
            for (var g in cloudScores) {
                localStorage.setItem(currentUser + "_" + g, cloudScores[g]);
            }
            updateBestDisplay();
        });
    }
}

function getBest(game) {
    return parseInt(localStorage.getItem(currentUser + "_" + game) || "0");
}

function saveBest(game, s) {
    var old = getBest(game);
    if (s > old) {
        localStorage.setItem(currentUser + "_" + game, s);
        document.getElementById("best").innerText = s;

        // sync to firebase cloud
        if (db && currentUser !== "Guest") {
            var key = dbKey(currentUser);
            db.ref("users/" + key + "/scores/" + game).set(s);
        }
    }
}

function updateBestDisplay() {
    if (currentGame) {
        document.getElementById("best").innerText = getBest(currentGame);
    }
}

// SWITCH GAMES
function play(name) {
    if (gameTimer) clearInterval(gameTimer);
    gameRunning = false;

    // show canvas or chat room
    var c = document.getElementById("c");
    var chat = document.getElementById("chat-panel");

    if (name === "chat") {
        if (!isRadioUser()) return;
        c.style.display = "none";
        chat.style.display = "block";
    } else {
        c.style.display = "block";
        chat.style.display = "none";
    }

    currentGame = name;
    score = 0;
    document.getElementById("score").innerText = "0";
    document.getElementById("game-name").innerText = name.toUpperCase();
    updateBestDisplay();

    if (name === "snake") startSnake();
    if (name === "tetris") startTetris();
    if (name === "breakout") startBreakout();
    if (name === "memory") startMemory();
    if (name === "mines") startMines();
    if (name === "chat") startChat();
}


// ==========================================
// GAME 1: SNAKE
// ==========================================
var snake, snakeFood, snakeDir, nextSnakeDir;

function startSnake() {
    canvas.width = 300;
    canvas.height = 300;
    document.getElementById("help-text").innerText = "Controls: Arrow Keys or W A S D to turn.";

    snake = [{x: 7, y: 7}, {x: 6, y: 7}, {x: 5, y: 7}];
    snakeDir = {x: 1, y: 0};
    nextSnakeDir = {x: 1, y: 0};
    gameRunning = true;

    spawnSnakeFood();
    // gameTimer = setInterval(stepSnake, 60); // was WAY too fast
    gameTimer = setInterval(stepSnake, 110);
}

function spawnSnakeFood() {
    snakeFood = {
        x: Math.floor(Math.random() * 15),
        y: Math.floor(Math.random() * 15)
    };
}

function stepSnake() {
    if (!gameRunning) return;

    snakeDir = nextSnakeDir;
    var head = {x: snake[0].x + snakeDir.x, y: snake[0].y + snakeDir.y};

    // wall hit
    if (head.x < 0 || head.x >= 15 || head.y < 0 || head.y >= 15) return endSnake();

    // body hit
    for (var i = 0; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) return endSnake();
    }

    snake.unshift(head);

    if (head.x === snakeFood.x && head.y === snakeFood.y) {
        score += 10;
        document.getElementById("score").innerText = score;
        spawnSnakeFood();
    } else {
        snake.pop();
    }

    // draw
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, 300, 300);

    ctx.fillStyle = "red";
    ctx.fillRect(snakeFood.x * 20, snakeFood.y * 20, 18, 18);

    ctx.fillStyle = "lime";
    for (var j = 0; j < snake.length; j++) {
        ctx.fillRect(snake[j].x * 20, snake[j].y * 20, 18, 18);
    }
}

function endSnake() {
    gameRunning = false;
    clearInterval(gameTimer);
    saveBest("snake", score);
    ctx.fillStyle = "white";
    ctx.font = "20px sans-serif";
    ctx.fillText("Game Over!", 100, 150);
}


// ==========================================
// GAME 2: TETRIS
// ==========================================
var tBoard, tPiece, tColor, tX, tY;

var SHAPES = [
    [[1,1,1,1]], // I
    [[1,1],[1,1]], // O
    [[0,1,0],[1,1,1]], // T
    [[1,1,0],[0,1,1]], // S
    [[0,1,1],[1,1,0]], // Z
    [[1,0,0],[1,1,1]], // L
    [[0,0,1],[1,1,1]]  // J
];
var COLORS = ["cyan", "yellow", "purple", "green", "red", "orange", "blue"];

function startTetris() {
    canvas.width = 200;
    canvas.height = 400;
    document.getElementById("help-text").innerText = "Controls: Left/Right to move, Up to rotate, Down to drop.";

    tBoard = [];
    for (var r = 0; r < 20; r++) {
        tBoard[r] = new Array(10).fill(0);
    }

    gameRunning = true;
    newTetrisPiece();
    drawTetris();

    gameTimer = setInterval(dropTetris, 400);
}

function newTetrisPiece() {
    var rand = Math.floor(Math.random() * SHAPES.length);
    tPiece = SHAPES[rand];
    tColor = COLORS[rand];
    tX = 3;
    tY = 0;

    if (tCollide(tPiece, tX, tY)) {
        gameRunning = false;
        clearInterval(gameTimer);
        saveBest("tetris", score);
        drawTetris();
        ctx.fillStyle = "white";
        ctx.font = "20px sans-serif";
        ctx.fillText("Game Over!", 45, 200);
    }
}

function tCollide(piece, px, py) {
    for (var r = 0; r < piece.length; r++) {
        for (var c = 0; c < piece[r].length; c++) {
            if (piece[r][c]) {
                var nx = px + c;
                var ny = py + r;
                if (nx < 0 || nx >= 10 || ny >= 20) return true;
                if (ny >= 0 && tBoard[ny][nx]) return true;
            }
        }
    }
    return false;
}

function dropTetris() {
    if (!gameRunning) return;

    if (!tCollide(tPiece, tX, tY + 1)) {
        tY++;
    } else {
        for (var r = 0; r < tPiece.length; r++) {
            for (var c = 0; c < tPiece[r].length; c++) {
                if (tPiece[r][c] && tY + r >= 0) {
                    tBoard[tY + r][tX + c] = tColor;
                }
            }
        }

        // clear lines
        for (var row = 19; row >= 0; row--) {
            var full = true;
            for (var col = 0; col < 10; col++) {
                if (!tBoard[row][col]) full = false;
            }
            if (full) {
                tBoard.splice(row, 1);
                tBoard.unshift(new Array(10).fill(0));
                score += 100;
                document.getElementById("score").innerText = score;
                row++;
            }
        }

        newTetrisPiece();
    }
    drawTetris();
}

function rotateTetris() {
    var rotated = [];
    for (var c = 0; c < tPiece[0].length; c++) {
        rotated[c] = [];
        for (var r = tPiece.length - 1; r >= 0; r--) {
            rotated[c].push(tPiece[r][c]);
        }
    }
    // fixed: prevent rotating into wall
    if (!tCollide(rotated, tX, tY)) {
        tPiece = rotated;
    }
}

function drawTetris() {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, 200, 400);

    for (var r = 0; r < 20; r++) {
        for (var c = 0; c < 10; c++) {
            if (tBoard[r][c]) {
                ctx.fillStyle = tBoard[r][c];
                ctx.fillRect(c * 20, r * 20, 19, 19);
            }
        }
    }

    if (tPiece && gameRunning) {
        ctx.fillStyle = tColor;
        for (var pr = 0; pr < tPiece.length; pr++) {
            for (var pc = 0; pc < tPiece[pr].length; pc++) {
                if (tPiece[pr][pc]) {
                    ctx.fillRect((tX + pc) * 20, (tY + pr) * 20, 19, 19);
                }
            }
        }
    }
}


// ==========================================
// GAME 3: BREAKOUT (BRICK BREAKER)
// ==========================================
var bPaddleX, bPaddleW, bPaddleH;
var bBallX, bBallY, bBallVX, bBallVY;
var bricks = [];

function startBreakout() {
    canvas.width = 300;
    canvas.height = 300;
    document.getElementById("help-text").innerText = "Controls: Mouse or A / D to move paddle. Smash all bricks!";

    bPaddleW = 65;
    bPaddleH = 9;
    bPaddleX = (300 - bPaddleW) / 2;

    bBallX = 150;
    bBallY = 220;
    bBallVX = 2.2;
    bBallVY = -2.5;

    // 4 rows of 6 bricks
    bricks = [];
    var rowColors = ["#ff4757", "#ffa502", "#2ed573", "#1e90ff"];
    for (var r = 0; r < 4; r++) {
        for (var c = 0; c < 6; c++) {
            bricks.push({
                x: 10 + c * 47,
                y: 35 + r * 18,
                w: 42,
                h: 12,
                color: rowColors[r],
                alive: true
            });
        }
    }

    gameRunning = true;
    gameTimer = setInterval(stepBreakout, 20);
}

function stepBreakout() {
    if (!gameRunning) return;

    bBallX += bBallVX;
    bBallY += bBallVY;

    // bounce left / right wall
    if (bBallX <= 4 || bBallX >= 296) {
        bBallVX = -bBallVX;
    }
    // bounce top wall
    if (bBallY <= 4) {
        bBallVY = -bBallVY;
    }

    // hit paddle
    if (bBallY >= 270 && bBallY <= 276) {
        if (bBallX >= bPaddleX && bBallX <= bPaddleX + bPaddleW) {
            bBallVY = -Math.abs(bBallVY);
            // change angle depending on where it hits paddle
            var offset = (bBallX - (bPaddleX + bPaddleW / 2)) / (bPaddleW / 2);
            bBallVX = offset * 3;
        }
    }

    // ball fell down = game over
    if (bBallY > 300) {
        gameRunning = false;
        clearInterval(gameTimer);
        saveBest("breakout", score);
        ctx.fillStyle = "white";
        ctx.font = "20px sans-serif";
        ctx.fillText("Game Over!", 100, 160);
        return;
    }

    // hit bricks
    var allCleared = true;
    for (var i = 0; i < bricks.length; i++) {
        var b = bricks[i];
        if (b.alive) {
            allCleared = false;
            // collision check
            if (bBallX >= b.x && bBallX <= b.x + b.w && bBallY >= b.y && bBallY <= b.y + b.h) {
                b.alive = false;
                bBallVY = -bBallVY;
                score += 10;
                document.getElementById("score").innerText = score;
                break;
            }
        }
    }

    // win check
    if (allCleared) {
        gameRunning = false;
        clearInterval(gameTimer);
        score += 50; // win bonus
        document.getElementById("score").innerText = score;
        saveBest("breakout", score);
        ctx.fillStyle = "white";
        ctx.font = "20px sans-serif";
        ctx.fillText("You Cleared It!", 85, 160);
        return;
    }

    // draw
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, 300, 300);

    // draw paddle
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(bPaddleX, 275, bPaddleW, bPaddleH);

    // draw ball
    ctx.fillStyle = "#2ed573";
    ctx.beginPath();
    ctx.arc(bBallX, bBallY, 5, 0, Math.PI * 2);
    ctx.fill();

    // draw bricks
    for (var j = 0; j < bricks.length; j++) {
        var br = bricks[j];
        if (br.alive) {
            ctx.fillStyle = br.color;
            ctx.fillRect(br.x, br.y, br.w, br.h);
        }
    }
}


// ==========================================
// GAME 4: MEMORY MATCH (4x4 GRID)
// ==========================================
var memCards = [];
var memFirst = null;
var memLock = false;

function startMemory() {
    canvas.width = 300;
    canvas.height = 300;
    document.getElementById("help-text").innerText = "Click cards to flip and match pairs!";

    // 8 pairs = 16 cards
    var symbols = ["★", "♥", "♦", "♣", "▲", "●", "✦", "✖"];
    var deck = symbols.concat(symbols);

    // shuffle
    for (var i = deck.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = deck[i];
        deck[i] = deck[j];
        deck[j] = temp;
    }

    memCards = [];
    for (var k = 0; k < 16; k++) {
        memCards.push({
            sym: deck[k],
            open: false,
            matched: false
        });
    }

    memFirst = null;
    memLock = false;
    gameRunning = true;
    drawMemory();
}

function drawMemory() {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, 300, 300);

    for (var i = 0; i < 16; i++) {
        var col = i % 4;
        var row = Math.floor(i / 4);
        var x = 15 + col * 70;
        var y = 15 + row * 70;
        var card = memCards[i];

        if (card.matched) {
            // matched card: faded
            ctx.fillStyle = "#1e272e";
            ctx.fillRect(x, y, 60, 60);
            ctx.fillStyle = "#2ed573";
            ctx.font = "26px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(card.sym, x + 30, y + 30);
        } else if (card.open) {
            // flipped card
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(x, y, 60, 60);
            ctx.fillStyle = "#ff4757";
            ctx.font = "26px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(card.sym, x + 30, y + 30);
        } else {
            // face down card
            ctx.fillStyle = "#3742fa";
            ctx.fillRect(x, y, 60, 60);
            // card back detail
            ctx.strokeStyle = "#5352ed";
            ctx.strokeRect(x + 4, y + 4, 52, 52);
        }
    }
}

function clickMemory(mx, my) {
    if (!gameRunning || memLock) return;

    // find which card was clicked
    for (var i = 0; i < 16; i++) {
        var col = i % 4;
        var row = Math.floor(i / 4);
        var x = 15 + col * 70;
        var y = 15 + row * 70;

        if (mx >= x && mx <= x + 60 && my >= y && my <= y + 60) {
            var card = memCards[i];
            // fixed bug: clicking already opened or matched card counted twice!
            if (card.open || card.matched) return;

            card.open = true;
            drawMemory();

            if (memFirst === null) {
                memFirst = i;
            } else {
                // second card flipped
                var card1 = memCards[memFirst];
                var card2 = card;

                if (card1.sym === card2.sym) {
                    // MATCH!
                    card1.matched = true;
                    card2.matched = true;
                    memFirst = null;
                    score += 20;
                    document.getElementById("score").innerText = score;
                    saveBest("memory", score);
                    checkMemoryWin();
                } else {
                    // NOT A MATCH, flip back after 600ms
                    memLock = true;
                    setTimeout(function() {
                        card1.open = false;
                        card2.open = false;
                        memFirst = null;
                        memLock = false;
                        drawMemory();
                    }, 600);
                }
            }
            break;
        }
    }
}

function checkMemoryWin() {
    var win = true;
    for (var i = 0; i < 16; i++) {
        if (!memCards[i].matched) win = false;
    }
    if (win) {
        gameRunning = false;
        setTimeout(function() {
            alert("All pairs found! Great memory!");
        }, 100);
    }
}


// ==========================================
// GAME 5: MINESWEEPER MINI (6x6)
// ==========================================
var mineGrid = [];
var mineCount = 5;

function startMines() {
    canvas.width = 300;
    canvas.height = 300;
    document.getElementById("help-text").innerText = "Click squares to reveal. Avoid the 5 hidden mines!";

    mineGrid = [];
    for (var r = 0; r < 6; r++) {
        mineGrid[r] = [];
        for (var c = 0; c < 6; c++) {
            mineGrid[r][c] = {
                mine: false,
                revealed: false,
                count: 0
            };
        }
    }

    // place 5 mines randomly
    var placed = 0;
    while (placed < mineCount) {
        var rr = Math.floor(Math.random() * 6);
        var cc = Math.floor(Math.random() * 6);
        if (!mineGrid[rr][cc].mine) {
            mineGrid[rr][cc].mine = true;
            placed++;
        }
    }

    // count neighbor mines
    for (var row = 0; row < 6; row++) {
        for (var col = 0; col < 6; col++) {
            if (!mineGrid[row][col].mine) {
                var count = 0;
                for (var dr = -1; dr <= 1; dr++) {
                    for (var dc = -1; dc <= 1; dc++) {
                        var nr = row + dr;
                        var nc = col + dc;
                        if (nr >= 0 && nr < 6 && nc >= 0 && nc < 6) {
                            if (mineGrid[nr][nc].mine) count++;
                        }
                    }
                }
                mineGrid[row][col].count = count;
            }
        }
    }

    gameRunning = true;
    drawMines();
}

function drawMines() {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, 300, 300);

    for (var r = 0; r < 6; r++) {
        for (var c = 0; c < 6; c++) {
            var cell = mineGrid[r][c];
            var x = c * 50;
            var y = r * 50;

            if (cell.revealed) {
                if (cell.mine) {
                    ctx.fillStyle = "#ff4757";
                    ctx.fillRect(x + 1, y + 1, 48, 48);
                    ctx.fillStyle = "black";
                    ctx.font = "24px sans-serif";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText("💣", x + 25, y + 25);
                } else {
                    ctx.fillStyle = "#2f3542";
                    ctx.fillRect(x + 1, y + 1, 48, 48);
                    if (cell.count > 0) {
                        ctx.fillStyle = cell.count === 1 ? "#1e90ff" : (cell.count === 2 ? "#2ed573" : "#ffa502");
                        ctx.font = "bold 20px sans-serif";
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        ctx.fillText(cell.count, x + 25, y + 25);
                    }
                }
            } else {
                // unrevealed cell
                ctx.fillStyle = "#57606f";
                ctx.fillRect(x + 1, y + 1, 48, 48);
            }
        }
    }
}

function clickMines(mx, my) {
    if (!gameRunning) return;

    var col = Math.floor(mx / 50);
    var row = Math.floor(my / 50);

    if (row < 0 || row >= 6 || col < 0 || col >= 6) return;

    var cell = mineGrid[row][col];
    if (cell.revealed) return;

    // hit a mine!
    if (cell.mine) {
        gameRunning = false;
        // reveal all mines
        for (var r = 0; r < 6; r++) {
            for (var c = 0; c < 6; c++) {
                if (mineGrid[r][c].mine) mineGrid[r][c].revealed = true;
            }
        }
        drawMines();
        saveBest("mines", score);
        setTimeout(function() { alert("BOOM! You hit a mine!"); }, 50);
        return;
    }

    // reveal safe cell
    revealMineCell(row, col);
    drawMines();

    // check if all safe cells are revealed
    var won = true;
    for (var r2 = 0; r2 < 6; r2++) {
        for (var c2 = 0; c2 < 6; c2++) {
            if (!mineGrid[r2][c2].mine && !mineGrid[r2][c2].revealed) {
                won = false;
            }
        }
    }

    if (won) {
        gameRunning = false;
        score += 50;
        document.getElementById("score").innerText = score;
        saveBest("mines", score);
        setTimeout(function() { alert("Victory! You cleared the minefield!"); }, 50);
    }
}

// flood fill reveal empty cells
function revealMineCell(r, c) {
    if (r < 0 || r >= 6 || c < 0 || c >= 6) return;
    var cell = mineGrid[r][c];
    if (cell.revealed || cell.mine) return;

    cell.revealed = true;
    score += 5;
    document.getElementById("score").innerText = score;

    // if zero neighbors, reveal around it
    if (cell.count === 0) {
        for (var dr = -1; dr <= 1; dr++) {
            for (var dc = -1; dc <= 1; dc++) {
                revealMineCell(r + dr, c + dc);
            }
        }
    }
}


// ==========================================
// USER INPUTS (KEYBOARD & MOUSE)
// ==========================================
window.addEventListener("keydown", function(e) {
    // stop page scroll with arrows / space
    if ([32, 37, 38, 39, 40].indexOf(e.keyCode) > -1) {
        e.preventDefault();
    }

    // SNAKE
    if (currentGame === "snake" && gameRunning) {
        if ((e.key === "ArrowLeft" || e.key === "a") && snakeDir.x !== 1) nextSnakeDir = {x: -1, y: 0};
        if ((e.key === "ArrowRight" || e.key === "d") && snakeDir.x !== -1) nextSnakeDir = {x: 1, y: 0};
        if ((e.key === "ArrowUp" || e.key === "w") && snakeDir.y !== 1) nextSnakeDir = {x: 0, y: -1};
        if ((e.key === "ArrowDown" || e.key === "s") && snakeDir.y !== -1) nextSnakeDir = {x: 0, y: 1};
    }

    // TETRIS
    if (currentGame === "tetris" && gameRunning) {
        if (e.key === "ArrowLeft" || e.key === "a") {
            if (!tCollide(tPiece, tX - 1, tY)) { tX--; drawTetris(); }
        }
        if (e.key === "ArrowRight" || e.key === "d") {
            if (!tCollide(tPiece, tX + 1, tY)) { tX++; drawTetris(); }
        }
        if (e.key === "ArrowDown" || e.key === "s") {
            dropTetris();
        }
        if (e.key === "ArrowUp" || e.key === "w") {
            rotateTetris();
            drawTetris();
        }
    }

    // BREAKOUT
    if (currentGame === "breakout" && gameRunning) {
        if (e.key === "ArrowLeft" || e.key === "a") {
            bPaddleX -= 20;
            if (bPaddleX < 0) bPaddleX = 0;
        }
        if (e.key === "ArrowRight" || e.key === "d") {
            bPaddleX += 20;
            if (bPaddleX > 300 - bPaddleW) bPaddleX = 300 - bPaddleW;
        }
    }
});

// CANVAS CLICKS (MEMORY & MINESWEEPER)
canvas.addEventListener("mousedown", function(e) {
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;

    if (currentGame === "memory") clickMemory(mx, my);
    if (currentGame === "mines") clickMines(mx, my);
});

// BREAKOUT MOUSE MOVE
canvas.addEventListener("mousemove", function(e) {
    if (currentGame === "breakout" && gameRunning) {
        var rect = canvas.getBoundingClientRect();
        var mx = e.clientX - rect.left;
        bPaddleX = mx - bPaddleW / 2;
        if (bPaddleX < 0) bPaddleX = 0;
        if (bPaddleX > 300 - bPaddleW) bPaddleX = 300 - bPaddleW;
    }
});

// ==========================================
// RADIO ROOM LOG
// ==========================================
function startChat() {
    document.getElementById("help-text").innerText = "Radio room active. Any user can clear messages.";
    renderChat();
    setTimeout(function() {
        var inp = document.getElementById("chat-input");
        if (inp) inp.focus();
    }, 50);
}

// listen for live messages from all 4 computers
function initRadioListener() {
    if (db) {
        db.ref("radio_log").on("value", function(snap) {
            var data = snap.val();
            var list = [];
            if (data) {
                for (var id in data) {
                    list.push(data[id]);
                }
            }
            localStorage.setItem("radio_log", JSON.stringify(list));
            if (currentGame === "chat") {
                renderChat();
            }
        });
    }
}

function getChatMessages() {
    try {
        return JSON.parse(localStorage.getItem("radio_log") || "[]");
    } catch(e) {
        return [];
    }
}

function renderChat() {
    var box = document.getElementById("chat-messages");
    if (!box) return;
    var list = getChatMessages();

    if (list.length === 0) {
        box.innerHTML = "<div style='color: #666; font-style: italic;'>No transmissions yet...</div>";
        return;
    }

    var html = "";
    for (var i = 0; i < list.length; i++) {
        var msg = list[i];
        html += "<div class='chat-msg'>";
        html += "<span class='chat-sender'>" + escapeHTML(msg.sender) + ":</span> ";
        html += "<span class='chat-text'>" + escapeHTML(msg.text) + "</span>";
        html += "<span class='chat-time'>[" + escapeHTML(msg.time) + "]</span>";
        html += "</div>";
    }
    box.innerHTML = html;
    box.scrollTop = box.scrollHeight; // auto scroll
}

function sendChatMessage() {
    var inp = document.getElementById("chat-input");
    var val = inp.value.trim();
    if (val === "") return;

    var now = new Date();
    var timeStr = now.getHours() + ":" + (now.getMinutes() < 10 ? "0" : "") + now.getMinutes();

    var msg = {
        sender: currentUser,
        text: val,
        time: timeStr
    };

    if (db) {
        // pushes live to cloud across all computers
        db.ref("radio_log").push(msg);
    } else {
        var list = getChatMessages();
        list.push(msg);
        localStorage.setItem("radio_log", JSON.stringify(list));
        renderChat();
    }

    inp.value = "";
}

function clearChatLog() {
    if (confirm("Clear all radio transmissions?")) {
        if (db) {
            db.ref("radio_log").remove();
        }
        localStorage.removeItem("radio_log");
        renderChat();
    }
}

function escapeHTML(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// send on enter key
document.getElementById("chat-input").addEventListener("keydown", function(e) {
    if (e.key === "Enter") {
        sendChatMessage();
    }
});
