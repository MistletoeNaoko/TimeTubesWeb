import React from 'react';
import ReactDOM from 'react-dom';
import ResultSummary from '../Components/ResultSummary';
import * as TimeTubesAction from '../Actions/TimeTubesAction';
import * as domActions from '../lib/domActions';
import DataStore from '../Stores/DataStore';
import FeatureStore from '../Stores/FeatureStore';
import TimeTubesStore from '../Stores/TimeTubesStore';

export function makeQueryfromQBE(source, period, ignored) {
    let roundedPeriod = [Math.floor(period[0]), Math.ceil(period[1])];
    let minJD = DataStore.getData(source).data.meta.min.z;
    let lookup = DataStore.getData(source).data.lookup;
    let query = {};
    for (let key in lookup) {
        if (ignored.indexOf(key) < 0) {
            query[key] = [];
        }
    }
    for (let i = roundedPeriod[0]; i <= roundedPeriod[1]; i++) {
        let values = DataStore.getValues(source, i - minJD);
        for (let key in query) {
            if (key !== 'z') {
                query[key].push(values[key]);
            } else {
                query[key].push(i);
            }
        }
    }
    query['minJD'] = roundedPeriod[0];
    query['arrayLength'] = roundedPeriod[1] - roundedPeriod[0] + 1;
    return query;
}

