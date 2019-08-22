import {EventEmitter} from 'events';
import dispatcher from "../Dispatcher/dispatcher";
import * as THREE from "three";

const opacityDistSet = {
    Default: [
        [0.00, 1.00],
        [0.05, 0.75],
        [0.37, 0.50],
        [0.62, 0.50],
        [0.95, 0.25],
        [1.00, 0.00]
    ],
    Linear: [
        [0.00, 1.00],
        [0.25, 0.75],
        [0.50, 0.50],
        [0.75, 0.25],
        [1.00, 0.00]
    ],
    Flat: [
        [0.00, 1.00],
        [0.25, 1.00],
        [0.50, 1.00],
        [0.75, 1.00],
        [1.00, 1.00]
    ],
    Valley: [
        [0.00, 1.00],
        [0.25, 0.75],
        [0.50, 0.50],
        [0.75, 0.75],
        [1.00, 1.00]
    ]
};

class TimeTubesStore extends EventEmitter{
    constructor() {
        super();
        this.initColorIdx = 5;
        this.presetColors = ['#DC143C', '#FF6347', '#FFA500', '#FFFF00',
            '#00FF00', '#7FFFD4', '#00FFFF', '#00BFFF',
            '#1E90FF', '#7B68EE', '#9932CC', '#FF00FF',
            '#FF69B4', '#FFFFFF', '#FFF8DC', '#CD853F'];
        this.cameraProp = [{
            xpos: 0,
            ypos: 0,
            zpos: 50,
            fov: 45,
            far: 2000,
            depth: 0,
            aspect: 1,
            zoom: 1,
            type: 'Perspective'
        }];
        this.texture = [];
        this.checked = [];
        this.focused = [];
        this.minmaxV = [];
        this.minmaxH = [];
        this.plotColor = [];
        this.gridSize = 15;
        this.tubeNum = 16;
        this.visualQuery = false;
        this.dragSelection = true;
        this.activeId = -1;
        this.lock = [];
        this.opacityCurves = {};
        for (let key in opacityDistSet) {
            let points = [];
            for (let i = 0; i < opacityDistSet[key].length; i++) {
                points.push(new THREE.Vector2(opacityDistSet[key][i][0], opacityDistSet[key][i][1]));
            }
            this.opacityCurves[key] = new THREE.SplineCurve(points);
        }
    }

    handleActions(action) {
        // console.log('TimeTubesStore received an action', action);
        switch (action.type) {
            case 'UPLOAD_DATA':
                this.uploadData();
                break;
            case 'UPDATE_CAMERA':
                this.updateCamera(action.id, action.cameraProp);
                break;
            case 'SWITCH_CAMERA':
                this.switchCamera(action.id);
                break;
            case 'RESET_CAMERA':
                this.resetCamera(action.id);
                break;
            case 'SEARCH_TIME':
                this.searchTime(action.id, action.dst);
                break;
            case 'UPDATE_CHECKED':
                this.updateChecked(action.id);
                break;
            case 'SWITCH_GRID':
                this.switchGridDisplay(action.id, action.state);
                break;
            case 'SWITCH_LABEL':
                this.switchLabelDisplay(action.id, action.state);
                break;
            case 'SWITCH_AXIS':
                this.switchAxisDisplay(action.id, action.state);
                break;
            case 'SWITCH_PLOT':
                this.switchPlotDisplay(action.id, action.state);
                break;
            case 'CHANGE_BACKGROUND':
                this.changeBackground(action.id, action.color);
                break;
            case 'CLIP_TUBE':
                this.clipTube(action.id, action.state);
                break;
            case 'SWITCH_SHADE':
                this.switchShade(action.id, action.state);
                break;
            case 'UPDATE_FOCUS':
                this.updateFocus(action.id, action.zpos, action.flag);
                break;
            case 'CHANGE_FAR':
                this.changeFar(action.id, action.value);
                break;
            case 'UPDATE_MINMAXH':
                this.updateMinMaxH(action.id, action.min, action.max);
                break;
            case 'UPDATE_MINMAXV':
                this.updateMinMaxV(action.id, action.min, action.max);
                break;
            case 'CHANGE_PLOTCOLOR':
                this.changePlotColor(action.id, action.color);
                break;
            case 'UPDATE_TEXTURE':
                this.updateTexture(action.id, action.texture);
                break;
            case 'ACTIVATE_VIEWPORT':
                this.activateViewport(action.id);
                break;
            case 'TIME_FITTING':
                this.timeFitting(action.dst);
                break;
            case 'LOCK_CONTROL':
                this.lockControl(action.ids, action.state);
                break;
            case 'SYNCHRONIZE_TUBES':
                this.synchronizeTubes(action.id, action.zpos, action.pos, action.deg);
                break;
            case 'ZOOM_OUT_TIMETUBE':
                this.zoomOutTimeTubes(action.id);
                break;
            case 'RESET_ZOOM_TIMETUBES':
                this.resetZoomTimeTubes(action.id);
                break;
            case 'ZOOM_IN_TIMETUBES':
                this.zoomInTimeTubes(action.id);
                break;
            default:
        }
    }

    getCameraProp(id) {
        return this.cameraProp[id];
    }

    getChecked(id) {
        return this.checked[id];
    }

    getCheckedList() {
        return this.checked;
    }

    getFocused(id) {
        // focused is not JD, but the position of the tube in the 3D space
        return this.focused[id];
    }

