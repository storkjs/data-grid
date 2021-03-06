# data-grid

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/storkjs/data-grid/master/LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/storkjs/data-grid.svg)](https://github.com/storkjs/data-grid/issues)
[![Bower version](https://badge.fury.io/bo/stork-grid.svg)](https://github.com/storkjs/data-grid/releases)

**What is it?**
Worlds most efficient and smooth big data grid.
Has the most essential features without redundant bloat.

**Why?**
Because most of the time you need to display data. Show the user a grid of data so he can browse it quickly.
No need for heavy features that will slow down the website and will make the grid stutter.
Simple as that.

### TOC
- [Usage](#usage)
- [Options](#options)
- [Methods](#methods)
- [Events](#events)
- [Code Example](#code-example)
- [Demo](#demo)

### Usage
Initiate a grid with `new StorkGrid(options)`. This will return a grid object for further adjusting the grid later.

#### Options
_element_: the HTML DOM Element that will hold the grid. Example: `{ element: document.getElementById('my_grid') }`

_data_: an Array of Objects. Every item is a Key-Value pairs where the Key indicates the column the value belongs to. Example:
```javascript
{ data: [
  {name: "John", age: 20, weight: 70 },
  {name: "Ben", age: 23, weight: 80 },
  {name: "Dan", age: 24, weight: 76 }
] }
```

_rowHeight_ [optional]: the height of each row. defaults to 32 (pixels). Example:
`{ rowHeight: 40 }`

_headerHeight_ [optional]: the height of the table headers (the column names). defaults to _rowHeight_. Example:
`{ headerHeight: 50 }`

_selection_ [optional]: an Object with properties defining how selections on the grid are done.
- _selection.multi_: whether the user can select multiple values from the grid or not. defaults to _False_. Example:
`{ selection: { multi: true } }`
- _selection.type_: what type of element can the user select - a whole _row_ or a single _cell_. defaults to _"row"_. Example:
`{ selection: { type: "cell" } }`

_trackBy_ [optional]: the column which the grid should keep track of its content by (index). defaults to _null_. Example:
`{ trackBy: "age" }`

_columns_ [optional]: an Array of Objects. Each item in the array is an object that defines a column. These objects have the following properties:
- _field_: the key that will be looked for in the data object.
- _label_: the display name of the column (the text in the table headers).
- _width_: a user defined width for the column.
- _minWidth_: a user defined minimum width for when the client resizes the column.
- _fixed_: whether this column is fixed to the left and will not be moved when scrolling horizontally.
- _sortable_: if false than clicking the column will do nothing (becomes unsortable) and also adds a class to indicate this.
- _render(tdDiv, value, dataIndex, rowData)_: special function that will render the data inside the TD instead of the default renderer. This function lets you decide how to print the data (instead of just printing it as plain text), even put html inside.
- _resizable_: whether this specific column is not resizable.
Example:
```javascript
{ columns: [
  { field: 'name', label: 'Full Name', width: 75 },
  { field: 'age', label: 'Age', resizable: false },
  { field: 'weight', label: 'Weight (kg)', width: 60, render: function(tdDiv, value, dataIndex, rowData) { tdDiv.innerHTML = value+'!'; } }
] }
```

_minColumnWidth_ [optional]: the minimum column width that can be set. defaults to 50. Example:
`{ minColumnWidth: 65 }`

_resizableColumns_ [optional]: can the user resize the columns by dragging the header. defaults to _true_. Example:
`{ resizableColumns: false }`

_sortable_ [optional]: does clicking the header cells emit a sort event. defaults to _true_. Example:
`{ sortable: false }`

_onload_ [optional]: function to run after the grid finished constructing. defaults to _null_. the event's detail has a `gridObj` property holding the grid object. Example:
```javascript
{ onload: function(e) {
  console.log(e.detail);
} }
```

_asyncLoading_ [optional]: should the data grid load asynchronous thus letting other scripts run before it. defaults to _false_. Example:
`{ asyncLoading: true }`

#### Methods
_setRowHeight(height)_: sets the height of each row. arguments: _height_ {integer}.

_setHeaderHeight(height)_: sets the height of the header. arguments: _height_ {integer}.

_addEventListener(type, listener, optionsUseCapture)_: adds an event listener to the DOM Element of the grid.
arguments: _type_ {string}, listener {function}, [optionsUseCapture] {boolean|object}. Example:
```javascript
var myEventListener = function(e) {
  console.log(e.detail); // logs: {column: "age", dataIndex: 17}
};
myGrid.addEventListener("select", myEventListener, false);
```

_removeEventListener(type, listener, optionsUseCapture)_: removes an event listener from the DOM Element of the grid.
arguments: _type_ {string}, listener {function}, [optionsUseCapture] {boolean|object}. Example:
```javascript
myGrid.removeEventListener("select", myEventListener, false);
```

_addScrollEvent(type, amount, fromBottom)_: add a custom event to be emitted on certain positions when scrolling.
arguments: _type_ {string} - the name of the event to be emitted. _amount_ {integer} - the threshold in pixels for when to emit the event. _fromBottom_ {boolean} - threshold is relative to the bottom of the grid or else to the top (defaults to _true_).

_resizeCalculate_: re-calculates the viewport's height and the inner tables scrolling thresholds (in charge of replacing the data rows while scrolling). use this when the user resizes the window or the grid.

_resize_: a method for completely calculating and rebuilding new inner data tables when the grid's main element has changed its size.

_setData(data)_: sets a new data object and then refreshes the grid.
arguments: _data_ {object}.

_refresh_: calculates the height of the data and the maximum scroll available, and updates the height of the rows container and then repositions the data rows. use this in cases where the grid's data was altered by reference and the grid wasn't aware of it.

_destroy_: completely destroy the grid - its DOM elements, methods and data.

_setColumns(columns)_: set a new columns for the grid. can be used to re-arrange the columns or set some as fixed etc..
arguments: _columns_ {object}.

_addColumnClass(field, className)_: add a class to a specific column header (to a TH).
arguments: _field_ {string}, _className_ {string}.

_removeColumnClass(field, className)_: remove a class off a specific column header (off a TH).
arguments: _field_ {string}, _className_ {string}.

#### Events
_select_: when the user selected something from the grid. this event has a _detail_ object containing four properties - the index of the selected data (`event.detail.dataIndex`), the row's data object (`event.detail.rowData`), the selected column (`event.detail.column`) and whether it is a select or un-select (`event.detail.isSelect`). Example:
```javascript
myGrid.addEventListener("select", function(e) {
  console.log(e.detail); // logs: {dataIndex: 17, rowData: {name: "joe", age: 20}, column: "age", isSelect: true}
});
```

_dblselect_: same as _select_ but emitted when user double clicks the grid. :small_orange_diamond:_notice: on the first click of the double-click a `select` event is still emitted and then on the second click a `dblclick` event is emitted._

_enter-select_: same as _select_ but emitted when user presses ENTER for selecting data on the grid.

_data-click_: when the user performs a full click on something from the grid. this event has a _detail_ object containing four properties - the index of the selected data (`event.detail.dataIndex`), the row's data object (`event.detail.rowData`), the selected column (`event.detail.column`) and whether it is a select or un-select (`event.detail.isSelect`). Example:
```javascript
myGrid.addEventListener("data-click", function(e) {
  console.log(e.detail); // logs: {dataIndex: 17, rowData: {name: "joe", age: 20}, column: "age", isSelect: true}
});
```

_column-click_: when the user clicks on a column header this event is emitted with a `detail` object holding one property - the column field name (`event.detail.column`).
this event can be used to sort the column and then add an 'ascending' or 'descending' class to the column via _addColumnClass_.
:small_orange_diamond:_notice: this is just an event. the actual sort and grid refresh is not done by the grid._

_resize-column_: is emitted after the user has resized a column's width. this event has a `detail` object containing two properties - the index of the resized column (`event.detail.columnIndex`) and the new width of the column (`event.detail.width`).

_grid-loaded_: when the grid completes its constructing this event is emitted. you can listen to this event instead of giving the `onload` option.

_Custom scroll events_: these events will be emitted if defined via the _addScrollEvent_ method.

### Code Example
```html
<div id="my_grid" style="width: 80%; height: 400px;"></div>
```

```javascript
var myData = [
  {name: "John", age: 20, weight: 70, miscInfo: "is tall" },
  {name: "Ben", age: 23, weight: 80, miscInfo: "is short" },
  {name: "Dan", age: 24, weight: 86, miscInfo: "is fat" }
];

var sortColumn = function sortColumn(column, state) {
  return function(a, b) {
    if(state === null && a.id) {
      column = 'id';
      state = 'ascending';
    }
    if (a[column] < b[column]) { return (state === 'ascending' ? 1 : -1); }
    if (a[column] > b[column]) { return (state === 'ascending' ? -1 : 1); }
    return 0;
  }
};

document.getElementById('my_grid').addEventListener('grid-loaded', function(e) {
  console.log('second way of onload', e.detail.gridObj);
}, { capture: false });

myGrid = new StorkGrid({
  element: document.getElementById('my_grid'),
  data: myData,
  rowHeight: 30,
  headerHeight: 50,
  sortable: true,
  selection: {
    multi: false,
    type: 'row'
  },
  columns: [
    { field: 'name', label: 'Full Name', width: 75 },
    { field: 'age', label: 'Age' },
    { field: 'weight', label: 'Weight (kg)', width: 60, fixed: true, render: function(tdDiv, value) {
      if(value.length > 10) { tdDiv.innerHTML = value.substr(0, 7) + '...'; }
        else { tdDiv.innerHTML = value; }
      }
    }
  ],
  trackBy: 'age',
  minColumnWidth: 65,
  resizableColumns: true,
  onload: function(e) { console.log('first way of onload', e.detail.gridObj); }
});

myGrid.addEventListener("select", function(e) {
  console.log('column selected', e.detail); // logs: {column: "age", dataIndex: 17}
}, false);
myGrid.addEventListener("dblselect", function(e) {
  console.log('double clicked column', e.detail); // logs: {column: "age", dataIndex: 17}
}, false);
myGrid.addEventListener("enter-select", function(e) {
  console.log('enter pressed', e.detail); // logs: {column: "age", dataIndex: 17}
}, false);

// a way to make an infinite scroll. just load ajax content instead of this dummy
myGrid.addScrollEvent('almostHitBottom', 100); // when to emit
myGrid.addEventListener('almostHitBottom', function(e) {
  myData.push({name: "Dave", age: 27, weight: 90, miscInfo: "is old" });
  testGrid.setData(myData);
}, false);

myGrid.addEventListener('sort', function(e) {
  testGrid.data.sort(sortColumn(e.detail.column, e.detail.state));
  testGrid.refresh();
}, false);

myGrid.addEventListener('resize-column', function(e) {
  console.log(e.detail);
}, false);
```

### Demo
[View demo on plunker](https://embed.plnkr.co/0HapBb/)
