/* global kt:false, KnimePlotlyInterface:false */
window.knimeViolin = (function () {

    var ViolinPlot = {};

    ViolinPlot.init = function (representation, value) {

        this.KPI = new KnimePlotlyInterface();
        this.KPI.initialize(representation, value, new kt(), arguments[2]);
        this.columns = this.KPI.getXYCartesianColsWDate(false);
        this.axisCol = this.KPI.value.options.axisColumn || this.columns[0];
        this.groupByCol = this.KPI.representation.options.groupByColumn || 'Data';
        this.plotlyNumColKey = this.KPI.value.options.plotDirection === 'Vertical' ? 'y' : 'x';
        this.plotlyGroupColKey = this.KPI.value.options.plotDirection === 'Vertical' ? 'x' : 'y';
        this.onSelectionChange = this.onSelectionChange.bind(this);
        this.onFilterChange = this.onFilterChange.bind(this);

        this.drawChart();
        this.drawKnimeMenu();
        this.KPI.mountAndSubscribe(this.onSelectionChange, this.onFilterChange);
        this.listenForLabelChanges();
    };

    ViolinPlot.drawChart = function () {
        var t = this.createTraces();
        var l = new this.LayoutObject(this.KPI.representation, this.KPI.value);
        var c = new this.ConfigObject(this.KPI.representation, this.KPI.value);
        this.KPI.createElement('knime-violin');
        this.KPI.drawChart(t, l, c);
    };

    ViolinPlot.listenForLabelChanges = function () {
        var self = this;
        document.getElementById('knime-violin').on('plotly_relayout', function (eData) {
            if (eData) {
                var valueObj = {};
                if (eData['xaxis.title.text']) {
                    if (self.plotlyNumColKey === 'y') {
                        valueObj.groupedAxisLabel = eData['xaxis.title.text'];
                    } else {
                        valueObj.numAxisLabel = eData['xaxis.title.text'];
                    }
                }
                if (eData['yaxis.title.text']) {
                    if (self.plotlyNumColKey === 'y') {
                        valueObj.numAxisLabel = eData['yaxis.title.text'];
                    } else {
                        valueObj.groupedAxisLabel = eData['yaxis.title.text'];
                    }
                }
                self.KPI.updateValue(valueObj);
            }
        });
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
        this.y = plotDirection === 'Vertical' ? numData : '';
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
        var groupedColLabel = val.options.groupedAxisLabel.length === 0
            ? rep.options.groupByColumn : val.options.groupedAxisLabel;
        var numericColLabel = val.options.numAxisLabel.length === 0
            ? val.options.axisColumn : val.options.numAxisLabel;
        this.title = {
            text: val.options.title || 'Violin Plot',
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
            title: val.options.plotDirection === 'Vertical' ? groupedColLabel : numericColLabel,
            font: {
                size: 12,
                family: 'sans-serif'
            },
            tickangle: 0,
            linewidth: 1,
            zeroline: val.options.plotDirection === 'Vertical' ? val.options.showGrid : false
        };
        this.yaxis = {
            title: val.options.plotDirection === 'Vertical' ? numericColLabel : groupedColLabel,
            font: {
                size: 12,
                family: 'sans-serif'
            },
            tickangle: val.options.plotDirection === 'Vertical' ? 'auto' : -90,
            linewidth: 1,
            zeroline: val.options.plotDirection === 'Vertical' ? false : val.options.showGrid
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

    ViolinPlot.ConfigObject = function (rep, val) {
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

    ViolinPlot.getSVG = function () {
        return this.KPI.getSVG();
    };

    ViolinPlot.validate = function () {
        return true;
    };

    ViolinPlot.getComponentValue = function () {
        return this.KPI.getComponentValue();
    };

    ViolinPlot.onSelectionChange = function (data) {
        if (data) {
            this.KPI.updateSelected(data);
            var changeObj = this.getChangeObject();
            this.KPI.update(changeObj);
        }
    };

    ViolinPlot.onFilterChange = function (data) {
        if (data) {
            this.KPI.updateFilter(data);
            var changeObj = this.getChangeObject();
            this.KPI.update(changeObj);
        }
    };

    ViolinPlot.getChangeObject = function () {
        var self = this;
        var changeObj = this.KPI.getFilteredChangeObject();
        changeObj.transforms = [];
        changeObj.ids.forEach(function (idArr, traceInd) {
            var tGroups = changeObj[self.plotlyGroupColKey][traceInd];
            var tColors = changeObj['marker.color'][traceInd];
            changeObj.transforms[traceInd] = self.getTransforms(tGroups, tColors);
        });
        delete changeObj.selectedpoints;
        delete changeObj['marker.color'];
        if (this.KPI.value.options.plotDirection === 'Horizontal') {
            delete changeObj[this.plotlyGroupColKey];
        }
        return changeObj;
    };

    ViolinPlot.getTransforms = function (groupData, colors) {
        var style = [];
        var self = this;
        var groupSet = new self.KPI.KSet([]);
        var colorObj = {};
        groupData.forEach(function (group, gInd) {
            if (typeof colorObj[group] === 'undefined') {
                colorObj[group] = [];
            }
            colorObj[group].push(colors[gInd]);
            groupSet.add(group);
        });

        groupSet.getArray().forEach(function (group) {
            var colors = colorObj[group];
            var color = self.KPI.getMostFrequentColor(colors);
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
                var plotlyLayoutKey = self.plotlyNumColKey + 'axis.title';
                var axisColSelection = knimeService.createMenuSelect(
                    'axis-col-menu-item',
                    this.axisCol,
                    this.columns,
                    function () {
                        if (self.axisCol !== this.value) {
                            self.axisCol = this.value;
                            var valueObj = {
                                axisColumn: self.axisCol
                            };
                            var keys = {
                                dataKeys: [self.axisCol, self.groupByCol, 'rowKeys', 'rowColors'],
                                plotlyKeys: [[self.plotlyNumColKey], [self.plotlyGroupColKey], ['text', 'ids'], ['marker.color']]
                            };
                            var layoutObj = {};
                            layoutObj[plotlyLayoutKey] = self.axisCol;
                            self.KPI.updateValue(valueObj);
                            self.KPI.updateKeys(keys);
                            var changeObj = self.getChangeObject();
                            self.KPI.update(changeObj, layoutObj);
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
                            var changeObj = self.getChangeObject();
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

    return ViolinPlot;

})();
