var should = require( "should" );
var _ = require( "lodash" );
var processHost = require( "../src/processHost.js" );

describe( "when starting a child process", function() {
	var host;
	var hostEvent = false, stdoutData = false;

	before( function( done ) {

		host = processHost();
		host.start( "timer1", {
			cwd: "./spec",
			command: "node",
			args: [ "timer.js" ],
			stdio: "pipe"
		} );

		// written this way to test attaching after
		// to assert that use of nextTick delays start
		// long enough for the listener to catch "started"
		host.once( "timer1.started", function() {
			hostEvent = true;
		} );

		host.once( "timer1.stdout", function() {
			stdoutData = true;
			done();
		} );
	} );

	it( "should capture started event from host", function() {
		hostEvent.should.be.true; // jshint ignore:line
	} );

	it( "should have captured stdout data", function() {
		stdoutData.should.be.true; // jshint ignore:line
	} );

	after( function( done ) {
		host.once( "timer1.stopped", function() {
			done();
		} );
		host.stop();
	} );
} );

describe( "when setting up multiple child process", function() {
	var host;

	before( function( done ) {
		var remaining = 3;
		var onStart = function() {
			remaining--;
			if( remaining === 0 ) {
				done();
			}
		};
		host = processHost();
		host.setup( {
			"timer3a": {
				cwd: "./spec",
				command: "node",
				args: [ "timer.js" ],
				stdio: "pipe",
				start: true
			},
			"timer3b": {
				cwd: "./spec",
				command: "node",
				args: [ "timer.js" ],
				stdio: "pipe",
				start: true
			},"timer3c": {
				cwd: "./spec",
				command: "node",
				args: [ "timer.js" ],
				stdio: "pipe",
				start: true
			}
		} ).then( function( handles ) {
			_.each( handles, function( handle ) {
				handle.on( "started", onStart );
			} );
		} );
	} );

	it( "should capture started event from host", function() {
		
	} );

	it( "should have captured stdout data", function() {
		
	} );

	after( function() {
		host.stop();
	} );
} );