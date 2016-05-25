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
		this.columns = options.columns || [];
		this.trackBy = options.trackBy || null;

		this.selection = {};
		options.selection = options.selection || {};
		this.selection.multi = options.selection.multi || false;
		this.selection.type = options.selection.type === 'cell' ? 'cell' : 'row';

		this.rnd = (Math.floor(Math.random() * 9) + 1) * 1000 + Date.now() % 1000; // random identifier for this grid
		this.tableExtraSize = 0.4; // how much is each data table bigger than the view port
		this.tableExtraPixelsForThreshold = 0;
		this.dataTables = []; // will hold both data-tables elements and child elements and some properties
		this.dataWrapperElm = null;
		this.dataElm = null;
		this.selectedItems = new Map();/*ES6*/
		this.customScrollEvents = [];

		this.scrollY = 0; // will be defined upon building the dataWrapper div!
		this.maxScrollY = 0;
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
	 * will add an event that will be emitted when passing the defined threshold while scrolling
	 * @param {string} type - the name for the event
	 * @param {number} amount
	 * @param {boolean} [fromBottom] - relative to the bottom of the grid or else to the top of it. defaults to True
	 */
	storkGrid.prototype.addScrollEvent = function addScrollEvent(type, amount, fromBottom) {
		fromBottom = fromBottom !== false;
		this.customScrollEvents.push({type: type, amount: amount, fromBottom: fromBottom});
	};

	/**
	 * a function for passing an addEventListener from the grid-instance to the grid-dom-element
	 * @param type
	 * @param listener
	 * @param [options_or_useCapture]
	 */
	storkGrid.prototype.addEventListener = function customAddEventListener(type, listener, options_or_useCapture) {
		this.grid.addEventListener(type, listener, options_or_useCapture);
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
	 * sets the height of each row
	 * @param num
	 */
	storkGrid.prototype.setRowHeight = function setRowHeight(num) {
		this.rowHeight = num;
		this.makeHeightRule();
	};

	/**
	 * sets the height of the header
	 * @param num
	 */
	storkGrid.prototype.setHeaderHeight = function setHeaderHeight(num) {
		this.headerHeight = num;
		this.makeHeightRule();
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

		this.calculateDataHeight();

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
	 * calculates and sets the needed height for the data
	 */
	storkGrid.prototype.calculateDataHeight = function calculateDataHeight() {
		this.totalDataHeight = this.rowHeight * this.data.length;
		this.dataElm.style.height = this.totalDataHeight + 'px';
		this.maxScrollY = this.dataWrapperElm.scrollHeight - this.dataViewHeight;
	};

	/**
	 * calculates the size of child elements upon resize
	 */
	storkGrid.prototype.resizeCalculate = function resizeCalculate() {
		this.dataViewHeight = this.dataWrapperElm.clientHeight; // the height of a viewport the client can see
		this.maxScrollY = this.dataWrapperElm.scrollHeight - this.dataViewHeight;

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
				tr.storkGridProps = { // our custom object on the DOM object
					dataIndex: null,
					selected: false
				};

				this.dataTables[counter].rows[i] = {
					row: tr,
					tds: []
				};

				for(j=0; j < this.columns.length; j++) {
					td = document.createElement('td');
					td.storkGridProps = { // our custom object on the DOM object
						column: this.columns[j].dataName,
						selected: false
					};

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
	 * @param [forceUpdateViewData] - forces updating dom elements even if scroll hasn't passed to the next data block
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
		var currScrollDirection = currScrollTop >= this.lastScrollTop ? 'down' : 'up';
		var scrollEvent, i, evnt;

		if(this.lastScrollDirection !== currScrollDirection
			|| (this.lastScrollDirection === 'down' && currScrollTop >= this.nextThreshold)
			|| (this.lastScrollDirection === 'up' && currScrollTop <= this.nextThreshold)) {
			this.repositionTables(currScrollDirection, currScrollTop);
		}

		// save these variables for next script
		var lastScrollTop = this.lastScrollTop;
		var lastScrollDirection = this.lastScrollDirection;

		// this 'onDataScroll' method ends here.
		// next script is for events and it may invoke a call to this method again so we "finish" our code here to prevent an infinite recursion
		this.lastScrollTop = currScrollTop;
		this.lastScrollDirection = currScrollDirection;

		// custom scroll events
		for(i=0; i < this.customScrollEvents.length; i++) {
			scrollEvent = this.customScrollEvents[i];

			/*script for dispatching event once when passing through the threshold*/
			// if((scrollEvent.fromBottom && lastScrollTop < this.maxScrollY - scrollEvent.amount && currScrollTop >= this.maxScrollY - scrollEvent.amount)
			// 	|| (!scrollEvent.fromBottom && lastScrollTop > scrollEvent.amount && currScrollTop <= scrollEvent.amount)) {
			// 	evnt = new Event(scrollEvent.type);
			// 	this.grid.dispatchEvent(evnt);
			// }
			if((scrollEvent.fromBottom && currScrollTop >= this.maxScrollY - scrollEvent.amount)
				|| (!scrollEvent.fromBottom && currScrollTop <= scrollEvent.amount)) {
				evnt = new Event(scrollEvent.type);
				this.grid.dispatchEvent(evnt);
			}
		}
	};

	storkGrid.prototype.onDataClick = function onDataClick(e) {
		var TD = e.target,
			i = 0,
			dataIndex, TR, selectedCellColumn, selectedItem, trackByData;

		while(TD.tagName.toUpperCase() !== 'TD') {
			if(i++ >= 2) {
				return; // user clicked on something that is too far from our table-cell
			}
			TD = TD.parentNode;
		}

		TR = TD.parentNode;

		dataIndex = parseInt(TR.storkGridProps.dataIndex, 10);
		selectedCellColumn = TD.storkGridProps.column;

		if(dataIndex >= 0 && dataIndex <= Number.MAX_SAFE_INTEGER/*ES6*/) {
			if (this.trackBy) { // tracking by a specific column data
				trackByData = this.data[dataIndex][this.trackBy];
			} else { // tracking by the whole row's data object
				trackByData = this.data[dataIndex];
			}

			// when not on multi select clear previous selection, unless re-selecting the same row
			// which we should let the next code unselect it
			if(!this.selection.multi && !this.selectedItems.has(trackByData)) {
				this.selectedItems.clear();
			}

			if(this.selectedItems.has(trackByData)) {
				if(this.selection.type === 'row') {
					this.selectedItems.delete(trackByData); // unselect row
				}
				else {
					selectedItem = this.selectedItems.get(trackByData);

					var indexOfColumn = selectedItem.indexOf(selectedCellColumn);
					if(indexOfColumn === -1) {
						selectedItem.push(selectedCellColumn);
					}
					else {
						selectedItem.splice(indexOfColumn, 1); // unselect cell

						if(selectedItem.length === 0) {
							this.selectedItems.delete(trackByData); // unselect row
						}
					}
				}
			}
			else {
				this.selectedItems.set(trackByData, [selectedCellColumn]);
			}

			var evnt = new CustomEvent('select', {detail:
				{
					/* this primitive values will help us get the selected row's data by using `this.data[dataIndex]`
					 * and getting the selected cell's data by using `this.data[dataIndex][column]`
					 */
					column: selectedCellColumn,
					dataIndex: dataIndex
				}
			});
			this.grid.dispatchEvent(evnt);
		}
		else {
			this.selectedItems.clear();
			console.warn('selected row is not pointing to a valid data');
		}

		this.repositionTables(null, null, true);
	};

	storkGrid.prototype.updateViewData = function updateViewData(tableIndex, dataBlockIndex) {
		var tableObj, firstBlockRow, lastBlockRow, row, rowObj,
			dataKeyName, dataIndex, i, selectedItem, trackByData;

		tableObj = this.dataTables[tableIndex];

		firstBlockRow = dataBlockIndex * this.numDataRowsInTable;
		lastBlockRow = (dataBlockIndex + 1) * this.numDataRowsInTable - 1;
		row = 0;

		for(dataIndex = firstBlockRow; dataIndex <= lastBlockRow; dataIndex++, row++) {
			rowObj = tableObj.rows[row];
			rowObj.row.storkGridProps.dataIndex = dataIndex;

			if(this.data[ dataIndex ]) {
				// select the TR if needed
				if (this.trackBy) { // tracking by a specific column data or by the whole row's data object
					trackByData = this.data[dataIndex][this.trackBy];
				} else {
					trackByData = this.data[dataIndex];
				}

				if (this.selectedItems.has(trackByData)) {
					selectedItem = this.selectedItems.get(trackByData);
					rowObj.row.classList.add('selected');
					rowObj.row.storkGridProps.selected = true;
				}
				else {
					selectedItem = null;

					if (rowObj.row.storkGridProps.selected) {
						rowObj.row.classList.remove('selected');
						rowObj.row.storkGridProps.selected = false;
					}
				}

				for (i = 0; i < this.columns.length; i++) {
					dataKeyName = this.columns[i].dataName;

					// select the TD if needed
					if (selectedItem && this.selection.type === 'cell' && selectedItem.indexOf(dataKeyName) > -1) { // if this row is selected, and if this column is selected too
						rowObj.tds[i].classList.add('selected');
						rowObj.tds[i].storkGridProps.selected = true;
					}
					else if (rowObj.tds[i].storkGridProps.selected) {
						rowObj.tds[i].classList.remove('selected');
						rowObj.tds[i].storkGridProps.selected = false;
					}

					if (rowObj.tds[i].firstChild) {
						rowObj.tds[i].firstChild.nodeValue = this.data[dataIndex][dataKeyName];
					} else {
						rowObj.tds[i].appendChild(document.createTextNode(this.data[dataIndex][dataKeyName]));
					}
				}
			}
			else {
				for (i = 0; i < this.columns.length; i++) {
					if (rowObj.tds[i].firstChild) {
						rowObj.tds[i].firstChild.nodeValue = '';
					}
				}
			}

			selectedItem = null;
		}

		tableObj.dataBlockIndex = dataBlockIndex;
	};

	/**
	 * a method for completely calculating and rebuilding new tables when the grid's main element has changed size
	 */
	storkGrid.prototype.resize = function resize() {
		this.resizeCalculate();
		this.buildDataTables();
		this.repositionTables(null, null, true);
	};

	/**
	 * refreshes the data height and viewport.
	 * use this when grid.data has changed
	 */
	storkGrid.prototype.refreshData = function refreshData() {
		this.calculateDataHeight();
		this.repositionTables(null, null, true);
	};

	root.storkGrid = storkGrid;
})(this); // main scope we run at (should be 'window')