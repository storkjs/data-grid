var storkGrid = function storkGrid(options) {
	"use strict";
	this.grid = options.element;
	this.data = options.data || [];
	this.rowHeight = options.rowHeight || 32;
	this.headerHeight = options.headerHeight || this.rowHeight;
	this.columns = options.columns || [];

	this.rnd = (Math.floor(Math.random() * 9) + 1) * 1000 + Date.now() % 1000; // random identifier for this grid
	this.tableExtraSize = 1.5; // how much is each data table bigger than the view port
	this.dataTables = []; // will hold both data-tables and child elements
	this.dataWrapper = null;
	this.scrollTop = 0;
	this.totalDataHeight = 0;
	this.dataViewHeight = 0;
	this.dataTableHeight = 0;
	this.numDataRowsInTable = 0;

	// if user didn't define columns and column names then let's try and fetch names from the keys of the first data object
	if(this.columns.length === 0 && this.data.length > 0) {
		for(var key in this.data[0]) {
			this.columns.push({ dataName: key, displayName: key });
		}
	}

	/** add grid class */
	this.grid.classList.add('stork-grid', 'stork-grid'+this.rnd);

	/** add css rules */
	this.makeHeightRule();

	/** init HEADER table */
	this.makeHeaderTable();

	/** handle data rows blocks */
	this.initDataView();

	/** insert data into the data-tables */
	this.updateData(0);

	/** on scroll */
	this.dataWrapper.addEventListener('scroll', this.onscroll.bind(this));
};

storkGrid.prototype.makeHeightRule = function makeHeightRule() {
	"use strict";
	var style = document.getElementById('grid'+this.rnd+'_style');
	if(!style) {
		style = document.createElement('style');
		style.id = 'grid'+this.rnd+'_style';
		style.type = 'text/css';
		document.getElementsByTagName('head')[0].appendChild(style);
	}

	style.innerHTML = '.stork-grid'+this.rnd+' table.header tr { height: ' + this.headerHeight + 'px; }' +
										'.stork-grid'+this.rnd+' table.body tr { height: ' + this.rowHeight + 'px; }';
};

storkGrid.prototype.makeHeaderTable = function makeHeaderTable() {
	"use strict";
	var table = document.getElementById('grid'+this.rnd+'_header');
	if(!table) {
		table = document.createElement('table');
		table.id = 'grid'+this.rnd+'_header';
		table.classList.add('header');
		this.grid.appendChild(table);
	}

	while(table.firstChild) {
		table.removeChild(table.firstChild);
	}

	var thead = document.createElement('thead');
	var tr = document.createElement('tr');
	var th;

	for(var i=0; i < this.columns.length; i++) {
		th = document.createElement('th');
		th.appendChild(document.createTextNode(this.columns[i].displayName));
		tr.appendChild(th);
	}

	// extra th for offseting the scrollbar area
	th = document.createElement('th');
	th.classList.add('scrollbar-offset');
	tr.appendChild(th);

	thead.appendChild(tr);
	table.appendChild(thead);
};

storkGrid.prototype.initDataView = function initDataView() {
	"use strict";
	this.dataWrapper = document.createElement('div');
	this.dataWrapper.classList.add('data-wrapper');
	this.dataWrapper.style.height = 'calc(100% - ' + this.headerHeight + 'px)';

	var div = document.createElement('div');
	div.classList.add('data');
	this.totalDataHeight = this.rowHeight * this.data.length;
	div.style.height = this.totalDataHeight + 'px';

	this.grid.appendChild(this.dataWrapper);
	this.dataViewHeight = this.dataWrapper.clientHeight; // the height of a viewport the client can see
	this.numDataRowsInTable = Math.ceil(this.dataViewHeight * this.tableExtraSize / this.rowHeight);
	this.dataTableHeight = this.numDataRowsInTable * this.rowHeight;

	var table, tbody, tr, td, i, j, dataIndex, dataKeyName;

	for(var counter=0; counter < 2; counter++) { // counter for number of blocks
		table = document.createElement('table');
		table.id = 'grid' + this.rnd + '_dataTable' + counter;
		table.classList.add('body');
		this.dataTables[counter] = {
			table: table,
			rows: []
		};
		tbody = document.createElement('tbody');

		for(i=0; i < this.numDataRowsInTable; i++) {
			tr = document.createElement('tr');
			this.dataTables[counter].rows[i] = [];

			for(j=0; j < this.columns.length; j++) {
				td = document.createElement('td');
				this.dataTables[counter].rows[i].push(td);
				tr.appendChild(td);
			}
			tbody.appendChild(tr);
		}

		table.style.top = (this.dataTableHeight * counter) + 'px';
		table.appendChild(tbody);
		div.appendChild(table);
	}
	this.dataWrapper.appendChild(div);
};

storkGrid.prototype.onscroll = function onscroll(e) {
	"use strict";
	var currScrollTop = this.dataWrapper.scrollTop;
	var currScrollDirection = currScrollTop > this.scrollTop ? 'down' : 'up';
	var tableInView = this.dataTables[(Math.floor(currScrollTop / this.dataTableHeight) % 2)].table; // whether the table in view is odd or even
	var tableOutOfView = this.dataTables[((Math.floor(currScrollTop / this.dataTableHeight) + 1) % 2)].table; // whether the table out of view is even or odd

	var tableInViewTop = currScrollTop - Math.floor(currScrollTop % this.dataTableHeight); // current table's top (don't count on elements top since it might not have been rendered yet while scrolling)
	// simply always re-update the 'top' since its much simpler (thus more efficient and faster) than calculating
	// whether we passed a certain threshold based off the scrolling direction
	tableInView.style.top = tableInViewTop + 'px';
	tableOutOfView.style.top = (tableInViewTop + this.dataTableHeight) + 'px';

	this.scrollTop = currScrollTop;
	this.scrollDirection = currScrollDirection;
};

storkGrid.prototype.updateData = function updateData(dataBlockIndex) {
	var tableObj, firstBlockRow, lastBlockRow, row, rowElm, dataKeyName,
		dataIndex, i;

	for(var counter=0; counter < 2; counter++) {
		dataBlockIndex += counter;
		tableObj = this.dataTables[counter];

		if(tableObj.table.getAttribute('data-block-index') !== dataBlockIndex) {
			firstBlockRow = dataBlockIndex * this.numDataRowsInTable;
			lastBlockRow = (dataBlockIndex + 1) * this.numDataRowsInTable - 1;
			row = 0;

			for(dataIndex = firstBlockRow; dataIndex <= lastBlockRow; dataIndex++) {
				rowElm = tableObj.rows[row];

				for(i=0; i < this.columns.length; i++) {
					while(rowElm[i].firstChild) {
						rowElm[i].removeChild(rowElm[i].firstChild);
					}

					dataKeyName = this.columns[i].dataName;
					rowElm[i].appendChild(document.createTextNode(this.data[ dataIndex ][ dataKeyName ]));
				}

				row++;
			}

			tableObj.table.setAttribute('data-block-index', dataBlockIndex);
		}
	}
};