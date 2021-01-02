import { cluster } from 'd3';
import {objectSum, objectSub, objectMul, objectDiv, objectAbsSub, objectTotal} from '../lib/mathLib';
import DataStore from '../Stores/DataStore';

export function performClustering(datasets, clusteringParameters, subsequenceParameters, variables) {
    // Overview of subsequence clustering
    // 1: extract all possible subsequences (SS)
    // 2: make all SS isometric + z-normalize SS if needed
    // 3: remove trivial matches (aggregate SS with the same starting point + aggregate SS with high overlappingDegree)
    //      at step 3, we get SS required for clustering finally
    // 4: k-means or k-medoid, and so on

    // k-means with DBA
    // 1: initialize cluster centers to randomly selected SS
    // 2: compute DTW between the cluster center and SS and update the cluster center
    // 3: reassign SS to new clusters
    // 4: update cluster centeres again
    
    // ignore z (=JD) in clustering, but keep z in the objects for references
    variables.push('z');

    let rawData = {}, mins = {}, maxs = {};
    for (let i = 0; i < datasets.length; i++) {
        let rawDataTmp = [];
        for (let j = 0; j < datasets[i].data.spatial.length; j++) {
            let dataTmp = {};
            dataTmp.z = datasets[i].data.spatial[j].z;
            for (let k = 0; k < variables.length; k++) {
                dataTmp[variables[k]] = datasets[i].data.spatial[j][variables[k]];
            }
            rawDataTmp.push(dataTmp);
        }
        rawData[datasets[i].id] = rawDataTmp;
        mins[datasets[i].id] = datasets[i].data.meta.min;
        maxs[datasets[i].id] = datasets[i].data.meta.max;
    }

    let subsequences = {}, subsequenceData = [];
    let isometricData, anomalyDegrees;

    // filtering subsequences according to selected options
    // subsequences by datasets
    if (subsequenceParameters.filtering.indexOf('dataDrivenSlidingWindow') >= 0) {
        let SSRanges = extractRanges(rawData, subsequenceParameters.SSperiod);
        // store indexes of subsequences for initialization
        for (let dataIdx in SSRanges) {
            subsequences[dataIdx] = [];
            for (let i = 0; i < SSRanges[dataIdx].length; i++) {
                subsequences[dataIdx].push(i);
            }
        }

        // make subsequence isometric and compute anomaly degree
        [isometricData, anomalyDegrees] = timeSeriesIsometry(
                rawData, 
                SSRanges, 
                subsequenceParameters.isometryLen, 
                subsequenceParameters.normalize,
                mins,
                maxs
            );

        // pick up a SS with the highest changeDegrees from SS which has the same starting data point
        if (subsequenceParameters.filtering.indexOf('sameStartingPoint') >= 0) {
            for (let dataIdx in SSRanges) {
                let i = 0,
                    filteredSameStartsIdx = [];
                while (i < SSRanges[dataIdx].length) {
                    let startIdx = SSRanges[dataIdx][i][0],
                        maxChangeDegreeIdx = i;
                    i++;
                    while (i < SSRanges[dataIdx].length && SSRanges[dataIdx][i][0] == startIdx) {
                        if (anomalyDegrees[dataIdx][maxChangeDegreeIdx] < anomalyDegrees[dataIdx][i]) {
                            maxChangeDegreeIdx = i;
                            i++;
                            continue;
                        } else if (i + 1 < SSRanges[dataIdx].length && SSRanges[dataIdx][i + 1][0] !== startIdx) {
                            break;
                        } else {
                            i++;
                            continue;
                        }
                    }
                    filteredSameStartsIdx.push(maxChangeDegreeIdx);
                    i++;
                }
                subsequences[dataIdx] = filteredSameStartsIdx;
            }
        }

        // if needed, filter out SS with high overlapping degree
        if (subsequenceParameters.filtering.indexOf('overlappingDegreeFilter') >= 0) {
            if (subsequenceParameters.overlappingTh > 0) {
                for (let dataIdx in SSRanges) {
                    let filteredSS = [];
                    let i = 0;
                    while (i < subsequences[dataIdx].length) {
                        let range1 = SSRanges[dataIdx][subsequences[dataIdx][i]],
                            maxChangeDegreeIdx = subsequences[dataIdx][i];
                        let j = i + 1;
                        while (j < subsequences[dataIdx].length) {
                            let overlap = overlappingDegree(range1, SSRanges[dataIdx][subsequences[dataIdx][j]]);
                            if (overlap < subsequenceParameters.overlappingTh) {
                                break;
                            }
                            if (overlap >= subsequenceParameters.overlappingTh) {
                                if (anomalyDegrees[maxChangeDegreeIdx] < anomalyDegrees[subsequences[dataIdx][j]]) {
                                    maxChangeDegreeIdx = subsequences[dataIdx][j];
                                } else if (anomalyDegrees[maxChangeDegreeIdx] === anomalyDegrees[subsequences[dataIdx][j]]) {
                                    if (SSRanges[dataIdx][subsequences[dataIdx][i]][1] - SSRanges[dataIdx][subsequences[dataIdx][i]][0] < SSRanges[dataIdx][subsequences[dataIdx][j]][1] - SSRanges[dataIdx][subsequences[dataIdx][j]][0]) {
                                        maxChangeDegreeIdx = subsequences[dataIdx][j];
                                    } else {
                                        maxChangeDegreeIdx = subsequences[dataIdx][i];
                                    }
                                }
                            }
                            j++;
                        }
                        filteredSS.push(maxChangeDegreeIdx);
                        i = j;
                    }
                    subsequences[dataIdx] = filteredSS;
                }
            }
        }

        // data collection only for filtered subsequences
        for (let dataIdx in subsequences) {
            for (let i = 0; i < subsequences[dataIdx].length; i++) {
                let dataTmp = isometricData[dataIdx][subsequences[dataIdx][i]];
                dataTmp.id = dataIdx;
                subsequenceData.push(dataTmp);
            }
        }
    } else {
        // extract subsequences by the normal sliding window
        let step = 1;
        for (let i = 0; i < datasets.length; i++) {
            let dataIdx = datasets[i].id;
            let targetData = DataStore.getDataArray(dataIdx, step);
            targetData = convertDataStyle(targetData, variables);
            let SSRanges = extractRangesFromInterpolatedData(targetData, subsequenceParameters.SSperiod);

            // store indexes of subsequences for initialization
            subsequences[dataIdx] = [];
            for (let i = 0; i < SSRanges.length; i++) {
                subsequences[dataIdx].push(i);
            }

            [isometricData, anomalyDegrees] = timeSeriesIsometry(
                targetData, 
                SSRanges, 
                subsequenceParameters.isometryLen, 
                subsequenceParameters.normalize,
                mins[dataIdx],
                maxs[dataIdx]
            );

            // pick up a SS with the highest changeDegrees from SS which has the same starting data point
            if (subsequenceParameters.filtering.indexOf('sameStartingPoint') >= 0) {
                let i = 0,
                    filteredSameStartsIdx = [];
                while (i < SSRanges.length) {
                    let startIdx = SSRanges[i][0],
                        maxChangeDegreeIdx = i;
                    i++;
                    while (i < SSRanges.length && SSRanges[i][0] == startIdx) {
                        if (anomalyDegrees[maxChangeDegreeIdx] < anomalyDegrees[i]) {
                            maxChangeDegreeIdx = i;
                            i++;
                            continue;
                        } else if (i + 1 < SSRanges.length && SSRanges[i + 1][0] !== startIdx) {
                            break;
                        } else {
                            i++;
                            continue;
                        }
                    }
                    filteredSameStartsIdx.push(maxChangeDegreeIdx);
                    i++;
                }
                subsequences[dataIdx] = filteredSameStartsIdx;
            }

            // if needed, filter out SS with high overlapping degree
            if (subsequenceParameters.filtering.indexOf('overlappingDegreeFilter') >= 0) {
                if (subsequenceParameters.overlappingTh > 0) {
                    let filteredSS = [];
                    let i = 0;
                    while (i < subsequences[dataIdx].length) {
                        let range1 = SSRanges[subsequences[dataIdx][i]],
                            maxChangeDegreeIdx = subsequences[dataIdx][i];
                        let j = i + 1;
                        while (j < subsequences[dataIdx].length) {
                            let overlap = overlappingDegree(range1, SSRanges[subsequences[dataIdx][j]]);
                            if (overlap < subsequenceParameters.overlappingTh) {
                                break;
                            }
                            if (overlap >= subsequenceParameters.overlappingTh) {
                                if (anomalyDegrees[maxChangeDegreeIdx] < anomalyDegrees[subsequences[dataIdx][j]]) {
                                    maxChangeDegreeIdx = subsequences[dataIdx][j];
                                } else if (anomalyDegrees[maxChangeDegreeIdx] === anomalyDegrees[subsequences[dataIdx][j]]) {
                                    if (SSRanges[dataIdx][subsequences[dataIdx][i]][1] - SSRanges[dataIdx][subsequences[dataIdx][i]][0] < SSRanges[dataIdx][subsequences[dataIdx][j]][1] - SSRanges[dataIdx][subsequences[dataIdx][j]][0]) {
                                        maxChangeDegreeIdx = subsequences[dataIdx][j];
                                    } else {
                                        maxChangeDegreeIdx = subsequences[dataIdx][i];
                                    }
                                }
                            }
                            j++;
                        }
                        filteredSS.push(maxChangeDegreeIdx);
                        i = j;
                    }
                    subsequences[dataIdx] = filteredSS;
                }
            }
            // data collection only for filtered subsequences
            for (let i = 0; i < subsequences[dataIdx].length; i++) {
                let dataTmp = isometricData[subsequences[dataIdx][i]];
                dataTmp.id = dataIdx;
                subsequenceData.push(dataTmp);
            }
        }
    }

    // perform clustering
    let distanceParameters = {
        window: clusteringParameters.window,
        metric: clusteringParameters.distanceMetric,
        distFunc: EuclideanDist
    }
    let clusterCenters, labels;
    switch (clusteringParameters.method) {
        case 'kmedoids':
            [clusterCenters, labels] = kMedoids(subsequenceData, clusteringParameters.clusterNum, distanceParameters, variables);
            break;
        case 'kmeans':
            [clusterCenters, labels] = kMeans(subsequenceData, clusteringParameters.clusterNum, distanceParameters, variables);
            break;
        default:
            break;
    }
    return [subsequenceData, clusterCenters, labels];
}

