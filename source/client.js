
window.onload = function() {
	var hand = new UI.Hand(document.getElementById("section-player-self-hand"));
	hand.draw(Cards["wealthiest_player"]);
	hand.draw(Cards["biggest_payor"]);
	hand.draw(Cards["majority_vote"]);
	hand.draw(Cards["wealth_vote"]);
	hand.draw(Cards["conditional"]);
	hand.draw(Cards["twice"]);
	hand.draw(Cards["or"]);
	
	var exp = new UI.Expression(document.getElementById("section-input"));
	exp.expect(Role.Action);
	
	let log = new UI.Log(document.getElementById("section-log"));
	
	var player = new Player(0, []);
	player.name = "Goreflex";
	
	var game = new Game(
		[player],
		[Expression.fromList([Cards["you_gain_5"]]),
		Expression.fromList([Cards["specify_action_optional"], Cards["you"]]),
		Expression.fromList([Cards["you_draw_2"]])]);
	game.onlog = log.log.bind(log);
	
	setInterval(function() {
		game.run(null, false);
	}, 500);
}