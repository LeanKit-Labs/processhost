// !!! NOTICE !!! 
// This source is a copy/adaptation of Anvil.JS's process host.
// Anvil.JS is an MIT/GPL product and so all rights are granted.
// Use of this source in a commercial or work-for-hire capacity does *not*
// confer exclusive rights.
// !!! NOTICE !!!

module.exports = function( _, spawn, minimatch, Monologue, machina ) {
	var Process = machina.Fsm.extend( {
		initialize: function( id, config ) {
			this.id = id;
			this.config = config;
			this.exits = 0;
			_.bindAll( this );
		},
		contains: function ( list, file ) {
			var patterns = _.isArray( list ) ? list : [ list ];
			return _.any( patterns, function( pattern ) {
				var matched = minimatch( file, pattern );
				return matched;
			} );
		},
		start: function() {
			this.handle( 'start', {} );
		},
		startProcess: function() {
			var config = this.config;
			this.transition( 'starting' );
			this.processHandle = spawn(
				config.command,
				config.args,
				{
					cwd: config.cwd || process.cwd(),
					stdio: config.stdio || 'inherit',
					env: config.env || process.env
				} );

			this.transition( 'started' );
			this.processHandle.on( 'exit', function( code, signal ) {
				if( config.toleranceWindow > 0 ) {
					setTimeout( function() {
						this.exits --;
					}.bind( this ), config.toleranceWindow );
				}
				this.handle( 'processExit', { code: code, signal: signal } );
			}.bind( this ) );
		},
		stop: function() {
			this.handle( 'stop', {} );
		},
		stopProcess: function() {
			if( this.processHandle ) {
				var signals = this.config.killSignal,
					handle = this.processHandle;
				if( _.isString( signals ) || _.isEmpty( signals ) ) {
					signals = [ signals || 'SIGTERM' ];
				}
				_.each( signals, function( signal ) {
					if( handle ) {
						handle.kill( signal );
					}
				} );
			}
		},
		states: {
			uninitialized: {
				start: function() {
					this.startProcess();
				}
			},
			crashed: {
				start: function() {
					this.startProcess();
				}
			},
			restarting: {
				processExit: function( data ) {
					this.startProcess();
				}
			},
			starting: {
				stop: function() {
					this.deferUntilNextHandler();
				},
				processExit: function( data ) {
					this.emit( 'crash', { id: this.id, data: data } );
				}
			},
			started: {
				_onEnter: function() {
					this.emit( 'started', { id: this.id } );
				},
				start: function() {
					this.emit( 'restarting', { id: this.id } );
					this.stopProcess();
					this.transition( 'restarting' );
				},
				stop: function() {
					this.transition( 'stopping' );
					this.stopProcess();
				},
				processExit: function( data ) {
					this.transition( 'crashed' );
					this.emit( 'crash', { id: this.id, data: data } );					
				}
			},
			stopping: {
				processExit: function( data ) {
					this.emit( 'exit', { id: this.id, data: data } );
					this.transition( 'stopped' );
				}
			},
			stopped: {
				start: function() {
					this.startProcess();
				}
			}
		}
	} );
	Monologue.mixin( Process );
	return Process;
};