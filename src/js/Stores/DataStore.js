import {EventEmitter} from 'events';
import * as THREE from 'three';
import dispatcher from "../Dispatcher/dispatcher";

const dataHeaders = {
    HU: {
        x: 'Q/I',
        y: 'U/I',
        z: 'JD',
        r_x: 'E_Q/I',
        r_y: 'E_U/I',
        H: 'V-J',
        V: 'Flx(V)',
        PA: 'PA',
        PD: 'PD'
    },
    AUPolar: {
        x: '< q >',
        y: '< u >',
        z: 'JD',
        r_x: 'rms(q)',
        r_y: 'rms(u)',
        PA: 'PA',
        PD: 'PD'
    },
    AUPhoto: {
        z: 'JD',
        V: 'V'
    }
};
const spatialVar = ['x', 'y', 'z', 'r_x', 'r_y', 'H', 'V', 'PA', 'PD'];
class DataStore extends EventEmitter {
    constructor() {
        super();
        this.data = [];
        // id: id,
        // name: data.name,
        // data: data,
            //    name: value.fileName,
            //    data: value.data,
            //    spatial: value.spatial,
            //    meta: value.meta,
            //    position: value.splines.position,
            //    radius: value.splines.radius,
            //    color: value.splines.color,
            //    splines: value.splines.spline,
            //    lookup: value.lookup,
            //    merge: true
    }

    handleActions(action) {
        switch (action.type) {
            case 'UPLOAD_DATA':
                this.uploadData(action.data);
                break;
            case 'UPDATE_DETAIL':
                this.emit('updateDetail', action.id, action.zpos);
                break;
            case 'UPDATE_PRIVATE_COMMENT':
                this.updatePrivateComment();
                break;
            default:
        }
    }

    uploadData(data) {
        let id = this.data.length;
        this.data.push({
            id: id,
            name: data.name,
            data: data,
        });
        this.emit('upload', id);
        this.emit('showInitSP', id);
    }

    getAllData() {
        return this.data;
    }

    getAllFileNames() {
        let fileNames = [];
        for (let i = 0; i < this.data.length; i++) {
            fileNames.push(this.data[i].name);
        }
        return fileNames;
    }

    getAllIdsFileNames() {
        let idFile = [];
        for (let i = 0; i < this.data.length; i++) {
            idFile.push({id: this.data[i].id, name: this.data[i].name});
        }
        return idFile;
    }

    getData(id) {
        return this.data[id];
    }

    getDataArray(id, interval) {
        let result = {};
        for (let key in this.data[id].data.lookup) {
            result[key] = [];
        }
        let minJD = this.data[id].data.meta.min.z;
        let start = Math.ceil(this.data[id].data.meta.min.z),
            end = Math.floor(this.data[id].data.meta.max.z);
        for (let i = start; i <= end; i += interval) {
            let values = this.getValues(id, i - minJD);
            for (let key in values) {
                result[key].push(values[key]);
            }
            result.z[result.z.length - 1] = i;
        }
        result['arrayLength'] = end - start + 1;
        return result;
    }

    getDataNum() {
        return this.data.length;
    }

    getTailID() {
        return this.data[this.data.length - 1].id || 0;
    }

    getFileName(id) {
        return this.data[id].name || '';
    }

    getValues(id, zpos) {
        if (id < 0) {
            return {};
        } else {
            let currentJD = zpos + this.data[id].data.meta.min.z;

            let i;
            for (i = 1; i < this.data[id].data.position.length; i++) {
                if (this.data[id].data.position[i - 1].z <= currentJD && currentJD < this.data[id].data.position[i].z) {
                    break;
                }
            }
            let tPos;
            if ((currentJD === this.data[id].data.meta.min.z) || (i < 0)) {
                tPos = 0;
            } else if ((currentJD === this.data[id].data.position[this.data[id].data.position.length - 1].z) || (i > this.data[id].data.position.length - 1)) {
                tPos = 1;
            } else {
                tPos = ((i - 1) + (currentJD - this.data[id].data.position[i - 1].z) / (this.data[id].data.position[i].z - this.data[id].data.position[i - 1].z)) / (this.data[id].data.position.length - 1);
            }

            let j;
            for (j = 1; j < this.data[id].data.color.length; j++) {
                if (this.data[id].data.color[j - 1].z <= currentJD && currentJD < this.data[id].data.color[j].z)
                    break;
            }
            let tCol;
            if (j >= this.data[id].data.color.length - 1) {
                tCol = 1;
            } else {
                tCol = ((j - 1) + (currentJD - this.data[id].data.color[j - 1].z) / (this.data[id].data.color[j].z - this.data[id].data.color[j - 1].z)) / (this.data[id].data.color.length - 1);
            }
            // QI, UI, JD
            let pos = this.data[id].data.splines.position.getPoint(tPos);
            // EQI, EUI, JD
            let err = this.data[id].data.splines.radius.getPoint(tPos);
            // VJ, Flx(V), JD
            let col = this.data[id].data.splines.color.getPoint(tCol);
            // PD, PA, JD
            let PDPA = this.data[id].data.splines.PDPA.getPoint(tPos);

            return {
                z: pos.z,
                x: pos.x,
                r_x: err.x,
                y: pos.y,
                r_y: err.y,
                V: col.y,
                H: col.x,
                PD: PDPA.x,
                PA: PDPA.y
            };
        }
    }

    getIdFromName(fileName) {
        for (let i = 0; i < this.data.length; i++) {
            if (this.data[i].name === fileName)
                return i;
        }
        return -1;
    }

    getAverage(id, focused, bin) {
        let currentJD, data, average = {x: 0, y: 0};
        for (let i = 0; i < bin; i++) {
            currentJD = focused + i;
            data = this.getValues(id, currentJD);
            average.x += data.x;
            average.y += data.y;
        }
        average.x /= bin;
        average.y /= bin;
        return average;
    }

    getDataHeaders() {
        return dataHeaders;
    }

    getSpatialVar() {
        return spatialVar;
    }

    updatePrivateComment() {
        this.emit('updatePrivateComment');
    }
}

const dataStore = new DataStore();
dispatcher.register(dataStore.handleActions.bind(dataStore));
export default dataStore;
