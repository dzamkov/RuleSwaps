
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

// Sends the given object with an ajax request, and calls the given callback with the
// response.
function ajax(request, callback) {
	let xhttp = new XMLHttpRequest();
	xhttp.withCredentials = true;
	xhttp.open("POST", window.location, true);
	xhttp.onload = function(e) {
		if (callback) callback(JSON.parse(xhttp.responseText));
	}
	xhttp.send(JSON.stringify(request));
}