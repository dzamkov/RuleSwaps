
let maxGameLength = 500;

// A game run for the purposes of testing.
function FuzzerGame(setup, playerInfos) {
	Game.call(this, setup, playerInfos);
	this.canResolveRandomness = true;
	this.length = 0;
}

FuzzerGame.prototype = Object.create(Game.prototype);

FuzzerGame.prototype.log = function() {
	process.stdout.write("\t".repeat(this.getDepth()));
	for (let i = 0; i < arguments.length; i++) {
		if (arguments[i] === Log.Break) {
			process.stdout.write("\n");
			process.stdout.write("\t".repeat(this.getDepth()));
		} else {
			process.stdout.write(arguments[i].toString());
		}
	}
	process.stdout.write("\n");
	
	this.length++;
	if (this.length >= maxGameLength) {
		this.isRunning = false;
	}
};

FuzzerGame.prototype.awaitCommitment = function(commitment) {
	if (!commitment.isResolved) {
		commitment.resolve(commitment.format.random());
	}
	return commitment.value;
};

FuzzerGame.prototype.revealTo = function*(player, commitment) {
	return this.awaitCommitment(commitment);
};

FuzzerGame.prototype.win = function*(player) {
	this.log(player, " wins!");
	this.winner = player;
	yield this.pause();
};

// Set up game
while (true) {
	let player1 = { name: "John" };
	let player2 = { name: "Champ" };
	let player3 = { name: "Monty" };
	let setup = new Game.Setup([
			Expression.fromList(["you_draw"]),
			Expression.fromList(["specify_action_or_amendment", "you", "majority_vote"])
		], CardSet.create(defaultDeck), [4, 5, 6], [20]);
	let game = new FuzzerGame(setup, [player1, player2, player3]);
	game.run();
	process.stdout.write("\n");
	process.stdout.write("===============================================");
	process.stdout.write("\n");
}