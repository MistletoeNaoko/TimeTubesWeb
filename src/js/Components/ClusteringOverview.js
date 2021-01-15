import * as ClusteringAction from '../Actions/ClusteringAction';
import React from 'react';
import ClusteringStore from '../Stores/ClusteringStore';
import TimeTubesStore from '../Stores/TimeTubesStore';
import AppStore from '../Stores/AppStore';
import BufferGeometryUtils from '../lib/BufferGeometryUtils';
import OrbitControls from "three-orbitcontrols";
import * as THREE from 'three';
// import TextSprite from 'three.textsprite';
import TextSprite from '@seregpie/three.text-sprite';
import {formatValue} from '../lib/2DGraphLib';

export default class ClusteringOverview extends React.Component {
    constructor() {
        super();

        this.tubes = [];
        this.axes = [];
        this.labels = [];
        this.tubeNum = 16;
        this.segment = 16;
        this.division = 5;
        this.cameraPosZ = 50;
        this.tubeGroups = [];
        this.splines = [];
        this.opacityCurve = TimeTubesStore.getOpacityCurve('Default');
        this.vertex = document.getElementById('vertexShader_tube').textContent;
        this.fragment = document.getElementById('fragmentShader_tube').textContent;
        this.raycaster = new THREE.Raycaster();
        this.clusterCenters = [];
        this.clusterColors = [];
        this.clusteringScores = {};
    }

    componentDidMount() {
        const width = this.mount.clientWidth;
        let appHeaderHeight = $('#appHeader').height();
        const height = $('#clusteringResultsOverview').height() - appHeaderHeight;
        this.scene = new THREE.Scene();

        this.setCameras(width, height);

        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setClearColor(new THREE.Color(Number(TimeTubesStore.getBackgroundColor())));
        this.renderer.setSize(width, height);
        this.renderer.localClippingEnabled = true;
        this.renderer.domElement.id = 'clusteringResultsViewport';
        this.canvas = this.renderer.domElement;

        this.mount.appendChild(this.renderer.domElement);

        this.renderScene();
        this.start();

        this.initDetailView();

        let directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
        directionalLight.position.set(-20, 40, 60);
        this.scene.add(directionalLight);
        let ambientLight = new THREE.AmbientLight(0x292929);
        this.scene.add(ambientLight);

        this.addControls();

        let onMouseClick = this.onMouseClick();
        this.canvas.addEventListener('click', onMouseClick.bind(this), false);
        // for test
        // let geo = new THREE.BoxGeometry(40, 25, 15);
        // let mat = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
        // this.cube = new THREE.Mesh(geo, mat);
        // this.scene.add(this.cube);
        // var axis = new THREE.AxisHelper(1000);
        // this.scene.add(axis);

        ClusteringStore.on('showClusteringResults', () => {
            this.clusterCenters = ClusteringStore.getClusterCenters();
            this.clusterColors = ClusteringStore.getClusterColors();
            this.clusteringScores = ClusteringStore.getClusteringScores();
            this.setRendererSize();
            this.computeSplines();
            this.drawClusterCentersAsTubes();
            this.showClusteringScores();
        });
        ClusteringStore.on('showClusterDetails', (cluster) => {
            this.setDetailView(cluster);
        });
        AppStore.on('resizeExtractionResultsArea', () => {
            this.setRendererSize();
        });
    }

