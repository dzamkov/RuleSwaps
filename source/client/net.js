
// Inspect cookies
let sessionId = null;
(function() {
	let changed = false;
	if (document.cookie) {
		let content = Cookie.parse(document.cookie);
		sessionId = content.sessionId;
	}
	if (!sessionId) {

		// Create random session id
		sessionId = (Math.random() + 1).toString(36).substring(2, 12);
		changed = true;
	}
	if (changed) {
		document.cookie = Cookie.buildPersistent({
			sessionId: sessionId
		});
	}
})();

// Identifier for this tab, used for persistence within a page, but not between pages.
let tabId = (Math.random() + 1).toString(36).substring(2, 12);

// Sends the given object with an ajax request, and calls the given callback with the
// response.
function ajax(request, callback) {
	let xhttp = new XMLHttpRequest();
	xhttp.withCredentials = true;
	xhttp.open("POST", window.location, true);
	xhttp.setRequestHeader("Tab-Id", tabId);
	xhttp.onload = function(e) {
		if (callback) callback(JSON.parse(xhttp.responseText));
	}
	xhttp.send(JSON.stringify(request));
}

// Send unload message
window.onbeforeunload = function() {
	let xhttp = new XMLHttpRequest();
	xhttp.withCredentials = true;
	xhttp.open("POST", window.location, true);
	xhttp.setRequestHeader("Tab-Id", tabId);
	xhttp.send("CLOSE");
};


// Describes a user
function User(userId, name) {
	this.userId = userId;
	this.name = name;
}

// Creates a new user structure with the given id and info.
User.create = function(userId, info) {
	return new User(userId, info.name);
};