import {objectSum, objectSub, objectMul, objectDiv, objectAbsSub, objectTotal} from '../lib/mathLib';
import DataStore from '../Stores/DataStore';
import * as math from 'mathjs';

export function performClustering(datasets, clusteringParameters, subsequenceParameters) {
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
    let variables = clusteringParameters.variables.slice();
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

    let subsequences = {}, subsequenceData = [], ranges = [];
    let isometricData, anomalyDegrees;
    let filteringProcess = {};

    // filtering subsequences according to selected options
    // subsequences by datasets
    if (subsequenceParameters.filtering.indexOf('dataDrivenSlidingWindow') >= 0) {
        let SSRanges = extractRanges(rawData, subsequenceParameters.SSperiod);
        filteringProcess['dataDrivenSlidingWindow'] = {};
        // store indexes of subsequences for initialization
        for (let dataIdx in SSRanges) {
            subsequences[dataIdx] = [];
            filteringProcess['dataDrivenSlidingWindow'][dataIdx] = [];
            for (let i = 0; i < SSRanges[dataIdx].length; i++) {
                subsequences[dataIdx].push(i);
                filteringProcess['dataDrivenSlidingWindow'][dataIdx].push(i);
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
        filteringProcess['subsequences'] = isometricData;

        // pick up a SS with the highest changeDegrees from SS which has the same starting data point
        if (subsequenceParameters.filtering.indexOf('sameStartingPoint') >= 0) {
            filteringProcess['sameStartingPoint'] = {};
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
                filteringProcess['sameStartingPoint'][dataIdx] = filteredSameStartsIdx;
            }
        }

        // if needed, filter out SS with high overlapping degree
        if (subsequenceParameters.filtering.indexOf('overlappingDegree') >= 0) {
            filteringProcess['overlappingDegree'] = {};
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
                    filteringProcess['overlappingDegree'][dataIdx] = filteredSS;
                }
            }
        }
        // data collection only for filtered subsequences
        for (let dataIdx in subsequences) {
            for (let i = 0; i < subsequences[dataIdx].length; i++) {
                let dataTmp = isometricData[dataIdx][subsequences[dataIdx][i]];
                subsequenceData.push(dataTmp);
                ranges.push(SSRanges[dataIdx][subsequences[dataIdx][i]]);
            }
        }
    } else {
        // extract subsequences by the normal sliding window
        let step = 1;
        filteringProcess['normalSlidingWindow'] = {};
        for (let i = 0; i < datasets.length; i++) {
            let dataIdx = datasets[i].id;
            let targetData = DataStore.getDataArray(dataIdx, step);
            targetData = convertDataStyle(targetData, variables);
            let SSRanges = extractRangesFromInterpolatedData(targetData, subsequenceParameters.SSperiod);
            // store indexes of subsequences for initialization
            subsequences[dataIdx] = [];
            filteringProcess['normalSlidingWindow'][dataIdx] = [];
            for (let i = 0; i < SSRanges.length; i++) {
                subsequences[dataIdx].push(i);
                filteringProcess['normalSlidingWindow'][dataIdx].push(i);
            }

            [isometricData, anomalyDegrees] = timeSeriesIsometry(
                targetData, 
                SSRanges, 
                subsequenceParameters.isometryLen, 
                subsequenceParameters.normalize,
                mins[dataIdx],
                maxs[dataIdx]
            );
            filteringProcess['subsequences'] = isometricData;

            // pick up a SS with the highest changeDegrees from SS which has the same starting data point
            if (subsequenceParameters.filtering.indexOf('sameStartingPoint') >= 0) {
                let i = 0,
                    filteredSameStartsIdx = [];
                filteringProcess['sameStartingPoint'] = {};
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
                filteringProcess['sameStartingPoint'][dataIdx] = filteredSameStartsIdx;
            }

            // if needed, filter out SS with high overlapping degree
            if (subsequenceParameters.filtering.indexOf('overlappingDegree') >= 0) {
                filteringProcess['overlappingDegree'] = {};
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
                    filteringProcess['overlappingDegree'][dataIdx] = filteredSS;
                }
            }
            // data collection only for filtered subsequences
            for (let i = 0; i < subsequences[dataIdx].length; i++) {
                let dataTmp = isometricData[subsequences[dataIdx][i]];
                subsequenceData.push(dataTmp);
                ranges.push(SSRanges[subsequences[dataIdx][i]]);
            }
        }
    }

    // perform clustering
    let distanceParameters = {
        window: clusteringParameters.window,
        metric: clusteringParameters.distanceMetric,
        distFunc: EuclideanDist
    }
    let clusterCenters, medoidIdx, labels, clusteringScores, distMatrix, distsToClusters, distsBetweenClusters;
    switch (clusteringParameters.method) {
        case 'kmedoids':
            distsBetweenClusters = [];
            for (let i = 0; i < clusteringParameters.clusterNum; i++) {
                distsBetweenClusters.push([]);
                for (let j = 0; j < clusteringParameters.clusterNum; j++) {
                    distsBetweenClusters[i].push(0);
                }
            }
            if (clusteringParameters.medoidDefinition === 'unified') {
                [clusterCenters, medoidIdx, labels, clusteringScores, distMatrix] = kMedoidsUnified(subsequenceData, clusteringParameters.clusterNum, distanceParameters, variables);
                for (let i = 0; i < clusteringParameters.clusterNum - 1; i++) {
                    for (let j = i + 1; j < clusteringParameters.clusterNum; j++) {
                        distsBetweenClusters[i][j] = distMatrix[medoidIdx[i]][medoidIdx[j]];
                        distsBetweenClusters[j][i] = distMatrix[medoidIdx[j]][medoidIdx[i]];
                    }
                }

            } else if (clusteringParameters.medoidDefinition === 'each') {
                [clusterCenters, medoidIdx, labels, clusteringScores, distMatrix] = kMedoidsEach(subsequenceData, clusteringParameters.clusterNum, distanceParameters, variables);
                for (let i = 0; i < clusteringParameters.clusterNum - 1; i++) {
                    for (let j = i + 1; j < clusteringParameters.clusterNum; j++) {
                        let distSum = 0;
                        variables.forEach(key => {
                            if (key !== 'z') {
                                distSum += distMatrix[medoidIdx[i][key]][medoidIdx[j][key]][key];
                            }
                        });
                        distsBetweenClusters[i][j] = distSum;
                        distsBetweenClusters[j][i] = distSum;
                    }
                }
                // make distMatrix (distances of each variable) unified distance matrix
                for (let i = 0; i < distMatrix.length - 1; i++) {
                    distMatrix[i][i] = 0;
                    for (let j = i + 1; j < distMatrix[i].length; j++) {
                        let distSum = 0;
                        for (let key in distMatrix[i][j]) {
                            distSum += distMatrix[i][j][key];
                        }
                        distMatrix[i][j] = distSum;
                        distMatrix[j][i] = distSum;
                    }
                }
                distMatrix[distMatrix.length - 1][distMatrix.length - 1] = 0;
            }
            break;
        case 'kmeans':
            [clusterCenters, labels, clusteringScores, distMatrix, distsToClusters, distsBetweenClusters] = kMeans(subsequenceData, clusteringParameters.clusterNum, distanceParameters, variables);
            // merge distance matrix for each SS and distance matrix for clusters
            // fill 0s to shortcoming parts of the distance matrix
            for (let i = 0; i < clusteringParameters.clusterNum; i++) {
                distMatrix.push([]);
                for (let j = 0; j < subsequenceData.length; j++) {
                    distMatrix[j].push(0);
                    distMatrix[subsequences.length + i].push(0);
                }
                for (let j = 0; j < clusteringParameters.clusterNum; j++) {
                    distMatrix[subsequences.length + i].push(0);
                }
            }
            for (let i = 0; i < subsequenceData.length; i++) {
                for (let j = 0; j < clusteringParameters.clusterNum; j++) {
                    distMatrix[i][subsequences.length + j] = distsToClusters[i][j];
                    distMatrix[subsequences.length + j][i] = distsToClusters[i][j];
                }
            }
            for (let i = 0; i < clusteringParameters.clusterNum - 1; i++) {
                for (let j = i + 1; j < clusteringParameters.clusterNum; j++) {
                    distMatrix[subsequences.length + i][subsequences.length + j] = distsBetweenClusters[i][j];
                    distMatrix[subsequences.length + j][subsequences.length + i] = distsBetweenClusters[i][j];
                }
            }
            break;
        default:
            break;
    }
    let dataCenter = computeDataCenter(subsequenceData, distanceParameters, variables.filter(ele => ele !== 'z'), subsequenceParameters.isometryLen);
    let labelsCluster = divideSSIntoClusters(labels, clusteringParameters.clusterNum);
    
    clusteringScores.pseudoF = pseudoF(clusteringScores.clusterRadiuses, clusterCenters, dataCenter, labelsCluster.map(x => x.length), distanceParameters, variables.filter(ele => ele !== 'z'));

    let clustersPos = MDSClassical(distsBetweenClusters);
    console.log(clustersPos);
    console.log(distMatrix);
    let dataPos = MDSClassical(distMatrix);
    console.log(dataPos);

    return [subsequenceData, ranges, clusterCenters, labels, clusteringScores, filteringProcess];
}

