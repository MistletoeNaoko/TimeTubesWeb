import * as ClusteringAction from '../Actions/ClusteringAction';
import * as FeatureAction from '../Actions/FeatureAction';
import {selectMenu} from '../Actions/AppAction';
import {showTimeTubesOfTimeSlice} from '../Actions/TimeTubesAction';
import * as domActions from '../lib/domActions';
import React from 'react';
import DataStore from '../Stores/DataStore';
import ClusteringStore from '../Stores/ClusteringStore';
import TimeTubesStore from '../Stores/TimeTubesStore';
import AppStore from '../Stores/AppStore';
import FeatureStore from '../Stores/FeatureStore';
import BufferGeometryUtils from '../lib/BufferGeometryUtils';
import OrbitControls from "three-orbitcontrols";
import * as THREE from 'three';
import * as d3 from 'd3';
import * as MeshLine from 'three.meshline'

// import TextSprite from 'three.textsprite';
import TextSprite from '@seregpie/three.text-sprite';
import {formatValue} from '../lib/2DGraphLib';
import { before } from 'lodash';

d3.selection.prototype.moveToFront =
    function() {
        return this.each(function(){this.parentNode.appendChild(this);});
    };
d3.selection.prototype.moveToBack = function() {  
    return this.each(function() { 
        var firstChild = this.parentNode.firstChild; 
        if (firstChild) { 
            this.parentNode.insertBefore(this, firstChild); 
        } 
    });
};

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
        this.minGridSize = 3;
        this.tubeGroups = [];
        this.splines = [];
        this.opacityCurve = TimeTubesStore.getOpacityCurve('Default');
        this.vertex = document.getElementById('vertexShader_tube').textContent;
        this.fragment = document.getElementById('fragmentShader_tube').textContent;
        this.raycaster = new THREE.Raycaster();
        this.clusterCenters = [];
        this.clusterColors = [];
        this.tubeCoords = [];
        this.gridSize = undefined;
        this.selectedCluster = undefined;
        this.clusterRadiuses = undefined;
        this.update2DGraphsFlag = false;
        this.queryMode = FeatureStore.getMode();
        this.clickedX;
        this.clickedY;
        this.chartsSize = {
            MDS: {width: 0.75, height: 1},
            barChart: {width: 0.25, height: 1},
            elbowLineChart: {width: 0, height: 0},
            featureHeatmap: {width: 0, height: 0}
        };
        this.correlationPathGroupLeft;
        this.correlationPathGroupRight;
        this.state = {
            clusteringScores: {},
            interclusterTransitions: {left: false, right: false}
        };
    }

    componentDidMount() {
        const width = $('#clusteringResultsOverview').width();//this.mount.clientWidth;
        let appHeaderHeight = $('#appHeader').outerHeight(true);
        const height = $('#clusteringResultsOverview').height() - appHeaderHeight;
        this.scene = new THREE.Scene();

        this.setCameras(width, height);

        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setClearColor(new THREE.Color(Number(TimeTubesStore.getBackgroundColor())));
        this.renderer.setSize(width, height);
        this.renderer.localClippingEnabled = true;
        this.renderer.domElement.id = 'clusteringResultsViewport';
        this.canvas = document.getElementById('clusteringOverviewTimeTubesCanvas');//this.renderer.domElement;

        // this.mount.appendChild(this.renderer.domElement);
        // document.getElementById('clusteringOverviewTimeTubes').appendChild(this.renderer.domElement);

        this.renderScene();
        this.start();

        // this.initDetailView();

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
        AppStore.on('selectMenu', (menu) => {
            if (menu === 'feature') {
                if ($('#clusteringResults').length) {
                    this.setRendererSize();
                    this.setMDSScatterplotsSize();
                }
            }
        });
        AppStore.on('resizeExtractionResultsArea', () => {
            if ($('#clusteringResults').length) {
                this.setRendererSize();
                this.setMDSScatterplotsSize();
            }
        });
        ClusteringStore.on('showClusteringResults', () => {
            this.clusterCenters = ClusteringStore.getClusterCenters();
            this.subsequences = ClusteringStore.getSubsequences();
            this.SSLabels = ClusteringStore.getLabels();
            this.clusterColors = ClusteringStore.getClusterColors();
            this.selectedCluster = undefined;
            this.update2DGraphsFlag = true;
            let clusteringScores = ClusteringStore.getClusteringScores();
            // this.setRendererSize();
            // this.computeSplines();
            // this.computeTubePositions();
            // this.drawClusterCentersAsTubes();
            // this.drawClusterRadiusesAsRings(clusteringScores.clusterRadiuses);
            // this.showClusteringParameters();
            // this.resetDetailView();
            // this.drawMDSScatterplots();
            // this.drawClustersSummaryStuckedBarChart();
            // this.drawSilhouetteBarChart();
            this.setState({
                clusteringScores: clusteringScores
            });
        });
        ClusteringStore.on('showClusterDetails', (cluster) => {
            this.selectedCluster = cluster;
            this.setCameraDetail();
            this.setDetailView(cluster);
        });
        ClusteringStore.on('updateClusteringResults', () => {
            this.clusterCenters = ClusteringStore.getClusterCenters();
            this.subsequences = ClusteringStore.getSubsequences();
            this.SSLabels = ClusteringStore.getLabels();
            this.selectedCluster = undefined;
            this.update2DGraphsFlag = true;
            let clusteringScores = ClusteringStore.getClusteringScores();
            // this.setRendererSize();
            // this.computeSplines();
            // this.computeTubePositions();
            // this.drawClusterCentersAsTubes();
            // this.drawClusterRadiusesAsRings(clusteringScores.clusterRadiuses);
            // this.showClusteringParameters();
            // this.resetDetailView();
            // this.drawMDSScatterplots();
            // this.drawClustersSummaryStuckedBarChart();
            // this.drawSilhouetteBarChart();
            this.setState({
                clusteringScores: clusteringScores
            });
        });
        ClusteringStore.on('resetClusteringResults', () => {
            this.clusterCenters = ClusteringStore.getClusterCenters();
            this.subsequences = ClusteringStore.getSubsequences();
            this.SSLabels = ClusteringStore.getLabels();
            this.selectedCluster = undefined;
            this.update2DGraphsFlag = true;
            let clusteringScores = ClusteringStore.getClusteringScores();
            // this.setRendererSize();
            // this.computeSplines();
            // this.computeTubePositions();
            // this.drawClusterCentersAsTubes();
            // this.drawClusterRadiusesAsRings(clusteringScores.clusterRadiuses);
            // this.showClusteringParameters();
            // this.resetDetailView();
            // this.drawMDSScatterplots();
            // this.drawClustersSummaryStuckedBarChart();
            // this.drawSilhouetteBarChart();
            this.setState({
                clusteringScores: clusteringScores
            });
        });
        ClusteringStore.on('recoverClusteringSession', () => {
            this.clusterCenters = ClusteringStore.getClusterCenters();
            this.subsequences = ClusteringStore.getSubsequences();
            this.SSLabels = ClusteringStore.getLabels();
            this.clusterColors = ClusteringStore.getClusterColors();
            this.selectedCluster = undefined;
            this.update2DGraphsFlag = true;
            let clusteringScores = ClusteringStore.getClusteringScores();
            this.setState({
                clusteringScores: clusteringScores
            });
        });
    }

    componentDidUpdate() {
        if (this.update2DGraphsFlag) {
            let clusteringScores = ClusteringStore.getClusteringScores();
            this.setRendererSize();
            this.computeSplines();
            this.computeTubePositions();
            this.drawClusterCentersAsTubes();
            this.drawClusterRadiusesAsRings(clusteringScores.clusterRadiuses);
            this.drawInterClusterTransitionLink();
            this.showClusteringParameters();
            this.resetDetailView();
            this.drawMDSScatterplots();
            this.drawClustersSummaryStuckedBarChart();
            this.drawSilhouetteBarChart();
            this.drawElbowMethodLineChart();
            this.drawFeatureHeatmap();
            this.update2DGraphsFlag = false;
        }
    }

    render() {
        let width = $('#clusteringResultsOverview').width();
        let appHeaderHeight = $('#appHeader').outerHeight(true);
        let timelineHeight = $('#clusteringTimeline').outerHeight(true);
        let height = window.innerHeight - appHeaderHeight - timelineHeight;
        let clusterRadRows = [];
        if (this.state.clusteringScores.clusterRadiuses) {
            for (let i = 0; i < this.state.clusteringScores.clusterRadiuses.length; i++) {
                clusterRadRows.push(
                    <tr key={i}>
                        <td>
                            Cluster {i}
                        </td>
                        <td>
                            {formatValue(this.state.clusteringScores.clusterRadiuses[i])}
                        </td>
                    </tr>
                );
            }
            
        }
        let overviewArea2d;
        let clusteringParameters = ClusteringStore.getClusteringParameters(),
            subsequenceParameters = ClusteringStore.getSubsequenceParameters();
        if (Object.keys(clusteringParameters).length > 0) {
            if (subsequenceParameters.normalize && !Array.isArray(clusteringParameters.elbow)) {
                // show two charts (MDS, bar charts)
                overviewArea2d = (
                    <div className='container'>
                        <div className='row'>
                            <div className='col-9'
                                id='clusteringOverviewMDSScatterplots'>
                            </div>
                            <div className='col-3'
                                id='silhouetteBarChart'>
                            </div>
                        </div>
                    </div>
                );
                this.chartsSize = {
                    MDS: {width: 0.75, height: 1},
                    barChart: {width: 0.25, height: 1},
                    elbowLineChart: {width: 0, height: 0},
                    featureHeatmap: {width: 0, height: 0}
                };
            } else if (!subsequenceParameters.normalize && !Array.isArray(clusteringParameters.elbow)) {
                // show three charts (MDS, bar charts, heatmap)
                overviewArea2d = (
                    <div className='container'>
                        <div className='row'>
                            <div className='col-9'
                                id='clusteringOverviewMDSScatterplots'>
                            </div>
                            <div className='col-3'>
                                <div id='silhouetteBarChart'> 
                                </div>
                                <div id='clusterFeatureHeatmap'>
                                </div>
                            </div>
                        </div>
                    </div>
                );
                this.chartsSize = {
                    MDS: {width: 0.75, height: 1},
                    barChart: {width: 0.25, height: 0.75},
                    elbowLineChart: {width: 0, height: 0},
                    featureHeatmap: {width: 0.25, height: 0.25}
                };
            } else if (subsequenceParameters.normalize && Array.isArray(clusteringParameters.elbow)) {
                // show three charts (MDS, bar charts, cost)
                overviewArea2d = (
                    <div className='container'>
                        <div className='row'>
                            <div className='col-9'
                                id='clusteringOverviewMDSScatterplots'>
                            </div>
                            <div className='col-3'>
                                <div id='silhouetteBarChart'> 
                                </div>
                                <div id='elbowMethodLineChart'>
                                </div>
                            </div>
                        </div>
                    </div>
                );
                this.chartsSize = {
                    MDS: {width: 0.75, height: 1},
                    barChart: {width: 0.25, height: 0.75},
                    elbowLineChart: {width: 0.25, height: 0.25},
                    featureHeatmap: {width: 0, height: 0}
                };
            } else if (!subsequenceParameters.normalize && Array.isArray(clusteringParameters.elbow)) {
                // show four charts (MDS, bar charts, heatmap, cost)
                overviewArea2d = (
                    <div className='container'>
                        <div className='row'>
                            <div className='col-9'
                                id='clusteringOverviewMDSScatterplots'>
                            </div>
                            <div className='col'
                                id='silhouetteBarChart'>
                            </div>
                        </div>
                        <div className='row'>
                            <div className='col-6'
                                id='clusterFeatureHeatmap'>
                            </div>
                            <div className='col-6'
                                id='elbowMethodLineChart'>
                            </div>
                        </div>
                    </div>
                );
                this.chartsSize = {
                    MDS: {width: 0.75, height: 0.75},
                    barChart: {width: 0.25, height: 0.75},
                    elbowLineChart: {width: 0.5, height: 0.25},
                    featureHeatmap: {width: 0.5, height: 0.25}
                };
            }
        }
        return (
            <div id='clusteringOverview' 
                className='clusteringPanel'
                style={{height: window.innerHeight - $('#appHeader').outerHeight(true)}}
                ref={mount => {
                    this.mount = mount;
                }}>
                <div id='clusteringOverviewCarousel' className='carousel slide'  data-ride="carousel" data-interval="false" data-pause="hover">
                    <div className="carousel-inner">
                        <div id='clusteringOverviewTimeTubes' 
                            className="carousel-item active"
                            style={{height: height + 'px'}}>
                            <div className="form-group form-inline">
                                <h6>Intercluster transitions</h6>
                                <div className="custom-control custom-switch interClusterTransitions" onChange={this.onSwitchInterclusterTransLeft.bind(this)}>
                                    <input type="checkbox" className="custom-control-input" id="interclusterTransLeft" checked={this.state.interclusterTransitions.left}/>
                                    <label className="custom-control-label" htmlFor="interclusterTransLeft">Before</label>
                                </div>
                                <div className="custom-control custom-switch interClusterTransitions" onChange={this.onSwitchInterclusterTransRight.bind(this)}>
                                    <input type="checkbox" className="custom-control-input" id="interclusterTransRight" checked={this.state.interclusterTransitions.right}/>
                                    <label className="custom-control-label" htmlFor="interclusterTransRight">After</label>
                                </div>
                            </div>
                            <canvas id='clusteringOverviewTimeTubesCanvas'
                                width='2000' height='2000'
                                style={{width: width + 'px', height: height + 'px', position: 'absolute'}}></canvas>
                            <div id='clusteringParameters'>
                                <details>
                                    <summary>Clustering parameters</summary>
                                    <table id='clusteringParametersTable'>
                                        <tbody>
                                            <tr key='clusteringMethod'>
                                                <td>Method</td>
                                                <td id='clusteringTableMethod'
                                                    className='parametersValues'></td>
                                            </tr>
                                            <tr key='clusterNumber'>
                                                <td>Cluster number</td>
                                                <td id='clusteringTableClusterNumber'
                                                    className='parametersValues'></td>
                                            </tr>
                                            <tr key='clusteringVariables'>
                                                <td>Variables</td>
                                                <td id='clusteringTableVariables'
                                                    className='parametersValues'></td>
                                            </tr>
                                            <tr key='distanceMetric'>
                                                <td>Distance metric</td>
                                                <td id='clusteringTableDistanceMetric'
                                                    className='parametersValues'></td>
                                            </tr>
                                            <tr>
                                                <td>Subsequence period</td>
                                                <td id='subsequenceTablePeriod'
                                                    className='parametersValues'></td>
                                            </tr>
                                            <tr>
                                                <td>Normalization</td>
                                                <td id='subsequenceTableNormalization'
                                                    className='parametersValues'></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </details>
                            </div>
                            <div id='clusteringOverviewRightTables'>
                                <div id='clusteringScores'>
                                    <details>
                                        <summary>Performance evaluation</summary>
                                        <table id='clusteringScoresTable'>
                                            <tbody>
                                                <tr>
                                                    <td>Pseudo F</td>
                                                    <td id='pseudoFValue'
                                                        className='clusteringScoresValues'>
                                                        {typeof(this.state.clusteringScores.pseudoF) !== 'undefined'? formatValue(this.state.clusteringScores.pseudoF): ''}
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td>Silhouette coefficient</td>
                                                    <td id='silhouetteValue'
                                                        className='clusteringScoresValues'>
                                                        {typeof(this.state.clusteringScores.silhouette) !== 'undefined'? formatValue(this.state.clusteringScores.silhouette): ''}
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td>Davis Bouldin index</td>
                                                    <td id='davisBouldinValue'
                                                        className='clusteringScoresValues'>
                                                        {typeof(this.state.clusteringScores.davisBouldin) !== 'undefined'? formatValue(this.state.clusteringScores.davisBouldin): ''}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </details>
                                </div>
                                <div id='clusterRadiuses'>
                                    <details>
                                        <summary>Cluster radiuses</summary>
                                        <table id='clusterRadiusesTable'>
                                            <tbody>
                                                {clusterRadRows}
                                            </tbody>
                                        </table>
                                    </details>
                                </div>
                            </div>
                        </div>
                        <div id='clusteringOverview2DCharts' 
                            className="carousel-item resultAreaElemNoPadding">
                            {overviewArea2d}
                        </div>
                    </div>
                    <a className="carousel-control-prev" 
                        id='carouselControlPrevClusteringOverview'
                        href="#clusteringOverviewCarousel" 
                        role="button" 
                        data-slide="prev"
                        style={{top: height / 2 - 50 / 2}}>
                        <span className="carousel-control-prev-icon" aria-hidden="true"></span>
                        {/* <span className="visually-hidden">Previous</span> */}
                    </a>
                    <a className="carousel-control-next" 
                        id='carouselControlNextClusteringOverview'
                        href="#clusteringOverviewCarousel" 
                        role="button" 
                        data-slide="next"
                        style={{top: height / 2 - 50 / 2}}>
                        <span className="carousel-control-next-icon" aria-hidden="true"></span>
                        {/* <span className="visually-hidden">Next</span> */}
                    </a>
                </div>
            </div>
        );
    }

    showClusteringParameters() {
        let clusteringParameters = ClusteringStore.getClusteringParameters();
        if (Object.keys(clusteringParameters).length > 0) {
            $('#clusteringTableMethod').text(clusteringParameters.method);
            $('#clusteringTableClusterNumber').text(clusteringParameters.clusterNum);
            // variables
            let labels = '';
            for (let i = 0; i < clusteringParameters.variables.length; i++) {
                labels += $('label[for="clusteringVaribales_' + clusteringParameters.variables[i] + '"]').text() + ', ';
            }
            labels = labels.slice(0, -2);
            $('#clusteringTableVariables').text(labels);
            $('#clusteringTableDistanceMetric').text(clusteringParameters.distanceMetric);
        }

        let subsequenceParameters = ClusteringStore.getSubsequenceParameters();
        if (Object.keys(subsequenceParameters).length > 0) {
            $('#subsequenceTablePeriod').text(subsequenceParameters.SSperiod[0] + '-' + subsequenceParameters.SSperiod[1] + ' days');
            $('#subsequenceTableNormalization').text(subsequenceParameters.normalize);
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
        // if (this.renderer) this.renderer.render(this.scene, this.camera);
        this.renderClusteringOverviewRenderer();
        if (typeof(this.selectedCluster) !== 'undefined') this.renderClusteringDetailRenderer();
        // if (this.detailRenderer) this.detailRenderer.render(this.scene, this.cameraDetail);
    }

    renderClusteringOverviewRenderer() {
        let dom = document.getElementById('clusteringOverviewTimeTubesCanvas');
        if (dom) {
            let width = this.renderer.domElement.width,
                height = this.renderer.domElement.height;
            let context = dom.getContext('2d');
            this.renderer.render(this.scene, this.camera);
            context.drawImage(
                this.renderer.domElement,
                0, 0, width, height,
                0, 0, dom.width, dom.height
            );
        }
    }

    renderClusteringDetailRenderer() {
        let dom = document.getElementById('selectedClusterCenterTimeTubesCanvas');
        if (dom) {
            let width = this.renderer.domElement.width,
                height = this.renderer.domElement.height;
            let context = dom.getContext('2d');
            this.renderer.render(this.scene, this.cameraDetail);
            context.drawImage(
                this.renderer.domElement,
                0, 0, width, height,
                0, 0, dom.width, dom.height
            );
        }
    }
    
    setRendererSize() {
        const width = $('#clusteringResultsOverview').width();//this.mount.clientWidth;
        let appHeaderHeight = $('#appHeader').outerHeight(true);
        let timelineHeight = $('#clusteringTimeline').outerHeight(true);//40 * ClusteringStore.getDatasets().length + 16 + 2;
        const height = window.innerHeight - appHeaderHeight - timelineHeight;
        let canvas = document.getElementById('clusteringOverviewTimeTubesCanvas');
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
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
        this.camera = new THREE.OrthographicCamera(
            -size_x / 2, size_x / 2,
            size_y / 2, -size_y / 2, 0.1,
            far);
        this.camera.position.z = this.cameraPosZ;
        this.camera.lookAt(this.scene.position);
        this.renderer.render(this.scene, this.camera);
        this.addControls();
    }

    // initDetailView() {
    //     this.detailRenderer = new THREE.WebGLRenderer();
    //     this.detailRenderer.setSize(300, 300);
    //     this.detailRenderer.setClearColor('#000000');
    //     this.detailRenderer.domElement.id = 'selectedClusterCenterTimeTubes';
    // }

    setDetailView(cluster) {
        if (typeof(cluster) !== 'undefined' && $('#selectedClusterCenterTimeTubes').length) {
            let rendererSize = $('#selectedClusterCenterTimeTubes').width() - 16 * 2;
            $('#selectedClusterCenterTimeTubesCanvas').width(rendererSize);
            $('#selectedClusterCenterTimeTubesCanvas').height(rendererSize);
            // this.detailRenderer.setSize(rendererSize, rendererSize);
            // this.detailRenderer.domElement.id = 'selectedClusterCenterTimeTubesRenderer';
            let posX = this.tubeCoords[cluster].x;
            let posY = this.tubeCoords[cluster].y;
            this.cameraDetail.position.x = posX;
            this.cameraDetail.position.y = posY;
            this.cameraDetail.lookAt(posX, posY, 0);
            // let canvas = document.getElementById('selectedClusterCenterTimeTubes');
            // canvas.appendChild(this.detailRenderer.domElement);

            document.getElementById('selectedClusterCenterTimeTubesCanvas')
                .addEventListener('mousedown', this.onMouseDownClusterCenterTimeTubesRenderer().bind(this), false);
        }
    }

    onMouseDownClusterCenterTimeTubesRenderer() {
        return function(d) {
            this.queryMode = FeatureStore.getMode();
            if (this.queryMode === 'QBE' || this.queryMode === 'QBS') {
                let elem = d.target;
                elem.classList.add('drag');
                this.clickedX = d.pageX - elem.offsetLeft;
                this.clickedY = d.pageY - elem.offsetTop;
                document.body.addEventListener('mousemove', this.onMouseMoveClusterCenterTimeTubesRenderer().bind(this), false);
                elem.addEventListener('mouseup', this.onMouseUpClusterCenterTimeTubesRenderer().bind(this), false);
            }
        };
    }

    onMouseMoveClusterCenterTimeTubesRenderer() {
        return function(d) {
            let drag = document.getElementsByClassName('drag')[0];
            if (drag) {
                drag.style.position = 'absolute';
                d.preventDefault();

                drag.style.top = d.pageY - this.clickedY + 'px';
                drag.style.left = d.pageX - this.clickedX - drag.clientWidth / 2 - $('#extractionMenu').width() + 'px';

                switch(this.queryMode) {
                    case 'QBE':
                        let selectedTimeSlice = $('#selectedTimeSliceView');
                        let selectedTimeSlicePos = selectedTimeSlice.offset(),
                            selectedTimeSliceWidth = selectedTimeSlice.width(),
                            selectedTimeSliceHeight = selectedTimeSlice.height();
                        
                        if ((selectedTimeSlicePos.left <= d.pageX && d.pageX <= selectedTimeSlicePos.left + selectedTimeSliceWidth)
                        && (selectedTimeSlicePos.top <= d.pageY && d.pageY <= selectedTimeSlicePos.top + selectedTimeSliceHeight)) {
                            let overlayPanel = $('#selectedTimeSliceView > .overlayHidingPanel');
                            overlayPanel.css('display', 'block');
                            overlayPanel.css('width', Math.min(selectedTimeSliceWidth, selectedTimeSliceHeight));
                            overlayPanel.css('height', Math.min(selectedTimeSliceWidth, selectedTimeSliceHeight));
                        }
                        break;
                    case 'QBS':
                        let sketchPad = $('#QBSSketchPad');
                        let sketchPadPos = sketchPad.offset(),
                            sketchPadWidth = sketchPad.width(),
                            sketchPadHeight = sketchPad.innerHeight();

                        if ((sketchPadPos.left <= d.pageX && d.pageX <= sketchPadPos.left + sketchPadWidth)
                        && (sketchPadPos.top <= d.pageY && d.pageY <= sketchPadPos.top + sketchPadHeight)) {
                            let overlayPanel = $('#QBSCanvasArea > .overlayHidingPanel');
                            overlayPanel.css('display', 'block');
                            overlayPanel.css('width', Math.min(sketchPadWidth, sketchPadHeight));
                            overlayPanel.css('height', Math.min(sketchPadWidth, sketchPadHeight));
                        }
                        break;
                    default:
                        break;
                }
            }
        };
    }

    onMouseUpClusterCenterTimeTubesRenderer() {
        return function(d) {
            document.body.removeEventListener('mousemove', this.onMouseMoveClusterCenterTimeTubesRenderer().bind(this), false);

            let drag = document.getElementsByClassName('drag')[0];
            if (drag) {
                drag.removeEventListener('mouseup', this.onMouseUpClusterCenterTimeTubesRenderer.bind(this), false);
                drag.classList.remove('drag');
                drag.style.position = 'static';
            }
            let selectedCluster = ClusteringStore.getSelectedCluster();
            let clusteringParameters = ClusteringStore.getClusteringParameters(),
                subsequenceParameters = ClusteringStore.getSubsequenceParameters();
            switch(this.queryMode) {
                case 'QBE':
                    $('#selectedTimeSliceView > .overlayHidingPanel').css('display', 'none');
                    let selectedTimeSlice = $('#selectedTimeSliceView');
                    let selectedTimeSlicePos = selectedTimeSlice.offset(),
                        selectedTimeSliceWidth = selectedTimeSlice.width(),
                        selectedTimeSliceHeight = selectedTimeSlice.height();
                    if (selectedTimeSlicePos) {
                        if ((selectedTimeSlicePos.left <= d.pageX && d.pageX <= selectedTimeSlicePos.left + selectedTimeSliceWidth)
                        && (selectedTimeSlicePos.top <= d.pageY && d.pageY <= selectedTimeSlicePos.top + selectedTimeSliceHeight)) {
                            let values = {};
                            for (let i = 0; i < clusteringParameters.variables.length; i++) {
                                values[clusteringParameters.variables[i]] = [];
                            }
                            for (let i = 0; i < clusteringParameters.variables.length; i++) {
                                for (let j = 0; j < this.clusterCenters[selectedCluster].length; j++) {
                                    values[clusteringParameters.variables[i]].push(this.clusterCenters[selectedCluster][j][clusteringParameters.variables[i]]);
                                }
                            }
                            values.arrayLength = this.clusterCenters[selectedCluster].length;
                            
                            let clusterCenter = {
                                parameters: clusteringParameters,
                                values: values
                            };

                            // visual queryの設定パネルを設定
                            // normalization setting
                            if (subsequenceParameters.normalize) {
                                $('#NormalizeSwitch').prop('checked', true);
                                let normalizationList = document.getElementById('normalizationOptions');
                                for (let i = 0; i < normalizationList.options.length; i++) {
                                    if (normalizationList.options[i].value === 'zScore') {
                                        normalizationList.selectedIndex = i;
                                        break;
                                    }
                                }
                                $('#NormalizeSwitch').prop('disabled', true);
                                $('#normalizationOptions').prop('disabled', true);
                            }

                            // distance metric
                            switch(clusteringParameters.distanceMetric) {
                                case 'DTWD':
                                    FeatureAction.changeDTWMode('DTWD');
                                    // $('#DTWD').prop('checked', true);
                                    // $('#DTWI').prop('checked', false);
                                    break;
                                case 'DTWI':
                                    FeatureAction.changeDTWMode('DTWI');
                                    // $('#DTWI').prop('checked', true);
                                    // $('#DTWD').prop('checked', false);
                                    break;
                                case 'DTW':
                                    FeatureAction.changeDTWMode('DTWI');
                                    // $('#DTWI').prop('checked', true);
                                    // $('#DTWD').prop('checked', false);
                                    break;
                                default:
                                    break;
                            }
                            $('#warpingWindowSize').val(clusteringParameters.window);
                            
                            // set active variables
                            FeatureAction.setActiveVariables(clusteringParameters.variables);
                            FeatureAction.convertClusterCenterIntoQuery(clusterCenter);
                        }
                    }
                    break;
                case 'QBS':
                    $('#QBSCanvasArea > .overlayHidingPanel').css('display', 'none');
                    let sketchPad = $('#QBSSketchPad');
                    let sketchPadPos = sketchPad.offset(),
                        sketchPadWidth = sketchPad.width(),
                        sketchPadHeight = sketchPad.innerHeight();
                    if (sketchPadPos) {
                        if ((sketchPadPos.left <= d.pageX && d.pageX <= sketchPadPos.left + sketchPadWidth)
                        && (sketchPadPos.top <= d.pageY && d.pageY <= sketchPadPos.top + sketchPadHeight)) {
                            // convert the result into a new query
                            // FeatureAction.convertResultIntoQuery(this.result.id, [this.result.start, this.result.start + this.result.period], this.ignored);
                            // if ($('#resultDetailArea').css('display') === 'block') {
                            //     domActions.toggleExtractionDetailPanel();
                            // }
                            let values = {};
                            for (let i = 0; i < clusteringParameters.variables.length; i++) {
                                values[clusteringParameters.variables[i]] = [];
                            }
                            for (let i = 0; i < clusteringParameters.variables.length; i++) {
                                for (let j = 0; j < this.clusterCenters[selectedCluster].length; j++) {
                                    values[clusteringParameters.variables[i]].push(this.clusterCenters[selectedCluster][j][clusteringParameters.variables[i]]);
                                }
                            }
                            values.arrayLength = this.clusterCenters[selectedCluster].length;
                            
                            let clusterCenter = {
                                parameters: clusteringParameters,
                                subsequenceParameters: ClusteringStore.getSubsequenceParameters(),
                                values: values
                            };
                            // visual queryの設定パネルを設定
                            // normalization setting
                            if (subsequenceParameters.normalize) {
                                $('#NormalizeSwitch').prop('checked', true);
                                let normalizationList = document.getElementById('normalizationOptions');
                                for (let i = 0; i < normalizationList.options.length; i++) {
                                    if (normalizationList.options[i].value === 'zScore') {
                                        normalizationList.selectedIndex = i;
                                        break;
                                    }
                                }
                                // TODO: QBSの場合、いったん正規化オプションの強制無効化はなし（クエリ更新時の解除が面倒）
                                // $('#NormalizeSwitch').prop('disabled', true);
                                // $('#normalizationOptions').prop('disabled', true);
                            }

                            // distance metric (for QBS, only DTWD is allowed)
                            FeatureAction.changeDTWMode('DTWD');

                            $('#warpingWindowSize').val(clusteringParameters.window);
                            FeatureAction.convertClusterCenterIntoQuery(clusterCenter);
                        }
                    }
                    break;
            }
        };
    }

    resetDetailView() {
        if ($('#selectedClusterCenterTimeTubes').length) {
            let rendererSize = $('#selectedClusterCenterTimeTubes').width() - 16 * 2;
            // this.detailRenderer.setSize(rendererSize, rendererSize);
            this.cameraDetail.position.x = 0;
            this.cameraDetail.position.y = 0;
            this.cameraDetail.lookAt(0, 0, 0);
        }
    }

    addControls() {
        this.controls = new OrbitControls(this.camera, document.getElementById('clusteringOverviewTimeTubesCanvas'));
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
        let canvas = document.getElementById('clusteringOverviewTimeTubesCanvas');
        let clientRect = canvas.getBoundingClientRect();
        let canvasPageX = window.pageXOffset + clientRect.left,
            canvasPageY = window.pageYOffset + clientRect.top;
        let offsetX = event.pageX - canvasPageX,
            offsetY = event.pageY - canvasPageY;
        raymouse.x = (offsetX / Number(canvas.style.width.slice(0, -2))) * 2 - 1;
        raymouse.y = -(offsetY / Number(canvas.style.height.slice(0, -2))) * 2 + 1;
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
        this.cameraDetail.position.z = this.cameraPosZ;
    }


    setCameraDetail() {
        let far = 1000;
        let axisSize = (typeof(this.gridSize) === 'undefined')? ClusteringStore.getViewportSize() * 0.5: this.gridSize * 1.4;
        this.cameraDetail = new THREE.OrthographicCamera(
            -axisSize / 2, axisSize / 2,
            axisSize / 2, -axisSize / 2, 0.1,
            far
        );
        this.cameraDetail.position.z = this.cameraPosZ;
    }

    computeSplines() {
        // TODO:　正規化の有無で計算変える
        this.minmax = {};
        this.splines = [];
        this.range = undefined;
        let targets = ClusteringStore.getDatasets(),
            subsequenceParameters = ClusteringStore.getSubsequenceParameters(),
            clusteringParameters = ClusteringStore.getClusteringParameters();
        let variables = clusteringParameters.variables;
        // variables = variables.filter(ele => ele !== 'z');
        // for (let i = 0; i < variables.length; i++) {
        //     this.minmax[variables[i]] = [this.clusterCenters[0][0][variables[i]], this.clusterCenters[0][0][variables[i]]];
        // }
        this.minmax.x = [Infinity, -Infinity];
        this.minmax.y = [Infinity, -Infinity];
        this.minmax.H = [Infinity, -Infinity];
        this.minmax.V = [Infinity, -Infinity];
        if (variables.indexOf('x') >= 0 && variables.indexOf('y') >= 0) {
            for (let i = 0; i < this.clusterCenters.length; i++) {
                let position = [], radius = [], color = [];
                for (let j = 0; j < this.clusterCenters[i].length; j++) {
                    let curdata = this.clusterCenters[i][j];
                    let currentValues = {
                        x: curdata.x,
                        y: curdata.y,
                        r_x: 'r_x' in curdata? curdata.r_x: 0.5,
                        r_y: 'r_y' in curdata? curdata.r_y: 0.5,
                        H: 'H' in curdata? curdata.H: 0.5, 
                        V: 'V' in curdata? curdata.V: 0.5
                    };
                    position.push(new THREE.Vector3(currentValues.x, currentValues.y, j));
                    radius.push(new THREE.Vector3(currentValues.r_x, currentValues.r_y, j));
                    color.push(new THREE.Vector3(currentValues.H, currentValues.V, j));
                    for (let key in this.minmax) {
                        if (currentValues[key] < this.minmax[key][0])
                            this.minmax[key][0] = currentValues[key];
                        if (this.minmax[key][1] < currentValues[key])
                            this.minmax[key][1] = currentValues[key];
                    }
                }
                let spline = {};
                spline.position = new THREE.CatmullRomCurve3(position, false, 'catmullrom');
                spline.radius = new THREE.CatmullRomCurve3(radius, false, 'catmullrom');
                spline.color = new THREE.CatmullRomCurve3(color, false, 'catmullrom');
                this.splines.push(spline);
            }
        } else if (variables.indexOf('PA') >= 0 && variables.indexOf('PD') >= 0) {
            for (let i = 0; i < this.clusterCenters.length; i++) {
                let position = [], radius = [], color = [];

                if (subsequenceParameters.normalize) {
                    // when subsequences are normalized
                    let PAMinMax = d3.extent(this.clusterCenters[i], (d) => {
                        return d.PA;
                    });
                    let PDMin = d3.min(this.clusterCenters[i], (d) => {
                        return d.PD;
                    });
                    let PARatio = Math.PI / Math.max(Math.abs(PAMinMax[0]), Math.abs(PAMinMax[1]));
                    for (let j = 0; j < this.clusterCenters[i].length; j++) {
                        let curdata = this.clusterCenters[i][j];
                        // convert normalized PA to [-180, 180]
                        let PARad = curdata.PA * PARatio;
                        let PDPlus = curdata.PD;
                        // make PD larger than 0
                        if (PDMin < 0) {
                            PDPlus += Math.abs(PDMin);
                        }
                        let currentValues = {
                            x: PDPlus * Math.cos(PARad),
                            y: PDPlus * Math.sin(PARad),
                            r_x: 'r_x' in curdata? curdata.r_x: 0.5,
                            r_y: 'r_y' in curdata? curdata.r_y: 0.5,
                            H: 'H' in curdata? curdata.H: 0.5, 
                            V: 'V' in curdata? curdata.V: 0.5
                        };
                        position.push(new THREE.Vector3(currentValues.x, currentValues.y, j));
                        radius.push(new THREE.Vector3(currentValues.r_x, currentValues.r_y, j));
                        color.push(new THREE.Vector3(currentValues.H, currentValues.V, j));
                        for (let key in this.minmax) {
                            if (currentValues[key] < this.minmax[key][0])
                                this.minmax[key][0] = currentValues[key];
                            if (this.minmax[key][1] < currentValues[key])
                                this.minmax[key][1] = currentValues[key];
                        }
                    }
                    let spline = {};
                    spline.position = new THREE.CatmullRomCurve3(position, false, 'catmullrom');
                    spline.radius = new THREE.CatmullRomCurve3(radius, false, 'catmullrom');
                    spline.color = new THREE.CatmullRomCurve3(color, false, 'catmullrom');
                    this.splines.push(spline);
                } else {
                    // when the entire dataset is normalized
                    // recover orginal values
                    // multiple datasets/single dataset
                    if (targets.length === 1) {
                        // multiply std and add mean
                        let meta = DataStore.getData(targets[0]).data.meta;
                        for (let j = 0; j < this.clusterCenters[i].length; j++) {
                            let curdata = this.clusterCenters[i][j];
                            let PARad = curdata.PA * meta.std.PA + meta.mean.PA;
                            if (90 < PARad && PARad <= 180) {
                                PARad -= 180;
                            }
                            PARad *= 2;
                            PARad = PARad * Math.PI / 180;
                            let currentValues = {
                                x: (curdata.PD * meta.std.PD + meta.mean.PD) * Math.cos(PARad),
                                y: (curdata.PD * meta.std.PD + meta.mean.PD) * Math.sin(PARad),
                                r_x: 'r_x' in curdata? (curdata.r_x * meta.std.r_x + meta.mean.r_x): 0.5,
                                r_y: 'r_y' in curdata? (curdata.r_y * meta.std.r_y + meta.mean.r_y): 0.5,
                                H: 'H' in curdata? (curdata.H * meta.std.H + meta.mean.H): 0.5, 
                                V: 'V' in curdata? (curdata.V * meta.std.V + meta.mean.V): 0.5
                            };
                            position.push(new THREE.Vector3(currentValues.x, currentValues.y, j));
                            radius.push(new THREE.Vector3(currentValues.r_x, currentValues.r_y, j));
                            color.push(new THREE.Vector3(currentValues.H, currentValues.V, j));
                            for (let key in this.minmax) {
                                if (currentValues[key] < this.minmax[key][0])
                                    this.minmax[key][0] = currentValues[key];
                                if (this.minmax[key][1] < currentValues[key])
                                    this.minmax[key][1] = currentValues[key];
                            }
                        }
                        let spline = {};
                        spline.position = new THREE.CatmullRomCurve3(position, false, 'catmullrom');
                        spline.radius = new THREE.CatmullRomCurve3(radius, false, 'catmullrom');
                        spline.color = new THREE.CatmullRomCurve3(color, false, 'catmullrom');
                        this.splines.push(spline);
                    } else {
                        // compute average mean and stds
                        let means = {}, stds = {}, dataNum = {};
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

                        for (let j = 0; j < this.clusterCenters[i].length; j++) {
                            let curdata = this.clusterCenters[i][j];
                            let PARad = curdata.PA * stds.PA + means.PA;
                            if (90 < PARad && PARad <= 180) {
                                PARad -= 180;
                            }
                            PARad *= 2;
                            PARad = PARad * Math.PI / 180;
                            let currentValues = {
                                x: (curdata.PD * stds.PD + means.PD) * Math.cos(PARad),
                                y: (curdata.PD * stds.PD + means.PD) * Math.sin(PARad),
                                r_x: 'r_x' in curdata? (curdata.r_x * stds.r_x + means.r_x): 0.5,
                                r_y: 'r_y' in curdata? (curdata.r_y * stds.r_y + means.r_y): 0.5,
                                H: 'H' in curdata? (curdata.H * stds.H + means.H): 0.5, 
                                V: 'V' in curdata? (curdata.V * stds.V + means.V): 0.5
                            };
                            position.push(new THREE.Vector3(currentValues.x, currentValues.y, j));
                            radius.push(new THREE.Vector3(currentValues.r_x, currentValues.r_y, j));
                            color.push(new THREE.Vector3(currentValues.H, currentValues.V, j));
                            for (let key in this.minmax) {
                                if (currentValues[key] < this.minmax[key][0])
                                    this.minmax[key][0] = currentValues[key];
                                if (this.minmax[key][1] < currentValues[key])
                                    this.minmax[key][1] = currentValues[key];
                            }
                        }
                        let spline = {};
                        spline.position = new THREE.CatmullRomCurve3(position, false, 'catmullrom');
                        spline.radius = new THREE.CatmullRomCurve3(radius, false, 'catmullrom');
                        spline.color = new THREE.CatmullRomCurve3(color, false, 'catmullrom');
                        this.splines.push(spline);
                    }
                }
            }
        } else if ((variables.indexOf('x') >= 0 || variables.indexOf('y') >= 0) && (variables.indexOf('PA') >= 0 || variables.indexOf('PD') >= 0)) {
            // TODO: tentatively prohibit these variable selection
            // for (let i = 0; i < this.clusterCenters.length; i++) {
            //     let position = [], radius = [], color = [];
            //     for (let j = 0; j < this.clusterCenters[i].length; j++) {
            //         let curdata = this.clusterCenters[i][j];
            //         let xCur, yCur;
            //         if (variables.indexOf('PA') >= 0) {
            //             let PDCur;
            //             if (variables.indexOf('x') >= 0) {
            //                 xCur = curdata.x;
            //                 let PARad = curdata.PA;
            //                 if (0.5 * Math.PI < PARad && PARad <= Math.PI) {
            //                     PARad -= Math.PI;
            //                 }
            //                 PARad *= 2;
            //                 PDCur = curdata.x / Math.cos(PARad);
            //                 yCur = PDCur * Math.sin(PARad);
            //             } else if (variables.indexOf('y') >= 0) {
            //                 PDCur = curdata.y / Math.sin(2 * curdata.PA);
            //                 xCur = PDCur * Math.cos(2 * curdata.PA);
            //                 yCur = curdata.y;
            //             }
            //         } else if (variables.indexOf('PD') >= 0) {
            //             let PACur;
            //             if (variables.indexOf('x') >= 0) {
            //                 PACur = Math.acos(curdata.x / curdata.PD) / 2;
            //                 xCur = curdata.x;
            //                 yCur = curdata.PD * Math.sin(2 * PACur);
            //             } else if (variables.indexOf('y') >= 0) {
            //                 PACur = Math.asin(curdata.y / curdata.PD) / 2;
            //                 xCur = curdata.PD * Math.cos(2 * PACur);
            //                 yCur = curdata.y;
            //             }
            //         }
            //         let currentValues = {
            //             x: xCur,
            //             y: yCur,
            //             r_x: 'r_x' in curdata? curdata.r_x: 0.5,
            //             r_y: 'r_y' in curdata? curdata.r_y: 0.5,
            //             H: 'H' in curdata? curdata.H: 0.5, 
            //             V: 'V' in curdata? curdata.V: 0.5
            //         };
            //         position.push(new THREE.Vector3(currentValues.x, currentValues.y, j));
            //         radius.push(new THREE.Vector3(currentValues.r_x, currentValues.r_y, j));
            //         color.push(new THREE.Vector3(currentValues.H, currentValues.V, j));
            //         for (let key in this.minmax) {
            //             if (currentValues[key] < this.minmax[key][0])
            //                 this.minmax[key][0] = currentValues[key];
            //             if (this.minmax[key][1] < currentValues[key])
            //                 this.minmax[key][1] = currentValues[key];
            //         }
            //     }
            //     let spline = {};
            //     spline.position = new THREE.CatmullRomCurve3(position, false, 'catmullrom');
            //     spline.radius = new THREE.CatmullRomCurve3(radius, false, 'catmullrom');
            //     spline.color = new THREE.CatmullRomCurve3(color, false, 'catmullrom');
            //     this.splines.push(spline);
            // }
        } else if (variables.indexOf('x') >= 0 || variables.indexOf('y') >= 0) {
            for (let i = 0; i < this.clusterCenters.length; i++) {
                let position = [], radius = [], color = [];
                for (let j = 0; j < this.clusterCenters[i].length; j++) {
                    let curdata = this.clusterCenters[i][j];
                    let currentValues = {
                        x: 'x' in curdata? curdata.x: 0,
                        y: 'y' in curdata? curdata.y: 0,
                        r_x: 'r_x' in curdata? curdata.r_x: 0.5,
                        r_y: 'r_y' in curdata? curdata.r_y: 0.5,
                        H: 'H' in curdata? curdata.H: 0.5, 
                        V: 'V' in curdata? curdata.V: 0.5
                    };
                    position.push(new THREE.Vector3(currentValues.x, currentValues.y, j));
                    radius.push(new THREE.Vector3(currentValues.r_x, currentValues.r_y, j));
                    color.push(new THREE.Vector3(currentValues.H, currentValues.V, j));
                    for (let key in this.minmax) {
                        if (currentValues[key] < this.minmax[key][0])
                            this.minmax[key][0] = currentValues[key];
                        if (this.minmax[key][1] < currentValues[key])
                            this.minmax[key][1] = currentValues[key];
                    }
                }
                let spline = {};
                spline.position = new THREE.CatmullRomCurve3(position, false, 'catmullrom');
                spline.radius = new THREE.CatmullRomCurve3(radius, false, 'catmullrom');
                spline.color = new THREE.CatmullRomCurve3(color, false, 'catmullrom');
                this.splines.push(spline);
            }
        } else if (variables.indexOf('PA') >= 0 || variables.indexOf('PD') >= 0) {
            for (let i = 0; i < this.clusterCenters.length; i++) {
                let position = [], radius = [], color = [];

                if (subsequenceParameters.normalize) {
                    // when subsequences are normalized
                    let PAMinMax, PARatio, PDMin;
                    if (variables.indexOf('PA') >= 0) {
                        PAMinMax = d3.extent(this.clusterCenters[i], (d) => {
                            return d.PA;
                        });
                        PARatio = Math.PI / Math.max(Math.abs(PAMinMax[0]), Math.abs(PAMinMax[1]));
                    } else if (variables.indexOf('PD') >= 0) {
                        PDMin = d3.min(this.clusterCenters[i], (d) => {
                            return d.PD;
                        });
                    }
                    let xCur, yCur;
                    for (let j = 0; j < this.clusterCenters[i].length; j++) {
                        let curdata = this.clusterCenters[i][j];
                        if (variables.indexOf('PA') >= 0) {
                            let PDTmp = 1;
                            xCur = PDTmp * Math.cos(curdata.PA * PARatio);
                            yCur = PDTmp * Math.sin(curdata.PA * PARatio);
                        } else if (variables.indexOf('PD') >= 0) {
                            let PDPlus = curdata.PD;
                            // make PD larger than 0
                            if (PDMin < 0) {
                                PDPlus += Math.abs(PDMin);
                            }
                            xCur = 0;
                            yCur = PDPlus;
                        }
                        let currentValues = {
                            x: xCur,
                            y: yCur,
                            r_x: 'r_x' in curdata? curdata.r_x: 0.5,
                            r_y: 'r_y' in curdata? curdata.r_y: 0.5,
                            H: 'H' in curdata? curdata.H: 0.5, 
                            V: 'V' in curdata? curdata.V: 0.5
                        };
                        position.push(new THREE.Vector3(currentValues.x, currentValues.y, j));
                        radius.push(new THREE.Vector3(currentValues.r_x, currentValues.r_y, j));
                        color.push(new THREE.Vector3(currentValues.H, currentValues.V, j));
                        for (let key in this.minmax) {
                            if (currentValues[key] < this.minmax[key][0])
                                this.minmax[key][0] = currentValues[key];
                            if (this.minmax[key][1] < currentValues[key])
                                this.minmax[key][1] = currentValues[key];
                        }
                    }
                } else {
                    // when the entire dataset is normalized
                    // recover orginal values
                    // multiple datasets/single dataset
                    if (targets.length === 1) {
                        // multiply std and add mean
                        let meta = DataStore.getData(targets[0]).data.meta;
                        for (let j = 0; j < this.clusterCenters[i].length; j++) {
                            let curdata = this.clusterCenters[i][j];
                            let xCur, yCur;
                            if (variables.indexOf('PA') >= 0) {
                                let PARad = curdata.PA * meta.std.PA + meta.mean.PA;
                                if (90 < PARad && PARad <= 180) {
                                    PARad -= 180;
                                }
                                PARad *= 2;
                                PARad = PARad * Math.PI / 180;
                                xCur = Math.cos(PARad);
                                yCur =  Math.sin(PARad);
                            } else if (variables.indexOf('PD') >= 0) {
                                xCur = (curdata.PD * meta.std.PD + meta.mean.PD) * Math.cos(0.5 * Math.PI);
                                yCur = (curdata.PD * meta.std.PD + meta.mean.PD) * Math.sin(0.5 * Math.PI);
                            }
                            let currentValues = {
                                x: xCur,
                                y: yCur,
                                r_x: 'r_x' in curdata? (curdata.r_x * meta.std.r_x + meta.mean.r_x): 0.5,
                                r_y: 'r_y' in curdata? (curdata.r_y * meta.std.r_y + meta.mean.r_y): 0.5,
                                H: 'H' in curdata? (curdata.H * meta.std.H + meta.mean.H): 0.5, 
                                V: 'V' in curdata? (curdata.V * meta.std.V + meta.mean.V): 0.5
                            };
                            position.push(new THREE.Vector3(currentValues.x, currentValues.y, j));
                            radius.push(new THREE.Vector3(currentValues.r_x, currentValues.r_y, j));
                            color.push(new THREE.Vector3(currentValues.H, currentValues.V, j));
                            for (let key in this.minmax) {
                                if (currentValues[key] < this.minmax[key][0])
                                    this.minmax[key][0] = currentValues[key];
                                if (this.minmax[key][1] < currentValues[key])
                                    this.minmax[key][1] = currentValues[key];
                            }
                        }
                    } else {
                        // compute average mean and stds
                        let means = {}, stds = {}, dataNum = {};
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

                        for (let j = 0; j < this.clusterCenters[i].length; j++) {
                            let curdata = this.clusterCenters[i][j];
                            let xCur, yCur;
                            if (variables.indexOf('PA') >= 0) {
                                let PARad = curdata.PA * stds.PA + means.PA;
                                if (90 < PARad && PARad <= 180) {
                                    PARad -= 180;
                                }
                                PARad *= 2;
                                PARad = PARad * Math.PI / 180;
                                xCur = Math.cos(PARad);
                                yCur =  Math.sin(PARad);
                            } else if (variables.indexOf('PD') >= 0) {
                                xCur = (curdata.PD * stds.PD + means.PD) * Math.cos(0.5 * Math.PI);
                                yCur = (curdata.PD * stds.PD + means.PD) * Math.sin(0.5 * Math.PI);
                            }
                            let currentValues = {
                                x: xCur,
                                y: yCur,
                                r_x: 'r_x' in curdata? (curdata.r_x * stds.r_x + means.r_x): 0.5,
                                r_y: 'r_y' in curdata? (curdata.r_y * stds.r_y + means.r_y): 0.5,
                                H: 'H' in curdata? (curdata.H * stds.H + means.H): 0.5, 
                                V: 'V' in curdata? (curdata.V * stds.V + means.V): 0.5
                            };
                            position.push(new THREE.Vector3(currentValues.x, currentValues.y, j));
                            radius.push(new THREE.Vector3(currentValues.r_x, currentValues.r_y, j));
                            color.push(new THREE.Vector3(currentValues.H, currentValues.V, j));
                            for (let key in this.minmax) {
                                if (currentValues[key] < this.minmax[key][0])
                                    this.minmax[key][0] = currentValues[key];
                                if (this.minmax[key][1] < currentValues[key])
                                    this.minmax[key][1] = currentValues[key];
                            }
                        }
                    }
                }
                let spline = {};
                spline.position = new THREE.CatmullRomCurve3(position, false, 'catmullrom');
                spline.radius = new THREE.CatmullRomCurve3(radius, false, 'catmullrom');
                spline.color = new THREE.CatmullRomCurve3(color, false, 'catmullrom');
                this.splines.push(spline);
                // for (let j = 0; j < this.clusterCenters[i].length; j++) {
                //     let curdata = this.clusterCenters[i][j];
                //     let xCur, yCur;
                //     if (variables.indexOf('PA') >= 0) {
                //         let PDTmp = 1;
                //         xCur = PDTmp * Math.cos(2 * curdata.PA);
                //         yCur = PDTmp * Math.sin(2 * curdata.PA);
                //     } else if (variables.indexOf('PD') >= 0) {
                //         let PATmp = 0.5 * Math.PI;
                //         xCur = curdata.PD * Math.cos(PATmp);
                //         yCur = curdata.PD * Math.sin(PATmp);
                //     }
                //     let currentValues = {
                //         x: xCur,
                //         y: yCur,
                //         r_x: 'r_x' in curdata? curdata.r_x: 0.5,
                //         r_y: 'r_y' in curdata? curdata.r_y: 0.5,
                //         H: 'H' in curdata? curdata.H: 0.5, 
                //         V: 'V' in curdata? curdata.V: 0.5
                //     };
                //     position.push(new THREE.Vector3(currentValues.x, currentValues.y, j));
                //     radius.push(new THREE.Vector3(currentValues.r_x, currentValues.r_y, j));
                //     color.push(new THREE.Vector3(currentValues.H, currentValues.V, j));
                //     for (let key in this.minmax) {
                //         if (currentValues[key] < this.minmax[key][0])
                //             this.minmax[key][0] = currentValues[key];
                //         if (this.minmax[key][1] < currentValues[key])
                //             this.minmax[key][1] = currentValues[key];
                //     }
                // }
                // let spline = {};
                // spline.position = new THREE.CatmullRomCurve3(position, false, 'catmullrom');
                // spline.radius = new THREE.CatmullRomCurve3(radius, false, 'catmullrom');
                // spline.color = new THREE.CatmullRomCurve3(color, false, 'catmullrom');
                // this.splines.push(spline);
            }
        }
        let xRange = this.minmax.x[1] - this.minmax.x[0];
        let yRange = this.minmax.y[1] - this.minmax.y[0];
        let range = Math.round(Math.max(xRange, yRange) * Math.pow(10, 2 - Math.ceil(Math.log10(Math.max(xRange, yRange)))));
        this.range = ClusteringStore.getGridSize() / (Math.ceil(range / 5) * 5 * Math.pow(10, - (2 - Math.ceil(Math.log10(Math.max(xRange, yRange))))));
    }

    drawClusterCentersAsTubes() {
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

    drawClusterRadiusesAsRings(clusterRadiuses) {
        if (this.clusterRadiuses) {
            let geometry = this.clusterRadiuses.geometry,
                material = this.clusterRadiuses.material;
            this.scene.remove(this.clusterRadiuses);
            this.clusterRadiuses = undefined;
            geometry.dispose();
            material.dispose();
        }
        this.clusterRadiuses = undefined;

        // min cluster radius === this.gridSize
        let minClusterRad = 0;
        for (let i = 0; i < clusterRadiuses.length; i++) {
            if (clusterRadiuses[i] > 0) {
                minClusterRad = clusterRadiuses[i];
                break;
            }
        }
        let ratio = this.gridSize * 0.7 / minClusterRad;
        let segment = 32;
        
        let circleIndices = Array(segment * 2 * clusterRadiuses.filter(d => d !== 0).length),
            circlePositions = [],
            del = Math.PI * 2 / segment;
        let radiusRingsCount = 0;
        for (let i = 0; i < clusterRadiuses.length; i++) {
            if (clusterRadiuses[i] > 0) {
                let currentIdx = segment * 2 * radiusRingsCount;
                circleIndices[currentIdx] = radiusRingsCount * segment;
                circleIndices[currentIdx + segment * 2 - 1] = radiusRingsCount * segment;
                for (let j = 0; j < segment; j++) {
                    circlePositions.push(this.tubeCoords[i].x + clusterRadiuses[i] * ratio * Math.cos(del * j));
                    circlePositions.push(this.tubeCoords[i].y + clusterRadiuses[i] * ratio * Math.sin(del * j));
                    circlePositions.push(0);

                    if (j !== 0) {
                        circleIndices[currentIdx + 2 * (j - 1) + 1] = radiusRingsCount * segment + j;
                        circleIndices[currentIdx + 2 * (j - 1) + 2] = radiusRingsCount * segment + j;
                    }
                }
                radiusRingsCount++;
            }
        }
        let circleGeometry = new THREE.BufferGeometry();
        circleGeometry.setIndex(circleIndices);
        circleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(circlePositions, 3));
        let circleMaterial = new THREE.LineBasicMaterial({
            color: 0xffffff,
            linewidth: 1,
            // vertexColors: THREE.VertexColors,
            // clippingPlanes: [this.clippingPlane]
        });
        this.clusterRadiuses = new THREE.LineSegments(circleGeometry, circleMaterial);
        this.scene.add(this.clusterRadiuses);
    }

    drawInterClusterTransitionLink() {
        // remove previous paths
        if (this.correlationPathGroupLeft) {
            this.scene.remove(this.correlationPathGroupLeft);
            this.correlationPathGroupLeft = undefined;
        }
        if (this.correlationPathGroupRight) {
            this.scene.remove(this.correlationPathGroupRight);
            this.correlationPathGroupRight = undefined;
        }

        this.correlationPathGroupLeft = new THREE.Group();
        this.correlationPathGroupRight = new THREE.Group();

        let clusterBefore = [],
            clusterAfter = [];
        for (let i = 0; i < this.clusterCenters.length; i++) {
            clusterBefore.push(new Array(this.clusterCenters.length).fill(0));
            clusterAfter.push(new Array(this.clusterCenters.length).fill(0));
        }
        if (typeof(this.SSLabels[0]) === 'object') {
            for (let i = 0; i < this.SSLabels.length; i++) {
                if (i - 1 >= 0) {
                    clusterBefore[this.SSLabels[i].cluster][this.SSLabels[i - 1].cluster]++;
                }
                if (i + 1 < this.SSLabels.length) {
                    clusterAfter[this.SSLabels[i].cluster][this.SSLabels[i + 1].cluster]++;
                }
            }
        } else {
            for (let i = 0; i < this.SSLabels.length; i++) {
                if (i - 1 >= 0) {
                    clusterBefore[this.SSLabels[i]][this.SSLabels[i - 1]]++;
                }
                if (i + 1 < this.SSLabels.length) {
                    clusterAfter[this.SSLabels[i]][this.SSLabels[i + 1]]++;
                }
            }
        }
        let maxCount = -Infinity, minCount = Infinity;
        for (let i = 0; i < this.clusterCenters.length; i++) {
            let clusterBeforeMoreThan0 = clusterBefore[i].filter(d => d > 0),
                clusterAfterMoreThan0 = clusterAfter[i].filter(d => d > 0);
            let minMaxBef = d3.extent(clusterBeforeMoreThan0);
            let minMaxAft = d3.extent(clusterAfterMoreThan0);
            if (minMaxBef[0] < minCount) {
                minCount = minMaxBef[0];
            }
            if (maxCount < minMaxBef[1]) {
                maxCount = minMaxBef[1];
            }
            if (minMaxAft[0] < minCount) {
                minCount = minMaxAft[0];
            }
            if (maxCount < minMaxAft[1]) {
                maxCount = minMaxAft[1];
            }
        }
        let axisSize = this.gridSize * 0.7 * 2;
        let arrowSize = axisSize * 0.1, arrowSharpness = Math.PI / 6;
        let minPathWidth = 0.01, maxPathWidth = this.gridSize * 0.7 / 4;
        const segments = 50;
        let zpos = 0;//this.clusterCenters[0].length;
        for (let i = 0; i < this.clusterCenters.length - 1; i++) {
            for (let j = i + 1; j < this.clusterCenters.length; j++) {
                if (i !== j) {
                    let xCoordDiff = Math.abs(this.tubeCoords[i].x - this.tubeCoords[j].x),
                        yCoordDiff = Math.abs(this.tubeCoords[i].y - this.tubeCoords[j].y);
                    if (xCoordDiff < axisSize) {
                        // connect top & bottom
                        let topIdx = (this.tubeCoords[i].y > this.tubeCoords[j].y)? i: j,
                            bottomIdx = (this.tubeCoords[i].y <= this.tubeCoords[j].y)? i: j;
                        let topPoint = {
                            x: this.tubeCoords[topIdx].x,
                            y: this.tubeCoords[topIdx].y - axisSize / 2
                        };
                        let bottomPoint = {
                            x: this.tubeCoords[bottomIdx].x,
                            y: this.tubeCoords[bottomIdx].y + axisSize / 2
                        };
                        let shiftSize = 2;
                        let normalTilt = -1 * (topPoint.x - bottomPoint.x) / (topPoint.y - bottomPoint.y);
                        let deltaX = Math.sqrt(shiftSize * shiftSize / (1 + normalTilt * normalTilt));
                        let deltaY = normalTilt * deltaX;
                        let beforeClusterIdx = Math.min(topIdx, bottomIdx);
                        let afterClusterIdx = Math.max(topIdx, bottomIdx);
                        if (clusterBefore[afterClusterIdx][beforeClusterIdx] > 0) {
                            let conePos = {x: 0, y: 0}, coneRotate = 0;
                            let points = [], arrowPoints = [];
                            if (afterClusterIdx === bottomIdx) {
                                // bottom is the goal of the path
                                points.push(new THREE.Vector3( topPoint.x, topPoint.y, zpos ));
                                points.push(new THREE.Vector3( 
                                    topPoint.x + (bottomPoint.x - topPoint.x) / 2 - deltaX,
                                    topPoint.y + (bottomPoint.y - topPoint.y) / 2 - deltaY, 
                                    zpos 
                                ));
                                points.push(new THREE.Vector3( bottomPoint.x, bottomPoint.y, zpos ));
                                coneRotate =  Math.atan2(
                                    (bottomPoint.y - (topPoint.y + (bottomPoint.y - topPoint.y) / 2 - deltaY)),
                                    (bottomPoint.x - (topPoint.x + (bottomPoint.x - topPoint.x) / 2 - deltaX))
                                );
                                arrowPoints.push(
                                    new THREE.Vector3(
                                        bottomPoint.x - arrowSize * Math.cos(coneRotate - arrowSharpness),
                                        bottomPoint.y - arrowSize * Math.sin(coneRotate - arrowSharpness),
                                        zpos
                                    )
                                );
                                arrowPoints.push(
                                    new THREE.Vector3(bottomPoint.x, bottomPoint.y, zpos)
                                );
                                arrowPoints.push(
                                    new THREE.Vector3(
                                        bottomPoint.x - arrowSize * Math.cos(coneRotate + arrowSharpness),
                                        bottomPoint.y - arrowSize * Math.sin(coneRotate + arrowSharpness),
                                        zpos
                                    )
                                );
                            } else if (afterClusterIdx === topIdx) {
                                // top is the goal of the path
                                points.push(new THREE.Vector3( topPoint.x, topPoint.y, zpos ));
                                points.push(new THREE.Vector3( 
                                    topPoint.x + (bottomPoint.x - topPoint.x) / 2 - deltaX,
                                    topPoint.y + (bottomPoint.y - topPoint.y) / 2 - deltaY, 
                                    zpos 
                                ));
                                points.push(new THREE.Vector3( bottomPoint.x, bottomPoint.y, zpos ));
                                coneRotate = Math.atan2(
                                    (topPoint.y - (topPoint.y + (bottomPoint.y - topPoint.y) / 2 - deltaY)),
                                    (topPoint.x - (topPoint.x + (bottomPoint.x - topPoint.x) / 2 - deltaX))
                                );
                                arrowPoints.push(
                                    new THREE.Vector3(
                                        topPoint.x - arrowSize * Math.cos(coneRotate - arrowSharpness),
                                        topPoint.y - arrowSize * Math.sin(coneRotate - arrowSharpness),
                                        zpos
                                    )
                                );
                                arrowPoints.push(
                                    new THREE.Vector3(topPoint.x, topPoint.y, zpos)
                                );
                                arrowPoints.push(
                                    new THREE.Vector3(
                                        topPoint.x - arrowSize * Math.cos(coneRotate + arrowSharpness),
                                        topPoint.y - arrowSize * Math.sin(coneRotate + arrowSharpness),
                                        zpos
                                    )
                                );
                            }
                            let beforeSplineGeometry = new THREE.Geometry().setFromPoints(new THREE.CatmullRomCurve3(points).getPoints(50));
                            let beforeMeshLine = new MeshLine.MeshLine();
                            beforeMeshLine.setGeometry(beforeSplineGeometry);
                            let beforeMeshLineMaterial = new MeshLine.MeshLineMaterial({
                                color: new THREE.Color(
                                    'hsl(' + 
                                    this.clusterColors[beforeClusterIdx][0] + ', 50%, 50%)'
                                ),
                                lineWidth: 0.3
                            });
                            let beforeMesh = new THREE.Mesh(beforeMeshLine.geometry, beforeMeshLineMaterial);
                            let arrowGeometry = new THREE.Geometry().setFromPoints(arrowPoints);
                            let arrowMeshLine = new MeshLine.MeshLine();
                            arrowMeshLine.setGeometry(arrowGeometry);
                            let beforeArrowMesh = new THREE.Mesh(arrowMeshLine.geometry, beforeMeshLineMaterial);
                            let beforeLabel = new TextSprite({
                                alignment: 'center',
                                color: 'hsl(' + this.clusterColors[beforeClusterIdx][0] + ', 50%, 50%)',
                                fontFamily: 'Arial, Helvetica, sans-serif',
                                textSize: 0.5,
                                text: String(clusterBefore[afterClusterIdx][beforeClusterIdx])
                            });
                            beforeLabel.name = 'beforeTransition_' + afterClusterIdx + '_' + beforeClusterIdx;
                            beforeLabel.position.set(
                                topPoint.x + (bottomPoint.x - topPoint.x) / 2 - deltaX - shiftSize / 2,
                                topPoint.y + (bottomPoint.y - topPoint.y) / 2 - deltaY,
                                zpos    
                            );
                            this.correlationPathGroupLeft.add(beforeMesh);
                            this.correlationPathGroupLeft.add(beforeArrowMesh);
                            this.correlationPathGroupLeft.add(beforeLabel);
                        }
                        
                        if (clusterAfter[afterClusterIdx][beforeClusterIdx] > 0) {
                            let conePos = {x: 0, y: 0}, coneRotate = 0;
                            let points = [], arrowPoints = [];
                            if (afterClusterIdx === bottomIdx) {
                                // arrow from bottom to top
                                points.push(new THREE.Vector3( bottomPoint.x, bottomPoint.y, zpos ));
                                points.push(new THREE.Vector3( 
                                    topPoint.x + (bottomPoint.x - topPoint.x) / 2 + deltaX,
                                    topPoint.y + (bottomPoint.y - topPoint.y) / 2 + deltaY, 
                                    zpos 
                                ));
                                points.push(new THREE.Vector3( topPoint.x, topPoint.y, zpos ));
                                coneRotate = Math.atan2(
                                    (topPoint.y - (topPoint.y + (bottomPoint.y - topPoint.y) / 2 + deltaY)),
                                    (topPoint.x - (topPoint.x + (bottomPoint.x - topPoint.x) / 2 + deltaX))
                                );
                                arrowPoints.push(
                                    new THREE.Vector3(
                                        topPoint.x - arrowSize * Math.cos(coneRotate - arrowSharpness),
                                        topPoint.y - arrowSize * Math.sin(coneRotate - arrowSharpness),
                                        zpos
                                    )
                                );
                                arrowPoints.push(
                                    new THREE.Vector3(topPoint.x, topPoint.y, zpos)
                                );
                                arrowPoints.push(
                                    new THREE.Vector3(
                                        topPoint.x - arrowSize * Math.cos(coneRotate + arrowSharpness),
                                        topPoint.y - arrowSize * Math.sin(coneRotate + arrowSharpness),
                                        zpos
                                    )
                                );
                            } else if (afterClusterIdx === topIdx) {
                                // arrow from top to bottom
                                points.push(new THREE.Vector3( topPoint.x, topPoint.y, zpos ));
                                points.push(new THREE.Vector3( 
                                    topPoint.x + (bottomPoint.x - topPoint.x) / 2 + deltaX,
                                    topPoint.y + (bottomPoint.y - topPoint.y) / 2 + deltaY, 
                                    zpos 
                                ));
                                points.push(new THREE.Vector3( bottomPoint.x, bottomPoint.y, zpos ));
                                coneRotate = Math.atan2(
                                    (bottomPoint.y - (topPoint.y + (bottomPoint.y - topPoint.y) / 2 + deltaY)),
                                    (bottomPoint.x - (topPoint.x + (bottomPoint.x - topPoint.x) / 2 + deltaX))
                                );
                                arrowPoints.push(
                                    new THREE.Vector3(
                                        bottomPoint.x - arrowSize * Math.cos(coneRotate - arrowSharpness),
                                        bottomPoint.y - arrowSize * Math.sin(coneRotate - arrowSharpness),
                                        zpos
                                    )
                                );
                                arrowPoints.push(
                                    new THREE.Vector3(bottomPoint.x, bottomPoint.y, zpos)
                                );
                                arrowPoints.push(
                                    new THREE.Vector3(
                                        bottomPoint.x - arrowSize * Math.cos(coneRotate + arrowSharpness),
                                        bottomPoint.y - arrowSize * Math.sin(coneRotate + arrowSharpness),
                                        zpos
                                    )
                                );
                            }
                            let afterSplineGeometry = new THREE.Geometry().setFromPoints(new THREE.CatmullRomCurve3(points).getPoints(50));
                            let afterMeshLine = new MeshLine.MeshLine();
                            afterMeshLine.setGeometry(afterSplineGeometry);
                            let afterMeshLineMaterial = new MeshLine.MeshLineMaterial({
                                color: new THREE.Color(
                                    'hsl(' + 
                                    this.clusterColors[afterClusterIdx][0] + ', 50%, 50%)'
                                ),
                                lineWidth: 0.3
                            });
                            let afterMesh = new THREE.Mesh(afterMeshLine.geometry, afterMeshLineMaterial);
                            let arrowGeometry = new THREE.Geometry().setFromPoints(arrowPoints);
                            let arrowMeshLine = new MeshLine.MeshLine();
                            arrowMeshLine.setGeometry(arrowGeometry);
                            let afterArrowMesh = new THREE.Mesh(arrowMeshLine.geometry, afterMeshLineMaterial);
                            let afterLabel = new TextSprite({
                                alignment: 'center',
                                color: 'hsl(' + this.clusterColors[afterClusterIdx][0] + ', 50%, 50%)',
                                fontFamily: 'Arial, Helvetica, sans-serif',
                                textSize: 0.5,
                                text: String(clusterAfter[afterClusterIdx][beforeClusterIdx])
                            });
                            afterLabel.name = 'afterTransition_' + afterClusterIdx + '_' + beforeClusterIdx;
                            afterLabel.position.set(
                                topPoint.x + (bottomPoint.x - topPoint.x) / 2 + deltaX + shiftSize / 2,
                                topPoint.y + (bottomPoint.y - topPoint.y) / 2 + deltaY, 
                                zpos    
                            );
                            this.correlationPathGroupRight.add(afterMesh);
                            this.correlationPathGroupRight.add(afterArrowMesh);
                            this.correlationPathGroupRight.add(afterLabel);
                        }
                    } else if (yCoordDiff < axisSize) {
                        // connect left & right
                        let leftIdx = (this.tubeCoords[i].x < this.tubeCoords[j].x)? i: j,
                            rightIdx = (this.tubeCoords[i].x >= this.tubeCoords[j].x)? i: j;
                        let leftPoint = {
                            x: this.tubeCoords[leftIdx].x + axisSize / 2,
                            y: this.tubeCoords[leftIdx].y
                        };
                        let rightPoint = {
                            x: this.tubeCoords[rightIdx].x - axisSize / 2,
                            y: this.tubeCoords[rightIdx].y
                        };
                        let shiftSize = 2;
                        let normalTilt = -1 * (rightPoint.x - leftPoint.x) / (rightPoint.y - leftPoint.y);
                        let deltaX = Math.sqrt(shiftSize * shiftSize / (1 + normalTilt * normalTilt));
                        let deltaY = normalTilt * deltaX;
                        let beforeClusterIdx = Math.min(leftIdx, rightIdx);
                        let afterClusterIdx = Math.max(leftIdx, rightIdx);
                        if (clusterBefore[afterClusterIdx][beforeClusterIdx] > 0) {
                            let conePos = {x: 0, y: 0}, coneRotate = 0;
                            let points = [], arrowPoints = [];
                            if (afterClusterIdx === leftIdx) {
                                // left is the goal of the path
                                points.push(new THREE.Vector3( leftPoint.x, leftPoint.y, zpos ));
                                points.push(new THREE.Vector3( 
                                    leftPoint.x + (rightPoint.x - leftPoint.x) / 2 - deltaX,
                                    leftPoint.y + (rightPoint.y - leftPoint.y) / 2 - deltaY, 
                                    zpos 
                                ));
                                points.push(new THREE.Vector3( rightPoint.x, rightPoint.y, zpos ));
                                coneRotate = Math.atan2(
                                    (leftPoint.y - (leftPoint.y + (rightPoint.y - leftPoint.y) / 2 - deltaY)),
                                    (leftPoint.x - (leftPoint.x + (rightPoint.x - leftPoint.x) / 2 - deltaX))
                                );

                                arrowPoints.push(
                                    new THREE.Vector3(
                                        leftPoint.x - arrowSize * Math.cos(coneRotate - arrowSharpness),
                                        leftPoint.y - arrowSize * Math.sin(coneRotate - arrowSharpness),
                                        zpos
                                    )
                                );
                                arrowPoints.push(
                                    new THREE.Vector3(leftPoint.x, leftPoint.y, zpos)
                                );
                                arrowPoints.push(
                                    new THREE.Vector3(
                                        leftPoint.x - arrowSize * Math.cos(coneRotate + arrowSharpness),
                                        leftPoint.y - arrowSize * Math.sin(coneRotate + arrowSharpness),
                                        zpos
                                    )
                                );
                            } else if (afterClusterIdx === rightIdx) {
                                // right is the goal of the path
                                points.push(new THREE.Vector3( leftPoint.x, leftPoint.y, zpos ));
                                points.push(new THREE.Vector3( 
                                    leftPoint.x + (rightPoint.x - leftPoint.x) / 2 - deltaX,
                                    leftPoint.y + (rightPoint.y - leftPoint.y) / 2 - deltaY, 
                                    zpos 
                                ));
                                points.push(new THREE.Vector3( rightPoint.x, rightPoint.y, zpos ));
                                coneRotate = Math.atan2(
                                    (rightPoint.y - (leftPoint.y + (rightPoint.y - leftPoint.y) / 2 - deltaY)), 
                                    (rightPoint.x - (leftPoint.x + (rightPoint.x - leftPoint.x) / 2 - deltaX))
                                );
                                arrowPoints.push(
                                    new THREE.Vector3(
                                        rightPoint.x - arrowSize * Math.cos(coneRotate - arrowSharpness),
                                        rightPoint.y - arrowSize * Math.sin(coneRotate - arrowSharpness),
                                        zpos
                                    )
                                );
                                arrowPoints.push(
                                    new THREE.Vector3(rightPoint.x, rightPoint.y, zpos)
                                );
                                arrowPoints.push(
                                    new THREE.Vector3(
                                        rightPoint.x - arrowSize * Math.cos(coneRotate + arrowSharpness),
                                        rightPoint.y - arrowSize * Math.sin(coneRotate + arrowSharpness),
                                        zpos
                                    )
                                );
                            }
                            let beforeSplineGeometry = new THREE.Geometry().setFromPoints(new THREE.CatmullRomCurve3(points).getPoints(50));
                            let beforeMeshLine = new MeshLine.MeshLine();
                            beforeMeshLine.setGeometry(beforeSplineGeometry);
                            let beforeMeshLineMaterial = new MeshLine.MeshLineMaterial({
                                color: new THREE.Color(
                                    'hsl(' + 
                                    this.clusterColors[beforeClusterIdx][0] + ', 50%, 50%)'
                                ),
                                lineWidth: 0.3
                            });
                            let beforeMesh = new THREE.Mesh(beforeMeshLine.geometry, beforeMeshLineMaterial);
                            let arrowGeometry = new THREE.Geometry().setFromPoints(arrowPoints);
                            let arrowMeshLine = new MeshLine.MeshLine();
                            arrowMeshLine.setGeometry(arrowGeometry);
                            let beforeArrowMesh = new THREE.Mesh(arrowMeshLine.geometry, beforeMeshLineMaterial);
                            let beforeLabel = new TextSprite({
                                alignment: 'center',
                                color: 'hsl(' + this.clusterColors[beforeClusterIdx][0] + ', 50%, 50%)',
                                fontFamily: 'Arial, Helvetica, sans-serif',
                                textSize: 0.5,
                                text: String(clusterBefore[afterClusterIdx][beforeClusterIdx])
                            });
                            beforeLabel.name = 'beforeTransition_' + afterClusterIdx + '_' + beforeClusterIdx;
                            beforeLabel.position.set(
                                leftPoint.x + (rightPoint.x - leftPoint.x) / 2 - deltaX,
                                leftPoint.y + (rightPoint.y - leftPoint.y) / 2 - deltaY + shiftSize / 2, 
                                zpos   
                            );
                            this.correlationPathGroupLeft.add(beforeMesh);
                            this.correlationPathGroupLeft.add(beforeArrowMesh);
                            this.correlationPathGroupLeft.add(beforeLabel);
                        }

                        if (clusterAfter[afterClusterIdx][beforeClusterIdx] > 0) {
                            let conePos = {x: 0, y: 0}, coneRotate = 0;
                            let points = [], arrowPoints = [];
                            // connect left & right
                            if (afterClusterIdx === leftIdx) {
                                // right is the goal of the path
                                points.push(new THREE.Vector3( leftPoint.x, leftPoint.y, zpos ));
                                points.push(new THREE.Vector3( 
                                    leftPoint.x + (rightPoint.x - leftPoint.x) / 2 + deltaX,
                                    leftPoint.y + (rightPoint.y - leftPoint.y) / 2 + deltaY, 
                                    zpos 
                                ));
                                points.push(new THREE.Vector3( rightPoint.x, rightPoint.y, zpos ));
                                coneRotate = Math.atan2(
                                    (rightPoint.y - (leftPoint.y + (rightPoint.y - leftPoint.y) / 2 + deltaY)), 
                                    (rightPoint.x - (leftPoint.x + (rightPoint.x - leftPoint.x) / 2 + deltaX))
                                );
                                arrowPoints.push(
                                    new THREE.Vector3(
                                        rightPoint.x - arrowSize * Math.cos(coneRotate - arrowSharpness),
                                        rightPoint.y - arrowSize * Math.sin(coneRotate - arrowSharpness),
                                        zpos
                                    )
                                );
                                arrowPoints.push(
                                    new THREE.Vector3(rightPoint.x, rightPoint.y, zpos)
                                );
                                arrowPoints.push(
                                    new THREE.Vector3(
                                        rightPoint.x - arrowSize * Math.cos(coneRotate + arrowSharpness),
                                        rightPoint.y - arrowSize * Math.sin(coneRotate + arrowSharpness),
                                        zpos
                                    )
                                );
                            } else if (afterClusterIdx === rightIdx) {
                                // left is the goal of the path
                                points.push(new THREE.Vector3( leftPoint.x, leftPoint.y, zpos ));
                                points.push(new THREE.Vector3( 
                                    leftPoint.x + (rightPoint.x - leftPoint.x) / 2 + deltaX,
                                    leftPoint.y + (rightPoint.y - leftPoint.y) / 2 + deltaY, 
                                    zpos 
                                ));
                                points.push(new THREE.Vector3( rightPoint.x, rightPoint.y, zpos ));
                                coneRotate = Math.atan2(
                                    (leftPoint.y - (leftPoint.y + (rightPoint.y - leftPoint.y) / 2 + deltaY)),
                                    (leftPoint.x - (leftPoint.x + (rightPoint.x - leftPoint.x) / 2 + deltaX))
                                );
                                arrowPoints.push(
                                    new THREE.Vector3(
                                        leftPoint.x - arrowSize * Math.cos(coneRotate - arrowSharpness),
                                        leftPoint.y - arrowSize * Math.sin(coneRotate - arrowSharpness),
                                        zpos
                                    )
                                );
                                arrowPoints.push(
                                    new THREE.Vector3(leftPoint.x, leftPoint.y, zpos)
                                );
                                arrowPoints.push(
                                    new THREE.Vector3(
                                        leftPoint.x - arrowSize * Math.cos(coneRotate + arrowSharpness),
                                        leftPoint.y - arrowSize * Math.sin(coneRotate + arrowSharpness),
                                        zpos
                                    )
                                );
                            }
                            let afterSplineGeometry = new THREE.Geometry().setFromPoints(new THREE.CatmullRomCurve3(points).getPoints(50));
                            let afterMeshLine = new MeshLine.MeshLine();
                            afterMeshLine.setGeometry(afterSplineGeometry);
                            let afterMeshLineMaterial = new MeshLine.MeshLineMaterial({
                                color: new THREE.Color(
                                    'hsl(' + 
                                    this.clusterColors[afterClusterIdx][0] + ', 50%, 50%)'
                                ),
                                lineWidth: 0.3
                            });
                            let afterMesh = new THREE.Mesh(afterMeshLine.geometry, afterMeshLineMaterial);
                            let arrowGeometry = new THREE.Geometry().setFromPoints(arrowPoints);
                            let arrowMeshLine = new MeshLine.MeshLine();
                            arrowMeshLine.setGeometry(arrowGeometry);
                            let afterArrowMesh = new THREE.Mesh(arrowMeshLine.geometry, afterMeshLineMaterial);
                            let afterLabel = new TextSprite({
                                alignment: 'center',
                                color: 'hsl(' + this.clusterColors[afterClusterIdx][0] + ', 50%, 50%)',
                                fontFamily: 'Arial, Helvetica, sans-serif',
                                textSize: 0.5,
                                text: String(clusterAfter[afterClusterIdx][beforeClusterIdx])
                            });
                            afterLabel.name = 'afterTransition_' + afterClusterIdx + '_' + beforeClusterIdx;
                            afterLabel.position.set(
                                leftPoint.x + (rightPoint.x - leftPoint.x) / 2 + deltaX,
                                leftPoint.y + (rightPoint.y - leftPoint.y) / 2 + deltaY - shiftSize / 2, 
                                zpos
                            );
                            this.correlationPathGroupRight.add(afterMesh);
                            this.correlationPathGroupRight.add(afterArrowMesh);
                            this.correlationPathGroupRight.add(afterLabel);
                        }
                    } else {
                        // connect bottom-left/right-top
                        let leftIdx = (this.tubeCoords[i].x < this.tubeCoords[j].x)? i: j,
                            rightIdx = (this.tubeCoords[i].x >= this.tubeCoords[j].x)? i: j,
                            topIdx = (this.tubeCoords[i].y > this.tubeCoords[j].y)? i: j,
                            bottomIdx = (this.tubeCoords[i].y <= this.tubeCoords[j].y)? i: j;
                        let beforeClusterIdx = Math.min(leftIdx, rightIdx);
                        let afterClusterIdx = Math.max(leftIdx, rightIdx);
                        let baryCenterX = this.tubeCoords[leftIdx].x + (this.tubeCoords[rightIdx].x - this.tubeCoords[leftIdx].x) / 2;
                        if (baryCenterX > 0) {
                            // the tubes are located in the left side of the view
                            // right top/right bottom 
                            let leftPoint, rightPoint;
                            if (leftIdx === topIdx) {
                                // right top
                                leftPoint = {
                                    x: this.tubeCoords[leftIdx].x + axisSize / 2,
                                    y: this.tubeCoords[leftIdx].y
                                };
                                rightPoint = {
                                    x: this.tubeCoords[rightIdx].x,
                                    y: this.tubeCoords[rightIdx].y + axisSize / 2
                                };
                            } else if (rightIdx === topIdx) {
                                // right bottom
                                leftPoint = {
                                    x: this.tubeCoords[leftIdx].x + axisSize / 2,
                                    y: this.tubeCoords[leftIdx].y
                                };
                                rightPoint = {
                                    x: this.tubeCoords[rightIdx].x,
                                    y: this.tubeCoords[rightIdx].y - axisSize / 2
                                };
                            } 
                            let shiftSize = 2;
                            let normalTilt = -1 * (rightPoint.x - leftPoint.x) / (rightPoint.y - leftPoint.y);
                            let deltaX = Math.sqrt(shiftSize * shiftSize / (1 + normalTilt * normalTilt));
                            let deltaY = normalTilt * deltaX;
                            if (clusterBefore[afterClusterIdx][beforeClusterIdx] > 0) {
                                let conePos = {x: 0, y: 0}, coneRotate = 0;
                                let points = [], arrowPoints = [];
                                if (afterClusterIdx === leftIdx) {
                                    points.push(new THREE.Vector3( leftPoint.x, leftPoint.y, zpos ));
                                    points.push(new THREE.Vector3( 
                                        leftPoint.x + (rightPoint.x - leftPoint.x) / 2 - deltaX,
                                        leftPoint.y + (rightPoint.y - leftPoint.y) / 2 - deltaY, 
                                        zpos
                                    ));
                                    points.push(new THREE.Vector3( rightPoint.x, rightPoint.y, zpos ));
                                    coneRotate = Math.atan2(
                                        (leftPoint.y - (leftPoint.y + (rightPoint.y - leftPoint.y) / 2 - deltaY)),
                                        (leftPoint.x - (leftPoint.x + (rightPoint.x - leftPoint.x) / 2 - deltaX))
                                    );
                                    arrowPoints.push(
                                        new THREE.Vector3(
                                            leftPoint.x - arrowSize * Math.cos(coneRotate - arrowSharpness),
                                            leftPoint.y - arrowSize * Math.sin(coneRotate - arrowSharpness),
                                            zpos
                                        )
                                    );
                                    arrowPoints.push(
                                        new THREE.Vector3(leftPoint.x, leftPoint.y, zpos)
                                    );
                                    arrowPoints.push(
                                        new THREE.Vector3(
                                            leftPoint.x - arrowSize * Math.cos(coneRotate + arrowSharpness),
                                            leftPoint.y - arrowSize * Math.sin(coneRotate + arrowSharpness),
                                            zpos
                                        )
                                    );
                                } else if (afterClusterIdx === rightIdx) {
                                    // right is the goal of the path
                                    points.push(new THREE.Vector3( leftPoint.x, leftPoint.y, zpos ));
                                    points.push(new THREE.Vector3( 
                                        leftPoint.x + (rightPoint.x - leftPoint.x) / 2 - deltaX,
                                        leftPoint.y + (rightPoint.y - leftPoint.y) / 2 - deltaY, 
                                        zpos
                                    ));
                                    points.push(new THREE.Vector3( rightPoint.x, rightPoint.y, zpos ));
                                    coneRotate = Math.atan2(
                                        (rightPoint.y - (leftPoint.y + (rightPoint.y - leftPoint.y) / 2 - deltaY)), 
                                        (rightPoint.x - (leftPoint.x + (rightPoint.x - leftPoint.x) / 2 - deltaX))
                                    );
                                    arrowPoints.push(
                                        new THREE.Vector3(
                                            rightPoint.x - arrowSize * Math.cos(coneRotate - arrowSharpness),
                                            rightPoint.y - arrowSize * Math.sin(coneRotate - arrowSharpness),
                                            zpos
                                        )
                                    );
                                    arrowPoints.push(
                                        new THREE.Vector3(rightPoint.x, rightPoint.y, zpos)
                                    );
                                    arrowPoints.push(
                                        new THREE.Vector3(
                                            rightPoint.x - arrowSize * Math.cos(coneRotate + arrowSharpness),
                                            rightPoint.y - arrowSize * Math.sin(coneRotate + arrowSharpness),
                                            zpos
                                        )
                                    );
                                }
                                let beforeSplineGeometry = new THREE.Geometry().setFromPoints(new THREE.CatmullRomCurve3(points).getPoints(50));
                                let beforeMeshLine = new MeshLine.MeshLine();
                                beforeMeshLine.setGeometry(beforeSplineGeometry);
                                // beforeMeshLine.setPoints(beforeSplineGeometry, p => 2);
                                let beforeMeshLineMaterial = new MeshLine.MeshLineMaterial({
                                    color: new THREE.Color(
                                        'hsl(' + 
                                        this.clusterColors[beforeClusterIdx][0] + ', 50%, 50%)'
                                    ),
                                    lineWidth: 0.3
                                });
                                let beforeMesh = new THREE.Mesh(beforeMeshLine.geometry, beforeMeshLineMaterial);
                                let arrowGeometry = new THREE.Geometry().setFromPoints(arrowPoints);
                                let arrowMeshLine = new MeshLine.MeshLine();
                                arrowMeshLine.setGeometry(arrowGeometry);
                                let beforeArrowMesh = new THREE.Mesh(arrowMeshLine.geometry, beforeMeshLineMaterial);
                                let beforeLabel = new TextSprite({
                                    alignment: 'center',
                                    color: 'hsl(' + this.clusterColors[beforeClusterIdx][0] + ', 50%, 50%)',
                                    fontFamily: 'Arial, Helvetica, sans-serif',
                                    textSize: 0.5,
                                    text: String(clusterBefore[afterClusterIdx][beforeClusterIdx])
                                });
                                beforeLabel.name = 'beforeTransition_' + afterClusterIdx + '_' + beforeClusterIdx;
                                if (leftIdx === topIdx) {
                                    beforeLabel.position.set(
                                        leftPoint.x + (rightPoint.x - leftPoint.x) / 2 - deltaX,
                                        leftPoint.y + (rightPoint.y - leftPoint.y) / 2 - deltaY - shiftSize / 2, 
                                        zpos   
                                    );
                                } else {
                                    beforeLabel.position.set(
                                        leftPoint.x + (rightPoint.x - leftPoint.x) / 2 - deltaX,
                                        leftPoint.y + (rightPoint.y - leftPoint.y) / 2 - deltaY + shiftSize / 2, 
                                        zpos   
                                    );
                                }
                                this.correlationPathGroupLeft.add(beforeMesh);
                                this.correlationPathGroupLeft.add(beforeArrowMesh);
                                this.correlationPathGroupLeft.add(beforeLabel);
                            }
                            if (clusterAfter[afterClusterIdx][beforeClusterIdx] > 0) {
                                let conePos = {x: 0, y: 0}, coneRotate = 0;
                                let points = [], arrowPoints = [];
                                if (afterClusterIdx === leftIdx) {
                                    // right is the goal of the path
                                    points.push(new THREE.Vector3( leftPoint.x, leftPoint.y, zpos ));
                                    points.push(new THREE.Vector3( 
                                        leftPoint.x + (rightPoint.x - leftPoint.x) / 2 + deltaX,
                                        leftPoint.y + (rightPoint.y - leftPoint.y) / 2 + deltaY, 
                                        zpos 
                                    ));
                                    points.push(new THREE.Vector3( rightPoint.x, rightPoint.y, zpos ));
                                    coneRotate = Math.atan2(
                                        (rightPoint.y - (leftPoint.y + (rightPoint.y - leftPoint.y) / 2 + deltaY)), 
                                        (rightPoint.x - (leftPoint.x + (rightPoint.x - leftPoint.x) / 2 + deltaX))
                                    );
                                    arrowPoints.push(
                                        new THREE.Vector3(
                                            rightPoint.x - arrowSize * Math.cos(coneRotate - arrowSharpness),
                                            rightPoint.y - arrowSize * Math.sin(coneRotate - arrowSharpness),
                                            zpos
                                        )
                                    );
                                    arrowPoints.push(
                                        new THREE.Vector3(rightPoint.x, rightPoint.y, zpos)
                                    );
                                    arrowPoints.push(
                                        new THREE.Vector3(
                                            rightPoint.x - arrowSize * Math.cos(coneRotate + arrowSharpness),
                                            rightPoint.y - arrowSize * Math.sin(coneRotate + arrowSharpness),
                                            zpos
                                        )
                                    );
                                } else if (afterClusterIdx === rightIdx) {
                                    // left is the goal of the path
                                    points.push(new THREE.Vector3( leftPoint.x, leftPoint.y, zpos ));
                                    points.push(new THREE.Vector3( 
                                        leftPoint.x + (rightPoint.x - leftPoint.x) / 2 + deltaX,
                                        leftPoint.y + (rightPoint.y - leftPoint.y) / 2 + deltaY, 
                                        zpos
                                    ));
                                    points.push(new THREE.Vector3( rightPoint.x, rightPoint.y, zpos ));
                                    coneRotate = Math.atan2(
                                        (leftPoint.y - (leftPoint.y + (rightPoint.y - leftPoint.y) / 2 + deltaY)),
                                        (leftPoint.x - (leftPoint.x + (rightPoint.x - leftPoint.x) / 2 + deltaX))
                                    );
                                    arrowPoints.push(
                                        new THREE.Vector3(
                                            leftPoint.x - arrowSize * Math.cos(coneRotate - arrowSharpness),
                                            leftPoint.y - arrowSize * Math.sin(coneRotate - arrowSharpness),
                                            zpos
                                        )
                                    );
                                    arrowPoints.push(
                                        new THREE.Vector3(leftPoint.x, leftPoint.y, zpos)
                                    );
                                    arrowPoints.push(
                                        new THREE.Vector3(
                                            leftPoint.x - arrowSize * Math.cos(coneRotate + arrowSharpness),
                                            leftPoint.y - arrowSize * Math.sin(coneRotate + arrowSharpness),
                                            zpos
                                        )
                                    );
                                }
                                let afterSplineGeometry = new THREE.Geometry().setFromPoints(new THREE.CatmullRomCurve3(points).getPoints(50));
                                let afterMeshLine = new MeshLine.MeshLine();
                                afterMeshLine.setGeometry(afterSplineGeometry);
                                let afterMeshLineMaterial = new MeshLine.MeshLineMaterial({
                                    color: new THREE.Color(
                                        'hsl(' + 
                                        this.clusterColors[afterClusterIdx][0] + ', 50%, 50%)'
                                    ),
                                    lineWidth: 0.3
                                });
                                let afterMesh = new THREE.Mesh(afterMeshLine.geometry, afterMeshLineMaterial);
                                let arrowGeometry = new THREE.Geometry().setFromPoints(arrowPoints);
                                let arrowMeshLine = new MeshLine.MeshLine();
                                arrowMeshLine.setGeometry(arrowGeometry);
                                let afterArrowMesh = new THREE.Mesh(arrowMeshLine.geometry, afterMeshLineMaterial);
                                let afterLabel = new TextSprite({
                                    alignment: 'center',
                                    color: 'hsl(' + this.clusterColors[afterClusterIdx][0] + ', 50%, 50%)',
                                    fontFamily: 'Arial, Helvetica, sans-serif',
                                    textSize: 0.5,
                                    text: String(clusterAfter[afterClusterIdx][beforeClusterIdx])
                                });
                                afterLabel.name = 'afterTransition_' + afterClusterIdx + '_' + beforeClusterIdx;
                                if (leftIdx === topIdx) {
                                    afterLabel.position.set(
                                        leftPoint.x + (rightPoint.x - leftPoint.x) / 2 + deltaX,
                                        leftPoint.y + (rightPoint.y - leftPoint.y) / 2 + deltaY + shiftSize / 2, 
                                        zpos   
                                    );
                                } else {
                                    afterLabel.position.set(
                                        leftPoint.x + (rightPoint.x - leftPoint.x) / 2 + deltaX,
                                        leftPoint.y + (rightPoint.y - leftPoint.y) / 2 + deltaY - shiftSize / 2, 
                                        zpos   
                                    );
                                }
                                this.correlationPathGroupRight.add(afterMesh);
                                this.correlationPathGroupRight.add(afterArrowMesh);
                                this.correlationPathGroupRight.add(afterLabel);
                            }
                        } else if (0 >= baryCenterX) {
                            // the tubes are located in the right side of the view
                            // bottom left/top left
                            let leftPoint, rightPoint;
                            if (leftIdx === topIdx) {
                                // bottom left
                                leftPoint = {
                                    x: this.tubeCoords[leftIdx].x,
                                    y: this.tubeCoords[leftIdx].y - axisSize / 2
                                };
                                rightPoint = {
                                    x: this.tubeCoords[rightIdx].x - axisSize / 2,
                                    y: this.tubeCoords[rightIdx].y
                                };
                            } else if (rightIdx === topIdx) {
                                // top left
                                leftPoint = {
                                    x: this.tubeCoords[leftIdx].x,
                                    y: this.tubeCoords[leftIdx].y + axisSize / 2
                                };
                                rightPoint = {
                                    x: this.tubeCoords[rightIdx].x - axisSize / 2,
                                    y: this.tubeCoords[rightIdx].y
                                };
                            }
                            let shiftSize = 2;
                            let normalTilt = -1 * (rightPoint.x - leftPoint.x) / (rightPoint.y - leftPoint.y);
                            let deltaX = Math.sqrt(shiftSize * shiftSize / (1 + normalTilt * normalTilt));
                            let deltaY = normalTilt * deltaX;
                            let beforeClusterIdx = Math.min(leftIdx, rightIdx);
                            let afterClusterIdx = Math.max(leftIdx, rightIdx);
                            if (clusterBefore[afterClusterIdx][beforeClusterIdx] > 0) {
                                let conePos = {x: 0, y: 0}, coneRotate = 0;
                                let points = [], arrowPoints = [];
                                if (afterClusterIdx === leftIdx) {
                                    // left is the goal of the path
                                    points.push(new THREE.Vector3( leftPoint.x, leftPoint.y, zpos ));
                                    points.push(new THREE.Vector3( 
                                        leftPoint.x + (rightPoint.x - leftPoint.x) / 2 - deltaX,
                                        leftPoint.y + (rightPoint.y - leftPoint.y) / 2 - deltaY, 
                                        zpos 
                                    ));
                                    points.push(new THREE.Vector3( rightPoint.x, rightPoint.y, zpos ));
                                    coneRotate = Math.atan2(
                                        (leftPoint.y - (leftPoint.y + (rightPoint.y - leftPoint.y) / 2 - deltaY)),
                                        (leftPoint.x - (leftPoint.x + (rightPoint.x - leftPoint.x) / 2 - deltaX))
                                    );
                                    arrowPoints.push(
                                        new THREE.Vector3(
                                            leftPoint.x - arrowSize * Math.cos(coneRotate - arrowSharpness),
                                            leftPoint.y - arrowSize * Math.sin(coneRotate - arrowSharpness),
                                            zpos
                                        )
                                    );
                                    arrowPoints.push(
                                        new THREE.Vector3(leftPoint.x, leftPoint.y, zpos)
                                    );
                                    arrowPoints.push(
                                        new THREE.Vector3(
                                            leftPoint.x - arrowSize * Math.cos(coneRotate + arrowSharpness),
                                            leftPoint.y - arrowSize * Math.sin(coneRotate + arrowSharpness),
                                            zpos
                                        )
                                    );
                                } else if (afterClusterIdx === rightIdx) {
                                    // right is the goal of the path
                                    points.push(new THREE.Vector3( leftPoint.x, leftPoint.y, zpos ));
                                    points.push(new THREE.Vector3( 
                                        leftPoint.x + (rightPoint.x - leftPoint.x) / 2 - deltaX,
                                        leftPoint.y + (rightPoint.y - leftPoint.y) / 2 - deltaY, 
                                        zpos 
                                    ));
                                    points.push(new THREE.Vector3( rightPoint.x, rightPoint.y, zpos ));
                                    coneRotate = Math.atan2(
                                        (rightPoint.y - (leftPoint.y + (rightPoint.y - leftPoint.y) / 2 - deltaY)), 
                                        (rightPoint.x - (leftPoint.x + (rightPoint.x - leftPoint.x) / 2 - deltaX))
                                    );
                                    arrowPoints.push(
                                        new THREE.Vector3(
                                            rightPoint.x - arrowSize * Math.cos(coneRotate - arrowSharpness),
                                            rightPoint.y - arrowSize * Math.sin(coneRotate - arrowSharpness),
                                            zpos
                                        )
                                    );
                                    arrowPoints.push(
                                        new THREE.Vector3(rightPoint.x, rightPoint.y, zpos)
                                    );
                                    arrowPoints.push(
                                        new THREE.Vector3(
                                            rightPoint.x - arrowSize * Math.cos(coneRotate + arrowSharpness),
                                            rightPoint.y - arrowSize * Math.sin(coneRotate + arrowSharpness),
                                            zpos
                                        )
                                    );
                                }
                                let beforeSplineGeometry = new THREE.Geometry().setFromPoints(new THREE.CatmullRomCurve3(points).getPoints(50));
                                let beforeMeshLine = new MeshLine.MeshLine();
                                beforeMeshLine.setGeometry(beforeSplineGeometry);
                                let beforeMeshLineMaterial = new MeshLine.MeshLineMaterial({
                                    color: new THREE.Color(
                                        'hsl(' + 
                                        this.clusterColors[beforeClusterIdx][0] + ', 50%, 50%)'
                                    ),
                                    lineWidth: 0.3
                                });
                                let beforeMesh = new THREE.Mesh(beforeMeshLine.geometry, beforeMeshLineMaterial);
                                let arrowGeometry = new THREE.Geometry().setFromPoints(arrowPoints);
                                let arrowMeshLine = new MeshLine.MeshLine();
                                arrowMeshLine.setGeometry(arrowGeometry);
                                let beforeArrowMesh = new THREE.Mesh(arrowMeshLine.geometry, beforeMeshLineMaterial);
                                let beforeLabel = new TextSprite({
                                    alignment: 'center',
                                    color: 'hsl(' + this.clusterColors[beforeClusterIdx][0] + ', 50%, 50%)',
                                    fontFamily: 'Arial, Helvetica, sans-serif',
                                    textSize: 0.5,
                                    text: String(clusterBefore[afterClusterIdx][beforeClusterIdx])
                                });
                                beforeLabel.name = 'beforeTransition_' + afterClusterIdx + '_' + beforeClusterIdx;
                                if (rightIdx === topIdx) {
                                    beforeLabel.position.set(
                                        leftPoint.x + (rightPoint.x - leftPoint.x) / 2 - deltaX,
                                        leftPoint.y + (rightPoint.y - leftPoint.y) / 2 - deltaY + shiftSize / 2, 
                                        zpos 
                                    );
                                } else {
                                    beforeLabel.position.set(
                                        leftPoint.x + (rightPoint.x - leftPoint.x) / 2 - deltaX,
                                        leftPoint.y + (rightPoint.y - leftPoint.y) / 2 - deltaY - shiftSize / 2, 
                                        zpos 
                                    );
                                }
                                this.correlationPathGroupLeft.add(beforeMesh);
                                this.correlationPathGroupLeft.add(beforeArrowMesh);
                                this.correlationPathGroupLeft.add(beforeLabel);
                            }

                            if (clusterAfter[afterClusterIdx][beforeClusterIdx] > 0) {
                                let conePos = {x: 0, y: 0}, coneRotate = 0;
                                let points = [], arrowPoints = [];
                                if (afterClusterIdx === leftIdx) {
                                    // right is the goal of the path
                                    points.push(new THREE.Vector3( leftPoint.x, leftPoint.y, zpos ));
                                    points.push(new THREE.Vector3( 
                                        leftPoint.x + (rightPoint.x - leftPoint.x) / 2 + deltaX,
                                        leftPoint.y + (rightPoint.y - leftPoint.y) / 2 + deltaY, 
                                        zpos
                                    ));
                                    points.push(new THREE.Vector3( rightPoint.x, rightPoint.y, zpos ));
                                    coneRotate = Math.atan2(
                                        (rightPoint.y - (leftPoint.y + (rightPoint.y - leftPoint.y) / 2 + deltaY)), 
                                        (rightPoint.x - (leftPoint.x + (rightPoint.x - leftPoint.x) / 2 + deltaX))
                                    );
                                    arrowPoints.push(
                                        new THREE.Vector3(
                                            rightPoint.x - arrowSize * Math.cos(coneRotate - arrowSharpness),
                                            rightPoint.y - arrowSize * Math.sin(coneRotate - arrowSharpness),
                                            zpos
                                        )
                                    );
                                    arrowPoints.push(
                                        new THREE.Vector3(rightPoint.x, rightPoint.y, zpos)
                                    );
                                    arrowPoints.push(
                                        new THREE.Vector3(
                                            rightPoint.x - arrowSize * Math.cos(coneRotate + arrowSharpness),
                                            rightPoint.y - arrowSize * Math.sin(coneRotate + arrowSharpness),
                                            zpos
                                        )
                                    );
                                } else if (afterClusterIdx === rightIdx) {
                                    // left is the goal of the path
                                    points.push(new THREE.Vector3( leftPoint.x, leftPoint.y, zpos ));
                                    points.push(new THREE.Vector3( 
                                        leftPoint.x + (rightPoint.x - leftPoint.x) / 2 + deltaX,
                                        leftPoint.y + (rightPoint.y - leftPoint.y) / 2 + deltaY, 
                                        zpos 
                                    ));
                                    points.push(new THREE.Vector3( rightPoint.x, rightPoint.y, zpos ));
                                    coneRotate = Math.atan2(
                                        (leftPoint.y - (leftPoint.y + (rightPoint.y - leftPoint.y) / 2 + deltaY)),
                                        (leftPoint.x - (leftPoint.x + (rightPoint.x - leftPoint.x) / 2 + deltaX))
                                    );
                                    arrowPoints.push(
                                        new THREE.Vector3(
                                            leftPoint.x - arrowSize * Math.cos(coneRotate - arrowSharpness),
                                            leftPoint.y - arrowSize * Math.sin(coneRotate - arrowSharpness),
                                            zpos
                                        )
                                    );
                                    arrowPoints.push(
                                        new THREE.Vector3(leftPoint.x, leftPoint.y, zpos)
                                    );
                                    arrowPoints.push(
                                        new THREE.Vector3(
                                            leftPoint.x - arrowSize * Math.cos(coneRotate + arrowSharpness),
                                            leftPoint.y - arrowSize * Math.sin(coneRotate + arrowSharpness),
                                            zpos
                                        )
                                    );
                                }
                                let afterSplineGeometry = new THREE.Geometry().setFromPoints(new THREE.CatmullRomCurve3(points).getPoints(50));
                                let afterMeshLine = new MeshLine.MeshLine();
                                afterMeshLine.setGeometry(afterSplineGeometry);
                                let afterMeshLineMaterial = new MeshLine.MeshLineMaterial({
                                    color: new THREE.Color(
                                        'hsl(' + 
                                        this.clusterColors[afterClusterIdx][0] + ', 50%, 50%)'
                                    ),
                                    lineWidth: 0.3
                                });
                                let afterMesh = new THREE.Mesh(afterMeshLine.geometry, afterMeshLineMaterial);
                                let arrowGeometry = new THREE.Geometry().setFromPoints(arrowPoints);
                                let arrowMeshLine = new MeshLine.MeshLine();
                                arrowMeshLine.setGeometry(arrowGeometry);
                                let afterArrowMesh = new THREE.Mesh(arrowMeshLine.geometry, afterMeshLineMaterial);
                                let afterLabel = new TextSprite({
                                    alignment: 'center',
                                    color: 'hsl(' + this.clusterColors[afterClusterIdx][0] + ', 50%, 50%)',
                                    fontFamily: 'Arial, Helvetica, sans-serif',
                                    textSize: 0.5,
                                    text: String(clusterAfter[afterClusterIdx][beforeClusterIdx])
                                });
                                afterLabel.name = 'afterTransition_' + afterClusterIdx + '_' + beforeClusterIdx;
                                if (rightIdx === topIdx) {
                                    afterLabel.position.set(
                                        leftPoint.x + (rightPoint.x - leftPoint.x) / 2 + deltaX,
                                        leftPoint.y + (rightPoint.y - leftPoint.y) / 2 + deltaY - shiftSize / 2, 
                                        zpos    
                                    );
                                } else {
                                    afterLabel.position.set(
                                        leftPoint.x + (rightPoint.x - leftPoint.x) / 2 + deltaX,
                                        leftPoint.y + (rightPoint.y - leftPoint.y) / 2 + deltaY + shiftSize / 2, 
                                        zpos    
                                    );
                                }
                                this.correlationPathGroupRight.add(afterMesh);
                                this.correlationPathGroupRight.add(afterArrowMesh);
                                this.correlationPathGroupRight.add(afterLabel);
                            }
                        }
                    }
                }
            }
        }
        this.scene.add(this.correlationPathGroupLeft);
        this.scene.add(this.correlationPathGroupRight);
        this.correlationPathGroupLeft.visible = this.state.interclusterTransitions.left;
        this.correlationPathGroupRight.visible = this.state.interclusterTransitions.right;
    }

    computeTubePositions() {
        this.tubeCoords = [];
        this.gridSize = undefined;
        let clustersCoord = ClusteringStore.getResultsCoordinates().clustersCoord;
        if (clustersCoord) {
            let xPosMinMax = [Infinity, -Infinity],
                yPosMinMax = [Infinity, -Infinity];
            let minDistBetweenClusters = Infinity;
            for (let i = 0; i < clustersCoord.length; i++) {
                if (clustersCoord[i][0] < xPosMinMax[0]) {
                    xPosMinMax[0] = clustersCoord[i][0];
                }
                if (xPosMinMax[1] < clustersCoord[i][0]) {
                    xPosMinMax[1] = clustersCoord[i][0];
                }
                if (clustersCoord[i][1] < yPosMinMax[0]) {
                    yPosMinMax[0] = clustersCoord[i][1];
                }
                if (yPosMinMax[1] < clustersCoord[i][1]) {
                    yPosMinMax[1] = clustersCoord[i][1];
                }
                for (let j = i + 1; j < clustersCoord.length; j++) {
                    let dist = Math.sqrt(Math.pow(clustersCoord[i][0] - clustersCoord[j][0], 2) + Math.pow(clustersCoord[i][1] - clustersCoord[j][1], 2));
                    if (dist < minDistBetweenClusters) {
                        minDistBetweenClusters = dist;
                    }
                }
            }
            let width = $('#clusteringResultsOverview').width();
            let height = $('#clusteringResultsOverview').height();
            let aspect = width / height;
            let yRange = Math.max(Math.abs(xPosMinMax[1] - xPosMinMax[0]) / aspect, Math.abs(yPosMinMax[1] - yPosMinMax[0]));
            let xRange = yRange * aspect;
            let viewportSize = ClusteringStore.getViewportSize() * 0.8;
            let xAreaSize = (width > height)? ClusteringStore.getViewportSize() * 0.9 * aspect: viewportSize,
                yAreaSize = (width < height)? ClusteringStore.getViewportSize() * 0.9 / aspect: viewportSize;
            let ratio = viewportSize * 2 / (height < width? yRange: xRange);
            if (minDistBetweenClusters * ratio < ClusteringStore.getGridSize() * 2) {
                this.gridSize = minDistBetweenClusters * ratio / 2;
            }
            // if the grid size is too small, rearrange the position of cluster centers a bit by force layout
            if (this.gridSize < this.minGridSize) {
                this.gridSize = this.minGridSize;
                let xShift = (xPosMinMax[1] - (xPosMinMax[1] - xPosMinMax[0]) / 2) * -1 * ratio,
                    yShift = (yPosMinMax[1] - (yPosMinMax[1] - yPosMinMax[0]) / 2) * -1 * ratio;
                for (let i = 0; i < clustersCoord.length; i++) {
                    this.tubeCoords.push({x: xShift + clustersCoord[i][0] * ratio, y: yShift + clustersCoord[i][1] * ratio});
                }

                let distBetweenClusters = []
                for (let i = 0; i < clustersCoord.length; i++) {
                    distBetweenClusters.push([]);
                    for (let j = 0; j < clustersCoord.length; j++) {
                        distBetweenClusters[i].push(0);
                    }
                }
                for (let i = 0; i < this.tubeCoords.length; i++) {
                    for (let j = i + 1; j < this.tubeCoords.length; j++) {
                        let dist = Math.sqrt(
                            Math.pow(
                                this.tubeCoords[i].x - this.tubeCoords[j].x, 2) + 
                            Math.pow(
                                this.tubeCoords[i].y - this.tubeCoords[j].y, 2)
                        );
                        distBetweenClusters[i][j] = dist;
                        distBetweenClusters[j][i] = dist;
                        if (dist < minDistBetweenClusters) {
                            minDistBetweenClusters = dist;
                        }
                    }
                }
                let overlappingFlag = true, loop = 0;
                let overlappingGroups = [];
                while (overlappingFlag && loop < 10) {
                    // step 1: find groups of overlapping plots
                    let i = 0;
                    while(i < distBetweenClusters.length - 1) {
                        overlappingGroups = [];
                        findOverlappingPoints(i);
                        if (overlappingGroups.length > 0) {
                            overlappingGroups.push(i);
                            overlappingGroups = Array.from(new Set(overlappingGroups));
                            let overlappingTubeCoords = [];
                            for (let j = 0; j < overlappingGroups.length; j++) {
                                let coordsTmp = Object.assign({}, this.tubeCoords[overlappingGroups[j]]);
                                coordsTmp.idx = overlappingGroups[j];
                                overlappingTubeCoords.push(coordsTmp);
                            }
                            // step 2: compute barycenter of the overlapping group
                            let barycenter = {x: 0, y: 0};
                            if (overlappingGroups.length >= 3) {
                                // compute barycenter step by step
                                overlappingTubeCoords.sort((a, b) => {
                                    return a.x < b.x? -1: 1;
                                });
                                let coords = overlappingTubeCoords;
                                while (coords.length !== 1) {
                                    let coordsTmp = [];
                                    for (let j = 1; j < coords.length - 1; j++) {
                                        coordsTmp.push(
                                            computeBarycenter(
                                                coords[0], 
                                                coords[j], 
                                                coords[j + 1]
                                            )
                                        );
                                    }
                                    coords = coordsTmp;
                                }
                                barycenter = coords;
                            } else {
                                for (let j = 0; j < overlappingTubeCoords.length; j++) {
                                    barycenter.x += overlappingTubeCoords[j].x;
                                    barycenter.y += overlappingTubeCoords[j].y;
                                }
                                barycenter.x /= overlappingTubeCoords.length;
                                barycenter.y /= overlappingTubeCoords.length;
                            }
                            // step 3: find the maximum overlapping pair
                            let minBetweenDist = Infinity,
                                maxOverlappingPair = [-1, -1];
                            for (let j = 0; j < overlappingGroups.length - 1; j++) {
                                for (let k = j + 1; k < overlappingGroups.length; k++) {
                                    if (distBetweenClusters[j][k] < minBetweenDist) {
                                        minBetweenDist = distBetweenClusters[j][k];
                                        maxOverlappingPair = [j, k];
                                    }
                                }
                            }
                            // step 4: compute shift size of each plot
                            let magRate = 2 * this.minGridSize / minDistBetweenClusters;
                            
                            // step 5: update this.tubeCoords
                            let xOver = 0, yOver = 0;
                            for (let j = 0; j < overlappingGroups.length; j++) {
                                this.tubeCoords[overlappingGroups[j]].x *= magRate;
                                this.tubeCoords[overlappingGroups[j]].y *= magRate;
                                if (Math.abs(this.tubeCoords[overlappingGroups[j]].x) > xAreaSize) {
                                    if (this.tubeCoords[overlappingGroups[j]].x >= 0) {
                                        let xOverTmp = this.tubeCoords[overlappingGroups[j]].x - xAreaSize;
                                        if (xOver < xOverTmp) 
                                            xOver = xOverTmp;
                                    } else {
                                        let xOverTmp = this.tubeCoords[overlappingGroups[j]].x + xAreaSize;
                                        if (xOverTmp < xOver) 
                                            xOver = xOverTmp;
                                    }
                                }
                                if (Math.abs(this.tubeCoords[overlappingGroups[j]].y) > yAreaSize) {
                                    if (this.tubeCoords[overlappingGroups[j]].y >= 0) {
                                        let yOverTmp = this.tubeCoords[overlappingGroups[j]].y - yAreaSize;
                                        if (yOver < yOverTmp) 
                                            yOver = yOverTmp;
                                    } else {
                                        let yOverTmp = this.tubeCoords[overlappingGroups[j]].y + yAreaSize;
                                        if (yOverTmp < yOver) 
                                            yOver = yOverTmp;
                                    }
                                }
                            }
                            // step 6: shift the coordinates if needed
                            if (xOver !== 0 || yOver !== 0) {
                                for (let j = 0; j < overlappingGroups.length; j++) {
                                    if (xOver !== 0) this.tubeCoords[overlappingGroups[j]].x -= xOver;
                                    if (yOver !== 0) this.tubeCoords[overlappingGroups[j]].y -= yOver;
                                }
                            }

                            // step 7: update distBetweenClusters
                            for (let j = 0; j < this.tubeCoords.length; j++) {
                                for (let k = j + 1; k < this.tubeCoords.length; k++) {
                                    let dist = Math.sqrt(
                                        Math.pow(
                                            this.tubeCoords[j].x - this.tubeCoords[k].x, 2) + 
                                        Math.pow(
                                            this.tubeCoords[j].y - this.tubeCoords[k].y, 2)
                                    );
                                    distBetweenClusters[j][k] = dist;
                                    distBetweenClusters[k][j] = dist;
                                    if (dist < minDistBetweenClusters) {
                                        minDistBetweenClusters = dist;
                                    }
                                }
                            }
                            // step 8: check whether there are overlapping plots
                            if (this.minGridSize < minDistBetweenClusters) {
                                overlappingFlag = false;
                                break;
                            }
                        }
                        i++;
                    }
                    if (i >= distBetweenClusters.length - 1 && overlappingGroups.length === 0) {
                        overlappingFlag = false;
                    }
                    loop++;
                }
                this.range = this.gridSize * this.range / ClusteringStore.getGridSize();
                function findOverlappingPoints(pivot) {
                    for (let j = pivot + 1; j < distBetweenClusters[pivot].length; j++) {
                        if (distBetweenClusters[pivot][j] < 6) {
                            overlappingGroups.push(j);
                            findOverlappingPoints(j);
                        }
                    }
                }
                function computeBarycenter(a, b, c) {
                    return {x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3};
                }
            } else {
                this.range = this.gridSize * this.range / ClusteringStore.getGridSize();
                let xShift = (xPosMinMax[1] - (xPosMinMax[1] - xPosMinMax[0]) / 2) * -1 * ratio,
                    yShift = (yPosMinMax[1] - (yPosMinMax[1] - yPosMinMax[0]) / 2) * -1 * ratio;
                for (let i = 0; i < clustersCoord.length; i++) {
                    this.tubeCoords.push({x: xShift + clustersCoord[i][0] * ratio, y: yShift + clustersCoord[i][1] * ratio});
                }
            }
        } else {
            this.gridSize = ClusteringStore.getGridSize();
            let viewportSize = ClusteringStore.getViewportSize() * 0.7;
            for (let i = 0; i < this.clusterCenters.length; i++) {
                let posX = viewportSize * Math.cos(Math.PI * 0.5 - 2 * Math.PI / this.clusterCenters.length * i);
                let posY = viewportSize * Math.sin(Math.PI * 0.5 - 2 * Math.PI / this.clusterCenters.length * i);
                this.tubeCoords.push({x: posX, y: posY});
            }
        }
    }

    drawTubes() {
        // remove previous tubes
        for (let i = 0; i < this.tubes.length; i++) {
            let geometry = this.tubes[i].geometry,
                material = this.tubes[i].material;
            this.scene.remove(this.tubes[i]);
            geometry.dispose();
            material.dispose();
            this.tubes[i] = undefined;
        }
        this.tubes = [];

        let variables = ClusteringStore.getClusteringParameters().variables;
        let dataLen = ClusteringStore.getSubsequenceParameters().isometryLen + 1;
        let divNum = this.division * dataLen;
        let del = Math.PI * 2 / (this.segment - 1);
        let defaultRad = typeof(this.gridSize) === 'undefined'? 0.5: 0.5 * this.gridSize / ClusteringStore.getGridSize();
        for (let i = 0; i < this.splines.length; i++) {
            let tubeGeometry;
            let vertices = [],
                colors = [],
                indices = [];
            let cen = this.splines[i].position.getSpacedPoints(divNum),
                rad = this.splines[i].radius.getSpacedPoints(divNum),
                col = this.splines[i].color.getSpacedPoints(divNum);
            let posX = this.tubeCoords[i].x;
            let posY = this.tubeCoords[i].y;
            if ('r_x' in variables || 'r_y' in variables) {
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
                    let radX = ('r_x' in this.clusterCenters[0][0])? rad[j].x * this.range: defaultRad,
                        radY = ('r_y' in this.clusterCenters[0][0])? rad[j].y * this.range: defaultRad;
                    for (let k = 0; k < this.segment; k++) {
                        for (let l = 0; l < this.tubeNum; l++) {
                            let currad = (1 / this.tubeNum) * (l + 1);
                            let deg = del * k;
                            vertices[l].push((posX + cen[j].x * this.range + currad * radX * Math.cos(deg)) * -1);
                            vertices[l].push(posY + cen[j].y * this.range + currad * radY * Math.sin(deg));
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
                        vertices.push((posX + cen[j].x * this.range + defaultRad * Math.cos(deg)) * -1);
                        vertices.push(posY + cen[j].y * this.range + defaultRad * Math.sin(deg));
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
            let tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
            tube.rotateY(Math.PI);
            this.scene.add(tube);
            this.tubes.push(tube);
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
        
        let axisSize;
        if (typeof(this.gridSize) !== 'undefined') {
            axisSize = this.gridSize * 0.7;
        } else {
            axisSize = ClusteringStore.getGridSize() * 0.7;
        }
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
            this.axes[this.axes.length - 1].translateX(this.tubeCoords[i].x);
            this.axes[this.axes.length - 1].translateY(this.tubeCoords[i].y);
            this.axes[this.axes.length - 1].rotateY(Math.PI);
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

        let axisSize;
        if (typeof(this.gridSize) !== 'undefined') {
            axisSize = this.gridSize * 0.7;
        } else {
            axisSize = ClusteringStore.getGridSize() * 0.7;
        }
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
            let posX = this.tubeCoords[i].x;
            let posY = this.tubeCoords[i].y + axisSize;
            this.labels[this.labels.length - 1].position.set(posX, posY, -3);
            this.scene.add(this.labels[this.labels.length - 1]);
        }
    }

    drawMDSScatterplots() {
        $('#clusteringOverviewMDSScatterplotsSVG').remove();
        if (this.clusterCenters.length > 0) {
            let width = $('#clusteringResultsOverview').width() * this.chartsSize.MDS.width - 15 * 3;
            let appHeaderHeight = $('#appHeader').outerHeight(true);
            let timelineHeight = $('#clusteringTimeline').outerHeight(true);
            let height = (window.innerHeight - appHeaderHeight - timelineHeight) * this.chartsSize.MDS.height;
            let svgPadding = {left: 30, right: 30, top: 30, bottom: 30};
            this.MDSSPSvg = d3.select('#clusteringOverviewMDSScatterplots')
                .append('svg')
                .attr('id', 'clusteringOverviewMDSScatterplotsSVG')
                .attr('width', width)
                .attr('height', height)
                .style('background-color', 'white');

            let clusteringParameters = ClusteringStore.getClusteringParameters();
            let resultsCoords = ClusteringStore.getResultsCoordinates();
            let dataCoords = resultsCoords.dataCoord;
            let clusterCenterCoords;
            if (clusteringParameters.method === 'kmeans' || (clusteringParameters.method === 'kmedoids' && clusteringParameters.medoidDefinition === 'each')) {
                clusterCenterCoords = dataCoords.slice(dataCoords.length - this.clusterCenters.length, dataCoords.length)
            } else {
                clusterCenterCoords = [];
                for (let i = 0; i < resultsCoords.medoidIdx.length; i++) {
                    clusterCenterCoords.push(dataCoords[resultsCoords.medoidIdx[i]]);
                }
            }
            if (clusteringParameters.method === 'kmeans' || (clusteringParameters.method === 'kmedoids' && clusteringParameters.medoidDefinition === 'each')) {
                dataCoords = dataCoords.slice(0, dataCoords.length - this.clusterCenters.length);
            }

            let xMinMax = d3.extent(dataCoords, (d) => {
                return d[0];
            });
            let yMinMax = d3.extent(dataCoords, (d) => {
                return d[1];
            });
            if (width / height < (xMinMax[1] - xMinMax[0]) / (yMinMax[1] - yMinMax[0])) {
                // fit to x axis
                let yValueRange = (xMinMax[1] - xMinMax[0]) / width * height;
                let yRatio = yValueRange / (yMinMax[1] - yMinMax[0]);
                this.xScale = d3.scaleLinear()
                    .domain(xMinMax)
                    .range([svgPadding.left, width - svgPadding.right])
                    .nice();
                this.yScale = d3.scaleLinear()
                    .domain([yMinMax[0] * yRatio, yMinMax[1] * yRatio])
                    .range([height - svgPadding.bottom, svgPadding.top])
                    .nice();
            } else {
                // fit to y axis
                let xValueRange = (yMinMax[1] - yMinMax[0]) / height * width;
                let xRatio = xValueRange / (xMinMax[1] - xMinMax[0]);
                this.xScale = d3.scaleLinear()
                    .domain([xMinMax[0] * xRatio, xMinMax[1] * xRatio])
                    .range([svgPadding.left, width - svgPadding.right])
                    .nice();
                this.yScale = d3.scaleLinear()
                    .domain(yMinMax)
                    .range([height - svgPadding.bottom, svgPadding.top])
                    .nice();
            }
            // let xAxis = d3.axisBottom(this.xScale)
            //     .tickSize(-height + svgPadding.top + svgPadding.bottom);
            // this.xLabel = this.MDSSPSvg.append('g')
            //     .attr('class', 'x_axis')
            //     .attr('transform', 'translate(0,' + (height - svgPadding.bottom) + ')')
            //     .call(xAxis);
            // let yAxis = d3.axisLeft(this.yScale)
            //     .tickSize(-width + svgPadding.left + svgPadding.right);
            // this.yLabel = this.MDSSPSvg.append('g')
            //     .attr('class', 'y_axis')
            //     .attr('transform', 'translate(' + svgPadding.left + ',0)')
            //     .call(yAxis);
            // map each dataPoints on scatterplots
            this.dataPlots = this.MDSSPSvg.selectAll('circle.dataPointsMDS')
                .data(dataCoords)
                .enter()
                .append('circle')
                .attr('cx', function(d) {
                    return this.xScale(d[0]);
                }.bind(this))
                .attr('cy', function(d) {
                    return this.yScale(d[1]);
                }.bind(this))
                .attr('r', 3)
                .attr('class', function(d, i) {
                    let clusterId = typeof(this.SSLabels[i]) === 'object'? this.SSLabels[i].cluster: this.SSLabels[i];
                    return 'dataPointsMDS' + ' dataPointsMDS_' + clusterId;
                }.bind(this))
                .attr('id', function(d, i) {
                    return 'dataPointsMDS_' + this.subsequences[i].id + '_' + this.subsequences[i].idx;
                }.bind(this))
                .attr('fill', function(d, i) {
                    let color = this.clusterColors[(typeof(this.SSLabels[i]) === 'object')? this.SSLabels[i].cluster: this.SSLabels[i]];
                    return d3.hsl(color[0], color[1], color[2]);
                }.bind(this))
                .on('mouseover', this.onMouseOverDataPointsMDS().bind(this))
                .on('mouseout', this.onMouseOutDataPointsMDS().bind(this))
                .on('click', this.onClickDataPointsMDS().bind(this))
                .on('dblclick', this.onDoubleClickDataPointsMDS().bind(this));
            // map cluster centers on scatterplots
            this.clusterCenterPlots = this.MDSSPSvg.selectAll('circle.clusterCentersMDS')
                .data(clusterCenterCoords)
                .enter()
                .append('circle')
                .attr('class', 'clusterCentersMDS')
                .attr('cx', function(d) {
                    return this.xScale(d[0]);
                }.bind(this))
                .attr('cy', function(d) {
                    return this.yScale(d[1]);
                }.bind(this))
                .attr('r', 5)
                .attr('id', function(d, i) {
                    return 'clusterCentersMDS_' + i;
                })
                .attr('fill', 'none')
                .attr('stroke', function(d, i) {
                    let color = this.clusterColors[i];
                    return d3.hsl(color[0], color[1], color[2]);
                }.bind(this))
                .attr('stroke-width', 2)
                .on('mouseover', this.onMouseOverClusterCentersMDS().bind(this))
                .on('mouseout', this.onMouseOutClusterCentersMDS().bind(this))
                .on('click', this.onClickClusterCentersMDS().bind(this));
            this.clusterNameLabels = this.MDSSPSvg.selectAll('text.clusterNameLabelMDS')
                .data(clusterCenterCoords)
                .enter()
                .append('text')
                .attr('class', 'clusterNameLabelMDS')
                .attr('x', function(d) {
                    return this.xScale(d[0]);
                }.bind(this))
                .attr('y', function(d) {
                    return this.yScale(d[1]) + 16;
                }.bind(this))
                .attr('id', function(d, i) {
                    return 'clusterCentersLabelMDS_' + i;
                })
                .attr('fill', function(d, i) {
                    let color = this.clusterColors[i];
                    return d3.hsl(color[0], color[1], color[2]);
                }.bind(this))
                .attr('font-size', '0.8rem')
                .attr('text-anchor', 'middle')
                .text(function(d, i) {
                    return 'Cluster ' + i;
                })
                .on('mouseover', this.onMouseOverClusterCentersMDS().bind(this))
                .on('mouseout', this.onMouseOutClusterCentersMDS().bind(this))
                .on('click', this.onClickClusterCentersMDS().bind(this))
                .moveToBack();
            this.SSClusterCoords = [];
            this.SSCluster = [];
            let SSClusterCoords = [];
            for (let i = 0; i < this.clusterCenters.length; i++) {
                this.SSClusterCoords.push([]);
                SSClusterCoords.push([]);
                this.SSClusterCoords[i].push(clusterCenterCoords[i]);
                SSClusterCoords[i].push([this.xScale(clusterCenterCoords[i][0]), this.yScale(clusterCenterCoords[i][1])]);
                this.SSCluster.push([]);
            }
            for (let i = 0; i < this.SSLabels.length; i++) {
                if (typeof(this.SSLabels[i]) === 'object') {
                    this.SSClusterCoords[this.SSLabels[i].cluster].push(dataCoords[i]);
                    SSClusterCoords[this.SSLabels[i].cluster].push([this.xScale(dataCoords[i][0]), this.yScale(dataCoords[i][1])]);
                    this.SSCluster[this.SSLabels[i].cluster].push(this.subsequences[i]);
                } else {
                    this.SSClusterCoords[this.SSLabels[i]].push(dataCoords[i]);
                    SSClusterCoords[this.SSLabels[i]].push([this.xScale(dataCoords[i][0]), this.yScale(dataCoords[i][1])]);
                    this.SSCluster[this.SSLabels[i]].push(this.subsequences[i]);
                }
            }
            this.hulls = [];
            for (let i = 0; i < this.clusterCenters.length; i++) {
                let hullData = d3.polygonHull(SSClusterCoords[i]);
                this.hulls.push(
                    this.MDSSPSvg.append('path')
                    .attr('class', 'hull')
                    .attr('id', 'hull_' + i)
                    .attr('fill', function(d) {
                        let color = this.clusterColors[i];
                        return d3.hsl(color[0], 0.8, 0.8);
                    }.bind(this))
                    .style('opacity', 0.2)
                    .attr('d', hullData === null? null: 'M' + hullData.join('L') + 'Z')
                    .style('visibility', 'hidden')
                    .moveToBack()
                );
            }
        }
    }

    drawClustersSummaryStuckedBarChart() {
        let clusterMemberNum = new Array(this.clusterCenters.length).fill(0);
        for (let  i = 0; i < this.SSLabels.length; i++) {
            let cluster = typeof(this.SSLabels[i]) === 'object'? this.SSLabels[i].cluster: this.SSLabels[i];
            clusterMemberNum[cluster]++;
        }
        
        let width = $('#clusteringResultsOverview').width() * this.chartsSize.MDS.width - 15 * 3;
        this.clusterSummaryBarChart = this.MDSSPSvg
            .selectAll('rect.clusterSummaryBar')
            .data(clusterMemberNum)
            .enter()
            .append('rect')
            .attr('id', function(d, i) {
                return 'clusterSummaryBar_' + i;
            })
            .attr('class', 'clusterSummaryBar')
            .attr('x', function(d, i) {
                let dataNumBefore = 0;
                for (let j = 0; j < i; j++) {
                    dataNumBefore += clusterMemberNum[j];
                }
                return dataNumBefore * width / this.SSLabels.length;
            }.bind(this))
            .attr('y', 5)
            .attr('width', function(d) {
                return d * width / this.SSLabels.length;
            }.bind(this))
            .attr('height', 10)
            .attr('fill', function(d, i) {
                let color = this.clusterColors[i];
                return d3.hsl(color[0], color[1], color[2]);
            }.bind(this))
            .on('mouseover', this.onMouseOverClusterCentersMDS().bind(this))
            .on('mouseout', this.onMouseOutClusterCentersMDS().bind(this))
            .on('click', this.onClickClusterCentersMDS().bind(this));
    }

    drawSilhouetteBarChart () {
        $('#silhouetteBarChartSVG').remove();
        if (this.SSLabels.length > 0) {
            let svgPadding = {left: 30, right: 15, top: 15, bottom: 30};
            let width = $('#clusteringResultsOverview').width() * this.chartsSize.barChart.width - 15 * 3;
            let appHeaderHeight = $('#appHeader').outerHeight(true);
            let timelineHeight = $('#clusteringTimeline').outerHeight(true);
            let height = (window.innerHeight - appHeaderHeight - timelineHeight) * this.chartsSize.barChart.height;
            this.SilhouetteSVG = d3.select('#silhouetteBarChart')
                .append('svg')
                .attr('id', 'silhouetteBarChartSVG')
                .attr('width', width)
                .attr('height', height)
                .style('background-color', 'white');

            // let this.state.clusteringScore = ClusteringStore.getClusteringScores();
            let clusterMembers = [];
            for (let i = 0; i < this.clusterCenters.length; i++) {
                clusterMembers.push([]);
            }
            for (let i = 0; i < this.SSLabels.length; i++) {
                let cluster = typeof(this.SSLabels[i]) === 'object'? this.SSLabels[i].cluster: this.SSLabels[i];
                clusterMembers[cluster].push({idx: i, silhouette: this.state.clusteringScores.silhouetteSS[i]});
            }

            this.xScaleSilhouette = d3.scaleLinear()
                .range([0, width - svgPadding.left - svgPadding.right])
                .domain([0, 1]);
            let xAxis = d3.axisBottom(this.xScaleSilhouette)
                .ticks(5)
                .tickSize(-height + svgPadding.top + svgPadding.bottom);
            this.xLabelSilhouette = this.SilhouetteSVG
                .append('g')
                .attr('class', 'x_axis')
                .attr('transform', 'translate(' + svgPadding.left + ',' + (height - svgPadding.bottom) + ')')
                .call(xAxis);
            this.yScaleSilhouette = d3.scaleBand()
                .range([svgPadding.top, height - svgPadding.bottom])
                .domain(this.SSLabels.map((d, i) => {
                    return i;
                }))
                .padding(.05);
            // let yAxis = d3.axisLeft(this.yScaleSilhouette)
            //     .ticks(this.SSLabels.length);
            // this.yLabelSilhouette = this.SilhouetteSVG
            //     .append('g')
            //     .attr('class', 'y_axis')
            //     .attr('transform', 'translate(' + svgPadding.left + ',0)')
            //     .call(yAxis);
            this.SilhouetteBars = this.SilhouetteSVG
                .append('g')
                .attr('class', 'SilhouetteBars')
                .on('mouseover', this.onMouseOverSilhouetteBarChart().bind(this))
                .on('mouseout', this.onMouseOutSilhouetteBarChart().bind(this))
                .on('click', this.onClickSilhouetteBarChart().bind(this))
                .on('dblclick', this.onDoubleClickSilhouetteBarChart().bind(this));
            for (let i = 0; i < clusterMembers.length; i++) {
                clusterMembers[i].sort((a, b) => b.silhouette - a.silhouette);
                for (let j = 0; j < clusterMembers[i].length; j++) {
                    let previousClusterNum = 0;
                    for (let k = 0; k < i; k++) {
                        previousClusterNum += clusterMembers[k].length;
                    }
                    clusterMembers[i][j].order = previousClusterNum + j;
                }
            }
            for (let i = 0; i < this.clusterCenters.length; i++) {
                let color = this.clusterColors[i];
                color = d3.hsl(color[0], color[1], color[2]);
                this.SilhouetteBars
                    .selectAll('rect.SilhouetteBarCluster_' + i)
                    .data(clusterMembers[i])
                    .enter()
                    .append('rect')
                    .attr('class', 'SilhouetteBar SilhouetteBarCluster_' + i)
                    .attr('id', (d) => {
                        return 'SilhouetteBar_' + d.idx;
                    })
                    .attr('width', function(d) {
                        return this.xScaleSilhouette(d.silhouette);
                    }.bind(this))
                    .attr('x', svgPadding.left)
                    .attr('y', function(d) {
                        return this.yScaleSilhouette(d.order);
                    }.bind(this))
                    .attr('height', this.yScaleSilhouette.bandwidth())
                    .attr('fill', color);
            }
            // let drag = d3.drag()
            //     .on('start', dragstarted)
            //     .on('drag', dragged)
            //     .on('end', dragended);
            this.silhouetteVerticalLine = this.SilhouetteSVG
                .append('line')
                .attr('stroke-width', 2)
                .attr('stroke', 'black')
                .attr('id', 'silhouetteVerticalLine')
                .attr('x1', this.xScaleSilhouette(this.state.clusteringScores.silhouette) + svgPadding.left)
                .attr('y1', svgPadding.top)
                .attr('x2', this.xScaleSilhouette(this.state.clusteringScores.silhouette) + svgPadding.left)
                .attr('y2', height - svgPadding.bottom);
            //     .call(drag);
            // function dragstarted() {
            //     d3.select(this)
            //         .classed('selectedLine', true);
            // }
            // function dragged() {
            //     let line = d3.select('#silhouetteVerticalLine');
            //     let pos = d3.event.x;
            //     if (pos <= svgPadding.left)
            //         pos = svgPadding.left
            //     else if (svgPadding.left + width <= pos)
            //         pos = svgPadding.left + width;
            //     line.attr('x1', pos)
            //         .attr('x2', pos);
            // }
            // function dragended() {
            //     d3.select(this)
            //         .classed('selectedLine', false);
            // }
        }
    }

    drawElbowMethodLineChart() {
        $('#elbowMethodLineChartSVG').remove();
        if ($('#elbowMethodLineChart').length > 0) {
            let width = $('#clusteringResultsOverview').width() * this.chartsSize.elbowLineChart.width - 15 * 3;
            let appHeaderHeight = $('#appHeader').outerHeight(true);
            let timelineHeight = $('#clusteringTimeline').outerHeight(true);
            let height = (window.innerHeight - appHeaderHeight - timelineHeight) * this.chartsSize.elbowLineChart.height;
            let svgPadding = {left: 45, right: 15, top: 15, bottom: 30};

            this.elbowMethodLineChartSVG = d3.select('#elbowMethodLineChart')
                .append('svg')
                .attr('id', 'elbowMethodLineChartSVG')
                .attr('width', width)
                .attr('height', height)
                .style('background-color', 'white');

            let SSEClusters = ClusteringStore.getSSEClusters();
            let SSEkeys = Object.keys(SSEClusters);
            SSEkeys.sort((a, b) => a - b);
            let SSEs = [];
            for (let i = 0; i < SSEkeys.length; i++) {
                SSEkeys[i] = Number(SSEkeys[i]);
                SSEs.push({clusterNum: Number(SSEkeys[i]), SSE: SSEClusters[SSEkeys[i]]});
            }
            this.xScaleSSE = d3.scaleLinear()
                .range([svgPadding.left, width - svgPadding.right])
                .domain(d3.extent(SSEkeys));
            let xAxis = d3.axisBottom(this.xScaleSSE)
                .ticks(SSEkeys.length);
            this.xLabelSSE = this.elbowMethodLineChartSVG
                .append('g')
                .attr('class', 'x_axis')
                .attr('transform', 'translate(0,' + (height - svgPadding.bottom) + ')')
                .call(xAxis)
                .attr('font-size', '0.5rem');
            this.yScaleSSE = d3.scaleLinear()
                .range([height - svgPadding.bottom, svgPadding.top])
                .domain([0, d3.max(SSEs, d => d.SSE)])
                .nice();
            let yAxis = d3.axisLeft(this.yScaleSSE)
                .ticks(5);
            this.yLabelSSE = this.elbowMethodLineChartSVG
                .append('g')
                .attr('class', 'y_axis')
                .attr('transform', 'translate(' + svgPadding.left + ',0)')
                .call(yAxis)
                .attr('font-size', '0.5rem');
            this.elbowMethodLineChartSVG
                .append('path')
                .datum(SSEs)
                .attr('id', 'elbowMethodLineChartPath')
                .attr('fill', 'none')
                .attr('stroke', 'gray')
                .attr('stroke-width', 1.5)
                .attr('d', d3.line()
                    .x(function(d) {
                        return this.xScaleSSE(d.clusterNum);
                    }.bind(this))
                    .y(function(d) {
                        return this.yScaleSSE(d.SSE);
                    }.bind(this))
                );
            let plotsGroup = this.elbowMethodLineChartSVG
                .append('g')
                .attr('id', 'elbowMethodLineChartPlotGroup');
            plotsGroup
                .append('line')
                .attr('id', 'elbowMethodLineChartFocusedV')
                .attr('x1', svgPadding.left)
                .attr('y1', svgPadding.top)
                .attr('x2', svgPadding.left)
                .attr('y2', height - svgPadding.bottom)
                .attr('stroke', 'orange')
                .attr('stroke-width', 1)
                .style('visibility', 'hidden');
            plotsGroup
                .append('line')
                .attr('id', 'elbowMethodLineChartFocusedH')
                .attr('x1', svgPadding.left)
                .attr('y1', svgPadding.top)
                .attr('x2', width - svgPadding.right)
                .attr('y2', svgPadding.top)
                .attr('stroke', 'orange')
                .attr('stroke-width', 1)
                .style('visibility', 'hidden');
            plotsGroup
                .selectAll('circle')
                .data(SSEs)
                .enter()
                .append('circle')
                .attr('cx', function(d) {
                    return this.xScaleSSE(d.clusterNum);
                }.bind(this))
                .attr('cy', function(d) {
                    return this.yScaleSSE(d.SSE);
                }.bind(this))
                .attr('r', 2)
                .attr('fill', 'white')
                .attr('stroke-width', 1)
                .attr('stroke', 'gray')
                .on('mouseover', onMouseOverElbowMethodPlots)
                .on('mouseout', onMouseOutElbowMethodPlots);
            this.elbowMethodLineChartSVG
                .append('text')
                .attr('x', svgPadding.left + (width - svgPadding.left) / 2)
                .attr('y', height - 8)
                .attr('id', 'elbowMethodLineChartXLabel')
                .attr('fill', 'black')
                .attr('font-size', '0.6rem')
                .attr('text-anchor', 'middle')
                .text('Cluster number');
            this.elbowMethodLineChartSVG
                .append('text')
                .attr('transform', 'rotate(-90)')
                .attr('y', 8)
                .attr('x', -1 * (height - svgPadding.bottom) / 2)
                .attr('id', 'elbowMethodLineChartYLabel')
                .attr('fill', 'black')
                .attr('font-size', '0.6rem')
                .attr('text-anchor', 'middle')
                .text('SSE');
            function onMouseOverElbowMethodPlots() {
                let xPos = d3.select(this).attr('cx'),
                    yPos = d3.select(this).attr('cy');
                d3.select('#elbowMethodLineChartFocusedV')
                    .attr('x1', xPos)
                    .attr('x2', xPos)
                    .style('visibility', 'visible');
                d3.select('#elbowMethodLineChartFocusedH')
                    .attr('y1', yPos)
                    .attr('y2', yPos)
                    .style('visibility', 'visible');
            }
            function onMouseOutElbowMethodPlots() {
                d3.select('#elbowMethodLineChartFocusedV')
                    .style('visibility', 'hidden');
                d3.select('#elbowMethodLineChartFocusedH')
                    .style('visibility', 'hidden');
            }
        }
    }

    drawFeatureHeatmap() {
        $('#clusterFeatureHeatmapSVG').remove();
        if ($('#clusterFeatureHeatmap').length > 0) {
            let width = $('#clusteringResultsOverview').width() * this.chartsSize.featureHeatmap.width - 15 * 3;
            let appHeaderHeight = $('#appHeader').outerHeight(true);
            let timelineHeight = $('#clusteringTimeline').outerHeight(true);
            let height = (window.innerHeight - appHeaderHeight - timelineHeight) * this.chartsSize.featureHeatmap.height;
            let svgPadding = {left: 45, right: 15, top: 20, bottom: 30};

            this.featureHeatmapSVG = d3.select('#clusterFeatureHeatmap')
                .append('svg')
                .attr('id', 'clusterFeatureHeatmapSVG')
                .attr('width', width)
                .attr('height', height)
                .style('background-color', 'white');

            let variables = ClusteringStore.getClusteringParameters().variables;
            let aveDataValues = [];
            for (let i = 0; i < this.SSCluster.length; i++) {
                let sumDataValues = {}, sumDataPointsNum = {};
                variables.forEach(function(key) {
                    sumDataValues[key] = 0;
                    sumDataPointsNum[key] = 0;
                    for (let j = 0; j < this.SSCluster[i].length; j++) {
                        for (let k = 0; k < this.SSCluster[i][j].dataPoints.length; k++) {
                            if (key in this.SSCluster[i][j].dataPoints[k]) {
                                sumDataValues[key] += this.SSCluster[i][j].dataPoints[k][key];
                                sumDataPointsNum[key]++;
                            }
                        }
                    }
                }.bind(this));
                variables.forEach(function(key) {
                    sumDataValues[key] /= sumDataPointsNum[key];
                }.bind(this));
                aveDataValues.push(sumDataValues);
            }
            let minMax = {};
            variables.forEach((key) => {
                minMax[key] = [Infinity, -Infinity];
            })
            for (let i = 0; i < aveDataValues.length; i++) {
                variables.forEach((key) => {
                    if (aveDataValues[i][key] < minMax[key][0]) {
                        minMax[key][0] = aveDataValues[i][key];
                    }
                    if (minMax[key][1] < aveDataValues[i][key]) {
                        minMax[key][1] = aveDataValues[i][key];
                    }
                });
            }
            let variableLabels = {};
            let targets = ClusteringStore.getDatasets();
            for (let i = 0; i < targets.length; i++) {
                let lookup = DataStore.getData(targets[i]).data.lookup;
                for (let key in lookup) {
                    if (!(key in variableLabels)) {
                        variableLabels[key] = lookup[key];
                    } else {
                        for (let j = 0; j < lookup[key].length; j++) {
                            if (variableLabels[key].indexOf(lookup[key][j]) < 0) {
                                variableLabels[key].push(lookup[key][j]);
                            }
                        }
                    }
                }
            }
            let labels = [];
            variables.forEach((key) => {
                labels.push(variableLabels[key].join(', '));
            });
            let clusterIdxs = Array(this.clusterCenters.length).fill().map((_, i) => i);
            this.xScaleFeatureHeatmap = d3.scaleBand()
                .range([svgPadding.left, width - svgPadding.right])
                .domain(clusterIdxs)
                .padding(.05);
            this.xLabelFeatureHeatmap = this.featureHeatmapSVG
                .append('g')
                .attr('class', 'x_axis')
                .attr('transform', 'translate(0,' + (height - svgPadding.bottom) + ')')
                .call(d3.axisBottom(this.xScaleFeatureHeatmap));
            this.xLabelFeatureHeatmap
                .selectAll('text')
                .attr('fill', function(d) {
                    let color = this.clusterColors[d];
                    return d3.hsl(color[0], color[1], color[2]);
                }.bind(this))
            this.yScaleFeatureHeatmap = d3.scaleBand()
                .range([svgPadding.top, height - svgPadding.bottom])
                .domain(labels)
                .padding(.05);
            this.yLabelFeatureHeatmap = this.featureHeatmapSVG
                .append('g')
                .attr('class', 'y_axis')
                .attr('transform', 'translate(' + svgPadding.left + ',0)')
                .call(d3.axisLeft(this.yScaleFeatureHeatmap));
            for (let i = 0; i < aveDataValues.length; i++) {
                this.featureHeatmapSVG
                    .selectAll('rect.featureHeatmapRect_' + i)
                    .data(labels)
                    .enter()
                    .append('rect')
                    .attr('class', 'featureHeatmapRect featureHeatmapRect_' + i)
                    .attr('id', function(d, idx) {
                        return 'featureHeatmapRect_' + i + '_' + variables[idx];
                    })
                    .attr('x', function(d) {
                        return this.xScaleFeatureHeatmap(i);
                    }.bind(this))
                    .attr('y', function(d, idx) {
                        return this.yScaleFeatureHeatmap(d)
                    }.bind(this))
                    .attr('width', this.xScaleFeatureHeatmap.bandwidth())
                    .attr('height', this.yScaleFeatureHeatmap.bandwidth())
                    .attr('fill', function(d, idx) {
                        return d3.interpolateRdBu(
                            (aveDataValues[i][variables[idx]] - minMax[variables[idx]][0]) 
                            / (minMax[variables[idx]][1] - minMax[variables[idx]][0])
                        );
                    })
                    .on('mouseover', onMouseOverFeatureHeatmap.bind(this))
                    .on('mouseout', onMouseOutFeatureHeatmap.bind(this))
                    .on('click', onClickFeatureHeatmap);
            }
            // axis labels
            this.featureHeatmapSVG
                .append('text')
                .attr('x', svgPadding.left + (width - svgPadding.left) / 2)
                .attr('y', height - 8)
                .attr('id', 'featureHeatmapXLabel')
                .attr('fill', 'black')
                .attr('font-size', '0.6rem')
                .attr('text-anchor', 'middle')
                .text('Cluster name');
            this.featureHeatmapSVG
                .append('text')
                .attr('transform', 'rotate(-90)')
                .attr('y', 8)
                .attr('x', -1 * (height - svgPadding.bottom) / 2)
                .attr('id', 'featureHeatmapYLabel')
                .attr('fill', 'black')
                .attr('font-size', '0.6rem')
                .attr('text-anchor', 'middle')
                .text('Variables');

            // show color legend for references
            let rectSize = (width - svgPadding.left - svgPadding.right) / 2 / this.clusterCenters.length;
            let featureHeatmapLegend = this.featureHeatmapSVG
                .append('g')
                .attr('class', 'featureHeatmapLegend');
            featureHeatmapLegend
                .selectAll('rect.featureHeatmapLegendRect')
                .data(clusterIdxs)
                .enter()
                .append('rect')
                .attr('class', 'featureHeatmapLegendRect')
                .attr('x', function(d) {
                    return width / 2 + d * rectSize;
                })
                .attr('y', 0)
                .attr('width', rectSize)
                .attr('height', 10)
                .attr('fill', function(d) {
                    return d3.interpolateRdBu(d / (this.clusterCenters.length - 1));
                }.bind(this));
            featureHeatmapLegend
                .append('text')
                .attr('id', 'featureHeatmapLegendLabelSmall')
                .attr('x', width / 2 - 15)
                .attr('y', 10)
                .attr('text-anchor', 'middle')
                .attr('fill', 'black')
                .attr('font-size', '0.6rem')
                .text('small');
            featureHeatmapLegend
                .append('text')
                .attr('id', 'featureHeatmapLegendLabelLarge')
                .attr('x', width - svgPadding.right - 2)
                .attr('y', 10)
                .attr('text-anchor', 'middle')
                .attr('fill', 'black')
                .attr('font-size', '0.6rem')
                .text('large');
            function onMouseOverFeatureHeatmap() {
                if (d3.event.target) {
                    let targetId = d3.event.target.id;
                    let targetElem = targetId.split('_');
                    let clusterId = Number(targetElem[1]);
                    let tooltip = $('#tooltipFeatureHeatmap');
                    tooltip.text(formatValue(aveDataValues[clusterId][targetElem[2]]));
                    tooltip.css('display', 'block');
                    let resultsPanelOffset = $('#clusteringResults').offset();
                    let scrollTop = window.pageYOffset;
                    let mouseX, mouseY;
                    if (scrollTop < resultsPanelOffset.top) {
                        // header is visible
                        mouseX = d3.event.clientX - resultsPanelOffset.left + 5;
                        if (d3.event.clientY < $('#clusteringResults').height() / 2) {
                            mouseY = d3.event.clientY - (resultsPanelOffset.top - scrollTop) + 5;
                        } else {
                            let tooltipHeight = tooltip.height() === 0? 30: tooltip.height();
                            mouseY = d3.event.clientY - (resultsPanelOffset.top - scrollTop) - tooltipHeight - 5;
                        }
                    } else {
                        // header is invisible
                        mouseX = d3.event.clientX - resultsPanelOffset.left + 5;
                        if (d3.event.clientY < $('#clusteringOverviewMDSScatterplots').height() / 2) {
                            mouseY = d3.event.clientY + 5;
                        } else {
                            let tooltipHeight = tooltip.height() === 0? 30: tooltip.height();
                            mouseY = d3.event.clientY - tooltipHeight - 5;
                        }
                    }
                    tooltip.css({
                        left: mouseX + 'px',
                        top: mouseY + 'px',
                        right: 'unset',
                        bottom: 'unset'
                    });

                    this.hulls[clusterId].style('visibility', 'visible');
                    d3.selectAll('circle.dataPointsMDS')
                        .style('opacity', 0.3);
                    d3.selectAll('circle.clusterCentersMDS')
                        .style('opacity', 0.3);
                    d3.selectAll('circle.dataPointsMDS_' + clusterId)
                        .style('opacity', 1);
                    d3.select('#clusterCentersMDS_' + clusterId)
                        .style('opacity', 1);
                }
            }
            function onMouseOutFeatureHeatmap() {
                if (d3.event.target) {
                    let targetId = d3.event.target.id;
                    let targetElem = targetId.split('_');
                    let clusterId = Number(targetElem[1]);
                    let tooltip = $('#tooltipFeatureHeatmap');
                    tooltip.css('display', 'none');
                    this.hulls[clusterId].style('visibility', 'hidden');
                    d3.selectAll('circle.dataPointsMDS')
                        .style('opacity', 1);
                    d3.selectAll('circle.clusterCentersMDS')
                        .style('opacity', 1);
                }
            }
            function onClickFeatureHeatmap() {
                if (d3.event.target) {
                    let targetId = d3.event.target.id;
                    let targetElem = targetId.split('_');
                    ClusteringAction.showClusterDetails(Number(targetElem[1]));
                }
            }
        }
    }

    onClickDataPointsMDS() {
        return function() {
            // show the cluster which the selected SS belongs to
            if (d3.event.target) {
                let targetClass = d3.event.target.classList[1];
                let clusterNum = Number(targetClass.split('_')[1]);
                ClusteringAction.showClusterDetails(clusterNum);
            }
        }
    }

    onDoubleClickDataPointsMDS() {
        return  function() {
            let targetId = d3.event.target.id;
            if (targetId) {
                let targetEle = targetId.split('_');
                let dataId = Number(targetEle[1]),
                    SSId = Number(targetEle[2]);
                let data;
                for (let i = 0; i < this.subsequences.length; i++) {
                    if (this.subsequences[i].id === dataId && this.subsequences[i].idx === SSId) {
                        data = this.subsequences[i];
                        break;
                    }
                }
                $('#tooltipClusteringResults').css('display', 'none');
                selectMenu('visualization');
                showTimeTubesOfTimeSlice(dataId, [data.dataPoints[0].z, data.dataPoints[data.dataPoints.length - 1].z]);
            }
        };
    }

    onMouseOverDataPointsMDS() {
        return function() {
            let targetId = d3.event.target.id;
            if (targetId) {
                let tooltip = $('#tooltipClusteringResults'),
                    tooltipTable = $('#tooltipClusteringResultsTable');
                let targetEle = targetId.split('_');
                let dataId = Number(targetEle[1]),
                    SSId = Number(targetEle[2]);
                let data;
                let i = 0;
                for (i = 0; i < this.subsequences.length; i++) {
                    if (this.subsequences[i].id === dataId && this.subsequences[i].idx === SSId) {
                        data = this.subsequences[i];
                        break;
                    }
                }

                // show detail information of the subsequence
                let fileName = DataStore.getFileName(dataId);
                let period = [data.dataPoints[0].z, data.dataPoints[data.dataPoints.length - 1].z];
                let dataPointNum = data.dataPoints.length;
                let scrollTop = window.pageYOffset;
                let resultsPanelOffset = $('#clusteringResults').offset();
                let mouseX, mouseY;
                // if the position of the mouse is in the upper side of MDS plots, show tooltip below the mouse
                // else, show tooltip above the mouse
                if (scrollTop < resultsPanelOffset.top) {
                    // header is visible
                    mouseX = d3.event.clientX - resultsPanelOffset.left + 5;
                    if (d3.event.clientY < $('#clusteringResults').height() / 2) {
                        mouseY = d3.event.clientY - (resultsPanelOffset.top - scrollTop) + 5;
                    } else {
                        let tooltipHeight = tooltip.height() === 0? 230: tooltip.height();
                        mouseY = d3.event.clientY - (resultsPanelOffset.top - scrollTop) - tooltipHeight - 5;
                    }
                } else {
                    // header is invisible
                    mouseX = d3.event.clientX - resultsPanelOffset.left + 5;
                    if (d3.event.clientY < $('#clusteringOverviewMDSScatterplots').height() / 2) {
                        mouseY = d3.event.clientY + 5;
                    } else {
                        let tooltipHeight = tooltip.height() === 0? 230: tooltip.height();
                        mouseY = d3.event.clientY - tooltipHeight - 5;
                    }
                }
                tooltipTable.html('<table><tbody><tr><td class="tooltipTableLabel">File name</td><td class="tooltipTableValues">' + fileName + '</td></tr>' +
                    '<tr><td class="tooltipTableLabel">Period</td><td class="tooltipTableValues">' + formatValue(period[0]) + '-' + formatValue(period[1]) + '</td></tr>' +
                    '<tr><td class="tooltipTableLabel">Data points number</td><td class="tooltipTableValues">' + dataPointNum + '</td></tr></tbody></table>');
                tooltip.css({
                    left: mouseX + 'px',
                    top: mouseY + 'px',
                    right: 'unset',
                    bottom: 'unset'
                });
                tooltip.css('display', 'block');
                
                let beforeAfter = [undefined, undefined];
                if (i - 1 >= 0) {
                    if (this.subsequences[i - 1].id === this.subsequences[i].id) {
                        beforeAfter[0] = typeof(this.SSLabels[i - 1]) === 'object'? this.SSLabels[i - 1].cluster: this.SSLabels[i - 1];
                    }
                }
                if (i + 1 < this.SSLabels.length) {
                    if (this.subsequences[i].id === this.subsequences[i + 1].id) {
                        beforeAfter[1] = typeof(this.SSLabels[i + 1]) === 'object'? this.SSLabels[i + 1].cluster: this.SSLabels[i + 1];
                    }
                }
                domActions.highlightCorrespondingElemInClusteringResults(dataId, SSId, period, beforeAfter);
                ClusteringAction.showTTViewOfSelectedSSClusteringResults(Number(dataId), period);
            }
        }
    }

    onMouseOutDataPointsMDS() {
        return function() {
            let targetId = d3.event.target.id;
            if (targetId) {
                let targetEle = targetId.split('_');
                let dataId = Number(targetEle[1]),
                    SSId = Number(targetEle[2]);
                // hide the tooltip
                $('#tooltipClusteringResults').css('display', 'none');

                domActions.removeHighlightCorrespondingElemInClusteringResults(dataId, SSId);
            }
        }
    }

    onClickSilhouetteBarChart() {
        return function() {
            // show the cluster which the selected SS belongs to
            if (d3.event.target) {
                let targetClass = d3.event.target.classList[1];
                let clusterNum = Number(targetClass.split('_')[1]);
                ClusteringAction.showClusterDetails(clusterNum);
            }
        }
    }

    onDoubleClickSilhouetteBarChart() {
        return  function() {
            let targetId = d3.event.target.id;
            if (targetId) {
                let targetEle = targetId.split('_');
                let idx = Number(targetEle[1]);
                let data = this.subsequences[idx];
                $('#tooltipClusteringResults').css('display', 'none');
                selectMenu('visualization');
                showTimeTubesOfTimeSlice(data.id, [data.dataPoints[0].z, data.dataPoints[data.dataPoints.length - 1].z]);
            }
        };
    }

    onMouseOverSilhouetteBarChart() {
        return function() {
            let targetId = d3.event.target.id;
            if (targetId) {
                let tooltip = $('#tooltipClusteringResults'),
                    tooltipTable = $('#tooltipClusteringResultsTable');
                let targetEle = targetId.split('_');
                let idx = Number(targetEle[1]);
                let data = this.subsequences[idx];

                // show detail information of the subsequence
                let fileName = DataStore.getFileName(data.id);
                let period = [data.dataPoints[0].z, data.dataPoints[data.dataPoints.length - 1].z];
                let dataPointNum = data.dataPoints.length;
                let scrollTop = window.pageYOffset;
                let resultsPanelOffset = $('#clusteringResults').offset();
                let mouseX, mouseY;
                // if the position of the mouse is in the upper side of MDS plots, show tooltip below the mouse
                // else, show tooltip above the mouse
                if (scrollTop < resultsPanelOffset.top) {
                    // header is visible
                    mouseX = d3.event.clientX - resultsPanelOffset.left + 5;
                    if (d3.event.clientY < $('#clusteringResults').height() / 2) {
                        mouseY = d3.event.clientY - (resultsPanelOffset.top - scrollTop) + 5;
                    } else {
                        let tooltipHeight = tooltip.height() === 0? 230: tooltip.height();
                        mouseY = d3.event.clientY - (resultsPanelOffset.top - scrollTop) - tooltipHeight - 5;
                    }
                } else {
                    // header is invisible
                    mouseX = d3.event.clientX - resultsPanelOffset.left + 5;
                    if (d3.event.clientY < $('#clusteringOverviewMDSScatterplots').height() / 2) {
                        mouseY = d3.event.clientY + 5;
                    } else {
                        let tooltipHeight = tooltip.height() === 0? 230: tooltip.height();
                        mouseY = d3.event.clientY - tooltipHeight - 5;
                    }
                }
                tooltipTable.html('<table><tbody><tr><td class="tooltipTableLabel">File name</td><td class="tooltipTableValues">' + fileName + '</td></tr>' +
                    '<tr><td class="tooltipTableLabel">Period</td><td class="tooltipTableValues">' + formatValue(period[0]) + '-' + formatValue(period[1]) + '</td></tr>' +
                    '<tr><td class="tooltipTableLabel">Data points number</td><td class="tooltipTableValues">' + dataPointNum + '</td></tr></tbody></table>');
                tooltip.css({
                    left: mouseX + 'px',
                    top: mouseY + 'px',
                    right: 'unset',
                    bottom: 'unset'
                });
                tooltip.css('display', 'block');
                
                let beforeAfter = [undefined, undefined];
                if (idx - 1 >= 0) {
                    if (this.subsequences[idx - 1].id === this.subsequences[idx].id) {
                        beforeAfter[0] = typeof(this.SSLabels[idx - 1]) === 'object'? this.SSLabels[idx - 1].cluster: this.SSLabels[idx - 1];
                    }
                }
                if (idx + 1 < this.SSLabels.length) {
                    if (this.subsequences[idx].id === this.subsequences[idx + 1].id) {
                        beforeAfter[1] = typeof(this.SSLabels[idx + 1]) === 'object'? this.SSLabels[idx + 1].cluster: this.SSLabels[idx + 1];
                    }
                }
                domActions.highlightCorrespondingElemInClusteringResults(data.id, data.idx, period, beforeAfter);
                ClusteringAction.showTTViewOfSelectedSSClusteringResults(data.id, period);
            }
        }
    }

    onMouseOutSilhouetteBarChart() {
        return function() {
            let targetId = d3.event.target.id;
            if (targetId) {
                let targetEle = targetId.split('_');
                let idx = Number(targetEle[1]);
                // hide the tooltip
                $('#tooltipClusteringResults').css('display', 'none');

                domActions.removeHighlightCorrespondingElemInClusteringResults(this.subsequences[idx].id, this.subsequences[idx].idx);
            }
        }
    }

    onMouseOverClusterCentersMDS() {
        return function() {
            let targetId = d3.event.target.id;
            if (targetId) {
                let clusterId = Number(targetId.split('_')[1]);
                this.hulls[clusterId].style('visibility', 'visible');
                d3.selectAll('circle.dataPointsMDS')
                    .style('opacity', 0.3);
                d3.selectAll('circle.clusterCentersMDS')
                    .style('opacity', 0.3);
                d3.selectAll('circle.dataPointsMDS_' + clusterId)
                    .style('opacity', 1);
                d3.select('#clusterCentersMDS_' + clusterId)
                    .style('opacity', 1);
            }
        };
    }

    onMouseOutClusterCentersMDS() {
        return function() {
            let targetId = d3.event.target.id;
            if (targetId) {
                let clusterId = Number(targetId.split('_')[1]);
                this.hulls[clusterId].style('visibility', 'hidden');
                d3.selectAll('circle.dataPointsMDS')
                    .style('opacity', 1);
                d3.selectAll('circle.clusterCentersMDS')
                    .style('opacity', 1);
            }
        };
    }

    onClickClusterCentersMDS() {
        return function() {
            if (d3.event.target) {
                let targetId = d3.event.target.id;
                let clusterNum = Number(targetId.split('_')[1]);
                ClusteringAction.showClusterDetails(clusterNum);
            }
        };
    }

    setMDSScatterplotsSize() {
        if ($('#clusteringOverviewMDSScatterplotsSVG').length) {
            let parentWidth = $('#clusteringResultsOverview').width();
            let appHeaderHeight = $('#appHeader').outerHeight(true);
            let timelineHeight = $('#clusteringTimeline').outerHeight(true);
            const parentHeight = window.innerHeight - appHeaderHeight - timelineHeight;
            let svgPadding = {left: 30, right: 30, top: 30, bottom: 30};
            // MDS plot
            this.MDSSPSvg
                .attr('width', parentWidth * this.chartsSize.MDS.width - 15 * 3)
                .attr('height', parentHeight * this.chartsSize.MDS.height);
            this.xScale
                .range([svgPadding.left, parentWidth * this.chartsSize.MDS.width - 15 * 3 - svgPadding.right]);
            this.yScale
                .range([parentHeight * this.chartsSize.MDS.height - svgPadding.bottom, svgPadding.top]);
            // this.xLabel.call(
            //     d3.axisBottom(this.xScale)
            //         .tickSize(-height + svgPadding.top + svgPadding.bottom)
            // )
            // .attr('transform', 'translate(0,' + (height - svgPadding.bottom) + ')');
            // this.yLabel.call(
            //     d3.axisLeft(this.yScale)
            //     .tickSize(-width + svgPadding.left + svgPadding.right)
            // )
            // .attr('transform', 'translate(' + svgPadding.left + ',0)');
            this.dataPlots
                .attr('cx', function(d) {
                    return this.xScale(d[0]);
                }.bind(this))
                .attr('cy', function(d) {
                    return this.yScale(d[1]);
                }.bind(this));
            this.clusterCenterPlots
                .attr('cx', function(d) {
                    return this.xScale(d[0]);
                }.bind(this))
                .attr('cy', function(d) {
                    return this.yScale(d[1]);
                }.bind(this));
            this.clusterNameLabels
                .attr('x', function(d) {
                    return this.xScale(d[0]);
                }.bind(this))
                .attr('y', function(d) {
                    return this.yScale(d[1]) + 16;
                }.bind(this));
            let SSClusterCoords = [];
            for (let i = 0; i < this.SSClusterCoords.length; i++) {
                SSClusterCoords.push([]);
                for (let j = 0; j < this.SSClusterCoords[i].length; j++) {
                    SSClusterCoords[i].push([this.xScale(this.SSClusterCoords[i][j][0]), this.yScale(this.SSClusterCoords[i][j][1])]);
                }
            }
            for (let i = 0; i < this.hulls.length; i++) {
                let hullData = d3.polygonHull(SSClusterCoords[i]);
                this.hulls[i]
                    .attr('d', hullData === null? null: 'M' + hullData.join('L') + 'Z');
            }

            // clusters summary stucked bar chart
            let clusterMemberNum = new Array(this.clusterCenters.length).fill(0);
            for (let  i = 0; i < this.SSLabels.length; i++) {
                let cluster = typeof(this.SSLabels[i]) === 'object'? this.SSLabels[i].cluster: this.SSLabels[i];
                clusterMemberNum[cluster]++;
            }    
            this.clusterSummaryBarChart
                .attr('x', function(d, i) {
                    let dataNumBefore = 0;
                    for (let j = 0; j < i; j++) {
                        dataNumBefore += clusterMemberNum[j];
                    }
                    return dataNumBefore * (parentWidth * this.chartsSize.MDS.width - 15 * 3) / this.SSLabels.length;
                }.bind(this))
                .attr('y', 5)
                .attr('width', function(d) {
                    return d * (parentWidth * this.chartsSize.MDS.width - 15 * 3) / this.SSLabels.length;
                }.bind(this));
            
            // bar chart for silhouette coefficient
            // let clusteringScore = ClusteringStore.getClusteringScores();
            this.SilhouetteSVG
                .attr('width', parentWidth * this.chartsSize.barChart.width - 15 * 3)
                .attr('height', parentHeight * this.chartsSize.barChart.height);
            this.xScaleSilhouette
                .range([0, parentWidth * this.chartsSize.barChart.width - 15 * 3 - svgPadding.left - svgPadding.right / 2]);
            this.xLabelSilhouette
                .attr('transform', 'translate(' + svgPadding.left + ',' + (parentHeight * this.chartsSize.barChart.height - svgPadding.bottom) + ')')
                .call(
                    d3.axisBottom(this.xScaleSilhouette)
                        .ticks(5)
                        .tickSize(-(parentHeight * this.chartsSize.barChart.height) + svgPadding.top / 2 + svgPadding.bottom)
                );
            this.yScaleSilhouette
                .range([svgPadding.top / 2, parentHeight * this.chartsSize.barChart.height - svgPadding.bottom]);
            this.SilhouetteBars.selectAll('rect.SilhouetteBar')
                .attr('width', function(d) {
                    return this.xScaleSilhouette(d.silhouette);
                }.bind(this))
                .attr('y', function(d) {
                    return this.yScaleSilhouette(d.order);
                }.bind(this))
                .attr('height', this.yScaleSilhouette.bandwidth());
            this.silhouetteVerticalLine
                .attr('x1', this.xScaleSilhouette(this.state.clusteringScores.silhouette) + svgPadding.left)
                .attr('y1', svgPadding.top / 2)
                .attr('x2', this.xScaleSilhouette(this.state.clusteringScores.silhouette) + svgPadding.left)
                .attr('y2', parentHeight * this.chartsSize.barChart.height - svgPadding.bottom);

            // line chart for cost
            if ($('#elbowMethodLineChart').length > 0) {
                this.elbowMethodLineChartSVG
                    .attr('width', parentWidth * this.chartsSize.elbowLineChart.width - 15 * 3)
                    .attr('height', parentHeight * this.chartsSize.elbowLineChart.height);
                this.xScaleSSE
                    .range([svgPadding.left * 1.5, parentWidth * this.chartsSize.elbowLineChart.width - 15 * 3 - svgPadding.right / 2]);
                this.xLabelSSE
                    .attr('transform', 'translate(0,' + (parentHeight * this.chartsSize.elbowLineChart.height - svgPadding.bottom) + ')')
                    .call(
                        d3.axisBottom(this.xScaleSSE)
                            .ticks(Object.keys(ClusteringStore.getSSEClusters()).length)
                    );
                this.yScaleSSE
                    .range([parentHeight * this.chartsSize.elbowLineChart.height - svgPadding.bottom, svgPadding.top / 2]);
                this.yLabelSSE
                    .call(
                        d3.axisLeft(this.yScaleSSE)
                            .ticks(5)
                    );
                d3.select('#elbowMethodLineChartPath')
                    .attr('d', d3.line()
                        .x(function(d) {
                            return this.xScaleSSE(d.clusterNum);
                        }.bind(this))
                        .y(function(d) {
                            return this.yScaleSSE(d.SSE);
                        }.bind(this))
                    );
                d3.select('g#elbowMethodLineChartPlotGroup')
                    .selectAll('circle')
                    .attr('cx', function(d) {
                        return this.xScaleSSE(d.clusterNum);
                    }.bind(this))
                    .attr('cy', function(d) {
                        return this.yScaleSSE(d.SSE);
                    }.bind(this));
                d3.select('#elbowMethodLineChartXLabel')
                    .attr('x', 1.5 * svgPadding.left + (parentWidth * this.chartsSize.elbowLineChart.width - 15 * 3 - 1.5 * svgPadding.left) / 2)
                    .attr('y', parentHeight * this.chartsSize.elbowLineChart.height - 8);
                d3.select('#elbowMethodLineChartYLabel')
                    .attr('x', -1 * (parentHeight * this.chartsSize.elbowLineChart.height - svgPadding.bottom) / 2);
                d3.select('#elbowMethodLineChartFocusedV')
                    .attr('y2', parentHeight * this.chartsSize.elbowLineChart.height - svgPadding.bottom);
                d3.select('#elbowMethodLineChartFocusedH')
                    .attr('x2', parentWidth * this.chartsSize.elbowLineChart.width - 15 * 3 - svgPadding.right);
            }

            // heatmap
            if ($('#clusterFeatureHeatmap').length > 0) {
                this.featureHeatmapSVG
                    .attr('width', parentWidth * this.chartsSize.featureHeatmap.width - 15 * 3)
                    .attr('height', parentHeight * this.chartsSize.featureHeatmap.height);
                this.xScaleFeatureHeatmap
                    .range([1.5 * svgPadding.left, parentWidth * this.chartsSize.featureHeatmap.width - 15 * 3 - svgPadding.right / 2]);
                this.xLabelFeatureHeatmap
                    .attr('transform', 'translate(0,' + (parentHeight * this.chartsSize.featureHeatmap.height - svgPadding.bottom) + ')')
                    .call(
                        d3.axisBottom(this.xScaleFeatureHeatmap)
                    );
                this.yScaleFeatureHeatmap
                    .range([svgPadding.top * 2 / 3, parentHeight * this.chartsSize.featureHeatmap.height - svgPadding.bottom]);
                this.yLabelFeatureHeatmap
                    .call(d3.axisLeft(this.yScaleFeatureHeatmap));
                for (let i = 0; i < this.clusterCenters.length; i++) {
                    d3.selectAll('rect.featureHeatmapRect_' + i)
                        .attr('x', function(d) {
                            return this.xScaleFeatureHeatmap(i);
                        }.bind(this))
                        .attr('y', function(d, idx) {
                            return this.yScaleFeatureHeatmap(d)
                        }.bind(this))
                        .attr('width', this.xScaleFeatureHeatmap.bandwidth())
                        .attr('height', this.yScaleFeatureHeatmap.bandwidth());
                }
                d3.select('#featureHeatmapXLabel')
                    .attr('x', 1.5 * svgPadding.left + (parentWidth * this.chartsSize.featureHeatmap.width - 15 * 3 - 1.5 * svgPadding.left) / 2)
                    .attr('y', parentHeight * this.chartsSize.featureHeatmap.height - 8);
                d3.select('#featureHeatmapYLabel')
                    .attr('x', -1 * (parentHeight * this.chartsSize.featureHeatmap.height - svgPadding.bottom) / 2);

                let rectSize = (parentWidth * this.chartsSize.featureHeatmap.width - 15 * 3 - 1.5 * svgPadding.left - svgPadding.right / 2) / 2 / this.clusterCenters.length;
                d3.selectAll('rect.featureHeatmapLegendRect')
                    .attr('x', function(d) {
                        return (parentWidth * this.chartsSize.featureHeatmap.width - 15 * 3) / 2 + d * rectSize;
                    }.bind(this))
                    .attr('width', rectSize);
                d3.select('#featureHeatmapLegendLabelSmall')  
                    .attr('x', (parentWidth * this.chartsSize.featureHeatmap.width - 15 * 3) / 2 - 15);
                d3.select('#featureHeatmapLegendLabelLarge')
                    .attr('x', (parentWidth * this.chartsSize.featureHeatmap.width - 15 * 3) - svgPadding.right / 2 - 2);
            }
        }
    }
    
    onSwitchInterclusterTransLeft() {
        let current = this.state.interclusterTransitions;
        if (this.correlationPathGroupLeft) {
            this.correlationPathGroupLeft.visible = !current.left;
        }
        this.setState({
            interclusterTransitions: {left: !current.left, right: current.right}
        });
    }

    onSwitchInterclusterTransRight() {
        let current = this.state.interclusterTransitions;
        if (this.correlationPathGroupRight) {
            this.correlationPathGroupRight.visible = !current.right;
        }
        this.setState({
            interclusterTransitions: {left: current.left, right: !current.right}
        });
    }
}
