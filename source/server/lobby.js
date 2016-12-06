// Describes a game lobby.
function Lobby(lobbyId, host, setup) {
	this.lobbyId = lobbyId;
	this.host = host;
	this.setup = setup || new Game.Setup([
			Expression.fromList(
				["you_gain_5"]),
			Expression.fromList(
				["player_draws_3", "you"]),
			Expression.fromList(
				["insert_amendment_conditional", "you",
				"player_decides", "auction_winner"]),
			Expression.fromList(
				["specify_action_optional", "you"]),
			Expression.fromList(
				["wealth_win"])
		], CardSet.create(defaultDeck));

	// The set of all users in this lobby.
	this.users = { };
	this.users[host.userId] = host;
	host.lobbies[lobbyId] = this;
	host.bump();

	// The tentative list of players for the game.
	this.players = [{ user: host, isReady: false }];
}

// The set of all active lobbies, organized by lobby ID.
Lobby.active = {};

// Creates a new lobby with the given user as its host, returned as a promise.
Lobby.create = function(host, setup) {
	return new Promise((resolve, reject) => {
		function tryCreate() {
			rypto.randomBytes(3, (err, buf) => {
				if (err) return reject(err);
				let lobbyId = buf.toString("hex");
				if (!Lobby.active[lobbyId]) {
					let lobby = new Lobby(lobbyId, host, setup);
					Lobby.active[lobbyId] = lobby;
					resolve(lobby);
				} else {
					
					// ID collision, try again.
					tryCreate();
				}
			});
		}
	});
};

// Gets or creates a lobby.
Lobby.get = function(user, lobbyId, setup) {
	let lobby = Lobby.active[lobbyId];
	if (lobby) return lobby;
	lobby = new Lobby(lobbyId, user, setup);
	Lobby.active[lobbyId] = lobby;
	return lobby;
};

// Adds the given user to this lobby, if they aren't already.
Lobby.prototype.bump = function(user) {
	if (!this.users[user.userId]) {
		this.users[user.userId] = user;
		user.lobbies[this.lobbyId] = this;
		user.bump();
	}
};

// Handles a message sent to this lobby.
Lobby.prototype.handle = function(user, type, content, callback) {
	if (type === "intro") {

		// Add user to lobby
		this.bump(user);

		// Return lobby info
		let users = { };
		let players = [];
		for (let userId in this.users) {
			users[userId] = this.users[userId].info;
		}
		for (let i = 0; i < this.players.length; i++) {
			let player = this.players[i];
			players.push({ userId: player.user.userId, isReady: player.isReady });
		}
		callback(Format.message.lobby.introResponse.encode({
			users: users,
			players: players,
			host: this.host.userId,
			setup: this.setup
		}));

	} else {
		callback("false");
	}
};