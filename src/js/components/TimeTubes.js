import React from 'react';
import * as THREE from 'three';
import Details from './Details';
import * as TimeTubesAction from '../Actions/TimeTubesAction';
import * as ScatterplotsAction from '../Actions/ScatterplotsAction';
import * as DataAction from '../Actions/DataAction';
import * as FeatureAction from '../Actions/FeatureAction';
import TimeTubesStore from '../Stores/TimeTubesStore';
import DataStore from '../Stores/DataStore';
import FeatureStore from '../Stores/FeatureStore';
import BufferGeometryUtils from '../lib/BufferGeometryUtils';
import OrbitControls from "three-orbitcontrols";
import TextSprite from 'three.textsprite';
import EventListener from 'react-event-listener';

export default class TimeTubes extends React.Component{
    constructor(props) {
        super();
        this.id = props.id;
        this.data = props.data;
        this.cameraProp = TimeTubesStore.getCameraProp(props.id);
        this.tubeNum = 16;
        this.segment = 16;
        this.division = 5;
        this.currentHighlightedPlot = 0;
        this.drag = false;
        this.visualQuery = false;
        this.dragSelection = true;
        this.selector = true;
        this.animationPara = {flag: false, dep: 0, dst:0, speed: 40, now: 0};
        this.raycaster = new THREE.Raycaster();
        this.vertex = document.getElementById('vertexShader_tube').textContent;
        this.fragment = document.getElementById('fragmentShader_tube').textContent;
        this.lock = false;
        this.opacityCurve = TimeTubesStore.getOpacityCurve('Default');
        // set plot color
        if (this.data.merge) {
            this.plotColor = [];
            this.idNameLookup = {};
            // get plot colors for each dataset
            let viewNames = this.data.name.split(',');
            // get id from viewNames (DataStore)
            // get plot color for the ids (TimeTubesStore)
            for (let i = 0; i < viewNames.length; i++) {
                let id = DataStore.getIdFromName(viewNames[i]);
                this.idNameLookup[viewNames[i]] = i;
                let eachNames = viewNames[i].split('+');
                if (eachNames.length > 1) {
                    for (let j = 0; j < eachNames.length; j++) {
                        this.idNameLookup[eachNames[j]] = i;
                    }
                }
                this.plotColor.push(TimeTubesStore.getPlotColor(id));
            }
            // TimeTubesAction.changePlotColor(this.id, this.plotColor);
            TimeTubesStore.setPlotColorbyIdx(this.id, this.plotColor);
        } else {
            TimeTubesStore.setPlotColorbyIdx(this.id, (TimeTubesStore.getInitColorIdx() + this.id) % TimeTubesStore.getPresetNum());
            this.plotColor = TimeTubesStore.getPlotColor(this.id);
        }
    }

    render() {
        let width = ($(window).width() - $('#Controllers').width() - $('.right').width()) / DataStore.getDataNum()// * 0.95;
        let height = Math.max($('#Controllers').height(), 500);
        this.updateSize(width, height);
        return (
            <div style={{position: 'relative', float: 'left'}}>
                <div
                    className={'TimeTubes'}
                    style={{width: width + 'px', height: height + 'px'}}//"500px", height: "500px"}}
                    // style={{width: "500px", height: "500px", position: 'absolute', top: '0px', left: '0px', zIndex: '0'}}
                    ref={mount => {
                        this.mount = mount;
                    }}
                />
                <Details/>
            </div>
        )
    }

