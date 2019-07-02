/* global kt:false, twinlistMultipleSelections:false, KnimePlotlyInterface:false  */
window.knimeRadarPlot = (function () {

    var RadarPlot = {};

    RadarPlot.init = function (representation, value) {
        var self = this;
        this.KPI = new KnimePlotlyInterface();
        this.KPI.initialize(representation, value, new kt(), arguments[2]);
        this.numericColumns = this.KPI.getNumericColumns();
        this.inclColumns = this.KPI.value.options.columns;
        this.onSelectionChange = this.onSelectionChange.bind(this);
        this.onFilterChange = this.onFilterChange.bind(this);
        var ie11Log = Math.log(this.KPI.totalRows) * Math.LOG10E;
        this.opacity = this.KPI.totalRows > 2500 ? .5 / ie11Log
            : .5 / ie11Log;
        this.legendTraces = [];
        this.groupSet = new this.KPI.KSet([]);
        this.hiddenSet = new this.KPI.KSet([]);
        this.groupColors = {};

        this.drawChart();
        this.KPI.Plotly.addTraces('knime-radar', this.legendTraces);
        this.colorDataArea();
        this.drawKnimeMenu();
        this.KPI.mountAndSubscribe(this.onSelectionChange, this.onFilterChange);
        document.getElementById('knime-radar').on('plotly_relayout', function (eData) {
            self.colorDataArea();
            self.updateLegend();
        });
        document.getElementById('knime-radar').on('plotly_restyle', function (eData) {
            self.colorDataArea();
            self.updateLegend();
        });
        document.getElementById('knime-radar').on('plotly_legendclick', function (eData) {
            if (eData.curveNumber && eData.data) {
                var lg = eData.data[eData.curveNumber].legendgroup;
                if (self.hiddenSet.has(lg)) {
                    self.hiddenSet.delete(lg);
                } else {
                    self.hiddenSet.add(lg);
                }
                var changeObj = self.getChangeObj();
                self.KPI.update(changeObj);
            }
            self.colorDataArea();
            return false;
        });
    };

    RadarPlot.drawChart = function () {
        var gridColor = this.KPI.hexToRGBA(this.KPI.representation.options.gridColor, .15);
        var t = this.createTraces();
        var l = new this.LayoutObject(this.KPI.representation, this.KPI.value, gridColor);
        var c = new this.ConfigObject(this.KPI.representation, this.KPI.value);
        this.KPI.createElement('knime-radar');
        this.KPI.drawChart(t, l, c);
    };

    RadarPlot.colorDataArea = function () {
        var dataArea = document.querySelector('.plotbg');
        if (dataArea && dataArea.children) {
            dataArea.children[0].setAttribute('style', 'fill: ' + this.KPI.representation.options.daColor +
                ';fill-opacity: 1');
        }
    };

    RadarPlot.updateLegend = function () {
        var self = this;
        var legend = document.querySelector('.scrollbox');
        if (legend) {
            for (var i = 0; i < legend.children.length; i++) {
                if (self.hiddenSet.has(legend.children[i].children[0].textContent)) {
                    legend.children[i].children[0].style.opacity = .5;
                } else {
                    legend.children[i].children[0].style.opacity = 1;
                }
            }
        }
    };

    RadarPlot.createTraces = function () {
        var self = this;
        var traces = [];
        var dummyData = [];

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
                dummyData[colInd] = 0;
            });

            d.push(d[0]);
            t.push(t[0]);
            var trace = new self.TraceObject(d, t, rowKey, fc, lc, n, i);
            if (self.KPI.representation.options.groupByColumn &&
                self.KPI.data[self.KPI.representation.options.groupByColumn]) {
                var group = self.KPI.data[self.KPI.representation.options.groupByColumn][rowInd];
                if (!self.groupSet.has(group)) {
                    self.groupColors[group] = [];
                }
                self.groupSet.add(group);
                self.groupColors[group].push(lc);
                trace.legendgroup = group;
            }
            traces.push(trace);
        });

        var groups = self.groupSet.getArray();

        if (groups.length > 0 && this.KPI.value.options.showLegend) {
            groups.forEach(function (group) {
                var groupColor = self.KPI.getMostFrequentColor(self.groupColors[group]);
                self.groupColors[group].mostColor = groupColor;
                var gTrace = new self.TraceObject(dummyData, self.inclColumns,
                    '', groupColor, groupColor, group, [''])
                gTrace.showlegend = true;
                self.legendTraces.push(gTrace);
            });
        }

        return traces;
    };

    RadarPlot.TraceObject = function (rData, thetaData, rowId, fillColor, lineColor, name, ids) {
        this.r = rData;
        this.theta = thetaData;
        this.type = 'scatterpolar';
        // this.fill = 'toself';
        this.connectends = true;
        // this.fillcolor = 'rgba(159, 159, 159, 0.1)';
        // this.fillcolor = fillColor;
        this.legendgroup = name;
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

    RadarPlot.LayoutObject = function (rep, val, gridColor) {
        this.title = {
            text: val.options.title,
            y: 1.1,
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
                },
                color: gridColor,
            }
        };
        this.font = {
            size: 12,
            family: 'sans-serif'
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

    RadarPlot.ConfigObject = function (rep, val) {
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
            visible: []
        };
        changeObj['line.width'] = [];
        changeObj['line.color'] = [];
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
                if (self.KPI.representation.options.groupByColumn && self.legendTraces.length > 0 && vis) {
                    vis = !self.hiddenSet.has(self.KPI.data[self.KPI.representation.options.groupByColumn][rowInd]);
                }
                var selected = self.KPI.selected.has(rowKey);
                var origColor = self.KPI.data.rowColors[rowInd];
                var color = selected ? self.KPI.hexToRGBA(origColor, self.opacity)
                    : self.KPI.hexToRGBA(origColor, .2);
                var width = selected ? 4 : 2;
                changeObj.visible.push(self.KPI.showOnlySelected && vis ? selected : vis);
                changeObj['line.color'].push(color);
                changeObj['line.width'].push(self.KPI.totalSelected > 0 ? width : 3);
            });
            this.legendTraces.forEach(function (legend) {
                changeObj.visible.push(true);
                changeObj['line.color'].push(self.groupColors[legend.name].mostColor);
                changeObj['line.width'].push(3);
            });
        }
        return changeObj;
    };

    RadarPlot.drawKnimeMenu = function () {

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

            if (self.KPI.representation.options.showSelectedOnlyToggle &&
                (self.KPI.representation.options.enableSelection || (knimeService.isInteractivityAvailable() &&
                    (self.KPI.representation.options.subscribeSelectionToggle || self.KPI.value.options.subscribeToSelection)))) {

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

    return RadarPlot;

})();
