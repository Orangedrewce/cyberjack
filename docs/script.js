// --- DOM Elements ---
const bankrollEl = document.getElementById('bankroll');
const currentBetEl = document.getElementById('current-bet');
const dealerSumEl = document.getElementById('dealer-sum');
const dealerCardsEl = document.getElementById('dealer-cards');
const playerHandsContainer = document.getElementById('player-hands-container');
const messageEl = document.getElementById('game-message');
const dealBtn = document.getElementById('deal-btn');
const hitBtn = document.getElementById('hit-btn');
const standBtn = document.getElementById('stand-btn');
const doubleBtn = document.getElementById('double-btn');
const splitBtn = document.getElementById('split-btn');

// --- Game State Variables ---
let deck = [];
let playerHands = [];
let currentHandIndex = 0;
let dealerCards = [];
let bankroll = 500;
let currentBet = 0;
let lastBet = 0;
let gameInProgress = false;
let dealerHidden = null;
const suits = ['♠', '♥', '♦', '♣'];
const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// --- Core Game Logic ---
const getCardValue = card => (card.value === 'A') ? 11 : (['J', 'Q', 'K'].includes(card.value)) ? 10 : parseInt(card.value);

const getHandSum = hand => {
    let sum = hand.reduce((acc, card) => acc + getCardValue(card), 0);
    let aces = hand.filter(card => card.value === 'A').length;
    while (sum > 21 && aces-- > 0) sum -= 10;
    return sum;
};

const buildDeck = () => { 
    deck = suits.flatMap(suit => values.map(value => ({ value, suit }))); 
};

const shuffleDeck = () => { 
    for (let i = deck.length - 1; i > 0; i--) { 
        const j = Math.floor(Math.random() * (i + 1)); 
        [deck[i], deck[j]] = [deck[j], deck[i]]; 
    } 
};

// --- Betting Functions ---
const updateBetUI = () => currentBetEl.textContent = currentBet;

function addToBet(amount) { 
    if (!gameInProgress && currentBet + amount <= bankroll) { 
        currentBet += amount; 
        updateBetUI(); 
    } 
}

function clearBet() { 
    if (!gameInProgress) { 
        currentBet = 0; 
        updateBetUI(); 
    } 
}

function maxBet() { 
    if (!gameInProgress) { 
        currentBet = bankroll; 
        updateBetUI(); 
    } 
}

function repeatBet() { 
    if (!gameInProgress && lastBet > 0 && lastBet <= bankroll) { 
        currentBet = lastBet; 
        updateBetUI(); 
    } 
}

// --- UI and Display Functions ---
function createCardElement(card, isHidden = false) {
    const el = document.createElement('div');
    el.className = 'card';
    if (isHidden) { 
        el.classList.add('back'); 
        el.innerHTML = '🂠'; 
    } else {
        el.classList.add((card.suit === '♥' || card.suit === '♦') ? 'red' : 'black');
        el.innerHTML = `<div class="rank">${card.value}</div><div class="suit">${card.suit}</div><div class="rank" style="transform: rotate(180deg);">${card.value}</div>`;
    }
    return el;
}

// Creates the panel/wrapper for a new player hand
function createPlayerHandElement(index, bet) {
    const handWrapper = document.createElement('div');
    handWrapper.className = 'hand-section player-hand panel';
    handWrapper.id = `player-hand-wrapper-${index}`;
    handWrapper.innerHTML = `
        <h2 class="section-title">Hand ${index + 1}</h2>
        <div class="sum-display">Sum: <span id="player-sum-${index}">0</span></div>
        <div class="bet-display">Bet: $${bet}</div>
        <div id="player-cards-${index}" class="cards-container"></div>
    `;
    playerHandsContainer.appendChild(handWrapper);
}

// Updates only text values and CSS classes, preventing flickering
function updateTextAndHighlights() {
    bankrollEl.textContent = bankroll;
    updateBetUI();

    playerHands.forEach((hand, index) => {
        const sumEl = document.getElementById(`player-sum-${index}`);
        if (sumEl) sumEl.textContent = getHandSum(hand.cards);

        const handWrapper = document.getElementById(`player-hand-wrapper-${index}`);
        if (handWrapper) {
            handWrapper.classList.toggle('active-hand', index === currentHandIndex && gameInProgress && playerHands.length > 1);
        }
    });
    
    dealerSumEl.textContent = gameInProgress && dealerHidden ? getHandSum(dealerCards) : getHandSum([...dealerCards, ...(dealerHidden ? [dealerHidden] : [])]);
}

