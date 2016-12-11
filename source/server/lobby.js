// Describes a game lobby.
function Lobby(lobbyId, setup) {
	this.lobbyId = lobbyId;
	this.host = null;
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

	// The set of all tabs displaying this lobby.
	this.tabs = { };

	// The set of all users in this lobby.
	this.users = { };

	// The tentative list of players for the game.
	this.players = [];
}

// The set of all active lobbies, organized by lobby ID.
Lobby.active = { };

// Gets or creates a lobby.
Lobby.get = function(lobbyId, setup) {
	let lobby = Lobby.active[lobbyId];
	if (lobby) return lobby;
	lobby = new Lobby(lobbyId, setup);
	Lobby.active[lobbyId] = lobby;
	return lobby;
};

// Called to indicate this lobby was abandoned.
Lobby.prototype.abandon = function() {
	delete Lobby.active[this.lobbyId];
};

// Gets the lobby tab corresponding to the given tab. This may connect the corresponding user to the lobby.
Lobby.prototype.getTab = function(tab) {
	if (!this.tabs[tab.uniqueId]) {

		// Connect user
		if (!this.users[tab.user.userId]) {
			this.users[tab.user.userId] = tab.user;

			// Add as host if no other exists
			if (!this.host) {
				this.host = tab.user;
				this.players.push({ user: tab.user, isReady: false });
			} else {
				this.broadcast({
					type: "userJoin",
					content: {
						userId: tab.user.userId,
						userInfo: tab.user.info,
						isPlayer: false
					}
				});
			}
		}

		// Handle tab closing
		this.tabs[tab.uniqueId] = tab;
		let lobby = this;
		let curClose = tab.close;
		tab.close = function() {
			curClose.call(tab);
			delete lobby.tabs[tab.uniqueId];

			// Check if the lobby has been abandoned or the user disconnected.
			let user = tab.user;
			let needDisconnect = true;
			let needAbandon = true;
			for (let uniqueId in lobby.tabs) {
				needAbandon = false;
				if (lobby.tabs[uniqueId].user === user) {
					needDisconnect = false;
					break;
				}
			}

			if (needAbandon) {
				lobby.abandon();
			} else {

				// Disconnect
				if (needDisconnect) {
					for (let i = 0; i < lobby.players.length; i++) {
						if (lobby.players[i].user === user) {
							lobby.players.splice(i, 1);
							break;
						}
					}
					delete lobby.users[user.userId];

					// TODO: Change host if needed

					// Send disconnect message
					lobby.broadcast({
						type: "userLeave",
						content: {
							userId: user.userId,
							wasKicked: false,
							hostId: lobby.host.userId
						}
					});
				}
			}
		};

		// Establish message queue
		tab.messageQueue = [];
	}
	return tab;
};

// Sends a (formatted) message to all users in this lobby, except maybe to a certain tab.
Lobby.prototype.broadcast = function(message, excludeUniqueId) {
	for (let uniqueId in this.tabs) {
		let tab = this.tabs[uniqueId];
		if (uniqueId !== excludeUniqueId)
			tab.messageQueue.push(message);
		if (tab.messageQueue.length > 0 && tab.respond(tab.messageQueue))
			tab.messageQueue = [];
	}
};


// Handles a message sent to this lobby.
Lobby.prototype.handle = function(tab, message, callback) {
	tab = this.getTab(tab);
	if (message.type === "intro") {

		// Return lobby info
		let users = { };
		let players = this.players.map(p => ({ userId: p.user.userId, isReady: p.isReady }));
		for (let userId in this.users) {
			users[userId] = this.users[userId].info;
		}
		callback(Format.message.lobby.response.intro.encode({
			users: users,
			players: players,
			hostId: this.host.userId,
			youId: tab.user.userId,
			setup: this.setup
		}));
		return;

	} else if (message.type === "poll") {

		tab.poll(callback);
		if (tab.messageQueue.length > 0) {
			tab.respond(tab.messageQueue);
			tab.messageQueue = [];
		}
		return;

	} else if (message.type === "chat") {
		this.broadcast({
			type: "chat",
			content: {
				userId: tab.user.userId,
				text: message.content
			}
		}, tab.uniqueId);
		callback(true);
		return;

	} else if (message.type === "shuffle") {
		if (tab.user === this.host) {
			this.players = [];
			let isPlayer = { };
			for (let i = 0; i < message.content.length; i++) {
				let userId = message.content[i];
				let user = this.users[userId];
				if (user && !isPlayer[userId]) {
					this.players.push({ user: user, isReady: false });
					isPlayer[userId] = true;
				}
			}
			this.broadcast({
				type: "shuffle",
				content: this.players.map(p => p.user.userId)
			}, tab.uniqueId);
			callback(true);
			return;
		}
	}

	callback(false);
	return;
};