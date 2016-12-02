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
		hand: new UI.CardList(parts.selfHand),
		constitution: new UI.Constitution(
			parts.constitutionNumbers,
			parts.constitutionList),
		log: new UI.Log(parts.log),
		input: {
			options: new UI.Input.Options(
				parts.inputOptions),
			payment: new UI.Input.Payment(
				parts.inputPayment,
				parts.inputPaymentHandle,
				parts.inputPaymentBar,
				parts.inputPaymentButtons),
			cards: new UI.Input.Cards(
				parts.inputCards,
				parts.inputCardsList,
				parts.inputCardsButtons),
			expression: new UI.Input.Expression(
				parts.inputExpression,
				parts.inputExpressionList,
				parts.inputExpressionButtons),
		},
		chat: new UI.Chat(
			parts.inputChatSelector,
			parts.inputChatTextbox,
			parts.inputChatButton)
	};
	
	this.ui.input.cards.returnTarget = this.ui.hand;
	this.ui.input.expression.returnTarget = this.ui.hand;
	
	this.ui.chat.onSay = (function(recipient, message) {
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
		card.sendTo(this.ui.hand);
	}
}

// Resolves a commitment for this interface.
Interface.prototype.resolveCommitment = function(commitment, value) {
	console.assert(this.playerSelf === commitment.player);
	commitment.resolve(value);
	this.run();
}

// The default style for a boolean interaction
Interface.defaultBooleanStyle = {
	yes: {
		text: "Yay",
		color: Color.Green
	},
	no: {
		text: "Nay",
		color: Color.Red
	}
};

// Merges two objects, prefering the first.
function merge(a, b) {
	if (!a) return b;
	else if (!b) return a;
	else if (a instanceof Object && b instanceof Object) {
		let res = { };
		for (let prop in b)
			res[prop] = b[prop];
		for (let prop in a)
			res[prop] = merge(a[prop], b[prop]);
		return res;
	} else return a;
};

Interface.prototype.interactBoolean = function*(player, style) {
	let commitment = Game.prototype.interactBoolean.call(this, player);
	if (!commitment.isResolved && player == this.playerSelf) {
		style = merge(style, Interface.defaultBooleanStyle);
		this.ui.input.options.request({
			buttons: [{
				text: style.yes.text,
				color: style.yes.color,
				value: true
			}, {
				text: style.no.text,
				color: style.no.color,
				value: false
			}]
		}, this.resolveCommitment.bind(this, commitment));
		yield this.awaitCommitment(commitment);
	}
	return commitment;
};

Interface.prototype.interactPlayer = function*(player, canPickThemself, style) {
	let commitment = Game.prototype.interactPlayer.call(this, player);
	if (!commitment.isResolved && player === this.playerSelf) {
		let buttons = [];
		for (let i = 0; i < this.players.length; i++) {
			let otherPlayer = this.players[i];
			if (canPickThemself || otherPlayer !== this.playerSelf) {
				buttons.push({
					text: [otherPlayer],
					color: Color.White,
					value: otherPlayer
				});
			}
		}
		this.ui.input.options.request({
			buttons: buttons
		}, this.resolveCommitment.bind(this, commitment));
		yield this.awaitCommitment(commitment);
	}
	return commitment;
};

// The default style for a payment interaction
Interface.defaultPaymentStyle = {
	accept: {
		text: "Pay",
		color: Color.Green
	},
	pass: {
		text: "Pass",
		color: Color.Yellow
	}
};


Interface.prototype.interactPayment = function*(player, style) {
	let commitment = Game.prototype.interactPayment.call(this, player);
	if (!commitment.isResolved && player == this.playerSelf) {
		style = merge(style, Interface.defaultPaymentStyle);
		this.ui.input.payment.request({
			limit: this.playerSelf.coins,
			buttons: [{
				text: style.accept.text,
				color: style.accept.color,
				pass: false
			}, {
				text: style.pass.text,
				color: style.pass.color,
				pass: true
			}]
		}, this.resolveCommitment.bind(this, commitment));
		yield this.awaitCommitment(commitment);
	}
	return commitment;
};

// The default style for a boolean payment interaction
Interface.defaultBooleanPaymentStyle = {
	yes: {
		text: "Yay",
		color: Color.Green
	},
	no: {
		text: "Nay",
		color: Color.Red
	},
	pass: {
		text: "Pass",
		color: Color.Yellow
	}
};

