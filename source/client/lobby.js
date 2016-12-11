// Update UI with lobby-specific concepts
(function() {

	// Augments an element to be a draggable user indicator.
	function UserEntry(element, name, status, user) {
		Motion.Animated.call(this, element);
		this.name = name;
		this.status = status;
		this.hoverStyle = "-hover";

		this.user = user;
		this.isReady = null;
		this.isHost = false;
	}

	UserEntry.prototype = Object.create(Motion.Animated.prototype);

	// Creates a new user entry.
	UserEntry.create = function(user, isReady) {
		let container = document.createElement("div");
		container.className = "user-entry -animated";
		let name = document.createElement("div");
		name.className = "name";
		container.appendChild(name);
		let status = document.createElement("div");
		status.className = "status";
		container.appendChild(status);
		let entry = new UserEntry(container, name, status, user);
		entry.setUser(user);
		entry.setReady(isReady);
		return entry;
	};

	// Updates the information for the user associated with this entry.
	UserEntry.prototype.setUser = function(user) {
		this.user = user;
		this.name.innerText = user.name;
	};

	// Sets whether the user associated with this entry is ready or not. If the passed value is null,
	// the entry is assumed to be for a non-player.
	UserEntry.prototype.setReady = function(isReady) {
		if (typeof isReady === "boolean") {
			if (this.isReady !== isReady) {
				this.element.className += " -player";
				this.status.className = "status " + (isReady ? "-ready" : "-notready");
				this.isReady = isReady;
			}
		} else if (this.isReady !== null) {
			this.element.className = this.element.className.replace(" -player", "");
			this.status.className = "";
			this.isReady = null;
		}
	};

	// Sets whether the user for this entry is the host.
	UserEntry.prototype.setHost = function(isHost) {
		if (this.isHost !== isHost) {
			if (isHost) {
				this.element.className += " -host";
			} else {
				this.element.className = this.element.className.replace(" -host", "");
			}
			this.isHost = isHost;
		}
	};

	// Augments an element to be a user list.
	function UserList(element) {
		Motion.Acceptor.call(this, element);
	}

	UserList.prototype = Object.create(Motion.Acceptor.prototype);

	UserList.prototype.balanceChildren = function() {
		let element = this.element;
		let children = element.children;
		let computedStyle = window.getComputedStyle(element);
		let paddingLeft = parseFloat(computedStyle.paddingLeft || 0);
		let paddingTop = parseFloat(computedStyle.paddingTop || 0);
		let spacing = parseFloat(computedStyle.borderSpacing || 0);
		let top = paddingTop;
		for (let i = 0; i < children.length; i++) {
			children[i].animated.moveTo(paddingLeft, top);
			top += children[i].offsetHeight + spacing;
		}
	};

	UserList.prototype.dragOut = function(element) {
		if (this.canDrag() && element.animated instanceof UserEntry) {
			let hole = document.createElement("div");
			hole.className = "user-entry -hole";
			element.animated.hole = hole;
			let rect = element.animated.getClientRect();
			element.style.width = rect.width + "px";
			hole.style.height = rect.height + "px";
			element.animated.replace(new Motion.Animated(hole));
			return {
				rect: rect,
				animated: element.animated,
				hole: hole
			}
		}
	}

	UserList.prototype.dragIn = function(animated, left, top, fromAcceptor) {
		if (animated instanceof UserEntry) {
			let children = this.element.children;
			let prev = null;
			for (let i = 0; i < children.length; i++) {
				let child = children[i];
				let rect = child.animated.getTargetRect();
				let midY = (rect.top + rect.bottom) / 2.0;
				if (midY < top) {
					prev = child;
				} else {
					break;
				}
			}

			let next = prev ? prev.nextSibling : this.element.firstChild;
			if (animated.hole === prev) return prev;
			if (animated.hole === next) return next;

			this.element.insertBefore(animated.hole, next);
			if (fromAcceptor !== this) fromAcceptor.balanceChildren();
			this.balanceChildren();
			return animated.hole;
		}
	}

	UserList.prototype.leave = function(animated, hole) {
		this.element.removeChild(hole);
		this.balanceChildren();
	};

	// Gets whether dragging items out of this list is allowed.
	UserList.prototype.canDrag = function() {
		return true;
	};

	// Appends an entry at the end of this let.
	UserList.prototype.appendEntry = function(entry) {
		this.element.appendChild(entry.element);
		this.balanceChildren();
	};

	// Sets the list of entries in this list.
	UserList.prototype.setEntries = function(entries) {
		while (this.element.lastChild) this.element.removeChild(this.element.lastChild);
		for (let i = 0; i < entries.length; i++) {
			this.element.appendChild(entries[i].element);
		}
		this.balanceChildren();
	};

	// Gets the list of entries in this list.
	UserList.prototype.getEntries = function() {
		let entries = [];
		let children = this.element.children;
		for (let i = 0; i < children.length; i++) {
			let entry = children[i].animated;
			if (entry) entries.push(entry);
		}
		return entries;
	};

	// Removes an entry from this list.
	UserList.prototype.removeEntry = function(entry) {
		if (entry.element.parentNode === this.element) {
			this.element.removeChild(entry.element);
			this.balanceChildren();
			return true;
		} else {
			return false;
		}
	};

	this.UserEntry = UserEntry;
	this.UserList = UserList;
}).call(UI);

