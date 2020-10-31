import * as d3 from 'd3';
import * as THREE from 'three';
import {histogramEqualizer} from '../lib/colorMap';
import dispatcher from '../Dispatcher/dispatcher';
import DataStore from '../Stores/DataStore';
import TimeTubesStore from '../Stores/TimeTubesStore';

const dataHeaders = DataStore.getDataHeaders();

const spatialVar = DataStore.getSpatialVar();

export function uploadData(file) {
    // import data in a proper format
    loadFile(file);
}

export function updateDetails(id, zpos) {
    dispatcher.dispatch({type: 'UPDATE_DETAIL', id, zpos});
}

export function mergeData(ids) {
    // data: color, data, lookup, meta, name, position, radius, spatial, splines
    // let value = runMergeData(ids);
    // dispatcher.dispatch({
    //     type:'UPLOAD_DATA',
    //     data: { name: value.fileName,
    //         data: value.data,
    //         spatial: value.spatial,
    //         meta: value.meta,
    //         position: value.splines.position,
    //         radius: value.splines.radius,
    //         color: value.splines.color,
    //         splines: value.splines.spline,
    //         lookup: value.lookup,
    //         merge: true
    //     }
    // });
    let promise = Promise.resolve();
    let mergedData = [];
    let files = [];
    promise
        .then(function () {
            for (let i = 0; i < ids.length; i++) {
                let data = DataStore.getData(ids[i]);
                mergedData = mergedData.concat(data.data.data);
                files.push(data.name);
            }
            let fileNames = files.join(',');
            mergedData.sort(function (a, b) {
                let atmp = a.JD, btmp = b.JD;
                if (Math.log10(a.JD) > 4)
                    atmp -= 2450000;
                if (Math.log10(b.JD) > 4)
                    btmp -= 2450000;
                return (atmp < btmp) ? -1 : 1;
            })
            let [spatialData, lookup] = extractData(mergedData);
            let metaData = computeStats(spatialVar, spatialData);
            let splines = computeSplines(spatialData);
            let rankings = rankHueValue(splines.spline.hue.points, splines.spline.value.points);
            return {
                fileName: fileNames, 
                data: mergedData, 
                spatial: spatialData, 
                lookup: lookup, 
                meta: metaData, 
                hueValRanks: rankings, 
                splines: splines
            };
        })
        .then(function (value) {
            dispatcher.dispatch({
                type:'UPLOAD_DATA',
                data: { name: value.fileName,
                    data: value.data,
                    spatial: value.spatial,
                    meta: value.meta,
                    splines: value.splines.spline,
                    lookup: value.lookup,
                    hueValRanks: value.rankings, 
                    merge: true
                }
            });
        });
}

export function importDemoData(fileName, data) {
    let initLine = 2;
    let dataset = [];
    let blazarData = [];
    let result = data;
    let dataTmp;
    dataTmp = d3.csvParse(result, function (d) {
        // if (Object.keys(d).length = 0)
        //     delete d;
        Object.keys(d).forEach(function(value) {
            if (!isNaN(d[value]))
                d[value] = Number(d[value]);
        }, d);
        d.source = fileName;
        return d;
    });
    let slicedData = dataTmp.splice(initLine - 2);
    dataset.push(slicedData);
    for (let j = 0; j < dataset.length; j++) {
        blazarData = blazarData.concat(dataset[j]);
    }
    blazarData.sort(function (a, b) {
        return (a['JD'] < b['JD']) ? -1 : 1;
    });
    let [spatialData, lookup] = extractData(blazarData);
    let metaData = computeStats(spatialVar, spatialData);
    let splines = computeSplines(spatialData);
    let rankings = rankHueValue(splines.spline.hue.points, splines.spline.value.points);
    dispatcher.dispatch({
        type:'UPLOAD_DATA',
        data: { name:fileName,
            data:blazarData,
            spatial: spatialData,
            meta: metaData,
            splines: splines.spline,
            lookup: lookup,
            hueValRanks: rankings,
            merge: false
        }
    });
}

