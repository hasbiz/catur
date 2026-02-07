// ===== Chess Game Logic =====

// Piece symbols
const PIECES = {
    white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
    black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' }
};

// Initial board setup
const INITIAL_BOARD = [
    ['br', 'bn', 'bb', 'bq', 'bk', 'bb', 'bn', 'br'],
    ['bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp'],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp'],
    ['wr', 'wn', 'wb', 'wq', 'wk', 'wb', 'wn', 'wr']
];

// Game state
let board = [];
let currentPlayer = 'white';
let selectedSquare = null;
let validMoves = [];
let moveHistory = [];
let capturedPieces = { white: [], black: [] };
let gameOver = false;
let lastMove = null;

// Castling rights
let castlingRights = {
    white: { kingSide: true, queenSide: true },
    black: { kingSide: true, queenSide: true }
};

// En passant target
let enPassantTarget = null;

// Initialize the game
function initGame() {
    board = JSON.parse(JSON.stringify(INITIAL_BOARD));
    currentPlayer = 'white';
    selectedSquare = null;
    validMoves = [];
    moveHistory = [];
    capturedPieces = { white: [], black: [] };
    gameOver = false;
    lastMove = null;
    castlingRights = {
        white: { kingSide: true, queenSide: true },
        black: { kingSide: true, queenSide: true }
    };
    enPassantTarget = null;

    renderBoard();
    updateStatus();
    updateCapturedPieces();
    updateTurnIndicator();
}

// Render the chess board
function renderBoard() {
    const boardElement = document.getElementById('chess-board');
    boardElement.innerHTML = '';

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            const isLight = (row + col) % 2 === 0;
            square.className = `square ${isLight ? 'light' : 'dark'}`;
            square.dataset.row = row;
            square.dataset.col = col;

            // Add piece
            const piece = board[row][col];
            if (piece) {
                const pieceElement = document.createElement('span');
                pieceElement.className = `piece ${piece[0] === 'w' ? 'white' : 'black'}`;
                pieceElement.textContent = getPieceSymbol(piece);
                square.appendChild(pieceElement);
            }

            // Highlight selected square
            if (selectedSquare && selectedSquare.row === row && selectedSquare.col === col) {
                square.classList.add('selected');
            }

            // Highlight valid moves
            if (validMoves.some(move => move.row === row && move.col === col)) {
                if (board[row][col]) {
                    square.classList.add('valid-capture');
                } else {
                    square.classList.add('valid-move');
                }
            }

            // Highlight last move
            if (lastMove) {
                if ((lastMove.from.row === row && lastMove.from.col === col) ||
                    (lastMove.to.row === row && lastMove.to.col === col)) {
                    square.classList.add('last-move');
                }
            }

            // Highlight check
            if (isKingInCheck(currentPlayer)) {
                const kingPos = findKing(currentPlayer);
                if (kingPos.row === row && kingPos.col === col) {
                    square.classList.add('check');
                }
            }

            square.addEventListener('click', () => handleSquareClick(row, col));
            boardElement.appendChild(square);
        }
    }
}

// Get piece symbol from code
function getPieceSymbol(pieceCode) {
    if (!pieceCode) return '';
    const color = pieceCode[0] === 'w' ? 'white' : 'black';
    const pieceType = {
        'k': 'king', 'q': 'queen', 'r': 'rook',
        'b': 'bishop', 'n': 'knight', 'p': 'pawn'
    }[pieceCode[1]];
    return PIECES[color][pieceType];
}

// Handle square click
function handleSquareClick(row, col) {
    if (gameOver) return;

    const piece = board[row][col];

    // If clicking on a valid move for selected piece
    if (selectedSquare && validMoves.some(move => move.row === row && move.col === col)) {
        makeMove(selectedSquare.row, selectedSquare.col, row, col);
        selectedSquare = null;
        validMoves = [];
        renderBoard();
        return;
    }

    // If clicking on own piece, select it
    if (piece && piece[0] === currentPlayer[0]) {
        selectedSquare = { row, col };
        validMoves = getValidMoves(row, col);
        renderBoard();
        return;
    }

    // Deselect
    selectedSquare = null;
    validMoves = [];
    renderBoard();
}

