let http = require("http");
let url = require("url");
let path = require("path");
let fs = require("fs");
let mime = require("mime");

let port = parseInt(process.argv[2], 10);

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

// Responds with a specific file.
function respondFile(response, file) {
	let filename = path.join(process.cwd(), file);
	fs.readFile(filename, "binary", function(err, file) {
		if (err) {
			respondError(response);
		} else {
			response.writeHead(200, { "Content-Type": "text/html" });
			response.write(file, "binary");
			response.end();
		}
	});
}

// Waits until all content for the given request has been loaded, then calls
// the given callback with the content as a string.
function awaitRequest(request, callback) {
	let buf = "";
	request.on("data", function(chunk) {
		buf += chunk;
		// TODO: Limit request size, look in to better way of streaming
	});
	request.on("end", function() {
		callback(buf);
	});
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
				respondFile(response, "static/game.html");
			} else if (request.method === "POST") {
				
				// Response to game message
				let gameId = parts[2];
				let game = null;
				let message = null;
				
				ServerGame.get(gameId, function(nGame) {
					game = nGame;
					if (game && message) game.handle(message, respondJSON.bind(null, response));
				});
				
				awaitRequest(request, function(buf) {
					message = JSON.parse(buf); // TODO: Handle errors here
					message = Format.message.general.decode(message);
					if (game && message) game.handle(message, respondJSON.bind(null, response));
				});
			} else {
				respondNotFound(response);
			}
		} else if (parts.length === 3 && parts[1] === "lobby") {
			if (parts.length === 3 && request.method === "GET") {
				respondFile(response, "static/lobby.html");
			} else if (request.method === "POST") {

				// Respond to lobby message
				let lobbyId = parts[2];
				awaitRequest(request, function(buf) {
					let message = JSON.parse(buf); // TODO: Handle errors here
					message = Format.message.general.decode(message);
					User.getBySessionId(message.sessionId).then(user => {
						let lobby = Lobby.get(user, lobbyId);
						lobby.handle(user, message.type, message.content, respondJSON.bind(null, response));
					});
				});
			} else {
				respondNotFound(response);
			}
		} else {
			respondNotFound(response);
		}
	}
	
}).listen(port);

// Detect errors in promises
process.on("unhandledRejection", err => { throw err; })

// Print deck stats
let deck = CardSet.create(defaultDeck);
console.log("Total card types: ", Object.keys(deck.counts).length);
console.log("Total cards in deck: ", deck.totalCount);

let roleCounts = deck.getRoleCounts();
console.log("Total action cards: ", roleCounts[0]);
console.log("Total condition cards: ", roleCounts[1]);
console.log("Total player cards: ", roleCounts[2]);

console.log("Server running...");