loadBulk(1000);

var testGrid, almostHitTop;

var sortColumn = function sortColumn(column, state) {
	return function(a, b) {
		if(state === null && a.id) {
			column = 'id';
			state = 'ascending';
		}
		if (a[column] < b[column]) {
			return (state === 'ascending' ? 1 : -1);
		}
		if (a[column] > b[column]) {
			return (state === 'ascending' ? -1 : 1);
		}
		return 0;
	};
};

document.addEventListener("DOMContentLoaded", function(e) {
	document.getElementById('grid').addEventListener('grid-loaded', function(e) {
		e.detail.gridObj.scrollY += 500;
	}, { capture: false });
	
	testGrid = new StorkGrid({
		debug: true,
		element: document.getElementById('grid'),
		data: window.bigData,
		rowHeight: 30,
		headerHeight: 50,
		selection: {
			multi: true,
			type: 'row'
		},
		columns: window.columns,
		minColumnWidth: 40,
		resizableColumns: true,
		trackBy: 'id',
		onload: function(e) { // another way to add onLoad listener
			e.detail.gridObj.scrollY += 2000;
		},
		asyncLoading: true
	});
	
	testGrid.addEventListener('data-click', function(e) {
		console.log('cell/row click: ', e.detail);
	}, false);
	testGrid.addEventListener('select', function(e) {
		console.log('select: ', e.detail);
	}, false);
	testGrid.addEventListener('dblselect', function(e) {
		console.log('double select: ', e.detail);
	}, false);
	testGrid.addEventListener('enter-select', function(e) {
		console.log('enter select: ', e.detail);
	}, false);
	
	testGrid.addScrollEvent('almostHitBottom', 100); // when to emit
	testGrid.addEventListener('almostHitBottom', function(e) {
		var dataLength = testGrid.data.length;
		loadBulk(4000);
		if(testGrid.data.length > dataLength) {
			testGrid.refresh();
		}
	}, false);
	
	var forceRefresh = false;
	var loadedDataTO;
	testGrid.addScrollEvent('almostHitTop', 100, false); // when to emit
	almostHitTop = function(e) {
		var dataLength = testGrid.data.length;
		loadBulk(900, true);
		if(testGrid.data.length > dataLength) {
			testGrid.scrollY += 1200;
			forceRefresh = true;
			clearTimeout(loadedDataTO);
			loadedDataTO = setTimeout(function() { forceRefresh = false; }, 500);
		}
		
		// will keep refreshing the view on each scroll up, for 500ms since last successful 'loadBulk'.
		// this solves a bug when user drags the scrollbar up and the browser keeps emitting 'scrollTop=0'
		if(forceRefresh) {
			testGrid.refresh();
		}
	};
	testGrid.addEventListener('almostHitTop', almostHitTop, false);
	
	var sortState = {
		prevColumn: '',
		prevState: null,
		column: '',
		state: null
	};
	testGrid.addEventListener('column-click', function(e) {
		sortState.prevColumn = sortState.column;
		sortState.prevState = sortState.state;
		
		sortState.column = e.detail.column;
		
		if(sortState.column !== sortState.prevColumn) {
			sortState.state = 'ascending';
		}
		else {
			switch(sortState.state) {
				case null:
					sortState.state = 'ascending';
					break;
				case 'ascending':
					sortState.state = 'descending';
					break;
				default:
					sortState.state = null
			}
		}
		
		if(sortState.prevState !== null) { testGrid.removeColumnClass(sortState.prevColumn, sortState.prevState, true); }
		if(sortState.state !== null) { testGrid.addColumnClass(sortState.column, sortState.state, true); }
		
		testGrid.data.sort(sortColumn(sortState.column, sortState.state));
		testGrid.refresh();
	}, false);
	
	testGrid.addEventListener('resize-column', function(e) {
		console.log(e.detail);
	}, false);
	
	window.addEventListener('resize', function() {
		testGrid.resize();
	});
});

var destroyGrid = function destroyGrid() {
	if(testGrid) {
		testGrid.destroy();
	}
};
var rearrange = function rearrange() {
	if(testGrid && testGrid.grid) {
		testGrid.setColumns([
			{field: 'country', label: 'Country', width: 110, minWidth: 70, fixed: true},
			{field: 'random_integer', label: 'Integer', width: 110, fixed: true},
			{field: 'random_float', label: 'Float', width: 110},
			{field: 'city', label: 'City', width: 115, minWidth: 75},
			{field: 'id', label: 'ID'}
		]);
	}
};
var removeInfiniteTopScroll = function removeInfiniteTopScroll() {
	testGrid.removeEventListener('almostHitTop', almostHitTop, false);
};
var biggerHeader = function biggerHeader() {
	testGrid.setHeaderHeight(70);
};
var biggerRows = function biggerRows() {
	testGrid.setRowHeight(40);
};