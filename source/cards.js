(function() {

	// Actions
	// -----------------------

	let playerDraws = function*(game, player, amount) {
		yield game.log(player, " draws ", Log.Cards(amount));
		yield game.drawCards(player, amount);
	};

	let playerDrawsTo = function*(game, player, amount) {
		if (player.handSize < amount) {
			yield game.log(player, " draws up to ", Log.Cards(amount));
			yield game.drawCards(player, amount - player.handSize);
		} else {
			yield game.log(player, " already has ", Log.Cards(amount));
		}
	};

	let playerDiscards = function*(game, player, amount) {
		let discard = Math.min(amount, player.handSize);
		if (discard > 0) {
			yield game.log(player, " must discard ", Log.Cards(discard));
			let commitment = yield game.interactCards(player, {
				ordered: false,
				optional: false,
				amount: discard
			}, {
				accept: { text: "Discard" }
			});
			let res = yield game.reveal(commitment);
			yield game.takeCards(player, res, commitment);
			yield game.log(player, " discards ", res)
			yield game.discard(res);
		} else {
			yield game.log(player, " doesn't have any cards");
		}
	};

	Card.register("you_draw", new Card(Role.Action,
	"You draw 2 cards",
	function*(game, slots) {
		let player = game.getActivePlayer();
		yield playerDraws(game, player, 2);
	}));
		
	Card.register("you_draw_type", new Card(Role.Action,
	"Name a card type and draw until you get a card of that type (discard all others drawn)",
	function*(game, slots) {
		let player = game.getActivePlayer();
		let role = yield game.reveal(yield game.interactRole(player));
		yield game.log(player, " wants a ", role.str.toLowerCase(), " card");
		
		let discarded = CardSet.create();
		let commitment;
		while (commitment = yield game.draw()) {
			let card = yield game.reveal(commitment);
			if (card.role === role) {
				yield game.giveCard(player, commitment);
				if (discarded.totalCount > 0) {
					yield game.log(player, " drew and discarded ", discarded, " but kept ", card);
				} else {
					yield game.log(player, " drew ", card);
				}
				return;
			} else {
				discarded.insert(card);
				yield game.discard(CardSet.fromList([card]), commitment);
			}
		}
		if (discarded.totalCount > 0) {
			yield game.log(player, " discarded ", discarded);
		}
	}));

	Card.register("you_draw_to", new Card(Role.Action,
	"You draw cards until you have 8",
	function*(game, slots) {
		let player = game.getActivePlayer();
		yield playerDrawsTo(game, player, 8);
	}));

	Card.register("player_discards", new Card(Role.Action,
	"{Player} must discard 3 cards of their choice",
	function*(game, slots) {
		let player = yield game.resolve(slots[0]);
		yield playerDiscards(game, player, 3);
	}));
	

	Card.register("conditional_you_draw", new Card(Role.Action,
	"If {Condition}, you draw 5 cards",
	function*(game, slots) {
		if (yield game.resolve(slots[0])) {
			let player = game.getActivePlayer();
			yield playerDraws(game, player, 5);
		}
	}));

	Card.register("conditional_you_draw_to", new Card(Role.Action,
	"If {Condition}, you draw cards until you have 11",
	function*(game, slots) {
		if (yield game.resolve(slots[0])) {
			let player = game.getActivePlayer();
			yield playerDrawsTo(game, player, 11);
		}
	}));

	Card.register("conditional_player_discards", new Card(Role.Action,
	"If {Condition}, {Player} must discard 5 cards of their choice",
	function*(game, slots) {
		if (yield game.resolve(slots[0])) {
			let player = yield game.resolve(slots[1]);
			yield playerDiscards(game, player, 5);
		}
	}));


	let playerGains = function*(game, player, amount) {
		yield game.log(player, " gains ", Log.Coins(amount));
		yield game.giveCoins(player, amount);
	};

	let playerLoses = function*(game, player, target) {
		let amount = Math.min(player.coins, target);
		yield game.log(player, " loses ", Log.Coins(amount));
		yield game.takeCoins(player, amount);
	};
		
	Card.register("you_gain_coins", new Card(Role.Action,
	"You gain 5 coins",
	function*(game, slots) {
		var player = game.getActivePlayer();
		yield playerGains(game, player, 5);
	}));

	Card.register("player_loses_coins", new Card(Role.Action,
	"{Player} loses 15 coins",
	function*(game, slots) {
		var player = yield game.resolve(slots[0]);
		yield playerLoses(game, player, 15);
	}));

	Card.register("conditional_you_gain_coins", new Card(Role.Action,
	"If {Condition}, you gain 12 coins",
	function*(game, slots) {
		if (yield game.resolve(slots[0])) {
			var player = game.getActivePlayer();
			yield playerGains(game, player, 12);
		}
	}));

	Card.register("conditional_player_loses_coins", new Card(Role.Action,
	"If {Condition}, {Player} loses 25 coins",
	function*(game, slots) {
		if (yield game.resolve(slots[0])) {
			var player = yield game.resolve(slots[1]);
			yield playerLoses(game, player, 25);
		}
	}));


	Card.register("player_reveals_hand", new Card(Role.Action,
	"{Player} must reveal their hand",
	function*(game, slots) {
		let player = yield game.resolve(slots[0]);
		let hand = yield game.reveal(yield game.getHand(player));
		yield game.log(player, " reveals their hand ", hand);
	}));

	Card.register("specify_action_or_amendment", new Card(Role.Action,
	"{Player} may specify and perform an action, or propose an amendment, to be ratified if {Condition}",
	function*(game, slots) {
		let player = yield game.resolve(slots[0]);
		yield game.log(player, " may specify and perform an action or propose an amendment");
		let commitment = yield game.interactNewAmend(player, true);
		let res = yield game.reveal(commitment);
		if (res) {
			if (res.line === null) {
				let cards = CardSet.fromList(res.exp.toList());
				yield game.takeCards(player, cards, commitment);
				yield game.log(player, " performs an action ", res.exp);
				yield game.pushPlayerStack(player);
				yield game.resolve(res.exp);
				yield game.popPlayerStack(player);
				yield game.discard(cards, commitment);
			} else {
				yield game.log(player,
					((res.line === 0) ?
					(" proposes a new amendment at the top of the constitution") :
					(" proposes a new amendment below the " + getOrdinal(res.line))) + " ",
					res.exp);
				yield game.takeCards(player, CardSet.fromList(res.exp.toList()), commitment);
				let amendment = yield game.insertAmend(res.line, res.exp, true, commitment);
				if (yield game.resolve(slots[1])) {
					yield game.reifyAmend(amendment);
					yield game.log(player, "'s amendment has been ratified");
				} else {
					yield game.removeAmend(amendment);
					yield game.log(player, "'s amendment was not ratified");
				}
			}
		} else {
			yield game.log(player, " waives the right to specify an action");
		}
	}));

	Card.register("specify_action_or_discard", new Card(Role.Action,
	"{Player} must specify and perform an action, or discard down to 5 cards",
	function*(game, slots) {
		let downTo = 5;
		let player = yield game.resolve(slots[0]);
		yield game.log(player, " must specify and perform an action, or discard down to ", Log.Cards(downTo));
		let commitment = yield game.interactSpecify(player, Role.Action, 
		(player.handSize > downTo) ? {
			pass: { 
				text: "Discard",
				color: Color.Red
			}
		} : undefined);
		let exp = yield game.reveal(commitment);
		if (exp) {
			let cardList = exp.toList();
			yield game.takeCards(player, CardSet.fromList(cardList), commitment);
			yield game.log(player, " performs an action ", exp);
			yield game.pushPlayerStack(player);
			yield game.resolve(exp);
			yield game.popPlayerStack(player);
			yield game.discard(CardSet.fromList(cardList));
		} else {
			if (player.handSize <= downTo) {
				yield game.log(player,
					" chose not to perform an action and doesn't have more than ",
					Log.Cards(downTo));
			} else {
				yield game.log(player, " chose to discard down to ", Log.Cards(downTo));
				let amount = player.handSize - downTo;
				commitment = yield game.interactCards(player, {
					ordered: false,
					optional: false,
					amount: amount
				}, {
					accept: { text: "Discard" }
				});
				let res = yield game.reveal(commitment);
				yield game.takeCards(player, res, commitment);
				yield game.log(player, " discards ", res)
				yield game.discard(res);
			}
		}
	}));

	Card.register("repeal_last_amendment", new Card(Role.Action,
	"Repeal the last amendment in the constitution (unless it is active)",
	function*(game, slots) {
		let last = game.constitution[game.constitution.length - 1];
		if (!last.isProposal && game.active !== last) {
			yield game.log("The last amendment has been repealed ", last.exp);
			yield game.removeAmend(last);
		} else {
			yield game.log("The last amendment is active and will not be repealed");
		}
	}));
		
	Card.register("conditional_twice", new Card(Role.Action,
	"If {Condition}, do {Action} twice",
	function*(game, slots) {
		if (yield game.resolve(slots[0])) {
			yield game.resolve(slots[1]);
			yield game.resolve(slots[1]);
		}
	}));

	Card.register("foreach_conditional", new Card(Role.Action,
	"For each player, going clockwise, if that player satisfies {Condition}, they do {Action}",
	function*(game, slots) {
		let players = game.getPlayersFrom(game.getActivePlayer());
		for (let i = 0; i < players.length; i++) {
			let player = players[i];
			yield game.log(player, " is evaluated");
			yield game.pushPlayerStack(player);
			if (yield game.resolve(slots[0]))
				yield game.resolve(slots[1]);
			yield game.popPlayerStack(player);
		}
	}));

	Card.register("left_player_wins", new Card(Role.Action,
	"The player to your left wins",
	function*(game, slots) {
		let players = game.getPlayersFrom(game.getActivePlayer());
		yield game.win(players[1 % players.length]);
	}));

	Card.register("wealth_win", new Card(Role.Action,
	"If you have 100 coins, you win",
	function*(game, slots) {
		let player = game.getActivePlayer();
		if (player.coins >= 100) {
			yield game.log(player, " has ", Log.Coins(100));
			yield game.win(player);
		} else {
			yield game.log(player, " doesn't have ", Log.Coins(100));
		}
	}));

	Card.register("composition_win", new Card(Role.Action,
	"Reveal your hand. If you have exactly 3 action, 3 condition and 3 player cards, you win",
	function*(game, slots) {
		let player = game.getActivePlayer();
		let hand = yield game.reveal(yield game.getHand(player));
		let roleCounts = hand.getRoleCounts();
		if (roleCounts[0] === 3 && roleCounts[1] === 3 && roleCounts[2] === 3) {
			yield game.log(player, " reveals their hand ", hand,
				" which has exactly 3 action, 3 condition and 3 player cards!");
			yield game.win(player);
		} else {
			yield game.log(player, " reveals their hand ", hand,
				" which doesn't satisfy the necessary criteria");
		}
	}));
		
	Card.register("conditional_win", new Card(Role.Action,
	"If {Condition}, {Condition}, {Condition} and {Condition}, you win",
	function*(game, slots) {
		if ((yield game.resolve(slots[0])) &&
			(yield game.resolve(slots[1])) &&
			(yield game.resolve(slots[2])) &&
			(yield game.resolve(slots[3])))
			yield game.win(game.getActivePlayer());
	}));

	Card.register("player_win", new Card(Role.Action,
	"If {Player}, {Player}, {Player} and {Player} are the same, that player wins",
	function*(game, slots) {
		let p1 = yield game.resolve(slots[0]);
		let p2 = yield game.resolve(slots[1]);
		if (p1 === p2) {
			let p3 = yield game.resolve(slots[2]);
			if (p1 === p3) {
				let p4 = yield game.resolve(slots[3]);
				if (p1 === p4) {
					yield game.win(p1);
				}
			}
		}
	}));
		
	// Conditions
	// -----------------------

	Card.register("coin_flip", new Card(Role.Condition,
	"Coin flip",
	function*(game, slots) {
		let res = yield game.reveal(yield game.random(2));
		if (res === 1) {
			yield game.log("The coin came up heads");
			return true;
		} else {
			yield game.log("The coin came up tails");
			return false;
		}
	}));

	let mayPay = function*(game, player, amount) {
		if (player.coins >= amount) {
			yield game.log(player, " may pay ", Log.Coins(amount));
			let res = yield game.reveal(yield game.interactBoolean(player, {
				yes: { text: ["Pay ", Log.Coins(amount)] },
				no: { text: "Don't pay" }
			}));
			if (res) {
				yield game.log(player, " pays ", Log.Coins(amount));
				yield game.takeCoins(player, amount);
				return true;
			} else {
				yield game.log(player, " doesn't pay ", Log.Coins(amount));
				return false;
			}
		} else {
			yield game.log(player, " doesn't have ", Log.Coins(amount));
			return false;
		}
	};

	Card.register("you_pay", new Card(Role.Condition,
	"You pay 10 coins",
	function*(game, slots) {
		let player = game.getActivePlayer();
		return yield mayPay(game, player, 10);
	}));
		
	Card.register("you_reveal_hand", new Card(Role.Condition,
	"You reveal your hand",
	function*(game, slots) {
		let player = game.getActivePlayer();
		let res = yield game.reveal(yield game.interactBoolean(player, {
			yes: { text: "Reveal hand" },
			no: { text: "Don't reveal hand" }
		}));
		if (res) {
			let hand = yield game.reveal(yield game.getHand(player));
			yield game.log(player, " reveals their hand ", hand);
			return true;
		} else {
			yield game.log(player, " doesn't reveal their hand");
			return false;
		}
	}));

	let mayDiscard = function*(game, player, amount) {
		if (player.handSize >= amount) {
			yield game.log(player, " may discard ", Log.Cards(amount));
			let commitment = yield game.interactCards(player, {
				ordered: false,
				optional: true,
				amount: 3
			}, {
				accept: { text: "Discard" }
			});
			let res = yield game.reveal(commitment);
			if (res) {
				yield game.takeCards(player, res, commitment);
				yield game.log(player, " discards ", res)
				yield game.discard(res);
				return true;
			} else {
				yield game.log(player, " doesn't discard ", Log.Cards(amount));
				return false;
			}
		} else {
			yield game.log(player, " doesn't have ", Log.Cards(amount));
			return false;
		}
	};

	Card.register("you_discard", new Card(Role.Condition,
	"You discard 3 cards",
	function*(game, slots) {
		let player = game.getActivePlayer();
		return yield mayDiscard(game, player, 3);
	}));

	let decides = function*(game, player) {
		let decision = yield game.reveal(yield game.interactBoolean(player));
		yield game.log(player, decision ? Log.Positive(" approves") : Log.Negative(" rejects"));
		return decision;
	};	

	Card.register("player_decides", new Card(Role.Condition,
	"{Player} decides",
	function*(game, slots) {
		let player = yield game.resolve(slots[0]);
		return yield decides(game, player);
	}));

	Card.register("auction_winner_decides", new Card(Role.Condition,
	"Auction winner decides",
	function*(game, slots) {
		let winner = yield auctionWinner(game, null);
		return yield decides(game, winner);
	}));
		
	Card.register("or", new Card(Role.Condition,
	"{Condition} or {Condition} (stop if the first condition is satisfied)",
	function*(game, slots) {
		return (yield game.resolve(slots[0])) || (yield game.resolve(slots[1]));
	}));

	Card.register("not", new Card(Role.Condition,
	"Not {Condition}", function*(game, slots) {
		let res = yield game.resolve(slots[0]);
		if (res) {
			yield game.log("The test is inverted and ", Log.Negative("fails"));
		} else {
			yield game.log("The test is inverted and ", Log.Positive("passes"));
		}
		return !res;
	}));

	Card.register("3_attempts", new Card(Role.Condition,
	"{Condition} passes within 3 attempts",
	function*(game, slots) {
		for (let i = 0; i < 3; i++) {
			if (yield game.resolve(slots[0]))
				return true;
		}
		return false;
	}));

	Card.register("you_are", new Card(Role.Condition,
	"You are {Player}", function*(game, slots) {
		let you = game.getActivePlayer();
		let other = yield game.resolve(slots[0]);
		if (you === other) {
			yield game.log(you, " is the expected player");
			return true;
		} else {
			yield game.log(you, " is not ", other);
			return false;
		}
	}));

	let drawRole = function*(game, player, role) {
		let card = yield game.draw();
		if (card) {
			card = yield game.reveal(card);
			let same = (card.role === role);
			yield game.log(player, " drew the " + (same ? "right" : "wrong") + " type of card ", card);
			yield game.giveCard(player, card);
			return same;
		}
		return false;
	};
		
	Card.register("you_draw_action", new Card(Role.Condition,
	"You draw a card, and it is an action card (Keep it regardless)",
	function*(game, slots) {
		return yield drawRole(game, game.getActivePlayer(), Role.Action);
	}));

	Card.register("you_draw_condition", new Card(Role.Condition,
	"You draw a card, and it is a condition card (Keep it regardless)",
	function*(game, slots) {
		return yield drawRole(game, game.getActivePlayer(), Role.Condition);
	}));
		
	Card.register("you_draw_player", new Card(Role.Condition,
	"You draw a card, and it is a player card (Keep it regardless)",
	function*(game, slots) {
		return yield drawRole(game, game.getActivePlayer(), Role.Player);
	}));

	Card.register("majority_vote", new Card(Role.Condition,
	"Majority vote",
	function*(game, slots) {
		yield game.log("A majority vote is triggered");
		let votes = new Array(game.players.length);
		for (let i = 0; i < game.players.length; i++) {
			votes[i] = yield game.interactBoolean(game.players[i]);
		}
		let count = 0;
		for (let i = 0; i < votes.length; i++) {
			let res = yield game.reveal(votes[i]);
			if (res) count++;
			votes[i] = res;
		}
		let pass = (count * 2) > votes.length;
		let message = [];
		message.push("The vote ",
			pass ? Log.Positive("passes") : Log.Negative("fails"),
			" with " + count + "/" + votes.length + " approvals");
		for (let i = 0; i < votes.length; i++) {
			message.push(Log.Break, game.players[i], " ",
				votes[i] ? Log.Positive("approved") : Log.Negative("rejected"));
		}
		yield game.log.apply(game, message);
		return pass;
	}));

	Card.register("payment_vote", new Card(Role.Condition,
	"Payment-weighted vote (each player gets votes equal to the amount of coins they pay)",
	function*(game, slots) {
		let players = yield game.getPlayersFrom(game.getActivePlayer());
		yield game.log("A payment-weighted vote is triggered")
		let payments = new Array(players.length);
		let votes = new Array(players.length);
		for (let i = 0; i < payments.length; i++) {
			let commitments = yield game.interactBooleanPayment(players[i]);
			payments[i] = commitments.payment;
			votes[i] = commitments.bool;
		}
		let count = 0;
		let total = 0;
		for (let i = 0; i < payments.length; i++) {
			let amount = yield game.reveal(payments[i]);
			payments[i] = amount;
			yield game.takeCoins(players[i], amount);
			let res = yield game.reveal(votes[i]);
			if (res) count += amount;
			total += amount;
			votes[i] = res;
		}
		let pass = (count * 2) > total;
		let message = [];
		message.push("The vote ",
			pass ? Log.Positive("passes") : Log.Negative("fails"),
			" with " + count + "/" + total + " approval votes");
		for (let i = 0; i < votes.length; i++) {
			if (payments[i]) {
				message.push(Log.Break, players[i], " paid ",
					Log.Coins(payments[i]), " and ",
					votes[i] ? Log.Positive("approved") : Log.Negative("rejected"));
			} else {
				message.push(Log.Break, players[i], " passed");
			}
		}
		yield game.log.apply(game, message);
		return pass;
	}));
		
	Card.register("wealth_vote", new Card(Role.Condition,
	"Wealth-weighted vote (each player gets votes equal to their wealth)",
	function*(game, slots) {
		yield game.log("A wealth-weighted vote is triggered");
		let votes = new Array(game.players.length);
		for (let i = 0; i < game.players.length; i++) {
			votes[i] = yield game.interactBoolean(game.players[i]);
		}
		let count = 0;
		let total = 0;
		for (let i = 0; i < votes.length; i++) {
			let res = yield game.reveal(votes[i]);
			let wealth = game.players[i].coins;
			if (res) count += wealth;
			total += wealth;
			votes[i] = res;
		}
		let pass = (count * 2) > total;
		let message = [];
		message.push("The vote ",
			pass ? Log.Positive("passes") : Log.Negative("fails"),
			" with " + count + "/" + total + " approval votes");
		for (let i = 0; i < votes.length; i++) {
			message.push(Log.Break, game.players[i], " has ",
				Log.Coins(game.players[i].coins), " and ",
				votes[i] ? Log.Positive("approved") : Log.Negative("rejected"));
		}
		yield game.log.apply(game, message);
		return pass;
	}));
		
	// Players
	// -----------------------

	Card.register("you", new Card(Role.Player,
	"You", function(game, slots) {
		return game.getActivePlayer();
	}));
		
	function getTop(list, measure) {
		let curTop = [];
		let curMeasure = -Infinity;
		for (let i = 0; i < list.length; i++) {
			let iMeasure = measure(list[i]);
			if (iMeasure > curMeasure) {
				curTop = [i];
				curMeasure = iMeasure;
			} else if (iMeasure === curMeasure) {
				curTop.push(i);
			}
		}
		return curTop;
	}

	let concatPlayers = function(message, players) {
		for (let i = 0; i < players.length - 2; i++) {
			message.push(players[i], ", ");
		}
		message.push(players[players.length - 2]);
		message.push(" and ", players[players.length - 1]);
	};

	let tiebreak = function*(game, players) {
		let i = yield game.reveal(yield game.random(players.length));
		let player = players[i];
		yield game.log(player, " was randomly selected in a tiebreaker");
		return player;
	};

	let picks = function*(game, player, allowSelf) {
		yield game.log(player, allowSelf ? " may pick any player" : " may pick any other player");
		let otherPlayer = yield game.reveal(yield game.interactPlayer(player, allowSelf));
		yield game.log(player, " picked ", otherPlayer);
		return otherPlayer;
	};

	var auctionWinner = function*(game, host) {
		let players = game.players;
		if (host) {
			yield game.log("An auction is triggered, with proceeds going to ", host);
		} else {
			yield game.log("An auction is triggered");
		}
		let bids = new Array(players.length);
		for (let i = 0; i < bids.length; i++) {
			if (players[i] !== host) {
				bids[i] = yield game.interactPayment(players[i],
					{ accept: { text: "Bid" }});
			}
		}
		for (let i = 0; i < bids.length; i++) {
			if (players[i] !== host) {
				bids[i] = yield game.reveal(bids[i]);
			} else {
				bids[i] = -Infinity;
			}
		}
		let mostBidId = getTop(bids, n => n);
		let highBid = bids[mostBidId[0]];
		let mostBid = mostBidId.map(i => players[i]);
		let message = [];
		if (mostBid.length > 1) {
			concatPlayers(message, mostBid);
			message.push(" are tied for the largest bid");
		} else {
			message.push(mostBid[0], " made the largest bid");
		}
		for (let i = 0; i < bids.length; i++) {
			if (players[i] !== host) {
				if (bids[i] > 0) {
					message.push(Log.Break, players[i], " bid ", Log.Coins(bids[i]));
				} else {
					message.push(Log.Break, players[i], " didn't place a bid");
				}
			}
		}
		yield game.log.apply(game, message);
		let winner;
		if (mostBid.length > 1) {
			winner = yield tiebreak(game, mostBid);
		} else {
			winner = mostBid[0];
		}
		if (highBid > 0) {
			yield game.takeCoins(winner, highBid);
			if (host) {
				yield game.log(winner, " pays ", Log.Coins(highBid), " to ", host);
				yield game.giveCoins(host, highBid);
			} else {
				yield game.log(winner, " pays ", Log.Coins(highBid));
			}
		}
		return winner;
	};

	Card.register("poorest_player", new Card(Role.Player,
	"Poorest player",
	function*(game, slots) {
		let players = game.players;
		let poorest = getTop(players, player => -player.coins).map(i => players[i]);
		if (poorest.length > 1) {
			let message = [];
			concatPlayers(message, poorest);
			message.push(" are tied for poorest player.");
			yield game.log.apply(game, message);
			return yield tiebreak(game, poorest);
		} else {
			yield game.log(poorest[0], " is the poorest player");
			return poorest[0];
		}
	}));

	Card.register("wealthiest_player", new Card(Role.Player,
	"Wealthiest player",
	function*(game, slots) {
		let players = game.players;
		let wealthiest = getTop(players, player => player.coins).map(i => players[i]);
		if (wealthiest.length > 1) {
			let message = [];
			concatPlayers(message, wealthiest);
			message.push(" are tied for wealthiest player.");
			yield game.log.apply(game, message);
			return yield tiebreak(game, wealthiest);
		} else {
			yield game.log(wealthiest[0], " is the wealthiest player");
			return wealthiest[0];
		}
	}));

	Card.register("left_player", new Card(Role.Player,
	"The player to the left of {Player}",
	function*(game, slots) {
		let other = yield game.resolve(slots[0]);
		let players = yield game.getPlayersFrom(other);
		let res = players[1 % players.length];
		yield game.log(res, " is the player to the left of ", other);
		return res;
	}));

	Card.register("right_player", new Card(Role.Player,
	"The player to the right of {Player}",
	function*(game, slots) {
		let other = yield game.resolve(slots[0]);
		let players = yield game.getPlayersFrom(other);
		let res = players[players.length - 1];
		yield game.log(res, " is the player to the right of ", other);
		return res;
	}));

	Card.register("most_paid_picks", new Card(Role.Player,
	"Whoever pays the most coins picks",
	function*(game, slots) {
		let players = game.players;
		yield game.log("Whoever pays the most coins will chose a player");
		let payments = new Array(players.length);
		for (let i = 0; i < payments.length; i++) {
			payments[i] = yield game.interactPayment(players[i]);
		}
		for (let i = 0; i < payments.length; i++) {
			let res = yield game.reveal(payments[i]);
			payments[i] = res;
			yield game.takeCoins(players[i], res);
		}
		let mostPaid = getTop(payments, n => n).map(i => players[i]);
		let message = [];
		if (mostPaid.length > 1) {
			concatPlayers(message, mostPaid);
			message.push(" made the biggest payment");
		} else {
			message.push(mostPaid[0], " made the biggest payment");
		}
		for (let i = 0; i < payments.length; i++) {
			if (payments[i] > 0) {
				message.push(Log.Break, players[i], " paid ", Log.Coins(payments[i]));
			} else {
				message.push(Log.Break, players[i], " didn't make a payment");
			}
		}
		yield game.log.apply(game, message);
		let player;
		if (mostPaid.length > 1) {
			player = yield tiebreak(game, mostPaid);
		} else {
			player = mostPaid[0];
		}
		return yield picks(game, player, true);
	}));
		
	Card.register("most_discarded_picks", new Card(Role.Player,
	"Whoever discards the most cards picks",
	function*(game, slots) {
		let players = game.players;
		yield game.log("Whoever discards the most cards will chose a player");
		let discards = new Array(players.length);
		for (let i = 0; i < discards.length; i++) {
			discards[i] = yield game.interactCards(players[i], {
				ordered: false,
				optional: true
			}, {
				accept: { text: "Discard" }
			});
		}
		for (let i = 0; i < discards.length; i++) {
			let res = yield game.reveal(discards[i]);
			discards[i] = res;
			if (res) {
				yield game.takeCards(players[i], res, discards[i]);
				yield game.discard(res);
			}
		}
		let mostDiscarded = getTop(discards, d => d ? d.totalCount : 0).map(i => players[i]);
		let message = [];
		if (mostDiscarded.length > 1) {
			concatPlayers(message, mostDiscarded);
			message.push(" discarded the most cards");
		} else {
			message.push(mostDiscarded[0], " discarded the most cards");
		}
		for (let i = 0; i < discards.length; i++) {
			if (discards[i]) {
				message.push(Log.Break, players[i], " discarded ", discards[i]);
			} else {
				message.push(Log.Break, players[i], " didn't discard anything");
			}
		}
		yield game.log.apply(game, message);
		let player;
		if (mostDiscarded.length > 1) {
			player = yield tiebreak(game, mostDiscarded);
		} else {
			player = mostDiscarded[0];
		}
		return yield picks(game, player, true);
	}));
		
	Card.register("auction_winner_picks", new Card(Role.Player,
	"Auction winner picks",
	function*(game, slots) {
		let winner = yield auctionWinner(game, null);
		return yield picks(game, winner, true);
	}));

	Card.register("auction_winner_to_you_picks", new Card(Role.Player,
	"Auction winner picks, with proceeds going to you (You don't participate in the auction)",
	function*(game, slots) {
		let player = game.getActivePlayer();
		let winner = yield auctionWinner(game, player);
		return yield picks(game, winner, true);
	}));
		
	Card.register("picks", new Card(Role.Player,
	"{Player} picks",
	function*(game, slots) {
		let player = yield game.resolve(slots[0]);
		return yield picks(game, player, true);
	}));

	Card.register("picks_other", new Card(Role.Player,
	"{Player} picks, other than themself",
	function*(game, slots) {
		let player = yield game.resolve(slots[0]);
		return yield picks(game, player, false);
	}));
		
	Card.register("first", new Card(Role.Player,
	"The first player, going clockwise, who satisfies {Condition}",
	function*(game, slots) {
		let players = game.getPlayersFrom(game.getActivePlayer());
		for (let i = 0; i < players.length; i++) {
			let player = players[i];
			yield game.log(player, " is evaluated");
			yield game.pushPlayerStack(player);
			let res = yield game.resolve(slots[0]);
			yield game.popPlayerStack(player);
			if (res) {
				yield game.log(player, " is first to satisfy the condition");
				return player;
			}
		}
		yield game.log("Nobody satisfied the condition, so the active player, ",
			players[0], ", is selected");
		return players[0];
	}));
})();
	
