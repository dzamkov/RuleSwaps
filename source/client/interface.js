// A client-specific interface to a game.
function Interface(setup, playerInfos, selfId) {
	
	// Set up UI
	this.ui = {
		deck: {
			draw: new UI.Deck(document.getElementById("deck-draw"), UI.Deck.Style.FaceDown),
			discard: new UI.Deck(document.getElementById("deck-discard"), UI.Deck.Style.FaceUp),
			play: new UI.Deck(document.getElementById("deck-play"), UI.Deck.Style.Invisible)
		},
		hand: new UI.CardList(document.getElementById("section-player-self-hand")),
		constitution: new UI.Constitution(
			document.getElementById("section-constitution-list")),
		log: new UI.Log(document.getElementById("section-log")),
		input: {
			options: new UI.Input.Options(
				document.getElementById("input-options")),
			payment: new UI.Input.Payment(
				document.getElementById("input-payment"),
				document.getElementById("input-payment-slider-handle"),
				document.getElementById("input-payment-slider-bar"),
				document.getElementById("input-payment-buttons")),
			cards: new UI.Input.Cards(
				document.getElementById("input-cards"),
				document.getElementById("input-cards-list"),
				document.getElementById("input-cards-buttons")),
			expression: new UI.Input.Expression(
				document.getElementById("input-expression"),
				document.getElementById("input-expression-list"),
				document.getElementById("input-expression-buttons")),
		},
		chat: new UI.Chat(
			document.getElementById("input-chat-selector"),
			document.getElementById("input-chat-box"),
			document.getElementById("input-chat-button")),

		playersLeft: document.getElementById("players-left"),
		playersRight: document.getElementById("players-right"),

		selfBack: document.getElementById("player-self-back"),
		selfCoins: document.getElementById("player-self-coins"),
		selfCards: document.getElementById("player-self-cards"),
	};
	
	this.ui.input.cards.returnTarget = this.ui.hand;
	this.ui.input.expression.returnTarget = this.ui.hand;
	
	this.ui.chat.onSay = (function(recipient, message) {
		this.onSay(recipient, message);
	}).bind(this);
	
	// Set up game
	Game.call(this, setup, playerInfos);
	this.ui.constitution.populate(this.constitution);
	
	// Set up players
	if (selfId !== null) {
		this.playerSelf = this.players[selfId];
		this.playerSelf.ui = new UI.PlayerInfo(this.playerSelf,
			this.ui.selfCoins, this.ui.selfCards, this.ui.selfBack);
		let otherPlayers = this.getPlayersFrom(this.playerSelf).slice(1);
		let split = Math.ceil(otherPlayers.length / 2);
		for (let i = split - 1; i >= 0; i--) {
			let playerInfo = UI.PlayerInfo.create(otherPlayers[i], true);
			this.ui.playersLeft.appendChild(playerInfo.container);
			otherPlayers[i].ui = playerInfo;
		}
		for (let i = split; i < otherPlayers.length; i++) {
			let playerInfo = UI.PlayerInfo.create(otherPlayers[i], false);
			this.ui.playersRight.appendChild(playerInfo.container);
			otherPlayers[i].ui = playerInfo;
		}
	} else {
		this.playerSelf = null;
		let players = this.players;
		let split = Math.ceil(players.length / 2);
		for (let i = split - 1; i >= 0; i--) {
			let playerInfo = UI.PlayerInfo.create(players[i], true);
			this.ui.playersLeft.appendChild(playerInfo.container);
			players[i].ui = playerInfo;
		}
		for (let i = split; i < players.length; i++) {
			let playerInfo = UI.PlayerInfo.create(players[i], false);
			this.ui.playersRight.appendChild(playerInfo.container);
			players[i].ui = playerInfo;
		}
		
		// TODO: Hide player-self stuff
	}

	// The set of effects that have yet to be displayed, along with the timeout handle to display them.
	this.effects = [];
	this.isEffectActive = false;
	this.forceUpdate = this.forceUpdate.bind(this);
}

