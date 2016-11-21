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
}

// The set of all active server games.
ServerGame.active = { };

// Gets a game by its game id.
ServerGame.get = function(gameId, callback) {
	let cur = ServerGame.active[gameId];
	if (cur) return cur;
	
	let player1 = new Player();
	player1.name = "Player 1";
	player1.userId = 1;
	
	let player2 = new Player();
	player2.name = "Player 2";
	player2.userId = 2;
	
	let setup = new Game.Setup(
		[player1, player2],[
			["you_gain_5"],
			["you_draw_2"],
			["insert_amendment_conditional", "you", "decide_bool", "you"],
			["specify_action_optional", "you"],
			["you_draw_2"]
		], defaultDeck);
	
	let game = ServerGame.active[gameId] = new ServerGame(setup);
	callback(game);
}

ServerGame.prototype = Object.create(Game.prototype);

ServerGame.prototype.drawCards = function*(player, count) {
	while (count > 0) {
		let cardCommitment = this.createCommitment(null, Format.card);
		this.resolveCommitment(cardCommitment, this.deck.draw());
		yield this.drawCard(player, cardCommitment);
		count--;
	}
}

ServerGame.prototype.random = function*(range) {
	let commitment = this.createCommitment(null, Format.num(limit));
	this.resolveCommitment(commitment, Math.floor(Math.random() * range));
	return commitment;
}

// Handles a message sent to this game.
ServerGame.prototype.handle = function(request, callback) {
	let type = request.messageType;
	if (type === "intro") {
		callback({
			setup: this.setup
		});
	} else {
		callback(null);	
	}
}


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

console.log("Server running...");