const showMessage = (message, type) => { 
    const messageTextEl = document.querySelector('.message-text');
    if (messageTextEl) {
        messageTextEl.textContent = message;
    }
    messageEl.className = 'game-message message-' + type; 
};

// --- Main Game Actions ---
const delay = ms => new Promise(res => setTimeout(res, ms));

async function dealCards() {
    if (currentBet === 0 || currentBet > bankroll) { 
        showMessage("Invalid bet.", "info"); 
        return; 
    }
    resetForNewHand();
    createPlayerHandElement(0, playerHands[0].bet);
    
    await delay(400); 
    await addCardToHand(playerHands[0], 0);
    await delay(400); 
    await addCardToHand(null, -1, false, true); // Dealer visible
    await delay(400); 
    await addCardToHand(playerHands[0], 0);
    await delay(400); 
    await addCardToHand(null, -1, true, true);  // Dealer hidden
    
    checkInitialPlayerOptions();
}

async function hit() {
    if (!gameInProgress) return;
    const hand = playerHands[currentHandIndex];
    doubleBtn.disabled = true;
    splitBtn.disabled = true;

    await addCardToHand(hand, currentHandIndex);

    if (getHandSum(hand.cards) >= 21) {
        moveToNextHandOrStand();
    }
}

function stand() {
    if (!gameInProgress) return;
    playerHands[currentHandIndex].stood = true;
    moveToNextHandOrStand();
}

async function doubleDown() {
    const hand = playerHands[currentHandIndex];
    if (!gameInProgress || bankroll < hand.bet) { 
        showMessage("Cannot double down.", "info"); 
        return; 
    }
    
    bankroll -= hand.bet;
    hand.bet *= 2;
    doubleBtn.disabled = true;
    splitBtn.disabled = true;

    await addCardToHand(hand, currentHandIndex);
    
    if (getHandSum(hand.cards) <= 21) {
        hand.stood = true;
    }
    setTimeout(moveToNextHandOrStand, 500);
}

async function split() {
    const hand = playerHands[0];
    if (bankroll < hand.bet) { 
        showMessage("Not enough funds to split.", "info"); 
        return; 
    }

    bankroll -= hand.bet;
    const secondCard = hand.cards.pop();
    const newHand = { cards: [secondCard], bet: hand.bet, stood: false };
    playerHands.push(newHand);
    
    // Re-render first hand with one card and create element for second hand
    document.getElementById('player-cards-0').innerHTML = '';
    document.getElementById('player-cards-0').appendChild(createCardElement(hand.cards[0]));
    createPlayerHandElement(1, newHand.bet);
    
    // Immediately show the split card in Hand 2
    document.getElementById('player-cards-1').appendChild(createCardElement(secondCard));
    
    // Update the display to show current sums
    updateTextAndHighlights();

    splitBtn.disabled = true;
    doubleBtn.disabled = true;
    
    await delay(400); 
    await addCardToHand(playerHands[0], 0);
    await delay(400); 
    await addCardToHand(playerHands[1], 1);

    checkInitialPlayerOptions();
}

// --- Helper & State Management Functions ---
function resetForNewHand() {
    gameInProgress = true;
    lastBet = currentBet;
    bankroll -= currentBet;
    playerHands = [{ cards: [], bet: currentBet, stood: false }];
    currentHandIndex = 0;
    dealerCards = [];
    dealerHidden = null;

    playerHandsContainer.innerHTML = '';
    dealerCardsEl.innerHTML = '';

    if (deck.length < 20) { 
        buildDeck(); 
        shuffleDeck(); 
        showMessage("Shuffling deck...", "info"); 
    }
    dealBtn.disabled = true;
}

