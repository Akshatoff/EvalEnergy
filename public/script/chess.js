const submitButton = document.getElementById("evals");
const input = document.getElementById("eg");
const win = document.getElementById("winner");
let player = prompt("Enter your player ID (e.g., player1 or player2):");
let game = new Chess();
let canMove = false;
let playerColor = null;
let gameState = {}; // Initialize gameState as an empty object

let boardConfig = {
  draggable: true,
  position: game.fen(),
  onDragStart,
  onDrop,
};

let board = Chessboard2('myBoard', boardConfig);

// Increase the frequency of state updates
setInterval(fetchGameState, 1000);

resetGameState();

window.addEventListener('beforeunload', resetGameState);

submitButton.addEventListener("click", submitGuess);
function resetGameState() {
  fetch('/reset', {
    method: 'POST',
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    if (data.success) {
      gameState = data.gameState;
      canMove = false;
      playerColor = null;
      game.reset();
      board.start();
      input.value = '';
      input.disabled = false;
      submitButton.disabled = false;
      win.innerHTML = 'Game reset. Waiting for both players to guess...';
      updateTimerDisplay(gameState.timers.player1, gameState.timers.player2);
      updateGuessTimerDisplay(gameState.guessTimers.player1, gameState.guessTimers.player2);
    } else {
      throw new Error('Failed to reset game state');
    }
  })
  .catch(error => {
    console.error('Error resetting game state:', error);
    win.innerHTML = 'Error resetting game state. Please try again.';
  });
}


window.addEventListener('load', resetGameState);

const resetButton = document.createElement('button');
resetButton.textContent = 'Reset Game';
resetButton.addEventListener('click', resetGameState);
document.body.appendChild(resetButton);
resetButton.style.display = 'none';

function fetchGameState() {
  fetch('/game-state')
    .then(response => response.json())
    .then(data => {
      gameState = data;

      if (typeof data.fen === 'string' && data.fen !== game.fen()) {
        game.load(data.fen);
        board.position(data.fen);
      }
      
      canMove = data.canMove;

      if (data.playerPositions) {
        playerColor = data.playerPositions[player];
        if (playerColor) {
          board.orientation(playerColor);
        }
      }

      if (data.timers) {
        updateTimerDisplay(data.timers.player1, data.timers.player2);
      }

      if (data.guessTimers) {
        updateGuessTimerDisplay(data.guessTimers.player1, data.guessTimers.player2);
      }

      updateStatus(data.playerGuesses || {});
    })
    .catch(error => console.error('Fetch error:', error));
}


function updateTimerDisplay(player1Time, player2Time) {
  const formatTime = (timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const player1TimerElement = document.getElementById('player1-timer');
  const player2TimerElement = document.getElementById('player2-timer');

  if (player1TimerElement && player2TimerElement) {
    player1TimerElement.textContent = `Player 1 Time: ${formatTime(player1Time)}`;
    player2TimerElement.textContent = `Player 2 Time: ${formatTime(player2Time)}`;
  }
}

function updateGuessTimerDisplay(player1GuessTime, player2GuessTime) {
  const formatTime = (timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const player1GuessTimerElement = document.getElementById('player1-guess-timer');
  const player2GuessTimerElement = document.getElementById('player2-guess-timer');

  if (player1GuessTimerElement && player2GuessTimerElement) {
    player1GuessTimerElement.textContent = `Player 1 Guess Timer: ${formatTime(player1GuessTime)}`;
    player2GuessTimerElement.textContent = `Player 2 Guess Timer: ${formatTime(player2GuessTime)}`;
  }
}

function onDragStart(dragStartEvt) {
  board.clearCircles();
  if (!canMove) return false;

  const piece = game.get(dragStartEvt.square);

  // Check if the piece belongs to the player
  if (!piece || piece.color !== playerColor[0]) {
    return false; // Prevent dragging the piece
  }

  const legalMoves = game.moves({
    square: dragStartEvt.square,
    verbose: true,
  });

  legalMoves.forEach((move) => {
    board.addCircle(move.to);
  });
}

function onDrop(dropEvt) {
  if (!canMove) return 'snapback';

  const move = game.move({
    from: dropEvt.source,
    to: dropEvt.target,
    promotion: 'q',
  });

  if (!move) {
    return 'snapback';
  }

  // Check if the move is made by the correct color
  if (move.color !== playerColor[0]) {
    game.undo();
    return 'snapback';
  }

  board.clearCircles();

  const gameState = {
    move: move,
    fen: game.fen(),
  };

  fetch('/move', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(gameState),
  }).then(response => response.json())
    .then(data => {
      if (data.success) {
        board.position(game.fen());
        updateStatus();
      } else {
        console.error('Error making move:', data.error);
        game.undo();
        return 'snapback';
      }
    });
}

function submitGuess() {
  const guessValue = input.value;

  if (!guessValue || isNaN(parseFloat(guessValue))) {
    alert('Please enter a valid number for your guess.');
    return;
  }

  fetch('/submit-guess', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ player, guess: parseFloat(guessValue) }),
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    if (data.success) {
      console.log(`Player ${player} guessed: ${guessValue}`);
      win.innerHTML = `Your guess (${guessValue}) has been submitted. Waiting for the other player...`;
      input.value = ''; // Clear the input field
      input.disabled = true; // Disable the input field after submission
      submitButton.disabled = true; // Disable the submit button after submission
    } else {
      console.error('Error submitting guess:', data.error);
      win.innerHTML = `Error submitting guess: ${data.error}`;
    }
  })
  .catch(error => {
    console.error('Fetch error:', error);
    win.innerHTML = `Error submitting guess: ${error.message}`;
  });
}


function updateStatus(playerGuesses = {}) {
    if (!canMove) {
        if (gameState.timeOut) {
            win.innerHTML = `${gameState.winner} wins by timeout!`;
        } else if (playerGuesses[player] === Number.NEGATIVE_INFINITY) {
            win.innerHTML = "You missed your guess!";
        } else {
            win.innerHTML = "Waiting for both players to guess...";
        }
    } else if (!game.game_over()) {
        const currentTurn = game.turn() === 'w' ? 'white' : 'black';
        if (currentTurn === playerColor) {
            win.innerHTML = `Both players have guessed. You are playing as ${playerColor}. It's your turn!`;
        } else {
            win.innerHTML = `Both players have guessed. You are playing as ${playerColor}. Waiting for opponent's move...`;
        }
    } else {
        // Handle endgame scenarios
        if (game.in_checkmate()) {
            win.innerHTML = `${game.turn() === 'w' ? "Black" : "White"} wins by checkmate!`;
        } else if (game.in_stalemate()) {
            win.innerHTML = 'Game is drawn by stalemate.';
        } else if (game.in_threefold_repetition()) {
            win.innerHTML = 'Game is drawn by threefold repetition rule.';
        } else if (game.insufficient_material()) {
            win.innerHTML = 'Game is drawn by insufficient material.';
        } else if (game.in_draw()) {
            win.innerHTML = 'Game is drawn by fifty-move rule.';
        } else {
            win.innerHTML = 'Game is over.';
        }
    }
}