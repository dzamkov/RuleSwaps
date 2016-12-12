// Identifies and describes a user.
function User(userId, sessionId, info) {
	this.userId = userId;
	this.sessionId = sessionId;
	this.info = info;

	// The set of tabs this user has open.
	this.tabs = { };

	// The set of active games this user is a participant in.
	this.games = { };
}

// The set of all active users, organized by session ID.
User.activeBySessionId = { };

// Creates a new temporary user with the given name and session ID, returned as a promise.
User.create = function(sessionId, name) {
	return new Promise((resolve, reject) => {
		crypto.randomBytes(8, (err, buf) => {
			if (err) return reject(err);
			let userId = buf.toString("hex");
			let info = { name: name };
			let user = new User(userId, sessionId, info);
			User.activeBySessionId[sessionId] = user;
			resolve(user);
		});
	});
};

// Gets the user associated with the given session ID, returned as a promise. The resulting user is
// temporary and should be brought online if they have a persistent connection.
User.getBySessionId = function(sessionId) {

	// Check if user is active
	let res = User.activeBySessionId[sessionId];
	if (res) return Promise.resolve(res);

	// Check if user is in database
	// TODO

	// Create a memory-only user
	return User.create(sessionId, "New Player");
};

// Checks if this user is involved anywhere on the server, and if not, deactives the user.
User.prototype.clean = function() {
	for (let tabId in this.tabs) return;
	for (let gameId in this.games) return;
	delete User.activeBySessionId[this.userId];
};

// Gets a tab for this user.
User.prototype.getTab = function(tabId) {
	let tab = this.tabs[tabId];
	if (tab) return tab;
	tab = new User.Tab(this, tabId);
	this.tabs[tabId] = tab;
	return tab;
};

// Changes the name for this user.
User.prototype.changeName = function(name, excludeUniqueId) {
	this.info.name = name;

	// Find the lobbies this player is in.
	let lobbies = { };
	for (let tabId in this.tabs) {
		let tab = this.tabs[tabId];
		if (tab.lobby) {
			lobbies[tab.lobby.lobbyId] = tab.lobby;
		}
	}

	// Inform lobbies of name change
	for (let lobbyId in lobbies) {
		lobbies[lobbyId].userChangedName(this, name, excludeUniqueId);
	}
};

// Identifies a tab that a user may have open. Each tab is associated with exactly one area of the site.
User.Tab = function(user, tabId) {
	this.user = user;
	this.tabId = tabId;
	this.uniqueId = User.Tab.getUniqueId(user, tabId);
	this.callback = null;
	this.timeoutHandle = null;
	this.bump();
};

// Constructs a globally-unique ID for a tab based on the user and the tab ID.
User.Tab.getUniqueId = function(user, tabId) {
	return user.userId + tabId;
};

// Resets the timeout for this tab.
User.Tab.prototype.bump = function() {
	if (!this.callback) {
		if (this.timeoutHandle) clearTimeout(this.timeoutHandle);
		let tab = this;
		this.timeoutHandle = setTimeout(function() {
			tab.close();
		}, 5000);
	}
};

// Indicates that this tab is currently polling. Sets the callback used to respond to the polling message.
User.Tab.prototype.poll = function(callback) {
	this.callback = callback;
	if (this.timeoutHandle) clearTimeout(this.timeoutHandle);
};

// Provides a response to a polling request for this tab.
User.Tab.prototype.respond = function(response) {
	if (this.callback) {
		this.callback(response);
		this.callback = null;
		this.bump();
		return true;
	} else {
		return false;
	}
};

// Indicates that this tab has been closed.
User.Tab.prototype.close = function() {
	delete this.user.tabs[this.tabId];
	this.user.clean();
};