(function(root) {
  "use strict";
  var capitalizeWords = function capitalizeWords(str) {
    return str.replace(/\w\S*/g, function(txt) {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
  };
  var changeTranslate = function changeTranslate(elm, direction, amount) {
    if (!elm.storkGridProps) {
      elm.storkGridProps = {};
    }
    if (!elm.storkGridProps.translateX) {
      elm.storkGridProps.translateX = 0;
    }
    if (!elm.storkGridProps.translateY) {
      elm.storkGridProps.translateY = 0;
    }
    if (direction.toUpperCase() === "X") {
      elm.storkGridProps.translateX = amount;
      elm.style.transform = "translate(" + amount + "px," + elm.storkGridProps.translateY + "px)";
    } else if (direction.toUpperCase() === "Y") {
      elm.storkGridProps.translateY = amount;
      elm.style.transform = "translate(" + elm.storkGridProps.translateX + "px," + amount + "px)";
    }
  };
  var StorkGrid = function StorkGrid(options) {
    this.initProperties(options);
    this.initColumnsObject();
    this.grid.classList.add("stork-grid", "stork-grid" + this.rnd);
    this.grid.setAttribute("tabindex", 0);
    this.makeHeaderTable();
    this.initDataView();
    this.updateViewData(0, 0);
    this.updateViewData(1, 1);
    if (this.resizableColumns) {
      this.makeColumnsResizable();
    }
    this.calculateColumnsWidths();
    this.makeCssRules();
    this._addEventListener(this.headerTable.container, "click", this.onHeaderClick.bind(this), false);
    this._addEventListener(this.dataWrapperElm, "click", this.onDataClick.bind(this), false);
    this._addEventListener(this.dataWrapperElm, "mousedown", this.onDataSelect.bind(this), false);
    this._addEventListener(this.grid, "keydown", this._onKeyboardNavigate.bind(this), false);
    this._addEventListener(this.dataWrapperElm, "scroll", this.onDataScroll.bind(this), false);
    this._addEventListener(document, "click", this._onClickCheckFocus.bind(this), true);
    this._addEventListener(document, "copy", this.onCopy.bind(this), true);
    var evnt = new CustomEvent("grid-loaded", {
      bubbles: true,
      cancelable: true,
      detail: {
        gridObj: this
      }
    });
    if (this.onload) {
      this.onload(evnt);
    }
    this.grid.dispatchEvent(evnt);
  };
  StorkGrid.prototype.initProperties = function initProperties(options) {
    this.grid = options.element;
    this.data = options.data || [];
    this.rowHeight = options.rowHeight || 32;
    this.headerHeight = options.headerHeight || this.rowHeight;
    this.columns = options.columns || [];
    this.minColumnWidth = options.minColumnWidth || 50;
    this.resizableColumns = options.resizableColumns !== false;
    this.trackBy = options.trackBy || null;
    this.onload = options.onload || null;
    this.selection = {};
    options.selection = options.selection || {};
    this.selection.multi = options.selection.multi || false;
    this.selection.type = options.selection.type === "cell" ? "cell" : "row";
    this.rnd = (Math.floor(Math.random() * 9) + 1) * 1e3 + Date.now() % 1e3;
    this.tableExtraSize = .4;
    this.tableExtraPixelsForThreshold = 0;
    this.rowBorders = {
      header: 0,
      data: 0
    };
    this.headerTable = {
      container: null,
      loose: null,
      fixed: null,
      resizer_loose: null,
      resizer_fixed: null,
      ths: []
    };
    this.dataTables = [];
    this.dataWrapperElm = null;
    this.dataElm = null;
    this.selectedItems = new Map();
    this.clickedItem = null;
    this.hoveredRowElm = null;
    this.customScrollEvents = [];
    this.eventListeners = [];
    this.resizerLine = null;
    this.scrollY = 0;
    this.scrollX = 0;
    this.maxScrollY = 0;
    this.lastScrollTop = 0;
    this.lastScrollDirection = "static";
    this.lastScrollLeft = 0;
    this.lastThreshold = 0;
    this.nextThreshold = 0;
    this.totalDataWidthFixed = 0;
    this.totalDataWidthLoose = 0;
    this.totalDataHeight = 0;
    this.dataViewHeight = 0;
    this.dataTableHeight = 0;
    this.numDataRowsInTable = 0;
  };
  StorkGrid.prototype.initColumnsObject = function initColumnsObject() {
    if (this.columns.length === 0 && this.data.length > 0) {
      var columnName;
      for (var key in this.data[0]) {
        if (this.data[0].hasOwnProperty(key)) {
          columnName = key.replace(/[-_]/, " ");
          columnName = capitalizeWords(columnName);
          this.columns.push({
            field: key,
            label: columnName,
            width: 0,
            minWidth: 0,
            fixed: false,
            render: null
          });
        }
      }
    } else {
      var fixedColumns = [], looseColumns = [], i;
      for (i = 0; i < this.columns.length; i++) {
        if (this.columns[i].fixed) {
          fixedColumns.push(this.columns[i]);
        } else {
          looseColumns.push(this.columns[i]);
        }
      }
      this.columns = fixedColumns.concat(looseColumns);
    }
  };
  StorkGrid.prototype._addEventListener = function customAddEventListener(element, type, listener, options_or_useCapture, isUserDefined) {
    isUserDefined = isUserDefined || false;
    element.addEventListener(type, listener, options_or_useCapture);
    this.eventListeners.push({
      element: element,
      type: type,
      listener: listener,
      options: options_or_useCapture,
      isUserDefined: isUserDefined
    });
    return this.eventListeners.length - 1;
  };
  StorkGrid.prototype._removeEventListener = function customRemoveEventListener(index) {
    var currEL = this.eventListeners[index];
    if (currEL) {
      currEL.element.removeEventListener(currEL.type, currEL.listener, currEL.options);
    }
    this.eventListeners[index] = null;
  };
  StorkGrid.prototype._emptyEventListeners = function emptyEventListeners() {
    var currEL;
    for (var i = 0; i < this.eventListeners.length; i++) {
      currEL = this.eventListeners[i];
      if (currEL) {
        this._removeEventListener(i);
      }
    }
  };
  StorkGrid.prototype.addEventListener = function customAddEventListener(type, listener, options_or_useCapture) {
    this._addEventListener(this.grid, type, listener, options_or_useCapture, true);
  };
  StorkGrid.prototype.removeEventListener = function customRemoveEventListener(type, listener, options_or_useCapture) {
    this.grid.removeEventListener(type, listener, options_or_useCapture);
    for (var i = 0; i < this.eventListeners.length; i++) {
      if (this.eventListeners[i].element === this.grid && this.eventListeners[i].type === type && this.eventListeners[i].listener === listener) {
        this.eventListeners[i] = null;
      }
    }
  };
  StorkGrid.prototype._dispatchSelectEvent = function _dispatchSelectEvent(type, dataIndex, column, trackByData) {
    if (type !== "dblselect" && type !== "data-click") {
      type = "select";
    }
    var evnt = new CustomEvent(type, {
      bubbles: true,
      cancelable: true,
      detail: {
        dataIndex: dataIndex,
        rowData: this.data[dataIndex],
        column: column,
        isSelect: this.selectedItems.has(trackByData)
      }
    });
    this.grid.dispatchEvent(evnt);
  };
  StorkGrid.prototype.addScrollEvent = function addScrollEvent(type, amount, fromBottom) {
    fromBottom = fromBottom !== false;
    this.customScrollEvents.push({
      type: type,
      amount: amount,
      fromBottom: fromBottom
    });
  };
  StorkGrid.prototype.calculateColumnsWidths = function calculateColumnsWidths() {
    this.totalDataWidthLoose = 0;
    this.totalDataWidthFixed = 0;
    var userDefinedWidth = 0, numColumnsNotDefined = 0, i, availableWidth, availableWidthPerColumn, roundedPixels;
    for (i = 0; i < this.columns.length; i++) {
      this.calculateColumnHeaderContentWidth(this.columns[i]);
      this.columns[i].width = this.columns[i].width || 0;
      this.columns[i].minWidth = this.columns[i].minWidth || 0;
      if (this.columns[i].width) {
        this.columns[i].width = Math.max(this.columns[i].width, this.columns[i].minWidth, this.columns[i].contentWidth, this.minColumnWidth);
        userDefinedWidth += this.columns[i].width;
      } else {
        numColumnsNotDefined++;
      }
    }
    availableWidth = this.dataWrapperElm.clientWidth - userDefinedWidth;
    availableWidthPerColumn = 0;
    if (numColumnsNotDefined > 0) {
      availableWidthPerColumn = Math.floor(availableWidth / numColumnsNotDefined);
    }
    roundedPixels = availableWidth % numColumnsNotDefined;
    for (i = 0; i < this.columns.length; i++) {
      if (!this.columns[i].width) {
        this.columns[i].width = Math.max(this.columns[i].minWidth, this.minColumnWidth, availableWidthPerColumn);
        if (roundedPixels && this.columns[i].width === availableWidthPerColumn) {
          this.columns[i].width += roundedPixels;
          roundedPixels = 0;
        }
      }
      if (this.columns[i].fixed) {
        this.totalDataWidthFixed += this.columns[i].width;
      } else {
        this.totalDataWidthLoose += this.columns[i].width;
      }
    }
  };
  StorkGrid.prototype.makeCssRules = function makeCssRules() {
    var style = document.getElementById("grid" + this.rnd + "_style");
    if (!style) {
      style = document.createElement("style");
      style.id = "grid" + this.rnd + "_style";
      style.type = "text/css";
      document.getElementsByTagName("head")[0].appendChild(style);
    }
    var headerStyle = this.headerTable.container.currentStyle || window.getComputedStyle(this.headerTable.container);
    this.rowBorders.header = parseInt(headerStyle.borderTopWidth, 10) + parseInt(headerStyle.borderBottomWidth, 10);
    if (this.dataTables[0].rows[0].tds.length > 0) {
      var cellStyle = this.dataTables[0].rows[0].tds[0].currentStyle || window.getComputedStyle(this.dataTables[0].rows[0].tds[0]);
      this.rowBorders.data = parseInt(cellStyle.borderTopWidth, 10) + parseInt(cellStyle.borderBottomWidth, 10);
    }
    var headerScrollbarWidth = this.headerTable.container.offsetWidth - this.headerTable.container.clientWidth;
    if (!headerScrollbarWidth || headerScrollbarWidth < 0) {
      headerScrollbarWidth = 15;
    }
    var html = ".stork-grid" + this.rnd + " div.header-wrapper { height: " + this.headerHeight + "px; }";
    html += ".stork-grid" + this.rnd + " div.header > table th," + ".stork-grid" + this.rnd + " div.header > table.resizers a { height: " + (this.headerHeight - this.rowBorders.header) + "px; }";
    html += ".stork-grid" + this.rnd + " div.header > table th > div { max-height: " + (this.headerHeight - this.rowBorders.header) + "px; }";
    html += ".stork-grid" + this.rnd + " div.header-wrapper > div.scrollbar-concealer { width: " + headerScrollbarWidth + "px; }";
    html += ".stork-grid" + this.rnd + " div.data > table td { height: " + this.rowHeight + "px; }";
    html += ".stork-grid" + this.rnd + " div.data > table td > div { max-height: " + (this.rowHeight - this.rowBorders.data) + "px; }";
    for (var i = 0; i < this.columns.length; i++) {
      html += ".stork-grid" + this.rnd + " th." + this.columns[i].field + "," + ".stork-grid" + this.rnd + " td." + this.columns[i].field + " { width: " + this.columns[i].width + "px; }";
    }
    html += ".stork-grid" + this.rnd + " div.header > table.loose," + ".stork-grid" + this.rnd + " div.data-wrapper > div.data > table.loose { width: " + this.totalDataWidthLoose + "px; }";
    html += ".stork-grid" + this.rnd + " div.header > table.fixed," + ".stork-grid" + this.rnd + " div.data-wrapper > div.data > table.fixed { width: " + this.totalDataWidthFixed + "px; }";
    html += ".stork-grid" + this.rnd + " div.data-wrapper > div.data { width: " + (this.totalDataWidthLoose + this.totalDataWidthFixed) + "px; }";
    style.innerHTML = html;
    this.headerTable.loose.style.marginLeft = this.totalDataWidthFixed + "px";
    if (this.headerTable.resizer_loose) {
      this.headerTable.resizer_loose.style.marginLeft = this.totalDataWidthFixed + "px";
    }
    this.dataTables[0].table.style.marginLeft = this.totalDataWidthFixed + "px";
    this.dataTables[1].table.style.marginLeft = this.totalDataWidthFixed + "px";
  };
  StorkGrid.prototype.setRowHeight = function setRowHeight(num) {
    this.rowHeight = num;
    this.makeCssRules();
    this.resize();
  };
  StorkGrid.prototype.setHeaderHeight = function setHeaderHeight(num) {
    this.headerHeight = num;
    this.makeCssRules();
    this.resize();
  };
  StorkGrid.prototype.makeHeaderTable = function makeHeaderTable() {
    var table = document.getElementById("grid" + this.rnd + "_headerTable");
    var tableFixed = document.getElementById("grid" + this.rnd + "_headerTable_fixed");
    var i;
    if (!table) {
      var headerWrapper = document.createElement("div");
      headerWrapper.classList.add("header-wrapper");
      var headerDiv = document.createElement("div");
      headerDiv.classList.add("header");
      this.headerTable.container = headerDiv;
      table = document.createElement("table");
      table.id = "grid" + this.rnd + "_headerTable";
      table.classList.add("loose");
      table.classList.add("columns");
      this.headerTable.loose = table;
      tableFixed = document.createElement("table");
      tableFixed.id = "grid" + this.rnd + "_headerTable_fixed";
      tableFixed.classList.add("fixed");
      tableFixed.classList.add("columns");
      this.headerTable.fixed = tableFixed;
      headerDiv.appendChild(tableFixed);
      headerDiv.appendChild(table);
      var scrollbarConcealer = document.createElement("div");
      scrollbarConcealer.classList.add("scrollbar-concealer");
      headerWrapper.appendChild(headerDiv);
      headerWrapper.appendChild(scrollbarConcealer);
      this.grid.appendChild(headerWrapper);
    } else {
      while (table.firstChild) {
        table.removeChild(table.firstChild);
      }
      while (tableFixed.firstChild) {
        tableFixed.removeChild(tableFixed.firstChild);
      }
    }
    var thead = document.createElement("thead");
    var theadFixed = document.createElement("thead");
    var tr = document.createElement("tr");
    var trFixed = document.createElement("tr");
    var th, thSpan;
    for (i = 0; i < this.columns.length; i++) {
      th = document.createElement("th");
      th.classList.add(this.columns[i].field);
      thSpan = document.createElement("span");
      thSpan.appendChild(document.createTextNode(this.columns[i].label));
      th.appendChild(thSpan);
      th.storkGridProps = {
        column: this.columns[i].field
      };
      this.headerTable.ths.push(th);
      if (this.columns[i].fixed) {
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
  var addRemoveColumnClass = function addRemoveColumnClass(operation) {
    operation = operation === "remove" ? "remove" : "add";
    return function(field, className, alsoFromDataCells) {
      alsoFromDataCells = alsoFromDataCells === true;
      var TH = this.headerTable.container.querySelector("th." + field);
      if (TH) {
        TH.classList[operation](className);
        if (alsoFromDataCells) {
          var TDs = this.dataElm.querySelectorAll("td." + field);
          for (var i = 0; i < TDs.length; i++) {
            TDs[i].classList[operation](className);
          }
        }
      } else {
        console.warn("Invalid column given to addColumnClass");
      }
    };
  };
  StorkGrid.prototype.addColumnClass = addRemoveColumnClass("add");
  StorkGrid.prototype.removeColumnClass = addRemoveColumnClass("remove");
  StorkGrid.prototype.initDataView = function initDataView() {
    if (!(this.dataWrapperElm instanceof HTMLElement)) {
      this.dataWrapperElm = document.createElement("div");
      this.dataWrapperElm.classList.add("data-wrapper");
      this.dataElm = document.createElement("div");
      this.dataElm.classList.add("data");
      this.dataElm.setAttribute("tabindex", 0);
      this.dataWrapperElm.appendChild(this.dataElm);
      this.grid.appendChild(this.dataWrapperElm);
    }
    this.dataWrapperElm.style.height = "calc(100% - " + this.headerHeight + "px)";
    this.calculateDataHeight();
    var self = this;
    Object.defineProperty(self, "scrollY", {
      configurable: true,
      enumerable: true,
      get: function() {
        return self.dataWrapperElm.scrollTop || 0;
      },
      set: function(newValue) {
        self.dataWrapperElm.scrollTop = newValue;
      }
    });
    Object.defineProperty(self, "scrollX", {
      configurable: true,
      enumerable: true,
      get: function() {
        return self.dataWrapperElm.scrollLeft || 0;
      },
      set: function(newValue) {
        self.dataWrapperElm.scrollLeft = newValue;
      }
    });
    this.resize();
  };
  StorkGrid.prototype.calculateDataHeight = function calculateDataHeight() {
    var rows = this.data ? this.data.length : 0;
    this.totalDataHeight = this.rowHeight * rows;
    if (this.totalDataHeight > 0) {
      this.dataElm.style.height = this.totalDataHeight + "px";
      this.dataElm.style.visibility = "visible";
    } else {
      this.dataElm.style.height = "1px";
      this.dataElm.style.visibility = "hidden";
    }
    this.maxScrollY = Math.max(this.dataWrapperElm.scrollHeight - this.dataViewHeight, 0);
  };
  StorkGrid.prototype.resizeCalculate = function resizeCalculate() {
    if (this.dataWrapperElm.clientHeight > this.grid.clientHeight) {
      this.grid.style.height = this.grid.clientHeight + "px";
      this.dataWrapperElm.style.maxHeight = window.innerHeight + "px";
    }
    this.dataViewHeight = this.dataWrapperElm.clientHeight;
    if (this.dataViewHeight < this.rowHeight) {
      this.dataViewHeight = this.rowHeight;
      console.warn("The Data Wrapper element was set too low. Height can't be less than the height of one row!");
    }
    this.maxScrollY = Math.max(this.dataWrapperElm.scrollHeight - this.dataViewHeight, 0);
    this.numDataRowsInTable = Math.ceil(this.dataViewHeight * (1 + this.tableExtraSize) / this.rowHeight);
    if (this.numDataRowsInTable % 2 === 1) {
      this.numDataRowsInTable++;
    }
    this.dataTableHeight = this.numDataRowsInTable * this.rowHeight;
    this.tableExtraPixelsForThreshold = Math.floor(this.dataTableHeight * (this.tableExtraSize / 2));
    this.lastThreshold = this.tableExtraPixelsForThreshold;
    this.nextThreshold = this.lastThreshold + this.dataTableHeight;
  };
  StorkGrid.prototype.buildDataTables = function buildDataTables() {
    var table, tableFixed, tbody, tbodyFixed, tr, trFixed, td, tdDiv, i, j;
    for (var counter = 0; counter < 2; counter++) {
      table = document.getElementById("grid" + this.rnd + "_dataTable" + counter);
      tableFixed = document.getElementById("grid" + this.rnd + "_dataTable_fixed" + counter);
      if (!table) {
        tableFixed = document.createElement("table");
        tableFixed.id = "grid" + this.rnd + "_dataTable_fixed" + counter;
        tableFixed.classList.add("fixed");
        table = document.createElement("table");
        table.id = "grid" + this.rnd + "_dataTable" + counter;
        table.classList.add("loose");
        this.dataElm.appendChild(tableFixed);
        this.dataElm.appendChild(table);
      }
      while (tableFixed.firstChild) {
        tableFixed.removeChild(tableFixed.firstChild);
      }
      while (table.firstChild) {
        table.removeChild(table.firstChild);
      }
      this.dataTables[counter] = {
        table: table,
        tableFixed: tableFixed,
        dataBlockIndex: null,
        rows: []
      };
      tbody = document.createElement("tbody");
      tbodyFixed = document.createElement("tbody");
      for (i = 0; i < this.numDataRowsInTable; i++) {
        tr = document.createElement("tr");
        trFixed = document.createElement("tr");
        tr.storkGridProps = {
          dataIndex: null,
          selected: false
        };
        trFixed.storkGridProps = tr.storkGridProps;
        this.dataTables[counter].rows[i] = {
          row: tr,
          rowFixed: trFixed,
          tds: []
        };
        for (j = 0; j < this.columns.length; j++) {
          td = document.createElement("td");
          td.classList.add(this.columns[j].field);
          td.storkGridProps = {
            column: this.columns[j].field,
            selected: false
          };
          tdDiv = document.createElement("div");
          td.appendChild(tdDiv);
          this.dataTables[counter].rows[i].tds.push(td);
          if (this.columns[j].fixed) {
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
  StorkGrid.prototype.repositionTables = function repositionTables(currScrollDirection, currScrollTop, forceUpdateViewData) {
    var topTableIndex, topTable, topTableFixed, bottomTableIndex, bottomTable, bottomTableFixed;
    currScrollTop = currScrollTop || this.scrollY;
    currScrollDirection = currScrollDirection || "down";
    forceUpdateViewData = forceUpdateViewData || false;
    var currDataBlock = 0;
    if (this.dataTableHeight > 0) {
      currDataBlock = Math.floor(currScrollTop / this.dataTableHeight);
    }
    topTableIndex = currDataBlock % 2;
    topTable = this.dataTables[topTableIndex].table;
    topTableFixed = this.dataTables[topTableIndex].tableFixed;
    bottomTableIndex = (currDataBlock + 1) % 2;
    bottomTable = this.dataTables[bottomTableIndex].table;
    bottomTableFixed = this.dataTables[bottomTableIndex].tableFixed;
    var self = this;
    var changeTranslateOfTables = function changeTranslateOfTables() {
      changeTranslate(topTable, "Y", currDataBlock * self.dataTableHeight);
      changeTranslate(topTableFixed, "Y", currDataBlock * self.dataTableHeight);
      changeTranslate(bottomTable, "Y", (currDataBlock + 1) * self.dataTableHeight);
      changeTranslate(bottomTableFixed, "Y", (currDataBlock + 1) * self.dataTableHeight);
    };
    if (currScrollDirection === "down") {
      changeTranslateOfTables();
      this.lastThreshold = currDataBlock * this.dataTableHeight + this.tableExtraPixelsForThreshold;
      if (currScrollTop >= this.lastThreshold) {
        this.nextThreshold = this.lastThreshold + this.dataTableHeight;
      } else {
        this.nextThreshold = this.lastThreshold;
        this.lastThreshold -= this.dataTableHeight;
      }
    } else if (currScrollDirection === "up") {
      changeTranslateOfTables();
      this.lastThreshold = (currDataBlock + 1) * this.dataTableHeight + this.tableExtraPixelsForThreshold;
      if (currScrollTop <= this.lastThreshold) {
        this.nextThreshold = this.lastThreshold - this.dataTableHeight;
      } else {
        this.nextThreshold = this.lastThreshold;
        this.lastThreshold += this.dataTableHeight;
      }
    }
    if (this.dataTables[topTableIndex].dataBlockIndex !== currDataBlock || forceUpdateViewData) {
      this.updateViewData(topTableIndex, currDataBlock);
    }
    if (this.dataTables[bottomTableIndex].dataBlockIndex !== currDataBlock + 1 || forceUpdateViewData) {
      this.updateViewData(bottomTableIndex, currDataBlock + 1);
    }
  };
  StorkGrid.prototype.onDataScroll = function onDataScroll(e) {
    var currScrollTop = e.target.scrollTop;
    if (currScrollTop !== this.lastScrollTop) {
      this.onScrollY(currScrollTop);
    } else {
      if (currScrollTop === 0 && this.lastScrollTop === 0) {
        this.onScrollY(currScrollTop);
      }
      var currScrollLeft = e.target.scrollLeft;
      if (currScrollLeft !== this.lastScrollLeft) {
        this.onScrollX(currScrollLeft);
      }
    }
  };
  StorkGrid.prototype.onScrollY = function onScrollY(currScrollTop) {
    var currScrollDirection = currScrollTop >= this.lastScrollTop ? "down" : "up";
    var scrollEvent, i, evnt;
    if (this.lastScrollDirection !== currScrollDirection || this.lastScrollDirection === "down" && currScrollTop >= this.nextThreshold || this.lastScrollDirection === "up" && currScrollTop <= this.nextThreshold) {
      this.repositionTables(currScrollDirection, currScrollTop);
    }
    this.lastScrollTop = currScrollTop;
    this.lastScrollDirection = currScrollDirection;
    for (i = 0; i < this.customScrollEvents.length; i++) {
      scrollEvent = this.customScrollEvents[i];
      if (scrollEvent.fromBottom && currScrollTop >= this.maxScrollY - scrollEvent.amount || !scrollEvent.fromBottom && currScrollTop <= scrollEvent.amount) {
        evnt = new Event(scrollEvent.type, {
          bubbles: true,
          cancelable: true
        });
        this.grid.dispatchEvent(evnt);
      }
    }
  };
  StorkGrid.prototype.onScrollX = function onScrollX(currScrollLeft) {
    changeTranslate(this.headerTable.loose, "X", -currScrollLeft);
    if (this.headerTable.resizer_loose) {
      changeTranslate(this.headerTable.resizer_loose, "X", -currScrollLeft);
    }
    changeTranslate(this.dataTables[0].tableFixed, "X", currScrollLeft);
    changeTranslate(this.dataTables[1].tableFixed, "X", currScrollLeft);
    if (this.totalDataWidthFixed > 0 && currScrollLeft >= 5 && this.lastScrollLeft < 5) {
      this.dataTables[0].tableFixed.classList.add("covering");
      this.dataTables[1].tableFixed.classList.add("covering");
      this.headerTable.fixed.classList.add("covering");
    } else if (currScrollLeft < 5 && this.lastScrollLeft >= 5) {
      this.dataTables[0].tableFixed.classList.remove("covering");
      this.dataTables[1].tableFixed.classList.remove("covering");
      this.headerTable.fixed.classList.remove("covering");
    }
    this.lastScrollLeft = currScrollLeft;
  };
  StorkGrid.prototype.onDataClick = function onDataClick(e) {
    var TD = e.target, i = 0, dataIndex, TR, selectedCellColumn, trackByData;
    while (TD.tagName.toUpperCase() !== "TD") {
      if (i++ >= 2) {
        return;
      }
      TD = TD.parentNode;
    }
    TR = TD.parentNode;
    dataIndex = parseInt(TR.storkGridProps.dataIndex, 10);
    selectedCellColumn = TD.storkGridProps.column;
    if (dataIndex >= 0 && dataIndex < this.data.length && dataIndex <= Number.MAX_SAFE_INTEGER) {
      trackByData = this._getTrackByData(dataIndex);
      this._dispatchSelectEvent("data-click", dataIndex, selectedCellColumn, trackByData);
    }
  };
  var lastClickTime = 0;
  var lastClickElm = null;
  StorkGrid.prototype.onDataSelect = function onDataSelect(e) {
    if (e.button !== 0) {
      return;
    }
    var TD = e.target, i = 0, eventName = "select", dataIndex, TR, selectedCellColumn, selectedItem, trackByData;
    while (TD.tagName.toUpperCase() !== "TD") {
      if (i++ >= 2) {
        return;
      }
      TD = TD.parentNode;
    }
    TR = TD.parentNode;
    dataIndex = parseInt(TR.storkGridProps.dataIndex, 10);
    selectedCellColumn = TD.storkGridProps.column;
    if (dataIndex >= 0 && dataIndex < this.data.length && dataIndex <= Number.MAX_SAFE_INTEGER) {
      trackByData = this._getTrackByData(dataIndex);
      var now = Date.now();
      var clickedElm;
      if (this.selection.type === "cell") {
        clickedElm = TD;
      } else {
        clickedElm = TR;
      }
      if (now - lastClickTime > 300 || clickedElm !== lastClickElm) {
        if (this.selection.type === "row" && this.selection.multi === true) {
          this.selectedItems.clear();
          if (this.clickedItem && this.clickedItem.dataIndex === dataIndex) {
            this.clickedItem = null;
            this.hoveredRowElm = null;
          } else {
            this.selectedItems.set(trackByData, [ selectedCellColumn ]);
            this.clickedItem = {
              dataIndex: dataIndex,
              data: this.data[dataIndex],
              column: selectedCellColumn
            };
            this.hoveredRowElm = TR;
            var self = this;
            var eventIndexes = {
              mouse_move: null,
              mouse_up: null
            };
            eventIndexes.mouse_move = this._addEventListener(this.dataWrapperElm, "mousemove", this.onDataSelectMove.bind(this), false);
            eventIndexes.mouse_up = this._addEventListener(document, "mouseup", function() {
              self._removeEventListener(eventIndexes.mouse_move);
              self._removeEventListener(eventIndexes.mouse_up);
            }, false);
          }
          this.renderSelectOnRows();
        } else {
          if (!this.selection.multi && !this.selectedItems.has(trackByData)) {
            this.selectedItems.clear();
          }
          if (this.selectedItems.has(trackByData)) {
            if (this.selection.type === "row") {
              this.selectedItems.delete(trackByData);
              this.clickedItem = null;
            } else {
              selectedItem = this.selectedItems.get(trackByData);
              var indexOfColumn = selectedItem.indexOf(selectedCellColumn);
              if (indexOfColumn === -1) {
                selectedItem.push(selectedCellColumn);
                this.clickedItem = {
                  dataIndex: dataIndex,
                  column: selectedCellColumn
                };
              } else {
                selectedItem.splice(indexOfColumn, 1);
                if (selectedItem.length === 0) {
                  this.selectedItems.delete(trackByData);
                }
                this.clickedItem = null;
              }
            }
          } else {
            this.selectedItems.set(trackByData, [ selectedCellColumn ]);
            this.clickedItem = {
              dataIndex: dataIndex,
              data: this.data[dataIndex],
              column: selectedCellColumn
            };
          }
          this.renderSelectOnRows();
        }
      } else {
        eventName = "dblselect";
      }
      lastClickTime = now;
      if (this.selection.type === "cell") {
        lastClickElm = TD;
      } else {
        lastClickElm = TR;
      }
      this._dispatchSelectEvent(eventName, dataIndex, selectedCellColumn, trackByData);
    } else {
      this.selectedItems.clear();
      console.warn("selected row is not pointing to a valid data");
      this.repositionTables(null, null, true);
    }
  };
  StorkGrid.prototype.onDataSelectMove = function onDataSelectMove(e) {
    var TD = e.target, i = 0, dataIndex, TR, trackByData;
    while (TD.tagName.toUpperCase() !== "TD") {
      if (i++ >= 2) {
        return;
      }
      TD = TD.parentNode;
    }
    TR = TD.parentNode;
    if (TR !== this.hoveredRowElm) {
      this.hoveredRowElm = TR;
      dataIndex = parseInt(TR.storkGridProps.dataIndex, 10);
      if (dataIndex >= 0 && dataIndex < this.data.length && dataIndex <= Number.MAX_SAFE_INTEGER) {
        this.selectedItems.clear();
        var smallIndex = Math.min(dataIndex, this.clickedItem.dataIndex);
        var bigIndex = Math.max(dataIndex, this.clickedItem.dataIndex);
        for (i = smallIndex; i <= bigIndex; i++) {
          if (this.trackBy) {
            trackByData = this.data[i][this.trackBy];
          } else {
            trackByData = this.data[i];
          }
          this.selectedItems.set(trackByData, [ this.clickedItem.column ]);
        }
        this.renderSelectOnRows();
      }
    }
  };
  StorkGrid.prototype._getTrackByData = function _getTrackByData(dataIndex) {
    if (this.trackBy) {
      if (typeof this.data[dataIndex][this.trackBy] !== "undefined" && this.data[dataIndex][this.trackBy] !== null) {
        return this.data[dataIndex][this.trackBy];
      }
      console.warn("Invalid track-by (" + this.trackBy + ") for data row (index: " + dataIndex + "):", this.data[dataIndex]);
    }
    return this.data[dataIndex];
  };
  StorkGrid.prototype._toggleSelectedClasses = function _toggleSelectedClasses(dataIndex, rowObj) {
    var trackByData = this._getTrackByData(dataIndex), selectedItem, dataKeyName, tdDiv, i;
    if (this.selectedItems.has(trackByData)) {
      rowObj.row.classList.add("selected");
      rowObj.rowFixed.classList.add("selected");
      rowObj.row.storkGridProps.selected = true;
      if (this.clickedItem && this.clickedItem.dataIndex === dataIndex) {
        rowObj.row.classList.add("clicked");
        rowObj.rowFixed.classList.add("clicked");
      } else {
        rowObj.row.classList.remove("clicked");
        rowObj.rowFixed.classList.remove("clicked");
      }
    } else if (rowObj.row.storkGridProps.selected) {
      rowObj.row.classList.remove("selected");
      rowObj.rowFixed.classList.remove("selected");
      rowObj.row.storkGridProps.selected = false;
      if (!this.clickedItem || this.clickedItem.dataIndex !== dataIndex) {
        rowObj.row.classList.remove("clicked");
        rowObj.rowFixed.classList.remove("clicked");
      }
    }
    selectedItem = this.selectedItems.has(trackByData) ? this.selectedItems.get(trackByData) : null;
    for (i = 0; i < this.columns.length; i++) {
      dataKeyName = this.columns[i].field;
      tdDiv = rowObj.tds[i].firstChild;
      if (selectedItem && this.selection.type === "cell" && selectedItem.indexOf(dataKeyName) > -1) {
        rowObj.tds[i].classList.add("selected");
        rowObj.tds[i].storkGridProps.selected = true;
      } else if (rowObj.tds[i].storkGridProps.selected) {
        rowObj.tds[i].classList.remove("selected");
        rowObj.tds[i].storkGridProps.selected = false;
      }
    }
  };
  StorkGrid.prototype.renderSelectOnRows = function renderSelectOnRows() {
    var i, j, dataIndex;
    for (i = 0; i < this.dataTables.length; i++) {
      for (j = 0; j < this.dataTables[i].rows.length; j++) {
        dataIndex = this.dataTables[i].rows[j].row.storkGridProps.dataIndex;
        if (dataIndex >= this.data.length) {
          continue;
        }
        this._toggleSelectedClasses(dataIndex, this.dataTables[i].rows[j]);
      }
    }
  };
  StorkGrid.prototype.onCopy = function onCopy(e) {
    if (this.grid.classList.contains("focused")) {
      if (this.selectedItems.size > 0) {
        var text = "", html = "<table><tbody>", i, j, trackByData, cellText;
        for (i = 0; i < this.data.length; i++) {
          if (this.trackBy) {
            trackByData = this.data[i][this.trackBy];
          } else {
            trackByData = this.data[i];
          }
          if (this.selectedItems.has(trackByData)) {
            html += "<tr>";
            for (j = 0; j < this.columns.length; j++) {
              cellText = this.data[i][this.columns[j].field] || "";
              text += cellText + " ";
              html += "<td>" + cellText + "</td>";
            }
            text = text.slice(0, -1) + "\n";
            html += "</tr>";
          }
        }
        text = text.slice(0, -1);
        html += "</tbody></table>";
        e.clipboardData.setData("text/plain", text);
        e.clipboardData.setData("text/html", html);
        e.preventDefault();
      }
    }
  };
  StorkGrid.prototype.onHeaderClick = function onHeaderClick(e) {
    var TH = e.target, i = 0;
    while (TH.tagName.toUpperCase() !== "TH") {
      if (i++ >= 2) {
        return;
      }
      TH = TH.parentNode;
    }
    var evnt = new CustomEvent("column-click", {
      bubbles: true,
      cancelable: true,
      detail: {
        column: TH.storkGridProps.column
      }
    });
    this.grid.dispatchEvent(evnt);
  };
  StorkGrid.prototype.updateViewData = function updateViewData(tableIndex, dataBlockIndex) {
    var tableObj, firstBlockRow, lastBlockRow, row, rowObj, dataKeyName, dataIndex, i, tdDiv, dataValue;
    tableObj = this.dataTables[tableIndex];
    firstBlockRow = dataBlockIndex * this.numDataRowsInTable;
    lastBlockRow = (dataBlockIndex + 1) * this.numDataRowsInTable - 1;
    row = 0;
    for (dataIndex = firstBlockRow; dataIndex <= lastBlockRow; dataIndex++, row++) {
      rowObj = tableObj.rows[row];
      rowObj.row.storkGridProps.dataIndex = dataIndex;
      if (this.data[dataIndex]) {
        this._toggleSelectedClasses(dataIndex, rowObj);
        for (i = 0; i < this.columns.length; i++) {
          dataKeyName = this.columns[i].field;
          dataValue = this.data[dataIndex][dataKeyName];
          tdDiv = rowObj.tds[i].firstChild;
          if (this.columns[i].render) {
            this.columns[i].render(tdDiv, dataValue, dataIndex, this.data[dataIndex]);
          } else {
            this.defaultRender(tdDiv, dataValue);
          }
        }
      } else {
        for (i = 0; i < this.columns.length; i++) {
          tdDiv = rowObj.tds[i].firstChild;
          if (tdDiv.firstChild) {
            tdDiv.firstChild.nodeValue = "";
          }
        }
      }
    }
    tableObj.dataBlockIndex = dataBlockIndex;
  };
  StorkGrid.prototype.defaultRender = function defaultRender(tdDiv, dataValue) {
    if (typeof dataValue !== "string" && typeof dataValue !== "number") {
      dataValue = "";
    }
    if (!tdDiv.firstChild) {
      tdDiv.appendChild(document.createTextNode(dataValue));
    } else if (tdDiv.firstChild) {
      tdDiv.firstChild.nodeValue = dataValue;
    }
  };
  StorkGrid.prototype.makeColumnsResizable = function makeColumnsResizable() {
    var colResizers = document.getElementById("grid" + this.rnd + "_columnResizers");
    var colResizersFixed = document.getElementById("grid" + this.rnd + "_columnResizers_fixed");
    var resizer, i, tbody, tr, trFixed, td, div;
    if (!colResizers) {
      colResizers = document.createElement("table");
      colResizers.id = "grid" + this.rnd + "_columnResizers";
      colResizers.classList.add("loose");
      colResizers.classList.add("resizers");
      this.headerTable.resizer_loose = colResizers;
      colResizersFixed = document.createElement("table");
      colResizersFixed.id = "grid" + this.rnd + "_columnResizers_fixed";
      colResizersFixed.classList.add("fixed");
      colResizersFixed.classList.add("resizers");
      this.headerTable.resizer_fixed = colResizersFixed;
      tbody = document.createElement("tbody");
      tr = document.createElement("tr");
      tbody.appendChild(tr);
      colResizers.appendChild(tbody);
      this.headerTable.container.insertBefore(colResizers, this.headerTable.container.firstChild);
      tbody = document.createElement("tbody");
      trFixed = document.createElement("tr");
      tbody.appendChild(trFixed);
      colResizersFixed.appendChild(tbody);
      this.headerTable.container.insertBefore(colResizersFixed, this.headerTable.container.firstChild);
      div = document.createElement("div");
      div.classList.add("resizer-line");
      this.grid.appendChild(div);
      this.resizerLine = div;
    } else {
      tr = colResizers.querySelector("tr");
      trFixed = colResizersFixed.querySelector("tr");
      while (tr.firstChild) {
        tr.removeChild(tr.firstChild);
      }
      while (trFixed.firstChild) {
        trFixed.removeChild(trFixed.firstChild);
      }
    }
    for (i = 0; i < this.columns.length; i++) {
      td = document.createElement("td");
      td.classList.add(this.columns[i].field);
      resizer = document.createElement("a");
      resizer.setAttribute("draggable", "true");
      resizer.storkGridProps = {
        dragStartX: 0,
        columnIndex: i
      };
      this.setResizeByDragging(resizer);
      td.appendChild(resizer);
      if (this.columns[i].fixed) {
        trFixed.appendChild(td);
      } else {
        tr.appendChild(td);
      }
    }
  };
  StorkGrid.prototype.setResizeByDragging = function setResizeByDragging(elm) {
    var self = this;
    this._addEventListener(elm, "dragstart", function(e) {
      e.preventDefault();
      return false;
    });
    this._addEventListener(elm, "mousedown", function(e) {
      if (e.button !== 0) {
        return;
      }
      if (document.selection) {
        document.selection.empty();
      } else if (window.getSelection) {
        window.getSelection().removeAllRanges();
      }
      self.startDragging(elm.storkGridProps.columnIndex, e.pageX);
    });
  };
  StorkGrid.prototype.startDragging = function startDragging(columnIndex, mouseStartingPosX) {
    var self = this;
    var columnObj = self.columns[columnIndex];
    var eventIndexes = {
      mouse_move: null,
      mouse_up: null
    };
    this.calculateColumnHeaderContentWidth(columnObj);
    self.resizerLine.style.left = mouseStartingPosX - self.dataElm.getCoordinates().x + "px";
    self.resizerLine.style.display = "block";
    self.grid.classList.add("resizing-column");
    eventIndexes.mouse_move = self._addEventListener(document, "mousemove", function(e) {
      if (e.pageX !== 0) {
        var delta = e.pageX - mouseStartingPosX;
        var newColumnWidth = columnObj.width + delta;
        var minWidth = Math.max(columnObj.minWidth, columnObj.contentWidth, self.minColumnWidth);
        if (newColumnWidth < minWidth) {
          delta = minWidth - columnObj.width;
        }
        changeTranslate(self.resizerLine, "X", delta);
      }
    });
    eventIndexes.mouse_up = self._addEventListener(document, "mouseup", function(e) {
      self.grid.classList.remove("resizing-column");
      self.resizerLine.style.display = "";
      self.resizerLine.style.transform = "";
      var delta = e.pageX - mouseStartingPosX;
      columnObj.width = Math.max(columnObj.width + delta, columnObj.minWidth, columnObj.contentWidth, self.minColumnWidth);
      self.calculateColumnsWidths();
      self.makeCssRules();
      var evnt = new CustomEvent("resize-column", {
        bubbles: true,
        cancelable: true,
        detail: {
          columnIndex: columnIndex,
          columnField: columnObj.field,
          width: columnObj.width
        }
      });
      self.grid.dispatchEvent(evnt);
      self._removeEventListener(eventIndexes.mouse_move);
      self._removeEventListener(eventIndexes.mouse_up);
    });
  };
  StorkGrid.prototype.calculateColumnHeaderContentWidth = function calculateColumnHeaderContentWidth(columnObj) {
    var elm = this.headerTable.container.querySelector("th." + columnObj.field);
    var contentWidth = elm.firstChild ? Math.ceil(elm.firstChild.offsetWidth) : 0;
    var thStyle = elm.currentStyle || window.getComputedStyle(elm);
    var paddingLeft = parseInt(thStyle.paddingLeft);
    var paddingRight = parseInt(thStyle.paddingRight);
    var borderLeft = parseInt(thStyle.borderLeftWidth);
    var borderRight = parseInt(thStyle.borderRightWidth);
    columnObj.contentWidth = borderLeft + paddingLeft + contentWidth + paddingRight + borderRight;
  };
  StorkGrid.prototype.resize = function resize() {
    this.resizeCalculate();
    this.buildDataTables();
    this.repositionTables(null, null, true);
  };
  StorkGrid.prototype.setData = function setData(data) {
    this.data = data;
    this.refresh();
  };
  StorkGrid.prototype.refresh = function refresh_data() {
    this.calculateDataHeight();
    this._updateClickedItemIndex();
    this.repositionTables(null, null, true);
  };
  StorkGrid.prototype._updateClickedItemIndex = function _updateClickedItemIndex() {
    if (this.clickedItem && this.clickedItem.data) {
      var itemIndex = this.data.indexOf(this.clickedItem.data);
      if (itemIndex >= 0) {
        this.clickedItem.dataIndex = itemIndex;
      } else {
        this.clickedItem = null;
      }
    }
  };
  StorkGrid.prototype.destroy = function destroy() {
    var rows = this.grid.querySelectorAll("tr");
    var cells = this.grid.querySelectorAll("th, td");
    var i, j, k;
    this._emptyEventListeners();
    for (i = 0; i < cells.length; i++) {
      cells[i].parentNode.removeChild(cells[i]);
    }
    for (i = 0; i < rows.length; i++) {
      rows[i].parentNode.removeChild(rows[i]);
    }
    while (this.grid.firstChild) {
      this.grid.removeChild(this.grid.firstChild);
    }
    this.grid.classList.remove("stork-grid", "stork-grid" + this.rnd);
    delete this.grid;
    delete this.data;
    delete this.rowHeight;
    delete this.headerHeight;
    delete this.columns;
    delete this.minColumnWidth;
    delete this.resizableColumns;
    delete this.trackBy;
    delete this.selection;
    delete this.onload;
    delete this.tableExtraSize;
    delete this.tableExtraPixelsForThreshold;
    for (i = 0; i < this.headerTable.ths.length; i++) {
      this.headerTable.ths[i] = null;
    }
    delete this.headerTable;
    for (i = 0; i < this.dataTables; i++) {
      for (j = 0; j < this.dataTables[i].rows.length; j++) {
        for (k = 0; k < this.dataTables[i].rows[j].tds.length; k++) {
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
    delete this.dataTableHeight;
    delete this.numDataRowsInTable;
  };
  StorkGrid.prototype.setColumns = function setColumns(columns) {
    this.columns = columns;
    this.initColumnsObject();
    this.makeHeaderTable();
    this.initDataView();
    this.updateViewData(0, 0);
    this.updateViewData(1, 1);
    if (this.resizableColumns) {
      this.makeColumnsResizable();
    }
    this.calculateColumnsWidths();
    this.makeCssRules();
    this.repositionTables(null, null, true);
  };
  StorkGrid.prototype._onClickCheckFocus = function _onClickCheckFocus(e) {
    var target = e.target;
    while (!(target instanceof HTMLDocument) && target !== this.grid) {
      target = target.parentNode;
      if (target && target instanceof HTMLDocument) {
        this.grid.classList.remove("focused");
        return;
      }
    }
    this.grid.classList.add("focused");
  };
  StorkGrid.prototype._onKeyboardNavigate = function _onKeyboardNavigate(e) {
    var key = keyboardMap[e.keyCode];
    if (this.clickedItem && (key === "DOWN" || key === "UP")) {
      if (key === "DOWN" && this.clickedItem.dataIndex < this.data.length - 1) {
        this.clickedItem.dataIndex++;
      } else if (key === "UP" && this.clickedItem.dataIndex > 0) {
        this.clickedItem.dataIndex--;
      } else {
        return;
      }
      e.preventDefault();
      var trackByData = this._getTrackByData(this.clickedItem.dataIndex);
      this.selectedItems.clear();
      this.selectedItems.set(trackByData, [ this.clickedItem.column ]);
      var clickedItemY = this.clickedItem.dataIndex * this.rowHeight;
      if (clickedItemY < this.scrollY) {
        this.scrollY = clickedItemY;
        this.onScrollY(clickedItemY);
      } else if (clickedItemY > this.scrollY + this.dataViewHeight - this.rowHeight) {
        this.scrollY = clickedItemY - this.dataViewHeight + this.rowHeight;
        this.onScrollY(clickedItemY - this.dataViewHeight + this.rowHeight);
      }
      this.renderSelectOnRows();
      this._dispatchSelectEvent("select", this.clickedItem.dataIndex, this.clickedItem.column, trackByData);
    }
  };
  root.StorkGrid = StorkGrid;
})(window);