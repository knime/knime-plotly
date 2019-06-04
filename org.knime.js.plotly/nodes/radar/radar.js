
/////////////////PLOTLY DATA////////////////////////////
var KnimelyDataProcessor = function () {

    //Created during processData step
    this._rowDirectory;
    this._domain;
    this._rowCount;

    this.initialize = function (knimeDataTable, nameColumnInd) {
        var self = this;
        var rowColors = knimeDataTable.getRowColors();
        var rowCount = 0;

        this._rowDirectory = {};
        this._domain = [Number.MAX_VALUE, -Number.MIN_VALUE];

        knimeDataTable.getRows().forEach(function (row, rowInd) {

            self._rowDirectory[row.rowKey] = {
                id: row.rowKey,
                tInd: rowInd,
                pInd: rowInd,
                fInd: rowInd,
                data: row.data,
                color: rowColors[rowInd] || 'lightblue',
                name: row.data[nameColumnInd]
            };

            rowCount++;
        });

        this._rowCount = rowCount;
        return this;
    };

    return this;
};
/////////////////END PLOTLY DATA////////////////////////////


/* global kt:false */
window.knimeRadarPlot = (function () {

    var RadarPlot = {};

    RadarPlot.init = function (representation, value) {
        var self = this;

        this.Plotly = arguments[2][0];
        this._representation = representation;
        this._value = value;
        this._table = new kt()
        this._table.setDataTable(representation.inObjects[0]);
        this._columns = this._table.getColumnNames();
        this._columnTypes = this._table.getColumnTypes();
        this._numericColumns = this._columns.filter(function (col, colInd) {
            return self._columnTypes[colInd] === 'number';
        })
        this._nameColInd = this._columns.indexOf(this._representation.options.groupByColumn);
        this._inclColumns = this._value.options.columns;
        this._inclColInd = [];
        this._columns.forEach(function (col, colInd) {
            if (self._inclColumns.indexOf(col) > -1) {
                self._inclColInd.push(colInd);
            }
        })
        this._knimelyObj = new KnimelyDataProcessor();
        this._knimelyObj.initialize(this._table, this._groupByColInd);
        this._opacity = this._knimelyObj._rowCount > 2500 ? .5 / (Math.log10(this._knimelyObj._rowCount)) :
            .5 / (Math.log10(this._knimelyObj._rowCount));

        this.createElement();
        this.drawChart();
        this.drawKnimeMenu();
        this.collectGarbage();
    };

    RadarPlot.drawChart = function () {
        var traces = this.createTraces();
        var layout = new this.LayoutObject(this._representation, this._value);
        var config = new this.ConfigObject(this._representation, this._value);

        this._knimelyObj._domain[0] -= this._knimelyObj._domain[0] * .01;
        this._knimelyObj._domain[1] += this._knimelyObj._domain[1] * .01;
        layout.polar.radialaxis.range = this._knimelyObj._domain;

        this.Plotly.newPlot('knime-radar', traces, layout, config);
    };

    RadarPlot.createElement = function () {
        //Create the plotly HTML element 
        let div = document.createElement('DIV');
        div.setAttribute('id', 'knime-radar');
        document.body.append(div);
    };

    RadarPlot.createTraces = function () {
        var self = this;
        var traces = [];

        Object.values(this._knimelyObj._rowDirectory).forEach(function (rowObj) {
            var data = [];
            var columns = [];
            self._inclColInd.forEach(function (ind) {
                data.push(rowObj.data[ind]);
                columns.push(self._columns[ind]);
                self._knimelyObj._domain[0] = Math.min(self._knimelyObj._domain[0], rowObj.data[ind]);
                self._knimelyObj._domain[1] = Math.max(self._knimelyObj._domain[1], rowObj.data[ind]);
            });
            data.push(data[0]);
            columns.push(columns[0]);

            traces.push(new self.TraceObject(data, columns, rowObj.id,
                rowObj.color, rowObj.name, self._opacity));
        });

        return traces;
    };


    RadarPlot.getSVG = function () {
        this.Plotly.toImage(this.Plotly.d3.select('#knime-radar').node(),
            { format: 'svg', width: 800, height: 600 }).then(function (dataUrl) {
                //TODO: decode URI
                return decodeURIComponent(dataUrl)
            })
    }

    RadarPlot.TraceObject = function (rData, thetaData, rowId, color, name, opacity) {
        this.r = rData;
        this.theta = thetaData;
        this.type = 'scatterpolar';
        this.fill = 'toself';
        // this.fillcolor = 'rgba(159, 159, 159, 0.1)';
        this.fillcolor = RadarPlot.hexToRGBA(color, 0);
        this.name = name || rowId;
        this.id = rowId;
        this.marker = {
            color: RadarPlot.hexToRGBA(color, opacity),
            size: 6,
            opacity: .3
        }
        this.line = {
            width: 3,
            color: RadarPlot.hexToRGBA(color, opacity)
        };
        return this;
    }

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
            y: 1,
        };
        this.polar = {
            radialaxis: {
                visible: true,
                title: {
                    text: val.options.axisLabel || '',
                }
            }
        }
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
        this.hovermode = rep.options.tooltipToggle ? 'closest' : 'none'
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

    RadarPlot.collectGarbage = function () {
        this._representation.inObjects[0].rows = null;
        this._table.setDataTable(this._representation.inObjects[0]);
    };

    RadarPlot.drawKnimeMenu = function () {

        var self = this;

        if (this._representation.options.enableViewControls) {

            if (this._representation.options.enableFeatureSelection) {
                // temporarily use controlContainer to solve th resizing problem with ySelect
                var controlContainer = this.Plotly.d3.select("#knime-radar").insert("table", "#radarContainer ~ *")
                    .attr("id", "radarControls")
                    /*.style("width", "100%")*/
                    .style("padding", "10px")
                    .style("margin", "0 auto")
                    .style("box-sizing", "border-box")
                    .style("font-family", 'san-serif')
                    .style("font-size", 12 + "px")
                    .style("border-spacing", 0)
                    .style("border-collapse", "collapse");
                var columnChangeContainer = controlContainer.append("tr");
                var columnSelect = new twinlistMultipleSelections();
                var columnSelectComponent = columnSelect.getComponent().get(0);
                columnChangeContainer.append("td").attr("colspan", "3").node().appendChild(columnSelectComponent);
                columnSelect.setChoices(this._numericColumns);
                columnSelect.setSelections(this._inclColumns);
                columnSelect.addValueChangedListener(function () {
                    self._inclColumns = columnSelect.getSelections();
                    self._inclColInd = [];
                    self._columns.forEach(function (col, colInd) {
                        if (self._inclColumns.indexOf(col) > -1) {
                            self._inclColInd.push(colInd);
                        }
                    })

                    self._knimelyObj._domain[0] -= self._knimelyObj._domain[0] * .01;
                    self._knimelyObj._domain[1] += self._knimelyObj._domain[1] * .01;

                    var changeObj = self.createTraces();
                    var x = new self.LayoutObject(self._representation, self._value);
                    x.polar.radialaxis.range = null;

                    self.Plotly.react('knime-radar', changeObj, x);
                });
                knimeService.addMenuItem('Columns:', 'long-arrow-up', columnSelectComponent);

                controlContainer.remove();

                knimeService.addMenuDivider();
            }

            if (this._representation.options.tooltipToggle) {

                var tooltipToggleCheckBox = knimeService.createMenuCheckbox(
                    'show-tooltips-checkbox',
                    this._representation.options.tooltipToggle,
                    function () {
                        if (self._representation.options.tooltipToggle !== this.checked) {
                            self._representation.options.tooltipToggle = this.checked;
                            var layoutObj = {
                                hovermode: self._representation.options.tooltipToggle ?
                                    'closest' : false
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
        this._knimelyObj._domain = [Number.MAX_VALUE, -Number.MIN_VALUE];

        Object.values(this._knimelyObj._rowDirectory).forEach(function (rowObj) {
            var data = [];
            var columns = [];
            self._inclColInd.forEach(function (ind) {
                data.push(rowObj.data[ind]);
                columns.push(self._columns[ind]);
                self._knimelyObj._domain[0] = Math.min(self._knimelyObj._domain[0], rowObj.data[ind]);
                self._knimelyObj._domain[1] = Math.max(self._knimelyObj._domain[1], rowObj.data[ind]);
            });
            data.push(data[0]);
            columns.push(columns[0]);

            traces.r.push(data);
            traces.theta.push(columns);
        });

        return traces;
    }

    RadarPlot.hexToRGBA = function (hColor, alph) {
        return 'rgba(' + parseInt(hColor.slice(1, 3), 16) + ', ' +
            parseInt(hColor.slice(3, 5), 16) + ', ' +
            parseInt(hColor.slice(5, 7), 16) + ', ' + alph + ')';
    }

    return RadarPlot;

})();