// Get valid moves for a piece
function getValidMoves(row, col) {
    const piece = board[row][col];
    if (!piece) return [];

    const color = piece[0] === 'w' ? 'white' : 'black';
    const pieceType = piece[1];
    let moves = [];

    switch (pieceType) {
        case 'p': moves = getPawnMoves(row, col, color); break;
        case 'r': moves = getRookMoves(row, col, color); break;
        case 'n': moves = getKnightMoves(row, col, color); break;
        case 'b': moves = getBishopMoves(row, col, color); break;
        case 'q': moves = getQueenMoves(row, col, color); break;
        case 'k': moves = getKingMoves(row, col, color); break;
    }

    // Filter out moves that would leave the king in check
    return moves.filter(move => !wouldBeInCheck(row, col, move.row, move.col, color));
}

// Pawn moves
function getPawnMoves(row, col, color) {
    const moves = [];
    const direction = color === 'white' ? -1 : 1;
    const startRow = color === 'white' ? 6 : 1;

    // Forward move
    if (isInBounds(row + direction, col) && !board[row + direction][col]) {
        moves.push({ row: row + direction, col });

        // Double move from start
        if (row === startRow && !board[row + 2 * direction][col]) {
            moves.push({ row: row + 2 * direction, col });
        }
    }

    // Captures
    for (const dc of [-1, 1]) {
        const newRow = row + direction;
        const newCol = col + dc;
        if (isInBounds(newRow, newCol)) {
            const target = board[newRow][newCol];
            if (target && target[0] !== color[0]) {
                moves.push({ row: newRow, col: newCol });
            }
            // En passant
            if (enPassantTarget && enPassantTarget.row === newRow && enPassantTarget.col === newCol) {
                moves.push({ row: newRow, col: newCol, enPassant: true });
            }
        }
    }

    return moves;
}

// Rook moves
function getRookMoves(row, col, color) {
    return getSlidingMoves(row, col, color, [[0, 1], [0, -1], [1, 0], [-1, 0]]);
}

// Bishop moves
function getBishopMoves(row, col, color) {
    return getSlidingMoves(row, col, color, [[1, 1], [1, -1], [-1, 1], [-1, -1]]);
}

// Queen moves
function getQueenMoves(row, col, color) {
    return [
        ...getRookMoves(row, col, color),
        ...getBishopMoves(row, col, color)
    ];
}

// Knight moves
function getKnightMoves(row, col, color) {
    const moves = [];
    const offsets = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1]
    ];

    for (const [dr, dc] of offsets) {
        const newRow = row + dr;
        const newCol = col + dc;
        if (isInBounds(newRow, newCol)) {
            const target = board[newRow][newCol];
            if (!target || target[0] !== color[0]) {
                moves.push({ row: newRow, col: newCol });
            }
        }
    }

    return moves;
}

// King moves
function getKingMoves(row, col, color) {
    const moves = [];
    const offsets = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1], [0, 1],
        [1, -1], [1, 0], [1, 1]
    ];

    for (const [dr, dc] of offsets) {
        const newRow = row + dr;
        const newCol = col + dc;
        if (isInBounds(newRow, newCol)) {
            const target = board[newRow][newCol];
            if (!target || target[0] !== color[0]) {
                moves.push({ row: newRow, col: newCol });
            }
        }
    }

    // Castling
    if (!isKingInCheck(color)) {
        const homeRow = color === 'white' ? 7 : 0;
        if (row === homeRow && col === 4) {
            // King side
            if (castlingRights[color].kingSide &&
                !board[homeRow][5] && !board[homeRow][6] &&
                board[homeRow][7] === color[0] + 'r' &&
                !isSquareAttacked(homeRow, 5, color) &&
                !isSquareAttacked(homeRow, 6, color)) {
                moves.push({ row: homeRow, col: 6, castling: 'kingSide' });
            }
            // Queen side
            if (castlingRights[color].queenSide &&
                !board[homeRow][1] && !board[homeRow][2] && !board[homeRow][3] &&
                board[homeRow][0] === color[0] + 'r' &&
                !isSquareAttacked(homeRow, 2, color) &&
                !isSquareAttacked(homeRow, 3, color)) {
                moves.push({ row: homeRow, col: 2, castling: 'queenSide' });
            }
        }
    }

    return moves;
}

