/* global kt:false, twinlistMultipleSelections:false, KnimePlotlyInterface:false  */
window.knimeRadarPlot = (function () {

    var RadarPlot = {};

    RadarPlot.init = function (representation, value) {
        var self = this;
        this.KPI = new KnimePlotlyInterface();
        this.KPI.initialize(representation, value, new kt(), arguments[2][0]);
        this.columns = this.KPI.table.getColumnNames();
        this.columnTypes = this.KPI.table.getColumnTypes();
        this.numericColumns = this.columns.filter(function (c, i) {
            return self.columnTypes[i] === 'number';
        });
        this.inclColumns = this.KPI.value.options.columns;
        this.onSelectionChange = this.onSelectionChange.bind(this);
        this.onFilterChange = this.onFilterChange.bind(this);
        this.opacity = this.KPI.totalRows > 2500 ? .5 / Math.log10(this.KPI.totalRows)
            : .5 / Math.log10(this.KPI.totalRows);

        this.drawChart();
        this.drawKnimeMenu();
        this.KPI.mountAndSubscribe(this.onSelectionChange, this.onFilterChange);
    };

    RadarPlot.drawChart = function () {
        var t = this.createTraces();
        var l = new this.LayoutObject(this.KPI.representation, this.KPI.value);
        var c = new this.ConfigObject(this.KPI.representation, this.KPI.value);
        this.KPI.createElement('knime-radar');
        this.KPI.drawChart(t, l, c);
    };

    RadarPlot.createTraces = function () {
        var self = this;
        var traces = [];
        var groupSet = new this.KPI.KSet([]);

        this.KPI.data.rowKeys.forEach(function (rowKey, rowInd) {
            var d = [];
            var t = self.inclColumns;
            var color = self.KPI.data.rowColors[rowInd];
            var fc = ['rgba(159, 159, 159, 0.1)'];
            var lc = self.KPI.hexToRGBA(color, self.opacity);
            var n = self.KPI.data[self.KPI.representation.groupByColumn]
                ? self.KPI.data[self.KPI.representation.groupByColumn][rowInd] : rowKey;
            var i = [];

            t.forEach(function (col, colInd) {
                d.push(self.KPI.data[col][rowInd]);
                i.push(rowKey);
            });

            d.push(d[0]);
            t.push(t[0]);
            var trace = new self.TraceObject(d, t, rowKey, fc, lc, n, i);
            if (self.KPI.representation.enableGroups && self.KPI.data[col]) {
                // TODO: test this lengend option
                var group = self.KPI.data[self.KPI.representation.groupByColumn][rowInd];
                groupSet.add(group);
                trace.legendgroup = group;
            }
            traces.push(trace);
        });

        var groups = groupSet.getArray();

        if (groups.length > 0 && this.KPI.value.options.showLegend) {
            // TODO: test this lengend option
            groups.forEach(function (group) {
                var gTrace = {
                    name: group,
                    r: [0],
                    theta: [0],
                    legendgroup: group,
                    showlegend: true,
                    ids: ['']
                };
                traces.push(gTrace);
            });
        }

        return traces;
    };

    RadarPlot.TraceObject = function (rData, thetaData, rowId, fillColor, lineColor, name, ids) {
        this.r = rData;
        this.theta = thetaData;
        this.type = 'scatterpolargl';
        // this.fill = 'toself';
        this.connectends = true;
        // this.fillcolor = 'rgba(159, 159, 159, 0.1)';
        // this.fillcolor = fillColor;
        this.showlegend = false;
        this.name = name || rowId;
        this.id = rowId;
        this.ids = ids;
        this.marker = {
            color: lineColor,
            size: 6,
            opacity: .3
        };
        this.line = {
            width: 3,
            color: lineColor
        };
        return this;
    };

    RadarPlot.LayoutObject = function (rep, val) {
        this.title = {
            text: val.options.title || 'Radar Plot',
            y: 1.2,
            x: .5,
            xanchor: 'center',
            xref: 'paper',
            yref: 'paper',
            yanchor: 'bottom'
        };
        this.showlegend = val.options.showLegend;
        this.autoSize = true;
        this.legend = {
            x: 1,
            y: 1
        };
        this.polar = {
            radialaxis: {
                visible: true,
                title: {
                    text: val.options.axisLabel || ''
                }
            }
        };
        this.font = {
            size: 12,
            family: 'sans-serif'
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

    RadarPlot.ConfigObject = function (rep, val) {
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
        this.showTips = false;
        this.showLink = rep.options.enablePlotlyEditor;
        this.modeBarButtonsToRemove = ['hoverClosestCartesian',
            'hoverCompareCartesian', 'toggleHover'
            // , 'select2d', 'lasso2d', 'zoom2d'
        ];
        return this;
    };

    RadarPlot.getSVG = function () {
        return this.KPI.getSVG();
    };

    RadarPlot.validate = function () {
        return true;
    };

    RadarPlot.getComponentValue = function () {
        return this.KPI.getComponentValue();
    };

    RadarPlot.onSelectionChange = function (data) {
        if (data) {
            this.KPI.updateSelected(data);
            var changeObj = this.getChangeObj();
            this.KPI.update(changeObj);
        }
    };

    RadarPlot.onFilterChange = function (data) {
        if (data) {
            this.KPI.updateFilter(data);
            var changeObj = this.getChangeObj();
            this.KPI.update(changeObj);
        }
    };

    RadarPlot.getChangeObj = function () {
        var self = this;
        var changeObj = {
            ['line.width']: [],
            ['line.color']: [],
            visible: []
        };
        if (self.KPI.totalSelected === 0 && self.KPI.showOnlySelected) {
            this.KPI.data.rowKeys.forEach(function (rowKey, rowInd) {
                changeObj.visible.push(false);
                var color = self.KPI.hexToRGBA(self.KPI.data.rowColors[rowInd], .00001);
                changeObj['line.color'].push(color);
            });
            delete changeObj['line.width'];
            changeObj.visible[changeObj.visible.length - 1] = true;
        } else {
            this.KPI.data.rowKeys.forEach(function (rowKey, rowInd) {
                var vis = self.KPI.filtered.has(rowKey);
                var selected = self.KPI.selected.has(rowKey);
                var origColor = self.KPI.data.rowColors[rowInd];
                var color = selected ? self.KPI.hexToRGBA(origColor, self.opacity)
                    : self.KPI.hexToRGBA(origColor, .2);
                var width = selected ? 4 : 2;
                changeObj.visible.push(self.KPI.showOnlySelected && vis ? selected : vis);
                changeObj['line.color'].push(color);
                changeObj['line.width'].push(self.KPI.totalSelected > 0 ? width : 3);
            });
        }
        return changeObj;
    };

    RadarPlot.drawKnimeMenu = function () {

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
                // temporarily use controlContainer to solve th resizing problem with ySelect
                var controlContainer = self.KPI.Plotly.d3.select('#' + self.KPI.divID).insert('table', '#radarContainer ~ *')
                    .attr('id', 'radarControls')
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
                columnSelect.setSelections(this.inclColumns);
                columnSelect.addValueChangedListener(function () {
                    self.inclColumns = columnSelect.getSelections();
                    var valueObj = {
                        columns: self.inclColumns
                    };
                    self.KPI.updateValue(valueObj);

                    var changeObj = self.getChangeObj();
                    changeObj.r = [];
                    changeObj.theta = [];
                    changeObj.ids = [];

                    self.KPI.data.rowKeys.forEach(function (rowKey, rowInd) {
                        var d = [];
                        var i = [];
                        var t = [];

                        self.inclColumns.forEach(function (col) {
                            d.push(self.KPI.data[col][rowInd]);
                            i.push(rowKey);
                            t.push(col);
                        });

                        d.push(d[0]);
                        t.push(t[0]);
                        changeObj.r.push(d);
                        changeObj.theta.push(t);
                        changeObj.ids.push(i);
                    });
                    self.KPI.update(changeObj);

                });
                knimeService.addMenuItem('Columns:', 'long-arrow-up', columnSelectComponent);

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
                        if (self.KPI.showOnlySelected !== this.checked) {
                            self.KPI.updateShowOnlySelected(this.checked);
                            var changeObj = self.getChangeObj();
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

    return RadarPlot;

})();
