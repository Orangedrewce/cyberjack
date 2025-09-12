// ============================================================================
// --- 1. DOM ELEMENT REFERENCES ---
// ============================================================================
const bankrollEl = document.getElementById('bankroll');
const currentBetEl = document.getElementById('current-bet');
const dealerSumEl = document.getElementById('dealer-sum');
const dealerCardsEl = document.getElementById('dealer-cards');
const playerHandsContainer = document.getElementById('player-hands-container');
const messageTextEl = document.getElementById('message-text');
const dealBtn = document.getElementById('deal-btn');
const hitBtn = document.getElementById('hit-btn');
const standBtn = document.getElementById('stand-btn');
const doubleBtn = document.getElementById('double-btn');
const splitBtn = document.getElementById('split-btn');
const bettingControls = document.querySelector('.betting-controls');
const betControls = document.querySelector('.bet-controls');

// ============================================================================
// --- 2. GAME STATE & CONFIGURATION ---
// ============================================================================
const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

let state = {};

function resetGameState() {
    state = {
        deck: [],
        playerHands: [],
        dealerCards: [],
        dealerHiddenCard: null,
        currentHandIndex: 0,
        bankroll: state.bankroll === undefined ? 500 : state.bankroll,
        currentBet: 0,
        lastBet: state.lastBet || 0,
        gamePhase: 'betting', // 'betting', 'player-turn', 'hand-resolving', 'dealer-turn', 'end-round'
    };
}

// ============================================================================
// --- 3. CORE GAME LOGIC (PURE FUNCTIONS) ---
// ============================================================================

const getCardValue = (card) => {
    if (card.value === 'A') return 11;
    if (['J', 'Q', 'K'].includes(card.value)) return 10;
    return parseInt(card.value);
};

const getHandSum = (cards) => {
    let sum = cards.reduce((acc, card) => acc + getCardValue(card), 0);
    let aces = cards.filter(card => card.value === 'A').length;
    while (sum > 21 && aces > 0) {
        sum -= 10;
        aces--;
    }
    return sum;
};

const createDeck = () => SUITS.flatMap(suit => VALUES.map(value => ({ value, suit })));

const shuffleDeck = (deck) => {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
};

const delay = (ms) => new Promise(res => setTimeout(res, ms));


// ============================================================================
// --- 4. UI & DISPLAY FUNCTIONS (ALL DOM MANIPULATION HERE) ---
// ============================================================================

function createCardElement(card, isHidden = false) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    if (isHidden) {
        cardEl.classList.add('back');
    } else {
        const isRed = ['♥', '♦'].includes(card.suit);
        cardEl.classList.add(isRed ? 'red' : 'black');
        cardEl.innerHTML = `
            <div class="rank">${card.value}</div>
            <div class="suit">${card.suit}</div>
        `;
    }
    return cardEl;
}

function updateUI() {
    bankrollEl.textContent = state.bankroll;
    currentBetEl.textContent = state.currentBet;

    dealerCardsEl.innerHTML = '';
    state.dealerCards.forEach(card => dealerCardsEl.appendChild(createCardElement(card)));
    if (state.dealerHiddenCard) {
        dealerCardsEl.appendChild(createCardElement(state.dealerHiddenCard, true));
    }
    dealerSumEl.textContent = state.gamePhase === 'player-turn' ? getHandSum(state.dealerCards) : getHandSum([...state.dealerCards, ...(state.dealerHiddenCard ? [state.dealerHiddenCard] : [])]);

    playerHandsContainer.innerHTML = '';
    state.playerHands.forEach((hand, index) => {
        let handWrapper = document.createElement('div');
        handWrapper.className = 'hand-section player-hand panel';
        handWrapper.id = `player-hand-wrapper-${index}`;
        playerHandsContainer.appendChild(handWrapper);

        handWrapper.innerHTML = `
            <h2 class="section-title">Hand ${index + 1}</h2>
            <div class="bet-display">Bet: $${hand.bet}</div>
            <div class="sum-display">Sum: <span>${getHandSum(hand.cards)}</span></div>
            <div id="player-cards-${index}" class="cards-container"></div>
        `;
        
        const cardsContainer = handWrapper.querySelector(`#player-cards-${index}`);
        hand.cards.forEach(card => cardsContainer.appendChild(createCardElement(card)));

        handWrapper.classList.toggle('active-hand', index === state.currentHandIndex && state.gamePhase === 'player-turn');
    });

    const inBettingPhase = state.gamePhase === 'betting';
    bettingControls.style.display = inBettingPhase ? 'flex' : 'none';
    betControls.style.display = inBettingPhase ? 'flex' : 'none';
    dealBtn.disabled = !inBettingPhase || state.currentBet === 0;

    const playerCanPlay = state.gamePhase === 'player-turn';
    hitBtn.disabled = !playerCanPlay;
    standBtn.disabled = !playerCanPlay;

    const currentHand = state.playerHands[state.currentHandIndex];
    const canDouble = playerCanPlay && currentHand?.cards.length === 2 && state.bankroll >= currentHand.bet;
    const canSplit = playerCanPlay && currentHand?.cards.length === 2 && getCardValue(currentHand.cards[0]) === getCardValue(currentHand.cards[1]) && state.bankroll >= currentHand.bet;
    
    doubleBtn.disabled = !canDouble;
    splitBtn.disabled = !canSplit;
}

