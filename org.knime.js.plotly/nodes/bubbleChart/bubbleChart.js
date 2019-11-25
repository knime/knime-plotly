/* global kt:false, KnimePlotlyInterface:false */
window.knimeBubbleChart = (function () {

    var BubbleChart = {};

    BubbleChart.init = function (representation, value) {

        this.KPI = new KnimePlotlyInterface();
        this.KPI.initialize(representation, value, new kt(), arguments[2]);
        this.columns = this.KPI.getXYCartesianColsWDate(true);
        this.numericColumns = this.KPI.getNumericColumns();
        this.xAxisCol = this.KPI.value.options.xAxisColumn || 'rowKeys';
        this.yAxisCol = this.KPI.value.options.yAxisColumn || 'rowKeys';
        this.sizeCol = this.KPI.value.options.sizeColumn || this.columns[2];
        this.onSelectionChange = this.onSelectionChange.bind(this);
        this.onFilterChange = this.onFilterChange.bind(this);

        this.drawChart();
        this.drawKnimeMenu();
        this.KPI.mountAndSubscribe(this.onSelectionChange, this.onFilterChange);
    };

    BubbleChart.drawChart = function () {
        var gridColor = this.KPI.hexToRGBA(this.KPI.representation.options.gridColor, .15);
        var t = this.createTraces();
        var l = new this.LayoutObject(this.KPI.representation, this.KPI.value, gridColor);
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
        var sizeMult = this.KPI.value.options.sizeMultiplier;
        var max = -Number.MAX_SAFE_INTEGER;

        data.names.forEach(function (group, groupInd) {

            data[self.sizeCol][groupInd].forEach(function (size) {
                max = Math.max(max, size);
            });

            var newTrace = new self.TraceObject(data[self.xAxisCol][groupInd],
                data[self.yAxisCol][groupInd], data[self.sizeCol][groupInd]);
            newTrace.marker.color = data.rowColors[groupInd];
            newTrace.text = data.rowKeys[groupInd];
            newTrace.ids = data.rowKeys[groupInd];
            newTrace.dataKeys = keys.dataKeys;
            newTrace.name = group;
            traces.push(newTrace);
        });

        traces.forEach(function (trace) {
            trace.marker.sizeref = 2.0 * max / Math.pow(sizeMult, 2);
        });

        return traces;
    };

    BubbleChart.TraceObject = function (xData, yData, sizeData) {
        this.x = xData;
        this.y = yData;
        this.mode = 'markers';
        this.type = 'scatter';
        this.name = '';
        this.marker = {
            color: [],
            opacity: .5,
            size: sizeData,
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

    BubbleChart.LayoutObject = function (rep, val, gridColor) {
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
            y: 1,
            itemsizing: 'constant'
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
            nticks: 10,
            minorgridcount: 1
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

    BubbleChart.ConfigObject = function (rep, val) {
        this.toImageButtonOptions = {
            format: 'svg', // one of png, svg, jpeg, webp
            filename: 'custom_image',
            height: rep.options.svg ? rep.options.svg.height : 600,
            width: rep.options.svg ? rep.options.svg.width : 800,
            scale: 1 // Multiply title/legend/axis/canvas sizes by this factor
        };
        this.displaylogo = false;
        this.responsive = rep.options.svg.fullscreen;
        this.editable = rep.options.enableEditing;
        this.scrollZoom = true;
        this.showTips = false;
        this.showLink = rep.options.enablePlotlyEditor;
        this.modeBarButtonsToRemove = ['hoverClosestCartesian',
            'hoverCompareCartesian', 'toggleSpikelines'];
        return this;
    };

    BubbleChart.getSVG = function () {
        return this.KPI.getSVG();
    };

    BubbleChart.validate = function () {
        return true;
    };

    BubbleChart.getComponentValue = function () {
        return this.KPI.getComponentValue();
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

    BubbleChart.drawKnimeMenu = function () {

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
                    'long-arrow-up',
                    yAxisSelection,
                    null,
                    knimeService.SMALL_ICON
                );

                var sizeSelection = knimeService.createMenuSelect(
                    'size-menu-item',
                    self.sizeCol,
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
                    'search',
                    sizeSelection,
                    null,
                    knimeService.SMALL_ICON
                );

                knimeService.addMenuDivider();
            }

            if (self.KPI.representation.options.enableSizeMultOption) {
                var sizeMenuItem = knimeService.createMenuNumberField(
                    'size-menu-item-item',
                    self.KPI.value.options.sizeMultiplier,
                    0,
                    Number.MAX_SAFE_INTEGER,
                    1,
                    function () {
                        if (self.KPI.value.options.sizeMultiplier !== this.value) {
                            var newSizeMult = this.value;
                            var changeObj = self.KPI.getFilteredChangeObject();
                            var numTraces = changeObj['marker.size'].length;
                            var max = -Number.MAX_SAFE_INTEGER;
                            changeObj['marker.sizeref'] = [];
                            for (var i = 0; i < 2; i++) {
                                for (var j = 0; j < numTraces; j++) {
                                    if (i === 0) {
                                        changeObj['marker.size'][j].forEach(function (size) {
                                            max = Math.max(max, size);
                                        });
                                    } else {
                                        changeObj['marker.sizeref'].push(2.0 * max / Math.pow(newSizeMult, 2));
                                    }
                                }
                            }
                            var valueObj = {
                                sizeMultiplier: newSizeMult
                            };
                            self.KPI.updateValue(valueObj);
                            self.KPI.update(changeObj);
                        }
                    },
                    true
                );

                knimeService.addMenuItem(
                    'Bubble size parameter:',
                    'arrows-h',
                    sizeMenuItem,
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
                                self.KPI.togglePublishSelection(self.onSelectionChange);
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

    return BubbleChart;

})();
