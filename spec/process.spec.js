require( "./setup" );

describe( "Live Process Control", function() {
	var child;
	var handleEvent = false;
	var stdoutData = false;
	var spawn;
	before( function( done ) {
		spawn = require( "win-spawn" );
		var Process = require( "../src/process.js" )( spawn );
		child = new Process( "timer2", {
			cwd: "./spec",
			command: "node",
			args: [ "timer.js" ],
			stdio: "pipe"
		} );

		// although you can attach *before* start
		// written this way to test attaching after
		// to assert that use of nextTick delays start
		// long enough for the listener to catch "started"
		child.start();
		child.once( "started", function() {
			handleEvent = true;
		} );
		child.once( "stdout", function() {
			stdoutData = true;
			done();
		} );
	} );

	it( "should capture started event from handle", function() {
		handleEvent.should.be.true; // jshint ignore:line
	} );

	it( "should have captured stdout data", function() {
		stdoutData.should.be.true; // jshint ignore:line
	} );

	after( function() {
		child.stop();
	} );
} );

describe( "Process transitions", function() {
	var child;
	describe( "with stubbed spawn", function() {
		var spawn;
		var onSpawn;
		var handle = {
			handles: {},
			off: function( ev ) {
				delete this.handles[ ev ];
			},
			on: function( ev, handler ) {
				this.handles[ ev ] = handler;
			},
			raise: function( ev, one, two, three ) {
				if ( this.handles[ ev ] ) {
					this.handles[ ev ]( one, two, three );
				}
			},
			removeAllListeners: function() {
				this.handles = {};
			},
			kill: function() {
				process.nextTick( function() {
					this.raise( "exit", 0, "" );
				}.bind( this ) );
			},
			crash: function() {
				process.nextTick( function() {
					this.raise( "exit", 100, "" );
				}.bind( this ) );
			}
		};
		_.bindAll( handle );

		before( function( done ) {
			spawn = function() {
				if ( onSpawn ) {
					process.nextTick( function() {
						onSpawn();
					} );
				}
				return handle;
			};
			var Process = require( "../src/process.js" )( spawn );
			child = new Process( "test", {
				command: "node",
				args: [ "node" ],
				restartLimit: 10,
				restartWindow: 1000
			} );
			child.start()
				.then( function() {
					done();
				} );
		} );

		it( "should be in the started state", function() {
			child.state.should.equal( "started" );
		} );

		describe( "when restarting a user restart-able process", function() {
			var transitionalState;

			before( function( done ) {
				child.once( "restarting", function() {
					transitionalState = child.state;
				} );

				child
					.start()
					.then( function() {
						done();
					} );
			} );

			it( "should restart the process (stop and start)", function() {
				transitionalState.should.equal( "restarting" );
			} );

			it( "should resolve to a started state", function() {
				child.state.should.equal( "started" );
			} );

			it( "should not increment exits", function() {
				child.exits.should.equal( 0 );
			} );
		} );

		describe( "when calling restart on an un-restart-able process", function() {
			var transitionalState;

			before( function( done ) {
				child.config.restart = false;
				child.once( "restarting", function() {
					transitionalState = child.state;
				} );

				child
					.start()
					.then( function() {
						done();
					} );
			} );

			it( "should not restart the process", function() {
				should.not.exist( transitionalState );
			} );

			it( "should stay in started", function() {
				child.state.should.equal( "started" );
			} );

			it( "should not increment exits", function() {
				child.exits.should.equal( 0 );
			} );
		} );

		describe( "when calling stop on a started process", function() {
			before( function( done ) {
				child.once( "exit", function() {
					done();
				} );
				child.stop();
			} );

			it( "should resolve to a stopped state", function() {
				child.state.should.equal( "stopped" );
			} );

			it( "should not increment exits", function() {
				child.exits.should.equal( 0 );
			} );

			after( function( done ) {
				child.once( "started", function() {
					done();
				} );
				child.start();
			} );
		} );

		describe( "when a process crashes", function() {
			var exit;
			before( function( done ) {
				child.once( "crashed", function( details ) {
					done();
					exit = details;
				} );
				handle.crash();
			} );

			it( "should have emitted a crash event", function() {
				exit.should.eql( { id: "test", data: { code: 100, signal: "" } } );
			} );

			it( "should increment exits", function() {
				child.exits.should.equal( 1 );
			} );

			it( "should restart", function() {
				child.state.should.equal( "started" );
			} );

			after( function( done ) {
				child.once( "started", function() {
					done();
				} );
				child.start();
			} );
		} );

		describe( "when a process crashes during restart", function() {
			before( function( done ) {
				onSpawn = function() {
					handle.crash();
				};

				child.once( "started", function() {
					done();
				} );

				child.start();
			} );

			it( "should resolve to a started state", function() {
				child.state.should.equal( "started" );
			} );

			it( "should increment exits", function() {
				child.exits.should.equal( 0 );
			} );

			after( function( done ) {
				onSpawn = undefined;
				child.start()
					.then( function() {
						done();
					} );
			} );
		} );

		describe( "when stopping a process", function() {
			before( function( done ) {
				child.once( "stopped", function() {
					done();
				} );
				child.stop();
			} );

			it( "should not increment exits", function() {
				child.exits.should.equal( 0 );
			} );

			it( "should end in a stopped state", function() {
				child.state.should.equal( "stopped" );
			} );
		} );
	} );
} );
