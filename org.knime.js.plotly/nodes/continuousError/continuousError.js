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
        this.auxillaryTraces = [];
        this.totalTraces = 0;

        this.drawChart();
        this.drawKnimeMenu();
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
        this.KPI.Plotly.addTraces(this.KPI.divID, this.auxillaryTraces);
    };

    ContinuousError.createTraces = function () {
        var self = this;
        var traces = [];
        this.KPI.updateOrderedIndicies(this.xAxisCol);
        var keys = {
            dataKeys: [self.xAxisCol, 'rowKeys', 'rowColors'],
            plotlyKeys: [['x'], ['text', 'ids'], ['marker.color']]
        };
        this.KPI.updateKeys(keys);
        var data = self.KPI.getData(keys);

        data.names.forEach(function (name, traceInd) {
            self.lineColumns.forEach(function (col, colInd) {
                var yData = self.KPI.getData({ dataKeys: [col] });
                var xData = data[self.xAxisCol][traceInd];
                var newTrace = new self.TraceObject(xData, yData[col][0]);
                var mfColor = self.KPI.getMostFrequentColor(data.rowColors[traceInd].slice());
                if (self.KPI.representation.options.enableGroups) {
                    newTrace.line.color = mfColor;
                }
                newTrace.marker.color = data.rowColors[traceInd];
                newTrace.text = self.getHoverText(data.rowKeys[traceInd], col, data.names[traceInd]);
                newTrace.ids = data.rowKeys[traceInd];
                newTrace.name = col;
                // newTrace.name = col + '<br>' + data.names[traceInd];
                newTrace.dataKeys = [self.xAxisCol, col, 'rowKeys', 'rowColors'];
                newTrace.legendgroup = data.names[traceInd];
                if (xData.length < 2) {
                    self.needsTypeChange = true;
                }
                traces.push(newTrace);
                self.totalTraces++;
                var errorTrace = self.getErrorLineData(yData[col][0], xData, data.rowKeys[traceInd]);
                errorTrace.fillcolor = self.KPI.hexToRGBA(mfColor, .2);
                errorTrace.dataKeys = [self.xAxisCol, col, 'rowKeys', 'rowColors'];
                errorTrace.legendgroup = data.names[traceInd];
                self.auxillaryTraces.push(errorTrace);
            });
        });

        keys = {
            plotlyKeys: [['x'], ['y'], ['text', 'ids'], ['marker.color']]
        };
        this.KPI.updateKeys(keys);
        return traces;
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
            title: val.options.xAxisLabel.length > 0 ? val.options.xAxisLabel
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
            title: val.options.yAxisLabel.length > 0 ? val.options.yAxisLabel
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
        this.showTips = false;
        this.showLink = rep.options.enablePlotlyEditor;
        this.modeBarButtonsToRemove = ['hoverClosestCartesian',
            'hoverCompareCartesian', 'toggleSpikelines'];
        return this;
    };

    ContinuousError.getSVG = function () {
        return this.KPI.getSVG();
    };

    ContinuousError.validate = function () {
        return true;
    };

    ContinuousError.getComponentValue = function () {
        return this.KPI.getComponentValue();
    };

    ContinuousError.onSelectionChange = function (data) {
        if (data) {
            this.KPI.updateSelected(data);
            var changeObj = this.KPI.getFilteredChangeObject();
            changeObj = this.updateChangeObj(changeObj);
            this.KPI.update(changeObj);
        }
    };

    ContinuousError.onFilterChange = function (data) {
        if (data) {
            this.KPI.updateFilter(data);
            var changeObj = this.KPI.getFilteredChangeObject();
            changeObj = this.updateChangeObj(changeObj);
            this.KPI.update(changeObj);
        }
    };

    ContinuousError.updateChangeObj = function (inChangeObj) {
        var self = this;
        var changeObj = inChangeObj || this.KPI.getFilteredChangeObject();
        changeObj.x.forEach(function (xData, traceInd) {
            var x = changeObj.x[traceInd];
            var y = changeObj.y[traceInd];
            var ids = changeObj.ids[traceInd];
            var eLine = self.getErrorLineData(y, x, ids);
            changeObj.x.push(eLine.x);
            changeObj.y.push(eLine.y);
            changeObj.ids.push(eLine.ids);
            for (var key in changeObj) {
                if (key !== 'x' && key !== 'y' && key !== ids) {
                    changeObj[key].push([]);
                }
            }
        });
        return changeObj;
    };

    ContinuousError.getErrorLineData = function (yValues, xValues, rowKeys) {
        var self = this;
        var xData = [];
        var yData = [];
        var ids = [];

        switch (String(this.KPI.value.options.calcMethod.replace(/\s/g, ' '))) {
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
            if (this.KPI.value.options.calcMethod.replace(/\s/g, ' ') === 'Standard Deviation') {
                variance = Math.sqrt(variance);
                // variance = Math.pow(Math.E, Math.log(variance) / 2);
            }

            for (var i = 0; i < yValues.length; i++) {
                yData.push(yValues[i] + variance * this.KPI.representation.options.calcMultiplier);
                xData.push(xValues[i]);
                ids.push(rowKeys[i]);
            }
            for (var j = yValues.length - 1; j >= 0; j--) {
                yData.push(yValues[j] + -1 * variance * this.KPI.representation.options.calcMultiplier);
                xData.push(xValues[j]);
                ids.push(rowKeys[j]);
            }

            break;
        case 'Percent':
            for (var k = 0; k < yValues.length; k++) {
                yData.push(yValues[k] + yValues[k] * (this.KPI.representation.options.calcPercent / 100));
                xData.push(xValues[k]);
                ids.push(rowKeys[k]);
            }
            for (var x = yValues.length - 1; x >= 0; x--) {
                yData.push(yValues[x] + -1 * yValues[x] * (this.KPI.representation.options.calcPercent / 100));
                xData.push(xValues[x]);
                ids.push(rowKeys[x]);
            }
            break;
        case 'Fixed Value':
            for (var y = 0; y < yValues.length; y++) {
                yData.push(yValues[y] + this.KPI.representation.options.fixedValue);
                xData.push(xValues[y]);
                ids.push(rowKeys[y]);
            }
            for (var z = yValues.length - 1; z >= 0; z--) {
                yData.push(yValues[z] + -1 * this.KPI.representation.options.fixedValue);
                xData.push(xValues[z]);
                ids.push(rowKeys[z]);
            }
            break;
        default:
            break;
        }

        var errorTrace = {
            x: xData,
            y: yData,
            ids: ids,
            hoverinfo: 'x+y',
            fill: 'toself',
            line: {
                color: 'transparent',
                shape: 'spline',
                smoothing: .1
            },
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

    ContinuousError.getHoverText = function (rowKeys, colName, groupName) {
        var text = [];
        var nameString = this.KPI.representation.options.enableGroups ? ', ' + groupName : '';
        rowKeys.forEach(function (key) {
            text.push(key + ', ' + colName + nameString);
        });
        return text;
    };

    ContinuousError.drawKnimeMenu = function () {

        var self = this;

        if (self.KPI.representation.options.enableViewControls) {

            if (self.KPI.representation.options.showFullscreen) {
                knimeService.allowFullscreen();
            }

            if (self.KPI.representation.options.enableSelection &&
                self.KPI.representation.options.showClearSelectionButton) {
                knimeService.addButton(
                    'clear-selection-button',
                    'minus-square',
                    'Clear Selection',
                    function () {
                        self.onSelectionChange({ points: [] });
                    }
                );
            }

            if (self.KPI.representation.options.enableCalcMethodSelection) {
                var calcMethodSelection = knimeService.createMenuSelect(
                    'calc-method-menu-item',
                    self.KPI.value.options.calcMethod.replace(/\s/g, ' '),
                    this.calculationMethods,
                    function () {
                        if (self.KPI.value.options.calcMethod !== this.value) {
                            self.KPI.value.options.calcMethod = this.value;
                            var changeObj = self.updateChangeObj();
                            self.KPI.update(changeObj);
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

            if (self.KPI.representation.options.enableFeatureSelection) {
                var xAxisSelection = knimeService.createMenuSelect(
                    'x-axis-menu-item',
                    this.xAxisCol,
                    this.numericColumns,
                    function () {
                        if (self.xAxisCol !== this.value) {
                            self.xAxisCol = this.value;
                            var layoutObj = {
                                'xaxis.title': self.xAxisCol
                            };
                            var keys = {
                                dataKeys: [self.xAxisCol, null, null, null]
                            };
                            var valueObj = {
                                xAxisColumn: self.xAxisCol
                            };
                            self.KPI.updateValue(valueObj);
                            self.KPI.updateOrderedIndicies(self.xAxisCol);
                            self.KPI.updateKeys(keys);
                            var changeObj = self.updateChangeObj();
                            self.KPI.update(changeObj, layoutObj);
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
                var controlContainer = self.KPI.Plotly.d3.select('#' + this.KPI.divID).insert('table', '#radarContainer ~ *')
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
                columnSelect.setChoices(this.numericColumns);
                columnSelect.setSelections(this.lineColumns);
                columnSelect.addValueChangedListener(function () {
                    self.lineColumns = columnSelect.getSelections();
                    var valObj = {
                        columns: self.lineColumns
                    };
                    var changeObj = {
                        visible: []
                    };
                    self.KPI.traceDirectory.forEach(function (trace) {
                        if (self.lineColumns.indexOf(trace.dataKeys[1]) > -1) {
                            changeObj.visible.push(true);
                        } else {
                            changeObj.visible.push(false);
                        }
                    });
                    self.KPI.updateValue(valObj);
                    self.KPI.update(changeObj);
                });
                knimeService.addMenuItem('Columns (lines):', 'long-arrow-up', columnSelectComponent);
                controlContainer.remove();

                knimeService.addMenuDivider();
            }

            if (self.KPI.representation.options.tooltipToggle) {

                var tooltipToggleCheckBox = knimeService.createMenuCheckbox(
                    'show-tooltips-checkbox',
                    self.KPI.representation.options.tooltipToggle,
                    function () {
                        if (self.KPI.representation.options.tooltipToggle !== this.checked) {
                            self.KPI.representation.options.tooltipToggle = this.checked;
                            var layoutObj = {
                                hovermode: self.KPI.representation.options.tooltipToggle
                                    ? 'closest' : false
                            };
                            self.KPI.update(false, layoutObj, true);
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

            if (self.KPI.representation.options.showSelectedOnlyToggle) {

                var showOnlySelectedCheckbox = knimeService.createMenuCheckbox(
                    'show-only-selected-checkbox',
                    this.showOnlySelected,
                    function () {
                        if (self.KPI.showOnlySelected !== this.checked) {
                            self.KPI.updateShowOnlySelected(this.checked);
                            var changeObj = self.updateChangeObj();
                            self.KPI.update(changeObj);
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

                if (self.KPI.representation.options.subscribeSelectionToggle) {

                    var subscribeToSelectionCheckbox = knimeService.createMenuCheckbox(
                        'subscribe-to-selection-checkbox',
                        self.KPI.value.options.subscribeToSelection,
                        function () {
                            if (self.KPI.value.options.subscribeToSelection !== this.checked) {
                                self.KPI.value.options.subscribeToSelection = this.checked;
                                self.KPI.toggleSubscribeToSelection();
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

                if (self.KPI.representation.options.subscribeFilterToggle) {

                    var subscribeToFilterCheckbox = knimeService.createMenuCheckbox(
                        'subscribe-to-filter-checkbox',
                        self.KPI.value.options.subscribeToFilters,
                        function () {
                            if (self.KPI.value.options.subscribeToFilters !== this.checked) {
                                self.KPI.value.options.subscribeToFilters = this.checked;
                                self.KPI.toggleSubscribeToFilters();
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