// Describes a visual effect that updates an interface and/or plays an animation that represents a game
// action. Additionally, an effect can be a request for the user to make a decision.
function Effect() { }

// Displays this effect using the given set of UI objects. Calls the given callback when the effect has
// finished, or returns true to indicate that the effect finishes immediately.
Effect.prototype.display = function(ui, callback) {

	// Override me
	return true;
};

// Constructs a custom effect based on the given display action and timeout delay.
Effect.custom = function(delay, display) {
	let effect = new Effect();
	effect.display = function(ui, callback) {
		display(ui);
		if (delay > 0) {
			setTimeout(callback, delay);
			return false;
		} else {
			return true;
		}
	};
	return effect;
};

// Constructs an effect to log a message.
Effect.log = function(depth, contents, style) {
	return Effect.custom(500, ui => ui.log.log(depth, contents, style));
};

// Constructs an effect that requests input from the user.
Effect.input = function(display, resolve) {
	let effect = new Effect();
	effect.display = function(ui, callback) {
		display(ui, function() {
			resolve.apply(this, arguments);
			callback();
		});
	};
	return effect;
};

// An effect which transfers cards.
Effect.Transfer = function(takeCards, putCards, ref) {

	// A procedure which takes the appropriate animated card elements from a source and returns them as a
	// list.
	this.takeCards = takeCards;

	// A procedure which takes a list of animated cards elements and puts them in the appropriate target.
	this.putCards = putCards;

	// An optionial identifier for the set of cards that were transfered.
	this.ref = ref;
}

// A value for 'putCards' which puts cards in the play area.
Effect.Transfer.putCardsInPlay = function(ui, cards) {
	for (let card of cards) {
		ui.deck.play.putCard(card);
	}
};

// A value for 'putCards' which gives cards, in order, to the given acceptor.
Effect.Transfer.giveCards = function(acceptor) {
	return function(ui, cards) {
		if (acceptor instanceof Function) acceptor = acceptor(ui);
		for (card of cards) acceptor.putCard(card);
	};
};

Effect.Transfer.prototype = Object.create(Effect.prototype);

Effect.Transfer.prototype.display = function(ui, callback) {
	let cards = this.takeCards(ui);
	this.putCards(ui, cards);
	setTimeout(callback, 100);
	return false;
};

// Constructs an effect to transfer cards.
Effect.transfer = function(takeCards, putCards, ref) {
	return new Effect.Transfer(takeCards, putCards, ref);
};

// Derive interface from game.
Interface.prototype = Object.create(Game.prototype);

// Queues an effect to be displayed by this interface.
Interface.prototype.queueEffect = function(effect) {
	this.effects.push(effect);
};

// Queues an effect which transfers cards from a given source (to the play area, by default, but may be
// followed by a call to 'queueTransferTo' with the same ref to change the target).
Interface.prototype.queueTransferFrom = function(takeCards, ref) {

	// Prefer to invalidate an earlier transfer rather than create a new one.
	if (ref) {
		for (let i = this.effects.length - 1; i >= 0; i--) {
			let effect = this.effects[i];
			if (effect instanceof Effect.Transfer && effect.ref === ref) {
				effect.putCards = Effect.Transfer.putCardsInPlay;
				return;
			}
		}
	}

	// Okay, fine, create a new transfer.
	this.queueEffect(Effect.transfer(takeCards, Effect.Transfer.putCardsInPlay, ref));
};

// Queues an effect which transfers cards to a given source (from the play area, by default, but may
// be from another source defined by 'queueTransferFrom' with the same ref).
Interface.prototype.queueTransferTo = function(cardTypes, putCards, ref) {

	// Prefer to redirect
	if (ref) {
		for (let i = this.effects.length - 1; i >= 0; i--) {
			let effect = this.effects[i];
			if (effect instanceof Effect.Transfer && effect.ref === ref) {
				effect.putCards = putCards;
				return;
			}
		}
	}

	// Create a new transfer from the play area
	this.queueEffect(Effect.transfer(function(ui) {
		let cards = [];
		for (let type of cardTypes) {
			cards.push(ui.deck.play.pullCard(type));
		}
		return cards;
	}, putCards, ref));

};