    componentWillMount() {
        TimeTubesStore.on('upload', () => {
            this.cameraProp = TimeTubesStore.getCameraProp(this.id);
            this.updateCamera();
        });
        TimeTubesStore.on('change', () => {
            this.cameraProp = TimeTubesStore.getCameraProp(this.id);
            this.updateCamera();
        });
        TimeTubesStore.on('reset', () => {
            this.cameraProp = TimeTubesStore.getCameraProp(this.id);
            if (this.cameraProp.xpos === 0 && this.cameraProp.ypos === 0 && this.cameraProp.zpos === 50) {
                this.resetCamera();
            }
        });
        TimeTubesStore.on('switch', () => {
            this.cameraProp = TimeTubesStore.getCameraProp(this.id);
            this.switchCamera();
        });
        TimeTubesStore.on('searchTime', (id, dst) => {
            if (id === this.id) {
                this.searchTime(dst);
            }
        });
        TimeTubesStore.on('switchGrid', (id, state) => {
            if (id === this.id) {
                this.grid.visible = state;
            }
        });
        TimeTubesStore.on('switchLabel', (id, state) => {
            if (id === this.id) {
                this.labelGroup.visible = state;
            }
        });
        TimeTubesStore.on('switchAxis', (id, state) => {
            if (id === this.id) {
                this.axis.visible = state;
            }
        });
        TimeTubesStore.on('switchPlot', (id, state) => {
            if (id === this.id) {
                this.plot.visible = state;
            }
        });
        TimeTubesStore.on('changeBackground', (id, color) => {
           if (id === this.id) {
               this.scene.background = new THREE.Color(Number(color));
           }
        });
        TimeTubesStore.on('clipTube', (id, state) => {
            if (id === this.id) {
                this.renderer.localClippingEnabled = state;
            }
        });
        TimeTubesStore.on('switchShade', (id, state) => {
            if (id === this.id) {
                this.tube.material.uniforms.shade.value = state;
            }
        });
        TimeTubesStore.on('changeFar', (id) => {
            if (id === this.id) {
                this.cameraProp = TimeTubesStore.getCameraProp(this.id);
                this.updateCamera();
            }
        });
        TimeTubesStore.on('updateMinMaxH', (id) => {
            if (id === this.id) {
                this.setMinMaxH(TimeTubesStore.getMinMaxH(this.id));
            }
        });
        TimeTubesStore.on('updateMinMaxV', (id) => {
            if (id === this.id) {
                this.setMinMaxV(TimeTubesStore.getMinMaxV(this.id));
            }
        });
        TimeTubesStore.on('changePlotColor', (id) => {
            if (id === this.id) {
                this.plotColor = TimeTubesStore.getPlotColor(this.id);
                this.changePlotsColor();
            } else if (this.data.merge) {
                let fileName = DataStore.getFileName(id);
                if (this.data.name.indexOf(fileName) >= 0) {
                    this.plotColor[this.idNameLookup[fileName]] = TimeTubesStore.getPlotColor(id);
                    this.changePlotsColor();
                }
            }
        });
        TimeTubesStore.on('timeFitting', (dst) => {
            if (TimeTubesStore.getChecked(this.id)) {
                let focused = TimeTubesStore.getFocused(this.id) + this.data.spatial[0].z;
                let fittingDst = dst;
                if (focused < this.data.spatial[0].z) {
                    // JD_Current<JD_Min：to JD_Min
                    fittingDst = this.data.spatial[0].z;
                } else if (this.data.spatial[this.data.spatial.length - 1].z < focused) {
                    // JD_Max<JD_Current：to JD_Max
                    fittingDst = this.data.spatial[this.data.spatial.length - 1].z;
                } else {
                    // move TimeTubes to the observation time of the active window
                    // do nothing
                }
                this.searchTime(fittingDst);
            }
        });
        TimeTubesStore.on('lockControl', (ids, state) => {
            if (!state || ids.indexOf(this.id) < 0) {
                this.lock = false;
            } else {
                this.lock = true;
                this.resetCamera();
            }
        });
        TimeTubesStore.on('synchronizeTubes', (id, zpos, pos, deg) => {
            if (this.lock & id !== this.id) {
                if (zpos !== 0) {
                    // move in the direction of the observation time
                    let min = this.data.meta.min['z'];
                    let max = this.data.meta.max['z'];
                    let dst = zpos + TimeTubesStore.getLock(this.id) - TimeTubesStore.getLock(id) + min;
                    if (min <= dst && dst <= max) {
                        // dst is fine
                    } else if (dst < min) {
                        dst = min;
                    } else if (max < dst) {
                        dst = max;
                    }
                    this.searchTime(dst);
                } else if (!pos.equals(new THREE.Vector3(0, 0, 0))) {
                    // rotate the tube
                    this.controls.object.position.set(pos.x, pos.y, pos.z);
                    this.controls.object.rotation.set(deg.x, deg.y, deg.z);
                }
            }
        });
        TimeTubesStore.on('updateZoomTimeTubes', (id) => {
            if (id === this.id) {
                this.cameraProp = TimeTubesStore.getCameraProp(this.id);
                this.updateCamera();
            }
        });
        TimeTubesStore.on('updateOpacity', (id, opt) => {
            if (id === this.id) {
                this.opacityCurve = TimeTubesStore.getOpacityCurve(opt);
                this.updateOpacity(opt);
            }
        });
        FeatureStore.on('switchVisualQuery', () => {
            // when the visual query is switched on, make the parameter 'visualQuery' true if the TimeTubes view is active
            let activeId = TimeTubesStore.getActiveId();
            if (activeId !== this.id) {
                this.visualQuery = false;
            } else {
                this.visualQuery = true;
            }
            this.updateControls();
            this.resetSelection();
        });
        FeatureStore.on('updateSource', () => {
            let visualQuery = FeatureStore.getVisualQuery();
            let sourceId = FeatureStore.getSource();
            if (sourceId === this.id) {
                this.visualQuery = true && visualQuery;
            } else {
                this.visualQuery = false && visualQuery;
            }
            this.updateControls();
            this.resetSelection();
        });
        FeatureStore.on('switchDragSelection', () => {
            this.dragSelection = FeatureStore.getDragSelection();
            this.updateControls();
        });
        FeatureStore.on('resetSelection', () => {
            this.deselectAll();
        });
        FeatureStore.on('switchSelector', () => {
            this.selector = FeatureStore.getSelector();
        });
        FeatureStore.on('selectTimeInterval', (value) => {
            this.selectTimeInterval(value);
        });
    }

    componentWillUnmount() {
        this.stop();
        this.mount.removeChild(this.renderer.domElement);
    }

    componentDidMount() {
        const width = this.mount.clientWidth;
        const height = this.mount.clientHeight;
        this.scene = new THREE.Scene();

        this.setCameras(width, height);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setClearColor("#000000");
        this.renderer.setSize(width, height);
        this.renderer.localClippingEnabled = true;
        this.renderer.domElement.id = 'TimeTubes_viewport_' + this.id;
        this.renderer.domElement.className = 'TimeTubes_viewport';

        // assign a canvas with the name of 'TimeTubes_viewport_ + this.id' to div element
        this.mount.appendChild(this.renderer.domElement);

        this.renderScene();
        this.start();

        this.clippingPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);

