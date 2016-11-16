(function(root) {
	"use strict";

	/**
	 * capitalize first letter of every word and the rest is lowercased
	 * @param str
	 * @returns {*}
	 */
	var capitalizeWords = function capitalizeWords(str) {
		return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
	};

	/**
	 * change an element's transform:translate style for X or Y axis without deleting the other axis' style
	 * @param elm
	 * @param direction
	 * @param amount
	 */
	var changeTranslate = function changeTranslate(elm, direction, amount) {
		if(!elm) {
			return;
		}

		if(!elm.storkGridProps) {
			elm.storkGridProps = {};
		}
		if(!elm.storkGridProps.translateX) {
			elm.storkGridProps.translateX = 0;
		}
		if(!elm.storkGridProps.translateY) {
			elm.storkGridProps.translateY = 0;
		}

		if(direction.toUpperCase() === 'X') {
			elm.storkGridProps.translateX = amount;
			elm.style.transform = 'translate(' + amount + 'px,' + elm.storkGridProps.translateY + 'px)';
		}
		else if(direction.toUpperCase() === 'Y') {
			elm.storkGridProps.translateY = amount;
			elm.style.transform = 'translate(' + elm.storkGridProps.translateX + 'px,' + amount + 'px)';
		}
	};

	/**
	 * construct for the StorkJS Data Grid...
	 * this initializes all of the variable and then starts the DOM build up process
	 * @param options
	 */
	var StorkGrid = function StorkGrid(options) {
		this.initProperties(options);

		if(this.asyncLoading) {
			setTimeout(this.bootstrap.bind(this), 1);
		} else {
			this.bootstrap();
		}
	};

	/**
	 * initiates and resets all required properties for the grid instance
	 * @param options
	 */
	StorkGrid.prototype.initProperties = function initProperties(options) {
		this.grid = options.element;
		this.data = options.data || [];
		this.rowHeight = options.rowHeight || 32;
		this.headerHeight = options.headerHeight || this.rowHeight;
		this.columns = options.columns || [];
		this.columnClasses = options.columnClasses || {};
		this.minColumnWidth = options.minColumnWidth || 50;
		this.resizableColumns = options.resizableColumns !== false;
		this.trackBy = options.trackBy || null;
		this.onload = options.onload || null;
		this.asyncLoading = options.asyncLoading || false;
		this.debug = options.debug || false;

		this.selection = {};
		options.selection = options.selection || {};
		this.selection.multi = options.selection.multi || false;
		this.selection.type = options.selection.type === 'cell' ? 'cell' : 'row';

		this.rnd = (Math.floor(Math.random() * 9) + 1) * 1000 + Date.now() % 1000; // random identifier for this grid
		this.tableExtraSize = 0.4; // how much is each data table bigger than the view port
		this.tableExtraPixelsForThreshold = 0;
		this.rowBorders = { // top&bottom border sizes
			header: 0, // border size of header element (do not put border on Table, TR or TH)
			data: 0 // border size of TDs (do not put border on TR, put it directly on TDs)
		};
		this.headerTable = {
			container: null,
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
		this.clickedItem = null; // physically clicked item (when user started a selection)
		this.hoveredRowElm = null; // last row user hovered above while on mouse-move
		this.customScrollEvents = [];
		this.eventListeners = [];
		this.resizerLine = null; // the element of the vertical line when resizing column

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
		this.dataViewWidth = 0;
		this.dataTableHeight = 0;
		this.numDataRowsInTable = 0;
	};

	/**
	 * init the whole loading up process
	 */
	StorkGrid.prototype.bootstrap = function bootstrap() {
		this.initColumnsObject();

		/** add grid class */
		this.grid.classList.add('stork-grid', 'stork-grid'+this.rnd);

		/** make grid a focusable element (also enables capturing key presses */
		this.grid.setAttribute('tabindex', 0);

		/** init HEADER table */
		this.makeHeaderTable();

		/** handle data rows blocks */
		this.initDataView(); //will call 'resize()' which triggers quazillion functions

		/** insert data into the data-tables */
		this.updateViewData(0, 0);
		this.updateViewData(1, 1);

		/** add column resizing buttons */
		if(this.resizableColumns) {
			this.makeColumnsResizable();
		}

		/** Events */
		this.setEventListeners();

		/** grid finished loading its data and DOM */
		var evnt = new CustomEvent('grid-loaded', { bubbles: true, cancelable: true, detail: {gridObj: this} });
		if(this.onload) {
			this.onload(evnt);
		}
		this.grid.dispatchEvent(evnt);
	};

	/**
	 * init the columns object which holds the columns metadata and adds column-names if needed or sorts to fixed and loose columns
	 */
	StorkGrid.prototype.initColumnsObject = function initColumnsObject() {
		/** if user didn't define columns and column names then let's try and fetch names from the keys of the first data object */
		if(this.columns.length === 0 && this.data.length > 0) {
			var columnName;
			for(var key in this.data[0]) {
				if(this.data[0].hasOwnProperty(key)) {
					columnName = key.replace(/[-_]/, ' ');
					// capitalize first letter of each word
					columnName = capitalizeWords(columnName);
					this.columns.push({ field: key, label: columnName, width: 0, minWidth: 0, fixed: false, render: null });
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
	};

	/**
	 * CUSTOM addEventListener method. this method keeps track of listeners so we can later do removeEventListener
	 * (for example on destroy()) and prevent memory leaks.
	 * @param element
	 * @param type
	 * @param listener
	 * @param options_or_useCapture
	 * @private
	 */
	StorkGrid.prototype._addEventListener = function customAddEventListener(element, type, listener, options_or_useCapture) {
		element.addEventListener(type, listener, options_or_useCapture); // add event listener

		this.eventListeners.push({element: element, type: type, listener: listener, options: options_or_useCapture}); // save listeners parameters

		return this.eventListeners.length - 1; // return index for removing this specific listener later
	};

	/**
	 * remove a specific event listener by its index
	 * @param index
	 * @private
	 */
	StorkGrid.prototype._removeEventListener = function customRemoveEventListener(index) {
		var currEL = this.eventListeners[index];
		if(currEL) { // if this event wasn't removed before
			currEL.element.removeEventListener(currEL.type, currEL.listener, currEL.options);
		}
		this.eventListeners[index] = null; // change value instead of popping it out because we don't want to change the indexes of others in this list
	};

	/**
	 * remove all event listeners from all of the grid's dom elements and empty the listeners array
	 * @private
	 */
	StorkGrid.prototype._emptyEventListeners = function emptyEventListeners() {
		var currEL;

		for(var i=0; i < this.eventListeners.length; i++) {
			currEL = this.eventListeners[i];

			if(currEL) {
				this._removeEventListener(i);
			}
		}
	};

	/**
	 * a function for passing an addEventListener from the grid-instance to the grid-dom-element
	 * @param type
	 * @param listener
	 * @param [options_or_useCapture]
	 */
	StorkGrid.prototype.addEventListener = function customAddEventListener(type, listener, options_or_useCapture) {
		this._addEventListener(this.grid, type, listener, options_or_useCapture, true);
	};

	/**
	 * a function for passing a removeEventListener from the grid-instance to the grid-dom-element
	 * @param type
	 * @param listener
	 * @param [options_or_useCapture]
	 */
	StorkGrid.prototype.removeEventListener = function customRemoveEventListener(type, listener, options_or_useCapture) {
		this.grid.removeEventListener(type, listener, options_or_useCapture);

		for(var i=0; i < this.eventListeners.length; i++) {
			if(this.eventListeners[i].element === this.grid
				&& this.eventListeners[i].type === type
				&& this.eventListeners[i].listener === listener) {
				this.eventListeners[i] = null;
			}
		}
	};

	/**
	 * dispatch a 'select' or 'dblselect' event, with a detail object
	 * @param type
	 * @param dataIndex
	 * @param column
	 * @param trackByData
	 * @private
	 */
	StorkGrid.prototype._dispatchSelectEvent = function _dispatchSelectEvent(type, dataIndex, column, trackByData) {
		if(type !== 'dblselect' && type !== 'data-click') {
			type = 'select';
		}

		var evnt = new CustomEvent(type, {
			bubbles: true,
			cancelable: true,
			detail: {
				dataIndex: dataIndex, /* these primitive value will help the user get extra data (did user click on first or last row? etc.) */
				rowData: this.data[dataIndex],
				column: column, /* getting the selected cell's data by using `rowData[column]` */
				isSelect: this.selectedItems.has(trackByData) /* we emit the event for both select and deselect. `false` is for when un-selecting */
			}
		});
		this.grid.dispatchEvent(evnt);
	};

	/**
	 * will add an event that will be emitted when passing the defined threshold while scrolling
	 * @param {string} type - the name for the event
	 * @param {number} amount
	 * @param {boolean} [fromBottom] - relative to the bottom of the grid or else to the top of it. defaults to True
	 */
	StorkGrid.prototype.addScrollEvent = function addScrollEvent(type, amount, fromBottom) {
		fromBottom = fromBottom !== false;
		this.customScrollEvents.push({type: type, amount: amount, fromBottom: fromBottom});
	};

	/**
	 * populated 'width' property for all columns
	 */
	StorkGrid.prototype.calculateColumnsWidths = function calculateColumnsWidths() {
		this.totalDataWidthLoose = 0;
		this.totalDataWidthFixed = 0;

		var userDefinedWidth = 0,
			numColumnsNotDefined = 0,
			i, availableWidth, availableWidthPerColumn, roundedPixels;

		for(i=0; i < this.columns.length; i++) {
			this.calculateColumnHeaderContentWidth(this.columns[i]);
			//we use private properties (_width etc.) because we don't wanna overwrite the initial user preferred width
			this.columns[i]._width = this.columns[i].width || 0;
			this.columns[i]._minWidth = this.columns[i].minWidth || 0;

			if(this.columns[i]._width) {
				// user has set an initial width but let's make sure it's not smaller than the allowed minimum
				this.columns[i]._width = Math.max(this.columns[i]._width, this.columns[i]._minWidth, this.columns[i].contentWidth, this.minColumnWidth);

				userDefinedWidth += this.columns[i]._width;
			}
			else {
				numColumnsNotDefined++;
			}
		}

		availableWidth = this.dataWrapperElm.clientWidth - userDefinedWidth;
		availableWidthPerColumn = 0;
		if(numColumnsNotDefined > 0) {
			availableWidthPerColumn = Math.floor(availableWidth / numColumnsNotDefined);
		}
		roundedPixels = availableWidth % numColumnsNotDefined;

		for(i=0; i < this.columns.length; i++) {
			if(!this.columns[i]._width) { // user didn't set any initial width so let's choose the largest minimum or fill the empty space of the wrapper if there is any
				this.columns[i]._width = Math.max(this.columns[i]._minWidth, this.minColumnWidth, availableWidthPerColumn);

				if(roundedPixels && this.columns[i]._width === availableWidthPerColumn) {
					this.columns[i]._width += roundedPixels;
					roundedPixels = 0; // add the missing pixels only once - to the first element
				}
			}

			if(this.columns[i].fixed) {
				this.totalDataWidthFixed += this.columns[i]._width;
			} else {
				this.totalDataWidthLoose += this.columns[i]._width;
			}
		}

		this.onScrollX(this.scrollX); //trigger a scroll in case the user has just resized a fixed column to be too wide
	};

	/**
	 * makes or updates the css rule for the heights of the header rows and data rows
	 */
	StorkGrid.prototype.makeCssRules = function makeCssRules() {
		var style = document.getElementById('grid'+this.rnd+'_style');
		if(!style) {
			style = document.createElement('style');
			style.id = 'grid'+this.rnd+'_style';
			style.type = 'text/css';
			document.getElementsByTagName('head')[0].appendChild(style);
		}

		var headerStyle = this.headerTable.container.currentStyle || window.getComputedStyle(this.headerTable.container);
		this.rowBorders.header = parseInt(headerStyle.borderTopWidth, 10) + parseInt(headerStyle.borderBottomWidth, 10);

		if(this.dataTables[0].rows[0].tds.length > 0) {
			var cellStyle = this.dataTables[0].rows[0].tds[0].currentStyle || window.getComputedStyle(this.dataTables[0].rows[0].tds[0]);
			this.rowBorders.data = parseInt(cellStyle.borderTopWidth, 10) + parseInt(cellStyle.borderBottomWidth, 10);
		}

		var headerScrollbarWidth = this.headerTable.container.offsetWidth - this.headerTable.container.clientWidth;
		if(!headerScrollbarWidth || headerScrollbarWidth < 0) {
			headerScrollbarWidth = 15; //browsers default
		}

		// header height
		var html = '.stork-grid'+this.rnd+' div.header-wrapper { height: ' + this.headerHeight + 'px; }';
		html += '.stork-grid'+this.rnd+' div.header > table th,' +
			'.stork-grid'+this.rnd+' div.header > table.resizers a { height: ' + (this.headerHeight - this.rowBorders.header) + 'px; }';
		// header content max-height
		html += '.stork-grid'+this.rnd+' div.header > table th > div { max-height: ' + (this.headerHeight - this.rowBorders.header) + 'px; }';
		//scrollbar-concealer width
		html += '.stork-grid'+this.rnd+' div.header-wrapper > div.scrollbar-concealer { width: ' + headerScrollbarWidth + 'px; }';
		// data rows height
		html += '.stork-grid'+this.rnd+' div.data > table td { height: ' + this.rowHeight + 'px; }';
		// data rows content max-height
		html += '.stork-grid'+this.rnd+' div.data > table td > div { max-height: ' + (this.rowHeight - this.rowBorders.data) + 'px; }';

		//columns widths
		for(var i=0; i < this.columns.length; i++) {
			html += '.stork-grid'+this.rnd+' th.'+this.columns[i].field+',' +
				'.stork-grid'+this.rnd+' td.'+this.columns[i].field+' { width: ' + this.columns[i]._width + 'px; }';
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

	StorkGrid.prototype.setEventListeners = function setEventListeners() {
		this._addEventListener(this.headerTable.container, 'click', this.onHeaderClick.bind(this), false); // on click on header
		this._addEventListener(this.dataWrapperElm, 'click', this.onDataClick.bind(this), false); // on click on data rows
		this._addEventListener(this.dataWrapperElm, 'mousedown', this.onDataSelect.bind(this), false); // on start selecting on data rows
		this._addEventListener(this.dataWrapperElm, 'wheel', this.onDataWheelScroll.bind(this), false); // on horizontal wheel scroll
		this._addEventListener(this.dataWrapperElm, 'keydown', this.onDataKeyboardNavigate.bind(this), false); // on horizontal keyboard scroll
		this._addEventListener(this.grid, 'keydown', this._onKeyboardNavigate.bind(this), false); // on arrows up/down
		this._addEventListener(this.dataWrapperElm, 'scroll', this.onDataScroll.bind(this), false); // on scroll
		this._addEventListener(document, 'click', this._onClickCheckFocus.bind(this), true); // document check if we are focused on the grid
		this._addEventListener(document, 'copy', this.onCopy.bind(this), true); // on copy
	};

	/**
	 * sets the height of each row
	 * @param num
	 */
	StorkGrid.prototype.setRowHeight = function setRowHeight(num) {
		this.rowHeight = num;
		this.resize();
	};

	/**
	 * sets the height of the header
	 * @param num
	 */
	StorkGrid.prototype.setHeaderHeight = function setHeaderHeight(num) {
		this.headerHeight = num;
		this.resize();
	};

	/**
	 * builds the header table for the column names
	 */
	StorkGrid.prototype.makeHeaderTable = function makeHeaderTable() {
		var table = document.getElementById('grid'+this.rnd+'_headerTable');
		var tableFixed = document.getElementById('grid'+this.rnd+'_headerTable_fixed');
		var i;

		if(!table) {
			var headerWrapper = document.createElement('div');
			headerWrapper.classList.add('header-wrapper');
			var headerDiv = document.createElement('div');
			headerDiv.classList.add('header');
			this.headerTable.container = headerDiv;

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

			var scrollbarConcealer = document.createElement('div');
			scrollbarConcealer.classList.add('scrollbar-concealer');

			headerWrapper.appendChild(headerDiv);
			headerWrapper.appendChild(scrollbarConcealer);
			this.grid.appendChild(headerWrapper);
		}
		else {
			while(table.firstChild) {
				table.removeChild(table.firstChild);
			}
			while(tableFixed.firstChild) {
				tableFixed.removeChild(tableFixed.firstChild);
			}
		}

		var thead = document.createElement('thead');
		var theadFixed = document.createElement('thead');
		var tr = document.createElement('tr');
		var trFixed = document.createElement('tr');
		var th, thSpan;

		for(i=0; i < this.columns.length; i++) {
			th = document.createElement('th');
			th.classList.add(this.columns[i].field);
			thSpan = document.createElement('span');
			thSpan.appendChild(document.createTextNode(this.columns[i].label));
			th.appendChild(thSpan);
			th.storkGridProps = {
				column: this.columns[i].field
			};
			this.headerTable.ths.push(th);

			if(this.columns[i].fixed) {
				trFixed.appendChild(th);
			} else {
				tr.appendChild(th);
			}
		}

		theadFixed.appendChild(trFixed);
		tableFixed.appendChild(theadFixed);

		thead.appendChild(tr);
		table.appendChild(thead);
	};

	/**
	 * a closure function for returning a function of either adding or removing a class from a column
	 * @param operation
	 */
	var addRemoveColumnClass = function addRemoveColumnClass(operation) {
		operation = operation==='remove' ? 'remove' : 'add';

		return function(field, className, alsoForDataCells) {
			alsoForDataCells = alsoForDataCells === true;

			var TH = this.headerTable.container.querySelector('th.' + field);

			if(TH) {
				TH.classList[operation](className);

				//save user columns in a cache
				if(TH.classList.contains(className)) {
					if(!this.columnClasses.hasOwnProperty(field)) {
						this.columnClasses[field] = {};
					}

					this.columnClasses[field][className] = false; //save class name with 'alsoForDataCells' false
				}
				else if(this.columnClasses.hasOwnProperty(field) && this.columnClasses[field].hasOwnProperty(className)) { //delete from cache
					delete this.columnClasses[field][className];
				}

				if(alsoForDataCells) {
					var TDs = this.dataElm.querySelectorAll('td.' + field);
					for(var i = 0; i < TDs.length; i++) {
						TDs[i].classList[operation](className);
					}

					if(this.columnClasses.hasOwnProperty(field) && this.columnClasses[field].hasOwnProperty(className)) {
						this.columnClasses[field][className] = true; //set 'alsoForDataCells' true
					}
				}
			} else {
				console.warn('Invalid column given to add/remove columnClass');
			}
		};
	};

	/**
	 * add a class to a specific column header
	 * @param field
	 * @param className
	 * @param alsoForDataCells
	 */
	StorkGrid.prototype.addColumnClass = addRemoveColumnClass('add');

	/**
	 * remove a class off a specific column header
	 * @param field
	 * @param className
	 * @param alsoForDataCells
	 */
	StorkGrid.prototype.removeColumnClass = addRemoveColumnClass('remove');

	/**
	 * inits the whole data view, with wrappers for scrolling and tables for data
	 */
	StorkGrid.prototype.initDataView = function initDataView() {
		if(!(this.dataWrapperElm instanceof HTMLElement)) { //runs only for the first time
			this.dataWrapperElm = document.createElement('div');
			this.dataWrapperElm.classList.add('data-wrapper');

			this.dataElm = document.createElement('div');
			this.dataElm.classList.add('data');
			this.dataElm.setAttribute('tabindex', 0);

			this.dataWrapperElm.appendChild(this.dataElm);
			this.grid.appendChild(this.dataWrapperElm);
		}

		// giving this element height before rendering fixes a memory-leak in Chrome and FF
		this.dataWrapperElm.style.height = 'calc(100% - ' + this.headerHeight + 'px)';
		this.calculateDataHeight();

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

		// init the DOM elements
		this.resize(); // resizeCalculate() + buildDataTables() + calculateColumnsWidths() + makeCssRules() + repositionTables()
	};

	/**
	 * calculates and sets the needed height for the data
	 */
	StorkGrid.prototype.calculateDataHeight = function calculateDataHeight() {
		var rows = this.data ? this.data.length : 0;
		this.totalDataHeight = this.rowHeight * rows;
		if(this.totalDataHeight > 0) { //there is data to show
			this.dataElm.style.height = this.totalDataHeight + 'px';
			this.dataElm.style.visibility = 'visible';
		}
		else { //there is no data to show. but we still want to force width which might trigger a scrollbar
			this.dataElm.style.height = '1px';
			this.dataElm.style.visibility = 'hidden';
		}
		this.maxScrollY = Math.max(this.dataWrapperElm.scrollHeight - this.dataViewHeight, 0);
	};

	/**
	 * calculates the size of child elements upon resize
	 */
	StorkGrid.prototype.resizeCalculate = function resizeCalculate() {
		// if the grid container height wasn't set then dataWrapperElm will have its height stretched unlimited (becuase it has 'height:100%')
		// this causes JS to calculate dataWrapperElm height as larger than its parent, the grid container.
		// we will add 2 styles as a counter measurements
		if(this.dataWrapperElm.clientHeight > this.grid.clientHeight) {
			this.grid.style.height = this.grid.clientHeight + 'px';
			this.dataWrapperElm.style.maxHeight = window.innerHeight + 'px';
		}

		this.dataViewHeight = this.dataWrapperElm.clientHeight; // the HEIGHT of a viewport the client can see
		this.dataViewWidth = this.dataWrapperElm.clientWidth; // the WIDTH of a viewport the client can see

		if(this.dataViewHeight < this.rowHeight) {
			this.dataViewHeight = this.rowHeight;
			if(this.debug) {
				console.warn('The Data Wrapper element was set too low. Height can\'t be less than the height of one row!');
			}
		}
		this.maxScrollY = Math.max(this.dataWrapperElm.scrollHeight - this.dataViewHeight, 0);

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
	StorkGrid.prototype.buildDataTables = function buildDataTables() {
		var table, tableFixed, tbody, tbodyFixed, tr, trFixed, td, tdDiv, i, j;

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
					td.classList.add(this.columns[j].field);
					td.storkGridProps = { // our custom object on the DOM object
						column: this.columns[j].field,
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
				}

				tbodyFixed.appendChild(trFixed);
				tbody.appendChild(tr);
			}

			tableFixed.appendChild(tbodyFixed);

			table.appendChild(tbody);
		}
	};

	/**
	 * repositions the two data tables and then updates the data in them
	 * @param [currScrollDirection]
	 * @param [currScrollTop]
	 * @param [forceUpdateViewData] - forces updating dom elements even if scroll hasn't passed to the next data block
	 */
	StorkGrid.prototype.repositionTables = function repositionTables(currScrollDirection, currScrollTop, forceUpdateViewData) {
		var topTableIndex, topTable, topTableFixed, bottomTableIndex, bottomTable, bottomTableFixed;
		currScrollTop = currScrollTop || this.scrollY;
		currScrollDirection = currScrollDirection || 'down';
		forceUpdateViewData = forceUpdateViewData || false;
		var currDataBlock = 0;
		if(this.dataTableHeight > 0) {
			currDataBlock = Math.floor(currScrollTop / this.dataTableHeight); // top data-block that is still in the viewable area
		}

		topTableIndex = currDataBlock % 2;
		topTable = this.dataTables[topTableIndex].table;
		topTableFixed = this.dataTables[topTableIndex].tableFixed;
		bottomTableIndex = (currDataBlock + 1) % 2;
		bottomTable = this.dataTables[bottomTableIndex].table;
		bottomTableFixed = this.dataTables[bottomTableIndex].tableFixed;

		var self = this;
		var changeTranslateOfTables = function changeTranslateOfTables() {
			changeTranslate(topTable, 'Y', currDataBlock * self.dataTableHeight);
			changeTranslate(topTableFixed, 'Y', currDataBlock * self.dataTableHeight);

			changeTranslate(bottomTable, 'Y', (currDataBlock + 1) * self.dataTableHeight);
			changeTranslate(bottomTableFixed, 'Y', (currDataBlock + 1) * self.dataTableHeight);
		};

		if(currScrollDirection === 'down') {
			changeTranslateOfTables();

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
			changeTranslateOfTables();

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
	StorkGrid.prototype.onDataScroll = function onDataScroll(e) {
		var currScrollTop = e.target.scrollTop;
		// trigger only when scroll vertically
		if(currScrollTop !== this.lastScrollTop) {
			this.onScrollY(currScrollTop); // vertical
		}
		else {
			if(currScrollTop === 0 && this.lastScrollTop === 0/*fixes a bug for infinite scroll up*/) {
				this.onScrollY(currScrollTop); // vertical
			}

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
	StorkGrid.prototype.onScrollY = function onScrollY(currScrollTop) {
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
	StorkGrid.prototype.onScrollX = function onScrollX(currScrollLeft) {
		//scroll the header (even though the overflow-x is hidden) so it will behave exactly like the data tables
		this.headerTable.container.scrollLeft = currScrollLeft;

		if(this.totalDataWidthFixed < this.dataViewWidth) { //move object with the scroll so they will look fixed
			changeTranslate(this.dataTables[0].tableFixed, 'X', currScrollLeft);
			changeTranslate(this.dataTables[1].tableFixed, 'X', currScrollLeft);
			changeTranslate(this.headerTable.fixed, 'X', currScrollLeft);
			changeTranslate(this.headerTable.resizer_fixed, 'X', currScrollLeft); //element might not exist

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
		}
		else {
			//fixed-columns are too wide, so in order not to fuck up the grid (not to stuck the user with columns too wide he can't shrink)
			//this fixed columns will act as loose columns and move away when the user scrolls
			changeTranslate(this.dataTables[0].tableFixed, 'X', 0);
			changeTranslate(this.dataTables[1].tableFixed, 'X', 0);
			changeTranslate(this.headerTable.fixed, 'X', 0);
			changeTranslate(this.headerTable.resizer_fixed, 'X', 0); //element might not exist

			if(this.headerTable.fixed.classList.contains('covering')) {
				this.dataTables[0].tableFixed.classList.remove('covering');
				this.dataTables[1].tableFixed.classList.remove('covering');
				this.headerTable.fixed.classList.remove('covering');
			}

			this.lastScrollLeft = -1;
		}
	};

	/**
	 * when mouse-clicking a row or cell (different from select and drag)
	 * @param e
	 */
	StorkGrid.prototype.onDataClick = function onDataClick(e) {
		var TD = e.target,
			i = 0,
			dataIndex, TR, selectedCellColumn, trackByData;

		while(TD.tagName.toUpperCase() !== 'TD') {
			if(i++ >= 2) {
				return; // user clicked on something that is too far from our table-cell
			}
			TD = TD.parentNode;
		}

		TR = TD.parentNode;

		dataIndex = parseInt(TR.storkGridProps.dataIndex, 10);
		selectedCellColumn = TD.storkGridProps.column;

		if(dataIndex >= 0 && dataIndex < this.data.length && dataIndex <= Number.MAX_SAFE_INTEGER/*ES6*/) {
			trackByData = this._getTrackByData(dataIndex);
			this._dispatchSelectEvent('data-click', dataIndex, selectedCellColumn, trackByData);
		}
	};

	/**
	 * the onclick handler when clicking on the data viewport
	 * @param e
	 */
	var lastClickTime = 0;
	var lastClickElm = null;
	StorkGrid.prototype.onDataSelect = function onDataSelect(e) {
		if(e.button !== 0) {
			return; // do nothing if the click wasn't with the main mouse button
		}

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

		if(dataIndex >= 0 && dataIndex < this.data.length && dataIndex <= Number.MAX_SAFE_INTEGER/*ES6*/) {
			trackByData = this._getTrackByData(dataIndex);

			// should emit a double-click-select?
			var now = Date.now();
			var clickedElm;
			if(this.selection.type === 'cell') {
				clickedElm = TD;
			} else {
				clickedElm = TR;
			}

			if(now - lastClickTime > 300 || clickedElm !== lastClickElm) {
				/** NEW and better way of handling data connection */
				if(this.selection.type === 'row' && this.selection.multi === true) {
					this.selectedItems.clear(); // clear all previous in order to start a whole new selection range

					if(this.clickedItem && this.clickedItem.dataIndex === dataIndex) { // only way to deselect
						this.clickedItem = null;
						this.hoveredRowElm = null;
					}
					else {
						this.selectedItems.set(trackByData, [selectedCellColumn]); // add current row to selection range
						this.clickedItem = { dataIndex: dataIndex, data: this.data[dataIndex], column: selectedCellColumn }; // save currently clicked row
						this.hoveredRowElm = TR;

						var self = this;
						var eventIndexes = { mouse_move: null, mouse_up: null };
						eventIndexes.mouse_move = this._addEventListener(this.dataWrapperElm, 'mousemove', this.onDataSelectMove.bind(this), false);
						eventIndexes.mouse_up = this._addEventListener(document, 'mouseup', function() {
							self._removeEventListener(eventIndexes.mouse_move);
							self._removeEventListener(eventIndexes.mouse_up);
						}, false);
					}

					this.renderSelectOnRows();
				}
				/** OLD way for handling data selection */
				else {
					// when not on multi select clear previous selection, unless re-selecting the same row
					// which we should let the next code unselect it
					if(!this.selection.multi && !this.selectedItems.has(trackByData)) {
						this.selectedItems.clear();
					}

					if(this.selectedItems.has(trackByData)) {
						if(this.selection.type === 'row') { // whole rows
							this.selectedItems.delete(trackByData); // unselect row
							this.clickedItem = null;
						}
						else { // individual cells
							selectedItem = this.selectedItems.get(trackByData);

							var indexOfColumn = selectedItem.indexOf(selectedCellColumn);
							if(indexOfColumn === -1) { // clicked on a cell not chosen before in this row
								selectedItem.push(selectedCellColumn);
								this.clickedItem = { dataIndex: dataIndex, column: selectedCellColumn };
							}
							else { // clicked on an already selected cell so let's remove it
								selectedItem.splice(indexOfColumn, 1); // unselect cell

								if(selectedItem.length === 0) {
									this.selectedItems.delete(trackByData); // unselect row
								}

								this.clickedItem = null;
							}
						}
					}
					else {
						this.selectedItems.set(trackByData, [selectedCellColumn]);
						this.clickedItem = { dataIndex: dataIndex, data: this.data[dataIndex], column: selectedCellColumn };
					}

					this.renderSelectOnRows();
				}
			}
			else { // it's a double click
				eventName = 'dblselect';
			}

			lastClickTime = now;

			if(this.selection.type === 'cell') {
				lastClickElm = TD;
			} else {
				lastClickElm = TR;
			}

			this._dispatchSelectEvent(eventName, dataIndex, selectedCellColumn, trackByData);
		}
		else { // invalid selection
			this.selectedItems.clear();
			console.warn('selected row is not pointing to a valid data');
			this.repositionTables(null, null, true);
		}
	};

	/**
	 * an event handler for mousemove when dragging the mouse for multi selecting
	 * @param e
	 */
	StorkGrid.prototype.onDataSelectMove = function onDataSelectMove(e) {
		var TD = e.target,
			i = 0,
			dataIndex, TR, trackByData;

		while (TD.tagName.toUpperCase() !== 'TD') {
			if (i++ >= 2) {
				return; // user clicked on something that is too far from our table-cell
			}
			TD = TD.parentNode;
		}

		TR = TD.parentNode;

		if(TR !== this.hoveredRowElm) { // dragged mouse from one row to a different one
			this.hoveredRowElm = TR;

			dataIndex = parseInt(TR.storkGridProps.dataIndex, 10);

			if (dataIndex >= 0 && dataIndex < this.data.length && dataIndex <= Number.MAX_SAFE_INTEGER/*ES6*/) {
				this.selectedItems.clear(); // clear all previous in order to start a whole new selection range

				var smallIndex = Math.min(dataIndex, this.clickedItem.dataIndex);
				var bigIndex = Math.max(dataIndex, this.clickedItem.dataIndex);

				for(i = smallIndex; i <= bigIndex; i++) {
					if (this.trackBy) { // tracking by a specific column data
						trackByData = this.data[i][this.trackBy];
					} else { // tracking by the whole row's data object
						trackByData = this.data[i];
					}

					this.selectedItems.set(trackByData, [this.clickedItem.column]); // add row to selection range
				}

				this.renderSelectOnRows();
			}
		}
	};

	/**
	 * preventing native on-wheel scroll because chrome's smooth scrolling makes the fixed columns render real ugly
	 * @param event
	 */
	StorkGrid.prototype.onDataWheelScroll = function onDataWheelScroll(event) {
		if(event.deltaX !== 0) {
			event.preventDefault();

			var deltaX = Math.min(40, event.deltaX);
			deltaX = Math.max(-40, event.deltaX); //limit deltaX between 40 to -40

			this.scrollX += deltaX;
		}
	};

	/**
	 * preventing native on-key scroll (left & right) because chrome's smooth scrolling makes the fixed columns render real ugly
	 * @param event
	 */
	StorkGrid.prototype.onDataKeyboardNavigate = function onDataKeyboardNavigate(event) {
		var key = keyboardMap[event.keyCode];

		if(key === 'LEFT' || key === 'RIGHT') {
			event.preventDefault();

			this.scrollX += key === 'LEFT' ? -40 : 40;
		}
	};

	StorkGrid.prototype._getTrackByData = function _getTrackByData(dataIndex) {
		if (this.trackBy) { // tracking by a specific column data or by the whole row's data object
			if(typeof this.data[dataIndex][this.trackBy] !== 'undefined' && this.data[dataIndex][this.trackBy] !== null) {
				return this.data[dataIndex][this.trackBy];
			}

			console.warn('Invalid track-by (' + this.trackBy + ') for data row (index: ' + dataIndex + '):', this.data[dataIndex]);
		}

		return this.data[dataIndex];
	};

	/**
	 * in charge of logic for adding and removing the "selected" and "clicked" classes
	 * @param dataIndex
	 * @param rowObj
	 * @private
	 */
	StorkGrid.prototype._toggleSelectedClasses = function _toggleSelectedClasses(dataIndex, rowObj) {
		var trackByData = this._getTrackByData(dataIndex),
			selectedItem, dataKeyName, tdDiv, i;

		if(this.selectedItems.has(trackByData)) {
			rowObj.row.classList.add('selected');
			rowObj.rowFixed.classList.add('selected');
			rowObj.row.storkGridProps.selected = true; // update the storkGridProps which is a reference between fixed and loose rows

			// add 'clicked' class to single clicked row
			if(this.clickedItem && this.clickedItem.dataIndex === dataIndex) {
				rowObj.row.classList.add('clicked');
				rowObj.rowFixed.classList.add('clicked');
			}
			else { // if had several selected items (via trackBy) and clicked on different ones between them
				rowObj.row.classList.remove('clicked');
				rowObj.rowFixed.classList.remove('clicked');
			}
		}
		else if(rowObj.row.storkGridProps.selected) { // only remove class to previously selected rows
			rowObj.row.classList.remove('selected');
			rowObj.rowFixed.classList.remove('selected');
			rowObj.row.storkGridProps.selected = false;

			// remove 'clicked' class from clicked row
			if(!this.clickedItem || this.clickedItem.dataIndex !== dataIndex) {
				rowObj.row.classList.remove('clicked');
				rowObj.rowFixed.classList.remove('clicked');
			}
		}

		selectedItem = this.selectedItems.has(trackByData) ? this.selectedItems.get(trackByData) : null; // the selected cells of the selected row

		for (i = 0; i < this.columns.length; i++) {
			dataKeyName = this.columns[i].field;
			tdDiv = rowObj.tds[i].firstChild;

			// select the TD if needed
			if (selectedItem && this.selection.type === 'cell' && selectedItem.indexOf(dataKeyName) > -1) { // if this row is selected, and if this column is selected too
				rowObj.tds[i].classList.add('selected');
				rowObj.tds[i].storkGridProps.selected = true;
			}
			else if (rowObj.tds[i].storkGridProps.selected) {
				rowObj.tds[i].classList.remove('selected');
				rowObj.tds[i].storkGridProps.selected = false;
			}
		}
	};

	/**
	 * adds/removes the 'select' class from the rows in the view (without rebuilding the DOM)
	 */
	StorkGrid.prototype.renderSelectOnRows = function renderSelectOnRows() {
		var i, j, dataIndex;

		for(i=0; i < this.dataTables.length; i++) {
			for(j=0; j < this.dataTables[i].rows.length; j++) {
				dataIndex = this.dataTables[i].rows[j].row.storkGridProps.dataIndex;

				if(dataIndex >= this.data.length) {
					continue; // when scrolled to the end of the grid and this iteration goes over empty TRs
				}

				this._toggleSelectedClasses(dataIndex, this.dataTables[i].rows[j]);
			}
		}
	};

	/**
	 * handle on-copy for custom copying
	 * @param e
	 */
	StorkGrid.prototype.onCopy = function onCopy(e) {
		if(this.grid.classList.contains('focused')) {
			if(this.selectedItems.size > 0) { // we should copy the selected data to the clipboard
				var text = '',
					html = '<table><tbody>',
					i, j, trackByData, cellText;

				for(i=0; i < this.data.length; i++) {
					if (this.trackBy) { // tracking by a specific column data or by the whole row's data object
						trackByData = this.data[i][this.trackBy];
					} else {
						trackByData = this.data[i];
					}

					if(this.selectedItems.has(trackByData)) {
						html += '<tr>';
						for(j=0; j < this.columns.length; j++) {
							cellText = this.data[i][ this.columns[j].field ] || '';
							text += cellText + ' ';
							html += '<td>' + cellText + '</td>';
						}
						text = text.slice(0, -1) + "\n"; // trim last space and add line-break
						html += '</tr>';
					}
				}

				text = text.slice(0, -1); // trim last line-break
				html += '</tbody></table>';

				e.clipboardData.setData('text/plain', text);
				e.clipboardData.setData('text/html', html);
				e.preventDefault();
			}
		}
	};

	/**
	 * handler for when clicking a column header to sort it
	 * @param e
	 */
	StorkGrid.prototype.onHeaderClick = function onHeaderClick(e) {
		var TH = e.target,
			i = 0;

		while(TH.tagName.toUpperCase() !== 'TH') {
			if(i++ >= 2) {
				return; // user clicked on something that is too far from our table-cell
			}
			TH = TH.parentNode;
		}

		var evnt = new CustomEvent('column-click', {
			bubbles: true,
			cancelable: true,
			detail: {
				column: TH.storkGridProps.column
			}
		});
		this.grid.dispatchEvent(evnt);
	};

	/**
	 * updates the data inside one of the tables according to the given data-block-index
	 * @param tableIndex
	 * @param dataBlockIndex
	 */
	StorkGrid.prototype.updateViewData = function updateViewData(tableIndex, dataBlockIndex) {
		var tableObj, firstBlockRow, lastBlockRow, row, rowObj,
			dataKeyName, dataIndex, i, tdDiv, dataValue;

		tableObj = this.dataTables[tableIndex];

		firstBlockRow = dataBlockIndex * this.numDataRowsInTable;
		lastBlockRow = (dataBlockIndex + 1) * this.numDataRowsInTable - 1;
		row = 0;

		for(dataIndex = firstBlockRow; dataIndex <= lastBlockRow; dataIndex++, row++) {
			rowObj = tableObj.rows[row];
			rowObj.row.storkGridProps.dataIndex = dataIndex;

			if(this.data[ dataIndex ]) {
				// select the TR if needed
				this._toggleSelectedClasses(dataIndex, rowObj);

				for (i = 0; i < this.columns.length; i++) {
					dataKeyName = this.columns[i].field;
					dataValue = this.data[dataIndex][dataKeyName];
					tdDiv = rowObj.tds[i].firstChild;

					if(this.columns[i].render) { // user's custom renderer
						this.columns[i].render(tdDiv, dataValue, dataIndex, this.data[dataIndex]);
					}
					else { // default rendering of data
						this.defaultRender(tdDiv, dataValue);
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
		}

		tableObj.dataBlockIndex = dataBlockIndex;
	};

	/**
	 * the default rendering function of values in cells
	 * @param tdDiv
	 * @param dataValue
	 */
	StorkGrid.prototype.defaultRender = function defaultRender(tdDiv, dataValue) {
		//validate data value
		if(typeof dataValue !== 'string' && typeof dataValue !== 'number') {
			dataValue = '';
		}

		if(!tdDiv.firstChild) {
			tdDiv.appendChild(document.createTextNode(dataValue)); // add text-node at the first data render
		}
		else if (tdDiv.firstChild) {
			tdDiv.firstChild.nodeValue = dataValue; // render content
		}
	};

	/**
	 * add dragable elements to resize the columns + emit events
	 */
	StorkGrid.prototype.makeColumnsResizable = function makeColumnsResizable() {
		var colResizers = document.getElementById('grid'+this.rnd+'_columnResizers');
		var colResizersFixed = document.getElementById('grid'+this.rnd+'_columnResizers_fixed');
		var resizer, i, tbody, tr, trFixed, td, div;

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

			tbody = document.createElement('tbody');
			tr = document.createElement('tr');

			tbody.appendChild(tr);
			colResizers.appendChild(tbody);
			this.headerTable.container.insertBefore(colResizers, this.headerTable.container.firstChild);

			tbody = document.createElement('tbody');
			trFixed = document.createElement('tr');

			tbody.appendChild(trFixed);
			colResizersFixed.appendChild(tbody);
			this.headerTable.container.insertBefore(colResizersFixed, this.headerTable.container.firstChild);

			// the vertical line for when resizing
			div = document.createElement('div');
			div.classList.add('resizer-line');
			this.grid.appendChild(div);
			this.resizerLine = div;
		}
		else {
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
			td = document.createElement('td');
			td.classList.add(this.columns[i].field);

			resizer = document.createElement('a');
			resizer.setAttribute('draggable', 'true');
			resizer.storkGridProps = {
				dragStartX: 0,
				columnIndex: i
			};

			this.setResizeByDragging(resizer);

			td.appendChild(resizer);
			if(this.columns[i].fixed) {
				trFixed.appendChild(td);
			}
			else {
				tr.appendChild(td);
			}
		}
	};

	/**
	 * sets the dragging events for the resizing element
	 * @param {HTMLElement} elm
	 */
	StorkGrid.prototype.setResizeByDragging = function setResizeByDragging(elm) {
		var self = this;

		this._addEventListener(elm, 'dragstart', function(e) {
			e.preventDefault();
			return false;
		});

		this._addEventListener(elm, 'mousedown', function(e) {
			if(e.button !== 0) {
				return; // do nothing if the click wasn't with the main mouse button
			}

			// unselect previous element/text selections - this solves a UI bug where phantom elements are dragged with us
			if ( document.selection ) {
				document.selection.empty();
			} else if ( window.getSelection ) {
				window.getSelection().removeAllRanges();
			}

			self.startDragging(elm.storkGridProps.columnIndex, e.pageX);
		});
	};

	/**
	 * start the dragging function - mousemove and mouse up while setting the right styles
	 * @param columnIndex
	 * @param mouseStartingPosX
	 */
	StorkGrid.prototype.startDragging = function startDragging(columnIndex, mouseStartingPosX) {
		var self = this;
		var columnObj = self.columns[columnIndex];
		var eventIndexes = { mouse_move: null, mouse_up: null };

		this.calculateColumnHeaderContentWidth(columnObj);

		self.resizerLine.style.left = (mouseStartingPosX - self.dataElm.getCoordinates().x) + 'px';
		self.resizerLine.style.display = 'block';

		self.grid.classList.add('resizing-column');

		/** on mouse move */
		eventIndexes.mouse_move = self._addEventListener(document, 'mousemove', function(e) {
			if(e.pageX !== 0) { // fixes annoying bug when ending drag
				var delta = e.pageX - mouseStartingPosX;
				var newColumnWidth = columnObj._width + delta;
				var minWidth = Math.max(columnObj._minWidth, columnObj.contentWidth, self.minColumnWidth);

				if(newColumnWidth < minWidth) {
					delta = minWidth - columnObj._width;
				}

				changeTranslate(self.resizerLine, 'X', delta);
			}
		});

		/** on mouse up */
		eventIndexes.mouse_up = self._addEventListener(document, 'mouseup', function(e) {
			self.grid.classList.remove('resizing-column');
			self.resizerLine.style.display = '';
			self.resizerLine.style.transform = '';

			var delta = e.pageX - mouseStartingPosX;
			//very important - since the user is the one that changed the width, it should be permanent, thus saved on the public 'width' property
			columnObj.width = Math.max(columnObj._width + delta, columnObj._minWidth, columnObj.contentWidth, self.minColumnWidth);

			self.calculateColumnsWidths();
			self.makeCssRules();

			var evnt = new CustomEvent('resize-column', {
				bubbles: true,
				cancelable: true,
				detail: {
					columnIndex: columnIndex,
					columnField: columnObj.field,
					width: columnObj._width
				}
			});
			self.grid.dispatchEvent(evnt);

			/** remove mouse listeners */
			self._removeEventListener(eventIndexes.mouse_move);
			self._removeEventListener(eventIndexes.mouse_up);
		});
	};

	/**
	 * calculate the width required for the TD to show its entire text content
	 * @param columnObj - the column metadata object (not the html-element)
	 */
	StorkGrid.prototype.calculateColumnHeaderContentWidth = function calculateColumnHeaderContentWidth(columnObj) {
		var elm = this.headerTable.container.querySelector('th.' + columnObj.field);
		var contentWidth = elm.firstChild ? Math.ceil(elm.firstChild.offsetWidth) : 0;
		var thStyle = elm.currentStyle || window.getComputedStyle(elm);
		var paddingLeft = parseInt(thStyle.paddingLeft);
		var paddingRight = parseInt(thStyle.paddingRight);
		var borderLeft = parseInt(thStyle.borderLeftWidth);
		var borderRight = parseInt(thStyle.borderRightWidth);

		columnObj.contentWidth = borderLeft + paddingLeft + contentWidth + paddingRight + borderRight;
	};

	/**
	 * a method for completely calculating and rebuilding new tables when the grid's main element has changed size
	 */
	StorkGrid.prototype.resize = function resize() {
		this.resizeCalculate();
		this.buildDataTables();
		this.calculateColumnsWidths();
		this.makeCssRules();
		this.repositionTables(null, null, true);
	};

	/**
	 * sets a new data object and then refreshes the grid
	 */
	StorkGrid.prototype.setData = function setData(data) {
		this.data = data;
		if(this.columns.length === 0) {
			this.initColumnsObject();
			this.setColumns(this.columns);
		} else {
			this.refresh();
		}
	};

	/**
	 * refreshes the data height and viewport.
	 * use this when grid.data has changed
	 */
	StorkGrid.prototype.refresh = function refresh_data() {
		this.calculateDataHeight();
		this._updateClickedItemIndex();
		this.repositionTables(null, null, true);
	};

	/**
	 * in-charge of updating the selectedItem index when it was changed (happens after data refresh. btw sorting causes data refresh)
	 * @private
	 */
	StorkGrid.prototype._updateClickedItemIndex = function _updateClickedItemIndex() {
		if(this.clickedItem && this.clickedItem.data) {
			var itemIndex = this.data.indexOf(this.clickedItem.data);
			if(itemIndex >= 0) {
				this.clickedItem.dataIndex = itemIndex;
			} else {
				this.clickedItem = null;
			}
		}
	};

	/**
	 * completely destroy the grid - its DOM elements, methods and data
	 */
	StorkGrid.prototype.destroy = function destroy() {
		var rows = this.grid.querySelectorAll('tr');
		var cells = this.grid.querySelectorAll('th, td');
		var i, j, k;

		// remove event listeners
		this._emptyEventListeners();

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
		delete this.columnClasses;
		delete this.minColumnWidth;
		delete this.resizableColumns;
		delete this.trackBy;
		delete this.selection;
		delete this.onload;

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
		delete this.eventListeners;
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
		delete this.dataViewWidth;
		delete this.dataTableHeight;
		delete this.numDataRowsInTable;
	};

	/**
	 * set a new columns for the grid. can be used to re-arrange the columns or set some as fixed etc..
	 * @param {Array} columns - a columns array holding objects with the following properties: field, label, [width], [minWidth], [fixed]
	 */
	StorkGrid.prototype.setColumns = function setColumns(columns) {
		this.columns = columns;
		this.initColumnsObject();
		this.makeHeaderTable();
		this.initDataView();
		this.updateViewData(0, 0);
		this.updateViewData(1, 1);
		if(this.resizableColumns) {
			this.makeColumnsResizable();
		}
		this.calculateColumnsWidths();
		this.makeCssRules();
		this.repositionTables(null, null, true);

		//re-add user's custom column classes
		var keyField, keyClass;
		for(keyField in this.columnClasses) {
			if(this.columnClasses.hasOwnProperty(keyField)) {
				for(keyClass in this.columnClasses[keyField]) {
					if(this.columnClasses[keyField].hasOwnProperty(keyClass)) {
						this.addColumnClass(keyField, keyClass, this.columnClasses[keyField][keyClass]);
					}
				}
			}
		}
	};

	/**
	 * check if user is focused on the grid or not
	 * @param e
	 */
	StorkGrid.prototype._onClickCheckFocus = function _onClickCheckFocus(e) {
		var target = e.target;

		while(!(target instanceof HTMLDocument) && target !== this.grid) {
			target = target.parentNode;

			if(target && target instanceof HTMLDocument) { // our loop reached 'document' element, meaning user clicked outside of the component
				this.grid.classList.remove('focused');
				return;
			}
		}

		this.grid.classList.add('focused');
	};

	/**
	 * change selected item when an item on the grid is selected and the user presses up/down arrows
	 * (selects the bottom or top item)
	 * @param e
	 */
	StorkGrid.prototype._onKeyboardNavigate = function _onKeyboardNavigate(e) {
		var key = keyboardMap[e.keyCode];

		if(this.clickedItem && (key === 'DOWN' || key === 'UP')) {
			if(key === 'DOWN' && this.clickedItem.dataIndex < this.data.length - 1) {
				this.clickedItem.dataIndex++;
			} else if(key === 'UP' && this.clickedItem.dataIndex > 0) {
				this.clickedItem.dataIndex--;
			} else {
				return; // about to navigate out of bounds so abort
			}

			e.preventDefault(); // stops document scrolling

			var trackByData = this._getTrackByData(this.clickedItem.dataIndex);

			this.selectedItems.clear();
			this.selectedItems.set(trackByData, [this.clickedItem.column]);

			var clickedItemY = this.clickedItem.dataIndex * this.rowHeight;
			if(clickedItemY < this.scrollY) { // navigate above our view
				this.scrollY = clickedItemY;
				this.onScrollY(clickedItemY);
			}
			else if(clickedItemY > this.scrollY + this.dataViewHeight - this.rowHeight) { // navigate below our view
				this.scrollY = clickedItemY - this.dataViewHeight + this.rowHeight;
				this.onScrollY(clickedItemY - this.dataViewHeight + this.rowHeight);
			}

			this.renderSelectOnRows();

			this._dispatchSelectEvent('select', this.clickedItem.dataIndex, this.clickedItem.column, trackByData);
		}
	};

	root.StorkGrid = StorkGrid;
})(window); // main scope we are running at (if 'this' is passed then we will be compatible with node 'module.reports' style)