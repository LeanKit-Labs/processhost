// !!! NOTICE !!!
// This source is a copy/adaptation of Anvil.JS"s process host.
// Anvil.JS is an MIT/GPL product and so all rights are granted.
// Use of this source in a commercial or work-for-hire capacity does *not*
// confer exclusive rights.
// !!! NOTICE !!!

var _ = require( "lodash" );
var when = require( "when" );
var Monologue = require( "monologue.js" );
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

		this.removeListeners = function() {
			process.removeListener( "SIGINT", shutdown );
			process.removeListener( "SIGTERM", shutdown );
			process.removeListener( "exit", shutdown );
		};

		_.bindAll( this );
	};

	ProcessHost.prototype.createAndStart = function( id, config ) {
		return this.create( id, config )
			.then( function( process ) {
				return process.start();
			} );
	};

	ProcessHost.prototype.create = function( id, config ) {
		return when.promise( function( resolve, reject ) {
			var process = id ? this.processes[ id ] : undefined;
			if ( !process || config ) {
				process = Process( id, config );
				this.processes[ id ] = process;

				process.on( "#", function( data, envelope ) {
					this.emit( data.id + "." + envelope.topic, data );
				}.bind( this ) );
			}
			resolve( process );
		}.bind( this ) );
	};

	ProcessHost.prototype.restart = function( id ) {
		var process = id ? this.processes[ id ] : undefined;
		if ( id === undefined ) {
			return when.all( _.map( this.processes, function( process ) {
				return process.start();
			} ) );
		} else if ( process ) {
			return process.start();
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
		if ( !id ) {
			throw new Error( "Cannot call start without an identifier." );
		}
		var process = id ? this.processes[ id ] : undefined;
		if ( !process && !config ) {
			throw new Error( "Cannot call start on non-existent '" + id + "' without configuration." );
		}
		if ( process && /start/.test( process.state ) && config ) {
			return when.promise( function( resolve, reject ) {
				process.once( "exit", function() {
					process.off( "#" );
					this.createAndStart( id, config )
						.then( resolve, reject );
				}.bind( this ) );
				process.stop();
			}.bind( this ) );
		} else if ( config ) {
			return this.createAndStart( id, config );
		} else if ( process ) {
			return process.start();
		}
	};

	ProcessHost.prototype.stop = function( id ) {
		if ( id ) {
			var process = id ? this.processes[ id ] : undefined;
			if ( process ) {
				process.stop();
			}
		} else {
			_.each( this.processes, function( process ) {
				process.stop();
			} );
		}
	};

	Monologue.mixInto( ProcessHost );
	return new ProcessHost();
};