export function loadFile(file, headerNum) {
    let dataIDx = DataStore.getDataNum();
    let type = 'csv';
    let initLine = headerNum;
    let fileName = [];
    let dataset = [];
    let blazarData = [];
    for (let i = 0; i < file.length; i++) {
        fileName.push(file[i].name);
        let reader = new FileReader();
        reader.readAsText(file[i]);
        reader.onload = function () {
            let result = reader.result;
            let dataTmp;
            switch (type) {
                case 'csv':
                    console.log('csv file');
                    dataTmp = d3.csvParse(result, function (d) {
                        // if (Object.keys(d).length = 0)
                        //     delete d;
                        Object.keys(d).forEach(function(value) {
                            if (!isNaN(d[value]))
                                d[value] = Number(d[value]);
                        }, d);
                        d.source = file[i].name;
                        return d;
                    });
                    break;
            }
            let slicedData = dataTmp.splice(initLine - 1);
            dataset.push(slicedData);
            if (i === file.length - 1) {
                for (let j = 0; j < dataset.length; j++) {
                    blazarData = blazarData.concat(dataset[j]);
                }
                blazarData.sort(function (a, b) {
                    return (a['JD'] < b['JD']) ? -1 : 1;
                });
                let [spatialData, lookup] = extractData(blazarData);
                let metaData = computeStats(spatialVar, spatialData);
                let splines = computeSplines(spatialData);
                let rankings = rankHueValue(splines.spline.hue.points, splines.spline.value.points);
                dispatcher.dispatch({
                    type:'UPLOAD_DATA',
                    data: { name:fileName.join('+'),
                        data:blazarData,
                        spatial: spatialData,
                        meta: metaData,
                        splines: splines.spline,
                        lookup: lookup,
                        hueValRanks: rankings,
                        merge: false
                    }
                });
            }
        }
    }
}

function extractData(data) {
    let result = [], lookup = {};
    for (let i = 0; i < data.length; i++) {
        result[i] = {};
        let polar = 'Q/I' in data[i] || '< q >' in data[i];
        let photo = 'Flx(V)' in data[i] || 'V' in data[i];
        if (polar && photo) {
            for (let key in dataHeaders['HU']) {
                if (dataHeaders['HU'][key] in data[i]) {
                    result[i][key] = data[i][dataHeaders['HU'][key]];
                } else if (dataHeaders['HU'][key] === 'PA') {
                    let PAtmp = 0.5 * Math.atan2(data[i]['U/I'], data[i]['Q/I']) * 180 / Math.PI;
                    if (PAtmp < 0) {
                        PAtmp += 180;
                    }
                    result[i][key] = PAtmp;
                } else if (dataHeaders['HU'][key] === 'PD') {
                    result[i][key] = Math.sqrt(Math.pow(data[i]['Q/I'], 2) + Math.pow(data[i]['U/I'], 2)) * 100;
                }

                if (!lookup[key] || lookup[key].indexOf(dataHeaders['HU'][key]) < 0) {
                    if (!lookup[key])
                        lookup[key] = [];
                    lookup[key].push(dataHeaders['HU'][key]);
                }
            }
        } else if (polar) {
            for (let key in dataHeaders['AUPolar']) {
                if (key == 'z') {
                    result[i][key] = data[i][dataHeaders['AUPolar'][key]] - 2450000;
                    if (!lookup[key] || lookup[key].indexOf(dataHeaders['AUPolar'][key]) < 0) {
                        if (!lookup[key])
                            lookup[key] = [];
                        lookup[key].push(dataHeaders['AUPolar'][key]);
                    }
                } else {
                    if (dataHeaders['AUPolar'][key] in data[i]) {
                        result[i][key] = data[i][dataHeaders['AUPolar'][key]] || 0;
                    } else if (dataHeaders['AUPolar'][key] === 'PA') {
                        let PAtmp = 0.5 * Math.atan2(data[i]['< u >'], data[i]['< q >']) * 180 / Math.PI;
                        if (PAtmp < 0) {
                            PAtmp += 180;
                        }
                        result[i][key] = PAtmp;
                    } else if (dataHeaders['AUPolar'][key] === 'PD') {
                        result[i][key] = Math.sqrt(Math.pow(data[i]['< q >'], 2) + Math.pow(data[i]['< u >'], 2)) * 100;
                    }

                    if (!lookup[key] || lookup[key].indexOf(dataHeaders['AUPolar'][key]) < 0) {
                        if (!lookup[key])
                            lookup[key] = [];
                        lookup[key].push(dataHeaders['AUPolar'][key]);
                    }
                }
            }
        } else if (photo) {
            for (let key in dataHeaders['AUPhoto']) {
                if (key == 'z') {
                    result[i][key] = data[i][dataHeaders['AUPhoto'][key]] - 2450000;
                    if (!lookup[key] || lookup[key].indexOf(dataHeaders['AUPhoto'][key]) < 0) {
                        if (!lookup[key])
                            lookup[key] = [];
                        lookup[key].push(dataHeaders['AUPhoto'][key]);
                    }
                } else {
                    if (key === 'V') {
                        // convert V to Flx(V)
                        result[i][key] = Math.pow(10, -1 *  (data[i][dataHeaders['AUPhoto'][key]] + 11.7580) / 2.5);
                        if (!lookup[key] || lookup[key].indexOf(dataHeaders['AUPhoto'][key]) < 0) {
                            if (!lookup[key])
                                lookup[key] = [];
                            lookup[key].push(dataHeaders['AUPhoto'][key]);
                        }
                    } else {
                        result[i][key] = data[i][dataHeaders['AUPhoto'][key]] || 0;
                        if (!lookup[key] || lookup[key].indexOf(dataHeaders['AUPhoto'][key]) < 0) {
                            if (!lookup[key])
                                lookup[key] = [];
                            lookup[key].push(dataHeaders['AUPhoto'][key]);
                        }
                    }
                }
            }
        }
        result[i].source = data[i].source;
        // for (let key in lookup) {
        //     let tmp = data[i][lookup[key]];
        //     if (lookup[key] === 'JD' && Math.log10(tmp) > 4) {
        //         tmp -= 2450000;
        //     }
        //     result[i][key] = tmp;
        // }
    }
    return [result, lookup];
}

