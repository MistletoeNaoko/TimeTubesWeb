import React from 'react';
import * as THREE from 'three';
import DataStore from '../Stores/DataStore';
import TimeTubesStore from '../Stores/TimeTubesStore';
import FeatureStore from '../Stores/FeatureStore';
import OrbitControls from "three-orbitcontrols";

export default class SelectedTimeSlice extends React.Component {
    constructor(props) {
        super();
        this.sourceId = props.sourceId;
        this.selectedPeriod = FeatureStore.getSelectedPeriod();
        this.data = DataStore.getData(this.sourceId);
        this.texture = TimeTubesStore.getTexture();
        this.segment = TimeTubesStore.getSegment();
        this.division = TimeTubesStore.getDivision();
        this.ignoredVariables = [];
    }

    render() {
        // this.props sourceId
        let width = $('#selectedIntervalViewArea').width();
        let height = width;
        return (
            <div
                className='TimeTubes'
                id='selectedTimeSliceView'
                ref={mount => {
                    this.mount = mount;
                }}>
                <div className='overlayHidingPanel'></div>
            </div>
        )
    }

    componentWillMount() {
        TimeTubesStore.on('switch', () => {
           if (this.camera) {
               this.switchCamera();
           }
        });
        FeatureStore.on('updateSource', () => {
            this.sourceId = FeatureStore.getSource();
            this.data = DataStore.getData(this.sourceId);
            this.setUpScene();
        });
        FeatureStore.on('resetSelection', () => {
            this.deselectAll();
        });
        FeatureStore.on('updateSelectedPeriod', () => {
            this.selectedPeriod = FeatureStore.getSelectedPeriod();
            this.updateTimePeriod();
        });
        FeatureStore.on('selectPeriodfromSP', (period) => {
            this.selectedPeriod = FeatureStore.getSelectedPeriod();
            this.updateTimePeriod();
        });
        FeatureStore.on('selectTimeInterval', (id, value) => {
            this.selectedPeriod = FeatureStore.getSelectedPeriod();
            console.log(this.selectedPeriod);
            this.updateTimePeriod();
        });
        FeatureStore.on('setIgnoredVariables', (varList) => {
            this.ignoredVariables = varList;
            this.redrawTube();
        });
        FeatureStore.on('convertResultIntoQuery', (id, period, ignored) => {
            if (FeatureStore.getMode() === 'QBE') {
                this.sourceId = id;
                this.selectedPeriod = period;
                this.ignoredVariables = ignored;
                this.data = DataStore.getData(this.sourceId);
                if (!this.tube) {
                    this.setUpScene();
                }
                // update the source select menu
                let sourceList = document.getElementById('sourceList');
                for (let i = 0; i < sourceList.options.length; i++) {
                    if (Number(sourceList.options[i].value) === id) {
                        sourceList.selectedIndex = i;
                        break;
                    }
                }
                // update the selection detail information
                $('#selectedInterval').text('JD: ' + period[0].toFixed(3) + ' - ' + period[1].toFixed(3));
                $('#targetLengthMin').val(Math.floor(period[1]) - Math.ceil(period[0]));
                $('#targetLengthMax').val(Math.floor(period[1]) - Math.ceil(period[0]));

                // update ignored variables
                if (ignored) {
                    let checkList = $('input[name=QBEIgnored]');
                    checkList.each(function(index, element) {
                        if (ignored.indexOf(element.value) < 0) {
                            element.checked = false;
                        } else {
                            element.checked = true;
                        }
                    });
                }
            }
            this.updateTimePeriod();
            this.redrawTube();
        });
    }

    componentWillUnmount() {
        this.stop();
        this.mount.removeChild(this.renderer.domElement);
    }

    componentDidMount() {
        this.initializeScene();
    }