function extractRanges(datasets, SSperiod) {
    let ranges = {};
    for (let dataId in datasets) {
        let rangeData = [];
        for (let i = 0; i < datasets[dataId].length; i++) {
            for (let j = i; j < datasets[dataId].length; j++) {
                let rangeTmp = datasets[dataId][j].z - datasets[dataId][i].z;
                if (rangeTmp > SSperiod[1])
                    break;
                if (SSperiod[0] <= rangeTmp && rangeTmp <= SSperiod[1])
                    rangeData.push([i, j])
            }
        }
        ranges[dataId] = rangeData;
    }
    return ranges;
}

function extractRangesFromInterpolatedData(data, SSperiod) {
    let ranges = [];
    for (let i = 0; i < data.length; i++) {
        for (let j = i; j < data.length; j++) {
            let rangeTmp = data[j].z - data[i].z;
            if (rangeTmp > SSperiod[1])
                break;
            if (SSperiod[0] <= rangeTmp && rangeTmp <= SSperiod[1])
                ranges.push([i, j]);
        }
    }
    return ranges;
}

function convertDataStyle(data, variables) {
    let dataNew = [];
    for (let i = 0; i < data.z.length; i++) {
        let dataTmp = {};
        variables.forEach(ele => {
            dataTmp[ele] = data[ele][i];
        });
        dataNew.push(dataTmp);
    }
    return dataNew;
}

