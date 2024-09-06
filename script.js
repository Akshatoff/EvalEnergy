const express = require('express');
const app = express();
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

let initialGameState = {
    fen: "1r1qkb1r/1bp2ppp/1n1ppn2/8/1P5P/P1PP1B2/3N1PP1/R1BQK2R w KQk - 0 1",
    moves: [],
    canMove: false,
    winningColor: 'black',
    guessTimers: {
        player1: 60, // 60 seconds for guessing
        player2: 60  // 60 seconds for guessing
    },
    timers: {
        player1: 180, // Initial time in seconds
        player2: 180,
    },
    activePlayer: null,
    timeOut: false,
    winner: null
};

let gameState = { ...initialGameState };

let guesses = [];
let players = {
    player1: { position: 'unset', guess: null },
    player2: { position: 'unset', guess: null },
};

// Decrement the guess timers every second
function decrementGuessTimers() {
    for (const player in gameState.guessTimers) {
        if (players[player].guess === null && gameState.guessTimers[player] > 0) {
            gameState.guessTimers[player] -= 1;

            if (gameState.guessTimers[player] <= 0) {
                // The other player wins if this player's guess timer reaches 0
                const otherPlayer = player === 'player1' ? 'player2' : 'player1';

                if (players[otherPlayer].guess !== null) {
                    gameState.winner = otherPlayer;
                    gameState.timeOut = true;
                    gameState.canMove = false;
                    return;
                }
            }
        }
    }
}

// Function to check if both players have guessed and start the game timer
function checkForBothGuesses() {
    if (players.player1.guess !== null && players.player2.guess !== null) {
        const eval = -2; // The actual evaluation
        const allGuesses = [
            { player: 'player1', guess: players.player1.guess },
            { player: 'player2', guess: players.player2.guess }
        ];
        const closestPlayer = allGuesses.reduce((prev, curr) =>
            Math.abs(curr.guess - eval) < Math.abs(prev.guess - eval) ? curr : prev
        );

        // Assign the winning position (black) to the winner of the guessing round
        players[closestPlayer.player].position = gameState.winningColor;
        const otherPlayer = closestPlayer.player === 'player1' ? 'player2' : 'player1';
        players[otherPlayer].position = gameState.winningColor === 'black' ? 'white' : 'black';

        // Set the game state to allow moves and assign the starting player
        gameState.canMove = true;
        gameState.activePlayer = closestPlayer.player; // The closest guesser starts the game

        // Start the game timers immediately after both guesses
        startGameTimers();

        console.log(`Player ${closestPlayer.player} starts the game.`);
    }
}

// Start the game timers for the active player
function startGameTimers() {
    if (gameState.activePlayer) {
        setInterval(decrementTimers, 1000); // Decrease the timer every second
    }
}

// Decrement the active player's timer
function decrementTimers() {
    if (gameState.activePlayer && gameState.canMove) {
        const player = gameState.activePlayer;
        gameState.timers[player] -= 1;

        if (gameState.timers[player] <= 0) {
            // End the game if the active player's time runs out
            gameState.canMove = false;
            gameState.winner = player === 'player1' ? 'player2' : 'player1'; // The other player wins
            gameState.timeOut = true; // Flag to indicate a timeout
            console.log(`Player ${gameState.winner} wins by timeout.`);
        }
    }
}

app.get('/game-state', (req, res) => {
    res.json({
        ...gameState,
        playerPositions: {
            player1: players.player1.position,
            player2: players.player2.position
        },
        playerGuesses: {
            player1: players.player1.guess,
            player2: players.player2.guess
        },
        timers: gameState.timers,
        guessTimers: gameState.guessTimers,
        timeOut: gameState.timeOut || false,
        winner: gameState.winner || null,
    });
});

app.post('/move', (req, res) => {
    if (!gameState.canMove) {
        return res.status(400).json({ success: false, error: 'Cannot move until both players have guessed' });
    }

    const move = req.body.move;
    const fen = req.body.fen;

    if (move) {
        gameState.moves.push(move);
        gameState.fen = fen;

        // Add the 2-second increment
        gameState.timers[gameState.activePlayer] += 2;

        // Switch the active player
        gameState.activePlayer = gameState.activePlayer === 'player1' ? 'player2' : 'player1';
    }

    res.json({ success: true });
});

app.post('/reset', (req, res) => {
    gameState = { ...initialGameState };
    guesses = [];
    players = {
        player1: { position: 'unset', guess: null },
        player2: { position: 'unset', guess: null },
    };
    res.json({ success: true });
});

app.post('/submit-guess', (req, res) => {
    const player = req.body.player;
    const guess = parseFloat(req.body.guess);

    if (player in players) {
        players[player].guess = guess;
        guesses.push({ player, guess });

        // Stop the guess timer for the player who submitted their guess
        gameState.guessTimers[player] = 0;

        // Check if both players have guessed
        checkForBothGuesses();

        res.json({ success: true });
    } else {
        res.status(400).json({ error: 'Invalid player' });
    }
});

setInterval(decrementGuessTimers, 1000); // Decrement the guess timer every second

app.listen(8080, () => {
    console.log('Server is running on http://localhost:8080');
});
