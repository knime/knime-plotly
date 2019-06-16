/* global kt:false, KnimePlotlyInterface:false  */
window.knimePlotlyScatterPlot3D = (function () {

    var ScatterPlot3D = {};

    ScatterPlot3D.init = function (representation, value) {

        this.KPI = new KnimePlotlyInterface();
        this.KPI.initialize(representation, value, new kt(), arguments[2]);
        this.columns = this.KPI.getXYCartesianColsWDate(true);
        this.xAxisCol = this.KPI.value.options.xAxisColumn || 'rowKeys';
        this.yAxisCol = this.KPI.value.options.yAxisColumn || 'rowKeys';
        this.zAxisCol = this.KPI.value.options.zAxisColumn || 'rowKeys';
        this.onSelectionChange = this.onSelectionChange.bind(this);
        this.onFilterChange = this.onFilterChange.bind(this);

        this.drawChart();
        this.drawKnimeMenu();
        this.KPI.mountAndSubscribe(this.onSelectionChange, this.onFilterChange);
    };

    ScatterPlot3D.drawChart = function () {
        var t = this.createTraces();
        var l = new this.LayoutObject(this.KPI.representation, this.KPI.value);
        var c = new this.ConfigObject(this.KPI.representation, this.KPI.value);
        this.KPI.createElement('knime-scatter3D');
        this.KPI.drawChart(t, l, c);
    };

    ScatterPlot3D.createTraces = function () {
        var self = this;
        var traces = [];
        var keys = {
            dataKeys: [self.xAxisCol, self.yAxisCol, self.zAxisCol, 'rowKeys', 'rowColors'],
            plotlyKeys: [['x'], ['y'], ['z'], ['text', 'ids'], ['marker.color']]
        };

        var data = this.KPI.getData(keys);

        data.names.forEach(function (group, groupInd) {
            var newTrace = new self.TraceObject(data[self.xAxisCol][groupInd],
                data[self.yAxisCol][groupInd], data[self.zAxisCol][groupInd]);
            newTrace.marker.color = data.rowColors[groupInd];
            newTrace.text = data.rowKeys[groupInd];
            newTrace.ids = data.rowKeys[groupInd];
            newTrace.dataKeys = keys.dataKeys;
            newTrace.name = group;
            traces.push(newTrace);
        });
        return traces;
    };

    ScatterPlot3D.TraceObject = function (xData, yData, zData) {
        this.x = xData;
        this.y = yData;
        this.z = zData;
        this.mode = 'markers';
        this.type = 'scatter3d'; // possible to do scattergl
        this.name = '';
        this.marker = {
            color: [],
            opacity: .3,
            size: 5
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

    ScatterPlot3D.LayoutObject = function (rep, val) {
        this.title = {
            text: val.options.title || '3D Scatter Plot',
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
        this.scene = {
            camera: {
                eye: {
                    x: 1.5,
                    y: 1.5,
                    z: .5
                }
            },
            zaxis: {
                title: val.options.zAxisLabel.length > 0 ? val.options.zAxisLabel :
                    val.options.zAxisColumn,
                font: {
                    size: 12,
                    family: 'sans-serif'
                },
                showgrid: val.options.showGrid,
                gridcolor: '#fffff', // potential option
                linecolor: '#fffff', // potential option
                linewidth: 1,
                nticks: 10
            },
            yaxis: {
                title: val.options.yAxisLabel.length > 0 ? val.options.yAxisLabel :
                    val.options.yAxisColumn,
                font: {
                    size: 12,
                    family: 'sans-serif'
                },
                showgrid: val.options.showGrid,
                gridcolor: '#fffff', // potential option
                linecolor: '#fffff', // potential option
                linewidth: 1,
                nticks: 10
            },
            xaxis: {
                title: val.options.xAxisLabel.length > 0 ? val.options.xAxisLabel :
                    val.options.xAxisColumn,
                font: {
                    size: 12,
                    family: 'sans-serif'
                },
                showgrid: val.options.showGrid,
                gridcolor: '#fffff', // potential option
                linecolor: '#fffff', // potential option
                linewidth: 1,
                nticks: 10

            }
        };
        this.margin = {
            l: 50,
            r: 15,
            b: 35,
            t: 50,
            pad: 0
        };
        this.hovermode = rep.options.tooltipToggle ? 'closest' : 'none';
        this.paper_bgcolor = rep.options.daColor || '#ffffff';
        this.plot_bgcolor = rep.options.backgroundColor || '#ffffff';
    };

    ScatterPlot3D.ConfigObject = function (rep, val) {
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
            'hoverCompareCartesian', 'hovermode', 'hoverClosest3d'];
        return this;
    };

    ScatterPlot3D.getSVG = function () {
        return this.KPI.getSVG();
    };

    ScatterPlot3D.validate = function () {
        return true;
    };

    ScatterPlot3D.getComponentValue = function () {
        return this.KPI.getComponentValue();
    };

    ScatterPlot3D.onSelectionChange = function (data) {
        if (data) {
            this.KPI.updateSelected(data);
            var changeObj = this.getSelectedChangeObject();
            this.KPI.update(changeObj);
        }
    };

    ScatterPlot3D.onFilterChange = function (data) {
        if (data) {
            this.KPI.updateFilter(data);
            var changeObj = this.getSelectedChangeObject();
            this.KPI.update(changeObj);
        }
    };

    ScatterPlot3D.getSelectedChangeObject = function (filteredObj) {
        var self = this;
        var changeObj = filteredObj || this.KPI.getFilteredChangeObject();
        changeObj['marker.opacity'] = [];
        changeObj.ids.forEach(function (idArr, traceInd) {
            idArr.forEach(function (rowKey, rowInd) {
                if (self.KPI.totalSelected > 0) {
                    if (!self.KPI.selected.has(rowKey)) {
                        changeObj['marker.color'][traceInd][rowInd] = '#d3d3d3';
                    }
                }
            });
            if (self.KPI.showOnlySelected) {
                changeObj['marker.opacity'][traceInd] = self.KPI.selected.length < 1 ? 0.00001 : 0.4;
            } else {
                changeObj['marker.opacity'][traceInd] = .4;
            }
        });
        return changeObj;
    };

    ScatterPlot3D.drawKnimeMenu = function () {

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
                                'scene.xaxis.title': self.xAxisCol
                            };
                            var keys = {
                                dataKeys: [self.xAxisCol, self.yAxisCol, self.zAxisCol, 'rowKeys', 'rowColors'],
                                plotlyKeys: [['x'], ['y'], ['z'], ['text', 'ids'], ['marker.color']]
                            };
                            var valueObj = {
                                xAxisColumn: self.xAxisCol
                            };
                            self.KPI.updateValue(valueObj);
                            self.KPI.updateKeys(keys);
                            var changeObj = self.getSelectedChangeObject();
                            self.KPI.update(changeObj, layoutObj);
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
                                'scene.yaxis.title': self.yAxisCol
                            };
                            var keys = {
                                dataKeys: [self.xAxisCol, self.yAxisCol, self.zAxisCol, 'rowKeys', 'rowColors'],
                                plotlyKeys: [['x'], ['y'], ['z'], ['text', 'ids'], ['marker.color']]
                            };
                            var valueObj = {
                                yAxisColumn: self.yAxisCol
                            };
                            self.KPI.updateValue(valueObj);
                            self.KPI.updateKeys(keys);
                            var changeObj = self.getSelectedChangeObject();
                            self.KPI.update(changeObj, layoutObj);
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

                var zAxisSelection = knimeService.createMenuSelect(
                    'z-axis-menu-item',
                    this.zAxisCol,
                    this.columns,
                    function () {
                        if (self.zAxisCol !== this.value) {
                            self.zAxisCol = this.value;
                            var layoutObj = {
                                'scene.zaxis.title': self.zAxisCol
                            };
                            var keys = {
                                dataKeys: [self.xAxisCol, self.yAxisCol, self.zAxisCol, 'rowKeys', 'rowColors'],
                                plotlyKeys: [['x'], ['y'], ['z'], ['text', 'ids'], ['marker.color']]
                            };
                            var valueObj = {
                                zAxisColumn: self.zAxisCol
                            };
                            self.KPI.updateValue(valueObj);
                            self.KPI.updateKeys(keys);
                            var changeObj = self.getSelectedChangeObject();
                            self.KPI.update(changeObj, layoutObj);
                        }
                    }
                );

                knimeService.addMenuItem(
                    'Z-Axis',
                    'long-arrow-left',
                    zAxisSelection,
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
                            var changeObj = self.getSelectedChangeObject();
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

    return ScatterPlot3D;

})();
