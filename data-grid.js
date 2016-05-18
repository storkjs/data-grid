loadBulk(999);

var ebsGrid = function ebsGrid(params) {
	var grid = params.element;
	var data = params.data || [];
	var rowHeight = params.rowHeight || 30;
	var columns = params.columns || [];
	var rnd = Date.now() % 1000;
	var dataBlocks = [];
	var lastScrollPhase = 0;
	var i, j, counter, key, tmp;

	// if user didnt define columns and their names then let's try and fetch names from the keys of the first data object
	if(columns.length === 0 && data.length > 0) {
		for(key in data[0]) {
			columns.push({ dataName: key, displayName: key });
		}
	}

	// add grid class
	grid.classList.add('ebs-grid');

	// add css rules
	var style = document.createElement('style');
	style.type = 'text/css';
	style.innerHTML = '.ebs-grid table th, .ebs-grid table td { height: '+rowHeight+'px; }';
	document.getElementsByTagName('head')[0].appendChild(style);

	/** handle HEADER row */
	var table = document.createElement('table');
	table.setAttribute('id', 'ebsgrid_'+rnd+'_header');
	table.classList.add('header');
	var tbody = document.createElement('thead');
	var tr = document.createElement('tr');

	for(i=0; i < columns.length; i++) {
		tmp = document.createElement('th');
		tmp.appendChild(document.createTextNode(columns[i].displayName));
		tr.appendChild(tmp);
	}

	tbody.appendChild(tr);
	table.appendChild(tbody);
	grid.appendChild(table);
	/** /handle HEADER row */

	/** handle data rows blocks */
	var divWrapper = document.createElement('div');
	divWrapper.classList.add('data-wrapper');
	divWrapper.style.height = 'calc(100% - '+rowHeight+'px)';

	var div = document.createElement('div');
	div.classList.add('data');
	div.style.height = (rowHeight * data.length) + 'px';

	grid.appendChild(divWrapper);
	var viewableHeight = divWrapper.clientHeight;
	var numDataRowsInView = Math.ceil(viewableHeight / rowHeight);

	for(counter=0; counter < 2; counter++) { // counter for number of blocks
		table = document.createElement('table');
		table.setAttribute('id', 'ebsgrid_'+rnd+'_block_'+counter);
		dataBlocks[counter] = table;
		tbody = document.createElement('tbody');

		for(i=0; i < numDataRowsInView; i++) {
			tr = document.createElement('tr');
			for(j=0; j < columns.length; j++) {
				tmp = document.createElement('td');
				tmp.appendChild(document.createTextNode(data[ i+counter*numDataRowsInView ][ columns[j].dataName ]));
				tr.appendChild(tmp);
			}
			tbody.appendChild(tr);
		}

		table.style.top = (viewableHeight * counter) + 'px';
		table.appendChild(tbody);
		div.appendChild(table);
	}
	divWrapper.appendChild(div);
	/** /handle data rows blocks */

	divWrapper.addEventListener('scroll', function(e) {
		var scrollPhase = Math.floor(divWrapper.scrollTop / viewableHeight);
		if(lastScrollPhase !== scrollPhase) { // triggers a re-arrangement of data
			lastScrollPhase = scrollPhase;
			var phaseOrder = scrollPhase % 3;
			var sortedDataBlocks = [];

			// sort dataBlocks by show-up order
			if(phaseOrder === 0) { sortedDataBlocks[0] = dataBlocks[0]; sortedDataBlocks[1] = dataBlocks[1]; sortedDataBlocks[2] = dataBlocks[2]; }
			else if(phaseOrder === 1) { sortedDataBlocks[0] = dataBlocks[1]; sortedDataBlocks[1] = dataBlocks[2]; sortedDataBlocks[2] = dataBlocks[0]; }
			else if(phaseOrder === 2) { sortedDataBlocks[0] = dataBlocks[2]; sortedDataBlocks[1] = dataBlocks[0]; sortedDataBlocks[2] = dataBlocks[1]; }

			sortedDataBlocks[0].style.top = (viewableHeight * scrollPhase) + 'px';
			sortedDataBlocks[1].style.top = (viewableHeight * (scrollPhase+1)) + 'px';
			sortedDataBlocks[2].style.top = (viewableHeight * (scrollPhase+2)) + 'px';
		}
	});
};

document.addEventListener("DOMContentLoaded", function(e) {
	ebsGrid({
		element: document.getElementById('grid'),
		data: window.bigData,
		rowHeight: 32,
		columns: [
			// { dataName: 'eretz', displayName: 'Eretz' },
			// { dataName: 'eer', displayName: 'Eer' },
			// { dataName: 'hai', displayName: 'Hai' },
			// { dataName: 'tzomeah', displayName: 'Tzomeah' },
			// { dataName: 'domem', displayName: 'Domem' }
		]
	});
});