export function timeSeriesIsometry(data, ranges, isometryLen = 50, normalize = true, min, max) {
    if (Array.isArray(data)) {
        let isometricSS = [], changeDegrees = [];
        for (let i = 0; i < ranges.length; i++) {
            let delta = (data[ranges[i][1]].z - data[ranges[i][0]].z) / isometryLen;
            let SStmp = [];
            for (let j = 0; j <= isometryLen; j++) {
                // get n (n = isometryLen) coordinates between the currently focused range
                let timestampTmp = j * delta + data[ranges[i][0]].z;
                let dataTmp;
                for (let k = ranges[i][0]; k <= ranges[i][1]; k++) {
                    // find data points around z=timestampTmp
                    if (data[k].z === timestampTmp) {
                        dataTmp = data[k];
                        break;
                    } else if (data[k].z < timestampTmp && timestampTmp < data[k + 1].z) {
                        let zpos = (timestampTmp - data[k].z) / (data[k + 1].z - data[k].z);
                        if (k === 0) {
                            // if the data point just before the current data point is the first data point in the dataset
                            let interpData = objectSub(data[k], objectSub(data[k + 1], data[k]));
                            dataTmp = catmullromPointMd(zpos, interpData, data[k], data[k + 1], data[k + 2]);
                            dataTmp.z = timestampTmp;
                        } else if (k == data.length - 2) {
                            // if the data point just after the current data point is the second last data point in the dataset
                            let interpData = objectSum(data[k + 1], objectSub(data[k + 1], data[k]));
                            dataTmp = catmullromPointMd(zpos, data[k - 1], data[k], data[k + 1], interpData);
                            dataTmp.z = timestampTmp;
                        } else {
                            // there are at least two data points before and after the current data point
                            dataTmp = catmullromPointMd(zpos, data[k - 1], data[k], data[k + 1], data[k + 2]);
                            dataTmp.z = timestampTmp;
                        }
                        break;
                    }
                }
                SStmp.push(dataTmp);
            }
            // compute change degrees
            changeDegrees.push(anomalyDegree(SStmp, min, max));
            // normalize SS here if needed
            if (normalize) {
                SStmp = zNormalization(SStmp, ['z']);
            }
            isometricSS.push(SStmp);
        }
        return [isometricSS, changeDegrees];
    } else {
        let isometricSS = {}, changeDegrees = {};
        for (let dataIdx in data) {
            let isometricSSTmp = [], changeDegreesTmp = [];
            for (let i = 0; i < ranges[dataIdx].length; i++) {
                let delta = (data[dataIdx][ranges[dataIdx][i][1]].z - data[dataIdx][ranges[dataIdx][i][0]].z) / isometryLen;
                let SStmp = [];
                for (let j = 0; j <= isometryLen; j++) {
                    // get n (n = isometryLen) coordinates between the currently focused range
                    let timestampTmp = j * delta + data[dataIdx][ranges[dataIdx][i][0]].z;
                    let dataTmp;
                    for (let k = ranges[dataIdx][i][0]; k <= ranges[dataIdx][i][1]; k++) {
                        // find data points around z=timestampTmp
                        if (data[dataIdx][k].z === timestampTmp) {
                            dataTmp = data[dataIdx][k];
                            break;
                        } else if (data[dataIdx][k].z < timestampTmp && timestampTmp < data[dataIdx][k + 1].z) {
                            let zpos = (timestampTmp - data[dataIdx][k].z) / (data[dataIdx][k + 1].z - data[dataIdx][k].z);
                            if (k === 0) {
                                // if the data point just before the current data point is the first data point in the dataset
                                let interpData = objectSub(data[dataIdx][k], objectSub(data[dataIdx][k + 1], data[dataIdx][k]));
                                dataTmp = catmullromPointMd(zpos, interpData, data[dataIdx][k], data[dataIdx][k + 1], data[dataIdx][k + 2]);
                                dataTmp.z = timestampTmp;
                            } else if (k == data[dataIdx].length - 2) {
                                // if the data point just after the current data point is the second last data point in the dataset
                                let interpData = objectSum(data[dataIdx][k + 1], objectSub(data[dataIdx][k + 1], data[dataIdx][k]));
                                dataTmp = catmullromPointMd(zpos, data[dataIdx][k - 1], data[dataIdx][k], data[dataIdx][k + 1], interpData);
                                dataTmp.z = timestampTmp;
                            } else {
                                // there are at least two data points before and after the current data point
                                dataTmp = catmullromPointMd(zpos, data[dataIdx][k - 1], data[dataIdx][k], data[dataIdx][k + 1], data[dataIdx][k + 2]);
                                dataTmp.z = timestampTmp;
                            }
                            break;
                        }
                    }
                    SStmp.push(dataTmp);
                }
                // compute change degrees
                changeDegreesTmp.push(anomalyDegree(SStmp, min[dataIdx], max[dataIdx]));
                // normalize SS here if needed
                if (normalize) {
                    SStmp = zNormalization(SStmp, ['z']);
                }
                isometricSSTmp.push(SStmp);
            }
            isometricSS[dataIdx] = isometricSSTmp;
            changeDegrees[dataIdx] = changeDegreesTmp;
        }
        return [isometricSS, changeDegrees];
    }
}

function catmullromPointMd (x, v0, v1, v2, v3) {
    // x: the x-coord, for which the y-coord is needed
    // v0: 1st support point
    // v1: 2nd support point
    // v2: 3rd support point
    // v3: 4th support point
    let c1 = v1,
        c2 = objectSum(objectMul(-0.5, v0), objectMul(0.5, v2)),
        c3 = objectSub(objectSum(objectSub(v0, objectMul(2.5, v1)), objectMul(2, v2)), objectMul(0.5, v3)),
        c4 = objectSum(objectSub(objectSum(objectMul(-0.5, v0), objectMul(1.5, v1)), objectMul(1.5, v2)), objectMul(0.5, v3))

    return objectSum(objectMul(objectSum(objectMul(objectSum(objectMul(c4, x), c3), x), c2), x), c1);
}

function catmullromPoint(x, v0, v1, v2, v3) {
    // x: the x-coord, for which the y-coord is needed
    // v0: 1st support point
    // v1: 2nd support point
    // v2: 3rd support point
    // v3: 4th support point
    let c1 = v1,
        c2 = -0.5 * v0 + 0.5 * v2,
        c3 = v0 -2.5 * v1 + 2 * v2 - 0.5 * v3,
        c4 = -0.5 * v0 + 1.5 * v1 - 1.5 * v2 + 0.5 * v3;
    return ((c4 * x + c3) * x + c2) * x + c1;
}

