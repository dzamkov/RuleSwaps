// Actions
// -----------------------
	
Card.register("you_draw_2", new Card(Role.Action,
	"You draw 2 cards",
	function*(game, slots) {
		var player = game.getActivePlayer();
		yield game.log(player, " draws ", Log.Cards(2));
		yield game.drawCards(player, 2);
	}));

Card.register("player_draws_3", new Card(Role.Action,
	"{Player} draws 3 cards",
	function*(game, slots) {
		var player = yield game.resolve(slots[0]);
		yield game.log(player, " draws ", Log.Cards(3));
		yield game.drawCards(player, 3);
	}));
	
Card.register("you_gain_5", new Card(Role.Action,
	"You gain 5 coins",
	function*(game, slots) {
		var player = game.getActivePlayer();
		yield game.log(player, " gains ", Log.Coins(5));
		yield game.giveCoins(player, 5);
	}));

Card.register("player_gains_8", new Card(Role.Action,
	"{Player} gains 8 coins",
	function*(game, slots) {
		var player = yield game.resolve(slots[0]);
		yield game.log(player, " gains ", Log.Coins(8));
		yield game.giveCoins(player, 8);
	}));

Card.register("specify_action_optional", new Card(Role.Action,
	"{Player} may specify and perform an action",
	function*(game, slots) {
		let player = yield game.resolve(slots[0]);
		yield game.log(player, " may specify and perform an action");
		let exp = yield game.reveal(yield game.interactSpecify(player, Role.Action));
		// TODO: Remove from hand
		if (exp) {
			let cardList = exp.toList();
			yield game.removeCards(player, CardSet.fromList(cardList));
			yield game.log(player, " performs an action ", exp);
			yield game.pushPlayerStack(player);
			yield game.resolve(exp);
			yield game.popPlayerStack(player);
			yield game.discard(cardList);
		} else {
			yield game.log(player, " waives the right to perform an action");
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
	
Card.register("insert_amendment_conditional", new Card(Role.Action,
	"{Player} may propose an amendment, to be ratified if {Condition}",
	function*(game, slots) {
		let player = yield game.resolve(slots[0]);
		yield game.log(player, " may propose an amendment");
		let amend = yield game.interactAmend(player);
		if (amend) {
			yield game.log(player,
				(amend.line === 0) ?
				(" proposes a new amendment at the top of the constitution") :
				(" proposes a new amendment below the " + getOrdinal(amend.line)),
				amend.exp);
			if (yield game.resolve(slots[1])) {
				yield game.log(player, "'s amendment has been ratified");
				yield game.confirmAmend(amend);
			} else {
				yield game.log(player, "'s amendment was not ratified");
				yield game.cancelAmend(amend);
			}
		} else {
			yield game.log(player, " waives the right to propose an amendment");
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

Card.register("player_decides", new Card(Role.Condition,
	"{Player} decides",
	function*(game, slots) {
		let player = yield game.resolve(slots[0]);
		let decision = yield game.reveal(yield game.interactBoolean(player));
		yield game.log(player, decision ? Log.Positive(" approves") : Log.Negative(" rejects"));
		return decision;
	}));
	
Card.register("or", new Card(Role.Condition,
	"{Condition} or {Condition} (stop if the first condition is satisfied)",
	function*(game, slots) {
		if (yield game.resolve(slots[0])) return true;
		if (yield game.resolve(slots[1])) return true;
		return false;
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

Card.register("you_are", new Card(Role.Condition,
	"You are {Player}", function*(game, slots) {
		let you = game.getActivePlayer();
		let other = game.resolve(slots[0]);
		if (you === other) {
			yield game.log(you, " is the expected player");
			return true;
		} else {
			yield game.log(you, " is not ", other);
			return false;
		}
	}));

Card.register("majority_vote", new Card(Role.Condition,
	"Majority vote",
	function*(game, slots) {
		yield game.log("A majority vote is triggered");
		let votes = new Array(game.players);
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
			message.push(Log.Newline, game.players[i], " ",
				votes[i] ? Log.Positive("approved") : Log.Negative("rejected"));
		}
		yield game.log.apply(game, message);
		return pass;
	}));

Card.register("payment_vote", new Card(Role.Condition,
	"Payment-weighted vote (each player gets votes equal to the amount of coins they pay)",
	function*(game, slots) {
		// TODO
	}));
	
Card.register("wealth_vote", new Card(Role.Condition,
	"Wealth-weighted vote (each player gets votes equal to their wealth)",
	function*(game, slots) {
		yield game.log("A wealth-weighted vote is triggered");
		let votes = new Array(game.players);
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
			message.push(Log.Newline, game.players[i], " has ",
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
			curTop = [list[i]];
			curMeasure = iMeasure;
		} else if (iMeasure === curMeasure) {
			curTop.push(list[i]);
		}
	}
	return curTop;
}

Card.register("poorest_player", new Card(Role.Player,
	"Poorest player",
	function*(game, slots) {
		let players = yield game.getPlayersFrom(game.getActivePlayer());
		let poorest = getTop(players, player => -player.coins);
		if (poorest.length > 1) {
			yield game.log("There is a tie for poorest player. ", poorest[0], " is the first going clockwise");
		} else {
			yield game.log(poorest[0], " is the poorest player");
		}
		return poorest[0];
	}));

Card.register("wealthiest_player", new Card(Role.Player,
	"Wealthiest player",
	function*(game, slots) {
		let players = yield game.getPlayersFrom(game.getActivePlayer());
		let wealthiest = getTop(players, player => player.coins);
		if (wealthiest.length > 1) {
			yield game.log("There is a tie for wealthiest player. ", wealthiest[0], " is the first going clockwise");
		} else {
			yield game.log(wealthiest[0], " is the wealthiest player");
		}
		return wealthiest[0];
	}));

Card.register("left_player", new Card(Role.Player,
	"The player to the left of {Player}",
	function*(game, slots) {
		let other = yield game.resolve(slots[0]);
		let players = yield game.getPlayersFrom(other);
		let res = players[1];
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

Card.register("biggest_payor", new Card(Role.Player,
	"Whoever pays the most coins",
	function*(game, slots) {
		// TODO
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

	
let defaultDeck = {
	"you_draw_2": 5,
	"player_draws_3": 3,
	"you_gain_5": 5,
	"player_gains_8": 3,
	"specify_action_optional": 3,
	"conditional_twice": 3,
	"insert_amendment_conditional": 3,
	"foreach_conditional": 2,
	
	"coin_flip": 5,
	"or": 4,
	"not": 3,
	"you_are": 3,
	"majority_vote": 4,
	"payment_vote": 3,
	"wealth_vote": 2,
	
	"you": 5,
	"poorest_player": 4,
	"wealthiest_player": 4,
	"left_player": 3,
	"right_player": 3,
	"biggest_payor": 3,
	"first": 3
}