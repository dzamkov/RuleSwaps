// A client-specific interface to a game.
function Interface(setup, playerSelf, parts) {
	this.delayTimeout = null;
	
	// Set up UI
	this.ui = {
		parts: parts,
		deck: {
			draw: new UI.Deck(parts.deckDraw),
			discard: new UI.Deck(parts.deckDiscard),
		},
		hand: new UI.Hand(parts.selfHand),
		constitution: new UI.Constitution(
			parts.constitutionNumbers,
			parts.constitutionList),
		log: new UI.Log(parts.log),
		input: {
			bool: new UI.Input.Boolean(
				parts.inputBoolean,
				parts.inputBooleanYes,
				parts.inputBooleanNo),
			payment: new UI.Input.Payment(
				parts.inputPayment,
				parts.inputPaymentHandle,
				parts.inputPaymentBar,
				parts.inputPaymentYes,
				parts.inputPaymentNo,
				parts.inputPaymentPass),
			expression: new UI.Input.Expression(
				parts.inputExpression,
				parts.inputExpressionList,
				parts.inputExpressionAccept,
				parts.inputExpressionPass),
			chat: new UI.Input.Chat(
				parts.inputChatSelector,
				parts.inputChatTextbox,
				parts.inputChatButton)
		}
	};
	
	this.ui.input.expression.log = this.ui.log;
	this.ui.input.expression.returnHand = this.ui.hand;
	this.ui.input.chat.onSay = (function(recipient, message) {
		this.onSay(recipient, message);
	}).bind(this);
	
	// Set up game
	Game.call(this, setup);
	this.ui.constitution.populate(this.constitution);
	
	// Set up players
	this.playerSelf = this.players[playerSelf];
	this.playerSelf.info = new UI.PlayerInfo(this.playerSelf,
		parts.selfCoins, parts.selfCards, parts.selfBack);
	let otherPlayers = this.getPlayersFrom(this.playerSelf).slice(1);
	let split = Math.ceil(otherPlayers.length / 2);
	for (let i = split - 1; i >= 0; i--) {
		let playerInfo = UI.PlayerInfo.create(otherPlayers[i], true);
		parts.playersLeft.appendChild(playerInfo.container);
		otherPlayers[i].info = playerInfo;
	}
	for (let i = split; i < otherPlayers.length; i++) {
		let playerInfo = UI.PlayerInfo.create(otherPlayers[i], false);
		parts.playersRight.appendChild(playerInfo.container);
		otherPlayers[i].info = playerInfo;
	}
}

// Derive interface from game.
Interface.prototype = Object.create(Game.prototype);

Interface.prototype.run = function() {
	if (!this.delayTimeout) {
		Game.prototype.run.call(this);
	}
}

Interface.prototype.revealTo = function*(player, commitment) {
	if (this.playerSelf === player) {
		return yield this.awaitCommitment(commitment);
	} else {
		return null;
	}
}

Interface.prototype.log = function*() {
	this.ui.log.log(this.getDepth(), arguments, UI.Log.Style.Normal);
	yield this.delay(500);
}

Interface.prototype.win = function*(player) {
	this.ui.log.log(this.getDepth(), [player, " wins!"], UI.Log.Style.Victory);
	yield Game.prototype.win.call(this, player);
}

Interface.prototype.chat = function(player, message) {
	this.ui.log.log(this.getDepth(), [player, ": ", message], UI.Log.Style.Chat);
}

// An event fired in response to an outgoing chat.
Interface.prototype.onSay = function(recipient, message) {
	// Override me
}

Interface.prototype.setActiveLine = function*(line) {
	// TODO: problem with multiple proposals
	this.ui.constitution.setActiveLine(line);
	return yield Game.prototype.setActiveLine.call(this, line);
}

Interface.prototype.setCoins = function*(player, count) {
	player.info.setCoins(count);
	return yield Game.prototype.setCoins.call(this, player, count);
}