    initializeScene() {
        const width = $('#selectedIntervalViewArea').width();//this.mount.clientWidth;
        const height = width;//this.mount.clientHeight;
        this.scene = new THREE.Scene();
        this.setCameras();
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setClearColor("#000000");
        this.renderer.setSize(width, height);
        this.renderer.domElement.id = 'selectedTimeSliceView';
        this.mount.appendChild(this.renderer.domElement);

        let directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
        directionalLight.position.set(-20, 40, 60);
        this.scene.add(directionalLight);
        let ambientLight = new THREE.AmbientLight(0x292929);
        this.scene.add(ambientLight);
        var axis = new THREE.AxesHelper(1000);
        this.scene.add(axis);
        
        this.renderScene();
        this.start();
        this.addControls();
        if (this.sourceId >= 0) {
            this.setPlaceHolder();
        }
    }

    setUpScene() {
        this.updateCameras();
        this.setPlaceHolder();
        this.renderScene();
        this.start();
        this.addControls();
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

    setCameras() {
        // initialize camera properties
        let cameraProp;
        if (this.sourceId >= 0) {
            cameraProp = TimeTubesStore.getCameraProp(this.sourceId);
        } else {
            cameraProp = TimeTubesStore.getDefaultCameraProp();
        }
        this.cameraSet = {};
        this.cameraSet.perspective = new THREE.PerspectiveCamera(
            cameraProp.fov,
            1,
            0.1,
            cameraProp.far
        );
        let size_y = cameraProp.depth * (50);
        let size_x = cameraProp.depth * (50) * 1;
        this.cameraSet.orthographic = new THREE.OrthographicCamera(
            -size_x / 2, size_x / 2,
            size_y / 2, -size_y / 2, 0.1,
            cameraProp.far);

        if (cameraProp.type === 'Perspective') {
            this.camera = this.cameraSet.perspective;
        } else {
            this.camera = this.cameraSet.orthographic;
        }
        this.camera.position.z = 50;
        this.camera.lookAt(-this.scene.position);
    }

    updateCameras() {
        let cameraProp = TimeTubesStore.getCameraProp(this.sourceId);
        this.cameraSet.perspective.fov = cameraProp.fov;
        this.cameraSet.perspective.far = cameraProp.far;

        let size_y = cameraProp.depth * (50);
        let size_x = cameraProp.depth * (50) * 1;
        this.cameraSet.orthographic.left = -size_x / 2;
        this.cameraSet.orthographic.right = size_x / 2;
        this.cameraSet.orthographic.top = size_y / 2;
        this.cameraSet.orthographic.bottom = -size_y / 2;
        this.cameraSet.orthographic.far = cameraProp.far;


        if (cameraProp.type === 'Perspective') {
            this.camera = this.cameraSet.perspective;
        } else {
            this.camera = this.cameraSet.orthographic;
        }
        this.camera.position.z = 50;
        this.camera.lookAt(-this.scene.position);
    }

    setPlaceHolder() {
        let texture = TimeTubesStore.getTexture(this.sourceId);
        let pos = new Float32Array(0);
        let color = new Float32Array(0);
        let normals = new Float32Array(0);
        let selected = new Float32Array(0);
        let indices = new Uint32Array(0);
        let tubeGeometry = new THREE.BufferGeometry();
        tubeGeometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
        tubeGeometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
        tubeGeometry.addAttribute('colorData', new THREE.BufferAttribute(new Float32Array(color), 2));
        tubeGeometry.addAttribute('selected', new THREE.BufferAttribute(new Float32Array(selected), 1));
        tubeGeometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
        tubeGeometry.computeVertexNormals();
        let tubeMaterial = new THREE.ShaderMaterial({
            vertexShader: document.getElementById('vertexShader_tube').textContent,
            fragmentShader: document.getElementById('fragmentShader_tube').textContent,
            uniforms: {
                lightPosition: {value: new THREE.Vector3(-20, 40, 60)},
                tubeNum: {value: 1},//TimeTubesStore.getTubeNum()},
                shade: {value: false},
                texture: {value: texture},
                minmaxH: {value: new THREE.Vector2(this.data.data.meta.min.H, this.data.data.meta.max.H)},
                minmaxV: {value: new THREE.Vector2(this.data.data.meta.min.V, this.data.data.meta.max.V)},
                flagH: {value: true},
                flagV: {value: true}
            },
            side: THREE.DoubleSide,
            transparent: true,
        });
        this.tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
        this.tube.rotateY(Math.PI);
        this.scene.add(this.tube);
    }

    switchCamera() {
        let currentPos = this.camera.position;
        let cameraProp = TimeTubesStore.getCameraProp(this.sourceId);
        if (cameraProp.type === 'Perspective') {
            this.camera = this.cameraSet.perspective;
            this.camera.position.x = currentPos.x;
            this.camera.position.y = currentPos.y;
            this.camera.position.z = currentPos.z;
            this.camera.lookAt(this.scene.position);
        } else if (cameraProp.type === 'Orthographic') {
            this.camera = this.cameraSet.orthographic;
            this.camera.position.x = currentPos.x;
            this.camera.position.y = currentPos.y;
            this.camera.position.z = currentPos.z;
            this.camera.lookAt(this.scene.position);
        }
        this.addControls();
    }

    addControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.position0.set(0, 0, 50);
        this.controls.screenSpacePanning = false;
        this.controls.enableZoom = false;
        // controls.enablePan = false;
    }

