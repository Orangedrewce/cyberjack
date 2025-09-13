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
        gamePhase: 'betting', // 'betting', 'player-turn', 'dealer-turn', 'end-round'
        handFinished: false, // Track if current hand is done
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

    // Update dealer display
    dealerCardsEl.innerHTML = '';
    state.dealerCards.forEach(card => dealerCardsEl.appendChild(createCardElement(card)));
    if (state.dealerHiddenCard) {
        dealerCardsEl.appendChild(createCardElement(state.dealerHiddenCard, true));
    }
    
    // Always show the sum of VISIBLE cards. The sum will update automatically
    // when the hidden card is revealed and moved to the dealerCards array.
    dealerSumEl.textContent = getHandSum(state.dealerCards);

    // Update player hands
    playerHandsContainer.innerHTML = '';
    state.playerHands.forEach((hand, index) => {
        let handWrapper = document.createElement('div');
        handWrapper.className = 'hand-section player-hand panel';
        handWrapper.id = `player-hand-wrapper-${index}`;
        playerHandsContainer.appendChild(handWrapper);

        const handSum = getHandSum(hand.cards);
        const statusText = hand.finished ? (handSum > 21 ? ' (BUST)' : ' (STAND)') : '';

        handWrapper.innerHTML = `
            <h2 class="section-title">Hand ${index + 1}${statusText}</h2>
            <div class="bet-display">Bet: $${hand.bet}</div>
            <div class="sum-display">Sum: <span>${handSum}</span></div>
            <div id="player-cards-${index}" class="cards-container"></div>
        `;
        
        const cardsContainer = handWrapper.querySelector(`#player-cards-${index}`);
        hand.cards.forEach(card => cardsContainer.appendChild(createCardElement(card)));

        // Only highlight active hand if it's not finished
        handWrapper.classList.toggle('active-hand', 
            index === state.currentHandIndex && 
            state.gamePhase === 'player-turn' && 
            !hand.finished
        );
    });

    // Update button states
    const inBettingPhase = state.gamePhase === 'betting';
    bettingControls.style.display = inBettingPhase ? 'flex' : 'none';
    betControls.style.display = inBettingPhase ? 'flex' : 'none';
    dealBtn.disabled = !inBettingPhase || state.currentBet === 0;

    const currentHand = state.playerHands[state.currentHandIndex];
    const playerCanPlay = state.gamePhase === 'player-turn' && currentHand && !currentHand.finished;
    
    hitBtn.disabled = !playerCanPlay;
    standBtn.disabled = !playerCanPlay;

    const canDouble = playerCanPlay && 
                     currentHand?.cards.length === 2 && 
                     state.bankroll >= currentHand.bet;
    
    const canSplit = playerCanPlay && 
                    currentHand?.cards.length === 2 && 
                    getCardValue(currentHand.cards[0]) === getCardValue(currentHand.cards[1]) && 
                    state.bankroll >= currentHand.bet &&
                    state.playerHands.length < 4; // Limit splits
    
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
    
    // Shuffle new deck if needed
    if (state.deck.length < 20) { // More cards needed for splits
        displayMessage("Shuffling new deck...");
        await delay(500);
        state.deck = shuffleDeck(createDeck());
    }

    // Initialize game state
    state.playerHands = [{ cards: [], bet: state.currentBet, finished: false }];
    state.dealerCards = [];
    state.dealerHiddenCard = null;
    state.currentHandIndex = 0;

    updateUI();

    // Deal cards with animation
    await delay(400); state.playerHands[0].cards.push(state.deck.pop()); updateUI();
    await delay(400); state.dealerCards.push(state.deck.pop()); updateUI();
    await delay(400); state.playerHands[0].cards.push(state.deck.pop()); updateUI();
    await delay(400); state.dealerHiddenCard = state.deck.pop(); updateUI();

    // Check for player blackjack
    if (getHandSum(state.playerHands[0].cards) === 21) {
        displayMessage("🎉 Blackjack!", "win");
        state.playerHands[0].finished = true;
        updateUI();
        await delay(1500);
        startDealerTurn();
    } else {
        displayMessage(`Playing Hand 1. Hit or Stand?`);
    }
}

