// !!! NOTICE !!! 
// This source is a copy/adaptation of Anvil.JS's process host.
// Anvil.JS is an MIT/GPL product and so all rights are granted.
// Use of this source in a commercial or work-for-hire capacity does *not*
// confer exclusive rights.
// !!! NOTICE !!!

module.exports = function( _, spawn, minimatch, Monologue ) {
	var Process = function( id, config ) {
		this.id = id;
		this.config = config;
		this.running = false;
		this.stopping = false;
		this.stopped = false;
		this.exits = 0;
		_.bindAll( this );
	};

	Process.prototype.contains = function ( list, file ) {
		var patterns = _.isArray( list ) ? list : [ list ];
		return _.any( patterns, function( pattern ) {
			var matched = minimatch( file, pattern );
			return matched;
		} );
	};

	Process.prototype.start = function() {
		if( this.running === true ) {
			return;
		}
		var self = this,
			config = this.config,
			handle = spawn(
				config.command,
				config.args,
				{
					cwd: config.cwd || process.cwd(),
					stdio: config.stdio || "inherit",
					env: config.env || process.env
				} );
		this.running = true;
		this.stopped = false;
		this.emit( "started", { id: this.id } );
		handle.on( "exit", function( code, signal ) {
			self.running = false;
			self.emit( "exit", { id: this.id, code: code } );
			if( config.toleranceWindow > 0 ) {
				setTimeout( function() {
					self.exits --;
				}, config.toleranceWindow);
			}
		} );
		this.handle = handle;
		return handle;
	};

	Process.prototype.stop = function() {
		var self = this;
		this.stopping = true;
		if( this.handle ) {
			var signals = this.config.killSignal,
				handle = this.handle;
			if( _.isString( signals ) || _.isEmpty( ) ) {
				signals = [ signals || "SIGTERM" ];
			}

			_.each( signals, function( signal ) {
				if( handle ) {
					handle.kill( signal );
				}
			} );
			this.emit( "stopped", { id: this.id } );
		}
		this.stopping = false;
		this.stopped = true;
	};

	Process.prototype.restart = function() {
		var self = this;
		if( this.stopped || this.stopping ) {
			return;
		}
		if( !this.running ) {
			this.start();
		}
		if( this.config.restart ) {
			this.once( "exit", function() {
				setTimeout( function() {
					self.start();
				}, 200 );
			} );
			this.stop();
		}
	};

	Monologue.mixin( Process );
	return Process;
};