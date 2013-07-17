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
		_.bindAll( this );
	};

	Process.prototype.allowRestart = function( file ) {
		var ignore = this.config.ignore,
			watch = this.config.watch,
			watching = !_.isEmpty( watch ),
			ignoring = !_.isEmpty( ignore ),
			noConfig = !watching && !ignoring,
			ignored = ignoring && this.contains( ignore, file ),
			watched = watching && this.contains( watch, file );

		if( noConfig ) {
			return true;
		} else if( ignored ) {
			return false;
		} else if( watched ) {
			return true;
		} else if( watching ) {
			return false;
		} else {
			return true;
		}
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
		this.emit( "started", { id: this.id } );
		handle.on( "exit", function( code, signal ) {
			self.emit( "exit", { id: this.id, code: code } );
			self.running = false;
		} );
		this.handle = handle;
		return handle;
	};

	Process.prototype.stop = function() {
		var self = this;
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
	};

	Process.prototype.restart = function() {
		var self = this;
		if( !this.running ) {
			this.start();
		}
		if( this.config.restart && this.allowRestart( changedFile ) ) {
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