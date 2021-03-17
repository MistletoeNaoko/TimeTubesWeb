import React from 'react';
import * as THREE from 'three';
import * as d3 from 'd3';
import DataStore from '../Stores/DataStore';
import TimeTubesStore from '../Stores/TimeTubesStore';
import FeatureStore from '../Stores/FeatureStore';
import ClusteringStore from '../Stores/ClusteringStore';
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
        this.activeVar = FeatureStore.getActive();
        this.clusterCenter = {};
        this.splinesClusterCenter = {};
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

    componentWillUnmount() {
        this.stop();
        this.mount.removeChild(this.renderer.domElement);
    }

    componentDidMount() {
        this.initializeScene();

        // for the case when 'recoverQuery' is called before selected time slice is monted
        // Eventlistener does not work before the components are mounted
        if (this.sourceId >= 0 && this.selectedPeriod[0] >= 0 && this.selectedPeriod[1] >= 0) {
            if (!this.tube) {
                this.setUpScene();
            }
            this.hideClusteringTube();
            this.updateTimePeriod();
            this.redrawTube();
        }

        TimeTubesStore.on('switch', () => {
           if (this.camera) {
               this.switchCamera();
           }
        });
        FeatureStore.on('switchQueryMode', (mode) => {
            if (mode !== 'QBE') {
                this.sourceId = FeatureStore.getSource();
                this.activeVar = [];
                if (this.tube) {
                    this.deselectAll();
                }
            }
        });
        FeatureStore.on('updateSource', () => {
            this.sourceId = FeatureStore.getSource();
            this.data = DataStore.getData(this.sourceId);
            this.setUpScene();
        });
        FeatureStore.on('resetSelection', () => {
            if (this.tube) {
                this.deselectAll();
            }
        });
        FeatureStore.on('updateSelectedPeriod', () => {
            this.hideClusteringTube();
            this.selectedPeriod = FeatureStore.getSelectedPeriod();
            this.updateTimePeriod();
        });
        FeatureStore.on('selectPeriodfromSP', (period) => {
            this.selectedPeriod = FeatureStore.getSelectedPeriod();
            this.hideClusteringTube();
            if (this.selectedPeriod[1] - this.selectedPeriod[0] > 0) {
                this.updateTimePeriod();
            } else {
                if (this.tube) {
                    this.deselectAll();
                }
            }
        });
        FeatureStore.on('selectTimeInterval', (id, value) => {
            this.hideClusteringTube();
            this.selectedPeriod = FeatureStore.getSelectedPeriod();
            this.updateTimePeriod();
        });
        FeatureStore.on('setActiveVariables', (varList) => {
            this.activeVar = varList;
            this.redrawTube();
        });
        FeatureStore.on('convertResultIntoQuery', (id, period, activeVar) => {
            if (FeatureStore.getMode() === 'QBE') {
                this.sourceId = id;
                this.selectedPeriod = period;
                this.activeVar = activeVar;
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
                if (activeVar) {
                    let checkList = $('input[name=QBEActive]');
                    checkList.each(function(index, element) {
                        if (activeVar.indexOf(element.value) < 0) {
                            element.checked = false;
                        } else {
                            element.checked = true;
                        }
                    });
                }
                this.hideClusteringTube();
                this.updateTimePeriod();
                this.redrawTube();
            }
        });
        FeatureStore.on('recoverQuery', (query) => {
            if (FeatureStore.getMode() === 'QBE') {
                this.sourceId = FeatureStore.getSource();
                this.selectedPeriod = FeatureStore.getSelectedPeriod();
                this.activeVar = FeatureStore.getActive();
                this.data = DataStore.getData(this.sourceId);
                if (!this.tube) {
                    this.setUpScene();
                }
                this.hideClusteringTube();
                this.updateTimePeriod();
                this.redrawTube();
            }
        });
        FeatureStore.on('convertClusterCenterIntoQuery', (clusterCenter) => {
        　　 if (FeatureStore.getMode() === 'QBE') {
                this.clusterCenter = clusterCenter;
                this.activeVar = clusterCenter.parameters.variables;
                this.splinesClusterCenter = {}
                this.computeSplines(clusterCenter);
                let texture = new THREE.TextureLoader();
                texture.load('img/1_256.png', function(texture) {
                    this.textureCluster = texture;
                    this.drawClusterCenterTube(clusterCenter);
                }.bind(this));
            }
        });
    }

    componentDidUpdate() {
        const width = $('#selectedIntervalViewArea').width();
        const height = width;
        this.renderer.setSize(width, height);
    }

    hideClusteringTube() {
        if (this.tube) {
            this.tube.visible = true;
        }
        if (this.tubeCluster) {
            this.tubeCluster.visible = false;
        }
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
        let cameraProp;
        if (this.sourceId >= 0) {
            cameraProp = TimeTubesStore.getCameraProp(this.sourceId);
        } else {
            cameraProp = TimeTubesStore.getDefaultCameraProp();
        }
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
        if (this.tube === undefined) {
            let texture = TimeTubesStore.getTexture(this.sourceId);
            let pos = new Float32Array(0);
            let color = new Float32Array(0);
            let normals = new Float32Array(0);
            let selected = new Float32Array(0);
            let indices = new Uint32Array(0);
            let tubeGeometry = new THREE.BufferGeometry();
            tubeGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
            tubeGeometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
            tubeGeometry.setAttribute('colorData', new THREE.BufferAttribute(new Float32Array(color), 2));
            tubeGeometry.setAttribute('selected', new THREE.BufferAttribute(new Float32Array(selected), 1));
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
        this.redrawTube();
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
        if (this.tube && this.tube.visible) {
            // draw a tube for a subsequence
            let activeX = (this.activeVar.indexOf('x') >= 0)? true: false,
                activeY = (this.activeVar.indexOf('y') >= 0)? true: false,
                activeRX = (this.activeVar.indexOf('r_x') >= 0)? true: false,
                activeRY = (this.activeVar.indexOf('r_y') >= 0)? true: false,
                activeH = (this.activeVar.indexOf('H') >= 0)? true: false,
                activeV = (this.activeVar.indexOf('V') >= 0)? true: false,
                activePA = (this.activeVar.indexOf('PA') >= 0)? true: false,
                activePD = (this.activeVar.indexOf('PD') >= 0)? true: false;
            // if any ignored variables on positions (x, y, r_x, r_y) are set, recompute position attribute
            let minJD = this.data.data.meta.min.z;
            let maxJD = this.data.data.meta.max.z;
            let range = this.data.data.meta.range;
            let divNum = this.division * Math.ceil(maxJD - minJD);
            let delTime = (maxJD - minJD) / divNum;
            let divNumPol = Math.ceil((this.data.data.splines.position.getPoint(1).z - this.data.data.splines.position.getPoint(0).z) / delTime);
            // let divNumPho = Math.ceil((this.data.data.splines.color.getPoint(1).z - this.data.data.splines.color.getPoint(0).z) / delTime);
            let cen = this.data.data.splines.position.getSpacedPoints(divNumPol);
            let rad = this.data.data.splines.radius.getSpacedPoints(divNumPol);
            // let col = this.data.data.splines.color.getSpacedPoints(divNumPho);
            let divNumHue, hue;
            if (this.data.data.splines.hue.points.length > 0) {
                divNumHue = Math.ceil((this.data.data.splines.hue.getPoint(1).z - this.data.data.splines.hue.getPoint(0).z) / delTime);
                hue = this.data.data.splines.hue.getSpacedPoints(divNumHue);
            }
            let divNumValue = Math.ceil((this.data.data.splines.value.getPoint(1).z - this.data.data.splines.value.getPoint(0).z) / delTime);
            let value = this.data.data.splines.value.getSpacedPoints(divNumValue);
            let del = Math.PI * 2 / (this.segment - 1);
            let minIdx = Math.ceil((this.selectedPeriod[0] - minJD) / delTime);
            let attrSize = this.tube.geometry.attributes.position.array.length / 3 / this.segment;
            let maxIdx = Math.ceil((this.selectedPeriod[1] - minJD) / delTime);
            let gridSize = TimeTubesStore.getGridSize();
            let vertices = [], colors = [];
            let deg, cenX, cenY, radX, radY;
            for (let i = minIdx; i < minIdx + attrSize; i++) {//i <= maxIdx; i++) {
                radX = (activeRX)? rad[i].x: 1 / range;
                radY = (activeRY)? rad[i].y: 1 / range;
                if ((activeX || activeY) || (activePA && activePD)) {
                    cenX = (activeX || (activePA && activePD))? cen[i].x: 0;
                    cenY = (activeY || (activePA && activePD))? cen[i].y: 0;
                } else if (activePA || activePD) {
                    if (activePA) {
                        let rad = Math.sqrt(cen[i].x * cen[i].x + cen[i].y * cen[i].y);
                        let ratio = gridSize / range / rad;
                        cenX = cen[i].x * ratio;
                        cenY = cen[i].y * ratio;
                     } else if (activePD) {
                        let rad = Math.sqrt(cen[i].x * cen[i].x + cen[i].y * cen[i].y);
                        cenX = 0;
                        cenY = rad;
                    }
                } else {
                    cenX = 0;
                    cenY = 0;
                }
                for (let j = 0; j < this.segment; j++) {
                    deg = del * j;
                    vertices.push((cenX * range + radX * range * Math.cos(deg)) * -1);
                    vertices.push(cenY * range + radY * range * Math.sin(deg));
                    vertices.push(cen[i].z - this.selectedPeriod[0]);
                }
            }
            // if any ignored variables on colors (H, V) are set, pass a flag as a uniform
            this.tube.material.uniforms.flagH.value = activeH;
            this.tube.material.uniforms.flagV.value = activeV;
            this.tube.geometry.attributes.position.needsUpdate = true;
            this.tube.geometry.attributes.position = new THREE.BufferAttribute(new Float32Array(vertices), 3);
            this.tube.geometry.computeVertexNormals();
            this.renderer.render(this.scene, this.camera);
        } else if (this.tubeCluster && this.tubeCluster.visible) {
            // draw a tube for a cluster center
            let activeX = (this.activeVar.indexOf('x') >= 0)? true: false,
                activeY = (this.activeVar.indexOf('y') >= 0)? true: false,
                activeRX = (this.activeVar.indexOf('r_x') >= 0)? true: false,
                activeRY = (this.activeVar.indexOf('r_y') >= 0)? true: false,
                activeH = (this.activeVar.indexOf('H') >= 0)? true: false,
                activeV = (this.activeVar.indexOf('V') >= 0)? true: false,
                activePA = (this.activeVar.indexOf('PA') >= 0)? true: false,
                activePD = (this.activeVar.indexOf('PD') >= 0)? true: false;
            let dataLen = this.clusterCenter.values[Object.keys(this.clusterCenter.values)[0]].length;
            let divNum = this.division * dataLen;
            let del = Math.PI * 2 / (this.segment - 1);
            let gridSize = TimeTubesStore.getGridSize();

            let cen = this.splinesClusterCenter.position.getSpacedPoints(divNum),
                rad = this.splinesClusterCenter.radius.getSpacedPoints(divNum);
            let vertices = [];
            let deg, cenX, cenY, radX, radY;
            for (let j = 0; j <= divNum; j++) {
                if (activeX || activeY) {
                    cenX = (activeX)? cen[j].x: 0;
                    cenY = (activeY)? cen[j].y: 0;
                } else if (activePA && activePD) {
                    cenX = (activePA)? cen[j].x: 0;
                    cenY = (activePD)? cen[j].y: 0;
                } else if (activePA || activePD) {
                    let rad = Math.sqrt(cen[j].x * cen[j].x + cen[j].y * cen[j].y);
                    if (activePA) {
                        let ratio = gridSize / this.rangeClusterCenter / rad;
                        cenX = cen[j].x * ratio;
                        cenY = cen[j].y * ratio;
                    } else if (activePD) {
                        cenX = 0;
                        cenY = rad;
                    }
                } else {
                    cenX = 0;
                    cenY = 0;
                }
                radX = (activeRX)? rad[j].x: 1 / this.rangeClusterCenter;
                radY = (activeRY)? rad[j].y: 1 / this.rangeClusterCenter;
                for (let k = 0; k < this.segment; k++) {
                    deg = del * k;
                    vertices.push((cenX * this.rangeClusterCenter + radX * this.rangeClusterCenter * Math.cos(deg)) * -1);
                    vertices.push(cenY * this.rangeClusterCenter + radY * this.rangeClusterCenter * Math.sin(deg));
                    vertices.push(cen[j].z);
                }
            }
            this.tubeCluster.material.uniforms.flagH.value = activeH;
            this.tubeCluster.material.uniforms.flagV.value = activeV;
            this.tubeCluster.geometry.attributes.position.needsUpdate = true;
            this.tubeCluster.geometry.attributes.position = new THREE.BufferAttribute(new Float32Array(vertices), 3);
            this.tubeCluster.geometry.computeVertexNormals();
            this.renderer.render(this.scene, this.camera);
        }
    }
    
    computeSplines(clusterCenter) {
        this.minmax = {};
        this.minmax.x = [Infinity, -Infinity];
        this.minmax.y = [Infinity, -Infinity];
        this.minmax.H = [Infinity, -Infinity];
        this.minmax.V = [Infinity, -Infinity];
        this.minmax.PA = [Infinity, -Infinity];
        this.minmax.PD = [Infinity, -Infinity];
        
        let position = [], radius = [], color = [];
        let subsequenceParameters = ClusteringStore.getSubsequenceParameters();
        let targets = ClusteringStore.getDatasets(),
            variables = clusterCenter.parameters.variables;
        let PAMinMax, PARatio, PDMin, means, stds, dataNum;
        if ('PA' in clusterCenter.values || 'PD' in clusterCenter.values) {
            PAMinMax = d3.extent(clusterCenter.values.PA, (d) => {
                return d;
            });
            PARatio = Math.PI / Math.max(Math.abs(PAMinMax[0]), Math.abs(PAMinMax[1]));
            PDMin = d3.min(clusterCenter.values.PD, (d) => {
                return d;
            });
            if (targets.length === 1) {
                let meta = DataStore.getData(targets[0]).data.meta;
                means = meta.mean;
                stds = meta.std;
            } else {
                means = {};
                stds = {};
                dataNum = {};
                variables.forEach(d => {
                    means[d] = 0;
                    stds[d] = 0;
                    dataNum[d] = 0;
                });
                for (let j = 0; j < targets.length; j++) {
                    let data = DataStore.getData(targets[j]);
                    variables.forEach(d => {
                        let dataCount = 0;
                        if (d === 'PA' || d === 'PD' || d === 'r_x' || d === 'r_y') {
                            dataCount = data.data.splines.PDPA.points.length;
                        } else if (d === 'H') {
                            dataCount = data.data.splines.hue.points.length;
                        } else if (d === 'V') {
                            dataCount = data.data.splines.value.points.length;
                        }
                        means[d] += data.data.meta.mean[d] * dataCount;
                        stds[d] += Math.pow(data.data.meta.std[d], 2) * dataCount;
                        dataNum[d] += dataCount;
                    });
                }
                variables.forEach(d => {
                    means[d] /= dataNum[d];
                    stds[d] = Math.sqrt(stds[d] / dataNum[d]);
                });
            }
        }
        for (let i = 0; i < clusterCenter.values[Object.keys(clusterCenter.values)[0]].length; i++) {
            let xPos, yPos;
            if ('x' in clusterCenter.values || 'y' in clusterCenter.values) {
                xPos = ('x' in clusterCenter.values)? clusterCenter.values.x[i]: 0; 
                yPos = ('y' in clusterCenter.values)? clusterCenter.values.y[i]: 0;
            } else if ('PA' in clusterCenter.values && 'PD' in clusterCenter.values) {
                if (subsequenceParameters.normalize) {
                    let PARad = clusterCenter.values.PA[i] * PARatio;
                    let PDPlus = clusterCenter.values.PD[i];
                    if (PDMin < 0) {
                        PDPlus += Math.abs(PDMin);
                    }
                    xPos = PDPlus * Math.cos(PARad);
                    yPos = PDPlus * Math.sin(PARad);
                } else {
                    let PARad = clusterCenter.values.PA[i] * stds.PA + means.PA;
                    if (90 < PARad && PARad <= 180) {
                        PARad -= 180;
                    }
                    PARad *= 2;
                    PARad = PARad * Math.PI / 180;
                    let PDOrg = clusterCenter.values.PD[i] * stds.PD + means.PD;
                    xPos = PDOrg * Math.cos(PARad);
                    yPos = PDOrg * Math.sin(PARad);
                }
            } else if ('PA' in clusterCenter.values) {
                if (subsequenceParameters.normalize) {
                    xPos = Math.cos(clusterCenter.values.PA[i] * PARatio);
                    yPos = Math.sin(clusterCenter.values.PA[i] * PARatio);
                } else {
                    let PARad = clusterCenter.values.PA[i] * stds.PA + means.PA;
                    if (90 < PARad && PARad <= 180) {
                        PARad -= 180;
                    }
                    PARad *= 2;
                    PARad = PARad * Math.PI / 180;
                    xPos = Math.cos(PARad);
                    yPos =  Math.sin(PARad);
                }
            } else if ('PD' in clusterCenter.values) {
                if (subsequenceParameters.normalize) {
                    let PDPlus = clusterCenter.values.PD[i];
                    if (PDMin < 0) {
                        PDPlus += Math.abs(PDMin);
                    }
                    xPos = 0;
                    yPos = PDPlus;
                } else {
                    xPos = (clusterCenter.values.PD[i] * stds.PD + means.PD) * Math.cos(0.5 * Math.PI);
                    yPos = (clusterCenter.values.PD[i] * stds.PD + means.PD) * Math.sin(0.5 * Math.PI);
                }
            }
            let currentValues = {
                x: xPos,
                y: yPos,
                r_x: 'r_x' in clusterCenter.values? clusterCenter.values.r_x[i]: 1,
                r_y: 'r_y' in clusterCenter.values? clusterCenter.values.r_y[i]: 1,
                H: 'H' in clusterCenter.values? clusterCenter.values.H[i]: 0.5,
                V: 'V' in clusterCenter.values? clusterCenter.values.V[i]: 0.5
            };
            position.push(new THREE.Vector3(currentValues.x, currentValues.y, i));
            radius.push(new THREE.Vector3(currentValues.r_x, currentValues.r_y, i));
            color.push(new THREE.Vector3(currentValues.H, currentValues.V, i));

            for (let key in this.minmax) {
                if (currentValues[key] < this.minmax[key][0])
                    this.minmax[key][0] = currentValues[key];
                if (this.minmax[key][1] < currentValues[key])
                    this.minmax[key][1] = currentValues[key];
            }
        }
        this.splinesClusterCenter.position = new THREE.CatmullRomCurve3(position, false, 'catmullrom');
        this.splinesClusterCenter.radius = new THREE.CatmullRomCurve3(radius, false, 'catmullrom');
        this.splinesClusterCenter.color = new THREE.CatmullRomCurve3(color, false, 'catmullrom');
        let xRange = this.minmax.x[1] - this.minmax.x[0];
        let yRange = this.minmax.y[1] - this.minmax.y[0];
        let range = Math.round(Math.max(xRange, yRange) * Math.pow(10, 2 - Math.ceil(Math.log10(Math.max(xRange, yRange)))));
        this.rangeClusterCenter = TimeTubesStore.getGridSize() / (Math.ceil(range / 5) * 5 * Math.pow(10, - (2 - Math.ceil(Math.log10(Math.max(xRange, yRange))))));
    }

    drawClusterCenterTube(clusterCenter) {
        if (this.tube) {
            this.tube.visible = false;
        }
        
        if (this.tubeCluster) {
            let geometry = this.tubeCluster.geometry,
                material = this.tubeCluster.material;
            this.scene.remove(this.tubeCluster);
            geometry.dispose();
            material.dispose();
            this.tubeCluster = undefined;
        }

        let texture = TimeTubesStore.getTextureDefault();
        let variables = Object.keys(clusterCenter.values);
        let dataLen = clusterCenter.values[Object.keys(clusterCenter.values)[0]].length;
        let divNum = this.division * dataLen;
        let del = Math.PI * 2 / (this.segment - 1);
        let vertices = [],
            colors = [],
            indices = [];
        let cen = this.splinesClusterCenter.position.getSpacedPoints(divNum),
            rad = this.splinesClusterCenter.radius.getSpacedPoints(divNum),
            col = this.splinesClusterCenter.color.getSpacedPoints(divNum);
        let activeRX = variables.indexOf('r_x') >= 0? true: false,
            activeRY = variables.indexOf('r_y') >= 0? true: false;
        let radX, radY;
        for (let j = 0; j <= divNum; j++) {
            radX = (activeRX)? rad[j].x: 1 / this.rangeClusterCenter;
            radY = (activeRY)? rad[j].y: 1 / this.rangeClusterCenter;
            for (let k = 0; k < this.segment; k++) {
                let deg = del * k;
                vertices.push((cen[j].x * this.rangeClusterCenter + radX * this.rangeClusterCenter * Math.cos(deg)) * -1);
                vertices.push(cen[j].y * this.rangeClusterCenter + radY * this.rangeClusterCenter * Math.sin(deg));
                vertices.push(cen[j].z);

                colors.push(col[j].x);
                colors.push(col[j].y);
                colors.push(1);
                if (k !== this.segment - 1) {
                    indices.push(k + j * (this.segment));
                    indices.push(k + (this.segment) + j * (this.segment));
                    indices.push(k + 1 + j * (this.segment));
                    indices.push(k + (this.segment) + j * (this.segment));
                    indices.push(k + 1 + (this.segment) + j * (this.segment));
                    indices.push(k + 1 + j * (this.segment));
                }
            }
        }
        indices = indices.slice(0, -1 * this.segment * 3 * 2);
        let normals = new Float32Array(vertices.length);
        let tubeGeometry = new THREE.BufferGeometry();
        tubeGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
        tubeGeometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        tubeGeometry.setAttribute('colorData', new THREE.BufferAttribute(new Float32Array(colors), 3));
        tubeGeometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
        tubeGeometry.computeVertexNormals();
        let tubeMaterial = new THREE.ShaderMaterial({
            vertexShader: document.getElementById('vertexShader_tube').textContent,
            fragmentShader: document.getElementById('fragmentShader_tube').textContent,
            uniforms: {
                lightPosition: {value: new THREE.Vector3(-20, 40, 60)},
                shade: {value: true},
                texture: {value: texture},
                minmaxH: {value: new THREE.Vector2(this.minmax.H[0], this.minmax.H[1])},
                minmaxV: {value: new THREE.Vector2(this.minmax.V[0], this.minmax.V[1])},
                flagH: {value: true},
                flagV: {value: true}
            },
            side: THREE.DoubleSide,
            transparent: true
        });
        let tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
        tube.rotateY(Math.PI);
        this.scene.add(tube);
        this.tubeCluster = tube;
        this.renderer.render(this.scene, this.camera);
    }
}
