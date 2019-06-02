
/////////////////PLOTLY DATA////////////////////////////
var KnimelyDataProcessor = function () {

    //Created during initialization
    this._columns;
    this._rowColors;
    this._groupByColumnInd;

    //Created during processData step
    this._rowDirectory;
    this._dataArray;

    this.initialize = function (knimeDataTable, groupByColumnInd) {
        var self = this;

        this._columns = knimeDataTable.getColumnNames();
        this._rowColors = knimeDataTable.getRowColors();
        this._groupByColumnInd = this._columns.indexOf(groupByColumnInd);
        this._rowDirectory = {};
        this._dataArray = [];
        this.groupBySet = [];

        knimeDataTable.getRows().forEach(function (row, rowInd) {

            var rowGroup = row.data[self._groupByColumnInd] || 'data';
            var traceIndex = self.groupBySet.indexOf(rowGroup);
            var rowColor = self._rowColors[rowInd] || 'lightblue';

            if (traceIndex < 0) {
                traceIndex = self.groupBySet.push(rowGroup) - 1;
                self._dataArray[traceIndex] = new self.DataObj(rowGroup, self._columns);
            }
            var pInd = self._dataArray[traceIndex].consumeRow(row, rowColor);

            self._rowDirectory[row.rowKey] = {
                tInd: traceIndex,
                pInd: pInd,
                fInd: pInd
            };
        });
        return this;
    };

    this.DataObj = function (name, columns) {
        var self = this;
        this.rowKeys = [];
        this.rowColors = [];
        this.columns = columns;
        this.name = name;

        columns.forEach(function (column) {
            self[column] = [];
        });

        this.consumeRow = function (row, rowColor, start, end) {
            var self = this;
            start = start || 0;
            end = end || row.data.length;

            for (var i = start; i < end; i++) {
                self[self.columns[i]].push(row.data[i]);
            }

            self.rowColors.push(rowColor);
            return self.rowKeys.push(row.rowKey) - 1;
        };

        this.produceColumn = function (columnName) {
            return this[columnName];
        };

        return this;
    };
    return this;
};
/////////////////END PLOTLY DATA////////////////////////////


