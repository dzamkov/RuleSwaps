// Contains functions related to animated elements and dragging.
var Motion = new function() {
	
	// TODO: Smooth motion
	
	// Handles a mouse down on a potentially draggable element.
	function draggableMouseDown(e) {
		if (e.button === 0 && !window.dragging) {
			e.preventDefault();
			
			// Find animated and acceptor
			let animated, acceptor;
			let cur = e.target;
			while (cur != null) {
				animated = animated || cur.animated;
				acceptor = acceptor || cur.acceptor;
				cur = cur.parentNode;
			}
			
			// Consult with acceptor first
			let hole = null;
			let rect = null;
			if (acceptor) {
				let element = e.target;
				if (animated) element = animated.element;
				let res = acceptor.dragOut(element);
				if (res) {
					rect = res.rect;
					animated = res.animated;
					hole = res.hole;
				} else {
					return;
				}
			} else if (animated) {
				rect = animated.element.getBoundingClientRect();
				acceptor = null;
			}
			
			// Start dragging
			if (animated) {
				let target = animated.element;
				target.style.position = "fixed";
				target.style.left = rect.left + "px";
				target.style.top = rect.top + "px";
				target.style.width = rect.width + "px";
				target.style.height = rect.height + "px";
				document.body.appendChild(target);
				
				window.dragging = {
					animated: animated,
					offsetX: e.clientX - rect.left,
					offsetY: e.clientY - rect.top,
					exitHole: hole,
					exitAcceptor: acceptor,
					enterHole: null,
					enterAcceptor: null
				};
			}
		}
	}
	
	function mouseEnter(e) {
		let target = e.target;
		if (target.animated && target.animated.hoverStyle) {
			target.className += " " + target.animated.hoverStyle;
		}
	}
	
	function mouseLeave(e) {
		let target = e.target;
		if (target.animated && target.animated.hoverStyle) {
			target.className = target.className.replace(" " + target.animated.hoverStyle, "");
		}
	}
	
	// Augments an element with the ability to smoothly move across the DOM and be
	// dragged.
	function Animated(element) {
		this.element = element;
		this.hoverStyle = null;
		element.animated = this;
		element.addEventListener("mousedown", draggableMouseDown);
		element.addEventListener("mouseenter", mouseEnter);
		element.addEventListener("mouseleave", mouseLeave);
	};
	
	// Causes this animated element to merge into the given hole of the given acceptor.
	Animated.prototype.mergeInto = function(acceptor, hole, fromAcceptor) {
		this.makeStatic();
		acceptor.accept(this, hole, fromAcceptor);
	};
	
	// Causes this animated element to move smoothly to the given coordinates. This should only be used for
	// animated elements in a fixed space.
	Animated.prototype.moveTo = function(left, top) {
		let element = this.element;
		element.style.left = left + "px";
		element.style.top = top + "px";
	};

	// Causes this animated element to stop moving and act as a normal element.
	Animated.prototype.makeStatic = function() {
		this.element.style.position = "relative";
		this.element.style.left = "";
		this.element.style.top = "";
		this.element.style.width = "";
		this.element.style.height = "";
	};
	
	// Augments an element with the ability to accept animated elements dragged into it and have
	// its own animated children dragged out.
	function Acceptor(element) {
		this.element = element;
		element.acceptor = this;
		element.addEventListener("mousedown", draggableMouseDown);
	}
	
	// Called when the user attempts to drag a child element out of an acceptor. The child may
	// or may not be animated. If the acceptor is willing to let the element leave, it should
	// remove the element from the DOM and possibly create a placeholder for its return.
	Acceptor.prototype.dragOut = function(element) {

		// Override me
		return null;

		/* e.g. return { 
			rect, element.getBoundingClientRect(),
			animated: element.animated,
			hole: createHole()
		} */
	};
	
	// Called when the user attempts to drag an element into this acceptor. If this acceptor is willing to
	// accept the element, it should return the hole that the element can merge into.
	Acceptor.prototype.dragIn = function(animated, left, top, fromAcceptor) {

		// Override me
		return null;
	};
	
	// Called when a draggable element leaves this acceptor, invalidating a hole.
	Acceptor.prototype.leave = function(animated, hole, toAcceptor) {
		hole.parentNode.removeChild(hole);
	};
	
	// Accepts a new element into a hole of this acceptor.
	Acceptor.prototype.accept = function(animated, hole, fromAcceptor) {
		hole.parentNode.replaceChild(animated.element, hole);
	};
	
	// Handles mouse move events for the window
	function windowMouseMove(e) {
		let dragging = window.dragging;
		if (dragging) {
			let animated = dragging.animated;
			if (animated) {
				let element = animated.element;
				e.preventDefault();
				animated.moveTo(
					e.clientX - dragging.offsetX,
					e.clientY - dragging.offsetY);
					
				// Remove current enter hole if we're too far away
				if (dragging.exitHole && dragging.enterHole) {
					let eRect = element.getBoundingClientRect();
					let hRect = dragging.enterHole.getBoundingClientRect();
					if (eRect.right < hRect.left || 
						eRect.left > hRect.right || 
						eRect.bottom < hRect.top || 
						eRect.top > hRect.bottom)
					{
						dragging.enterAcceptor.leave(animated, dragging.enterHole, null);
						dragging.enterAcceptor = null;
						dragging.enterHole = null;
					}
				}
				
				// Check behind dragged element for possible acceptor
				element.style.visibility = "hidden";
				let acceptorElement = document.elementFromPoint(e.clientX, e.clientY);
				element.style.visibility = "visible";
				
				// Traverse hiearchy for acceptor.
				let acceptor;
				while (acceptorElement && !(acceptor = acceptorElement.acceptor))
					acceptorElement = acceptorElement.parentNode;
				if (acceptor) {
					let rect = acceptorElement.getBoundingClientRect();
					let left = e.clientX - rect.left + acceptorElement.scrollLeft;
					let top = e.clientY - rect.top + acceptorElement.scrollTop;
					let nEnterHole = acceptor.dragIn(animated, left, top, dragging.exitAcceptor);
					if (nEnterHole) {
						if (nEnterHole === dragging.enterHole) {
							// Nothing to do here
						} else if (nEnterHole === dragging.exitHole) {
							dragging.exitHole = null;
							dragging.enterHole = nEnterHole;
						} else {
							if (dragging.enterHole) {
								dragging.enterAcceptor.leave(animated, dragging.enterHole, null);
							}
							dragging.enterHole = nEnterHole;
						}
						dragging.enterAcceptor = acceptor;
					}
				}
			} else if (dragging.move) {
				dragging.move.call(dragging, e);
			}
		}
	}
	
	// Handles mouse up events for the window
	function windowMouseUp(e) {
		var dragging = window.dragging;
		if (e.button === 0 && dragging) {
			e.preventDefault();
			window.dragging = null;
			
			if (dragging.animated) {
				// Begin merging
				if (dragging.enterHole) {
					dragging.animated.makeStatic();
					dragging.animated.mergeInto(
						dragging.enterAcceptor,
						dragging.enterHole,
						dragging.exitAcceptor);
					if (dragging.exitHole)
						dragging.exitAcceptor.leave(
							dragging.animated,
							dragging.exitHole,
							dragging.enterAcceptor);
				} else if (dragging.exitHole) {
					dragging.animated.makeStatic();
					dragging.animated.mergeInto(dragging.exitAcceptor, dragging.exitHole, null);
				}
			}
		}
	}
	
	// Register window event listeners
	window.addEventListener("mousemove", windowMouseMove);
	window.addEventListener("mouseup", windowMouseUp);

	this.Animated = Animated;
	this.Acceptor = Acceptor;
}