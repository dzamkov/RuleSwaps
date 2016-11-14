
window.onload = function() {
	var hand = new UI.Hand(document.getElementById("section-player-self-hand"));
	hand.draw(Cards["perform_action_required"]);
	hand.draw(Cards["wealthiest_player"]);
	hand.draw(Cards["biggest_payor"]);
	hand.draw(Cards["majority_vote"]);
} 