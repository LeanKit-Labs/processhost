// !!! NOTICE !!! 
// This source is a copy/adaptation of Anvil.JS"s process host.
// Anvil.JS is an MIT/GPL product and so all rights are granted.
// Use of this source in a commercial or work-for-hire capacity does *not*
// confer exclusive rights.
// !!! NOTICE !!!

var _ = require( "lodash" );
var when = require( "when" );
var Monologue = require( "monologue.js" )( _ );
var spawn = require( "win-spawn" );
var Process = require( "./process.js" )( spawn );
var debug = require( "debug" )( "processhost:host" );

module.exports = function() {

	var ProcessHost = function() {
		var shutdown;
		this.processes = {};

		shutdown = function() {
			shutdown = function() {};
			this.stop();
			process.exit( 0 );
		}.bind( this );

		process.on( "SIGINT", shutdown );
		process.on( "SIGTERM", shutdown );
		process.on( "exit", shutdown );
		_.bindAll( this );
	};

	ProcessHost.prototype.create = function( id, config ) {
		return when.promise( function( resolve ) {
			var handle = id ? this.processes[ id ] : undefined;
			if( !handle || config ) {
				handle = new Process( id, config );
				this.processes[ id ] = handle;

				handle.on( "#", function( data, envelope ) {
					this.emit( data.id + "." + envelope.topic, data );
				}.bind( this ) );

				handle.on( "crashed", function( /* data */ ) {
					debug( "Process '%s' crashed with '%d' - restart limit was set at '%d' within '%d'", id, handle.exits, config.restartLimit, config.restartWindow );
					if( ( handle.exits <= config.restartLimit || !config.restartLimit ) ) {
						debug( "Restarting process '%s'", id );
						handle.start();
					} else {
						this.emit( "failed", { exits: handle.exits, id: id } );
						this.emit( id + ".failed", { exits: handle.exits, id: id } );
					}
				}.bind( this ) );
			}
			resolve( handle );			
		}.bind( this ) );
	};

	ProcessHost.prototype.restart = function( id ) {
		var process = id ? this.processes[ id ] : undefined;
		if( id === undefined ) {
			_.each( this.processes, function( process ) {
				process.start();
			} );
		} else if( process ) {
			process.start();
		}
	};

	ProcessHost.prototype.setup = function( hash ) {
		var promises = _.map( hash, function( config, id ) {
			var call = config.start ? this.start : this.create;
			return call( id, config );
		}.bind( this ) );
		return when.all( promises );
	};

	ProcessHost.prototype.start = function( id, config ) {
		var handle = id ? this.processes[ id ] : undefined;
		if( handle && /start/.test( handle.state ) && config ) {
			return when.promise( function( resolve ) {
				handle.once( "exit", function() {
					handle.start();
					resolve( handle );
				}.bind( this ) );
				handle.stop();
			}.bind( this ) );
		} else {
			return this.create( id, config )
				.then( function( handle ) {
					handle.start();
					return handle;
				} );
		}
	};

	ProcessHost.prototype.stop = function( id ) {
		if( id ) {
			var process = id ? this.processes[ id ] : undefined;
			if( process ) {
				process.stop();
			}
		} else {
			_.each( this.processes, function( process ) {
				process.stop();
			} );
		}
	};
	
	Monologue.mixin( ProcessHost );
	return new ProcessHost();
};