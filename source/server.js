let http = require("http");
let url = require("url");
let path = require("path");
let fs = require("fs");
let mime = require("mime");

let port = parseInt(process.argv[2], 10);

// A game handled by a server
function ServerGame(setup) {
	Game.call(this, setup);
	this.setup = setup;
	
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
	
	// For testing purposes, provide session id's for connecting players.
	// TODO: Remove
	this.nextPlayerConnect = 0;
}

// The set of all active server games.
ServerGame.active = { };

// Gets a game by its game id.
ServerGame.get = function(gameId, callback) {
	let game = ServerGame.active[gameId];
	if (!game) {
		let player1 = new Player(0, CardSet.create({ }));
		player1.name = "Steve";
		player1.userId = 1;
		player1.sessionId = "ses1";
		
		let player2 = new Player(0, CardSet.create({ }));
		player2.name = "Dorp";
		player2.userId = 2;
		player2.sessionId = "ses2";
		
		let player3 = new Player(0, CardSet.create({ }));
		player3.name = "Scrumples";
		player3.userId = 3;
		player3.sessionId = "ses3";
		
		let setup = new Game.Setup(
			[player1],[
				Expression.fromList(["you_gain_5"]),
				Expression.fromList(["player_draws_3", "you"]),
				Expression.fromList(["insert_amendment_conditional", "you", "majority_vote"]),
				Expression.fromList(["specify_action_optional", "you"]),
				Expression.fromList(["wealth_win"])
			], CardSet.create(defaultDeck));
		
		game = ServerGame.active[gameId] = new ServerGame(setup);
		game.update();
	}
	callback(game);
};

ServerGame.prototype = Object.create(Game.prototype);

ServerGame.prototype.drawCards = function*(player, count) {
	while (count > 0) {
		let cardCommitment = this.declareCommitment(null, Format.card);
		if (cardCommitment.isResolved) {
			this.deck.remove(cardCommitment.value);
		} else {
			this.resolveCommitment(cardCommitment, this.deck.draw());
		}
		yield this.drawCard(player, cardCommitment);
		count--;
	}
};

ServerGame.prototype.random = function*(range) {
	let commitment = yield Game.prototype.random.call(this, range);
	if (!commitment.isResolved) {
		this.resolveCommitment(commitment, Math.floor(Math.random() * range));
	}
	return commitment;
};

