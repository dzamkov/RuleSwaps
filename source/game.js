// Identifies and describes a player in a game.
function Player(coins, hand, handSize, info) {
	this.coins = coins;
	this.hand = hand;
	this.handSize = handSize;
	this.info = info;
};

Player.prototype.toString = function() {
	if (this.info.name) {
		return this.info.name;
	} else if (this.id) {
		return "Player " + this.id;
	} else {
		return "Player";
	}
};

// Identifies a secret game value, but doesn't necessarily provide the value.
function Commitment(id) {
	this.id = id;
	this.player = null;
	this.format = null;
	this.value = null;
	this.encodedValue = null;
	this.isResolved = false;
};

// Resolves a commitment with its encoded value.
Commitment.prototype.resolveEncoded = function(encodedValue) {
	console.assert(!this.isResolved);
	if (this.format) {
		this.value = this.format.decode(encodedValue);
	} else {
		this.encodedValue = encodedValue;
	}
	this.isResolved = true;
};

// Resolves a commitment with its value.
Commitment.prototype.resolve = function(value) {
	console.assert(!this.isResolved);
	this.value = value;
	this.isResolved = true;
};

// Identifies a possible color for a button.
let Color = {
	Green: "green",
	Yellow: "yellow",
	Red: "red",
	White: "white"
};

// An interface for running a game.
function Game(setup, playerInfos) {
	
	// Create copy of initial setup
	this.constitution = new Array(setup.constitution.length);
	for (let i = 0; i < setup.constitution.length; i++) {
		this.constitution[i] = Expression.get(setup.constitution[i]);
	}
	this.deck = CardSet.create(setup.deck);
	this.deckSize = this.deck.totalCount;
	
	// Create player data
	this.players = new Array(playerInfos.length);
	for (let i = 0; i < this.players.length; i++) {
		this.players[i] = new Player(0, CardSet.create({ }), 0, playerInfos[i]);
		this.players[i].id = i;
	}
	
	// More initialization
	this.turn = 0;
	this.line = 0;
	this.playerStack = [];
	this.winner = null;
	
	this.canResolveRandomness = false;
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
		
	}).call(this)];
	
	// Commitment-related initialization
	this.nextCommitmentId = 0;
	this.commitments = [];
}

// Describes an initial configuration of a game.
Game.Setup = function(constitution, deck) {
	this.constitution = constitution;
	this.deck = deck;
};

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
};

// Stops a game from running. For this to be effective, it should be used in a loop with a
// wait condition.
Game.prototype.pause = function*() {
	this.isRunning = false;
	yield;
};

// Gets the player currently at the top of the player stack.
Game.prototype.getActivePlayer = function() {
	return this.playerStack[this.playerStack.length - 1];
};

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
};

// Gets the commitment with the given Id. This may be called before the commitment is declared
// in order to possibly let it be pre-resolved.
Game.prototype.getCommitment = function(id) {
	let commitment = this.commitments[id];
	if (!commitment) {
		commitment = new Commitment(id);
		this.commitments[id] = commitment;
	}
	return commitment;
};

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
};

// Resolves a commitment declared in this game.
Game.prototype.resolveCommitment = function(commitment, value) {
	commitment.resolve(value);
};

// Waits until the given commitment is resolved, then returns its value. This does not
// necessarily guarantee that the commitment will eventually be fufilled.
Game.prototype.awaitCommitment = function*(commitment) {
	while (!commitment.isResolved) yield this.pause();
	return commitment.value;
};

// Gets the value of the given commitment. When this is used, the value of the commitment
// becomes public information.
Game.prototype.reveal = function*(commitment) {
	return yield this.awaitCommitment(commitment);
};

// Gets the value of the given commitment for the given player. This will return null if the
// current interface is not allowed to look at that player's private information.
Game.prototype.revealTo = function*(player, commitment) {
	// Override me
	return null;
};

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

// Registers a winner and ends the game.
Game.prototype.win = function*(player) {
	this.winner = player;
	while (true) yield this.pause();
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
};

// Takes coins from a player
Game.prototype.takeCoins = function*(player, count) {
	if (count != 0) yield this.setCoins(player, player.coins - count);
};

// Draws a card from the deck and returns it wrapped in a commitment, or null if the deck is empty.
Game.prototype.draw = function*() {
	if (this.deckSize > 0) {
		let commitment = this.declareCommitment(null, Format.card);
		if (commitment.isResolved) {
			if (this.deck) {
				let valid = this.deck.remove(commitment.value);
				console.assert(valid);
				yield this.setDeckSize(this.deck.totalCount);
			} else {
				yield this.setDeckSize(this.getDeckSize() - 1);
			}
		} else if (this.canResolveRandomness && this.deck) {
			let card = this.deck.draw();
			this.resolveCommitment(commitment, card);
			yield this.setDeckSize(this.deck.totalCount);
		} else {
			this.deck = null;
			yield this.setDeckSize(this.getDeckSize() - 1);
		}
		return commitment;
	} else {
		return null;
	}
};

// Discards the given set of cards.
Game.prototype.discard = function(cards) {
	console.assert(cards instanceof CardSet);
	// TODO
};

// Gets the size of the deck.
Game.prototype.getDeckSize = function() {
	console.assert(!this.deck || this.deck.totalCount === this.deckSize);
	return this.deckSize;
};

// Sets the size of the deck.
Game.prototype.setDeckSize = function(size) {
	console.assert(!this.deck || this.deck.totalCount === size);
	this.deckSize = size;
};

// Gets the hand size of the given player.
Game.prototype.getHandSize = function(player) {
	console.assert(!player.hand || player.hand.totalCount === player.handSize);
	return player.handSize;
};

