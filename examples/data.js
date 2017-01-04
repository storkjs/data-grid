window.bigData = [];
window.columnNames = ['id', 'country','city','animal','plant','inanimate','isok','kidName','random_float','random_integer'];

var i,
	countries = ['this country takes like three lines','Israel','USA','Germany','France','Pitcairn'],
	cities = ['Tel Aviv','Jerusalem','New York','London'],
	animals = ['Monkey','Ape','Dog','Cat','Mouse','Rat','Pangolin'],
	plants = ['Rose','Daisy','Tulip'],
	inanimates = ['stone','pen','table','sand','roof','metal','can','thread','board','dust'],
	isok = [true, false],
	kidName = ['Noam','Michael','Naama','Mikaela','Judy'],
	allData = [],
	tmp;
for(i=0; i < 10000; i++) {
	tmp = {};
	tmp[ window.columnNames[0] ] = (i+1);
	tmp[ window.columnNames[1] ] = countries[ i % countries.length ];
	tmp[ window.columnNames[2] ] = cities[ i % cities.length ];
	tmp[ window.columnNames[3] ] = animals[ i % animals.length ];
	tmp[ window.columnNames[4] ] = plants[ i % plants.length ];
	tmp[ window.columnNames[5] ] = inanimates[ i % inanimates.length ];
	tmp[ window.columnNames[6] ] = isok[ i % isok.length ];
	tmp[ window.columnNames[7] ] = kidName[ i % kidName.length ];
	tmp[ window.columnNames[8] ] = Math.ceil(Math.random() * 999999) / 100;
	tmp[ window.columnNames[9] ] = Math.ceil(Math.random() * 99);
	allData.push(tmp);
}

var loadBulk = (function() {
	var amountFetched = 0;
	return function(amount, prepend) {
		amount = amount || 40;
		prepend = prepend || false;
		var bulkData = allData.slice(amountFetched, amountFetched + amount);
		amountFetched += amount;

		var i, spliceCounter=0;
		for(i=0; i < bulkData.length; i++) {
			if (prepend) {
				window.bigData.splice(spliceCounter++, 0, bulkData[i]);
			} else {
				window.bigData.push(bulkData[i]);
			}
		}
	};
})();