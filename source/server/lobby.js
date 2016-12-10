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

	// The set of all users (described as lobby users) in this lobby.
	this.users = {};
	this.connect(host);

	// The tentative list of players for the game.
	this.players = [{ user: host, isReady: false }];
}

// The set of all active lobbies, organized by lobby ID.
Lobby.active = {};

// Creates a new lobby with the given user as its host, returned as a promise.
Lobby.create = function(host, setup) {
	return new Promise((resolve, reject) => {
		function tryCreate() {
			crypto.randomBytes(3, (err, buf) => {
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

// Sets the given user to timeout after the given time.
Lobby.prototype.setTimeout = function(lobbyUser, time) {
	let lobby = this;
	time = time | 2000;
	lobby.clearTimeout(lobbyUser);
	lobbyUser.timeoutHandle = setTimeout(function() {
		lobbyUser.timeoutHandle = null;
		lobby.disconnect(lobbyUser);
	}, time);
};

// Clears the timeout for the given user.
Lobby.prototype.clearTimeout = function(lobbyUser) {
	if (lobbyUser.timeoutHandle) {
		clearTimeout(lobbyUser.timeoutHandle);
		lobbyUser.timeoutHandle = null;
	}
};

// Connects a user to this lobby.
Lobby.prototype.connect = function(user) {
	let lobbyUser = {
		user: user,
		timeoutHandle: null
	};
	this.setTimeout(lobbyUser);
	this.users[user.userId] = lobbyUser;
	user.connectLobby(this);
	return lobbyUser;
};

// Disconnects a user from this lobby.
Lobby.prototype.disconnect = function(lobbyUser) {
	// TODO: Remove from players list
	this.clearTimeout(lobbyUser);
	delete this.users[lobbyUser.user.userId];
	lobbyUser.user.disconnectLobby(this);
};

// Adds the given user to this lobby, if they aren't already.
Lobby.prototype.bump = function(user) {
	let lobbyUser = this.users[user.userId];
	if (lobbyUser) {

		// Update timeout
		if (lobbyUser.timeoutHandle)
			this.setTimeout(lobbyUser);
	} else {
		this.connect(user);
	}
};

// Handles a message sent to this lobby.
Lobby.prototype.handle = function(user, message, callback) {
	this.bump(user);
	if (message.type === "intro") {

		// Return lobby info
		let users = { };
		let players = [];
		for (let userId in this.users) {
			users[userId] = this.users[userId].user.info;
		}
		for (let i = 0; i < this.players.length; i++) {
			let player = this.players[i];
			players.push({ userId: player.user.userId, isReady: player.isReady });
		}
		callback(Format.message.lobby.response.intro.encode({
			users: users,
			players: players,
			host: this.host.userId,
			setup: this.setup
		}));

	} else {
		callback("false");
	}
};