ServerGame.prototype.getHand = function*(player) {
	let commitment = yield Game.prototype.getHand.call(this, player);
	if (!commitment.isResolved) {
		this.resolveCommitment(commitment, CardSet.create(player.hand));
	}
	return commitment;
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
ServerGame.prototype.chat = function(player, message) {
	this.messages.push({
		baseCommitmentId: this.baseCommitmentId,
		playerId: player.id,
		message: message
	});
	this.respond();
};

// Responds to polling requests to the server.
ServerGame.prototype.respond = function() {
	for (let i = 0; i < this.waiting.length; i++) {
		let waiting = this.waiting[i];
		if (waiting.baseCommitmentId < this.baseCommitmentId || waiting.messageId < this.messages.length) {
			waiting.callback(this.buildPollResponse(
				waiting.player, 
				waiting.baseCommitmentId,
				waiting.messageId));
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

// Gets a player in this game base on the given session id.
ServerGame.prototype.getPlayerBySessionId = function(sessionId) {
	for (let i = 0; i < this.players.length; i++) {
		if (this.players[i].sessionId === sessionId)
			return this.players[i];
	}
	return null;
};

// Handles a message sent to this game.
ServerGame.prototype.handle = function(request, callback) {
	let type = request.messageType;
	if (type === "intro") {
		let playerId = (this.nextPlayerConnect++) % this.players.length;
		console.log(playerId + " joined");
		callback({
			setup: Format.setup.encode(this.setup),
			sessionId: this.players[playerId].sessionId,
			playerId: playerId
		});
	} else if (type === "commit") {
		// TODO: Sanitize, check player
		let player = this.getPlayerBySessionId(request.sessionId);
		console.log(player.id + " commited");
		let commitmentId = Format.nat.decode(request.commitmentId);
		if (commitmentId < this.nextCommitmentId) {
			let commitment = this.getCommitment(request.commitmentId);
			if (!commitment.isResolved) {
				commitment.resolveEncoded(request.commitmentValue);
				this.unresolved--;
				this.update();
			}
		}
		callback(true);
	} else if (type === "chat") {
		let player = this.getPlayerBySessionId(request.sessionId);
		this.chat(player, request.message);
		callback(true);
	} else if (type === "poll") {
		let player = this.getPlayerBySessionId(request.sessionId);
		let baseCommitmentId = Format.nat.decode(request.baseCommitmentId);
		let messageId = Format.nat.decode(request.messageId);
		if (baseCommitmentId < this.baseCommitmentId || messageId < this.messages.length) {
			callback(this.buildPollResponse(player, baseCommitmentId, messageId));
		} else {
			this.waiting.push({
				player: player,
				baseCommitmentId: baseCommitmentId,
				messageId: messageId,
				callback: callback
			});
		}
	} else {
		callback(true);	
	}
};


// Responds with a generic 500 message.
function respondError(response) {
	response.writeHead(500, { "Content-Type": "text/plain" });
	response.write("500 Internal Server Error. \n");
	response.end();
}

// Responds with a generic 404 message.
function respondNotFound(response) {
	response.writeHead(404, { "Content-Type": "text/plain" });
	response.write("404 Not Found. \n");
	response.end();
}

// Responds with a generic 400 message.
function respondBadRequest(response) {
	response.writeHead(400, { "Content-Type": "text/plain" });
	response.write("400 Bad Request. \n");
	response.end();
}

// Responds with a JSON object.
function respondJSON(response, object) {
	response.writeHead(200, { "Content-Type": "application/json" });
	response.write(JSON.stringify(object));
	response.end();
}

http.createServer(function(request, response) {
	let pathname = path.normalize(url.parse(request.url).pathname);
	
	// Check for static file
	if (pathname.startsWith("/static/")) {
		let filename = path.join(process.cwd(), pathname);
		fs.readFile(filename, "binary", function(err, file) {
			if (err) {
				respondNotFound(response);
			} else {
				response.writeHead(200, { "Content-Type": mime.lookup(filename) });
				response.write(file, "binary");
				response.end();
			}
		});
	} else {
		let parts = pathname.split("/");
		console.assert(parts[0] === "");
		if (parts.length === 3 && parts[1] === "game") {
			if (parts.length === 3 && request.method === "GET") {
				
				// Load game html
				let filename = path.join(process.cwd(), "static/game.html");
				fs.readFile(filename, "binary", function(err, file) {
					if (err) {
						respondError(response);
					} else {
						response.writeHead(200, { "Content-Type": "text/html" });
						response.write(file, "binary");
						response.end();
					}
				});
			} else if (request.method === "POST") {
				
				// Response to game message
				let gameId = parts[2];
				let game = null;
				let message = null;
				
				ServerGame.get(gameId, function(nGame) {
					game = nGame;
					if (game && message) game.handle(message, respondJSON.bind(null, response));
				});
				
				let buf = "";
				request.on("data", function(chunk) {
					buf += chunk;
					// TODO: Limit request size, look in to better way of streaming
				});
				request.on("end", function() {
					message = JSON.parse(buf); // TODO: Handle errors here
					if (game && message) game.handle(message, respondJSON.bind(null, response));
				});
			} else {
				respondNotFound(response);
			}
		} else {
			respondNotFound(response);
		}
	}
	
}).listen(port);

// Print deck stats
let deck = CardSet.create(defaultDeck);
console.log("Total card types: ", Object.keys(deck.counts).length);
console.log("Total cards in deck: ", deck.totalCount);

let roleCounts = deck.getRoleCounts();
console.log("Total action cards: ", roleCounts[0]);
console.log("Total condition cards: ", roleCounts[1]);
console.log("Total player cards: ", roleCounts[2]);

console.log("Server running...");