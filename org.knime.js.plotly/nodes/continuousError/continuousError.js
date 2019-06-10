/* global kt:false, twinlistMultipleSelections:false, KnimePlotlyInterface:false  */
window.knimeContinuousErrorPlot = (function () {

    var ContinuousError = {};

    ContinuousError.init = function (representation, value) {
        var self = this;
        this.KPI = new KnimePlotlyInterface();
        this.KPI.initialize(representation, value, new kt(), arguments[2][0]);
        this.columns = this.KPI.table.getColumnNames();
        this.columnTypes = this.KPI.table.getColumnTypes();
        this.numericColumns = this.columns.filter(function (c, i) {
            return self.columnTypes[i] === 'number';
        });

        this.xAxisCol = this.KPI.value.options.xAxisColumn || this.columns[0];
        this.lineColumns = this.KPI.value.options.columns || [];
        this.onSelectionChange = this.onSelectionChange.bind(this);
        this.onFilterChange = this.onFilterChange.bind(this);
        this.calculationMethods = ['Variance', 'Standard Deviation', 'Percent', 'Fixed Value'];
        this.needsTypeChange = false;

        this.drawChart();
        // this.drawKnimeMenu();
        this.KPI.mountAndSubscribe(this.onSelectionChange, this.onFilterChange);
    };

    ContinuousError.drawChart = function () {

        var t = this.createTraces();
        var l = new this.LayoutObject(this.KPI.representation, this.KPI.value);
        var c = new this.ConfigObject(this.KPI.representation, this.KPI.value);
        if (this.needsTypeChange) {
            t.forEach(function (trace) {
                trace.type = 'scatter';
            });
        }
        this.KPI.createElement('knime-continuous-error');
        this.KPI.drawChart(t, l, c);
        this.KPI.update();
    };

    ContinuousError.createTraces = function () {
        var self = this;
        var traces = [];
        var auxillaryTraces = [];
        this.KPI.updateOrderedIndicies(this.xAxisCol);
        var keys = {
            dataKeys: [self.xAxisCol, 'rowKeys', 'rowColors'],
            plotlyKeys: [['x'], ['text', 'ids'], ['marker.color']]
        };
        this.KPI.updateKeys(keys);
        var data = self.KPI.getData(keys);
        this._knimelyObj._dataArray.forEach(function (dataObj, objInd) {
            var rowKeys = self.applyOrderedIndicies(dataObj.rowKeys, objInd);
            var rowColors = self.applyOrderedIndicies(dataObj.rowColors, objInd);
            var xData = self.orderedXData[objInd];
            var color = null;
            var hasColor = false;
            var colorSet = new self._knimelyObj.kSet(self._knimelyObj._rowColors).getArray();
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
            });

        });
        var allTraces = [];
        traces.forEach(function (t) {
            allTraces.push(t);
        });
        auxillaryTraces.forEach(function (at) {
            allTraces.push(at);
        });
        return [allTraces];
    };

    ContinuousError.TraceObject = function (xData, yData) {
        this.x = xData;
        this.y = yData;
        this.mode = 'lines+markers';
        this.type = 'scatter';
        this.name = '';
        this.marker = {
            color: [],
            opacity: .1,
            size: .00001
        };
        // this.error_y = eData;
        this.line = {
            width: 1,
            shape: 'spline',
            smoothing: .1
        };
        this.unselected = {
            marker: {
                opacity: .1,
                size: .00001
            }
        };
        this.selected = {
            marker: {
                opacity: 1,
                size: 10
            }
        };
        return this;
    };

    ContinuousError.LayoutObject = function (rep, val) {
        this.title = {
            text: val.options.title || 'Continuous Error Plot',
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
            title: val.options.xAxisLabel ? val.options.xAxisLabel
                : val.options.xAxisColumn,
            font: {
                size: 12,
                family: 'sans-serif'
            },
            type: 'linear',
            showgrid: val.options.showGrid,
            gridcolor: '#fffff', // potential option
            linecolor: '#fffff', // potential option
            linewidth: 1,
            nticks: 10

        };
        this.yaxis = {
            title: val.options.yAxisLabel ? val.options.yAxisLabel
                : val.options.yAxisColumn,
            font: {
                size: 12,
                family: 'sans-serif'
            },
            type: 'linear',
            showgrid: val.options.showGrid,
            gridcolor: '#fffff', // potential option
            linecolor: '#fffff', // potential option
            linewidth: 1,
            nticks: 10
        };
        this.margin = {
            l: 55,
            r: 20,
            b: 55,
            t: 60,
            pad: 0
        };
        this.hovermode = rep.options.tooltipToggle ? 'closest' : 'none';
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

    ContinuousError.onSelectionChange = function (data) {
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
        };
        var auxChangeObj = {
            selectedpoints: [],
            x: [],
            y: [],
            text: [],
            ids: []
        };

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

            // TODO: Implemented this bug fix vvvvvv
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
                changeObj.selectedpoints.push([]);
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
                    changeObj.text.push([]);
                    changeObj.ids.push([]);
                    changeObj.x.push([]);
                    changeObj.y.push([]);
                    if (dataObj[self._xAxisCol].length > 1) {
                        auxChangeObj.x.push([]);
                        auxChangeObj.y.push([]);
                    }
                }
            });

        });

        for (var i = 0; i < auxChangeObj.x.length; i++) {
            changeObj.x.push(auxChangeObj.x[i]);
            changeObj.y.push(auxChangeObj.y[i]);
            changeObj['marker.color'].push([]);
            changeObj.error_y.push(null);
            changeObj.text.push(auxChangeObj.text[i]);
            changeObj.ids.push(auxChangeObj.ids[i]);
            changeObj.selectedpoints.push(self.totalSelected > 0 ? [] : null);
        }

        changeObj = this.getSelectedChangeObject(changeObj);

        return changeObj;
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
                    sum += val;
                    count++;
                }
            });
            mean = sum / count;
            var variance = 0;
            yValues.forEach(function (val) {
                if (val === 0 || val) {
                    variance += Math.pow(val - mean, 2);
                }
            });
            variance /= count - 1;
            if (!variance) {
                variance = 0;
            }
            if (this._value.options.calcMethod.replace(/\s/g, ' ') === 'Standard Deviation') {
                variance = Math.sqrt(variance);
                // variance = Math.pow(Math.E, Math.log(variance) / 2);
            }

            for (var i = 0; i < yValues.length; i++) {
                yData.push(yValues[i] + variance * self._representation.options.calcMultiplier);
                xData.push(xValues[i]);
            }
            for (var j = yValues.length - 1; j >= 0; j--) {
                yData.push(yValues[j] + -1 * variance * self._representation.options.calcMultiplier);
                xData.push(xValues[j]);
            }

            break;
        case 'Percent':
            for (var k = 0; k < yValues.length; k++) {
                yData.push(yValues[k] + yValues[k] * (self._representation.options.calcPercent / 100));
                xData.push(xValues[k]);
            }
            for (var x = yValues.length - 1; x >= 0; x--) {
                yData.push(yValues[x] + -1 * yValues[x] * (self._representation.options.calcPercent / 100));
                xData.push(xValues[x]);
            }
            break;
        case 'Fixed Value':
            for (var y = 0; y < yValues.length; y++) {
                yData.push(yValues[y] + self._representation.options.fixedValue);
                xData.push(xValues[y]);
            }
            for (var z = yValues.length - 1; z >= 0; z--) {
                yData.push(yValues[z] + -1 * self._representation.options.fixedValue);
                xData.push(xValues[z]);
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
                    size: .00001
                }
            },
            selected: {
                marker: {
                    opacity: .00001,
                    size: .00001
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
        };

        switch (String(this._value.options.calcMethod.replace(/\s/g, ' '))) {
        case 'Variance':
        case 'Standard Deviation':
            var sum = 0;
            var count = 0;
            var mean = 0;
            yValues.forEach(function (val) {
                if (val === 0 || val) {
                    sum += val;
                    count++;
                }
            });
            mean = sum / count;
            var variance = 0;
            yValues.forEach(function (val) {
                if (val === 0 || val) {
                    variance += Math.pow(val - mean, 2);
                }
            });
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

        if (isNaN(error_y.value) || error_y.value === null || typeof error_y.value === 'undefined') {
            error_y.value = 0;
        }

        return error_y;
    };

    ContinuousError.getHoverText = function (rowKeys, colName, groupName) {
        var text = [];
        var nameString = this._representation.options.enableGroups ? ', ' + groupName : '';
        rowKeys.forEach(function (key) {
            text.push(key + ', ' + colName + nameString);
        });
        return text;
    };

    ContinuousError.drawKnimeMenu = function () {

        var self = this;

        if (this._representation.options.enableViewControls) {

            if (this._representation.options.showFullscreen) {
                knimeService.allowFullscreen();
            }

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
                var calcMethodSelection = knimeService.createMenuSelect(
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
                    calcMethodSelection,
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
                            };
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
                    /* .style('width', '100%') */
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
                    };
                    self._knimelyObj._dataArray.forEach(function (dataObj, objInd) {
                        self._lineColumns.forEach(function (colName, colInd) {
                            if (newSelected.indexOf(colName) >= 0) {
                                updatedSelect[colInd] = colName;
                                changeObj.visible.push(true);
                            } else {
                                updatedSelect[colInd] = null;
                                changeObj.visible.push(false);
                            }
                        });
                    });

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
                                hovermode: self._representation.options.tooltipToggle
                                    ? 'closest' : false
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

            if (knimeService.isInteractivityAvailable()) {

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
        }
    };

    return ContinuousError;

})();
