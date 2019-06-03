
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

            var rowGroup = row.data[self._groupByColumnInd] || '';
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
window.knimeContinuousErrorPlot = (function () {

    var ContinuousError = {};

    ContinuousError.init = function (representation, value) {

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
            this._representation.options.enableGroups ? this._representation.options.groupByColumn : '');
        this._xAxisCol = this._value.options.xAxisColumn || this._columns[0];
        this._yAxisCol = this._value.options.yAxisColumn || this._columns[1];
        this._lineColumns = this._value.options.columns || [];
        this._selected = [];
        this.includedDirectory = [];
        this.selectedDirectory = [];
        this.orderedIndicies = [];
        this.orderedXData = [];
        this.onSelectionChange = this.onSelectionChange.bind(this);
        this.onFilterChange = this.onFilterChange.bind(this);
        this.showOnlySelected = false;
        this.totalSelected = 0;
        this.calculationMethods = ['Variance', 'Standard Deviation', 'Percent', 'Fixed Value'];
        this.needsTypeChange = false;

        this.createElement();
        this.drawChart();
        this.drawKnimeMenu();
        this.mountAndSubscribe();
        this.collectGarbage();
    };

    ContinuousError.drawChart = function () {

        if (!knimeService.getGlobalService()) {
            this.createAllInclusiveFilter();
        }

        this.createAllExclusiveSelected();
        this.createOrderedIndicies();

        var traces = this.createTraces();
        var layout = new this.LayoutObject(this._representation, this._value);
        var config = new this.ConfigObject(this._representation, this._value)
        if (this.needsTypeChange) {
            traces.forEach(function (trace) {
                trace.type = 'scatter';
            })
        }
        // debugger
        // var test = this.getFilteredChangeObject();
        debugger

        this.Plotly.newPlot('knime-continuous-error', traces, layout, config);

        // this.Plotly.restyle('knime-continuous-error', test);
    };

    ContinuousError.createElement = function () {
        //Create the plotly HTML element 
        let div = document.createElement('DIV');
        div.setAttribute('id', 'knime-continuous-error');
        document.body.append(div);
    };

    ContinuousError.createTraces = function () {
        var self = this;
        var traces = [];
        var auxillaryTraces = [];
        this._knimelyObj._dataArray.forEach(function (dataObj, objInd) {
            var rowKeys = self.applyOrderedIndicies(dataObj.rowKeys, objInd);
            var rowColors = self.applyOrderedIndicies(dataObj.rowColors, objInd);
            var xData = self.orderedXData[objInd];
            var color = null;
            var hasColor = false;
            var colorSet = Array.from(new Set(self._knimelyObj._rowColors));
            if (self._representation.options.enableGroups) {
                color = self.getMostFrequentColor(rowColors.slice());
                hasColor = true;
            }



            self._lineColumns.forEach(function (col, colInd) {
                var traceName = col + '<br>' + dataObj.name;
                var yData = self.applyOrderedIndicies(dataObj[col], objInd);
                var trace = new self.TraceObject(xData, yData);

                trace.marker.color = rowColors;
                trace.selected.marker.color = rowColors;
                trace.unselected.marker.color = rowColors;

                if (!hasColor) {
                    color = colorSet.length > colInd - 1 ? colorSet[colInd] : colorSet[0];
                }
                trace.line.color = color;
                trace.text = self.getHoverText(rowKeys, col, dataObj.name);
                trace.name = traceName;
                trace.legendgroup = traceName;
                trace.ids = rowKeys;

                if (yData.length > 1) {
                    var errorTrace = self.getErrorLineData(yData, xData, traceName);

                    errorTrace.fillcolor = self.hexToRGBA(color, .2);
                    errorTrace.legendgroup = traceName;
                    errorTrace.name = traceName;

                    auxillaryTraces.push(errorTrace);
                } else {

                    self.needsTypeChange = true;
                    var eData = self.getErrorBarObject(yData);
                    trace.error_y = eData;
                }
                traces.push(trace);
            })

        });
        return [...traces, ...auxillaryTraces];
    };

    ContinuousError.getSVG = function () {
        this.Plotly.toImage(this.Plotly.d3.select('#knime-continuous-error').node(),
            { format: 'svg', width: 800, height: 600 }).then(function (dataUrl) {
                //TODO: decode URI
                return decodeURIComponent(dataUrl)
            })
    }

    ContinuousError.TraceObject = function (xData, yData) {
        this.x = xData;
        this.y = yData;
        this.mode = 'lines+markers';
        this.type = 'scatter';
        this.name = '';
        this.marker = {
            color: [],
            opacity: .1,
            size: .00001,
        };
        // this.error_y = eData;
        this.line = {
            width: 1,
            shape: 'spline',
            smoothing: .1
        }
        this.unselected = {
            marker: {
                opacity: .1,
                size: .00001,
            }
        };
        this.selected = {
            marker: {
                opacity: 1,
                size: 10,
            }
        };
        return this;
    }

    ContinuousError.LayoutObject = function (rep, val) {
        this.title = {
            text: val.options.title || 'Line Plot',
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
        this.xaxis = {
            title: val.options.xAxisLabel ? val.options.xAxisLabel :
                val.options.xAxisColumn,
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

        };
        this.yaxis = {
            title: val.options.yAxisLabel ? val.options.yAxisLabel :
                val.options.yAxisColumn,
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

    ContinuousError.ConfigObject = function (rep, val) {
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
            'hoverCompareCartesian', 'toggleSpikelines'];
        return this;
    };

    ContinuousError.collectGarbage = function () {
        this._representation.inObjects[0].rows = null;
        this._table.setDataTable(this._representation.inObjects[0]);
    };

    ContinuousError.createAllInclusiveFilter = function () {
        var self = this;
        self._knimelyObj._dataArray.forEach(function (dataObj, objInd) {
            var filteredIndicies = self.includedDirectory[objInd] || new Set([]);
            for (var i = 0; i < dataObj[self._xAxisCol].length; i++) {
                filteredIndicies.add(i);
            }
            self.includedDirectory[objInd] = filteredIndicies;
        });
    };

    ContinuousError.createAllExclusiveSelected = function () {
        var self = this;
        var count = 0;
        this._knimelyObj._dataArray.forEach(function () {
            self.selectedDirectory[count] = new Set([]);
            count++;
        });
    };

    ContinuousError.mountAndSubscribe = function () {
        var self = this;
        document.getElementById('knime-continuous-error').on('plotly_selected', function (plotlyEvent) {
            self.onSelectionChange(plotlyEvent);
        });
        document.getElementById('knime-continuous-error').on('plotly_deselect', function () {
            self.onSelectionChange({ points: [] });
        });
        this.togglePublishSelection();
        this.toggleSubscribeToFilters();
        this.toggleSubscribeToSelection();
    };

    ContinuousError.onSelectionChange = function (data) {
        debugger
        if (data) {
            this.updateSelected(data);
            var changeObj = this.getFilteredChangeObject();
            this.Plotly.restyle('knime-continuous-error', changeObj);
        }
    };

    ContinuousError.onFilterChange = function (data) {
        this.updateFilter(data);
        var changeObj = this.getFilteredChangeObject();
        this.Plotly.restyle('knime-continuous-error', changeObj);
    };

    ContinuousError.updateSelected = function (data) {
        var self = this;

        if (!data) {
            return;
        }

        this._selected = [];
        this.totalSelected = 0;
        this.createAllExclusiveSelected();

        if (data.points) { // this is for Plotly events

            var selectedSet = new Set([]);

            data.points.forEach(function (pt) {
                var rowObj = self._knimelyObj._rowDirectory[pt.id];
                if (rowObj !== undefined) {
                    if (!selectedSet.has(pt.id)) {
                        self.totalSelected++;
                        self.selectedDirectory[rowObj.tInd].add(rowObj.pInd);
                        selectedSet.add(pt.id);
                    }
                }
            });

            this._selected = Array.from(selectedSet);

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
                var rowObj = self._knimelyObj._rowDirectory[rowKey]
                if (rowObj !== undefined) { //only == undef with two different data sets 
                    self.selectedDirectory[rowObj.tInd].add(rowObj.pInd);
                    self.totalSelected++;
                }
            });
        }
    };

    ContinuousError.updateFilter = function (data) {

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

    ContinuousError.getSelectedChangeObject = function (filteredObj) {
        var self = this;
        var changeObj = filteredObj;
        var count = 0;

        this._knimelyObj._dataArray.forEach(function (dataObj, objInd) {

            var selected = new Set([]);
            var dataKeys = new Set(dataObj.rowKeys)
            self._selected.forEach(function (rowKey) {
                if (dataKeys.has(rowKey)) {
                    var rowObj = self._knimelyObj._rowDirectory[rowKey];
                    if (self._value.options.enableAggregate) {
                        //TODO: insert aggregate code
                    } else {
                        selected.add(rowObj.fInd);
                    }
                }
            })
            for (var j = 0; j < self._lineColumns.length; j++) {
                if (Array.from(selected).length > 0 && self._lineColumns[j] !== null) {
                    changeObj['selectedpoints'][count] = Array.from(selected);
                } else if (self.totalSelected < 1) {
                    changeObj['selectedpoints'][count] = null;
                }
                count++;
            }
        })

        return changeObj;
    };

    ContinuousError.getFilteredChangeObject = function (keys, pKeys) {

        var self = this;
        var changeObj = {
            selectedpoints: [],
            x: [],
            y: [],
            text: [],
            ids: [],
            ['marker.color']: [],
            error_y: []
        }
        var auxChangeObj = {
            selectedpoints: [],
            x: [],
            y: [],
            text: [],
            ids: [],
        }

        this._knimelyObj._dataArray.forEach(function (dataObj, objInd) {

            var filteredRowKeys = [];
            dataObj.rowKeys.forEach(function (rowKey, rowInd) {
                var included = self.includedDirectory[objInd].has(rowInd);
                if (self.showOnlySelected && included && self._selected.length > 0) {
                    included = self.selectedDirectory[objInd].has(rowInd);
                }
                if (included) {
                    filteredRowKeys.push(rowKey);
                } else {
                    filteredRowKeys.push(null);
                }
            });
            var orderedAndFilteredRowKeys = [];
            var count = 0;
            var orderedData = [];

            //TODO: Implemented this bug fix vvvvvv
            // for (var i = 0; i < filteredRowKeys.length; i++) {
            //     var rowKey = filteredRowKeys[this.orderedIndicies[objInd][i]];
            //     var rowObj = self._knimelyObj._rowDirectory[rowKey];
            //     orderedAndFilteredRowKeys[count] = rowKey;
            //     rowObj.fInd = i;
            //     // orderedData[i] = filteredRowKeys[this.orderedIndicies[objInd][i]];
            // }
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

            var rowKeys = self.applyFilter(dataObj.rowKeys, objInd);
            var rowColors = self.applyFilter(dataObj.rowColors, objInd);
            var xData = self.applyFilter(dataObj[self._xAxisCol], objInd);

            self._lineColumns.forEach(function (col, colInd) {
                changeObj['selectedpoints'].push([]);
                if (col) {
                    var traceName = col + '<br>' + dataObj.name;
                    var yData = self.applyFilter(dataObj[col], objInd);
                    changeObj['marker.color'].push(rowColors);
                    changeObj.x.push(xData);
                    changeObj.y.push(yData);

                    changeObj.text.push(self.getHoverText(rowKeys, col, dataObj.name));
                    changeObj.ids.push(filteredRowKeys);

                    if (dataObj[self._xAxisCol].length > 1) {
                        changeObj.error_y.push(null);
                        var errorTrace = self.getErrorLineData(yData, xData, traceName);
                        auxChangeObj.x.push(errorTrace.x);
                        auxChangeObj.y.push(errorTrace.y);
                        // auxChangeObj['marker.color'].push(rowColors);
                        auxChangeObj.text.push(self.getHoverText(rowKeys, col, dataObj.name));
                        auxChangeObj.ids.push(filteredRowKeys);
                    } else {
                        var eData = self.getErrorBarObject(yData);
                        changeObj.error_y.push(eData);
                    }
                } else {
                    changeObj.error_y.push(null);
                    changeObj['marker.color'].push([]);
                    changeObj.text.push([])
                    changeObj.ids.push([]);
                    changeObj.x.push([]);
                    changeObj.y.push([]);
                    if (dataObj[self._xAxisCol].length > 1) {
                        auxChangeObj.x.push([]);
                        auxChangeObj.y.push([])
                    }
                }
            })

        });

        for (var i = 0; i < auxChangeObj.x.length; i++) {
            changeObj.x.push(auxChangeObj.x[i])
            changeObj.y.push(auxChangeObj.y[i])
            changeObj['marker.color'].push([]);
            changeObj.error_y.push(null);
            changeObj.text.push(auxChangeObj.text[i]);
            changeObj.ids.push(auxChangeObj.ids[i]);
            changeObj['selectedpoints'].push(self.totalSelected > 0 ? [] : null);
        }

        changeObj = this.getSelectedChangeObject(changeObj);

        return changeObj;
    };

    ContinuousError.toggleSubscribeToFilters = function () {
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

    ContinuousError.toggleSubscribeToSelection = function () {
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

    ContinuousError.togglePublishSelection = function () {
        if (this._value.options.publishSelection) {
            knimeService.setSelectedRows(
                this._table.getTableId(),
                this._selected
            );
        }
    };

    ContinuousError.toggleShowOnlySelected = function () {
        var changeObj = this.getFilteredChangeObject();

        this.Plotly.restyle('knime-continuous-error', changeObj);
    };

    ContinuousError.createOrderedIndicies = function () {
        var self = this;

        this._knimelyObj._dataArray.forEach(function (dataObj, objInd) {
            var array = dataObj[self._xAxisCol];
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
            self.orderedXData[objInd] = xYz[0];
            self.orderedIndicies[objInd] = xYz[1];

            var orderedRows = self.applyOrderedIndicies(dataObj.rowKeys, objInd);

            orderedRows.forEach(function (rowKey, pointInd) {
                self._knimelyObj._rowDirectory[rowKey].fInd = pointInd;
            })
        })
    };

    ContinuousError.applyOrderedIndicies = function (array, objInd) {
        var orderedData = [];

        for (var i = 0; i < array.length; i++) {
            orderedData[i] = array[this.orderedIndicies[objInd][i]];
        }

        return orderedData.filter(function (val) { return (val === 0 || val) });
    };

    ContinuousError.applyFilter = function (array, objInd) {
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

    ContinuousError.hexToRGBA = function (hColor, alph) {
        return 'rgba(' + parseInt(hColor.slice(1, 3), 16) + ', ' +
            parseInt(hColor.slice(3, 5), 16) + ', ' +
            parseInt(hColor.slice(5, 7), 16) + ', ' + alph + ')';
    };

    ContinuousError.getMostFrequentColor = function (rowColors) {
        return rowColors.sort(function (c1, c2) {
            return (rowColors.filter(function (c3) {
                return c3 === c1;
            }).length - rowColors.filter(function (c4) {
                return c4 === c2;
            }));
        }).pop();
    };

    ContinuousError.getErrorLineData = function (yValues, xValues) {
        var self = this;
        var xData = [];
        var yData = [];

        switch (String(this._value.options.calcMethod.replace(/\s/g, ' '))) {
            case 'Variance':
            case 'Standard Deviation':
                var sum = 0;
                var count = 0;
                var mean = 0;
                yValues.forEach(function (val) {
                    if (val === 0 || val) {
                        sum += val
                        count++;
                    }
                })
                mean = sum / count;
                var variance = 0;
                yValues.forEach(function (val) {
                    if (val === 0 || val) {
                        variance += Math.pow((val - mean), 2);
                    }
                })
                variance /= count - 1;
                if (!variance) {
                    variance = 0;
                }
                if (this._value.options.calcMethod.replace(/\s/g, ' ') === 'Standard Deviation') {
                    variance = Math.sqrt(variance);
                    // variance = Math.pow(Math.E, Math.log(variance) / 2);
                }

                for (var i = 0; i < yValues.length; i++) {
                    yData.push(yValues[i] + (variance * self._representation.options.calcMultiplier));
                    xData.push(xValues[i]);
                }
                for (var i = yValues.length - 1; i >= 0; i--) {
                    yData.push(yValues[i] + (-1 * variance * self._representation.options.calcMultiplier));
                    xData.push(xValues[i]);
                }

                break;
            case 'Percent':
                for (var i = 0; i < yValues.length; i++) {
                    yData.push(yValues[i] + (yValues[i] * (self._representation.options.calcPercent / 100)));
                    xData.push(xValues[i]);
                }
                for (var i = yValues.length - 1; i >= 0; i--) {
                    yData.push(yValues[i] + (-1 * yValues[i] * (self._representation.options.calcPercent / 100)));
                    xData.push(xValues[i]);
                }
                break;
            case 'Fixed Value':
                for (var i = 0; i < yValues.length; i++) {
                    yData.push(yValues[i] + self._representation.options.fixedValue);
                    xData.push(xValues[i]);
                }
                for (var i = yValues.length - 1; i >= 0; i--) {
                    yData.push(yValues[i] + (-1 * self._representation.options.fixedValue));
                    xData.push(xValues[i]);
                }
                break;
            default:
                break;
        }

        var errorTrace = {
            x: xData,
            y: yData,
            fill: 'toself',
            // fillcolor: lineColor,
            line: {
                color: 'transparent',
                shape: 'spline',
                smoothing: .1
            },
            // legendgroup: lineName,
            // name: lineName,
            mode: 'lines',
            showlegend: false,
            type: 'scatter',
            unselected: {
                marker: {
                    opacity: .00001,
                    size: .00001,
                }
            },
            selected: {
                marker: {
                    opacity: .00001,
                    size: .00001,
                }
            }
        };

        return errorTrace;
    };

    ContinuousError.getErrorBarObject = function (yValues) {
        var self = this;
        var error_y = {
            type: '',
            value: [],
            visible: true
        }

        switch (String(this._value.options.calcMethod.replace(/\s/g, ' '))) {
            case 'Variance':
            case 'Standard Deviation':
                var sum = 0;
                var count = 0;
                var mean = 0;
                yValues.forEach(function (val) {
                    if (val === 0 || val) {
                        sum += val
                        count++;
                    }
                })
                mean = sum / count;
                var variance = 0;
                yValues.forEach(function (val) {
                    if (val === 0 || val) {
                        variance += Math.pow((val - mean), 2);
                    }
                })
                variance /= count - 1;
                if (!variance) {
                    variance = 0;
                }
                error_y.type = 'constant';
                if (this._value.options.calcMethod.replace(/\s/g, ' ') === 'Standard Deviation') {
                    variance = Math.sqrt(variance);
                    // variance = Math.pow(Math.E, Math.log(variance) / 2);
                }
                error_y.value = variance * self._representation.options.calcMultiplier;
                break;
            case 'Percent':
                error_y.type = 'percent';
                error_y.value = self._representation.options.calcPercent;
                break;
            case 'Fixed Value':
                error_y.type = 'constant';
                error_y.value = self._representation.options.fixedValue;
                break;
            default:
                break;
        }

        if (error_y.value === NaN || error_y.value === null || error_y.value === undefined) {
            error_y.value = 0;
        }

        return error_y;
    };

    ContinuousError.getHoverText = function (rowKeys, colName, groupName) {
        var text = []
        var nameString = this._representation.options.enableGroups ? ', ' + groupName : '';
        rowKeys.forEach(function (key) {
            text.push(key + ', ' + colName + nameString);
        })
        return text;
    };

    ContinuousError.drawKnimeMenu = function () {

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

            if (this._representation.options.enableCalcMethodSelection) {
                var xAxisSelection = knimeService.createMenuSelect(
                    'calc-method-menu-item',
                    this.calculationMethods.indexOf(this._value.options.calcMethod.replace(/\s/g, ' ')),
                    this.calculationMethods,
                    function () {
                        if (self._value.options.calcMethod !== this.value) {
                            self._value.options.calcMethod = this.value;
                            var changeObj = self.getFilteredChangeObject();

                            self.Plotly.restyle('knime-continuous-error', changeObj);
                        }
                    }
                );

                knimeService.addMenuItem(
                    'Calculation Method',
                    'calculator',
                    xAxisSelection,
                    null,
                    knimeService.SMALL_ICON
                );
            }

            if (this._representation.options.enableFeatureSelection) {
                var xAxisSelection = knimeService.createMenuSelect(
                    'x-axis-menu-item',
                    this._numericColumns.indexOf(this._xAxisCol),
                    this._numericColumns,
                    function () {
                        if (self._xAxisCol !== this.value) {
                            self._xAxisCol = this.value;
                            self.createOrderedIndicies();
                            var changeObj = self.getFilteredChangeObject();
                            var layoutObj = {
                                'xaxis.title': self._xAxisCol
                            }
                            self.Plotly.update('knime-continuous-error', changeObj, layoutObj);
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

                // temporarily use controlContainer to solve th resizing problem with ySelect
                var controlContainer = this.Plotly.d3.select('#knime-continuous-error').insert('table', '#radarContainer ~ *')
                    .attr('id', 'lineControls')
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
                columnSelect.setSelections(this._lineColumns);
                columnSelect.addValueChangedListener(function () {
                    var newSelected = columnSelect.getSelections();
                    var updatedSelect = [];
                    var changeObj = {
                        visible: []
                    }
                    self._knimelyObj._dataArray.forEach(function (dataObj, objInd) {
                        self._lineColumns.forEach(function (colName, colInd) {
                            if (newSelected.indexOf(colName) >= 0) {
                                updatedSelect[colInd] = colName;
                                changeObj.visible.push(true);
                            } else {
                                updatedSelect[colInd] = null;
                                changeObj.visible.push(false);
                            }
                        })
                    })

                    self.Plotly.restyle('knime-continuous-error', changeObj);
                });
                knimeService.addMenuItem('Columns (lines):', 'long-arrow-up', columnSelectComponent);
                controlContainer.remove();

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
                            self.Plotly.relayout('knime-continuous-error', layoutObj);
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

    return ContinuousError;

})();