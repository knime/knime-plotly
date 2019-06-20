/* global kt:false, twinlistMultipleSelections:false, KnimePlotlyInterface:false */
window.knimePlotlyLinePlot = (function () {

    var LinePlot = {};

    LinePlot.init = function (representation, value) {

        this.KPI = new KnimePlotlyInterface();
        this.KPI.initialize(representation, value, new kt(), arguments[2]);
        this.columns = this.KPI.getXYCartesianColsWDate(true);
        this.numericColumns = this.KPI.getNumericColumns();
        this.xAxisCol = this.KPI.value.options.xAxisColumn || 'rowKeys';
        this.lineColumns = this.KPI.value.options.columns || [];
        this.onSelectionChange = this.onSelectionChange.bind(this);
        this.onFilterChange = this.onFilterChange.bind(this);

        this.drawChart();
        this.drawKnimeMenu();
        this.KPI.mountAndSubscribe(this.onSelectionChange, this.onFilterChange);
    };

    LinePlot.drawChart = function () {
        var gridColor = this.KPI.hexToRGBA(this.KPI.representation.options.gridColor, .15);
        var t = this.createTraces();
        var l = new this.LayoutObject(this.KPI.representation, this.KPI.value, gridColor);
        var c = new this.ConfigObject(this.KPI.representation, this.KPI.value);
        this.KPI.createElement('knime-line');
        this.KPI.drawChart(t, l, c);
        this.KPI.update();
    };

    LinePlot.createTraces = function () {
        var self = this;
        var traces = [];
        this.KPI.updateOrderedIndicies(this.xAxisCol);
        var keys = {
            dataKeys: [self.xAxisCol, 'rowKeys', 'rowColors'],
            plotlyKeys: [['x'], ['text', 'ids'], ['marker.color']]
        };
        this.KPI.updateKeys(keys);
        var data = self.KPI.getData(keys);

        self.lineColumns.forEach(function (col, colInd) {
            var yData = self.KPI.getData({ dataKeys: [col] });
            var xData = data[self.xAxisCol][0];
            var newTrace = new self.TraceObject(xData, yData[col][0]);

            newTrace.marker.color = data.rowColors[0];
            newTrace.text = data.rowKeys[0];
            newTrace.ids = data.rowKeys[0];
            newTrace.name = col;
            newTrace.dataKeys = [self.xAxisCol, col, 'rowKeys', 'rowColors'];
            traces.push(newTrace);
        });

        keys = {
            plotlyKeys: [['x'], ['y'], ['text', 'ids'], ['marker.color']]
        };
        this.KPI.updateKeys(keys);
        return traces;
    };

    LinePlot.TraceObject = function (xData, yData) {
        this.x = xData;
        this.y = yData;
        this.mode = 'lines+markers';
        this.type = 'scatter';
        this.name = '';
        this.marker = {
            color: [],
            opacity: .5,
            size: 4
            // line: {
            //     width: 1
            // }
        };
        this.line = {
            color: [],
            opacity: .1,
            width: 1
        };
        this.unselected = {
            marker: {
                opacity: .1
            }
        };
        this.selected = {
            marker: {
                opacity: 1,
                size: 10,
                line: {
                    width: 10,
                    color: '#ffffff'
                }
            }
        };
        return this;
    };

    LinePlot.LayoutObject = function (rep, val, gridColor) {
        this.title = {
            text: val.options.title || 'Line Plot',
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

    LinePlot.ConfigObject = function (rep, val) {
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

    LinePlot.getSVG = function () {
        return this.KPI.getSVG();
    };

    LinePlot.validate = function () {
        return true;
    };

    LinePlot.getComponentValue = function () {
        return this.KPI.getComponentValue();
    };

    LinePlot.onSelectionChange = function (data) {
        if (data) {
            this.KPI.updateSelected(data);
            var changeObj = this.KPI.getFilteredChangeObject();
            this.KPI.update(changeObj);
        }
    };

    LinePlot.onFilterChange = function (data) {
        if (data) {
            this.KPI.updateFilter(data);
            var changeObj = this.KPI.getFilteredChangeObject();
            this.KPI.update(changeObj);
        }
    };

    LinePlot.drawKnimeMenu = function () {

        var self = this;

        if (self.KPI.representation.options.enableViewControls) {

            if (self.KPI.value.options.showFullscreen) {
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
                    self.columns = columnSelect.getSelections();
                    var valObj = {
                        columns: self.columns
                    };
                    var changeObj = {
                        visible: []
                    };
                    self.KPI.traceDirectory.forEach(function (trace) {
                        if (self.columns.indexOf(trace.dataKeys[1]) > -1) {
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

    return LinePlot;

})();