let defaultDeck = CardSet.create({
	"you_draw": 3,
	"you_draw_type": 5,
	"you_draw_to": 4,
	"player_discards": 4,
	"conditional_you_draw": 3,
	"conditional_you_draw_to": 4,
	"conditional_player_discards": 4,
	"you_gain_coins": 3,
	"player_loses_coins": 5,
	"conditional_you_gain_coins": 6,
	"conditional_player_loses_coins": 4,
	"player_reveals_hand": 6,
	"specify_action_or_amendment": 5,
	"specify_action_or_discard": 4,
	"repeal_last_amendment": 4,
	"conditional_twice": 4,
	"foreach_conditional": 2,
	"left_player_wins": 1,
	"wealth_win": 1,
	"composition_win": 1,
	"conditional_win": 1,
	"player_win": 1,
	
	"coin_flip": 5,
	"you_pay": 4,
	"you_reveal_hand": 2,
	"you_discard": 3,
	"player_decides": 3,
	"auction_winner_decides": 4,
	"or": 2,
	"not": 2,
	"3_attempts": 3,
	"you_are": 3,
	"you_draw_action": 2,
	"you_draw_condition": 2,
	"you_draw_player": 2,
	"majority_vote": 3,
	"payment_vote": 3,
	"wealth_vote": 2,
	
	"you": 5,
	"poorest_player": 4,
	"wealthiest_player": 4,
	"left_player": 2,
	"right_player": 2,
	"most_paid_picks": 5,
	"most_discarded_picks": 5,
	"auction_winner_picks": 5,
	"auction_winner_to_you_picks": 4,
	"picks": 2,
	"picks_other": 4,
	"first": 2
});