    render() {
        return (
            <div id='clusteringOverview' 
                className='clusteringPanel'
                ref={mount => {
                    this.mount = mount;
                }}>
                <div id='clusteringScores'>
                    <table id='clusteringScoresTable'>
                        <tbody>
                            <tr>
                                <td>Pseudo F</td>
                                <td id='pseudoFValue'
                                    className='clusteringScoresValues'></td>
                            </tr>
                            <tr>
                                <td>Silhouette coefficient</td>
                                <td id='silhouetteValue'
                                    className='clusteringScoresValues'></td>
                            </tr>
                            <tr>
                                <td>Davis Bouldin index</td>
                                <td id='davisBouldinValue'
                                    className='clusteringScoresValues'></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    showClusteringScores() {
        $('#pseudoFValue').text(formatValue(this.clusteringScores.pseudoF));
        $('#silhouetteValue').text(formatValue(this.clusteringScores.silhouette));
        $('#davisBouldinValue').text(formatValue(this.clusteringScores.davisBouldin));
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
        if (this.detailRenderer) this.detailRenderer.render(this.scene, this.cameraDetail);
    }
    
    setRendererSize() {
        const width = this.mount.clientWidth;
        let appHeaderHeight = $('#appHeader').height();
        let timelineHeight = $('#clusteringTimeline').height();//40 * ClusteringStore.getDatasets().length + 16 + 2;
        const height = window.innerHeight - appHeaderHeight - timelineHeight;
        this.renderer.setSize(width, height);
        let aspect = width / height, 
            fov = 45,
            far = 1000;
        let depth = Math.tan(fov / 2.0 * Math.PI / 180.0) * 2;
        let size_y = depth * this.cameraPosZ;
        let size_x = depth * this.cameraPosZ * aspect;
        // this.camera.left = -size_x / 2;
        // this.camera.right = size_x / 2;
        // this.camera.top = size_y / 2;
        // this.camera.bottom = -size_y / 2;
        // this.camera.lookAt(this.scene.position);
        this.cameraSet.orthographic = new THREE.OrthographicCamera(
            -size_x / 2, size_x / 2,
            size_y / 2, -size_y / 2, 0.1,
            far);
        this.camera = this.cameraSet.orthographic;
        this.camera.position.z = this.cameraPosZ;
        this.camera.lookAt(this.scene.position);
        this.renderer.render(this.scene, this.camera);
        this.addControls();
    }

    initDetailView() {
        this.detailRenderer = new THREE.WebGLRenderer();
        this.detailRenderer.setSize(300, 300);
        this.detailRenderer.setClearColor('#000000');
        this.detailRenderer.domElement.id = 'selectedClusterCenterTimeTubes';
    }

    setDetailView(cluster) {
        if (typeof(cluster) !== 'undefined' && $('#selectedClusterCenterTimeTubes')) {
            let rendererSize = $('#selectedClusterCenterTimeTubes').width() - 16 * 2;
            this.detailRenderer.setSize(rendererSize, rendererSize);
            let viewportSize = ClusteringStore.getViewportSize() * 0.7;
            let posX = viewportSize * Math.cos(Math.PI * 0.5 - 2 * Math.PI / this.clusterCenters.length * cluster);
            let posY = viewportSize * Math.sin(Math.PI * 0.5 - 2 * Math.PI / this.clusterCenters.length * cluster);
            this.cameraDetail.position.x = posX;
            this.cameraDetail.position.y = posY;
            this.cameraDetail.lookAt(posX, posY, 0);
            let canvas = document.getElementById('selectedClusterCenterTimeTubes');
            canvas.appendChild(this.detailRenderer.domElement);
        }
    }

    addControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.position0.set(0, 0, 50);
        this.controls.screenSpacePanning = false;
        this.controls.enableZoom = false;
    }

    onMouseClick() {
        return function(event) {
            let name = this.getIntersectedIndex(event);
            if (name) {
                name = Number(name.split('_')[1]);
                // show detail of the selected cluster
                ClusteringAction.showClusterDetails(name);
            }
        }
    }

    getIntersectedIndex(event) {
        let name;
        let raymouse = new THREE.Vector2();
        raymouse.x = (event.offsetX / this.renderer.domElement.clientWidth) * 2 - 1;
        raymouse.y = -(event.offsetY / this.renderer.domElement.clientHeight) * 2 + 1;
        this.raycaster.setFromCamera(raymouse, this.camera);
        for (let i = 0; i < this.labels.length; i++) {
            let intersects = this.raycaster.intersectObject(this.labels[i]);
            if (intersects.length > 0) {
                name = intersects[0].object.name;
                break;
            }
        }
        return name;
    }

    setCameras(width, height) {
        // initialize camera properties
        let fov = 45;
        let far = 1000; //Math.ceil(this.data.spatial[this.data.spatial.length - 1].z - this.data.spatial[0].z + 50);
        let depth = Math.tan(fov / 2.0 * Math.PI / 180.0) * 2;
        let aspect = width / height;

        this.cameraSet = {};
        this.cameraSet.perspective = new THREE.PerspectiveCamera(
            fov,
            aspect,
            0.1,
            far
        );
        let size_y = depth * this.cameraPosZ;
        let size_x = depth * this.cameraPosZ * aspect;
        this.cameraSet.orthographic = new THREE.OrthographicCamera(
            -size_x / 2, size_x / 2,
            size_y / 2, -size_y / 2, 0.1,
            far);
        this.camera = this.cameraSet.orthographic;
        this.camera.position.z = this.cameraPosZ;
        this.camera.lookAt(this.scene.position);

        let axisSize = ClusteringStore.getGridSize() * 0.7;
        this.cameraDetail = new THREE.OrthographicCamera(
            -axisSize / 2, axisSize / 2,
            axisSize / 2, -axisSize / 2, 0.1,
            far
        );
        this.cameraDetail.position.z = 10;
    }

    computeSplines() {
        this.minmax = {};
        this.splines = [];
        this.range = undefined;
        for (let key in this.clusterCenters[0][0]) {
            this.minmax[key] = [this.clusterCenters[0][0][key], this.clusterCenters[0][0][key]];
        }
        for (let i = 0; i < this.clusterCenters.length; i++) {
            let position = [], radius = [], color = [], PAPD = [];
            for (let j = 0; j < this.clusterCenters[i].length; j++) {
                let curdata = this.clusterCenters[i][j];
                // TODO: x, yがなくてPAPDしかなかった場合も座標に変換して
                position.push(new THREE.Vector3('x' in curdata? curdata.x: 0, 'y' in curdata? curdata.y: 0, j));
                radius.push(new THREE.Vector3('r_x' in curdata? curdata.r_x: 0.5, 'r_y' in curdata? curdata.r_y: 0.5, j));
                color.push(new THREE.Vector3('H' in curdata? curdata.H: 0.5, 'V' in curdata? curdata.V: 0.5, j));
                for (let key in curdata) {
                    if (curdata[key] < this.minmax[key][0]) 
                        this.minmax[key][0] = curdata[key];
                    if (this.minmax[key][1] < curdata[key])
                        this.minmax[key][1] = curdata[key];
                }
            }
            let spline = {};
            spline.position = new THREE.CatmullRomCurve3(position, false, 'catmullrom');
            spline.radius = new THREE.CatmullRomCurve3(radius, false, 'catmullrom');
            spline.color = new THREE.CatmullRomCurve3(color, false, 'catmullrom');
            this.splines.push(spline);
        }
        let xRange = this.minmax.x[1] - this.minmax.x[0];
        let yRange = this.minmax.y[1] - this.minmax.y[0];
        let range = Math.round(Math.max(xRange, yRange) * Math.pow(10, 2 - Math.ceil(Math.log10(Math.max(xRange, yRange)))));
        this.range = ClusteringStore.getGridSize() / (Math.ceil(range / 5) * 5 * Math.pow(10, - (2 - Math.ceil(Math.log10(Math.max(xRange, yRange))))));
    }

    drawClusterCentersAsTubes() {
        // TODO: 各チューブの場所にグリッドもしくは軸とクラスタ番号を表示
        if (typeof(this.texture) === 'undefined') {
            let texture = new THREE.TextureLoader();
            texture.load('img/1_256.png', function(texture) {
                this.texture = texture;
                this.drawTubes();
            }.bind(this));
        } else {
            this.drawTubes();
        }
        this.drawAxes();
        this.drawLabels();
    }

    drawTubes() {
        for (let i = 0; i < this.tubes.length; i++) {
            let geometry = this.tubes[i].geometry,
                material = this.tubes[i].material;
            this.scene.remove(this.tubes[i]);
            geometry.dispose();
            material.dispose();
            this.tubes[i] = undefined;
        }
        this.tubes = [];
        let tubeGeometry;

        let divNum = this.division * this.clusterCenters[0].length;
        let del = Math.PI * 2 / (this.segment - 1);

        for (let i = 0; i < this.clusterCenters.length; i++) {
            let vertices = [],
                colors = [],
                indices = [];
            let cen = this.splines[i].position.getSpacedPoints(divNum),
                rad = this.splines[i].radius.getSpacedPoints(divNum),
                col = this.splines[i].color.getSpacedPoints(divNum);

            if ('r_x' in this.clusterCenters[0][0] || 'r_y' in this.clusterCenters[0][0]) {
                let opacityPoints = this.opacityCurve.getSpacedPoints(this.tubeNum);
                let opacityList = [];
                for (let i = 1; i <= this.tubeNum; i++) {
                    opacityList.push(1 - (1 - opacityPoints[i - 1].y) / (1 - opacityPoints[i].y));
                }
                for (let j = 0; j < this.tubeNum; j++) {
                    vertices[j] = [];
                    colors[j] = [];
                }
                for (let j = 0; j <= divNum; j++) {
                    let radX = ('r_x' in this.clusterCenters[0][0])? rad[j].x * this.range: 0.5,
                        radY = ('r_y' in this.clusterCenters[0][0])? rad[j].y * this.range: 0.5;
                    for (let k = 0; k < this.segment; k++) {
                        for (let l = 0; l < this.tubeNum; l++) {
                            let currad = (1 / this.tubeNum) * (l + 1);
                            let deg = del * k;
                            vertices[l].push((cen[j].x * this.range + currad * radX * Math.cos(deg)) * -1);
                            vertices[l].push(cen[j].y * this.range + currad * radY * Math.sin(deg));
                            vertices[l].push(cen[j].z);

                            colors[l].push(col[j].x);
                            colors[l].push(col[j].y);
                            colors[l].push(opacityList[l]);
                        }
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
                let normals = new Float32Array(vertices[0].length);
                let geometries = [];
                for (let j = 0; j < this.tubeNum; j++) {
                    const geometryTmp = new THREE.BufferGeometry();
                    geometryTmp.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices[j]), 3));
                    geometryTmp.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
                    geometryTmp.setAttribute('colorData', new THREE.BufferAttribute(new Float32Array(colors[j]), 3));
                    geometryTmp.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
                    geometryTmp.computeVertexNormals();
                    geometries.push(geometryTmp);
                }
                tubeGeometry = BufferGeometryUtils.mergeBufferGeometries(geometries);
            } else {
                for (let j = 0; j <= divNum; j++) {
                    for (let k = 0; k < this.segment; k++) {
                        let deg = del * k;
                        vertices.push((cen[j].x * this.range + 0.5 * Math.cos(deg)) * -1);
                        vertices.push(cen[j].y * this.range + 0.5 * Math.sin(deg));
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
                tubeGeometry = new THREE.BufferGeometry();
                tubeGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
                tubeGeometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
                tubeGeometry.setAttribute('colorData', new THREE.BufferAttribute(new Float32Array(colors), 3));
                tubeGeometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
                tubeGeometry.computeVertexNormals();
            }
            let tubeMaterial = new THREE.ShaderMaterial({
                vertexShader: this.vertex,
                fragmentShader: this.fragment,
                uniforms: {
                    lightPosition: {value: new THREE.Vector3(-20, 40, 60)},
                    shade: {value: true},
                    texture: {value: this.texture},
                    minmaxH: {value: new THREE.Vector2(this.minmax.H[0], this.minmax.H[1])},
                    minmaxV: {value: new THREE.Vector2(this.minmax.V[0], this.minmax.V[1])},
                    flagH: {value: true},
                    flagV: {value: true}
                },
                side: THREE.DoubleSide,
                transparent: true
            });
            this.tubes.push(new THREE.Mesh(tubeGeometry, tubeMaterial));
            this.tubes[this.tubes.length - 1].rotateY(Math.PI);
            let viewportSize = ClusteringStore.getViewportSize() * 0.7;
            let posX = viewportSize * Math.cos(Math.PI * 0.5 - 2 * Math.PI / this.clusterCenters.length * i);
            let posY = viewportSize * Math.sin(Math.PI * 0.5 - 2 * Math.PI / this.clusterCenters.length * i);
            this.tubes[this.tubes.length - 1].translateX(posX);
            this.tubes[this.tubes.length - 1].translateY(posY);
            this.scene.add(this.tubes[this.tubes.length - 1]);
        }
    }

    drawAxes() {
        for (let i = 0; i < this.axes.length; i++) {
            let geometry = this.axes[i].geometry,
                material = this.axes[i].material;
            this.scene.remove(this.axes[i]);
            this.axes[i] = undefined;
            geometry.dispose();
            material.dispose();
        }
        this.axes = [];

        let axisSize = ClusteringStore.getGridSize() * 0.7;
        let viewportSize = ClusteringStore.getViewportSize() * 0.7;
        for (let i = 0; i < this.clusterCenters.length; i++) {
            let axisGeometry = new THREE.BufferGeometry();
            let axisMaterial = new THREE.LineBasicMaterial({
                color: 'white',
                opacity: 0.5
            });
            let axisPosisitons = [];
            let axisIndices = [];
            let j = 0;
            axisPosisitons.push(-1 * axisSize, 0, 0);
            axisPosisitons.push(axisSize, 0, 0);
            axisPosisitons.push(0, axisSize, 0);
            axisPosisitons.push(0, -1 * axisSize, 0);
            axisPosisitons.push(0, 0, 0);
            axisPosisitons.push(0, 0, this.clusterCenters[i].length);

            axisIndices.push(j + 0, j + 1, j + 2, j + 3, j + 4, j + 5);
            j += 6;

            axisGeometry.setIndex(axisIndices);
            axisGeometry.setAttribute(
                'position',
                new THREE.Float32BufferAttribute(axisPosisitons, 3)
            );
            this.axes.push(new THREE.LineSegments(axisGeometry, axisMaterial));
            this.axes[this.axes.length - 1].rotateY(Math.PI);
            let posX = viewportSize * Math.cos(Math.PI * 0.5 - 2 * Math.PI / this.clusterCenters.length * i);
            let posY = viewportSize * Math.sin(Math.PI * 0.5 - 2 * Math.PI / this.clusterCenters.length * i);
            this.axes[this.axes.length - 1].translateX(posX);
            this.axes[this.axes.length - 1].translateY(posY);
            this.scene.add(this.axes[this.axes.length - 1]);
        }
    }

    drawLabels() {
        for (let i = 0; i < this.labels.length; i++) {
            this.scene.remove(this.labels[i]);
            this.labels[i].dispose();
            this.labels[i] = undefined;
        }
        this.labels = [];

        let axisSize = ClusteringStore.getGridSize() * 0.7;
        let viewportSize = ClusteringStore.getViewportSize() * 0.7;
        for (let i = 0; i < this.clusterCenters.length; i++) {
            let label = new TextSprite({
                alignment: 'center',
                color: 'hsl(' + this.clusterColors[i][0] + ',' + this.clusterColors[i][1] * 100 + '%,' + this.clusterColors[i][2] * 100 + '%)',
                fontFamily: 'Arial, Helvetica, sans-serif',
                textSize: 0.8,
                text: 'Cluster ' + i
            });
            label.name = 'Cluster_' + i;
            this.labels.push(label);
            let posX = viewportSize * Math.cos(Math.PI * 0.5 - 2 * Math.PI / this.clusterCenters.length * i);
            let posY = viewportSize * Math.sin(Math.PI * 0.5 - 2 * Math.PI / this.clusterCenters.length * i) + axisSize;
            this.labels[this.labels.length - 1].position.set(posX, posY, -3);
            this.scene.add(this.labels[this.labels.length - 1]);
        }
    }
}
