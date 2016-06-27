(function(root) {
  "use strict";
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
    this.selection.type = options.selection.type === "cell" ? "cell" : "row";
    if (!this.rnd) {
      this.rnd = (Math.floor(Math.random() * 9) + 1) * 1e3 + Date.now() % 1e3;
    }
    this.tableExtraSize = .4;
    this.tableExtraPixelsForThreshold = 0;
    this.headerTable = {
      wrapper: null,
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
    this.customScrollEvents = [];
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
    if (this.columns.length === 0 && this.data.length > 0) {
      var columnName;
      for (var key in this.data[0]) {
        if (this.data[0].hasOwnProperty(key)) {
          columnName = key.replace(/[-_]/, " ");
          columnName = columnName.replace(/\w\S*/g, function(txt) {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
          });
          this.columns.push({
            dataName: key,
            displayName: columnName,
            width: 0,
            minWidth: 0,
            fixed: false
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
    this.grid.classList.add("stork-grid", "stork-grid" + this.rnd);
    this.makeHeaderTable();
    this.initDataView();
    this.dataWrapperElm.addEventListener("click", this.onDataClick.bind(this));
    if (this.sortable) {
      this.headerTable.wrapper.addEventListener("click", this.onHeaderClick.bind(this));
    }
    this.updateViewData(0, 0);
    this.updateViewData(1, 1);
    if (this.resizableColumns) {
      this.makeColumnsResizable();
    }
    this.calculateColumnsWidths();
    this.makeCssRules();
    this.dataWrapperElm.addEventListener("scroll", this.onDataScroll.bind(this));
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
  storkGrid.prototype.addScrollEvent = function addScrollEvent(type, amount, fromBottom) {
    fromBottom = fromBottom !== false;
    this.customScrollEvents.push({
      type: type,
      amount: amount,
      fromBottom: fromBottom
    });
  };
  storkGrid.prototype.addEventListener = function customAddEventListener(type, listener, options_or_useCapture) {
    this.grid.addEventListener(type, listener, options_or_useCapture);
  };
  storkGrid.prototype.calculateColumnsWidths = function calculateColumnsWidths() {
    this.totalDataWidthLoose = 0;
    this.totalDataWidthFixed = 0;
    var userDefinedWidth = 0, numColumnsNotDefined = 0, i, availableWidth, availableWidthPerColumn, roundedPixels;
    for (i = 0; i < this.columns.length; i++) {
      this.columns[i].width = this.columns[i].width || 0;
      this.columns[i].minWidth = this.columns[i].minWidth || 0;
      if (this.columns[i].width) {
        this.columns[i].width = Math.max(this.columns[i].width, this.columns[i].minWidth, this.minColumnWidth);
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
  storkGrid.prototype.makeCssRules = function makeCssRules() {
    var style = document.getElementById("grid" + this.rnd + "_style");
    if (!style) {
      style = document.createElement("style");
      style.id = "grid" + this.rnd + "_style";
      style.type = "text/css";
      document.getElementsByTagName("head")[0].appendChild(style);
    }
    var html = ".stork-grid" + this.rnd + " div.header," + ".stork-grid" + this.rnd + " div.header > table th," + ".stork-grid" + this.rnd + " div.header > table.resizers a { height: " + this.headerHeight + "px; }";
    html += ".stork-grid" + this.rnd + " div.header > table th > div { max-height: " + this.headerHeight + "px; }";
    html += ".stork-grid" + this.rnd + " div.data > table td { height: " + this.rowHeight + "px; }";
    html += ".stork-grid" + this.rnd + " div.data > table td > div { max-height: " + this.rowHeight + "px; }";
    for (var i = 0; i < this.columns.length; i++) {
      html += ".stork-grid" + this.rnd + " col.col-" + this.columns[i].dataName + " { width: " + this.columns[i].width + "px; }";
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
  storkGrid.prototype.setRowHeight = function setRowHeight(num) {
    this.rowHeight = num;
    this.makeCssRules();
  };
  storkGrid.prototype.setHeaderHeight = function setHeaderHeight(num) {
    this.headerHeight = num;
    this.makeCssRules();
  };
  storkGrid.prototype.makeHeaderTable = function makeHeaderTable() {
    var table = document.getElementById("grid" + this.rnd + "_headerTable");
    var tableFixed = document.getElementById("grid" + this.rnd + "_headerTable_fixed");
    var i;
    if (!table) {
      var headerDiv = document.createElement("div");
      headerDiv.classList.add("header");
      this.headerTable.wrapper = headerDiv;
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
      this.grid.appendChild(headerDiv);
    } else {
      while (table.firstChild) {
        table.removeChild(table.firstChild);
      }
      while (tableFixed.firstChild) {
        tableFixed.removeChild(tableFixed.firstChild);
      }
    }
    var colgroup = document.createElement("colgroup");
    var colgroupFixed = document.createElement("colgroup");
    var col;
    var thead = document.createElement("thead");
    var theadFixed = document.createElement("thead");
    var tr = document.createElement("tr");
    var trFixed = document.createElement("tr");
    var th, thDiv;
    for (i = 0; i < this.columns.length; i++) {
      col = document.createElement("col");
      col.classList.add("col-" + this.columns[i].dataName);
      th = document.createElement("th");
      thDiv = document.createElement("div");
      thDiv.appendChild(document.createTextNode(this.columns[i].displayName));
      th.appendChild(thDiv);
      th.storkGridProps = {
        column: this.columns[i].dataName,
        sortState: null
      };
      this.headerTable.ths.push(th);
      if (this.columns[i].fixed) {
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
  storkGrid.prototype.initDataView = function initDataView() {
    this.dataWrapperElm = document.createElement("div");
    this.dataWrapperElm.classList.add("data-wrapper");
    this.dataWrapperElm.style.height = "calc(100% - " + (this.headerHeight - 2) + "px)";
    this.dataElm = document.createElement("div");
    this.dataElm.classList.add("data");
    this.calculateDataHeight();
    this.dataWrapperElm.appendChild(this.dataElm);
    this.grid.appendChild(this.dataWrapperElm);
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
    this.resizeCalculate();
    this.buildDataTables();
  };
  storkGrid.prototype.calculateDataHeight = function calculateDataHeight() {
    this.totalDataHeight = this.rowHeight * this.data.length;
    this.dataElm.style.height = this.totalDataHeight + "px";
    this.maxScrollY = Math.max(this.dataWrapperElm.scrollHeight - this.dataViewHeight, 0);
  };
  storkGrid.prototype.resizeCalculate = function resizeCalculate() {
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
  storkGrid.prototype.buildDataTables = function buildDataTables() {
    var table, tableFixed, tbody, tbodyFixed, tr, trFixed, td, tdDiv, i, j, colgroup, colgroupFixed, col;
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
      colgroup = document.createElement("colgroup");
      colgroupFixed = document.createElement("colgroup");
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
          td.storkGridProps = {
            column: this.columns[j].dataName,
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
          if (i === 0) {
            col = document.createElement("col");
            col.classList.add("col-" + this.columns[j].dataName);
            if (this.columns[j].fixed) {
              colgroupFixed.appendChild(col);
            } else {
              colgroup.appendChild(col);
            }
          }
        }
        tbodyFixed.appendChild(trFixed);
        tbody.appendChild(tr);
      }
      tableFixed.style.top = this.dataTableHeight * counter + "px";
      tableFixed.appendChild(colgroupFixed);
      tableFixed.appendChild(tbodyFixed);
      table.style.top = this.dataTableHeight * counter + "px";
      table.appendChild(colgroup);
      table.appendChild(tbody);
    }
  };
  storkGrid.prototype.repositionTables = function repositionTables(currScrollDirection, currScrollTop, forceUpdateViewData) {
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
    if (currScrollDirection === "down") {
      topTable.style.top = topTableFixed.style.top = currDataBlock * this.dataTableHeight + "px";
      bottomTable.style.top = bottomTableFixed.style.top = (currDataBlock + 1) * this.dataTableHeight + "px";
      this.lastThreshold = currDataBlock * this.dataTableHeight + this.tableExtraPixelsForThreshold;
      if (currScrollTop >= this.lastThreshold) {
        this.nextThreshold = this.lastThreshold + this.dataTableHeight;
      } else {
        this.nextThreshold = this.lastThreshold;
        this.lastThreshold -= this.dataTableHeight;
      }
    } else if (currScrollDirection === "up") {
      topTable.style.top = topTableFixed.style.top = currDataBlock * this.dataTableHeight + "px";
      bottomTable.style.top = bottomTableFixed.style.top = (currDataBlock + 1) * this.dataTableHeight + "px";
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
  storkGrid.prototype.onDataScroll = function onDataScroll(e) {
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
  storkGrid.prototype.onScrollY = function onScrollY(currScrollTop) {
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
  storkGrid.prototype.onScrollX = function onScrollX(currScrollLeft) {
    this.headerTable.loose.style.left = -currScrollLeft + "px";
    if (this.headerTable.resizer_loose) {
      this.headerTable.resizer_loose.style.left = -currScrollLeft + "px";
    }
    this.dataTables[0].tableFixed.style.left = currScrollLeft + "px";
    this.dataTables[1].tableFixed.style.left = currScrollLeft + "px";
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
  var lastClickTime = 0;
  storkGrid.prototype.onDataClick = function onDataClick(e) {
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
    if (dataIndex >= 0 && dataIndex <= Number.MAX_SAFE_INTEGER) {
      var now = Date.now();
      if (now - lastClickTime > 300) {
        if (this.trackBy) {
          trackByData = this.data[dataIndex][this.trackBy];
        } else {
          trackByData = this.data[dataIndex];
        }
        if (!this.selection.multi && !this.selectedItems.has(trackByData)) {
          this.selectedItems.clear();
        }
        if (this.selectedItems.has(trackByData)) {
          if (this.selection.type === "row") {
            this.selectedItems.delete(trackByData);
          } else {
            selectedItem = this.selectedItems.get(trackByData);
            var indexOfColumn = selectedItem.indexOf(selectedCellColumn);
            if (indexOfColumn === -1) {
              selectedItem.push(selectedCellColumn);
            } else {
              selectedItem.splice(indexOfColumn, 1);
              if (selectedItem.length === 0) {
                this.selectedItems.delete(trackByData);
              }
            }
          }
        } else {
          this.selectedItems.set(trackByData, [ selectedCellColumn ]);
        }
        this.repositionTables(null, null, true);
      } else {
        eventName = "dblselect";
      }
      lastClickTime = now;
      var evnt = new CustomEvent(eventName, {
        bubbles: true,
        cancelable: true,
        detail: {
          dataIndex: dataIndex,
          column: selectedCellColumn
        }
      });
      this.grid.dispatchEvent(evnt);
    } else {
      this.selectedItems.clear();
      console.warn("selected row is not pointing to a valid data");
      this.repositionTables(null, null, true);
    }
  };
  storkGrid.prototype.onHeaderClick = function onHeaderClick(e) {
    var TH = e.target, i = 0;
    while (TH.tagName.toUpperCase() !== "TH") {
      if (i++ >= 2) {
        return;
      }
      TH = TH.parentNode;
    }
    for (i = 0; i < this.headerTable.ths.length; i++) {
      if (this.headerTable.ths[i] === TH) {
        continue;
      }
      this.headerTable.ths[i].classList.remove("ascending");
      this.headerTable.ths[i].classList.remove("descending");
      this.headerTable.ths[i].storkGridProps.sortState = null;
    }
    if (TH.storkGridProps.sortState === "ascending") {
      TH.classList.remove("ascending");
      TH.classList.add("descending");
      TH.storkGridProps.sortState = "descending";
    } else if (TH.storkGridProps.sortState === "descending") {
      TH.classList.remove("descending");
      TH.storkGridProps.sortState = null;
    } else {
      TH.classList.add("ascending");
      TH.storkGridProps.sortState = "ascending";
    }
    var evnt = new CustomEvent("sort", {
      bubbles: true,
      cancelable: true,
      detail: {
        column: TH.storkGridProps.column,
        state: TH.storkGridProps.sortState
      }
    });
    this.grid.dispatchEvent(evnt);
  };
  storkGrid.prototype.updateViewData = function updateViewData(tableIndex, dataBlockIndex) {
    var tableObj, firstBlockRow, lastBlockRow, row, rowObj, dataKeyName, dataIndex, i, selectedItem, trackByData, tdDiv, dataValue;
    tableObj = this.dataTables[tableIndex];
    firstBlockRow = dataBlockIndex * this.numDataRowsInTable;
    lastBlockRow = (dataBlockIndex + 1) * this.numDataRowsInTable - 1;
    row = 0;
    for (dataIndex = firstBlockRow; dataIndex <= lastBlockRow; dataIndex++, row++) {
      rowObj = tableObj.rows[row];
      rowObj.row.storkGridProps.dataIndex = dataIndex;
      if (this.data[dataIndex]) {
        if (this.trackBy) {
          trackByData = this.data[dataIndex][this.trackBy];
        } else {
          trackByData = this.data[dataIndex];
        }
        if (this.selectedItems.has(trackByData)) {
          selectedItem = this.selectedItems.get(trackByData);
          rowObj.row.classList.add("selected");
          rowObj.rowFixed.classList.add("selected");
          rowObj.row.storkGridProps.selected = true;
        } else {
          selectedItem = null;
          if (rowObj.row.storkGridProps.selected) {
            rowObj.row.classList.remove("selected");
            rowObj.rowFixed.classList.remove("selected");
            rowObj.row.storkGridProps.selected = false;
          }
        }
        for (i = 0; i < this.columns.length; i++) {
          dataKeyName = this.columns[i].dataName;
          tdDiv = rowObj.tds[i].firstChild;
          if (selectedItem && this.selection.type === "cell" && selectedItem.indexOf(dataKeyName) > -1) {
            rowObj.tds[i].classList.add("selected");
            rowObj.tds[i].storkGridProps.selected = true;
          } else if (rowObj.tds[i].storkGridProps.selected) {
            rowObj.tds[i].classList.remove("selected");
            rowObj.tds[i].storkGridProps.selected = false;
          }
          dataValue = this.data[dataIndex][dataKeyName];
          if (typeof dataValue !== "string" && typeof dataValue !== "number") {
            dataValue = "";
          }
          if (!tdDiv.firstChild) {
            tdDiv.appendChild(document.createTextNode(""));
          }
          if (tdDiv.firstChild) {
            tdDiv.firstChild.nodeValue = dataValue;
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
      selectedItem = null;
    }
    tableObj.dataBlockIndex = dataBlockIndex;
  };
  storkGrid.prototype.makeColumnsResizable = function makeColumnsResizable() {
    var colResizers = document.getElementById("grid" + this.rnd + "_columnResizers");
    var colResizersFixed = document.getElementById("grid" + this.rnd + "_columnResizers_fixed");
    var resizer, i, tbody, tr, trFixed, td, colgroup, colgroupFixed, col;
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
      colgroup = document.createElement("colgroup");
      tbody = document.createElement("tbody");
      tr = document.createElement("tr");
      tbody.appendChild(tr);
      colResizers.appendChild(colgroup);
      colResizers.appendChild(tbody);
      this.headerTable.wrapper.insertBefore(colResizers, this.headerTable.wrapper.firstChild);
      colgroupFixed = document.createElement("colgroup");
      tbody = document.createElement("tbody");
      trFixed = document.createElement("tr");
      tbody.appendChild(trFixed);
      colResizersFixed.appendChild(colgroupFixed);
      colResizersFixed.appendChild(tbody);
      this.headerTable.wrapper.insertBefore(colResizersFixed, this.headerTable.wrapper.firstChild);
      col = document.createElement("span");
      col.id = "grid" + this.rnd + "_dragPlaceholder";
      this.headerTable.wrapper.appendChild(col);
    } else {
      colgroup = colResizers.querySelector("colgroup");
      colgroupFixed = colResizersFixed.querySelector("colgroup");
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
      col = document.createElement("col");
      col.classList.add("col-" + this.columns[i].dataName);
      td = document.createElement("td");
      resizer = document.createElement("a");
      resizer.style.right = "-2px";
      resizer.setAttribute("draggable", "true");
      resizer.storkGridProps = {
        dragStartX: 0,
        columnIndex: i
      };
      this.setResizeByDragging(resizer, this.columns[i]);
      td.appendChild(resizer);
      if (this.columns[i].fixed) {
        trFixed.appendChild(td);
        colgroupFixed.appendChild(col);
      } else {
        tr.appendChild(td);
        colgroup.appendChild(col);
      }
    }
  };
  storkGrid.prototype.setResizeByDragging = function setResizeByDragging(elm) {
    var self = this;
    var columnObj = self.columns[elm.storkGridProps.columnIndex];
    elm.addEventListener("dragstart", function(e) {
      e.dataTransfer.setDragImage(document.getElementById("grid" + self.rnd + "_dragPlaceholder"), 0, 0);
      elm.storkGridProps.dragStartX = e.screenX;
      elm.classList.add("dragging");
    });
    elm.addEventListener("drag", function(e) {
      if (e.screenX !== 0) {
        var delta = e.screenX - elm.storkGridProps.dragStartX;
        var newColumnWidth = columnObj.width + delta;
        var minWidth = Math.max(columnObj.minWidth, self.minColumnWidth);
        if (newColumnWidth < minWidth) {
          delta = minWidth - columnObj.width;
        }
        elm.style.right = -2 - delta + "px";
      }
    });
    elm.addEventListener("dragend", function(e) {
      elm.classList.remove("dragging");
      elm.style.right = "-2px";
      var delta = e.screenX - elm.storkGridProps.dragStartX;
      columnObj.width = Math.max(columnObj.width + delta, columnObj.minWidth, self.minColumnWidth);
      self.calculateColumnsWidths();
      self.makeCssRules();
      var evnt = new CustomEvent("resize-column", {
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
  storkGrid.prototype.resize = function resize() {
    this.resizeCalculate();
    this.buildDataTables();
    this.repositionTables(null, null, true);
  };
  storkGrid.prototype.setData = function setData(data) {
    this.data = data;
    this.refresh();
  };
  storkGrid.prototype.refresh = function refresh_data() {
    this.calculateDataHeight();
    this.repositionTables(null, null, true);
  };
  storkGrid.prototype.destroy = function destroy() {
    var rows = this.grid.querySelectorAll("tr");
    var cells = this.grid.querySelectorAll("th, td");
    var i, j, k;
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
    delete this.sortable;
    delete this.trackBy;
    delete this.onload;
    delete this.selection.multi;
    delete this.selection.type;
    delete this.selection;
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
    this.destroy();
    this.constructor(options);
  };
  root.storkGrid = storkGrid;
})(window);