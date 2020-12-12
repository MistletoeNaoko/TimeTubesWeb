import {objectSum, objectSub, objectMul, objectDiv, objectAbsSub, objectTotal} from '../lib/mathLib';

export function performClustering(data, clusteringParameters, SSperiod, isometryLen, overlapTh, variables) {
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

    // perform clustering
    let distanceParameters = {
        window: clusteringParameters.window,
        metric: clusteringParameters.distanceMetric,
        distFunc: EuclideanDist
    }
    kMedoids(filteredSS, variables, clusteringParameters.clusterNum, distanceParameters);
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
        case 'Euclidean':
            break;
        default:
            break;
    }
    return distMatrix;
}

function kMedoids(data, variables, clusterNum, distanceParameters) {
    // step 1: compute distance matrix between SS
    // step 2: pick up k medoids from all SS
    // step 3: assign other SS to medoids
    // step 4: re-find medoids which minimize the total distances
    // step 5: repeat steps 3 and 4

    // step 1
    let distMatrix = distanceMatrix(data, distanceParameters, variables);
    console.log(distMatrix)
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
