function go() {
	setTimeout( function() {
		console.log( "It's been 1 second." );
		go();
	}, 1000 );
}

go();
