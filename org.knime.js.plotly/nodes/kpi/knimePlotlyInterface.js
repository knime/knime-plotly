window.KnimePlotlyInterface = function () {

    var KnimePlotlyInterface = {
        version: '1.0.0'
    };

    KnimePlotlyInterface.initialize = function (rep, val, knimeDataTable, Plotly) {
        var self = this;
        this.representation = rep;
        this.value = val;
        this.table = knimeDataTable;
        this.Plotly = Plotly;
        this.table.setDataTable(this.representation.inObjects[0]);
        this.columns = knimeDataTable.getColumnNames();
        this.rowColors = knimeDataTable.getRowColors();
        this.rowDirectory = {};
        this.filtered = new this.KSet([]);
        this.selected = new this.KSet([]);
        this.traceDirectory = [];
        this.changeObjKeys = [];
        this.orderedIndicies = [];
        this.totalSelected = 0;
        this.isOrdered = false;
        this.showOnlySelected = false;
        this.isSurface = false;
        this.data = {
            rowKeys: [],
            rowColors: []
        };

        this.columns.forEach(function (column) {
            self.data[column] = [];
        });

        knimeDataTable.getRows().forEach(function (row, rowInd) {

            row.data.forEach(function (data, dataInd) {
                self.data[self.columns[dataInd]].push(data);
            });

            self.rowDirectory[row.rowKey] = {
                tInds: [],
                pInd: self.data.rowColors.push(self.rowColors[rowInd]) - 1
            };

            self.data.rowKeys.push(row.rowKey);
            self.filtered.add(row.rowKey);
        });

        this.collectGarbage();

        return this;
    };

    KnimePlotlyInterface.drawChart = function (traceArr, layout, config) {
        this.indexTraces(traceArr);
        this.Plotly.newPlot(this.divID, traceArr, layout, config);
    };

    KnimePlotlyInterface.getSVG = function () {
        this.Plotly.toImage(this.Plotly.d3.select('#knime-violin').node(),
            { format: 'svg', width: 800, height: 600 }).then(function (dataUrl) {
            // TODO: decode URI
            return decodeURIComponent(dataUrl);
        });
    };

    KnimePlotlyInterface.getComponentValue = function () {
        return this.value;
    };

    KnimePlotlyInterface.setIsSurface = function (bool) {
        this.isSurface = bool;
    };

    KnimePlotlyInterface.createElement = function (stringDivName) {
        this.divID = stringDivName;
        // Create the plotly HTML element
        let div = document.createElement('div');
        div.setAttribute('id', stringDivName);
        document.body.append(div);
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
        if (this.representation.options.enableGroups && this.representation.options.groupByColumn) {
            self.data[this.representation.options.groupByColumn].forEach(function (group, groupInd) {
                if (typeof groupLocations[group] === 'undefined') {
                    groupLocations[group] = count;
                    groupIndicies.push(count);
                    keySet.forEach(function (key) {
                        obj[key].push([]);
                    });
                    obj.names.push(group);
                    count++;
                } else {
                    groupIndicies.push(groupLocations[group]);
                }
            });
        } else {
            groupIndicies = this.data.rowKeys.map(function (val, valInd) { return 0; });
            keySet.forEach(function (key) {
                obj[key].push([]);
            });
            obj.names.push(['Data']);
        }

        groupIndicies.forEach(function (indArr, gInd) {
            keySet.forEach(function (key) {
                obj[key][indArr].push(self.data[key][gInd]);
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
                    if (self.showOnlySelected && !self.selected.has(rowKey) || !self.filtered.has(rowKey)) {
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
                    if (self.showOnlySelected && !self.selected.has(rowId) || !self.filtered.has(rowId)) {
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

        if (onlyLayout && layout) {
            this.Plotly.relayout(this.divID, layout);
        } else {
            var changeObj = inChangeObj || this.getFilteredChangeObject();

            if (layout) {
                this.Plotly.update(this.divID, changeObj, layout);
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

            if (data.range && (data.range.x2 || data.range.y2)) {
                data.points.forEach(function (pt) {
                    var ptRowKeys = pt.fullData.ids;
                    pt.pointIndices.forEach(function (ptInd) {
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

        this.value.selection = this.selected;
    };

    KnimePlotlyInterface.updateFilter = function (data) {

        if (!data) {
            this.createAllInclusiveFilter();
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
    };


    KnimePlotlyInterface.mountAndSubscribe = function (selectionChange, filterChange) {
        document.getElementById(this.divID).on('plotly_selected', function (plotlyEvent) {
            selectionChange(plotlyEvent);
        });
        document.getElementById(this.divID).on('plotly_deselect', function () {
            filterChange({ points: [] });
        });
        this.togglePublishSelection();
        this.toggleSubscribeToFilters(filterChange);
        this.toggleSubscribeToSelection(selectionChange);
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

        if (iterable && iterable.length) {
            for (var i = 0; i < iterable.length; i++) {
                data[iterable[i]] = true;
            }
        }

        this.add = function (member) {
            data[member] = true;
            return this;
        };

        this.addAll = function (members) {
            if (members && members.length) {
                for (var i = 0; i < members.length; i++) {
                    data[members[i]] = true;
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
            data[member] = false;
            delete data[member];
            return this;
        };

        this.clear = function () {
            data = {};
            return this;
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