export function reperformClustering(data, clusteringParameters, dataLen) {
    let variablesZ = clusteringParameters.variables.slice();
    variablesZ.push('z');
    
    let distanceParameters = {
        window: clusteringParameters.window,
        metric: clusteringParameters.distanceMetric,
        distFunc: EuclideanDist
    }


    let clusterCenters, medoidIdx, labels, clusteringScores, distMatrix, distsToClusters, distsBetweenClusters;
    switch (clusteringParameters.method) {
        case 'kmedoids':
            if (clusteringParameters.medoidDefinition === 'unified') {
                [clusterCenters, medoidIdx, labels, clusteringScores, distMatrix] = kMedoidsUnified(data, clusteringParameters.clusterNum, distanceParameters, variablesZ);
            } else if (clusteringParameters.medoidDefinition === 'each') {
                [clusterCenters, medoidIdx, labels, clusteringScores, distMatrix] = kMedoidsEach(data, clusteringParameters.clusterNum, distanceParameters, variablesZ);
            }
            break;
        case 'kmeans':
            [clusterCenters, labels, clusteringScores, distMatrix, distsToClusters, distsBetweenClusters] = kMeans(data, clusteringParameters.clusterNum, distanceParameters, variablesZ);
            break;
        default:
            break;
    }

    let dataCenter = computeDataCenter(data, distanceParameters, clusteringParameters.variables, dataLen);
    let labelsCluster = divideSSIntoClusters(labels, clusteringParameters.clusterNum);
    clusteringScores.pseudoF = pseudoF(clusteringScores.clusterRadiuses, clusterCenters, dataCenter, labelsCluster.map(x => x.length), distanceParameters, clusteringParameters.variables);
    return [clusterCenters, labels, clusteringScores];
}

function divideSSIntoClusters (labels, clusterNum) {
    let clusters = [];
    for (let i = 0; i < clusterNum; i++) {
        clusters.push([]);
    }
    if (typeof(labels[0]) === 'object') {
        for (let i = 0; i < labels.length; i++) {
            clusters[labels[i].cluster].push(i);
        }
    } else {
        for (let i = 0; i < labels.length; i++) {
            clusters[labels[i]].push(i);
        }
    }
    return clusters;
}

function pseudoF(clusterRadiuses, clusterCenters, dataCenter, clusterMemberNum, distanceParameters, variableList) {
    let cohesion = 0, separation = 0;
    for (let i = 0; i < clusterRadiuses.length; i++) {
        cohesion += (clusterRadiuses[i] * clusterMemberNum[i]);
    }
    switch (distanceParameters.metric) {
        case 'Euclidean':
            break;
        case 'DTWD':
            if (distanceParameters.window > 0) {
                for (let i = 0; i < clusterCenters.length; i++) {
                    let dist = DTWMD(clusterCenters[i], dataCenter, variableList, distanceParameters.window, distanceParameters.distFunc);
                    separation += clusterMemberNum[i] * dist[dist.length - 1][dist[0].length - 1];
                }
            } else {
                for (let i = 0; i < clusterCenters.length; i++) {
                    let dist = DTWSimpleMD(clusterCenters[i], dataCenter, variableList, distanceParameters.distFunc);
                    separation += clusterMemberNum[i] * dist[dist.length - 1][dist[0].length - 1];
                }
            }
            break;
        case 'DTWI':
            if (distanceParameters.window > 0) {
                for (let i = 0; i < clusterCenters.length; i++) {
                    let dist = DTW(clusterCenters[i], dataCenter, variableList, distanceParameters.window, distanceParameters.distFunc);
                    let distSum = 0;
                    variableList.forEach(key => {
                        distSum += dist[key][dist[key].length - 1][dist[key][0].length - 1];
                    });
                    separation += clusterMemberNum[i] * distSum;
                }
            } else {
                for (let i = 0; i < clusterCenters.length; i++) {
                    let dist = DTWSimple(clusterCenters[i], dataCenter, variableList, distanceParameters.distFunc);
                    let distSum = 0;
                    variableList.forEach(key => {
                        distSum += dist[key][dist[key].length - 1][dist[key][0].length - 1];
                    });
                    separation += clusterMemberNum[i] * distSum;
                }
            }
            break;
        case 'DTW':
            // kmedoidEachの時はmedoidは各変数ごとに決まっているが、clusterCentersのデータはデータ値になってるからOK
            // TODO: DTWの時はDTWIでOK?
            if (distanceParameters.window > 0) {
                for (let i = 0; i < clusterCenters.length; i++) {
                    let dist = DTW(clusterCenters[i], dataCenter, variableList, distanceParameters.window, distanceParameters.distFunc);
                    let distSum = 0;
                    variableList.forEach(key => {
                        distSum += dist[key][dist[key].length - 1][dist[key][0].length - 1];
                    });
                    separation += clusterMemberNum[i] * distSum;
                }
            } else {
                for (let i = 0; i < clusterCenters.length; i++) {
                    let dist = DTWSimple(clusterCenters[i], dataCenter, variableList, distanceParameters.distFunc);
                    let distSum = 0;
                    variableList.forEach(key => {
                        distSum += dist[key][dist[key].length - 1][dist[key][0].length - 1];
                    });
                    separation += clusterMemberNum[i] * distSum;
                }
            }
            break;
        default:
            break;
    }
    let dataNumber = clusterMemberNum.reduce((sum, element) => sum + element, 0);
    return (separation / cohesion) * ((dataNumber - clusterCenters.length) / (clusterCenters.length - 1));
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
            let SStmp = [], SSDataPoints = [];
            SSDataPoints = data.slice(ranges[i][0], ranges[i][1] + 1);
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
                let dataPoints = [], means, stds;
                [SStmp, means, stds] = zNormalization(SStmp, ['z']);
                for (let dataPointIdx = 0; dataPointIdx < SSDataPoints.length; dataPointIdx++) {
                    let dataPointTmp = {};
                    for (let key in SStmp[0]) {
                        if (key === 'z') {
                            dataPointTmp[key] = SSDataPoints[dataPointIdx].z;
                        } else {
                            dataPointTmp[key] = (SSDataPoints[dataPointIdx][key] - means[key]) / stds[key];
                        }
                    }
                    dataPoints.push(dataPointTmp);
                }
                SStmp.dataPoints = dataPoints;
                SStmp.idx = i;
            } else {
                SStmp.dataPoints = SSDataPoints;
                SStmp.idx = i;
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
                let SStmp = [], SSDataPoints = [];
                SSDataPoints = data[dataIdx].slice(ranges[dataIdx][i][0], ranges[dataIdx][i][1] + 1);
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
                    let dataPoints = [], means, stds;
                    [SStmp, means, stds] = zNormalization(SStmp, ['z']);
                    for (let dataPointIdx = 0; dataPointIdx < SSDataPoints.length; dataPointIdx++) {
                        let dataPointTmp = {};
                        for (let key in SStmp[0]) {
                            if (key === 'z') {
                                dataPointTmp[key] = SSDataPoints[dataPointIdx].z;
                            } else {
                                dataPointTmp[key] = (SSDataPoints[dataPointIdx][key] - means[key]) / stds[key];
                            }
                        }
                        dataPoints.push(dataPointTmp);
                    }
                    SStmp.dataPoints = dataPoints;
                    SStmp.id = dataIdx;
                    SStmp.idx = i;
                } else {
                    SStmp.dataPoints = SSDataPoints;
                    SStmp.id = dataIdx;
                    SStmp.idx = i;
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
    return [normalized, means, stds];
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
    for (let i = 0; i < data.length; i++) {
        distMatrix.push([]);
        for (let j = 0; j < data.length; j++) {
            distMatrix[i].push(0);
        }
    }
    // initialize distance matrix
    switch (distanceParameters.metric) {
        case 'DTWD':
            if (distanceParameters.window > 0) {
                // DTWMD
                for (let i = 0; i < data.length - 1; i++) {
                    // let distTmp = [];
                    for (let j = i + 1; j < data.length; j++) {
                        let dist = DTWMD(data[i], data[j], variables, distanceParameters.window, distanceParameters.distFunc);
                        // distTmp.push(dist[dist.length - 1][dist[0].length - 1]);
                        distMatrix[i][j] = dist[dist.length - 1][dist[0].length - 1];
                        distMatrix[j][i] = dist[dist.length - 1][dist[0].length - 1];
                    }
                    // distMatrix.push(distTmp);
                }
            } else {
                // DTWSimpleMD
                for (let i = 0; i < data.length - 1; i++) {
                    // let distTmp = [];
                    for (let j = i + 1; j < data.length; j++) {
                        let dist = DTWSimpleMD(data[i], data[j], variables, distanceParameters.distFunc);
                        // distTmp.push(dist[dist.length - 1][dist[0].length - 1]);
                        distMatrix[i][j] = dist[dist.length - 1][dist[0].length - 1];
                        distMatrix[j][i] = dist[dist.length - 1][dist[0].length - 1];
                    }
                    // distMatrix.push(distTmp);
                }
            }
            break;
        case 'DTWI':
            if (distanceParameters.window > 0) {
                // DTW
                for (let i = 0; i < data.length - 1; i++) {
                    // let distTmp = [];
                    for (let j = i + 1; j < data.length; j++) {
                        let distSum = 0;
                        let dists = DTW(data[i], data[j], variables, distanceParameters.window, disranceParameter.distFunc);
                        variables.forEach(key => {
                            distSum += dists[key][dists[key].length - 1][dists[key][0].length - 1];
                        });
                        // distTmp.push(distSum);
                        distMatrix[i][j] = distSum;
                        distMatrix[j][i] = distSum;
                    }
                    // distMatrix.push(distTmp);
                }
            } else {
                // DTWSimple
                for (let i = 0; i < data.length - 1; i++) {
                    // let distTmp = [];
                    for (let j = i + 1; j < data.length; j++) {
                        let distSum = 0;
                        let dists = DTWSimple(data[i], data[j], variables, distanceParameters.distFunc);
                        variables.forEach(key => {
                            distSum += dists[key][dists[key].length - 1][dists[key][0].length - 1];
                        });
                        // distTmp.push(distSum);
                        distMatrix[i][j] = distSum;
                        distMatrix[j][i] = distSum;
                    }
                    // distMatrix.push(distTmp);
                }
            }
            break;
        case 'DTW':
            if (distanceParameters.window > 0) {
                // DTW (=DTWI)
                for (let i = 0; i < data.length - 1; i++) {
                    let distList = [];
                    for (let j = i + 1; j < data.length; j++) {
                        let distTmp = {};
                        let dists = DTW(data[i], data[j], variables, distanceParameters.window, disranceParameter.distFunc);
                        variables.forEach(key => {
                            distTmp[key] = dists[key][dists[key].length - 1][dists[key][0].length - 1];
                        });
                        // distList.push(distTmp);
                        distMatrix[i][j] = distTmp;
                        distMatrix[j][i] = distTmp;
                    }
                    // distMatrix.push(distList);
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
                        // distList.push(distTmp);
                        distMatrix[i][j] = distTmp;
                        distMatrix[j][i] = distTmp;
                    }
                    // distMatrix.push(distList);
                }
            }
            // make diagonal element of the matrix object of 0s
            let zerosTmp = {};
            variables.forEach(key => {
                zerosTmp[key] = 0;    
            });
            for (let i = 0; i < data.length; i++) {
                distMatrix[i][i] = zerosTmp;
            }
            break;
        case 'Euclidean':
            break;
        default:
            break;
    }
    return distMatrix;
}

