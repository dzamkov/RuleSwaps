// Identifies and describes a player in a game.
function Player(coins, hand, handSize) {
	this.coins = coins || 0;
	this.hand = null;
	this.handSize = handSize || 0;
	if (hand) {
		this.hand = CardSet.create(hand);
		this.handSize = this.hand.totalCount;
	}
}

// Creates a player based on the given information.
Player.create = function(player) {
	let nPlayer = new Player(player.coins, player.hand, player.handSize);
	for (let prop in player) {
		if (!nPlayer[prop]) nPlayer[prop] = player[prop];
	}
	return nPlayer;
}

// Identifies a secret game value, but doesn't necessarily provide the value.
function Commitment(id) {
	this.id = id;
	this.player = null;
	this.format = null;
	this.value = null;
	this.encodedValue = null;
	this.isResolved = false;
}

// Resolves a commitment with its encoded value.
Commitment.prototype.resolveEncoded = function(encodedValue) {
	console.assert(!this.isResolved);
	if (this.format) {
		this.value = this.format.decode(encodedValue);
	} else {
		this.encodedValue = encodedValue;
	}
	this.isResolved = true;
}

// Resolves a commitment with its value.
Commitment.prototype.resolve = function(value) {
	console.assert(!this.isResolved);
	this.value = value;
	this.isResolved = true;
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
		this.players[i].id = i;
	}
	this.deck = CardSet.create(setup.deck);
	
	// More initialization
	this.turn = 0;
	this.line = 0;
	this.playerStack = [];
	
	this.isRunning = false;
	this.executionStack = [(function*() {
		
		// The high-level playthrough procedure for a game.
		while (true) {
			console.assert(this.playerStack.length === 0);
			yield this.setActiveLine(0);
			let player = this.players[this.turn % this.players.length];
			yield this.log(player, " takes the floor for turn " + (this.turn + 1));
			this.playerStack.push(player);
			while (this.line < this.constitution.length) {
				let exp = this.constitution[this.line];
				yield this.log("The " + getOrdinal(this.line + 1) + " amendment is invoked ", exp);
				yield this.resolve(exp);
				yield this.setActiveLine(this.line + 1);
			}
			this.playerStack.pop();
			this.turn++;
		}
		
	}).call(this)]
	
	// Commitment-related initialization
	this.nextCommitmentId = 0;
	this.commitments = [];
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
		response = res.value;
		if (response && response.next) { // Check for generator
			this.executionStack.push(response);
			response = null;
		}
	}
}

// Stops a game from running. For this to be effective, it should be used in a loop with a
// wait condition.
Game.prototype.pause = function*() {
	this.isRunning = false;
	yield;
}

// Gets the player currently at the top of the player stack.
Game.prototype.getActivePlayer = function() {
	return this.playerStack[this.playerStack.length - 1];
}

// Adds a player to the top of the player stack.
Game.prototype.pushPlayerStack = function(player) {
	this.playerStack.push(player);
}

// Removes a player from the top of the player stack.
Game.prototype.popPlayerStack = function(player) {
	let res = this.playerStack.pop();
	console.assert(!player || player === res);
}

// Gets the list of players, going clockwise, starting at the given player.
Game.prototype.getPlayersFrom = function(player) {
	return this.players.slice(player.id).concat(this.players.slice(0, player.id));
}

// Gets how far into the player stack the game is at.
Game.prototype.getDepth = function() {
	return this.playerStack.length;
}

// Resolves an expression in the game.
Game.prototype.resolve = function(exp) {
	return exp.card.resolve(this, exp.slots);
}

// Gets the commitment with the given Id. This may be called before the commitment is declared
// in order to possibly let it be pre-resolved.
Game.prototype.getCommitment = function(id) {
	let commitment = this.commitments[id];
	if (!commitment) {
		commitment = new Commitment(id);
		this.commitments[id] = commitment;
	}
	return commitment;
}

// Declares a new commitment.
Game.prototype.declareCommitment = function(player, format) {
	let commitment = this.getCommitment(this.nextCommitmentId++);
	commitment.player = player;
	commitment.format = format;
	if (commitment.isResolved) {
		commitment.value = format.decode(commitment.encodedValue);
		commitment.encodedValue = null;
	}
	return commitment;
}

// Waits until the given commitment is resolved, then returns its value. This does not
// necessarily guarantee that the commitment will eventually be fufilled.
Game.prototype.awaitCommitment = function*(commitment) {
	while (!commitment.isResolved) yield this.pause();
	return commitment.value;
}

// Gets the value of the given commitment. When this is used, the value of the commitment
// becomes public information.
Game.prototype.reveal = function*(commitment) {
	return yield this.awaitCommitment(commitment);
}

