/////////////////PLOTLY DATA////////////////////////////
var KnimelyDataProcessor = function () {

    //Created during initialization
    this._columns;
    this._rowColors;
    this._groupByColumnInd;

    //Created during processData step
    this._rowDirectory;
    this._dataArray;

    this.initialize = function (knimeDataTable, groupByColumn) {
        var self = this;

        this._columns = knimeDataTable.getColumnNames();
        this._rowColors = knimeDataTable.getRowColors();
        this._groupByColumnInd = this._columns.indexOf(groupByColumn);
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
window.knimeDensity2D = (function () {

    var Density2D = {};

    Density2D.init = function (representation, value) {

        this.Plotly = arguments[2][0];
        this._representation = representation;
        this._value = value;
        this._table = new kt()
        this._table.setDataTable(representation.inObjects[0]);
        this._columns = this._table.getColumnNames();
        this._knimelyObj = new KnimelyDataProcessor();
        this._knimelyObj.initialize(this._table,
            this._representation.options.groupByColumn || '');
        this._xAxisCol = this._value.options.xAxisColumn || this._columns[0];
        this._yAxisCol = this._value.options.yAxisColumn || this._columns[1];
        this._selected = [];
        this.includedDirectory = [];
        this.selectedDirectory = [];
        this.onSelectionChange = this.onSelectionChange.bind(this);
        this.onFilterChange = this.onFilterChange.bind(this);
        this.showOnlySelected = false;
        this.totalSelected = 0;
        this.colorscale = 'Hot';

        this.createElement();
        this.drawChart();
        this.drawKnimeMenu();
        this.mountAndSubscribe();
        this.collectGarbage();
    };

    Density2D.drawChart = function () {

        if (!knimeService.getGlobalService()) {
            this.createAllInclusiveFilter();
        }

        this.createAllExclusiveSelected();

        this.Plotly.newPlot('knime-density2D',
            this.createTraces(),
            new this.LayoutObject(this._representation, this._value),
            new this.ConfigObject(this._representation, this._value));
    };

    Density2D.createElement = function () {
        // Create the plotly HTML element
        let div = document.createElement('DIV');
        div.setAttribute('id', 'knime-density2D');
        document.body.append(div);
    };

    Density2D.createTraces = function () {
        var self = this;
        var dataObj = this._knimelyObj._dataArray[0];
        var traces = [];
        var trace = new self.ScatterTraceObject(dataObj[self._xAxisCol],
            dataObj[self._yAxisCol]);
        trace.marker.color = dataObj.rowColors;
        trace.text = dataObj.rowKeys;
        trace.name = dataObj.name;
        trace.ids = dataObj.rowKeys;
        traces.push(trace);

        var densityTrace = new self.DensityTraceObject(dataObj[self._xAxisCol],
            dataObj[self._yAxisCol]);
        densityTrace.ids = dataObj.rowKeys;
        traces.push(densityTrace);

        var xHistTrace = new self.XHistogramTraceObject(dataObj[self._xAxisCol]);
        xHistTrace.ids = dataObj.rowKeys;
        traces.push(xHistTrace);

        var yHistTrace = new self.YHistogramTraceObject(dataObj[self._yAxisCol]);
        yHistTrace.ids = dataObj.rowKeys;
        traces.push(yHistTrace);

        return traces;
    };

    Density2D.getSVG = function () {
        this.Plotly.toImage(this.Plotly.d3.select('#knime-density2D').node(),
            { format: 'svg', width: 800, height: 600 }).then(function (dataUrl) {
                // TODO: decode URI
                return decodeURIComponent(dataUrl);
            });
    };

    Density2D.ScatterTraceObject = function (xData, yData) {
        this.x = xData;
        this.y = yData;
        this.mode = 'markers';
        this.name = 'points';
        this.marker = {
            size: 4,
            opacity: 0.4
        };
        this.type = 'scatter';
        this.unselected = {
            markers: {
                opacity: .1
            }
        };
        this.selected = {
            markers: {
                opacity: 1
            }
        };
        return this;
    };

    Density2D.DensityTraceObject = function (xData, yData) {
        this.x = xData;
        this.y = yData;
        this.name = 'density';
        this.ncontours = 20;
        this.colorscale = 'Hot';
        this.reversescale = true;
        this.showscale = false;
        this.type = 'histogram2dcontour';
        return this;
    };

    Density2D.XHistogramTraceObject = function (xData) {
        this.x = xData;
        this.name = 'x density';
        this.marker = { color: 'rgb(102,0,0)' };
        this.yaxis = 'y2';
        this.type = 'histogram';
        return this;
    };

    Density2D.YHistogramTraceObject = function (yData) {
        this.y = yData;
        this.name = 'y density';
        this.marker = { color: 'rgb(102,0,0)' };
        this.xaxis = 'x2';
        this.type = 'histogram';
        return this;
    };

    Density2D.LayoutObject = function (rep, val) {
        this.title = {
            text: val.options.title || '2D Density Plot',
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
        this.bargap = 0;
        this.xaxis = {
            title: val.options.xAxisLabel ? val.options.xAxisLabel : val.options.xAxisColumn,
            font: {
                size: 12,
                family: 'sans-serif'
            },
            domain: [0, 0.84],
            type: 'linear',
            showgrid: false,
            gridcolor: '#fffff', //potential option
            linecolor: '#fffff', //potential option
            linewidth: 1,
            nticks: 10,

        };
        this.yaxis = {
            title: val.options.yAxisLabel ? val.options.yAxisLabel : val.options.yAxisColumn,
            font: {
                size: 12,
                family: 'sans-serif'
            },
            domain: [0, 0.84],
            type: 'linear',
            showgrid: false,
            gridcolor: '#fffff', //potential option
            linecolor: '#fffff', //potential option
            linewidth: 1,
            nticks: 10,
        };
        this.xaxis2 = {
            title: '',
            domain: [0.85, 1],
            showgrid: false,
            zeroline: false
        };
        this.yaxis2 = {
            title: '',
            domain: [0.85, 1],
            showgrid: false,
            zeroline: false
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

    Density2D.ConfigObject = function (rep, val) {
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
            'hoverCompareCartesian'];
        return this;
    };

    Density2D.collectGarbage = function () {
        this._representation.inObjects[0].rows = null;
        this._table.setDataTable(this._representation.inObjects[0]);
    };

    Density2D.createAllInclusiveFilter = function () {
        var self = this;
        self._knimelyObj._dataArray.forEach(function (dataObj, objInd) {
            var filteredIndicies = self.includedDirectory[objInd] || new Set([]);
            for (var i = 0; i < dataObj[self._xAxisCol].length; i++) {
                filteredIndicies.add(i);
            }
            self.includedDirectory[objInd] = filteredIndicies;
        });
    };

    Density2D.createAllExclusiveSelected = function () {
        var self = this;
        this._knimelyObj._dataArray.forEach(function (dataObj, objInd) {
            self.selectedDirectory[objInd] = new Set([]);
        });
    };

    Density2D.mountAndSubscribe = function () {
        var self = this;
        document.getElementById('knime-density2D').on('plotly_selected', function (plotlyEvent) {
            self.onSelectionChange(plotlyEvent);
        });
        document.getElementById('knime-density2D').on('plotly_deselect', function () {
            self.onSelectionChange({ points: [] });
        });
        this.togglePublishSelection();
        this.toggleSubscribeToFilters();
        this.toggleSubscribeToSelection();
    };

    Density2D.onSelectionChange = function (data) {
        this.updateSelected(data);
        var changeObj;
        if (this.showOnlySelected) {
            changeObj = this.getFilteredChangeObject(
                [this._xAxisCol, this._yAxisCol, 'rowColors', 'rowKeys', 'rowKeys'],
                ['x', 'y', 'marker.color', 'text', 'ids']
            );
            changeObj['y'] = [changeObj['y'][0], changeObj['y'][0], null, changeObj['y'][0]];
            changeObj['x'] = [changeObj['x'][0], changeObj['x'][0], changeObj['x'][0], null];
        } else {
            changeObj = this.getSelectedChangeObject();
        }
        this.Plotly.restyle('knime-density2D', changeObj);

    };

    Density2D.onFilterChange = function (data) {
        this.updateFilter(data);
        var changeObj = this.getFilteredChangeObject(
            [this._xAxisCol, this._yAxisCol, 'rowColors', 'rowKeys', 'rowKeys'],
            ['x', 'y', 'marker.color', 'text', 'ids']
        );
        changeObj['y'] = [changeObj['y'][0], changeObj['y'][0], null, changeObj['y'][0]];
        changeObj['x'] = [changeObj['x'][0], changeObj['x'][0], changeObj['x'][0], null];
        this.Plotly.restyle('knime-density2D', changeObj);
    };

    Density2D.updateSelected = function (data) {
        var self = this;

        if (!data) {
            return;
        }

        this._selected = [];
        this.totalSelected = 0;
        this.createAllExclusiveSelected();

        if (data.points) { // this is for Plotly events

            if (data.range && (data.range.x2 || data.range.y2)) {
                data.points.forEach(function (pt) {
                    var ptRowKeys = pt.fullData.ids;
                    pt.pointIndices.forEach(function (ptInd) {
                        var rowKey = ptRowKeys[ptInd];
                        self._selected.push(rowKey);
                        self.selectedDirectory[0].add(self._knimelyObj._rowDirectory[rowKey].pInd);
                        self.totalSelected++;
                    });
                });
            } else {
                data.points.forEach(function (pt) {
                    var rowObj = self._knimelyObj._rowDirectory[pt.text];
                    self.selectedDirectory[pt.curveNumber].add(rowObj.pInd);
                    self._selected.push(pt.text);
                    self.totalSelected++;
                });
            }

            if (self._value.options.publishSelection && knimeService.getGlobalService()) {
                knimeService.setSelectedRows(
                    this._table.getTableId(),
                    this._selected,
                    this.onSelectionChange
                );
            }

        } else { // this is for incoming knime events

            this._selected = knimeService.getAllRowsForSelection(
                this._table.getTableId()
            );

            this._selected.forEach(function (rowKey) {
                var rowObj = self._knimelyObj._rowDirectory[rowKey];
                if (rowObj !== undefined) { //only == undef with two different data sets 
                    self.selectedDirectory[rowObj.tInd].add(rowObj.pInd);
                    self.totalSelected++;
                }
            });
        }
    };

    Density2D.updateFilter = function (data) {

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

    Density2D.getSelectedChangeObject = function (filteredObj) {
        var self = this;
        var changeObj = filteredObj || this.getEmptyChangeObject(['selectedpoints']);

        // possible optimization.
        this._knimelyObj._dataArray.forEach(function (dataObj, objInd) {
            var selPtInd = [];
            dataObj.rowKeys.forEach(function (rowKey, rowInd) {
                var rowObj = self._knimelyObj._rowDirectory[rowKey];
                if (self.selectedDirectory[objInd].has(rowInd)) {
                    selPtInd.push(rowObj.fInd);
                }
            });
            changeObj['selectedpoints'][objInd] = self.totalSelected < 1 ? null : selPtInd;
        });

        return changeObj;
    };

    Density2D.getFilteredChangeObject = function (keys, pKeys) {

        var self = this;
        var changeObj = this.getEmptyChangeObject(pKeys);
        changeObj['selectedpoints'] = [];

        this._knimelyObj._dataArray.forEach(function (dataObj, objInd) {
            keys.forEach(function (key, keyInd) {
                var count = 0;
                changeObj[pKeys[keyInd]][objInd] = dataObj[key].filter(function (val, valInd) {
                    var included = self.includedDirectory[objInd].has(valInd);
                    if (self.showOnlySelected && included && self._selected.length > 0) {
                        included = self.selectedDirectory[objInd].has(valInd);
                    }
                    if (included) {
                        self._knimelyObj._rowDirectory[dataObj.rowKeys[valInd]].fInd = count;
                        count++;
                    } else {
                        self._knimelyObj._rowDirectory[dataObj.rowKeys[valInd]].fInd = -1;
                    }
                    return included;
                });
            });
            changeObj['selectedpoints'][objInd] = [];
        });

        changeObj = this.getSelectedChangeObject(changeObj);

        return changeObj;
    };

    Density2D.getEmptyChangeObject = function (pKeys) {
        var self = this;
        var changeObj = {};
        pKeys.forEach(function (pKey) {
            changeObj[pKey] = self._knimelyObj._dataArray.map(function () {
                return [];
            });
        });
        return changeObj;
    };

    Density2D.toggleSubscribeToFilters = function () {
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

    Density2D.toggleSubscribeToSelection = function () {
        if (this._value.options.subscribeToSelection) {
            knimeService.subscribeToSelection(
                this._table.getTableId(),
                this.onSelectionChange
            );
        } else {
            knimeService.unsubscribeSelection(
                this._table.getTableId(),
                this.onSelectionChange
            );
        }
    };

    Density2D.togglePublishSelection = function () {
        if (this._value.options.publishSelection) {
            knimeService.setSelectedRows(
                this._table.getTableId(),
                this._selected
            );
        }
    };

    Density2D.toggleShowOnlySelected = function () {
        var changeObj = this.getFilteredChangeObject(
            [this._xAxisCol, this._yAxisCol, 'rowColors', 'rowKeys', 'rowKeys'],
            ['x', 'y', 'marker.color', 'text', 'ids']
        );
        changeObj['y'] = [changeObj['y'][0], changeObj['y'][0], null, changeObj['y'][0]];
        changeObj['x'] = [changeObj['x'][0], changeObj['x'][0], changeObj['x'][0], null];

        this.Plotly.restyle('knime-density2D', changeObj);
    };

    Density2D.drawKnimeMenu = function () {

        var self = this;

        if (this._representation.options.enableViewControls) {

            if (this._representation.options.enableSelection &&
                this._representation.options.showClearSelectionButton) {
                knimeService.addButton(
                    'clear-selection-button',
                    'minus-square',
                    'Clear Selection',
                    function () {
                        self.onSelectionChange({ points: [] });
                    }
                );
            }

            if (this._representation.options.enableFeatureSelection) {
                var xAxisSelection = knimeService.createMenuSelect(
                    'x-axis-menu-item',
                    this._columns.indexOf(this._xAxisCol),
                    this._columns,
                    function () {
                        if (self._xAxisCol !== this.value) {
                            self._xAxisCol = this.value;
                            var changeObj = self.getFilteredChangeObject([self._xAxisCol], ['x']);
                            changeObj['x'] = [changeObj['x'][0], changeObj['x'][0], changeObj['x'][0], null];
                            var layoutObj = {
                                'xaxis.title': self._xAxisCol
                            };
                            self.Plotly.update('knime-density2D', changeObj, layoutObj);
                        }
                    }
                );

                knimeService.addMenuItem(
                    'X-Axis',
                    'x',
                    xAxisSelection,
                    null,
                    knimeService.SMALL_ICON
                );

                var yAxisSelection = knimeService.createMenuSelect(
                    'y-axis-menu-item',
                    this._columns.indexOf(this._yAxisCol),
                    this._columns,
                    function () {
                        if (self._yAxisCol !== this.value) {
                            self._yAxisCol = this.value;
                            var changeObj = self.getFilteredChangeObject([self._yAxisCol], ['y']);
                            changeObj['y'] = [changeObj['y'][0], changeObj['y'][0], null, changeObj['y'][0]];
                            var layoutObj = {
                                'yaxis.title': self._yAxisCol
                            };
                            self.Plotly.update('knime-density2D', changeObj, layoutObj);
                        }
                    }
                );

                knimeService.addMenuItem(
                    'Y-Axis',
                    'y',
                    yAxisSelection,
                    null,
                    knimeService.SMALL_ICON
                );

                knimeService.addMenuDivider();
            }

            if (this._representation.options.showDensityColorOptions) {
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
                                colorscale: [null, self.colorscale, null, null]
                            };
                            self.Plotly.restyle('knime-density2D', changeObj);
                        }
                    }
                );

                knimeService.addMenuItem(
                    'Density color',
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
                                hovermode: self._representation.options.tooltipToggle ? 'closest' : false
                            };
                            self.Plotly.relayout('knime-density2D', layoutObj);
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

            if (this._representation.options.showSelectedOnlyToggle) {

                var showOnlySelectedCheckbox = knimeService.createMenuCheckbox(
                    'show-only-selected-checkbox',
                    this.showOnlySelected,
                    function () {
                        if (self.showOnlySelected !== this.checked) {
                            self.showOnlySelected = this.checked;
                            self.toggleShowOnlySelected();
                        }
                    },
                    true
                );

                knimeService.addMenuItem(
                    'Show Only Selected',
                    'filter',
                    showOnlySelectedCheckbox,
                    null,
                    knimeService.SMALL_ICON
                );

                knimeService.addMenuDivider();

            }

            if (this._representation.options.enableSelection &&
                this._representation.options.publishSelectionToggle) {

                var publishSelectionCheckbox = knimeService.createMenuCheckbox(
                    'publish-selection-checkbox',
                    this._value.options.publishSelection,
                    function () {
                        if (self._value.options.publishSelection !== this.checked) {
                            self._value.options.publishSelection = this.checked;
                            self.togglePublishSelection();
                        }
                    },
                    true
                );

                knimeService.addMenuItem(
                    'Publish Selection',
                    knimeService.createStackedIcon('check-square-o',
                        'angle-right', 'faded left sm', 'right bold'),
                    publishSelectionCheckbox,
                    null,
                    knimeService.SMALL_ICON
                );

            }

            if (this._representation.options.subscribeSelectionToggle) {

                var subscribeToSelectionCheckbox = knimeService.createMenuCheckbox(
                    'subscribe-to-selection-checkbox',
                    this._value.options.subscribeToSelection,
                    function () {
                        if (self._value.options.subscribeToSelection !== this.checked) {
                            self._value.options.subscribeToSelection = this.checked;
                            self.toggleSubscribeToSelection();
                        }
                    },
                    true
                );

                knimeService.addMenuItem(
                    'Subscribe to Selection',
                    knimeService.createStackedIcon('check-square-o',
                        'angle-double-right', 'faded right sm', 'left bold'),
                    subscribeToSelectionCheckbox,
                    null,
                    knimeService.SMALL_ICON
                );
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

    return Density2D;

})();