// Get sliding piece moves (rook, bishop, queen)
function getSlidingMoves(row, col, color, directions) {
    const moves = [];

    for (const [dr, dc] of directions) {
        let newRow = row + dr;
        let newCol = col + dc;

        while (isInBounds(newRow, newCol)) {
            const target = board[newRow][newCol];
            if (!target) {
                moves.push({ row: newRow, col: newCol });
            } else {
                if (target[0] !== color[0]) {
                    moves.push({ row: newRow, col: newCol });
                }
                break;
            }
            newRow += dr;
            newCol += dc;
        }
    }

    return moves;
}

// Check if position is in bounds
function isInBounds(row, col) {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
}

// Find king position
function findKing(color) {
    const kingCode = color[0] + 'k';
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if (board[row][col] === kingCode) {
                return { row, col };
            }
        }
    }
    return null;
}

// Check if king is in check
function isKingInCheck(color) {
    const kingPos = findKing(color);
    if (!kingPos) return false;
    return isSquareAttacked(kingPos.row, kingPos.col, color);
}

// Check if a square is attacked by opponent
function isSquareAttacked(row, col, color) {
    const opponentColor = color === 'white' ? 'black' : 'white';

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && piece[0] === opponentColor[0]) {
                const pieceType = piece[1];
                let canAttack = false;

                switch (pieceType) {
                    case 'p':
                        const direction = opponentColor === 'white' ? -1 : 1;
                        canAttack = (r + direction === row) && (Math.abs(c - col) === 1);
                        break;
                    case 'r':
                        canAttack = canSlidingAttack(r, c, row, col, [[0, 1], [0, -1], [1, 0], [-1, 0]]);
                        break;
                    case 'n':
                        const dr = Math.abs(r - row);
                        const dc = Math.abs(c - col);
                        canAttack = (dr === 2 && dc === 1) || (dr === 1 && dc === 2);
                        break;
                    case 'b':
                        canAttack = canSlidingAttack(r, c, row, col, [[1, 1], [1, -1], [-1, 1], [-1, -1]]);
                        break;
                    case 'q':
                        canAttack = canSlidingAttack(r, c, row, col, [
                            [0, 1], [0, -1], [1, 0], [-1, 0],
                            [1, 1], [1, -1], [-1, 1], [-1, -1]
                        ]);
                        break;
                    case 'k':
                        canAttack = Math.abs(r - row) <= 1 && Math.abs(c - col) <= 1;
                        break;
                }

                if (canAttack) return true;
            }
        }
    }

    return false;
}

// Check if sliding piece can attack target
function canSlidingAttack(fromRow, fromCol, toRow, toCol, directions) {
    for (const [dr, dc] of directions) {
        let r = fromRow + dr;
        let c = fromCol + dc;

        while (isInBounds(r, c)) {
            if (r === toRow && c === toCol) return true;
            if (board[r][c]) break;
            r += dr;
            c += dc;
        }
    }
    return false;
}

// Check if move would leave king in check
function wouldBeInCheck(fromRow, fromCol, toRow, toCol, color) {
    // Save state
    const originalPiece = board[toRow][toCol];
    const movingPiece = board[fromRow][fromCol];

    // Make temporary move
    board[toRow][toCol] = movingPiece;
    board[fromRow][fromCol] = '';

    // Check for en passant capture
    let enPassantCaptured = null;
    if (movingPiece[1] === 'p' && enPassantTarget &&
        toRow === enPassantTarget.row && toCol === enPassantTarget.col) {
        const capturedRow = color === 'white' ? toRow + 1 : toRow - 1;
        enPassantCaptured = board[capturedRow][toCol];
        board[capturedRow][toCol] = '';
    }

    const inCheck = isKingInCheck(color);

    // Restore state
    board[fromRow][fromCol] = movingPiece;
    board[toRow][toCol] = originalPiece;

    if (enPassantCaptured !== null) {
        const capturedRow = color === 'white' ? toRow + 1 : toRow - 1;
        board[capturedRow][toCol] = enPassantCaptured;
    }

    return inCheck;
}

