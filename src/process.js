// !!! NOTICE !!!
// This source is a copy/adaptation of Anvil.JS"s process host.
// Anvil.JS is an MIT/GPL product and so all rights are granted.
// Use of this source in a commercial or work-for-hire capacity does *not*
// confer exclusive rights.
// !!! NOTICE !!!

var _ = require( "lodash" );
var Monologue = require( "monologue.js" );
var machina = require( "machina" );
Monologue.mixInto( machina.Fsm );
var when = require( "when" );
var debug = require( "debug" )( "processhost:process" );

function attachToIO( handle, stream, emit, id ) {
	if ( handle[ stream ] ) {
		handle[ stream ].on( "data", function( data ) {
			emit( stream, { id: id, data: data } );
		} );
	}
}

// increments the count and after it would pass out of
// the restart window, decrements exits
function countCrash( fsm, restartLimit, restartWindow ) {
	if ( restartWindow > 0 ) {
		fsm.exits++;
		setTimeout( function() {
			if ( fsm.exits > 0 ) {
				fsm.exits--;
			}
		}, restartWindow );
	}
	debug( "Process '%s' crashed with '%d' - restart limit was set at '%d' within '%d'",
		fsm.id, fsm.exits, restartLimit, restartWindow );
	if ( restartLimit === undefined || fsm.exits <= restartLimit ) {
		debug( "Restarting crashed process, '%s'", fsm.id );
		fsm.handle( "start", {} );
	} else {
		fsm.handle( "failed", {} );
	}
}

function reportState( fsm ) {
	debug( "Process '%s' entering '%s' state", fsm.id, fsm.state );
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
	if ( _.isString( signals ) || _.isEmpty( signals ) ) {
		signals = [ signals || "SIGTERM" ];
	}
	debug( "Killing process '%s'", id );
	_.each( signals, function( signal ) {
		if ( handle ) {
			try {
				handle.kill( signal );
			} catch ( err ) {
				debug( "Error attempting to send", signal, "to process", handle.pid, err );
			}
		}
	} );
}

module.exports = function( spawn ) {
	return function( id, config ) {
		return new machina.Fsm( {
				_startProcess: function() {
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
				_stopProcess: function() {
					if ( this.processHandle ) {
						stopProcess( this.processHandle, this.config.killSignal, this.id );
					}
				},
				initialize: function() {
					this.id = id;
					this.config = config;
					this.exits = 0;
					if ( !_.has( config, "restart" ) ) {
						this.config.restart = true;
					}
					_.bindAll( this );
				},
				crash: function( data ) {
					this.transition( "crashed" );
					countCrash( this, this.config.restartLimit, this.config.restartWindow );
					var crashDetail = { id: this.id, data: data };
					this.emit( "crashed", crashDetail );
				},
				start: function() {
					this.exits = 0;
					return when.promise( function( resolve, reject ) {
						this.once( "started", function() {
							resolve( this );
						}.bind( this ) );
						this.once( "failed", reject );
						process.nextTick( function() {
							this.handle( "start", {} );
						}.bind( this ) );
					}.bind( this ) );
				},
				stop: function() {
					process.nextTick( function() {
						this.handle( "stop", {} );
					}.bind( this ) );
				},

				write: function( data ) {
					if ( this.processHandle && this.processHandle.stdin ) {
						this.processHandle.stdin.write( data );
					}
				},
				states: {
					uninitialized: {
						start: function() {
							this._startProcess();
						}
					},
					crashed: {
						_onEnter: function() {
							debug( "Process '%s' crashed in state %s", this.id, this.previousState );
							if ( this.processHandle ) {
								this.processHandle.removeAllListeners();
							}
						},
						start: function() {
							this._startProcess();
						},
						failed: function() {
							this.emit( "failed", { id: this.id } );
						}
					},
					restarting: {
						_onEnter: function() {
							reportState( this );
							this.emit( "restarting", { id: this.id } );
						},
						processExit: function( data ) {
							this._startProcess();
						}
					},
					starting: {
						_onEnter: function() {
							reportState( this );
							this.emit( "starting", { id: this.id } );
						},
						start: function() {
							this.deferUntilTransition( "started" );
						},
						stop: function() {
							this.deferUntilNextHandler();
						},
						processExit: function( data ) {
							this.crash( data );
						}
					},
					started: {
						_onEnter: function() {
							reportState( this );
							this.emit( "started", { id: this.id } );
						},
						start: function() {
							if ( this.config.restart && this.previousState !== "starting" ) {
								debug( "Process '%s' is being restarted", this.id );
								this.transition( "restarting" );
								this._stopProcess();
							} else {
								this.emit( "started", { id: this.id } );
							}
						},
						stop: function() {
							this.transition( "stopping" );
							this._stopProcess();
						},
						processExit: function( data ) {
							this.crash( data );
						}
					},
					stopping: {
						_onEnter: function() {
							reportState( this );
						},
						processExit: function( data ) {
							debug( "Process '%s' exited", this.id );
							this.emit( "exit", { id: this.id, data: data } );
							this.transition( "stopped" );
						}
					},
					stopped: {
						_onEnter: function() {
							reportState( this );
							this.emit( "stopped", { id: this.id } );
						},
						start: function() {
							this.exits = 0;
							this._startProcess();
						}
					}
				}
			} );
	};
};
