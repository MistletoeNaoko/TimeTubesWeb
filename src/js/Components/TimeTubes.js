import React from 'react';
import * as THREE from 'three';
import Details from './Details';
import * as TimeTubesAction from '../Actions/TimeTubesAction';
import * as ScatterplotsAction from '../Actions/ScatterplotsAction';
import * as DataAction from '../Actions/DataAction';
import * as FeatureAction from '../Actions/FeatureAction';
import * as dataLib from '../lib/dataLib';
import AppStore from '../Stores/AppStore';
import TimeTubesStore from '../Stores/TimeTubesStore';
import DataStore from '../Stores/DataStore';
import FeatureStore from '../Stores/FeatureStore';
import ClusteringStore from '../Stores/ClusteringStore';
import BufferGeometryUtils from '../lib/BufferGeometryUtils';
import OrbitControls from "three-orbitcontrols";
import TextSprite from 'three.textsprite';

export default class TimeTubes extends React.Component{
    constructor(props) {
        super();
        this.id = props.id;
        this.data = props.data;
        this.menu = 'visualization';
        this.canvas;
        this.cameraProp = TimeTubesStore.getCameraProp(props.id);
        this.tubeNum = 16;
        this.segment = 16;
        this.division = 5;
        this.currentHighlightedPlot = 0;
        this.drag = false;
        this.visualQuery = false;
        this.dragSelection = false;
        this.selector = true;
        this.averagePeriod = 0;
        this.animationPara = {flag: false, dep: 0, dst:0, speed: 40, now: 0};
        this.raycaster = new THREE.Raycaster();
        this.vertex = document.getElementById('vertexShader_tube').textContent;
        this.fragment = document.getElementById('fragmentShader_tube').textContent;
        this.lock = false;
        this.opacityCurve = TimeTubesStore.getOpacityCurve('Default');
        this.rotationPeriod = null;
        this.wheelInterval = 1;
        this.colorEncodingOption = {hue: 'default', value: 'default'};
        this.renderClusteringResultView = false;
        this.currentTubeStatus = {
            position: undefined,
            grid: undefined,
            plot: undefined
        };
        this.subsequencesInComparisonPanel = [];
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
        this.state = {
            width: props.width,
            height: props.height,
        }
    }

