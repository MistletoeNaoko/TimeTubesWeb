import {EventEmitter} from 'events';
import * as THREE from 'three';
import dispatcher from "../Dispatcher/dispatcher";

class DataStore extends EventEmitter {
    constructor() {
        super();
        this.data = [];
    }

    handleActions(action) {
        // console.log('DataStore received an action', action);
        switch (action.type) {
            case 'UPLOAD_DATA':
                this.uploadData(action.data);
                break;
            case 'UPDATE_DETAIL':
                this.emit('updateDetail', action.id, action.zpos);
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
            // spatial: spatial,
            // metadata: meta
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
            return {keys: [], vals: []};
        } else {
            let currentJD = zpos + this.data[id].data.spatial[0].z;

            let i;
            for (i = 1; i < this.data[id].data.position.length; i++) {
                if (this.data[id].data.position[i - 1].z <= currentJD && currentJD < this.data[id].data.position[i].z) {
                    break;
                }
            }
            let tPos;
            if ((currentJD === this.data[id].data.position[this.data[id].data.position.length - 1].z) || (i > this.data[id].data.position.length - 1)) {
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

            return {
                keys: ['JD', 'Q/I', 'E_Q/I', 'U/I', 'E_U/I', 'Flx(V)', 'V-J'],
                vals: [pos.z, pos.x, err.x, pos.y, err.y, col.y, col.x]
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
}

const dataStore = new DataStore();
dispatcher.register(dataStore.handleActions.bind(dataStore));
export default dataStore;