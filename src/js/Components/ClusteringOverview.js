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
// import TextSprite from 'three.textsprite';
import TextSprite from '@seregpie/three.text-sprite';
import {formatValue} from '../lib/2DGraphLib';
import {} from '../lib/TimeSeriesQuerying';

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
        this.queryMode = FeatureStore.getMode();
        this.clickedX;
        this.clickedY;
        this.state = {
            clusteringScores: {}
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
            let clusteringScores = ClusteringStore.getClusteringScores();
            this.setRendererSize();
            this.computeSplines();
            this.computeTubePositions();
            this.drawClusterCentersAsTubes();
            this.drawClusterRadiusesAsRings(clusteringScores.clusterRadiuses);
            this.showClusteringParameters();
            this.resetDetailView();
            this.drawMDSScatterplots();
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
            let clusteringScores = ClusteringStore.getClusteringScores();
            this.setRendererSize();
            this.computeSplines();
            this.computeTubePositions();
            this.drawClusterCentersAsTubes();
            this.drawClusterRadiusesAsRings(clusteringScores.clusterRadiuses);
            this.showClusteringParameters();
            this.resetDetailView();
            this.drawMDSScatterplots();
            this.setState({
                clusteringScores: clusteringScores
            });
        });
        ClusteringStore.on('resetClusteringResults', () => {
            this.clusterCenters = ClusteringStore.getClusterCenters();
            this.subsequences = ClusteringStore.getSubsequences();
            this.SSLabels = ClusteringStore.getLabels();
            this.selectedCluster = undefined;
            let clusteringScores = ClusteringStore.getClusteringScores();
            this.setRendererSize();
            this.computeSplines();
            this.computeTubePositions();
            this.drawClusterCentersAsTubes();
            this.drawClusterRadiusesAsRings(clusteringScores.clusterRadiuses);
            this.showClusteringParameters();
            this.resetDetailView();
            this.drawMDSScatterplots();
            this.setState({
                clusteringScores: clusteringScores
            });
        });
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
                        <div id='clusteringOverviewMDSScatterplots' className="carousel-item">
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
        this.minmax = {};
        this.splines = [];
        this.range = undefined;
        let variables = ClusteringStore.getClusteringParameters().variables;
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
                    // TODO: x, yがなくてPAPDしかなかった場合も座標に変換して
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
                    // for (let k = 0; k < variables.length; k++) {
                    //     if (curdata[variables[k]] < this.minmax[variables[k]][0]) 
                    //         this.minmax[variables[k]][0] = curdata[variables[k]];
                    //     if (this.minmax[variables[k]][1] < curdata[variables[k]])
                    //         this.minmax[variables[k]][1] = curdata[variables[k]];
                    // }
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
                for (let j = 0; j < this.clusterCenters[i].length; j++) {
                    let curdata = this.clusterCenters[i][j];
                    let PARad = curdata.PA;
                    if (0.5 * Math.PI < PARad && PARad <= Math.PI) {
                        PARad -= Math.PI;
                    }
                    PARad *= 2;
                    let currentValues = {
                        x: curdata.PD * Math.cos(PARad),
                        y: curdata.PD * Math.sin(PARad),
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
                for (let j = 0; j < this.clusterCenters[i].length; j++) {
                    let curdata = this.clusterCenters[i][j];
                    let xCur, yCur;
                    if (variables.indexOf('PA') >= 0) {
                        let PDTmp = 1;
                        xCur = PDTmp * Math.cos(2 * curdata.PA);
                        yCur = PDTmp * Math.sin(2 * curdata.PA);
                    } else if (variables.indexOf('PD') >= 0) {
                        let PATmp = 0.5 * Math.PI;
                        xCur = curdata.PD * Math.cos(PATmp);
                        yCur = curdata.PD * Math.sin(PATmp);
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
                let spline = {};
                spline.position = new THREE.CatmullRomCurve3(position, false, 'catmullrom');
                spline.radius = new THREE.CatmullRomCurve3(radius, false, 'catmullrom');
                spline.color = new THREE.CatmullRomCurve3(color, false, 'catmullrom');
                this.splines.push(spline);
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
            let width = $('#clusteringResultsOverview').width();
            let appHeaderHeight = $('#appHeader').outerHeight(true);
            let timelineHeight = $('#clusteringTimeline').outerHeight(true);
            let height = window.innerHeight - appHeaderHeight - timelineHeight;
            let svgPadding = {left: 50, right: 30, top: 30, bottom: 50};
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
            let xAxis = d3.axisBottom(this.xScale)
                .tickSize(-height + svgPadding.top + svgPadding.bottom);
            this.xLabel = this.MDSSPSvg.append('g')
                .attr('class', 'x_axis')
                .attr('transform', 'translate(0,' + (height - svgPadding.bottom) + ')')
                .call(xAxis);
            let yAxis = d3.axisLeft(this.yScale)
                .tickSize(-width + svgPadding.left + svgPadding.right);
            this.yLabel = this.MDSSPSvg.append('g')
                .attr('class', 'y_axis')
                .attr('transform', 'translate(' + svgPadding.left + ',0)')
                .call(yAxis);
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
                .attr('fill', function(d, i) {
                    let color = this.clusterColors[i];
                    return d3.hsl(color[0], color[1], color[2]);
                }.bind(this))
                .attr('font-size', '0.8rem')
                .attr('text-anchor', 'middle')
                .text(function(d, i) {
                    return 'Cluster ' + i;
                })
                .moveToBack();
            this.SSCluster = [];
            let SSClusterCoords = [];
            for (let i = 0; i < this.clusterCenters.length; i++) {
                this.SSCluster.push([]);
                SSClusterCoords.push([]);
                this.SSCluster[i].push(clusterCenterCoords[i]);
                SSClusterCoords[i].push([this.xScale(clusterCenterCoords[i][0]), this.yScale(clusterCenterCoords[i][1])]);
            }
            for (let i = 0; i < this.SSLabels.length; i++) {
                if (typeof(this.SSLabels[i]) === 'object') {
                    this.SSCluster[this.SSLabels[i].cluster].push(dataCoords[i]);
                    SSClusterCoords[this.SSLabels[i].cluster].push([this.xScale(dataCoords[i][0]), this.yScale(dataCoords[i][1])]);
                } else {
                    this.SSCluster[this.SSLabels[i]].push(dataCoords[i]);
                    SSClusterCoords[this.SSLabels[i]].push([this.xScale(dataCoords[i][0]), this.yScale(dataCoords[i][1])]);
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
                tooltipTable.html('<table><tbody><tr><td>File name</td><td class="tooltipTableValues">' + fileName + '</td></tr>' +
                    '<tr><td>Period</td><td class="tooltipTableValues">' + period[0] + '-' + period[1] + '</td></tr>' +
                    '<tr><td>Data points number</td><td class="tooltipTableValues">' + dataPointNum + '</td></tr></tbody></table>');
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
            const width = $('#clusteringResultsOverview').width();
            let appHeaderHeight = $('#appHeader').outerHeight(true);
            let timelineHeight = $('#clusteringTimeline').outerHeight(true);
            const height = window.innerHeight - appHeaderHeight - timelineHeight;
            let svgPadding = {left: 50, right: 30, top: 30, bottom: 50};
            this.MDSSPSvg
                .attr('width', width)
                .attr('height', height);
            this.xScale
                .range([svgPadding.left, width - svgPadding.right]);
            this.yScale
                .range([height - svgPadding.bottom, svgPadding.top]);
            this.xLabel.call(
                d3.axisBottom(this.xScale)
                    .tickSize(-height + svgPadding.top + svgPadding.bottom)
            )
            .attr('transform', 'translate(0,' + (height - svgPadding.bottom) + ')');
            this.yLabel.call(
                d3.axisLeft(this.yScale)
                .tickSize(-width + svgPadding.left + svgPadding.right)
            )
            .attr('transform', 'translate(' + svgPadding.left + ',0)');
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
            for (let i = 0; i < this.SSCluster.length; i++) {
                SSClusterCoords.push([]);
                for (let j = 0; j < this.SSCluster[i].length; j++) {
                    SSClusterCoords[i].push([this.xScale(this.SSCluster[i][j][0]), this.yScale(this.SSCluster[i][j][1])]);
                }
            }
            for (let i = 0; i < this.hulls.length; i++) {
                let hullData = d3.polygonHull(SSClusterCoords[i]);
                this.hulls[i]
                    .attr('d', hullData === null? null: 'M' + hullData.join('L') + 'Z');
            }
        }
    }
}