async function hit() {
    if (state.gamePhase !== 'player-turn') return;

    const hand = state.playerHands[state.currentHandIndex];
    if (hand.finished) return;

    await delay(400);
    hand.cards.push(state.deck.pop());
    updateUI();
    
    const sum = getHandSum(hand.cards);
    if (sum >= 21) {
        hand.finished = true;
        updateUI();
        
        if (sum > 21) {
            displayMessage(`Hand ${state.currentHandIndex + 1} busts!`, "lose");
        } else {
            displayMessage(`Hand ${state.currentHandIndex + 1} gets 21!`, "win");
        }
        
        await delay(1500);
        moveToNextHand();
    }
}

async function stand() {
    if (state.gamePhase !== 'player-turn') return;
    
    const hand = state.playerHands[state.currentHandIndex];
    if (hand.finished) return;
    
    hand.finished = true;
    updateUI();
    displayMessage(`Hand ${state.currentHandIndex + 1} stands on ${getHandSum(hand.cards)}.`);
    await delay(1000);
    moveToNextHand();
}

async function doubleDown() {
    if (state.gamePhase !== 'player-turn') return;
    
    const hand = state.playerHands[state.currentHandIndex];
    if (hand.finished || state.bankroll < hand.bet || hand.cards.length !== 2) {
        displayMessage("Cannot double down.");
        return;
    }
    
    state.bankroll -= hand.bet;
    hand.bet *= 2;
    
    await delay(400);
    hand.cards.push(state.deck.pop());
    hand.finished = true; // Automatically stand after doubling
    
    updateUI();
    
    const sum = getHandSum(hand.cards);
    if (sum > 21) {
        displayMessage(`Doubled down and busted with ${sum}!`, "lose");
    } else {
        displayMessage(`Doubled down and got ${sum}.`);
    }
    
    await delay(1500);
    moveToNextHand();
}

async function split() {
    if (state.gamePhase !== 'player-turn') return;

    const hand = state.playerHands[state.currentHandIndex];
    if (hand.finished || 
        state.bankroll < hand.bet || 
        hand.cards.length !== 2 ||
        getCardValue(hand.cards[0]) !== getCardValue(hand.cards[1]) ||
        state.playerHands.length >= 4) {
        displayMessage("Cannot split.");
        return;
    }
    
    state.bankroll -= hand.bet;
    
    // Create new hand with the second card
    const secondCard = hand.cards.pop();
    const newHand = { cards: [secondCard], bet: hand.bet, finished: false };
    
    // Insert new hand after current hand
    state.playerHands.splice(state.currentHandIndex + 1, 0, newHand);

    // Deal new cards to both hands with animation
    await delay(400);
    hand.cards.push(state.deck.pop());
    updateUI();

    await delay(400);
    newHand.cards.push(state.deck.pop());
    
    displayMessage(`Split into ${state.playerHands.length} hands. Playing Hand ${state.currentHandIndex + 1}.`);
    updateUI();
}

function moveToNextHand() {
    // Find next unfinished hand
    let nextHandIndex = state.currentHandIndex + 1;
    
    while (nextHandIndex < state.playerHands.length && state.playerHands[nextHandIndex].finished) {
        nextHandIndex++;
    }
    
    if (nextHandIndex < state.playerHands.length) {
        state.currentHandIndex = nextHandIndex;
        displayMessage(`Playing Hand ${state.currentHandIndex + 1}. Hit or Stand?`);
        updateUI();
    } else {
        // All hands finished
        startDealerTurn();
    }
}

