// Actions
// -----------------------
	
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
	
Card.register("conditional_twice", new Card(Role.Action,
	"If {Condition}, do {Action} twice",
	function*(game, slots) {
		if (yield game.resolve(slots[0])) {
			yield game.resolve(slots[1]);
			yield game.resolve(slots[1]);
		}
	}));
	
Card.register("insert_ammendment_conditional", new Card(Role.Action,
	"{Player} may propose an ammendment, to be ratified if {Condition}",
	function*(game, slots) {
		
	}));
	
// Conditions
// -----------------------

Card.register("coin_flip", new Card(Role.Condition,
	"Coin flip yields heads",
	function*(game, slots) {
		// TODO
	}));

Card.register("or", new Card(Role.Condition,
	"{Condition} or {Condition} (stop if the first condition is satisfied)",
	function*(game, slots) {
		if (yield game.resolve(slots[0])) return true;
		if (yield game.resolve(slots[1])) return true;
		return false;
	}));
	
Card.register("majority_vote", new Card(Role.Condition,
	"Majority vote",
	function*(game, slots) {
		// TODO
	}));

Card.register("payment_vote", new Card(Role.Condition,
	"Payment-weighted vote (each player gets votes equal to the amount of coins they pay)",
	function*(game, slots) {
		// TODO
	}));
	
Card.register("wealth_vote", new Card(Role.Condition,
	"Wealth-weighted vote (each player gets votes equal to their wealth)",
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
	"Poorest player",
	function*(game, slots) {
		// TODO
	}));

Card.register("wealthiest_player", new Card(Role.Player,
	"Wealthiest player",
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
	"Whoever pays the most coins",
	function*(game, slots) {
		// TODO
	}));

	
let defaultDeck = {
	"you_draw_2": 5,
	"you_gain_5": 5,
	"specify_action_optional": 3,
	"conditional_twice": 3,
	"insert_ammendment_conditional": 3,
	
	"coin_flip": 5,
	"or": 4,
	"majority_vote": 4,
	"payment_vote": 3,
	"wealth_vote": 2,
	
	"you": 5,
	"poorest_player": 4,
	"wealthiest_player": 4,
	"left_player": 3,
	"right_player": 3,
	"biggest_payor": 3
}