async function addCardToHand(hand, handIndex, isHidden = false, isDealer = false) {
    const card = deck.pop();
    if (isDealer) {
        if (isHidden) {
            dealerHidden = card;
            dealerCardsEl.appendChild(createCardElement(card, true));
        } else {
            dealerCards.push(card);
            dealerCardsEl.appendChild(createCardElement(card));
        }
    } else {
        hand.cards.push(card);
        document.getElementById(`player-cards-${handIndex}`).appendChild(createCardElement(card));
    }
    updateTextAndHighlights();
    await delay(100);
}

function checkInitialPlayerOptions() {
    hitBtn.disabled = false;
    standBtn.disabled = false;
    const hand = playerHands[currentHandIndex];
    
    doubleBtn.disabled = !(bankroll >= hand.bet && hand.cards.length === 2);
    // Fix split logic: compare card face values (ranks), not point values
    splitBtn.disabled = !(hand.cards.length === 2 && hand.cards[0].value === hand.cards[1].value && bankroll >= hand.bet && playerHands.length < 4);

    if (getHandSum(hand.cards) === 21) {
        showMessage("🎉 Blackjack!", "win");
        setTimeout(stand, 1000);
    } else {
        showMessage(`Playing Hand ${currentHandIndex + 1}. Hit or Stand?`, "info");
    }
}

async function moveToNextHandOrStand() {
    if (currentHandIndex < playerHands.length - 1) {
        currentHandIndex++;
        updateTextAndHighlights();
        checkInitialPlayerOptions();
    } else {
        await startDealerTurn();
    }
}

async function startDealerTurn() {
    gameInProgress = false; // Player turn is over
    updateTextAndHighlights(); // Remove active hand highlight
    hitBtn.disabled = true; 
    standBtn.disabled = true; 
    doubleBtn.disabled = true; 
    splitBtn.disabled = true;
    
    const hiddenEl = dealerCardsEl.querySelector('.back');
    if (hiddenEl && dealerHidden) {
        dealerCards.push(dealerHidden);
        hiddenEl.replaceWith(createCardElement(dealerHidden));
        dealerHidden = null;
        updateTextAndHighlights();
        await delay(500);
    }

    while (getHandSum(dealerCards) < 17) {
        await delay(800);
        await addCardToHand(null, -1, false, true); // Add to dealer
    }
    
    endGame();
}

function endGame() {
    const finalDealerSum = getHandSum(dealerCards);
    let totalWinnings = 0;
    let finalMessage = "";

    playerHands.forEach((hand, index) => {
        const finalPlayerSum = getHandSum(hand.cards);
        const houseEdge = parseFloat(document.getElementById('house-edge').value) / 100 || 0.005;
        let handResult = "";
        
        if (finalPlayerSum > 21) {
            handResult = `Hand ${index + 1} busts (-${hand.bet}). `;
            totalWinnings -= hand.bet;
        } else if (finalDealerSum > 21 || finalPlayerSum > finalDealerSum) {
            const isBlackjack = hand.cards.length === 2 && finalPlayerSum === 21;
            const payout = isBlackjack ? hand.bet * 1.5 : hand.bet;
            const winAmount = Math.floor(payout * (1 - houseEdge));
            bankroll += hand.bet + winAmount;
            totalWinnings += winAmount;
            handResult = `Hand ${index + 1} ${isBlackjack ? 'Blackjack!' : 'wins'} (+${winAmount})! `;
        } else if (finalPlayerSum < finalDealerSum) {
            handResult = `Hand ${index + 1} loses (-${hand.bet}). `;
            totalWinnings -= hand.bet;
        } else {
            bankroll += hand.bet; // Push
            handResult = `Hand ${index + 1} is a push. `;
        }
        finalMessage += handResult;
    });
    
    showMessage(finalMessage, totalWinnings > 0 ? "win" : totalWinnings < 0 ? "lose" : "tie");
    currentBet = 0;
    
    setTimeout(() => {
        updateTextAndHighlights();
        dealBtn.disabled = false;
        if (bankroll <= 0) { 
            showMessage("💔 Game Over! Refresh to restart.", "lose"); 
            dealBtn.disabled = true; 
        }
    }, 800);
}

// --- Initialize Game ---
function initGame() {
    buildDeck();
    shuffleDeck();
    bankrollEl.textContent = bankroll;
    currentBetEl.textContent = currentBet;
    showMessage("Welcome! Place your bet and deal.", "info");
}

window.onload = initGame;