Interface.prototype.interactBooleanPayment = function*(player, style) {
	let game = this;
	let bool = yield Game.prototype.interactBoolean.call(this, player);
	let payment = yield Game.prototype.interactPayment.call(this, player);
	if (!bool.isResolved && !payment.isResolved && player == this.playerSelf) {
		style = merge(style, Interface.defaultBooleanPaymentStyle);
		this.ui.input.payment.request({
			limit: this.playerSelf.coins,
			buttons: [{
				text: style.yes.text,
				color: style.yes.color,
				value: true,
				pass: false
			}, {
				text: style.no.text,
				color: style.no.color,
				value: false,
				pass: false
			}, {
				text: style.pass.text,
				color: style.pass.color,
				value: false,
				pass: true
			}]
		}, function(a, b) {
			game.resolveCommitment(bool, b);
			game.resolveCommitment(payment, a);
		});
		yield this.awaitCommitment(bool);
		yield this.awaitCommitment(payment);
	}
	return { bool: bool, payment: payment };
};

// The default style for a cards interaction
Interface.defaultCardsStyle = {
	accept: {
		text: "Accept",
		color: Color.Green
	},
	pass: {
		text: "Pass",
		color: Color.Yellow
	}
};

Interface.prototype.interactCards = function*(player, options, style) {
	let game = this;
	let commitment = Game.prototype.interactCards.call(this, player, options);
	if (!commitment.isResolved && player === this.playerSelf) {
		style = merge(style, Interface.defaultCardsStyle);
		this.ui.input.cards.request({
			amount: options.amount,
			buttons: [{
				text: style.accept.text,
				color: style.accept.color,
				pass: false
			}].concat(options.optional ? [{
				text: style.pass.text,
				color: style.pass.color,
				pass: true
			}] : [])
		}, function(list) {
			if (list) {
				game.resolveCommitment(commitment, options.ordered ? list : CardSet.fromList(list));
				game.ui.input.cards.sendAllTo(null);
			} else {
				game.resolveCommitment(commitment, null);
			}
		});
		yield this.awaitCommitment(commitment);
	}
	return commitment;
};

// The default style for a specify interaction
Interface.defaultSpecifyStyle = {
	accept: {
		text: "Accept",
		color: Color.Green
	},
	pass: {
		text: "Pass",
		color: Color.Yellow
	}
};

Interface.prototype.interactSpecify = function*(player, role, style) {
	let game = this;
	let commitment = Game.prototype.interactSpecify.call(this, player, role);
	if (!commitment.isResolved && player === this.playerSelf) {
		style = merge(style, Interface.defaultSpecifyStyle);
		this.ui.input.expression.request({
			role: role,
			buttons: [{
				text: style.accept.text,
				color: style.accept.color,
				pass: false
			}, {
				text: style.pass.text,
				color: style.pass.color,
				pass: true
			}]
		}, function(exp) {
			game.resolveCommitment(commitment, exp);
			game.ui.input.expression.sendAllTo(null);
		});
		yield this.awaitCommitment(commitment);
	}
	return commitment;
};

Interface.prototype.interactAmend = function*(player, style) {
	let game = this;
	let commitment = this.declareCommitment(player, this.getAmendFormat());
	if (!commitment.isResolved && player === this.playerSelf) {
		style = merge(style, Interface.defaultSpecifyStyle);
		this.ui.constitution.allowInsertPick();
		this.ui.input.expression.request({
			role: Role.Action,
			buttons: [{
				text: style.accept.text,
				color: style.accept.color,
				pass: false
			}, {
				text: style.pass.text,
				color: style.pass.color,
				pass: true
			}]
		}, function(exp) {
			if (exp) {
				let proposal = game.ui.constitution.proposeInsertPick(exp);
				game.resolveCommitment(commitment, {
					line: proposal.line,
					exp: exp,
					proposal: proposal
				});
				game.ui.input.expression.sendAllTo(null);
			} else {
				game.ui.constitution.cancelInsertPick();
				game.resolveCommitment(commitment, null);
			}
		});
	}
	return yield this.processAmend(commitment);
};

Interface.prototype.proposeAmendment = function*(amend) {
	if (!amend.proposal) amend.proposal = this.ui.constitution.propose(amend.line, amend.exp);
	yield Game.prototype.proposeAmendment.call(this, amend);
};

Interface.prototype.confirmAmend = function*(amend) {
	this.ui.constitution.confirmProposal(amend.proposal);
	return yield Game.prototype.confirmAmend.call(this, amend);
};

Interface.prototype.cancelAmend = function*(amend) {
	this.ui.constitution.cancelProposal(amend.proposal);
	return yield Game.prototype.cancelAmend.call(this, amend);
};

// Stops the interface from running for the given length of time.
Interface.prototype.delay = function*(time) {
	if (this.delayTimeout) clearTimeout(this.delayTimeout);
	this.delayTime = setTimeout((function() {
		this.delayTime = null;
		this.run();
	}).bind(this), time);
	while (this.delayTime) yield this.pause();
};