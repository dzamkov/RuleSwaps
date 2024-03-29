let http = require("http");
let url = require("url");
let path = require("path");
let fs = require("fs");
let mime = require("mime");

let port = parseInt(process.argv[2] || process.env["PORT"] || 80, 10);
if (fs.existsSync("output")) process.chdir("output");

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
			response.writeHead(200, { 
				"Content-Type": mime.lookup(filename),
				"Cache-Control": "public,max-age=60"
			});
			response.write(file, "binary");
			response.end();
		}
	});
}

// Returns the entire contents of the given request as a promise.
function getRequestContents(request) {
	return new Promise((resolve, reject) => {
		let buf = "";
		request.on("data", function(chunk) {
			buf += chunk;
			// TODO: Limit request size, look in to better way of streaming
		});
		request.on("end", function() {
			resolve(buf);
		});
	});
}

http.createServer(function(request, response) {
	let pathname = path.normalize(url.parse(request.url).pathname);
	
	// Check for static file
	if (pathname.startsWith("/static/")) {
		respondFile(response, pathname);
	} else {
		
		// Get headers
		let tabId = request.headers["tab-id"]; // TODO: Handle malformed
		let cookie = Cookie.parse(request.headers.cookie || ""); // TODO: Handle malformed
		let sessionId = cookie.sessionId || tabId;
		tabId = tabId || sessionId;

		let parts = pathname.split("/");
		console.assert(parts[0] === "");
		if (pathname === "/") {
			respondFile(response, "static/home.html");
			return;
		} else if (pathname === "/favicon.ico") {
			respondFile(response, "static/images/favicon-16x16.png");
			return;
		} else if (pathname === "/rulebook") {
			respondFile(response, "static/rulebook.html");
			return;
		} else if (pathname === "/practice") {

			// Create a practice game
			User.getBySessionId(sessionId).then(user => {
				return ServerGame.create(defaultSetup, [
					{ user: user, name: user.info.name },
					{ user: null, name: "JaneBot" },
					{ user: null, name: "MontyBot" }
				]);
			}).then(game => {

				// Redirect to game
				response.writeHead(302, { "Location": "/game/" + game.gameId });
				response.end();
			});
			return;

		} else if (pathname === "/createprivate") {

			// Create a private lobby
			Lobby.create(defaultSetup).then(lobby => {

				// Redirect to lobby
				response.writeHead(302, { "Location": "/lobby/" + lobby.lobbyId });
				response.end();
			});
			return;
			
		} else if (parts.length === 3 && parts[1] === "game") {
			if (request.method === "GET") {

				respondFile(response, "static/game.html");
				return;

			} else if (request.method === "POST") {
				
				// Response to game message
				let gameId = parts[2];
				Promise.all([
					getRequestContents(request),
					User.getBySessionId(sessionId),
					ServerGame.get(gameId)
				]).then(values => {
					let buf = values[0];
					let user = values[1];
					let game = values[2];
					if (game) {
						if (buf === "CLOSE") {
							user.getTab(tabId).close();
						} else {
							let message = JSON.parse(buf); // TODO: Handle errors here
							message = Format.message.game.request.decode(message);
							let tab = user.getTab(tabId);
							tab.bump();
							game.handle(tab, message, respondJSON.bind(null, response));
						}
					} else {
						respondNotFound(response);
					}
				});
				return;
			}
		} else if (parts.length === 3 && parts[1] === "lobby") {
			if (request.method === "GET") {

				respondFile(response, "static/lobby.html");
				return;

			} else if (request.method === "POST") {

				// Respond to lobby message
				let lobbyId = parts[2];
				Promise.all([
					getRequestContents(request),
					User.getBySessionId(sessionId),
					Lobby.get(lobbyId)
				]).then(values => {
					let buf = values[0];
					let user = values[1];
					let lobby = values[2];
					if (lobby) {
						if (buf === "CLOSE") {
							user.getTab(tabId).close();
						} else {
							let message = JSON.parse(buf); // TODO: Handle errors here
							message = Format.message.lobby.request.decode(message);
							let tab = user.getTab(tabId);
							tab.bump();
							lobby.handle(tab, message, respondJSON.bind(null, response));
						}
					} else {
						respondJSON(response, null);
					}
				});
				return;
			}
		}

		respondNotFound(response);
		return;
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

console.log("Server running on port " + port);