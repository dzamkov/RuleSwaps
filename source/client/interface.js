// A client-specific interface to a game.
function Interface(setup, playerSelf, parts) {
	this.delayTimeout = null;
	
	// Set up UI
	this.ui = {
		parts: parts,
		deck: {
			draw: new UI.Deck(parts.deckDraw),
			discard: new UI.Deck(parts.deckDiscard),
			play: new UI.Deck(parts.deckPlay)
		},
		hand: new UI.Hand(parts.selfHand),
		constitution: new UI.Constitution(
			parts.constitutionNumbers,
			parts.constitutionList),
		log: new UI.Log(parts.log),
		input: {
			expression: new UI.Input.Expression(
				parts.inputExpression,
				parts.inputExpressionList,
				parts.inputExpressionAccept,
				parts.inputExpressionPass)
		}
	};
	
	this.ui.input.expression.log = this.ui.log;
	this.ui.input.expression.returnHand = this.ui.hand;
	// this.ui.input.expression.playDeck = this.ui.deck.play;
	
	// Set up game
	Game.call(this, setup);
	this.ui.constitution.populate(this.constitution);
	this.playerSelf = this.players[playerSelf];
}

// Derive interface from game.
Interface.prototype = Object.create(Game.prototype);

Interface.prototype.run = function() {
	if (!this.delayTimeout) {
		Game.prototype.run.call(this);
	}
}

Interface.prototype.resolveCommitment = function(commitment, value) {
	// TODO: Send message
	Game.prototype.resolveCommitment.call(this, commitment, value);
	if (!this.isRunning) this.run();
}

Interface.prototype.log = function*() {
	this.ui.log.log(this.getDepth(), arguments);
	this.delay(500);
	yield this.pause();
}

Interface.prototype.drawCard = function*(player, cardCommitment) {
	yield Game.prototype.drawCard.call(this, player, cardCommitment);
	if (this.playerSelf === player) {
		console.assert(cardCommitment.isResolved);
		let cardType = cardCommitment.value;
		
		let card = this.ui.deck.draw.pull(cardType);
		card.home = this.ui.hand;
		card.mergeInto(this.ui.hand, this.ui.hand.createInvisibleHole());
	}
}

Interface.prototype.interactSpecify = function*(player, role, style) {
	if (player === this.playerSelf) {
		let game = this;
		let commitment = this.createCommitment();
		this.ui.input.expression.request(role, style, function(exp) {
			game.resolveCommitment(commitment, exp);
		});
		yield this.revealTo(this.playerSelf, commitment);
		return commitment;
	} else {
		return Game.prototype.interactSpecify.call(this, player, role);
	}
}

// Stops the interface from running for the given length of time.
Interface.prototype.delay = function(time) {
	if (this.delayTimeout) clearTimeout(this.delayTimeout);
	this.delayTime = setTimeout((function() {
		this.delayTime = null;
		this.run();
	}).bind(this), time);
}