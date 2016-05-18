window.bigData = [];
window.columnNames = ['id', 'eretz','eer','hai','tzomeah','domem','yeled','yalda','amount','other amount'];

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
	tmp[ window.columnNames[0] ] = i;
	tmp[ window.columnNames[1] ] = countries[ i % countries.length ];
	tmp[ window.columnNames[2] ] = cities[ i % cities.length ];
	tmp[ window.columnNames[3] ] = animals[ i % animals.length ];
	tmp[ window.columnNames[4] ] = plants[ i % plants.length ];
	tmp[ window.columnNames[5] ] = inanimates[ i % inanimates.length ];
	tmp[ window.columnNames[6] ] = boy[ i % boy.length ];
	tmp[ window.columnNames[7] ] = girl[ i % girl.length ];
	tmp[ window.columnNames[8] ] = Math.ceil(Math.random() * 999999) / 100;
	tmp[ window.columnNames[9] ] = Math.ceil(Math.random() * 9999);
	allData.push(tmp);
}

var loadBulk = (function() {
	var amountFetched = 0;
	return function(amount, prepend) {
		amount = amount || 40;
		prepend = prepend || false;
		var bulkData = allData.slice(amountFetched, amountFetched + amount);
		amountFetched += amount;

		if(prepend) {
			window.bigData = bulkData.concat(window.bigData);
		} else {
			window.bigData = window.bigData.concat(bulkData);
		}
	};
})();