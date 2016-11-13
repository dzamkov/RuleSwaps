// The set of all cards available in the game.
var Cards = [];

// Actions
// -----------------------

Cards["perform_action"] = new Card(Role.Action,
	"{Player} may specify and perform an action",
	function*(slots, context) {
		var player = yield context.resolve(slots[0]);
		var exp = yield context.specify(player, Role.Action, false);
		if (exp) yield context.resolve(exp);
	});

Cards["perform_action_required"] = new Card(Role.Action,
	"{Player} must specify and perform an action, or reveal their hand if they're unable to",
	function*(slots, context) {
		var player = yield context.resolve(slots[0]);
		var exp = yield context.specify(player, Role.Action, true);
		if (exp) yield context.resolve(exp);
		// TODO: Reveal hand
	});
	
Cards["conditional"] = new Card(Role.Action,
	"If {Condition}, do {Action}",
	function*(slots, context) {
		if (yield context.resolve(slots[0]))
			yield context.resolve(slots[1]);
	});

Cards["twice"] = new Card(Role.Action,
	"Do {Action} twice",
	function*(slots, context) {
		yield context.resolve(slots[0]);
		yield context.resolve(slots[0]);
	});

Cards["thrice"] = new Card(Role.Action,
	"Do {Action} thrice",
	function*(slots, context) {
		yield context.resolve(slots[0]);
		yield context.resolve(slots[0]);
		yield context.resolve(slots[0]);
	});
	
	
// Conditions
// -----------------------

Cards["and"] = new Card(Role.Condition,
	"{Condition} and {Condition} (stop if the first condition failed)",
	function*(slots, context) {
		return context.resolve(slots[0]) && context.resolve(slots[1]);
	});

Cards["or"] = new Card(Role.Condition,
	"{Condition} or {Condition} (stop if the first condition succeded)",
	function*(slots, context) {
		return context.resolve(slots[0]) || context.resolve(slots[1]);
	});
	
Cards["xor"] = new Card(Role.Condition,
	"{Condition} or {Condition}, but not both",
	function*(slots, context) {
		return context.resolve(slots[0]) != context.resolve(slots[1]);
	});
	
Cards["majority_vote"] = new Card(Role.Condition,
	"Majority vote",
	function*(slots, context) {
		// TODO
	});
	
Cards["wealth-vote"] = new Card(Role.Condition,
	"Wealth-weighted vote (each player gets votes equal to their wealth)",
	function*(slots, context) {
		// TODO
	});

Cards["payment-vote"] = new Card(Role.Condition,
	"Payment-weighted vote (each player gets votes equal to the amount of coins they pay)",
	function*(slots, context) {
		// TODO
	});
	
// Players
// -----------------------
	
Cards["poorest_player"] = new Card(Role.Player,
	"Poorest player (if there is a tie, choose randomly among the poorest)",
	function*(slots, context) {
		// TODO
	});

Cards["wealthiest_player"] = new Card(Role.Player,
	"Wealthiest player (if there is a tie, choose randomly among the wealthiest)",
	function*(slots, context) {
		// TODO
	});

Cards["left"] = new Card(Role.Player,
	"The player to the left of {Player}",
	function*(slots, context) {
		// TODO
	});

Cards["right"] = new Card(Role.Player,
	"The player to the right of {Player}",
	function*(slots, context) {
		// TODO
	});

Cards["payment"] = new Card(Role.Player,
	"Whoever pays the most coins (if there is a tie, choose randomly among the winners)",
	function*(slots, context) {
		// TODO
	});