async function startDealerTurn() {
    state.gamePhase = 'dealer-turn';
    updateUI();
    
    // Check if all player hands busted
    const allHandsBusted = state.playerHands.every(hand => getHandSum(hand.cards) > 21);
    
    if (allHandsBusted) {
        displayMessage("All hands busted. Dealer wins.", "lose");
        await delay(2000);
        endRound();
        return;
    }
    
    // Reveal hidden card
    if (state.dealerHiddenCard) {
        displayMessage("Dealer reveals hidden card...");
        await delay(1000);
        state.dealerCards.push(state.dealerHiddenCard);
        state.dealerHiddenCard = null;
        updateUI();
        await delay(800);
    }

    // Dealer must hit until 17
    while (getHandSum(state.dealerCards) < 17) {
        displayMessage(`Dealer has ${getHandSum(state.dealerCards)}, must hit...`);
        await delay(800);
        state.dealerCards.push(state.deck.pop());
        updateUI();
        await delay(800);
    }
    
    const finalSum = getHandSum(state.dealerCards);
    if (finalSum > 21) {
        displayMessage(`Dealer busts with ${finalSum}!`, "win");
    } else {
        displayMessage(`Dealer stands on ${finalSum}.`);
    }
    
    await delay(1500);
    endRound();
}

function endRound() {
    state.gamePhase = 'end-round';
    const dealerSum = getHandSum(state.dealerCards);
    const houseEdge = parseFloat(document.getElementById('house-edge')?.value || 0) / 100;
    let totalWinnings = 0;
    let finalMessage = "";

    state.playerHands.forEach((hand, index) => {
        const playerSum = getHandSum(hand.cards);
        let handResult = `Hand ${index + 1}: `;

        if (playerSum > 21) {
            // Bust - already lost bet
            handResult += `Busts (-$${hand.bet})`;
        } else if (dealerSum > 21 || playerSum > dealerSum) {
            // Player wins
            const isBlackjack = playerSum === 21 && hand.cards.length === 2 && state.playerHands.length === 1;
            const payout = isBlackjack ? hand.bet * 1.5 : hand.bet;
            const winAmount = Math.round(payout * (1 - houseEdge));
            state.bankroll += hand.bet + winAmount; // Return bet plus winnings
            totalWinnings += winAmount;
            handResult += `${isBlackjack ? 'Blackjack! Wins' : 'Wins'} (+$${winAmount})`;
        } else if (playerSum < dealerSum) {
            // Player loses - already lost bet
            handResult += `Loses (-$${hand.bet})`;
        } else {
            // Push - return bet
            handResult += `Push (bet returned)`;
            state.bankroll += hand.bet;
        }
        
        finalMessage += handResult + (index < state.playerHands.length - 1 ? " | " : "");
    });

    const messageType = totalWinnings > 0 ? "win" : (totalWinnings < 0 ? "lose" : "tie");
    displayMessage(finalMessage, messageType);

    setTimeout(() => {
        if (state.bankroll <= 0) {
            displayMessage("💔 Game Over! Refresh to restart.", "lose");
        } else {
            state.gamePhase = 'betting';
            state.currentBet = 0;
            updateUI();
            displayMessage("Place your bet for the next round.");
        }
    }, 4000);
}

// ============================================================================
// --- 6. EVENT LISTENERS & INITIALIZATION ---
// ============================================================================

function setupEventListeners() {
    bettingControls.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip-btn');
        if (chip && state.gamePhase === 'betting') {
            const value = parseInt(chip.dataset.value);
            if (state.currentBet + value <= state.bankroll) {
                state.currentBet += value;
                updateUI();
                animateChip(chip);
            }
        }
    });

    betControls.addEventListener('click', (e) => {
        if (state.gamePhase !== 'betting') return;
        
        if (e.target.textContent === 'Clear') {
            state.currentBet = 0;
        } else if (e.target.textContent === 'Max') {
            state.currentBet = state.bankroll;
        } else if (e.target.textContent === 'Repeat' && state.lastBet <= state.bankroll) {
            state.currentBet = state.lastBet;
        }
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
