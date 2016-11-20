
window.onload = function() {
	let goreflex = new Player();
	goreflex.name = "Goreflex";
	
	let setup = new Game.Setup(
		[
			goreflex
		],[
			["you_gain_5"],
			["you_draw_2"],
			["insert_ammendment_conditional", "you", "decide_bool", "you"],
			["specify_action_optional", "you"],
			["you_draw_2"]
		],defaultDeck);
	
	let inteface = new Interface(setup, 0, {
		deckDraw: document.getElementById("deck-draw"),
		deckDiscard: document.getElementById("deck-discard"),
		deckPlay: document.getElementById("deck-play"),
		
		constitutionNumbers: document.getElementById("section-constitution-numbers"),
		constitutionList: document.getElementById("section-constitution-list"),
		log: document.getElementById("section-log"),
		
		inputBoolean: document.getElementById("input-boolean"),
		inputBooleanYes: document.getElementById("input-boolean-yes"),
		inputBooleanNo: document.getElementById("input-boolean-no"),
		
		inputExpression: document.getElementById("input-expression"),
		inputExpressionList: document.getElementById("input-expression-list"),
		inputExpressionAccept: document.getElementById("input-expression-accept"),
		inputExpressionPass: document.getElementById("input-expression-pass"),
		
		selfHand: document.getElementById("section-player-self-hand")
	});
	inteface.canResolveRandomness = true;
	inteface.run(null);
}