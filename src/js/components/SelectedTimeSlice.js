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

            let cameraProp = TimeTubesStore.getCameraProp(this.sourceId);
            this.camera = new THREE.PerspectiveCamera(
                45,//cameraProp.fov,
                1,// cameraProp.aspect,
                0.1,
                2000//cameraProp.far
            );
            this.camera.position.z = 50;
            this.camera.lookAt(-this.scene.position);

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
            // let geo = new THREE.BoxGeometry(5, 5, 5);
            // let mat = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
            // this.cube = new THREE.Mesh(geo, mat);
            // this.scene.add(this.cube);
            var axis = new THREE.AxisHelper(1000);
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

    addControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.position0.set(0, 0, 50);
        this.controls.screenSpacePanning = false;
        this.controls.enableZoom = false;
        // controls.enablePan = false;
    }

    drawSelectedTube(pos, color, indices) {
        // 短いから、TubeBufferGeometryで作り直すか
    //    カットプレインとかで切り出すか？
        let texture = TimeTubesStore.getTexture(this.sourceId);
        let normals = new Float32Array(pos.length);
        let selected = new Float32Array(pos.length / 3);
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
}