    getMinMaxH(id) {
        return this.minmaxH[id];
    }

    getMinMaxV(id) {
        return this.minmaxV[id];
    }

    getActiveId() {
        return this.activeId;
    }

    uploadData() {
        let idx = this.cameraProp.length;
        this.cameraProp.push(
            {
                xpos: 0,
                ypos: 0,
                zpos: 50,
                fov: 45,
                depth: 0,
                far: 2000,
                aspect: 1,
                zoom: 1,
                type: 'Perspective'
            }
        );
        this.checked.push(true);
        this.focused.push(0);
        this.minmaxV.push([0, 0]);
        this.minmaxV.push([0, 0]);
        this.lock.push(0);
        this.emit('upload');
    }

    updateCamera(id, cameraProp) {
        for (let key in cameraProp) {
            this.cameraProp[id][key] = cameraProp[key];
        }
        this.emit('change');
    }

    resetCamera(id) {
        this.cameraProp[id].xpos = 0;
        this.cameraProp[id].ypos = 0;
        this.cameraProp[id].zpos = 50;
        this.emit('reset');
    }

    switchCamera(id) {
        if (this.cameraProp[id].type === 'Perspective') {
            this.cameraProp[id].type = 'Orthographic';
        } else {
            this.cameraProp[id].type = 'Perspective';
        }
        this.emit('switch');
    }

    searchTime(id, dst) {
        this.emit('searchTime', id, dst);
    }

    updateChecked(id) {
        this.checked[id] = !this.checked[id];
        this.emit('updateChecked', id);
    }

    switchGridDisplay(id, state) {
        this.emit('switchGrid', id, state);
    }

    switchLabelDisplay(id, state) {
        this.emit('switchLabel', id, state);
    }

    switchAxisDisplay(id, state) {
        this.emit('switchAxis', id, state);
    }

    switchPlotDisplay(id, state) {
        this.emit('switchPlot', id, state);
    }

    changeBackground(id, color) {
        this.emit('changeBackground', id, color);
    }

    clipTube(id, state) {
        this.emit('clipTube', id, state);
    }

    switchShade(id, state) {
        this.emit('switchShade', id, state);
    }

    updateFocus(id, zpos, flag) {
        this.focused[id] = zpos;
        this.emit('updateFocus', id, zpos, flag);
    }

    changeFar(id, value) {
        this.cameraProp[id].far = value;
        this.emit('changeFar', id);
    }

    updateMinMaxH(id, min, max) {
        this.minmaxH[id] = [min, max];
        this.emit('updateMinMaxH', id);
    }

    updateMinMaxV(id, min, max) {
        this.minmaxV[id] = [min, max];
        this.emit('updateMinMaxV', id);
    }

    changePlotColor(id, color) {
        this.plotColor[id] = color;
        this.emit('changePlotColor', id);
    }

    updateTexture(id, texture) {
        this.texture[id] = texture;
        this.emit('updateTexture', id);
    }

    activateViewport(id) {
        this.activeId = id;
    }

    timeFitting(dst) {
        this.emit('timeFitting', dst);
    }

    lockControl(ids, state) {
        if (!state) {
            // reset this.lock
            for (let i = 0; i < this.lock.length; i++) {
                this.lock[i] = 0;
            }
        } else {
            // set the current position of the tube to lock[]
            // current positions can be got by getFocus
            for (let i = 0; i < ids.length; i++) {
                this.lock[ids[i]] = this.getFocused(ids[i]);
            }
        }
        this.emit('lockControl', ids, state);
    }

    synchronizeTubes(id, zpos, pos, deg) {
        this.emit('synchronizeTubes', id, zpos, pos, deg);
    }

    zoomOutTimeTubes(id) {
        if (this.cameraProp[id].zoom >= 0.2) {
            this.cameraProp[id].zoom -= 0.1;
            this.emit('updateZoomTimeTubes', id);
        }
    }

    resetZoomTimeTubes(id) {
        this.cameraProp[id].zoom = 1;
        this.emit('updateZoomTimeTubes', id);
    }

    zoomInTimeTubes(id) {
        this.cameraProp[id].zoom += 0.1;
        this.emit('updateZoomTimeTubes', id);
    }

    getPresetColors() {
        return this.presetColors;
    }

    getPresetColor(idx) {
        return this.presetColors[idx];
    }

    getPresetNum() {
        return this.presetColors.length;
    }

    getPlotColor(id) {
        return this.plotColor[id];
    }

    getInitColorIdx() {
        return this.initColorIdx;
    }

    getGridSize() {
        return this.gridSize;
    }

    getVisualQuery() {
        return this.visualQuery;
    }

    getTexture(id) {
        return this.texture[id];
    }

    getTubeNum() {
        return this.tubeNum;
    }

    getLock(id) {
        return this.lock[id];
    }

    getOpacityDistSet() {
        return opacityDistSet;
    }

    getOpacityCurves() {
        return this.opacityCurves;
    }

    getOpacityCurve(opt) {
        return this.opacityCurves[opt];
    }

    setPlotColor(id, color) {
        this.plotColor[id] = color;
    }

    setPlotColorbyIdx(id, colorIdx) {
        this.plotColor[id] = this.presetColors[colorIdx];
    }
}

const timetubesStore = new TimeTubesStore;
dispatcher.register(timetubesStore.handleActions.bind(timetubesStore));
export default timetubesStore;