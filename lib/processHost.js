// !!! NOTICE !!! 
// This source is a copy/adaptation of Anvil.JS's process host.
// Anvil.JS is an MIT/GPL product and so all rights are granted.
// Use of this source in a commercial or work-for-hire capacity does *not*
// confer exclusive rights.
// !!! NOTICE !!!

var _ = require( 'lodash' ),
	Monologue = require( 'monologue.js' )( _ ),
	machina = require( 'machina' )( _ ),
	spawn = require( 'win-spawn' ),
	minimatch = require( 'minimatch' ),
	Process = require( './process.js' )( _, spawn, minimatch, Monologue, machina );

module.exports = function() {

	var ProcessHost = function() {
		var shutdown;
		this.processes = {};

		shutdown = function() {
			shutdown = function() {};
			this.stop();
			process.exit( 0 );
		}.bind( this );

		process.on( 'SIGINT', shutdown );
		process.on( 'SIGTERM', shutdown );
		process.on( 'exit', shutdown );
		_.bindAll( this );
	};

	ProcessHost.prototype.stop = function() {
		_.each( this.processes, function( process, pid ) {
			process.stop();
		} );
	};

	ProcessHost.prototype.startProcess = function( id, config ) {
		var handle = id ? this.processes[ id ] : undefined;
		if( handle && /start/.test( handle.state ) && config ) {
			handle.once( 'exit', function() {
				this.createProcess( id, config );
			}.bind( this ) );
			handle.stop();
		} else {
			this.createProcess( id, config );
		}
	};

	ProcessHost.prototype.createProcess = function( id, config ) {
		var handle = id ? this.processes[ id ] : undefined;
		if( !handle || config ) {
			handle = new Process( id, config );
			this.processes[ id ] = handle;
			
			handle.on( '#', function( data, envelope ) {
				this.emit( data.id + '.' + envelope.topic, data );
			}.bind( this ) );
			
			handle.on( 'crash', function( data ) {
				handle.exits ++;
				console.log( 'process crashed with', handle.exits, 'and a tolerance of', config.tolerance );
				if( ( handle.exits <= config.tolerance || !config.tolerance ) ) {
					console.log( 'restarting process' );
					handle.start();
				} else {
					this.emit( 'failed', { exits: handle.exits, id: id } );
				}
			}.bind( this ) );
		}
		handle.start();
	};

	ProcessHost.prototype.stopProcess = function( id ) {
		var process = id ? this.processes[ id ] : undefined;
		if( process ) {
			process.stop();
		}
	};
	
	ProcessHost.prototype.restart = function( id, config ) {
		var process = id ? this.processes[ id ] : undefined;
		if( id === undefined ) {
			_.each( this.processes, function( process, pid ) {
				process.start();
			} );
		} else {
			if( !process ) {
				process = new Process( id, config );
				process.start();
				this.processes[ id ] = process;
			} else {
				process.start();
			}
		}
	};
	Monologue.mixin( ProcessHost );
	return new ProcessHost();
};