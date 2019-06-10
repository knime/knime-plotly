/* global kt:false, KnimePlotlyInterface:false  */
window.knimeViolin = (function () {

    var ViolinPlot = {};

    ViolinPlot.init = function (representation, value) {

        var self = this;
        this.Plotly = arguments[2][0];
        this.KPI = new KnimePlotlyInterface();
        this.KPI.initialize(representation, value, new kt(), arguments[2][0]);
        this.columns = this.KPI.table.getColumnNames();
        this.columnTypes = this.KPI.table.getColumnTypes();
        this.numericColumns = this.columns.filter(function (c, i) {
            return self.columnTypes[i] === 'number';
        });
        this.axisCol = this.KPI.value.options.axisColumn || this.columns[0];
        this.groupByCol = this.KPI.representation.options.groupByColumn || 'Data Set';
        this.plotlyNumColKey = this.KPI.value.options.plotDirection === 'Vertical' ? 'y' : 'x';
        this.plotlyGroupColKey = this.KPI.value.options.plotDirection === 'Vertical' ? 'x' : 'y';
        this.onSelectionChange = this.onSelectionChange.bind(this);
        this.onFilterChange = this.onFilterChange.bind(this);

        this.drawChart();
        this.drawKnimeMenu();
        this.KPI.mountAndSubscribe(this.onSelectionChange, this.onFilterChange);
    };

    ViolinPlot.drawChart = function () {
        var t = this.createTraces();
        var l = new this.LayoutObject(this.KPI.representation, this.KPI.value);
        var c = new this.ConfigObject(this.KPI.representation, this.KPI.value);
        this.KPI.createElement('knime-violin');
        this.KPI.drawChart(t, l, c);
    };

    ViolinPlot.createTraces = function () {
        var self = this;
        var traces = [];
        var keys = {
            dataKeys: [self.axisCol, self.groupByCol, 'rowKeys', 'rowColors'],
            plotlyKeys: [[self.plotlyNumColKey], [self.plotlyGroupColKey], ['text', 'ids'], ['marker.color']]
        };
        var plotDirection = this.KPI.value.options.plotDirection;

        var data = this.KPI.getData(keys);
        
        data.names.forEach(function (group, groupInd) {
            var transforms = self.getTransforms(data[self.groupByCol][groupInd], data.rowColors[groupInd]);
            var newTrace = new self.TraceObject(data[self.axisCol][groupInd],
                data[self.groupByCol][groupInd], plotDirection);
            newTrace.transforms = transforms;
            newTrace.text = data.rowKeys[groupInd];
            newTrace.ids = data.rowKeys[groupInd];
            newTrace.dataKeys = keys.dataKeys;
            newTrace.name = group;
            traces.push(newTrace);
        });

        return traces;

    };

    ViolinPlot.TraceObject = function (numData, groupData, plotDirection) {
        this.x = plotDirection === 'Vertical' ? groupData : numData;
        this.y = plotDirection === 'Vertical' ? numData : '0';
        this.type = 'violin';
        this.points = 'none';
        this.box = {
            visible: true
        };
        this.meanline = {
            visible: true
        };
        this.line = {
            color: 'green'
        };

        return this;
    };

    ViolinPlot.LayoutObject = function (rep, val) {
        var groupedColLabel = rep.options.groupedAxisLabel || rep.options.groupByColumn;
        var numericColLabel = val.options.numAxisLabel || val.options.axisColumn;
        this.title = {
            text: val.options.title || 'Violin Plot',
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
            title: val.options.plotDirection === 'Vertical' ? groupedColLabel : numericColLabel,
            font: {
                size: 12,
                family: 'sans-serif'
            },
            showgrid: val.options.plotDirection === 'Vertical' ? false : val.options.showGrid,
            gridcolor: '#fffff', // potential option
            linecolor: '#fffff', // potential option
            linewidth: 1,
            zeroline: val.options.plotDirection === 'Vertical' ? val.options.showGrid : false
        };
        this.yaxis = {
            title: val.options.plotDirection === 'Vertical' ? numericColLabel : groupedColLabel,
            font: {
                size: 12,
                family: 'sans-serif'
            },
            showgrid: val.options.plotDirection === 'Vertical' ? val.options.showGrid : false,
            gridcolor: '#fffff', // potential option
            linecolor: '#fffff', // potential option
            linewidth: 1,
            zeroline: val.options.plotDirection === 'Vertical' ? false : val.options.showGrid
        };
        this.margin = {
            l: val.options.plotDirection === 'Vertical' ? 55 : 90,
            r: 20,
            b: 55,
            t: 60,
            pad: 0
        };
        this.hovermode = rep.options.tooltipToggle ? 'closest' : 'none';
        this.paper_bgcolor = rep.options.daColor || '#ffffff';
        this.plot_bgcolor = rep.options.backgroundColor || '#ffffff';
        return this;
    };

    ViolinPlot.ConfigObject = function (rep, val) {
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
        this.modeBarButtonsToRemove = ['hoverClosestCartesian', 'hoverCompareCartesian'];
        return this;
    };

    ViolinPlot.onSelectionChange = function (data) {
        if (data) {
            this.KPI.updateSelected(data);
            var changeObj = {};
            changeObj = this.KPI.getFilteredChangeObject();
            this.KPI.update(changeObj);
        }
    };

    ViolinPlot.onFilterChange = function (data) {
        if (data) {
            this.KPI.updateFilter(data);
            var changeObj = this.KPI.getFilteredChangeObject();
            var tGroups = changeObj[this.plotlyGroupColKey][0];
            var tColors = changeObj['marker.color'][0];
    
            changeObj.transforms = [this.getTransforms(tGroups, tColors)];
    
            if (this.KPI.value.options.plotDirection === 'Horizontal') {
                delete changeObj[this.plotlyGroupColKey];
            }
            this.KPI.update(changeObj);
        }
    };

    ViolinPlot.getTransforms = function (groupData, colors) {
        var style = [];
        var self = this;
        var groupSet = new self.KPI.KSet([]);
        var groupColors = new self.KPI.KMap([]);
        groupData.forEach(function (group, gInd) {
            if (groupSet.has(group)) {
                var gColorMap = groupColors.get(group);
                var count = gColorMap.has(colors[gInd]) ? gColorMap.get(colors[gInd]) + 1 : 1;
                gColorMap.set(colors[gInd], count);
                groupColors.set(group, gColorMap);
            } else {
                groupSet.add(group);
                var nonGroupColorMap = new self.KPI.KMap([]);
                nonGroupColorMap.set(colors[gInd], 1);
                groupColors.set(group, nonGroupColorMap);
            }
        });

        groupSet.getArray().forEach(function (group) {
            var min = 0;
            var color = '#8dd3c7';
            groupColors.get(group).values().forEach(function (value, key) {
                if (value > min) {
                    min = value;
                    color = key;
                }
            });
            style.push({
                target: group,
                value: {
                    line: {
                        color: color
                    }
                }
            });
        });

        var transforms = [{
            type: 'groupby',
            groups: groupData,
            styles: style
        }];

        return transforms;
    };

    ViolinPlot.drawKnimeMenu = function () {

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
                var axisColSelection = knimeService.createMenuSelect(
                    'axis-col-menu-item',
                    this.columns.indexOf(this.axisCol),
                    this.numericColumns,
                    function () {
                        if (self.axisCol !== this.value) {
                            self.axisCol = this.value;
                            var valueObj = {
                                axisColumn: self.sizeCol
                            };
                            var keys = {
                                dataKeys: [self.axisCol, self.groupByCol, 'rowKeys', 'rowColors'],
                                plotlyKeys: [[self.plotlyNumColKey], [self.plotlyGroupColKey], ['text', 'ids'], ['marker.color']]
                            };
                            var layoutObjKey = self.plotlyNumColKey + 'axis.title';
                            var layoutObj = {};
                            layoutObj[layoutObjKey] = self.axisCol;
                            self.KPI.updateValue(valueObj);
                            self.KPI.updateKeys(keys);
                            self.KPI.update(false, layoutObj);
                        }
                    }
                );

                knimeService.addMenuItem(
                    'Axis Column',
                    'calculator',
                    axisColSelection,
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

    return ViolinPlot;

})();
