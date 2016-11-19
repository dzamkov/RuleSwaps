// Actions
// -----------------------

Card.register("specify_action_optional", new Card(Role.Action,
	"{Player} may specify and perform an action",
	function*(game, slots) {
		let player = yield game.resolve(slots[0]);
		yield game.log(player, " may specify and perform an action");
		let exp = yield game.reveal(yield game.interactSpecify(player, Role.Action));
		if (exp) {
			yield game.log(player, " performs an action: ", exp);
			yield game.resolve(exp);
		} else {
			yield game.log(player, " waives the right to perform an action");
		}
	}));

Card.register("specify_action", new Card(Role.Action,
	"{Player} must specify and perform an action or reveal their hand",
	function*(game, slots) {
		// TODO
	}));
	
Card.register("conditional", new Card(Role.Action,
	"If {Condition}, do {Action}",
	function*(game, slots) {
		if (yield game.resolve(slots[0]))
			yield game.resolve(slots[1]);
	}));

Card.register("twice", new Card(Role.Action,
	"Do {Action} twice",
	function*(game, slots) {
		yield game.resolve(slots[0]);
		yield game.resolve(slots[0]);
	}));

Card.register("thrice", new Card(Role.Action,
	"Do {Action} thrice",
	function*(game, slots) {
		yield game.resolve(slots[0]);
		yield game.resolve(slots[0]);
		yield game.resolve(slots[0]);
	}));

Card.register("you_draw_2", new Card(Role.Action,
	"You draw 2 cards",
	function*(game, slots) {
		var player = game.getActivePlayer();
		yield game.log(player, " draws ", Log.Cards(2));
		yield game.drawCards(player, 2);
	}));
	
Card.register("you_gain_5", new Card(Role.Action,
	"You gain 5 coins",
	function*(game, slots) {
		var player = game.getActivePlayer();
		yield game.log(player, " gains ", Log.Coins(5));
		yield game.giveCoins(player, 5);
	}));
	
// Conditions
// -----------------------

Card.register("and", new Card(Role.Condition,
	"{Condition} and {Condition} (stop if the first condition failed)",
	function*(game, slots) {
		return game.resolve(slots[0]) && game.resolve(slots[1]);
	}));

Card.register("or", new Card(Role.Condition,
	"{Condition} or {Condition} (stop if the first condition succeded)",
	function*(game, slots) {
		return game.resolve(slots[0]) || game.resolve(slots[1]);
	}));
	
Card.register("xor", new Card(Role.Condition,
	"{Condition} or {Condition}, but not both",
	function*(game, slots) {
		return game.resolve(slots[0]) != game.resolve(slots[1]);
	}));
	
Card.register("majority_vote", new Card(Role.Condition,
	"Majority vote",
	function*(game, slots) {
		// TODO
	}));
	
Card.register("wealth_vote", new Card(Role.Condition,
	"Wealth-weighted vote (each player gets votes equal to their wealth)",
	function*(game, slots) {
		// TODO
	}));

Card.register("payment_vote", new Card(Role.Condition,
	"Payment-weighted vote (each player gets votes equal to the amount of coins they pay)",
	function*(game, slots) {
		// TODO
	}));
	
// Players
// -----------------------

Card.register("you", new Card(Role.Player,
	"You", function(game, slots) {
		return game.getActivePlayer();
	}));

Card.register("poorest_player", new Card(Role.Player,
	"Poorest player (if there is a tie, choose randomly among the poorest)",
	function*(game, slots) {
		// TODO
	}));

Card.register("wealthiest_player", new Card(Role.Player,
	"Wealthiest player (if there is a tie, choose randomly among the wealthiest)",
	function*(game, slots) {
		// TODO
	}));

Card.register("left_player", new Card(Role.Player,
	"The player to the left of {Player}",
	function*(game, slots) {
		// TODO
	}));

Card.register("right_player", new Card(Role.Player,
	"The player to the right of {Player}",
	function*(game, slots) {
		// TODO
	}));

Card.register("biggest_payor", new Card(Role.Player,
	"Whoever pays the most coins (if there is a tie, choose randomly among the winners)",
	function*(game, slots) {
		// TODO
	}));