// Identifies and describes a player in a game.
function Player(coins, handSize, hand) {
	this.coins = coins || 0;
	this.handSize = handSize || 0;
	this.hand = hand || CardSet.create({ });
}

// Creates a player based on the given information.
Player.create = function(player) {
	let nPlayer = new Player(player.coins, player.handSize, player.hand);
	for (let prop in player) {
		if (!nPlayer[prop]) nPlayer[prop] = player[prop];
	}
	return nPlayer;
}

// Identifies a secret game value, but doesn't necessarily provide the value.
function Commitment(id) {
	this.id = id;
	this.value = null;
	this.isResolved = false;
}


// An interface for running a game.
function Game(setup) {
	
	// Create copy of initial setup
	this.constitution = new Array(setup.constitution.length);
	for (let i = 0; i < setup.constitution.length; i++) {
		this.constitution[i] = Expression.get(setup.constitution[i]);
	}
	this.players = new Array(setup.players.length);
	for (let i = 0; i < this.players.length; i++) {
		this.players[i] = Player.create(setup.players[i]);
	}
	this.deck = CardSet.create(setup.deck);
	
	// More initialization
	this.turn = 0;
	this.line = 0;
	this.playerStack = [];
	
	this.canResolveRandomness = false;
	this.isRunning = false;
	this.executionStack = [(function*() {
		
		// Don't start just yet
		yield; 
		
		// The high-level playthrough procedure for a game.
		while (true) {
			console.assert(this.playerStack.length === 0);
			this.line = 0;
			let player = this.players[this.turn % this.players.length];
			yield this.log(player, " takes the floor for turn " + (this.turn + 1));
			this.playerStack.push(player);
			while (this.line < this.constitution.length) {
				let exp = this.constitution[this.line];
				yield this.log("The " + getOrdinal(this.line + 1) + " ammendment is triggered: ", exp);
				yield this.resolve(exp);
				this.line++;
			}
			this.playerStack.pop();
			this.turn++;
		}
		
	}).call(this)]
	
	// Commitment-related initialization
	this.nextCommitmentId = 0
}

// Describes an initial configuration for a game.
Game.Setup = function(players, constitution, deck) {
	this.players = players;
	this.constitution = constitution;
	this.deck = deck;
}

// Runs this game until it is forced to stop (user interaction, waiting for message, etc).
Game.prototype.run = function() {
	let response = null;
	this.isRunning = true;
	while (this.isRunning) {
		let cur = this.executionStack.pop();
		let res = cur.next(response);
		if (!res.done) this.executionStack.push(cur);
		if (res.value) {
			if (res.value.next) { // Check for generator
				this.executionStack.push(res.value);
			} else {
				response = res.value;
			}
		}
	}
}

// Stops a game from running.
Game.prototype.pause = function*() {
	this.isRunning = false;
	yield;
}

// Gets the player currently at the top of the player stack.
Game.prototype.getActivePlayer = function() {
	return this.playerStack[this.playerStack.length - 1];
}

// Gets how far into the player stack the game is at.
Game.prototype.getDepth = function() {
	return this.playerStack.length;
}

// Resolves an expression in the game.
Game.prototype.resolve = function(exp) {
	return exp.card.resolve(this, exp.slots);
}


// Creates a new unresolved commitment.
Game.prototype.createCommitment = function() {
	return new Commitment(this.nextCommitmentId++);
}

// Resolves a commitment.
Game.prototype.resolveCommitment = function(commitment, value) {
	commitment.value = value;
	commitment.isResolved = true;
}

// Gets the value of the given commitment. When this is used, the value of the commitment
// becomes public information.
Game.prototype.reveal = function*(commitment) {
	if (!commitment.isResolved) yield this.pause();
	return commitment.value;
}

// Gets the value of the given commitment for the given player. This will return null if the
// current interface is not allowed to look at that player's private information.
Game.prototype.revealTo = function*(player, commitment) {
	if (!commitment.isResolved) yield this.pause();
	return commitment.value;
}

function getOrdinalSuffix(i) {
	let j = i % 10;
	let k = i % 100;
	if (j == 1 && k != 11)
		return "st";
	if (j == 2 && k != 12)
		return "nd";
	if (j == 3 && k != 13)
		return "rd";
	return "th";
}

function getOrdinal(i) {
	return i + getOrdinalSuffix(i);
}

// Contains functions for constructing log objects.
let Log = {
	Coins: function(n) { return n + " coins" },
	Cards: function(n) { return n + " cards" }
};

// Writes to the game log.
Game.prototype.log = function() {
	// Override me
}

// Gets the number of coins the given player has.
Game.prototype.getCoins = function(player) {
	return player.coins;
}

// Gives coins to a player.
Game.prototype.giveCoins = function(player, count) {
	player.coins += count;
}

// Takes coins from a player
Game.prototype.takeCoins = function(player, count) {
	player.coins -= count;
}

// Gets the hand size of the given player
Game.prototype.getHandSize = function(player) {
	return player.handSize;
}

// Causes a player to draw the given number of cards.
Game.prototype.drawCards = function*(player, count) {
	while (count > 0) {
		let cardCommitment = this.createCommitment();
		if (this.deck && this.canResolveRandomness) {
			let card = this.deck.draw();
			this.resolveCommitment(cardCommitment, card);
		} else {
			this.deck = null;
		}
		yield this.drawCard(player, cardCommitment);
		count--;
	}
}

// Causes a player to draw a specific card, given by a commitment.
Game.prototype.drawCard = function*(player, cardCommitment) {
	let card = yield this.revealTo(player, cardCommitment);
	if (player.hand) {
		if (card) {
			player.hand.insert(card.name);
		} else {
			player.hand = null;
		}
	}
	player.handSize++;
}

// Causes the given player to specify an expression of the given role. Returns that expression wrapped in
// a commitment.
Game.prototype.interactSpecify = function(player, role) {
	return this.createCommitment();
}