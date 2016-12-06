// Starts the lobby given the response to the "intro" request.
function start(response) {
	
}

// Handle loading
let loaded = false;
let introResponse = null;

window.onload = function() {
	loaded = true;
	if (loaded && introResponse) start(introResponse);
}

request("intro", null, function(response) {
	introResponse = Format.message.lobby.introResponse.decode(response);
	if (loaded && introResponse) start(introResponse);
});