function displayMessage(text, type = 'info') {
    messageTextEl.textContent = text;
    messageTextEl.parentElement.className = `panel message-panel message-${type}`;
}


// ============================================================================
// --- 5. GAME ACTIONS & CONTROL FLOW ---
// ============================================================================

async function deal() {
    if (state.currentBet === 0 || state.currentBet > state.bankroll) {
        displayMessage("Invalid bet amount.");
        return;
    }

    state.gamePhase = 'player-turn';
    state.bankroll -= state.currentBet;
    state.lastBet = state.currentBet;
    
    if (state.deck.length < 52) {
        displayMessage("Shuffling new deck...");
        await delay(500);
        state.deck = shuffleDeck(createDeck());
    }

    state.playerHands = [{ cards: [], bet: state.currentBet }];
    state.dealerCards = [];
    state.currentHandIndex = 0;

    updateUI();

    await delay(400); state.playerHands[0].cards.push(state.deck.pop()); updateUI();
    await delay(400); state.dealerCards.push(state.deck.pop()); updateUI();
    await delay(400); state.playerHands[0].cards.push(state.deck.pop()); updateUI();
    await delay(400); state.dealerHiddenCard = state.deck.pop(); updateUI();

    if (getHandSum(state.playerHands[0].cards) === 21) {
        displayMessage("🎉 Blackjack!", "win");
        await delay(1500);
        startDealerTurn();
    } else {
        displayMessage(`Playing Hand 1. Hit or Stand?`);
    }
}

async function hit() {
    if (state.gamePhase !== 'player-turn') return;

    const hand = state.playerHands[state.currentHandIndex];
    hand.cards.push(state.deck.pop());
    
    const sum = getHandSum(hand.cards);
    if (sum >= 21) {
        state.gamePhase = 'hand-resolving'; // BUG FIX: Immediately change phase
        updateUI(); // This disables the buttons instantly
        if (sum > 21) displayMessage(`Hand ${state.currentHandIndex + 1} busts!`);
        await delay(1500);
        moveToNextHand();
    } else {
        updateUI(); // Normal update if no bust
    }
}

async function stand() {
    if (state.gamePhase !== 'player-turn') return;
    moveToNextHand();
}

async function doubleDown() {
    if (state.gamePhase !== 'player-turn') return;
    
    const hand = state.playerHands[state.currentHandIndex];
    if (state.bankroll < hand.bet) {
        displayMessage("Not enough funds to double down.");
        return;
    }
    
    state.bankroll -= hand.bet;
    hand.bet *= 2;
    hand.cards.push(state.deck.pop());
    
    state.gamePhase = 'hand-resolving'; // Also disable buttons after doubling
    updateUI();

    await delay(1500);
    if (getHandSum(hand.cards) > 21) displayMessage(`Doubled down and busted!`);
    moveToNextHand();
}

async function split() {
    if (state.gamePhase !== 'player-turn') return;

    const hand = state.playerHands[state.currentHandIndex];
    if (state.bankroll < hand.bet) {
        displayMessage("Not enough funds to split.");
        return;
    }
    
    state.bankroll -= hand.bet;
    const secondCard = hand.cards.pop();
    const newHand = { cards: [secondCard], bet: hand.bet };
    
    state.playerHands.splice(state.currentHandIndex + 1, 0, newHand);

    hand.cards.push(state.deck.pop());
    newHand.cards.push(state.deck.pop());
    
    updateUI();
}

