import { cluster } from 'd3';
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
    let clusterCenters, labels;
    switch (clusteringParameters.method) {
        case 'kmedoids':
            [clusterCenters, labels] = kMedoids(filteredSS, clusteringParameters.clusterNum, distanceParameters);
            break;
        case 'kmeans':
            kMeans(filteredSS, clusteringParameters.clusterNum, distanceParameters);
            break;
        default:
            break;
    }
    
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

function kMedoids(data, clusterNum, distanceParameters) {
    // step 1: compute distance matrix between SS
    // step 2: pick up k medoids from all SS
    // step 3: assign other SS to medoids
    // step 4: re-find medoids which minimize the total distances
    // step 5: repeat steps 3 and 4

    // step 1
    // note: when comparing SSi and SSj (i < j), refer distMatrix[i][j - i - 1]
    let variables = Object.keys(data[0][0]);
    variables = variables.filter(ele => ele !== 'z');
    let distMatrix = distanceMatrix(data, distanceParameters, variables);

    // step 2
    // find the inital medoids which make the errors inside the clusters minimum
    let init_search = 5;
    let score = Infinity, medoids, labels;
    for (let i = 0; i < init_search; i++) {
        // step 3
        let [medoidsTmp, scoreTmp, labelsTmp] = initMedoids();
        if (scoreTmp < score) {
            score = scoreTmp;
            medoids = medoidsTmp;
            labels = labelsTmp;
        }
    }

    // step 3 and 4
    let newMedoids = [], newLabels = [];
    let loop = 0, maxIteration = 300;
    while (medoids.filter(i => newMedoids.indexOf(i) == -1).length > 0 && loop < maxIteration) {
        // update medoids until there are no medoid updates or repeat updating medoids maxIteration times
        if (newMedoids.length !== 0 && newLabels.length !== 0) {
            medoids = newMedoids;
            labels = newLabels;
        }
        // step 3
        newMedoids = updateMedoids(medoids, labels);
        // step 4
        newLabels = assignSSToMedoids(newMedoids);
        loop++;
    }

    medoids = newMedoids;
    labels = newLabels;
    return [medoids, labels];

    function initMedoids() {
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
        // 直角状にdistmatrixからmedoidとの距離抜いてこれるはず？
        let errorSum = 0;
        for (let i = 0; i < labels.length; i++) {
            if (i < medoids[labels[i]]) {
                errorSum += distMatrix[i][medoids[labels[i]] - i - 1];
            } else if (medoids[labels[i]] < i) {
                errorSum += distMatrix[medoids[labels[i]]][i - medoids[labels[i]] - 1];
            }
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
                NNDist = distMatrix[Math.min(i, NNMedoid)][Math.max(i, NNMedoid) - Math.min(i, NNMedoid) - 1];
            for (let j = 1; j < medoids.length; j++) {
                // compare data[i] and medoid[j] (=data[medoids[j]])
                if (i < medoids[j]) {
                    if (distMatrix[i][medoids[j] - i - 1] < NNDist) {
                        NNMedoid = j;
                        NNDist = distMatrix[i][medoids[j] - i - 1];
                    }
                } else if (medoids[j] < i) {
                    if (distMatrix[medoids[j]][i - medoids[j] - 1] < NNDist) {
                        NNMedoid = j;
                        NNDist = distMatrix[medoids[j]][i - medoids[j] - 1];
                    }
                }
            }
            labels.push(NNMedoid);
        }
        return labels;
    }
    function updateMedoids(medoids, labels) {
        // divide SS by clusters
        let clusters = [];
        for (let i = 0; i < medoids.length; i++) {
            clusters.push([]);
        }
        for (let i = 0; i < labels.length; i++) {
            clusters[labels[i]].push(i);
        }
        let newMedoids = [];
        for (let i = 0; i < medoids.length; i++) {
            // find the best medoid from each cluster
            let newMedoidTmp = 0,
                minDistSum = Infinity;
            for (let j = 0; j < clusters[i].length; j++) {
                // if the medoid of the cluster is clusters[i], how much the total distance between the medoid and other SS
                let distSumTmp = 0;
                for (let k = 0; k < clusters[i].length; k++) {
                    if (clusters[i][j] === clusters[i][k]) {
                        continue;
                    } else if (clusters[i][j] < clusters[i][k]) {
                        distSumTmp += distMatrix[clusters[i][j]][clusters[i][k] - clusters[i][j] - 1];
                    } else if (clusters[k] > clusters[j]) {
                        distSumTmp += distMatrix[clusters[i][k]][clusters[i][j] - clusters[i][k] - 1];
                    }
                    if (minDistSum < distSumTmp)
                        break;
                }
                if (distSumTmp < minDistSum) {
                    newMedoidTmp = clusters[i][j];
                    minDistSum = distSumTmp;
                }
            }
            newMedoids.push(newMedoidTmp);
        }
        return newMedoids;
    }
}

