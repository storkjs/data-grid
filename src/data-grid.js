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
		this.resizableColumns = options.resizableColumns !== false;
		this.sortable = options.sortable !== false;
		this.trackBy = options.trackBy || null;
		this.onload = options.onload || null;

		this.selection = {};
		options.selection = options.selection || {};
		this.selection.multi = options.selection.multi || false;
		this.selection.type = options.selection.type === 'cell' ? 'cell' : 'row';

		if(!this.rnd) {
			this.rnd = (Math.floor(Math.random() * 9) + 1) * 1000 + Date.now() % 1000; // random identifier for this grid
		}
		this.tableExtraSize = 0.4; // how much is each data table bigger than the view port
		this.tableExtraPixelsForThreshold = 0;
		this.headerTable = {
			wrapper: null,
			loose: null,
			fixed: null,
			resizer_loose: null,
			resizer_fixed: null,
			ths: []
		};
		this.dataTables = []; // will hold top and bottom data-tables (as objects) and within it its elements and children and some properties
		this.dataWrapperElm = null;
		this.dataElm = null;
		this.selectedItems = new Map();/*ES6*/
		this.customScrollEvents = [];

		this.scrollY = 0; // will be defined upon building the dataWrapper div!
		this.scrollX = 0; // will be defined upon building the dataWrapper div!
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
					this.columns.push({ dataName: key, displayName: columnName, width: 0, minWidth: 0, fixed: false });
				}
			}
		}
		else { // sort columns by 'fixed' first
			var fixedColumns = [], looseColumns = [], i;
			for(i=0; i < this.columns.length; i++) {
				if(this.columns[i].fixed) {
					fixedColumns.push(this.columns[i]);
				} else {
					looseColumns.push(this.columns[i]);
				}
			}

			this.columns = fixedColumns.concat(looseColumns);
		}

		/** add grid class */
		this.grid.classList.add('stork-grid', 'stork-grid'+this.rnd);

		/** init HEADER table */
		this.makeHeaderTable();

		/** handle data rows blocks */
		this.initDataView();

		/** onClick events */
		this.dataWrapperElm.addEventListener('click', this.onDataClick.bind(this));
		if(this.sortable) {
			this.headerTable.wrapper.addEventListener('click', this.onHeaderClick.bind(this));
		}

		/** insert data into the data-tables */
		this.updateViewData(0, 0);
		this.updateViewData(1, 1);

		/** add column resizing buttons */
		if(this.resizableColumns) {
			this.makeColumnsResizable();
		}

		/** determine column widths */
		this.calculateColumnsWidths();

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

		var userDefinedWidth = 0,
			numColumnsNotDefined = 0,
			i, availableWidth, availableWidthPerColumn, roundedPixels;

		for(i=0; i < this.columns.length; i++) {
			this.columns[i].width = this.columns[i].width || 0;
			this.columns[i].minWidth = this.columns[i].minWidth || 0;

			if(this.columns[i].width) {
				// user has set an initial width but let's make sure it's not smaller than the allowed minimum
				this.columns[i].width = Math.max(this.columns[i].width, this.columns[i].minWidth, this.minColumnWidth);

				userDefinedWidth += this.columns[i].width;
			}
			else {
				numColumnsNotDefined++;
			}
		}

		availableWidth = this.dataWrapperElm.clientWidth - userDefinedWidth;
		availableWidthPerColumn = Math.floor(availableWidth / numColumnsNotDefined);
		roundedPixels = availableWidth % numColumnsNotDefined;

		for(i=0; i < this.columns.length; i++) {
			if(!this.columns[i].width) { // user didn't set any initial width so let's choose the largest minimum or fill the empty space of the wrapper if there is any
				this.columns[i].width = Math.max(this.columns[i].minWidth, this.minColumnWidth, availableWidthPerColumn);

				if(roundedPixels && this.columns[i].width === availableWidthPerColumn) {
					this.columns[i].width += roundedPixels;
					roundedPixels = 0; // add the missing pixels only once - to the first element
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

		// header height
		var html = '.stork-grid'+this.rnd+' div.header,' +
			'.stork-grid'+this.rnd+' div.header > table th,' +
			'.stork-grid'+this.rnd+' div.header > table.resizers a { height: ' + this.headerHeight + 'px; }';
		// header content max-height
		html += '.stork-grid'+this.rnd+' div.header > table th > div { max-height: ' + this.headerHeight + 'px; }';
		// data rows height
		html += '.stork-grid'+this.rnd+' div.data > table td { height: ' + this.rowHeight + 'px; }';
		// data rows content max-height
		html += '.stork-grid'+this.rnd+' div.data > table td > div { max-height: ' + this.rowHeight + 'px; }';

		for(var i=0; i < this.columns.length; i++) {
			html += '.stork-grid'+this.rnd+' col.col-'+this.columns[i].dataName+' { width: ' + this.columns[i].width + 'px; }';
		}

		// when table-layout is 'fixed' then the tables must have a 'width' style
		html += '.stork-grid'+this.rnd+' div.header > table.loose,' +
			'.stork-grid'+this.rnd+' div.data-wrapper > div.data > table.loose { width: ' + this.totalDataWidthLoose + 'px; }';
		html += '.stork-grid'+this.rnd+' div.header > table.fixed,' +
			'.stork-grid'+this.rnd+' div.data-wrapper > div.data > table.fixed { width: ' + this.totalDataWidthFixed + 'px; }';

		// force a 'width' for the data div so it will overflow and trigger a horizontal scrollbar
		html += '.stork-grid'+this.rnd+' div.data-wrapper > div.data { width: ' + (this.totalDataWidthLoose + this.totalDataWidthFixed) + 'px; }';

		style.innerHTML = html;

		/** extra styles */
		this.headerTable.loose.style.marginLeft = this.totalDataWidthFixed + 'px';
		if(this.headerTable.resizer_loose) {
			this.headerTable.resizer_loose.style.marginLeft = this.totalDataWidthFixed + 'px';
		}
		this.dataTables[0].table.style.marginLeft = this.totalDataWidthFixed + 'px';
		this.dataTables[1].table.style.marginLeft = this.totalDataWidthFixed + 'px';
	};

	/**
	 * sets the height of each row
	 * @param num
	 */
	storkGrid.prototype.setRowHeight = function setRowHeight(num) {
		this.rowHeight = num;
		this.makeCssRules();
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
			table.classList.add('columns');
			this.headerTable.loose = table;

			tableFixed = document.createElement('table');
			tableFixed.id = 'grid'+this.rnd+'_headerTable_fixed';
			tableFixed.classList.add('fixed');
			tableFixed.classList.add('columns');
			this.headerTable.fixed = tableFixed;

			headerDiv.appendChild(tableFixed);
			headerDiv.appendChild(table);
			this.grid.appendChild(headerDiv);
		}
		else {
			while(table.firstChild) {
				table.removeChild(table.firstChild);
			}
			while(tableFixed.firstChild) {
				tableFixed.removeChild(tableFixed.firstChild);
			}
		}

		var colgroup = document.createElement('colgroup');
		var colgroupFixed = document.createElement('colgroup');
		var col;

		var thead = document.createElement('thead');
		var theadFixed = document.createElement('thead');
		var tr = document.createElement('tr');
		var trFixed = document.createElement('tr');
		var th, thDiv;

		for(i=0; i < this.columns.length; i++) {
			col = document.createElement('col');
			col.classList.add('col-'+this.columns[i].dataName);

			th = document.createElement('th');
			thDiv = document.createElement('div');
			thDiv.appendChild(document.createTextNode(this.columns[i].displayName));
			th.appendChild(thDiv);
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
			configurable: true,
			enumerable: true,
			get: function() {
				return self.dataWrapperElm.scrollTop || 0;
			},
			set: function(newValue) {
				self.dataWrapperElm.scrollTop = newValue;
			}
		});
		Object.defineProperty(self, 'scrollX', {
			configurable: true,
			enumerable: true,
			get: function() {
				return self.dataWrapperElm.scrollLeft || 0;
			},
			set: function(newValue) {
				self.dataWrapperElm.scrollLeft = newValue;
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
		var table, tableFixed, tbody, tbodyFixed, tr, trFixed, td, tdDiv, i, j, colgroup, colgroupFixed, col;

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

					tdDiv = document.createElement('div');
					td.appendChild(tdDiv);

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
		else {
			// on desktop the user either scrolls vertically or horizontally.
			// so this prevents getting the 'target.scrollLeft' value which triggers a reflow, which is a heavy operation.
			// TODO - test what happens when scrolling both down and right (like in mobile)?
			var currScrollLeft = e.target.scrollLeft;
			// trigger only when scroll horizontally
			if(currScrollLeft !== this.lastScrollLeft) {
				this.onScrollX(currScrollLeft); // horizontal
			}
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
		if(this.headerTable.resizer_loose) {
			this.headerTable.resizer_loose.style.left = -currScrollLeft + 'px';
		}
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
			if(this.headerTable.ths[i] === TH) {
				continue;
			}
			this.headerTable.ths[i].classList.remove('ascending');
			this.headerTable.ths[i].classList.remove('descending');
			this.headerTable.ths[i].storkGridProps.sortState = null;
		}

		if(TH.storkGridProps.sortState === 'ascending') {
			TH.classList.remove('ascending');
			TH.classList.add('descending');
			TH.storkGridProps.sortState = 'descending';
		} else if(TH.storkGridProps.sortState === 'descending') {
			TH.classList.remove('descending');
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
			dataKeyName, dataIndex, i, selectedItem, trackByData, tdDiv;

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

					// render content
					tdDiv = rowObj.tds[i].firstChild;
					if (tdDiv.firstChild) {
						tdDiv.firstChild.nodeValue = this.data[dataIndex][dataKeyName];
					} else {
						tdDiv.appendChild(document.createTextNode(this.data[dataIndex][dataKeyName]));
					}
				}
			}
			else {
				for (i = 0; i < this.columns.length; i++) {
					tdDiv = rowObj.tds[i].firstChild;
					if (tdDiv.firstChild) {
						tdDiv.firstChild.nodeValue = '';
					}
				}
			}

			selectedItem = null;
		}

		tableObj.dataBlockIndex = dataBlockIndex;
	};

	/**
	 * add dragable elements to resize the columns + emit events
	 */
	storkGrid.prototype.makeColumnsResizable = function makeColumnsResizable() {
		var colResizers = document.getElementById('grid'+this.rnd+'_columnResizers');
		var colResizersFixed = document.getElementById('grid'+this.rnd+'_columnResizers_fixed');
		var resizer, i, tbody, tr, trFixed, td,
			colgroup, colgroupFixed, col;

		if(!colResizers) {
			colResizers = document.createElement('table');
			colResizers.id = 'grid'+this.rnd+'_columnResizers';
			colResizers.classList.add('loose');
			colResizers.classList.add('resizers');
			this.headerTable.resizer_loose = colResizers;

			colResizersFixed = document.createElement('table');
			colResizersFixed.id = 'grid'+this.rnd+'_columnResizers_fixed';
			colResizersFixed.classList.add('fixed');
			colResizersFixed.classList.add('resizers');
			this.headerTable.resizer_fixed = colResizersFixed;

			colgroup = document.createElement('colgroup');
			tbody = document.createElement('tbody');
			tr = document.createElement('tr');

			tbody.appendChild(tr);
			colResizers.appendChild(colgroup);
			colResizers.appendChild(tbody);
			this.headerTable.wrapper.insertBefore(colResizers, this.headerTable.wrapper.firstChild);

			colgroupFixed = document.createElement('colgroup');
			tbody = document.createElement('tbody');
			trFixed = document.createElement('tr');

			tbody.appendChild(trFixed);
			colResizersFixed.appendChild(colgroupFixed);
			colResizersFixed.appendChild(tbody);
			this.headerTable.wrapper.insertBefore(colResizersFixed, this.headerTable.wrapper.firstChild);

			col = document.createElement('span'); // temporarily use of 'col' var
			col.id = 'grid'+this.rnd+'_dragPlaceholder';
			this.headerTable.wrapper.appendChild(col);
		}
		else {
			colgroup = colResizers.querySelector('colgroup');
			colgroupFixed = colResizersFixed.querySelector('colgroup');

			tr = colResizers.querySelector('tr');
			trFixed = colResizersFixed.querySelector('tr');

			while(tr.firstChild) {
				tr.removeChild(tr.firstChild);
			}
			while(trFixed.firstChild) {
				trFixed.removeChild(trFixed.firstChild);
			}
		}

		for(i=0; i < this.columns.length; i++) {
			col = document.createElement('col');
			col.classList.add('col-'+this.columns[i].dataName);

			td = document.createElement('td');

			resizer = document.createElement('a');
			resizer.style.right = '-2px';
			resizer.setAttribute('draggable', 'true');
			resizer.storkGridProps = {
				dragStartX: 0,
				columnIndex: i
			};

			this.setResizeByDragging(resizer, this.columns[i]);

			td.appendChild(resizer);
			if(this.columns[i].fixed) {
				trFixed.appendChild(td);
				colgroupFixed.appendChild(col);
			}
			else {
				tr.appendChild(td);
				colgroup.appendChild(col);
			}
		}
	};

	/**
	 * sets the dragging events for the resizing element
	 * @param {HTMLElement} elm
	 */
	storkGrid.prototype.setResizeByDragging = function setResizeByDragging(elm) {
		var self = this;
		var columnObj = self.columns[elm.storkGridProps.columnIndex];

		elm.addEventListener('dragstart', function(e) {
			e.dataTransfer.setDragImage(document.getElementById('grid'+self.rnd+'_dragPlaceholder'), 0, 0);
			elm.storkGridProps.dragStartX = e.screenX;
			elm.classList.add('dragging');
		});
		elm.addEventListener('drag', function(e) {
			if(e.screenX !== 0) { // fixes annoying bug when ending drag
				var delta = e.screenX - elm.storkGridProps.dragStartX;
				var newColumnWidth = columnObj.width + delta;
				var minWidth = Math.max(columnObj.minWidth, self.minColumnWidth);

				if(newColumnWidth < minWidth) {
					delta = minWidth - columnObj.width;
				}

				elm.style.right = (-2 - delta) + 'px';
			}
		});
		elm.addEventListener('dragend', function(e) {
			elm.classList.remove('dragging');
			elm.style.right = '-2px';
			var delta = e.screenX - elm.storkGridProps.dragStartX;

			columnObj.width = Math.max(columnObj.width + delta, columnObj.minWidth, self.minColumnWidth);

			self.calculateColumnsWidths();
			self.makeCssRules();

			var evnt = new CustomEvent('resize-column', {
				bubbles: true,
				cancelable: true,
				detail: {
					columnIndex: elm.storkGridProps.columnIndex,
					width: columnObj.width
				}
			});
			self.grid.dispatchEvent(evnt);
		});
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

	/**
	 * completely destroy the grid - its DOM elements, methods and data
	 */
	storkGrid.prototype.destroy = function destroy() {
		var rows = this.grid.querySelectorAll('tr');
		var cells = this.grid.querySelectorAll('th, td');
		var i, j, k;

		// remove dom elements
		for(i=0; i < cells.length; i++) {
			cells[i].parentNode.removeChild(cells[i]);
		}
		for(i=0; i < rows.length; i++) {
			rows[i].parentNode.removeChild(rows[i]);
		}

		while(this.grid.firstChild) {
			this.grid.removeChild(this.grid.firstChild);
		}

		// remove properties
		this.grid.classList.remove('stork-grid', 'stork-grid'+this.rnd);
		delete this.grid;
		delete this.data;
		delete this.rowHeight;
		delete this.headerHeight;
		delete this.columns;
		delete this.minColumnWidth;
		delete this.resizableColumns;
		delete this.sortable;
		delete this.trackBy;
		delete this.onload;

		delete this.selection.multi;
		delete this.selection.type;
		delete this.selection;

		delete this.tableExtraSize;
		delete this.tableExtraPixelsForThreshold;

		for(i=0; i < this.headerTable.ths.length; i++) {
			this.headerTable.ths[i] = null;
		}
		delete this.headerTable;

		for(i=0; i < this.dataTables; i++) {
			for(j=0; j < this.dataTables[i].rows.length; j++) {
				for(k=0; k < this.dataTables[i].rows[j].tds.length; k++) {
					this.dataTables[i].rows[j].tds[k] = null;
				}
				this.dataTables[i].rows[j] = null;
			}
		}
		delete this.dataTables;

		delete this.dataWrapperElm;
		delete this.dataElm;
		delete this.selectedItems;
		delete this.customScrollEvents;
		delete this.scrollX;
		delete this.scrollY;
		delete this.maxScrollY;
		delete this.lastScrollTop;
		delete this.lastScrollDirection;
		delete this.lastScrollLeft;
		delete this.lastThreshold;
		delete this.nextThreshold;
		delete this.totalDataWidthFixed;
		delete this.totalDataWidthLoose;
		delete this.totalDataHeight;
		delete this.dataViewHeight;
		delete this.dataTableHeight;
		delete this.numDataRowsInTable;
	};

	storkGrid.prototype.setColumns = function setColumns(columns) {
		var options = {};

		// save all currently set options (but with new columns)
		options.columns = columns;

		options.element = this.grid;
		options.data = this.data;
		options.rowHeight = this.rowHeight;
		options.headerHeight = this.headerHeight;
		options.minColumnWidth = this.minColumnWidth;
		options.resizableColumns = this.resizableColumns;
		options.sortable = this.sortable;
		options.trackBy = this.trackBy;
		options.onload = this.onload;
		options.selection = this.selection;

		// destroy the grid
		this.destroy();

		// rebuild the grid
		this.constructor(options);
	};

	root.storkGrid = storkGrid;
})(this); // main scope we run at (should be 'window')