'use strict';

var app = require("express")(),
	http = require("http").Server(app),
	io = require("socket.io")(http),
	util = require("util");

var players = [];
var maxPlayers = 4;
var fps = 20;
var g;
var pi2 = Math.PI*2;

Array.prototype.last = function() {
	return this[this.length - 1];
};

Array.prototype.popN = function(n) {
	if (n > this.length) { n = this.length; }
	for(; n > 0; n--) {
		this.pop();
	}
};

function init() {
	io
		.listen(8901, {})
		.on("connection", onNewConnection);
	util.log("server created?");
	
	g = new Game();
	setInterval(g.update, 1000 / fps);
};

function onNewConnection(cl) {
	util.log("New connection: " + cl.id);
	cl.on("disconnect", onClientDisconnect);
	cl.on("hello", onHello);
	cl.on("mouse", g.mouseHandler);
};

function onClientDisconnect() {
	util.log("disco!");
};

function onHello() {
	util.log("Hello from client");
}

init();


function Game() {
	var g = this;
	var pts = [];
	var lines = [];
	var growing = false;
	var appendage = [];
	var sourceP = null;
	var targetP = null;
	var hoverP = null;
	var frameNum = 0;
	
	var collisions = [];
	
	var minSpacing = 24;
	var lineSegment = 16;
	var targetSnap = 16;
	
	var pointC = "rgba(255,128,64,0.7)";
	var hlC = "rgba(255,128,64,0.3)";
	var lineC = "rgba(255,128,64,0.4)";
	var appendageC = [
		"rgba(128,128,192,0.40)",
		"rgba(128,128,192,0.42)",
		"rgba(128,128,192,0.43)",
		"rgba(128,128,192,0.44)",
		"rgba(128,128,192,0.46)",
		"rgba(128,128,192,0.47)",
		"rgba(128,128,192,0.48)",
		"rgba(128,128,192,0.50)",
		"rgba(128,128,192,0.52)",
		"rgba(128,128,192,0.53)",
		"rgba(128,128,192,0.54)",
		"rgba(128,128,192,0.55)",
		"rgba(128,128,192,0.56)",
		"rgba(128,128,192,0.55)",
		"rgba(128,128,192,0.54)",
		"rgba(128,128,192,0.53)",
		"rgba(128,128,192,0.52)",
		"rgba(128,128,192,0.50)",
		"rgba(128,128,192,0.48)",
		"rgba(128,128,192,0.47)",
		"rgba(128,128,192,0.46)",
		"rgba(128,128,192,0.44)",
		"rgba(128,128,192,0.43)",
		"rgba(128,128,192,0.42)",
	];
	var targetC = "rgba(128,255,64,0.5)";
	var sourceC = "rgba(128,255,64,0.5)";
	var noTargetC = "rgba(255,128,64,0.5)";
	
	g.update = function() {
		var doGrow = (frameNum % 2) == 0;
		if (growing) { //appendage nie może być pusta!
			if (doGrow) {
				var lastA = appendage.last();
				
				var dX = targetP.x - lastA.x;
				var dY = targetP.y - lastA.y;
				var distToTarget = Math.hypot(dX, dY);
				if (distToTarget < targetSnap) { //udało się zrobić linię!
					//czy nowy punkt czy podłączamy do istniejącego
					var newA;
					if (targetP.p != null) { //podłącz
						newA = { x: targetP.p.x, y: targetP.p.y };
					} else {
						newA = { x: targetP.x, y: targetP.y };
					}
					if (targetP == null && intersects(lastA, newA)) { //jest przecięcie, przerywamy zabawę.
					} else {
						if (targetP.p == null) {
							pts.push(newA);
						}
						appendage.push(newA);
						lines.push(appendage);
						
						appendage = [];
					}
					stopGrow();
				} else { //jeszcze rośnie
					var scale = lineSegment / distToTarget;
					var newA = {
							x: (lastA.x + (dX * scale)) |0, //robimy int, inaczej sprawdzanie kolizji się sypie...
							y: (lastA.y + (dY * scale)) |0
					};
					//sprawdź przecięcie z innymi liniami
					//tylko dla punktów powyżej pierwszego!
					if (appendage.length > 1 && intersects(lastA, newA)) { //jest przecięcie, przerywamy rośnięcie.
						stopGrow();
					} else {
						appendage.push(newA);
					}
//					$log.debug("app: ", appendage);
				}
			}
		} else if (appendage.length > 0) {
			appendage.popN(2);
		}
		
		updatePlayers();
	};
	
	function updatePlayers() {
		io.emit("update", {
			'pts': pts,
			'lines': lines,
			'growing': growing,
			'appendage': appendage,
			'sourceP': sourceP,
			'targetP': targetP,
			'hoverP': hoverP
		});
	};

	function startGrow(e, np) {
//		$log.debug("GR~!");
		if (np == null && appendage.length == 0) {
			sourceP = findNearestPoint(e.x, e.y);
			targetP = {x: e.x, y: e.y};
			growing = true;
//			appendage = [];
			appendage.push(sourceP);
		}
	}
	
	function stopGrow() {
		growing = false;
		targetP = null;
		sourceP = null;
		//nie czyścimy appendage, samo się kurczy!
	}
	
	function findNearestPoint(x, y) {
		var i;
		var minD = 100000;
		var minP = null;
		
		for (i = pts.length - 1; i > -1; i--) {
			var p = pts[i];
			var d = Math.hypot(x - p.x, y - p.y);
			if (d < minD) {
				minP = p;
				minD = d;
			}
		}
		return minP;
	};
	
	function findNearPoint(x, y) {
		var i;
		var minD = 100000;
		var minP = null;
		
		for (i = pts.length - 1; i > -1; i--) {
			var p = pts[i];
			var d = Math.hypot(x - p.x, y - p.y);
			if (d < minSpacing && d < minD) {
				minP = p;
				minD = d;
			}
		}
		return minP;
	};

	function intersects(p2, p3) {
		for (var i = lines.length - 1; i > -1; i--) {
			if (intersectsLine(p2, p3, lines[i])) return true;
		}
		//nie sprawdzamy poprzednio zrobionego odcinka, bo na pewno się przetnie :)
		if (intersectsLine(p2, p3, appendage.slice(0, -1))) return true;
		return false;
	}
	
	function intersectsLine(p2, p3, l) {
		var lLen = l.length;
		var p0 = l[0];
		var p1 = p0;
		for (var j = 1; j < lLen; j++) {
			p1 = l[j];
			if (doesIntersect(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y)) {
//				$log.debug("kolizja: ", p0, p1, p2, p3);
				collisions.push({'p0': p0, 'p1': p1, 'p2': p2, 'p3': p3});
				return true;
			}
			p0 = p1;
		}
		return false;
	}
	
	//p. http://www.algorytm.org/geometria-obliczeniowa/przecinanie-sie-odcinkow.html
	function det(x0, y0, x1, y1, x2, y2) {
		return x0 * y1 + x1 * y2 + x2 * y0 - x2 * y1 - x0 * y2 - x1 * y0; 
	}
	
	function contains(x0, y0, x1, y1, x2, y2) {
		return (
			(Math.min(x0, x1) <= x2) && (x2 <= Math.max(x0, x1)) &&
			(Math.min(y0, y1) <= y2) && (y2 <= Math.max(y0, y1))
		);
	}
	
	function doesIntersect(x0, y0, x1, y1, x2, y2, x3, y3) {
		var det1 = det(x0, y0, x1, y1, x2, y2);
		var det2 = det(x0, y0, x1, y1, x3, y3);
		var det3 = det(x2, y2, x3, y3, x0, y0);
		var det4 = det(x2, y2, x3, y3, x1, y1);
		var inter =
			((det1 == 0) && contains(x0, y0, x1, y1, x2, y2)) ||
			((det2 == 0) && contains(x0, y0, x1, y1, x3, y3)) ||
			((det3 == 0) && contains(x2, y2, x3, y3, x0, y0)) ||
			((det4 == 0) && contains(x2, y2, x3, y3, x1, y1)) ||
			((det1 * det2) < 0) && ((det3 * det4) < 0);
		return inter;
	}
	
	g.mouseHandler = function(e) {
		var np = findNearPoint(e.x, e.y);
		switch (e.t) {
		case "u": //mouseUp
			if (growing) {
				stopGrow();
			}
			break;
		case "d": //mouseDown
			if (pts.length == 0) { //pierwszy punkt
				if (np == null) {
					pts.push({x: e.x, y: e.y});
				}
			} else {
				startGrow(e, np);
			}
			break;
		case "m": //mouseMove
			hoverP = {x: e.x, y: e.y, p: np}
			if (growing) {
				if (np == null) {
					targetP = hoverP;
				} else {
					targetP = np;
				}
			} else if (e.b == 1) { //przycisk wciśnięty, ale nie rośnie (jeszcze)
				startGrow(e, np);
			}
			break;
		}
	};
		
}