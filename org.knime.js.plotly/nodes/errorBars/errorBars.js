/* global kt:false, twinlistMultipleSelections:false, KnimePlotlyInterface:false  */
window.knimeErrorBarsPlot = (function () {

    var ErrorBars = {};

    ErrorBars.init = function (representation, value) {

        this.KPI = new KnimePlotlyInterface();
        this.KPI.initialize(representation, value, new kt(), arguments[2]);
        this.columns = this.KPI.getXYCartesianColsWDate(true);
        this.numericColumns = this.KPI.getNumericColumns();
        this.xAxisCol = this.KPI.value.options.xAxisColumn || 'rowKeys';
        this.lineColumns = this.KPI.value.options.columns || [];
        this.errorCol = this.KPI.value.options.errorColumn || this.numericColumns[0];
        this.onSelectionChange = this.onSelectionChange.bind(this);
        this.onFilterChange = this.onFilterChange.bind(this);
        this.calculationMethods = ['Standard Deviation', 'Percent', 'Fixed Value', 'Data Column'];
        this.needsTypeChange = false;

        this.drawChart();
        this.drawKnimeMenu();
        this.KPI.mountAndSubscribe(this.onSelectionChange, this.onFilterChange);
    };

    ErrorBars.drawChart = function () {
        var gridColor = this.KPI.hexToRGBA(this.KPI.representation.options.gridColor, .15);
        var t = this.createTraces();
        var l = new this.LayoutObject(this.KPI.representation, this.KPI.value, gridColor);
        var c = new this.ConfigObject(this.KPI.representation, this.KPI.value);
        if (this.needsTypeChange) {
            t.forEach(function (trace) {
                trace.type = 'scatter';
            });
        }
        this.KPI.createElement('knime-errorbars');
        this.KPI.drawChart(t, l, c);
        this.KPI.update();
    };

    ErrorBars.createTraces = function () {
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
                var eData;
                if (self.KPI.value.options.calcMethod.replace(/\s/g, ' ') === 'Data Column') {
                    eData = self.getErrorObject(data.rowKeys[traceInd]);
                } else {
                    eData = self.getErrorObject(yData[col][0]);
                }
                var newTrace = new self.TraceObject(xData, yData[col][0], eData);
                if (self.KPI.representation.options.enableGroups) {
                    newTrace.line.color = self.KPI.hexToRGBA(self.KPI.getMostFrequentColor(data.rowColors[traceInd].slice()), 1);
                }

                newTrace.marker.color = data.rowColors[traceInd];
                newTrace.line.color = self.KPI.representation.options.overrideColors
                    ? self.KPI.representation.options.dataColor
                    : data.rowColors[traceInd];
                // newTrace.text = self.getHoverText(data.rowKeys[traceInd], col, data.names[traceInd]);
                newTrace.ids = data.rowKeys[traceInd];
                newTrace.name = 'Col: ' + col;
                // newTrace.name = col + '<br>' + data.names[traceInd];
                newTrace.dataKeys = [self.xAxisCol, col, 'rowKeys', 'rowColors'];
                if (xData.length < 2) {
                    self.needsTypeChange = true;
                }
                traces.push(newTrace);
            });
        });

        keys = {
            plotlyKeys: [['x'], ['y'], ['text', 'ids'], ['marker.color']]
        };
        this.KPI.updateKeys(keys);
        return traces;
    };

    ErrorBars.TraceObject = function (xData, yData, eData) {
        this.x = xData;
        this.y = yData;
        this.mode = 'lines+markers';
        this.type = 'scatter';
        this.name = '';
        this.marker = {
            color: [],
            opacity: .5,
            size: 4
        };
        this.error_y = eData;
        this.line = {
            width: 1
        };
        this.unselected = {
            marker: {
                opacity: .1,
                size: 4
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

    ErrorBars.LayoutObject = function (rep, val, gridColor) {
        this.title = {
            text: val.options.title,
            y: 1,
            yref: 'paper',
            yanchor: 'bottom'
        };
        this.showlegend = val.options.showLegend;
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
            showgrid: val.options.showGrid,
            gridcolor: gridColor,
            linecolor: rep.options.gridColor,
            linewidth: 1,
            nticks: 10

        };
        this.yaxis = {
            title: val.options.yAxisLabel.length > 0 ? val.options.yAxisLabel
                : 'y',
            font: {
                size: 12,
                family: 'sans-serif'
            },
            showgrid: val.options.showGrid,
            gridcolor: gridColor,
            linecolor: rep.options.gridColor,
            linewidth: 1,
            nticks: 10
        };
        this.margin = {
            l: 50,
            r: 15,
            b: 35,
            t: 50,
            pad: 0
        };
        this.hovermode = rep.options.tooltipToggle ? 'closest' : 'none';
        this.paper_bgcolor = rep.options.backgroundColor || '#ffffff';
        this.plot_bgcolor = rep.options.daColor || '#ffffff';
    };

    ErrorBars.ConfigObject = function (rep, val) {
        this.toImageButtonOptions = {
            format: 'svg', // one of png, svg, jpeg, webp
            filename: 'custom_image',
            height: rep.options.svg ? rep.options.svg.height : 600,
            width: rep.options.svg ? rep.options.svg.width : 800,
            scale: 1 // Multiply title/legend/axis/canvas sizes by this factor
        };
        this.displaylogo = false;
        this.responsive = rep.options.svg ? rep.options.svg.fullscreen : true;
        this.editable = rep.options.enableEditing;
        this.scrollZoom = true;
        this.showTips = false;
        this.showLink = rep.options.enablePlotlyEditor;
        this.modeBarButtonsToRemove = ['hoverClosestCartesian',
            'hoverCompareCartesian', 'toggleSpikelines'];
        return this;
    };

    ErrorBars.getSVG = function () {
        return this.KPI.getSVG();
    };

    ErrorBars.validate = function () {
        return true;
    };

    ErrorBars.getComponentValue = function () {
        return this.KPI.getComponentValue();
    };

    ErrorBars.onSelectionChange = function (data) {
        if (data) {
            this.KPI.updateSelected(data);
            var changeObj = {};
            changeObj = this.KPI.getFilteredChangeObject();
            this.KPI.update(changeObj);
        }
    };

    ErrorBars.onFilterChange = function (data) {
        if (data) {
            this.KPI.updateFilter(data);
            var changeObj = this.KPI.getFilteredChangeObject();
            this.KPI.update(changeObj);
        }
    };

    ErrorBars.getErrorObject = function (yValues) {
        var self = this;
        var error_y = {
            type: '',
            value: [],
            visible: true
        };

        switch (String(this.KPI.value.options.calcMethod.replace(/\s/g, ' '))) {
        case 'Data Column':
            var data = this.KPI.data[this.errorCol];
            error_y.type = 'data';
            error_y.array = [];
            delete error_y.value;
            yValues.forEach(function (rowKey) {
                error_y.array.push(data[self.KPI.data.rowKeys.indexOf(rowKey)] *
                        self.KPI.representation.options.calcMultiplier);
            });
            break;
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
            variance = Math.sqrt(variance);
            error_y.value = variance * self.KPI.representation.options.calcMultiplier;
            break;
        case 'Percent':
            error_y.type = 'percent';
            error_y.value = self.KPI.representation.options.calcPercent;
            break;
        case 'Fixed Value':
            error_y.type = 'constant';
            error_y.value = self.KPI.representation.options.fixedValue;
            break;
        default:
            break;
        }

        if (isNaN(error_y.value) || error_y.value === null || typeof error_y.value === 'undefined') {
            error_y.value = 0;
        }
        return error_y;
    };

    ErrorBars.getHoverText = function (rowKeys, colName, groupName) {
        var text = [];
        var nameString = this.KPI.representation.options.enableGroups ? ', ' + groupName : '';
        rowKeys.forEach(function (key) {
            text.push(key + ', ' + colName + nameString);
        });
        return text;
    };

    ErrorBars.drawKnimeMenu = function () {

        var self = this;

        if (self.KPI.representation.options.enableViewControls) {

            if (self.KPI.value.options.showFullscreen) {
                knimeService.allowFullscreen();
            }

            if (self.KPI.representation.options.showClearSelectionButton &&
                (self.KPI.representation.options.enableSelection ||
                    (knimeService.isInteractivityAvailable() &&
                        (self.KPI.value.options.subscribeToSelection ||
                            self.KPI.representation.options.subscribeSelectionToggle))
                )) {
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
                            var changeObj = self.KPI.getFilteredChangeObject();
                            var errorChanges = [];
                            changeObj.y.forEach(function (dataArr, traceInd) {
                                if (self.KPI.value.options.calcMethod.replace(/\s/g, ' ') === 'Data Column') {
                                    errorChanges.push(self.getErrorObject(changeObj.ids[traceInd]));
                                } else {
                                    errorChanges.push(self.getErrorObject(dataArr));
                                }
                            });

                            changeObj.error_y = errorChanges;

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
                    this.columns,
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
                            self.KPI.update(false, layoutObj);
                        }
                    }
                );

                knimeService.addMenuItem(
                    'X-Axis',
                    'long-arrow-right',
                    xAxisSelection,
                    null,
                    knimeService.SMALL_ICON
                );

                // temporarily use controlContainer to solve th resizing problem with ySelect
                var controlContainer = this.KPI.Plotly.d3.select('#' + this.KPI.divID).insert('table', '#radarContainer ~ *')
                    .attr('id', 'lineControls')
                    /* .style("width", "100%") */
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

            if (self.KPI.representation.options.showSelectedOnlyToggle &&
                (self.KPI.representation.options.enableSelection || (knimeService.isInteractivityAvailable() &&
                    (self.KPI.representation.options.subscribeSelectionToggle || self.KPI.value.options.subscribeToSelection)))) {

                var showOnlySelectedCheckbox = knimeService.createMenuCheckbox(
                    'show-only-selected-checkbox',
                    this.showOnlySelected,
                    function () {
                        if (self.showOnlySelected !== this.checked) {
                            self.KPI.updateShowOnlySelected(this.checked);
                            self.KPI.update();
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

                if (self.KPI.representation.options.enableSelection &&
                    self.KPI.representation.options.publishSelectionToggle) {

                    var publishSelectionCheckbox = knimeService.createMenuCheckbox(
                        'publish-selection-checkbox',
                        self.KPI.value.options.publishSelection,
                        function () {
                            if (self.KPI.value.options.publishSelection !== this.checked) {
                                self.KPI.value.options.publishSelection = this.checked;
                                self.KPI.togglePublishSelection(self.onSelectionChange);
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

                if (self.KPI.representation.options.subscribeSelectionToggle) {

                    var subscribeToSelectionCheckbox = knimeService.createMenuCheckbox(
                        'subscribe-to-selection-checkbox',
                        self.KPI.value.options.subscribeToSelection,
                        function () {
                            if (self.KPI.value.options.subscribeToSelection !== this.checked) {
                                self.KPI.value.options.subscribeToSelection = this.checked;
                                self.KPI.toggleSubscribeToSelection(self.onSelectionChange);
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
                                self.KPI.toggleSubscribeToFilters(self.onFilterChange);
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

    return ErrorBars;

})();
