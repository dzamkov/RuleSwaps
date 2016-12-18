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

	UserList.prototype.dragGrab = function(element) {
		if (this.canDrag()) {
			let entry = Motion.Animated.get(element);
			if (entry instanceof UserEntry) {
				entry.fromList = this;
				entry.pin();
				let hole = entry.element.parentNode;
				if (!hole || hole === this.element) {
					hole = document.createElement("div");
					hole.className = "user-entry -hole";
					new Motion.Animated(hole);
					this.element.replaceChild(hole, entry.element);
				}
				hole.holeFor = entry;
				entry.hole = hole;
				return entry;
			}
		}
		return null;
	};

	UserList.prototype.dragRelease = function(animated) {
		animated.settleHole(animated.hole);
		animated.hole = null;

		this.onDragAdd(animated, animated.fromList);
		animated.fromList = null;
	};

	UserList.prototype.dragEnterMove = function(animated, left, top, fromAcceptor) {
		if (animated instanceof UserEntry) {
			let prev = null;
			for (let child of this.element.children) {
				let rect = Motion.getTargetRect(this.element, child);
				let midY = rect.top + rect.height / 2.0;
				if (midY < top) {
					prev = child;
				} else {
					break;
				}
			}

			let next = prev ? prev.nextSibling : this.element.firstChild;
			if (animated.hole === prev) return prev;
			if (animated.hole === next) return next;

			animated.hole.animated.pin();
			Motion.Animated.pinAll(animated.hole.parentNode);
			Motion.Animated.pinAll(this.element);
			this.element.insertBefore(animated.hole, next);
			return animated.hole;
		}
	};

	// Gets whether dragging items out of this list is allowed.
	UserList.prototype.canDrag = function() {
		return true;
	};

	// Indicates that an entry has been dragged into this list.
	UserList.prototype.onDragAdd = function(entry, fromList) {
		// Override me
	};

	// Appends an entry at the end of this let.
	UserList.prototype.appendEntry = function(entry) {
		this.element.appendChild(entry.element);
	};

	// Sets the list of entries in this list.
	UserList.prototype.setEntries = function(entries) {
		while (this.element.lastChild) this.element.removeChild(this.element.lastChild);
		for (let i = 0; i < entries.length; i++) {
			this.element.appendChild(entries[i].element);
		}
	};

	// Gets the list of entries in this list.
	UserList.prototype.getEntries = function() {
		let entries = [];
		for (child of this.element.children) {
			let animated = child.animated;
			if (animated instanceof UserEntry)
				entries.push(animated);
			else if (child.holeFor instanceof UserEntry)
				entries.push(child.holeFor);
		}
		return entries;
	};

	// Removes an entry from this list.
	UserList.prototype.removeEntry = function(entry) {
		if (entry.hole) {
			if (entry.hole.parentNode === this.element) {
				entry.delete();
				this.element.removeChild(entry.hole);
				return true;
			}
		} else {
			let child = Motion.getImmediateChild(this.element, entry.element);
			if (child) {
				this.element.removeChild(child);
				return true;
			}
		}
		return false;
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
	let changeNameButton = new UI.Button(document.getElementById("change-name-button"));
	let readyButton = new UI.Button(document.getElementById("ready-button"), false);
	let unreadyButton = new UI.Button(document.getElementById("unready-button"), false);

	// User entries
	let userEntries = {};
	(function() {
		let observerEntries = {};
		let playerEntries = [];
		for (let userId in response.users) {
			let user = User.create(userId, response.users[userId]);
			let entry = UI.UserEntry.create(user, null);
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
	let hostEntry = userEntries[response.hostId];
	hostEntry.setHost(true);
	playerList.canDrag = observerList.canDrag = () => meEntry.isHost;

	// Change name button
	changeNameButton.onClick = function() {
		let oldName = meEntry.user.name;
		let newName = prompt("Choose a new name", oldName);
		if (oldName !== newName) {
			meEntry.user.name = newName;
			meEntry.setUser(meEntry.user);
			ajax(Format.message.lobby.request.encode({
				type: "changeName",
				content: newName
			}));
		}
	};

	// Updates the status of the buttons
	function updateButtons() {
		if (meEntry.isReady === true) {
			readyButton.setVisible(false);
			unreadyButton.setVisible(true);
		} else if (meEntry.isReady === false) {
			readyButton.setVisible(true);
			unreadyButton.setVisible(false);
		} else {
			readyButton.setVisible(false);
			unreadyButton.setVisible(false);
		}
	}
	function changeReady(isReady) {
		if (meEntry.isReady === !isReady) {
			meEntry.setReady(isReady);
			ajax(Format.message.lobby.request.encode({
				type: "ready",
				content: isReady
			}));
		}
		updateButtons();
	}
	readyButton.onClick = changeReady.bind(null, true);
	unreadyButton.onClick = changeReady.bind(null, false);
	updateButtons();

	// Clears the ready status for all players
	function clearReady() {
		let playerEntries = playerList.getEntries();
		for (let i = 0; i < playerEntries.length; i++)
			playerEntries[i].setReady(false);
		updateButtons();
	}

	// Makes a player an observer
	function makeObserver(entry) {
		entry.setReady(null);
		updateButtons();
	}

	// Handle player rearrangement
	playerList.onDragAdd = function(entry, fromList) {

		// TODO: Ignore when the order doesnt change

		// Send player shuffle message
		ajax(Format.message.lobby.request.encode({
			type: "shuffle",
			content: Array.from(playerList.getEntries(), e => e.user.userId)
		}));

		// Clear player ready status
		clearReady();
	};
	observerList.onDragAdd = function(entry, fromList) {
		if (fromList === playerList) {

			// Send player shuffle message
			ajax(Format.message.lobby.request.encode({
				type: "shuffle",
				content: Array.from(playerList.getEntries(), e => e.user.userId)
			}));

			makeObserver(entry);
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
				Motion.Animated.pinAll(playerList.element);
				playerList.appendEntry(entry);
				clearReady();
			} else {
				observerList.appendEntry(entry);
			}
			log.log(0, [user, " has joined the lobby"]);

		} else if (type === "userLeave") {

			Motion.Animated.pinAll(playerList.element);
			Motion.Animated.pinAll(observerList.element);

			let entry = userEntries[content.userId];
			if (entry) {
				delete userEntries[content.userId];
				if (playerList.removeEntry(entry)) {
					clearReady();
				} else {
					observerList.removeEntry(entry);
				}

				let message = [entry.user,
					content.wasKicked ? " was kicked by the host" : " has left the lobby"];
				if (content.hostId) {
					hostEntry.setHost(false);
					hostEntry = userEntries[content.hostId];
					hostEntry.setHost(true);
					message.push(Log.Break, hostEntry.user, " is the new host")
				}
				log.log(0, message);
			}

		} else if (type === "shuffle") {

			Motion.Animated.pinAll(playerList.element);
			Motion.Animated.pinAll(observerList.element);

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
					makeObserver(entry);
					observerList.appendEntry(entry);
				}
			}
			clearReady();

		} else if (type === "ready") {

			let entry = userEntries[content.userId];
			entry.setReady(content.isReady);
			updateButtons();

			if (content.isStarting) {
				log.log(0, ["All players are ready. the game will start in a moment"], UI.Log.Style.Victory);
			}

		} else if (type === "changeName") {

			let entry = userEntries[content.userId];
			let name = content.name;
			log.log(0, [entry.user, " changed their name to " + name])
			entry.user.name = name;
			entry.setUser(entry.user);
			
		} else if (type === "started") {
			window.location = "/game/" + content;
		}
		Motion.Animated.flush();
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