        let directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
        directionalLight.position.set(-20, 40, 60);
        this.scene.add(directionalLight);
        let ambientLight = new THREE.AmbientLight(0x292929);
        this.scene.add(ambientLight);

        this.addControls();
        let canvas = document.querySelector('#TimeTubes_viewport_' + this.id);
        let onMouseWheel = this.onMouseWheel();
        let onMouseDown = this.onMouseDown();
        let onMouseMove = this.onMouseMove();
        let onMouseUp = this.onMouseUp();
        let onMouseClick = this.onMouseClick();

        canvas.addEventListener('wheel', onMouseWheel.bind(this), false);
        canvas.addEventListener('mousedown', onMouseDown.bind(this), false);
        canvas.addEventListener('mousemove', onMouseMove.bind(this), false);
        canvas.addEventListener('mouseup', onMouseUp.bind(this), false);
        canvas.addEventListener('click', onMouseClick.bind(this), false);


        // for test
        // let geo = new THREE.BoxGeometry(5, 5, 5);
        // let mat = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
        // this.cube = new THREE.Mesh(geo, mat);
        // this.scene.add(this.cube);
        // var axis = new THREE.AxisHelper(1000);
        // this.scene.add(axis);

        this.tubeGroup = new THREE.Group();
        this.scene.add(this.tubeGroup);

