// Contains functions related to animated elements and dragging.
var Motion = new function() {
	
	// TODO: Smooth motion
	
	// Prevents an event from propogating.
	function pauseEvent(e) {
		if (e.stopPropogation) e.stopPropogation();
		if (e.preventDefault) e.preventDefault();
		e.cancelBubble = true;
		e.returnValue = false;
	}
	
	// Handles a mouse down on a potentially draggable element.
	function draggableMouseDown(e) {
		if (e.button === 0 && !window.dragging) {
			pauseEvent(e);
			
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
				rect = animated.getClientRect();
			}
			
			// Start dragging
			if (animated) {
				let target = animated.element;
				target.style.position = "fixed";
				target.style.left = rect.left + "px";
				target.style.top = rect.top + "px";
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
	}
	
	// Replaces this animated element with the given animated element.
	Animated.prototype.replace = function(other) {
		this.element.parentNode.replaceChild(other.element, this.element);
		other.element.style.position = this.element.style.position;
		other.element.style.left = this.element.style.left;
		other.element.style.top = this.element.style.top;
	}
	
	// Causes this animated element to merge into the given hole of the given acceptor.
	Animated.prototype.mergeInto = function(acceptor, hole) {
		acceptor.accept(this, hole);
	}
	
	// Causes this animated element to move smoothly to the given coordinates relative to its parent.
	Animated.prototype.moveTo = function(left, top) {
		let element = this.element;
		if (!element.style.position)
			element.style.position = "absolute";
		element.style.left = left + "px";
		element.style.top = top + "px";
	}
	
	// Gets the rectangle that this animated element is moving to.
	Animated.prototype.getTargetRect = function() {
		let offsetLeft = this.element.offsetLeft;
		let offsetTop = this.element.offsetTop;
		return {
			left: offsetLeft,
			top: offsetTop,
			right: offsetLeft + this.element.offsetWidth,
			bottom: offsetTop + this.element.offsetHeight
		};
	}
	
	// Gets the current client rectangle of this animated element.
	Animated.prototype.getClientRect = function() {
		let element = this.element;
		var rect = element.getBoundingClientRect();
		return rect;
	}
	
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
		
		// e.g. return { rect, element.getBoundingClientRect(), animated: element.animated, hole: createHole() }
	}
	
	// Called when the user attempts to drag an element into this acceptor. If this acceptor is willing to
	// accept the element, it should return the hole that the element can merge into.
	Acceptor.prototype.dragIn = function(animated, left, top, fromAcceptor) {
		
		// Override me
		return null;
	}
	
	// Called when a draggable element leaves this acceptor, invalidating a hole.
	Acceptor.prototype.leave = function(animated, hole, isOriginalElement) {
		this.removeChild(hole);
	}
	
	// Accepts a new element into a hole of this acceptor.
	Acceptor.prototype.accept = function(animated, hole) {
		let element = animated.element;
		element.style.position = hole.style.position;
		element.style.left = hole.style.left;
		element.style.top = hole.style.top;
		this.element.replaceChild(element, hole);
	}
	
	
	// Handles mouse move events for the window
	function windowMouseMove(e) {
		let dragging = window.dragging;
		if (dragging) {
			let animated = dragging.animated;
			let element = animated.element;
			pauseEvent(e);
			animated.moveTo(
				e.clientX - dragging.offsetX,
				e.clientY - dragging.offsetY);
				
			// Remove current enter hole if we're too far away
			if (dragging.enterHole) {
				let eRect = element.getBoundingClientRect();
				let hRect = dragging.enterHole.getBoundingClientRect();
				if (eRect.right < hRect.left || 
					eRect.left > hRect.right || 
					eRect.bottom < hRect.top || 
					eRect.top > hRect.bottom)
				{
					dragging.enterAcceptor.leave(animated, dragging.enterHole, false);
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
				let left = e.clientX - rect.left;
				let top = e.clientY - rect.top;
				let nEnterHole = acceptor.dragIn(animated, left, top, dragging.exitAcceptor);
				if (nEnterHole && nEnterHole !== dragging.enterHole && nEnterHole !== dragging.exitHole) {
					if (dragging.enterHole) dragging.enterAcceptor.leave(animated, dragging.enterHole, false);
					dragging.enterHole = nEnterHole;
					dragging.enterAcceptor = acceptor;
				}
			}
		}
	}
	
	// Handles mouse up events for the window
	function windowMouseUp(e) {
		var dragging = window.dragging;
		if (e.button === 0 && dragging) {
			pauseEvent(e);
			window.dragging = null;
			
			// Begin merging
			if (dragging.enterHole) {
				dragging.animated.mergeInto(dragging.enterAcceptor, dragging.enterHole);
				if (dragging.exitHole)
					dragging.exitAcceptor.leave(dragging.animated, dragging.exitHole, true);
			} else if (dragging.exitHole) {
				dragging.animated.mergeInto(dragging.exitAcceptor, dragging.exitHole);
			}
		}
	}
	
	// Register window event listeners
	window.addEventListener("mousemove", windowMouseMove);
	window.addEventListener("mouseup", windowMouseUp);

	this.Animated = Animated;
	this.Acceptor = Acceptor;
}