# processhost
Its almost too simple to be of use. I've extracted it from Anvil because I kept wanting something that worked like Anvil's processhost. So ... yeah.

## API

### Getting an instance
```javascript
	var processHost = require( "processhost" )();
```

### startProcess
```javascript
	processHost.startProcess( <processAlias>, <configuration> );
```

### stopProcess
```javascript
	processHost.stopProcess( <processAlias> );
```

### restart
Process alias is optional. If provided, only restarts process with matching alias. If not provided, restarts ALL processes with restart: true in their configuration.

```javascript
	processHost.restart(); // restart all

	processHost.restart( 'myApp' ); // restart only 'myApp'
``` 

### stop
Stops everything.

```javascript
	processHost.stop();
```

### configuration
Possible config values:

	{
		"cwd": "", // defaults to current working directory
		"command": "", // this will probably be "node"
		"args": [], // the command line args for the process, i.e. your script
		"killSignal": "" | [ "" ], // not required, defaults to "SIGTERM", it can be multiple
		"stdio": "inherit" | "ignore" // determines if the process will write to the console
		"env": {}, // defaults to the process.env, should be simple hash
		"tolerance": 1, // number of allowed restarts
		"toleranceWindow": 100 // duration (in ms) of tolerance window
	}

## Events
You can subscribed to the following process level events off the process host.

### <processAlias>.started

### <processAlias>.stopped

### <processAlias>.exit