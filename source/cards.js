// The set of all cards available in the game.
var Cards = [];

// Actions
// -----------------------

Cards["perform_action"] = new Card(
	Role.Action, [Role.Player], 2,
	"{Player} may specify and perform an action, paying coins equal to its total value",
	function* (slots, context) {
		var player = yield context.resolve(slots[0]);
		var exp = yield context.specify(player, Role.Action, false, function(exp) {
			return context.getWealth(player) <= exp.totalValue;
		});
		if (exp) {
			yield context.pay(player, exp.totalValue);
			yield context.resolve(exp);
		}
	});

Cards["perform_action_free"] = new Card(
	Role.Action, [Role.Player], 5,
	"{Player} may specify and perform an action (no card value payment required)",
	function*(slots, context) {
		var player = yield context.resolve(slots[0]);
		var exp = yield context.specify(player, Role.Action, false);
		if (exp) yield context.resolve(exp);
	});

Cards["perform_action_required"] = new Card(
	Role.Action, [Role.Player], 20,
	"{Player} must specify and perform an action, or reveal their hand if they're unable to",
	function*(slots, context) {
		var player = yield context.resolve(slots[0]);
		var exp = yield context.specify(player, Role.Action, true);
		if (exp) yield context.resolve(exp);
	});
	
Cards["conditional"] = new Card(
	Role.Action, [Role.Condition, Role.Action], 2,
	"If {Condition}, do {Action}",
	function*(slots, context) {
		if (yield context.resolve(slots[0]))
			yield context.resolve(slots[1]);
	});

Cards["twice"] = new Card(
	Role.Action, [Role.Action], 15,
	"Do {Action} twice",
	function*(slots, context) {
		yield context.resolve(slots[0]);
		yield context.resolve(slots[0]);
	});

Cards["thrice"] = new Card(
	Role.Action, [Role.Action], 25,
	"Do {Action} thice",
	function*(slots, context) {
		yield context.resolve(slots[0]);
		yield context.resolve(slots[0]);
		yield context.resolve(slots[0]);
	});
	
	
// Conditions
// -----------------------

Cards["and"] = new Card(
	Role.Condition, [Role.Condition, Role.Condition], 1,
	"{Condition} and {Condition} (stop if the first condition failed)",
	function*(slots, context) {
		return context.resolve(slots[0]) && context.resolve(slots[1]);
	});

Cards["or"] = new Card(
	Role.Condition, [Role.Condition, Role.Condition], 1,
	"{Condition} or {Condition} (stop if the first condition succeded)",
	function*(slots, context) {
		return context.resolve(slots[0]) || context.resolve(slots[1]);
	});
	
Cards["xor"] = new Card(
	Role.Condition, [Role.Condition, Role.Condition], 3,
	"{Condition} or {Condition}, but not both",
	function*(slots, context) {
		return context.resolve(slots[0]) != context.resolve(slots[1]);
	});
	
Cards["majority_vote"] = new Card(
	Role.Condition, [], 2,
	"Majority vote",
	function*(slots, context) {
		// TODO
	});
	
Cards["wealth-vote"] = new Card(
	Role.Condition, [], 4,
	"Wealth-weighted vote (each player gets votes equal to their wealth)",
	function*(slots, context) {
		// TODO
	});

Cards["payment-vote"] = new Card(
	Role.Condition, [], 7,
	"Payment-weighted vote (each player gets votes equal to the amount of coins they pay)",
	function*(slots, context) {
		// TODO
	});
	
// Players
// -----------------------
	
Cards["poorest_player"] = new Card(
	Role.Player, [], 3,
	"Poorest player",
	function*(slots, context) {
		// TODO
	});

Cards["wealthiest_player"] = new Card(
	Role.Player, [], 3,
	"Wealthiest player",
	function*(slots, context) {
		// TODO
	});

Cards["left"] = new Card(
	Role.Player, [Role.Player], 1,
	"The player to the left of {Player}",
	function*(slots, context) {
		// TODO
	});

Cards["right"] = new Card(
	Role.Player, [Role.Player], 1,
	"The player to the right of {Player}",
	function*(slots, context) {
		// TODO
	});

Cards["payment"] = new Card(
	Role.Player, [], 8,
	"Whoever pays the most coins (if there is a tie, chose randomly among the winners)",
	function*(slots, context) {
		// TODO
	});