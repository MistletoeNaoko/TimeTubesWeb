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
        this.selectedInterval = props.selectedInterval;
        this.data = DataStore.getData(this.sourceId);
        this.texture = TimeTubesStore.getTexture();
    }

    render() {
        // this.props sourceId, selectedInterval
        // console.log(this.props);
        let width = $('#selectedIntervalViewArea').width();
        let height = width;
        return (
            <div
                className='TimeTubes'
                id='selectedTimeSliceView'
                style={{width: width + 'px', height: height + 'px'}}
                ref={mount => {
                    this.mount = mount;
                }}
            />
        )
    }

    componentWillMount() {
        FeatureStore.on('updateSelectedInterval', () => {
            this.drawSelectedTube(
                FeatureStore.getSelectedPos(),
                FeatureStore.getSelectedColor(),
                FeatureStore.getSelectedIndices()
            );
        });
        TimeTubesStore.on('switch', () => {
           if (this.camera) {
               this.switchCamera();
           }
        });
    }

    componentWillUnmount() {
        this.stop();
        this.mount.removeChild(this.renderer.domElement);
    }

    componentDidMount() {
        if (this.sourceId >= 0) {
            const width = this.mount.clientWidth;
            const height = this.mount.clientHeight;
            this.scene = new THREE.Scene();

            this.setCameras();

            this.renderer = new THREE.WebGLRenderer({antialias: true});
            this.renderer.setClearColor("#000000");
            this.renderer.setSize(width, height);
            this.renderer.domElement.id = 'selectedTimeSliceView';

            this.mount.appendChild(this.renderer.domElement);

            this.renderScene();
            this.start();

            let directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
            directionalLight.position.set(-20, 40, 60);
            this.scene.add(directionalLight);
            let ambientLight = new THREE.AmbientLight(0x292929);
            this.scene.add(ambientLight);

            this.addControls();

            this.setPlaceHolder();
            // let geo = new THREE.BoxGeometry(5, 5, 5);
            // let mat = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
            // this.cube = new THREE.Mesh(geo, mat);
            // this.scene.add(this.cube);
            var axis = new THREE.AxesHelper(1000);
            this.scene.add(axis);
        }
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
        let cameraProp = TimeTubesStore.getCameraProp(this.sourceId);
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
                tubeNum: {value: TimeTubesStore.getTubeNum()},
                shade: {value: false},
                texture: {value: texture},
                minmaxH: {value: new THREE.Vector2(this.data.data.meta.min.H, this.data.data.meta.max.H)},
                minmaxV: {value: new THREE.Vector2(this.data.data.meta.min.V, this.data.data.meta.max.V)}
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
        this.tube.geometry.attributes.colorData = new THREE.BufferAttribute(new Float32Array(color), 2);
        this.tube.geometry.attributes.selected = new THREE.BufferAttribute(new Float32Array(pos.length / 3), 1);
        this.tube.geometry.attributes.normal = new THREE.BufferAttribute(new Float32Array(pos.length), 1);
        this.tube.geometry.index = new THREE.BufferAttribute(new Uint32Array(indices), 1);
        this.tube.geometry.computeVertexNormals();
        this.renderer.render(this.scene, this.camera);
    }
}