function zNormalization(data, ignored = undefined) {
    let normalized = [];
    // compute the mean and standard deviation of the time interval
    let means = {}, stds = {};
    for (let key in data[0]) {
        if (typeof(ignored) === "undefined" || ignored.indexOf(key) < 0) {
            means[key] = 0;
            stds[key] = 0;
        }
    }
    for (let i = 0; i < data.length; i++) {
        for (let key in data[i]) {
            if (typeof(ignored) === "undefined" || ignored.indexOf(key) < 0) {
                means[key] += data[i][key];
            }
        }
    }
    for (let key in means) {
        means[key] /= data.length;
    }
    for (let i = 0; i < data.length; i++) {
        for (let key in data[i]) {
            if (typeof(ignored) === "undefined" || ignored.indexOf(key) < 0) {
                stds[key] += Math.pow((data[i][key] - means[key]), 2);
            }
        }
    }
    for (let key in stds) {
        stds[key] = Math.sqrt(stds[key] / data.length);
    }

    // z-normalize data points
    for (let i = 0; i < data.length; i++) {
        let normalizedTmp = {};
        for (let key in data[i]) {
            if (typeof(ignored) === "undefined" || ignored.indexOf(key) < 0) {
                normalizedTmp[key] = (data[i][key] - means[key]) / stds[key];
            }
            if (typeof(ignored) !== "undefined" && ignored.indexOf(key) >= 0) {
                normalizedTmp[key] = data[i][key];
            }
        }
        normalized.push(normalizedTmp);
    }
    return normalized;
}

function anomalyDegree(data, min, max) {
    let ranges = objectSub(max, min);
    let change = {};
    for (let key in data[0]) {
        change[key] = 0;
    }
    for (let i = 0; i < data.length - 1; i++) {
        let data1 = objectDiv(objectSub(data[i], min), ranges),
            data2 = objectDiv(objectSub(data[i + 1], min), ranges);
        change = objectSum(change, objectAbsSub(data2, data1));
    }
    return objectTotal(change, ['z']) / data.length;
}

function overlappingDegree(data1, data2) {
    // data1: []
    // data2: {}
    let degree = 0;
    if (data1[0] <= data2[0] && data2[0] <= data1[1]) {
        // [{]} or [{}]
        if (data2[1] <= data1[1]) {
            // [{}]
            degree = (data2[1] - data2[0] + 1) / Math.max(data1[1] - data1[0] + 1, data2[1] - data2[0] + 1) * 100;
        } else {
            // [{]}
            degree = (data1[1] - data2[0] + 1) / Math.max(data1[1] - data1[0] + 1, data2[1] - data2[0] + 1) * 100;
        }
    } else if (data2[0] <= data1[0] && data1[0] <= data2[1]) {
        // {[}] or {[]}
        if (data1[1] <= data2[1]) {
            // {[]}
            degree = (data1[1] - data1[0] + 1) / Math.max(data1[1] - data1[0] + 1, data2[1] - data2[0] + 1) * 100;
        } else {
            // {[}]
            degree = (data2[1] - data1[0] + 1) / Math.max(data1[1] - data1[0] + 1, data2[1] - data2[0] + 1) * 100;
        }
    }
    return degree;
}

function distanceMatrix(data, distanceParameters, variables) {
    let distMatrix = [];
    // initialize distance matrix
    switch (distanceParameters.metric) {
        case 'DTWD':
            if (distanceParameters.window > 0) {
                // DTWMD
                for (let i = 0; i < data.length - 1; i++) {
                    let distTmp = [];
                    for (let j = i + 1; j < data.length; j++) {
                        let dist = DTWMD(data[i], data[j], variables, distanceParameters.window, distanceParameters.distFunc);
                        distTmp.push(dist[dist.length - 1][dist[0].length - 1]);
                    }
                    distMatrix.push(distTmp);
                }
            } else {
                // DTWSimpleMD
                for (let i = 0; i < data.length - 1; i++) {
                    let distTmp = [];
                    for (let j = i + 1; j < data.length; j++) {
                        let dist = DTWSimpleMD(data[i], data[j], variables, distanceParameters.distFunc);
                        distTmp.push(dist[dist.length - 1][dist[0].length - 1]);
                    }
                    distMatrix.push(distTmp);
                }
            }
            break;
        case 'DTWI':
            if (distanceParameters.window > 0) {
                // DTW
                for (let i = 0; i < data.length - 1; i++) {
                    let distTmp = [];
                    for (let j = i + 1; j < data.length; j++) {
                        let distSum = 0;
                        let dists = DTW(data[i], data[j], variables, distanceParameters.window, disranceParameter.distFunc);
                        variables.forEach(key => {
                            distSum += dists[key][dists[key].length - 1][dists[key][0].length - 1];
                        });
                        distTmp.push(distSum);
                    }
                    distMatrix.push(distTmp);
                }
            } else {
                // DTWSimple
                for (let i = 0; i < data.length - 1; i++) {
                    let distTmp = [];
                    for (let j = i + 1; j < data.length; j++) {
                        let distSum = 0;
                        let dists = DTWSimple(data[i], data[j], variables, distanceParameters.distFunc);
                        variables.forEach(key => {
                            distSum += dists[key][dists[key].length - 1][dists[key][0].length - 1];
                        });
                        distTmp.push(distSum);
                    }
                    distMatrix.push(distTmp);
                }
            }
            break;
        case 'DTW':
            if (distanceParameters.window > 0) {
                // DTW
                for (let i = 0; i < data.length - 1; i++) {
                    let distList = [];
                    for (let j = i + 1; j < data.length; j++) {
                        let distTmp = {};
                        let dists = DTW(data[i], data[j], variables, distanceParameters.window, disranceParameter.distFunc);
                        variables.forEach(key => {
                            distTmp[key] = dists[key][dists[key].length - 1][dists[key][0].length - 1];
                        });
                        distList.push(distTmp);
                    }
                    distMatrix.push(distList);
                }
            } else {
                // DTWSimple
                for (let i = 0; i < data.length - 1; i++) {
                    let distList = [];
                    for (let j = i + 1; j < data.length; j++) {
                        let distTmp = {};
                        let dists = DTWSimple(data[i], data[j], variables, distanceParameters.distFunc);
                        variables.forEach(key => {
                            distTmp[key] = dists[key][dists[key].length - 1][dists[key][0].length - 1];
                        });
                        distList.push(distTmp);
                    }
                    distMatrix.push(distList);
                }
            }
            break;
        case 'Euclidean':
            break;
        default:
            break;
    }
    return distMatrix;
}

