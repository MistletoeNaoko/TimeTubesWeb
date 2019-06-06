import {EventEmitter} from 'events';
import dispatcher from "../Dispatcher/dispatcher";

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
            type: 'Perspective'
        }];
        this.checked = [];
        this.focused = [];
        this.minmaxV = [];
        this.minmaxH = [];
        this.plotColor = [];
        this.gridSize = 15;
        this.visualQuery = false;
        this.dragSelection = true;
    }

    handleActions(action) {
        // console.log('CameraStore received an action', action);
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
                this.updateFocus(action.id, action.zpos);
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
            case 'UPDATE_CURRENTPOS':
                this.updateCurrentPos(action.id, action.zpos);
                break;
            case 'SWITCH_VISUALQUERY':
                this.switchVisualQuery(action.status);
                break;
            case 'SWITCH_DRAGSELECTION':
                this.switchDragSelection(action.status);
                break;
            case 'RESET_SELECTION':
                this.resetSelection();
                break;
            case 'SWITCH_SELECTOR':
                this.switchSelector();
                break;
            default:
        }
    }

    getCameraProp(id) {
        return this.cameraProp[id];
    }

    getCheckedList() {
        return this.checked;
    }

    getFocused(id) {
        return this.focused[id];
    }

    getMinMaxH(id) {
        return this.minmaxH[id];
    }

    getMinMaxV(id) {
        return this.minmaxV[id];
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
                type: 'Perspective'
            }
        );
        this.checked.push(true);
        this.focused.push(0);
        this.minmaxV.push([0, 0]);
        this.minmaxV.push([0, 0]);
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

    updateFocus(id, zpos) {
        this.focused[id] = zpos;
        this.emit('updateFocus', id);
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

    updateCurrentPos(id, zpos) {
        this.emit('updateCurrentPos', id, zpos);
    }

    switchVisualQuery(status) {
        this.visualQuery = status;
        this.emit('switchVisualQuery');
    }

    switchDragSelection(status) {
        this.dragSelection = status;
        this.emit('switchDragSelection');
    }

    resetSelection() {
        this.emit('resetSelection');
    }

    switchSelector() {
        this.emit('switchSelector');
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

    getDragSelection() {
        return this.dragSelection;
    }

    setPlotColor(id, color) {
        this.plotColor[id] = color;
    }

    setPlotColorbyIdx(id, colorIdx) {
        this.plotColor[id] = this.presetColors[colorIdx];
    }
}

const cameraStore = new TimeTubesStore;
dispatcher.register(cameraStore.handleActions.bind(cameraStore));
export default cameraStore;