// Gets the value of the given commitment for the given player. This will return null if the
// current interface is not allowed to look at that player's private information.
Game.prototype.revealTo = function*(player, commitment) {
	// Override me
	return null;
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
	Coins: function(n) {
		let inst = Object.create(Log.Coins.prototype);
		inst.count = n;
		return inst;
	},
	Cards: function(n) {
		let inst = Object.create(Log.Cards.prototype);
		inst.count = n;
		return inst;
	},
	Break: {
		toString: function() { return "\n"; }
	},
	Positive: function(str) {
		let inst = Object.create(Log.Positive.prototype);
		inst.str = str;
		return inst;
	},
	Negative: function(str) {
		let inst = Object.create(Log.Negative.prototype);
		inst.str = str;
		return inst;
	}
};

Log.Coins.prototype.toString = function() {
	return this.count + " coins";
}

Log.Cards.prototype.toString = function() {
	return this.count + " cards";
}

Log.Positive.prototype.toString = function() {
	return this.str;
}

Log.Negative.prototype.toString = function() {
	return this.str;
}


// Writes to the game log.
Game.prototype.log = function() {
	// Override me
}

// Gets the current consitution.
Game.prototype.getConstitution = function() {
	return this.constitution;
}

// Sets the constitution line that is currently being executed.
Game.prototype.setActiveLine = function(line) {
	this.line = line;
}

// Gets the number of coins the given player has.
Game.prototype.getCoins = function(player) {
	return player.coins;
}

// Sets the number of coins the given player has.
Game.prototype.setCoins = function(player, count) {
	player.coins = count;
}

// Gives coins to a player.
Game.prototype.giveCoins = function*(player, count) {
	if (count != 0) yield this.setCoins(player, player.coins + count);
}

// Takes coins from a player
Game.prototype.takeCoins = function*(player, count) {
	if (count != 0) yield this.setCoins(player, player.coins - count);
}

// Discards the given list of cards in the given order.
Game.prototype.discard = function(cards) {
	// TODO
}

// Gets the hand size of the given player
Game.prototype.getHandSize = function(player) {
	return player.handSize;
}

// Sets the hand size of the given player
Game.prototype.setHandSize = function(player, handSize) {
	player.handSize = handSize;
}

// Causes a player to draw the given number of cards.
Game.prototype.drawCards = function*(player, count) {
	while (count > 0) {
		let cardCommitment = this.declareCommitment(null, Format.card);
		this.deck = null;
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
	yield this.setHandSize(player, player.handSize + 1);
}

// Removes a given set of cards from a player's hand.
Game.prototype.removeCards = function*(player, cardSet) {
	if (player.hand) {
		player.hand.removeSet(cardSet);
		yield this.setHandSize(player, player.hand.totalCount);
	} else {
		yield this.setHandSize(player, player.handSize - cardSet.totalCount);
	}
}

// Chooses a random integer between 0 (inclusive) and the given number (exclusive). Returns
// it as a commitment.
Game.prototype.random = function*(range) {
	return this.declareCommitment(null, Format.num(range));
}

// Requests the given player specify a boolean value. Returns that value wrapped in a commitment.
Game.prototype.interactBoolean = function(player) {
	return this.declareCommitment(player, Format.bool);
}

// Requests the given player to specify a payment amount. Returns that amount wrapped in a commitment.
Game.prototype.interactPayment = function(player) {
	return this.declareCommitment(player, Format.num(player.coins + 1));
}

// Requests the given player to specify a payment amount and a boolean. Returns both wrapped in
// separate commitments.
Game.prototype.interactBooleanPayment = function*(player) {
	let bool = yield this.interactBoolean(player);
	let payment = yield this.interactPayment(player);
	return { bool: bool, payment: payment };
}

// Requests the given player to specify an expression of the given role. Returns that expression wrapped in
// a commitment.
Game.prototype.interactSpecify = function(player, role) {
	return this.declareCommitment(player, Format.exp);
}

// Gets the format for an amendment to the constitution at this moment.
Game.prototype.getAmendFormat = function() {
	return Format.obj({
		line: Format.num(this.constitution.length + 1),
		exp: Format.exp
	});
}

// Given a commitment for an amendment, does the processing needed to reveal it and make a proposal.
Game.prototype.processAmend = function*(commitment) {
	let amend = yield this.reveal(commitment);
	if (amend) {
		yield this.removeCards(commitment.player, CardSet.fromList(amend.exp.toList()))
		yield this.proposeAmendment(amend);
	}
	return amend;
}

// Causes the given player to specify an amendment. Returns it as a proposed amendment.
Game.prototype.interactAmend = function*(player) {
	return yield this.processAmend(this.declareCommitment(player, this.getAmendFormat()));
}

// Proposes an amendment to the constitution. The proposal is viewable by all players, but
// should be confirmed or canceled before it is invoked.
Game.prototype.proposeAmendment = function*(amend) {
	
	// Proposals count as real amendments until they are canceled (makes indexing easier).
	this.constitution.splice(amend.line, 0, amend.exp);
	if (amend.line <= this.line) {
		yield this.setActiveLine(this.line + 1);
	}
}

// Cancels an amendment previously specified by a player.
Game.prototype.cancelAmend = function*(amend) {
	this.constitution.splice(amend.line, 1);
	yield this.discard(amend.exp.toList());
}

// Confirms an amendment previously specified by a player.
Game.prototype.confirmAmend = function*(amend) {
	// Nothing to do here
}