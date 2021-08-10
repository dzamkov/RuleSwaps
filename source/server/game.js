// A game handled by a server
function ServerGame(gameId, setup, playerInfos) {
	Game.call(this, setup, playerInfos);
	this.canResolveRandomness = true;
	
	this.gameId = gameId;
	this.setup = setup;

	// Mapping from user ID to player
	this.playerForUserId = { };
	for (let i = 0; i < this.players.length; i++) {
		let player = this.players[i];
		if (player.user) {
			this.playerForUserId[player.user.userId] = player;
			player.user.games[gameId] = this;
		}
	}
	
	// The first commitment in the frame we are waiting on.
	this.baseCommitmentId = 0;
	
	// The number of commitments that need to be resolved before we can proceed in the frame.
	this.unresolved = 0;
	
	// The set of all reveals made, in order.
	this.revealed = [];
	
	// The list of all chat messages in the game.
	this.chats = [];
	
	// The set of all tabs displaying this game.
	this.tabs = { };

	this.update();
}

// The set of all active server games
ServerGame.active = { };

// Creates and registers a new server game with the given setup and player set. Returns the game wrapped
// in a promise.
ServerGame.create = function(setup, players) {
	return new Promise((resolve, reject) => {
		crypto.randomBytes(12, (err, buf) => {
			if (err) return reject(err);
			let gameId = buf.toString("hex"); // TODO: base 36?
			let game = new ServerGame(gameId, setup, players);
			ServerGame.active[gameId] = game;
			resolve(game);
		});
	});
};

// Gets a game by its game ID, returned as a promise.
ServerGame.get = function(gameId, callback) {
	let game = ServerGame.active[gameId];
	if (game) return Promise.resolve(game);
	return Promise.resolve(null);
};

ServerGame.prototype = Object.create(Game.prototype);

ServerGame.prototype.declareCommitment = function(player, format) {
	let commitment = Game.prototype.declareCommitment.call(this, player, format);
	if (!commitment.isResolved) this.unresolved++;
	return commitment;
};

// Resolves a commitment for this game.
ServerGame.prototype.resolveCommitment = function(commitment, value) {
	console.assert(commitment.player === null || commitment.player.user === null);
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

// Gets the game tab corresponding to the given tab.
ServerGame.prototype.getTab = function(tab) {
	if (!this.tabs[tab.uniqueId]) {
		tab.game = this;
		this.tabs[tab.uniqueId] = tab;

		// Handle tab closing
		let curClose = tab.close;
		tab.close = function() {
			let game = this.game;
			curClose.call(this);
			delete game.tabs[this.uniqueId];

			// TODO: Handle player disconnect, game abandon
		};

		// Establish poll request
		tab.pollRequest = null;
	}
	return tab;
}

// Builds a response to a poll message for a particular player, or null for an observer.
ServerGame.prototype.buildPollResponse = function(player, baseCommitmentId, chatId) {
	
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
	let chats = this.chats.slice(chatId);
	
	// Create response message
	return {
		commitments: commitments,
		chats: chats,
		baseCommitmentId: this.baseCommitmentId,
		chatId: this.chats.length
	};
};

// Adds a chat message to the server.
ServerGame.prototype.chat = function(player, content) {
	this.chats.push({
		baseCommitmentId: this.baseCommitmentId,
		playerId: player.id,
		content: content
	});
	this.respond();
};

// Responds to polling requests that can be fulfilled.
ServerGame.prototype.respond = function() {
	for (let uniqueId in this.tabs) {
		let tab = this.tabs[uniqueId];
		if (tab.callback) {
			let request = tab.pollRequest;
			if (request.baseCommitmentId < this.baseCommitmentId || request.chatId < this.chats.length) {
				tab.respond(Format.message.game.response.poll.encode(this.buildPollResponse(
					this.playerForUserId[tab.user.userId], 
					request.baseCommitmentId,
					request.chatId)));
			}
		}
	}
};

// Runs the game and responds to polls.
ServerGame.prototype.update = function() {
	this.run();
	this.respond();
};

// Handles a message sent to this game.
ServerGame.prototype.handle = function(tab, message, callback) {
	tab = this.getTab(tab);
	let player = this.playerForUserId[tab.user.userId];
	if (message.type === "intro") {
		callback(Format.message.game.response.intro.encode({
			setup: this.setup,
			players: this.players.map(p => ({
				userId: p.user ? p.user.userId : null,
				name: p.name
			})),
			youId: player ? player.id : null,
			data: this.buildPollResponse(player, 0, 0)
		}));
		return;

	} else if (message.type === "commit") {

		// TODO: Sanitize, check player
		let content = message.content;
		if (content.id < this.nextCommitmentId) {
			let commitment = this.getCommitment(content.id);
			if (!commitment.isResolved) {
				commitment.resolveEncoded(content.value);
				this.unresolved--;
				this.update();
			}
		}
		callback(true);
		return;

	} else if (message.type === "chat") {

		this.chat(player, message.content);
		callback(true);
		return;

	} else if (message.type === "poll") {
		let content = message.content;
		if (content.baseCommitmentId < this.baseCommitmentId || content.chatId < this.chats.length) {

			callback(Format.message.game.response.poll.encode(
				this.buildPollResponse(player, content.baseCommitmentId, content.chatId)));
			return;

		} else {

			tab.poll(callback);
			tab.pollRequest = content;
			return;
		}
	}

	callback(true);	
	return;
};