function kMedoids(data, clusterNum, distanceParameters, variables) {
    // step 1: compute distance matrix between SS
    // step 2: pick up k medoids from all SS
    // step 3: assign other SS to medoids
    // step 4: re-find medoids which minimize the total distances
    // step 5: repeat steps 3 and 4

    // step 1
    // note: when comparing SSi and SSj (i < j), refer distMatrix[i][j - i - 1]
    let variableList = variables.filter(ele => ele !== 'z');
    let distMatrix = distanceMatrix(data, distanceParameters, variableList);
    // step 2
    // find the inital medoids which make the errors inside the clusters minimum
    let init_search = 100;
    let score = Infinity, medoids, labels;
    let bestMedoids, bestLabels, bestDist = Infinity;

    for (let i = 0; i < init_search; i++) {
        // step 3
        [medoids, score, labels] = initMedoids(variableList);
        // if (scoreTmp < score) {
        //     score = scoreTmp;
        //     medoids = medoidsTmp;
        //     labels = labelsTmp;
        // }
        // step 3 and 4
        let newMedoids = [], newLabels = [], distSum = [];
        let loop = 0, maxIteration = 300;
        while (!checkMedoidsUpdates(medoids, newMedoids, variableList) && loop < maxIteration) {//(medoids.filter(i => newMedoids.indexOf(i) == -1).length > 0 && loop < maxIteration) {
            // update medoids until there are no medoid updates or repeat updating medoids maxIteration times
            if (newMedoids.length !== 0 && newLabels.length !== 0) {
                medoids = newMedoids;
                labels = newLabels;
            }
            // step 3
            [newMedoids, distSum] = updateMedoids(labels, variableList);
            // step 4
            newLabels = assignSSToMedoids(newMedoids, variableList);
            loop++;
        }
        let distSumTmp = 0;
        for (let i = 0; i < distSum.length; i++) {
            for (let key in distSum[i]) {
                distSumTmp += distSum[i][key];
            }
        }
        if (distSumTmp < bestDist) {
            bestDist = distSumTmp;
            bestMedoids = newMedoids;
            bestLabels = newLabels;
        }
    }
    console.log(bestDist);
    medoids = bestMedoids;
    labels = bestLabels;
    // for (let i = 0; i < init_search; i++) {
    //     // step 3
    //     let [medoidsTmp, scoreTmp, labelsTmp] = initMedoids(variableList);
    //     if (scoreTmp < score) {
    //         score = scoreTmp;
    //         medoids = medoidsTmp;
    //         labels = labelsTmp;
    //     }
    // }
    // // step 3 and 4
    // let newMedoids = [], newLabels = [];
    // let loop = 0, maxIteration = 300;
    // while (!checkMedoidsUpdates(medoids, newMedoids, variableList) && loop < maxIteration) {//(medoids.filter(i => newMedoids.indexOf(i) == -1).length > 0 && loop < maxIteration) {
    //     // update medoids until there are no medoid updates or repeat updating medoids maxIteration times
    //     if (newMedoids.length !== 0 && newLabels.length !== 0) {
    //         medoids = newMedoids;
    //         labels = newLabels;
    //     }
    //     // step 3
    //     newMedoids = updateMedoids(labels, variableList);
    //     // step 4
    //     newLabels = assignSSToMedoids(newMedoids, variableList);
    //     loop++;
    // }
    // medoids = newMedoids;
    // labels = newLabels;
    let medoidData = [];
    for (let i = 0; i < medoids.length; i++) {
        let dataTmp = [];
        for (let i = 0; i < data[0].length; i++) {
            dataTmp.push({});
        }
        for (let key in medoids[i]) {
            for (let j = 0; j < data[medoids[i][key]].length; j++) {
                dataTmp[j][key] = data[medoids[i][key]][j][key];
            }
        }
        medoidData.push(dataTmp);
    }
    return [medoidData, labels];

    function initMedoids(activeVariables) {
        // randomly pick up k SS from the dataset
        let medoids = [];
        while (medoids.length < clusterNum) {
            let medoidTmp = {};
            activeVariables.forEach((key) => {
                let medoid;
                while (typeof(medoid) === 'undefined') {
                    medoid = Math.floor(Math.random() * Math.floor(data.length));
                    for (let i = 0; i < medoids.length; i++) {
                        if (medoids[i][key] === medoid) {
                            medoid = undefined;
                            break;
                        }
                    }
                }
                medoidTmp[key] = medoid;
            });
            medoids.push(medoidTmp);
        }
        let labels = assignSSToMedoids(medoids, activeVariables);
        let score = evalInit(medoids, labels, activeVariables);
        return [medoids, score, labels];
    }
    function checkMedoidsUpdates (pMedoids, nMedoids, activeVariables) {
        let update = true;
        if (pMedoids.length !== nMedoids.length) {
            update = false;
        } else {
            for (let i = 0; i < nMedoids.length; i++) {
                let sameMedoidFlag = false;
                for (let j = 0; j < pMedoids.length; j++) {
                    let updateTmp = true;
                    for (let key of activeVariables) {
                        if (nMedoids[i][key] !== pMedoids[j][key]) {
                            updateTmp = false;
                            break;
                        }
                    }; 
                    if (updateTmp) {
                        sameMedoidFlag = true;
                        break;
                    }
                }
                if (!sameMedoidFlag) {
                    update = false;
                    break;
                }
            }
        }
        // 一つでも更新があればupdateはfalseになる
        return update;
    }
    function evalInit(medoids, labels, activeVariables) {
        // compute errors between a medoid and SS
        let errorSum = 0;
        for (let i = 0; i < labels.length; i++) {
            activeVariables.forEach(key => {
                if (i < medoids[labels[i]][key]) {
                    errorSum += distMatrix[i][medoids[labels[i]][key] - i - 1][key];
                } else if (medoids[labels[i]][key] < i) {
                    errorSum += distMatrix[medoids[labels[i]][key]][i - medoids[labels[i]][key] - 1][key];
                }  
            });
        }
        return errorSum;
    }
    function assignSSToMedoids(medoids, activeVariables) {
        let labels = [];
        for (let i = 0; i < data.length; i++) {
            let NNMedoid = 0,
                NNDist = Infinity;
            // for (let key of activeVariables) {
            //     if (medoids[0][key] === 0) {
            //         continue;
            //     } else {
            //         NNDist += distMatrix[0][medoids[0][key] - 1][key];
            //     }
            // };
            for (let j = 0; j < medoids.length; j++) {
                let distTmp = 0;
                activeVariables.forEach(key => {
                    if (i < medoids[j][key]) {
                        distTmp += distMatrix[i][medoids[j][key] - i - 1][key];
                    } else if (medoids[j][key] < i) {
                        distTmp += distMatrix[medoids[j][key]][i - medoids[j][key] - 1][key];
                    } else {
                        distTmp += 0;
                    }
                });
                if (distTmp < NNDist) {
                    NNMedoid = j;
                    NNDist = distTmp;
                }
            }
            labels.push(NNMedoid);
            // if data[i] is a medoid
            // let medoidCheck = medoids.indexOf(i);
            // if (medoidCheck >= 0) {
            //     labels.push(medoidCheck);
            //     continue;
            // }
            // let NNMedoid = 0,
            //     NNDist = distMatrix[Math.min(i, NNMedoid)][Math.max(i, NNMedoid) - Math.min(i, NNMedoid) - 1];
            // for (let j = 1; j < medoids.length; j++) {
            //     // compare data[i] and medoid[j] (=data[medoids[j]])
            //     if (i < medoids[j]) {
            //         if (distMatrix[i][medoids[j] - i - 1] < NNDist) {
            //             NNMedoid = j;
            //             NNDist = distMatrix[i][medoids[j] - i - 1];
            //         }
            //     } else if (medoids[j] < i) {
            //         if (distMatrix[medoids[j]][i - medoids[j] - 1] < NNDist) {
            //             NNMedoid = j;
            //             NNDist = distMatrix[medoids[j]][i - medoids[j] - 1];
            //         }
            //     }
            // }
            // labels.push(NNMedoid);
        }
        return labels;
    }
    function updateMedoids(labels, activeVariables) {
        // divide SS by clusters
        let clusters = [];
        for (let i = 0; i < clusterNum; i++) {
            clusters.push([]);
        }
        for (let i = 0; i < labels.length; i++) {
            clusters[labels[i]].push(i);
        }
        let newMedoids = [];
        let distSumFinal = [];
        for (let i = 0; i < clusterNum; i++) {
            let newMedoidTmp = {},
                minDistSum = {};
            activeVariables.forEach((key) => {
                newMedoidTmp[key] = 0;
                minDistSum[key] = Infinity;
            });
            // 変数毎にクラスタ内の距離合計を最小にする代表値を選ぶ
            for (let j = 0; j < clusters[i].length; j++) {
                // 各変数についてclusters[i][j]をmedoidにした場合
                let distSumTmp = {};
                for (let key in minDistSum) {
                    distSumTmp[key] = 0;
                }
                for (let k = 0; k < clusters[i].length; k++) {
                    let overCounter = 0;
                    if (clusters[i][j] === clusters[i][k]) {
                        continue;
                    } else if (clusters[i][j] < clusters[i][k]) {
                        for (let key in minDistSum) {
                            distSumTmp[key] += distMatrix[clusters[i][j]][clusters[i][k] - clusters[i][j] - 1][key];
                            if (minDistSum[key] < distSumTmp[key]) {
                                overCounter++;
                            }
                        }
                    } else if (clusters[i][k] < clusters[i][j]) {
                        for (let key in minDistSum) {
                            distSumTmp[key] += distMatrix[clusters[i][k]][clusters[i][j] - clusters[i][k] - 1][key];
                            if (minDistSum[key] < distSumTmp[key]) {
                                overCounter++;
                            }
                        }
                    }
                    if (overCounter === Object.keys(minDistSum)) {
                        break;
                    }
                }
                // 各変数について最小値だったらmedoidを更新
                for (let key in minDistSum) {
                    if (distSumTmp[key] < minDistSum[key]) {
                        minDistSum[key] = distSumTmp[key];
                        newMedoidTmp[key] = clusters[i][j];
                    }
                }
            }
            newMedoids.push(newMedoidTmp);
            distSumFinal.push(minDistSum);
        }
        // for (let i = 0; i < clusterNum; i++) {
        //     // find the best medoid from each cluster
        //     let newMedoidTmp = 0,
        //         minDistSum = Infinity;
        //     for (let j = 0; j < clusters[i].length; j++) {
        //         // if the medoid of the cluster is clusters[i], how much the total distance between the medoid and other SS
        //         let distSumTmp = 0;
        //         for (let k = 0; k < clusters[i].length; k++) {
        //             if (clusters[i][j] === clusters[i][k]) {
        //                 continue;
        //             } else if (clusters[i][j] < clusters[i][k]) {
        //                 distSumTmp += distMatrix[clusters[i][j]][clusters[i][k] - clusters[i][j] - 1];
        //             } else if (clusters[k] > clusters[j]) {
        //                 distSumTmp += distMatrix[clusters[i][k]][clusters[i][j] - clusters[i][k] - 1];
        //             }
        //             if (minDistSum < distSumTmp)
        //                 break;
        //         }
        //         if (distSumTmp < minDistSum) {
        //             newMedoidTmp = clusters[i][j];
        //             minDistSum = distSumTmp;
        //         }
        //     }
        //     newMedoids.push(newMedoidTmp);
        // }
        return [newMedoids, distSumFinal];
    }
}

