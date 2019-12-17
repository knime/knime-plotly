/**
 * KnimePlotlyInterface is the utility file that abstracts much of the
 * functionality from the Plotly nodes. Its main purposes are:
 * 
 *      - Converting the JSONDataTable (kt) from a row-based format to
 *        a columnar format which is more performant with the Plotly
 *        library.
 *      - Indexing the data into "Traces" which are collections of related
 *        points or rows usually partitioned based on the "groupBy" column
 *        (except for the radar plot which has a trace per row).
 *      - Storing ordered indicies for line based plots.
 *      - Storing updated indicies for styling selected points.
 *      - Storing the "selected" and "filtered" state of the views.
 *      - Providing the functionality to consume filter and selection events
 *        and create Plotly "update" Objects to enable interactivity.
 *      - Providing utility methods such as converting color string formats
 *        or reordering the data when new features are selected.
 * 
 * Each Plotly node should have a KPI instance which consumes the data and the
 * settings. The Knime JS Views framework methods should all be accessed through
 * the KPI instance of each Plotly node (such as getSVG, getComponentValue, etc).
 */
window.KnimePlotlyInterface = function () {

    /**
     * Version 1.0.0: original implementation
     * Version 1.0.1: documentation added
     */
    var KnimePlotlyInterface = {
        version: '1.0.1'
    };

    /**
     * The *init* method is closely linked to the instantiation of the KPI
     * and should be called 2nd in the lifecyle of a KPI instance. This 
     * method established many of the internal fields as well as maps
     * the input JSON data table into a columnar, indexed format which
     * is much better suited for Plotly integration. It also sets any 
     * warning messages regarding missing values and, finally, clears
     * out the in-memory references to the rows in the *kt* instance 
     * to improve performance.
     * 
     * @param  {Object} rep the viewRepresentation configuration object
     * @param  {Object} val the ViewValue configuration object
     * @param  {Object} knimeDataTable the kt (knimeDataTable.js) instance
     * @param  {array} args the array of libraries holding the Plotly and (if 
     *      applicable) moment.js libraries.
     */
    KnimePlotlyInterface.initialize = function (rep, val, knimeDataTable, args) {

        var self = this;
        this.supportsWebGl = this.checkWebGlInBrowser();
        this.representation = rep;
        this.value = val;
        this.table = knimeDataTable;
        if (typeof args[2] === 'undefined') {
            this.Plotly = args[0];
        } else {
            this.moment = args[0];
            this.Plotly = args[2];
        }
        this.table.setDataTable(this.representation.inObjects[0]);
        this.columns = knimeDataTable.getColumnNames();
        this.rowColors = knimeDataTable.getRowColors();
        this.rowDirectory = {};
        this.filtered = new this.KSet([]);
        this.selected = new this.KSet([]);
        this.traceDirectory = [];
        this.changeObjKeys = [];
        this.orderedIndicies = [];
        this.totalRows = 0;
        this.totalSelected = 0;
        this.isOrdered = false;
        this.showOnlySelected = false;
        this.isSurface = false;
        this.rotatedTicks = false;
        this.onlySelectedBehavior = 'normal'; // important for custom selection behavior
        this.lastSOSState = false;  // important for custom selection behavior ('violin')
        this.mValues = val.options.mValues.replace(/\s/g, ' ') === 'Skip rows with missing values' ? 0 : 1;
        this.mRows = new this.KSet([]);
        this.data = {
            rowKeys: [],
            rowColors: []
        };

        this.columns.forEach(function (column) {
            self.data[column] = [];
        });

        if (this.representation.options.overrideColors) {
            this.rowColors = [];
        }

        var rows = knimeDataTable.getRows();

        rows.forEach(function (row, rowInd) {

            var skipRow = false;
            var totalPush = 0;

            row.data.forEach(function (data, dataInd) {
                if (skipRow) {
                    return;
                }
                if (data === null) {
                    if (rep.options.reportMissing) {
                        self.mRows.add(row.rowKey);
                    }
                    if (self.mValues === 0) {
                        skipRow = true;
                        return;
                    }
                }
                totalPush++;
                self.data[self.columns[dataInd]].push(data);
            });

            if (skipRow) {
                // remove partially inserted rows with missing values
                for (var i = 0; i < totalPush; i++) {
                    self.data[self.columns[i]].splice(self.data[self.columns[i]].length - 1, 1);
                }
                return;
            }

            if (self.rowColors.length < rows.length ||
                self.representation.options.overrideColors) {
                self.rowColors.push(self.representation.options.dataColor);
            }

            self.rowDirectory[row.rowKey] = {
                tInds: [],
                pInd: self.data.rowColors.push(self.rowColors[rowInd]) - 1
            };

            self.data.rowKeys.push(row.rowKey);
            self.filtered.add(row.rowKey);
            self.totalRows++;
        });

        if (rep.options.reportMissing && this.mRows.size() > 0 && val.options.showWarnings) {
            if (self.mValues === 0) {
                knimeService.setWarningMessage('There were missing values in this dataset. They have been removed from the ' +
                    ' results. Total rows with missing values (removed): ' + this.mRows.size());
            } else {
                knimeService.setWarningMessage('There are missing values in this dataset! Total rows with missing values: ' +
                    this.mRows.size() + '. Please use caution when interpreting results.');
            }
        }

        this.collectGarbage();

        return this;
    };

    /**
     * This method initializes the visual elements in the DOM for the first time
     * in the lifecycle of a Plotly js node. The parameters passed from the Parent
     * chart contain all of the data, configuration, and settings for the view.
     * This method also indexes the traces and creates the internal trace directory. 
     * 
     * @param  {array[...Object]} traceArr the array of trace data objects to chart
     * @param  {Object} layout the Plotly layout object
     * @param  {} config the Plotly config object
     */
    KnimePlotlyInterface.drawChart = function (traceArr, layout, config) {
        /*
        If WebGL supported, option enabled and running in a non-headless instance
        then we will tell Plotly to render with WebGL.
        */
        if (this.supportsWebGl &&
            this.representation.options.enableGL &&
            this.representation.runningInView) {
            traceArr.forEach(function (trace) {
                if (trace.type) {
                    trace.type += 'gl';
                }
            });
        }
        this.indexTraces(traceArr);
        var layoutObj = layout;
        if (traceArr[0] && traceArr[0].y) {
            layoutObj = this.updateTicks(traceArr[0], layout);
        }
        if (!this.representation.options.enableSelection) {
            if (typeof config.modeBarButtonsToRemove === 'undefined') {
                config.modeBarButtonsToRemove = [];
            }
            var selectionButtons = ['lasso2d', 'select2d'];
            selectionButtons.forEach(function (selBut) { config.modeBarButtonsToRemove.push(selBut); });
        }
        this.Plotly.newPlot(this.divID, traceArr, layoutObj, config);
        if (this.representation.options.enableSelection) {
            if (this.value.options.selectedrows && this.value.options.selectedrows.length > 0) {
                this.totalSelected = this.value.options.selectedrows.length;
                this.selected = new this.KSet(this.value.options.selectedrows);
                this.update();
            }
        }
    };

    /**
     * This method can be called by the parent chart to retrieve the SVG image
     * from the view. It has multiple branches of logic, because some charts 
     * have different DOM elements and the Plotly SVG API is undocumented,
     * so this method serves as a workaround and likely will need continual
     * updates as new charts are introduced. It also does not currently supprt
     * 3D charts.
     * 
     * @returns {String} the SVG string from the view
     */
    KnimePlotlyInterface.getSVG = function () {
        var self = this;
        var h = this.representation.options.svg.height;
        var w = this.representation.options.svg.width;
        var mainAxisClips = document.querySelectorAll('.xy');
        mainAxisClips.forEach(function (clipObj) {
            clipObj.childNodes.forEach(function (node) {
                node.style.fill = self.representation.options.backgroundColor;
            });
        });
        var secondAxisClips = document.querySelectorAll('.xy2');
        if (secondAxisClips && secondAxisClips.length && secondAxisClips.length > 0) {
            secondAxisClips.forEach(function (clipObj) {
                clipObj.childNodes.forEach(function (node) {
                    node.style.fill = self.representation.options.backgroundColor;
                });
            });
        }
        var thirdAxisClips = document.querySelectorAll('.x2y');
        if (thirdAxisClips && thirdAxisClips.length && thirdAxisClips.length > 0) {
            thirdAxisClips.forEach(function (clipObj) {
                clipObj.childNodes.forEach(function (node) {
                    node.style.fill = self.representation.options.backgroundColor;
                });
            });
        }
        var polarClips = document.querySelector('.polarsublayer');
        if (polarClips && polarClips.children.length && polarClips.children.length > 0) {
            polarClips.childNodes.forEach(function (pathChild) {
                pathChild.style.fill = self.representation.options.backgroundColor;
            });
        }
        var svgElem = document.querySelectorAll('#' + this.divID + '> div > div > svg');
        var svgCol = '<svg class="main-svg" xmlns="http://www.w3.org/2000/svg"' +
            ' xmlns:xlink="http://www.w3.org/1999/xlink" width="' + w +
            '" height="' + h + '">' +
            '"><g xmlns="http://www.w3.org/2000/svg"><rect width="' + w + '" height="' +
            h + '" style="fill: ' +
            this.representation.options.backgroundColor + ';width:' + w + 'px;height:' +
            h + 'px"></rect></g>';
        svgElem.forEach(function (svg, svgInd) {
            if (svg.tagName === 'svg') {
                knimeService.inlineSvgStyles(svg);
                svgCol += new XMLSerializer().serializeToString(svg);
            }
        });
        svgCol += '</svg>';
        return svgCol;
    };

    /**
     * Similar to the method of the same name in all JS-Knime views
     * this method is called by the parent chart and retrieves the 
     * updated chart state to be used and saved inside the node.
     * 
     * @returns {Object} the ViewValue to be returned to the AP
     */
    KnimePlotlyInterface.getComponentValue = function () {
        var self = this;
        var selectedObj = {};
        Object.keys(this.rowDirectory).forEach(function (rowKey) {
            selectedObj[rowKey] = self.selected.has(rowKey);
        });
        this.value.outColumns = {
            selection: selectedObj
        };
        return this.value;
    };

    /**
     * Setter method for the surface chart flag which is used 
     * to comply with Plotly specifications in the 
     * getFilteredChangeObj method. Surface chart is special
     * because it supports no selection.
     * 
     * @param  {boolean} bool true only for Surface chart
     */
    KnimePlotlyInterface.setIsSurface = function (bool) {
        this.isSurface = bool;
    };

    /**
     * This method is used to change the showOnlySelectd behavior
     * for the 'violin' chart currently. It could be used in the
     * future to enable more special behavior for other charts.
     * 
     * The two expected values for the field currently are 'normal'
     * and 'violin'.
     * 
     * @param  {String} str the String value for onlySelectedBehavior
     */
    KnimePlotlyInterface.setOnlySelectedBehavior = function (str) {
        this.onlySelectedBehavior = str;
    };

    /**
     * This method creates the Plotly target element in the DOM and
     * also handles the SVG/Image size, if necessary.
     * 
     * @param  {String} stringDivName the name of the HTML div ID
     *      which will contain the Plotly chart.
     */
    KnimePlotlyInterface.createElement = function (stringDivName) {
        this.divID = stringDivName;
        // Create the plotly HTML element
        var divElem = document.createElement('div');
        if (this.representation.options.svg &&
            (!this.representation.options.svg.fullscreen || !this.representation.runningInView)) {
            var dimString = 'width:' + this.representation.options.svg.width + 'px;height:' +
                this.representation.options.svg.height + 'px';
            divElem.setAttribute('style', dimString);
        }
        divElem.setAttribute('id', stringDivName);
        document.body.appendChild(divElem);
    };

    /**
     * This method is called after the KPI initialization and returns
     * an Object full of arrays containing the data needed for traces
     * by the Plotly API. The provided keys correspond to available data
     * attributes, either actual column names from the data table, 'rowKeys'
     * or 'rowColors'. The data returned is binned if there is grouping 
     * information available. See the example below of the structure:
     * 
     *                        TRACE NUMBER
     * return obj {             #1,   etc...
     *      "Universe0_0" : [[0, ...], ...],     
     *      .
     *      .
     *      .
     *      "rowKeys" : [['rowID_0', ...], ...]
     *  }
     * 
     * The data returned is then used to create the initial trace objects
     * for initializing the Plot (they will be passed into the drawChart
     * method). Its important that the data is retrieved for each chart
     * in this way because the trace data objects are different for all
     * Plotly nodes.
     * 
     * @param  {Object} keys the object containing the data keys 
     *  and their plotly equivalent and their corresponding Plotly keys
     */
    KnimePlotlyInterface.getData = function (keys) {
        var self = this;
        if (!this.changeKeys) {
            this.updateKeys(keys);
        }
        var keySet = new this.KSet(keys.dataKeys).getArray();
        var groupIndicies = [];
        var groupLocations = {};
        var obj = {
            names: [],
            rowKeys: []
        };

        keySet.forEach(function (key) {
            obj[key] = [];
        });

        var count = 0;
        if (this.representation.options.groupByColumn && this.representation.options.groupByColumn !== 'none') {
            self.data[this.representation.options.groupByColumn].forEach(function (group, groupInd) {
                if (typeof groupLocations[group] === 'undefined') {
                    groupLocations[group] = count;
                    groupIndicies.push(count);
                    keySet.forEach(function (key) {
                        obj[key].push([]);
                    });
                    obj.names.push(group || 'Missing');
                    count++;
                } else {
                    groupIndicies.push(groupLocations[group]);
                }
            });
        } else {
            groupIndicies = this.data.rowKeys.map(function (val, valInd) { return 0; });
            keySet.forEach(function (key) {
                obj[key].push([]);
                if (!self.data[key]) {
                    self.data[key] = groupIndicies.map(function () { return 'Data Set'; });
                }
            });
            obj.names.push(['Data']);
        }

        groupIndicies.forEach(function (indArr, gInd) {
            keySet.forEach(function (key) {
                if (self.data[key]) {
                    obj[key][indArr].push(self.data[key][gInd]);
                }
            });
        });

        if (this.isOrdered) {
            obj.rowKeys.forEach(function (group, groupInd) {
                keySet.forEach(function (key) {
                    obj[key][groupInd] = self.getOrderedArray(obj[key][groupInd]);
                });
            });
        }
        return obj;
    };

    /**
     * This internal method is called during the invocation of the drawChart
     * method in the second stage of the KPI lifecycle. It consumes the
     * array of trace objects created to Plotly specifications in the 
     * parent chart. It then creates the internally stored TraceDirectory
     * for each of the provided traces (with a TraceMap instance) and maps
     * the data keys for each trace to the TraceMap instance.
     * 
     * @param  {array[Object]} incomingTraces an array of Plotly compliant
     *      trace objects.
     */
    KnimePlotlyInterface.indexTraces = function (incomingTraces) {
        var self = this;
        // create an array to hold out trace objects
        this.traceDirectory = [];
        incomingTraces.forEach(function (singleTrace, traceInd) {
            singleTrace.ids.forEach(function (rowId) {
                self.rowDirectory[rowId].tInds.push(traceInd);
            });
            self.traceDirectory[traceInd] = new self.TraceMap(singleTrace.ids);
            self.traceDirectory[traceInd].dataKeys = singleTrace.dataKeys;
        });
    };

    /**
     * This method is used to get an array of arrays for a single trace
     * containing the indicies (in the Plotly trace) of selected points.
     * The returned array should be used in a ChangeObj as the 
     * [selectedpoints] value when updating a Plotly chart. The indicies
     * themselves come from the KPI instance [traceDirectory] which holds
     * a TraceMap instance for each of the traces on the chart. This has
     * rowKeys mapped to the most updated point indicies as far as Plotly
     * is concerned, which is why we use them to update the style of the
     * chart to reflect selection.
     * 
     * @returns {array[array]} an array of arrays: 1 for each trace in
     *      the chart scope, each containing the point indicies of the
     *      selected points.
     */
    KnimePlotlyInterface.getSelectedPoints = function () {
        var self = this;
        var selectedPoints = [];

        this.traceDirectory.forEach(function () {
            var emptySelection = self.totalSelected > 0 ? [] : null;
            selectedPoints.push(emptySelection);
        });
        this.selected.getArray().forEach(function (rowKey) {
            self.rowDirectory[rowKey].tInds.forEach(function (tInd) {
                if (self.traceDirectory[tInd][rowKey] > -1) {
                    selectedPoints[tInd].push(self.traceDirectory[tInd][rowKey]);
                }
            });
        });

        return selectedPoints;
    };

    /**
     * Likely the most important method in the KPI, this is used to 
     * get all updated data required to update the chart visuals.
     * This method can be used without a parameter, in which case it
     * will return the most update data with all of the specified
     * keys (set through the updateKeys method). It can also be passed
     * specific keys to just retrieve single feature changeObj (like 
     * retrieving updated colors or ids).
     * 
     * This method returns a Plotly-compliant JavaScript object as
     * seen here:
     * 
     * EXAMPLE CHANGEOBJ
     * 
     * var changeObj = {
     *      'x' = [[0,1,...], [...], ...], //one array per trace
     *      'y' = [[...], ...], //literal keys when possible
     *      ['marker.color'] = [[...], ...], //key variables when not
     *      marker = {
     *          'selectpoints' = [null, [1,2,...], []] //null values for
     *      }                                          //no change, empty
     *  }                                              //[] for no data
     * 
     * This JavaScript object structure is *central* to the Plotly API
     * and is referenced again and again in the KPI. For more information
     * on possible keys, etc. please reference: https://plot.ly
     * 
     * This method also uses internal state to dynamically determine which
     * data should be visible in the parent chart. If points are excluded
     * via filter, they will not be represented in the returned object. The
     * same goes for charts which support showing only selected points. This
     * behavior is treated like a filter in implementation and the data is
     * actually ommited from the ChangeObj instead of being published.
     * 
     * Lastly, there is Surface chart specific code to re-box the 'z' axis
     * data into another container array to comply with Plotly specs.
     * 
     * @param  {array (optional)} keys to retrieve the most updated data
     * @returns {Object} changeObj the filtered changeObj for updating
     */
    KnimePlotlyInterface.getFilteredChangeObject = function (keys) {
        var self = this;
        var changeObj = {};
        // var dataKeys = keys ? keys.dataKeys : this.dataKeys;
        var changeKeys = keys ? keys.plotlyKeys : this.changeObjKeys;

        changeKeys.forEach(function (keys) {
            keys.forEach(function (key) {
                changeObj[key] = [];
                self.traceDirectory.forEach(function () {
                    changeObj[key].push([]);
                });
            });
        });

        if (self.isOrdered) {
            var orderedRowKeys = this.getOrderedArray(this.data.rowKeys);
            var count = 0;
            self.traceDirectory.forEach(function (trace, traceInd) {
                orderedRowKeys.forEach(function (rowKey, rowInd) {
                    if (typeof trace[rowKey] === 'undefined') {
                        return;
                    }
                    if ((self.showOnlySelected && !self.selected.has(rowKey)) || !self.filtered.has(rowKey)) {
                        self.traceDirectory[traceInd][rowKey] = -1;
                        return;
                    }
                    var zData = changeObj.z || [[]];
                    trace.dataKeys.forEach(function (key, keyInd) {
                        if (self.isSurface && keyInd < 2) {
                            if (keyInd === 0) {
                                zData[0][count] = self.data[key][self.orderedIndicies[rowInd]];
                                trace[rowKey] = count;
                            } else {
                                key.forEach(function (vCol, vColInd) {
                                    var vectorData = zData[vColInd] || [];
                                    vectorData[count] = self.data[vCol][self.orderedIndicies[rowInd]];
                                    zData[vColInd] = vectorData;
                                });
                                changeObj.z = zData;
                            }
                        } else {
                            changeKeys[keyInd].forEach(function (plotlyKey) {
                                trace[rowKey] = changeObj[plotlyKey][traceInd].push(self.data[key][self.orderedIndicies[rowInd]]) - 1;
                            });
                        }
                    });
                    count++;

                });
            });

        } else {

            this.data.rowKeys.forEach(function (rowId, rowInd) {
                var rowObj = self.rowDirectory[rowId];
                rowObj.tInds.forEach(function (tInd) {
                    if ((self.showOnlySelected && !self.selected.has(rowId)) || !self.filtered.has(rowId)) {
                        self.traceDirectory[tInd][rowId] = -1;
                        return;
                    }

                    self.traceDirectory[tInd].dataKeys.forEach(function (key, keyInd) {
                        if (key) {
                            changeKeys[keyInd].forEach(function (plotlyKey) {
                                var newPID = changeObj[plotlyKey][tInd].push(self.data[key][rowObj.pInd]) - 1;
                                self.traceDirectory[tInd][rowId] = newPID;
                            });
                        } else {
                            changeKeys[keyInd].forEach(function (plotlyKey) {
                                changeObj[plotlyKey][tInd] = null;
                            });
                        }
                    });

                });
            });
        }

        if (this.isSurface) {
            changeObj.z = [changeObj.z];
        } else {
            changeObj.selectedpoints = this.getSelectedPoints();
        }
        return changeObj;
    };

    /**
     * This method handles the actual invocation of updating the parent chart.
     * It optionally takes in three parameters. If only a changeObj is passed in
     * it will call the Plotly.restyle() method (which has the least overhead to 
     * update a chart's data). Alternatively, if a changeObj is not passed in, and the
     * onlyLayout option is *not* set to true, then the method will go and get
     * the most updated data to update the chart. If a layoutObj is passed in
     * either Plotly.relayout() (most efficient way to update chart layout) or
     * the Plotly.update() (most efficient way to update both layout and data).
     * 
     * @param  {Object || null} inChangeObj the changeObj to be passed to Plotly
     * @param  {Object || null} layoutObj the layoutObj 
     * @param  {boolean || null} onlyLayout true if update only the layout
     */
    KnimePlotlyInterface.update = function (inChangeObj, layoutObj, onlyLayout) {
        if (onlyLayout && layoutObj) {
            this.Plotly.relayout(this.divID, layoutObj);
        } else {
            var changeObj = inChangeObj || this.getFilteredChangeObject();
            layoutObj = this.updateTicks(changeObj, layoutObj);
            if (layoutObj) {
                this.Plotly.update(this.divID, changeObj, layoutObj);
            } else {
                this.Plotly.restyle(this.divID, changeObj);
            }
        }
    };

    /**
     * This method can be used to set or update the keys which are returned
     * each time a new changeObj is created. It's also possible to set trace-
     * specific keys for different scenarios, such as when different traces
     * have different data or have different Plotly keys. The keys passed in
     * should be valid Plotly configuration option keys (ex: x, y, marker, etc.)
     * 
     * @param  {Object} keys object
     *          *EITHER*
     * @param  {Object} keys.plotlyKeys the data-bound key literals
     *      which need to be updated in the changeObj each time there is a data
     *      update
     *          *OR*
     * @param  {Object} keys.dataKeys the array of arrays containing trace-
     *      specific keys
     */
    KnimePlotlyInterface.updateKeys = function (keys) {
        var self = this;
        if (keys.plotlyKeys) {
            this.changeObjKeys = keys.plotlyKeys;
        }

        if (keys.dataKeys && self.traceDirectory) {
            keys.dataKeys.forEach(function (key, keyInd) {
                if (key) {
                    if (key.length && Array.isArray(key)) {
                        key.forEach(function (tKey, tInd) {
                            self.traceDirectory[tInd].dataKeys[keyInd] = tKey;
                        });
                    } else {
                        self.traceDirectory.forEach(function (trace) {
                            if (trace.dataKeys[keyInd]) {
                                trace.dataKeys[keyInd] = key;
                            }
                        });
                    }
                }
            });
        }
    };

    /**
     * This method is used both internally and externally (by
     * the parent chart) to update the view value which should
     * be stored inside the KPI instance. The object passed
     * as a parameter can have one of more keys and each key 
     * will be mapped to the ViewValue.
     * 
     * @param  {Object} newValue.foo the object with ViewValue
     *      fields and their associated values to be set
     */
    KnimePlotlyInterface.updateValue = function (newValue) {
        for (var key in newValue) {
            this.value.options[key] = newValue[key];
        }
    };

    /**
     * This method is consumes both Knime-published event objects
     * and Plotly event objects. It clears the internal field
     * this.selected and creates a new KSet containing all of the
     * rowKeys that are currently selected.
     * 
     * If the event comes from a Plotly publisher, then the logic 
     * uses multiple steps to find the id from the actual DOM 
     * elements which were selected, usually through the trace
     * ids, but sometimes through the point indicies in the TraceMaps.
     * When the event is a Plotly event, the method also checks to see
     * if there are other views available in the window scope and 
     * publishes the rowIds of the selected points for other Knime
     * views.
     * 
     * If the event is published by the KnimeService (i.e. incomming)
     * then this method will set the internal .selected field to
     * whatever the incomming selection set is.
     * 
     * This method also contains the logic which allows the violin plot
     * to show all points on load, but also react as if showOnlySelected
     * was enabled when it is in a composite view by hard-coded default
     * (implemented per request from Data Scientists).
     * 
     * Lastly, this method will update the ViewValue .selected field so
     * the rowIds are available if the node is closed, or the settings 
     * are applied.
     * 
     * @param  {Object} data either the Plotly or Knime selection event
     *      object
     */
    KnimePlotlyInterface.updateSelected = function (data) {
        var self = this;

        if (!data) {
            return;
        }

        this.selected = new this.KSet([]);
        this.totalSelected = 0;

        if (data.points) { // this is for Plotly events

            if (data.range && ((data.range.x2 || data.range.y2) || (data.points.length &&
                data.points[0] && data.points[0].r))) {
                // if ((data.range && (data.range.x2 || data.range.y2))) {
                data.points.forEach(function (pt) {
                    var ptRowKeys = pt.fullData.ids;
                    var ptInds = pt.pointIndices || [pt.pointIndex];
                    ptInds.forEach(function (ptInd) {
                        var rowKey = ptRowKeys[ptInd];
                        self.selected.add(rowKey);
                        self.totalSelected++;
                    });
                });
            } else {
                data.points.forEach(function (pt) {
                    self.selected.add(pt.id);
                    self.totalSelected++;
                });
            }

            if (self.value.options.publishSelection && knimeService.getGlobalService()) {
                knimeService.setSelectedRows(
                    this.table.getTableId(),
                    this.selected.getArray(),
                    this.onSelectionChange
                );
            }

        } else { // this is for incoming knime events
            this.selected = new this.KSet([]);
            var incomingSelected = knimeService.getAllRowsForSelection(
                this.table.getTableId()
            );
            if (incomingSelected.length > 0) {
                this.totalSelected = 1;
            }
            incomingSelected.forEach(function (rowKey) {
                if (typeof self.rowDirectory[rowKey] !== 'undefined') {
                    self.selected.add(rowKey);
                    self.totalSelected++;
                }
            });
        }

        if (self.totalSelected === 0 &&
            self.showOnlySelected &&
            self.onlySelectedBehavior === 'violin') {
            self.showOnlySelected = false;
            self.lastSOSState = true;
        } else if (self.totalSelected > 0 &&
            self.lastSOSState &&
            self.onlySelectedBehavior === 'violin') {
            self.showOnlySelected = true;
        }

        this.updateValue({ selectedrows: self.selected.getArray() });
    };

    /**
     * This method takes in a KnimeService-published filter event object
     * and updates the internal KPI.filtered field with a new KSet containing
     * the rowKeys of the rows that are included in the chart *after* the 
     * filter has been applied. This method *should* support both numeric
     * and nominal filters as well as multiple filters across different 
     * columns.
     * 
     * @param  {Object} data the KnimeService filter object
     * @param  {array} data.elements an array of filter elements
     * @param  {Object} data.elements[i].type the type of the filter (only 
     *      "range" is currently supported by KnimeService)
     * @param  {array} data.elements[i].columns an array of column filter
     *      object
     * @param  {Object} data.elements[i].columns[i] actual filter with keys
     *      for [type] = "numeric": [minimumInclusive] || [maximumInclusive],
     *       [minimum{number}], [maximum{number}] *OR* for [type] = "nominal" :
     *       [values{array}]
     *      
     */
    KnimePlotlyInterface.updateFilter = function (data) {

        if (!data || !data.elements) {
            return;
        }

        var self = this;

        this.filtered = new this.KSet([]);

        data.elements.forEach(function (filterElement, filterInd) {
            if (filterElement.type === 'range' && filterElement.columns) {
                for (var col = 0; col < filterElement.columns.length; col++) {
                    var column = filterElement.columns[col];
                    self.data[column.columnName].forEach(function (colVal, colInd) {
                        if (typeof colVal === 'undefined' || colVal === null) {
                            return;
                        }
                        var included = true;
                        var rKey = self.data.rowKeys[colInd];
                        if (column.type === 'numeric') {
                            if (column.minimumInclusive) {
                                included = included && colVal >= column.minimum;
                            } else {
                                included = included && colVal > column.minimum;
                            }
                            if (column.maximumInclusive) {
                                included = included && colVal <= column.maximum;
                            } else {
                                included = included && colVal < column.maximum;
                            }
                        } else if (column.type === 'nominal') {
                            included = included && column.values.indexOf(colVal) >= 0;
                        }
                        if (included) {
                            if (filterInd > 0 && !self.filtered.has(rKey)) {
                                return;
                            }
                            self.filtered.add(rKey);
                        } else if (self.filtered.has(rKey)) {
                            self.filtered.delete(rKey);
                        }
                    });
                }
            }
        });
    };

    /**
     * This method creates and updates the interally sorted indicies used when 
     * providing data in Plotly change objects. If a chart require ordered data
     * (such as the line chart), this method will take a parameter (String) for
     * the column name that is to be the ordered axis (usually the x-axis). It 
     * will then parse for Data/Time values and, if necessary, convert them to 
     * Unix millisecond timestamps to allow them to be sorted as numbers. This
     * method then uses and internal implementation of Merge Sort to create
     * an array of original indicies in the correct order. This array is then
     * set as the internal state of order for the KPI instance and is used
     * whenever new data or data updates are required for the Plot. 
     * 
     * In the view when features are updated (such as user choosing new x-axis)
     * this method will be called again and the internal order updated.
     * 
     * @param  {String} newOrderedColumnName name of the column to order by
     */
    KnimePlotlyInterface.updateOrderedIndicies = function (newOrderedColumnName) {
        var self = this;
        this.isOrdered = true;
        var array = self.data[newOrderedColumnName];
        if (typeof array[0] === 'string') {
            if (array[0].indexOf('Row') !== -1) {
                var failedParse = false;
                array = array.map(function (rowId) {
                    var rowNum = parseFloat(rowId.split('Row')[1]);
                    if (isNaN(rowNum)) {
                        failedParse = true;
                    }
                    return rowNum;
                });
                if (failedParse) {
                    self.orderedIndicies = array.map(function (e, i) { return i; });
                    return;
                }
            } else if (this.table.getColumnTypes()[this.columns.indexOf(newOrderedColumnName)] ===
                'dateTime' && this.representation.options.hasDateTime) {
                if (this.moment(array[0].isValid())) {
                    array = array.map(function (date) {
                        return self.moment(date).valueOf();
                    });
                }
            } else {
                self.orderedIndicies = array.map(function (e, i) { return i; });
                return;
            }
        }
        var indicies = [];

        for (var i = 0; i < array.length; i++) {
            indicies.push(i);
        }

        var merge = function (lArr, rArr) {
            var sortedArr = [];
            var sortedInd = [];
            var lInd = 0;
            var rInd = 0;

            while (lInd < lArr[0].length && rInd < rArr[0].length) {
                if (lArr[0][lInd] < rArr[0][rInd]) {
                    sortedArr.push(lArr[0][lInd]);
                    sortedInd.push(lArr[1][lInd]);
                    lInd++;
                } else {
                    sortedArr.push(rArr[0][rInd]);
                    sortedInd.push(rArr[1][rInd]);
                    rInd++;
                }
            }

            return [sortedArr.concat(lArr[0].slice(lInd)).concat(rArr[0].slice(rInd)),
            sortedInd.concat(lArr[1].slice(lInd)).concat(rArr[1].slice(rInd))];
        };

        var mergeSort = function (subArr, indArr) {
            if (subArr.length <= 1) {
                return [subArr, indArr];
            }

            var centInd = Math.floor(subArr.length / 2);
            var leftArr = subArr.slice(0, centInd);
            var rightArr = subArr.slice(centInd);
            var lIndArr = indArr.slice(0, centInd);
            var rIndArr = indArr.slice(centInd);

            var lSortArr = mergeSort(leftArr, lIndArr);
            var rSortArr = mergeSort(rightArr, rIndArr);
            return merge(lSortArr, rSortArr);
        };

        var xYz = mergeSort(array, indicies);
        self.orderedIndicies = xYz[1];
    };

    /**
     * Utility method to resort an array of data based on the internal
     * ordering state. This is used for any sort of plot that requires
     * data to be contiguous (such as line based plots) and is called
     * by the getFilteredChangeObject method and the getData method.
     * It can later be "privatised" by making it a local variable, as
     * it is not yet used in any charts directly.
     * 
     * @param  {array} array containing values to order
     * @returns {array} an array containing the ordered data
     */
    KnimePlotlyInterface.getOrderedArray = function (array) {
        var orderedData = [];

        for (var i = 0; i < array.length; i++) {
            orderedData[i] = array[this.orderedIndicies[i]];
        }

        return orderedData.filter(function (val) { return val === 0 || val; });
    };

    /**
     * This method is exposed for charts to call when the showOnlySelected 
     * button is clicked by the user. It updates the internal state of the
     * KPI instance, which affects the included data in selection and filter
     * methods.
     * 
     * @param  {boolean} bool the state of showOnlySelected internally
     */
    KnimePlotlyInterface.updateShowOnlySelected = function (bool) {
        this.showOnlySelected = bool;
    };

    /**
     * This general initialization function should be called by the plot itself;
     * passing in the two required callback functions. The correct place to call
     * this method in the lifecycle of a Plotly .js view is after the drawChart
     * method is invoked. In addition to providing KnimeService with the required
     * callback functions it needs for interactive events, this method also triggers
     * a title spacing call (adjustTitleSpacing) and a call to remove any extra
     * axis labels (removeSecondAxisLabels). *Critically* it also handles the mounting
     * of event listeners for each of the Plotly-published events: plotly_relayout,
     * plotly_restyle, plotly_selected & plotly_deselect.
     * 
     * @param  {Function} selectionChange the callback function to handle selection
     *      changes either from the KnimeService or internally
     * @param  {} filterChange filterChange the callback function to handle filter
     *      changes from the KnimeService
     */
    KnimePlotlyInterface.mountAndSubscribe = function (selectionChange, filterChange) {
        var self = this;
        var hasSecondAxis = this.removeSecondAxisElements();
        this.adjustTitleSpacing();

        document.getElementById(this.divID).on('plotly_relayout', function (eData) {
            if (eData) {
                if (hasSecondAxis) {
                    self.removeSecondAxisElements();
                }
                var valueObj = {};
                if (eData['xaxis.title.text']) {
                    valueObj.xAxisLabel = eData['xaxis.title.text'];
                }
                if (eData['yaxis.title.text']) {
                    valueObj.yAxisLabel = eData['yaxis.title.text'];
                }
                if (eData['title.text']) {
                    valueObj.title = eData['title.text'];
                }
                self.updateValue(valueObj);
            }
            self.adjustTitleSpacing();
        });
        document.getElementById(this.divID).on('plotly_restyle', function (plotlyEvent) {
            if (plotlyEvent && plotlyEvent.length) {
                if (plotlyEvent[0] && plotlyEvent[0].colorscale && plotlyEvent[0].colorscale.length) {
                    var valueObj = { colorscale: plotlyEvent[0].colorscale[0] };
                    self.updateValue(valueObj);
                }
            }
            self.adjustTitleSpacing();
        });
        document.getElementById(this.divID).on('plotly_selected', function (plotlyEvent) {
            selectionChange(plotlyEvent);
            self.adjustTitleSpacing();
        });
        document.getElementById(this.divID).on('plotly_deselect', function () {
            selectionChange({ points: [] });
            self.adjustTitleSpacing();
        });

        this.togglePublishSelection();
        this.toggleSubscribeToFilters(filterChange);
        this.toggleSubscribeToSelection(selectionChange);
    };

    /**
     * This method is used to rotate y-axis labels 90 degrees when they are String values
     * (such as when dislaying grouped charts) or to set the angle for Numeric values
     * which tend to run off the screen when they are very long. It is called during the
     * drawing of the chart as well as during subsequent "update" calls, if there is a
     * layoutObj provided.
     * 
     * @param  {Object} changeObj the KPI changeObj involved in the Plotly update event
     * @param  {array} changeObj.y the array containing (n*numTraces)*[y1,y2,...] values
     * @param  {array} changeObj.y[i] the array containing the y values for a single trace
     * @param  {Object} layoutObj the KPI layoutObj involved in the Plotly update event
     * @param  {Object || null} layoutObj.yaxis this key containing the object holding the
     *      y-axis configuration options. If layoutObj.yaxis is missing, then it will be 
     *      dynamically created and the "tickangle" property will be set to the appropriate
     *      value based on the y "type"
     *  
     * @returns {Object} layoutObj the updated KPI layoutObj with the correct tick angles
     */
    KnimePlotlyInterface.updateTicks = function (changeObj, layout) {
        var layoutObj = layout;
        if (changeObj.y && changeObj.y.length > 0 &&
            changeObj.y[0] && changeObj.y[0].length) {
            if (typeof changeObj.y[0][0] === 'string') {
                layoutObj = layoutObj || {};
                if (layoutObj.yaxis) {
                    layoutObj.yaxis.tickangle = -90;
                } else {
                    layoutObj['yaxis.tickangle'] = -90;
                }
                this.rotatedTicks = true;
            } else if (this.rotatedTicks && typeof changeObj.y[0][0] === 'number') {
                layoutObj = layoutObj || {};
                if (layoutObj.yaxis) {
                    layoutObj.yaxis.tickangle = -0;
                } else {
                    layoutObj['yaxis.tickangle'] = -0;
                }
                this.rotatedTicks = true;
            }
        }
        return layoutObj;
    };

    /**
     * This method solves a bug with Plotly where sometimes the main chart
     * title is overlapping or inaccurately placed on the chart. This method
     * is called during the MountAndSubscribe method and during subsequent
     * Plotly "relayout" events. It changes the html tags to re-align the 
     * title.
     */
    KnimePlotlyInterface.adjustTitleSpacing = function () {
        if (document.querySelector('.gtitle')) {
            document.querySelector('.gtitle').setAttribute('dy', '-.5em');
        }
    };

    /**
     * This method is used to remove unwanted axis labels from secondary
     * axis, such as in the 2D Density plot when Histograms are enabled.
     * We decided jointly that being able to edit multiple axis labels 
     * (2+ for x, 2+ for y) was unwanted behavior, so this method removes
     * them manually and is called by MountAndSubscribe upon graph init-
     * ializaion and during subsequent Plotly "relayout" events. 
     * 
     * @returns {boolean} true if multiple axis labels were removed and
     *      false if there were no 2nd axis in the DOM
     */
    KnimePlotlyInterface.removeSecondAxisElements = function () {
        var x2Title = document.querySelector('.x2title');
        var y2Title = document.querySelector('.y2title');
        if (x2Title && y2Title) {
            x2Title.remove();
            y2Title.remove();
            return true;
        } else {
            return false;
        }
    };

    /**
     * This method takes a callback function as a parameter to be called by the KnimeService
     * everytime there is a filter change. It is called internally by the MountAndSubscribe
     * method, through which these custom callback functions should be passed by the views
     * themselves. It is important to bind lexical "this" to the callbacks.
     * 
     * @param  {Function} onFilterChange the function to call when filter events are published
     */
    KnimePlotlyInterface.toggleSubscribeToFilters = function (onFilterChange) {
        if (this.value.options.subscribeToFilters) {
            knimeService.subscribeToFilter(
                this.table.getTableId(),
                onFilterChange,
                this.table.getFilterIds()
            );
        } else {
            knimeService.unsubscribeFilter(
                this.table.getTableId(),
                onFilterChange
            );
        }
    };

    /**
     * This method takes a callback function as a parameter to be called by the KnimeService
     * everytime there is a selection change. It is called internally by the MountAndSubscribe
     * method, through which these custom callback functions should be passed by the views
     * themselves. It is important to bind lexical "this" to the callbacks.
     * 
     * @param  {Function} onSelectionChange the function to call when selection changes
     */
    KnimePlotlyInterface.toggleSubscribeToSelection = function (onSelectionChange) {
        if (this.value.options.subscribeToSelection) {
            knimeService.subscribeToSelection(
                this.table.getTableId(),
                onSelectionChange
            );
        } else {
            knimeService.unsubscribeSelection(
                this.table.getTableId(),
                onSelectionChange
            );
        }
    };

    /**
     * This method will toggle on and off the publishing functionality
     * of the plot. When it is toggled off, it does *not* publish any-
     * thing; rather leaves the composite view selection state as-is.
     * When toggled on, it publishes the current selection from the 
     * Plotly view to other views in the same interactivity scope.
     */
    KnimePlotlyInterface.togglePublishSelection = function () {
        if (this.value.options.publishSelection) {
            knimeService.setSelectedRows(
                this.table.getTableId(),
                this.selected.getArray()
            );
        }
    };

    /**
     * Utility function to create a basic index mapping of
     * rowIds to their initial indicies. These indicies will
     * be used as a direct pointer reference to the row in various
     * methods such as filtering, selection, etc. This method should
     * be called with the "new" initialization keyword, as it creates
     * a literal JavaScript object in the format {rowKey_0: 1, ...}.
     * 
     * These indicies are later updated as the data points realtime 
     * location *within* the Plotly traces. "i" represents the initial 
     * index of the data within each trace, but as traces are modified,
     * the value is updated to reflect their current position (with -1
     * being used to represent absent or "missing"). These indicies are
     * mapped to the rowIds to provide a non-iterative reference pointer
     * for quick view manipulation.
     * 
     * @param  {} traceIds
     */
    KnimePlotlyInterface.TraceMap = function (traceIds) {
        for (var i = 0; i < traceIds.length; i++) {
            this[traceIds[i]] = i;
        }
    };

    /**
     * Utility class/polyfill to create a functionally equivalent
     * ES5 compliant version of a JavaScript Map. Should be 
     * initialized with the "new" keyword. See internal method
     * documentation for other functionality. Offers the added
     * benefits (over just using JavaScript Object mapping) that
     * you can retrieve keys and values with methods, where IE11
     * sometimes complains about the JS native methods.
     * 
     * @param  {array} iterable to initialize the map in the format
     *      expected : [[foo, bar], ....]
     */
    KnimePlotlyInterface.KMap = function (iterable) {

        var obj = {};
        var keys = [];
        var values = [];
        var size = 0;

        if (iterable && iterable.length) {
            for (var i = 0; i < iterable.length; i++) {
                if (typeof iterable[i][0] !== 'undefined') {
                    this.set(iterable[i][0], iterable[i][1]);
                    size++;
                }
            }
        }

        /**
         * Utility method to add or update members of the map.
         * 
         * @param  {Object} key the key to set
         * @param  {Object} value the value to set
         * @returns {KMap} this
         */
        this.set = function (key, value) {
            if (this.has(key)) {
                obj[key].value = value;
            } else {
                var ind = keys.push(key);
                values.push(value);
                obj[key] = {
                    value: value,
                    ind: ind
                };
                size++;
            }
            return this;
        };

        /**
         * Utility method to check if a key exists in the map.
         * 
         * @param  {Object} key the element to check for membership
         * @returns {boolean} true if the parameter is a member, false
         *      if the parameter is not a member
         */
        this.has = function (key) {
            if (typeof obj[key] === 'undefined') {
                return false;
            } else {
                return true;
            }
        };

        /**
         * Utility method to clear the map back to an empty state.
         * 
         * @returns {KMap} this
         */
        this.clear = function () {
            obj = {};
            keys = [];
            values = [];
            size = 0;
            return this;
        };

        /**
         * Utility method to get the value mapped to the provided key.
         * 
         * @param  {Object} key
         * @returns {Object} value the value mapped to the key
         */
        this.get = function (key) {
            return obj[key].value;
        };

        /**
         * Utility method to delete the key-pair of the key provided.
         * 
         * @param  {Object} key to delete
         * @returns {boolean} true if the key was a member and was deleted,
         *      false if the key was not a member
         */
        this.delete = function (key) {
            if (typeof obj[key] === 'undefined') {
                return false;
            } else {
                keys.splice(obj[key].ind, 1, null);
                values.splice(obj[key].ind, 1, null);
                delete this.obj[key];
                size--;
                return true;
            }
        };

        /**
         * Utility method to get an array of key-value pairs of all of the
         * members in the map.
         * 
         * @returns {array} an array of key-value pairs in the format: 
         *      [[foo, bar], ...]
         */
        this.entries = function () {
            var result = [];
            for (var i = 0; i < values.length; i++) {
                if (keys[i]) {
                    result.push([keys[i], values[i]]);
                }
            }
        };

        /**
         * Utility method to get all of the keys in the map.
         * 
         * @returns {array} an array of all of the keys in the map
         */
        this.keys = function () {
            return keys.filter(function (key) { return key; });
        };

        /**
         * Utility method to get all of the values in the map.
         * 
         * @returns {array} an array of all of the values in the map
         */
        this.values = function () {
            return values.filter(function (val) { return val; });
        };

        /**
         * Utility method to get the number of key-value pairs in the
         * map.
         * 
         * @returns {number} the number of key-value pairs in the map
         */
        this.size = function () {
            return size;
        };
    };

    /**
     * Utility class/polyfill to create a functionally equivalent
     * ES5 compliant version of a JavaScript Set. Should be 
     * initialized with the "new" keyword. See internal method
     * documentation for other functionality.
     * 
     * @param  {array} iterable
     */
    KnimePlotlyInterface.KSet = function (iterable) {

        var data = {};
        var size = 0;

        if (iterable && iterable.length) {
            for (var i = 0; i < iterable.length; i++) {
                data[iterable[i]] = true;
            }
        }

        /**
         * Utility method to add member to the set.
         * 
         * @param  {Object} member to be added to the set
         * @returns {KSet} this
         */
        this.add = function (member) {
            if (typeof member !== 'undefined') {
                if (!this.has(member)) {
                    size++;
                }
                data[member] = true;
            }
            return this;
        };

        /**
         * Utility method to add multiple members to the set
         * at one time.
         * 
         * @param  {array} member to be added to the set
         * @returns {KSet} this
         */
        this.addAll = function (members) {
            if (members && members.length) {
                for (var i = 0; i < members.length; i++) {
                    if (typeof members[i] !== 'undefined') {
                        data[members[i]] = true;
                        size++;
                    }
                }
            }
            return this;
        };

        /**
         * Utility method to check membership of an element.
         * 
         * @param  {Object} element to check membership
         * @returns {boolean} is the parameter a member of
         *      this set
         */
        this.has = function (member) {
            if (data[member] === true) {
                return true;
            } else {
                return false;
            }
        };

        /**
         * Utility method to remove an member from the set.
         * 
         * @param  {Object} member to remove from the set.
         * @return {KSet} this
         */
        this.delete = function (member) {
            if (this.has(member)) {
                data[member] = false;
                delete data[member];
                size--;
            }
            return this;
        };

        /**
         * Utility method to clear the set of all members.
         * 
         * @returns {KSet} this
         */
        this.clear = function () {
            data = {};
            size = 0;
            return this;
        };

        /**
         * Utility method to get the number of members that
         * are in the set. 
         * 
         * @return {number} the size of the set
         */
        this.size = function () {
            return size;
        };

        /**
         * Utility method to convert the set into an array and
         * return that array.
         * 
         * @returns {array} the array of object members in
         *      insertion order.
         */
        this.getArray = function () {
            var setArray = [];
            for (var key in data) {
                if (key) {
                    setArray.push(key);
                }
            }
            return setArray;
        };
    };

    /**
     * Utility method to convert hex color strings in the format '#ffffff'
     * to RGBA format strings in the format 'rgba(rrr,ggg,bbb,a)'. Ommitting
     * the Alpha value for the color will default the value to 1, or 100%
     * opaque.
     * 
     * @param  {string} hColor the hex format color string to convert to 
     *      RGBA format
     * @param  {number (double -> [0,1])} alph alpha value between 0-1 for
     *      the opacity of the returned RGBA string
     * @returns {string} rgba format string of the input hex color
     */
    KnimePlotlyInterface.hexToRGBA = function (hColor, alph) {
        if (!alph) {
            alph = 1;
        }
        return 'rgba(' + parseInt(hColor.slice(1, 3), 16) + ', ' +
            parseInt(hColor.slice(3, 5), 16) + ', ' +
            parseInt(hColor.slice(5, 7), 16) + ', ' + alph + ')';
    };

    /**
     * Utility method to get the names of all of the numeric columns
     * contained within the internally held KPI table.
     * 
     * @returns {['Universe_0', ...]} an array of the numeric column names
     */
    KnimePlotlyInterface.getNumericColumns = function () {
        var columns = this.table.getColumnNames();
        var columnTypes = this.table.getColumnTypes();
        var numColumns = columns.filter(function (c, i) {
            return columnTypes[i] === 'number';
        });
        return numColumns;
    };

    /**
     * Utility method to return the possible column types by checking the 
     * types of the columns in the KPI table spec. It also takes a parameter
     * for if the "rowKeys" type should be included. This method does return 
     * Date/Time types (hence the "...W..." in the name).
     * 
     * @param  {boolean} inclRowKey true if the 'rowKeys' column type should
     *      be included in the returned array
     * @returns {['foo', ...]} an array of KNIME column types as strings
     */
    KnimePlotlyInterface.getXYCartesianColsWDate = function (inclRowKey) {
        var columns = this.table.getColumnNames();
        var columnTypes = this.table.getKnimeColumnTypes();
        var xyCartColTypes = ['Number (integer)', 'Number (long)', 'Number (double)',
            'Date and Time', 'String', 'Local Date', 'Local Time',
            'Local Date Time', 'Zoned Date Time', 'Period', 'Duration'];
        var inclCols = columns.filter(function (c, i) {
            return xyCartColTypes.indexOf(columnTypes[i]) > -1;
        });
        if (inclRowKey) {
            inclCols.push('rowKeys');
        }
        return inclCols;
    };

    /**
     * Utility method to return the possible column types by checking the 
     * types of the columns in the KPI table spec. It also takes a parameter
     * for if the "rowKeys" type should be included. This method does NOT 
     * return Date/Time types (hence the "...WO..." in the name).
     * 
     * @param  {boolean} inclRowKey true if the 'rowKeys' column type should
     *      be included in the returned array
     * @returns {['foo', ...]} an array of KNIME column types as strings
     */
    KnimePlotlyInterface.getXYCartesianColsWODate = function (inclRowKey) {
        var columns = this.table.getColumnNames();
        var columnTypes = this.table.getKnimeColumnTypes();
        var xyCartColTypes = ['Number (integer)', 'Number (long)', 'Number (double)',
            'String'];
        var inclCols = columns.filter(function (c, i) {
            return xyCartColTypes.indexOf(columnTypes[i]) > -1;
        });
        if (inclRowKey) {
            inclCols.push('rowKeys');
        }
        return inclCols;
    };

    /**
     * This utility method returns the most requent color in an array
     * of color strings. Technically, it will return the most common
     * string member of any array, but in the KPI it is used to find
     * the most common color in collections of data points.
     * 
     * @param  {['foo', ...]} rowColors as hex strings ('#ffffff')
     * @returns {string} most common color in the parameterized array
     */
    KnimePlotlyInterface.getMostFrequentColor = function (rowColors) {
        return rowColors.sort(function (c1, c2) {
            return rowColors.filter(function (c3) {
                return c3 === c1;
            }).length - rowColors.filter(function (c4) {
                return c4 === c2;
            });
        }).pop();
    };

    /**
     * Clears internally held JSONData rows after they have been pivoted
     * from a row-wise format to a columnar storage format. Keeps the 
     * original table meta-info from the BufferedDataTable.
     */
    KnimePlotlyInterface.collectGarbage = function () {
        this.representation.inObjects[0].rows = null;
        this.table.setDataTable(this.representation.inObjects[0]);
    };

    /**
     * Checks the support and current state of WebGL in the browser instance.
     * This was added when we moved the Plotly extension to use WebGL by
     * default. It not only checks whether WebGL is supported by the browser,
     * but also whether or not it has been disabled.
     *
     * The approach used to check the WebGL support was inspired by multiple
     * sources:
     *  1) Modernizer.js: https://modernizr.com/download?webgl-dontmin-setclasses
     *  2) StackOverflow: @Balthazar && @oabarca
     *      https://stackoverflow.com/questions/11871077/proper-way-to-detect-webgl-support
     *
     * @returns {boolean} if WebGL can be used to render charts.
     */
    KnimePlotlyInterface.checkWebGlInBrowser = function () {
        var isSVG = document.documentElement.nodeName.toLowerCase() === 'svg';
        var canvas;
        var supported = false;
        var enabled = false;
        if (typeof document.createElement !== 'function') {
            // This is the case in IE7, where the type of createElement is "object".
            // For this reason, we cannot call apply() as Object is not a Function.
            canvas = document.createElement('canvas');
        } else if (isSVG) {
            canvas = document.createElementNS.call(document, 'http://www.w3.org/2000/svg', 'canvas');
        } else {
            canvas = document.createElement('canvas');
        }
        var supports = 'probablySupportsContext' in canvas ? 'probablySupportsContext' :  'supportsContext';
        if (supports in canvas) {
            supported = Boolean(canvas[supports]('webgl') || canvas[supports]('experimental-webgl'));
        } else {
            supported = 'WebGLRenderingContext' in window;
        }
        try {
            enabled = Boolean(!!window.WebGLRenderingContext &&
                (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
        } catch (e) {
            // do nothing; leave enabled false
        }
        return supported && enabled;
    };

    return KnimePlotlyInterface;
};
