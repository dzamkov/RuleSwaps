// Update UI with lobby-specific concepts
(function() {

	// Augments an element to be a draggable user indicator.
	function UserEntry(element, name, status, userId) {
		Motion.Animated.call(this, element);
		this.name = name;
		this.status = status;
		this.hoverStyle = "-hover";

		this.userId = userId;
		this.userInfo = null;
		this.isReady = null;
	}

	UserEntry.prototype = Object.create(Motion.Animated.prototype);

	// Creates a new user entry.
	UserEntry.create = function(userId, info, isReady) {
		let container = document.createElement("div");
		container.className = "user-entry -animated";
		let name = document.createElement("div");
		name.className = "name";
		container.appendChild(name);
		let status = document.createElement("div");
		status.className = "status";
		container.appendChild(status);
		let entry = new UserEntry(container, name, status, userId);
		entry.setInfo(info);
		entry.setReady(isReady);
		return entry;
	};

	// Updates the information for the user associated with this entry.
	UserEntry.prototype.setInfo = function(info) {
		this.userInfo = info;
		this.name.innerText = info.name;
	};

	// Sets whether the user associated with this entry is ready or not. If the passed value is null,
	// the entry is assumed to be for a non-player.
	UserEntry.prototype.setReady = function(isReady) {
		if (typeof isReady === "boolean") {
			this.element.className = "user-entry -animated -player";
			if (this.isReady !== isReady) {
				this.status.className = "status " + (isReady ? "-ready" : "-notready");
				this.isReady = isReady;
			}
		} else if (this.isReady !== null) {
			this.element.className = "user-entry -animated";
			this.status.className = "";
			this.isReady = null;
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
		if (element.animated instanceof UserEntry) {
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

			animated.hole.parentNode.acceptor.balanceChildren();
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

	// Adds a user entry to this list.
	UserList.prototype.add = function(entry) {
		this.element.appendChild(entry.element);
		this.balanceChildren();
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

	chat.onSay = function(recipient, message) {
		log.log(0, message, UI.Log.Style.Chat);
	};

	// User entries
	let playerIds = [];
	let observerIds = { };
	let userEntries = { };
	for (let userId in response.users) {
		let userInfo = response.users[userId];
		let entry = UI.UserEntry.create(userId, userInfo, null);
		userEntries[userId] = entry;
		observerIds[userId] = true;
	}

	// Players
	for (let i = 0; i < response.players.length; i++) {
		let playerInfo = response.players[i];
		let entry = userEntries[playerInfo.userId];
		entry.setReady(playerInfo.isReady);
		delete observerIds[playerInfo.userId];
		playerIds.push(playerInfo.userId);
	}

	// Set up initial lists
	for (let i = 0; i < playerIds.length; i++) {
		playerList.add(userEntries[playerIds[i]]);
	}
	for (let id in observerIds) {
		observerList.add(userEntries[id]);
	}

	// Polling
	function poll() {
		ajax(Format.message.lobby.request.poll.encode({

		}), function(response) {

		});
	}
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