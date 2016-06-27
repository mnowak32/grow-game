'use strict';

var fps = 25;
var $log = console;
var pi2 = Math.PI*2;

function Screen(ctx, dims) {
	var s = this;
	
	//kilka defaultów
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	
	s.clear = function() {
		ctx.clearRect(0, 0, dims.x, dims.y);
	};
	
	s.point = function(x, y, c) {
		ctx.beginPath();
		ctx.arc(x, y, 10, 0, pi2);
		ctx.fillStyle = c;
		ctx.fill();
		ctx.closePath();
	};
	
	s.pointHl = function(x, y, c) {
		ctx.beginPath();
		ctx.arc(x, y, 20, 0, pi2);
		ctx.fillStyle = c;
		ctx.fill();
//		ctx.closePath();
	};
	
	s.line = function(x0, y0, x1, y1, c) {
		ctx.beginPath();
		ctx.moveTo(x0, y0);
		ctx.lineTo(x1, y1);
		ctx.lineWidth = 8;
		ctx.strokeStyle = c;
		ctx.stroke();
//		ctx.closePath();
	};
	
	s.thinLine = function(x0, y0, x1, y1, c) {
		ctx.beginPath();
		ctx.moveTo(x0, y0);
		ctx.lineTo(x1, y1);
		ctx.lineWidth = 1;
		ctx.strokeStyle = c;
		ctx.stroke();
//		ctx.closePath();
	};
}

function Game(scr, mou, socket) {
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
		scr.clear();
		var i;
		for (i = pts.length - 1; i >= 0; i--) {
			scr.point(pts[i].x, pts[i].y, pointC);
		}
		for (i = lines.length - 1; i >= 0; i--) {
			drawLine(lines[i], lineC);
		}
		if (appendage.length > 0) {
			drawLine(appendage, appendageC[frameNum % 24]);
		}
		
		for (i = collisions.length - 1; i >= 0; i--) {
			var c = collisions[i];
			scr.thinLine(c.p0.x, c.p0.y, c.p1.x, c.p1.y, "#f00");
			scr.thinLine(c.p2.x, c.p2.y, c.p3.x, c.p3.y, "#0f0");
		}
		
		if (sourceP != null) {
			scr.pointHl(sourceP.x, sourceP.y, hlC);
		}
		if (hoverP != null) {
			if (hoverP.p == null) {
				scr.pointHl(hoverP.x, hoverP.y, targetC);
			} else {
				scr.pointHl(hoverP.x, hoverP.y, noTargetC);
			}
		}
		
		frameNum++;
	};
	
	function drawLine(l, c) {
		var lLen = l.length;
		var p0 = l[0];
		for (var j = 1; j < lLen; j++) {
			var p1 = l[j];
			scr.line(p0.x, p0.y, p1.x, p1.y, c);
			p0 = p1;
		}
	}
	
	g.mouseHandler = function(e) {
		socket.emit("mouse", e);
	};
	
	g.updateFromServer = function(d) {
		pts = d.pts;
		lines = d.lines;
		growing = d.growing;
		appendage = d.appendage;
		sourceP = d.sourceP;
		targetP = d.targetP;
		hoverP = d.hoverP;
	}
	
	mou.handler = g.mouseHandler;
}

function Mouse($src) {
	var m = this;
	var bState = 0;
	
	m.handler = null;
	
	$log.debug("$src is", $src);
	$src.on("mousedown", function(e) { mouseDown(e); })
		.on("mouseup", function(e) { mouseUp(e); })
		.on("mousemove", function(e) { mouseMove(e); });
	
	var deltaX = $src.offset().left;
	var deltaY = $src.offset().top;
	$log.debug("deltaX,Y::", deltaX, deltaY);
	
	function passEvent(type, e) {
		var eData = {t: type, x: e.pageX - deltaX, y: e.pageY - deltaY, b: bState};
		if (m.handler) {
			m.handler(eData);
		}
	};
	
	function mouseDown(e) {
		bState = 1;
		passEvent("d", e);
	};
	
	function mouseUp(e) {
		bState = 0;
		passEvent("u", e);
	};
	
	function mouseMove(e) {
		passEvent("m", e);
	};
	
	$log.debug("mouse initialized");
}

$(function() {
	var $canv = $("canvas");
	var dims = {x: $canv.width(), y: $canv.height()};
	$canv
		.attr("width", dims.x)
		.attr("height", dims.y);
	var ctx = $canv.get(0).getContext("2d");
	
	var socket = io("http://localhost:8901");
	socket.emit("hello");
	
	var scr = new Screen(ctx, dims);
	var mou = new Mouse($canv);
	var g = new Game(scr, mou, socket);
	
	socket.on("update", g.updateFromServer);
	
	setInterval(g.update, 1000 / fps);
	
});