export function runMatching(query, targets, DTWType, normalization, dist, window, step, period) {
    // make a nomalized query if the user select the normalized option (only think about relative shapes of variations)
    // slide a window and create a target array
    // normalize the target
    // compute DTW distance
    // store the DTW distance with the first time stamp of the time slice and the length of the priod
    // sort the result
    let result = [];//, resultLib = [];
    let distFunc;
    switch (dist) {
        case 'Euclidean':
            distFunc = EuclideanDist;
            break;
    }
    if (normalization) {
        query = normalizeTimeSeries(query);
    }
    for (let targetId = 0; targetId < targets.length; targetId++) {
        let targetData = DataStore.getDataArray(targets[targetId], 1);
        let minJD = targetData.z[0];

        switch (DTWType) {
            case 'DTWI':
                if (window > 0) {
                    // compute dtw every time (time consuming :(
                    let i = 0;
                    while (i < targetData.arrayLength - period[0]) {
                        let dtws = [];
                        for (let j = period[0]; j <= period[1]; j++) {
                            if (i + j > targetData.arrayLength - 1) break;
                            let dtwSum = 0, paths = {};
                            for (let key in query) {
                                if (Array.isArray(targetData[key]) && key !== 'z') {
                                    let target = targetData[key].slice(i, i + j);
                                    if (normalization) {
                                        target = normalizeTimeSeries(target);
                                    }
                                    let dtw = DTW(query[key], target, window, distFunc);
                                    let path = OptimalWarpPath(dtw);
                                    paths[key] = path;
                                    dtwSum += dtw[query[key].length - 1][target.length - 1];
                                }
                            }
                            dtws.push({dist: dtwSum, path: paths});
                        }
                        let minIdx = 0;
                        let minVal = Infinity;
                        for (let j = 0; j < dtws.length; j++) {
                            if (dtws[j].dist < minVal) {
                                minVal = dtws[j].dist;
                                minIdx = j;
                            }
                        }
                        result.push([targetId, i + minJD, period[0] + minIdx, minVal, dtws.path]);
                        i += step;
                    }
                } else {
                    // If there are no restriction on window size (simpleDTW), use fast computing
                    let i = 0;
                    while (i < targetData.arrayLength - period[0]) {
                        let dists = {};
                        let maxLen = (i + period[1] < targetData.arrayLength - 1) ? period[1] : targetData.arrayLength - i;
                        for (let key in query) {
                            if (Array.isArray(targetData[key]) && key !== 'z') {
                                let target = targetData[key].slice(i, i + maxLen);
                                if (normalization) {
                                    target = normalizeTimeSeries(target);
                                }
                                let dist = DTWSimple(query[key], target, distFunc);
                                dists[key] = dist;
                            }
                        }
                        // Choose a collection of dtw which minimize the sum
                        let targetPeriod = maxLen - period[0] + 1, 
                            dtws = [];
                        for (let j = 1; j <= targetPeriod; j++) {
                            let distSum = 0;
                            for (let key in dists) {
                                distSum += dists[key][query.arrayLength - 1][dists[key][0].length - 1 - targetPeriod + j];
                            }
                            dtws.push(distSum);
                        }
                        let minIdx = 0;
                        let minVal = Infinity;
                        for (let j = 0; j < dtws.length; j++) {
                            if (dtws[j] < minVal) {
                                minVal = dtws[j];
                                minIdx = j;
                            }
                        }

                        let paths = {};
                        for (let key in dists) {
                            let minDist = [];
                            for (let j = 0; j < dists[key].length; j++) {
                                minDist.push(dists[key].slice(0, dists[key][j].length - 1 - targetPeriod + (minIdx + 1) + 1));
                            }
                            paths[key] = OptimalWarpPath(minDist);
                        }
                        // result is a collection of [start JD, the length of period, dtw value]
                        result.push([targetId, i + minJD, period[0] + minIdx, minVal, paths]);
                        i += step;
                    }
                }
                break;
            case 'DTWD':
                let keys = [];
                for (let key in query) {
                    if (Array.isArray(query[key]) && key !== 'z') {
                        keys.push(key);
                    }
                }
                if (window > 0) {
                    // use DTW
                    let i = 0;
                    while (i < targetData.arrayLength - period[0]) {
                        let dtws = [];
                        for (let j = period[0]; j <= period[1]; j++) {
                            if (i + j > targetData.arrayLength - 1) break;
                            let target = {};
                            keys.forEach(function (key) {
                                target[key] = targetData[key].slice(i, i + j);
                            });
                            target.arrayLength = j;
                            if (normalization) {
                                target = normalizeTimeSeries(target);
                            }
                            // let distMat = DTWMD(query, target, window, keys, distFunc);
                            dtws.push(DTWMD(query, target, window, keys, distFunc));//distMat[distMat.length - 1][distMat[0].length - 1]);
                        }
                        let minIdx = 0;
                        let minVal = Infinity;
                        for (let j = 0; j < dtws.length; j++) {
                            if (dtws[j][dtws[j].length - 1][dtws[j][0].length - 1] < minVal) {
                                minVal = dtws[j][dtws[j].length - 1][dtws[j][0].length - 1];
                                minIdx = j;
                            }
                        }
                        let path = OptimalWarpPath(dtws[minIdx]);
                        result.push([targetId, i + minJD, period[0] + minIdx, minVal, path]);
                        i += step;
                    }
                } else {
                    // use DTWSimple
                    let i = 0;
                    while (i < targetData.arrayLength - period[0]) {
                        let target = {};
                        let maxLen = (i + period[1] < targetData.arrayLength - 1) ? period[1] : targetData.arrayLength - i;
                        keys.forEach(function (key) {
                            target[key] = targetData[key].slice(i, i + maxLen);
                        });
                        target.arrayLength = maxLen;
                        if (normalization) {
                            target = normalizeTimeSeries(target);
                        }
                        let dist = DTWSimpleMD(query, target, keys, distFunc);
                        let targetPeriod = maxLen - period[0] + 1,
                            dtws = [];
                        for (let j = 1; j <= targetPeriod; j++) {
                            dtws.push(dist[query.arrayLength - 1][target.arrayLength - 1 - targetPeriod + j])
                        }
                        let minIdx = 0;
                        let minVal = Infinity;
                        for (let j = 1; j < dtws.length; j++) {
                            if (dtws[j] < minVal) {
                                minVal = dtws[j];
                                minIdx = j;
                            }
                        }

                        let minDist = [];
                        for (let j = 0; j < dist.length; j++) {
                            minDist.push(dist[j].slice(0, target.arrayLength - 1 - targetPeriod + (minIdx + 1) + 1));
                        }
                        let path = OptimalWarpPath(minDist);
                        result.push([targetId, i + minJD, period[0] + minIdx, minVal, path]);
                        i += step;
                    }
                }
                break;
        }
    }
    // result stores [id, JD, period, dtw distance]
    return result;
}

