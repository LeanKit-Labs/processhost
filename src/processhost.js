// !!! NOTICE !!! 
// This source is a copy/adaptation of Anvil.JS's process host.
// Anvil.JS is an MIT/GPL product and so all rights are granted.
// Use of this source in a commercial or work-for-hire capacity does *not*
// confer exclusive rights.
// !!! NOTICE !!!

var _ = require( "underscore" ),
	Monologue = require( "monologue.js" )( _ ),
	spawn = require( "win-fork" ),
	minimatch = require( "minimatch" ),
	Process = require( "./process.js" )( _, spawn, minimatch, Monologue );

module.exports = function() {

	var ProcessHost = function() {
		var self = this,
			shutdown;
		this.processes = {};
		this.lastChanged = "";
		this.started = false;

		shutdown = function() {
			shutdown = function() {};
			self.stop();
			process.exit( 0 );
		};

		process.on( "SIGINT", shutdown );
		process.on( "SIGTERM", shutdown );
		process.on( "exit", shutdown );
		_.bindAll( this );
	};

	ProcessHost.prototype.stop = function() {
		_.each( this.processes, function( process, pid ) {
			process.stop();
		} );
	};

	ProcessHost.prototype.startProcess = function( id, config ) {
		var self = this,
			process = id ? this.processes[ id ] : undefined;
		this.started = true;
		if( !process ) {
			process = new Process( id, config );
			this.processes[ id ] = process;
			process.on( "#", function( data, envelope ) {
				self.emit( data.id + "." + envelope.topic, data );
			} );
		}
		process.start();
	};

	ProcessHost.prototype.stopProcess = function( id ) {
		var self = this,
			process = id ? this.processes[ id ] : undefined;
		if( process && process.running ) {
			process.stop();
		}
	};

	ProcessHost.prototype.restart = function( id, config ) {
		var self = this,
			process = id ? this.processes[ id ] : undefined;
		if( id === undefined ) {
			_.each( this.processes, function( process, pid ) {
				process.restart();
			} );
		} else {
			if( !process ) {
				process = new Process( id, config );
				process.start();
				this.processes[ id ] = process;
			} else {
				process.restart();
			}
		}
	};

	Monologue.mixin( ProcessHost );
	return new ProcessHost();
};