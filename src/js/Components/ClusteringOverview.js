import React from 'react';
import ClusteringStore from '../Stores/ClusteringStore';
import TimeTubesStore from '../Stores/TimeTubesStore';
import BufferGeometryUtils from '../lib/BufferGeometryUtils';
import OrbitControls from "three-orbitcontrols";

import * as THREE from 'three';

export default class ClusteringOverview extends React.Component {
    constructor() {
        super();

        this.tubes = [];
        this.tubeNum = 16;
        this.segment = 16;
        this.division = 5;
        this.tubeGroups = [];
        this.splines = [];
        this.opacityCurve = TimeTubesStore.getOpacityCurve('Default');
        this.vertex = document.getElementById('vertexShader_tube').textContent;
        this.fragment = document.getElementById('fragmentShader_tube').textContent;
    }

    componentDidMount() {
        const width = this.mount.clientWidth;
        const height = $('#clusteringResultsOverview').height();
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

        let directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
        directionalLight.position.set(-20, 40, 60);
        this.scene.add(directionalLight);
        let ambientLight = new THREE.AmbientLight(0x292929);
        this.scene.add(ambientLight);

        this.addControls();
        // for test
        // let geo = new THREE.BoxGeometry(40, 25, 15);
        // let mat = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
        // this.cube = new THREE.Mesh(geo, mat);
        // this.scene.add(this.cube);
        // var axis = new THREE.AxisHelper(1000);
        // this.scene.add(axis);

        ClusteringStore.on('showClusteringResults', () => {
            this.clusterCenters = ClusteringStore.getClusterCenters();
            this.computeSplines();
            this.drawClusterCentersAsTubes();
        });
    }

    render() {
        return (
            <div id='clusteringOverview' 
                className='clusteringPanel'
                ref={mount => {
                    this.mount = mount;
                }}>
                clustering overview
            </div>
        );
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
    }

    setCameras(width, height) {
        // initialize camera properties
        let fov = 45;
        let far = 100; //Math.ceil(this.data.spatial[this.data.spatial.length - 1].z - this.data.spatial[0].z + 50);
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
        this.camera = this.cameraSet.perspective;
        this.camera.position.z = 50;
        this.camera.lookAt(this.scene.position);
    }

    computeSplines() {
        let variables = Object.keys(this.clusterCenters[0][0]);
        this.minmax = {};
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
        // チューブグループをクラスタの数ずつ作成
        // 描画画面内に等間隔の円形状にチューブを配置
        // 原点中心に描画してから移動？
        // z座標は配列のインデックスに一致
       
        // すでにオブジェクトがあれば削除

        let texture = new THREE.TextureLoader();
        texture.load('img/1_256.png', function(texture) {
            this.texture = texture;
            this.drawTubes();
        }.bind(this));
    }

    drawTubes(texture) {
        let divNum = this.division * this.clusterCenters[0].length;
        let del = Math.PI * 2 / (this.segment - 1);

        for (let i = 0; i < this.clusterCenters.length; i++) {
            let vertices = [],
                colors = [],
                indices = [];
            let cen = this.splines[i].position.getSpacedPoints(divNum),
                rad = this.splines[i].radius.getSpacedPoints(divNum),
                col = this.splines[i].color.getSpacedPoints(divNum);
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
                for (let k = 0; k < this.segment; k++) {
                    for (let l = 0; l < this.tubeNum; l++) {
                        let currad = (1 / this.tubeNum) * (l + 1);
                        let deg = del * k;
                        vertices[l].push((cen[j].x * this.range + currad * rad[j].x * this.range * Math.cos(deg)) * -1);
                        vertices[l].push(cen[j].y * this.range + currad * rad[j].y * this.range * Math.sin(deg));
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
            let tubeGeometry = BufferGeometryUtils.mergeBufferGeometries(geometries);
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
                transparent: true,
                // clipping: true,
                // clippingPlanes: [this.clippingPlane]
            });
            this.tubes.push(new THREE.Mesh(tubeGeometry, tubeMaterial));
            // this.tubeGroup.add(this.tube);
            this.tubes[this.tubes.length - 1].rotateY(Math.PI);
            let viewportSize = ClusteringStore.getViewportSize();
            let posX = viewportSize * Math.sin(Math.PI * 0.5 - 2 * Math.PI / this.clusterCenters.length * i);
            let posY = viewportSize * Math.cos(Math.PI * 0.5 - 2 * Math.PI / this.clusterCenters.length * i);
            this.tubes[this.tubes.length - 1].translateX(posX);
            this.tubes[this.tubes.length - 1].translateY(posY);
            this.scene.add(this.tubes[this.tubes.length - 1]);
        }
    }
}