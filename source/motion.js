// Contains functions related to animated elements and dragging.
var Motion = new function() {
	
	// Causes the source element to be replaced by the target element. The source element will be
	// removed from the DOM.
	function replace(source, target) {
		target.style.position = source.style.position;
		target.style.left = source.style.left;
		target.style.top = source.style.top;
		source.parentNode.replaceChild(target, source);
	}
	
	// Smoothly animates and then merges the given source object into the given destination object.
	function mergeInto(source, dest) {
		source.target = dest;
		replace(dest, source);
	}
	
	// Sets an element to smoothly move to the given position within its parent. The first time this
	// is called on an element, it will be moved instantly.
	function moveTo(element, left, top) {
		var motion = element.motion || (element.motion = {});
		motion.target = { left: left, top: top };
		if (!element.style.position)
			element.style.position = "absolute";
		element.style.left = left + "px";
		element.style.top = top + "px";
	}
	
	// Gets the rectangle the given element is moving to.
	function getTargetRect(element) {
		var left = element.offsetLeft;
		var top = element.offsetTop;
		return {
			left: left,
			top: top,
			right: left + element.offsetWidth,
			bottom: top + element.offsetHeight
		};
	}
	
	// Places an element at a fixed place in view space.
	function fix(element, offset) {
		var motion = element.motion || (element.motion = {});
		motion.target = offset;
		element.style.position = "fixed";
		element.style.left = offset.left + "px";
		element.style.top = offset.top + "px";
	}
	
	// Prevents an event from propogating.
	function pauseEvent(e) {
		if (e.stopPropogation) e.stopPropogation();
		if (e.preventDefault) e.preventDefault();
		e.cancelBubble = true;
		e.returnValue = false;
	}
	
	// Handles the mouse down event for a draggable element.
	function draggableMouseDown(e) {
		if (e.button === 0 && !window.dragging) {
			pauseEvent(e);
			var motion, getExitHole;
			var target = e.target;
			while (!(motion = target.motion) || !(getExitHole = motion.getExitHole))
				target = target.parentNode;
			target.style.transition = "none";
			target.style.transform = "none";
			var rect = target.getBoundingClientRect();
			
			// Create substitution hole
			if (motion.target instanceof HTMLElement) {
				motion.exitHole = motion.target;
			} else {
				var hole = motion.exitHole = motion.getExitHole.call(target);
				replace(target, hole);
			}
			
			// Re-add item in screen space
			document.body.appendChild(target);
			fix(target, rect);
			target.style.transition = "";
			target.style.transform = "";
			window.dragging = {
				element: target,
				offsetX: e.clientX - rect.left,
				offsetY: e.clientY - rect.top
			};
		}
	}
	
	// Removes or resets an element being used as a placeholder for dragging.
	function cancelHole(hole) {
		var parent = hole.parentNode;
		var parentMotion, cancelHole;
		if ((parentMotion = parent.motion) && (cancelHole = parentMotion.cancelHole)) {
			cancelHole.call(parent, hole);
		} else {
			parent.removeChild(hole);
		}
	}
	
	// Handles mouse move events for the window
	function windowMouseMove(e) {
		var dragging = window.dragging;
		if (dragging) {
			var element = dragging.element;
			var elementMotion = element.motion;
			pauseEvent(e);
			moveTo(element,
				e.clientX - dragging.offsetX,
				e.clientY - dragging.offsetY);
				
			// Remove current enter hole if we're too far away
			if (elementMotion.enterHole) {
				var eRect = element.getBoundingClientRect();
				var hRect = elementMotion.enterHole.getBoundingClientRect();
				if (eRect.right < hRect.left || 
					eRect.left > hRect.right || 
					eRect.bottom < hRect.top || 
					eRect.top > hRect.bottom)
				{
					cancelHole(elementMotion.enterHole);
					elementMotion.enterHole = null;
				}
			}
			
			// Check behind dragged element for possible acceptor
			element.style.visibility = "hidden";
			var acceptor = document.elementFromPoint(e.clientX, e.clientY);
			element.style.visibility = "visible";
			
			// Traverse hiearchy for acceptor.
			var acceptorMotion, getEnterHole;
			while (acceptor && (!(acceptorMotion = acceptor.motion) ||
				!(getEnterHole = acceptorMotion.getEnterHole)))
			{			
				acceptor = acceptor.parentNode;
			}
			if (acceptor) {
				var rect = acceptor.getBoundingClientRect();
				var left = e.clientX - rect.left;
				var top = e.clientY - rect.top;
				var nEnterHole = getEnterHole.call(acceptor, element, left, top);
				if (nEnterHole !== elementMotion.enterHole) {
					if (elementMotion.enterHole)
						cancelHole(elementMotion.enterHole);
					elementMotion.enterHole = (nEnterHole !== elementMotion.exitHole) ? nEnterHole : null;
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
			var motion = dragging.element.motion;
			if (motion.enterHole) {
				mergeInto(dragging.element, motion.enterHole);
				if (motion.exitHole)
					cancelHole(motion.exitHole);
				motion.enterHole = motion.exitHole = null;
			} else if (motion.exitHole) {
				mergeInto(dragging.element, motion.exitHole);
				motion.exitHole = null;
			}
		}
	}
	
	function mouseEnter(e) {
		var target = e.target;
		var motion = target.motion;
		if (motion && motion.onHoverStyle) {
			target.className += " " + motion.onHoverStyle;
		}
	}
	
	function mouseLeave(e) {
		var target = e.target;
		var motion = target.motion;
		if (motion && motion.onHoverStyle) {
			target.className = target.className.replace(" " + motion.onHoverStyle, "");
		}
	}
	
	// Enables dragging of the given element, given a function that creates a drag placeholder
	// for the element. This is the element that the dragged element will merge into if it was not
	// dragged to an acceptable spot. If the placeholder is null, then the element will remain where
	// it is dragged to.
	function enableDrag(element, getExitHole, mergeInto) {
		var motion = element.motion || (element.motion = {});
		motion.getExitHole = getExitHole;
		element.addEventListener("mousedown", draggableMouseDown);
	}
	
	// Enables the given element to accept and hold dragged items, given a function that creates or gets a
	// placeholder for incoming elements.
	function enableAccept(element, getEnterHole, cancelHole) {
		var motion = element.motion || (element.motion = {});
		motion.getEnterHole = getEnterHole;
		motion.cancelHole = cancelHole;
	}
	
	// Sets the style to be applied to an element when the mouse is over it. (Unlike the CSS selector, this will
	// not flail around as the element is moved throughout the DOM).
	function styleOnHover(element, style) {
		var motion = element.motion || (element.motion = {});
		motion.onHoverStyle = style;
		element.addEventListener("mouseenter", mouseEnter);
		element.addEventListener("mouseleave", mouseLeave);
	}
	
	// Register window event listeners
	window.addEventListener("mousemove", windowMouseMove);
	window.addEventListener("mouseup", windowMouseUp);
	
	this.mergeInto = mergeInto;
	this.moveTo = moveTo;
	this.getTargetRect = getTargetRect;
	this.replace = replace;
	this.enableDrag = enableDrag;
	this.enableAccept = enableAccept;
	this.styleOnHover = styleOnHover;
}