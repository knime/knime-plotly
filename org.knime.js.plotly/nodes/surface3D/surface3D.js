/* global kt:false, twinlistMultipleSelections:false, KnimePlotlyInterface:false  */
window.knimeSurface3DPlot = (function () {

    var SurfacePlot = {};

    SurfacePlot.init = function (representation, value) {
        var self = this;
        this.Plotly = arguments[2][0];
        this.KPI = new KnimePlotlyInterface();
        this.KPI.initialize(representation, value, new kt(), arguments[2][0]);
        this.columns = this.KPI.table.getColumnNames();
        this.columnTypes = this.KPI.table.getColumnTypes();
        this.numericColumns = this.columns.filter(function (c, i) {
            return self.columnTypes[i] === 'number';
        });
        this.zAxisCol = this.KPI.value.options.zAxisColumn || this.columns[0];
        this.vectorColumns = this.KPI.value.options.columns || [];
        this.onFilterChange = this.onFilterChange.bind(this);
        this.colorscale = this.KPI.value.options.colorscale || 'Hot';

        this.drawChart();
        this.drawKnimeMenu();
        this.KPI.mountAndSubscribe(null, this.onFilterChange);
    };

    SurfacePlot.drawChart = function () {
        var t = this.createTraces();
        var l = new this.LayoutObject(this.KPI.representation, this.KPI.value);
        var c = new this.ConfigObject(this.KPI.representation, this.KPI.value);
        this.KPI.createElement('knime-surface');
        this.KPI.drawChart(t, l, c);
    };

    SurfacePlot.createTraces = function () {
        var self = this;
        var traces = [];

        this.KPI.updateOrderedIndicies(this.zAxisCol);
        this.KPI.setIsSurface(true);

        var keys = {
            dataKeys: [self.zAxisCol, 'rowKeys'],
            plotlyKeys: [['z'], ['z'], ['text', 'ids']]
        };
        this.KPI.updateKeys(keys);
        var data = self.KPI.getData(keys);
        var zData = [data[self.zAxisCol][0]];

        this.vectorColumns.forEach(function (vCol) {
            zData.push(self.KPI.getOrderedArray(self.KPI.getData({ dataKeys: [vCol] })[vCol][0]));
        });

        var newTrace = new this.TraceObject(zData);
        newTrace.text = data.rowKeys[0];
        newTrace.ids = data.rowKeys[0];
        newTrace.dataKeys = [self.zAxisCol, this.vectorColumns, 'rowKeys'];
        traces.push(newTrace);

        return traces;
    };

    SurfacePlot.TraceObject = function (zData) {
        this.z = zData;
        this.type = 'surface';
        this.name = '';
        return this;
    };

    SurfacePlot.LayoutObject = function (rep, val) {
        this.title = {
            text: val.options.title || 'Surface Plot',
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
        this.scene = {
            camera: {
                eye: {
                    x: 1.5,
                    y: 1.5,
                    z: .5
                }
            },
            zaxis: {
                title: val.options.zAxisLabel.length > 0 ? val.options.zAxisLabel
                    : 'z',
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
            },
            yaxis: {
                title: val.options.yAxisLabel.length > 0 ? val.options.yAxisLabel
                    : 'y',
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
            },
            xaxis: {
                title: val.options.xAxisLabel.length > 0 ? val.options.xAxisLabel
                    : 'x',
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

            }
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

    SurfacePlot.ConfigObject = function (rep, val) {
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
            'hoverCompareCartesian', 'hoverClosest3d'];
        return this;
    };

    SurfacePlot.getSVG = function () {
        return this.KPI.getSVG();
    };

    SurfacePlot.validate = function () {
        return true;
    };

    SurfacePlot.getComponentValue = function () {
        return this.KPI.getComponentValue();
    };

    SurfacePlot.onFilterChange = function (data) {
        if (data) {
            this.KPI.updateFilter(data);
            this.KPI.update();
        }
    };

    SurfacePlot.drawKnimeMenu = function () {

        var self = this;

        if (self.KPI.representation.options.enableViewControls) {

            if (self.KPI.representation.options.showFullscreen) {
                knimeService.allowFullscreen();
            }

            if (self.KPI.representation.options.enableFeatureSelection) {
                var zAxisSelection = knimeService.createMenuSelect(
                    'z-axis-menu-item',
                    self.zAxisCol,
                    self.columns,
                    function () {
                        if (self.zAxisCol !== this.value) {
                            self.zAxisCol = this.value;
                            var layoutObj = {
                                'xaxis.title': self.zAxisCol
                            };
                            var keys = {
                                dataKeys: [self.zAxisCol, null, null]
                            };
                            var valueObj = {
                                zAxisColumn: self.zAxisCol
                            };
                            self.KPI.updateValue(valueObj);
                            self.KPI.updateOrderedIndicies(self.zAxisCol);
                            self.KPI.updateKeys(keys);
                            self.KPI.update(false, layoutObj);
                        }
                    }
                );

                knimeService.addMenuItem(
                    'Z-Axis',
                    'z',
                    zAxisSelection,
                    null,
                    knimeService.SMALL_ICON
                );

                // temporarily use controlContainer to solve th resizing problem with ySelect
                var controlContainer = this.KPI.Plotly.d3.select('#' + this.KPI.divID).insert('table', '#radarContainer ~ *')
                    .attr('id', 'surfaceControls')
                    /* .style('width', '100%') */
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
                columnSelect.setSelections(this.vectorColumns);
                columnSelect.addValueChangedListener(function () {
                    self.vectorColumns = columnSelect.getSelections();
                    var valueObj = {
                        columns: self.vectorColumns
                    };

                    self.KPI.traceDirectory[0].dataKeys = [self.zAxisCol, self.vectorColumns, 'rowKeys'];
                    self.KPI.updateValue(valueObj);
                    self.KPI.update();
                });
                knimeService.addMenuItem('Vectors:', 'long-arrow-up', columnSelectComponent);
                controlContainer.remove();
                knimeService.addMenuDivider();
            }

            if (self.KPI.representation.options.showSurfaceColorOptions) {
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
                    'Surface color',
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
                                hovermode: self.representation.options.tooltipToggle ?
                                    'closest' : false
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

            if (knimeService.isInteractivityAvailable()) {

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

    return SurfacePlot;

})();
