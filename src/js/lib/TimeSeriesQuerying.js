import React from 'react';
import ReactDOM from 'react-dom';
import ResultSummary from '../Components/ResultSummary';
import * as d3 from 'd3';
import * as TimeTubesAction from '../Actions/TimeTubesAction';
import * as FeatureAction from '../Actions/FeatureAction';
import * as domActions from '../lib/domActions';
import * as mathLib from '../lib/mathLib';
import DataStore from '../Stores/DataStore';
import FeatureStore from '../Stores/FeatureStore';
import TimeTubesStore from '../Stores/TimeTubesStore';

export function makeQueryfromQBE(source, period, activeVar, coordinates) {
    let roundedPeriod = [Math.floor(period[0]), Math.ceil(period[1])];
    let minJD = DataStore.getData(source).data.meta.min.z;
    let lookup = DataStore.getData(source).data.lookup;
    let queryVal = {}, keys = [];
    keys = activeVar;
    // for (let key in lookup) {
    //     if (ignored.indexOf(key) < 0) {
    //         keys.push(key);
    //     }
    // }
    if (coordinates === 'rectangular') {
        for (let keyIdx = 0; keyIdx < keys.length; keyIdx++) {
            queryVal[keys[keyIdx]] = [];
        }
        for (let i = roundedPeriod[0]; i <= roundedPeriod[1]; i++) {
            let values = DataStore.getValues(source, i - minJD);
            for (let key in queryVal) {
                if (key !== 'z') {
                    queryVal[key].push(values[key]);
                } else if (key === 'z') {
                    queryVal[key].push(i);
                }
            }
        }
        queryVal['minJD'] = roundedPeriod[0];
        queryVal['arrayLength'] = roundedPeriod[1] - roundedPeriod[0] + 1;
    } else if (coordinates === 'polar') {
        // to use polar coordinate, both of x and y axis information are necessary
        if (keys.indexOf('x') < 0 || keys.indexOf('y') < 0) {
            alert('To use the polar coordinate for computing similarities, you cannot ignore the Stokes parameters (Q/I and U/I).');
            return false;
        } else {
            for (let keyIdx = 0; keyIdx < keys.length; keyIdx++) {
                queryVal[keys[keyIdx]] = [];
                // if (keys[keyIdx] === 'x') {
                //     queryVal.r = [];
                // } else if (keys[keyIdx] === 'y') {
                //     queryVal.theta = [];
                // } else {
                //     queryVal[keys[keyIdx]] = [];
                // }
            }
            queryVal.r = [];
            queryVal.theta = [];
            for (let i = roundedPeriod[0]; i <= roundedPeriod[1]; i++) {
                let values = DataStore.getValues(source, i - minJD);
                let r = Math.sqrt(Math.pow(values.x, 2) + Math.pow(values.y, 2));
                let theta = convertRadToDeg(Math.atan2(values.y, values.x));
                for (let key in queryVal) {
                    if (key === 'r') {
                        queryVal[key].push(r);
                    } else if (key === 'theta') {
                        queryVal[key].push(theta);
                    } else if (key !== 'z') {
                        queryVal[key].push(values[key]);
                    } else if (key === 'z') {
                        queryVal[key].push(i);
                    }
                }
            }
            queryVal['minJD'] = roundedPeriod[0];
            queryVal['arrayLength'] = roundedPeriod[1] - roundedPeriod[0] + 1;
        }
    }
    // let activeVarName = [];
    // for (let i = 0; i < activeVar.length; i++) {
    //     activeVarName.push(lookup[activeVar[i]]);
    // }
    let query = {
        mode: 'visual query',
        option: 'query-by-example',
        query: {
            source: DataStore.getData(Number(FeatureStore.getSource())).name,
            period: roundedPeriod,
            activeVariables: activeVar//activeVarName
        },
        values: queryVal
    };
    return query;
}

export function makeQueryPolarQBS(query) {
    let keys = Object.keys(query);
    let queryPolar = {};
    if (keys.indexOf('x') < 0 || keys.indexOf('y') < 0) {
        alert('To use the polar coordinate for computing similarities, you cannot ignore the Stokes parameters (Q/I and U/I).');
        return false;
    } else {
        if (query.x.indexOf(null) >= 0 || query.y.indexOf(null) >= 0) {
            alert('To use the polar coordinate for computing similarities, you have to assign Q/I and U/I to x axis, y axis, or width.');
            return false;
        } else {
            let r = [], theta = [];
            for (let i = 0; i < query.arrayLength; i++) {
                let rValue = Math.sqrt(Math.pow(query.x[i], 2) + Math.pow(query.y[i], 2));
                let thetaValue = convertRadToDeg(Math.atan2(query.y[i], query.x[i]));
                r.push(rValue);
                theta.push(thetaValue);
            }
            queryPolar.r = r;
            queryPolar.theta = theta;
            for (let key in query) {
                // if (key !== 'x' && key !== 'y') {
                    queryPolar[key] = query[key];
                // }
            }
        }
    }
    return queryPolar;
}

