// Starts the game given the response to the "intro" request.
function start(response) {
	let setup = response.setup;
	let playerInfos = response.players;
	let selfId = response.youId;
	
	let inteface = new Interface(setup, playerInfos, selfId, {
		deckDraw: document.getElementById("deck-draw"),
		deckDiscard: document.getElementById("deck-discard"),
		deckPlay: document.getElementById("deck-play"),
		
		constitutionNumbers: document.getElementById("section-constitution-numbers"),
		constitutionList: document.getElementById("section-constitution-list"),
		log: document.getElementById("section-log"),
		
		inputOptions: document.getElementById("input-options"),
		
		inputPayment: document.getElementById("input-payment"),
		inputPaymentHandle: document.getElementById("input-payment-slider-handle"),
		inputPaymentBar: document.getElementById("input-payment-slider-bar"),
		inputPaymentButtons: document.getElementById("input-payment-buttons"),
		
		inputCards: document.getElementById("input-cards"),
		inputCardsList: document.getElementById("input-cards-list"),
		inputCardsButtons: document.getElementById("input-cards-buttons"),
		
		inputExpression: document.getElementById("input-expression"),
		inputExpressionList: document.getElementById("input-expression-list"),
		inputExpressionButtons: document.getElementById("input-expression-buttons"),
		
		inputChatSelector: document.getElementById("input-chat-selector"),
		inputChatTextbox: document.getElementById("input-chat-box"),
		inputChatButton: document.getElementById("input-chat-button"),
		
		selfBack: document.getElementById("player-self-back"),
		selfHand: document.getElementById("section-player-self-hand"),
		selfCoins: document.getElementById("player-self-coins"),
		selfCards: document.getElementById("player-self-cards"),
		
		playersLeft: document.getElementById("players-left"),
		playersRight: document.getElementById("players-right")
	});
	
	// Send a message upon resolving a commitment.
	inteface.resolveCommitment = function(commitment, value) {
		request("commit", Format.message.game.commit.encode({
			id: commitment.id,
			value: commitment.format.encode(value)
		}));
		Interface.prototype.resolveCommitment.call(this, commitment, value);
	}
	
	// Set up chat listener
	inteface.onSay = function(recipient, content) {
		request("chat", Format.message.game.chat.encode(content));
	}
	
	// Applies the data in a poll response to the interface.
	function processPollData(data) {
		for (let commitmentId in data.commitments) {
			let commitment = inteface.getCommitment(commitmentId);
			if (!commitment.isResolved) commitment.resolveEncoded(data.commitments[commitmentId]); 
		}
		for (let i = 0; i < data.messages.length; i++) {
			let message = data.messages[i];
			inteface.chat(inteface.players[message.playerId], message.content);
		}
		inteface.run();
		poll(data.baseCommitmentId, data.messageId);
	}
	
	// Applies a poll response message to the interface.
	function processPollResponse(response) {
		processPollData(Format.message.game.pollResponse.decode(response));
	}
	
	// Performs a polling query for more game information.
	function poll(baseCommitmentId, messageId) {
		request("poll", Format.message.game.pollRequest.encode({
			baseCommitmentId: baseCommitmentId,
			messageId: messageId
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

request("intro", null, function(response) {
	introResponse = Format.message.game.introResponse.decode(response);
	if (loaded && introResponse) start(introResponse);
});