function kMeans(data, clusterNum, distanceParameters, variables) {
    // step 1: randomly assign SS to k clusters
    // step 2: compute barycenters (centroids) of the clusters
    // step 3: re-assign SS to the nearest cluster
    // step 4: repeat steps 2 and 3 if there are any changes the nodes in the cluster
    let variableList = variables.filter(ele => ele !== 'z');
    let dataLen = data[0].length;

    // step 1 and 2
    let centroids = createCentroids();
    let labels = assignSSToCentroids(centroids);

    // step 3 and 4
    let newCentroids = [], newLabels = [];
    let loop = 0, maxIteration = 300;
    while (loop < maxIteration && checkUpdates(labels, newLabels)) {
        if (newCentroids.length !== 0 && newLabels.length !== 0) {
            centroids = newCentroids;
            labels = newLabels;
        }
        newCentroids = updateCentroids(labels, dataLen);
        newLabels = assignSSToCentroids(newCentroids);
        loop++;
    }
    centroids = newCentroids;
    labels = newLabels;
    return [centroids, labels];

    function createCentroids() {
        // choose k SS from the dataset as a initial centroid of the clusters
        let initCentroidsIdx = [],
            initCentroids = [];
        while (initCentroidsIdx.length < clusterNum) {
            let centroidTmp = Math.floor(Math.random() * Math.floor(data.length));
            if (initCentroidsIdx.indexOf(centroidTmp) < 0)
                initCentroidsIdx.push(centroidTmp);
        }
        for (let i = 0; i < initCentroidsIdx.length; i++) {
            initCentroids.push(data[initCentroidsIdx[i]]);
        }
        return initCentroids;
    }
    function assignSSToCentroids(centroids) {
        let labels = [];
        for (let i = 0; i < data.length; i++) {
            let NNDist = Infinity,
                NNDistPath,
                NNCentroid;
            for (let j = 0; j < centroids.length; j++) {
                // compute distances between centroids and SS
                let distTmp = 0;
                switch (distanceParameters.metric) {
                    case 'Euclidean':
                        break;
                    case 'DTWD':
                        if (distanceParameters.window > 0) {
                            // DTWMD
                            distTmp = DTWMD(centroids[j], data[i], variableList, distanceParameters.window, distanceParameters.distFunc);
                            if (distTmp[distTmp.length - 1][distTmp[0].length - 1] < NNDist) {
                                NNDist = distTmp[distTmp.length - 1][distTmp[0].length - 1];
                                NNCentroid = j;
                                NNDistPath = OptimalWarpingPath(distTmp);
                            }
                        } else {
                            // DTWSimpleMD
                            distTmp = DTWSimpleMD(centroids[j], data[i], variableList, distanceParameters.distFunc);
                            if (distTmp[distTmp.length - 1][distTmp[0].length - 1] < NNDist) {
                                NNDist = distTmp[distTmp.length - 1][distTmp[0].length - 1];
                                NNCentroid = j;
                                NNDistPath = OptimalWarpingPath(distTmp);
                            }
                        }
                        break;
                    case 'DTWI':
                        if (distanceParameters.window > 0) {
                            // DTW
                            distTmp = DTW(centroids[j], data[i], variableList, distanceParameters.window, distanceParameters.distFunc);
                            let distSum = 0;
                            variables.forEach(key => {
                                distSum += distTmp[key][distTmp[key].length - 1][distTmp[key][0].length - 1];
                            });
                            if (distSum < NNDist) {
                                NNDist = distSum;
                                NNCentroid = j;
                                NNDistPath = OptimalWarpingPath(distTmp);
                            }
                        } else {
                            // DTWSimple
                            distTmp = DTWSimple(centroids[j], data[i], variableList, distanceParameters.distFunc);
                            let distSum = 0;
                            variables.forEach(key => {
                                distSum += distTmp[key][distTmp[key].length - 1][distTmp[key][0].length - 1];
                            });
                            if (distSum < NNDist) {
                                NNDist = distSum;
                                NNCentroid = j;
                                NNDistPath = OptimalWarpingPath(distTmp);
                            }
                        }
                        break;
                    default:
                        break;
                }
            }
            labels.push({
                cluster: NNCentroid,
                path: NNDistPath
            });
        }
        return labels;
    }
    function updateCentroids(labels, dataLen) {
        // divide SS into clusters according to labels
        let clusters = []; // store indexes of data samples belonging to each cluster
        for (let i = 0; i < clusterNum; i++) {
            clusters.push([]);
        }
        for (let i = 0; i < labels.length; i++) {
            clusters[labels[i].cluster].push(i);
        }
        
        let newCentroids = [];
        switch(distanceParameters.metric) {
            case 'Euclidean':
                break;
            case 'DTWD':
                // compute new centroids according to SS in the cluster and the path between the current centroid and SS
                for (let i = 0; i < clusters.length; i++) {
                    // create a new arrray for storing new centroid
                    let centroidTmp = [],
                        dataCount = [];
                    // new centroid will be a barycenter of data values of data samples in the cluster
                    for (let j = 0; j < dataLen; j++) {
                        let dataTmp = {};
                        variableList.forEach(key => {
                            dataTmp[key] = 0;
                        });
                        centroidTmp.push(dataTmp);
                        dataCount.push(0);
                    }

                    // add data values of data in the cluster to get barycenter
                    for (let j = 0; j < clusters[i].length; j++) {
                        // focus on a data[clusters[i][j]] (data[clusters[i][j]] has 31 data points)
                        // check the path between the current centroid and data[clusters[i][j]] (labels[clusters[i][j]].path)
                        for (let k = 0; k < labels[clusters[i][j]].path.length; k++) {
                            variableList.forEach(key => {
                                centroidTmp[labels[clusters[i][j]].path[k][0]][key] += data[clusters[i][j]][labels[clusters[i][j]].path[k][1]][key];
                            });
                            dataCount[labels[clusters[i][j]].path[k][0]]++;
                        }
                    }
                    // compute barycenters of each variables
                    for (let j = 0; j < centroidTmp.length; j++) {
                        variableList.forEach(key => {
                            centroidTmp[j][key] /= dataCount[j];
                        });
                    }
                    newCentroids.push(centroidTmp);
                }
                break;
            case 'DTWI':
                // compute new centroids according to SS in the cluster amd the path between the current centroid and SS
                for (let i = 0; i < clusters.length; i++) {
                    // create a new array for storing new centroid
                    let centroidTmp = [],
                        dataCount = [];
                    // new centroid will be a barycenter of data values of data samples in the cluster
                    for (let j = 0; j < dataLen; j++) {
                        let dataTmp = {},
                            countTmp = {};
                        variableList.forEach(key => {
                            dataTmp[key] = 0;
                            countTmp[key] = 0;
                        });
                        centroidTmp.push(dataTmp);
                        dataCount.push(countTmp);
                    }

                    // add data values of data in the cluster to get barycenter
                    for (let j = 0; j < clusters[i].length; j++) {
                        // focus on a data[clusters[i][j]] (data[clusters[i][j]] has 31 data points)
                        // check the path between the current centroid and data[clusters[i][j]] (labels[clusters[i][j]].path)
                        variableList.forEach(key => {
                            for (let k = 0; k < labels[clusters[i][j]].path[key].length; k++) {
                                centroidTmp[labels[clusters[i][j]].path[key][k][0]][key] += data[clusters[i][j]][labels[clusters[i][j]].path[key][k][1]][key];
                                dataCount[labels[clusters[i][j]].path[key][k][0]][key]++;
                            }
                        });
                    }
                    // compute barycenters of each variables
                    for (let j = 0; j < centroidTmp.length; j++) {
                        variableList.forEach(key => {
                            centroidTmp[j][key] /= dataCount[j][key];
                        });
                    }
                    newCentroids.push(centroidTmp);
                }
                break;
            default:
                break;
        }
        return newCentroids;
    }
    function checkUpdates(pLabels, nLabels) {
        let flag = false;
        if (pLabels.length === 0 || nLabels.length === 0) {
            return true;
        }
        for (let i = 0; i < pLabels.length; i++) {
            if (pLabels[i].cluster !== nLabels[i].cluster) {
                flag = true;
                break;
            }
        }
        return flag;
    }
}