    render() {
        // let width = ($(window).width() - $('#Controllers').width() - $('.right').width()) / DataStore.getDataNum()// * 0.95;
        // let height = Math.max($('#Controllers').height(), 500);
        this.updateSize(this.props.width, this.props.height);
        return (
            <div style={{position: 'relative', float: 'left'}}>
                <div
                    className={'TimeTubes'}
                    style={{width: this.props.width + 'px', height: this.props.height + 'px'}}//"500px", height: "500px"}}
                    // style={{width: "500px", height: "500px", position: 'absolute', top: '0px', left: '0px', zIndex: '0'}}
                    ref={mount => {
                        this.mount = mount;
                    }}
                />
                <Details/>
            </div>
        )
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
        this.renderer = new THREE.WebGLRenderer({preserveDrawingBuffer: true}); //{ antialias: true }
        this.renderer.setClearColor(new THREE.Color(Number(TimeTubesStore.getBackgroundColor())));
        this.renderer.setSize(width, height);
        this.renderer.localClippingEnabled = true;
        this.renderer.domElement.id = 'TimeTubes_viewport_' + this.id;
        this.renderer.domElement.className = 'TimeTubes_viewport';
        this.canvas = this.renderer.domElement;
        this.initQBEView();
        this.initClusteringResultsView();

        // assign a canvas with the name of 'TimeTubes_viewport_ + this.id' to div element
        this.mount.appendChild(this.renderer.domElement);

        this.renderScene();
        this.start();

        this.clippingPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
        this.clippingPlane2 = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

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
        texture.load('img/1_256.png', function(texture) {
            TimeTubesAction.setTexture(this.id, texture);
            this.drawTube(texture);
        }.bind(this));
        this.drawGrid(TimeTubesStore.getGridSize() * 2, 10);
        this.drawLabel(TimeTubesStore.getGridSize() / this.data.meta.range);
        this.drawAxis();
        this.drawPlot();
        this.drawDisk();
        this.drawDiskForRotationCenter();
        this.drawComment();
        this.drawPeriodMarker();

        AppStore.on('selectMenu', (menu) => {
            if (menu === 'feature') {
                this.menu = FeatureStore.getMode();
            } else {
                this.menu = menu;
            }
            if (menu === 'visualization') {
                this.tubeGroup.position.z = this.currentTubeStatus.position;
                this.grid.visible = this.currentTubeStatus.grid;
                this.plot.visible = this.currentTubeStatus.plot;
                if (this.currentTubeStatus.far) {
                    this.clippingPlane2.constant = this.currentTubeStatus.far;
                    this.renderer.clippingPlanes = [this.clippingPlane2];
                } else {
                    this.renderer.clippingPlanes = [];
                }
                this.currentTubeStatus = {
                    position: undefined,
                    grid: undefined,
                    plot: undefined,
                    far: undefined
                };
                this.renderer.localClippingEnabled = $('#checkboxClip').prop('checked');
            } else if (AppStore.getPreviousMenu() === 'visualization' && menu !== 'visualization') {
                this.currentTubeStatus = {
                    position: this.tubeGroup.position.z,
                    grid: this.grid.visible,
                    plot: this.plot.visible,
                    far: (this.renderer.clippingPlanes.length > 0)? this.renderer.clippingPlanes[0].constant: undefined
                };
            }
        });
        DataStore.on('updatePrivateComment', () => {
            this.updateComment();
        });
        TimeTubesStore.on('upload', () => {
            this.cameraProp = TimeTubesStore.getCameraProp(this.id);
            this.updateCamera();
        });
        TimeTubesStore.on('updateCamera', (id) => {
            if (id === this.id) {
                this.cameraProp = TimeTubesStore.getCameraProp(this.id);
                this.updateCamera();
                // if (this.cameraProp.xpos === 0 && this.cameraProp.ypos === 0 && this.cameraProp.zpos === 50) {
                    
                // this.resetCamera();
                // }
                // this.resetCamera();
            }
        });
        TimeTubesStore.on('reset', (id) => {
            if (id === this.id) {
                this.cameraProp = TimeTubesStore.getCameraProp(this.id);
                if (this.cameraProp.xpos === 0 && this.cameraProp.ypos === 0 && this.cameraProp.zpos === 50) {
                    this.resetCamera();
                }
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
        TimeTubesStore.on('changeBackground', () => {
            this.scene.background = new THREE.Color(Number(TimeTubesStore.getBackgroundColor()));
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
        TimeTubesStore.on('changeFar', (id, far) => {
            if (id === this.id) {
                this.cameraProp = TimeTubesStore.getCameraProp(this.id);
                this.clippingPlane2.constant = far;
                this.renderer.clippingPlanes = [this.clippingPlane2];
                this.renderer.render(this.scene, this.camera);
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
                this.drawPlot();
                // this.changePlotsColor();
            } else if (this.data.merge) {
                let fileName = DataStore.getFileName(id);
                if (this.data.name.indexOf(fileName) >= 0) {
                    this.plotColor[this.idNameLookup[fileName]] = TimeTubesStore.getPlotColor(id);
                    this.drawPlot();
                    // this.changePlotsColor();
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

                if (this.lock) {
                    TimeTubesStore.setLock(this.id, fittingDst - this.data.spatial[0].z);
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
                    let min = this.data.meta.min.z;
                    let max = this.data.meta.max.z;
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
        // TimeTubesStore.on('moveTubeGroup', (id, pos) => {
        //     if (id === this.id) {
        //         this.tubeGroup = pos;
        //     }
        // });
        TimeTubesStore.on('takeSnapshot', (id, pos, far) => {
            if (id === this.id) {
                this.deselectAll();
                this.tubeGroup.position.z = pos;
                if (far !== undefined) {
                    this.clippingPlane2.constant = far;
                    this.renderer.clippingPlanes = [this.clippingPlane2];
                }
                this.renderer.render(this.scene, this.camera);
            }
        });
        TimeTubesStore.on('recoverTube', (id, cameraProp, tubePos) => {
            if (id === this.id) {
                this.cameraProp = TimeTubesStore.getCameraProp(this.id);
                this.tubeGroup.position.z = tubePos;
                this.updateCamera();
                this.renderer.clippingPlanes = [];
            }
        });
        TimeTubesStore.on('showTimeTubesOfTimeSlice', (id, period) => {
            if (id === this.id) {
                // put labels at the beginning and end of the period and a tube to show a period at te origin of the space
                this.resetCamera();
                this.tubeGroup.position.z = TimeTubesStore.getFocused(id);
                this.clippingPlane2.constant = period[1] - period[0];
                this.renderer.clippingPlanes = [this.clippingPlane2];

                this.showPeriod(period);
            }
        });
        TimeTubesStore.on('updateAveragePeriod', () => {
            this.averagePeriod = TimeTubesStore.getAveragePeriod();
            if (this.averagePeriod > 0) {
                let average = DataStore.getAverage(this.id, this.tubeGroup.position.z, this.averagePeriod);
                this.disk.visible = true;
                this.disk.position.x = average.x * this.data.meta.range;
                this.disk.position.y = average.y * this.data.meta.range;
            } else {
                this.disk.visible = false;
            }
        });
        TimeTubesStore.on('updateTexture', (id, texture) => {
            if (id === this.id) {
                // update texture
                this.tube.material.uniforms.texture.value = texture;
            }
        });
        TimeTubesStore.on('showRotationCenter', (id, period, center) => {
            if (id === this.id) {
                // put labels at the beginning and end of the period and a tube tu show a period at te origin of the space
                this.resetCamera();
                this.tubeGroup.position.z = TimeTubesStore.getFocused(id);
                this.diskRotation.visible = true;
                this.diskRotation.position.x = center.x * this.data.meta.range;
                this.diskRotation.position.y = center.y * this.data.meta.range;
                this.rotationPeriod = period;
                this.clippingPlane2.constant = period[1] - period[0];
                this.renderer.clippingPlanes = [this.clippingPlane2];
                
                this.showPeriod(period);
            } else {
                this.rotationPeriod = null;
            }
        });
        TimeTubesStore.on('switchComment', (id, state) => {
            if (id === this.id) {
                if (state) {
                    this.comment.visible = true;
                } else {
                    this.comment.visible = false;
                    this.commentContents.visible = false;
                }
            }
        });
        TimeTubesStore.on('updateWheelInterval', () => {
            this.wheelInterval = TimeTubesStore.getWheelInterval();
        });
        TimeTubesStore.on('updateColorEncodingOptionHue', (id, option) => {
            if (id === this.id) {
                this.colorEncodingOption.hue = option;
                this.updateColorEncodingOptionHue();
            }
        });
        TimeTubesStore.on('updateColorEncodingOptionValue', (id, option) => {
            if (id === this.id) {
                this.colorEncodingOption.value = option;
                this.updateColorEncodingOptionValue();
            }
        });
        FeatureStore.on('setExtractionResults', () => {
            this.subsequencesInComparisonPanel = [];
        });
        FeatureStore.on('switchQueryMode', (mode) => {
            this.renderClusteringResultView = false;
            let sourceId = FeatureStore.getSource();
            this.menu = mode;
            if (mode === 'QBE' && sourceId !== 'default') {
                this.visualQuery = (Number(sourceId) === this.id);
                this.setQBEView();
                // this.updateControls();
                this.resetSelection();
            } else {
                this.deselectAll();
            }
        });
        FeatureStore.on('updateSource', () => {
            this.renderClusteringResultView = false;
            this.subsequencesInComparisonPanel = [];
            this.menu = FeatureStore.getMode();
            let sourceId = FeatureStore.getSource();
            if (this.menu === 'QBE' && sourceId !== 'default') {
                this.visualQuery = (Number(sourceId) === this.id);
                this.setQBEView();
                // this.updateControls();
                this.resetSelection();
            }
        });
        FeatureStore.on('switchDragSelection', () => {
            this.dragSelection = FeatureStore.getDragSelection();
            this.updateControls();
        });
        FeatureStore.on('resetSelection', () => {
            if (this.tube) {
                this.deselectAll();
            }
        });
        FeatureStore.on('switchSelector', () => {
            this.selector = FeatureStore.getSelector();
        });
        FeatureStore.on('selectTimeInterval', (id, value) => {
            this.menu = FeatureStore.getMode();
            if (this.menu === 'QBE' && Number(id) === this.id) {
                // this.selectTimeInterval(Number(value));
                this.paintSelectedPeriod();
            }
        });
        FeatureStore.on('updateSelectedPeriod', () => {
            let sourceId = FeatureStore.getSource();
            this.menu = FeatureStore.getMode();
            if (this.menu === 'QBE' && Number(sourceId) === this.id) {
                // paint the selected period red
                this.paintSelectedPeriod();
            }
        });
        FeatureStore.on('convertResultIntoQuery', (id, period, activeVar) => {
            this.renderClusteringResultView = false;
            this.subsequencesInComparisonPanel = [];
            this.menu = FeatureStore.getMode();
            if (this.menu === 'QBE' && Number(id) === this.id) {
                this.visualQuery = (Number(id) === this.id);
                this.setQBEView();
                // this.updateControls();
                this.resetSelection();
                this.paintSelectedPeriod();
                this.searchTime(period[0]);
                this.grid.visible = this.currentTubeStatus.grid;
                this.plot.visible = this.currentTubeStatus.plot;
                if (this.currentTubeStatus.far) {
                    this.clippingPlane2.constant = this.currentTubeStatus.far;
                    this.renderer.clippingPlanes = [this.clippingPlane2];
                } else {
                    this.renderer.clippingPlanes = [];
                }
            }
        });
        FeatureStore.on('recoverQuery', (query) => {
            this.renderClusteringResultView = false;
            this.subsequencesInComparisonPanel = [];
            if (FeatureStore.getMode() === 'QBE' && Number(FeatureStore.getSource()) === this.id) {
                this.visualQuery = true;
                setTimeout(function() {
                    this.setQBEView();
                    // this.updateControls();
                    this.resetSelection();
                    this.paintSelectedPeriod();
                }.bind(this), 0);
            }
        });
        ClusteringStore.on('showClusteringResults', () => {
            // show subsequences in TimeTubes view
            // 必要なのはsubsequencesとlabelsとcolors
            let subsequences = ClusteringStore.getSubsequences();
            let labels = ClusteringStore.getLabels();
            let colors = ClusteringStore.getClusterColors();
            this.renderClusteringResultView = false;
            this.subsequencesInComparisonPanel = [];
            // TODO: もう少しまともな表示方法を検討！！
            // this.showClusteringResults(subsequences, labels, colors);
            // this.setClusteringResultsView();
        });
        ClusteringStore.on('showTTViewOfSelectedSSClustering', (id, period) => {
            if (id === this.id) {
                // this.grid.visible = false;
                // this.plot.visible = false;
                this.renderClusteringResultView = true;
                this.showSelectedSSClusteringResultsView(period);
            } else {
                this.renderClusteringResultView = false;
            }
        });
        ClusteringStore.on('showSelectedSubsequenceInComparisonPanel', (id, period, SSId) => {
            if (id === this.id) {
                this.renderClusteringResultView = false;
                this.showSelectedSSInComparisonPanel(period, SSId);
            }
        });
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
        this.renderMainRenderer();
        if (this.renderClusteringResultView) {//(this.menu === 'Clustering' && this.renderClusteringResultView) {
            this.renderClusteringRenderer();
        }
        if (this.menu === 'QBE') {
            this.renderQBERenderer();
        }
        if (!this.renderClusteringResultView && this.subsequencesInComparisonPanel.length > 0) {
            // マウスオーバーによる選択部分のTimeTubes表示とcomparison viewの操作が同時に行われることはないから
            this.renderSSComparisonPanel();
        }
    }

    renderMainRenderer() {
        this.renderer.render(this.scene, this.camera);
    }

    renderQBERenderer() {
        // https://teratail.com/questions/67020 canvasの解像度はcanvasのwidth, height依存（CSSじゃなくてattributeの方）
        let dom = document.getElementById('QBESourceTTCanvas');
        if  (dom) {
            let width = this.renderer.domElement.width,
                height = this.renderer.domElement.height;
            let context = dom.getContext('2d');
            this.renderer.render(this.scene, this.QBECamera);
            context.drawImage(
                this.renderer.domElement, 
                0, 0, width, height,
                0, 0, dom.width, dom.height);
        }
    }

    renderSSComparisonPanel() {
        for (let i = 0; i < this.subsequencesInComparisonPanel.length; i++) {
            // this.subsequencesInComparisonPanel[i].render();
            this.clippingPlane2.constant = this.subsequencesInComparisonPanel[i].period[1] - this.subsequencesInComparisonPanel[i].period[0];
            this.renderer.clippingPlanes = [this.clippingPlane2];
            this.tubeGroup.position.z = this.subsequencesInComparisonPanel[i].period[0] - this.data.spatial[0].z;
            let canvas = document.getElementById("subsequenceComparisonCanvas_" + this.subsequencesInComparisonPanel[i].SSId);
            if (canvas) {
                let width = this.renderer.domElement.width,
                    height = this.renderer.domElement.height;
                let context = canvas.getContext('2d');
                this.renderer.render(this.scene, this.subsequencesInComparisonPanel[i].camera);
                context.drawImage(
                    this.renderer.domElement,
                    0, 0, width, height,
                    0, 0, canvas.width, canvas.height
                );
            }
        }
    }

    renderClusteringRenderer() {
        let dom = document.getElementById('tooltipClusteringResultsSubsequencesTTView');
        if (dom) {
            let width = this.renderer.domElement.width,
                height = this.renderer.domElement.height;
            let context = dom.getContext('2d');
            this.renderer.render(this.scene, this.ClusteringCamera);
            context.drawImage(
                this.renderer.domElement, 
                0, 0, width, height,
                0, 0, dom.width, dom.height);
        }
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
            if (this.QBEControls) this.QBEControls.enabled = false;
        } else {
            if (this.QBEControls) this.QBEControls.enabled = true;
        }
    }

    onMouseWheel() {
        return function(event) {
            event.preventDefault();
            // 1 scroll = 100 in delta
            // changeColFlg is whether or not current focused coincides with any observations
            let scrollDirection = (event.deltaY > 0)? true: false;
            let changeColFlg = false;
            let now = this.tubeGroup.position.z;
            let dst = this.tubeGroup.position.z;

            if (scrollDirection) {
                dst += this.wheelInterval;
            } else {
                dst += -1 * this.wheelInterval;
            }

            if (dst < 0) {
                dst = 0;
            } else if (dst > this.data.spatial[this.data.spatial.length - 1].z - this.data.spatial[0].z) {
                dst = this.data.spatial[this.data.spatial.length - 1].z - this.data.spatial[0].z;
            }
            
            let i;
            if (scrollDirection) {
                // if the wheel goes forward
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
            } else {
                // if the wheel goes back
                for (i = this.data.spatial.length - 1; i >= 0; i--) {
                    let tmp = this.data.spatial[i].z - this.data.spatial[0].z;
                    if (Math.min(now, dst) < tmp && tmp < Math.max(now, dst)) {
                        dst = tmp;
                        // this.currentFocusedIdx = i;
                        if ('x' in this.data.spatial[i])
                            changeColFlg = true;
                        break;
                    }
                }
            }

            if ((dst === this.data.spatial[this.data.spatial.length - 1].z - this.data.spatial[0].z) && ('x' in this.data.spatial[this.data.spatial.length - 1])) {
                changeColFlg = true;
            }
            if ((dst === 0) && ('x' in this.data.spatial[0])) {
                changeColFlg = true;
            }

            // reset the highlighted plot's color before updating a currently focused plot
            let color;
            if (!this.data.merge) {
                color = new THREE.Color(Number('0x' + this.plotColor.slice(1)));
            } else {
                color = new THREE.Color(Number('0x' + this.plotColor[this.idNameLookup[this.data.spatial[this.currentHighlightedPlot].source]].slice(1)));
            }
            this.changePlotColor(this.currentHighlightedPlot * this.segment, color);
            
            // make a currently focused plot red
            if (changeColFlg) {
                if (!this.data.merge) {
                    for (let j = 0; j < this.data.splines.position.points.length; j++) {
                        if (dst === this.data.spatial[j].z - this.data.spatial[0].z) {
                            this.changePlotColor(j * this.segment, new THREE.Color('red'));
                            this.currentHighlightedPlot = j;
                        }
                    }
                } else {
                    let posCount = 0;
                    for (let j = 0; j < this.data.spatial.length; j++) {
                        if ('x' in this.data.spatial[j]) {
                            if (dst === this.data.spatial[j].z - this.data.spatial[0].z) {
                                this.changePlotColor(posCount * this.segment, new THREE.Color('red'));
                                this.currentHighlightedPlot = posCount;
                            }
                            posCount++;
                        }
                    }
                }
            }

            if (this.periodStartMarker.visible) {
                this.periodGroup.position.z = this.periodGroup.position.z + (dst - this.tubeGroup.position.z);
            }
            this.tubeGroup.position.z = dst;
            if (this.clusteringGroup) {
                this.clusteringGroup.position.z = dst;
            }

            // remove/hide objects out of use
            if (this.diskRotation.visible) {
                if (dst < this.rotationPeriod[0] - this.data.spatial[0].z || this.rotationPeriod[1] - this.data.spatial[0].z < dst) {
                    this.diskRotation.visible = false;
                    this.rotationPeriod = null;
                }
            }
            if (this.renderer.clippingPlanes.length > 0) {
                // this.renderer.clippingPlanes = [];
                this.clippingPlane2.constant = this.cameraProp.far;
            }

            TimeTubesAction.updateFocus(this.id, dst, changeColFlg);
            if (this.lock)
                TimeTubesAction.synchronizeTubes(this.id, dst, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0));
            ScatterplotsAction.moveCurrentLineonTimeSelector(this.id, dst + this.data.spatial[0].z);
            DataAction.updateDetails(this.id, dst);

            if (this.averagePeriod > 0) {
                let average = DataStore.getAverage(this.id, this.tubeGroup.position.z, this.averagePeriod);
                this.disk.position.x = average.x * this.data.meta.range;
                this.disk.position.y = average.y * this.data.meta.range;
            }
        }.bind(this);
    }

    onMouseDown() {
        return function (event) {
            this.drag = false;
        }
    }

    onMouseMove() {
        return function (event) {
            this.drag = true;
            if (this.drag) {
                // let cameraPropNow = this.cameraProp;
                // cameraPropNow.xpos = this.camera.position.x;
                // cameraPropNow.ypos = this.camera.position.y;
                // cameraPropNow.zpos = this.camera.position.z;
                // this.cameraProp = cameraPropNow;
                if (this.lock) {
                    let deg = new THREE.Vector3(this.controls.object.rotation._x, this.controls.object.rotation._y, this.controls.object.rotation._z);
                    let pos = this.controls.object.position;
                    TimeTubesAction.synchronizeTubes(this.id, 0, pos, deg);
                }
                // if (this.visualQuery && this.dragSelection) {
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

                        // fill between selections
                        let arraySize = this.tube.geometry.attributes.selected.array.length / this.tubeNum;
                        //  'idx - arraySize * (this.tubeNum - 1) / this.tubeNum' is because only the most outside tube is highlighted in red
                        let firstIdx = this.tube.geometry.attributes.selected.array.indexOf(1) % arraySize;
                        let lastIdx = this.tube.geometry.attributes.selected.array.lastIndexOf(1) % arraySize;
                        for (let i = firstIdx; i <= lastIdx; i++) {
                            this.tube.geometry.attributes.selected.array[arraySize * (this.tubeNum - 1) + i] = 1;
                        }
                        let minJD = this.data.meta.min.z;
                        let firstJD = Math.floor(firstIdx / this.segment) * (1 / this.division) + minJD;
                        let lastJD = (Math.floor(lastIdx / this.segment) + 1) * (1 / this.division) + minJD;
                        FeatureAction.updateSelectedPeriod([firstJD, lastJD]);
                        // this.renderer.render(this.scene, this.camera);
                        // if (this.QBERenderer) this.QBERenderer.render(this.scene, this.QBECamera);
                    }
                }
            }
        }
    }

    onMouseUp() {
        return function (event) {
            if (this.comment.visible && !this.drag) {
                let face;
                let raymouse = new THREE.Vector2();
                raymouse.x = (event.offsetX / this.renderer.domElement.clientWidth) * 2 - 1;
                raymouse.y = -(event.offsetY / this.renderer.domElement.clientHeight) * 2 + 1;
                this.raycaster.setFromCamera(raymouse, this.camera);
                let intersects = this.raycaster.intersectObject(this.comment);
                if (intersects.length > 0) {
                    face = intersects[0].face;
                }
                if (face !== undefined) {
                    // get the target comment
                    // show the summary of the comment
                    if (this.commentContents.visible) {
                        this.commentContents.visible = false;
                    } else {
                        this.commentContents.visible = true;
                        let commentIdx = Math.floor(face.a / 6);
                        let commentId = this.commentList[commentIdx];
                        let comment = dataLib.getPrivateCommentFromId(commentId);
                        let content = comment.timeStamp + '\n'
                            + comment.userName + '\n';
                        if (comment.comment.length > 30) {
                            content += comment.comment.substr(0, 50);
                        } else {
                            content += comment.comment;
                        }
                        this.commentContents.material.map.text = content;
                        this.commentContents.position.set(-TimeTubesStore.getGridSize() - 10, 0, 0);
                    }
                }
            } else if (this.drag) {
                let cameraPropNow = this.cameraProp;
                cameraPropNow.xpos = this.camera.position.x;
                cameraPropNow.ypos = this.camera.position.y;
                cameraPropNow.zpos = this.camera.position.z;
                this.cameraProp = cameraPropNow;
            }
            // this.drag = false;
        }
    }

    onMouseClick() {
        return function (event) {
            if (!this.drag && this.visualQuery && !this.dragSelection) {
                let face = this.getIntersectedIndex(event);
                let firstIdx, lastIdx;
                if (face !== undefined) {
                    if (this.tube) {
                        this.tube.geometry.colorsNeedUpdate = true;
                        this.tube.geometry.attributes.selected.needsUpdate = true;
                        let startIdx = Math.floor(Math.min(face.a, face.b, face.c) / this.segment);
                        let startJD = Math.floor(startIdx / this.segment) * (1 / this.division) + this.data.meta.min.z;
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

                        // fill between selections
                        let arraySize = this.tube.geometry.attributes.selected.array.length / this.tubeNum;
                        //  'idx - arraySize * (this.tubeNum - 1) / this.tubeNum' is because only the most outside tube is highlighted in red
                        firstIdx = this.tube.geometry.attributes.selected.array.indexOf(1) % arraySize;
                        lastIdx = this.tube.geometry.attributes.selected.array.lastIndexOf(1) % arraySize;
                        for (let i = firstIdx; i <= lastIdx; i++) {
                            this.tube.geometry.attributes.selected.array[arraySize * (this.tubeNum - 1) + i] = 1;
                        }
                        // this.renderer.render(this.scene, this.camera);
                        // if (this.QBERenderer) this.QBERenderer.render(this.scene, this.QBECamera);

                        if (firstIdx >= lastIdx) {
                            FeatureAction.updateSelectedPeriod([-1, -1]);
                        } else {
                            let minJD = this.data.meta.min.z;
                            let firstJD = Math.floor(firstIdx / this.segment) * (1 / this.division) + minJD;
                            let lastJD = (Math.floor(lastIdx / this.segment) + 1) * (1 / this.division) + minJD;
                            FeatureAction.updateSelectedPeriod([firstJD, lastJD]);
                        }
                    }
                }
            } else if (!this.visualQuery) {
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
            this.drag = false;
        }
    }

    getIntersectedIndex(event) {
        let face;
        let raymouse = new THREE.Vector2();
        let QBECanvas = document.getElementById('QBESourceTTCanvas');
        let clientRect = QBECanvas.getBoundingClientRect();
        let canvasPageX = window.pageXOffset + clientRect.left,
            canvasPageY = window.pageYOffset + clientRect.top;
        let offsetX = event.pageX - canvasPageX,
            offsetY = event.pageY - canvasPageY;
        raymouse.x = (offsetX / Number(QBECanvas.style.width.slice(0, -2))) * 2 - 1;// this.QBERenderer.domElement.clientWidth) * 2 - 1;
        raymouse.y = -(offsetY / Number(QBECanvas.style.height.slice(0, -2))) * 2 + 1;//-(event.offsetY / this.QBERenderer.domElement.clientHeight) * 2 + 1;
        this.raycaster.setFromCamera(raymouse, this.QBECamera);
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
        // this.renderer.render(this.scene, this.camera);
        // if (this.QBERenderer) this.QBERenderer.render(this.scene, this.QBECamera);
        // FeatureAction.updateSelectedInterval([0, 0]);
    }

    resetSelection() {
        if (!this.visualQuery)
            this.deselectAll();
    }

    selectTimeInterval(value) {
        this.tube.geometry.colorsNeedUpdate = true;
        this.tube.geometry.attributes.selected.needsUpdate = true;
        let arraySize = this.tube.geometry.attributes.selected.array.length / this.tubeNum;
        let currentPos = this.tubeGroup.position.z;
        let initIdx = (Math.round(currentPos) * this.division + 1) * this.segment + arraySize * (this.tubeNum - 1);//(Math.floor(currentPos) * this.division + 1) * this.segment;
        for (let i = 0; i < (Math.floor(value)) * (this.division) * this.segment; i++) {
            this.tube.geometry.attributes.selected.array[initIdx + i] = 1;
        }

        // fill the gaps between selections
        let firstIdx = this.tube.geometry.attributes.selected.array.indexOf(1) % arraySize;
        let lastIdx = this.tube.geometry.attributes.selected.array.lastIndexOf(1) % arraySize;
        for (let i = firstIdx; i <= lastIdx; i++) {
            this.tube.geometry.attributes.selected.array[arraySize * (this.tubeNum - 1) + i] = 1;
        }
        let minJD = this.data.meta.min.z;
        let firstJD = Math.floor(firstIdx / this.segment) * (1 / this.division) + minJD;
        let lastJD = (Math.floor(lastIdx / this.segment) + 1) * (1 / this.division) + minJD;
        FeatureAction.updateSelectedPeriod([firstJD, lastJD]);
        // this.renderer.render(this.scene, this.camera);
        // if (this.QBERenderer) this.QBERenderer.render(this.scene, this.QBECamera);
    }

    paintSelectedPeriod() {
        this.deselectAll();
        let selectedPeriod = FeatureStore.getSelectedPeriod();
        let minJD = this.data.meta.min.z;
        let arraySize = this.tube.geometry.attributes.selected.array.length / this.tubeNum;
        let firstIdx = (Math.ceil(selectedPeriod[0] - minJD) * this.division * this.segment);
        let lastIdx = (Math.ceil(selectedPeriod[1] - minJD) * this.division * this.segment);
        this.tube.geometry.colorsNeedUpdate = true;
        this.tube.geometry.attributes.selected.needsUpdate = true;
        for (let i = firstIdx; i < lastIdx; i++) {
            this.tube.geometry.attributes.selected.array[arraySize * (this.tubeNum - 1) + i] = 1;
        }
        // this.renderer.render(this.scene, this.camera);
        // if (this.QBERenderer) this.QBERenderer.render(this.scene, this.QBECamera);
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
        let far = Math.ceil(this.data.spatial[this.data.spatial.length - 1].z - this.data.spatial[0].z + 50);
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
        this.camera.lookAt(this.scene.position);

        $( "#farSlider_" + this.id ).slider({
            min: 0,
            max: far,
            value: far
        });
    }

    resetCamera() {
        this.cameraProp.xpos = 0;
        this.cameraProp.ypos = 0;
        this.cameraProp.zpos = 50;
        TimeTubesAction.updateCamera(this.id, this.cameraProp);
        this.camera.position.set(this.cameraProp.xpos, this.cameraProp.ypos, this.cameraProp.zpos);
        this.camera.zoom = this.cameraProp.zoom;
        // this.controls.position0
        this.controls.reset();
    }

    updateCamera() {
        this.camera.position.set(this.cameraProp.xpos, this.cameraProp.ypos, this.cameraProp.zpos);
        this.camera.fov = this.cameraProp.fov;
        this.camera.depth = this.cameraProp.depth;
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
                if (this.disk.visible) {
                    let average = DataStore.getAverage(this.id, this.tubeGroup.position.z, this.averagePeriod);
                    this.disk.position.x = average.x * this.data.meta.range;
                    this.disk.position.y = average.y * this.data.meta.range;
                }
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
            this.plot.material.color = new THREE.Color(Number('0x' + this.plotColor.slice(1)));//.set(this.plotColor);
        } else {
            let circleColor = [];
            let baseColors = [];
            for (let i = 0; i < this.plotColor.length; i++) {
                baseColors.push(new THREE.Color(this.plotColor[i]));
            }
            let circleIndices = Array(this.data.splines.position.points.length * this.segment * 2);
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
            this.plot.geometry.setAttribute('color', new THREE.Float32BufferAttribute(circleColor, 3));
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

    showPeriod(period) {
        let gridSize = TimeTubesStore.getGridSize();
        this.periodGroup.visible = true;

        this.periodTube.geometry.attributes.position.needsUpdate = true;
        let startIdx = this.periodTube.geometry.attributes.position.array.length / 2 + 2;
        let endPos = period[1] - period[0];
        for (let i = 0; i < this.periodTube.geometry.attributes.position.array.length / 3 / 2; i++) {
            this.periodTube.geometry.attributes.position.array[startIdx + i * 3] = -endPos;
        }

        this.periodEndMarker.position.set(gridSize + 1, gridSize + 1, -endPos);

        this.periodGroup.position.z = -(period[0] - this.data.spatial[0].z) + this.tubeGroup.position.z;

        this.periodStartMarker.material.map.text = String(period[0].toFixed(0));
        this.periodEndMarker.material.map.text = String(period[1].toFixed(0));

        this.renderer.render(this.scene, this.camera);
    }

    drawTube(texture){//texture, spline, minList, maxList) {
        this.texture = texture;
        let minJD = this.data.spatial[0].z;
        let maxJD = this.data.spatial[this.data.spatial.length - 1].z;
        let range = this.data.meta.range;
        let divNum = this.division * Math.ceil(maxJD - minJD);
        let delTime = (maxJD - minJD) / divNum;
        let divNumPol = Math.ceil((this.data.splines.position.getPoint(1).z - this.data.splines.position.getPoint(0).z) / delTime);
        // let divNumPho = Math.ceil((this.data.splines.color.getPoint(1).z - this.data.splines.color.getPoint(0).z) / delTime);
        let cen = this.data.splines.position.getSpacedPoints(divNumPol);
        let rad = this.data.splines.radius.getSpacedPoints(divNumPol);
        // let col = this.data.splines.color.getSpacedPoints(divNumPho);
        let divNumHue, hue, idxGapHue;
        if (this.data.splines.hue.points.length > 0) { 
            divNumHue = Math.ceil((this.data.splines.hue.getPoint(1).z - this.data.splines.hue.getPoint(0).z) / delTime);
            hue = this.data.splines.hue.getSpacedPoints(divNumHue);
            idxGapHue = Math.ceil((this.data.splines.hue.getPoint(0).z - this.data.splines.position.getPoint(0).z) / delTime);
        }
        let divNumValue = Math.ceil((this.data.splines.value.getPoint(1).z - this.data.splines.value.getPoint(0).z) / delTime);
        // let hue
        // if (divNumHue) {
        //     hue = this.data.splines.hue.getSpacedPoints(divNumHue);
        // }
        let value = this.data.splines.value.getSpacedPoints(divNumValue);
        // let idxGap = Math.ceil((this.data.splines.color.getPoint(0).z - this.data.splines.position.getPoint(0).z) / delTime);

        // let idxGapHue = Math.ceil((this.data.splines.hue.getPoint(0).z - this.data.splines.position.getPoint(0).z) / delTime);
        let idxGapValue = Math.ceil((this.data.splines.value.getPoint(0).z - this.data.splines.position.getPoint(0).z) / delTime);
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
        let opacityPoints = this.opacityCurve.getSpacedPoints(this.tubeNum);
        let opacityList = [];
        for (let i = 1; i <= this.tubeNum; i++) {
            opacityList.push(1 - (1 - opacityPoints[i - 1].y) / (1 - opacityPoints[i].y));
        }
        for (let i = 0; i <= divNumPol; i++) {
            currentColorX = 0;
            currentColorY = 0;
            // if (idxGap < i && (i - idxGap) < divNumPho) {
            //     currentColorX = col[i - idxGap].x;//(col[i - idxGap].x - minH) / (maxH - minH);
            //     currentColorY = col[i - idxGap].y;//(col[i - idxGap].y - minV) / (maxV - minV);
            // }
            if (divNumHue) {
                if (idxGapHue < i && (i - idxGapHue) < divNumHue) {
                    currentColorX = hue[i - idxGapHue].x;
                }
            }
            if (idxGapValue < i && (i - idxGapValue) < divNumValue) {
                currentColorY = value[i - idxGapValue].y;
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
            geometryTmp.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices[i]), 3));
            geometryTmp.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
            geometryTmp.setAttribute('colorData', new THREE.BufferAttribute(new Float32Array(colors[i]), 3));
            geometryTmp.setAttribute('selected', new THREE.BufferAttribute(new Float32Array(selected), 1));
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
                shade: {value: true},
                texture: {value: this.texture},
                minmaxH: {value: new THREE.Vector2(this.data.meta.min.H, this.data.meta.max.H)},
                minmaxV: {value: new THREE.Vector2(this.data.meta.min.V, this.data.meta.max.V)},
                flagH: {value: true},
                flagV: {value: true}
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
        let positionArray = vertices[this.tubeNum - 1];
        let colorArray = colors[this.tubeNum - 1];
        let indicesArray = indices;
        TimeTubesAction.uploadTubeAttributes(this.id, positionArray, colorArray, indicesArray);
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
        axisGeometry.setAttribute(
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
            let circleIndices = Array(this.data.splines.position.points.length * this.segment * 2);
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
            circleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(circlePositions, 3));
            circleGeometry.setAttribute('color', new THREE.Float32BufferAttribute(circleColor, 3));
            let circleMaterial = new THREE.LineBasicMaterial({
                vertexColors: THREE.VertexColors,
                clippingPlanes: [this.clippingPlane]
            });
            this.plot = new THREE.LineSegments(circleGeometry, circleMaterial);
        } else {
            let circlePositions = [];
            let circleColor = [];
            let baseColor = new THREE.Color(this.plotColor);
            let circleIndices = Array(this.data.splines.position.points.length * this.segment * 2);
            let del = Math.PI * 2 / this.segment;
            let range = this.data.meta.range;
            // let plotNum = 0;
            for (let i = 0; i < this.data.splines.position.points.length; i++) {
                let zpos = this.data.splines.position.points[i].z - this.data.splines.position.points[0].z;
                let xcen = -this.data.splines.position.points[i].x * range;
                let ycen = this.data.splines.position.points[i].y * range;
                let xrad = this.data.splines.radius.points[i].x * range;
                let yrad = this.data.splines.radius.points[i].y * range;
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
            circleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(circlePositions, 3));
            circleGeometry.setAttribute('color', new THREE.Float32BufferAttribute(circleColor, 3));

            let circleMaterial = new THREE.LineBasicMaterial({
                vertexColors: THREE.VertexColors,
                clippingPlanes: [this.clippingPlane]
            });
            this.plot = new THREE.LineSegments(circleGeometry, circleMaterial);
        }
        this.tubeGroup.add(this.plot);
        this.plot.rotateY(Math.PI);
    }

    drawDisk() {
        let circleGeometry = new THREE.CircleGeometry(0.5, 16);
        let circleMaterial = new THREE.MeshBasicMaterial({color: 0xff0000, opacity: 0.8});
        this.disk = new THREE.Mesh(circleGeometry, circleMaterial);
        this.scene.add(this.disk);
        this.disk.visible = false;
    }

    drawDiskForRotationCenter() {
        let circleGeometry = new THREE.CircleGeometry(0.5, 16);
        let circleMaterial = new THREE.MeshBasicMaterial({color: 0xffff00, opacity: 0.8});
        this.diskRotation = new THREE.Mesh(circleGeometry, circleMaterial);
        this.scene.add(this.diskRotation);
        this.diskRotation.visible = false;
    }

    drawComment() {
        this.commentList = [];
        let filename = DataStore.getFileName(this.id);
        let comments = dataLib.getDataFromLocalStorage('privateComment');

        let planeSize = 2;
        let gridSize = TimeTubesStore.getGridSize();
        let planePositions = [], planeColors = [];
        for (let id in comments) {
            if (comments[id].fileName === filename) {
                this.commentList.push(id);
                let color = new THREE.Color(Number(comments[id].labelColor));
                // first triangle
                planePositions.push(gridSize + planeSize + 1);
                planePositions.push(gridSize);
                planePositions.push(comments[id].start - this.data.meta.min.z);
                planeColors.push(color.r, color.g, color.b);

                planePositions.push(gridSize + 1);
                planePositions.push(gridSize);
                planePositions.push(comments[id].start - this.data.meta.min.z);
                planeColors.push(color.r, color.g, color.b);

                planePositions.push(gridSize + planeSize + 1);
                planePositions.push(gridSize - planeSize);
                planePositions.push(comments[id].start - this.data.meta.min.z);
                planeColors.push(color.r, color.g, color.b);

                // second triangle
                planePositions.push(gridSize + 1);
                planePositions.push(gridSize);
                planePositions.push(comments[id].start - this.data.meta.min.z);
                planeColors.push(color.r, color.g, color.b);

                planePositions.push(gridSize + planeSize + 1);
                planePositions.push(gridSize - planeSize);
                planePositions.push(comments[id].start - this.data.meta.min.z);
                planeColors.push(color.r, color.g, color.b);

                planePositions.push(gridSize + 1);
                planePositions.push(gridSize - planeSize);
                planePositions.push(comments[id].start - this.data.meta.min.z);
                planeColors.push(color.r, color.g, color.b);
            }
        }
        let planeGeometry = new THREE.BufferGeometry();
        planeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(planePositions, 3));
        planeGeometry.setAttribute('color', new THREE.Float32BufferAttribute(planeColors, 3));
        let planeMaterial = new THREE.MeshBasicMaterial({
            vertexColors: THREE.VertexColors,
            side: THREE.DoubleSide,
            clippingPlanes: [this.clippingPlane]
        });
        this.comment = new THREE.Mesh(planeGeometry, planeMaterial);
        this.tubeGroup.add(this.comment);
        this.comment.rotateY(Math.PI);

        this.commentContents = new TextSprite({
            material: {
                color: 0xffffff,
            },
            redrawInterval: 250,
            textSize: 1.3,
            texture: {
                fontFamily: 'Arial, Helvetica, sans-serif',
                fontStyle: 'italic',
                text: '',
                align: 'left',
            },
        });
        this.scene.add(this.commentContents);
        this.commentContents.position.set(-gridSize, gridSize, 0);
        // this.commentContents.visible = false;
    }

    drawPeriodMarker() {
        let gridSize = TimeTubesStore.getGridSize();
        // green text for a start marker
        this.periodStartMarker = new TextSprite({
            material: {
                color: 0x00ff00,
                clippingPlanes: [this.clippingPlane]
            },
            redrawInterval: 250,
            textSize: 1.3,
            texture: {
                fontFamily: 'Arial, Helvetica, sans-serif',
                fontStyle: 'italic',
                text: 'start',
                align: 'left',
            },
        });
        this.periodStartMarker.position.set(gridSize + 1, gridSize + 1, 0);
        // red text for an end marker
        this.periodEndMarker = new TextSprite({
            material: {
                color: 0xff0000,
                clippingPlanes: [this.clippingPlane]
            },
            redrawInterval: 250,
            textSize: 1.3,
            texture: {
                fontFamily: 'Arial, Helvetica, sans-serif',
                fontStyle: 'italic',
                text: 'end',
                align: 'left',
            },
        });
        this.periodEndMarker.position.set(gridSize + 1, gridSize + 1, 0);
        // a tube to show the length of the period
        let curve = new THREE.LineCurve3(
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, -1)
        );
        let tubeGeometry = new THREE.TubeBufferGeometry(curve, 1, 0.5, 16, false);
        let tubeMaterial = new THREE.MeshBasicMaterial({
            color: 0x0000ff,
            clippingPlanes: [this.clippingPlane]
        });
        this.periodTube = new THREE.Mesh(tubeGeometry, tubeMaterial);

        this.periodGroup = new THREE.Group();
        this.periodGroup.add(this.periodStartMarker);
        this.periodGroup.add(this.periodEndMarker);
        this.periodGroup.add(this.periodTube);

        this.periodGroup.visible = false;

        this.scene.add(this.periodGroup);
        // this.scene.add(this.periodStartMarker);
        // this.scene.add(this.periodEndMarker);
        // this.scene.add(this.periodTube);
    }

    updateComment() {
        this.commentList = [];
        let filename = DataStore.getFileName(this.id);
        let comments = dataLib.getDataFromLocalStorage('privateComment');

        let planeSize = 2;
        let gridSize = TimeTubesStore.getGridSize();
        let planePositions = [], planeColors = [];
        for (let id in comments) {
            if (comments[id].fileName === filename) {
                this.commentList.push(id);
                let color = new THREE.Color(Number(comments[id].labelColor));

                // first triangle
                planePositions.push(gridSize + planeSize + 1);
                planePositions.push(gridSize);
                planePositions.push(comments[id].start - this.data.meta.min.z);
                planeColors.push(color.r, color.g, color.b);

                planePositions.push(gridSize + 1);
                planePositions.push(gridSize);
                planePositions.push(comments[id].start - this.data.meta.min.z);
                planeColors.push(color.r, color.g, color.b);

                planePositions.push(gridSize + planeSize + 1);
                planePositions.push(gridSize - planeSize);
                planePositions.push(comments[id].start - this.data.meta.min.z);
                planeColors.push(color.r, color.g, color.b);

                // second triangle
                planePositions.push(gridSize + 1);
                planePositions.push(gridSize);
                planePositions.push(comments[id].start - this.data.meta.min.z);
                planeColors.push(color.r, color.g, color.b);

                planePositions.push(gridSize + planeSize + 1);
                planePositions.push(gridSize - planeSize);
                planePositions.push(comments[id].start - this.data.meta.min.z);
                planeColors.push(color.r, color.g, color.b);

                planePositions.push(gridSize + 1);
                planePositions.push(gridSize - planeSize);
                planePositions.push(comments[id].start - this.data.meta.min.z);
                planeColors.push(color.r, color.g, color.b);
            }
        }
        this.comment.geometry.attributes.position.needsUpdate = true;
        this.comment.geometry.attributes.position = new THREE.Float32BufferAttribute(planePositions, 3);
        this.comment.geometry.attributes.color.needsUpdate = true;
        this.comment.geometry.attributes.color = new THREE.Float32BufferAttribute(planeColors, 3);


        this.commentContents.visible = false;

        this.renderer.render(this.scene, this.camera);
    }

    initQBEView() {
        this.QBECamera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
        this.QBECamera.position.z = 50;
        this.QBERenderer = new THREE.WebGLRenderer();
        // this.QBERenderer.setSize(500, 500);
        // this.QBERenderer.setClearColor("#000000");
        // this.QBERenderer.localClippingEnabled = false;
        // this.QBERenderer.domElement.id = 'QBE_viewport_' + this.id;
        // this.QBERenderer.domElement.className = 'TimeTubes_viewport';
        // this.QBERenderer.render(this.scene, this.QBECamera);
    }

    setQBEView() {
        let dom = document.getElementById('QBESourceTTCanvas');//'QBE_viewport_' + this.id);
        if (this.visualQuery) {
            this.QBECamera.lookAt(this.scene.position);
            this.QBECamera.far = this.camera.far;
            let sourcePadding = 15 * 2;
            if (Number($('#QBESource').css('padding-left'))) {
                sourcePadding = Number($('#QBESource').css('padding-left').replace('px', '')) * 2;
            } else if (Number($('#QBESource').css('padding'))) {
                sourcePadding = Number($('#QBESource').css('padding').replace('px', '')) * 2;
            }
            // let QBESourceWidth = $('#QBESource').outerWidth(true) - (sourcePadding >= 0? sourcePadding: 0);
            // this.QBERenderer.localClippingEnabled = true;
            // this.QBERenderer.setSize(QBESourceWidth, QBESourceWidth);
            if (dom != null) {
                dom.style.display = 'block';
            // } else {
                // let canvas = document.getElementById('QBESourceTT');
                let onMouseWheel = this.onMouseWheel();
                let onMouseDown = this.onMouseDown();
                let onMouseMove = this.onMouseMove();
                let onMouseUp = this.onMouseUp();
                let onMouseClick = this.onMouseClick();
                // canvas.appendChild(this.QBERenderer.domElement);
                dom.addEventListener('wheel', onMouseWheel.bind(this), false);
                dom.addEventListener('mousedown', onMouseDown.bind(this), false);
                dom.addEventListener('mousemove', onMouseMove.bind(this), false);
                dom.addEventListener('mouseup', onMouseUp.bind(this), false);
                dom.addEventListener('click', onMouseClick.bind(this), false);
                this.QBEControls = new OrbitControls(this.QBECamera, this.renderer.domElement);
                this.QBEControls.position0.set(0, 0, 50);
                this.QBEControls.screenSpacePanning = false;
                this.QBEControls.enableZoom = false;
            }
        } else {
            if (dom != null) {
                dom.style.display = 'none';
            }
        }
    }

    updateColorEncodingOptionHue() {
        this.tube.geometry.colorsNeedUpdate = true;
        this.tube.geometry.attributes.colorData.needsUpdate = true;
        
        let divNumHue = this.tube.geometry.attributes.colorData.array.length / (3 * this.segment * this.tubeNum);
        let hue;
        switch (this.colorEncodingOption.hue) {
            case 'default':
                hue = this.data.splines.hue.getSpacedPoints(divNumHue);
                for (let i = 0; i < this.tubeNum; i++) {
                    for (let j = 0; j < divNumHue * this.segment; j++) {
                        this.tube.geometry.attributes.colorData.array[divNumHue * this.segment * 3 * i + 3 * j] = hue[Math.floor(j / this.segment)].x;
                    }
                }
                this.tube.material.uniforms.minmaxH.value = new THREE.Vector2(this.data.meta.min.H, this.data.meta.max.H);
                break;
            case 'histogramEqualization':
                hue = this.data.hueValRanks.hue.getSpacedPoints(divNumHue);
                for (let i = 0; i < this.tubeNum; i++) {
                    for (let j = 0; j < divNumHue * this.segment; j++) {
                        this.tube.geometry.attributes.colorData.array[divNumHue * this.segment * 3 * i + 3 * j] = hue[Math.floor(j / this.segment)].y;
                    }
                }
                this.tube.material.uniforms.minmaxH.value = new THREE.Vector2(this.data.hueValRanks.minmaxHue.min, this.data.hueValRanks.minmaxHue.max);
                break;
            default:
                break;
        }
        this.renderer.render(this.scene, this.camera);
    }

    updateColorEncodingOptionValue() {
        this.tube.geometry.colorsNeedUpdate = true;
        this.tube.geometry.attributes.colorData.needsUpdate = true;
        
        let divNumValue = this.tube.geometry.attributes.colorData.array.length / (3 * this.segment * this.tubeNum);
        let value;
        switch (this.colorEncodingOption.value) {
            case 'default':
                value = this.data.splines.value.getSpacedPoints(divNumValue);
                for (let i = 0; i < this.tubeNum; i++) {
                    for (let j = 0; j < divNumValue * this.segment; j++) {
                        this.tube.geometry.attributes.colorData.array[divNumValue * this.segment * 3 * i + 3 * j + 1] = value[Math.floor(j / this.segment)].y;
                    }
                }
                this.tube.material.uniforms.minmaxV.value = new THREE.Vector2(this.data.meta.min.V, this.data.meta.max.V);
                break;
            case 'histogramEqualization':
                value = this.data.hueValRanks.value.getSpacedPoints(divNumValue);
                for (let i = 0; i < this.tubeNum; i++) {
                    for (let j = 0; j < divNumValue * this.segment; j++) {
                        this.tube.geometry.attributes.colorData.array[divNumValue * this.segment * 3 * i + 3 * j + 1] = value[Math.floor(j / this.segment)].y;
                    }
                }
                this.tube.material.uniforms.minmaxV.value = new THREE.Vector2(this.data.hueValRanks.minmaxValue.min, this.data.hueValRanks.minmaxValue.max);
                break;
            default:
                break;
        }
        this.renderer.render(this.scene, this.camera);
    }

    showClusteringResults (subsequences, labels, colors) {
        if (this.clusteringGroup) {
            for (let i = 0; i < this.clusteringGroup.children.length; i++) {
                let geometry = this.clusteringGroup.children[i].geometry,
                    material = this.clusteringGroup.children[i].material;
                this.scene.remove(this.clusteringGroup.children[i]);
                geometry.dispose();
                material.dispose();
            }
        }
        this.clusteringGroup = new THREE.Group();
        this.scene.add(this.clusteringGroup);
        let cubeSize = TimeTubesStore.getGridSize() * 2;
        cubeSize = Math.sqrt(cubeSize * cubeSize / 2);
        let materials = [];
        for (let i = 0; i < colors.length; i++) {
            materials.push(new THREE.MeshBasicMaterial({
                color: new THREE.Color('hsl(' + colors[i][0] + ',' + (colors[i][1] * 100) + '%,' + (colors[i][2] * 100) + '%)'),
                transparent: true,
                opacity: 0.3,
                clippingPlanes: [this.clippingPlane]
            }));
        }
        for (let i = 0; i < subsequences.length; i++) {
            if (Number(subsequences[i].id) === this.id) {
                let cubeDepth = subsequences[i][subsequences[i].length - 1].z - subsequences[i][0].z;
                let cubeSSGeometry = new THREE.CylinderBufferGeometry(cubeSize, cubeSize, cubeDepth, 4);
                let cluster = (typeof(labels[i]) === 'object'? labels[i].cluster: labels[i]);
                let cubeSSMesh = new THREE.Mesh(cubeSSGeometry, materials[cluster]);
                cubeSSMesh.rotateZ(Math.PI / 4);
                cubeSSMesh.rotateX(Math.PI / 2);
                cubeSSMesh.position.z = subsequences[i][0].z - this.data.meta.min.z + cubeDepth / 2;
                this.clusteringGroup.add(cubeSSMesh);
            }
        }

        this.clusteringGroup.rotateY(Math.PI);
    }

    initClusteringResultsView() {
        let fov = 45, far = 2000;
        let depth = Math.tan(fov / 2.0 * Math.PI / 180.0) * 2;
        let aspect = 1;
        let size_y = depth * (50);
        let size_x = depth * (50) * aspect;
        this.ClusteringCamera = new THREE.OrthographicCamera(
            -size_x / 2, size_x / 2,
            size_y / 2, -size_y / 2, 0.1,
            far);//new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
        this.ClusteringCamera.position.z = 50;
        this.ClusteringCamera.lookAt(this.scene.position);
        // this.ClusteringRenderer = new THREE.WebGLRenderer();
        // this.ClusteringRenderer.setSize(150, 150);
        // this.ClusteringRenderer.setClearColor('#000000');
        // this.ClusteringRenderer.localClippingEnabled = false;
        // this.ClusteringRenderer.domElement.id = 'clusteringResultsSubsequence_' + this.id;
        // this.ClusteringRenderer.domElement.className = 'clusteringResultsSubsequence';
        // this.ClusteringRenderer.domElement.style.display = 'none';
        // this.ClusteringClippingPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        // 各データに関してclusteringrendererが作られるから、選択されたデータ点に応じて表示非表示を切り替える
    }

    setClusteringResultsView() {
        // let dom = document.getElementById('tooltipClusteringResultsSubsequencesTTView');
        // if (dom) {
        //     // dom.appendChild(this.renderer.domElement);
        //     let context = dom.getContext('2d');
        //     context.drawImage(this.renderer.domElement, 0, 0, 200, 200);
        // }
    }

    showSelectedSSClusteringResultsView(period) {
        // Array.from(document.getElementsByClassName('clusteringResultsSubsequence')).forEach(ele => {
        //     ele.style.display = 'none';
        // });
        // document.getElementById('clusteringResultsSubsequence_' + this.id).style.display = 'block';
        // this.ClusteringClippingPlane.constant = period[1] - period[0];// - this.data.spatial[0].z;
        // this.ClusteringRenderer.localClippingEnabled = true;
        // this.ClusteringRenderer.clippingPlanes = [this.ClusteringClippingPlane];
//         var vFOV = THREE.MathUtils.degToRad( this.camera.fov ); // convert vertical fov to radians

        this.clippingPlane2.constant = period[1] - period[0];
        this.renderer.clippingPlanes = [this.clippingPlane2];
        this.tubeGroup.position.z = period[0] - this.data.spatial[0].z;
        // if (this.ClusteringRenderer) this.ClusteringRenderer.render(this.scene, this.ClusteringCamera);
    }

    showSelectedSSInComparisonPanel(period, SSId) {
        let view = {};
        let fov = 45, far = 2000;
        let depth = Math.tan(fov / 2.0 * Math.PI / 180.0) * 2;
        let aspect = 1;
        let size_y = depth * (50);
        let size_x = depth * (50) * aspect;
        let camera = new THREE.OrthographicCamera(
            -size_x / 2, size_x / 2,
            size_y / 2, -size_y / 2, 0.1,
            far
        );
        view.period = period;
        view.SSId = SSId;
        view.camera = camera;
        this.subsequencesInComparisonPanel.push(view);
    }
}
