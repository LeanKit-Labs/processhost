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
var processFn = require( "./process.js" )( spawn );

module.exports = function() {
	var ProcessHost = function() {
		var shutdown;
		this.processes = {};
		// jscs:disable safeContextKeyword
		var host = this;
		// jscs:enable safeContextKeyword

		function onShutdown( exitCode ) {
			if ( !shutdown ) {
				shutdown = true;
				host.stop();
				host.removeListeners();
				process.exit( exitCode || 0 );
			}
		}

		process.on( "SIGINT", onShutdown );
		process.on( "SIGTERM", onShutdown );
		process.on( "exit", onShutdown );

		this.removeListeners = function() {
			process.removeAllListeners( "SIGINT", onShutdown );
			process.removeAllListeners( "SIGTERM", onShutdown );
			process.removeAllListeners( "exit", onShutdown );
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
			var child = id ? this.processes[ id ] : undefined;
			if ( !child || config ) {
				child = processFn( id, config );
				this.processes[ id ] = child;

				child.on( "#", function( data, envelope ) {
					this.emit( data.id + "." + envelope.topic, data );
				}.bind( this ) );
			}
			resolve( child );
		}.bind( this ) );
	};

	ProcessHost.prototype.restart = function( id ) {
		var child = id ? this.processes[ id ] : undefined;
		if ( id === undefined ) {
			return when.all( _.map( this.processes, function( child ) {
				return child.start();
			} ) );
		} else if ( child ) {
			return child.start();
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
		var child = id ? this.processes[ id ] : undefined;
		if ( !child && !config ) {
			throw new Error( "Cannot call start on non-existent '" + id + "' without configuration." );
		}
		if ( child && /start/.test( child.state ) && config ) {
			return when.promise( function( resolve, reject ) {
				child.once( "exit", function() {
					child.off( "#" );
					this.createAndStart( id, config )
						.then( resolve, reject );
				}.bind( this ) );
				child.stop();
			}.bind( this ) );
		} else if ( config ) {
			return this.createAndStart( id, config );
		} else if ( child ) {
			return child.start();
		}
	};

	ProcessHost.prototype.stop = function( id ) {
		if ( id ) {
			var child = id ? this.processes[ id ] : undefined;
			if ( child ) {
				child.stop();
			}
		} else {
			_.each( this.processes, function( child ) {
				child.stop();
			} );
		}
	};

	Monologue.mixInto( ProcessHost );
	return new ProcessHost();
};