export function runMatchingSketch(query, targets, DTWType, normalization, dist, window, step, period) {
    let result = [];
    let distFunc;
    switch (dist) {
        case 'Euclidean':
            distFunc = EuclideanDist;
            break;
    }
    if (normalization) {
        query = normalizeTimeSeries(query);
    }
    for (let targetId = 0; targetId < targets.length; targetId++) {
        let targetData = DataStore.getDataArray(targets[targetId], 1);
        let minJD = targetData.z[0];

        // TODO: how to filter values when DTWI is selected
        switch (DTWType) {
            case 'DTWD':
                let keys = [], keysFilter = [];
                for (let key in query) {
                    if (Array.isArray(query[key]) && query[key].indexOf(null) < 0 && key !== 'z') {
                        keys.push(key);
                    } else if (Array.isArray(query[key]) && query[key].indexOf(null) >= 0) {
                        keysFilter.push(key);
                    }
                }

                if (window > 0) {
                    // use DTW
                    let i = 0;
                    while (i < targetData.arrayLength - period[0]) {
                        let dtws = [];
                        for (let j = period[0]; j <= period[1]; j++) {
                            if (i + j > targetData.arrayLength - 1) break;
                            let target = {};
                            keys.forEach(function (key) {
                                target[key] = targetData[key].slice(i, i + j);
                            });
                            target.arrayLength = j;
                            if (normalization) {
                                target = normalizeTimeSeries(target);
                            }
                            dtws.push(DTWMD(query, target, window, keys, distFunc));
                        }
                        let minIdx = 0;
                        let minVal = Infinity;
                        for (let j = 0; j < dtws.length; j++) {
                            if (dtws[j][dtws[j].length - 1][dtws[j][0].length - 1] < minVal) {
                                minVal = dtws[j][dtws[j].length - 1][dtws[j][0].length - 1];
                                minIdx = j;
                            }
                        }
                        // check whether the time slice is filtered out or not
                        let path = OptimalWarpPath(dtws[minIdx]);
                        let flag = true;
                        for (let key in keysFilter) {
                            for (let j = 0; j < query[keysFilter[key]].length; j++) {
                                if (query[keysFilter[key]][j]) {
                                    // value range is assigned to the time point
                                    for (let k = 0; k < path.length; k++) {
                                        // find the corresponding time point in the target
                                        // path[k][0]: time point of the target
                                        // path[k][1]: time point of the query
                                        if (path[k][1] < j) break;
                                        if (path[k][1] === j) {
                                            let targetVal = targetData[keysFilter[key]][i + path[k][0]];
                                            // check whether the value of the variable is in the assigned range
                                            if (targetVal < query[keysFilter[key]][j][0] || query[keysFilter[key]][j][1] < targetVal) {
                                                // filtered out!
                                                flag = false;
                                                break;
                                            }
                                        }
                                    }
                                }
                                if (!flag) break;
                            }
                            if (!flag) break;
                        }
                        if (flag) {
                            result.push([targetId, i + minJD, period[0] + minIdx, minVal, path]);
                        }
                        i += step;
                    }
                } else {
                    // use DTWSimple
                    let i = 0;
                    while (i < targetData.arrayLength - period[0]) {
                        let target = {};
                        let maxLen = (i + period[1] < targetData.arrayLength - 1) ? period[1] : targetData.arrayLength - i;
                        keys.forEach(function (key) {
                            target[key] = targetData[key].slice(i, i + maxLen);
                        });
                        target.arrayLength = maxLen;
                        if (normalization) {
                            target = normalizeTimeSeries(target);
                        }
                        let dist = DTWSimpleMD(query, target, keys, distFunc);
                        let targetPeriod = maxLen - period[0] + 1,
                            dtws = [];
                        for (let j = 1; j <= targetPeriod; j++) {
                            dtws.push(dist[query.arrayLength - 1][target.arrayLength - 1 - targetPeriod + j])
                        }
                        let minIdx = 0;
                        let minVal = Infinity;
                        for (let j = 0; j < dtws.length; j++) {
                            if (dtws[j] < minVal) {
                                minVal = dtws[j];
                                minIdx = j;
                            }
                        }

                        let minDist = [];
                        for (let j = 0; j < dist.length; j++) {
                            minDist.push(dist[j].slice(0, target.arrayLength - 1 - targetPeriod + (minIdx + 1) + 1));
                        }
                        // check whether the time slice is filtered out or not
                        let path = OptimalWarpPath(minDist);
                        let flag = true;
                        for (let key in keysFilter) {
                            for (let j = 0; j < query[keysFilter[key]].length; j++) {
                                if (query[keysFilter[key]][j]) {
                                    // value range is assigned to the time point
                                    for (let k = 0; k < path.length; k++) {
                                        // find the corresponding time point in the target
                                        // path[k][0]: time point of the target
                                        // path[k][1]: time point of the query
                                        if (path[k][1] < j) break;
                                        if (path[k][1] === j) {
                                            let targetVal = targetData[keysFilter[key]][i + path[k][0]];
                                            // check whether the value of the variable is in the assigned range
                                            if (targetVal < query[keysFilter[key]][j][0] || query[keysFilter[key]][j][1] < targetVal) {
                                                // filtered out!
                                                flag = false;
                                                break;
                                            }
                                        }
                                    }
                                }
                                if (!flag) break;
                            }
                            if (!flag) break;
                        }
                        if (flag) {
                            result.push([targetId, i + minJD, period[0] + minIdx, minVal, path]);
                        }
                        i += step;
                    }
                }
                break;
        }
    }
    return result;
}

