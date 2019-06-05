import React from 'react';
import * as THREE from 'three';
import Details from './Details';
import * as TimeTubesAction from '../Actions/TimeTubesAction';
import TimeTubesStore from '../Stores/TimeTubesStore';
import DataStore from '../Stores/DataStore';
import BufferGeometryUtils from '../lib/BufferGeometryUtils';
import OrbitControls from "three-orbitcontrols";
import TextSprite from 'three.textsprite';
import EventListener from 'react-event-listener';
import * as DataAction from '../Actions/DataAction';

let vertexShaderTube = [
    'precision mediump float;',
    'attribute vec2 colorData;',
    'attribute float selected;',
    'varying vec3 vNormal;',
    'varying vec3 vWorldPosition;',
    'varying vec2 vColor;',
    'varying float vSelected;',
    '#include <clipping_planes_pars_vertex>',
    'void main() {',
    '#include <begin_vertex>',
    'vNormal = normalMatrix * normal;',
    'vec4 worldPosition = modelMatrix * vec4(position, 1.0);',
    'vWorldPosition = worldPosition.xyz;',
    'vColor = colorData;',
    'vSelected = selected;',
    'gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    'vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);',
    '#include <clipping_planes_vertex>',
    '}'
].join('\n');

let fragmentShaderTube = [
    'precision mediump float;',
    'varying vec3 vNormal;',
    'varying vec3 vWorldPosition;',
    'varying vec2 vColor;',
    'varying float vSelected;',
    'uniform vec3 lightPosition;',
    'uniform sampler2D texture;',
    'uniform int tubeNum;',
    'uniform bool shade;',
    'uniform vec2 minmaxH;',
    'uniform vec2 minmaxV;',
    '#include <clipping_planes_pars_fragment>',
    'void main()',
    '{',
    '#include <clipping_planes_fragment>',
    'vec3 lightDirection = normalize(lightPosition - vWorldPosition);',
    'vec2 T;',
    'T.x = (vColor.x - minmaxH.x) / (minmaxH.y - minmaxH.x);',
    'T.y = (vColor.y - minmaxV.x) / (minmaxV.y - minmaxV.x);',
    'vec4 resultColor = texture2D(texture, T);',
    'float c = max(0.0, dot(vNormal, lightDirection)) * 0.3;',
    'float opacity = 1.0 / float(tubeNum);//vPositionx;//vWorldPosition.x;//1.0 / float(TUBE_NUM);',
    'if (shade)',
    'gl_FragColor = vec4(resultColor.r + c, resultColor.g + c, resultColor.b + c, opacity);',
    'else',
    'gl_FragColor = vec4(resultColor.r, resultColor.g, resultColor.b, opacity);',
    'if (vSelected != 0.0) {',
    'gl_FragColor = vec4(1.0, 0.0, 0.0, opacity);}',
    '}',
].join('\n');

export default class TimeTubes extends React.Component{
    constructor(props) {
        super();
        this.id = props.id;
        this.data = props.data;
        this.cameraProp = TimeTubesStore.getCameraProp(props.id);
        this.tubeNum = 1;
        this.segment = 16;
        this.currentHighlightedPlot = 0;
        this.drag = false;
        this.animationPara = {flag: false, dep: 0, dst:0, speed: 40, now: 0};
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
        this.raycaster = new THREE.Raycaster();
    }

