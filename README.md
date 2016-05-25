# data-grid
**What is it?**
Worlds most efficient and smooth big data grid.
Has the most essential features without redundant bloat.

**Why?**
Because most of the time you need to display data. Show the user a grid of data so he can browse it quickly.
No need for heavy features that will slow down the website and will make the grid stutter.
Simple as that.

### Usage
Initiate a grid with `new storkGrid(options)`. This will return a grid object for further adjusting the grid later.

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

_rowHeight_ [optional]: the height of each row. defaults to 32px. Example:
`{ rowHeight: 34px }`

_headerHeight_ [optional]: the height of the table headers (the column names). defaults to _rowHeight_. Example:
`{ headerHeight: 34px }`

_selection_ [optional]: an Object with properties defining how selections on the grid are done.
- _selection.multi_: whether the user can select multiple values from the grid or not. defaults to _False_. Example:
- `{ selection: { multi: true } }`
- _selection.type_: what type of element can the user select - a whole _row_ or a single _cell_. defaults to _"row"_. Example:
- `{ selection: { type: "cell" } }`

_trackBy_ [optional]: the column which the grid should keep track of its content by (index). defaults to _null_. Example:
`{ trackBy: "age" }`

_columns_ [optional]: an Array of Object. Every item in the array defines a column.
- _columns.dataName_: the key that the column will look for in the data object.
- _columns.displayName_: the display name of the column (the text in the table headers).
- _columns.width_: a user defined width for the column.
Example:
```javascript
{ columns: [
  { dataName: 'name', displayName: 'Full Name', width: 75 },
  { dataName: 'age', displayName: 'Age' },
  { dataName: 'weight', displayName: 'Weight (kg)', width: 60 }
] }
```

#### Methods
_setRowHeight(height)_: sets the height of each row. arguments: _height_ {integer}.

_setHeaderHeight(height)_: sets the height of the header. arguments: _height_ {integer}.

_addEventListener(type, listener, optionsUseCapture)_: adds an event listener to the DOM Element of the grid.
arguments: _type_ {string}, listener {function}, optionsUseCapture {boolean|object}. Example:
```javascript
myGrid.addEventListener("select", function(e) {
  console.log(e.detail); // logs: {column: "age", dataIndex: 17}
}, false);
```


#### Events
_select_: when the user selected something from the grid. this event has a _detail_ containing the selected column and the index of the selected data. Example:
```javascript
myGrid.addEventListener("select", function(e) {
  console.log(e.detail); // logs: {column: "age", dataIndex: 17}
});
```

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

myGrid = new storkGrid({
  element: document.getElementById('my_grid'),
  data: myData,
  rowHeight: 30,
  headerHeight: 50,
  selection: {
    multi: false,
    type: 'row'
  },
  columns: [
    { dataName: 'name', displayName: 'Full Name', width: 75 },
    { dataName: 'age', displayName: 'Age' },
    { dataName: 'weight', displayName: 'Weight (kg)', width: 60 }
  ],
  trackBy: 'age'
});

myGrid.addEventListener("select", function(e) {
  console.log(e.detail); // logs: {column: "age", dataIndex: 17}
}, false);
```