// Starts the lobby given the response to the "intro" request.
function start(response) {
	
	let log = new UI.Log(document.getElementById("section-chat-log"));
	let chat = new UI.Chat(null,
		document.getElementById("input-chat-box"),
		document.getElementById("input-chat-button"));
	let playerList = new UI.UserList(document.getElementById("section-player-list"));
	let observerList = new UI.UserList(document.getElementById("section-observer-list"));

	// User entries
	let userEntries = {};
	(function() {
		let observerEntries = {};
		let playerEntries = [];
		for (let userId in response.users) {
			let user = User.create(userId, response.users[userId]);
			let entry = UI.UserEntry.create(user, null);
			entry.setHost(response.hostId === user.userId);
			userEntries[userId] = entry;
			observerEntries[userId] = entry;
		}
		for (let i = 0; i < response.players.length; i++) {
			let playerInfo = response.players[i];
			let entry = userEntries[playerInfo.userId];
			entry.setReady(playerInfo.isReady);
			playerEntries.push(entry);
			delete observerEntries[playerInfo.userId];
		}
		playerList.setEntries(playerEntries);
		observerList.setEntries(Object.values(observerEntries));
	})();
	let meEntry = userEntries[response.youId];
	playerList.canDrag = observerList.canDrag = () => meEntry.isHost;

	// Clears the ready status for all players
	function clearReady() {
		let playerEntries = playerList.getEntries();
		for (let i = 0; i < playerEntries.length; i++)
			playerEntries[i].setReady(false);
	}

	// Handle player rearrangement
	playerList.accept = function(entry, hole, fromAcceptor) {
		// TODO: What if player disconnects while dragging?
		UI.UserList.prototype.accept.call(this, entry, hole, fromAcceptor);

		// Send player shuffle message
		ajax(Format.message.lobby.request.encode({
			type: "shuffle",
			content: playerList.getEntries().map(e => e.user.userId)
		}));

		// Clear player ready status
		clearReady();
	};
	observerList.accept = function(entry, hole, fromAcceptor) {
		// TODO: What if player disconnects while dragging?
		UI.UserList.prototype.accept.call(this, entry, hole, fromAcceptor);
		if (fromAcceptor === playerList) {

			// Send player shuffle message
			ajax(Format.message.lobby.request.encode({
				type: "shuffle",
				content: playerList.getEntries().map(e => e.user.userId)
			}));

			entry.setReady(null);
		}
	};

	// Updates the lobby in response to a message
	function update(message) {
		let type = message.type;
		let content = message.content;
		if (type === "chat") {
			log.chat(0, userEntries[content.userId].user, content.text);
		} else if (type === "userJoin") {
			let user = User.create(content.userId, content.userInfo);
			let entry = UI.UserEntry.create(user, null);
			userEntries[user.userId] = entry;
			if (content.isPlayer) {
				playerList.appendEntry(entry);
				clearReady();
			} else {
				observerList.appendEntry(entry);
			}
			log.log(0, [user, " has joined the lobby"]);
		} else if (type === "userLeave") {
			let entry = userEntries[content.userId];
			delete userEntries[content.userId];
			if (playerList.removeEntry(entry)) {
				clearReady();
			} else {
				observerList.removeEntry(entry);
			}
			log.log(0, [entry.user, content.wasKicked ? " was kicked by the host" : " has left the lobby"]);
		} else if (type === "shuffle") {
			let observerEntries = observerList.getEntries();
			let accountedForEntries = { };
			for (let i = 0; i < observerEntries.length; i++) {
				let entry = observerEntries[i];
				accountedForEntries[entry.user.userId] = entry;
			}
			let playerEntries = [];
			for (let i = 0; i < content.length; i++) {
				let userId = content[i];
				let entry = userEntries[userId];
				playerList.appendEntry(entry);
				accountedForEntries[userId] = entry;
			}
			for (let userId in userEntries) {
				if (!accountedForEntries[userId]) {
					let entry = userEntries[userId];
					entry.setReady(null);
					observerList.appendEntry(entry);
				}
			}
			clearReady();
			log.log(0, ["The host has shuffled around players"]);
		}
	}

	// Set up chat
	chat.onSay = function(recipient, text) {
		log.chat(0, meEntry.user, text);
		ajax(Format.message.lobby.request.encode({
			type: "chat",
			content: text
		}));
	};

	// Polling
	function poll() {
		ajax(Format.message.lobby.request.encode({
			type: "poll",
			content: null
		}), function(response) {
			for (let i = 0; i < response.length; i++)
				update(response[i]);
			poll();
		});
	}
	poll();
}

// Handle loading
let loaded = false;
let introResponse = null;

window.onload = function() {
	loaded = true;
	if (loaded && introResponse) start(introResponse);
}

ajax(Format.message.lobby.request.encode({
	type: "intro",
	content: null
}), function(response) {
	introResponse = Format.message.lobby.response.intro.decode(response);
	if (loaded && introResponse) start(introResponse);
});