// Make a move
function makeMove(fromRow, fromCol, toRow, toCol) {
    const piece = board[fromRow][fromCol];
    const captured = board[toRow][toCol];
    const color = piece[0] === 'w' ? 'white' : 'black';

    // Save move to history
    moveHistory.push({
        from: { row: fromRow, col: fromCol },
        to: { row: toRow, col: toCol },
        piece: piece,
        captured: captured,
        castlingRights: JSON.parse(JSON.stringify(castlingRights)),
        enPassantTarget: enPassantTarget ? { ...enPassantTarget } : null
    });

    // Handle en passant capture
    if (piece[1] === 'p' && enPassantTarget &&
        toRow === enPassantTarget.row && toCol === enPassantTarget.col) {
        const capturedRow = color === 'white' ? toRow + 1 : toRow - 1;
        const capturedPawn = board[capturedRow][toCol];
        capturedPieces[color].push(capturedPawn);
        board[capturedRow][toCol] = '';
    }

    // Update en passant target
    enPassantTarget = null;
    if (piece[1] === 'p' && Math.abs(toRow - fromRow) === 2) {
        enPassantTarget = { row: (fromRow + toRow) / 2, col: fromCol };
    }

    // Handle castling
    const move = validMoves.find(m => m.row === toRow && m.col === toCol);
    if (move && move.castling) {
        const homeRow = color === 'white' ? 7 : 0;
        if (move.castling === 'kingSide') {
            board[homeRow][5] = board[homeRow][7];
            board[homeRow][7] = '';
        } else {
            board[homeRow][3] = board[homeRow][0];
            board[homeRow][0] = '';
        }
    }

    // Update castling rights
    if (piece[1] === 'k') {
        castlingRights[color].kingSide = false;
        castlingRights[color].queenSide = false;
    }
    if (piece[1] === 'r') {
        const homeRow = color === 'white' ? 7 : 0;
        if (fromRow === homeRow) {
            if (fromCol === 0) castlingRights[color].queenSide = false;
            if (fromCol === 7) castlingRights[color].kingSide = false;
        }
    }

    // Capture piece
    if (captured) {
        capturedPieces[color].push(captured);
    }

    // Move piece
    board[toRow][toCol] = piece;
    board[fromRow][fromCol] = '';

    // Handle pawn promotion
    const promotionRow = color === 'white' ? 0 : 7;
    if (piece[1] === 'p' && toRow === promotionRow) {
        showPromotionModal(toRow, toCol, color);
        return;
    }

    // Save last move
    lastMove = { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } };

    // Switch player
    switchPlayer();
}

// Show pawn promotion modal
function showPromotionModal(row, col, color) {
    const modal = document.getElementById('promotion-modal');
    const options = document.getElementById('promotion-options');
    options.innerHTML = '';

    const pieces = ['q', 'r', 'b', 'n'];
    const symbols = { q: 'queen', r: 'rook', b: 'bishop', n: 'knight' };

    for (const p of pieces) {
        const option = document.createElement('span');
        option.className = 'piece-option';
        option.textContent = PIECES[color][symbols[p]];
        option.addEventListener('click', () => {
            board[row][col] = color[0] + p;
            modal.classList.remove('active');
            lastMove = { from: selectedSquare, to: { row, col } };
            switchPlayer();
        });
        options.appendChild(option);
    }

    modal.classList.add('active');
}

// Switch player turn
function switchPlayer() {
    currentPlayer = currentPlayer === 'white' ? 'black' : 'white';
    updateStatus();
    updateCapturedPieces();
    updateTurnIndicator();
    renderBoard();

    // Check for checkmate or stalemate
    if (!hasLegalMoves(currentPlayer)) {
        if (isKingInCheck(currentPlayer)) {
            const winner = currentPlayer === 'white' ? 'Hitam' : 'Putih';
            updateStatus(`Skakmat! ${winner} Menang!`, 'checkmate');
        } else {
            updateStatus('Stalemate! Seri!', 'stalemate');
        }
        gameOver = true;
    }
}