function DTWSimple(s, t, variables, distFunc) {
    let dists = {};
    variables.forEach(key => {
        let dist = [];
        for (let i = 0; i <= s.length; i++) {
            dist[i] = [];
            for (let j = 0; j <= t.length; j++) {
                dist[i][j] = Infinity;
            }
        }
        dist[0][0] = 0;
        dists[key] = dist;
    });
    // distances between two data points are stored in dist[1~s.length][1~t.length]
    for (let i = 1; i <= s.length; i++) {
        for (let j = 1; j <= t.length; j++) {
            variables.forEach(key => {
                dists[key][i][j] = distFunc(s[i - 1][key], t[j - 1][key]) 
                + Math.min(
                    dists[key][i - 1][j], 
                    dists[key][i][j - 1], 
                    dists[key][i - 1][j - 1]
                );
            });
        }
    }

    // remove infinity row and column
    let result = {};
    variables.forEach(key => {
        result[key] = [];
        for (let i = 1; i < dists[key].length; i++) {
            result[key].push(dists[key][i].slice(1, dists[key][i].length));
        }
    });
    
    return result;
}

function DTWSimpleMD(s, t, variables, distFunc) {
    // s and t are object
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
            dist[i][j] = distFunc(s[i - 1], t[j - 1], variables) 
                + Math.min(
                    dist[i - 1][j], 
                    dist[i][j - 1], 
                    dist[i - 1][j - 1]
                );
        }
    }

    // remove infinity row and column
    let result = []
    for (let i = 1; i < dist.length; i++) {
        result.push(dist[i].slice(1, dist[i].length));
    }

    return result;
}

