(function(root) {
	"use strict";
	/**
	 * construct for the StorkJS Data Grid.
	 * this initializes all of the variable and then starts the DOM build up process
	 * @param options
	 */
	var storkGrid = function storkGrid(options) {
		this.grid = options.element;
		this.data = options.data || [];
		this.rowHeight = options.rowHeight || 32;
		this.headerHeight = options.headerHeight || this.rowHeight;
		this.multiSelect = options.multiSelect || false;
		this.columns = options.columns || [];

		this.rnd = (Math.floor(Math.random() * 9) + 1) * 1000 + Date.now() % 1000; // random identifier for this grid
		this.tableExtraSize = 0.4; // how much is each data table bigger than the view port
		this.tableExtraPixelsForThreshold = 0;
		this.dataTables = []; // will hold both data-tables elements and child elements and some properties
		this.dataWrapperElm = null;
		this.dataElm = null;
		this.selectedItems = {
			rows: new Set(),
			tds: new Set()
		};

		this.scrollY = 0; // will be defined upon building the dataWrapper div!
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
			var columnName;
			for(var key in this.data[0]) {
				columnName = key.replace(/[-_]/, ' ');
				// capitalize first letter of each word
				columnName = columnName.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
				this.columns.push({ dataName: key, displayName: columnName });
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
		this.dataWrapperElm.addEventListener('scroll', this.onDataScroll.bind(this));
	};

	/**
	 * makes or updates the css rule for the heights of the header rows and data rows
	 */
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

	/**
	 * builds the header table for the column names
	 */
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

	/**
	 * inits the whole data view, with wrappers for scrolling and tables for data
	 */
	storkGrid.prototype.initDataView = function initDataView() {
		this.dataWrapperElm = document.createElement('div');
		this.dataWrapperElm.classList.add('data-wrapper');
		this.dataWrapperElm.style.height = 'calc(100% - ' + this.headerHeight + 'px)';

		this.dataElm = document.createElement('div');
		this.dataElm.classList.add('data');
		this.totalDataHeight = this.rowHeight * this.data.length;
		this.dataElm.style.height = this.totalDataHeight + 'px';

		this.dataWrapperElm.appendChild(this.dataElm);
		this.grid.appendChild(this.dataWrapperElm);

		this.dataWrapperElm.addEventListener('click', this.onDataClick.bind(this));

		var self = this;
		Object.defineProperty(self, 'scrollY', {
			configurable: false,
			enumerable: true,
			get: function() {
				return self.dataWrapperElm.scrollTop || 0;
			},
			set: function(newValue) {
				self.dataWrapperElm.scrollTop = newValue;
			}
		});

		this.resizeCalculate();

		this.buildDataTables();
	};

	/**
	 * calculates the size of child elements upon resize
	 */
	storkGrid.prototype.resizeCalculate = function resizeCalculate() {
		this.dataViewHeight = this.dataWrapperElm.clientHeight; // the height of a viewport the client can see
		this.numDataRowsInTable = Math.ceil(this.dataViewHeight * (1 + this.tableExtraSize) / this.rowHeight);
		if(this.numDataRowsInTable % 2 === 1) {
			this.numDataRowsInTable++;
		}
		this.dataTableHeight = this.numDataRowsInTable * this.rowHeight;

		this.tableExtraPixelsForThreshold = Math.floor(this.dataTableHeight * (this.tableExtraSize / 2));
		this.lastThreshold = this.tableExtraPixelsForThreshold;
		this.nextThreshold = this.lastThreshold + this.dataTableHeight;
	};

	/**
	 * builds two completely new <table> for the data
	 */
	storkGrid.prototype.buildDataTables = function buildDataTables() {
		var table, tbody, tr, td, i, j;

		for(var counter=0; counter < 2; counter++) { // counter for number of blocks
			table = document.getElementById('grid' + this.rnd + '_dataTable' + counter);
			if(!table) {
				table = document.createElement('table');
				table.id = 'grid' + this.rnd + '_dataTable' + counter;
				table.classList.add('body');
				this.dataElm.appendChild(table);
			}

			while(table.firstChild) {
				table.removeChild(table.firstChild);
			}

			this.dataTables[counter] = {
				table: table,
				dataBlockIndex: null,
				rows: []
			};

			tbody = document.createElement('tbody');

			for(i=0; i < this.numDataRowsInTable; i++) {
				tr = document.createElement('tr');
				this.dataTables[counter].rows[i] = {
					row: tr,
					tds: []
				};

				for(j=0; j < this.columns.length; j++) {
					td = document.createElement('td');
					td.setAttribute('data-column', this.columns[j].dataName);
					this.dataTables[counter].rows[i].tds.push(td);
					tr.appendChild(td);
				}
				tbody.appendChild(tr);
			}

			table.style.top = (this.dataTableHeight * counter) + 'px';
			table.appendChild(tbody);
		}
	};

	/**
	 * repositions the two data tables and then updates the data in them
	 * @param [currScrollDirection]
	 * @param [currScrollTop]
	 */
	storkGrid.prototype.repositionTables = function repositionTables(currScrollDirection, currScrollTop, forceUpdateViewData) {
		var topTableIndex, topTable, bottomTableIndex, bottomTable;
		currScrollTop = currScrollTop || this.scrollY;
		currScrollDirection = currScrollDirection || 'down';
		forceUpdateViewData = forceUpdateViewData || false;
		var currDataBlock = Math.floor(currScrollTop / this.dataTableHeight); // top data-block that is still in the viewable area

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
		if(this.dataTables[topTableIndex].dataBlockIndex !== currDataBlock || forceUpdateViewData) {
			this.updateViewData(topTableIndex, currDataBlock);
		}
		if(this.dataTables[bottomTableIndex].dataBlockIndex !== currDataBlock + 1 || forceUpdateViewData) {
			this.updateViewData(bottomTableIndex, currDataBlock + 1);
		}
	};

	storkGrid.prototype.onDataScroll = function onDataScroll(e) {
		var currScrollTop = this.dataWrapperElm.scrollTop;
		var currScrollDirection = currScrollTop > this.lastScrollTop ? 'down' : 'up';

		if(this.lastScrollDirection !== currScrollDirection
			|| (this.lastScrollDirection === 'down' && currScrollTop >= this.nextThreshold)
			|| (this.lastScrollDirection === 'up' && currScrollTop <= this.nextThreshold)) {
			this.repositionTables(currScrollDirection, currScrollTop);
		}

		this.lastScrollTop = currScrollTop;
		this.lastScrollDirection = currScrollDirection;
	};

	storkGrid.prototype.onDataClick = function onDataClick(e) {
		var target = e.target,
			i = 0,
			setItr;

		while(target.tagName.toUpperCase() !== 'TD') {
			if(i++ >= 2) {
				return; // user clicked on something that is too far from our table-cell
			}
			target = target.parentNode;
		}

		if(!this.multiSelect) {
			setItr = this.selectedItems.tds.values(); // for TDs
			for(i of setItr) {
				i.classList.remove('selected');
			}

			setItr = this.selectedItems.rows.values(); // for TRs
			for(i of setItr) {
				i.classList.remove('selected');
			}

			this.selectedItems.tds.clear();
			this.selectedItems.rows.clear();
		}

		this.selectedItems.tds.add(target);
		this.selectedItems.rows.add(target.parentNode);

		this.repositionTables(null, null, true);
	};

	storkGrid.prototype.updateViewData = function updateViewData(tableIndex, dataBlockIndex) {
		var tableObj, firstBlockRow, lastBlockRow, row, rowObj, dataKeyName, dataIndex, i;

		tableObj = this.dataTables[tableIndex];

		firstBlockRow = dataBlockIndex * this.numDataRowsInTable;
		lastBlockRow = (dataBlockIndex + 1) * this.numDataRowsInTable - 1;
		row = 0;

		for(dataIndex = firstBlockRow; dataIndex <= lastBlockRow; dataIndex++, row++) {
			rowObj = tableObj.rows[row];
			rowObj.row.setAttribute('data-index', dataIndex);

			// select the TR if needed
			if(this.selectedItems.rows.has(rowObj.row)) {
				rowObj.row.classList.add('selected');
			}

			for(i=0; i < this.columns.length; i++) {
				dataKeyName = this.columns[i].dataName;

				if(this.data[ dataIndex ]) {
					// select the TD if needed
					if(this.selectedItems.tds.has(rowObj.tds[i])) {
						rowObj.tds[i].classList.add('selected');
					}

					if(rowObj.tds[i].firstChild) {
						rowObj.tds[i].firstChild.nodeValue = this.data[ dataIndex ][ dataKeyName ];
					} else {
						rowObj.tds[i].appendChild(document.createTextNode(this.data[ dataIndex ][ dataKeyName ]));
					}
				}
				else {
					if(rowObj.tds[i].firstChild) {
						rowObj.tds[i].firstChild.nodeValue = '';
					}
				}
			}
		}

		tableObj.dataBlockIndex = dataBlockIndex;
	};

	storkGrid.prototype.resize = function resize() {
		this.resizeCalculate();
		this.buildDataTables();
		this.repositionTables(null, null, true);
	};

	root.storkGrid = storkGrid;
})(this); // main scope we run at (should be 'window')