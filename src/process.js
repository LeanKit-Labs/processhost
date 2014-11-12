// !!! NOTICE !!! 
// This source is a copy/adaptation of Anvil.JS"s process host.
// Anvil.JS is an MIT/GPL product and so all rights are granted.
// Use of this source in a commercial or work-for-hire capacity does *not*
// confer exclusive rights.
// !!! NOTICE !!!

var _ = require( "lodash" );
var Monologue = require( "monologue.js" )( _ );
var machina = require( "machina" )( _ );
var debug = require( "debug" )( "processhost:process" );

function attachToIO( handle, stream, emit, id ) {
	if( handle[ stream ] ) {
		handle[ stream ].on( "data", function( data ) {
			emit( stream, { id: id, data: data } );
		} );
	}
}

// increments the count and after it would pass out of
// the restart window, decrements exits
function countCrash( fsm, restartWindow ) {
	if( restartWindow > 0 ) {
		fsm.exits ++;
		setTimeout( function() {
			fsm.exits --;
		}, restartWindow );
	}
}

function startProcess( spawn, config, id ) {
	debug( "Starting process '%s'", id );
	return spawn(
		config.command,
		config.args,
		{
			cwd: config.cwd || process.cwd(),
			stdio: config.stdio || "inherit",
			env: config.env || process.env
		} );
}

function stopProcess( handle, signals, id ) {
	if( _.isString( signals ) || _.isEmpty( signals ) ) {
		signals = [ signals || "SIGTERM" ];
	}
	debug( "Killing process '%s'", id );
	_.each( signals, function( signal ) {
		if( handle ) {
			try {
				handle.kill( signal );
			} catch( err ) {
				debug( "Error attempting to send", signal, "to process", handle.pid, err );
			}
		}
	} );
}

module.exports = function( spawn ) {
	var Process = machina.Fsm.extend( {
		initialize: function( id, config ) {
			this.id = id;
			this.config = config;
			this.exits = 0;
			_.bindAll( this );
		},
		crash: function( data ) {
			countCrash( this, this.config.restartWindow );
			this.emit( "crashed", { id: this.id, data: data } );
		},
		start: function() {
			process.nextTick( function() {
				this.handle( "start", {} );
			}.bind( this ) );
		},
		startProcess: function() {
			var config = this.config;
			this.transition( "starting" );
			this.processHandle = startProcess( spawn, config, this.id );

			attachToIO( this.processHandle, "stderr", this.emit, this.id );
			attachToIO( this.processHandle, "stdout", this.emit, this.id );
			
			this.processHandle.on( "exit", function( code, signal ) {
				debug( "Process '%s' exited with code %d", this.id, code );
				this.handle( "processExit", { code: code, signal: signal } );
			}.bind( this ) );
			this.transition( "started" );
		},
		stop: function() {
			process.nextTick( function() {
				this.handle( "stop", {} );
			}.bind( this ) );
		},
		stopProcess: function() {
			if( this.processHandle ) {
				stopProcess( this.processHandle, this.config.killSignal, this.id );
			}
		},
		write: function( data ) {
			if( this.processHandle && this.processHandle.stdin ) {
				this.processHandle.stdin.write( data );
			}
		},
		states: {
			uninitialized: {
				start: function() {
					this.startProcess();
				}
			},
			crashed: {
				_onEnter: function() {
					debug( "Process '%s' entering '%s' state", this.id, this.state );
				},
				start: function() {
					this.startProcess();
				}
			},
			restarting: {
				_onEnter: function() {
					debug( "Process '%s' entering '%s' state", this.id, this.state );
					this.emit( "restarting", { id: this.id } );
				},
				processExit: function( data ) {
					debug( "Process '%s' exited during restart", this.id );
					this.startProcess();
				}
			},
			starting: {
				_onEnter: function() {
					debug( "Process '%s' entering '%s' state", this.id, this.state );
					this.emit( "starting", { id: this.id } );
				},
				stop: function() {
					this.deferUntilNextHandler();
				},
				processExit: function( data ) {
					debug( "Process '%s' crashed during starting", this.id, this.state );
					this.crash( data );
				}
			},
			started: {
				_onEnter: function() {
					debug( "Process '%s' entering '%s' state", this.id, this.state );
					this.emit( "started", { id: this.id } );
				},
				start: function() {
					debug( "Process '%s' is being restarted", this.id );
					this.transition( "restarting" );
					this.stopProcess();
				},
				stop: function() {
					this.transition( "stopping" );
					this.stopProcess();
				},
				processExit: function( data ) {
					this.transition( "crashed" );
					this.crash( data );
				}
			},
			stopping: {
				_onEnter: function() {
					debug( "Process '%s' entering '%s' state", this.id, this.state );
				},
				processExit: function( data ) {
					debug( "Process '%s' exited", this.id );
					this.emit( "exit", { id: this.id, data: data } );
					this.transition( "stopped" );
				}
			},
			stopped: {
				_onEnter: function() {
					this.emit( "stopped", { id: this.id } );
					debug( "Process '%s' entering '%s' state", this.id, this.state );
				},
				start: function() {
					this.exits = 0;
					this.startProcess();
				}
			}
		}
	} );
	Monologue.mixin( Process );
	return Process;
};