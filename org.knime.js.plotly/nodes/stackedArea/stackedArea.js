/* global kt:false, twinlistMultipleSelections:false, KnimePlotlyInterface:false  */
window.knimePlotlyStackedArea = (function () {

    var StackedArea = {};

    StackedArea.init = function (representation, value) {

        var self = this;
        this.KPI = new KnimePlotlyInterface();
        this.KPI.initialize(representation, value, new kt(), arguments[2][0]);
        this.columns = this.KPI.table.getColumnNames();
        this.columnTypes = this.KPI.table.getColumnTypes();
        this.numericColumns = this.columns.filter(function (c, i) {
            return self.columnTypes[i] === 'number';
        });

        this.xAxisCol = this.KPI.value.options.xAxisColumn || this.columns[0];
        this.lineColumns = this.KPI.value.options.columns || [];
        this.onSelectionChange = this.onSelectionChange.bind(this);
        this.onFilterChange = this.onFilterChange.bind(this);

        this.drawChart();
        this.drawKnimeMenu();
        this.KPI.mountAndSubscribe(this.onSelectionChange, this.onFilterChange);
    };

    StackedArea.drawChart = function () {

        var t = this.createTraces();
        var l = new this.LayoutObject(this.KPI.representation, this.KPI.value);
        var c = new this.ConfigObject(this.KPI.representation, this.KPI.value);
        this.KPI.createElement('knime-stacked-area');
        this.KPI.drawChart(t, l, c);
        this.KPI.update();
    };

    StackedArea.createTraces = function () {
        var self = this;
        var traces = [];
        this.KPI.updateOrderedIndicies(this.xAxisCol);
        var keys = {
            dataKeys: [self.xAxisCol, 'rowKeys', 'rowColors'],
            plotlyKeys: [['x'], ['text', 'ids'], ['marker.color']]
        };
        this.KPI.updateKeys(keys);
        var data = self.KPI.getData(keys);

        self.lineColumns.forEach(function (col, colInd) {
            var yData = self.KPI.getData({ dataKeys: [col] });
            var xData = data[self.xAxisCol][0];
            var newTrace = new self.TraceObject(xData, yData[col][0]);

            newTrace.marker.color = data.rowColors[0];
            // newTrace.line.color = data.rowColors[0];
            newTrace.text = data.rowKeys[0];
            newTrace.ids = data.rowKeys[0];
            newTrace.name = col;
            newTrace.dataKeys = [self.xAxisCol, col, 'rowKeys', 'rowColors'];
            if (self.KPI.representation.options.enableFillArea) {
                if (colInd === 0) {
                    newTrace.fill = 'tozeroy';
                } else {
                    newTrace.fill = 'tonexty';
                }
                newTrace.mode = 'lines+markers';
                newTrace.type = 'scattergl';
            } else {
                newTrace.stackgroup = 'one';
            }
            traces.push(newTrace);
        });

        keys = {
            plotlyKeys: [['x'], ['y'], ['text', 'ids'], ['marker.color']]
        };
        this.KPI.updateKeys(keys);
        return traces;
    };

    StackedArea.TraceObject = function (xData, yData) {
        this.x = xData;
        this.y = yData;
        // this.mode = 'lines+markers';
        // this.type = 'scattergl';
        this.name = '';
        this.marker = {
            color: [],
            opacity: .5,
            size: 4
            // line: {
            //     width: 1
            // }
        };
        this.line = {
            color: [],
            opacity: .1,
            width: 1
        };
        this.unselected = {
            marker: {
                opacity: .1
            }
        };
        this.selected = {
            marker: {
                opacity: 1,
                size: 10,
                line: {
                    width: 10,
                    color: '#ffffff'
                }
            }
        };
        return this;
    };

    StackedArea.LayoutObject = function (rep, val) {
        this.title = {
            text: val.options.title || 'Stacked Area Chart',
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

    StackedArea.ConfigObject = function (rep, val) {
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
            'hoverCompareCartesian', 'toggleSpikelines'];
        return this;
    };

    StackedArea.onSelectionChange = function (data) {
        this.updateSelected(data);
        var changeObj = this.getFilteredChangeObject();
        this.Plotly.restyle('knime-stacked-area', changeObj);
    };

    StackedArea.onFilterChange = function (data) {
        this.updateFilter(data);
        var changeObj = this.getFilteredChangeObject();
        this.Plotly.restyle('knime-stacked-area', changeObj);
    };

    StackedArea.drawKnimeMenu = function () {

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
                    this.numericColumns,
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
                            self.KPI.updateOrderedIndicies(self.xAxisCol);
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

                // temporarily use controlContainer to solve th resizing problem with ySelect
                var controlContainer = this.KPI.Plotly.d3.select('#knime-line').insert('table', '#radarContainer ~ *')
                    .attr('id', 'lineControls')
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
                columnSelect.setSelections(this.lineColumns);
                columnSelect.addValueChangedListener(function () {
                    var newSelected = columnSelect.getSelections();
                    var valObj = {
                        columns: newSelected
                    };
                    var changeObj = {
                        visible: []
                    };

                    self.KPI.traceDirectory.forEach(function (trace) {
                        if (newSelected.indexOf(trace.dataKeys[1]) > -1) {
                            changeObj.visible.push(true);
                        } else {
                            changeObj.visible.push(false);
                        }
                    });
                    self.KPI.updateValue(valObj);
                    self.KPI.update(changeObj);
                });
                knimeService.addMenuItem('Columns (lines):', 'long-arrow-up', columnSelectComponent);
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
                                hovermode: self.representation.options.tooltipToggle
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
                        if (self.showOnlySelected !== this.checked) {
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

    return StackedArea;

})();