export function runMatching(query, targets, parameters) {
    // parameters (DTWType, normalization, normalizationOption, dist, window, step, period)
    // make a nomalized query if the user select the normalized option (only think about relative shapes of variations)
    // slide a window and create a target array
    // normalize the target
    // compute DTW distance
    // store the DTW distance with the first time stamp of the time slice and the length of the priod
    // sort the result
    let DTWType = parameters.DTWType, 
        normalization = parameters.normalize,
        normalizationOption = parameters.normalizationOption,
        dist = parameters.distanceMetric,
        window = parameters.warpingWindowSize,
        step = parameters.slidingWindow,
        period = parameters.timeSliceLength,
        distanceNormalization = parameters.distanceNormalization;
    let result = [];
    let distFunc;
    switch (dist) {
        case 'Euclidean':
            distFunc = EuclideanDist;
            break;
    }
    // normalize query when needed
    if (normalization) {
        query = normalizeTimeSeries(normalizationOption, query);
    }
    // compute distances between query and targets
    for (let targetIdx = 0; targetIdx < targets.length; targetIdx++) {
        let targetId = targets[targetIdx];
        let targetData = DataStore.getDataArray(targetId, 1);
        // if QI and UI values are converted into polar coordinates,
        // convert target data into polar coordinates as well
        if (query.r) {
            let newTargetData = {};
            let r = [], theta = [];
            for (let i = 0; i < targetData.arrayLength; i++) {
                r.push(Math.sqrt(Math.pow(targetData.x[i], 2) + Math.pow(targetData.y[i], 2)));
                theta.push(convertRadToDeg(Math.atan2(targetData.y[i], targetData.x[i])));
            }
            newTargetData.r = r;
            newTargetData.theta = theta;
            for (let key in targetData) {
                newTargetData[key] = targetData[key];
            }
            targetData = newTargetData;
        }
        let minJD = targetData.z[0];
        // make a list for parameters in the datasets
        let keys = [];
        if (query.r) {
            for (let key in query) {
                if (key !== 'x' && key !== 'y') { 
                    if (Array.isArray(query[key]) && key !== 'z') {
                        keys.push(key);
                    }
                }
            }
        } else {
            for (let key in query) {
                if (Array.isArray(query[key]) && key !== 'z') {
                    keys.push(key);
                }
            }
        }

        switch (DTWType) {
            case 'DTWI':
                // when the window siz constraint is exist
                if (window > 0) {
                    let i = 0;
                    while (i < targetData.arrayLength - period[0]) {
                        let dtws = [];
                        for (let j = period[0]; j <= period[1]; j++) {
                            if (i + j > targetData.arrayLength - 1) break;
                            let dtwSum = 0, paths = {};
                            keys.forEach(function (key) {
                                if (Array.isArray(targetData[key]) && key !== 'z') {
                                    let target = targetData[key].slice(i, i + j);
                                    if (normalization) {
                                        if (key !== 'theta') {
                                            target = normalizeTimeSeries(normalizationOption, target);
                                        } else {
                                            target = normalizeTheta(normalizationOption, target);
                                        }
                                    }
                                    let dtw = DTW(query[key], target, window, distFunc);
                                    paths[key] = OptimalWarpingPath(dtw);
                                    switch (distanceNormalization) {
                                        case 'none':
                                            dtwSum += dtw[query[key].length - 1][target.length - 1];
                                            break;
                                        case 'warpingPathLength':
                                            dtwSum += (dtw[query[key].length - 1][target.length - 1] / paths[key].length);
                                            break;
                                        case 'minLength':
                                            dtwSum += (dtw[query[key].length - 1][target.length - 1] / Math.min(query.arrayLength, j));
                                            break;
                                        case 'maxLength':
                                            dtwSum += (dtw[query[key].length - 1][target.length - 1] / Math.max(query.arrayLength, j));
                                            break;
                                        case 'timeNormalization':
                                            let distSum = 0, weightSum = 0, weight = 0;
                                            for (let k = 0; k < paths[key].length - 1; k++) {
                                                weight = (paths[key][k][0] - paths[key][k + 1][0]) + (paths[key][k][1] - paths[key][k + 1][1]);
                                                distSum += weight * (dtw[paths[key][k][1]][paths[key][k][0]] - dtw[paths[key][k + 1][1]][paths[key][k + 1][0]]);
                                                weightSum += weight;
                                            }
                                            weight = 1;
                                            distSum += weight * dtw[0][0];
                                            weightSum += weight;
                                            distSum /= weightSum;
                                            dtwSum += distSum;
                                            break;
                                        case 'pathLengthRatio':
                                            dtwSum += (dtw[query[key].length - 1][target.length - 1] / (paths[key].length / (query.arrayLength + j)));
                                            break;
                                        default:
                                            break;
                                    }
                                }
                            });
                            dtws.push({dist: dtwSum, path: paths});
                        }
                        let minIdx = 0;
                        let minVal = {dist: Infinity};
                        for (let j = 0; j < dtws.length; j++) {
                            if (dtws[j].dist < minVal.dist) {
                                minVal = dtws[j];
                                minIdx = j;
                            }
                        }
                        if (minVal.dist !== Infinity) {
                            result.push({
                                id: targetId,
                                start: i + minJD,
                                period: period[0] + minIdx,
                                distance: minVal.dist,
                                path: minVal.path
                            });//[targetId, i + minJD, period[0] + minIdx, minVal, dtws.path]);
                        }
                        i += step;
                    }
                } else {
                    // If there are no restriction on window size (simpleDTW), use fast computing
                    let i = 0;
                    while (i < targetData.arrayLength - period[0]) {
                        let dists = {};
                        let maxLen = (i + period[1] < targetData.arrayLength - 1) ? period[1] : targetData.arrayLength - i;
                        keys.forEach(function (key) {
                            if (Array.isArray(targetData[key]) && key !== 'z') {
                                let target = targetData[key].slice(i, i + maxLen);
                                if (normalization) {
                                    if (key !== 'theta') {
                                        target = normalizeTimeSeries(normalizationOption, target);
                                    } else {
                                        target = normalizeTheta(normalizationOption, target);
                                    }
                                }
                                let dist = DTWSimple(query[key], target, distFunc);
                                dists[key] = dist;
                            }
                        });
                        // Choose a collection of dtw which minimize the sum
                        let targetPeriod = maxLen - period[0] + 1, 
                            dtws = [];
                        for (let j = 1; j <= targetPeriod; j++) {
                            let dtwSum = 0,
                                paths = {};
                            for (let key in dists) {
                                let targetLength = dists[key][0].length - targetPeriod + j;
                                let subDist = [];
                                for (let k = 0; k < dists[key].length; k++) {
                                    subDist.push(dists[key][k].slice(0, targetLength));
                                }
                                paths[key] = OptimalWarpingPath(subDist);
                                switch (distanceNormalization) {
                                    case 'none':
                                        dtwSum += subDist[query.arrayLength - 1][targetLength - 1];
                                        break;
                                    case 'warpingPathLength':
                                        dtwSum += (subDist[query.arrayLength - 1][targetLength - 1] / paths[key].length);
                                        break;
                                    case 'minLength':
                                        dtwSum += (subDist[query.arrayLength - 1][targetLength - 1] / Math.min(query.arrayLength, targetLength));
                                        break;
                                    case 'maxLength':
                                        dtwSum += (subDist[query.arrayLength - 1][targetLength - 1] / Math.max(query.arrayLength, targetLength));
                                        break;
                                    case 'timeNormalization':
                                        let distSum = 0, weightSum = 0, weight = 0;
                                        for (let k = 0; k < paths[key].length - 1; k++) {
                                            weight = (paths[key][k][0] - paths[key][k + 1][0]) + (paths[key][k][1] - paths[key][k + 1][1]);
                                            distSum += weight * (subDist[paths[key][k][1]][paths[key][k][0]] - subDist[paths[key][k + 1][1]][paths[key][k + 1][0]]);
                                            weightSum += weight;
                                        }
                                        weight = 1;
                                        distSum += weight * subDist[0][0];
                                        weightSum += weight;
                                        distSum /= weightSum;
                                        dtwSum += distSum;
                                        break;
                                    case 'pathLengthRatio':
                                        dtwSum += (subDist[query.arrayLength - 1][targetLength - 1] / (paths[key].length / (query.arrayLength + targetLength)));
                                        break;
                                    default:
                                        break;
                                }
                            }
                            dtws.push({dist: dtwSum, paths: paths});
                        }
                        let minIdx = 0;
                        let minVal = {dist: Infinity};
                        for (let j = 0; j < dtws.length; j++) {
                            if (dtws[j].dist < minVal.dist) {
                                minVal = dtws[j];
                                minIdx = j;
                            }
                        }

                        // let paths = {};
                        // for (let key in dists) {
                        //     let minDist = [];
                        //     for (let j = 0; j < dists[key].length; j++) {
                        //         minDist.push(dists[key].slice(0, dists[key][j].length - 1 - targetPeriod + (minIdx + 1) + 1));
                        //     }
                        //     paths[key] = OptimalWarpingPath(minDist);
                        // }
                        // result is a collection of [start JD, the length of period, dtw value]
                        if (minVal.dist !== Infinity) {
                            result.push({
                                id: targetId,
                                start: i + minJD,
                                period: period[0] + minIdx,
                                distance: minVal.dist,
                                path: minVal.paths
                            });//[targetId, i + minJD, period[0] + minIdx, minVal, paths]);
                        }
                        i += step;
                    }
                }
                break;
            case 'DTWD':
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
                                target = normalizeTimeSeries(normalizationOption, target);
                            }
                            // let distMat = DTWMD(query, target, window, keys, distFunc);
                            dtws.push(DTWMD(query, target, window, keys, distFunc));//distMat[distMat.length - 1][distMat[0].length - 1]);
                        }
                        let minIdx = 0;
                        let minVal = {dist: Infinity};
                        for (let j = 0; j < dtws.length; j++) {
                            let path = OptimalWarpingPath(dtws[j]);
                            let distTmp = dtws[j][dtws[j].length - 1][dtws[j][0].length - 1];
                            switch (distanceNormalization) {
                                case 'none':
                                    // do nothing
                                    break;
                                case 'warpingPathLength':
                                    distTmp /= path.length;
                                    break;
                                case 'minLength':
                                    distTmp /= Math.min(query.arrayLength, target.arrayLength);
                                    break;
                                case 'maxLength':
                                    distTmp /= Math.max(query.arrayLength, target.arrayLength);
                                    break;
                                case 'timeNormalization':
                                    let distSum = 0, weightSum = 0, weight = 0;
                                    for (let k = 0; k < path.length - 1; k++) {
                                        weight = (path[k][0] - path[k + 1][0]) + (path[k][1] - path[k + 1][1]);
                                        distSum += weight * (dtws[j][path[k][1]][path[k][0]] - dtws[j][path[k + 1][1]][path[k + 1][0]]);
                                        weightSum += weight;
                                    }
                                    weight = 1;
                                    distSum += weight * dtws[j][0][0];
                                    weightSum += weight;
                                    distSum /= weightSum;
                                    distTmp = distSum; 
                                    break;
                                case 'pathLengthRatio':
                                    distTmp /= (path.length / (query.arrayLength + target.arrayLength));
                                    break;
                                default:
                                    break;
                            }
                            if (distTmp < minVal.dist) {
                                minVal = {dist: distTmp, path: path};
                                minIdx = j;
                            }
                        }
                        // let path = OptimalWarpingPath(dtws[minIdx]);
                        if (minVal.dist !== Infinity) {
                            result.push({
                                id: targetId,
                                start: i + minJD,
                                period: period[0] + minIdx,
                                distance: minVal.dist,
                                path: minVal.path
                            });//[targetId, i + minJD, period[0] + minIdx, minVal, path]);
                        }
                        i += step;
                    }
                } else {
                    // use DTWSimple
                    let i = 0;
                    while (i < targetData.arrayLength - period[0]) {
                        let target = {};
                        let maxLen = (i + period[1] < targetData.arrayLength - 1) ? period[1] : targetData.arrayLength - i - 1;
                        keys.forEach(function (key) {
                            target[key] = targetData[key].slice(i, i + maxLen);
                        });
                        target.arrayLength = maxLen;
                        if (normalization) {
                            target = normalizeTimeSeries(normalizationOption, target);
                        }
                        let dist = DTWSimpleMD(query, target, keys, distFunc);
                        let targetPeriod = maxLen - period[0] + 1,
                            dtws = [];
                        for (let j = 1; j <= targetPeriod; j++) {
                            // make a new smaller distance matrix from original matrix
                            let subDist = [];//dist.slice(0, target.arrayLength - 1 - targetPeriod + j + 1);
                            for (let k = 0; k < dist.length; k++) {
                                subDist.push(dist[k].slice(0, target.arrayLength - 1 - targetPeriod + j + 1));
                            }

                            let path = OptimalWarpingPath(subDist);
                            let distTmp = subDist[query.arrayLength - 1][target.arrayLength - 1 - targetPeriod + j];
                            switch (distanceNormalization) {
                                case 'none':
                                    // do nothing
                                    break;
                                case 'warpingPathLength':
                                    distTmp /= path.length;
                                    break;
                                case 'minLength':
                                    distTmp /= Math.min(query.arrayLength, target.arrayLength - targetPeriod + j);
                                    break;
                                case 'maxLength':
                                    distTmp /= Math.max(query.arrayLength, target.arrayLength - targetPeriod + j);
                                    break;
                                case 'timeNormalization':
                                    let distSum = 0, weightSum = 0, weight = 0;
                                    for (let k = 0; k < path.length - 1; k++) {
                                        weight = (path[k][0] - path[k + 1][0]) + (path[k][1] - path[k + 1][1]);
                                        distSum += weight * (subDist[path[k][1]][path[k][0]] - subDist[path[k + 1][1]][path[k + 1][0]]);
                                        weightSum += weight;
                                    }
                                    weight = 1;
                                    distSum += weight * subDist[0][0];
                                    weight += weight;
                                    distSum /= weightSum;
                                    distTmp = distSum;
                                    break;
                                case 'pathLengthRatio':
                                    distTmp /= (path.length / (query.arrayLength + target.arrayLength - targetPeriod + j));
                                    break;
                                default:
                                    break;
                            }
                            dtws.push({dist: distTmp, path: path});
                                // dist[query.arrayLength - 1][target.arrayLength - 1 - targetPeriod + j])
                        }
                        let minIdx = 0;
                        let minVal = {dist: Infinity};
                        for (let j = 1; j < dtws.length; j++) {
                            if (dtws[j].dist < minVal.dist) {
                                minVal = dtws[j];
                                minIdx = j;
                            }
                        }
                        // let minDist = [];
                        // for (let j = 0; j < dist.length; j++) {
                        //     minDist.push(dist[j].slice(0, target.arrayLength - 1 - targetPeriod + (minIdx + 1) + 1));
                        // }
                        // let path = OptimalWarpingPath(minDist);
                        if (minVal.dist !== Infinity) {
                            result.push({
                                id: targetId,
                                start: i + minJD,
                                period: period[0] + minIdx,
                                distance: minVal.dist,
                                path: minVal.path
                            });//[targetId, i + minJD, period[0] + minIdx, minVal, path]);
                        }
                        i += step;
                    }
                }
                break;
        }
    }
    // result stores [id, JD, period, dtw distance]
    return result;
}

