// Sends the given object with an ajax request, and calls the given callback with the
// response.
function ajax(request, callback) {
	let xhttp = new XMLHttpRequest();
	xhttp.open("POST", window.location, true);
	xhttp.onload = function(e) {
		if (callback) callback(JSON.parse(xhttp.responseText));
	}
	xhttp.send(JSON.stringify(request));
}

let sessionId = (Math.random() + 1).toString(36).substring(2, 7);

// Sends a game-related request.
function request(type, content, callback) {
	ajax(Format.message.general.encode({
		type: type,
		sessionId: sessionId,
		content: content
	}), callback);
}