function DTW(s, t, variables, w, distFunc) {
    let dists = {};
    w = Math.max(w, Math.abs(s.length - t.length));
    variables.forEach(key => {
        let dist = [];
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
        dists[key] = dist;
    });

    // distances between two data points are stored in dist[1~s.length][1~t.length]
    for (let i = 1; i <= s.length; i++) {
        let start = Math.max(1, i - w),
            end = Math.min(t.length, i + w);
        for (let j = start; j <= end; j++) {
            variables.forEach(key => {
                dists[key][i][j] = distFunc(s[i - 1][key], t[j - 1][key]) + Math.min(
                    dists[key][i - 1][j],     // insertion
                    dists[key][i][j - 1],     // deletion
                    dists[key][i - 1][j - 1]  // match
                );
            });
        }
    }

    // remove infinity row and column
    let result = {};
    variables.forEach(key => {
        result[key] = [];
        for (let i = 1; i < dists[key].length; i++) {
            result[key].push(dists[key][i].slice(1, dists[key][i].length));
        }
    });

    return result;
}

function DTWMD(s, t, variables, w, distFunc) {
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

    for (let i = 1; i <= s.length; i++) {
        let start = Math.max(1, i - w),
            end = Math.min(t.length, i + w);
        for (let j = start; j <= end; j++) {
            dist[i][j] = distFunc(s[i - 1], t[j - 1], variables) + Math.min(
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
}

function OptimalWarpingPath(cost) {
    if (Array.isArray(cost)) {
        let path = [];
        let i = cost.length - 1,    // y axis: source (SS)
            j = cost[0].length - 1; // x axis: target (centroid/medoid)
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
    } else if (typeof(cost) === 'object') {
        let paths = {};
        for (let key in cost) {
            let path = [];
            let i = cost[key].length - 1,    // y axis: source (SS)
                j = cost[key][0].length - 1; // x axis: target (centroid/medoid)
            path.push([j, i]);
            while (i > 0 && j > 0) {
                if (i === 0) {
                    j--;
                } else if (j === 0) {
                    i--;
                } else {
                    if (cost[key][i - 1][j] === Math.min(cost[key][i - 1][j - 1], cost[key][i - 1][j], cost[key][i][j - 1])) {
                        i--;
                    } else if (cost[key][i][j - 1] === Math.min(cost[key][i - 1][j - 1], cost[key][i - 1][j], cost[key][i][j - 1])) {
                        j--;
                    } else {
                        i--;
                        j--;
                    }
                }
                path.push([j, i]);
            }
            path.push([0, 0]);
            paths[key] = path;
        }
        return paths;
    }
}

function EuclideanDist(x, y, variables) {
    if (Array.isArray(x)) {
        let sum = 0;
        for (let i = 0; i < x.length; i++) {
            sum += Math.pow(x[i] - y[i], 2);
        }
        return Math.sqrt(sum);
    } else if (typeof(x) === 'number') {
        return Math.abs(x - y);
    } else if (typeof(x) === 'object') {
        let sum = 0;
        variables.forEach((key) => {
            sum += Math.pow(x[key] - y[key], 2);
        });
        return Math.sqrt(sum);
    }
}
