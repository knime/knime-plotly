/* global kt:false, KnimePlotlyInterface:false  */
window.knimePlotlyScatterPlot = (function () {

    var ScatterPlot = {};

    ScatterPlot.init = function (representation, value) {

        this.KPI = new KnimePlotlyInterface();
        this.KPI.initialize(representation, value, new kt(), arguments[2]);
        this.columns = this.KPI.getXYCartesianColsWDate(true);
        this.xAxisCol = this.KPI.value.options.xAxisColumn || 'rowKeys';
        this.yAxisCol = this.KPI.value.options.yAxisColumn || 'rowKeys';
        this.onSelectionChange = this.onSelectionChange.bind(this);
        this.onFilterChange = this.onFilterChange.bind(this);

        this.drawChart();
        this.drawKnimeMenu();
        this.KPI.mountAndSubscribe(this.onSelectionChange, this.onFilterChange);
    };

    ScatterPlot.drawChart = function () {
        var gridColor = this.KPI.hexToRGBA(this.KPI.representation.options.gridColor, .15);
        var t = this.createTraces();
        var l = new this.LayoutObject(this.KPI.representation, this.KPI.value, gridColor);
        var c = new this.ConfigObject(this.KPI.representation, this.KPI.value);
        this.KPI.createElement('knime-scatter');
        this.KPI.drawChart(t, l, c);
    };

    ScatterPlot.createTraces = function () {
        var self = this;
        var traces = [];
        var keys = {
            dataKeys: [self.xAxisCol, self.yAxisCol, 'rowKeys', 'rowColors'],
            plotlyKeys: [['x'], ['y'], ['text', 'ids'], ['marker.color']]
        };

        var data = this.KPI.getData(keys);

        data.names.forEach(function (group, groupInd) {
            var newTrace = new self.TraceObject(data[self.xAxisCol][groupInd],
                data[self.yAxisCol][groupInd]);
            newTrace.marker.color = data.rowColors[groupInd];
            newTrace.text = data.rowKeys[groupInd];
            newTrace.ids = data.rowKeys[groupInd];
            newTrace.dataKeys = keys.dataKeys;
            newTrace.name = group;
            traces.push(newTrace);
        });

        return traces;
    };

    ScatterPlot.TraceObject = function (xData, yData) {
        this.x = xData;
        this.y = yData;
        this.mode = 'markers';
        this.type = 'scatter';
        this.name = '';
        this.marker = {
            color: [],
            opacity: .5
        };
        this.unselected = {
            marker: {
                opacity: .1
            }
        };
        this.selected = {
            marker: {
                opacity: 1
            }
        };
        return this;
    };

    ScatterPlot.LayoutObject = function (rep, val, gridColor) {
        this.title = {
            text: val.options.title || 'Scatter Plot',
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
                : val.options.yAxisColumn,
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

    ScatterPlot.ConfigObject = function (rep, val) {
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

    ScatterPlot.getSVG = function () {
        return this.KPI.getSVG();
    };

    ScatterPlot.validate = function () {
        return true;
    };

    ScatterPlot.getComponentValue = function () {
        return this.KPI.getComponentValue();
    };

    ScatterPlot.onSelectionChange = function (data) {
        if (data) {
            this.KPI.updateSelected(data);
            var changeObj = {};
            changeObj = this.KPI.getFilteredChangeObject();
            this.KPI.update(changeObj);
        }
    };

    ScatterPlot.onFilterChange = function (data) {
        if (data) {
            this.KPI.updateFilter(data);
            var changeObj = this.KPI.getFilteredChangeObject();
            this.KPI.update(changeObj);
        }
    };

    ScatterPlot.drawKnimeMenu = function () {

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
                                dataKeys: [self.xAxisCol, self.yAxisCol, 'rowKeys', 'rowColors'],
                                plotlyKeys: [['x'], ['y'], ['text', 'ids'], ['marker.color']]
                            };
                            var valueObj = {
                                xAxisColumn: self.xAxisCol
                            };
                            self.KPI.updateValue(valueObj);
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

                var yAxisSelection = knimeService.createMenuSelect(
                    'y-axis-menu-item',
                    this.yAxisCol,
                    this.columns,
                    function () {
                        if (self.yAxisCol !== this.value) {
                            self.yAxisCol = this.value;
                            var layoutObj = {
                                'yaxis.title': self.yAxisCol
                            };
                            var keys = {
                                dataKeys: [self.xAxisCol, self.yAxisCol, 'rowKeys', 'rowColors'],
                                plotlyKeys: [['x'], ['y'], ['text', 'ids'], ['marker.color']]
                            };
                            var valueObj = {
                                yAxisColumn: self.yAxisCol
                            };
                            self.KPI.updateValue(valueObj);
                            self.KPI.updateKeys(keys);
                            self.KPI.update(false, layoutObj);
                        }
                    }
                );

                knimeService.addMenuItem(
                    'Y-Axis',
                    'long-arrow-up',
                    yAxisSelection,
                    null,
                    knimeService.SMALL_ICON
                );

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

    return ScatterPlot;

})();