export function runMatchingClusterCenter(query, targets, parameters) {
    // in the case of QBE with cluster center, query has already normalized
    let DTWType = parameters.DTWType,
        normalization = parameters.normalize,
        normalizationOption = parameters.normalizationOption,
        dist = parameters.distanceMetric,
        window = parameters.warpingWindowSize,
        step = parameters.slidingWindow,
        period = parameters.timeSliceLength,
        distanceNormalization = parameters.distanceNormalization;
    let result = [];
    let distFunc;
    switch (dist) {
        case 'Euclidean':
            distFunc = EuclideanDist;
            break;
    }
    for (let targetIdx = 0; targetIdx < targets.length; targetIdx++) {
        let targetId = targets[targetIdx];

        // TODO: 本来はtargetDataもqueryと同じ解像度で補間すべき
        let targetData = DataStore.getDataArray(targetId, 1);
        // if QI and UI values are converted into polar coordinates,
        // convert target data into polar coordinates as well
        if (query.r) {
            let newTargetData = {};
            let r = [], theta = [];
            for (let i = 0; i < targetData.arrayLength; i++) {
                r.push(Math.sqrt(Math.pow(targetData.x[i], 2) + Math.pow(targetData.y[i], 2)));
                theta.push(convertRadToDeg(Math.atan2(targetData.y[i], targetData.x[i])));
            }
            newTargetData.r = r;
            newTargetData.theta = theta;
            for (let key in targetData) {
                newTargetData[key] = targetData[key];
            }
            targetData = newTargetData;
        }
        let minJD = targetData.z[0];
        // make a list for parameters in the datasets
        let keys = [];
        if (query.r) {
            for (let key in query) {
                if (key !== 'x' && key !== 'y') { 
                    if (Array.isArray(query[key]) && key !== 'z') {
                        keys.push(key);
                    }
                }
            }
        } else {
            for (let key in query) {
                if (Array.isArray(query[key]) && key !== 'z') {
                    keys.push(key);
                }
            }
        }

        switch (DTWType) {
            case 'DTWI':
                if (window > 0) {
                    let i = 0;
                    while (i < targetData.arrayLength - period[0]) {
                        let dtws = [];
                        for (let j = period[0]; j <= period[1]; j++) {
                            if (i + j > targetData.arrayLength - 1) break;
                            let dtwSum = 0, paths = {};
                            keys.forEach(function (key) {
                                if (Array.isArray(targetData[key]) && key !== 'z') {
                                    let target = targetData[key].slice(i, i + j);
                                    if (normalization) {
                                        if (key !== 'theta') {
                                            target = normalizeTimeSeries(normalizationOption, target);
                                        } else {
                                            target = normalizeTheta(normalizationOption, target);
                                        }
                                    }
                                    let dtw = DTW(query[key], target, window, distFunc);
                                    paths[key] = OptimalWarpingPath(dtw);
                                    switch (distanceNormalization) {
                                        case 'none':
                                            dtwSum += dtw[query[key].length - 1][target.length - 1];
                                            break;
                                        case 'warpingPathLength':
                                            dtwSum += (dtw[query[key].length - 1][target.length - 1] / paths[key].length);
                                            break;
                                        case 'minLength':
                                            dtwSum += (dtw[query[key].length - 1][target.length - 1] / Math.min(query.arrayLength, j));
                                            break;
                                        case 'maxLength':
                                            dtwSum += (dtw[query[key].length - 1][target.length - 1] / Math.max(query.arrayLength, j));
                                            break;
                                        case 'timeNormalization':
                                            let distSum = 0, weightSum = 0, weight = 0;
                                            for (let k = 0; k < paths[key].length - 1; k++) {
                                                weight = (paths[key][k][0] - paths[key][k + 1][0]) + (paths[key][k][1] - paths[key][k + 1][1]);
                                                distSum += weight * (dtw[paths[key][k][1]][paths[key][k][0]] - dtw[paths[key][k + 1][1]][paths[key][k + 1][0]]);
                                                weightSum += weight;
                                            }
                                            weight = 1;
                                            distSum += weight * dtw[0][0];
                                            weightSum += weight;
                                            distSum /= weightSum;
                                            dtwSum += distSum;
                                            break;
                                        case 'pathLengthRatio':
                                            dtwSum += (dtw[query[key].length - 1][target.length - 1] / (paths[key].length / (query.arrayLength + j)));
                                            break;
                                        default:
                                            break;
                                    }
                                }
                            });
                            dtws.push({dist: dtwSum, path: paths});
                        }
                        let minIdx = 0;
                        let minVal = {dist: Infinity};
                        for (let j = 0; j < dtws.length; j++) {
                            if (dtws[j].dist < minVal.dist) {
                                minVal = dtws[j];
                                minIdx = j;
                            }
                        }
                        if (minVal.dist !== Infinity) {
                            result.push({
                                id: targetId,
                                start: i + minJD,
                                period: period[0] + minIdx,
                                distance: minVal.dist,
                                path: minVal.path
                            });
                        }
                        i += step;
                    }
                } else {
                    // If there are no restriction on window size (simpleDTW), use fast computing
                    let i = 0;
                    while (i < targetData.arrayLength - period[0]) {
                        let dists = {};
                        let maxLen = (i + period[1] < targetData.arrayLength - 1) ? period[1] : targetData.arrayLength - i;
                        keys.forEach(function (key) {
                            if (Array.isArray(targetData[key]) && key !== 'z') {
                                let target = targetData[key].slice(i, i + maxLen);
                                if (normalization) {
                                    if (key !== 'theta') {
                                        target = normalizeTimeSeries(normalizationOption, target);
                                    } else {
                                        target = normalizeTheta(normalizationOption, target);
                                    }
                                }
                                let dist = DTWSimple(query[key], target, distFunc);
                                dists[key] = dist;
                            }
                        });
                        // Choose a collection of dtw which minimize the sum
                        let targetPeriod = maxLen - period[0] + 1, 
                            dtws = [];
                        for (let j = 1; j <= targetPeriod; j++) {
                            let dtwSum = 0,
                                paths = {};
                            for (let key in dists) {
                                let targetLength = dists[key][0].length - targetPeriod + j;
                                let subDist = [];
                                for (let k = 0; k < dists[key].length; k++) {
                                    subDist.push(dists[key][k].slice(0, targetLength));
                                }
                                paths[key] = OptimalWarpingPath(subDist);
                                switch (distanceNormalization) {
                                    case 'none':
                                        dtwSum += subDist[query.arrayLength - 1][targetLength - 1];
                                        break;
                                    case 'warpingPathLength':
                                        dtwSum += (subDist[query.arrayLength - 1][targetLength - 1] / paths[key].length);
                                        break;
                                    case 'minLength':
                                        dtwSum += (subDist[query.arrayLength - 1][targetLength - 1] / Math.min(query.arrayLength, targetLength));
                                        break;
                                    case 'maxLength':
                                        dtwSum += (subDist[query.arrayLength - 1][targetLength - 1] / Math.max(query.arrayLength, targetLength));
                                        break;
                                    case 'timeNormalization':
                                        let distSum = 0, weightSum = 0, weight = 0;
                                        for (let k = 0; k < paths[key].length - 1; k++) {
                                            weight = (paths[key][k][0] - paths[key][k + 1][0]) + (paths[key][k][1] - paths[key][k + 1][1]);
                                            distSum += weight * (subDist[paths[key][k][1]][paths[key][k][0]] - subDist[paths[key][k + 1][1]][paths[key][k + 1][0]]);
                                            weightSum += weight;
                                        }
                                        weight = 1;
                                        distSum += weight * subDist[0][0];
                                        weightSum += weight;
                                        distSum /= weightSum;
                                        dtwSum += distSum;
                                        break;
                                    case 'pathLengthRatio':
                                        dtwSum += (subDist[query.arrayLength - 1][targetLength - 1] / (paths[key].length / (query.arrayLength + targetLength)));
                                        break;
                                    default:
                                        break;
                                }
                            }
                            dtws.push({dist: dtwSum, paths: paths});
                        }
                        let minIdx = 0;
                        let minVal = {dist: Infinity};
                        for (let j = 0; j < dtws.length; j++) {
                            if (dtws[j].dist < minVal.dist) {
                                minVal = dtws[j];
                                minIdx = j;
                            }
                        }

                        if (minVal.dist !== Infinity) {
                            result.push({
                                id: targetId,
                                start: i + minJD,
                                period: period[0] + minIdx,
                                distance: minVal.dist,
                                path: minVal.paths
                            });
                        }
                        i += step;
                    }
                }
                break;
            case 'DTWD':
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
                                target = normalizeTimeSeries(normalizationOption, target);
                            }
                            // let distMat = DTWMD(query, target, window, keys, distFunc);
                            dtws.push(DTWMD(query, target, window, keys, distFunc));//distMat[distMat.length - 1][distMat[0].length - 1]);
                        }
                        let minIdx = 0;
                        let minVal = {dist: Infinity};
                        for (let j = 0; j < dtws.length; j++) {
                            let path = OptimalWarpingPath(dtws[j]);
                            let distTmp = dtws[j][dtws[j].length - 1][dtws[j][0].length - 1];
                            switch (distanceNormalization) {
                                case 'none':
                                    // do nothing
                                    break;
                                case 'warpingPathLength':
                                    distTmp /= path.length;
                                    break;
                                case 'minLength':
                                    distTmp /= Math.min(query.arrayLength, target.arrayLength);
                                    break;
                                case 'maxLength':
                                    distTmp /= Math.max(query.arrayLength, target.arrayLength);
                                    break;
                                case 'timeNormalization':
                                    let distSum = 0, weightSum = 0, weight = 0;
                                    for (let k = 0; k < path.length - 1; k++) {
                                        weight = (path[k][0] - path[k + 1][0]) + (path[k][1] - path[k + 1][1]);
                                        distSum += weight * (dtws[j][path[k][1]][path[k][0]] - dtws[j][path[k + 1][1]][path[k + 1][0]]);
                                        weightSum += weight;
                                    }
                                    weight = 1;
                                    distSum += weight * dtws[j][0][0];
                                    weightSum += weight;
                                    distSum /= weightSum;
                                    distTmp = distSum; 
                                    break;
                                case 'pathLengthRatio':
                                    distTmp /= (path.length / (query.arrayLength + target.arrayLength));
                                    break;
                                default:
                                    break;
                            }
                            if (distTmp < minVal.dist) {
                                minVal = {dist: distTmp, path: path};
                                minIdx = j;
                            }
                        }
                        // let path = OptimalWarpingPath(dtws[minIdx]);
                        if (minVal.dist !== Infinity) {
                            result.push({
                                id: targetId,
                                start: i + minJD,
                                period: period[0] + minIdx,
                                distance: minVal.dist,
                                path: minVal.path
                            });//[targetId, i + minJD, period[0] + minIdx, minVal, path]);
                        }
                        i += step;
                    }
                } else {
                    // use DTWSimple
                    let i = 0;
                    while (i < targetData.arrayLength - period[0]) {
                        let target = {};
                        let maxLen = (i + period[1] < targetData.arrayLength - 1) ? period[1] : targetData.arrayLength - i - 1;
                        keys.forEach(function (key) {
                            target[key] = targetData[key].slice(i, i + maxLen);
                        });
                        target.arrayLength = maxLen;
                        if (normalization) {
                            target = normalizeTimeSeries(normalizationOption, target);
                        }
                        let dist = DTWSimpleMD(query, target, keys, distFunc);
                        let targetPeriod = maxLen - period[0] + 1,
                            dtws = [];
                        for (let j = 1; j <= targetPeriod; j++) {
                            // make a new smaller distance matrix from original matrix
                            let subDist = [];//dist.slice(0, target.arrayLength - 1 - targetPeriod + j + 1);
                            for (let k = 0; k < dist.length; k++) {
                                subDist.push(dist[k].slice(0, target.arrayLength - 1 - targetPeriod + j + 1));
                            }

                            let path = OptimalWarpingPath(subDist);
                            let distTmp = subDist[query.arrayLength - 1][target.arrayLength - 1 - targetPeriod + j];
                            switch (distanceNormalization) {
                                case 'none':
                                    // do nothing
                                    break;
                                case 'warpingPathLength':
                                    distTmp /= path.length;
                                    break;
                                case 'minLength':
                                    distTmp /= Math.min(query.arrayLength, target.arrayLength - targetPeriod + j);
                                    break;
                                case 'maxLength':
                                    distTmp /= Math.max(query.arrayLength, target.arrayLength - targetPeriod + j);
                                    break;
                                case 'timeNormalization':
                                    let distSum = 0, weightSum = 0, weight = 0;
                                    for (let k = 0; k < path.length - 1; k++) {
                                        weight = (path[k][0] - path[k + 1][0]) + (path[k][1] - path[k + 1][1]);
                                        distSum += weight * (subDist[path[k][1]][path[k][0]] - subDist[path[k + 1][1]][path[k + 1][0]]);
                                        weightSum += weight;
                                    }
                                    weight = 1;
                                    distSum += weight * subDist[0][0];
                                    weight += weight;
                                    distSum /= weightSum;
                                    distTmp = distSum;
                                    break;
                                case 'pathLengthRatio':
                                    distTmp /= (path.length / (query.arrayLength + target.arrayLength - targetPeriod + j));
                                    break;
                                default:
                                    break;
                            }
                            dtws.push({dist: distTmp, path: path});
                                // dist[query.arrayLength - 1][target.arrayLength - 1 - targetPeriod + j])
                        }
                        let minIdx = 0;
                        let minVal = {dist: Infinity};
                        for (let j = 1; j < dtws.length; j++) {
                            if (dtws[j].dist < minVal.dist) {
                                minVal = dtws[j];
                                minIdx = j;
                            }
                        }
                        // let minDist = [];
                        // for (let j = 0; j < dist.length; j++) {
                        //     minDist.push(dist[j].slice(0, target.arrayLength - 1 - targetPeriod + (minIdx + 1) + 1));
                        // }
                        // let path = OptimalWarpingPath(minDist);
                        if (minVal.dist !== Infinity) {
                            result.push({
                                id: targetId,
                                start: i + minJD,
                                period: period[0] + minIdx,
                                distance: minVal.dist,
                                path: minVal.path
                            });//[targetId, i + minJD, period[0] + minIdx, minVal, path]);
                        }
                        i += step;
                    }
                }
                break;
            default:
                break;
        }
    }
    
    // result stores [id, JD, period, dtw distance]
    return result;
}

