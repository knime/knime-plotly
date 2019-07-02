/* global kt:false, KnimePlotlyInterface:false  */
window.knimeDensity2D = (function () {

    var Density2D = {};

    Density2D.init = function (representation, value) {

        this.KPI = new KnimePlotlyInterface();
        this.KPI.initialize(representation, value, new kt(), arguments[2]);
        this.columns = this.KPI.getXYCartesianColsWODate(false);
        this.xAxisCol = this.KPI.value.options.xAxisColumn || this.columns[0];
        this.yAxisCol = this.KPI.value.options.yAxisColumn || this.columns[1];
        this.onSelectionChange = this.onSelectionChange.bind(this);
        this.onFilterChange = this.onFilterChange.bind(this);
        this.colorscale = this.KPI.value.options.colorscale || 'Hot';

        this.drawChart();
        this.drawKnimeMenu();
        this.KPI.mountAndSubscribe(this.onSelectionChange, this.onFilterChange);
    };

    Density2D.drawChart = function () {
        var t = this.createTraces();
        var l = new this.LayoutObject(this.KPI.representation, this.KPI.value);
        var c = new this.ConfigObject(this.KPI.representation, this.KPI.value);
        this.KPI.createElement('knime-density2D');
        this.KPI.drawChart(t, l, c);
        this.KPI.update();
    };

    Density2D.createTraces = function () {
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

            var density2DTrace = new self.Density2DTraceObject(data[self.xAxisCol][groupInd],
                data[self.yAxisCol][groupInd], self.colorscale);
            density2DTrace.text = data.rowKeys[groupInd];
            density2DTrace.ids = data.rowKeys[groupInd];
            density2DTrace.dataKeys = keys.dataKeys;
            density2DTrace.name = group;
            traces.push(density2DTrace);

            if (self.KPI.value.options.showHistogram) {

                var xHistTrace = new self.XHistogramTraceObject(data[self.xAxisCol][groupInd]);
                // xHistTrace.text = data.rowKeys[groupInd];
                xHistTrace.ids = data.rowKeys[groupInd];
                xHistTrace.dataKeys = [self.xAxisCol, null, 'rowKeys', 'rowColors'];
                // xHistTrace.name = group;
                xHistTrace.hoverinfo = 'x+y';
                traces.push(xHistTrace);

                var yHistTrace = new self.YHistogramTraceObject(data[self.yAxisCol][groupInd]);
                // yHistTrace.text = data.rowKeys[groupInd];
                yHistTrace.ids = data.rowKeys[groupInd];
                yHistTrace.dataKeys = [null, self.yAxisCol, 'rowKeys', 'rowColors'];
                // yHistTrace.name = group;
                yHistTrace.hoverinfo = 'x+y';
                traces.push(yHistTrace);
            }
        });

        return traces;
    };

    Density2D.ScatterTraceObject = function (xData, yData) {
        this.x = xData;
        this.y = yData;
        this.mode = 'markers';
        this.name = 'points';
        this.hoverinfo = 'x+y';
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

    Density2D.Density2DTraceObject = function (xData, yData, colorscale) {
        this.x = xData;
        this.y = yData;
        this.name = 'density2D';
        this.hoverinfo = 'x+y';
        this.ncontours = 20;
        this.colorscale = colorscale;
        this.reversescale = true;
        this.showscale = false;
        this.type = 'histogram2dcontour';
        return this;
    };

    Density2D.XHistogramTraceObject = function (xData) {
        this.x = xData;
        this.name = 'x density2D';
        this.marker = {
            color: 'rgb(102,0,0)',
            opacity: 0.4
        };
        this.yaxis = 'y2';
        this.type = 'histogram';
        return this;
    };

    Density2D.YHistogramTraceObject = function (yData) {
        this.y = yData;
        this.name = 'y density2D';
        this.marker = {
            color: 'rgb(102,0,0)',
            opacity: 0.4
        };
        this.xaxis = 'x2';
        this.type = 'histogram';
        return this;
    };

    Density2D.LayoutObject = function (rep, val) {

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
        this.bargap = 0;
        this.xaxis = {
            title: val.options.xAxisLabel.length > 0 ? val.options.xAxisLabel :
                val.options.xAxisColumn,
            font: {
                size: 12,
                family: 'sans-serif'
            },
            domain: val.options.showHistogram ? [0, 0.84] : [0, 1],
            showgrid: false,
            gridcolor: '#000000',
            linecolor: '#000000',
            linewidth: 1,
            nticks: 10

        };
        this.yaxis = {
            title: val.options.yAxisLabel.length > 0 ? val.options.yAxisLabel :
                val.options.yAxisColumn,
            font: {
                size: 12,
                family: 'sans-serif'
            },
            domain: val.options.showHistogram ? [0, 0.84] : [0, 1],
            showgrid: false,
            gridcolor: '#000000',
            linecolor: '#000000',
            linewidth: 1,
            nticks: 10
        };
        if (val.options.showHistogram) {
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
        }
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

    Density2D.ConfigObject = function (rep, val) {
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

    Density2D.getSVG = function () {
        return this.KPI.getSVG();
    };

    Density2D.validate = function () {
        return true;
    };

    Density2D.getComponentValue = function () {
        return this.KPI.getComponentValue();
    };

    Density2D.onSelectionChange = function (data) {
        if (data) {
            this.KPI.updateSelected(data);
            var changeObj = this.KPI.getFilteredChangeObject();
            this.KPI.update(changeObj);
        }
    };

    Density2D.onFilterChange = function (data) {
        if (data) {
            this.KPI.updateFilter(data);
            var changeObj = this.KPI.getFilteredChangeObject();
            this.KPI.update(changeObj);
        }
    };

    Density2D.drawKnimeMenu = function () {

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
                    'long-arrow-up',
                    yAxisSelection,
                    null,
                    knimeService.SMALL_ICON
                );

                knimeService.addMenuDivider();
            }

            if (self.KPI.representation.options.showDensity2DColorOptions) {
                var colorScaleSelection = knimeService.createMenuSelect(
                    'colorscale-menu-item',
                    self.colorscale,
                    ['Hot', 'Greys', 'YlGnBu', 'Greens', 'YlOrRd', 'Bluered', 'RdBu', 'Reds', 'Blues',
                        'Picnic', 'Rainbow', 'Portland', 'Jet', 'Blackbody', 'Earth',
                        'Electric', 'Viridis', 'Cividis.'],
                    function () {
                        if (self.colorscale !== this.value) {
                            self.colorscale = this.value;
                            var changeObj = {
                                colorscale: [self.colorscale]
                            };
                            var valueObj = {
                                colorscale: self.colorscale
                            };
                            self.KPI.updateValue(valueObj);
                            self.KPI.update(changeObj);
                        }
                    }
                );

                knimeService.addMenuItem(
                    'Density2D color',
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

            if (self.KPI.representation.options.showSelectedOnlyToggle &&
                (self.KPI.representation.options.enableSelection || (knimeService.isInteractivityAvailable() &&
                    (self.KPI.representation.options.subscribeSelectionToggle || self.KPI.value.options.subscribeToSelection)))) {

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

    return Density2D;

})();