    drawSelectedTube(pos, color, indices) {
        this.tube.geometry.attributes.position.needsUpdate = true;
        this.tube.geometry.attributes.normal.needsUpdate = true;
        this.tube.geometry.attributes.colorData.needsUpdate = true;
        this.tube.geometry.attributes.selected.needsUpdate = true;
        this.tube.geometry.index.needsUpdate = true;

        this.tube.geometry.attributes.position = new THREE.BufferAttribute(new Float32Array(pos), 3);
        this.tube.geometry.attributes.colorData = new THREE.BufferAttribute(new Float32Array(color), 3);
        this.tube.geometry.attributes.selected = new THREE.BufferAttribute(new Float32Array(pos.length / 3), 1);
        this.tube.geometry.attributes.normal = new THREE.BufferAttribute(new Float32Array(pos.length), 1);
        this.tube.geometry.index = new THREE.BufferAttribute(new Uint32Array(indices), 1);
        this.tube.geometry.computeVertexNormals();
        this.renderer.render(this.scene, this.camera);
    }

    deselectAll() {
        this.tube.geometry.attributes.position.needsUpdate = true;
        this.tube.geometry.attributes.normal.needsUpdate = true;
        this.tube.geometry.attributes.colorData.needsUpdate = true;
        this.tube.geometry.attributes.selected.needsUpdate = true;
        this.tube.geometry.index.needsUpdate = true;

        this.tube.geometry.attributes.position = new THREE.BufferAttribute(new Float32Array(0), 3);
        this.tube.geometry.attributes.colorData = new THREE.BufferAttribute(new Float32Array(0), 2);
        this.tube.geometry.attributes.selected = new THREE.BufferAttribute(new Float32Array(0), 1);
        this.tube.geometry.attributes.normal = new THREE.BufferAttribute(new Float32Array(0), 1);
        this.tube.geometry.index = new THREE.BufferAttribute(new Uint32Array(0), 1);
        this.tube.geometry.computeVertexNormals();
        this.renderer.render(this.scene, this.camera);
    }

    extractTubeAttributes() {
        let attributes = FeatureStore.getTubeAttributes(Number(this.sourceId));
        // let firstJD = Math.floor(firstIdx / this.segment) * (1 / this.division) + minJD;
        let firstIdx = (Math.ceil(this.selectedPeriod[0] - this.data.data.meta.min.z) * this.division * this.segment);
        let lastIdx = (Math.ceil(this.selectedPeriod[1] - this.data.data.meta.min.z) * this.division * this.segment);
        let pos = attributes.position.slice(firstIdx * 3, lastIdx * 3);
        let col = attributes.color.slice(firstIdx * 3, lastIdx * 3);
        let minPos = pos[2];
        // move the tube to the initial position and show a solid tube
        for (let i = 0; i < pos.length / 3; i++) {
            pos[i * 3 + 2] -= minPos;
            col[i * 3 + 2] = 1;
        }
        return {pos: pos, col: col, indices: attributes.indices.slice(0, ((lastIdx - firstIdx) / this.segment - 1) * (this.segment - 1) * 3 * 2)};
    }

