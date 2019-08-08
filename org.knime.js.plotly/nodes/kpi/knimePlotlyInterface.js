window.KnimePlotlyInterface = function () {

    var KnimePlotlyInterface = {
        version: '1.0.0'
    };

    KnimePlotlyInterface.initialize = function (rep, val, knimeDataTable, args) {

        var self = this;
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

    KnimePlotlyInterface.drawChart = function (traceArr, layout, config) {
        if (this.representation.options.enableGL && this.representation.runningInView) {
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
                svgCol += new XMLSerializer().serializeToString(svg);
            }
        });
        svgCol += '</svg>';
        return svgCol;
    };

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

    KnimePlotlyInterface.setIsSurface = function (bool) {
        this.isSurface = bool;
    };

    KnimePlotlyInterface.setOnlySelectedBehavior = function (str) {
        this.onlySelectedBehavior = str;
    };

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

    // runs when 'draw chart' is called
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

    KnimePlotlyInterface.update = function (inChangeObj, layout, onlyLayout) {

        var layoutObj = layout;

        if (onlyLayout && layoutObj) {
            this.Plotly.relayout(this.divID, layout);
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

    KnimePlotlyInterface.updateValue = function (newValue) {
        for (var key in newValue) {
            this.value.options[key] = newValue[key];
        }
    };

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
                            if (filterInd > 0 && !self.filtered.has(colInd)) {
                                return;
                            }
                            self.filtered.add(self.data.rowKeys[colInd]);
                        } else if (self.filtered.has(colInd)) {
                            self.filtered.remove(self.data.rowKeys[colInd]);
                        }
                    });
                }
            }
        });
    };

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

    KnimePlotlyInterface.getOrderedArray = function (array) {
        var orderedData = [];

        for (var i = 0; i < array.length; i++) {
            orderedData[i] = array[this.orderedIndicies[i]];
        }

        return orderedData.filter(function (val) { return val === 0 || val; });
    };

    KnimePlotlyInterface.updateShowOnlySelected = function (bool) {
        this.showOnlySelected = bool;
        if (!bool && self.lastSOSState) {
            self.lastSOSState = false;
        }
    };


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

    KnimePlotlyInterface.adjustTitleSpacing = function () {
        if (document.querySelector('.gtitle')) {
            document.querySelector('.gtitle').setAttribute('dy', '-.5em');
        }
    };

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

    KnimePlotlyInterface.togglePublishSelection = function () {
        if (this.value.options.publishSelection) {
            knimeService.setSelectedRows(
                this.table.getTableId(),
                this.selected.getArray()
            );
        }
    };

    KnimePlotlyInterface.TraceMap = function (traceIds) {
        for (var i = 0; i < traceIds.length; i++) {
            this[traceIds[i]] = i;
        }
    };

    KnimePlotlyInterface.KMap = function (iterable) {

        var obj = {};
        var keys = [];
        var values = [];

        if (iterable && iterable.length) {
            for (var i = 0; i < iterable.length; i++) {
                if (typeof iterable[i][0] !== 'undefined') {
                    this.set(iterable[i][0], iterable[i][1]);
                }
            }
        }

        this.set = function (key, value) {
            var ind = keys.push(key);
            values.push(value);
            obj[key] = {
                value: value,
                ind: ind
            };
            return this;
        };

        this.has = function (key) {
            if (typeof obj[key] === 'undefined') {
                return false;
            } else {
                return true;
            }
        };

        this.clear = function () {
            obj = {};
            keys = [];
            values = [];
            return this;
        };

        this.get = function (key) {
            return obj[key].value;
        };

        this.delete = function (key) {
            if (typeof obj[key] === 'undefined') {
                return false;
            } else {
                keys.splice(obj[key].ind, 1);
                values.splice(obj[key].ind, 1);
                delete this.obj[key];
                return true;
            }
        };

        this.entries = function () {
            var result = [];
            for (var i = 0; i < values.length; i++) {
                result.push([keys[i], values[i]]);
            }
        };

        this.keys = function () {
            return keys;
        };

        this.values = function () {
            return values;
        };
    };

    KnimePlotlyInterface.KSet = function (iterable) {

        var data = {};
        var size = 0;

        if (iterable && iterable.length) {
            for (var i = 0; i < iterable.length; i++) {
                data[iterable[i]] = true;
            }
        }

        this.add = function (member) {
            if (typeof member !== 'undefined') {
                if (!this.has(member)) {
                    size++;
                }
                data[member] = true;
            }
            return this;
        };

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

        this.has = function (member) {
            if (data[member] === true) {
                return true;
            } else {
                return false;
            }
        };

        this.delete = function (member) {
            if (this.has(member)) {
                data[member] = false;
                delete data[member];
                size--;
            }
            return this;
        };

        this.clear = function () {
            data = {};
            size = 0;
            return this;
        };

        this.size = function () {
            return size;
        };

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

    KnimePlotlyInterface.hexToRGBA = function (hColor, alph) {
        return 'rgba(' + parseInt(hColor.slice(1, 3), 16) + ', ' +
            parseInt(hColor.slice(3, 5), 16) + ', ' +
            parseInt(hColor.slice(5, 7), 16) + ', ' + alph + ')';
    };

    KnimePlotlyInterface.getNumericColumns = function () {
        var columns = this.table.getColumnNames();
        var columnTypes = this.table.getColumnTypes();
        var numColumns = columns.filter(function (c, i) {
            return columnTypes[i] === 'number';
        });
        return numColumns;
    };

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

    KnimePlotlyInterface.getMostFrequentColor = function (rowColors) {
        return rowColors.sort(function (c1, c2) {
            return rowColors.filter(function (c3) {
                return c3 === c1;
            }).length - rowColors.filter(function (c4) {
                return c4 === c2;
            });
        }).pop();
    };

    KnimePlotlyInterface.collectGarbage = function () {
        this.representation.inObjects[0].rows = null;
        this.table.setDataTable(this.representation.inObjects[0]);
    };

    return KnimePlotlyInterface;
};
