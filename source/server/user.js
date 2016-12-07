// Identifies and describes a user.
function User(userId, sessionId, info) {
	this.userId = userId;
	this.sessionId = sessionId;
	this.info = info;
	this.isOnline = false;

	// The set of active lobbies this user is in.
	this.lobbies = { };

	// The set of active games this user is in.
	this.games = { };
}

// The set of all users that are connected to the server, organized by session ID.
User.onlineBySessionId = { };

// Creates a new temporary user with the given name and session ID, returned as a promise.
User.create = function(sessionId, name) {
	return new Promise((resolve, reject) => {
		crypto.randomBytes(8, (err, buf) => {
			if (err) return reject(err);
			let userId = buf.toString("hex");
			let info = { name: name };
			resolve(new User(userId, sessionId, info));
		});
	});
};

// Gets the user associated with the given session ID, returned as a promise. The resulting user is
// temporary and should be brought online if they have a persistent connection.
User.getBySessionId = function(sessionId) {

	// Check if user is online
	let res = User.onlineBySessionId[sessionId];
	if (res) return Promise.resolve(res);

	// Check if user is in database
	// TODO

	// Create a memory-only user
	return User.create(sessionId, "New Player");
};

// Brings this user online, if they aren't already.
User.prototype.bump = function() {
	if (!this.isOnline) {
		this.isOnline = true;
		User.onlineBySessionId[this.sessionId] = this;
	}
};