function computeDataCenter(data, distanceParameters, variables, dataLen) {
    let centroid = [], newCentroid = [];
    let loop = 0, maxIteration = 300;
    let distMetric = distanceParameters.metric;
    if (distMetric === 'DTW') {
        distMetric = 'DTWI';
        // if (medoidDefinition === 'unified') {
        //     distMetric = 'DTWD';
        // } else if (medoidDefinition === 'each') {
        //     distMetric = 'DTWI';
        // }
    }
    switch (distMetric) {
        case 'Euclidean':
            break;
        case 'DTWD':
            // いったんランダムにセントろいどを決定してから更新していく
            centroid = data[Math.floor(Math.random() * Math.floor(data.length))];
            while (loop < maxIteration && checkUpdates(centroid, newCentroid)) {
                let distTmp = 0;
                let centroidTmp = [], dataCount = [];
                for (let i = 0; i <= dataLen; i++) {
                    let dataTmp = {};
                    variables.forEach(key => {
                        dataTmp[key] = 0;
                    });
                    centroidTmp.push(dataTmp);
                    dataCount.push(0);
                }
                if (distanceParameters.window > 0) {
                    for (let i = 0; i < data.length; i++) {
                        distTmp = DTWMD(centroid, data[i], variables, distanceParameters.window, distanceParameters.distFunc);
                        let path = OptimalWarpingPath(distTmp);
                        for (let j = 0; j < path.length; j++) {
                            variables.forEach(key => {
                                centroidTmp[path[j][0]][key] += data[i][path[j][1]][key];
                            });
                            dataCount[path[j][0]]++;
                        }
                    }
                } else {
                    for (let i = 0; i < data.length; i++) {
                        distTmp = DTWSimpleMD(centroid, data[i], variables, distanceParameters.distFunc);
                        let path = OptimalWarpingPath(distTmp);
                        for (let j = 0; j < path.length; j++) {
                            variables.forEach(key => {
                                centroidTmp[path[j][0]][key] += data[i][path[j][1]][key];
                            });
                            dataCount[path[j][0]]++;
                        }
                    }
                }
                for (let i = 0; i < centroidTmp.length; i++) {
                    for (let key in centroidTmp[i]) {
                        centroidTmp[i][key] /= dataCount[i];
                    }
                }
                newCentroid = centroidTmp;
                loop++;
            }
            break;
        case 'DTWI':
            // いったんランダムにセントろいどを決定してから更新していく
            centroid = data[Math.floor(Math.random() * Math.floor(data.length))];
            while (loop < maxIteration && checkUpdates(centroid, newCentroid)) {
                let distTmp = 0;
                let centroidTmp = [], dataCount = [];
                for (let i = 0; i <= dataLen; i++) {
                    let dataTmp = {}, countTmp = {};
                    variables.forEach(key => {
                        dataTmp[key] = 0;
                        countTmp[key] = 0;
                    });
                    centroidTmp.push(dataTmp);
                    dataCount.push(countTmp);
                }
                if (distanceParameters.window > 0) {
                    for (let i = 0; i < data.length; i++) {
                        distTmp = DTW(centroid, data[i], variables, distanceParameters.window, distanceParameters.distFunc);
                        let path = OptimalWarpingPath(distTmp);
                        variables.forEach(key => {
                            for (let j = 0; j < path[key].length; j++) {
                                centroidTmp[path[key][j][0]][key] += data[i][path[key][j][1]][key];
                                dataCount[path[key][j][0]][key]++;
                            }
                        });
                    }
                } else {
                    for (let i = 0; i < data.length; i++) {
                        distTmp = DTWSimple(centroid, data[i], variables, distanceParameters.distFunc);
                        let path = OptimalWarpingPath(distTmp);
                        variables.forEach(key => {
                            for (let j = 0; j < path[key].length; j++) {
                                centroidTmp[path[key][j][0]][key] += data[i][path[key][j][1]][key];
                                dataCount[path[key][j][0]][key]++;
                            }
                        });
                    }
                }
                for (let i = 0; i < centroidTmp.length; i++) {
                    for (let key in centroidTmp[i]) {
                        centroidTmp[i][key] /= dataCount[i][key];
                    }
                }
                newCentroid = centroidTmp;
                loop++;
            }
            break;
        default:
            break;
    }
    return newCentroid;
    function checkUpdates(pCentroid, nCentroid) {
        let flag = false;
        if (pCentroid.length === 0 || nCentroid.length === 0) {
            return true;
        }
        for (let i = 0; i < pCentroid.length; i++) {
            for (let key in variables) {
                if (pCentroid[i][key] !== nCentroid[i][key]) {
                    flag = true;
                    break;
                }
            }
            if (flag) break;
        }
        return flag;
    }
}

function kMedoidsEach(data, clusterNum, distanceParameters, variables) {
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
    let initSearch = 5, maxTrial = 10;
    let medoids = [], labels = [];
    let clusteringScores = {};
    let bestMedoids, bestLabels, bestDist = Infinity, bestDists;

    for (let trial = 0; trial < maxTrial; trial++) {
        let score = Infinity;
        medoids = [], labels = [];
        for (let i = 0; i < initSearch; i++) {
            // step 3
            let [medoidsTmp, scoreTmp, labelsTmp] = initMedoids(variableList);
            if (scoreTmp < score) {
                score = scoreTmp;
                medoids = medoidsTmp;
                labels = labelsTmp;
            }
        }
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
        medoids = newMedoids;
        newLabels = labels;
        let distSumTmp = 0, distCluster = [];
        for (let i = 0; i < distSum.length; i++) {
            let distClusterTmp = 0;
            for (let key in distSum[i]) {
                distSumTmp += distSum[i][key];
                distClusterTmp += distSum[i][key];
            }
            distCluster.push(distClusterTmp);
        }
        if (distSumTmp < bestDist) {
            bestDist = distSumTmp;
            bestDists = distCluster;
            bestMedoids = medoids;
            bestLabels = labels;
        }
    }
    medoids = bestMedoids;
    labels = bestLabels;
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

    let clusters = divideSSIntoClusters();

    clusteringScores.clusterRadiuses = clusterRadius(clusters.map(x => x.length));
    [clusteringScores.silhouette, clusteringScores.silhouetteSS] = silhouetteCoefficient();
    clusteringScores.davisBouldin = davisBouldinIndex();
    
    return [medoidData, medoids, labels, clusteringScores, distMatrix];

    function divideSSIntoClusters() {
        let clustersTmp = [];
        for (let i = 0; i < clusterNum; i++) {
            clustersTmp.push([]);
        }
        for (let i = 0; i < labels.length; i++) {
            clustersTmp[labels[i]].push(i);
        }
        return clustersTmp;
    }
    // function countClusterNumber() {
    //     let counters = [];
    //     for (let i = 0; i < clusterNum; i++) {
    //         counters.push(0);
    //     }
    //     for (let i = 0; i < labels.length; i++) {
    //         counters[labels[i]]++;
    //     }
    //     return counters;
    // }
    function clusterRadius(counters) {
        let radiuses = [];
        for (let i = 0; i < clusterNum; i++) {
            radiuses.push(bestDists[i] / counters[i]);
        }
        return radiuses;
    }
    function silhouetteCoefficient() {
        // silhouette: silhouette coefficient for whole clustering results
        // silhouetteSS: silhouette coefficients for each SS
        let silhouette, silhouetteSS = [];
        silhouetteSS = Array(data.length).fill(0);
        for (let i = 0; i < clusters.length; i++) {
            for (let j = 0; j < clusters[i].length; j++) {
                // focus on data[clusters[i][j]]
                let cohesionTmp = 0, separationTmp = 0;
                let clusterNear, clusterNearDist = Infinity;
                // find the second nearest cluster of data[clusters[i][j]]
                for (let k = 0; k < medoids.length; k++) {
                    if (k !== i) {
                        let dist = 0;
                        variableList.forEach(key => {
                            if (clusters[i][j] !== medoids[k][key]) {
                                // let dataIdxMin = Math.min(clusters[i][j], medoids[k][key]),
                                //     dataIdxMax = Math.max(clusters[i][j], medoids[k][key]);
                                dist += distMatrix[clusters[i][j]][medoids[k][key]][key];//[dataIdxMin][dataIdxMax - dataIdxMin - 1][key];
                            }
                        });
                        if (dist < clusterNearDist) {
                            clusterNearDist = dist;
                            clusterNear = k;
                        }
                    }
                }

                for (let k = 0; k < clusters[i].length; k++) {
                    // compute cohesion of the focused data sample (data[clusters[i][j]])
                    if (clusters[i][j] !== clusters[i][k]) {
                        // let dataIdxMin = Math.min(clusters[i][j], clusters[i][k]),
                        //     dataIdxMax = Math.max(clusters[i][j], clusters[i][k]);
                        variableList.forEach(key => {
                            cohesionTmp += distMatrix[clusters[i][j]][clusters[i][k]][key];//distMatrix[dataIdxMin][dataIdxMax - dataIdxMin - 1][key];
                        });
                    }
                }
                cohesionTmp /= (clusters[i].length - 1);
                for (let k = 0; k < clusters[clusterNear].length; k++) {
                    // compute separation of the focused data sample (data[clusters[i][j]])
                    // let dataIdxMin = Math.min(clusters[i][j], clusters[clusterNear][k]),
                    //     dataIdxMax = Math.max(clusters[i][j], clusters[clusterNear][k]);
                    variableList.forEach(key => {
                        separationTmp += distMatrix[clusters[i][j]][clusters[clusterNear][k]][key];//distMatrix[dataIdxMin][dataIdxMax - dataIdxMin - 1][key];
                    });
                }
                separationTmp /= clusters[clusterNear].length;
                silhouetteSS[clusters[i][j]] = (separationTmp - cohesionTmp) / Math.max(cohesionTmp, separationTmp);
            }
        }
        silhouette = silhouetteSS.reduce((sum, element) => sum + element, 0);
        silhouette /= silhouetteSS.length;
        return [silhouette, silhouetteSS];
    }
    function davisBouldinIndex() {
        let db = 0;
        // let insideClusterAverageDists = [];
        // compute the average distance between each point of cluster and the medoid of the cluster (cluster diameter)
        // for (let i = 0; i < clusters.length; i++) {
        //     let totalDistTmp = 0;
        //     for (let j = 0; j < clusters[i].length; j++) {
        //         variableList.forEach(key => {
        //             if (clusters[i][j] !== medoids[i][key]) {
        //                 let dataIdxMin = Math.min(medoids[i][key], clusters[i][j]),
        //                     dataIdxMax = Math.max(medoids[i][key], clusters[i][j]);
        //                 totalDistTmp += distMatrix[dataIdxMin][dataIdxMax - dataIdxMin - 1][key];
        //             }
        //         });
        //     }
        //     totalDistTmp /= clusters[i].length;
        //     insideClusterAverageDists.push(totalDistTmp);
        // }
        for (let i = 0; i < clusters.length; i++) {
            let maxR = -Infinity;
            for (let j = i + 1; j < clusters.length; j++) {
                if (i === j) continue;
                let clustersDist = 0;
                variableList.forEach(key => {
                    // let dataIdxMin = Math.min(medoids[i][key], medoids[j][key]),
                    //     dataIdxMax = Math.max(medoids[i][key], medoids[j][key]);
                    clustersDist += distMatrix[medoids[i][key]][medoids[j][key]][key];//distMatrix[dataIdxMin][dataIdxMax - dataIdxMin - 1][key];
                });
                let Rij = (clusteringScores.clusterRadiuses[i] + clusteringScores.clusterRadiuses[j]) / clustersDist;
                if (maxR < Rij) {
                    maxR = Rij;
                }
            }   
            if (isFinite(maxR)) { 
                db += maxR;
            }
        }
        db /= clusters.length;
        return db;
    }
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
                errorSum += distMatrix[i][medoids[labels[i]][key]][key];
                // if (i < medoids[labels[i]][key]) {
                //     errorSum += distMatrix[i][medoids[labels[i]][key] - i - 1][key];
                // } else if (medoids[labels[i]][key] < i) {
                //     errorSum += distMatrix[medoids[labels[i]][key]][i - medoids[labels[i]][key] - 1][key];
                // }  
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
                    if (i !== medoids[j][key]) {
                        distTmp += distMatrix[i][medoids[j][key]][key];
                    }
                    // if (i < medoids[j][key]) {
                    //     distTmp += distMatrix[i][medoids[j][key] - i - 1][key];
                    // } else if (medoids[j][key] < i) {
                    //     distTmp += distMatrix[medoids[j][key]][i - medoids[j][key] - 1][key];
                    // } else {
                    //     distTmp += 0;
                    // }
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
                    } else {
                        for (let key in minDistSum) {
                            distSumTmp[key] += distMatrix[clusters[i][j]][clusters[i][k]][key];
                            if (minDistSum[key] < distSumTmp[key]) {
                                overCounter++;
                            }
                        }
                    }
                    // else if (clusters[i][j] < clusters[i][k]) {
                    //     for (let key in minDistSum) {
                    //         distSumTmp[key] += distMatrix[clusters[i][j]][clusters[i][k]][key];//distMatrix[clusters[i][j]][clusters[i][k] - clusters[i][j] - 1][key];
                    //         if (minDistSum[key] < distSumTmp[key]) {
                    //             overCounter++;
                    //         }
                    //     }
                    // } else if (clusters[i][k] < clusters[i][j]) {
                    //     for (let key in minDistSum) {
                    //         distSumTmp[key] += distMatrix[clusters[i][k]][clusters[i][j] - clusters[i][k] - 1][key];
                    //         if (minDistSum[key] < distSumTmp[key]) {
                    //             overCounter++;
                    //         }
                    //     }
                    // }
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


