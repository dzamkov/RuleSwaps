// A game handled by a server
function ServerGame(setup, playerInfos) {
	Game.call(this, setup, playerInfos);
	this.canResolveRandomness = true;
	
	this.setup = setup;
	this.playerInfos = playerInfos;
	
	// The first commitment in the frame we are waiting on.
	this.baseCommitmentId = 0;
	
	// The number of commitments that need to be resolved before we can proceed in the frame.
	this.unresolved = 0;
	
	// The set of all reveals made, in order.
	this.revealed = [];
	
	// The list of all messages (i.e. chat) in the game.
	this.messages = [];
	
	
	// The callbacks currently waiting on more data, along with the base commitment Id they are
	// waiting form.
	this.waiting = [];
}

// The set of all active server games
ServerGame.active = { };

// Gets a game by its game id.
ServerGame.get = function(gameId, callback) {
	let game = ServerGame.active[gameId];
	if (!game) {
		let player1 = { name: "Steve" };
		let player2 = { name: "Dorp" };
		let player3 = { name: "Scrumples" };
		
		let setup = new Game.Setup([
				Expression.fromList(["you_gain_5"]),
				Expression.fromList(["player_draws_3", "you"]),
				Expression.fromList(["insert_amendment_conditional", "you", "player_decides", "auction_winner"]),
				Expression.fromList(["specify_action_optional", "you"]),
				Expression.fromList(["wealth_win"])
			], CardSet.create(defaultDeck));
		
		game = ServerGame.active[gameId] = new ServerGame(setup, [player1, player2]);
		game.update();
	}
	callback(game);
};

ServerGame.prototype = Object.create(Game.prototype);

ServerGame.prototype.getDeckSize = function() {
	return this.deck.totalCount;
};

ServerGame.prototype.setDeckSize = function(size) {
	console.assert(this.deck.totalCount === size);
};

ServerGame.prototype.declareCommitment = function(player, format) {
	let commitment = Game.prototype.declareCommitment.call(this, player, format);
	if (!commitment.isResolved) this.unresolved++;
	return commitment;
};

// Resolves a commitment for this game.
ServerGame.prototype.resolveCommitment = function(commitment, value) {
	console.assert(commitment.player === null);
	commitment.resolve(value);
	this.unresolved--;
};

ServerGame.prototype.waitReveal = function*(commitment) {
	while (this.unresolved > 0) yield this.pause();
	console.assert(commitment.isResolved);
	this.baseCommitmentId = this.nextCommitmentId;
	return commitment.value;
};

ServerGame.prototype.reveal = function*(commitment) {
	this.revealed.push({
		baseCommitmentId: this.nextCommitmentId,
		commitment: commitment,
		player: null
	});
	return yield this.waitReveal(commitment);
};

ServerGame.prototype.revealTo = function*(player, commitment) {
	this.revealed.push({
		baseCommitmentId: this.nextCommitmentId,
		commitment: commitment,
		player: player
	});
	return yield this.waitReveal(commitment);
};

// Builds a response to a poll message.
ServerGame.prototype.buildPollResponse = function(player, baseCommitmentId, messageId) {
	
	// Build commitments
	let commitments = { };
	for (let i = this.revealed.length - 1; i >= 0; i--) {
		let item = this.revealed[i];
		if (baseCommitmentId < item.baseCommitmentId) {
			if (item.baseCommitmentId <= this.baseCommitmentId) {
				if (!item.player || item.player === player) {
					let commitment = item.commitment;
					console.assert(commitment.isResolved);
					commitments[commitment.id] = commitment.format.encode(commitment.value);
				}
			}
		} else {
			break;
		}
	}
	
	// Build messages
	let messages = this.messages.slice(messageId);
	
	// Create response message
	return {
		commitments: commitments,
		messages: messages,
		baseCommitmentId: this.baseCommitmentId,
		messageId: this.messages.length
	};
};

// Adds a chat message to the server.
ServerGame.prototype.chat = function(player, content) {
	this.messages.push({
		baseCommitmentId: this.baseCommitmentId,
		playerId: player.id,
		content: content
	});
	this.respond();
};

// Responds to polling requests to the server.
ServerGame.prototype.respond = function() {
	for (let i = 0; i < this.waiting.length; i++) {
		let waiting = this.waiting[i];
		if (waiting.baseCommitmentId < this.baseCommitmentId || waiting.messageId < this.messages.length) {
			waiting.callback(Format.message.game.pollResponse.encode(this.buildPollResponse(
				waiting.player, 
				waiting.baseCommitmentId,
				waiting.messageId)));
			this.waiting[i] = this.waiting[this.waiting.length - 1];
			this.waiting.pop();
			i--;
		}
	}
};

// Runs the game and responds to polls.
ServerGame.prototype.update = function() {
	this.run();
	this.respond();
};

// Gets a player in this game based on the given session ID.
ServerGame.prototype.getPlayerBySessionId = function(sessionId) {
	for (let i = 0; i < this.players.length; i++) {
		let playerInfo = this.players[i].info;
		if (playerInfo.sessionId === sessionId) {
			return this.players[i];
		} else if (!playerInfo.sessionId) {
			
			// Become the player
			playerInfo.sessionId = sessionId;
			return this.players[i];
		}	
	}
	return null;
};

// Handles a message sent to this game.
ServerGame.prototype.handle = function(message, callback) {
	if (message.type === "intro") {
		let player = this.getPlayerBySessionId(message.sessionId);
		callback(Format.message.game.introResponse.encode({
			setup: this.setup,
			players: this.playerInfos,
			youId: player ? player.id : null,
			data: this.buildPollResponse(player, 0, 0)
		}));
	} else if (message.type === "commit") {
		// TODO: Sanitize, check player
		let player = this.getPlayerBySessionId(message.sessionId);
		let content = Format.message.game.commit.decode(message.content);
		if (content.id < this.nextCommitmentId) {
			let commitment = this.getCommitment(content.id);
			if (!commitment.isResolved) {
				commitment.resolveEncoded(content.value);
				this.unresolved--;
				this.update();
			}
		}
		callback(true);
	} else if (message.type === "chat") {
		let player = this.getPlayerBySessionId(message.sessionId);
		this.chat(player, Format.message.game.chat.decode(message.content));
		callback(true);
	} else if (message.type === "poll") {
		let player = this.getPlayerBySessionId(message.sessionId);
		let content = Format.message.game.pollRequest.encode(message.content);
		if (content.baseCommitmentId < this.baseCommitmentId || content.messageId < this.messages.length) {
			callback(this.buildPollResponse(player, content.baseCommitmentId, content.messageId));
		} else {
			this.waiting.push({
				player: player,
				baseCommitmentId: content.baseCommitmentId,
				messageId: content.messageId,
				callback: callback
			});
		}
	} else {
		callback(true);	
	}
};