function normalizeTimeSeries(data) {
    // array or object
    let result;
    if (Array.isArray(data)) {
        result = [];
        let min = Math.min.apply(null, data),
            max = Math.max.apply(null, data);
        for (let i = 0; i < data.length; i++) {
            result.push((data[i] - min) / (max - min));
        }
    } else if (typeof(data) === 'object') {
        result = {};
        for (let key in data) {
            if (Array.isArray(data[key]) && data[key].indexOf(null) < 0) {
                let min = Math.min.apply(null, data[key]),
                    max = Math.max.apply(null, data[key]);
                let tmp = data[key].map(function (num) {
                    return (num - min) / (max - min);
                });
                result[key] = tmp;
            } else {
                result[key] = data[key];
            }
        }
    }
    return result;
}

export function DTWSimple(s, t, distFunc) {
    let dist = [];
    for (let i = 0; i < s.length; i++) {
        dist[i] = [];
        for (let j = 0; j < t.length; j++) {
            dist[i][j] = Infinity;
        }
    }

    for (let i = 0; i < s.length; i++) {
        for (let j = 0; j < t.length; j++) {
            if (i > 0) {
                if (j > 0) {
                    dist[i][j] = distFunc(s[i], t[j]) + Math.min(dist[i - 1][j], dist[i][j - 1], dist[i - 1][j - 1]);
                } else {
                    dist[i][j] = distFunc(s[i], t[j]) + dist[i - 1][j];
                }
            } else {
                if (j > 0) {
                    dist[i][j] = distFunc(s[i], t[j]) + dist[i][j - 1];
                } else {
                    dist[i][j] = 0;
                }
            }
        }
    }
    // let result = []
    // for (let i = 1; i <= period; i++) {
    //     result.push(dist[s.length - 1][t.length - 1 - period + i]);
    // }
    return dist;//result;
}

