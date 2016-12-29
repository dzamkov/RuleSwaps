// Starts the game given the response to the "intro" request.
function start(response) {
	let setup = response.setup;
	let playerInfos = response.players;
	let selfId = response.youId;
	
	playerInfos = playerInfos.map(p => new User(p.userId, p.name));
	let inteface = new Interface(setup, playerInfos, selfId);
	
	// Send a message upon resolving a commitment.
	inteface.resolveCommitment = function(commitment, value) {
		ajax(Format.message.game.request.encode({
			type: "commit",
			content: {
				id: commitment.id,
				value: commitment.format.encode(value)
			}
		}));
		Interface.prototype.resolveCommitment.call(this, commitment, value);
	}
	
	// Set up chat listener
	inteface.onSay = function(recipient, content) {
		ajax(Format.message.game.request.encode({
			type: "chat",
			content: content
		}));
	}
	
	// Applies the data in a poll response to the interface.
	function processPollData(data) {
		for (let commitmentId in data.commitments) {
			let commitment = inteface.getCommitment(commitmentId);
			if (!commitment.isResolved) commitment.resolveEncoded(data.commitments[commitmentId]); 
		}
		for (let i = 0; i < data.chats.length; i++) {
			let chat = data.chats[i];
			inteface.chat(inteface.players[chat.playerId], chat.content);
		}
		inteface.run();
		poll(data.baseCommitmentId, data.chatId);
	}
	
	// Applies a poll response message to the interface.
	function processPollResponse(response) {
		processPollData(Format.message.game.response.poll.decode(response));
	}
	
	// Performs a polling query for more game information.
	function poll(baseCommitmentId, chatId) {
		ajax(Format.message.game.request.encode({
			type: "poll",
			content: {
				baseCommitmentId: baseCommitmentId,
				chatId: chatId
			}
		}), processPollResponse);
	}
	
	// Run game
	processPollData(response.data);
}

// Handle loading
let loaded = false;
let introResponse = null;

window.onload = function() {
	loaded = true;
	if (loaded && introResponse) start(introResponse);
}

ajax(Format.message.game.request.encode({
	type: "intro",
	content: null
}), function(response) {
	introResponse = Format.message.game.response.intro.decode(response);
	if (loaded && introResponse) start(introResponse);
});