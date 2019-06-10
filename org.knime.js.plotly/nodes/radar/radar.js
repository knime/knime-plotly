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
        // this.opacity = this.knimelyObj.rowCount > 2500 ? .5 / Math.log10(this.knimelyObj.rowCount)
        //     : .5 / Math.log10(this.knimelyObj.rowCount);
        this.opacity = .5;

        this.drawChart();
        // this.drawKnimeMenu();
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

        this.KPI.data.rowKeys.forEach(function (rowKey, rowInd) {
            var d = [];
            var t = self.inclColumns;
            var color = self.KPI.data.rowColors[rowInd];
            var fc = ['rgba(159, 159, 159, 0.1)'];
            var lc = [self.KPI.hexToRGBA(color, self.opacity)];
            var n = self.KPI.data[self.KPI.representation.groupByColumn] ?
                self.KPI.data[self.KPI.representation.groupByColumn][rowInd] : rowKey;
            var o = self.opacity;

            t.forEach(function (col, colInd) {
                d.push(self.KPI.data[col][rowInd]);
            });

            d.push(d[0]);
            t.push(t[0]);

            var trace = new self.TraceObject(d, t, rowKey, fc, lc, n, o);
            trace.ids = [rowKey];
            traces.push(trace);
        });

        return traces;
    };

    RadarPlot.TraceObject = function (rData, thetaData, rowId, fillColor, lineColor, name) {
        this.r = rData;
        this.theta = thetaData;
        this.type = 'scatterpolar';
        this.fill = 'toself';
        this.connectends = true;
        // this.fillcolor = 'rgba(159, 159, 159, 0.1)';
        this.fillcolor = fillColor;
        this.name = name || rowId;
        this.id = rowId;
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
        this.showLink = rep.options.enablePlotlyEditor;
        this.modeBarButtonsToRemove = ['hoverClosestCartesian',
            'hoverCompareCartesian', 'select2d', 'lasso2d', 'toggleHover',
            'zoom2d'];
        return this;
    };

    RadarPlot.onSelectionChange = function (data) {
        if (data) {
            this.KPI.updateSelected(data);
            var changeObj = {
                ['line.width']: [],
                visible: []
            };
            if (this.KPI.showOnlySelected) {
                this.KPI.data.rowKeys.forEach(function (rowKey) {
                    if (self.KPI.filtered.has(rowKey) && self.KPI.selected.has(rowKey)) {
                        changeObj.visible.push(true);
                    } else {
                        changeObj.visible.push(false);
                    }
                });
            } else {
                this.KPI.data.rowKeys.forEach(function (rowKey) {
                    if (self.KPI.selected.has(rowKey)) {
                        changeObj['line.width.width'].push(3);
                    } else {
                        changeObj['line.width.width'].push(1);
                    }
                });
            }
            this.KPI.update(changeObj);
        }
    };

    RadarPlot.onFilterChange = function (data) {
        if (data) {
            var self = this;
            this.KPI.updateFilter(data);
            var changeObj = {
                visible: []
            };
            this.KPI.data.rowKeys.forEach(function (rowKey) {
                changeObj.visible.push(self.KPI.filtered.has(rowKey));
            });
            this.KPI.update(changeObj);
        }
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

            if (this.representation.options.enableFeatureSelection) {
                // temporarily use controlContainer to solve th resizing problem with ySelect
                var controlContainer = this.Plotly.d3.select('#knime-radar').insert('table', '#radarContainer ~ *')
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
                    self.inclColInd = [];
                    self.columns.forEach(function (col, colInd) {
                        if (self.inclColumns.indexOf(col) > -1) {
                            self.inclColInd.push(colInd);
                        }
                    });

                    self.knimelyObj.domain[0] -= self.knimelyObj.domain[0] * .01;
                    self.knimelyObj.domain[1] += self.knimelyObj.domain[1] * .01;

                    var changeObj = self.createTraces();
                    var x = new self.LayoutObject(self.representation, self.value);
                    x.polar.radialaxis.range = null;

                    self.Plotly.react('knime-radar', changeObj, x);
                });
                knimeService.addMenuItem('Columns:', 'long-arrow-up', columnSelectComponent);

                controlContainer.remove();

                knimeService.addMenuDivider();
            }

            if (this.representation.options.tooltipToggle) {

                var tooltipToggleCheckBox = knimeService.createMenuCheckbox(
                    'show-tooltips-checkbox',
                    this.representation.options.tooltipToggle,
                    function () {
                        if (self.representation.options.tooltipToggle !== this.checked) {
                            self.representation.options.tooltipToggle = this.checked;
                            var layoutObj = {
                                hovermode: self.representation.options.tooltipToggle
                                    ? 'closest' : false
                            };
                            self.Plotly.relayout('knime-radar', layoutObj);
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
        }
    };

    RadarPlot.createChangeObj = function () {
        var self = this;
        var traces = {
            r: [],
            theta: []
        };
        this.knimelyObj.domain = [Number.MAX_VALUE, -Number.MIN_VALUE];

        Object.values(this.knimelyObj.rowDirectory).forEach(function (rowObj) {
            var data = [];
            var columns = [];
            self.inclColInd.forEach(function (ind) {
                data.push(rowObj.data[ind]);
                columns.push(self.columns[ind]);
                self.knimelyObj.domain[0] = Math.min(self.knimelyObj.domain[0], rowObj.data[ind]);
                self.knimelyObj.domain[1] = Math.max(self.knimelyObj.domain[1], rowObj.data[ind]);
            });
            data.push(data[0]);
            columns.push(columns[0]);

            traces.r.push(data);
            traces.theta.push(columns);
        });

        return traces;
    };

    return RadarPlot;

})();