// Sets the hand size of the given player.
Game.prototype.setHandSize = function(player, handSize) {
	console.assert(!player.hand || player.hand.totalCount === handSize);
	player.handSize = handSize;
};

// Declares a commitment that contains the current hand of the given player as a
// card set.
Game.prototype.getHand = function(player) {
	let commitment = this.declareCommitment(null, Format.cardSet);
	if (!commitment.isResolved && player.hand) {
		this.resolveCommitment(commitment, CardSet.create(player.hand));
	}
	return commitment;
};

// Causes a player to try drawing the given number of cards. Returns the actual amount drawn (which
// may be lower due to deck emptying.
Game.prototype.drawCards = function*(player, count) {
	let drawn = 0;
	let cardCommitment;
	while (count > 0 && (cardCommitment = yield this.draw())) {
		yield this.giveCard(player, cardCommitment);
		count--;
		drawn++;
	}
	return drawn;
};

// Inserts a card into a player's hand. Either the card is given, or a commitment to it is.
Game.prototype.giveCard = function*(player, card) {
	if (card instanceof Commitment) card = yield this.revealTo(player, card);
	if (player.hand) {
		if (card) {
			player.hand.insert(card.name);
			yield this.setHandSize(player, player.hand.totalCount);
		} else {
			let size = player.hand.totalCount;
			player.hand = null;
			yield this.setHandSize(player, size + 1);
		}
	} else {
		yield this.setHandSize(player, this.getHandSize(player) + 1);
	}
	return card;
};

// Inserts a publicly-known set of cards into a player's hand.
Game.prototype.giveCards = function*(player, cardSet) {
	// TODO
};

// Removes a publicly-known set of cards from a player's hand.
Game.prototype.takeCards = function*(player, cardSet) {
	if (player.hand) {
		player.hand.removeSet(cardSet);
		yield this.setHandSize(player, player.hand.totalCount);
	} else {
		yield this.setHandSize(player, this.getHandSize(player) - cardSet.totalCount);
	}
};

// Chooses a random integer between 0 (inclusive) and the given number (exclusive). Returns
// it as a commitment.
Game.prototype.random = function*(range) {
	let commitment = this.declareCommitment(null, Format.nat.lessThan(range));
	if (!commitment.isResolved && this.canResolveRandomness) {
		this.resolveCommitment(commitment, Math.floor(Math.random() * range));
	}
	return commitment;
};

// Requests the given player specify a boolean value. Returns that value wrapped in a commitment.
Game.prototype.interactBoolean = function(player) {
	return this.declareCommitment(player, Format.bool);
};

// Requests the given player pick another player. Returns that player wrapped in a commitment.
Game.prototype.interactPlayer = function(player, canPickThemself) {
	// TODO: Restrict format when canPickThemself is false
	return this.declareCommitment(player, Format.id(Format.nat, this.players));
};

// Requests the given player to specify a payment amount. Returns that amount wrapped in a commitment.
Game.prototype.interactPayment = function(player) {
	return this.declareCommitment(player, Format.nat.lessThan(player.coins + 1));
};

// Requests the given player to specify a payment amount and a boolean. Returns both wrapped in
// separate commitments.
Game.prototype.interactBooleanPayment = function*(player) {
	let bool = yield this.interactBoolean(player);
	let payment = yield this.interactPayment(player);
	return { bool: bool, payment: payment };
};

// Requests the given player to pick a card role. Returns that role wrapped in a commitment.
Game.prototype.interactRole = function(player) {
	return this.declareCommitment(player, Format.id(Format.nat, Role));
};

// Requests the given player to select a list or set of cards subject to restrictions.
//
// 	options
//		ordered  - does the order of cards matter?
//		optional - can the player skip this interaction without selecting cards?
//		amount   - if set, the exact number of cards that can be selected.
//
//	returns a commitment of either a set or lists of cards.
Game.prototype.interactCards = function(player, options) {
	let format = options.ordered ? Format.list.card : Format.cardSet;
	if (player.hand) format = format.withSuperset(player.hand);
	if (options.amount) format = format.withSize(options.amount);
	if (options.optional) format = format.orNull();
	return this.declareCommitment(player, format);
};

// Requests the given player to specify an expression of the given role. Returns that expression wrapped in
// a commitment.
Game.prototype.interactSpecify = function(player, role) {
	let exp = Format.exp(Role.Action);
	if (player.hand) exp = exp.withSuperset(player.hand);
	exp = exp.orNull();
	return this.declareCommitment(player, exp);
}

// Gets the format for an amendment to the constitution at this moment.
Game.prototype.getAmendFormat = function(player) {
	let exp = Format.exp(Role.Action);
	if (player.hand) exp = exp.withSuperset(player.hand);
	return Format.record({
		line: Format.nat.lessThan(this.constitution.length + 1),
		exp: exp
	}).orNull();
}

// Given a commitment for an amendment, does the processing needed to reveal it and make a proposal.
Game.prototype.processAmend = function*(commitment) {
	let amend = yield this.reveal(commitment);
	if (amend) {
		yield this.takeCards(commitment.player, CardSet.fromList(amend.exp.toList()));
		yield this.proposeAmendment(amend);
	}
	return amend;
}

// Causes the given player to specify an amendment. Returns it as a proposed amendment.
Game.prototype.interactAmend = function*(player) {
	return yield this.processAmend(this.declareCommitment(player, this.getAmendFormat(player)));
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
	if (amend.line <= this.line) { // TODO: Track proposals
		yield this.setActiveLine(this.line - 1);
	}
	yield this.discard(CardSet.fromList(amend.exp.toList()));
}

// Confirms an amendment previously specified by a player.
Game.prototype.confirmAmend = function*(amend) {
	// Nothing to do here
}

// References to game objects for disambiguation when needed
Game.Card = Card;
Game.Log = Log;