function kMedoidsUnified(data, clusterNum, distanceParameters, variables) {
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
    let initSearch = 5, maxTrial = 10;
    let score = Infinity, medoids, labels;
    let clusteringScores = {};
    let bestMedoids, bestLabels, bestDist = Infinity, bestDists;

    for (let trial = 0; trial < maxTrial; trial++) {
        for (let i = 0; i < initSearch; i++) {
            // step 3
            let [medoidsTmp, scoreTmp, labelsTmp] = initMedoids();
            if (scoreTmp < score) {
                score = scoreTmp;
                medoids = medoidsTmp;
                labels = labelsTmp;
            }
        }

        // step 3 and 4
        let newMedoids = [], newLabels = [], distSum = [];
        let loop = 0, maxIteration = 300;
        while (medoids.filter(i => newMedoids.indexOf(i) == -1).length > 0 && loop < maxIteration) {
            // update medoids until there are no medoid updates or repeat updating medoids maxIteration times
            if (newMedoids.length !== 0 && newLabels.length !== 0) {
                medoids = newMedoids;
                labels = newLabels;
            }
            // step 3
            [newMedoids, distSum] = updateMedoids(labels);
            // step 4
            newLabels = assignSSToMedoids(newMedoids);
            loop++;
        }
        let distSumTmp = 0;
        for (let i = 0; i < distSum.length; i++) {
            distSumTmp += distSum[i];
        }
        if (distSumTmp < bestDist) {
            bestDist = distSumTmp;
            bestDists = distSum;
            bestMedoids = newMedoids;
            bestLabels = newLabels;
        }
    }
    medoids = bestMedoids;
    labels = bestLabels;
    let medoidData = [];
    for (let i = 0; i < medoids.length; i++) {
        medoidData.push(data[medoids[i]]);
    }
    let clusters = divideSSIntoClusters();

    clusteringScores.clusterRadiuses = clusterRadius(clusters.map(x => x.length));
    [clusteringScores.silhouette, clusteringScores.silhouetteSS] = silhouetteCoefficient();
    clusteringScores.davisBouldin = davisBouldinIndex();
    return [medoidData, medoids, labels, clusteringScores, distMatrix];

    function divideSSIntoClusters() {
        let clustersTmp = [];
        for (let i = 0; i < clusterNum; i++) {
            clustersTmp.push([]);
        }
        for (let i = 0; i < labels.length; i++) {
            clustersTmp[labels[i]].push(i);
        }
        return clustersTmp;
    }
    function clusterRadius(counters) {
        let radiuses = [];
        for (let i = 0; i < clusterNum; i++) {
            radiuses.push(bestDists[i] / counters[i]);
        }
        return radiuses;
    }
    function silhouetteCoefficient() {
        // silhouette: silhouette coefficient for whole clustering results
        // silhouetteSS: silhouette coefficients for each SS
        let silhouette, silhouetteSS = [];
        silhouetteSS = Array(data.length).fill(0);
        for (let i = 0; i < clusters.length; i++) {
            for (let j = 0; j < clusters[i].length; j++) {
                // focus on data[clusters[i][j]]
                let cohesionTmp = 0, separationTmp = 0;
                let clusterNear, clusterNearDist = Infinity;
                // find the second nearest cluster of data[clusters[i][j]]
                for (let k = 0; k < medoids.length; k++) {
                    if (k !== i) {
                        // let dataIdxMin = Math.min(clusters[i][j], medoids[k]),
                        //     dataIdxMax = Math.max(clusters[i][j], medoids[k]);
                        let dist = distMatrix[clusters[i][j]][medoids[k]];//distMatrix[dataIdxMin][dataIdxMax - dataIdxMin - 1];
                        if (dist < clusterNearDist) {
                            clusterNearDist = dist;
                            clusterNear = k;
                        }
                    }
                }

                for (let k = 0; k < clusters[i].length; k++) {
                    if (clusters[i][j] !== clusters[i][k]) {
                        // let dataIdxMin = Math.min(clusters[i][j], clusters[i][k]),
                        //     dataIdxMax = Math.max(clusters[i][j], clusters[i][k]);
                        cohesionTmp += distMatrix[clusters[i][j]][clusters[i][k]];//distMatrix[dataIdxMin][dataIdxMax - dataIdxMin - 1];
                    }
                }
                cohesionTmp /= (clusters[i].length - 1);
                for (let k = 0; k < clusters[clusterNear].length; k++) {
                    // let dataIdxMin = Math.min(clusters[i][j], clusters[clusterNear][k]),
                    //     dataIdxMax = Math.max(clusters[i][j], clusters[clusterNear][k]);
                    separationTmp += distMatrix[clusters[i][j]][clusters[clusterNear][k]];//distMatrix[dataIdxMin][dataIdxMax - dataIdxMin - 1];
                }
                separationTmp /= clusters[clusterNear].length;
                silhouetteSS[clusters[i][j]] = (separationTmp - cohesionTmp) / Math.max(cohesionTmp, separationTmp);
            }
        }
        silhouette = silhouetteSS.reduce((sum, element) => sum + element, 0);
        silhouette /= silhouetteSS.length;
        return [silhouette, silhouetteSS];
    }
    function davisBouldinIndex() {
        let db = 0;
        for (let i = 0; i < clusters.length; i++) {
            let maxR = -Infinity;
            for (let j = i + 1; j < clusters.length; j++) {
                if (i === j) continue;
                // let dataIdxMin = Math.min(medoids[i], medoids[j]),
                //     dataIdxMax = Math.max(medoids[i], medoids[j]);
                let clustersDist = distMatrix[medoids[i]][medoids[j]];//distMatrix[dataIdxMin][dataIdxMax - dataIdxMin - 1];
                let Rij = (clusteringScores.clusterRadiuses[i] + clusteringScores.clusterRadiuses[j]) / clustersDist;
                if (maxR < Rij) {
                    maxR = Rij;
                }
            }
            if (isFinite(maxR)) {    
                db += maxR;
            }
        }
        db /= clusters.length;
        return db;
    }
    function initMedoids() {
        // randomly pick up k SS from the dataset
        let medoids = [];
        while (medoids.length < clusterNum) {
            let medoid = Math.floor(Math.random() * Math.floor(data.length));
            if (medoids.indexOf(medoid) < 0)
                medoids.push(medoid);
        }
        let labels = assignSSToMedoids(medoids);
        let score = evalInit(medoids, labels);

        return [medoids, score, labels];
    }
    function evalInit(medoids, labels) {
        // compute errors between a medoid and SS
        let errorSum = 0;
        for (let i = 0; i < labels.length; i++) {
            if (i !== medoids[labels[i]]) {
                errorSum += distMatrix[i][medoids[labels[i]]];
            }
            // if (i < medoids[labels[i]]) {
            //     errorSum += distMatrix[i][medoids[labels[i]] - i - 1];
            // } else if (medoids[labels[i]] < i) {
            //     errorSum += distMatrix[medoids[labels[i]]][i - medoids[labels[i]] - 1];
            // }
        }
        return errorSum;
    }
    function assignSSToMedoids(medoids) {
        let labels = [];
        for (let i = 0; i < data.length; i++) {
            // if data[i] is a medoid
            let medoidCheck = medoids.indexOf(i);
            if (medoidCheck >= 0) {
                labels.push(medoidCheck);
                continue;
            }
            let NNMedoid = 0,
                NNDist = distMatrix[i][NNMedoid];//distMatrix[Math.min(i, NNMedoid)][Math.max(i, NNMedoid) - Math.min(i, NNMedoid) - 1];
            for (let j = 1; j < medoids.length; j++) {
                // compare data[i] and medoid[j] (=data[medoids[j]])
                if (distMatrix[i][medoids[j]] < NNDist) {
                    NNMedoid = j;
                    NNDist = distMatrix[i][medoids[j]];
                }
                // if (i < medoids[j]) {
                //     if (distMatrix[i][medoids[j] - i - 1] < NNDist) {
                //         NNMedoid = j;
                //         NNDist = distMatrix[i][medoids[j] - i - 1];
                //     }
                // } else if (medoids[j] < i) {
                //     if (distMatrix[medoids[j]][i - medoids[j] - 1] < NNDist) {
                //         NNMedoid = j;
                //         NNDist = distMatrix[medoids[j]][i - medoids[j] - 1];
                //     }
                // }
            }
            labels.push(NNMedoid);
        }
        return labels;
    }
    function updateMedoids(labels) {
        // divide SS by clusters
        let clusters = [];
        for (let i = 0; i < clusterNum; i++) {
            clusters.push([]);
        }
        for (let i = 0; i < labels.length; i++) {
            clusters[labels[i]].push(i);
        }
        let newMedoids = [], distSumFinal = [];
        for (let i = 0; i < clusterNum; i++) {
            // find the best medoid from each cluster
            let newMedoidTmp = 0,
                minDistSum = Infinity;
            for (let j = 0; j < clusters[i].length; j++) {
                // if the medoid of the cluster is clusters[i], how much the total distance between the medoid and other SS
                let distSumTmp = 0;
                for (let k = 0; k < clusters[i].length; k++) {
                    if (clusters[i][j] === clusters[i][k]) {
                        continue;
                    } else {
                        distSumTmp += distMatrix[clusters[i][j]][clusters[i][k]];
                    }
                    
                    // else if (clusters[i][j] < clusters[i][k]) {
                    //     distSumTmp += distMatrix[clusters[i][j]][clusters[i][k] - clusters[i][j] - 1];
                    // } else if (clusters[i][k] < clusters[i][j]) {
                    //     distSumTmp += distMatrix[clusters[i][k]][clusters[i][j] - clusters[i][k] - 1];
                    // }
                    if (minDistSum < distSumTmp)
                        break;
                }
                if (distSumTmp < minDistSum) {
                    newMedoidTmp = clusters[i][j];
                    minDistSum = distSumTmp;
                }
            }
            newMedoids.push(newMedoidTmp);
            distSumFinal.push(minDistSum);
        }
        return [newMedoids, distSumFinal];
    }
}

