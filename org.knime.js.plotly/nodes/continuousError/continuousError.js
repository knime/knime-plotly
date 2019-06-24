/* global kt:false, twinlistMultipleSelections:false, KnimePlotlyInterface:false  */
window.knimeContinuousErrorPlot = (function () {

    var ContinuousError = {};

    ContinuousError.init = function (representation, value) {

        this.KPI = new KnimePlotlyInterface();
        this.KPI.initialize(representation, value, new kt(), arguments[2]);
        this.columns = this.KPI.getXYCartesianColsWDate(true);
        this.numericColumns = this.KPI.getNumericColumns();
        this.xAxisCol = this.KPI.value.options.xAxisColumn || 'rowKeys';
        this.lineColumns = this.KPI.value.options.columns || [];
        this.errorCol = this.KPI.value.options.errorColumn || this.numericColumns[0];
        this.onSelectionChange = this.onSelectionChange.bind(this);
        this.onFilterChange = this.onFilterChange.bind(this);
        this.calculationMethods = ['Standard Deviation', 'Percent', 'Fixed Value', 'Data Column'];
        this.needsTypeChange = false;
        this.auxillaryTraces = [];
        this.totalTraces = 0;

        this.drawChart();
        this.drawKnimeMenu();
        this.KPI.mountAndSubscribe(this.onSelectionChange, this.onFilterChange);
    };

    ContinuousError.drawChart = function () {
        var gridColor = this.KPI.hexToRGBA(this.KPI.representation.options.gridColor, .15);
        var t = this.createTraces();
        var l = new this.LayoutObject(this.KPI.representation, this.KPI.value, gridColor);
        var c = new this.ConfigObject(this.KPI.representation, this.KPI.value);
        if (this.needsTypeChange) {
            t.forEach(function (trace) {
                trace.type = 'scatter';
            });
        }
        this.KPI.createElement('knime-continuous-error');
        this.KPI.drawChart(t, l, c);
        this.KPI.Plotly.addTraces(this.KPI.divID, this.auxillaryTraces);
    };

    ContinuousError.createTraces = function () {
        var self = this;
        var traces = [];
        this.KPI.updateOrderedIndicies(this.xAxisCol);
        var keys = {
            dataKeys: [self.xAxisCol, 'rowKeys', 'rowColors'],
            plotlyKeys: [['x'], ['text', 'ids'], ['marker.color']]
        };
        this.KPI.updateKeys(keys);
        var data = self.KPI.getData(keys);

        data.names.forEach(function (name, traceInd) {
            self.lineColumns.forEach(function (col, colInd) {
                var yData = self.KPI.getData({ dataKeys: [col] });
                var xData = data[self.xAxisCol][traceInd];
                var newTrace = new self.TraceObject(xData, yData[col][0]);
                var mfColor = self.KPI.representation.options.overrideColors
                    ? self.KPI.representation.options.dataColor
                    : self.colorBank[colInd];
                newTrace.marker.color = data.rowColors[traceInd];
                newTrace.ids = data.rowKeys[traceInd];
                newTrace.name = col;
                newTrace.hoverinfo = 'all';
                newTrace.hoverlabel = {
                    bgcolor: mfColor
                };
                newTrace.hoveron = 'points';
                newTrace.line.color = mfColor;
                newTrace.dataKeys = [self.xAxisCol, col, 'rowKeys', 'rowColors'];
                newTrace.legendgroup = data.names[traceInd];
                if (xData.length < 2) {
                    self.needsTypeChange = true;
                }
                traces.push(newTrace);
                self.totalTraces++;
                var errorTrace = self.getErrorLineData(yData[col][0], xData, data.rowKeys[traceInd], col);
                errorTrace.fillcolor = self.KPI.hexToRGBA(mfColor, .2);
                errorTrace.hoveron = 'points';
                errorTrace.hoverlabel = {
                    bgcolor: mfColor
                };
                errorTrace.dataKeys = [self.xAxisCol, col, 'rowKeys', 'rowColors'];
                errorTrace.legendgroup = data.names[traceInd];
                self.auxillaryTraces.push(errorTrace);
            });
        });

        keys = {
            plotlyKeys: [['x'], ['y'], ['text', 'ids'], ['marker.color']]
        };
        this.KPI.updateKeys(keys);
        return traces;
    };

    ContinuousError.TraceObject = function (xData, yData) {
        this.x = xData;
        this.y = yData;
        this.mode = 'lines+markers';
        this.type = 'scatter';
        this.name = '';
        this.marker = {
            color: [],
            opacity: .1,
            size: .00001
        };
        this.line = {
            width: 1,
            shape: 'spline',
            smoothing: .1
        };
        this.unselected = {
            marker: {
                opacity: .1,
                size: .00001
            }
        };
        this.selected = {
            marker: {
                opacity: 1,
                size: 10
            }
        };
        return this;
    };

    ContinuousError.LayoutObject = function (rep, val, gridColor) {
        this.title = {
            text: val.options.title || 'Continuous Error Plot',
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
            title: val.options.xAxisLabel && val.options.xAxisLabel.length > 0 ? val.options.xAxisLabel
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
            title: val.options.yAxisLabel && val.options.yAxisLabel.length > 0 ? val.options.yAxisLabel
                : 'y',
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

    ContinuousError.ConfigObject = function (rep, val) {
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

    ContinuousError.getSVG = function () {
        return this.KPI.getSVG();
    };

    ContinuousError.validate = function () {
        return true;
    };

    ContinuousError.getComponentValue = function () {
        return this.KPI.getComponentValue();
    };

    ContinuousError.onSelectionChange = function (data) {
        if (data) {
            this.KPI.updateSelected(data);
            var changeObj = this.KPI.getFilteredChangeObject();
            changeObj = this.updateChangeObj(changeObj);
            this.KPI.update(changeObj);
        }
    };

    ContinuousError.onFilterChange = function (data) {
        if (data) {
            this.KPI.updateFilter(data);
            var changeObj = this.KPI.getFilteredChangeObject();
            changeObj = this.updateChangeObj(changeObj);
            this.KPI.update(changeObj);
        }
    };

    ContinuousError.updateChangeObj = function (inChangeObj) {
        var self = this;
        var changeObj = inChangeObj || this.KPI.getFilteredChangeObject();

        changeObj.x.forEach(function (xData, traceInd) {
            var x = changeObj.x[traceInd];
            var y = changeObj.y[traceInd];
            var ids = changeObj.ids[traceInd];
            var eLine = self.getErrorLineData(y, x, ids, self.lineColumns[traceInd]);
            changeObj.x.push(eLine.x);
            changeObj.y.push(eLine.y);
            changeObj.ids.push(eLine.ids);
            for (var key in changeObj) {
                if (key !== 'x' && key !== 'y' && key !== ids) {
                    changeObj[key].push([]);
                }
            }
        });
        return changeObj;
    };

    ContinuousError.getErrorLineData = function (yValues, xValues, rowKeys, name) {
        var self = this;
        var xData = [];
        var yData = [];
        var ids = [];
        var text = [];


        switch (String(this.KPI.value.options.calcMethod.replace(/\s/g, ' '))) {
        case 'Data Column':
            var data = this.KPI.data[this.errorCol];
            var count = 0;
            rowKeys.forEach(function (rowKey, rowInd) {
                var diff = data[self.KPI.data.rowKeys.indexOf(rowKey)] * self.KPI.representation.options.calcMultiplier;
                yData.push(diff
                        + yValues[rowInd]);
                xData.push(xValues[rowInd]);
                ids.push(rowKey);
                text.push('(' + xValues[rowInd] + ', ' + yValues[rowInd] + ' + ' + diff + ')<br>Col: ' +
                        name + ', Row: ' + rowKey);
                count++;
            });
            for (var a = count - 1; a >= 0; a--) {
                var diff = data[self.KPI.data.rowKeys.indexOf(rowKeys[a])] *
                        self.KPI.representation.options.calcMultiplier;
                yData.push(
                    yValues[a] - diff
                );
                xData.push(xValues[a]);
                ids.push(rowKeys[a]);
                text.push('(' + xValues[a] + ', ' + yValues[a] + ' - ' + diff + ')<br>Col: ' +
                        name + ', Row: ' + rowKeys[a]);
                count++;
            }
            break;
        case 'Standard Deviation':
            var sum = 0;
            var count1 = 0;
            var mean = 0;
            yValues.forEach(function (val) {
                if (val === 0 || val) {
                    sum += val;
                    count1++;
                }
            });
            mean = sum / count1;
            var variance = 0;
            yValues.forEach(function (val) {
                if (val === 0 || val) {
                    variance += Math.pow(val - mean, 2);
                }
            });
            variance /= count1 - 1;
            if (!variance) {
                variance = 0;
            }
            variance = Math.sqrt(variance);

            for (var i = 0; i < yValues.length; i++) {
                var diff1 = variance * this.KPI.representation.options.calcMultiplier;
                yData.push(yValues[i] + diff1);
                xData.push(xValues[i]);
                ids.push(rowKeys[i]);
                text.push('(' + xValues[i] + ', ' + yValues[i] + ' + ' + diff1 + ')<br>Col: ' +
                        name + ', Row: ' + rowKeys[i]);
            }
            for (var j = yValues.length - 1; j >= 0; j--) {
                var diff2 = variance * this.KPI.representation.options.calcMultiplier;
                yData.push(yValues[j] + (-1 * diff2));
                xData.push(xValues[j]);
                ids.push(rowKeys[j]);
                text.push('(' + xValues[j] + ', ' + yValues[j] + ' - ' + diff2 + ')<br>Col: ' +
                        name + ', Row: ' + rowKeys[j]);
            }

            break;
        case 'Percent':
            for (var k = 0; k < yValues.length; k++) {
                var diff3 = yValues[k] * (this.KPI.representation.options.calcPercent / 100);
                yData.push(yValues[k] + diff3);
                xData.push(xValues[k]);
                ids.push(rowKeys[k]);
                text.push('(' + xValues[k] + ', ' + yValues[k] + ' + ' + diff3 + ')<br>Col: ' +
                        name + ', Row: ' + rowKeys[k]);
            }
            for (var x = yValues.length - 1; x >= 0; x--) {
                var diff4 = yValues[x] * (this.KPI.representation.options.calcPercent / 100);
                yData.push(yValues[x] + (-1 * diff4));
                xData.push(xValues[x]);
                ids.push(rowKeys[x]);
                text.push('(' + xValues[x] + ', ' + yValues[x] + ' - ' + diff4 + ')<br>Col: ' +
                        name + ', Row: ' + rowKeys[x]);
            }
            break;
        case 'Fixed Value':
            for (var y = 0; y < yValues.length; y++) {
                yData.push(yValues[y] + this.KPI.representation.options.fixedValue);
                xData.push(xValues[y]);
                ids.push(rowKeys[y]);
                text.push('(' + xValues[y] + ', ' + yValues[y] + ' + ' + this.KPI.representation.options.fixedValue + ')<br>Col: ' +
                        name + ', Row: ' + rowKeys[y]);
            }
            for (var z = yValues.length - 1; z >= 0; z--) {
                yData.push(yValues[z] + -1 * this.KPI.representation.options.fixedValue);
                xData.push(xValues[z]);
                ids.push(rowKeys[z]);
                text.push('(' + xValues[z] + ', ' + yValues[z] + ' - ' + this.KPI.representation.options.fixedValue + ')<br>Col: ' +
                        name + ', Row: ' + rowKeys[z]);
            }
            break;
        default:
            break;
        }

        var errorTrace = {
            x: xData,
            y: yData,
            ids: ids,
            text: text,
            hoverinfo: 'text',
            fill: 'toself',
            line: {
                color: 'transparent',
                shape: 'spline',
                smoothing: .1
            },
            mode: 'lines+markers',
            showlegend: false,
            type: 'scatter',
            unselected: {
                marker: {
                    opacity: .00001,
                    size: .00001
                }
            },
            selected: {
                marker: {
                    opacity: .00001,
                    size: .00001
                }
            }
        };

        return errorTrace;
    };

    ContinuousError.getHoverText = function (rowKeys, colName, groupName) {
        var text = [];
        var nameString = this.KPI.representation.options.enableGroups ? ', ' + groupName : '';
        rowKeys.forEach(function (key) {
            text.push(key + ', ' + colName + nameString);
        });
        return text;
    };

    ContinuousError.drawKnimeMenu = function () {

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

            if (self.KPI.representation.options.enableCalcMethodSelection) {
                var calcMethodSelection = knimeService.createMenuSelect(
                    'calc-method-menu-item',
                    self.KPI.value.options.calcMethod.replace(/\s/g, ' '),
                    this.calculationMethods,
                    function () {
                        if (self.KPI.value.options.calcMethod !== this.value) {
                            self.KPI.value.options.calcMethod = this.value;
                            var changeObj = self.updateChangeObj();
                            self.KPI.update(changeObj);
                        }
                    }
                );

                knimeService.addMenuItem(
                    'Calculation Method',
                    'calculator',
                    calcMethodSelection,
                    null,
                    knimeService.SMALL_ICON
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
                                dataKeys: [self.xAxisCol, null, null, null]
                            };
                            var valueObj = {
                                xAxisColumn: self.xAxisCol
                            };
                            self.KPI.updateValue(valueObj);
                            self.KPI.updateOrderedIndicies(self.xAxisCol);
                            self.KPI.updateKeys(keys);
                            var changeObj = self.updateChangeObj();
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

                // temporarily use controlContainer to solve th resizing problem with ySelect
                var controlContainer = self.KPI.Plotly.d3.select('#' + this.KPI.divID).insert('table', '#radarContainer ~ *')
                    .attr('id', 'lineControls')
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
                columnSelect.setSelections(this.lineColumns);
                columnSelect.addValueChangedListener(function () {
                    self.lineColumns = columnSelect.getSelections();
                    var valObj = {
                        columns: self.lineColumns
                    };
                    var changeObj = {
                        visible: []
                    };
                    self.KPI.traceDirectory.forEach(function (trace) {
                        if (self.lineColumns.indexOf(trace.dataKeys[1]) > -1) {
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
                            var changeObj = self.updateChangeObj();
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

    ContinuousError.colorBank = [
        '#63b598', '#ce7d78', '#ea9e70', '#a48a9e', '#c6e1e8', '#648177', '#0d5ac1',
        '#f205e6', '#1c0365', '#14a9ad', '#4ca2f9', '#a4e43f', '#d298e2', '#6119d0',
        '#d2737d', '#c0a43c', '#f2510e', '#651be6', '#79806e', '#61da5e', '#cd2f00',
        '#9348af', '#01ac53', '#c5a4fb', '#996635', '#b11573', '#4bb473', '#75d89e',
        '#2f3f94', '#2f7b99', '#da967d', '#34891f', '#b0d87b', '#ca4751', '#7e50a8',
        '#c4d647', '#e0eeb8', '#11dec1', '#289812', '#566ca0', '#ffdbe1', '#2f1179',
        '#935b6d', '#916988', '#513d98', '#aead3a', '#9e6d71', '#4b5bdc', '#0cd36d',
        '#250662', '#cb5bea', '#228916', '#ac3e1b', '#df514a', '#539397', '#880977',
        '#f697c1', '#ba96ce', '#679c9d', '#c6c42c', '#5d2c52', '#48b41b', '#e1cf3b',
        '#5be4f0', '#57c4d8', '#a4d17a', '#225b8', '#be608b', '#96b00c', '#088baf',
        '#f158bf', '#e145ba', '#ee91e3', '#05d371', '#5426e0', '#4834d0', '#802234',
        '#6749e8', '#0971f0', '#8fb413', '#b2b4f0', '#c3c89d', '#c9a941', '#41d158',
        '#fb21a3', '#51aed9', '#5bb32d', '#807fb', '#21538e', '#89d534', '#d36647',
        '#7fb411', '#0023b8', '#3b8c2a', '#986b53', '#f50422', '#983f7a', '#ea24a3',
        '#79352c', '#521250', '#c79ed2', '#d6dd92', '#e33e52', '#b2be57', '#fa06ec',
        '#1bb699', '#6b2e5f', '#64820f', '#1c271', '#21538e', '#89d534', '#d36647',
        '#7fb411', '#0023b8', '#3b8c2a', '#986b53', '#f50422', '#983f7a', '#ea24a3',
        '#79352c', '#521250', '#c79ed2', '#d6dd92', '#e33e52', '#b2be57', '#fa06ec',
        '#1bb699', '#6b2e5f', '#64820f', '#1c271', '#9cb64a', '#996c48', '#9ab9b7',
        '#06e052', '#e3a481', '#0eb621', '#fc458e', '#b2db15', '#aa226d', '#792ed8',
        '#73872a', '#520d3a', '#cefcb8', '#a5b3d9', '#7d1d85', '#c4fd57', '#f1ae16',
        '#8fe22a', '#ef6e3c', '#243eeb', '#1dc18', '#dd93fd', '#3f8473', '#e7dbce',
        '#421f79', '#7a3d93', '#635f6d', '#93f2d7', '#9b5c2a', '#15b9ee', '#0f5997',
        '#409188', '#911e20', '#1350ce', '#10e5b1', '#fff4d7', '#cb2582', '#ce00be',
        '#32d5d6', '#17232', '#608572', '#c79bc2', '#00f87c', '#77772a', '#6995ba',
        '#fc6b57', '#f07815', '#8fd883', '#060e27', '#96e591', '#21d52e', '#d00043',
        '#b47162', '#1ec227', '#4f0f6f', '#1d1d58', '#947002', '#bde052', '#e08c56',
        '#28fcfd', '#bb09b', '#36486a', '#d02e29', '#1ae6db', '#3e464c', '#a84a8f',
        '#911e7e', '#3f16d9', '#0f525f', '#ac7c0a', '#b4c086', '#c9d730', '#30cc49',
        '#3d6751', '#fb4c03', '#640fc1', '#62c03e', '#d3493a', '#88aa0b', '#406df9',
        '#615af0', '#4be47', '#2a3434', '#4a543f', '#79bca0', '#a8b8d4', '#00efd4',
        '#7ad236', '#7260d8', '#1deaa7', '#06f43a', '#823c59', '#e3d94c', '#dc1c06',
        '#f53b2a', '#b46238', '#2dfff6', '#a82b89', '#1a8011', '#436a9f', '#1a806a',
        '#4cf09d', '#c188a2', '#67eb4b', '#b308d3', '#fc7e41', '#af3101', '#ff065',
        '#71b1f4', '#a2f8a5', '#e23dd0', '#d3486d', '#00f7f9', '#474893', '#3cec35',
        '#1c65cb', '#5d1d0c', '#2d7d2a', '#ff3420', '#5cdd87', '#a259a4', '#e4ac44',
        '#1bede6', '#8798a4', '#d7790f', '#b2c24f', '#de73c2', '#d70a9c', '#25b67',
        '#88e9b8', '#c2b0e2', '#86e98f', '#ae90e2', '#1a806b', '#436a9e', '#0ec0ff',
        '#f812b3', '#b17fc9', '#8d6c2f', '#d3277a', '#2ca1ae', '#9685eb', '#8a96c6',
        '#dba2e6', '#76fc1b', '#608fa4', '#20f6ba', '#07d7f6', '#dce77a', '#77ecca'
    ];

    return ContinuousError;

})();
