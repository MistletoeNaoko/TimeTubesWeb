import {objectSum, objectSub, objectMul, objectDiv, objectAbsSub, objectTotal} from '../lib/mathLib';

export function performClustering(data, clusterNum, SSperiod, distanceMetric, isometryLen, overlapTh, variables) {
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
    let rawData = [];//data.data.spatial;
    for (let i = 0; i < data.data.spatial.length; i++) {
        let dataTmp = {};
        dataTmp.z = data.data.spatial[i].z;
        for (let j = 0; j < variables.length; j++) {
            dataTmp[variables[j]] = data.data.spatial[i][variables[j]];
        }
        rawData.push(dataTmp);
    }
    let SSRanges = extractRanges(rawData, SSperiod);
    let [isometricData, changeDegrees] = timeSeriesIsometry(rawData, SSRanges, isometryLen, false, data.data.meta.min, data.data.meta.max);

    // pick up a SS with the highest changeDegrees from SS which has the same starting data point
    let i = 0;
    let filteredSameStartsIdx = [];
    while (i < SSRanges.length) {
        let startIdx = SSRanges[i][0],
            maxChangeDegreeIdx = i;
        i++;
        while (i < SSRanges.length && SSRanges[i][0] == startIdx) {
            if (changeDegrees[maxChangeDegreeIdx] < changeDegrees[i]) {
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

    // if needed, filter out SS with high overlapping degree
    let filteredSS = [];
    if (overlapTh > 0) {
        let i = 0;
        while (i < filteredSameStartsIdx.length) {
            let range1 = SSRanges[filteredSameStartsIdx[i]],
                maxChangeDegreeIdx = filteredSameStartsIdx[i];
            let j = i + 1;
            while (j < filteredSameStartsIdx.length) {
                let overlap = overlappingDegree(range1, SSRanges[filteredSameStartsIdx[j]]);
                if (overlap < overlapTh) {
                    break;
                }
                if (overlap >= overlapTh) {
                    if (changeDegrees[maxChangeDegreeIdx] < changeDegrees[filteredSameStartsIdx[j]]) {
                        maxChangeDegreeIdx = filteredSameStartsIdx[j];
                    } else if (changeDegrees[maxChangeDegreeIdx] === changeDegrees[filteredSameStartsIdx[j]]) {
                        if (SSRanges[filteredSameStartsIdx[i]][1] - SSRanges[filteredSameStartsIdx[i]][0] < SSRanges[filteredSameStartsIdx[j]][1] - SSRanges[filteredSameStartsIdx[j]][0]) {
                            maxChangeDegreeIdx = filteredSameStartsIdx[j];
                        } else {
                            maxChangeDegreeIdx = filteredSameStartsIdx[i];
                        }
                    }
                }
                j++;
            }
            filteredSS.push(isometricData[maxChangeDegreeIdx]);
            i = j;
        }
    } else {
        for (let i = 0; i < filteredSameStartsIdx.length; i++) {
            filteredSS.push(isometricData[filteredSameStartsIdx[i]]);
        }
    }
    console.log(filteredSS.length)
}

export function extractRanges(data, SSperiod) {
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

export function timeSeriesIsometry(data, ranges, isometryLen = 50, normalize = true, min, max) {
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
        changeDegrees.push(changeDegree(SStmp, min, max))
        // normalize SS here if needed
        if (normalize) {
            SStmp = zNormalization(SStmp);
        }
        isometricSS.push(SStmp);
    }
    return [isometricSS, changeDegrees];
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

function zNormalization(data) {
    let normalized = [];
    // compute the mean and standard deviation of the time interval
    let means = {}, stds = {};
    for (let key in data[0]) {
        means[key] = 0;
        stds[key] = 0;
    }
    for (let i = 0; i < data.length; i++) {
        for (let key in data[i]) {
            means[key] += data[i][key];
        }
    }
    for (let key in means) {
        means[key] /= data.length;
    }
    for (let i = 0; i < data.length; i++) {
        for (let key in data[i]) {
            stds[key] += Math.pow((data[i][key] - means[key]), 2);
        }
    }
    for (let key in stds) {
        stds[key] = Math.sqrt(std[key] / data.length);
    }

    // z-normalize data points
    for (let i = 0; i < data.length; i++) {
        let normalizedTmp = {};
        for (let key in data[i]) {
            normalizedTmp[key] = (data[i][key] - means[key]) / stds[key];
        }
        normalized.push(normalizedTmp);
    }
    return normalized;
}

function changeDegree(data, min, max) {
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