/* global kt:false */
window.knimeSurface3DPlot = (function () {

    var SurfacePlot = {};

    SurfacePlot.init = function (representation, value) {

        var self = this;
        this.Plotly = arguments[2][0];
        this._representation = representation;
        this._value = value;
        this._table = new kt()
        this._table.setDataTable(representation.inObjects[0]);
        this._columns = this._table.getColumnNames();
        this._columnTypes = this._table.getColumnTypes();
        this._numericColumns = this._columns.filter(function (col, colInd) {
            return self._columnTypes[colInd] === 'number';
        })
        this._knimelyObj = new KnimelyDataProcessor();
        this._knimelyObj.initialize(this._table,
            this._representation.options.groupByColumn);
        this._zAxisCol = this._value.options.zAxisColumn || this._columns[2];
        this._vectorColumns = this._value.options.columns || [];
        this.includedDirectory = [];
        this.orderedIndicies = [];
        this.orderedZData = [];
        this.onFilterChange = this.onFilterChange.bind(this);
        this.colorscale = 'Hot';

        this.createElement();
        this.drawChart();
        this.drawKnimeMenu();
        this.mountAndSubscribe();
        this.collectGarbage();
    };

    SurfacePlot.drawChart = function () {

        if (!knimeService.getGlobalService()) {
            this.createAllInclusiveFilter();
        }

        this.createOrderedIndicies();

        this.Plotly.newPlot('knime-surface',
            this.createTraces(),
            new this.LayoutObject(this._representation, this._value),
            new this.ConfigObject(this._representation, this._value));
    };

    SurfacePlot.createElement = function () {
        //Create the plotly HTML element 
        let div = document.createElement('DIV');
        div.setAttribute('id', 'knime-surface');
        document.body.append(div);
    };

    SurfacePlot.createTraces = function () {
        var self = this;
        var traces = [];
        this._knimelyObj._dataArray.forEach(function (dataObj, objInd) {

            var surfaceData = [self.orderedZData[objInd]];
            self._vectorColumns.forEach(function (numCol) {
                surfaceData.push(self.applyOrderedIndicies(dataObj[numCol], objInd));
            })
            var rowKeys = self.applyOrderedIndicies(dataObj.rowKeys, objInd);
            var trace = new self.TraceObject(surfaceData);

            trace.text = rowKeys;
            trace.name = dataObj.name;
            trace.ids = rowKeys;
            traces.push(trace);

        });
        return traces;
    };

    SurfacePlot.getSVG = function () {
        this.Plotly.toImage(this.Plotly.d3.select('#knime-surface').node(),
            { format: 'svg', width: 800, height: 600 }).then(function (dataUrl) {
                //TODO: decode URI
                return decodeURIComponent(dataUrl)
            })
    }

    SurfacePlot.TraceObject = function (zData) {
        this.z = zData;
        this.type = 'surface';
        this.name = '';
        return this;
    }

    SurfacePlot.LayoutObject = function (rep, val) {
        this.title = {
            text: val.options.title || 'Surface Plot',
            y: 1,
            yref: 'paper',
            yanchor: 'bottom'
        };
        this.showlegend = rep.options.showLegend;
        this.autoSize = true;
        this.legend = {
            x: 1,
            y: 1,
        };
        this.font = {
            size: 12,
            family: 'sans-serif'
        };
        this.scene = {
            camera: {
                eye: {
                    x: 1.5,
                    y: 1.5,
                    z: .5
                }
            },
            zaxis: {
                title: val.options.zAxisLabel ? val.options.zAxisLabel :
                    'z',
                font: {
                    size: 12,
                    family: 'sans-serif'
                },
                type: 'linear',
                showgrid: val.options.showGrid,
                gridcolor: '#fffff', //potential option
                linecolor: '#fffff', //potential option
                linewidth: 1,
                nticks: 10,
            },
            yaxis: {
                title: val.options.yAxisLabel ? val.options.yAxisLabel :
                    'y',
                font: {
                    size: 12,
                    family: 'sans-serif'
                },
                type: 'linear',
                showgrid: val.options.showGrid,
                gridcolor: '#fffff', //potential option
                linecolor: '#fffff', //potential option
                linewidth: 1,
                nticks: 10,
            },
            xaxis: {
                title: val.options.xAxisLabel ? val.options.xAxisLabel :
                    'x',
                font: {
                    size: 12,
                    family: 'sans-serif'
                },
                type: 'linear',
                showgrid: val.options.showGrid,
                gridcolor: '#fffff', //potential option
                linecolor: '#fffff', //potential option
                linewidth: 1,
                nticks: 10,

            }
        };
        this.margin = {
            l: 55,
            r: 20,
            b: 55,
            t: 60,
            pad: 0
        };
        this.hovermode = rep.options.tooltipToggle ? 'closest' : 'none'
        this.paper_bgcolor = rep.options.daColor || '#ffffff';
        this.plot_bgcolor = rep.options.backgroundColor || '#ffffff';
    };

    SurfacePlot.ConfigObject = function (rep, val) {
        this.toImageButtonOptions = {
            format: 'svg', // one of png, svg, jpeg, webp
            filename: 'custom_image',
            height: 600,
            width: 800,
            scale: 1 // Multiply title/legend/axis/canvas sizes by this factor
        };
        this.displaylogo = false;
        this.responsive = true;
        this.editable = rep.options.enableEditing;
        this.scrollZoom = true;
        this.showLink = rep.options.enablePlotlyEditor;
        this.modeBarButtonsToRemove = ['hoverClosestCartesian',
            'hoverCompareCartesian', 'hoverClosest3d'];
        return this;
    };

    SurfacePlot.collectGarbage = function () {
        this._representation.inObjects[0].rows = null;
        this._table.setDataTable(this._representation.inObjects[0]);
    };

    SurfacePlot.createAllInclusiveFilter = function () {
        var self = this;
        self._knimelyObj._dataArray.forEach(function (dataObj, objInd) {
            var filteredIndicies = self.includedDirectory[objInd] || new Set([]);
            for (var i = 0; i < dataObj[self._zAxisCol].length; i++) {
                filteredIndicies.add(i);
            }
            self.includedDirectory[objInd] = filteredIndicies;
        });
    };

    SurfacePlot.mountAndSubscribe = function () {
        this.toggleSubscribeToFilters();
    };

    SurfacePlot.onFilterChange = function (data) {
        this.updateFilter(data);
        var changeObj = this.getFilteredChangeObject();
        this.Plotly.restyle('knime-surface', changeObj);
    };

    SurfacePlot.updateFilter = function (data) {

        if (!data) {
            this.createAllInclusiveFilter();
            return;
        }

        var self = this;

        data.elements.forEach(function (filterElement, filterInd) {
            if (filterElement.type === 'range' && filterElement.columns) {
                for (var col = 0; col < filterElement.columns.length; col++) {
                    var column = filterElement.columns[col];
                    self._knimelyObj._dataArray.forEach(function (dataObj, objInd) {
                        var filteredIndicies = self.includedDirectory[objInd] || new Set([]);
                        dataObj[column.columnName].map(function (colVal, colInd) {
                            if (typeof colVal === 'undefined' || colVal === null) {
                                return;
                            }
                            var included = true;
                            if (column.type === 'numeric') {
                                if (column.minimumInclusive) {
                                    included = included && colVal >= column.minimum;
                                } else {
                                    included = included && colVal > column.minimum;
                                }
                                if (column.maximumInclusive) {
                                    included = included && colVal <= column.maximum;
                                } else {
                                    included = included && colVal < column.maximum;
                                }
                            } else if (column.type === 'nominal') {
                                included = included && column.values.indexOf(colVal) >= 0;
                            }
                            if (!included) {
                                if (filteredIndicies.has(colInd)) {
                                    filteredIndicies.delete(colInd);
                                }
                            } else {
                                if (filterInd > 0 && !filteredIndicies.has(colInd)) {
                                    return;
                                }
                                filteredIndicies.add(colInd);
                            }
                        });
                        self.includedDirectory[objInd] = filteredIndicies;
                    })
                }
            }
        });
    };

    SurfacePlot.getFilteredChangeObject = function (keys, pKeys) {

        var self = this;
        var changeObj = {
            selectedpoints: [],
            z: [],
            text: [],
            ids: [],
        }

        this._knimelyObj._dataArray.forEach(function (dataObj, objInd) {

            var filteredRowKeys = [];
            dataObj.rowKeys.forEach(function (rowKey, rowInd) {
                var included = self.includedDirectory[objInd].has(rowInd);
                if (included) {
                    filteredRowKeys.push(rowKey);
                } else {
                    filteredRowKeys.push(null);
                }
            });
            var orderedAndFilteredRowKeys = [];
            var count = 0;
            for (var i = 0; i < filteredRowKeys.length; i++) {
                var rowKey = filteredRowKeys[self.orderedIndicies[objInd][i]];
                if (rowKey) {
                    var rowObj = self._knimelyObj._rowDirectory[rowKey];
                    orderedAndFilteredRowKeys[count] = rowKey;
                    rowObj.fInd = count;
                    count++;
                } else {
                    continue;
                }
            }

            var orderedAndFilteredZ = [self.applyFilter(dataObj[self._zAxisCol], objInd)];

            self._vectorColumns.forEach(function (col, colInd) {
                if (col) {
                    orderedAndFilteredZ.push(self.applyFilter(dataObj[col], objInd));
                }
            });
            changeObj.z = [orderedAndFilteredZ];
            changeObj.text.push(orderedAndFilteredRowKeys);
            changeObj.ids.push(orderedAndFilteredRowKeys);
        })
        return changeObj;
    };

    SurfacePlot.toggleSubscribeToFilters = function () {
        if (this._value.options.subscribeToFilters) {
            knimeService.subscribeToFilter(
                this._table.getTableId(),
                this.onFilterChange,
                this._table.getFilterIds()
            );
        } else {
            knimeService.unsubscribeFilter(
                this._table.getTableId(),
                this.onFilterChange
            );
        }
    };

    SurfacePlot.createOrderedIndicies = function () {
        var self = this;

        this._knimelyObj._dataArray.forEach(function (dataObj, objInd) {
            var array = dataObj[self._zAxisCol];
            var indicies = [];

            for (var i = 0; i < array.length; i++) {
                indicies.push(i);
            }

            var mergeSort = function (subArr, indArr) {
                if (subArr.length <= 1) {
                    return [subArr, indArr];
                }

                var centInd = Math.floor(subArr.length / 2);
                var leftArr = subArr.slice(0, centInd);
                var rightArr = subArr.slice(centInd);
                var lIndArr = indArr.slice(0, centInd);
                var rIndArr = indArr.slice(centInd);

                var lSortArr = mergeSort(leftArr, lIndArr);
                var rSortArr = mergeSort(rightArr, rIndArr);
                return merge(lSortArr, rSortArr);
            }

            var merge = function (lArr, rArr) {
                var sortedArr = [];
                var sortedInd = [];
                var lInd = 0;
                var rInd = 0;

                while (lInd < lArr[0].length && rInd < rArr[0].length) {
                    if (lArr[0][lInd] < rArr[0][rInd]) {
                        sortedArr.push(lArr[0][lInd]);
                        sortedInd.push(lArr[1][lInd]);
                        lInd++;
                    } else {
                        sortedArr.push(rArr[0][rInd]);
                        sortedInd.push(rArr[1][rInd]);
                        rInd++;
                    }
                }

                return [sortedArr.concat(lArr[0].slice(lInd)).concat(rArr[0].slice(rInd)),
                sortedInd.concat(lArr[1].slice(lInd)).concat(rArr[1].slice(rInd))];
            }

            var xYz = mergeSort(array, indicies);
            self.orderedZData[objInd] = xYz[0];
            self.orderedIndicies[objInd] = xYz[1];

            var orderedRows = self.applyOrderedIndicies(dataObj.rowKeys, objInd);

            orderedRows.forEach(function (rowKey, pointInd) {
                self._knimelyObj._rowDirectory[rowKey].fInd = pointInd;
            })
        })
    };

    SurfacePlot.applyOrderedIndicies = function (array, objInd) {
        var orderedData = [];

        for (var i = 0; i < array.length; i++) {
            orderedData[i] = array[this.orderedIndicies[objInd][i]];
        }

        return orderedData.filter(function (val) { return (val === 0 || val) });
    };

    SurfacePlot.applyFilter = function (array, objInd) {
        var self = this;
        var filteredArr = [];
        array.map(function (val, valInd) {
            var included = self.includedDirectory[objInd].has(valInd);
            if (self.showOnlySelected && included && self._selected.length > 0) {
                included = self.selectedDirectory[objInd].has(valInd);
            }
            if (included) {
                filteredArr.push(val);
            } else {
                filteredArr.push(null);
            }
        });
        return this.applyOrderedIndicies(filteredArr, objInd);
    };

    SurfacePlot.drawKnimeMenu = function () {

        var self = this;

        if (this._representation.options.enableViewControls) {

            if (this._representation.options.enableFeatureSelection) {
                var zAxisSelection = knimeService.createMenuSelect(
                    'z-axis-menu-item',
                    self._columns.indexOf(self._zAxisCol),
                    this._columns,
                    function () {
                        if (self._zAxisCol !== this.value) {
                            self._zAxisCol = this.value;
                            self.createOrderedIndicies();
                            var changeObj = self.getFilteredChangeObject();
                            self.Plotly.restyle('knime-surface', changeObj);
                        }
                    }
                );

                knimeService.addMenuItem(
                    'Z-Axis',
                    'z',
                    zAxisSelection,
                    null,
                    knimeService.SMALL_ICON
                );

                // temporarily use controlContainer to solve th resizing problem with ySelect
                var controlContainer = this.Plotly.d3.select('#knime-surface').insert('table', '#radarContainer ~ *')
                    .attr('id', 'surfaceControls')
                    /*.style('width', '100%')*/
                    .style('padding', '10px')
                    .style('margin', '0 auto')
                    .style('box-sizing', 'border-box')
                    .style('font-family', 'san-serif')
                    .style('font-size', 12 + 'px')
                    .style('border-spacing', 0)
                    .style('border-collapse', 'collapse');
                var columnChangeContainer = controlContainer.append('tr');
                var columnSelect = new twinlistMultipleSelections();
                var columnSelectComponent = columnSelect.getComponent().get(0);
                columnChangeContainer.append('td').attr('colspan', '3').node().appendChild(columnSelectComponent);
                columnSelect.setChoices(this._numericColumns);
                columnSelect.setSelections(this._vectorColumns);
                columnSelect.addValueChangedListener(function () {
                    var newSelected = columnSelect.getSelections();

                    self._vectorColumns = newSelected;
                    var changeObj = self.getFilteredChangeObject();

                    self.Plotly.restyle('knime-surface', changeObj);
                });
                knimeService.addMenuItem('Vectors:', 'long-arrow-up', columnSelectComponent);
                controlContainer.remove();

                knimeService.addMenuDivider();
            }

            if (this._representation.options.showSurfaceColorOptions) {
                var colorScaleSelection = knimeService.createMenuSelect(
                    'colorscale-menu-item',
                    0,
                    ['Hot', 'Greys', 'YlGnBu', 'Greens', 'YlOrRd', 'Bluered', 'RdBu', 'Reds', 'Blues',
                        'Picnic', 'Rainbow', 'Portland', 'Jet', 'Blackbody', 'Earth',
                        'Electric', 'Viridis', 'Cividis.'],
                    function () {
                        if (self.colorscale !== this.value) {
                            self.colorscale = this.value;
                            var changeObj = {
                                colorscale: [self.colorscale]
                            }
                            self.Plotly.restyle('knime-surface', changeObj);
                        }
                    }
                );

                knimeService.addMenuItem(
                    'Surface color',
                    'palette',
                    colorScaleSelection,
                    null,
                    knimeService.SMALL_ICON
                );

                knimeService.addMenuDivider();
            }

            if (this._representation.options.tooltipToggle) {

                var tooltipToggleCheckBox = knimeService.createMenuCheckbox(
                    'show-tooltips-checkbox',
                    this._representation.options.tooltipToggle,
                    function () {
                        if (self._representation.options.tooltipToggle !== this.checked) {
                            self._representation.options.tooltipToggle = this.checked;
                            var layoutObj = {
                                hovermode: self._representation.options.tooltipToggle ?
                                    'closest' : false
                            };
                            self.Plotly.relayout('knime-surface', layoutObj);
                        }
                    },
                    true
                );

                knimeService.addMenuItem(
                    'Show tooltips',
                    'info',
                    tooltipToggleCheckBox,
                    null,
                    knimeService.SMALL_ICON
                );

                knimeService.addMenuDivider();

            }

            if (this._representation.options.subscribeFilterToggle) {

                var subscribeToFilterCheckbox = knimeService.createMenuCheckbox(
                    'subscribe-to-filter-checkbox',
                    this._value.options.subscribeToFilters,
                    function () {
                        if (self._value.options.subscribeToFilters !== this.checked) {
                            self._value.options.subscribeToFilters = this.checked;
                            self.toggleSubscribeToFilters();
                        }
                    },
                    true
                );

                knimeService.addMenuItem(
                    'Subscribe to Filter',
                    knimeService.createStackedIcon('filter',
                        'angle-double-right', 'faded right sm', 'left bold'),
                    subscribeToFilterCheckbox,
                    null,
                    knimeService.SMALL_ICON
                );
            }
        }
    };

    return SurfacePlot;

})();