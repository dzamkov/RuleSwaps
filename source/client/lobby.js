// Starts the lobby given the response to the "intro" request.
function start(response) {
	
	let log = new UI.Log(document.getElementById("section-chat-log"));
	let chat = new UI.Chat(null,
		document.getElementById("input-chat-box"),
		document.getElementById("input-chat-button"));
	chat.onSay = function(recipient, message) {
		log.log(0, message, UI.Log.Style.Chat);
	};
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