        let texture = new THREE.TextureLoader();
        texture.load('img/1_256.png', this.drawTube.bind(this));
        this.drawGrid(TimeTubesStore.getGridSize() * 2, 10);
        this.drawLabel(TimeTubesStore.getGridSize() / this.data.meta.range);
        this.drawAxis();
        this.drawPlot();
    }

    start() {
        if (!this.frameId) {
            this.frameId = requestAnimationFrame(this.animate.bind(this));
        }
    }

    stop() {
        cancelAnimationFrame(this.frameId);
    }

    animate() {
        this.renderScene();
        this.frameId = window.requestAnimationFrame(this.animate.bind(this));
    }

    renderScene() {
        if (this.renderer) this.renderer.render(this.scene, this.camera);
    }

    addControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.position0.set(0, 0, 50);
        this.controls.screenSpacePanning = false;
        this.controls.enableZoom = false;
        // controls.enablePan = false;
    }

    updateControls() {
        if (this.visualQuery && this.dragSelection) {
            this.controls.enabled = false;
        } else {
            this.controls.enabled = true;
        }
    }

    onMouseWheel() {
        return function(event) {
            // 1 scroll = 100 in deltaY
            let changeColFlg = false;
            let now = this.tubeGroup.position.z;
            let dst = this.tubeGroup.position.z + event.deltaY / 100;
            if (dst < 0) {
                dst = 0;
            } else if (dst > this.data.spatial[this.data.spatial.length - 1].z - this.data.spatial[0].z) {
                dst = this.data.spatial[this.data.spatial.length - 1].z - this.data.spatial[0].z;
            }
            let i;
            for (i = 0; i < this.data.spatial.length; i++) {
                let tmp = this.data.spatial[i].z - this.data.spatial[0].z;
                if (Math.min(now, dst) < tmp && tmp < Math.max(now, dst)) {
                    dst = tmp;
                    // this.currentFocusedIdx = i;
                    if ('x' in this.data.spatial[i])
                        changeColFlg = true;
                    break;
                }
            }

            if ((dst === this.data.spatial[this.data.spatial.length - 1].z - this.data.spatial[0].z) && ('x' in this.data.spatial[this.data.spatial.length - 1])) {
                changeColFlg = true;
            }
            if ((dst === 0) && ('x' in this.data.spatial[0])) {
                changeColFlg = true;
            }

            if (changeColFlg) {
                if (!this.data.merge) {
                    for (let j = 0; j < this.data.position.length; j++) {
                        if (dst === this.data.spatial[j].z - this.data.spatial[0].z) {
                            let color = new THREE.Color('rgb(127, 255, 212)');//this.gui.__folders.Display.__folders.Plot.__controllers[1].object.plotColor;
                            // this._changePlotColor(this.currentHighlightedPlot * this.segment, new THREE.Color(color[0] / 255, color[1] / 255, color[2] / 255));
                            this.changePlotColor(this.currentHighlightedPlot * this.segment, color);
                            this.changePlotColor(j * this.segment, new THREE.Color('red'));
                            this.currentHighlightedPlot = j;
                        }
                    }
                } else {
                    let posCount = 0;
                    for (let j = 0; j < this.data.spatial.length; j++) {
                        if ('x' in this.data.spatial[j]) {
                            if (dst === this.data.spatial[j].z - this.data.spatial[0].z) {
                                let color = new THREE.Color(this.plotColor[this.idNameLookup[this.data.spatial[j].source]]);
                                this.changePlotColor(this.currentHighlightedPlot * this.segment, color);
                                this.changePlotColor(posCount * this.segment, new THREE.Color('red'));
                                this.currentHighlightedPlot = posCount;
                            }
                            posCount++;
                        }
                    }
                }
            }

            this.tubeGroup.position.z = dst;
            TimeTubesAction.updateFocus(this.id, dst, changeColFlg);
            if (this.lock)
                TimeTubesAction.synchronizeTubes(this.id, dst, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0));
            ScatterplotsAction.moveCurrentLineonTimeSelector(this.id, dst + this.data.spatial[0].z);
            DataAction.updateDetails(this.id, dst);
        }.bind(this);
    }

    onMouseDown() {
        return function (event) {
            this.drag = true;
        }
    }

    onMouseMove() {
        return function (event) {
            if (this.drag) {
                let cameraPropNow = this.cameraProp;
                cameraPropNow.xpos = this.camera.position.x;
                cameraPropNow.ypos = this.camera.position.y;
                cameraPropNow.zpos = this.camera.position.z;
                this.cameraProp = cameraPropNow;
                if (this.lock) {
                    let deg = new THREE.Vector3(this.controls.object.rotation._x, this.controls.object.rotation._y, this.controls.object.rotation._z);
                    let pos = this.controls.object.position;
                    TimeTubesAction.synchronizeTubes(this.id, 0, pos, deg);
                }
                if (this.visualQuery && this.dragSelection) {
                    let face = this.getIntersectedIndex(event);
                    if (face !== undefined && this.tube) {
                        this.tube.geometry.colorsNeedUpdate = true;
                        this.tube.geometry.attributes.selected.needsUpdate = true;
                        let startIdx = Math.floor(Math.min(face.a, face.b, face.c) / this.segment);
                        let setValue;
                        if (this.selector) {
                            setValue = 1;
                        } else {
                            setValue = 0;
                        }
                        // highlight a tube at one observation
                        for (let i = 0; i < this.segment; i++) {
                            this.tube.geometry.attributes.selected.array[startIdx * this.segment + i] = setValue;
                            this.tube.geometry.attributes.selected.array[(startIdx + 1) * this.segment + i] = setValue;
                        }
                        this.renderer.render(this.scene, this.camera);
                        this.getSelectedInterval();
                    }
                }
            }
        }
    }

    onMouseUp() {
        return function (event) {
            this.drag = false;
        }
    }

    onMouseClick() {
        return function (event) {
            if (this.visualQuery && !this.dragSelection) {
                let face = this.getIntersectedIndex(event);
                if (face !== undefined && this.tube) {
                    this.tube.geometry.colorsNeedUpdate = true;
                    this.tube.geometry.attributes.selected.needsUpdate = true;
                    let startIdx = Math.floor(Math.min(face.a, face.b, face.c) / this.segment);
                    let setValue;
                    if (this.selector) {
                        setValue = 1;
                    } else {
                        setValue = 0;
                    }
                    // highlight a tube at one observation
                    for (let i = 0; i < this.segment; i++) {
                        this.tube.geometry.attributes.selected.array[startIdx * this.segment + i] = setValue;
                        this.tube.geometry.attributes.selected.array[(startIdx + 1) * this.segment + i] = setValue;
                    }
                    this.renderer.render(this.scene, this.camera);
                }
                this.getSelectedInterval();
            } else {
                // activate the viewport
                // remove borders from all viewports
                let viewports = document.getElementsByClassName('TimeTubes_viewport');
                for (let i = 0; i < viewports.length; i++) {
                    viewports[i].style.border = 'none';
                }
                // add a border to the clicked viewport
                let currentViewport = document.getElementById('TimeTubes_viewport_' + this.id);
                currentViewport.style.border = 'solid 3px red';
                currentViewport.style.boxSizing = 'border-box';
                TimeTubesAction.activateViewport(this.id);
            }
        }
    }

    getIntersectedIndex(event) {
        let face;
        let raymouse = new THREE.Vector2();
        raymouse.x = (event.offsetX / this.renderer.domElement.clientWidth) * 2 - 1;
        raymouse.y = -(event.offsetY / this.renderer.domElement.clientHeight) * 2 + 1;
        this.raycaster.setFromCamera(raymouse, this.camera);
        let intersects = this.raycaster.intersectObject(this.tube);
        if (intersects.length > 0) {
            face = intersects[0].face;
        }
        return face;
    }

    deselectAll() {
        this.tube.geometry.colorsNeedUpdate = true;
        this.tube.geometry.attributes.selected.needsUpdate = true;
        for (let i = 0; i < this.tube.geometry.attributes.selected.array.length; i++) {
            this.tube.geometry.attributes.selected.array[i] = 0;
        }
        this.renderer.render(this.scene, this.camera);
        // FeatureAction.updateSelectedInterval([0, 0]);
    }

    resetSelection() {
        if (!this.visualQuery)
            this.deselectAll();
    }

    selectTimeInterval(value) {
        this.tube.geometry.colorsNeedUpdate = true;
        this.tube.geometry.attributes.selected.needsUpdate = true;
        let currentPos = this.tubeGroup.position.z;
        let initIdx = (Math.round(currentPos) * this.division + 1) * this.segment;//(Math.floor(currentPos) * this.division + 1) * this.segment;
        for (let i = 0; i < (Math.floor(value)) * (this.division) * this.segment; i++) {
            this.tube.geometry.attributes.selected.array[initIdx + i] = 1.0;
        }
        this.renderer.render(this.scene, this.camera);
        this.getSelectedInterval();
    }

    getSelectedInterval() {
        // get the first and last index of selected area
        let firstIdx = this.tube.geometry.attributes.selected.array.indexOf(1);
        let lastIdx = this.tube.geometry.attributes.selected.array.lastIndexOf(1);
        for (let i = firstIdx; i <= lastIdx; i++) {
            this.tube.geometry.attributes.selected.array[i] = 1;
        }
        this.renderer.render(this.scene, this.camera);
        let minJD = this.data.spatial[0].z;
        let firstJD = Math.floor(firstIdx / this.segment) * (1 / this.division) + minJD;
        let lastJD = (Math.floor(lastIdx / this.segment) + 1) * (1 / this.division) + minJD;
        let pos = this.tube.geometry.attributes.position.array.slice(firstIdx * 3, lastIdx * 3);
        let colorData = this.tube.geometry.attributes.colorData.array.slice(firstIdx * 2, lastIdx * 2);
        let indices = this.tube.geometry.index.array.slice(
            0,// firstIdx / this.segment * (this.segment - 1) * 3 * 2,
            ((lastIdx - firstIdx) / this.segment - 1) * (this.segment - 1) * 3 * 2// lastIdx / this.segment * (this.segment - 1) * 3 * 2,
            );

        let firstZpos = pos[2];
        for (let i = 0; i < pos.length / 3; i++) {
            pos[3 * i + 2] -= firstZpos;
        }
        FeatureAction.updateSelectedInterval([firstJD, lastJD], pos, colorData, indices);
    }

    // change the color of the currently focused plot
    changePlotColor(idx, color) {
        for (let i = 0; i < this.segment; i++) {
            this.plot.geometry.attributes.color.needsUpdate = true;
            this.plot.geometry.attributes.color.setXYZ(idx + i, color.r, color.g, color.b);
        }
    }

    setCameras(width, height) {
        // initialize camera properties
        let fov = 45;
        let far = Math.ceil(this.data.spatial[this.data.spatial.length - 1].z - this.data.spatial[0].z) + 50;
        let depth = Math.tan(fov / 2.0 * Math.PI / 180.0) * 2;
        let aspect = width / height;

        this.cameraSet = {};
        this.cameraSet.perspective = new THREE.PerspectiveCamera(
            fov,
            aspect,
            0.1,
            far
        );
        let size_y = depth * (50);
        let size_x = depth * (50) * aspect;
        this.cameraSet.orthographic = new THREE.OrthographicCamera(
            -size_x / 2, size_x / 2,
            size_y / 2, -size_y / 2, 0.1,
            far);

        TimeTubesAction.updateCamera(this.id, {
            xpos: 0,
            ypos: 0,
            zpos: 50,
            fov: fov,
            far: far,
            depth: depth,
            aspect: aspect,
            zoom: 1,
            type: 'Perspective'
        });

        this.camera = this.cameraSet.perspective;
        this.camera.position.z = 50;
        this.camera.lookAt(-this.scene.position);

        $( "#farSlider-" + this.id ).slider({
            min: 50,
            max: far,
            value: far
        });
    }

    resetCamera() {
        // let cameraStatus = this.cameraProp;
        this.camera.position.set(this.cameraProp.xpos, this.cameraProp.ypos, this.cameraProp.zpos);
        this.camera.zoom = this.cameraProp.zoom;
        // this.controls.position0
        this.controls.reset();
    }

    updateCamera() {
        this.camera.position.set(this.cameraProp.xpos, this.cameraProp.ypos, this.cameraProp.zpos);
        this.camera.fov = this.cameraProp.fov;
        this.camera.depth = this.cameraProp.depth;
        this.camera.far = this.cameraProp.far;
        this.camera.aspect = this.cameraProp.aspect;
        this.camera.zoom = this.cameraProp.zoom;
        this.camera.updateProjectionMatrix();
    }

    updateSize(width, height) {
        if (this.renderer) {
            this.renderer.setSize(width, height);
            TimeTubesAction.updateCamera(this.id, {aspect: width / height});
        }
    }

    switchCamera() {
        let currentPos = this.camera.position;
        if (this.cameraProp.type === 'Perspective') {
            this.camera = this.cameraSet.perspective;
            this.camera.position.x = currentPos.x;
            this.camera.position.y = currentPos.y;
            this.camera.position.z = currentPos.z;
            this.camera.lookAt(this.scene.position);
        } else if (this.cameraProp.type === 'Orthographic') {
            this.camera = this.cameraSet.orthographic;
            this.camera.position.x = currentPos.x;
            this.camera.position.y = currentPos.y;
            this.camera.position.z = currentPos.z;
            this.camera.lookAt(this.scene.position);
        }
        this.addControls();
    }

    searchTime(dst) {
        let zpos = dst - this.data.spatial[0].z;
        if (isNaN(zpos)) {
            alert('Please input numbers.');
        } else {
            this.animationPara.flag = true;
            this.animationPara.dep = this.tubeGroup.position.z;
            this.animationPara.dst = zpos;
            this.moveTube();
        }
    }

    moveTube() {
        if (this.animationPara.flag) {
            if (this.animationPara.now < this.animationPara.speed) {
                requestAnimationFrame(this.moveTube.bind(this));
                this.renderer.render(this.scene, this.camera);
                this.animationPara.now += 1;
                let anim = (1 - Math.cos(Math.PI * this.animationPara.now / this.animationPara.speed)) / 2;
                this.tubeGroup.position.z = this.animationPara.dep + (this.animationPara.dst - this.animationPara.dep) * anim;
            }
            if (this.animationPara.now === this.animationPara.speed) {
                DataAction.updateDetails(this.id, this.animationPara.dst);
                TimeTubesAction.updateFocus(this.id, this.animationPara.dst, false);
                this.animationPara.flag = false;
                this.animationPara.now = 0;
                this.animationPara.dep = 0;
                this.animationPara.dst = 0;
            }
        } else {
            this.animationPara.flag = false;
            this.animationPara.dst = 0;
        }
    }

    setMinMaxH(minmax) {
        this.tube.material.uniforms.minmaxH.value = new THREE.Vector2(minmax[0], minmax[1]);
    }

    setMinMaxV(minmax) {
        this.tube.material.uniforms.minmaxV.value = new THREE.Vector2(minmax[0], minmax[1]);
    }

    changePlotsColor() {
        if (!this.data.merge) {
            this.plot.material.color.set(this.plotColor);
        } else {
            let circleColor = [];
            let baseColors = [];
            for (let i = 0; i < this.plotColor.length; i++) {
                baseColors.push(new THREE.Color(this.plotColor[i]));
            }
            let circleIndices = Array(this.data.position.length * this.segment * 2);
            let posCount = 0;
            let del = Math.PI * 2 / this.segment;
            let range = this.data.meta.range;
            for (let i = 0; i < this.data.spatial.length; i++) {
                if ('x' in this.data.spatial[i]) {
                    let source = this.data.spatial[i].source;
                    let currentColor = baseColors[this.idNameLookup[source]];
                    for (let j = 0; j < this.segment; j++) {
                        circleColor.push(currentColor.r);
                        circleColor.push(currentColor.g);
                        circleColor.push(currentColor.b);
                    }
                }
            }
            this.plot.geometry.addAttribute('color', new THREE.Float32BufferAttribute(circleColor, 3));
        }
    }

    updateOpacity(opt) {
        this.tube.geometry.colorsNeedUpdate = true;
        this.tube.geometry.attributes.colorData.needsUpdate = true;
        let opacityPoints = this.opacityCurve.getSpacedPoints(this.tubeNum);
        let opacityList = [];
        if (opt === 'Flat') {
            for (let i = 1; i <= this.tubeNum; i++) {
                opacityList.push(1);
            }
        } else {
            for (let i = 1; i <= this.tubeNum; i++) {
                opacityList.push(1 - (1 - opacityPoints[i - 1].y) / (1 - opacityPoints[i].y));
            }
        }
        let divNumPol = this.tube.geometry.attributes.colorData.array.length / (3 * this.segment * this.tubeNum);
        for (let i = 0; i < this.tubeNum; i++) {
            for (let j = 0; j < divNumPol * this.segment; j++) {
                this.tube.geometry.attributes.colorData.array[divNumPol * this.segment * 3 * i + 3 * j + 2] = opacityList[i];
            }
        }
        this.renderer.render(this.scene, this.camera);
    }

    drawTube(texture){//texture, spline, minList, maxList) {
        TimeTubesAction.updateTexture(this.id, texture);
        this.texture = texture;
        let minJD = this.data.spatial[0].z;
        let maxJD = this.data.spatial[this.data.spatial.length - 1].z;
        let range = this.data.meta.range;
        let divNum = this.division * Math.ceil(maxJD - minJD);
        let delTime = (maxJD - minJD) / divNum;
        let divNumPol = Math.ceil((this.data.splines.position.getPoint(1).z - this.data.splines.position.getPoint(0).z) / delTime);
        let divNumPho = Math.ceil((this.data.splines.color.getPoint(1).z - this.data.splines.color.getPoint(0).z) / delTime);
        let cen = this.data.splines.position.getSpacedPoints(divNumPol);
        let rad = this.data.splines.radius.getSpacedPoints(divNumPol);
        let col = this.data.splines.color.getSpacedPoints(divNumPho);
        let idxGap = Math.ceil((this.data.splines.color.getPoint(0).z - this.data.splines.position.getPoint(0).z) / delTime);
        let del = Math.PI * 2 / (this.segment - 1);
        let vertices = [];
        let colors = [];
        for (let i = 0; i < this.tubeNum; i++) {
            vertices[i] = [];
            colors[i] = [];
        }
        let indices = [];
        let selected = [];
        let currentColorX = 0, currentColorY = 0;
        let minH = this.data.meta.min.H, maxH = this.data.meta.max.H;
        let minV = this.data.meta.min.V, maxV = this.data.meta.max.V;
        let opacityPoints = this.opacityCurve.getSpacedPoints(this.tubeNum);
        let opacityList = [];
        for (let i = 1; i <= this.tubeNum; i++) {
            opacityList.push(1 - (1 - opacityPoints[i - 1].y) / (1 - opacityPoints[i].y));
        }
        for (let i = 0; i <= divNumPol; i++) {
            currentColorX = 0;
            currentColorY = 0;
            if (idxGap < i && (i - idxGap) < divNumPho) {
                currentColorX = col[i - idxGap].x;//(col[i - idxGap].x - minH) / (maxH - minH);
                currentColorY = col[i - idxGap].y;//(col[i - idxGap].y - minV) / (maxV - minV);
            }
            for (let j = 0; j < this.segment; j++) {
                for (let k = 0; k < this.tubeNum; k++) {
                    // k = 0;
                    let currad = (1 / this.tubeNum) * (k + 1);
                    let deg = del * j;
                    vertices[k].push((cen[i].x * range + currad * rad[i].x * range * Math.cos(deg)) * -1);
                    vertices[k].push(cen[i].y * range + currad * rad[i].y * range * Math.sin(deg));
                    vertices[k].push(cen[i].z - minJD);

                    colors[k].push(currentColorX);
                    colors[k].push(currentColorY);
                    colors[k].push(opacityList[k]);
                }

                if (j !== this.segment - 1) {
                    indices.push(j + i * (this.segment));
                    indices.push(j + (this.segment) + i * (this.segment));
                    indices.push(j + 1 + i * (this.segment));
                    indices.push(j + (this.segment) + i * (this.segment));
                    indices.push(j + 1 + (this.segment) + i * (this.segment));
                    indices.push(j + 1 + i * (this.segment));
                }
            }
        }
        indices = indices.slice(0, -1 * this.segment * 3 * 2);
        selected = new Float32Array(vertices[0].length / 3);
        let normals = new Float32Array(vertices[0].length);
        let geometries = [];
        for (let i = 0; i < this.tubeNum; i++) {
            const geometryTmp = new THREE.BufferGeometry();
            geometryTmp.addAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices[i]), 3));
            geometryTmp.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
            geometryTmp.addAttribute('colorData', new THREE.BufferAttribute(new Float32Array(colors[i]), 3));
            geometryTmp.addAttribute('selected', new THREE.BufferAttribute(new Float32Array(selected), 1));
            geometryTmp.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
            // geometryTmp.computeFaceNormals();
            geometryTmp.computeVertexNormals();
            geometries.push(geometryTmp);
        }
        let tubeGeometry = BufferGeometryUtils.mergeBufferGeometries(geometries);
        // optional
        // geometry.computeBoundingBox();
        // geometry.computeBoundingSphere();

        // compute normals automatically
        // tubeGeometry.computeFaceNormals();
        // tubeGeometry.computeVertexNormals();
        let tubeMaterial = new THREE.ShaderMaterial({
            vertexShader: this.vertex,//vertexShaderTube,
            fragmentShader: this.fragment,//fragmentShaderTube,
            uniforms: {
                lightPosition: {value: new THREE.Vector3(-20, 40, 60)},
                tubeNum: {value: this.tubeNum},
                shade: {value: true},
                texture: {value: this.texture},
                minmaxH: {value: new THREE.Vector2(this.data.meta.min.H, this.data.meta.max.H)},
                minmaxV: {value: new THREE.Vector2(this.data.meta.min.V, this.data.meta.max.V)}
            },
            side: THREE.DoubleSide,
            transparent: true,
            clipping: true,
            clippingPlanes: [this.clippingPlane]
        });
        this.tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
        this.tubeGroup.add(this.tube);
        this.tube.rotateY(Math.PI);
        TimeTubesAction.updateMinMaxH(this.id, this.data.meta.min.H, this.data.meta.max.H);
        TimeTubesAction.updateMinMaxV(this.id, this.data.meta.min.V, this.data.meta.max.V);
    }

    drawGrid(size, divisions) {
        this.grid = new THREE.GridHelper(size, divisions, 'white', 'limegreen');
        this.grid.rotateX(Math.PI / 2);
        this.scene.add(this.grid);
    }

    drawLabel(range) {
        let gridSize = TimeTubesStore.getGridSize();
        this.labelGroup = new THREE.Group();
        this.scene.add(this.labelGroup);
        let pm = [
            [1, 1],
            [-1, 1],
            [-1, -1],
            [1, -1]
        ];
        for (let i = 0; i < pm.length; i++) {
            let label = new TextSprite({
                material: {
                    color: 0xffffff,
                },
                redrawInterval: 250,
                textSize: 0.8,
                texture: {
                    fontFamily: 'Arial, Helvetica, sans-serif',
                    text: '(' + pm[i][0] * range + ', ' + pm[i][1] * range + ')',
                },
            });
            this.labelGroup.add(label);
            label.position.set( pm[i][0] * gridSize,  pm[i][1] * gridSize, 0);
        }
        let QIlabel = new TextSprite({
            material: {
                color: 0x006400,
            },
            redrawInterval: 250,
            textSize: 1,
            texture: {
                fontFamily: 'Arial, Helvetica, sans-serif',
                fontStyle: 'italic',
                text: 'Q/I',
            },
        });
        let UIlabel = new TextSprite({
            material: {
                color: 0x006400,
            },
            redrawInterval: 250,
            textSize: 1,
            texture: {
                fontFamily: 'Arial, Helvetica, sans-serif',
                fontStyle: 'italic',
                text: 'U/I',
            },
        });
        this.labelGroup.add(QIlabel);
        this.labelGroup.add(UIlabel);
        QIlabel.position.set(gridSize + 1, 0, 0);
        UIlabel.position.set(0, gridSize + 1, 0);
    }

    drawAxis() {
        // 20 * 20
        let axisGeometry = new THREE.BufferGeometry();
        let axisMaterial = new THREE.LineBasicMaterial({
            color: 'white',
            opacity: 0.5,
            clippingPlanes: [this.clippingPlane]
        });
        let axisPosisitons = [];
        let axisIndices = [];
        let j = 0, curZ = 0;
        for (let i = 0; i < this.data.spatial.length; i++) {
            curZ = this.data.spatial[i].z - this.data.spatial[0].z;

            // left
            axisPosisitons.push(-10);
            axisPosisitons.push(0);
            axisPosisitons.push(curZ);
            // right
            axisPosisitons.push(10);
            axisPosisitons.push(0);
            axisPosisitons.push(curZ);
            // top
            axisPosisitons.push(0);
            axisPosisitons.push(10);
            axisPosisitons.push(curZ);
            // bottom
            axisPosisitons.push(0);
            axisPosisitons.push(-10);
            axisPosisitons.push(curZ);

            axisIndices.push(j + 0);
            axisIndices.push(j + 1);
            axisIndices.push(j + 2);
            axisIndices.push(j + 3);
            j = j + 4;
        }
        axisGeometry.setIndex(axisIndices);
        axisGeometry.addAttribute(
            'position',
            new THREE.Float32BufferAttribute(axisPosisitons, 3)
        );
        this.axis = new THREE.LineSegments( axisGeometry, axisMaterial );
        this.tubeGroup.add(this.axis);
        this.axis.rotateY(Math.PI);
    }

    drawPlot() {
        if (this.data.merge) {
            let circlePositions = [];
            let circleColor = [];
            let baseColors = [];
            for (let i = 0; i < this.plotColor.length; i++) {
                baseColors.push(new THREE.Color(this.plotColor[i]));
            }
            let circleIndices = Array(this.data.position.length * this.segment * 2);
            let posCount = 0;
            let del = Math.PI * 2 / this.segment;
            let range = this.data.meta.range;
            for (let i = 0; i < this.data.spatial.length; i++) {
                if ('x' in this.data.spatial[i]) {
                    let zpos = this.data.spatial[i].z - this.data.spatial[0].z;
                    let xcen = -this.data.spatial[i].x * range;
                    let ycen = this.data.spatial[i].y * range;
                    let xrad = this.data.spatial[i].r_x * range;
                    let yrad = this.data.spatial[i].r_y * range;

                    let currentIdx = this.segment * 2 * posCount;
                    let source = this.data.spatial[i].source;
                    let currentColor = baseColors[this.idNameLookup[source]];
                    circleIndices[currentIdx] = posCount * this.segment;
                    circleIndices[currentIdx + this.segment * 2 - 1] = posCount * this.segment;
                    for (let j = 0; j < this.segment; j++) {
                        circlePositions.push(xcen + xrad * Math.cos(del * j));
                        circlePositions.push(ycen + yrad * Math.sin(del * j));
                        circlePositions.push(zpos);

                        circleColor.push(currentColor.r);
                        circleColor.push(currentColor.g);
                        circleColor.push(currentColor.b);

                        if (j !== 0) {
                            circleIndices[currentIdx + 2 * (j - 1) + 1] = posCount * this.segment + j;
                            circleIndices[currentIdx + 2 * (j - 1) + 2] = posCount * this.segment + j;
                        }
                    }
                    posCount++;
                }
            }
            let circleGeometry = new THREE.BufferGeometry();
            circleGeometry.setIndex(circleIndices);
            circleGeometry.addAttribute('position', new THREE.Float32BufferAttribute(circlePositions, 3));
            circleGeometry.addAttribute('color', new THREE.Float32BufferAttribute(circleColor, 3));
            let circleMaterial = new THREE.LineBasicMaterial({
                vertexColors: THREE.VertexColors,
                clippingPlanes: [this.clippingPlane]
            });
            this.plot = new THREE.LineSegments(circleGeometry, circleMaterial);
            // console.log(this.plot);
            // this.tubeGroup.add(this.plot);
            // this.plot.rotateY(Math.PI);
        } else {
            let circlePositions = [];
            let circleColor = [];
            let baseColor = new THREE.Color(this.plotColor);//'rgb(127, 255, 212)');
            let circleIndices = Array(this.data.position.length * this.segment * 2);
            let del = Math.PI * 2 / this.segment;
            let range = this.data.meta.range;
            // let plotNum = 0;
            for (let i = 0; i < this.data.position.length; i++) {
                let zpos = this.data.position[i].z - this.data.position[0].z;
                let xcen = -this.data.position[i].x * range;
                let ycen = this.data.position[i].y * range;
                let xrad = this.data.radius[i].x * range;
                let yrad = this.data.radius[i].y * range;
                // 0-1, 1-2, 2-3, ... , 31-0
                let currentIdx = this.segment * 2 * i;
                circleIndices[currentIdx] = i * this.segment;
                circleIndices[currentIdx + this.segment * 2 - 1] = i * this.segment;
                for (let j = 0; j < this.segment; j++) {
                    circlePositions.push(xcen + xrad * Math.cos(del * j));
                    circlePositions.push(ycen + yrad * Math.sin(del * j));
                    circlePositions.push(zpos);

                    circleColor.push(baseColor.r);
                    circleColor.push(baseColor.g);
                    circleColor.push(baseColor.b);

                    if (j !== 0) {
                        circleIndices[currentIdx + 2 * (j - 1) + 1] = i * this.segment + j;
                        circleIndices[currentIdx + 2 * (j - 1) + 2] = i * this.segment + j;
                    }
                }
            }
            let circleGeometry = new THREE.BufferGeometry();
            circleGeometry.setIndex(circleIndices);
            circleGeometry.addAttribute('position', new THREE.Float32BufferAttribute(circlePositions, 3));
            circleGeometry.addAttribute('color', new THREE.Float32BufferAttribute(circleColor, 3));

            let circleMaterial = new THREE.LineBasicMaterial({
                vertexColors: THREE.VertexColors,
                clippingPlanes: [this.clippingPlane]
            });
            this.plot = new THREE.LineSegments(circleGeometry, circleMaterial);
        }
        this.tubeGroup.add(this.plot);
        this.plot.rotateY(Math.PI);
    }
}