Interface.prototype.setHandSize = function*(player, handSize) {
	player.info.setCards(handSize);
	return yield Game.prototype.setHandSize.call(this, player, handSize);
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

// Resolves a commitment for this interface.
Interface.prototype.resolveCommitment = function(commitment, value) {
	console.assert(this.playerSelf === commitment.player);
	commitment.resolve(value);
	this.run();
}

Interface.prototype.interactBoolean = function*(player, style) {
	let commitment = Game.prototype.interactBoolean.call(this, player);
	if (!commitment.isResolved && player == this.playerSelf) {
		this.ui.input.bool.request(this.resolveCommitment.bind(this, commitment), style);
		yield this.awaitCommitment(commitment);
	}
	return commitment;
}

Interface.prototype.interactPayment = function*(player, style) {
	let commitment = Game.prototype.interactPayment.call(this, player);
	if (!commitment.isResolved && player == this.playerSelf) {
		this.ui.input.payment.request(
			this.playerSelf.coins,
			this.resolveCommitment.bind(this, commitment),
			style);
		yield this.awaitCommitment(commitment);
	}
	return commitment;
}

Interface.prototype.interactBooleanPayment = function*(player, style) {
	let game = this;
	let bool = yield Game.prototype.interactBoolean.call(this, player);
	let payment = yield Game.prototype.interactPayment.call(this, player);
	if (!bool.isResolved && !payment.isResolved && player == this.playerSelf) {
		this.ui.input.payment.request(
			this.playerSelf.coins, function(a, b) {
				game.resolveCommitment(bool, b);
				game.resolveCommitment(payment, a);
			}, style || {
				yes: "Yay",
				no: "Nay",
				pass: "Pass"
			});
		yield this.awaitCommitment(bool);
		yield this.awaitCommitment(payment);
	}
	return { bool: bool, payment: payment };
}

Interface.prototype.interactSpecify = function*(player, role, style) {
	let commitment = Game.prototype.interactSpecify.call(this, player, role);
	if (!commitment.isResolved && player === this.playerSelf) {
		this.ui.input.expression.request(role, this.resolveCommitment.bind(this, commitment), style);
		yield this.awaitCommitment(commitment);
	}
	return commitment;
}

Interface.prototype.interactAmend = function*(player, style) {
	let game = this;
	let commitment = this.declareCommitment(player, this.getAmendFormat());
	if (!commitment.isResolved && player === this.playerSelf) {
		this.ui.constitution.allowInsertPick();
		this.ui.input.expression.request(Role.Action, function(exp) {
			if (exp) {
				let proposal = game.ui.constitution.proposeInsertPick(exp);
				game.resolveCommitment(commitment, {
					line: proposal.line,
					exp: exp,
					proposal: proposal
				});
				
			} else {
				game.ui.constitution.cancelInsertPick();
				game.resolveCommitment(commitment, null);
			}
		}, style);
	}
	return yield this.processAmend(commitment);
}

Interface.prototype.proposeAmendment = function*(amend) {
	if (!amend.proposal) amend.proposal = this.ui.constitution.propose(amend.line, amend.exp);
	yield Game.prototype.proposeAmendment.call(this, amend);
}

Interface.prototype.confirmAmend = function*(amend) {
	this.ui.constitution.confirmProposal(amend.proposal);
	return yield Game.prototype.confirmAmend.call(this, amend);
}

Interface.prototype.cancelAmend = function*(amend) {
	this.ui.constitution.cancelProposal(amend.proposal);
	return yield Game.prototype.cancelAmend.call(this, amend);
}

// Stops the interface from running for the given length of time.
Interface.prototype.delay = function*(time) {
	if (this.delayTimeout) clearTimeout(this.delayTimeout);
	this.delayTime = setTimeout((function() {
		this.delayTime = null;
		this.run();
	}).bind(this), time);
	while (this.delayTime) yield this.pause();
}