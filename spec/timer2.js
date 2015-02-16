function go() {
	setTimeout( function() {
		console.log( "It's been 100 ms." );
		go();
	}, 100 );
}

go();