    render() {
        let width = ($(window).width() - $('#Controllers').width() - $('.right').width()) / DataStore.getDataNum()// * 0.95;
        let height = Math.max($('#Controllers').height(), 500);
        this._updateSize(width, height);
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
            this._updateCamera();
        });
        TimeTubesStore.on('change', () => {
            this.cameraProp = TimeTubesStore.getCameraProp(this.id);
            this._updateCamera();
        });
        TimeTubesStore.on('reset', () => {
            this.cameraProp = TimeTubesStore.getCameraProp(this.id);
            if (this.cameraProp.xpos === 0 && this.cameraProp.ypos === 0 && this.cameraProp.zpos === 50) {
                this._resetCamera();
            }
        });
        TimeTubesStore.on('switch', () => {
            this.cameraProp = TimeTubesStore.getCameraProp(this.id);
            this._switchCamera();
        });
        TimeTubesStore.on('searchTime', (id, dst) => {
            if (id === this.id) {
                this._searchTime(dst);
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
                this._updateCamera();
            }
        });
        TimeTubesStore.on('updateMinMaxH', (id) => {
            if (id === this.id) {
                this._setMinMaxH(TimeTubesStore.getMinMaxH(this.id));
            }
        });
        TimeTubesStore.on('updateMinMaxV', (id) => {
            if (id === this.id) {
                this._setMinMaxV(TimeTubesStore.getMinMaxV(this.id));
            }
        });
        TimeTubesStore.on('changePlotColor', (id) => {
            if (id === this.id) {
                this.plotColor = TimeTubesStore.getPlotColor(this.id);
                this._changePlotsColor();
            } else if (this.data.merge) {
                let fileName = DataStore.getFileName(id);
                if (this.data.name.indexOf(fileName) >= 0) {
                    this.plotColor[this.idNameLookup[fileName]] = TimeTubesStore.getPlotColor(id);
                    this._changePlotsColor();
                }
            }
        })
    }

    componentWillUnmount() {
        this.stop();
        this.mount.removeChild(this.renderer.domElement);
    }

    componentDidMount() {
        const width = this.mount.clientWidth;
        const height = this.mount.clientHeight;
        this.scene = new THREE.Scene();

        this._setCameras(width, height);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setClearColor("#000000");
        this.renderer.setSize(width, height);
        this.renderer.localClippingEnabled = true;
        this.renderer.domElement.id = 'TimeTubes_viewport_' + this.id;

        this.mount.appendChild(this.renderer.domElement);

        this.renderScene();
        this.start();

        this.clippingPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);

        let directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
        directionalLight.position.set(-20, 40, 60);
        this.scene.add(directionalLight);
        let ambientLight = new THREE.AmbientLight(0x292929);
        this.scene.add(ambientLight);

        this._addControls();
        let canvas = document.querySelector('#TimeTubes_viewport_' + this.id);
        let onMouseWheel = this._onMouseWheel();
        let onMouseMove = this._onMouseMove();
        let onMouseClick = this._onMouseClick();

        canvas.addEventListener('wheel', onMouseWheel.bind(this), false);
        canvas.addEventListener('mousemove', onMouseMove.bind(this), false);
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
        texture.load('../../img/1_256.png', this._drawTube.bind(this));
        this._drawGrid(TimeTubesStore.getGridSize() * 2, 10);
        this._drawLabel(TimeTubesStore.getGridSize() / this.data.meta.range);
        this._drawAxis();
        this._drawPlot();
    }

    start() {
        if (!this.frameId) {
            this.frameId = requestAnimationFrame(this.animate.bind(this));
        }
    }

    stop() {
        cancelAnimationFrame(this.frameId);
    };

    animate() {
        this.renderScene();
        this.frameId = window.requestAnimationFrame(this.animate.bind(this));
    };

    renderScene() {
        if (this.renderer) this.renderer.render(this.scene, this.camera);
    }

    _addControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.position0.set(0, 0, 50);
        this.controls.screenSpacePanning = false;
        this.controls.enableZoom = false;
        // controls.enablePan = false;
    }

    _onMouseWheel() {
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

            TimeTubesAction.updateCurrentPos(this.id, dst);

            if ((dst === this.data.spatial[this.data.spatial.length - 1].z - this.data.spatial[0].z) && ('x' in this.data.spatial[this.data.spatial.length - 1])) {
                changeColFlg = true;
            }
            if ((dst === 0) && ('x' in this.data.spatial[0])) {
                changeColFlg = true;
            }

            if (changeColFlg) {
                if (!this.data.merge) {
                    for (let j = 0; j < this.data.position.length; j++) {
                        if (dst === this.data.position[j].z - this.data.spatial[0].z) {
                            let color = new THREE.Color('rgb(127, 255, 212)');//this.gui.__folders.Display.__folders.Plot.__controllers[1].object.plotColor;
                            // this._changePlotColor(this.currentHighlightedPlot * this.segment, new THREE.Color(color[0] / 255, color[1] / 255, color[2] / 255));
                            this._changePlotColor(this.currentHighlightedPlot * this.segment, color);
                            this._changePlotColor(j * this.segment, new THREE.Color('red'));
                            this.currentHighlightedPlot = j;
                            TimeTubesAction.updateFocus(this.id, dst);
                            // highlightCurrentPlot(this.idx, dst);
                        }
                    }
                } else {
                    let posCount = 0;
                    for (let j = 0; j < this.data.spatial.length; j++) {
                        if ('x' in this.data.spatial[j]) {
                            if (dst === this.data.spatial[j].z - this.data.spatial[0].z) {
                                let color = new THREE.Color(this.plotColor[this.idNameLookup[this.data.spatial[j].source]]);
                                this._changePlotColor(this.currentHighlightedPlot * this.segment, color);
                                this._changePlotColor(posCount * this.segment, new THREE.Color('red'));
                                this.currentHighlightedPlot = posCount;
                                TimeTubesAction.updateFocus(this.id, dst);
                                // highlightCurrentPlot(this.idx, dst);
                            }
                            posCount++;
                        }
                    }
                }
            }
            this.tubeGroup.position.z = dst;
            // this.gui.__folders.Tube.__controllers[0].setValue(dst + this.blazar.data[0].z);
            // showCurrentVal(this.idx, dst);
            DataAction.updateDetails(this.id, dst);
        }.bind(this);
    }

    _onMouseMove() {
        return function (event) {
            let cameraPropNow = this.cameraProp;
            cameraPropNow.xpos = this.camera.position.x;
            cameraPropNow.ypos = this.camera.position.y;
            cameraPropNow.zpos = this.camera.position.z;

            this.cameraProp = cameraPropNow;
        }
    }

    _onMouseClick() {
        return function (event) {
            let status = $('#switchVisualQuery').prop('checked');
            if (status) {
                console.log('clicked!', this.tube, status, event);
                let square = this._getIntersectedIndex(event);
                if (square !== undefined && this.tube) {
                    this.tube.geometry.colorsNeedUpdate = true;
                    this.tube.geometry.attributes.selected.needsUpdate = true;
                    this.tube.geometry.attributes.selected.array[square.a] = 1;
                    this.tube.geometry.attributes.selected.array[square.b] = 1;
                    this.tube.geometry.attributes.selected.array[square.c] = 1;
                    // this.tube.geometry.attributes.selected.array[square] = 1;
                    // this.tube.geometry.faces[square].color.set(0x00ff00);
                }
                this.renderer.render(this.scene, this.camera);
            }
        }
    }

    _getIntersectedIndex(event) {
        let square;
        let raymouse = new THREE.Vector2();
        raymouse.x = (event.offsetX / this.renderer.domElement.clientWidth) * 2 - 1;
        raymouse.y = -(event.offsetY / this.renderer.domElement.clientHeight) * 2 + 1;
        this.raycaster.setFromCamera(raymouse, this.camera);
        let intersects = this.raycaster.intersectObject(this.tube);
        console.log(raymouse, intersects, this.tube);
        // for ( var i = 0; i < intersects.length; i++ ) {
        //
        //     intersects[ i ].object.material.color.set( 0xff0000 );
        //
        // }
        if (intersects.length > 0) {
            square = intersects[0].face;//faceIndex;
        }
        return square;
    }

    // change the color of the currently focused plot
    _changePlotColor(idx, color) {
        for (let i = 0; i < this.segment; i++) {
            this.plot.geometry.attributes.color.needsUpdate = true;
            this.plot.geometry.attributes.color.setXYZ(idx + i, color.r, color.g, color.b);
        }
    }

    _setCameras(width, height) {
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

    _resetCamera() {
        // let cameraStatus = this.cameraProp;
        this.camera.position.set(this.cameraProp.xpos, this.cameraProp.ypos, this.cameraProp.zpos);
        // this.controls.position0
        this.controls.reset();
    }

    _updateCamera() {
        this.camera.position.set(this.cameraProp.xpos, this.cameraProp.ypos, this.cameraProp.zpos);
        this.camera.fov = this.cameraProp.fov;
        this.camera.depth = this.cameraProp.depth;
        this.camera.far = this.cameraProp.far;
        this.camera.aspect = this.cameraProp.aspect;
        this.camera.updateProjectionMatrix();
    }

    _updateSize(width, height) {
        if (this.renderer) {
            this.renderer.setSize(width, height);
            TimeTubesAction.updateCamera(this.id, {aspect: width / height});
        }
    }

    _switchCamera() {
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
        this._addControls();
    }

    _searchTime(dst) {
        let zpos = dst - this.data.spatial[0].z;
        if (isNaN(zpos)) {
            alert('Please input numbers.');
        } else {
            this.animationPara.flag = true;
            this.animationPara.dep = this.tubeGroup.position.z;
            this.animationPara.dst = zpos;
            this._moveTube();
        }
    }

    _moveTube() {
        if (this.animationPara.flag) {
            requestAnimationFrame(this._moveTube.bind(this));
            this.renderer.render(this.scene, this.camera);
            this.animationPara.now += 1;
            let anim = (1 - Math.cos(Math.PI * this.animationPara.now / this.animationPara.speed)) / 2;
            this.tubeGroup.position.z = this.animationPara.dep + (this.animationPara.dst - this.animationPara.dep) * anim;
            if (this.animationPara.now === this.animationPara.speed) {
                // showCurrentVal(this.idx, this.animationPara.dst);
                DataAction.updateDetails(this.id, this.animationPara.dst);
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

    _drawTube(texture){//texture, spline, minList, maxList) {
        this.texture = texture;
        let minJD = this.data.spatial[0].z;
        let maxJD = this.data.spatial[this.data.spatial.length - 1].z;
        let range = this.data.meta.range;
        let divNum = 10 * Math.ceil(maxJD - minJD);
        let delTime = (maxJD - minJD) / divNum;
        let divNumPol = Math.ceil((this.data.splines.position.getPoint(1).z - this.data.splines.position.getPoint(0).z) / delTime);
        let divNumPho = Math.ceil((this.data.splines.color.getPoint(1).z - this.data.splines.color.getPoint(0).z) / delTime);
        let cen = this.data.splines.position.getSpacedPoints(divNumPol);
        let rad = this.data.splines.radius.getSpacedPoints(divNumPol);
        let col = this.data.splines.color.getSpacedPoints(divNumPho);
        let idxGap = Math.ceil((this.data.splines.color.getPoint(0).z - this.data.splines.position.getPoint(0).z) / delTime);
        let del = Math.PI * 2 / this.segment;
        let vertices = [];
        for (let i = 0; i < this.tubeNum; i++) {
            vertices[i] = [];
        }
        let indices = [];
        let colors = [];
        let selected = [];
        let currentColorX = 0, currentColorY = 0;
        let minH = this.data.meta.min.H, maxH = this.data.meta.max.H;
        let minV = this.data.meta.min.V, maxV = this.data.meta.max.V;
        for (let i = 0; i <= divNumPol; i++) {
            currentColorX = 0;
            currentColorY = 0;
            if (idxGap < i && (i - idxGap) < divNumPho) {
                currentColorX = col[i - idxGap].x;//(col[i - idxGap].x - minH) / (maxH - minH);
                currentColorY = col[i - idxGap].y;//(col[i - idxGap].y - minV) / (maxV - minV);
            }
            for (let j = 0; j <= this.segment; j++) {
                for (let k = 0; k < this.tubeNum; k++) {
                    k = 0;
                    let currad = (1 / this.tubeNum) * (k + 1);
                    let deg = del * j;
                    vertices[k].push((cen[i].x * range + currad * rad[i].x * range * Math.cos(deg)) * -1);
                    vertices[k].push(cen[i].y * range + currad * rad[i].y * range * Math.sin(deg));
                    vertices[k].push(cen[i].z - minJD);

                }

                colors.push(currentColorX);
                colors.push(currentColorY);


                if (j !== this.segment) {
                    indices.push(j + i * (this.segment + 1));
                    indices.push(j + (this.segment + 1) + i * (this.segment + 1));
                    indices.push(j + 1 + i * (this.segment + 1));
                    indices.push(j + (this.segment + 1) + i * (this.segment + 1));
                    indices.push(j + 1 + (this.segment + 1) + i * (this.segment + 1));
                    indices.push(j + 1 + i * (this.segment + 1));
                }
            }
        }
        indices = indices.slice(0, -1 * this.segment * 3 * 2);
        selected = new Float32Array(vertices[0].length);
        let normals = new Float32Array(vertices[0].length);
        let geometries = [];
        for (let i = 0; i < this.tubeNum; i++) {
            const geometryTmp = new THREE.BufferGeometry();
            geometryTmp.addAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices[i]), 3));
            geometryTmp.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
            geometryTmp.addAttribute('colorData', new THREE.BufferAttribute(new Float32Array(colors), 2));
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
            vertexShader: vertexShaderTube,
            fragmentShader: fragmentShaderTube,
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

    _setMinMaxH(minmax) {
        this.tube.material.uniforms.minmaxH.value = new THREE.Vector2(minmax[0], minmax[1]);
    }

    _setMinMaxV(minmax) {
        this.tube.material.uniforms.minmaxV.value = new THREE.Vector2(minmax[0], minmax[1]);
    }

    _changePlotsColor() {
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

    _drawGrid(size, divisions) {
        this.grid = new THREE.GridHelper(size, divisions, 'white', 'limegreen');
        this.grid.rotateX(Math.PI / 2);
        this.scene.add(this.grid);
    }

    _drawLabel(range) {
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

    _drawAxis() {
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

    _drawPlot() {
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