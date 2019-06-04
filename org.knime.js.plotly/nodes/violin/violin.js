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
window.knimeViolin = (function () {

    var ViolinPlot = {};

    ViolinPlot.init = function (representation, value) {

        var self = this;
        this.Plotly = arguments[2][0];
        this._representation = representation;
        this._value = value;
        this._table = new kt();
        this._table.setDataTable(representation.inObjects[0]);
        this._columns = this._table.getColumnNames();
        this._columnTypes = this._table.getColumnTypes();
        this._numericColumns = this._columns.filter(function (c, i) {
            return self._columnTypes[i] === 'number';
        });
        this._knimelyObj = new KnimelyDataProcessor();
        this._knimelyObj.initialize(this._table, 'this._representation.options.groupByColumn');
        this._axisCol = this._value.options.axisColumn || this._columns[0];
        this._groupByCol = this._representation.options.groupByColumn || 'Data Set';
        this._selected = [];
        this.includedDirectory = [];
        this.selectedDirectory = [];
        this.plotlyNumColKey = this._value.options.plotDirection === 'Vertical' ? 'y' : 'x';
        this.plotlyGroupColKey = this._value.options.plotDirection === 'Vertical' ? 'x' : 'y';
        this.onSelectionChange = this.onSelectionChange.bind(this);
        this.onFilterChange = this.onFilterChange.bind(this);
        this.createTraces = this.createTraces.bind(this);
        this.TraceObject = this.TraceObject.bind(this);
        this.showOnlySelected = false;
        this.totalSelected = 0;

        this.createElement();
        this.drawChart();
        this.drawKnimeMenu();
        this.mountAndSubscribe();
        this.collectGarbage();
    };

    ViolinPlot.drawChart = function () {

        if (!knimeService.getGlobalService()) {
            this.createAllInclusiveFilter();
        }

        this.createAllExclusiveSelected();

        this.Plotly.newPlot('knime-violin',
            this.createTraces(),
            new this.LayoutObject(this._representation, this._value),
            new this.ConfigObject(this._representation, this._value)
        );
    };

    ViolinPlot.createElement = function () {
        // Create the plotly HTML element
        let div = document.createElement('div');
        div.setAttribute('id', 'knime-violin');
        document.body.append(div);
    };

    ViolinPlot.createTraces = function () {
        var self = this;
        var traces = this._knimelyObj._dataArray.map(function (dataObj) {
            var trace = new self.TraceObject(dataObj[self._axisCol], self, dataObj[self._groupByCol],
                dataObj.rowColors);
            trace.text = dataObj.rowKeys;
            trace.name = dataObj.name;
            trace.ids = dataObj.rowKeys;
            return trace;
        });
        return traces;
    };

    ViolinPlot.getSVG = function () {
        this.Plotly.toImage(this.Plotly.d3.select('#knime-violin').node(),
            { format: 'svg', width: 800, height: 600 }).then(function (dataUrl) {
                // TODO: decode URI
                return decodeURIComponent(dataUrl);
            });
    };

    ViolinPlot.TraceObject = function (numData, self, groupData, colors) {
        var style = [];
        var groupSet = new Set([]);
        var groupColors = new Map([]);
        groupData.forEach(function (group, gInd) {
            if (!groupSet.has(group)) {
                groupSet.add(group);
                var gColorMap = new Map([]);
                gColorMap.set(colors[gInd], 1);
                groupColors.set(group, gColorMap);
            } else {
                var gColorMap = groupColors.get(group);
                var count = gColorMap.has(colors[gInd]) ? gColorMap.get(colors[gInd]) + 1 : 1;
                gColorMap.set(colors[gInd], count);
                groupColors.set(group, gColorMap);
            }
        });

        Array.from(groupSet).forEach(function (group) {
            var min = 0;
            var color = '#8dd3c7';
            groupColors.get(group).forEach(function (value, key) {
                if (value > min) {
                    min = value;
                    color = key;
                }
            });
            style.push({
                target: group,
                value: {
                    line: {
                        color: color
                    }
                }
            });
        });
        this.x = self._value.options.plotDirection === 'Vertical' ? groupData : numData;
        this.y = self._value.options.plotDirection === 'Vertical' ? numData : '0';
        this.type = 'violin';
        this.points = 'none';
        this.box = {
            visible: true
        };
        this.meanline = {
            visible: true
        };
        this.line = {
            color: 'green'
        };
        this.transforms = [{
            type: 'groupby',
            groups: groupData,
            styles: style
        }];

        return this;
    };

    ViolinPlot.LayoutObject = function (rep, val) {
        var groupedColLabel = rep.options.groupedAxisLabel || rep.options.groupByColumn;
        var numericColLabel = val.options.numAxisLabel || val.options.axisColumn;
        this.title = {
            text: val.options.title || 'Violin Plot',
            y: 1,
            yref: 'paper',
            yanchor: 'bottom'
        };
        this.showlegend = rep.options.showLegend;
        this.autoSize = true;
        this.legend = {
            x: 1,
            y: 1
        };
        this.font = {
            size: 12,
            family: 'sans-serif'
        };
        this.xaxis = {
            title: val.options.plotDirection === 'Vertical' ? groupedColLabel : numericColLabel,
            font: {
                size: 12,
                family: 'sans-serif'
            },
            showgrid: val.options.plotDirection === 'Vertical' ? false : val.options.showGrid,
            gridcolor: '#fffff', // potential option
            linecolor: '#fffff', // potential option
            linewidth: 1,
            zeroline: val.options.plotDirection === 'Vertical' ? val.options.showGrid : false
        };
        this.yaxis = {
            title: val.options.plotDirection === 'Vertical' ? numericColLabel : groupedColLabel,
            font: {
                size: 12,
                family: 'sans-serif'
            },
            showgrid: val.options.plotDirection === 'Vertical' ? val.options.showGrid : false,
            gridcolor: '#fffff', // potential option
            linecolor: '#fffff', // potential option
            linewidth: 1,
            zeroline: val.options.plotDirection === 'Vertical' ? false : val.options.showGrid
        };
        this.margin = {
            l: val.options.plotDirection === 'Vertical' ? 55 : 90,
            r: 20,
            b: 55,
            t: 60,
            pad: 0
        };
        this.hovermode = rep.options.tooltipToggle ? 'closest' : 'none'
        this.paper_bgcolor = rep.options.daColor || '#ffffff';
        this.plot_bgcolor = rep.options.backgroundColor || '#ffffff';
        return this;
    };

    ViolinPlot.ConfigObject = function (rep, val) {
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
        this.modeBarButtonsToRemove = ['hoverClosestCartesian', 'hoverCompareCartesian'];
        return this;
    };

    ViolinPlot.collectGarbage = function () {
        this._representation.inObjects[0].rows = null;
        this._table.setDataTable(this._representation.inObjects[0]);
    };

    ViolinPlot.createAllInclusiveFilter = function () {
        var self = this;
        self._knimelyObj._dataArray.forEach(function (dataObj, objInd) {
            var filteredIndicies = self.includedDirectory[objInd] || new Set([]);
            for (var i = 0; i < dataObj[self._axisCol].length; i++) {
                filteredIndicies.add(i);
            }
            self.includedDirectory[objInd] = filteredIndicies;
        });
    };

    ViolinPlot.createAllExclusiveSelected = function () {
        var self = this;
        this._knimelyObj._dataArray.forEach(function (dataObj, objInd) {
            self.selectedDirectory[objInd] = new Set([]);
        });
    };

    ViolinPlot.mountAndSubscribe = function () {
        var self = this;
        document.getElementById('knime-violin').on('plotly_selected', function (plotlyEvent) {
            self.onSelectionChange(plotlyEvent);
        });
        document.getElementById('knime-violin').on('plotly_deselect', function () {
            self.onSelectionChange({ points: [] });
        });
        this.togglePublishSelection();
        this.toggleSubscribeToFilters();
        this.toggleSubscribeToSelection();
    };

    ViolinPlot.onSelectionChange = function (data) {
        this.updateSelected(data);
        if (knimeService.getGlobalService()) { // prevents boxes going away in single view
            var changeObj;
            if (this.showOnlySelected) {
                var changeObj = this.getFilteredChangeObject(
                    [this._axisCol, this._groupByCol, 'rowKeys', 'rowKeys', 'rowColors'],
                    [this.plotlyNumColKey, this.plotlyGroupColKey, 'text', 'ids', 'rowColors']
                );

            } else {
                changeObj = this.getSelectedChangeObject();
            }
            this.Plotly.restyle('knime-violin', changeObj);
        }
    };

    ViolinPlot.onFilterChange = function (data) {
        this.updateFilter(data);
        var changeObj = this.getFilteredChangeObject(
            [this._axisCol, this._groupByCol, 'rowKeys', 'rowKeys', 'rowColors'],
            [this.plotlyNumColKey, this.plotlyGroupColKey, 'text', 'ids', 'rowColors']
        );

        this.Plotly.restyle('knime-violin', changeObj);
    };

    ViolinPlot.updateSelected = function (data) {
        var self = this;

        if (!data) {
            return;
        }

        this._selected = [];
        this.totalSelected = 0;
        this.createAllExclusiveSelected();

        if (data.points) { // this is for Plotly events

            data.points.forEach(function (pt) {
                var rowObj = self._knimelyObj._rowDirectory[pt.text];
                self.selectedDirectory[pt.curveNumber].add(rowObj.pInd);
                self._selected.push(pt.text);
                self.totalSelected++;
            });

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

    ViolinPlot.updateFilter = function (data) {

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
                    });
                }
            }
        });
    };

    ViolinPlot.getSelectedChangeObject = function (filteredObj) {
        var self = this;
        var changeObj = filteredObj || this.getEmptyChangeObject(['selectedpoints']);

        // possible optimization.
        this._knimelyObj._dataArray.forEach(function (dataObj, objInd) {
            changeObj['selectedpoints'][objInd] = self.totalSelected < 1 ? null
                : dataObj.rowKeys.map(function (rowKey, rowInd) {
                    var rowObj = self._knimelyObj._rowDirectory[rowKey];
                    if (self.selectedDirectory[objInd].has(rowInd)) {
                        return rowObj.fInd;
                    }
                });
        });

        return changeObj;
    };

    ViolinPlot.getFilteredChangeObject = function (keys, pKeys) {

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

        var tGroups = changeObj[this.plotlyGroupColKey][0];
        var tColors = changeObj.rowColors[0];

        changeObj.transforms = [this.getTransforms(tGroups, tColors)];

        if (this._value.options.plotDirection === 'Horizontal') {
            delete changeObj[this.plotlyGroupColKey];
        }

        return changeObj;
    };

    ViolinPlot.getTransforms = function (groupData, colors) {
        var style = [];
        var groupSet = new Set([]);
        var groupColors = new Map([]);
        groupData.forEach(function (group, gInd) {
            if (groupSet.has(group)) {
                var gColorMap = groupColors.get(group);
                var count = gColorMap.has(colors[gInd]) ? gColorMap.get(colors[gInd]) + 1 : 1;
                gColorMap.set(colors[gInd], count);
                groupColors.set(group, gColorMap);
            } else {
                groupSet.add(group);
                var gColorMap = new Map([]);
                gColorMap.set(colors[gInd], 1);
                groupColors.set(group, gColorMap);
            }
        });

        Array.from(groupSet).forEach(function (group) {
            var min = 0;
            var color = '#8dd3c7';
            groupColors.get(group).forEach(function (value, key) {
                if (value > min) {
                    min = value;
                    color = key;
                }
            });
            style.push({
                target: group,
                value: {
                    line: {
                        color: color
                    }
                }
            });
        });

        var transforms = [{
            type: 'groupby',
            groups: groupData,
            styles: style
        }];

        return transforms;
    };

    ViolinPlot.getEmptyChangeObject = function (pKeys) {
        var self = this;
        var changeObj = {};
        pKeys.forEach(function (pKey) {
            changeObj[pKey] = self._knimelyObj._dataArray.map(function () {
                return [];
            });
        });
        return changeObj;
    };

    ViolinPlot.toggleSubscribeToFilters = function () {
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

    ViolinPlot.toggleSubscribeToSelection = function () {
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

    ViolinPlot.togglePublishSelection = function () {
        if (this._value.options.publishSelection) {
            knimeService.setSelectedRows(
                this._table.getTableId(),
                this._selected
            );
        }
    };

    ViolinPlot.toggleShowOnlySelected = function () {
        var changeObj = this.getFilteredChangeObject(
            [this._axisCol, this._groupByCol, 'rowKeys', 'rowKeys', 'rowColors'],
            [this.plotlyNumColKey, this.plotlyGroupColKey, 'text', 'ids', 'rowColors']
        );

        this.Plotly.restyle('knime-violin', changeObj);
    };

    ViolinPlot.drawKnimeMenu = function () {

        var self = this;

        if (this._representation.options.enableViewControls) {

            if (this._representation.options.showClearSelectionButton) {
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
                var axisColSelection = knimeService.createMenuSelect(
                    'axis-col-menu-item',
                    this._columns.indexOf(this._axisCol),
                    this._numericColumns,
                    function () {
                        if (self._axisCol !== this.value) {
                            self._axisCol = this.value;
                            var changeObj = self.getFilteredChangeObject(
                                [self._axisCol, self._groupByCol, 'rowKeys', 'rowKeys', 'rowColors'],
                                [self.plotlyNumColKey, self.plotlyGroupColKey, 'text', 'ids', 'rowColors']
                            );
                            var layoutObjKey = self.plotlyNumColKey + 'axis.title';
                            var layoutObj = {
                                [layoutObjKey]: self._axisCol
                            };
                            self.Plotly.update('knime-violin', changeObj, layoutObj);
                        }
                    }
                );

                knimeService.addMenuItem(
                    'Axis Column',
                    'calculator',
                    axisColSelection,
                    null,
                    knimeService.SMALL_ICON
                );

                // var yAxisSelection = knimeService.createMenuSelect(
                //     'y-axis-menu-item',
                //     this._columns.indexOf(this._yAxisCol),
                //     this._columns,
                //     function () {
                //         if (self._yAxisCol !== this.value) {
                //             self._yAxisCol = this.value;
                //             var changeObj = self.getFilteredChangeObject([self._yAxisCol], ['y']);
                //             var layoutObj = {
                //                 'yaxis.title': self._yAxisCol
                //             }
                //             self.Plotly.update('knime-violin', changeObj, layoutObj);
                //         }
                //     }
                // );

                // knimeService.addMenuItem(
                //     'Y-Axis',
                //     'y',
                //     yAxisSelection,
                //     null,
                //     knimeService.SMALL_ICON
                // );

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
                            self.Plotly.relayout('knime-violin', layoutObj);
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

    return ViolinPlot;

})();
