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
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      fetchGameState();
      canMove = false;
      playerColor = null;
    }
  });
}

function fetchGameState() {
  fetch('/game-state')
    .then(response => response.json())
    .then(data => {
      gameState = data;

      // Ensure that data.fen is a property, not a function
      if (typeof data.fen === 'string' && data.fen !== game.fen()) {
        game.load(data.fen); // Load the FEN string into the game object
        board.position(data.fen); // Set the board position using the FEN string
      }
      
      canMove = data.canMove;

      // Update player color
      if (data.playerPositions) {
        playerColor = data.playerPositions[player];
        if (playerColor) {
          board.orientation(playerColor);
        }
      }

      // Update regular timers
      if (data.timers) {
        updateTimerDisplay(data.timers.player1, data.timers.player2);
      }

      // Update guessing timers
      if (data.guessTimers) {
        updateGuessTimerDisplay(data.guessTimers.player1, data.guessTimers.player2);
      }

      // Update player guesses or other status
      if (data.playerGuesses) {
        updateStatus(data.playerGuesses);
      } else {
        updateStatus({});
      }
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

  // Display player timers
  player1TimerElement.textContent = `Player 1 Time: ${formatTime(player1Time)}`;
  player2TimerElement.textContent = `Player 2 Time: ${formatTime(player2Time)}`;
}

function updateGuessTimerDisplay(player1GuessTime, player2GuessTime) {
  const formatTime = (timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const player1GuessTimerElement = document.getElementById('player1-guess-timer');
  const player2GuessTimerElement = document.getElementById('player2-guess-timer');

  // Display player guess timers
  player1GuessTimerElement.textContent = `Player 1 Guess Timer: ${formatTime(player1GuessTime)}`;
  player2GuessTimerElement.textContent = `Player 2 Guess Timer: ${formatTime(player2GuessTime)}`;
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

  fetch('/submit-guess', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ player, guess: guessValue }),
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      console.log(`Player ${player} guessed: ${guessValue}`);
      if (data.result) {
        console.log(`Player 1 position: ${data.result.player1}`);
        console.log(`Player 2 position: ${data.result.player2}`);
        console.log(`Winner of the guessing round: ${data.result.winner}`);
        alert(`Player 1 is ${data.result.player1}, Player 2 is ${data.result.player2}. Winner of the guessing round: ${data.result.winner}`);
        canMove = data.result.canMove;
        playerColor = player === 'player1' ? data.result.player1 : data.result.player2;
        board.orientation(playerColor);
        updateStatus();
      } else {
        console.log('Waiting for other player to guess.');
      }
    } else {
      console.error('Error submitting guess:', data.error);
    }
  })
  .catch(error => console.error('Fetch error:', error));
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
