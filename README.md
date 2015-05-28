# processhost
Super simple, cross-platform process hosting for Node, adapted from [Anvil]'s(https://github.com/anviljs/anvil.js) processhost.

The most useful features are:

 * Reliably kills child processes on process exit
 * Reliably restarts child processes
 * Apply a tolerance to restart behavior

## API

```javascript
var processes = require( "processhost" )();
```

### configuration
Configuration hash has the following options. Only command and args are required.

```javascript
{
	command: "", // this will probably be "node"
	args: [], // the command line args for the process, i.e. your script
	[cwd]: "", // defaults to current working directory
	[killSignal]: "" | [ "" ], // not required, defaults to "SIGTERM", can provide an array
	[stdio]: "inherit" | "ignore" | "pipe" // determines if the process will write to the console
	[env]: {}, // defaults to the process.env, should be simple hash
	[restart]: true, // control whether or not the process restarts after a start or restart call
	[restartLimit]: 1, // number of allowed restarts
	[restartWindow]: 100 // duration (in ms) of tolerance window
}
```

> Notes

> 1. `restartWindow` defaults to undefined - this results in limitless restarts

> 2. `stdio` defaults to "inherit" causing child processes to share the parents stdio/stderr

### create( processAlias, configuration )
Creates a new process without starting it.
```javascript
processes.create( "myProcess", { command: "node", args: [ "./index.js" ], cwd: "./src" } );
```

### restart( [processAlias] )
If a `processAlias` is provided, only starts|restarts the matching process. Otherwise, this will start|restart ALL processes that have been defined.

```javascript
processes.restart(); // restart all

processes.restart( 'myApp' ); // restart only 'myApp'
```

### setup( processesHash )
Used to define and potentially start multiple processes in a single call.

```javascript
processes.setup( {
	"one": { ... },
	"two": { ... },
	"three": { ... }
} );
```

> Note

> To have the processes started automatically, add a `start`: true to the config block.

### start( processAlias, [configuration] )
If no configuration is provided, this will start|restart the matching process. If a configuration is provided, this will create and start a new process.

```javascript
processes.start( "myProcess", { command: "node", args: [ "./index.js" ], cwd: "./src" } );
```

### stop( [processAlias] )
If no `processAlias` is provided, stops all running processes, otherwise it stops the specified process if it exists and is running.

```javascript
processes.stop();
```

## Events
You can subscribe to the following process level events off the process host.

 * [processAlias].crashed - the process has exited unexpectedly
 * [processAlias].failed - the process has exceeded the set tolerance
 * [processAlias].restarting - the process is restarting
 * [processAlias].started - the process has started
 * [processAlias].stderr
 * [processAlias].stdout
 * [processAlias].stopped - the process has exited after `stop` was called

> Note

> The `stderr` and `stdout` events will not fire unless you set `stdio` to "pipe" in the config hash.