    updateTimePeriod() {
        let attributes = this.extractTubeAttributes();
        this.drawSelectedTube(
            attributes.pos,
            attributes.col,
            attributes.indices
        );
    }

    redrawTube() {
        let ignoredX = (this.ignoredVariables)? this.ignoredVariables.indexOf('x'): -1,
            ignoredY = (this.ignoredVariables)? this.ignoredVariables.indexOf('y'): -1,
            ignoredRX = (this.ignoredVariables)? this.ignoredVariables.indexOf('r_x'): -1,
            ignoredRY = (this.ignoredVariables)? this.ignoredVariables.indexOf('r_y'): -1,
            ignoredH = (this.ignoredVariables)? this.ignoredVariables.indexOf('H'): -1,
            ignoredV = (this.ignoredVariables)? this.ignoredVariables.indexOf('V'): -1;
        // if any ignored variables on positions (x, y, r_x, r_y) are set, recompute position attribute
        let minJD = this.data.data.meta.min.z;
        let maxJD = this.data.data.meta.max.z;
        let range = this.data.data.meta.range;
        let divNum = this.division * Math.ceil(maxJD - minJD);
        let delTime = (maxJD - minJD) / divNum;
        let divNumPol = Math.ceil((this.data.data.splines.position.getPoint(1).z - this.data.data.splines.position.getPoint(0).z) / delTime);
        let divNumPho = Math.ceil((this.data.data.splines.color.getPoint(1).z - this.data.data.splines.color.getPoint(0).z) / delTime);
        let cen = this.data.data.splines.position.getSpacedPoints(divNumPol);
        let rad = this.data.data.splines.radius.getSpacedPoints(divNumPol);
        let col = this.data.data.splines.color.getSpacedPoints(divNumPho);
        let del = Math.PI * 2 / (this.segment - 1);
        let minIdx = Math.ceil((this.selectedPeriod[0] - minJD) / delTime);
        let attrSize = this.tube.geometry.attributes.position.array.length / 3 / this.segment;
        let maxIdx = Math.ceil((this.selectedPeriod[1] - minJD) / delTime);
        let vertices = [], colors = [];
        let deg, cenX, cenY, radX, radY;
        for (let i = minIdx; i < minIdx + attrSize; i++) {//i <= maxIdx; i++) {
            cenX = (ignoredX >= 0) ? 0 : cen[i].x;
            cenY = (ignoredY >= 0) ? 0 : cen[i].y;
            radX = (ignoredRX >= 0) ? 1 / range : rad[i].x;
            radY = (ignoredRY >= 0) ? 1 / range : rad[i].y;
            for (let j = 0; j < this.segment; j++) {
                deg = del * j;
                vertices.push((cenX * range + radX * range * Math.cos(deg)) * -1);
                vertices.push(cenY * range + radY * range * Math.sin(deg));
                vertices.push(cen[i].z - this.selectedPeriod[0]);
            }
        }
        // if any ignored variables on colors (H, V) are set, pass a flag as a uniform
        this.tube.material.uniforms.flagH.value = (ignoredH >= 0)? false: true;
        this.tube.material.uniforms.flagV.value = (ignoredV >= 0)? false: true;
        this.tube.geometry.attributes.position.needsUpdate = true;
        this.tube.geometry.attributes.position = new THREE.BufferAttribute(new Float32Array(vertices), 3);
        this.tube.geometry.computeVertexNormals();
        this.renderer.render(this.scene, this.camera);
    }
}
