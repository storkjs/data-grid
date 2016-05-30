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
		this.minColumnWidth = options.minColumnWidth || 50;
		this.trackBy = options.trackBy || null;
		this.onload = options.onload || null;

		this.selection = {};
		options.selection = options.selection || {};
		this.selection.multi = options.selection.multi || false;
		this.selection.type = options.selection.type === 'cell' ? 'cell' : 'row';

		this.rnd = (Math.floor(Math.random() * 9) + 1) * 1000 + Date.now() % 1000; // random identifier for this grid
		this.tableExtraSize = 0.4; // how much is each data table bigger than the view port
		this.tableExtraPixelsForThreshold = 0;
		this.headerTable = {
			wrapper: null,
			loose: null,
			fixed: null,
			ths: []
		};
		this.dataTables = []; // will hold top and bottom data-tables (as objects) and within it its elements and children and some properties
		this.dataWrapperElm = null;
		this.dataElm = null;
		this.selectedItems = new Map();/*ES6*/
		this.customScrollEvents = [];

		this.scrollY = 0; // will be defined upon building the dataWrapper div!
		this.maxScrollY = 0;
		this.lastScrollTop = 0;
		this.lastScrollDirection = 'static';
		this.lastScrollLeft = 0;

		this.lastThreshold = 0;
		this.nextThreshold = 0;

		this.totalDataWidthFixed = 0;
		this.totalDataWidthLoose = 0;
		this.totalDataHeight = 0;
		this.dataViewHeight = 0;
		this.dataTableHeight = 0;
		this.numDataRowsInTable = 0;

		/** if user didn't define columns and column names then let's try and fetch names from the keys of the first data object */
		if(this.columns.length === 0 && this.data.length > 0) {
			var columnName;
			for(var key in this.data[0]) {
				if(this.data[0].hasOwnProperty(key)) {
					columnName = key.replace(/[-_]/, ' ');
					// capitalize first letter of each word
					columnName = columnName.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
					this.columns.push({ dataName: key, displayName: columnName });
				}
			}
		}
		/** determine column widths */
		this.calculateColumnsWidths();

		/** add grid class */
		this.grid.classList.add('stork-grid', 'stork-grid'+this.rnd);

		/** init HEADER table */
		this.makeHeaderTable();

		/** handle data rows blocks */
		this.initDataView();

		/** onClick events */
		this.dataWrapperElm.addEventListener('click', this.onDataClick.bind(this));
		this.headerTable.wrapper.addEventListener('click', this.onHeaderClick.bind(this));

		/** insert data into the data-tables */
		this.updateViewData(0, 0);
		this.updateViewData(1, 1);

		/** add css rules */
		this.makeCssRules();

		/** on scroll */
		this.dataWrapperElm.addEventListener('scroll', this.onDataScroll.bind(this));

		var evnt = new CustomEvent('grid-loaded', { bubbles: true, cancelable: true, detail: {gridObj: this} });
		if(this.onload) {
			this.onload(evnt);
		}
		this.grid.dispatchEvent(evnt);
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
	 * populated 'width' property for all columns
	 */
	storkGrid.prototype.calculateColumnsWidths = function calculateColumnsWidths() {
		this.totalDataWidthLoose = 0;
		this.totalDataWidthFixed = 0;

		for(var i=0; i < this.columns.length; i++) {
			if(!this.columns[i].width) {
				if(this.columns[i].minWidth) {
					this.columns[i].width = Math.max(this.columns[i].minWidth, this.minColumnWidth);
				} else {
					this.columns[i].width = this.minColumnWidth;
				}
			}

			if(this.columns[i].fixed) {
				this.totalDataWidthFixed += this.columns[i].width;
			} else {
				this.totalDataWidthLoose += this.columns[i].width;
			}
		}
	};

	/**
	 * makes or updates the css rule for the heights of the header rows and data rows
	 */
	storkGrid.prototype.makeCssRules = function makeCssRules() {
		var style = document.getElementById('grid'+this.rnd+'_style');
		if(!style) {
			style = document.createElement('style');
			style.id = 'grid'+this.rnd+'_style';
			style.type = 'text/css';
			document.getElementsByTagName('head')[0].appendChild(style);
		}

		var html = '.stork-grid'+this.rnd+' div.header, .stork-grid'+this.rnd+' div.header > table tr { height: ' + this.headerHeight + 'px; }';
		html += '.stork-grid'+this.rnd+' div.data > table tr { height: ' + this.rowHeight + 'px; }';

		for(var i=0; i < this.columns.length; i++) {
			if(!this.columns[i].width) {
				if(this.columns[i].minWidth) {
					this.columns[i].width = Math.max(this.columns[i].minWidth, this.minColumnWidth);
				} else {
					this.columns[i].width = this.minColumnWidth;
				}
			}
			html += '.stork-grid'+this.rnd+' col.col-'+this.columns[i].dataName+' { width: ' + this.columns[i].width + 'px; }';
		}

		html += '.stork-grid'+this.rnd+' div.header > table.loose { width: ' + this.totalDataWidthLoose + 'px; }';
		html += '.stork-grid'+this.rnd+' div.data-wrapper > div.data { width: ' + (this.totalDataWidthLoose + this.totalDataWidthFixed) + 'px; }';

		style.innerHTML = html;
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
		this.makeCssRules();
	};

	/**
	 * builds the header table for the column names
	 */
	storkGrid.prototype.makeHeaderTable = function makeHeaderTable() {
		var table = document.getElementById('grid'+this.rnd+'_headerTable');
		var tableFixed = document.getElementById('grid'+this.rnd+'_headerTable_fixed');
		var i;

		if(!table) {
			var headerDiv = document.createElement('div');
			headerDiv.classList.add('header');
			this.headerTable.wrapper = headerDiv;

			table = document.createElement('table');
			table.id = 'grid'+this.rnd+'_headerTable';
			table.classList.add('loose');
			this.headerTable.loose = table;

			tableFixed = document.createElement('table');
			tableFixed.id = 'grid'+this.rnd+'_headerTable_fixed';
			tableFixed.classList.add('fixed');
			this.headerTable.fixed = tableFixed;

			headerDiv.appendChild(tableFixed);
			headerDiv.appendChild(table);
			this.grid.appendChild(headerDiv);
		}

		while(table.firstChild) {
			table.removeChild(table.firstChild);
		}
		while(tableFixed.firstChild) {
			tableFixed.removeChild(tableFixed.firstChild);
		}

		var colgroup = document.createElement('colgroup');
		var colgroupFixed = document.createElement('colgroup');
		var col;

		var thead = document.createElement('thead');
		var theadFixed = document.createElement('thead');
		var tr = document.createElement('tr');
		var trFixed = document.createElement('tr');
		var th;

		for(i=0; i < this.columns.length; i++) {
			col = document.createElement('col');
			col.classList.add('col-'+this.columns[i].dataName);

			th = document.createElement('th');
			th.appendChild(document.createTextNode(this.columns[i].displayName));
			th.storkGridProps = {
				column: this.columns[i].dataName,
				sortState: null
			};
			this.headerTable.ths.push(th);

			if(this.columns[i].fixed) {
				colgroupFixed.appendChild(col);
				trFixed.appendChild(th);
			} else {
				colgroup.appendChild(col);
				tr.appendChild(th);
			}
		}

		theadFixed.appendChild(trFixed);
		tableFixed.appendChild(colgroupFixed);
		tableFixed.appendChild(theadFixed);

		table.style.marginLeft = this.totalDataWidthFixed + 'px';
		thead.appendChild(tr);
		table.appendChild(colgroup);
		table.appendChild(thead);
	};

	/**
	 * inits the whole data view, with wrappers for scrolling and tables for data
	 */
	storkGrid.prototype.initDataView = function initDataView() {
		this.dataWrapperElm = document.createElement('div');
		this.dataWrapperElm.classList.add('data-wrapper');
		this.dataWrapperElm.style.height = 'calc(100% - ' + (this.headerHeight - 2) + 'px)';

		this.dataElm = document.createElement('div');
		this.dataElm.classList.add('data');

		this.calculateDataHeight();

		this.dataWrapperElm.appendChild(this.dataElm);
		this.grid.appendChild(this.dataWrapperElm);

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
		var table, tableFixed, tbody, tbodyFixed, tr, trFixed, td, i, j, colgroup, colgroupFixed, col;

		for(var counter=0; counter < 2; counter++) { // counter for number of blocks
			table = document.getElementById('grid' + this.rnd + '_dataTable' + counter);
			tableFixed = document.getElementById('grid' + this.rnd + '_dataTable_fixed' + counter);

			if(!table) {
				tableFixed = document.createElement('table');
				tableFixed.id = 'grid' + this.rnd + '_dataTable_fixed' + counter;
				tableFixed.classList.add('fixed');

				table = document.createElement('table');
				table.id = 'grid' + this.rnd + '_dataTable' + counter;
				table.classList.add('loose');

				this.dataElm.appendChild(tableFixed);
				this.dataElm.appendChild(table);
			}

			while(tableFixed.firstChild) {
				tableFixed.removeChild(tableFixed.firstChild);
			}
			while(table.firstChild) {
				table.removeChild(table.firstChild);
			}

			this.dataTables[counter] = {
				table: table,
				tableFixed: tableFixed,
				dataBlockIndex: null,
				rows: []
			};

			tbody = document.createElement('tbody');
			tbodyFixed = document.createElement('tbody');
			colgroup = document.createElement('colgroup');
			colgroupFixed = document.createElement('colgroup');

			for(i=0; i < this.numDataRowsInTable; i++) {
				tr = document.createElement('tr');
				trFixed = document.createElement('tr');
				tr.storkGridProps = { // our custom object on the DOM object
					dataIndex: null,
					selected: false
				};
				trFixed.storkGridProps = tr.storkGridProps;

				this.dataTables[counter].rows[i] = {
					row: tr,
					rowFixed: trFixed,
					tds: []
				};

				for(j=0; j < this.columns.length; j++) {
					td = document.createElement('td');
					td.storkGridProps = { // our custom object on the DOM object
						column: this.columns[j].dataName,
						selected: false
					};

					this.dataTables[counter].rows[i].tds.push(td);
					if(this.columns[j].fixed) {
						trFixed.appendChild(td);
					} else {
						tr.appendChild(td);
					}

					if(i === 0) { // add cols to colgroup only once
						col = document.createElement('col');
						col.classList.add('col-'+this.columns[j].dataName);

						if(this.columns[j].fixed) {
							colgroupFixed.appendChild(col);
						} else {
							colgroup.appendChild(col);
						}
					}
				}

				tbodyFixed.appendChild(trFixed);
				tbody.appendChild(tr);
			}

			tableFixed.style.top = (this.dataTableHeight * counter) + 'px';
			tableFixed.appendChild(colgroupFixed);
			tableFixed.appendChild(tbodyFixed);

			table.style.marginLeft = this.totalDataWidthFixed + 'px';
			table.style.top = (this.dataTableHeight * counter) + 'px';
			table.appendChild(colgroup);
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
		var topTableIndex, topTable, topTableFixed, bottomTableIndex, bottomTable, bottomTableFixed;
		currScrollTop = currScrollTop || this.scrollY;
		currScrollDirection = currScrollDirection || 'down';
		forceUpdateViewData = forceUpdateViewData || false;
		var currDataBlock = Math.floor(currScrollTop / this.dataTableHeight); // top data-block that is still in the viewable area

		topTableIndex = currDataBlock % 2;
		topTable = this.dataTables[topTableIndex].table;
		topTableFixed = this.dataTables[topTableIndex].tableFixed;
		bottomTableIndex = (currDataBlock + 1) % 2;
		bottomTable = this.dataTables[bottomTableIndex].table;
		bottomTableFixed = this.dataTables[bottomTableIndex].tableFixed;

		if(currScrollDirection === 'down') {
			topTable.style.top = topTableFixed.style.top = (currDataBlock * this.dataTableHeight) + 'px';
			bottomTable.style.top = bottomTableFixed.style.top = ((currDataBlock + 1) * this.dataTableHeight) + 'px';

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
			topTable.style.top = topTableFixed.style.top = (currDataBlock * this.dataTableHeight) + 'px';
			bottomTable.style.top = bottomTableFixed.style.top = ((currDataBlock + 1) * this.dataTableHeight) + 'px';

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

	/**
	 * the onscroll handler when scrolling
	 * @param e
	 */
	storkGrid.prototype.onDataScroll = function onDataScroll(e) {
		var currScrollTop = e.target.scrollTop;
		// trigger only when scroll vertically
		if(currScrollTop !== this.lastScrollTop
			|| (currScrollTop === 0 && this.lastScrollTop === 0)/*fixes a bug for infinite scroll up*/) {
			this.onScrollY(currScrollTop); // vertical
		}

		var currScrollLeft = e.target.scrollLeft;
		// trigger only when scroll horizontally
		if(currScrollLeft !== this.lastScrollLeft) {
			this.onScrollX(currScrollLeft); // horizontal
		}
	};

	/**
	 * when scrolling vertically on Y axis
	 * @param currScrollTop
	 */
	storkGrid.prototype.onScrollY = function onScrollY(currScrollTop) {
		var currScrollDirection = currScrollTop >= this.lastScrollTop ? 'down' : 'up';
		var scrollEvent, i, evnt;

		if(this.lastScrollDirection !== currScrollDirection
			|| (this.lastScrollDirection === 'down' && currScrollTop >= this.nextThreshold)
			|| (this.lastScrollDirection === 'up' && currScrollTop <= this.nextThreshold)) {
			this.repositionTables(currScrollDirection, currScrollTop);
		}

		// save these variables for next script
		// var lastScrollTop = this.lastScrollTop;
		// var lastScrollDirection = this.lastScrollDirection;

		// this 'onScrollY' method ends here.
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
			/*script for dispatching event whenever we are beyond the threshold*/
			if((scrollEvent.fromBottom && currScrollTop >= this.maxScrollY - scrollEvent.amount)
				|| (!scrollEvent.fromBottom && currScrollTop <= scrollEvent.amount)) {
				evnt = new Event(scrollEvent.type, { bubbles: true, cancelable: true });
				this.grid.dispatchEvent(evnt);
			}
		}
	};

	/**
	 * when scrolling horizontally on X axis
	 * @param currScrollLeft
	 */
	storkGrid.prototype.onScrollX = function onScrollX(currScrollLeft) {
		this.headerTable.loose.style.left = -currScrollLeft + 'px';
		this.dataTables[0].tableFixed.style.left = currScrollLeft + 'px';
		this.dataTables[1].tableFixed.style.left = currScrollLeft + 'px';

		if(this.totalDataWidthFixed > 0 && currScrollLeft >= 5 && this.lastScrollLeft < 5) {
			this.dataTables[0].tableFixed.classList.add('covering');
			this.dataTables[1].tableFixed.classList.add('covering');
			this.headerTable.fixed.classList.add('covering');
		}
		else if(currScrollLeft < 5 && this.lastScrollLeft >= 5) {
			this.dataTables[0].tableFixed.classList.remove('covering');
			this.dataTables[1].tableFixed.classList.remove('covering');
			this.headerTable.fixed.classList.remove('covering');
		}

		this.lastScrollLeft = currScrollLeft;
	};

	/**
	 * the onclick handler when clicking on the data viewport
	 * @param e
	 */
	var lastClickTime = 0;
	storkGrid.prototype.onDataClick = function onDataClick(e) {
		var TD = e.target,
			i = 0,
			eventName = 'select',
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
			// should emit a double-click-select?
			var now = Date.now();
			if(now - lastClickTime > 300) {
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

				this.repositionTables(null, null, true);
			}
			else { // it's a double click
				eventName = 'dblselect';
			}

			lastClickTime = now;

			var evnt = new CustomEvent(eventName, {
				bubbles: true,
				cancelable: true,
				detail: {
					dataIndex: dataIndex, /* these primitive values will help us get the selected row's data by using `this.data[dataIndex]` */
					column: selectedCellColumn /* and getting the selected cell's data by using `this.data[dataIndex][column]` */
				}
			});
			this.grid.dispatchEvent(evnt);
		}
		else {
			this.selectedItems.clear();
			console.warn('selected row is not pointing to a valid data');
			this.repositionTables(null, null, true);
		}
	};

	/**
	 * handler for when clicking a column header to sort it
	 * @param e
	 */
	storkGrid.prototype.onHeaderClick = function onHeaderClick(e) {
		var TH = e.target,
			i = 0;

		while(TH.tagName.toUpperCase() !== 'TH') {
			if(i++ >= 2) {
				return; // user clicked on something that is too far from our table-cell
			}
			TH = TH.parentNode;
		}

		for(i=0; i < this.headerTable.ths.length; i++) {
			this.headerTable.ths[i].classList.remove('ascending');
			this.headerTable.ths[i].classList.remove('descending');
		}

		if(TH.storkGridProps.sortState === 'ascending') {
			TH.classList.add('descending');
			TH.storkGridProps.sortState = 'descending';
		} else if(TH.storkGridProps.sortState === 'descending') {
			TH.storkGridProps.sortState = null;
		} else {
			TH.classList.add('ascending');
			TH.storkGridProps.sortState = 'ascending';
		}

		var evnt = new CustomEvent('sort', {
			bubbles: true,
			cancelable: true,
			detail: {
				column: TH.storkGridProps.column,
				state: TH.storkGridProps.sortState
			}
		});
		this.grid.dispatchEvent(evnt);
	};

	/**
	 * updates the data inside one of the tables according to the given data-block-index
	 * @param tableIndex
	 * @param dataBlockIndex
	 */
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
					rowObj.rowFixed.classList.add('selected');
					rowObj.row.storkGridProps.selected = true; // storkGridProps is a referenced object between fixed and loose dom elements
				}
				else {
					selectedItem = null;

					if (rowObj.row.storkGridProps.selected) {
						rowObj.row.classList.remove('selected');
						rowObj.rowFixed.classList.remove('selected');
						rowObj.row.storkGridProps.selected = false; // storkGridProps is a referenced object between fixed and loose dom elements
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