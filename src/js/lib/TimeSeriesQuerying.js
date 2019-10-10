import DataStore from '../Stores/DataStore';
import DynamicTimeWarping from 'dynamic-time-warping';

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

export function runMatching(query, targetData, DTWType, normalization, dist, window, step, period) {
    // make a nomalized query if the user select the normalized option (only think about relative shapes of variations)
    // slide a window and create a target array
    // normalize the target
    // compute DTW distance
    // store the DTW distance with the first time stamp of the time slice and the length of the priod
    // sort the result
    let minJD = targetData.z[0];
    let distFunc;
    switch (dist) {
        case 'Euclidean':
            distFunc = EuclideanDist;
            break;
    }

    if (normalization) {
        query = normalizeTimeSeries(query);
    }
    let result = [];//, resultLib = [];
    switch (DTWType) {
        case 'DTWI':
            if (window > 0) {
                // compute dtw every time (time consuming :(
                let i = 0;
                while (i < targetData.arrayLength - period[0]) {
                    let dtws = [];
                    for (let j = period[0]; j <= period[1]; j++) {
                        if (i + j > targetData.arrayLength - 1) break;
                        let dtwSum = 0;
                        for (let key in query) {
                            if (Array.isArray(targetData[key]) && key !== 'z') {
                                let target = targetData[key].slice(i, i + j);
                                let dtw = DTW(query[key], target, window, distFunc);
                                dtwSum += dtw;
                            }
                        }
                        dtws.push(dtwSum);
                    }
                    let minIdx = 0;
                    let minVal = Infinity;
                    for (let j = 0; j < dtws.length; j++) {
                        if (dtws[j] < minVal) {
                            minVal = dtws[j];
                            minIdx = j;
                        }
                    }
                    result.push([i + minJD, period[0] + minIdx, minVal]);
                    i += step;
                }
            } else {
                // If there are no restriction on window size (simpleDTW), use fast computing
                let i = 0;
                while (i < targetData.arrayLength - period[0]) {
                    let dtws = [];
                    let maxLen = (i + period[1] < targetData.arrayLength - 1)? period[1]: targetData.arrayLength - i;
                    for (let key in query) {
                        if (Array.isArray(targetData[key]) && key !== 'z') {
                            let target = targetData[key].slice(i, i + maxLen);
                            let dtw = DTWSimple(query[key], target, distFunc, maxLen - period[0] + 1);
                            dtws.push(dtw);
                        }
                    }
                    // Choose a collection of dtw which minimize the sum
                    let minIdx = 0;
                    let minVal = Infinity;
                    for (let j = 0; j < dtws[0].length; j++) {
                        let sum = 0;
                        for (let k = 0; k < dtws.length; k++) {
                            sum += dtws[k][j];
                        }
                        if (sum < minVal) {
                            minVal = sum;
                            minIdx = j;
                        }
                    }
                    // result is a collection of [start JD, the length of period, dtw value]
                    result.push([i + minJD, period[0] + minIdx, minVal]);
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
                        dtws.push(DTWMD(query, target, window, keys, distFunc));
                    }
                    let minIdx = 0;
                    let minVal = Infinity;
                    for (let j = 0; j < dtws.length; j++) {
                        if (dtws[j] < minVal) {
                            minVal = dtws[j];
                            minIdx = j;
                        }
                    }
                    result.push([i + minJD, period[0] + minIdx, minVal]);
                    i += step;
                }
            } else {
                // use DTWSimple
                let i = 0;
                while (i < targetData.arrayLength - period[0]) {
                    let target = {};
                    let maxLen = (i + period[1] < targetData.arrayLength - 1)? period[1]: targetData.arrayLength - i;
                    keys.forEach(function(key) {
                        target[key] = targetData[key].slice(i, i + maxLen);
                    });
                    target.arrayLength = maxLen;
                    let dtws = DTWSimpleMD(query, target, keys, distFunc, maxLen - period[0] + 1);
                    let minIdx = 0;
                    let minVal = Infinity;
                    for (let j = 0; j < dtws.length; j++) {
                        if (dtws[j] < minVal) {
                            minVal = dtws[j];
                            minIdx = j;
                        }
                    }
                    result.push([i + minJD, period[0] + minIdx, minVal]);
                    i += step;
                }
            }
            break;
    }
    console.log(result);//, resultLib);
}

function normalizeTimeSeries(data) {
    let result = {};
    for (let key in data) {
        let min = Math.min.apply(null, data[key]),
            max = Math.max.apply(null, data[key]);
        let tmp = data[key].map(function(num) {
            return (num - min) / (max - min);
        });
        result[key] = tmp;
    }
    return result;
}

export function testDTW() {
    var distFunc = function( a, b ) {
        return Math.abs( a - b );
    };
    // case 1: 108 [ 9, 93, 15, 19, 24 ], [ 31, 97, 81, 82, 39 ]
    // case 2: 35
    let src = [71, 73, 75, 80, 80, 80, 78, 76, 75, 73, 71, 71, 71, 73, 75, 76, 76, 68, 76, 76, 75, 73, 71, 70, 70, 69, 68, 68, 72, 74, 78, 79, 80, 80, 78];
    let tgt = [69, 69, 73, 75, 79, 80, 79, 78, 76, 73, 72, 71, 70, 70, 69, 69, 69, 71, 73, 75, 76, 76, 76, 76, 76, 75, 73, 71, 70, 70, 71, 73, 75, 80, 80, 80, 78];
    // case 3: 9
    // let src = [1, 2, 5, 4, 3, 7];
    // let tgt = [2, 3, 2, 1, 3, 4];
    let dtw = new DynamicTimeWarping(src, tgt, distFunc);
    console.log(dtw.getDistance(), dtw.getPath(), dtw.getDistance() / dtw.getPath().length);
    console.log(DTW(src, tgt,  tgt.length));
}

export function DTWSimple(s, t, distFunc, period) {
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
    let result = []
    for (let i = 1; i <= period; i++) {
        result.push(dist[s.length - 1][t.length - 1 - period + i]);
    }
    return result;
}

export function DTWSimpleMD(s, t, keys, distFunc, period) {
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

    let result = []
    for (let i = 1; i <= period; i++) {
        result.push(dist[s.arrayLength - 1][t.arrayLength - 1 - period + i]);
    }
    return result;
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
    return dist[s.length - 1][t.length - 1];
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
    return dist[s.arrayLength - 1][t.arrayLength - 1];
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