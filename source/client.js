
window.onload = function() {
	var hand = new UI.Hand(document.getElementById("section-player-self-hand"));
	hand.draw(Cards["perform_action_required"]);
	hand.draw(Cards["wealthiest_player"]);
	hand.draw(Cards["biggest_payor"]);
	hand.draw(Cards["majority_vote"]);
	hand.draw(Cards["wealth_vote"]);
	hand.draw(Cards["conditional"]);
	hand.draw(Cards["twice"]);
	hand.draw(Cards["or"]);
	
	var exp = new UI.Expression(document.getElementById("section-input"));
	exp.expect(Role.Action);
} 