// Displays the next effect queued in this interface, assuming that no effect is currently being displayed.
Interface.prototype.forceUpdate = function() {
	this.isEffectActive = false;
	while (this.effects.length > 0) {
		let effect = this.effects.shift();
		let immediate = effect.display(this.ui, this.forceUpdate);
		if (!immediate) {
			this.isEffectActive = true;
			break;
		}
	}
	Motion.Animated.flush();
};

// Displays the next effect queued in this interface, if possible.
Interface.prototype.update = function() {
	if (!this.isEffectActive) this.forceUpdate();
};

Interface.prototype.run = function() {
	Game.prototype.run.call(this);
	this.update();
};

Interface.prototype.revealTo = function*(player, commitment) {
	if (this.playerSelf === player) {
		return yield this.awaitCommitment(commitment);
	} else {
		return null;
	}
};

Interface.prototype.log = function() {
	this.queueEffect(Effect.log(this.getDepth(), arguments, UI.Log.Style.Normal));
}

Interface.prototype.win = function*(player) {
	this.queueEffect(Effect.log(this.getDepth(), [player, " wins!"], UI.Log.Style.Victory));
	yield Game.prototype.win.call(this, player);
}

Interface.prototype.chat = function(player, message) {
	this.ui.log.chat(player.user, message);
}

// An event fired in response to an outgoing chat.
Interface.prototype.onSay = function(recipient, message) {
	// Override me
};

Interface.prototype.setActiveLine = function*(line) {
	// TODO: problem with multiple proposals
	this.queueEffect(Effect.custom(0, ui => ui.constitution.setActiveLine(line)));
	return yield Game.prototype.setActiveLine.call(this, line);
};

Interface.prototype.setCoins = function*(player, count) {
	this.queueEffect(Effect.custom(0, ui => player.ui.setCoins(count)));
	return yield Game.prototype.setCoins.call(this, player, count);
};

Interface.prototype.draw = function*() {
	let commitment = yield Game.prototype.draw.call(this);
	this.queueTransferFrom(function(ui) {
		return [ui.deck.draw.pullCard(commitment.isResolved ? commitment.value : null)];
	}, commitment);
	return commitment;
};

Interface.prototype.discard = function*(cards, ref) {
	yield Game.prototype.discard.call(this, cards);
	this.queueTransferTo(cards.toList(), Effect.Transfer.giveCards(ui => ui.deck.discard), ref);
};

Interface.prototype.setHandSize = function*(player, handSize) {
	this.queueEffect(Effect.custom(0, ui => player.ui.setCards(handSize)));
	return yield Game.prototype.setHandSize.call(this, player, handSize);
};

Interface.prototype.giveCard = function*(player, card) {
	let commitment = card;
	if (!(commitment instanceof Commitment)) commitment = null;
	card = yield Game.prototype.giveCard.call(this, player, card);
	if (this.playerSelf === player) {
		console.assert(card);
		yield this.queueTransferTo([card], Effect.Transfer.giveCards(ui => ui.hand), commitment);
	}
};

// Resolves a commitment for this interface.
Interface.prototype.resolveCommitment = function(commitment, value) {
	commitment.resolve(value);
	if (!this.isRunning) this.run();
};

