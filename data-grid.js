(function(root) {
	"use strict";
	var storkGrid = function storkGrid(options) {
		this.grid = options.element;
		this.data = options.data || [];
		this.rowHeight = options.rowHeight || 32;
		this.headerHeight = options.headerHeight || this.rowHeight;
		this.columns = options.columns || [];

		this.rnd = (Math.floor(Math.random() * 9) + 1) * 1000 + Date.now() % 1000; // random identifier for this grid
		this.tableExtraSize = 0.5; // how much is each data table bigger than the view port
		this.tableExtraPixelsForThreshold = 0;
		this.dataTables = []; // will hold both data-tables and child elements
		this.dataWrapper = null;

		this.lastScrollTop = 0;
		this.lastScrollDirection = 'static';

		this.lastThreshold = 0;
		this.nextThreshold = 0;

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
		this.updateViewData(0, 0);
		this.updateViewData(1, 1);

		/** on scroll */
		this.dataWrapper.addEventListener('scroll', this.onscroll.bind(this));
	};

	storkGrid.prototype.makeHeightRule = function makeHeightRule() {
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
		this.dataWrapper = document.createElement('div');
		this.dataWrapper.classList.add('data-wrapper');
		this.dataWrapper.style.height = 'calc(100% - ' + this.headerHeight + 'px)';

		var div = document.createElement('div');
		div.classList.add('data');
		this.totalDataHeight = this.rowHeight * this.data.length;
		div.style.height = this.totalDataHeight + 'px';

		this.grid.appendChild(this.dataWrapper);
		this.dataViewHeight = this.dataWrapper.clientHeight; // the height of a viewport the client can see
		this.numDataRowsInTable = Math.ceil(this.dataViewHeight * (1 + this.tableExtraSize) / this.rowHeight);
		if(this.numDataRowsInTable % 2 === 1) {
			this.numDataRowsInTable++;
		}
		this.dataTableHeight = this.numDataRowsInTable * this.rowHeight;

		this.tableExtraPixelsForThreshold = Math.floor(this.dataTableHeight * (this.tableExtraSize / 2));
		this.lastThreshold = this.tableExtraPixelsForThreshold;
		this.nextThreshold = this.lastThreshold + this.dataTableHeight;

		var table, tbody, tr, td, i, j;

		for(var counter=0; counter < 2; counter++) { // counter for number of blocks
			table = document.createElement('table');
			table.id = 'grid' + this.rnd + '_dataTable' + counter;
			table.classList.add('body');
			this.dataTables[counter] = {
				table: table,
				dataBlockIndex: null,
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

	storkGrid.prototype.repositionTables = function repositionTables(currScrollTop, currScrollDirection, currDataBlock) {
		var topTableIndex, topTable,
			bottomTableIndex, bottomTable;

		topTableIndex = currDataBlock % 2;
		topTable = this.dataTables[topTableIndex].table;
		bottomTableIndex = (currDataBlock + 1) % 2;
		bottomTable = this.dataTables[bottomTableIndex].table;

		if(currScrollDirection === 'down') {
			topTable.style.top = (currDataBlock * this.dataTableHeight) + 'px';
			bottomTable.style.top = ((currDataBlock + 1) * this.dataTableHeight) + 'px';

			this.lastThreshold = currDataBlock * this.dataTableHeight + this.tableExtraPixelsForThreshold;
			if(currScrollTop >= this.lastThreshold) {
				this.nextThreshold = this.lastThreshold + this.dataTableHeight;
			}
			else {
				this.nextThreshold = this.lastThreshold;
				this.lastThreshold -= this.dataTableHeight;
			}
		}
		else if(currScrollDirection === 'up') {
			topTable.style.top = (currDataBlock * this.dataTableHeight) + 'px';
			bottomTable.style.top = ((currDataBlock + 1) * this.dataTableHeight) + 'px';

			this.lastThreshold = (currDataBlock + 1) * this.dataTableHeight + this.tableExtraPixelsForThreshold;
			if(currScrollTop <= this.lastThreshold) {
				this.nextThreshold = this.lastThreshold - this.dataTableHeight;
			}
			else {
				this.nextThreshold = this.lastThreshold;
				this.lastThreshold += this.dataTableHeight;
			}
		}

		// both, scrolling down and up, should maintain the same position for the two data-tables
		// thus updating the data on view (by data blocks) is always the same for both directions
		if(this.dataTables[topTableIndex].dataBlockIndex !== currDataBlock) {
			this.updateViewData(topTableIndex, currDataBlock);
		}
		if(this.dataTables[bottomTableIndex].dataBlockIndex !== currDataBlock + 1) {
			this.updateViewData(bottomTableIndex, currDataBlock + 1);
		}
	};

	storkGrid.prototype.onscroll = function onscroll(e) {
		var currScrollTop = this.dataWrapper.scrollTop;
		var currScrollDirection = currScrollTop > this.lastScrollTop ? 'down' : 'up';
		var currDataBlock = Math.floor(currScrollTop / this.dataTableHeight); // top data-block that is still in the viewable area

		if(this.lastScrollDirection !== currScrollDirection
			|| this.lastScrollDirection === 'down' && currScrollTop >= this.nextThreshold
			|| this.lastScrollDirection === 'up' && currScrollTop <= this.nextThreshold) {
			this.repositionTables(currScrollTop, currScrollDirection, currDataBlock);
		}

		this.lastScrollTop = currScrollTop;
		this.lastScrollDirection = currScrollDirection;
	};

	storkGrid.prototype.updateViewData = function updateViewData(tableIndex, dataBlockIndex) {
		var tableObj, firstBlockRow, lastBlockRow, row, rowElm, dataKeyName, dataIndex, i;

		tableObj = this.dataTables[tableIndex];

		firstBlockRow = dataBlockIndex * this.numDataRowsInTable;
		lastBlockRow = (dataBlockIndex + 1) * this.numDataRowsInTable - 1;
		row = 0;

		for(dataIndex = firstBlockRow; dataIndex <= lastBlockRow; dataIndex++) {
			rowElm = tableObj.rows[row];

			for(i=0; i < this.columns.length; i++) {
				dataKeyName = this.columns[i].dataName;

				if(rowElm[i].firstChild) {
					rowElm[i].firstChild.nodeValue = this.data[ dataIndex ][ dataKeyName ];
				} else {
					rowElm[i].appendChild(document.createTextNode(this.data[ dataIndex ][ dataKeyName ]));
				}
			}

			row++;
		}

		tableObj.dataBlockIndex = dataBlockIndex;
	};

	root.storkGrid = storkGrid;
})(this); // main scope we run at (should be 'window')