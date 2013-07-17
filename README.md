# processhost
Its almost too simple to be of use. I've extracted it from Anvil because I kept wanting something that worked like Anvil's processhost. So ... yeah.

## API

### Getting an instance

	var processHost = require( "processhost" )();

### startProcess

	processHost.startProcess( <processAlias>, <configuration> );

### stopProcess

	processHost.stopProcess( <processAlias> );

### configuration
Possible config values:

	{
		"cwd": "", // defaults to current working directory
		"command": "", // this will probably be "node"
		"args": [], // the command line args for the process, i.e. your script
		"killSignal": "" | [ "" ], // not required, defaults to "SIGTERM", it can be multiple
		"stdio": "inherit" | "ignore" // determines if the process will write to the console
		"env": {} // defaults to the process.env, should be simple hash
	}

## Events
You can subscribed to the following process level events off the process host.

### <processAlias>.started

### <processAlias>.stopped

### <processAlias>.exit