Interface.prototype.takeCards = function*(player, cardSet, ref) {
	yield Game.prototype.takeCards.call(this, player, cardSet);
};

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
		this.queueEffect(Effect.input(function(ui, resolve) {
			ui.input.options.request({
				buttons: [{
					text: style.yes.text,
					color: style.yes.color,
					value: true
				}, {
					text: style.no.text,
					color: style.no.color,
					value: false
				}]
			}, resolve);
		}, this.resolveCommitment.bind(this, commitment)));
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
		this.queueEffect(Effect.input(function(ui, resolve) {
			ui.input.options.request({
				buttons: buttons
			}, resolve);
		}, this.resolveCommitment.bind(this, commitment)));
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
		let limit = this.playerSelf.coins;
		this.queueEffect(Effect.input(function(ui, resolve) {
			ui.input.payment.request({
				limit: limit,
				buttons: [{
					text: style.accept.text,
					color: style.accept.color,
					pass: false
				}, {
					text: style.pass.text,
					color: style.pass.color,
					pass: true
				}]
			}, resolve);
		}, this.resolveCommitment.bind(this, commitment)));
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
		let limit = this.playerSelf.coins;
		this.queueEffect(Effect.input(function(ui, resolve) {
			ui.input.payment.request({
				limit: limit,
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
			}, resolve);
		}, function(a, b) {
			game.resolveCommitment(bool, b);
			game.resolveCommitment(payment, a);
		}));
	}
	return { bool: bool, payment: payment };
};

Interface.prototype.interactRole = function*(player, style) {
	let commitment = Game.prototype.interactRole.call(this, player);
	if (!commitment.isResolved && player === this.playerSelf) {
		this.queueEffect(Effect.input(function(ui, resolve) {
			ui.input.options.request({
				buttons: [{
					text: "Action",
					color: Color.White,
					value: Role.Action
				}, {
					text: "Condition",
					color: Color.White,
					value: Role.Condition
				}, {
					text: "Player",
					color: Color.White,
					value: Role.Player
				}]
			}, resolve);
		}, this.resolveCommitment.bind(this, commitment)));
	}
	return commitment;
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
		this.queueEffect(Effect.input(function(ui, resolve) {
			ui.input.cards.request({
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
			}, resolve);
		}, function(list) {
			if (list) {
				game.resolveCommitment(commitment, options.ordered ? list : CardSet.fromList(list));
			} else {
				game.resolveCommitment(commitment, null);
			}
		}));
		this.queueTransferFrom(ui => ui.input.cards.takeAllCards(), commitment);
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
		this.queueEffect(Effect.input(function(ui, resolve) {
			ui.input.expression.request({
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
			}, resolve);
		}, game.resolveCommitment.bind(this, commitment)));
		this.queueTransferFrom(ui => ui.input.expression.takeAllCards());
	}
	return commitment;
};

Interface.prototype.interactAmend = function*(player, style) {
	let game = this;
	let commitment = this.declareCommitment(player, this.getAmendFormat(player));
	if (!commitment.isResolved && player === this.playerSelf) {
		style = merge(style, Interface.defaultSpecifyStyle);
		this.queueEffect(Effect.input(function(ui, resolve) {
			ui.constitution.allowInsertPick();
			ui.input.expression.request({
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
					let proposal = ui.constitution.proposeInsertPick(exp);
					resolve({
						line: proposal.line,
						exp: exp,
						proposal: proposal
					});
				} else {
					ui.constitution.cancelInsertPick();
					resolve(null);
				}
			});
		}, game.resolveCommitment.bind(this, commitment)));
		this.queueTransferFrom(ui => ui.input.expression.takeAllCards(), commitment);
	}
	return yield this.processAmend(commitment);
};

Interface.prototype.proposeAmendment = function*(amend) {
	// TODO: effect
	if (!amend.proposal) amend.proposal = this.ui.constitution.propose(amend.line, amend.exp);
	yield Game.prototype.proposeAmendment.call(this, amend);
};

Interface.prototype.confirmAmend = function*(amend) {
	// TODO: effect
	this.ui.constitution.confirmProposal(amend.proposal);
	return yield Game.prototype.confirmAmend.call(this, amend);
};

Interface.prototype.cancelAmend = function*(amend) {
	// TODO: effect
	this.ui.constitution.cancelProposal(amend.proposal);
	return yield Game.prototype.cancelAmend.call(this, amend);
};