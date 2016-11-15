// Identifies a player within a game and describes player-related game state.
function Player(coins, knownHand, handSize) {
	coins = coins || 0;
	knownHand = knownHand || [];
	handSize = handSize || knownHand.length;
	
	this.coins = coins;
	this.knownHand = knownHand;
	this.handSize = handSize;
}

// Describes a query within a game that must get a response before the game can proceed.
function Query(type, style) {
	this.type = type;
	this.style = style;
}

// A set of all possible query types
Query.Type = {
	Pause: 0,
	Specify: 1
};

// A generic pause query.
Query.Pause = new Query(Query.Pause);

// Maintains state information for a game.
function Game(players, constitution) {
	this.players = players;
	this.constitution = constitution;
	
	this.turn = 0
	this.line = 0;
	
	this.waitingFor = Query.Pause;
	this.executionStack = [this.play()];
	this.playerStack = [];
}

Game.prototype.run = function(response, skipPauses) {
	while (true) {
		let cur = this.executionStack[this.executionStack.length - 1];
		let res = cur.next(response);
		if (res.done) this.executionStack.pop();
		if (res.value) {
			if (res.value instanceof Query) {
				if (res.value.type === Query.Type.Pause && skipPauses) {
					response = null;
				} else {
					this.waitingFor = res.value;
					break;
				}
			} else if (res.value.next) { // Check if iterator
				this.executionStack.push(res.value);
			} else {
				response = res.value; // Use as response
			}
		} else {
			response = null;
		}
	}
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

// Writes the given sequence of texts and objects to the player log.
Game.prototype.log = function() {
	if (this.onlog) this.onlog(this.playerStack.length, arguments);
}

// Pauses the game to give players time to see whats happening.
Game.prototype.pause = function() {
	return Query.Pause;
}

// Combines calls to log and pause.
Game.prototype.logPause = function*() {
	this.log.apply(this, arguments);
	yield this.pause();
}

// The top-level game logic procedure.
Game.prototype.play = function*() {
	while (true) {
		console.assert(this.playerStack.length === 0);
		this.line = 0;
		let player = this.players[this.turn % this.players.length];
		yield this.logPause(player, " takes the floor for turn " + (this.turn + 1));
		this.playerStack.push(player);
		while (this.line < this.constitution.length) {
			let exp = this.constitution[this.line];
			yield this.logPause(player, " invokes the " + getOrdinal(this.line + 1) + " ammendment: ", exp);
			yield this.resolve(exp);
			this.line++;
		}
		this.playerStack.pop();
		this.turn++;
	}
}

// Resolves an expression within the game.
Game.prototype.resolve = function(exp) {
	return exp.card.resolve(this, exp.slots);
}

// Gets the player currently at the top of the player stack.
Game.prototype.getActivePlayer = function() {
	return this.playerStack[this.playerStack.length - 1];
}

// Allows a player to specify an expression of the given role.
Game.prototype.specify = function*(player, role, style) {
	var query = new Query(Query.Type.Pause, style);
	query.player = player;
	query.role = role;
	return yield query;
}

// Gives coins to a player.
Game.prototype.gain = function(player, coins) {
	player.coins += coins;
}

// Causes a player to draw cards.
Game.prototype.draw = function(player, count) {
	// TODO
}