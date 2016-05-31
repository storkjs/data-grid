window.bigData = [];
window.columnNames = ['id', 'eretz','eer','hai','tzomeah','domem','yeled','yalda','reg-amount','other_amount'];

var i,
	countries = ['israel','usa','germany','france','pitcairn'],
	cities = ['tel aviv','jerusalem','new york','london'],
	animals = ['monkey','ape','dog','cat','mouse','rat','pangolin'],
	plants = ['rose','daisy','tulip'],
	inanimates = ['stone','pen','table','sand','roof','metal','can','thread','pin','dust'],
	boy = ['noam','michael'],
	girl = ['naama','michaela','shivan'],
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
	tmp[ window.columnNames[6] ] = boy[ i % boy.length ];
	tmp[ window.columnNames[7] ] = girl[ i % girl.length ];
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