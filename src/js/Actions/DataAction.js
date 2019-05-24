import * as d3 from 'd3';
import * as THREE from 'three';
import dispatcher from '../Dispatcher/dispatcher';
import DataStore from '../Stores/DataStore';

const dataHeaders = {
    HU: {
        x: 'Q/I',
        y: 'U/I',
        z: 'JD',
        r_x: 'E_Q/I',
        r_y: 'E_U/I',
        H: 'V-J',
        V: 'Flx(V)'
    },
    AUPolar: {
        x: '< q >',
        y: '< u >',
        z: 'JD',
        r_x: 'rms(q)',
        r_y: 'rms(u)'
    },
    AUPhoto: {
        z: 'JD',
        V: 'V'
    }
}

const spatialVar = ['x', 'y', 'z', 'r_x', 'r_y', 'H', 'V'];

export function uploadData(file) {
    // import data in a proper format
    loadFile(file);
}

export function updateDetails(id, zpos) {
    dispatcher.dispatch({type: 'UPDATE_DETAIL', id, zpos});
}

export function mergeData(ids) {
    // data: color, data, lookup, meta, name, position, radius, spatial, splines
    let mergedData = [];
    let files = [];
    for (let i = 0; i < ids.length; i++) {
        let data = DataStore.getData(ids[i]);
        mergedData = mergedData.concat(data.data.data);
        files.push(data.name);
    }
    let fileNames = files.join(', ');
    mergedData.sort(function (a, b) {
        let atmp = a.JD, btmp = b.JD;
        if (Math.log10(a.JD) > 4)
            atmp -= 2450000;
        if (Math.log10(b.JD) > 4)
            btmp -= 2450000;
        return (atmp < btmp) ? -1 : 1;
    })
    let [spatialData, lookup] = extractData(mergedData);
    console.log(spatialData);
    let metaData = computeStats(spatialVar, spatialData);
    let splines = computeSplines(spatialData);
    dispatcher.dispatch({
        type:'UPLOAD_DATA',
        data: { name:fileNames,
            data:mergedData,
            spatial: spatialData,
            meta: metaData,
            position: splines.position,
            radius: splines.radius,
            color: splines.color,
            splines: splines.spline,
            lookup: lookup
        }
    });
}

function loadFile(file) {
    let dataIDx = DataStore.getDataNum();
    let type = 'csv';
    let initLine = Number($('#initialLineVal').text());
    let dataset = [];
    let blazarData = [];
    for (let i = 0; i < file.length; i++) {
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
                        return d;
                    });
                    break;
            }
            let slicedData = dataTmp.splice(initLine - 2);
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
                dispatcher.dispatch({
                    type:'UPLOAD_DATA',
                    data: { name:file[0].name,
                        data:blazarData,
                        spatial: spatialData,
                        meta: metaData,
                        position: splines.position,
                        radius: splines.radius,
                        color: splines.color,
                        splines: splines.spline,
                        lookup: lookup
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
        let polar = data[i]['Q/I'] || data[i]['< q >'];
        let photo = data[i]['Flx(V)'] || data[i]['V'];
        if (polar && photo) {
            for (let key in dataHeaders['HU']) {
                result[i][key] = data[i][dataHeaders['HU'][key]];
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
                    result[i][key] = data[i][dataHeaders['AUPolar'][key]] || 0;
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
    meta.range = 10 / (Math.ceil(int2dig / 5) * 5 * Math.pow(10, - (2 - Math.ceil(Math.log10(dataRange)))));
    return meta;
}

function computeSplines(data) {
    let line = [];
    let minZ = data[0].z;
    let position = [], radius = [], color = [];
    data.forEach(function (e) {
        if ('x' in e) {
            position.push(new THREE.Vector3(e.x, e.y, e.z));
            radius.push(new THREE.Vector3(e.r_x, e.r_y, e.z));
        }
        if ('V' in e) {
            color.push(new THREE.Vector3(e.H, e.V, e.z));
        }
        line.push(new THREE.Vector3(0, 0, e.z - minZ));
    });
    let spline = {};
    spline.position = new THREE.CatmullRomCurve3(position, false, 'catmullrom');
    spline.radius = new THREE.CatmullRomCurve3(radius, false, 'catmullrom');
    spline.color = new THREE.CatmullRomCurve3(color, false, 'catmullrom');
    spline.line = new THREE.CatmullRomCurve3(line, false, 'catmullrom');
    return {position: position, radius: radius, color: color, spline:spline};
}