export function removeOverlappingQBE(source, period, results) {
    // remove results overlapping with a query (selected time interval)
    let newResults = [];
    let queryLength = period[1] - period[0];
    for (let i = 0; i < results.length; i++) {
        if (source === results[i].id) {
            let overlap = 0;
            if (period[0] <= results[i].start && results[i].start <= period[1]) {
                overlap = period[1] - results[i].start;
            } else if (period[0] <= results[i].start + results[i].period && results[i].start + results[i].period <= period[1]) {
                overlap = results[i].start + results[i].period - period[0];
            } else if (results[i].start <= period[0] && period[1] <= results[i].start + results[i].period) {
                // result includes a queru
                overlap = queryLength;
            } else if (period[0] <= results[i].start && results[i].start + results[i].period <= period[1]) {
                // quary includes a result
                overlap = results[i].period;
            }

            if (overlap / queryLength < 0.3) {
                newResults.push(results[i]);
            }
        } else {
            newResults.push(results[i]);
        }
    }
    return newResults;
}

export function runMatchingSketch(query, targets, parameters) {
    let DTWType = parameters.DTWType, 
        normalization = parameters.normalize,
        normalizationOption = parameters.normalizationOption,
        dist = parameters.distanceMetric,
        window = parameters.warpingWindowSize,
        step = parameters.slidingWindow,
        period = parameters.timeSliceLength,
        distanceNormalization = parameters.distanceNormalization;
    let result = [];
    let distFunc;
    switch (dist) {
        case 'Euclidean':
            distFunc = EuclideanDist;
            break;
    }
    if (normalization) {
        query = normalizeTimeSeries(normalizationOption, query);
    }
    for (let targetIdx = 0; targetIdx < targets.length; targetIdx++) {
        let targetId = targets[targetIdx];
        let targetData = DataStore.getDataArray(targetId, 1);
        if (query.r) {
            let newTargetData = {};
            let r = [], theta = [];
            for (let i = 0; i < targetData.arrayLength; i++) {
                r.push(Math.sqrt(Math.pow(targetData.x[i], 2) + Math.pow(targetData.y[i], 2)));
                theta.push(convertRadToDeg(Math.atan2(targetData.y[i], targetData.x[i])));
            }
            newTargetData.r = r;
            newTargetData.theta = theta;
            for (let key in targetData) {
                newTargetData[key] = targetData[key];
            }
            targetData = newTargetData;
        }
        let minJD = targetData.z[0];

        // TODO: how to filter values when DTWI is selected
        switch (DTWType) {
            case 'DTWD':
                let keys = [], keysFilter = [];
                if (query.r) {
                    for (let key in query) {
                        if (key !== 'x' && key !== 'y') { 
                            if (Array.isArray(query[key]) && query[key].indexOf(null) < 0 && key !== 'z') {
                                keys.push(key);
                            } else if (Array.isArray(query[key]) && query[key].indexOf(null) >= 0) {
                                keysFilter.push(key);
                            }
                        }
                    }
                } else {
                    for (let key in query) {
                        if (Array.isArray(query[key]) && query[key].indexOf(null) < 0 && key !== 'z') {
                            keys.push(key);
                        } else if (Array.isArray(query[key]) && query[key].indexOf(null) >= 0) {
                            keysFilter.push(key);
                        }
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
                                target = normalizeTimeSeries(normalizationOption, target);
                            }
                            dtws.push(DTWMD(query, target, window, keys, distFunc));
                        }
                        let minIdx = 0;
                        let minVal = {dist: Infinity};
                        for (let j = 0; j < dtws.length; j++) {
                            let path = OptimalWarpingPath(dtws[j]);
                            let distTmp = dtws[j][dtws[j].length - 1][dtws[j][0].length - 1];
                            switch (distanceNormalization) {
                                case 'none':
                                    // do nothing
                                    break;
                                case 'warpingPathLength':
                                    distTmp /= path.length;
                                    break;
                                case 'minLength':
                                    distTmp /= Math.min(query.arrayLength, target.arrayLength);
                                    break;
                                case 'maxLength':
                                    distTmp /= Math.max(query.arrayLength, target.arrayLength);
                                    break;
                                case 'timeNormalization':
                                    let distSum = 0, weightSum = 0, weight = 0;
                                    for (let k = 0; k < path.length - 1; k++) {
                                        weight = (path[k][0] - path[k + 1][0]) + (path[k][1] - path[k + 1][1]);
                                        distSum += weight * (dtws[j][path[k][1]][path[k][0]] - dtws[j][path[k + 1][1]][path[k + 1][0]]);
                                        weightSum += weight;
                                    }
                                    weight = 1;
                                    distSum += weight * dtws[j][0][0];
                                    weightSum += weight;
                                    distSum /= weightSum;
                                    distTmp = distSum; 
                                    break;
                                case 'pathLengthRatio':
                                    distTmp /= (path.length / (query.arrayLength + target.arrayLength));
                                    break;
                            }
                            if (distTmp < minVal.dist) {
                                minVal = {dist: distTmp, path: path};
                                minIdx = j;
                            }
                        }
                        // check whether the time slice is filtered out or not
                        // let path = OptimalWarpingPath(dtws[minIdx]);
                        let flag = true;
                        for (let key in keysFilter) {
                            for (let j = 0; j < query[keysFilter[key]].length; j++) {
                                if (query[keysFilter[key]][j]) {
                                    // value range is assigned to the time point
                                    for (let k = 0; k < minVal.path.length; k++) {
                                        // find the corresponding time point in the target
                                        // path[k][0]: time point of the target
                                        // path[k][1]: time point of the query
                                        if (minVal.path[k][1] < j) break;
                                        if (minVal.path[k][1] === j) {
                                            let targetVal = targetData[keysFilter[key]][i + minVal.path[k][0]];
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
                        if (flag && minVal.dist !== Infinity) {
                            result.push({
                                id: targetId,
                                start: i + minJD,
                                period: period[0] + minIdx,
                                distance: minVal.dist,
                                path: minVal.path
                            });//[targetId, i + minJD, period[0] + minIdx, minVal, path]);
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
                            target = normalizeTimeSeries(normalizationOption, target);
                        }

                        let dist = DTWSimpleMD(query, target, keys, distFunc);
                        let targetPeriod = maxLen - period[0] + 1,
                            dtws = [];
                        for (let j = 1; j <= targetPeriod; j++) {
                            let subDist = [];
                            for (let k = 0; k < dist.length; k++) {
                                subDist.push(dist[k].slice(0, target.arrayLength - 1 - targetPeriod + j + 1));
                            }
                            let path = OptimalWarpingPath(subDist);
                            let distTmp = subDist[query.arrayLength - 1][target.arrayLength - 1 - targetPeriod + j];
                            switch (distanceNormalization) {
                                case 'none':
                                    // do nothing
                                    break;
                                case 'warpingPathLength':
                                    distTmp /= path.length;
                                    break;
                                case 'minLength':
                                    distTmp /= Math.min(query.arrayLength, target.arrayLength - targetPeriod + j);
                                    break;
                                case 'maxLength':
                                    distTmp /= Math.max(query.arrayLength, target.arrayLength - targetPeriod + j);
                                    break;
                                case 'timeNormalization':
                                    let distSum = 0, weightSum = 0, weight = 0;
                                    for (let k = 0; k < path.length - 1; k++) {
                                        weight = (path[k][0] - path[k + 1][0]) + (path[k][1] - path[k + 1][1]);
                                        distSum += weight * (subDist[path[k][1]][path[k][0]] - subDist[path[k + 1][1]][path[k + 1][0]]);
                                        weightSum += weight;
                                    }
                                    weight = 1;
                                    distSum += weight * subDist[0][0];
                                    weight += weight;
                                    distSum /= weightSum;
                                    distTmp = distSum;
                                    break;
                                case 'pathLengthRatio':
                                    distTmp /= (path.length / (query.arrayLength + target.arrayLength - targetPeriod + j   ));
                                    break;
                            }
                            dtws.push({dist: distTmp, path: path});
                        }
                        let minIdx = 0;
                        let minVal = {dist: Infinity};
                        for (let j = 0; j < dtws.length; j++) {
                            if (dtws[j].dist < minVal.dist) {
                                minVal = dtws[j];
                                minIdx = j;
                            }
                        }
                        // let minDist = [];
                        // for (let j = 0; j < dist.length; j++) {
                        //     minDist.push(dist[j].slice(0, target.arrayLength - 1 - targetPeriod + (minIdx + 1) + 1));
                        // }
                        // check whether the time slice is filtered out or not
                        // let path = OptimalWarpingPath(minDist);
                        let flag = true;
                        for (let key in keysFilter) {
                            for (let j = 0; j < query[keysFilter[key]].length; j++) {
                                if (query[keysFilter[key]][j]) {
                                    // value range is assigned to the time point
                                    for (let k = 0; k < minVal.path.length; k++) {
                                        // find the corresponding time point in the target
                                        // path[k][0]: time point of the target
                                        // path[k][1]: time point of the query
                                        if (minVal.path[k][1] < j) break;
                                        if (minVal.path[k][1] === j) {
                                            let targetVal = targetData[keysFilter[key]][i + minVal.path[k][0]];
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
                        if (flag && minVal.dist !== Infinity) {
                            result.push({
                                id: targetId,
                                start: i + minJD,
                                period: period[0] + minIdx,
                                distance: minVal.dist,
                                path: minVal.path
                            });//[targetId, i + minJD, period[0] + minIdx, minVal, path]);
                        }
                        i += step;
                    }
                }
                break;
        }
    }
    return result;
}

function normalizeTimeSeries(normalizationOption, data) {
    // array or object
    let result, mean;
    switch (normalizationOption) {
        case 'minmax':
            if (Array.isArray(data)) {
                result = [];
                let min = Math.min.apply(null, data),
                    max = Math.max.apply(null, data);
                if (max - min !== 0) {
                    for (let i = 0; i < data.length; i++) {
                        result.push((data[i] - min) / (max - min));
                    }
                } else {
                    for (let i = 0; i < data.length; i++) {
                        result.push(0);
                    }
                }
            } else if (typeof(data) === 'object') {
                result = {};
                for (let key in data) {
                    if (Array.isArray(data[key]) && data[key].indexOf(null) < 0) {
                        if (key !== 'theta') {
                            let min = Math.min.apply(null, data[key]),
                                max = Math.max.apply(null, data[key]);
                            result[key] = [];
                            if (max - min !== 0) {
                                for (let i = 0; i < data[key].length; i++) {
                                    result[key].push((data[key][i] - min) / (max - min));
                                }
                            } else {
                                for (let i = 0; i < data[key].length; i++) {
                                    result[key].push(0);
                                }
                            }
                            // let tmp = data[key].map(function (num) {
                            //     return (max - min !== 0)? (num - min) / (max - min): 0;
                            // });
                            // result[key] = tmp;
                        } else {
                            result[key] = normalizeTheta(normalizationOption, data[key]);
                        }
                    } else {
                        result[key] = data[key];
                    }
                }
            }
            break;
        case 'centralize':
            // make the average of the time period 0
            if (Array.isArray(data)) {
                result = [];
                mean = d3.mean(data);
                for (let i = 0; i < data.length; i++) {
                    result.push(data[i] - mean);
                }
            } else {
                result = {};
                for (let key in data) {
                    if (Array.isArray(data[key]) && data[key].indexOf(null) < 0) {
                        if (key !== 'theta') {
                            mean = d3.mean(data[key]);
                            result[key] = [];
                            for (let i = 0; i < data[key].length; i++) {
                                result[key].push(data[key][i] - mean);
                            }
                        } else {
                            result[key] = normalizeTheta(normalizationOption, data[key]);
                        }
                    } else {
                        result[key] = data[key];
                    }
                }
            }
            break;
        case 'zScore':
            if (Array.isArray(data)) {
                result = [];
                mean = d3.mean(data);
                let std = d3.deviation(data);
                for (let i = 0; i < data.length; i++) {
                    result.push((data[i] - mean) / std);
                }
            } else if (typeof(data) === 'object') {
                result = {};
                for (let key in data) {
                    if (Array.isArray(data[key]) && data[key].indexOf(null) < 0) {
                        if (key !== 'theta') {
                            mean = d3.mean(data[key]);
                            let std = d3.deviation(data[key]);
                            result[key] = [];
                            for (let i = 0; i < data[key].length; i++) {
                                result[key].push((data[key][i] - mean) / std);
                            }
                        } else {
                            result[key] = normalizeTheta(normalizationOption, data[key]);
                        }
                    } else {
                        result[key] = data[key];
                    }
                }
            }
            break;
    }
    return result;
}

function normalizeTheta(normalizationOption, data) {
    let result = [], dataTmp = [], mean;
    // parameters for the exponential smoothing
    let before = data[0], quadrantBef = getQuadrantAngle(data[0]), angDelSum = 0;
    // transform thetas (from 0 to 360) to continuous data
    for (let i = 0; i < data.length; i++) {
        let quadrantNow = getQuadrantAngle(data[i]);
        
        if (quadrantBef === 1 && quadrantNow === 4) {
            // from 1st quadrant to 4th quadrant (counterclockwise)
            angDelSum -= 360;
        } else if (quadrantBef == 4 && quadrantNow === 1) {
            // from 4st quadrant to 1th quadrant (counterclockwise)
            angDelSum += 360;
        }

        dataTmp.push(data[i] + angDelSum);

        before = data[i] + angDelSum;
        quadrantBef = quadrantNow;
    }
    switch (normalizationOption) {
        case 'minmax':
            let min = Math.min.apply(null, dataTmp),
                max = Math.max.apply(null, dataTmp);
            for (let i = 0; i < dataTmp.length; i++) {
                result.push((dataTmp[i] - min) / (max - min));
            }
            break;
        case 'centralize':
            mean = d3.mean(dataTmp);
            for (let i = 0; i < dataTmp.length; i++) {
                result.push(dataTmp[i] - mean);
            }
            break;
        case 'zScore':
            mean = d3.mean(dataTmp);
            let std = d3.deviation(dataTmp);
            for (let i = 0; i < dataTmp.length; i++) {
                result.push((dataTmp[i] - mean) / std);
            }
            break;
    }
    return result;
}

export function DTWSimple(s, t, distFunc) {
    let dist = [];
    for (let i = 0; i <= s.length; i++) {
        dist[i] = [];
        for (let j = 0; j <= t.length; j++) {
            dist[i][j] = Infinity;
        }
    }
    dist[0][0] = 0;

    // distances between two data points are stored in dist[1~s.length][1~t.length]
    for (let i = 1; i <= s.length; i++) {
        for (let j = 1; j <= t.length; j++) {
            dist[i][j] = distFunc(s[i - 1], t[j - 1]) + Math.min(dist[i - 1][j], dist[i][j - 1], dist[i - 1][j - 1]);
            // if (i > 0) {
            //     if (j > 0) {
            //         dist[i][j] = distFunc(s[i], t[j]) + Math.min(dist[i - 1][j], dist[i][j - 1], dist[i - 1][j - 1]);
            //     } else {
            //         dist[i][j] = distFunc(s[i], t[j]) + dist[i - 1][j];
            //     }
            // } else {
            //     if (j > 0) {
            //         dist[i][j] = distFunc(s[i], t[j]) + dist[i][j - 1];
            //     } else {
            //         dist[i][j] = 0;
            //     }
            // }
        }
    }

    // remove infinity row and column
    let result = []
    for (let i = 1; i < dist.length; i++) {
        result.push(dist[i].slice(1, dist[i].length));
    }
    return result;
}

export function DTWSimpleMD(s, t, keys, distFunc) {
    // s and t are object
    let dist = [];
    for (let i = 0; i <= s.arrayLength; i++) {
        dist[i] = [];
        for (let j = 0; j <= t.arrayLength; j++) {
            dist[i][j] = Infinity;
        }
    }
    dist[0][0] = 0;

    // distances between two data points are stored in dist[1~s.length][1~t.length]
    for (let i = 1; i <= s.arrayLength; i++) {
        let sValues = [];
        keys.forEach(function (key) {
            sValues.push(s[key][i - 1]);
        });
        for (let j = 1; j <= t.arrayLength; j++) {
            let tValues = [];
            keys.forEach(function (key) {
                tValues.push(t[key][j - 1]);
            });
            dist[i][j] = distFunc(sValues, tValues) + Math.min(dist[i - 1][j], dist[i][j - 1], dist[i - 1][j - 1]);
            // if (i > 0) {
            //     if (j > 0) {
            //         dist[i][j] = distFunc(sValues, tValues) + Math.min(dist[i - 1][j], dist[i][j - 1], dist[i - 1][j - 1]);
            //     } else {
            //         dist[i][j] = distFunc(sValues, tValues) + dist[i - 1][j];
            //     }
            // } else {
            //     if (j > 0) {
            //         dist[i][j] = distFunc(sValues, tValues) + dist[i][j - 1];
            //     } else {
            //         dist[i][j] = 0;
            //     }
            // }
        }
    }

    // remove infinity row and column
    let result = []
    for (let i = 1; i < dist.length; i++) {
        result.push(dist[i].slice(1, dist[i].length));
    }
    return result;
    // return dist;
}

export function DTW(s, t, w, distFunc) {
    let dist = [];
    w = Math.max(w, Math.abs(s.length - t.length));
    for (let i = 0; i <= s.length; i++) {
        dist[i] = [];
        for (let j = 0; j <= t.length; j++) {
            dist[i][j] = Infinity;
        }
    }
    dist[0][0] = 0;
    for (let i = 1; i <= s.length; i++) {
        let start = Math.max(1, i - w),
            end = Math.min(t.length, i + w);
        for (let j = start; j <= end; j++) {
            dist[i][j] = 0;
        }
    }

    // distances between two data points are stored in dist[1~s.length][1~t.length]
    for (let i = 1; i <= s.length; i++) {
        let start = Math.max(1, i - w),
            end = Math.min(t.length, i + w);
        for (let j = start; j <= end; j++) {
            dist[i][j] = distFunc(s[i - 1], t[j - 1]) + Math.min(
                dist[i - 1][j],     // insertion
                dist[i][j - 1],     // deletion
                dist[i - 1][j - 1]  // match
            );
        }
    }

    // remove infinity row and column
    let result = [];
    for (let i = 1; i < dist.length; i++) {
        result.push(dist[i].slice(1, dist[i].length));
    }
    return result;//dist;//[s.length - 1][t.length - 1];
}

export function DTWMD(s, t, w, keys, distFunc) {
    let dist = [];
    w = Math.max(w, Math.abs(s.arrayLength - t.arrayLength));
    for (let i = 0; i <= s.arrayLength; i++) {
        dist[i] = [];
        for (let j = 0; j <= t.arrayLength; j++) {
            dist[i][j] = Infinity;
        }
    }
    dist[0][0] = 0;
    for (let i = 1; i <= s.arrayLength; i++) {
        let start = Math.max(1, i - w),
            end = Math.min(t.arrayLength, i + w);
        for (let j = start; j <= end; j++) {
            dist[i][j] = 0;
        }
    }

    for (let i = 1; i <= s.arrayLength; i++) {
        let start = Math.max(1, i - w),
            end = Math.min(t.arrayLength, i + w);
        let sValues = [];
        keys.forEach(function (key) {
            sValues.push(s[key][i - 1]);
        });
        for (let j = start; j <= end; j++) {
            let tValues = [];
            keys.forEach(function (key) {
                tValues.push(t[key][j - 1]);
            });
            dist[i][j] = distFunc(sValues, tValues) + Math.min(
                dist[i - 1][j],     // insertion
                dist[i][j - 1],     // deletion
                dist[i - 1][j - 1]  // match
            );
        }
    }

    // remove infinity row and column
    let result = []
    for (let i = 1; i < dist.length; i++) {
        result.push(dist[i].slice(1, dist[i].length));
    }
    return result;
    // return dist;
}

function OptimalWarpingPath(cost) {
    if (Array.isArray(cost)) {
        let path;
        let i = cost.length - 1,    // y axis: source (SS)
            j = cost[0].length - 1; // x axis: target (centroid/medoid)
        path = [[i, j]];
        while (i > 0 || j > 0) {
            if (i > 0) {
                if (j > 0) {
                    if (cost[i - 1][j] < cost[i - 1][j - 1]) {
                        if (cost[i - 1][j] < cost[i][j - 1]) {
                            path.push([i - 1, j]);
                            i--;
                        } else {
                            path.push([i, j - 1]);
                            j--;
                        }
                    } else {
                        if (cost[i - 1][j - 1] < cost[i][j - 1]) {
                            path.push([i - 1, j - 1]);
                            i--;
                            j--;
                        } else {
                            path.push([i, j - 1]);
                            j--;
                        }
                    }
                } else {
                    path.push([i - 1, j]);
                    i--;
                }
            } else {
                path.push([i, j - 1]);
                j--;
            }
        }
        return path;
    } else {
        let paths = {};
        for (let key in cost) {
            let path;
            let i = cost[key].length - 1,    // y axis: source (SS)
                j = cost[key][0].length - 1; // x axis: target (centroid/medoid)
            path = [[i, j]];
            while (i > 0 || j > 0) {
                if (i > 0) {
                    if (j > 0) {
                        if (cost[key][i - 1][j] < cost[key][i - 1][j - 1]) {
                            if (cost[key][i - 1][j] < cost[key][i][j - 1]) {
                                path.push([i - 1, j]);
                                i--;
                            } else {
                                path.push([i, j - 1]);
                                j--;
                            }
                        } else {
                            if (cost[key][i - 1][j - 1] < cost[key][i][j - 1]) {
                                path.push([i - 1, j - 1]);
                                i--;
                                j--;
                            } else {
                                path.push([i, j - 1]);
                                j--;
                            }
                        }
                    } else {
                        path.push([i - 1, j]);
                        i--;
                    }
                } else {
                    path.push([i, j - 1]);
                    j--;
                }
            }
            paths[key] = path;
        }
        return paths;
    }
}
// function OptimalWarpingPath(cost) {
//     let path = [];
//     let i = cost.length - 1,    // y: source
//         j = cost[0].length - 1; // x: target
//     path.push([j, i]);
//     while (i > 0 && j > 0) {
//         if (i === 0) {
//             j--;
//         } else if (j === 0) {
//             i--;
//         } else {
//             if (cost[i - 1][j] === Math.min(cost[i - 1][j - 1], cost[i - 1][j], cost[i][j - 1])) {
//                 i--;
//             } else if (cost[i][j - 1] === Math.min(cost[i - 1][j - 1], cost[i - 1][j], cost[i][j - 1])) {
//                 j--;
//             } else {
//                 i--;
//                 j--;
//             }
//         }
//         path.push([j, i]);
//     }
//     path.push([0, 0]);
//     return path;
// }

export function EuclideanDist(x, y) {
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

export function sortResults(resultOrder) {
    let func;
    switch(resultOrder) {
        case 'distance':
            func = function (a, b) {
                return a.distance - b.distance;
            };
            break;
        case 'timeStamp':
            func = function (a, b) {
                let diff = a.start - b.start;
                if (diff === 0) {
                    diff = a.id - b.id;
                }
                return diff;
            };
            break;
        case 'data':
            func = function (a, b) {
                let diff = a.id - b.id;
                if (diff === 0) {
                    diff = a.distance - b.distance;
                }
                return diff;
            };
            break;
        case 'significance':
            func = function (a, b) {
                return a.significance - b.significance;
            }
            break;
        case 'intensity':
            func = function (a, b) {
                return a.intensity - b.intensity;
            }
            break;
        case 'angle':
            func = function (a, b) {
                return a.angle - b.angle;
            }
            break;
        case 'diameter':
            func = function (a, b) {
                return a.diameter - b.diameter;
            }
            break;
        case 'period':
            func = function (a, b) {
                return a.period - b.period;
            }
            break;
        // case 'direction':
        //     func = function (a, b) {
        //         if (a.)
        //     }
        //     break;
        case 'anomalyDegree':
            // descending order
            func = function (a, b) {
                return b.anomalyDegree - a.anomalyDegree;
            }
            break;
        case 'fileName':
            func = function (a, b) {
                a = a.toString().toLowerCase();
                b = a.toString().toLowerCase();
                if (a < b) {
                    return -1;
                } else if (a > b) {
                    return 1;
                }
                return 0;
            }
            break;
    }
    return func;
}

export function setDefaltOrderOfResults() {
    // select the default order of the results
    let mode = FeatureStore.getMode();
    let options = document.getElementById('resultOrderList').options;
    let i = 0;
    if (mode === 'AE') {
        for (i = 0; i < options.length; i++) {
            if (options[i].value === 'timeStamp') {
                document.getElementById('resultOrderList').selectedIndex = i;
                break;
            }
        }
    } else if (mode === 'QBE' || mode === 'QBS') {
        for (i = 0; i < options.length; i++) {
            if (options[i].value === 'distance') {
                document.getElementById('resultOrderList').selectedIndex = i;
                break;
            }
        }
    }
    FeatureAction.updateOrder(options[i].value);
}

export function showExtractionResults() {
    // result stores {id, start, period, dtw distance, path} (not sorted)
    // close the source panel
    if ($('#QBESourceMain').css('display') !== 'none') {
        domActions.toggleSourcePanel(false);
    }
    // get the options for showing results
    // order of the results
    let resultOrder = FeatureStore.getOrder();
    // k value
    let kValue = FeatureStore.getKValue();
    // distance threshold
    let distTh = FeatureStore.getDistanceThreshold();
    // filter results according to the input options
    // sort results
    let results = FeatureStore.getExtractionResults();
    if (!$('#topKResults').prop('disabled')) {
        // sort the result in the order of the most important factor (distance, flx, angle, etc)
        let mode = FeatureStore.getMode();
        if (mode === 'QBE' || mode === 'QBS') {
            // in the visual query mode, order the result by distance at first
            results.sort(sortResults('distance'));
        } else if (mode === 'AE') {
            if (FeatureStore.getAEOptionStatus('anomaly')) {
                results.sort(sortResults('anomalyDegree'));
            }
            // when the flare or rotation extraction is selected in AE, show all candidates
        }
        // show only top k results
        if (kValue !== '') {
            results = results.slice(0, kValue);
        }
        results.sort(sortResults(resultOrder));
    } else {
        results.sort(sortResults(resultOrder));
    }

    // filter out results with distance higher than threshold
    if (distTh !== '') {
        results = results.filter(function(result) {
            return (result.distance < distTh)? true: false;
        });
    }
    FeatureAction.updateShownResults(results);

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
        // let aspect = currentCamera[String(targetList[i])].aspect;
        TimeTubesAction.resetCamera(targetList[i]);
        // TimeTubesAction.updateCamera(targetList[i], {
        //     xpos: 0,
        //     ypos: 0,
        //     zpos: 50,
        //     fov: 45,
        //     far: 2000,
        //     depth: 0,
        //     aspect: aspect,
        //     zoom: 1,
        //     type: 'Perspective'
        // });
    }
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
        TimeTubesAction.takeSnapshot(result.id, result.start - minJDs[String(result.id)], result.period);
        let imageHeight = canvas[String(result.id)].height,
            imageWidth = canvas[String(result.id)].width;
        let image = new Image();
        image.src = canvas[String(result.id)].toDataURL();
        image.height = imageHeight;
        image.width = imageWidth;
        ReactDOM.render(<ResultSummary
            key={i}
            id={result.id}
            thumbnail={image}
            result={result}
            period={[result.start, result.start + result.period]}
            distance={result.distance}
            path={result.path}
            rank={i}/>, divElem);
    }
    // recover camara status
    for (let i = 0; i < targetList.length; i++) {
        TimeTubesAction.recoverTube(targetList[i], currentCamera[String(targetList[i])], currentPos[String(targetList[i])]);
    }
    if (results.length > 0) {
        $('#matchingStatus').text(results.length + ' results are found');
    } else {
        $('#matchingStatus').text('No results are found');
    }
}

export function updateSortResultsPulldown() {
    let options = [];
    options.push('Time stamp');
    options.push('Data');
    let list = [];
    if (FeatureStore.getMode() === 'AE') {
        if (FeatureStore.getAEOptionStatus('flare')) {
            options.push('Significance');
            options.push('Intensity');
        }
        if (FeatureStore.getAEOptionStatus('rotation')) {
            options.push('Angle');
            options.push('Diameter');
            options.push('Period');
            // options.push('Direction');
        }
        if (FeatureStore.getAEOptionStatus('anomaly')) {
            options.push('Anomaly degree');
        }
    } else {
        options.push('Distance');
    }
    for (let i = 0; i < options.length; i++) {
        let value = domActions.transformSentenceToCamel(options[i]);
        list.push(<option value={value} key={value}>{options[i]}</option>);
    }
    return list;
}

export function extractAnomalies(targets) {
    let results = [];
    for (let targetIdx = 0; targetIdx < targets.length; targetIdx++) {
        let resultsTmp = [];
        let targetId = targets[targetIdx];
        let targetData = DataStore.getData(targetId);
        let spatial = targetData.data.spatial;
        let minPolar = Infinity, maxPolar = -Infinity;
        // compute the rate of variability of polarization, color, intensity between 2 observation points
        // in the case that the time stamps between polarization, color, intensity do not coincide, use the interpolated values
        for (let i = 0; i < spatial.length - 1; i++) {
            let z1 = spatial[i].z,
                z2 = spatial[i + 1].z;
            
            let data1 = DataStore.getValues(targetId, z1 - spatial[0].z),
                data2 = DataStore.getValues(targetId, z2 - spatial[0].z);

            let polar = Math.sqrt(
                Math.pow((data2.x - data1.x) / (targetData.data.meta.max.x - targetData.data.meta.min.x), 2.0)
                + Math.pow((data2.y - data1.y) / (targetData.data.meta.max.y - targetData.data.meta.min.y), 2.0)
            ) * 100 / (z2 - z1);
            if (polar === 0 || isNaN(polar)) {
                polar = 1;
            }
            if (maxPolar < polar) {
                maxPolar = polar;
            }
            if (polar < minPolar) {
                minPolar = polar;
            }

            let intensity = Math.abs(data2.V - data1.V) 
                / (targetData.data.meta.max.V - targetData.data.meta.min.V) 
                * 100 / (z2 - z1);
            if (intensity === 0 || isNaN(intensity))  {
                intensity = 1;
            }

            let color = Math.abs(data2.H - data1.H) 
                / (targetData.data.meta.max.H - targetData.data.meta.min.H) 
                * 100 / (z2 - z1);
            if (color === 0 || isNaN(color)) {
                color = 1;
            }

            resultsTmp.push({
                id: targetId,
                start: z1,
                polar: polar,
                intensity: intensity,
                color: color
                // anomalyDegree: polar * intensity * color
            });
        }
        for (let i = 0; i < spatial.length - 1; i++) {
            results.push({
                id: resultsTmp[i].id,
                start: resultsTmp[i].start,
                anomalyDegree: ((resultsTmp[i].polar - minPolar) / (maxPolar - minPolar)) * resultsTmp[i].intensity * resultsTmp[i].color
            });
        }
    }
    return results;
}

export function extractFlares(targets, method, lookaround, sensitivity) {
    let results = [];
    for (let targetIdx = 0; targetIdx < targets.length; targetIdx++) {
        let targetId = targets[targetIdx];
        let targetData = DataStore.getData(targetId);      
        let sigList = [];
        let significance;
        for (let i = 0; i < targetData.data.splines.value.points.length; i++) {
            switch (method) {
                case 'AveMaximum':
                    significance = significanceAveMaximum(targetId, i, lookaround);
                    break;
                case 'AveAve':
                    significance = significanceAveAve(targetId, i, lookaround);
                    break;
                case 'AveDist':
                    significance = significanceAveDist(targetId, i, lookaround);
                    break;
            }
            sigList.push({index: i, significance: significance, V: targetData.data.splines.value.points[i].y});
        }
        let sigPositiveList = sigList.filter(d => d.significance > 0);
        let mean = d3.mean(sigPositiveList, d => d.significance);
        let std = d3.deviation(sigPositiveList, d => d.significance);
        for (let i = 0; i < sigPositiveList.length; i++) {
            if (sigPositiveList[i].significance - mean > sensitivity * std) {
                results.push({
                    id: targetId,
                    start: targetData.data.splines.value.points[sigPositiveList[i].index].z,
                    significance: sigPositiveList[i].significance,
                    V: sigPositiveList[i].V
                });
            }
        }
    }
    return results;
}

function significanceAveMaximum(targetId, dataId, lookaround) {
    let significance;
    let targetData = DataStore.getData(targetId).data.splines.value.points;
    let current = targetData[dataId].y;
    let leftNeighbor = targetData.slice(
        (dataId - lookaround) >= 0? dataId - lookaround: 0, 
        dataId).map(d => d.y);
    for (let i = 0; i < leftNeighbor.length; i++) {
        leftNeighbor[i] = current - leftNeighbor[i];
    }
    let rightNeighbor = targetData.slice(
        dataId + 1,
        (dataId + lookaround) < targetData.length? dataId + lookaround + 1: targetData.length - 1).map(d => d.y);
    for (let i = 0; i < rightNeighbor.length; i++) {
        rightNeighbor[i] = current - rightNeighbor[i];
    }
    let leftMax = d3.max(leftNeighbor);
    let rightMax = d3.max(rightNeighbor);
    if (!leftMax) {
        significance = rightMax;
    } else if (!rightMax) {
        significance = leftMax;
    } else {
        significance = (leftMax + rightMax) / 2;
    }
    return significance;
}

function significanceAveAve(targetId, dataId, lookaround) {
    let significance;
    let targetData = DataStore.getData(targetId).data.splines.value.points;
    let current = targetData[dataId].y;
    let leftNeighbor = targetData.slice(
        (dataId - lookaround) >= 0? dataId - lookaround: 0, 
        dataId).map(d => d.y);
    for (let i = 0; i < leftNeighbor.length; i++) {
        leftNeighbor[i] = current - leftNeighbor[i];
    }
    let rightNeighbor = targetData.slice(
        dataId + 1,
        (dataId + lookaround) < targetData.length? dataId + lookaround + 1: targetData.length - 1).map(d => d.y);
    for (let i = 0; i < rightNeighbor.length; i++) {
        rightNeighbor[i] = current - rightNeighbor[i];
    }
    let leftAve = d3.mean(leftNeighbor);
    let rightAve = d3.mean(rightNeighbor);
    if (!leftAve) {
        significance = rightAve;
    } else if (!rightAve) {
        significance = leftAve;
    } else {
        significance = (leftAve + rightAve) / 2;
    }
    return significance;
}

function significanceAveDist(targetId, dataId, lookaround) {
    let significance;
    let targetData = DataStore.getData(targetId).data.splines.value.points;
    let current = targetData[dataId].y;
    let leftNeighbor = targetData.slice(
        (dataId - lookaround) >= 0? dataId - lookaround: 0, 
        dataId).map(d => d.y);
    let rightNeighbor = targetData.slice(
        dataId + 1,
        (dataId + lookaround) < targetData.length? dataId + lookaround + 1: targetData.length - 1).map(d => d.y);
    let leftDist = current - d3.mean(leftNeighbor);
    let rightDist = current - d3.mean(rightNeighbor);
    if (!leftDist) {
        significance = rightDist;
    } else if (!rightDist) {
        significance = leftDist;
    } else {
        significance = (leftDist + rightDist) / 2;
    }
    return significance;
}

export function extractFlaresManual(targets, threshold) {
    let results = [];
    for (let targetIdx = 0; targetIdx < targets.length; targetIdx++) {
        let targetId = targets[targetIdx];
        let targetData = DataStore.getData(targetId);
        for (let i = 0; i < targetData.data.splines.value.points.length; i++) {
            if (targetData.data.splines.value.points[i].y >= threshold) {
                results.push({
                    id: targetId,
                    start: targetData.data.splines.value.points[i].z,
                    V: targetData.data.splines.value.points[i].y
                });
            }
        }
    }
    return results;
}

export function extractRotations(targets, period, diameter, angle, sigma, stdConst, alphaES) {
    let results = [];
    for (let targetIdx = 0; targetIdx < targets.length; targetIdx++) {
        let targetId = targets[targetIdx];
        let targetData = DataStore.getData(targetId).data.splines.position.points;
        // let targetData = DataStore.getDataArray(targets[targetId], 1);
        let computationResults = [];      
        for (let firstIdx = 0; firstIdx < targetData.length; firstIdx++) {
            let rotationList = [];
            for (let i = period[0]; i <= period[1]; i++) {
                if (targetData[firstIdx].z + i > targetData[targetData.length - 1].z) break;
                let missingFlg = false;
                for (let j = 1; (firstIdx + j < targetData.length) && (targetData[firstIdx + j].z - targetData[firstIdx].z < i); j++) {
                    if (targetData[firstIdx + j].z - targetData[firstIdx + j - 1].z > 5) {
                        missingFlg = true;
                        break;
                    }
                }
                let center = {x: 0, y: 0},
                    average = {x: 0, y: 0};
                let dataByDay = [];
                
                // compute the mean of the time period
                if (sigma === 0) {
                    // arithmetic average
                    for (let j = 0; j <= i; j++) {
                        let currentData = DataStore.getValues(targetId, targetData[firstIdx].z + j - targetData[0].z);
                        dataByDay.push(currentData);
                        center.x += currentData.x;
                        center.y += currentData.y;
                        average.x += currentData.x;
                        average.y += currentData.y;
                    }
                    center.x /= (i + 1);
                    center.y /= (i + 1);
                    average.x /= (i + 1);
                    average.y /= (i + 1);
                } else {
                    // weighted mean
                    let delGauss = 8 / i;
                    let currentGauss = -4;
                    let weightSum = 0;

                    for (let j = 0; j <= i; j++) {
                        let currentData = DataStore.getValues(targetId, targetData[firstIdx].z + j - targetData[0].z);
                        dataByDay.push(currentData);
                        let weightTmp = mathLib.getGaussValue(currentGauss, sigma)
                        center.x += weightTmp * currentData.x;
                        center.y += weightTmp * currentData.y;
                        weightSum += weightTmp;
                        currentGauss += delGauss;
                        average.x += currentData.x;
                        average.y += currentData.y;
                    }
                    center.x /= weightSum;
                    center.y /= weightSum;
                    average.x /= (i + 1);
                    average.y /= (i + 1);
                }

                // convert orthogonal coordinates into polar cordinates
                // and compute standard deviations
                let numeratorStd = {x: 0, y: 0};
                let minVal = {x: dataByDay[0].x, y: dataByDay[0].y},
                    maxVal = {x: dataByDay[0].x, y: dataByDay[0].y};
                let angList = [], degList = [];
                for (let j = 0; j <= i; j++) {
                    let pos = {x: dataByDay[j].x, y: dataByDay[j].y};
                    let angle = calcAngle(pos, center);
                    let degree = calcDegree(pos, center);
                    angList.push({z: dataByDay[j].z, angle: angle});
                    degList.push({z: dataByDay[j].z, degree: degree});

                    // ここが違う！！！！！回転中心じゃなくて平均を引くのよ！！！
                    numeratorStd.x += Math.pow(dataByDay[j].x - average.x, 2.0);
                    numeratorStd.y += Math.pow(dataByDay[j].y - average.y, 2.0);

                    if (dataByDay[j].x < minVal.x) {
                        minVal.x = dataByDay[j].x;
                    }
                    if (maxVal.x < dataByDay[j].x) {
                        maxVal.x = dataByDay[j].x;
                    }
                    if (dataByDay[j].y < minVal.y) {
                        minVal.y = dataByDay[j].y;
                    }
                    if (maxVal.y < dataByDay[j].y) {
                        maxVal.y = dataByDay[j].y;
                    }
                }
                let std = {x: Math.sqrt(numeratorStd.x / (i + 1)), y: Math.sqrt(numeratorStd.y / (i + 1))};

                // check whether the period has larger variation
                if (!missingFlg && ((maxVal.x - minVal.x) > diameter || (maxVal.y - minVal.y) > diameter)) {
                    // std of the whole dataset
                    let stdX = DataStore.getData(targetId).data.meta.std.x,
                        stdY = DataStore.getData(targetId).data.meta.std.y;
                    let flag = false;
                    switch(stdConst) {
                        case 'no':
                            // do nothing
                            flag = true;
                            break;
                        case 'and':
                            if ((stdX < std.x && stdY < std.y)) {
                                flag = true;
                                // continue;
                            }
                            break;
                        case 'or':
                            if ((stdX < std.x || stdY < std.y)) {
                                flag = true;
                                // continue;
                            }
                            break;
                        case 'x':
                            if ((stdX < std.x)) {
                                flag = true;
                                // continue;
                            }
                            break;
                        case 'y':
                            if ((stdY < std.y)) {
                                flag = true;
                                // continue;
                            }
                            break;
                        default:
                            flag = false;
                            break;
                    }
                    
                    if (flag) {
                        let rotationAng = 0,
                            before = angList[0],
                            alpha = alphaES,
                            predAngBef = angList[0].angle;
                        for (let j = 0; j <= i; j++) {
                            // sum up the differences of angle between two data points
                            // use the exponential smoothing to find the tendency of the time series
                            // according to the prediction by the exponential smoothing, 
                            // decide how to compute the difference
                            let divDeg;
                            let predAng = alpha * before.angle + (1 - alpha) * predAngBef;
                            if (Math.abs(angList[j].angle - before.angle) > 180) {
                                if (predAng - predAngBef < 0) {
                                    // clockwise
                                    if (before.angle > angList[j].angle) {
                                        divDeg = -1 * (before.angle - angList[j].angle);
                                    } else {
                                        divDeg = -1 * (before.angle + 360 - angList[j].angle);
                                    }
                                } else {
                                    // counterclockwise
                                    if (before.angle > angList[j].angle) {
                                        divDeg = angList[j].angle + 360 - before.angle;
                                    } else {
                                        divDeg = angList[j].angle - before.angle;
                                    }
                                }
                                // if the current data locates at the first/forth quadrant, reset the exponential smoothing
                                if ((getQuadrantAngle(angList[j].angle) === 1 && getQuadrantAngle(angList[j - 1].angle) === 4)
                                || (getQuadrantAngle(angList[j].angle) === 4 && getQuadrantAngle(angList[j - 1].angle) === 1)) {
                                    predAngBef = angList[j].angle;
                                } //else {
                                //     predAngBef = predAng;
                                // }
                            } else {
                                divDeg = angList[j].angle - before.angle;
                                // predAngBef = predAng;
                            }
                            predAngBef = predAng;
                            rotationAng += divDeg;
                            before = angList[j];
                        }

                        // check whether the total rotation angle is more than the threshold
                        if (Math.abs(rotationAng) > angle) {
                            rotationList.push({
                                id: targetId,
                                start: targetData[firstIdx].z, 
                                angle: Math.abs(rotationAng),
                                period: i,
                                center: center,
                                diameter: {x: maxVal.x - minVal.x, y: maxVal.y - minVal.y},
                                direction: (rotationAng < 0)? 'clockwise': 'counterclockwise'
                            });
                        }
                    }
                }
            }
            // store only the one with the biggest rotation angle
            if (rotationList.length > 0) {
                let maxAng = Math.abs(rotationList[0].angle),
                    maxIdx = 0;
                
                for (let i = 1; i < rotationList.length; i++) {
                    if (maxAng < Math.abs(rotationList[i].angle)) {
                        maxAng = Math.abs(rotationList[i].angle);
                        maxIdx = i;
                    }
                }
                computationResults.push(rotationList[maxIdx]);
            }
        }
        // remove redundancies from computationResults
        if (computationResults.length > 0) {
            let focusedRotationIdx = 0;
            let maxAngIdx = 0,
                maxAng = computationResults[focusedRotationIdx].angle;
            let i = 1;
            while (i < computationResults.length) {
                if ((computationResults[focusedRotationIdx].start <= computationResults[i].start 
                    && computationResults[focusedRotationIdx].start + computationResults[focusedRotationIdx].period <= computationResults[i].start + computationResults[i].period) 
                    || (computationResults[focusedRotationIdx].start <= computationResults[i].start
                    && computationResults[i].start + computationResults[i].period <= computationResults[focusedRotationIdx].start + computationResults[focusedRotationIdx].period)) {
                    let minJD = Math.max(computationResults[focusedRotationIdx].start, computationResults[i].start),
                        maxJD = Math.min(computationResults[focusedRotationIdx].start + computationResults[focusedRotationIdx].period, computationResults[i].start + computationResults[i].period);
                    
                    if (maxJD - minJD > computationResults[focusedRotationIdx].period * 0.5) {
                        // overlapping
                        if (computationResults[i].angle < maxAng) {
                            maxAng = computationResults[i].angle;
                            maxAngIdx = i;
                        } 
                        i++;
                    } else {
                        results.push(computationResults[maxAngIdx]);
                        maxAngIdx = i;
                        focusedRotationIdx = maxAngIdx;
                        maxAng = computationResults[maxAngIdx];
                        i++;
                    }
                }
                // if (computationResults[focusedRotationIdx].start <= computationResults[i].start
                //     && computationResults[i].start <= computationResults[focusedRotationIdx].start + computationResults[focusedRotationIdx].period / 2) {
                //     if (computationResults[i].angle < maxAng) {
                //         maxAng = computationResults[i].angle;
                //         maxAngIdx = i;
                //     }
                //     i++;
                // } else {
                //     results.push(computationResults[maxAngIdx]);
                //     maxAngIdx = i;
                //     focusedRotationIdx = maxAngIdx;
                //     maxAng = computationResults[maxAngIdx];
                //     i++;
                // }
            }
            results.push(computationResults[maxAngIdx]);
        }

        // if (computationResults.length > 0) {
        //     let rotationStart = 0;
        //     for (let i = 1; i < computationResults.length; i++) {
        //         if (computationResults[i].start - computationResults[i - 1].start < period[0]) {
        //             // if the difference between the current rotation angle and the previous one is less than period[1],
        //             // these rotations are considered to be the same rotation and take the one with larger angle
        //             if (computationResults[rotationStart].angle < computationResults[i].angle) {
        //                 rotationStart = i;
        //             }
        //             continue;
        //         } else {
        //             // if the difference is larger than period[1], register to the result array
        //             results.push(computationResults[rotationStart]);
        //             rotationStart = i;
        //         }
        //     }
        //     // add the last one to the result
        //     results.push(computationResults[rotationStart]);
        // }
    }

    return results;
}

function calcAngle(pos, center) {
    let rad = Math.atan2(pos.y - center.y, pos.x - center.x);
    let result;
    if (rad >= 0) {
        result = rad * 180 / Math.PI;
    } else {
        result = (2 * Math.PI + rad) * 180 / Math.PI;
    }
    return result;
}

function calcDegree(pos, center) {
    return Math.sqrt(Math.pow(pos.x - center.x, 2.0) + Math.pow(pos.y - center.y, 2.0));
}

function getQuadrantAngle(angle) {
    let quad;
    if (angle >= 0 && angle < 90) {
        quad = 1;
    } else if (angle >= 90 && angle < 180) {
        quad = 2;
    } else if (angle >= 180 && angle < 270) {
        quad = 3;
    } else {
        quad = 4;
    }
    return quad;
}

export function convertRadToDeg(rad) {
    let deg = 0;
    if (rad >= 0) {
        deg = rad * 180 / Math.PI;
    } else {
        deg = (Math.PI * 2 + rad) * 180 / Math.PI;
    }
    return deg;
}
