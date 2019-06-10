/* global kt:false, KnimePlotlyInterface:false */
window.knimeBubbleChart = (function () {

    var BubbleChart = {};

    BubbleChart.init = function (representation, value) {

        var self = this;
        this.Plotly = arguments[2][0];
        this.KPI = new KnimePlotlyInterface();
        this.KPI.initialize(representation, value, new kt(), arguments[2][0]);
        this.columns = this.KPI.table.getColumnNames();
        this.columnTypes = this.KPI.table.getColumnTypes();
        this.numericColumns = this.columns.filter(function (c, i) {
            return self.columnTypes[i] === 'number';
        });

        this.xAxisCol = this.KPI.value.options.xAxisColumn || this.columns[0];
        this.yAxisCol = this.KPI.value.options.yAxisColumn || this.columns[1];
        this.sizeCol = this.KPI.value.options.sizeColumn || this.columns[2];
        this.onSelectionChange = this.onSelectionChange.bind(this);
        this.onFilterChange = this.onFilterChange.bind(this);

        this.drawChart();
        this.drawKnimeMenu();
        this.KPI.mountAndSubscribe(this.onSelectionChange, this.onFilterChange);
    };

    BubbleChart.drawChart = function () {
        var t = this.createTraces();
        var l = new this.LayoutObject(this.KPI.representation, this.KPI.value);
        var c = new this.ConfigObject(this.KPI.representation, this.KPI.value);
        this.KPI.createElement('knime-bubble');
        this.KPI.drawChart(t, l, c);
    };

    BubbleChart.createTraces = function () {
        var self = this;
        var traces = [];
        var keys = {
            dataKeys: [self.xAxisCol, self.yAxisCol, self.sizeCol, 'rowKeys', 'rowColors'],
            plotlyKeys: [['x'], ['y'], ['marker.size'], ['text', 'ids'], ['marker.color']]
        };

        var data = this.KPI.getData(keys);

        data.names.forEach(function (group, groupInd) {
            var newTrace = new self.TraceObject(data[self.xAxisCol][groupInd],
                data[self.yAxisCol][groupInd], data[self.sizeCol][groupInd]);
            newTrace.marker.color = data.rowColors[groupInd];
            newTrace.text = data.rowKeys[groupInd];
            newTrace.ids = data.rowKeys[groupInd];
            newTrace.dataKeys = keys.dataKeys;
            newTrace.name = group;
            traces.push(newTrace);
        });

        return traces;
    };

    BubbleChart.TraceObject = function (xData, yData, sizeData) {
        var max = -Number.MAX_SAFE_INTEGER;
        sizeData.forEach(function (size) {
            max = Math.max(max, size);
        });
        this.x = xData;
        this.y = yData;
        this.mode = 'markers';
        this.name = '';
        this.marker = {
            color: [],
            opacity: .5,
            size: sizeData,
            sizeref: 2.0 * max / 40 ** 2, // arb 40
            sizemode: 'area'
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

    BubbleChart.LayoutObject = function (rep, val) {
        this.title = {
            text: val.options.title || 'Bubble Chart',
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

    BubbleChart.ConfigObject = function (rep, val) {
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

    BubbleChart.onSelectionChange = function (data) {
        if (data) {
            this.KPI.updateSelected(data);
            var changeObj = {};
            changeObj = this.KPI.getFilteredChangeObject();
            this.KPI.update(changeObj);
        }
    };

    BubbleChart.onFilterChange = function (data) {
        if (data) {
            this.KPI.updateFilter(data);
            var changeObj = this.KPI.getFilteredChangeObject();
            this.KPI.update(changeObj);
        }
    };

    BubbleChart.getComponentValue = function () {
        return this.KPI.getComponentValue();
    };

    BubbleChart.drawKnimeMenu = function () {

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

            if (self.KPI.representation.options.enableFeatureSelection) {
                var xAxisSelection = knimeService.createMenuSelect(
                    'x-axis-menu-item',
                    this.columns.indexOf(this.xAxisCol),
                    this.columns,
                    function () {
                        if (self.xAxisCol !== this.value) {
                            self.xAxisCol = this.value;
                            var layoutObj = {
                                'xaxis.title': self.xAxisCol
                            };
                            var keys = {
                                dataKeys: [self.xAxisCol, self.yAxisCol, self.sizeCol, 'rowKeys', 'rowColors'],
                                plotlyKeys: [['x'], ['y'], ['marker.size'], ['text', 'ids'], ['marker.color']]
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
                    'x',
                    xAxisSelection,
                    null,
                    knimeService.SMALL_ICON
                );

                var yAxisSelection = knimeService.createMenuSelect(
                    'y-axis-menu-item',
                    this.columns.indexOf(this.yAxisCol),
                    this.columns,
                    function () {
                        if (self.yAxisCol !== this.value) {
                            self.yAxisCol = this.value;
                            var layoutObj = {
                                'yaxis.title': self.yAxisCol
                            };
                            var keys = {
                                dataKeys: [self.xAxisCol, self.yAxisCol, self.sizeCol, 'rowKeys', 'rowColors'],
                                plotlyKeys: [['x'], ['y'], ['marker.size'], ['text', 'ids'], ['marker.color']]
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
                    'y',
                    yAxisSelection,
                    null,
                    knimeService.SMALL_ICON
                );

                var sizeSelection = knimeService.createMenuSelect(
                    'size-menu-item',
                    self.columns.indexOf(self.sizeCol),
                    this.numericColumns,
                    function () {
                        if (self.sizeCol !== this.value) {
                            self.sizeCol = this.value;
                            var keys = {
                                dataKeys: [self.xAxisCol, self.yAxisCol, self.sizeCol, 'rowKeys', 'rowColors'],
                                plotlyKeys: [['x'], ['y'], ['marker.size'], ['text', 'ids'], ['marker.color']]
                            };
                            var valueObj = {
                                sizeColumn: self.sizeCol
                            };
                            self.KPI.updateValue(valueObj);
                            self.KPI.updateKeys(keys);
                            self.KPI.update();
                        }
                    }
                );

                knimeService.addMenuItem(
                    'Size Column',
                    'size',
                    sizeSelection,
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
                                self.KPI.togglePublishSelection();
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

    return BubbleChart;

})();
