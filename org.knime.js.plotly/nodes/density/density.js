/* global kt:false, KnimePlotlyInterface:false  */
window.knimeDensity = (function () {

    var Density = {};

    Density.init = function (representation, value) {

        var self = this;
        this.KPI = new KnimePlotlyInterface();
        this.KPI.initialize(representation, value, new kt(), arguments[2][0]);
        this.columns = this.KPI.table.getColumnNames();
        this.columnTypes = this.KPI.table.getColumnTypes();
        this.numericColumns = this.columns.filter(function (c, i) {
            return self.columnTypes[i] === 'number';
        });
        this.xAxisCol = this.KPI.value.options.xAxisColumn || this.columns[0];
        this.yAxisCol = this.KPI.value.options.yAxisColumn || this.columns[1];
        this.onSelectionChange = this.onSelectionChange.bind(this);
        this.onFilterChange = this.onFilterChange.bind(this);
        this.colorscale = 'Hot';

        this.drawChart();
        this.drawKnimeMenu();
        this.KPI.mountAndSubscribe(this.onSelectionChange, this.onFilterChange);
    };

    Density.drawChart = function () {
        var t = this.createTraces();
        var l = new this.LayoutObject(this.KPI.representation, this.KPI.value);
        var c = new this.ConfigObject(this.KPI.representation, this.KPI.value);
        this.KPI.createElement('knime-density');
        this.KPI.drawChart(t, l, c);
    };

    Density.createTraces = function () {
        var self = this;
        var traces = [];
        var keys = {
            dataKeys: [self.xAxisCol, self.yAxisCol, 'rowKeys', 'rowColors'],
            plotlyKeys: [['x'], ['y'], ['text', 'ids'], ['marker.color']]
        };

        var data = this.KPI.getData(keys);

        data.names.forEach(function (group, groupInd) {

            var newTrace = new self.ScatterTraceObject(data[self.xAxisCol][groupInd],
                data[self.yAxisCol][groupInd]);
            newTrace.marker.color = data.rowColors[groupInd];
            newTrace.text = data.rowKeys[groupInd];
            newTrace.ids = data.rowKeys[groupInd];
            newTrace.dataKeys = keys.dataKeys;
            newTrace.name = group;
            traces.push(newTrace);

            var densityTrace = new self.DensityTraceObject(data[self.xAxisCol][groupInd],
                data[self.yAxisCol][groupInd]);
            densityTrace.text = data.rowKeys[groupInd];
            densityTrace.ids = data.rowKeys[groupInd];
            densityTrace.dataKeys = keys.dataKeys;
            densityTrace.name = group;
            traces.push(densityTrace);

            var xHistTrace = new self.XHistogramTraceObject(data[self.xAxisCol][groupInd]);
            xHistTrace.text = data.rowKeys[groupInd];
            xHistTrace.ids = data.rowKeys[groupInd];
            xHistTrace.dataKeys = [self.xAxisCol, null, 'rowKeys', 'rowColors'];
            xHistTrace.name = group;
            traces.push(xHistTrace);

            var yHistTrace = new self.YHistogramTraceObject(data[self.yAxisCol][groupInd]);
            yHistTrace.text = data.rowKeys[groupInd];
            yHistTrace.ids = data.rowKeys[groupInd];
            yHistTrace.dataKeys = [null, self.yAxisCol, 'rowKeys', 'rowColors'];
            yHistTrace.name = group;
            traces.push(yHistTrace);
        });

        return traces;
    };

    Density.ScatterTraceObject = function (xData, yData) {
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

    Density.DensityTraceObject = function (xData, yData) {
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

    Density.XHistogramTraceObject = function (xData) {
        this.x = xData;
        this.name = 'x density';
        this.marker = { color: 'rgb(102,0,0)' };
        this.yaxis = 'y2';
        this.type = 'histogram';
        return this;
    };

    Density.YHistogramTraceObject = function (yData) {
        this.y = yData;
        this.name = 'y density';
        this.marker = { color: 'rgb(102,0,0)' };
        this.xaxis = 'x2';
        this.type = 'histogram';
        return this;
    };

    Density.LayoutObject = function (rep, val) {
        this.title = {
            text: val.options.title || 'Density Plot',
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
            gridcolor: '#fffff', // potential option
            linecolor: '#fffff', // potential option
            linewidth: 1,
            nticks: 10

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
            gridcolor: '#fffff', // potential option
            linecolor: '#fffff', // potential option
            linewidth: 1,
            nticks: 10
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
        this.hovermode = rep.options.tooltipToggle ? 'closest' : 'none';
        this.paper_bgcolor = rep.options.daColor || '#ffffff';
        this.plot_bgcolor = rep.options.backgroundColor || '#ffffff';
    };

    Density.ConfigObject = function (rep, val) {
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

    Density.onSelectionChange = function (data) {
        if (data) {
            this.KPI.updateSelected(data);
            this.KPI.update();
        }
    };

    Density.onFilterChange = function (data) {
        if (data) {
            this.KPI.updateFilter(data);
            var changeObj = this.KPI.getFilteredChangeObject();
            this.KPI.update(changeObj);
        }
    };

    Density.drawKnimeMenu = function () {

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
                                dataKeys: [self.xAxisCol, null, null, null]
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
                                'xaxis.title': self.yAxisCol
                            };
                            var keys = {
                                dataKeys: [null, self.yAxisCol, null, null]
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

                knimeService.addMenuDivider();
            }

            if (self.KPI.representation.options.showDensityColorOptions) {
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
                            };
                            self.KPI.update(changeObj);
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

    return Density;

})();