function kMeans(data, clusterNum, distanceParameters, variables) {
    // step 1: randomly assign SS to k clusters
    // step 2: compute barycenters (centroids) of the clusters
    // step 3: re-assign SS to the nearest cluster
    // step 4: repeat steps 2 and 3 if there are any changes the nodes in the cluster
    let variableList = variables.filter(ele => ele !== 'z');
    // distMatrix is for computing silhouette coefficient
    let distMatrix = distanceMatrix(data, distanceParameters, variableList);
    let dataLen = data[0].length;
    let clusteringScores = {};

    let maxTrial = 10;
    let centroids = [], labels = [], distsToClusters;// = assignSSToCentroids(centroids);
    let bestDist = Infinity, bestCentroids, bestLabels, bestDistsToClusters;
    for (let i = 0; i < maxTrial; i++) {
        centroids = [], labels = [], distsToClusters = [];
        // initialize centroids
        centroids = initCentroids();
        let centroidsTmp;
        [labels, distsToClusters, centroidsTmp] = assignSSToCentroids(centroids);
        if (centroidsTmp.length > 0) {
            centroids = centroidsTmp;
        }

        let newCentroids = [], newLabels = [], distsToClusters;
        // step 3 and 4
        let loop = 0, maxIteration = 300;
        while (loop < maxIteration && checkUpdates(labels, newLabels)) {
            if (newCentroids.length !== 0 && newLabels.length !== 0) {
                centroids = newCentroids;
                labels = newLabels;
            }
            newCentroids = updateCentroids(labels, dataLen);
            let newCentroidsTmp;
            [newLabels, distsToClusters, newCentroidsTmp] = assignSSToCentroids(newCentroids);
            if (newCentroidsTmp.length > 0) {
                newCentroids = newCentroidsTmp;
            }
            loop++;
        }
        centroids = newCentroids;
        labels = newLabels;

        // if the total distances to clusters are smaller than the previous results
        let distSumTmp = 0;
        for (let i = 0; i < distsToClusters.length; i++) {
            distSumTmp += distsToClusters[i][labels[i].cluster];
        }
        if (distSumTmp < bestDist) {
            bestDist = distSumTmp;
            bestCentroids = centroids;
            bestLabels = labels;
            bestDistsToClusters = distsToClusters;
        }
    }
    centroids = bestCentroids;//newCentroids;
    labels = bestLabels;//newLabels;
    distsToClusters = bestDistsToClusters;

    let clusters = divideSSIntoClusters();
    let distsBetweenClusters;

    clusteringScores.clusterRadiuses = clusterRadius(clusters.map(x => x.length));
    [clusteringScores.silhouette, clusteringScores.silhouetteSS] = silhouetteCoefficient();
    [clusteringScores.davisBouldin, distsBetweenClusters] = davisBouldinIndex();

    return [centroids, labels, clusteringScores, distMatrix, distsToClusters, distsBetweenClusters];

    // function createCentroids() {
    //     // choose k SS from the dataset as a initial centroid of the clusters
    //     let initCentroidsIdx = [],
    //         initCentroids = [];
    //     while (initCentroidsIdx.length < clusterNum) {
    //         let centroidTmp = Math.floor(Math.random() * Math.floor(data.length));
    //         if (initCentroidsIdx.indexOf(centroidTmp) < 0)
    //             initCentroidsIdx.push(centroidTmp);
    //     }
    //     for (let i = 0; i < initCentroidsIdx.length; i++) {
    //         initCentroids.push(data[initCentroidsIdx[i]]);
    //     }
    //     return initCentroids;
    // }
    function divideSSIntoClusters() {
        let clustersTmp = [];
        for (let i = 0; i < clusterNum; i++) {
            clustersTmp.push([]);
        }
        for (let i = 0; i < labels.length; i++) {
            clustersTmp[labels[i].cluster].push(i);
        }
        return clustersTmp;
    }
    function clusterRadius(counters) {
        let radiuses = [];
        let distSum = [];
        for (let i = 0; i < clusterNum; i++) {
            distSum.push(0);
        }
        for (let i = 0; i < labels.length; i++) {
            distSum[labels[i].cluster] += distsToClusters[i][labels[i].cluster];
        }
        for (let i = 0; i < clusterNum; i++) {
            radiuses.push(distSum[i] / counters[i]);
        }
        return radiuses;
    }
    function silhouetteCoefficient() {
        // silhouette: silhouette coefficient for whole clustering results
        // silhouetteSS: silhouette coefficients for each SS
        let silhouette, silhouetteSS = [];
        silhouetteSS = Array(data.length).fill(0);
        for (let i = 0; i < clusters.length; i++) {
            for (let j = 0; j < clusters[i].length; j++) {
                // focus on data[clusters[i][j]]
                let cohesionTmp = 0, separationTmp = 0;
                let clusterNear, clusterNearDist = Infinity;
                // find the second nearest cluster of data[clusters[i][j]]
                for (let k = 0; k < clusterNum; k++) {
                    if (k !== i) {
                        if (distsToClusters[clusters[i][j]][k] < clusterNearDist) {
                            clusterNearDist = distsToClusters[clusters[i][j]][k];
                            clusterNear = k;
                        }
                    }
                }

                for (let k = 0; k < clusters[i].length; k++) {
                    if (clusters[i][j] !== clusters[i][k]) {
                        // let dataIdxMin = Math.min(clusters[i][j], clusters[i][k]),
                        //     dataIdxMax = Math.max(clusters[i][j], clusters[i][k]);
                        cohesionTmp += distMatrix[clusters[i][j]][clusters[i][k]];//distMatrix[dataIdxMin][dataIdxMax - dataIdxMin - 1];
                    }
                }
                cohesionTmp /= (clusters[i].length - 1);
                for (let k = 0; k < clusters[clusterNear].length; k++) {
                    // let dataIdxMin = Math.min(clusters[i][j], clusters[clusterNear][k]),
                    //     dataIdxMax = Math.max(clusters[i][j], clusters[clusterNear][k]);
                    separationTmp += distMatrix[clusters[i][j]][clusters[clusterNear][k]];//distMatrix[dataIdxMin][dataIdxMax - dataIdxMin - 1];
                }
                separationTmp /= clusters[clusterNear].length;
                silhouetteSS[clusters[i][j]] = (separationTmp - cohesionTmp) / Math.max(cohesionTmp, separationTmp);
            }
        }
        silhouette = silhouetteSS.reduce((sum, element) => sum + element, 0);
        silhouette /= silhouetteSS.length;
        return [silhouette, silhouetteSS];   
    }
    function davisBouldinIndex() {
        let db = 0;
        let clusterDists = [];
        for (let i = 0; i < clusters.length; i++) {
            clusterDists.push([]);
            for (let j = 0; j < clusters.length; j++) {
                clusterDists[i].push(0);
            }
        }
        for (let i = 0; i < clusters.length; i++) {
            let maxR = -Infinity;
            for (let j = i + 1; j < clusters.length; j++) {
                if (i === j) continue;
                //     let dataIdxMin = Math.min(medoids[i], medoids[j]),
                //         dataIdxMax = Math.max(medoids[i], medoids[j]);
                //     let clustersDist = distMatrix[dataIdxMin][dataIdxMax - dataIdxMin - 1];
                //     let Rij = (clusteringScores.clusterRadiuses[i] + clusteringScores.clusterRadiuses[j]) / clustersDist;
                //     if (maxR < Rij) {
                //         maxR = Rij;
                //     }
                    // compute distances between clusters
                switch(distanceParameters.metric) {
                    case 'Euclidean':
                        break;
                    case 'DTWD':
                        if (distanceParameters.window > 0) {
                            let clusterDist = DTWMD(centroids[i], centroids[j], variableList, distanceParameters.window, distanceParameters.distFunc);
                            clusterDists[i][j] = clusterDist[clusterDist.length - 1][clusterDist[0].length - 1];
                            let Rij = (clusteringScores.clusterRadiuses[i] + clusteringScores.clusterRadiuses[j]) / clusterDist[clusterDist.length - 1][clusterDist[0].length - 1];
                            if (maxR < Rij) {
                                maxR = Rij;
                            }
                        } else {
                            let clusterDist = DTWSimpleMD(centroids[i], centroids[j], variableList, distanceParameters.distFunc);
                            clusterDists[i][j] = clusterDist[clusterDist.length - 1][clusterDist[0].length - 1];
                            let Rij = (clusteringScores.clusterRadiuses[i] + clusteringScores.clusterRadiuses[j]) / clusterDist[clusterDist.length - 1][clusterDist[0].length - 1];
                            if (maxR < Rij) {
                                maxR = Rij;
                            }
                        }
                        break;
                    case 'DTWI':
                        if (distanceParameters.window > 0) {
                            let clusterDist = DTW(centroids[i], centroids[j], variableList, distanceParameters.window, distanceParameters.distFunc);
                            let distSum = 0;
                            variableList.forEach(key => {
                                distSum += clusterDist[key][clusterDist[key].length - 1][clusterDist[key][0].length - 1];
                            });
                            clusterDists[i][j] = distSum;
                            let Rij = (clusteringScores.clusterRadiuses[i] + clusteringScores.clusterRadiuses[j]) / distSum;
                            if (maxR < Rij) {
                                maxR = Rij;
                            }
                        } else {
                            let clusterDist = DTWSimple(centroids[i], centroids[j], variableList, distanceParameters.distFunc);
                            let distSum = 0;
                            variableList.forEach(key => {
                                distSum += clusterDist[key][clusterDist[key].length - 1][clusterDist[key][0].length - 1];
                            });
                            clusterDists[i][j] = distSum;
                            let Rij = (clusteringScores.clusterRadiuses[i] + clusteringScores.clusterRadiuses[j]) / distSum;
                            if (maxR < Rij) {
                                maxR = Rij;
                            }
                        }
                        break;
                    default:
                        break;
                }
            }
            if (isFinite(maxR)) {
                db += maxR;
            }
        }
        db /= clusters.length;
        return [db, clusterDists];
    }
    function initCentroids() {
        let clusters = [], clustersTmp = [];
        let newCentroid = [];
        for (let i = 0; i < clusterNum * 2; i++) {
        // 空のクラスタが生じるのを防ぐために、最初のk * 2個は順番に番号振ってる
            clustersTmp.push(i % clusterNum);
        }
        for (let i = clusterNum * 2; i < data.length; i++) {
            clustersTmp.push(Math.floor(Math.random() * clusterNum));
        }
        clustersTmp = shuffle(clustersTmp);
        for (let i = 0; i < clusterNum; i++) {
            clusters.push([]);
            newCentroid.push([]);
        }
        for (let i = 0; i < clustersTmp.length; i++) {
            clusters[clustersTmp[i]].push(i);
        }
        // DBAで各クラスタのセントロイドを求める 
        switch(distanceParameters.metric) {
            case 'Euclidean':
                break;
            case 'DTWD':
                for (let i = 0; i < clusters.length; i++) {
                    // 最初に仮の中心をデータのなかからランダムに決める
                    let pCentroid = data[clusters[i][Math.floor(Math.random() * clusters[i].length)]];
                    let loopInit = 0, maxIterationInit = 10;
                    // maxIterationInitはDBAを用いた重心導出の最大試行回数
                    if (distanceParameters.window > 0) {
                        loopInit = 0;
                        while (loopInit < maxIterationInit) {
                            // empty array for storing temporal centroid
                            let centroidTmp = [],
                                dataCount = [];
                            for (let j = 0; j < dataLen; j++) {
                                let dataTmp = {};
                                variableList.forEach(key => {
                                    dataTmp[key] = 0;
                                });
                                centroidTmp.push(dataTmp);
                                dataCount.push(0);
                            }

                            // run DBA and get barycenter
                            for (let j = 0; j < clusters[i].length; j++) {
                                let distTmp = DTWMD(pCentroid, data[clusters[i][j]], variableList, distanceParameters.window, distanceParameters.distFunc);
                                let path = OptimalWarpingPath(distTmp);
                                for (let k = 0; k < path.length; k++) {
                                    variableList.forEach(key => {
                                        centroidTmp[path[k][0]][key] += data[clusters[i][j]][path[k][1]][key];
                                    });
                                    dataCount[path[k][0]]++;
                                }
                            }
                            // average
                            for (let j = 0; j < centroidTmp.length; j++) {
                                for (let key in centroidTmp[j]) {
                                    centroidTmp[j][key] /= dataCount[j];
                                }
                            }
                            if (!checkUpdateInitCentroids(pCentroid, centroidTmp)) {
                                // if pCentroid and centroidTmp is the same (= no updates), stop this iteration
                                // newCentroid.push(centroidTmp);
                                for (let k = 0; k < centroidTmp.length; k++) {
                                    let dataTmp = {};
                                    variableList.forEach(key => {
                                        dataTmp[key] =  centroidTmp[k][key];
                                    });
                                    newCentroid[i].push(dataTmp);
                                }
                                break;
                            }
                            loopInit++;
                            if (loopInit === maxIterationInit && newCentroid[i].length !== i + 1) {
                                // if centroid is not set for cluster i
                                // newCentroid.push(centroidTmp);
                                for (let k = 0; k < centroidTmp.length; k++) {
                                    let dataTmp = {};
                                    variableList.forEach(key => {
                                        dataTmp[key] =  centroidTmp[k][key];
                                    });
                                    newCentroid[i].push(dataTmp);
                                }
                            }
                        }
                    } else {
                        loopInit = 0;
                        while (loopInit < maxIterationInit) {
                            // empty array for storing temporal centroid
                            let centroidTmp = [];
                            let dataCount = [];
                            for (let j = 0; j < dataLen; j++) {
                                let dataTmp = {};
                                variableList.forEach(key => {
                                    dataTmp[key] = 0;
                                });
                                centroidTmp.push(dataTmp);
                                dataCount.push(0);
                            }

                            // run DBA and get barycenter
                            for (let j = 0; j < clusters[i].length; j++) {
                                let distTmp = DTWSimpleMD(pCentroid, data[clusters[i][j]], variableList, distanceParameters.distFunc);
                                let path = OptimalWarpingPath(distTmp);
                                for (let k = 0; k < path.length; k++) {
                                    variableList.forEach(key => {
                                        centroidTmp[path[k][0]][key] += data[clusters[i][j]][path[k][1]][key];
                                    });
                                    dataCount[path[k][0]]++;
                                }
                            }
                            // average
                            for (let j = 0; j < centroidTmp.length; j++) {
                                for (let key in centroidTmp[j]) {
                                    centroidTmp[j][key] /= dataCount[j];
                                }
                            }
                            if (!checkUpdateInitCentroids(pCentroid, centroidTmp)) {
                                // if pCentroid and centroidTmp is the same (= no updates), stop this iteration
                                // newCentroid.push(centroidTmp);
                                // newCentroid[i] = centroidTmp;
                                for (let k = 0; k < centroidTmp.length; k++) {
                                    let dataTmp = {};
                                    variableList.forEach(key => {
                                        dataTmp[key] =  centroidTmp[k][key];
                                    });
                                    newCentroid[i].push(dataTmp);
                                }
                                break;
                            }
                            loopInit++;
                            if (loopInit === maxIterationInit && newCentroid[i].length === 0) {
                                // if centroid is not set for cluster i
                                // newCentroid[i] = centroidTmp;
                                for (let k = 0; k < centroidTmp.length; k++) {
                                    let dataTmp = {};
                                    variableList.forEach(key => {
                                        dataTmp[key] =  centroidTmp[k][key];
                                    });
                                    newCentroid[i].push(dataTmp);
                                }
                            }
                        }
                    }
                }
                break;
            case 'DTWI':
                for (let i = 0; i < clusters.length; i++) {
                    let pCentroid = data[clusters[i][Math.floor(Math.random() * clusters[i].length)]];
                    let loopInit = 0, maxIterationInit = 10;
                    // maxIterationInitはDBAを用いた重心導出の最大試行回数
                    if (distanceParameters.window > 0) {
                        loopInit = 0;
                        while (loopInit < maxIterationInit) {
                            // empty array for storing temporal centroid
                            let centroidTmp = [],
                                dataCount = [];
                            for (let j = 0; j < dataLen; j++) {
                                let dataTmp = {}, countTmp = {};
                                variableList.forEach(key => {
                                    dataTmp[key] = 0;
                                    countTmp[key] = 0;
                                });
                                centroidTmp.push(dataTmp);
                                dataCount.push(countTmp);
                            }

                            // run DBA and get barycenter
                            for (let j = 0; j < clusters[i].length; j++) {
                                let distTmp = DTW(pCentroid, data[clusters[i][j]], variableList, distanceParameters.window, distanceParameters.distFunc);
                                let path = OptimalWarpingPath(distTmp);
                                variableList.forEach(key => {
                                    for (let k = 0; k < path[key].length; k++) {
                                        centroidTmp[path[key][k][0]][key] += data[clusters[i][j]][path[key][k][1]][key];
                                        dataCount[path[key][k][0]][key]++;
                                    }
                                });
                            }
                            // average
                            for (let j = 0; j < centroidTmp.length; j++) {
                                for (let key in centroidTmp[j]) {
                                    centroidTmp[j][key] /= dataCount[j][key];
                                }
                            }

                            if (!checkUpdateInitCentroids(pCentroid, centroidTmp)) {
                                // if pCentroid and centroidTmp is the same (= no updates), stop this iteration
                                // newCentroid.push(centroidTmp);
                                for (let k = 0; k < centroidTmp.length; k++) {
                                    let dataTmp = {};
                                    variableList.forEach(key => {
                                        dataTmp[key] =  centroidTmp[k][key];
                                    });
                                    newCentroid[i].push(dataTmp);
                                }
                                break;
                            }
                            loopInit++;
                            if (loopInit === maxIterationInit && newCentroid[i].length !== i + 1) {
                                // if centroid is not set for cluster i
                                // newCentroid.push(centroidTmp);
                                for (let k = 0; k < centroidTmp.length; k++) {
                                    let dataTmp = {};
                                    variableList.forEach(key => {
                                        dataTmp[key] =  centroidTmp[k][key];
                                    });
                                    newCentroid[i].push(dataTmp);
                                }
                            }
                        }
                    } else {
                        loopInit = 0;
                        while (loopInit < maxIterationInit) {
                            // empty array for storing temporal centroid
                            let centroidTmp = [],
                                dataCount = [];
                            for (let j = 0; j < dataLen; j++) {
                                let dataTmp = {}, countTmp = {};
                                variableList.forEach(key => {
                                    dataTmp[key] = 0;
                                    countTmp[key] = 0;
                                });
                                centroidTmp.push(dataTmp);
                                dataCount.push(countTmp);
                            }

                            // run DBA and get barycenter
                            for (let j = 0; j < clusters[i].length; j++) {
                                let distTmp = DTWSimple(pCentroid, data[clusters[i][j]], variableList, distanceParameters.distFunc);
                                let path = OptimalWarpingPath(distTmp);
                                variableList.forEach(key => {
                                    for (let k = 0; k < path[key].length; k++) {
                                        centroidTmp[path[key][k][0]][key] += data[clusters[i][j]][path[key][k][1]][key];
                                        dataCount[path[key][k][0]][key]++;
                                    }
                                });
                            }
                            // average
                            for (let j = 0; j < centroidTmp.length; j++) {
                                for (let key in centroidTmp[j]) {
                                    centroidTmp[j][key] /= dataCount[j][key];
                                }
                            }

                            if (!checkUpdateInitCentroids(pCentroid, centroidTmp)) {
                                // if pCentroid and centroidTmp is the same (= no updates), stop this iteration
                                // newCentroid.push(centroidTmp);
                                for (let k = 0; k < centroidTmp.length; k++) {
                                    let dataTmp = {};
                                    variableList.forEach(key => {
                                        dataTmp[key] =  centroidTmp[k][key];
                                    });
                                    newCentroid[i].push(dataTmp);
                                }
                                break;
                            }
                            loopInit++;
                            if (loopInit === maxIterationInit && newCentroid[i].length !== i + 1) {
                                // if centroid is not set for cluster i
                                // newCentroid.push(centroidTmp);
                                for (let k = 0; k < centroidTmp.length; k++) {
                                    let dataTmp = {};
                                    variableList.forEach(key => {
                                        dataTmp[key] =  centroidTmp[k][key];
                                    });
                                    newCentroid[i].push(dataTmp);
                                }
                            }
                        }
                    }
                }
                break;
        }
        return newCentroid;
        function checkUpdateInitCentroids(pCentroid, nCentroid) {
            let flag = false;
            for (let i = 0; i < pCentroid.length; i++) {
                for (let key in pCentroid[i]) {
                    if (pCentroid[i][key] !== nCentroid[i][key]) {
                        flag = true;
                        break;
                    }
                } 
                if (flag) break;
            }
            return flag;
        }
    }
    function assignSSToCentroids(currentCentroids) {
        // distToClusters: distances between a data and cluster centers
        let centroidsTmp = [];//currentCentroids.slice(0, currentCentroids.length);
        let labels = [], distsToClusters = [];
        let clusterCount = [];
        for (let i = 0; i < clusterNum; i++) {
            clusterCount.push(0);
        }
        for (let i = 0; i < data.length; i++) {
            let NNDist = Infinity,
                NNDistMat,
                NNCentroid;
            distsToClusters.push([]);
            for (let j = 0; j < currentCentroids.length; j++) {
                // compute distances between centroids and SS
                let distTmp = 0;
                switch (distanceParameters.metric) {
                    case 'Euclidean':
                        break;
                    case 'DTWD':
                        if (distanceParameters.window > 0) {
                            // DTWMD
                            distTmp = DTWMD(currentCentroids[j], data[i], variableList, distanceParameters.window, distanceParameters.distFunc);
                            distsToClusters[i].push(distTmp[distTmp.length - 1][distTmp[0].length - 1]);
                            if (distTmp[distTmp.length - 1][distTmp[0].length - 1] < NNDist) {
                                NNDist = distTmp[distTmp.length - 1][distTmp[0].length - 1];
                                NNCentroid = j;
                                NNDistMat = distTmp;
                                // NNDistPath = OptimalWarpingPath(distTmp);
                            }
                        } else {
                            // DTWSimpleMD
                            distTmp = DTWSimpleMD(currentCentroids[j], data[i], variableList, distanceParameters.distFunc);
                            distsToClusters[i].push(distTmp[distTmp.length - 1][distTmp[0].length - 1]);
                            if (distTmp[distTmp.length - 1][distTmp[0].length - 1] < NNDist) {
                                NNDist = distTmp[distTmp.length - 1][distTmp[0].length - 1];
                                NNCentroid = j;
                                NNDistMat = distTmp;
                                // NNDistPath = OptimalWarpingPath(distTmp);
                            }
                        }
                        break;
                    case 'DTWI':
                        if (distanceParameters.window > 0) {
                            // DTW
                            distTmp = DTW(currentCentroids[j], data[i], variableList, distanceParameters.window, distanceParameters.distFunc);
                            let distSum = 0;
                            variableList.forEach(key => {
                                distSum += distTmp[key][distTmp[key].length - 1][distTmp[key][0].length - 1];
                            });
                            distsToClusters[i].push(distSum);
                            if (distSum < NNDist) {
                                NNDist = distSum;
                                NNCentroid = j;
                                NNDistMat = distTmp;
                                // NNDistPath = OptimalWarpingPath(distTmp);
                            }
                        } else {
                            // DTWSimple
                            distTmp = DTWSimple(currentCentroids[j], data[i], variableList, distanceParameters.distFunc);
                            let distSum = 0;
                            variableList.forEach(key => {
                                distSum += distTmp[key][distTmp[key].length - 1][distTmp[key][0].length - 1];
                            });
                            distsToClusters[i].push(distSum);
                            if (distSum < NNDist) {
                                NNDist = distSum;
                                NNCentroid = j;
                                NNDistMat = distTmp;
                                // NNDistPath = OptimalWarpingPath(distTmp);
                            }
                        }
                        break;
                    default:
                        break;
                }
            }
            labels.push({
                cluster: NNCentroid,
                path: OptimalWarpingPath(NNDistMat)//NNDistPath
            });
            // dists.push(NNDist);
            clusterCount[NNCentroid]++;
        }
        // check if there are empty clusters
        let singletons = [];
        for (let i = 0; i < clusterNum; i++) {
            if (clusterCount[i] === 0) {
                // TODO: クラスタが空の際の処理。複数オプション用意すべき
                // singleton
                // 空クラスタの中心から一番遠いデータ点を探索する
                let maxIdx = -1, maxDist = -Infinity;
                for (let j = 0; j < distsToClusters.length; j++) {
                    if (maxDist < distsToClusters[j][i]) {
                        maxIdx = j;
                        maxDist = distsToClusters[j][i];
                    }
                }
                // for (let j = 0; j < data.length; j++) {
                //     if (singletons.indexOf(j) < 0) {
                //         switch (distanceParameters.metric) {
                //             case 'Euclidean': 
                //                 break;
                //             case 'DTWD':
                //                 if (distanceParameters.window > 0) {
                //                     let distTmp = DTWMD(centroids[i], data[j], variableList, distanceParameters.window, distanceParameters.distFunc);
                //                     if (maxDist < distTmp[distTmp.length - 1][distTmp[0].length - 1]) {
                //                         maxIdx = j;
                //                         maxDist = distTmp[distTmp.length - 1][distTmp[0].length - 1];
                //                     }
                //                 } else {
                //                     let distTmp = DTWSimpleMD(centroids[i], data[j], variableList, distanceParameters.distFunc);
                //                     if (maxDist < distTmp[distTmp.length - 1][distTmp[0].length - 1]) {
                //                         maxIdx = j;
                //                         maxDist = distTmp[distTmp.length - 1][distTmp[0].length - 1];
                //                     }
                //                 }
                //                 break;
                //             case 'DTWI':
                //                 if (distanceParameters.window > 0) {
                //                     let dists = DTW(centroids[i], data[j], variableList, distanceParameters.window, distanceParameters.distFunc);
                //                     let distSum = 0;
                //                     variableList.forEach(key => {
                //                         distSum += dists[key][dists[key].length - 1][dists[key][0].length - 1];
                //                     });
                //                     if (maxDist < distSum) {
                //                         maxIdx = j;
                //                         maxDist = distSum;
                //                     }
                //                 } else {
                //                     let dists = DTWSimple(centroids[i], data[j], variableList, distanceParameters.distFunc);
                //                     let distSum = 0;
                //                     variableList.forEach(key => {
                //                         distSum += dists[key][dists[key].length - 1][dists[key][0].length - 1];
                //                     });
                //                     if (maxDist < distSum) {
                //                         maxIdx = j;
                //                         maxDist = distSum;
                //                     }
                //                 }
                //                 break;
                //             default:
                //                 break;
                //         }
                //     }
                // }
                let path = {};
                variableList.forEach(key => {
                    let pathTmp = [];
                    for (let j = 0; j < dataLen; j++) {
                        pathTmp.push([j, j]);
                    }
                    path[key] = pathTmp;
                });
                labels[maxIdx] = {
                    cluster: i,
                    path: path
                };
                // dists[maxIdx] = 0;//maxDist;
                
                // let centroidTmp = [];
                // for (let j = 0; j < data[maxIdx].length; j++) {
                //     let tmp = {};
                //     variableList.forEach(key => {
                //         tmp[key] = data[maxIdx][key];
                //     });
                //     centroidTmp.push(tmp);
                // }
                let centroidTmp = [];//data[maxIdx];//centroidTmp;
                let dataKeys = Object.keys(data[maxIdx][0]);
                for (let j = 0; j < data[maxIdx].length; j++) {
                    let dataTmp = Object.assign({}, data[maxIdx][j]);
                    dataKeys.forEach(key => {
                        if (variableList.indexOf(key) < 0) {
                            delete dataTmp[key];
                        }
                     });
                     centroidTmp.push(dataTmp);
                }
                singletons.push({
                    maxIdx: maxIdx,
                    cluster: i,
                    centroid: centroidTmp
                });


                // update a distance between new cluster and data points
                for (let j = 0; j < data.length; j++) {
                    if (j === maxIdx) {
                        distsToClusters[maxIdx][i] = 0;
                        continue;
                    }
                    let dist = 0;
                    switch (distanceParameters.metric) {
                        case 'Euclidean':
                            break;
                        case 'DTWD':
                            if (distanceParameters.window > 0) {
                                // DTWMD
                                dist = DTWMD(centroidTmp, data[j], variableList, distanceParameters.window, distanceParameters.distFunc);
                                distsToClusters[j][i] = dist[dist.length - 1][dist[0].length - 1];
                            } else {
                                // DTWSimpleMD
                                dist = DTWSimpleMD(centroidTmp, data[j], variableList, distanceParameters.distFunc);
                                distsToClusters[j][i] = dist[dist.length - 1][dist[0].length - 1];
                            }
                            break;
                        case 'DTWI':
                            if (distanceParameters.window > 0) {
                                // DTW
                                dist = DTW(centroidTmp, data[j], variableList, distanceParameters.window, distanceParameters.distFunc);
                                let distSum = 0;
                                variableList.forEach(key => {
                                    distSum += dist[key][dist[key].length - 1][dist[key][0].length - 1];
                                });
                                distsToClusters[j][i] = distSum;
                            } else {
                                // DTWSimple
                                dist = DTWSimple(centroidTmp, data[j], variableList, distanceParameters.distFunc);
                                let distSum = 0;
                                variableList.forEach(key => {
                                    distSum += dist[key][dist[key].length - 1][dist[key][0].length - 1];
                                });
                                distsToClusters[j][i] = distSum;
                            }
                            break;
                        default:
                            break;
                    }
                }
            }
        }
        if (singletons.length > 0) {
            centroidsTmp = currentCentroids.slice(0, currentCentroids.length);
            for (let i = 0; i < singletons.length; i++) {
                centroidsTmp[singletons[i].cluster] = singletons[i].centroid;
            }
            // reassign SS to new clusters
            labels = [];
            for (let i = 0; i < data.length; i++) {
                let newMinDist = Infinity,
                    newNNCluster = -1;
                for (let j = 0; j < clusterNum; j++) {
                    if (distsToClusters[i][j] < newMinDist) {
                        newMinDist = distsToClusters[i][j];
                        newNNCluster = j;
                    }
                }
                let distTmp;
                switch (distanceParameters.metric) {
                    case 'Euclidean':
                        break;
                    case 'DTWD':
                        if (distanceParameters.window > 0) {
                            distTmp = DTWMD(centroidsTmp[newNNCluster], data[i], variableList, distanceParameters.window, distanceParameters.distFunc);
                        } else {
                            distTmp = DTWSimpleMD(centroidsTmp[newNNCluster], data[i], variableList, distanceParameters.distFunc);
                        }
                        break;
                    case 'DTWI':
                        if (distanceParameters.window > 0) {
                            distTmp = DTW(centroidsTmp[newNNCluster], data[i], variableList, distanceParameters.window, distanceParameters.distFunc);
                        } else {
                            distTmp = DTWSimple(centroidsTmp[newNNCluster], data[i], variableList, distanceParameters.distFunc);
                        }
                        break;
                }
                labels.push({
                    cluster: newNNCluster,
                    path: OptimalWarpingPath(distTmp)
                });
            }
        }
        // for (let i = 0; i < labels.length; i++) {
        //     distSum[labels[i].cluster] += dists[i];
        // }
        return [labels, distsToClusters, centroidsTmp];
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
                        // check the path between the current centroid and data[clusters[i][j]] (labels[clusters[i][j]].path)labels[clusters[i][j]].path
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
                            if (centroidTmp[j][key] == 0) {
                            }
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
//     if (Array.isArray(cost)) {
//         let path = [];
//         let i = cost.length - 1,    // y axis: source (SS)
//             j = cost[0].length - 1; // x axis: target (centroid/medoid)
//         path.push([j, i]);
//         while (i > 0 && j > 0) {
//             if (i === 0) {
//                 j--;
//             } else if (j === 0) {
//                 i--;
//             } else {
//                 if (cost[i - 1][j] === Math.min(cost[i - 1][j - 1], cost[i - 1][j], cost[i][j - 1])) {
//                     i--;
//                 } else if (cost[i][j - 1] === Math.min(cost[i - 1][j - 1], cost[i - 1][j], cost[i][j - 1])) {
//                     j--;
//                 } else {
//                     i--;
//                     j--;
//                 }
//             }
//             path.push([j, i]);
//         }
//         path.push([0, 0]);
//         return path;
//     } else if (typeof(cost) === 'object') {
//         let paths = {};
//         for (let key in cost) {
//             let path = [];
//             let i = cost[key].length - 1,    // y axis: source (SS)
//                 j = cost[key][0].length - 1; // x axis: target (centroid/medoid)
//             path.push([j, i]);
//             while (i > 0 && j > 0) {
//                 if (i === 0) {
//                     j--;
//                 } else if (j === 0) {
//                     i--;
//                 } else {
//                     if (cost[key][i - 1][j] === Math.min(cost[key][i - 1][j - 1], cost[key][i - 1][j], cost[key][i][j - 1])) {
//                         i--;
//                     } else if (cost[key][i][j - 1] === Math.min(cost[key][i - 1][j - 1], cost[key][i - 1][j], cost[key][i][j - 1])) {
//                         j--;
//                     } else {
//                         i--;
//                         j--;
//                     }
//                 }
//                 path.push([j, i]);
//             }
//             path.push([0, 0]);
//             paths[key] = path;
//         }
//         return paths;
//     }
// }

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

const shuffle = ([...array]) => {
    // https://www.nxworld.net/js-array-shuffle.html
    for (let i = array.length - 1; i >= 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}


function MDSClassical(distMatrix) {
    // https://www.hongfeili.com/files/paper100/paper4.pdf
    let distSquare = math.square(distMatrix);
    let identity = math.identity(distSquare.length);
    let ones = math.ones(distSquare.length, distSquare.length);

    // compute centering matrix
    let centeringMatrix = math.subtract(identity, math.multiply(1/distSquare.length, ones));
    // double centering
    let B = math.multiply(-0.5, centeringMatrix, distSquare, centeringMatrix);
    for (let i = 0; i < B._data.length; i++) {
        for (let j = 0; j < B._data.length;j++) {
            B._data[j][i] = B._data[i][j];
        }
    }
    let eigen = math.eigs(B._data);
    let eigenvalues = eigen.values;//._data;
    let eigenvectors = eigen.vectors;//._data;
    let eigenvectorsTranpose = math.transpose(eigenvectors);
    let eigenVal1 = eigenvalues[eigenvalues.length - 1],
        eigenVal2 = eigenvalues[eigenvalues.length - 2];
    let eigenVec1 = eigenvectorsTranpose[eigenvectorsTranpose.length - 1],
        eigenVec2 = eigenvectorsTranpose[eigenvectorsTranpose.length - 2];
    let diagEigenvalues = math.diag([eigenVal1, eigenVal2]);
    let sqrtDiagEigenvalues = math.sqrt(diagEigenvalues);
    let eigenvectorsM = [];
    eigenvectorsM.push(eigenVec1);
    eigenvectorsM.push(eigenVec2);
    eigenvectorsM = math.transpose(eigenvectorsM);
    let pos = math.multiply(eigenvectorsM, sqrtDiagEigenvalues);
    return pos;
}

// MDSClassical([[0,4,3], [4,0,5], [3,5,0]]);
// MDSClassical([[0,93,82,133],[93,0,52,60],[82,52,0,111],[133,60,111,0]])
