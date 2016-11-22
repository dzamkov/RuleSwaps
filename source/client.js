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

// Starts the game given the response to the "intro" request.
function start(response) {
	let setup = response.setup;
	let inteface = new Interface(setup, 0, {
		deckDraw: document.getElementById("deck-draw"),
		deckDiscard: document.getElementById("deck-discard"),
		deckPlay: document.getElementById("deck-play"),
		
		constitutionNumbers: document.getElementById("section-constitution-numbers"),
		constitutionList: document.getElementById("section-constitution-list"),
		log: document.getElementById("section-log"),
		
		inputBoolean: document.getElementById("input-boolean"),
		inputBooleanYes: document.getElementById("input-boolean-yes"),
		inputBooleanNo: document.getElementById("input-boolean-no"),
		
		inputExpression: document.getElementById("input-expression"),
		inputExpressionList: document.getElementById("input-expression-list"),
		inputExpressionAccept: document.getElementById("input-expression-accept"),
		inputExpressionPass: document.getElementById("input-expression-pass"),
		
		selfHand: document.getElementById("section-player-self-hand")
	});
	
	// Send a message upon resolving a commitment.
	inteface.resolveCommitment = function(commitment, value) {
		ajax({
			messageType: "commit",
			commitmentId: commitment.id,
			commitmentValue: commitment.format.encode(value)
		});
		Interface.prototype.resolveCommitment.call(this, commitment, value);
	}
	
	// Performs a polling query for more game information.
	function poll(baseCommitmentId) {
		ajax({
			messageType: "poll",
			baseCommitmentId: baseCommitmentId
		}, function(response) {
			for (let commitmentId in response.commitments) {
				let commitment = inteface.getCommitment(commitmentId);
				if (!commitment.isResolved) commitment.resolveEncoded(response.commitments[commitmentId]);
			}
			inteface.run();
			poll(response.baseCommitmentId);
		});
	}
	
	// Run game
	inteface.run();
	poll(0);
}

// Handle loading
let loaded = false;
let introResponse = null;

window.onload = function() {
	loaded = true;
	if (loaded && introResponse) start(introResponse);
}

ajax({ messageType: "intro" }, function(response) {
	introResponse = response;
	if (loaded && introResponse) start(introResponse);
});