export function DTWSimpleMD(s, t, keys, distFunc) {
    // s and t are object
    let dist = [];
    for (let i = 0; i < s.arrayLength; i++) {
        dist[i] = [];
        for (let j = 0; j < t.arrayLength; j++) {
            dist[i][j] = Infinity;
        }
    }

    for (let i = 0; i < s.arrayLength; i++) {
        let sValues = [];
        keys.forEach(function (key) {
            sValues.push(s[key][i]);
        });
        for (let j = 0; j < t.arrayLength; j++) {
            let tValues = [];
            keys.forEach(function (key) {
                tValues.push(t[key][j]);
            });
            if (i > 0) {
                if (j > 0) {
                    dist[i][j] = distFunc(sValues, tValues) + Math.min(dist[i - 1][j], dist[i][j - 1], dist[i - 1][j - 1]);
                } else {
                    dist[i][j] = distFunc(sValues, tValues) + dist[i - 1][j];
                }
            } else {
                if (j > 0) {
                    dist[i][j] = distFunc(sValues, tValues) + dist[i][j - 1];
                } else {
                    dist[i][j] = 0;
                }
            }
        }
    }

    // let result = []
    // for (let i = 1; i <= period; i++) {
    //     result.push(dist[s.arrayLength - 1][t.arrayLength - 1 - period + i]);
    // }
    // return result;
    return dist;
}

export function DTW(s, t, w, distFunc) {
    let dist = [];
    w = Math.max(w, Math.abs(s.length - t.length));
    for (let i = 0; i < s.length; i++) {
        dist[i] = [];
        for (let j = 0; j < t.length; j++) {
            dist[i][j] = Infinity;
        }
    }

    dist[0][0] = 0;
    for (let i = 1; i < s.length; i++) {
        let start = Math.max(1, i - w),
            end = Math.min(t.length, i + w);
        for (let j = start; j < end; j++) {
            dist[i][j] = 0;
        }
    }

    for (let i = 1; i < s.length; i++) {
        let start = Math.max(1, i - w),
            end = Math.min(t.length, i + w);
        for (let j = start; j < end; j++) {
            dist[i][j] = distFunc(s[i], t[j]) + Math.min(
                dist[i - 1][j],     // insertion
                dist[i][j - 1],     // deletion
                dist[i - 1][j - 1]  // match
            );
        }
    }
    return dist;//[s.length - 1][t.length - 1];
}

export function DTWMD(s, t, w, keys, distFunc) {
    let dist = [];
    w = Math.max(w, Math.abs(s.arrayLength - t.arrayLength));
    for (let i = 0; i < s.arrayLength; i++) {
        dist[i] = [];
        for (let j = 0; j < t.arrayLength; j++) {
            dist[i][j] = Infinity;
        }
    }

    dist[0][0] = 0;
    for (let i = 1; i < s.arrayLength; i++) {
        let start = Math.max(1, i - w),
            end = Math.min(t.arrayLength, i + w);
        for (let j = start; j < end; j++) {
            dist[i][j] = 0;
        }
    }

    for (let i = 1; i < s.arrayLength; i++) {
        let start = Math.max(1, i - w),
            end = Math.min(t.arrayLength, i + w);
        let sValues = [];
        keys.forEach(function (key) {
            sValues.push(s[key][i]);
        });
        for (let j = start; j < end; j++) {
            let tValues = [];
            keys.forEach(function (key) {
                tValues.push(t[key][j]);
            });
            dist[i][j] = distFunc(sValues, tValues) + Math.min(
                dist[i - 1][j],     // insertion
                dist[i][j - 1],     // deletion
                dist[i - 1][j - 1]  // match
            );
        }
    }
    return dist;
}

function OptimalWarpPath(cost) {
    let path = [];
    let i = cost.length - 1,
        j = cost[0].length - 1;
    path.push([j, i]);
    while (i > 0 && j > 0) {
        if (i === 0) {
            j--;
        } else if (j === 0) {
            i--;
        } else {
            if (cost[i - 1][j] === Math.min(cost[i - 1][j - 1], cost[i - 1][j], cost[i][j - 1])) {
                i--;
            } else if (cost[i][j - 1] === Math.min(cost[i - 1][j - 1], cost[i - 1][j], cost[i][j - 1])) {
                j--;
            } else {
                i--;
                j--;
            }
        }
        path.push([j, i]);
    }
    path.push([0, 0]);
    return path;
}

function EuclideanDist(x, y) {
    if (Array.isArray(x)) {
        let sum = 0;
        for (let i = 0; i < x.length; i++) {
            sum += Math.pow(x[i] - y[i], 2);
        }
        return Math.sqrt(sum);
    } else {
        return Math.abs(x - y);
    }
}