function computeStats(lookup, data) {
    let meta = {};
    meta.min = {}, meta.max = {}, meta.mean = {}, meta.std = {};
    for (let i = 0; i < lookup.length; i++) {
        let key = lookup[i];
        [meta.min[key], meta.max[key]] = d3.extent(data, function (e) {
            return e[key];
        });
        meta.mean[key] = d3.mean(data, function (e) {
            return e[key];
        });
        meta.std[key] = d3.deviation(data, function (e) {
            return e[key];
        });
    }
    let xRange = Math.max(
        Math.abs(meta.mean.x - 3 * meta.std.x),
        Math.abs(meta.mean.x + 3 * meta.std.x)
    );
    let yRange = Math.max(
        Math.abs(meta.mean.y - 3 * meta.std.y),
        Math.abs(meta.mean.y + 3 * meta.std.y)
    );
    let dataRange = Math.max(xRange, yRange);
    let int2dig = Math.round(dataRange * Math.pow(10, 2 - Math.ceil(Math.log10(dataRange))));
    meta.range = TimeTubesStore.getGridSize() / (Math.ceil(int2dig / 5) * 5 * Math.pow(10, - (2 - Math.ceil(Math.log10(dataRange)))));
    return meta;
}

function computeSplines(data) {
    let line = [];
    let minZ = data[0].z;
    let position = [], radius = [], hue = [], value =[], PDPA = [];
    data.forEach(function (e) {
        if ('x' in e) {
            position.push(new THREE.Vector3(e.x, e.y, e.z));
            radius.push(new THREE.Vector3(e.r_x, e.r_y, e.z));
            PDPA.push(new THREE.Vector3(e.PD, e.PA, e.z));
        }
        if ('H' in e) {
            hue.push(new THREE.Vector3(e.H, 0, e.z));
        }
        if ('V' in e) {
            value.push(new THREE.Vector3(0, e.V, e.z));
        }
        line.push(new THREE.Vector3(0, 0, e.z - minZ));
    });
    let spline = {};
    spline.position = new THREE.CatmullRomCurve3(position, false, 'catmullrom');
    spline.radius = new THREE.CatmullRomCurve3(radius, false, 'catmullrom');
    // spline.color = new THREE.CatmullRomCurve3(color, false, 'catmullrom');
    spline.hue = new THREE.CatmullRomCurve3(hue, false, 'catmullrom');
    spline.value = new THREE.CatmullRomCurve3(value, false, 'catmullrom');
    spline.line = new THREE.CatmullRomCurve3(line, false, 'catmullrom');
    spline.PDPA = new THREE.CatmullRomCurve3(PDPA, false, 'catmullrom');
    // return {position: position, radius: radius, color: color, spline:spline};

    return {position: position, radius: radius, hue: hue, value:value, spline:spline};
}

