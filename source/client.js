
window.onload = function() {
	let goreflex = new Player();
	goreflex.name = "Goreflex";
	
	let setup = new Game.Setup(
		[
			goreflex
		],[
			["you_gain_5"],
			["specify_action_optional", "you"],
			["you_draw_2"]
		],{
			"you_gain_5": 3,
			"you_draw_2": 3,
			"twice": 3,
			"conditional": 4,
			"or": 2,
			"majority_vote": 10
		});
	
	let inteface = new Interface(setup, 0, {
		deckDraw: document.getElementById("deck-draw"),
		deckDiscard: document.getElementById("deck-discard"),
		deckPlay: document.getElementById("deck-play"),
		
		log: document.getElementById("section-log"),
		
		inputExpression: document.getElementById("input-expression"),
		inputExpressionList: document.getElementById("input-expression-list"),
		inputExpressionAccept: document.getElementById("input-expression-accept"),
		inputExpressionPass: document.getElementById("input-expression-pass"),
		
		selfHand: document.getElementById("section-player-self-hand")
	});
	inteface.canResolveRandomness = true;
	inteface.run(null);
}