function sortResults(resultOrder) {
    let func;
    switch(resultOrder) {
        case 'distance':
            func = function (a, b) {
                return a[3] - b[3];
            };
            break;
        case 'timeStamp':
            func = function (a, b) {
                let diff = a[1] - b[1];
                if (diff === 0) {
                    diff = a[0] - b[0];
                }
                return diff;
            };
            break;
        case 'data':
            func = function (a, b) {
                let diff = a[0] - b[0];
                if (diff === 0) {
                    diff = a[3] - b[3];
                }
                return diff;
            };
            break;
    }
    return func;
}

export function showExtractionResults() {
    // close the source panel
    if ($('#QBESourceMain').css('display') !== 'none') {
        domActions.toggleSourcePanel();
    }
    // get the options for showing results
    // order of the results
    let resultOrderList = document.getElementById('resultOrderList');
    let selectedIdx = resultOrderList.selectedIndex;
    let resultOrder = resultOrderList.options[selectedIdx].value;
    // k value
    let kValue = $('#topKResults').val();
    // distance threshold
    let distTh = $('#distanceThreshold').val();

    // filter results according to the input options
    // sort results
    let results = FeatureStore.getExtractionResults();
    results.sort(sortResults(resultOrder));

    // filter out results with distance higher than threshold
    if (distTh !== '') {
        results = results.filter(function(result) {
            return (result[3] < distTh)? true: false;
        });
    }
    // show only top k results
    if (kValue !== '') {
        results = results.slice(0, kValue);
    }
    // get a snapshot of the time slice
    // step 1: store the current status of the camera
    let targetList = FeatureStore.getTarget();
    let currentCamera = {},
        currentPos = {},
        minJDs = {},
        canvas = {};
    for (let i = 0; i < targetList.length; i++) {
        currentCamera[String(targetList[i])] = TimeTubesStore.getCameraProp(targetList[i]);
        currentPos[String(targetList[i])] = TimeTubesStore.getFocused(targetList[i]);
        minJDs[String(targetList[i])] = DataStore.getData(targetList[i]).data.meta.min.z;
        canvas[String(targetList[i])] = document.getElementById('TimeTubes_viewport_' + targetList[i]);
        // step 2: reset camera position
        let aspect = currentCamera[String(targetList[i])].aspect;
        TimeTubesAction.updateCamera(targetList[i], {
            xpos: 0,
            ypos: 0,
            zpos: 50,
            fov: 45,
            far: 2000,
            depth: 0,
            aspect: aspect,
            zoom: 1,
            type: 'Perspective'
        });
    }
    let summaries = [];
    let domnode = document.getElementById('resultsArea');
    // if there are previous results on the result panel, remove all
    while (domnode.firstChild) {
        ReactDOM.unmountComponentAtNode(domnode.firstChild);
        domnode.removeChild(domnode.firstChild);
    }
    for (let i = 0; i < results.length; i++) {
        // add a holder for React component to allow unmount react components
        let divElem = document.createElement('div');
        divElem.id = 'resultSummaryHolder_' + i;
        domnode.appendChild(divElem);
        let result = results[i];
        TimeTubesAction.takeSnapshot(result[0], result[1] - minJDs[String(result[0])], result[2]);

        let imageHeight = canvas[String(result[0])].height,
            imageWidth = canvas[String(result[0])].width;
        let image = new Image();
        image.src = canvas[String(result[0])].toDataURL();
        image.height = imageHeight;
        image.width = imageWidth;
        ReactDOM.render(<ResultSummary
            key={i}
            id={result[0]}
            thumbnail={image}
            period={[result[1], result[1] + result[2]]}
            distance={result[3]}
            path={result[4]}
            rank={i}/>, divElem);
    }
    // recover camara status
    for (let i = 0; i < targetList.length; i++) {
        TimeTubesAction.recoverTube(targetList[i], currentCamera[String(targetList[i])], currentPos[String(targetList[i])]);
    }
}