function kMeans(data, clusterNum, distanceParameters) {
    // step 1: randomly assign SS to k clusters
    // step 2: compute barycenters (centroids) of the clusters
    // step 3: re-assign SS to the nearest cluster
    // step 4: repeat steps 2 and 3 if there are any changes the nodes in the cluster
    let variables = Object.keys(data[0][0]);
    variables = variables.filter(ele => ele !== 'z');
    let dataLen = data[0].length;

    // step 1 and 2
    let centroids = createCentroids();
    let labels = assignSSToCentroids(centroids);

    // step 3 and 4
    let newCentroids = [], newLabels = [];
    let loop = 0, maxIteration = 1;
    updateCentroids(centroids, labels, distanceParameters, dataLen);
    // while (loop < maxIteration) {
    //     updateCentroids(centroids, labels, distanceParameters);
    //     assignSSToCentroids();
    //     loop++;
    // }

    function createCentroids() {
        let initCentroids = [];
        while (initCentroids.length < clusterNum) {
            let centroidTmp = Math.floor(Math.random() * Math.floor(data.length));
            if (initCentroids.indexOf(centroidTmp) < 0)
                initCentroids.push(centroidTmp);
        }
        for (let i = 0; i < initCentroids.length; i++) {
            initCentroids[i] = data[initCentroids[i]];
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
                    case 'DTWD':
                        if (distanceParameters.window > 0) {
                            // DTWMD
                            distTmp = DTWMD(centroids[j], data[i], variables, distanceParameters.window, distanceParameters.distFunc);
                            if (distTmp[distTmp.length - 1][distTmp[0].length - 1] < NNDist) {
                                NNDist = distTmp[distTmp.length - 1][distTmp[0].length - 1];
                                NNCentroid = j;
                                NNDistPath = OptimalWarpingPath(distTmp);
                            }
                        } else {
                            // DTWSimpleMD
                            distTmp = DTWSimpleMD(centroids[j], data[i], variables, distanceParameters.distFunc);
                            if (distTmp[distTmp.length - 1][distTmp[0].length - 1] < NNDist) {
                                NNDist = distTmp[distTmp.length - 1][distTmp[0].length - 1];
                                NNCentroid = j;
                                NNDistPath = OptimalWarpingPath(distTmp);
                            }
                        }
                        break;
                    case 'DTWI':
                        break;
                    case 'Euclidean':
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
    function updateCentroids(centroids, labels, distanceParameters, dataLen) {
        // DBA
        // centroidとSSの距離を計算する
        // 最適なパスを見つける
        // centroid上の各データ点に対応する時系列上の点の値を足し合わせる、何個のデータ点が足し合わされたかも記録
        // 重心を求め、重心をcentroidとして更新する
        // divide SS into clusters according to labels
        console.log(labels)
        let clusters = []; // store indexes of data samples belonging to each cluster
        for (let i = 0; i < centroids.length; i++) {
            clusters.push([]);
        }
        for (let i = 0; i < labels.length; i++) {
            clusters[labels[i].cluster].push(i);
        }
        
        switch(distanceParameters.metric) {
            case 'Euclidean':
                break;
            case 'DTWD':
                let newCentroids = [];
                // compute centroids according to SS in the cluster and the path between the current centroid and SS
                for (let i = 0; i < clusters.length; i++) {
                    // create a new arrray for storing new centroid
                    let centroidTmp = [],
                        dataCount = [];
                    // new centroid will be a barycenter of data values of data samples in the cluster
                    for (let j = 0; j < dataLen; j++) {
                        let dataTmp = {};
                        variables.forEach(key => {
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
                            variables.forEach(key => {
                                centroidTmp[labels[clusters[i][j]].path[k][0]][key] += data[clusters[i][j]][labels[clusters[i][j]].path[k][1]][key];
                            });
                            dataCount[labels[clusters[i][j]].path[k][0]]++;
                        }
                    }
                    // compute barycenters of each variables
                    for (let j = 0; j < centroidTmp.length; j++) {
                        variables.forEach(key => {
                            centroidTmp[j][key] /= dataCount[j];
                        });
                    }
                    newCentroids.push(centroidTmp);
                }
                console.log('newMedoids', variables, newCentroids);
                break;
            case 'DTWI':
                break;
            default:
                break;
        }
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