function rankHueValue(hue, value) {
    // create new array for only index and data value
    let hueData = hue.map((d, idx) => {
        return {index: idx, value: d.x, timeStamp: d.z};
    });
    let valueData = value.map((d, idx) => {
        return {index: idx, value: d.y, timeStamp: d.z};
    });

    // sort by value
    hueData.sort((a, b) => {
        if (a.value < b.value) return -1;
        if (a.value > b.value) return 1;
        return 0;
    });
    valueData.sort((a, b) => {
        if (a.value < b.value) return -1;
        if (a.value > b.value) return 1;
        return 0;
    });

    // convert hue and values into the values more than 0
    let nHue = -1 * Math.floor(Math.log10(hueData[0].value)),
        nValue = -1 * Math.floor(Math.log10(valueData[0].value));

    // add rank to the object array
    if (hueData.length === valueData.length) {
        for (let i = 0; i < hueData.length; i++) {
            hueData[i].rank = i;
            hueData[i].value *= Math.pow(10, nHue);
            valueData[i].rank = i;
            valueData[i].value *= Math.pow(10, nValue);
        }
    } else {
        for (let i = 0; i < hueData.length; i++) {
            hueData[i].rank = i;
            hueData[i].value *= Math.pow(10, nHue);
        }
        for (let i = 0; i < valueData.length; i++) {
            valueData[i].rank = i;
            valueData[i].value *= Math.pow(10, nValue);
        }
    }
    let diagHue = {
            rank: hueData.length - 1, 
            value: hueData[hueData.length - 1].value - hueData[0].value 
        },
        diagValue = {
            rank: valueData.length - 1, 
            value: valueData[valueData.length - 1].value - valueData[0].value
        };
    let minmaxHue = {min: hueData[0].index, max: hueData[hueData.length - 1].index},
        minmaxValue = {min: valueData[0].index, max: valueData[valueData.length - 1].index};
    // order the object array 
    let sortedHueData = hueData.slice().sort((a, b) => {
        if (a.index < b.index) return -1;
        if (a.index > b.index) return 1;
        return 0;
    });
    let sortedValueData = valueData.slice().sort((a, b) => {
        if (a.index < b.index) return -1;
        if (a.index > b.index) return 1;
        return 0;
    });

    // create the arrays only for the ranks of data samples
    let rankHue = [], rankValue = [];
    if (sortedHueData.length === valueData.length) {
        for (let i = 0; i < sortedHueData.length; i++) {
            rankHue.push({rank: sortedHueData[i].rank, value: sortedHueData[i].value, timeStamp: sortedHueData[i].timeStamp});
            rankValue.push({rank: sortedValueData[i].rank, value: sortedValueData[i].value, timeStamp: sortedValueData[i].timeStamp});
        }
    } else {
        for (let i = 0; i < sortedHueData.length; i++) {
            rankHue.push({rank: sortedHueData[i].rank, value: sortedHueData[i].value, timeStamp: sortedHueData[i].timeStamp});
        }
        for (let i = 0; i < sortedValueData.length; i++) {
            rankValue.push({rank: sortedValueData[i].rank, value: sortedValueData[i].value, timeStamp: sortedValueData[i].timeStamp});
        }
    }

    // create interpolation splines
    let projectedHue = [], projectedValue = [];
    let projectedTmp;
    if (rankHue.length === rankValue.length) {
        for (let i = 0; i < rankHue.length; i++) {
            projectedTmp = histogramEqualizer(rankHue, i, diagHue);
            projectedHue.push(new THREE.Vector3(rankHue[i].value, projectedTmp, rankHue[i].timeStamp));
            projectedTmp = histogramEqualizer(rankValue, i, diagValue);
            projectedValue.push(new THREE.Vector3(rankValue[i].value, projectedTmp, rankValue[i].timeStamp));
        }
    } else {
        for (let i = 0; i < rankHue.length; i++) {
            projectedTmp = histogramEqualizer(rankHue, i, diagHue);
            projectedValue.push(new THREE.Vector3(rankHue[i].value, projectedTmp, rankHue[i].timeStamp));
        }
        for (let i = 0; i < rankValue.length; i++) {
            projectedTmp = histogramEqualizer(rankValue, i, diagValue);
            projectedValue.push(new THREE.Vector3(rankValue[i].value, projectedTmp, rankValue[i].timeStamp));
        }
    }
    let projectedMinMaxHue = {min: histogramEqualizer(rankHue, minmaxHue.min, diagHue), max: histogramEqualizer(rankHue, minmaxHue.max, diagHue)},
        projectedMinMaxValue = {min: histogramEqualizer(rankValue, minmaxValue.min, diagValue), max: histogramEqualizer(rankValue, minmaxValue.max, diagValue)};

    return {hue: new THREE.CatmullRomCurve3(projectedHue, false, 'catmullrom'), value: new THREE.CatmullRomCurve3(projectedValue, false, 'catmullrom'), 
            minmaxHue: projectedMinMaxHue, minmaxValue: projectedMinMaxValue};
}

export function updatePrivateComment() {
    dispatcher.dispatch({type: 'UPDATE_PRIVATE_COMMENT'});
}