// Check if player has legal moves
function hasLegalMoves(color) {
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece && piece[0] === color[0]) {
                const moves = getValidMoves(row, col);
                if (moves.length > 0) return true;
            }
        }
    }
    return false;
}

// Update game status display
function updateStatus(message = null, type = null) {
    const statusElement = document.getElementById('game-status');
    const statusText = statusElement.querySelector('.status-text');

    statusElement.className = 'game-status';

    if (message) {
        statusText.textContent = message;
        if (type) statusElement.classList.add(type);
    } else {
        const playerName = currentPlayer === 'white' ? 'Putih' : 'Hitam';
        if (isKingInCheck(currentPlayer)) {
            statusText.textContent = `Skak! Giliran: ${playerName}`;
            statusElement.classList.add('check');
        } else {
            statusText.textContent = `Giliran: ${playerName}`;
        }
    }
}

// Update captured pieces display
function updateCapturedPieces() {
    for (const color of ['white', 'black']) {
        const container = document.getElementById(`captured-by-${color}`);
        const list = container.querySelector('.pieces-list');
        list.innerHTML = '';

        for (const piece of capturedPieces[color]) {
            const span = document.createElement('span');
            span.className = 'captured-piece';
            span.textContent = getPieceSymbol(piece);
            list.appendChild(span);
        }
    }
}

// Update turn indicator
function updateTurnIndicator() {
    document.getElementById('white-turn').classList.toggle('active', currentPlayer === 'white');
    document.getElementById('black-turn').classList.toggle('active', currentPlayer === 'black');
}

// Undo last move
function undoMove() {
    if (moveHistory.length === 0) return;

    const lastAction = moveHistory.pop();

    // Restore piece
    board[lastAction.from.row][lastAction.from.col] = lastAction.piece;
    board[lastAction.to.row][lastAction.to.col] = lastAction.captured || '';

    // Restore castling rights
    castlingRights = lastAction.castlingRights;

    // Restore en passant target
    enPassantTarget = lastAction.enPassantTarget;

    // Handle castling undo
    const piece = lastAction.piece;
    const color = piece[0] === 'w' ? 'white' : 'black';
    if (piece[1] === 'k') {
        const homeRow = color === 'white' ? 7 : 0;
        if (lastAction.from.col === 4 && lastAction.to.col === 6) {
            board[homeRow][7] = board[homeRow][5];
            board[homeRow][5] = '';
        } else if (lastAction.from.col === 4 && lastAction.to.col === 2) {
            board[homeRow][0] = board[homeRow][3];
            board[homeRow][3] = '';
        }
    }

    // Handle en passant undo
    if (piece[1] === 'p' && !lastAction.captured &&
        Math.abs(lastAction.from.col - lastAction.to.col) === 1) {
        const capturedRow = color === 'white' ? lastAction.to.row + 1 : lastAction.to.row - 1;
        const opponentPawn = color === 'white' ? 'bp' : 'wp';
        board[capturedRow][lastAction.to.col] = opponentPawn;
        capturedPieces[color].pop();
    }

    // Remove captured piece from list
    if (lastAction.captured) {
        capturedPieces[color].pop();
    }

    // Switch back to previous player
    currentPlayer = currentPlayer === 'white' ? 'black' : 'white';
    gameOver = false;
    lastMove = moveHistory.length > 0 ? {
        from: moveHistory[moveHistory.length - 1].from,
        to: moveHistory[moveHistory.length - 1].to
    } : null;

    selectedSquare = null;
    validMoves = [];

    updateStatus();
    updateCapturedPieces();
    updateTurnIndicator();
    renderBoard();
}

// Event Listeners
document.getElementById('new-game-btn').addEventListener('click', initGame);
document.getElementById('undo-btn').addEventListener('click', undoMove);

// Initialize game on load
initGame();