function moveToNextHand() {
    if (state.currentHandIndex < state.playerHands.length - 1) {
        state.currentHandIndex++;
        state.gamePhase = 'player-turn'; // Return to player turn for the next hand
        displayMessage(`Playing Hand ${state.currentHandIndex + 1}. Hit or Stand?`);
        updateUI();
    } else {
        startDealerTurn();
    }
}

async function startDealerTurn() {
    state.gamePhase = 'dealer-turn';
    updateUI(); // Hides player buttons
    
    if (state.dealerHiddenCard) {
        state.dealerCards.push(state.dealerHiddenCard);
        state.dealerHiddenCard = null;
        updateUI();
        await delay(800);
    }

    while (getHandSum(state.dealerCards) < 17) {
        state.dealerCards.push(state.deck.pop());
        updateUI();
        await delay(800);
    }
    
    endRound();
}

function endRound() {
    state.gamePhase = 'end-round';
    const dealerSum = getHandSum(state.dealerCards);
    const houseEdge = parseFloat(document.getElementById('house-edge').value) / 100 || 0;
    let totalWinnings = 0;
    let finalMessage = "";

    state.playerHands.forEach((hand, index) => {
        const playerSum = getHandSum(hand.cards);
        let handResult = `Hand ${index + 1}: `;

        if (playerSum > 21) {
            handResult += `Busts (-$${hand.bet}). `;
            // Bankroll was already reduced when the bet was placed
        } else if (dealerSum > 21 || playerSum > dealerSum) {
            const isBlackjack = playerSum === 21 && hand.cards.length === 2;
            const payout = isBlackjack ? hand.bet * 1.5 : hand.bet;
            const winAmount = Math.round(payout * (1 - houseEdge));
            state.bankroll += hand.bet + winAmount;
            totalWinnings += winAmount;
            handResult += `${isBlackjack ? 'Blackjack! Wins' : 'Wins'} (+$${winAmount})! `;
        } else if (playerSum < dealerSum) {
            handResult += `Loses (-$${hand.bet}). `;
        } else {
            handResult += `Push. `;
            state.bankroll += hand.bet;
        }
        finalMessage += handResult;
    });

    displayMessage(finalMessage, totalWinnings > 0 ? "win" : totalWinnings < 0 ? "lose" : "tie");

    setTimeout(() => {
        if (state.bankroll <= 0) {
            displayMessage("💔 Game Over! Refresh to restart.", "lose");
        } else {
            state.gamePhase = 'betting';
            state.currentBet = 0;
            updateUI();
            displayMessage("Place your bet for the next round.");
        }
    }, 3500);
}


// ============================================================================
// --- 6. EVENT LISTENERS & INITIALIZATION ---
// ============================================================================

function setupEventListeners() {
    bettingControls.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip-btn');
        if (chip) {
            const value = parseInt(chip.dataset.value);
            if (state.currentBet + value <= state.bankroll) {
                state.currentBet += value;
                updateUI();
                animateChip(chip);
            }
        }
    });

    betControls.addEventListener('click', (e) => {
        if (e.target.textContent === 'Clear') state.currentBet = 0;
        if (e.target.textContent === 'Max') state.currentBet = state.bankroll;
        if (e.target.textContent === 'Repeat' && state.lastBet <= state.bankroll) state.currentBet = state.lastBet;
        updateUI();
    });

    dealBtn.addEventListener('click', deal);
    hitBtn.addEventListener('click', hit);
    standBtn.addEventListener('click', stand);
    doubleBtn.addEventListener('click', doubleDown);
    splitBtn.addEventListener('click', split);
}

function animateChip(chip) {
    const startRect = chip.getBoundingClientRect();
    const endRect = currentBetEl.getBoundingClientRect();
    
    const clone = chip.cloneNode(true);
    clone.classList.add('chip-clone');
    document.body.appendChild(clone);
    
    clone.style.top = `${startRect.top}px`;
    clone.style.left = `${startRect.left}px`;

    const translateX = endRect.left - startRect.left + (endRect.width / 2) - (startRect.width / 2);
    const translateY = endRect.top - startRect.top + (endRect.height / 2) - (startRect.height / 2);

    setTimeout(() => {
        clone.style.transform = `translate(${translateX}px, ${translateY}px) scale(0.5)`;
        clone.style.opacity = '0';
    }, 10);

    clone.addEventListener('transitionend', () => clone.remove());
}

document.addEventListener('DOMContentLoaded', () => {
    resetGameState();
    state.deck = shuffleDeck(createDeck());
    setupEventListeners();
    updateUI();
});

