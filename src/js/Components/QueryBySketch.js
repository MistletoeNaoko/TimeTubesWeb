import React from 'react';
import paper from 'paper';
import * as d3 from 'd3';
import {tickFormatting, formatValue} from '../lib/2DGraphLib';
import * as FeatureAction from '../Actions/FeatureAction';
import {createDateLabel} from '../lib/dataLib';
import FeatureStore from '../Stores/FeatureStore';
import DataStore from '../Stores/DataStore';

export default class QueryBySketch extends React.Component{
    constructor(props) {
        super();
        // make a complete lookup table for x/y axis selection of the sketch pad
        // props.lookup is a collection of lookups from all data
        let lookup = this.updateLookup();
        let targets = FeatureStore.getTarget();
        let minList = {}, maxList = {};
        let minTmp = [], maxTmp = [];
        for (let key in lookup) {
            minTmp = [];
            maxTmp = [];
            for (let i = 0; i < targets.length; i++) {
                minTmp.push(DataStore.getData(targets[i]).data.meta.min[key]);
                maxTmp.push(DataStore.getData(targets[i]).data.meta.max[key]);
            }
            minList[key] = minTmp;
            maxList[key] = maxTmp;
        }
        this.state = {
            xItem: props.xItem,
            yItem: props.yItem,
            xItemonPanel: props.xItem,
            yItemonPanel: props.yItem,
            size: 0,
            lookup: lookup,
            selector: 'pen',
            targetList: targets,
            minList: minList,
            maxList: maxList,
            detectWidth: true,
            assignVariables: false
        }
        // this.assignVariables = false;
        this.margin = {"bottom": 20, "left": 20 };
        this.curveSegment = 10;
        this.sketching = false;
        this.touch = false;
        this.path = null;
        this.pathWidth = null;
        this.penSizeCircle = null;
        // store the size of a radius at each control point
        this.radiuses = null;
        // store the coordinates on the path, each curve in the path is divided into the same number (curveSegment)
        // the index of segPoints coincides with pathUpper and pathLower
        this.segPoints = [];
        this.pathUpper = null;
        this.pathLower = null;
        
        this.highlightedPoint = null;
        this.highlightedPointIdx = -1;
        // store the information associated to each control point (position, assigned variables, label, labelRect)
        this.controlPoints = [];
        // what variable is assigned to the path width
        this.widthVar = null;
        // for converting drawing speed into the path width
        this.timeStamps = [];
        // for hit tests
        this.selectedIdx = -1;
        this.selectedHandle = null;
        this.selectedPoint = null;
        // for setup sliders and pass the slider values to scale
        this.xMinMax = [];
        this.yMinMax= [];
    }

    componentDidMount() {
        this.initCanvas();
        if (this.state.targetList.length > 0) {
            let minmax = this.computeMinMaxValue(this.state.minList, this.state.maxList);
            this.xMinMax = minmax.xMinMax;
            this.yMinMax = minmax.yMinMax;
            this.updateAxis();
            this.updateWidthVariable();
        }
        // this.initSketchMenu();
        FeatureStore.on('updateTarget', () => {
            // if (FeatureStore.getMode() === 'QBS') {
                let targets = FeatureStore.getTarget();
                let lists = this.extractMinMaxList(targets);
                let lookup = this.updateLookup();
                this.setState({
                    targetList: targets,
                    minList: lists.minList,
                    maxList: lists.maxList,
                    lookup: lookup
                });
                let minmax = this.computeMinMaxValue(lists.minList, lists.maxList);
                this.xMinMax = minmax.xMinMax;
                this.yMinMax = minmax.yMinMax;
                this.xAxisText
                    .text(this.state.lookup[this.state.xItem]);
                this.yAxisText
                    .text(this.state.lookup[this.state.yItem]);
                this.updateAxis();
                this.updateWidthVariable();
            // }
        });
        FeatureStore.on('switchQueryMode', (mode) => {
            if (mode === 'QBS') {
                let targets = FeatureStore.getTarget();
                let lists = this.extractMinMaxList(targets);
                this.setState({
                    targetList: targets,
                    minList: lists.minList,
                    maxList: lists.maxList,
                });
                let minmax = this.computeMinMaxValue(lists.minList, lists.maxList);
                this.xMinMax = minmax.xMinMax;
                this.yMinMax = minmax.yMinMax;
                this.xAxisText
                    .text(this.state.lookup[this.state.xItem]);
                this.yAxisText
                    .text(this.state.lookup[this.state.yItem]);
                this.updateAxis();
                this.updateWidthVariable();
            }
        });
        FeatureStore.on('convertResultIntoQuery', (id, period, ignored) => {
            if (FeatureStore.getMode() === 'QBS') {
                if (this.path) {
                    this.path.remove();
                }
                if (this.pathWidth) {
                    this.pathWidth.remove();
                }
                if (this.penSizeCircle) {
                    this.penSizeCircle.remove();
                }
                for (let i = 0; i < this.controlPoints.length; i++) {
                    if (this.controlPoints[i].label) {
                        this.controlPoints[i].label.remove();
                        this.controlPoints[i].label = null;
                        this.controlPoints[i].labelRect.remove();
                        this.controlPoints[i].labelRect = null;
                    }
                }
                this.controlPoints = [];
                this.timeStamps = [];
                this.radiuses = [];
                this.pathUpper = null;
                this.pathLower = null;
                this.segPoints = [];
                this.transformDataIntoSketch(id, period, ignored);
            }
        });
    }

    updateLookup() {
        let lookupList = [];
        let dataList = DataStore.getAllData();
        dataList.forEach(function (e) {
           lookupList.push(e.data.lookup);
        });
        let lookup = {};
        lookupList.forEach(function (e) {
           for (let key in e) {
               if (!lookup[key]) {
                   lookup[key] = e[key];
               } else {
                   e[key].forEach(function (ee) {
                       if (lookup[key].indexOf(ee) < 0) {
                           lookup[key].push(ee);
                       }
                   });
               }
           }
        });
        return lookup;
    }

    extractMinMaxList(targets) {
        let minList = {}, maxList = {};
        let minTmp = [], maxTmp = [];
        for (let key in this.state.lookup) {
            minTmp = [];
            maxTmp = [];
            for (let i = 0; i < targets.length; i++) {
                minTmp.push(DataStore.getData(targets[i]).data.meta.min[key]);
                maxTmp.push(DataStore.getData(targets[i]).data.meta.max[key]);
            }
            minList[key] = minTmp;
            maxList[key] = maxTmp;
        }
        return {minList: minList, maxList: maxList};
    }

    computeMinMaxValue(minList, maxList) {
        let xMin = Math.min.apply(null, minList[this.state.xItem]),
            xMax = Math.max.apply(null, maxList[this.state.xItem]),
            yMin = Math.min.apply(null, minList[this.state.yItem]),
            yMax = Math.max.apply(null, maxList[this.state.yItem]);
        if (this.state.xItem === 'z') {
            xMax = Math.min(xMax - xMin, 50);
            xMin = 0;
        }
        if (this.state.yItem === 'z') {
            yMax = Math.min(yMax - yMin, 50);
            yMin = 0;
        }
        return {xMinMax: [xMin, xMax], yMinMax: [yMin, yMax]};
    }

    initCanvas() {
        let paddingLeft = Number($('#featureArea').css('padding-left').replace('px', '')),
            paddingRight = Number($('#featureArea').css('padding-right').replace('px', ''));
        let outerSize = Math.floor($('#mainFeatureArea').width() * 0.3 - paddingLeft - paddingRight);
        this.setState({
            size: outerSize
        });
        let parentArea = d3.select('#QBSCanvasArea')
            .style('position', 'relative')
            .style('padding-bottom', outerSize + 'px');
        this.svg = parentArea.append('svg')
            .attr('id', 'QBSSketchPadSVG')
            .attr('width', outerSize)
            .attr('height', outerSize)
            .style('position', 'absolute');
        this.canvas = parentArea.append('canvas')
            .attr('width', outerSize + 'px !important')
            .attr('height', outerSize + 'px !important')
            .attr('id', 'QBSSketchPad')
            .style('position', 'absolute')
            .style('border', '1px solid lightgray');
        paper.setup(this.canvas.node());

        this.xAxis = this.svg
            .append('g')
            .attr('class', 'x_axis');
        this.xAxisText = parentArea
            .append('text')
            .attr('class', 'axisLabel')
            .attr('id', 'sketchPadXLabel')
            .attr('fill', 'black')
            .attr('text-anchor', 'middle')
            .style('font-size', '0.7rem')
            .style('position', 'absolute')
            .style('background-color', 'white')
            .style('left', outerSize / 2 + 'px')
            .style('top', outerSize - 18 + 'px')
            .text(this.state.lookup[this.state.xItem])
            .on('click', this.CanvasXLabelOnClick().bind(this));
        this.xScale = d3.scaleLinear();

        this.yAxis = this.svg
            .append('g')
            .attr('class', 'y_axis');
        this.yAxisText = parentArea
            .append('text')
            .attr('class', 'axisLabel')
            .attr('id', 'sketchPadYLabel')
            .attr('fill', 'black')
            .attr('transform', 'rotate(-90)')
            .attr('text-anchor', 'middle')
            .style('font-size', '0.7rem')
            .style('position', 'absolute')
            .style('background-color', 'white')
            .style('left', this.margin.left / 2 + 'px')
            .style('top', outerSize / 2 + 'px')
            .text(this.state.lookup[this.state.yItem])
            .on('click', this.CanvasYLabelOnClick().bind(this));
        this.yScale = d3.scaleLinear();

        this.tool = new paper.Tool();
        this.tool.minDistance = 15;
        this.tool.onMouseDown = this.CanvasOnMouseDown().bind(this);
        this.tool.onMouseDrag = this.CanvasOnMouseDrag().bind(this);
        this.tool.onMouseUp = this.CanvasOnMouseUp().bind(this);

        document.getElementById('QBSSketchPad').addEventListener('touchmove', this.CanvasOnTouchMove().bind(this));

        paper.view.onFrame = this.CanvasOnFrame().bind(this);
    }

    CanvasOnFrame() {
        return function (event) {
            if (this.sketching && !this.touch && this.penSizeCircle) {
                let center = this.penSizeCircle.position;
                let now = Date.now();
                let deltaT = now - this.timeStamps[this.timeStamps.length - 1];
                let t = Math.min(deltaT / 1000 * 30 + 5 / 2, 100);
                this.penSizeCircle.remove();
                this.penSizeCircle = new paper.Path.Circle(center, t);
                this.penSizeCircle.strokeColor = '#325D88';
            }
        };
    }

    clearCanvas() {
        if (this.path) {
            this.path.remove();
        }
        if (this.pathWidth) {
            this.pathWidth.remove();
        }
        if (this.penSizeCircle) {
            this.penSizeCircle.remove();
        }
        for (let i = 0; i < this.controlPoints.length; i++) {
            if (this.controlPoints[i].label) {
                this.controlPoints[i].label.remove();
                this.controlPoints[i].label = null;
                this.controlPoints[i].labelRect.remove();
                this.controlPoints[i].labelRect = null;
            }
        }
        // initialize all
        this.controlPoints = [];
        this.timeStamps = [];
        this.radiuses = [];
    }

    CanvasOnTouchMove() {
        return function(e) {
            if (this.sketching && this.touch && this.penSizeCircle) {
                let center = this.penSizeCircle.position;
                let t = (100 - 2.5) * e.touches[0].force + 2.5;
                this.penSizeCircle.remove();
                this.penSizeCircle = new paper.Path.Circle(center, t);
                this.penSizeCircle.strokeColor = '#325D88';
            }
        }
    }

    CanvasOnMouseDown() {
        return function (event) {
            let hitResult;
            if (this.state.assignVariables) {
                hitResult = null;
                hitResult = this.path.hitTest(event.point, {segments: true, tolerance: 5});
                if (hitResult) {
                    this.highlightedPointIdx = hitResult.segment.index;
                    // highlight the clicked point
                    if (this.highlightedPoint) {
                        this.highlightedPoint.remove();
                    }
                    this.highlightedPoint = new paper.Path.Circle({
                        center: hitResult.point,
                        radius: 5,
                        fillColor: '#d23430'
                    });

                    // set up the popover
                    let popover = $('#controlPointPopover');
                    popover.css('display', 'block');
                    let popoverArrow = $('#controlPointPopoverArrow');
                    let arrowWidth = 16, arrowHeight = 8;
                    let popoverWidth = popover.outerWidth() + arrowHeight,
                        popoverHeight = popover.outerHeight() + arrowHeight;
                    let placement = null, position;
                    let arrowPos = {}; // top, bottom, left, right
                    let spaceRight = this.state.size - hitResult.point.x,
                        spaceLeft = hitResult.point.x,
                        spaceTop = hitResult.point.y,
                        spaceBottom = this.state.size - hitResult.point.y;

                    if (spaceRight >= popoverWidth) {
                        // place on the right
                        placement = 'right';
                        popover.attr('class', 'popover bs-popover-' + placement);
                        popoverWidth = popover.outerWidth(true);
                        popoverHeight = popover.outerHeight(true);
                        position = {x: hitResult.point.x, y: hitResult.point.y - popoverHeight / 2};
                        arrowPos = {top: (popoverHeight / 2 - arrowWidth) + 'px'};
                    } else if (spaceLeft >= popoverWidth) {
                        // place on the left
                        placement = 'left';
                        popover.attr('class', 'popover bs-popover-' + placement);
                        popoverWidth = popover.outerWidth(true);
                        popoverHeight = popover.outerHeight(true);
                        position = {x: hitResult.point.x - popoverWidth, y: hitResult.point.y - popoverHeight / 2};
                        arrowPos = {top: (popoverHeight / 2 - arrowWidth) + 'px'};
                    } else if (spaceTop >= popoverHeight) {
                        // place on the top
                        placement = 'top';
                        popover.attr('class', 'popover bs-popover-' + placement);
                        popoverWidth = popover.outerWidth(true);
                        popoverHeight = popover.outerHeight(true);
                        position = {x: hitResult.point.x - popoverWidth / 2, y: hitResult.point.y - popoverHeight};
                        arrowPos = {left: (popoverWidth / 2 - arrowWidth) + 'px'};
                    } else if (spaceBottom >= popoverHeight) {
                        // place on the bottom
                        placement = 'bottom';
                        popover.attr('class', 'popover bs-popover-' + placement);
                        popoverWidth = popover.outerWidth(true);
                        popoverHeight = popover.outerHeight(true);
                        position = {x: hitResult.point.x - popoverWidth / 2, y: hitResult.point.y};
                        arrowPos = {left: (popoverWidth / 2 - arrowWidth) + 'px'};
                    } else {

                    }

                    if (position.x < 0) {
                        position.x = 0;
                        arrowPos = {left: (hitResult.point.x - arrowWidth) + 'px'};
                    } else if (position.x > this.state.size - popoverWidth) {
                        position.x = this.state.size - popoverWidth;
                        arrowPos = {left: (this.state.size - hitResult.point.x - arrowWidth) + 'px'};
                    }

                    if (position.y < 0) {
                        position.y = 0;
                        arrowPos = {top: (hitResult.point.y - arrowWidth) + 'px'};
                    } else if (position.y > this.state.size - popoverHeight) {
                        position.y = this.state.size - popoverHeight;
                        arrowPos = {top: (popoverHeight - (this.state.size - hitResult.point.y) - arrowWidth) + 'px'};
                    }

                    popover.css({left: position.x + 'px', top: position.y + 'px'});
                    popoverArrow.css({top: '', left: ''});
                    popoverArrow.css(arrowPos);
                    for (let key in this.controlPoints[this.highlightedPointIdx].assignedVariables) {
                        if (this.controlPoints[this.highlightedPointIdx].assignedVariables[key].length <= 0) {
                            // if no variables are assigned yet
                            if (key === this.state.xItem) {
                                // show x value
                                $('#valueAssignmentCheckbox_' + key).prop('disabled', true);
                                $('#slider_' + key).css('display', 'none');
                                $('#widthValue_' + key).css('display', 'block');
                                $('#widthValue_' + key).text(
                                    formatValue(
                                        this.xScale.invert(this.controlPoints[this.highlightedPointIdx].position.x)
                                    )
                                );
                            } else if (key === this.state.yItem) {
                                // show y value
                                $('#valueAssignmentCheckbox_' + key).prop('disabled', true);
                                $('#slider_' + key).css('display', 'none');
                                $('#widthValue_' + key).css('display', 'block');
                                $('#widthValue_' + key).text(
                                    formatValue(
                                        this.yScale.invert(this.controlPoints[this.highlightedPointIdx].position.y)
                                    )
                                );
                            } else if (key !== this.widthVar) {
                                // show a slider
                                $('#valueAssignmentCheckbox_' + key).prop('checked', false);
                                $('#valueAssignmentCheckbox_' + key).prop('disabled', false);
                                $('#slider_' + key).css('display', 'block');
                                $('#slider_' + key).slider('option', 'values', [0, 100]);
                                $('#slider_' + key).slider('option', 'disabled', true);
                                $('#widthValue_' + key).css('display', 'none');
                            } else {
                                // show a value from the current width
                                $('#valueAssignmentCheckbox_' + key).prop('disabled', true);
                                $('#slider_' + key).css('display', 'none');
                                let minRad = Math.min.apply(null, this.radiuses),
                                    maxRad = Math.max.apply(null, this.radiuses);
                                let minVal = Math.min.apply(null, this.state.minList[key]),
                                    maxVal = Math.max.apply(null, this.state.maxList[key]);
                                let sliderRange = $('#sketchWidthSlider').slider('option', 'values');
                                let minRange = sliderRange[0] / 100 * (maxVal - minVal) + minVal,
                                    maxRange = sliderRange[1] / 100 * (maxVal - minVal) + minVal;

                                $('#widthValue_' + key).css('display', 'block');
                                $('#widthValue_' + key).text(formatValue((maxRange - minRange) / (maxRad - minRad) * (this.radiuses[this.highlightedPointIdx] - minRad) + minRange));
                            }
                        } else {
                            // if some variables are already assigned
                            if (key === this.state.xItem) {
                                // show x value
                                $('#valueAssignmentCheckbox_' + key).prop('disabled', true);
                                $('#slider_' + key).css('display', 'none');
                                $('#widthValue_' + key).css('display', 'block');
                                $('#widthValue_' + key).text(
                                    formatValue(
                                        this.xScale.invert(this.controlPoints[this.highlightedPointIdx].position.x)
                                    )
                                );
                            } else if (key === this.state.yItem) {
                                // show y value
                                $('#valueAssignmentCheckbox_' + key).prop('disabled', true);
                                $('#slider_' + key).css('display', 'none');
                                $('#widthValue_' + key).css('display', 'block');
                                $('#widthValue_' + key).text(
                                    formatValue(
                                        this.yScale.invert(this.controlPoints[this.highlightedPointIdx].position.y)
                                    )
                                );
                            } else if (key !== this.widthVar) {
                                // show a slider
                                $('#valueAssignmentCheckbox_' + key).prop('checked', true);
                                $('#valueAssignmentCheckbox_' + key).prop('disabled', false);
                                let min = Math.min.apply(null, this.state.minList[key]);
                                let max = Math.max.apply(null, this.state.maxList[key]);
                                $('#slider_' + key).slider('option', 'values', [
                                    (this.controlPoints[this.highlightedPointIdx].assignedVariables[key][0] - min) / (max - min) * 100,
                                    (this.controlPoints[this.highlightedPointIdx].assignedVariables[key][1] - min) / (max - min) * 100
                                ]);
                                $('#slider_' + key).slider('option', 'disabled', false);
                            } else {
                                // show a value from the current width
                                $('#valueAssignmentCheckbox_' + key).prop('disabled', true);
                                $('#slider_' + key).css('display', 'none');
                                let minRad = Math.min.apply(null, this.radiuses),
                                    maxRad = Math.max.apply(null, this.radiuses);
                                let minVal = Math.min.apply(null, this.state.minList[key]),
                                    maxVal = Math.max.apply(null, this.state.maxList[key]);
                                let sliderRange = $('#sketchWidthSlider').slider('option', 'values');
                                let minRange = sliderRange[0] / 100 * (maxVal - minVal) + minVal,
                                    maxRange = sliderRange[1] / 100 * (maxVal - minVal) + minVal;

                                $('#widthValue_' + key).css('display', 'block');
                                $('#widthValue_' + key).text(formatValue((maxRange - minRange) / (maxRad - minRad) * (this.radiuses[this.highlightedPointIdx] - minRad) + minRange));
                            }
                        }
                    }
                }
            } else {
                let inputType = event.event.type; // mousedown or touchstart
                switch (this.state.selector) {
                    case 'pen':
                        this.sketching = true;
                        if (inputType === 'touchstart') {
                            this.touch = true;
                        }
                        this.clearCanvas();

                        if (this.state.detectWidth) {
                            this.radiuses.push(0);
                            this.pathWidth = new paper.Path({
                                segments: [event.point],
                                strokeColor: '#325D88',
                                strokeWidth: 1,
                                fillColor: '#29ABE0',
                                opacity: 0.5
                            });
                            this.penSizeCircle = new paper.Path.Circle(event.point, 2.5);
                            this.penSizeCircle.strokeColor = '#325D88';
                            this.timeStamps.push(Date.now());
                        }
                        this.path = new paper.Path({
                            segments: [event.point],
                            strokeColor: 'black',
                            strokeWidth: 5
                        });
                        break;
                    case 'addPoint':
                        hitResult = null;
                        hitResult = this.path.hitTest(event.point, {fill: true, stroke: true, tolerance: 5});
                        if (hitResult) {
                            let curve = hitResult.location.curve;
                            let originalCurveLen = curve.length;
                            this.path.insert(curve.segment2.index, hitResult.point);
                            this.controlPoints.splice(curve.segment2.index, 0, {
                                position: {x: hitResult.point.x, y: hitResult.point.x},
                                assignedVariables: {},
                                label: null,
                                labelRect: null
                            });
                            for (let key in this.state.lookup) {
                                this.controlPoints[curve.segment2.index].assignedVariables[key] = [];
                            }
                            // add radiuses, segPoints, pathUpper, pathLower
                            let offset = this.path.getOffsetOf(hitResult.point);
                            let curveLen = 0;
                            for (let i = 0; i < curve.segment1.index; i++) {
                                curveLen += this.path.curves[i].length;
                            }

                            if (this.state.detectWidth) {
                                let r0 = this.radiuses[curve.segment1.index],
                                    r2 = this.radiuses[curve.segment2.index];
                                let r1 = (r2 - r0) * curve.length / originalCurveLen + r0;
                                this.radiuses.splice(curve.segment2.index, 0, r1);
                                this.pathWidth.remove();
                                this.drawPathWidth();
                            }
                        }
                        break;
                    case 'eraser':
                        hitResult = null;
                        hitResult = this.path.hitTest(event.point, {segments: true, tolerance: 5});
                        if (hitResult) {
                            let removedIdx = hitResult.segment.index;
                            this.path.removeSegment(removedIdx);
                            this.controlPoints.splice(removedIdx, 1);
                            if (this.state.detectWidth) {
                                this.radiuses.splice(removedIdx, 1);
                                this.pathWidth.remove();
                                this.drawPathWidth();
                            }
                        }
                        break;
                    case 'controlPoint':
                        this.tool.minDistance = 1;
                        this.selectedIdx = -1;
                        this.selectedHandle = null;
                        this.selectedPoint = null;
                        hitResult = null;
                        // Hit test on path for handles:
                        hitResult = this.path.hitTest(event.point, {handles: true, tolerance: 5});
                        if (hitResult) {
                            this.selectedIdx = hitResult.segment.index;
                            if (hitResult.type === 'handle-in') {
                                this.selectedHandle = hitResult.segment.handleIn;
                            } else if (hitResult.type === 'handle-out') {
                                this.selectedHandle = hitResult.segment.handleOut;
                            }
                        }
                        // if no handles were hit, hit test on points (segments)
                        if (this.selectedHandle == null) {
                            hitResult = this.path.hitTest(event.point, {segments: true, tolerance: 5});
                            if (hitResult) {
                                this.selectedIdx = hitResult.segment.index;
                                this.selectedPoint = hitResult.segment;
                            }
                        }
                        break;
                    case 'changeWidth':
                        if (this.state.detectWidth) {
                            this.tool.minDistance = 1;
                            this.selectedIdx = -1;
                            this.selectedPoint = null;
                            hitResult = null;

                            hitResult = this.path.hitTest(event.point, {segments: true, tolerance: 5});
                            if (hitResult) {
                                this.selectedIdx = hitResult.segment.index;
                                this.selectedPoint = hitResult.segment;
                            }
                        }
                        break;
                }
            }
        };
    }

    CanvasOnMouseDrag() {
        return function (event) {
            let inputType = event.event.type; // mousemove or touchmove
            if (!this.state.assignVariables) {
                switch (this.state.selector) {
                    case 'pen':
                        this.path.add(event.point);
                        if (this.state.detectWidth) {
                            if (inputType === 'mousemove') {
                                let now = Date.now();
                                let deltaT = now - this.timeStamps[this.timeStamps.length - 1];
                                this.timeStamps.push(now);
                                let t = Math.min(deltaT / 1000 * 30 + 5 / 2, 100);
                                let deltaX = event.delta.x, deltaY = event.delta.y;
                                let l = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                                let step = event.delta;
                                step.angle += 90;
                                let top = {
                                    x: event.middlePoint.x + t / l * step.x,
                                    y: event.middlePoint.y + t / l * step.y
                                };
                                let bottom = {
                                    x: event.middlePoint.x - t / l * step.x,
                                    y: event.middlePoint.y - t / l * step.y
                                };
                                this.pathWidth.add(top);
                                this.pathWidth.insert(0, bottom);
                                this.pathWidth.smooth();
                                this.radiuses.push(t);
                                this.penSizeCircle.remove();
                                this.penSizeCircle = new paper.Path.Circle(event.point, 2.5);
                                this.penSizeCircle.strokeColor = '#325D88';
                            } else if (inputType === 'touchmove') {
                                let pressure = 0;
                                if (event.event.touches.length > 0) {
                                    pressure = event.event.touches[0].force;
                                    // pressure: 0-1
                                    // radius: 2.5-100
                                    let t = (100 - 2.5) * pressure + 2.5;
                                    let deltaX = event.delta.x, deltaY = event.delta.y;
                                    let l = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                                    let step = event.delta;
                                    step.angle += 90;
                                    let top = {
                                        x: event.middlePoint.x + t / l * step.x,
                                        y: event.middlePoint.y + t / l * step.y
                                    };
                                    let bottom = {
                                        x: event.middlePoint.x - t / l * step.x,
                                        y: event.middlePoint.y - t / l * step.y
                                    };
                                    this.pathWidth.add(top);
                                    this.pathWidth.insert(0, bottom);
                                    this.pathWidth.smooth();
                                    this.radiuses.push(t);
                                    this.penSizeCircle.remove();
                                    this.penSizeCircle = new paper.Path.Circle(event.point, 2.5);
                                    this.penSizeCircle.strokeColor = '#325D88';
                                }
                            }
                        }
                        break;
                    case 'controlPoint':
                        if (this.selectedIdx >= 0) {
                            if (this.selectedHandle) {
                                this.selectedHandle.x += event.delta.x;
                                this.selectedHandle.y += event.delta.y;
                            }
                            if (this.selectedPoint) {
                                this.selectedPoint.point.x += event.delta.x;
                                this.selectedPoint.point.y += event.delta.y;
                                this.controlPoints[this.selectedIdx].position = {
                                    x: this.selectedPoint.point.x + event.delta.x,
                                    y: this.selectedPoint.point.y + event.delta.y
                                };
                            }
                            if (this.controlPoints[this.selectedIdx].label !== null) {
                                this.controlPoints[this.selectedIdx].label.position = new paper.Point(this.controlPoints[this.selectedIdx].position.x, this.controlPoints[this.selectedIdx].position.y - 10);
                                this.controlPoints[this.selectedIdx].labelRect.position = this.controlPoints[this.selectedIdx].label.bounds;
                            }
                        }
                        if (this.state.detectWidth) {
                            if (this.selectedIdx > 0 && this.selectedIdx < this.path.segments.length - 1) {
                                // move the curves both before and after the point
                                let curveLen = 0;
                                // the length of the path from the starting point to the point just before the selected point
                                for (let i = 0; i < this.selectedIdx - 1; i++) {
                                    curveLen += this.path.curves[i].length;
                                }
                                let r0 = this.radiuses[this.selectedIdx - 1],
                                    r1 = this.radiuses[this.selectedIdx],
                                    r2 = this.radiuses[this.selectedIdx + 1];
                                // change the one before the point
                                let currentCurveLen = this.path.curves[this.selectedIdx - 1].length;
                                for (let i = 1; i < this.curveSegment; i++) {
                                    let rj = (r1 - r0) * i / this.curveSegment + r0;
                                    let p = this.path.getPointAt(curveLen + currentCurveLen / this.curveSegment * i);
                                    let delta;
                                    let idx = (this.selectedIdx - 1) * this.curveSegment + i;
                                    let p0 = this.segPoints[idx - 1];
                                    delta = new paper.Point(p.x - p0.x, p.y - p0.y);
                                    let lDelta = Math.sqrt(delta.x * delta.x + delta.y * delta.y);
                                    delta.angle += 90;
                                    this.segPoints[idx] = p;
                                    this.pathUpper[idx] = {
                                        x: p.x + rj / lDelta * delta.x,
                                        y: p.y + rj / lDelta * delta.y
                                    };
                                    this.pathLower[idx] = {
                                        x: p.x - rj / lDelta * delta.x,
                                        y: p.y - rj / lDelta * delta.y
                                    };
                                }
                                curveLen += currentCurveLen;
                                // change the one after the point
                                currentCurveLen = this.path.curves[this.selectedIdx].length;
                                for (let i = 0; i < this.curveSegment; i++) {
                                    let rj = (r2 - r1) * i / this.curveSegment + r1;
                                    let p = this.path.getPointAt(curveLen + currentCurveLen / this.curveSegment * i);
                                    let delta;
                                    let idx = this.selectedIdx * this.curveSegment + i;
                                    let p0 = this.segPoints[idx - 1];
                                    delta = new paper.Point(p.x - p0.x, p.y - p0.y);
                                    let lDelta = Math.sqrt(delta.x * delta.x + delta.y * delta.y);
                                    delta.angle += 90;
                                    this.segPoints[idx] = p;
                                    this.pathUpper[idx] = {
                                        x: p.x + rj / lDelta * delta.x,
                                        y: p.y + rj / lDelta * delta.y
                                    };
                                    this.pathLower[idx] = {
                                        x: p.x - rj / lDelta * delta.x,
                                        y: p.y - rj / lDelta * delta.y
                                    };
                                }
                            } else if (this.selectedIdx === 0) {
                                // move the curve after the point
                                let r0 = this.radiuses[0],
                                    r1 = this.radiuses[1];
                                let currentCurveLen = this.path.curves[0].length;
                                for (let i = 0; i < this.curveSegment; i++) {
                                    let rj = (r1 - r0) * i / this.curveSegment + r0;
                                    let p = this.path.getPointAt(currentCurveLen / this.curveSegment * i);
                                    let delta;
                                    if (i === 0) {
                                        delta = new paper.Point(this.path.segments[0].handleOut.x, this.path.segments[0].handleOut.y);
                                    } else {
                                        let p0 = this.segPoints[i - 1];
                                        delta = new paper.Point(p.x - p0.x, p.y - p0.y);
                                    }
                                    let lDelta = Math.sqrt(delta.x * delta.x + delta.y * delta.y);
                                    delta.angle += 90;
                                    this.segPoints[i] = p;
                                    this.pathUpper[i] = {
                                        x: p.x + rj / lDelta * delta.x,
                                        y: p.y + rj / lDelta * delta.y
                                    };
                                    this.pathLower[i] = {
                                        x: p.x - rj / lDelta * delta.x,
                                        y: p.y - rj / lDelta * delta.y
                                    };
                                }
                            } else if (this.selectedIdx === this.path.segments.length - 1) {
                                let curveLen = 0;
                                // the length of the path from the starting point to the point just before the selected point
                                for (let i = 0; i < this.selectedIdx - 1; i++) {
                                    curveLen += this.path.curves[i].length;
                                }
                                // move the curve before the point
                                let r0 = this.radiuses[this.selectedIdx - 1],
                                    r1 = this.radiuses[this.selectedIdx];
                                // change the one before the point
                                let currentCurveLen = this.path.curves[this.selectedIdx - 1].length;
                                for (let i = 1; i <= this.curveSegment; i++) {
                                    let rj = (r1 - r0) * i / this.curveSegment + r0;
                                    let p;
                                    if (i !== this.curveSegment) {
                                        p = this.path.getPointAt(curveLen + currentCurveLen / this.curveSegment * i);
                                    } else {
                                        p = this.path.segments[this.path.segments.length - 1].point;
                                    }
                                    let delta;
                                    let idx = (this.selectedIdx - 1) * this.curveSegment + i;
                                    let p0 = this.segPoints[idx - 1];
                                    delta = new paper.Point(p.x - p0.x, p.y - p0.y);
                                    let lDelta = Math.sqrt(delta.x * delta.x + delta.y * delta.y);
                                    delta.angle += 90;
                                    this.segPoints[idx] = p;
                                    this.pathUpper[idx] = {
                                        x: p.x + rj / lDelta * delta.x,
                                        y: p.y + rj / lDelta * delta.y
                                    };
                                    this.pathLower[idx] = {
                                        x: p.x - rj / lDelta * delta.x,
                                        y: p.y - rj / lDelta * delta.y
                                    };
                                }
                            }
                            let reversedLower = this.pathLower.slice().reverse();
                            let mergedPoints = this.pathUpper.concat(reversedLower);

                            this.pathWidth.remove();
                            this.pathWidth = new paper.Path({
                                segments: mergedPoints,
                                strokeColor: '#325D88',
                                strokeWidth: 1,
                                fillColor: '#29ABE0',
                                opacity: 0.5,
                                closed: true
                            });
                            this.pathWidth.smooth();
                            this.pathWidth.sendToBack();
                        }
                        break;
                    case 'changeWidth':
                        if (this.state.detectWidth) {
                            if (this.selectedPoint) {
                                // this.selectedPoint.point.x += event.delta.x;
                                // this.selectedPoint.point.y += event.delta.y;
                                let delX = event.point.x - this.selectedPoint.point.x,
                                    delY = event.point.y - this.selectedPoint.point.y;
                                let size = Math.sqrt(delX * delX + delY * delY);
                                if (this.penSizeCircle) {
                                    this.penSizeCircle.remove();
                                }
                                this.penSizeCircle = new paper.Path.Circle(this.selectedPoint.point, size);
                                this.penSizeCircle.strokeColor = '#325D88';
                            }
                        }
                        break;
                }
            }
        };
    }

    CanvasOnMouseUp() {
        return function (event) {
            let inputType = event.event.type; // mouseup or touchend
            if (!this.state.assignVariables) {
                switch (this.state.selector) {
                    case 'pen':
                        let reverse = false;
                        this.path.add(event.point);
                        let segments = this.path.segments.slice(0, this.path.segments.length);
                        if (segments[segments.length - 2].point.x > segments[segments.length - 1].point.x) {
                            reverse = true;
                        }
                        this.path.simplify(10);
                        this.path.segments.forEach(function (e) {
                            this.controlPoints.push({
                                position: {x: e.point.x, y: e.point.y},
                                assignedVariables: {},
                                label: null,
                                labelRect: null
                            });
                            for (let key in this.state.lookup) {
                                this.controlPoints[this.controlPoints.length - 1].assignedVariables[key] = [];
                            }
                        }.bind(this));
                        if (this.state.detectWidth) {
                            let t = 0;
                            if (inputType === 'mouseup') {
                                let now = Date.now();
                                let deltaT = now - this.timeStamps[this.timeStamps.length - 1];
                                this.timeStamps.push(now);
                                t = Math.min(deltaT / 1000 * 30 + 5 / 2, 100);
                            } else if (inputType === 'touchend') {
                                let pressure = 0;
                                if (event.event.touches.length > 0) {
                                    pressure = event.event.touches[0].force;
                                    t = (100 - 2.5) * pressure + 2.5;
                                }
                            }
                            this.radiuses.push(t);

                            // remove the temporal width path
                            this.pathWidth.remove();

                            // simplificationDeg should be odd (- - * + +: * is the value of the point)
                            let simplificationDeg = segments.length / this.path.segments.length;
                            simplificationDeg = (Math.floor(simplificationDeg) % 2 === 1) ? Math.floor(simplificationDeg) : Math.ceil(simplificationDeg);

                            // get the radius value of each point on the simplified path
                            let idxOriginal = 0, idxSimple = 0;
                            let radiusesSimple = [];
                            while (idxOriginal < segments.length && idxSimple < this.path.segments.length) {
                                if (segments[idxOriginal].point.x === this.path.segments[idxSimple].point.x
                                    && segments[idxOriginal].point.y === this.path.segments[idxSimple].point.y) {
                                    let radTmp = 0, count = 0;
                                    let startIdx = idxOriginal - Math.floor(simplificationDeg / 2);
                                    let endIdx = idxOriginal + Math.floor(simplificationDeg / 2);
                                    startIdx = Math.max(0, startIdx);
                                    endIdx = Math.min(segments.length - 1, endIdx);
                                    for (let i = startIdx; i <= endIdx; i++) {
                                        radTmp += this.radiuses[i];
                                        count++;
                                    }
                                    radTmp /= count;
                                    radiusesSimple.push(radTmp);
                                    idxOriginal++;
                                    idxSimple++;
                                    continue;
                                }
                                idxOriginal++;
                            }
                            this.radiuses = radiusesSimple;

                            // compute the upper/lower points of the simplified curve
                            this.drawPathWidth();
                            this.penSizeCircle.remove();
                        }
                        this.penSizeCircle = null;
                        this.sketching = false;
                        this.touch = false;
                        this.touchPressure = 0;
                        break;
                    case 'controlPoint':
                        this.selectedHandle = null;
                        this.selectedPoint = null;
                        break;
                    case 'changeWidth':
                        if (this.state.detectWidth && this.penSizeCircle && this.selectedPoint) {
                            let delX = this.penSizeCircle.segments[0].point.x - this.selectedPoint.point.x,
                                delY = this.penSizeCircle.segments[0].point.y - this.selectedPoint.point.y;
                            let size = Math.sqrt(delX * delX + delY * delY);
                            this.radiuses[this.selectedIdx] = size;
                            this.selectedHandle = null;
                            this.selectedPoint = null;
                            this.selectedIdx = -1;
                            this.pathWidth.remove();
                            this.drawPathWidth();
                            this.penSizeCircle.remove();
                        }
                        break;
                }
                this.tool.minDistance = 15;
            }
            this.convertSketchIntoQuery(this.state.xItem, this.state.yItem);
        };
    }

    drawPathWidth() {
        // compute the upper/lower points of the simplified curve
        if (this.path.curves.length > 0) {
            this.segPoints = [];
            let upperPoints = [], lowerPoints = [];
            let curveLen = 0;
            for (let i = 0; i < this.path.curves.length; i++) {
                let r0 = this.radiuses[i],
                    r1 = this.radiuses[i + 1];
                let currentCurveLen = this.path.curves[i].length;
                for (let j = 0; j < this.curveSegment; j++) {
                    let rj = (r1 - r0) * j / this.curveSegment + r0;
                    let p = this.path.getPointAt(curveLen + currentCurveLen / this.curveSegment * j);
                    let delta;
                    if (j === 0 && this.path.segments[i].handleOut.x !== 0 && this.path.segments[i].handleOut.y !== 0) {
                        delta = new paper.Point(this.path.segments[i].handleOut.x, this.path.segments[i].handleOut.y);
                    } else {
                        let p0 = this.segPoints[this.segPoints.length - 1];
                        delta = new paper.Point(p.x - p0.x, p.y - p0.y);
                    }
                    let lDelta = Math.sqrt(delta.x * delta.x + delta.y * delta.y);
                    delta.angle += 90;
                    this.segPoints.push(p);
                    upperPoints.push({x: p.x + rj / lDelta * delta.x, y: p.y + rj / lDelta * delta.y});
                    lowerPoints.push({x: p.x - rj / lDelta * delta.x, y: p.y - rj / lDelta * delta.y});
                }
                curveLen += currentCurveLen;
            }
            // add the last point of the path
            let rj = this.radiuses[this.radiuses.length - 1];
            let p = this.path.segments[this.path.segments.length - 1].point;
            let p0 = this.segPoints[this.segPoints.length - 1];
            let delta = new paper.Point(p.x - p0.x, p.y - p0.y);
            let lDelta = Math.sqrt(delta.x * delta.x + delta.y * delta.y);
            delta.angle += 90;
            this.segPoints.push(p);
            upperPoints.push({x: p.x + rj / lDelta * delta.x, y: p.y + rj / lDelta * delta.y});
            lowerPoints.push({x: p.x - rj / lDelta * delta.x, y: p.y - rj / lDelta * delta.y});
            this.pathUpper = upperPoints;
            this.pathLower = lowerPoints;
            let reversedLower = lowerPoints.slice().reverse();
            let mergedPoints = upperPoints.concat(reversedLower);
            this.pathWidth = new paper.Path({
                segments: mergedPoints,
                strokeColor: '#325D88',
                strokeWidth: 1,
                fillColor: '#29ABE0',
                opacity: 0.5,
                closed: true
            });
            this.pathWidth.smooth();
            this.pathWidth.sendToBack();
        }
    }

    convertSketchIntoQuery(xItem, yItem) {
        // if the x or y axis is not JD
        // divide path into small segments with the same length
        // the number of segments is decided by the user-input query length
        // e.g. for the sketch for 20 days, the path will be divided into 20 segments
        // the coordinates of each segment point can be obtained by this.path.getPointAt(offset)
        // radius of each point also can be computed by interpolating this.radiuses
        // up to here, x, y, and width are converted into arrays
        // during the upper procedure, assigned filtering values to the nearest time slice to the original segment

        // if the x or y axis is JD
        // create a new line which is orthogonal to the JD axis
        // do getIntersections between the sketch and the line by moving the line by a day
        // from getIntersections result, position of the point on the path will be obtained
        // width can be computed from the offset value of the getIntersections and interporation

        // as a result, the converted query will look like as follows:
        // query: {
        // x: [collection of values day by day],
        // y: [...],
        // w: [...],
        // f1: [null, null, ..., [min, max], ...],
        // ...
        // arrayLength: xx}
        if (this.state.targetList.length > 0 && this.path && this.path.curves.length > 0) {
            // only when something is on the sketch pad

            let query = {};
            for (let key in this.state.lookup) {
                if (key !== 'z') {
                    query[key] = [];
                }
            }

            if (xItem !== 'z' && yItem !== 'z') {
                // if the x or y axis is not JD
                // get total length of the path
                let totalLength = this.path.length;

                // get the time length of the sketch
                let timeLength = $('#periodOfSketchQuery').val();
                if (timeLength !== '') {
                    timeLength = Number(timeLength);
                    let del = totalLength / timeLength;
                    let currentLen = this.path.curves[0].length,
                        curveIdx = 0,
                        totalCurveLen = 0,
                        pointBefore;
                    let radRange = [], valueRange = [];
                    if (this.widthVar) {
                        let minRad = Math.min.apply(null, this.radiuses),
                            maxRad = Math.max.apply(null, this.radiuses);
                        let minVal = Math.min.apply(null, this.state.minList[this.widthVar]),
                            maxVal = Math.max.apply(null, this.state.maxList[this.widthVar]);
                        let sliderRange = $('#sketchWidthSlider').slider('option', 'values');
                        let minRange = sliderRange[0] / 100 * (maxVal - minVal) + minVal,
                            maxRange = sliderRange[1] / 100 * (maxVal - minVal) + minVal;
                        radRange = [minRad, maxRad];
                        valueRange = [minRange, maxRange];
                    }
                    for (let key in query) {
                        if (this.controlPoints[0].assignedVariables[key].length > 0) {
                            query[key].push(this.controlPoints[0].assignedVariables[key]);
                        }
                    }
                    pointBefore = this.controlPoints[0].position;
                    for (let i = 0; i <= timeLength; i++) {
                        // convert x and y pos into values
                        let point = this.path.getPointAt(del * i);
                        if (point) {
                            for (let key in query) {
                                if (key === xItem) {
                                    // convert x pos to value
                                    query[key].push(this.xScale.invert(point.x));
                                } else if (key === yItem) {
                                    // convert y pos to value
                                    query[key].push(this.yScale.invert(point.y));
                                } else if (key === this.widthVar) {
                                    // convert width into value
                                    let width = (this.radiuses[curveIdx + 1] - this.radiuses[curveIdx])
                                        * (del * i - totalCurveLen) / currentLen + this.radiuses[curveIdx];
                                    query[key].push((valueRange[1] - valueRange[0]) / (radRange[1] - radRange[0]) * (width - radRange[0]) + valueRange[0]);
                                } else {
                                    query[key].push(null);
                                }
                            }

                            // update curveLen, curveIdx, totalCurveLen
                            if (totalCurveLen + currentLen <= del * i) {
                                // add assigned filtering value to the query
                                // judge which of before or current point variables are closer to the segment point
                                let controlPoint = this.controlPoints[curveIdx + 1].position,
                                    assignedVariables = this.controlPoints[curveIdx + 1].assignedVariables;
                                let distBefore = Math.sqrt(Math.pow(controlPoint.x - pointBefore.x, 2) + Math.pow(controlPoint.y - pointBefore.y, 2)),
                                    distCurrent = Math.sqrt(Math.pow(controlPoint.x - point.x, 2) + Math.pow(controlPoint.y - point.y, 2));
                                if (distBefore <= distCurrent) {
                                    // assign variables to before point
                                    for (let key in query) {
                                        if (assignedVariables[key].length > 0) {
                                            query[key][query[key].length - 2] = assignedVariables[key];
                                        }
                                    }
                                } else {
                                    // assign variables to the current point
                                    for (let key in query) {
                                        if (assignedVariables[key].length > 0) {
                                            query[key][query[key].length - 1] = assignedVariables[key];
                                        }
                                    }
                                }
                                totalCurveLen += currentLen;
                                curveIdx += 1;
                                if (curveIdx < this.path.curves.length) {
                                    currentLen = this.path.curves[curveIdx].length;
                                }
                            }
                            pointBefore = point;
                        }
                    }
                    // if some constraints are assigned to the last point, add them to a query
                    let lastPoint = this.controlPoints[this.controlPoints.length - 1].assignedVariables;
                    for (let key in lastPoint) {
                        if (lastPoint[key].length > 0) {
                            query[key][query[key].length - 1] = lastPoint[key];
                        }
                    }
                } else {
                    // alert says 'input time length of the input query'
                }
            } else if (xItem === 'z') {
                // get time range and set the value to $periodOfSketchQuery
                let minX = this.controlPoints[0].position.x,
                    maxX = this.controlPoints[this.controlPoints.length - 1].position.x;
                let sketchRange = this.xScale.invert(maxX - minX);
                $('#periodOfSketchQuery').val(formatValue(sketchRange));
                $('#targetLengthMin').val(Math.floor(sketchRange));
                $('#targetLengthMax').val(Math.ceil(sketchRange));
                let currentLen = this.path.curves[0].length,
                    curveIdx = 0,
                    totalCurveLen = 0,
                    pointBefore;
                // for converting the width into value
                let radRange = [], valueRange = [];
                if (this.widthVar) {
                    let minRad = Math.min.apply(null, this.radiuses),
                        maxRad = Math.max.apply(null, this.radiuses);
                    let minVal = Math.min.apply(null, this.state.minList[this.widthVar]),
                        maxVal = Math.max.apply(null, this.state.maxList[this.widthVar]);
                    let sliderRange = $('#sketchWidthSlider').slider('option', 'values');
                    let minRange = sliderRange[0] / 100 * (maxVal - minVal) + minVal,
                        maxRange = sliderRange[1] / 100 * (maxVal - minVal) + minVal;
                    radRange = [minRad, maxRad];
                    valueRange = [minRange, maxRange];
                }
                // create a vertical line to run hit test
                let del = this.xScale(1); // 1 day === del px
                let hitTestPath = new paper.Path.Line(new paper.Point(minX, 0), new paper.Point(minX, this.state.size));
                let currentX = minX;
                // initialization
                pointBefore = this.controlPoints[0].position;
                // for (let key in query) {
                //     if (this.controlPoints[0].assignedVariables[key].length > 0) {
                //         query[key].push(this.controlPoints[0].assignedVariables[key]);
                //     }
                // }

                while (currentX <= maxX) {
                    // get the position on the path
                    let hitResult = this.path.getIntersections(hitTestPath);
                    if (hitResult.length > 0) {
                        let offset = this.path.getOffsetOf(hitResult[0].point);
                        for (let key in query) {
                            if (key === this.state.yItem) {
                                query[key].push(this.yScale.invert(hitResult[0].point.y));
                            } else if (key === this.widthVar) {
                                let width =  (this.radiuses[curveIdx + 1] - this.radiuses[curveIdx])
                                        * (offset - totalCurveLen) / currentLen + this.radiuses[curveIdx];
                                // convert width into value
                                query[key].push((valueRange[1] - valueRange[0]) / (radRange[1] - radRange[0]) * (width - radRange[0]) + valueRange[0]);
                            } else if (key !== 'z') {
                                query[key].push(null);
                            }
                        }

                        // update curveLen, curveIdx, totalCurveLen
                        if (totalCurveLen + currentLen <= offset) {
                            let controlPoint = this.controlPoints[curveIdx + 1].position,
                                assignedVariables = this.controlPoints[curveIdx + 1].assignedVariables;
                            let distBefore = Math.sqrt(Math.pow(controlPoint.x - pointBefore.x, 2) + Math.pow(controlPoint.y - pointBefore.y, 2)),
                                distCurrent = Math.sqrt(Math.pow(controlPoint.x - hitResult[0].point.x, 2) + Math.pow(controlPoint.y - hitResult[0].point.y, 2));
                            if (distBefore <= distCurrent) {
                                // assign variables to before point
                                for (let key in query) {
                                    if (assignedVariables[key].length > 0) {
                                        query[key][query[key].length - 2] = assignedVariables[key];
                                    }
                                }
                            } else {
                                // assign variables to the current point
                                for (let key in query) {
                                    if (assignedVariables[key].length > 0) {
                                        query[key][query[key].length - 1] = assignedVariables[key];
                                    }
                                }
                            }
                            totalCurveLen += currentLen;
                            curveIdx += 1;
                            if (curveIdx < this.path.curves.length) {
                                currentLen = this.path.curves[curveIdx].length;
                            }
                        }
                    }
                    currentX += del;
                    hitTestPath.segments[0].point.x = currentX;
                    hitTestPath.segments[1].point.x = currentX;
                }
                hitTestPath.remove();
                // check whether the first/last point has assigned variables or not
                let firstPoint = this.controlPoints[0].assignedVariables;
                for (let key in query) {
                    if (firstPoint[key].length > 0) {
                        query[key][0] = firstPoint[key];
                    }
                }
                let lastPoint = this.controlPoints[this.controlPoints.length - 1].assignedVariables;
                for (let key in lastPoint) {
                    if (lastPoint[key].length > 0) {
                        query[key][query[key].length - 1] = lastPoint[key];
                    }
                }
            } else if (yItem === 'z') {
                // get time range and set the value to $periodOfSketchQuery
                let minY = this.controlPoints[0].position.y,
                    maxY = this.controlPoints[this.controlPoints.length - 1].position.y;
                let sketchRange = this.yScale.invert(maxY - minY);
                $('#periodOfSketchQuery').val(formatValue(sketchRange));
                let currentLen = this.path.curves[0].length,
                    curveIdx = 0,
                    totalCurveLen = 0,
                    pointBefore;
                // for converting the width into value
                let radRange = [], valueRange = [];
                if (this.widthVar) {
                    let minRad = Math.min.apply(null, this.radiuses),
                        maxRad = Math.max.apply(null, this.radiuses);
                    let minVal = Math.min.apply(null, this.state.minList[this.widthVar]),
                        maxVal = Math.max.apply(null, this.state.maxList[this.widthVar]);
                    let sliderRange = $('#sketchWidthSlider').slider('option', 'values');
                    let minRange = sliderRange[0] / 100 * (maxVal - minVal) + minVal,
                        maxRange = sliderRange[1] / 100 * (maxVal - minVal) + minVal;
                    radRange = [minRad, maxRad];
                    valueRange = [minRange, maxRange];
                }
                // create a vertical line to run hit test
                let del = this.state.size - this.yScale(1); // 1 day === del px
                let hitTestPath = new paper.Path.Line(new paper.Point(0, minY), new paper.Point(this.state.size, minY));
                let currentY = minY;
                // initialization
                pointBefore = this.controlPoints[0].position;
                while (currentY >= maxY) {
                    // get the position on the path
                    let hitResult = this.path.getIntersections(hitTestPath);
                    let offset = this.path.getOffsetOf(hitResult[0].point);
                    for (let key in query) {
                        if (key === xItem) {
                            query[key].push(this.xScale.invert(hitResult[0].point.x));
                        } else if (key === this.widthVar) {
                            let width =  (this.radiuses[curveIdx + 1] - this.radiuses[curveIdx])
                                    * (offset - totalCurveLen) / currentLen + this.radiuses[curveIdx];
                            // convert width into value
                            query[key].push((valueRange[1] - valueRange[0]) / (radRange[1] - radRange[0]) * (width - radRange[0]) + valueRange[0]);
                        } else if (key !== 'z') {
                            query[key].push(null);
                        }
                    }

                    // update curveLen, curveIdx, totalCurveLen
                    if (totalCurveLen + currentLen <= offset) {
                        let controlPoint = this.controlPoints[curveIdx + 1].position,
                            assignedVariables = this.controlPoints[curveIdx + 1].assignedVariables;
                        let distBefore = Math.sqrt(Math.pow(controlPoint.x - pointBefore.x, 2) + Math.pow(controlPoint.y - pointBefore.y, 2)),
                            distCurrent = Math.sqrt(Math.pow(controlPoint.x - hitResult[0].point.x, 2) + Math.pow(controlPoint.y - hitResult[0].point.y, 2));
                        if (distBefore <= distCurrent) {
                            // assign variables to before point
                            for (let key in query) {
                                if (assignedVariables[key].length > 0) {
                                    query[key][query[key].length - 2] = assignedVariables[key];
                                }
                            }
                        } else {
                            // assign variables to the current point
                            for (let key in query) {
                                if (assignedVariables[key].length > 0) {
                                    query[key][query[key].length - 1] = assignedVariables[key];
                                }
                            }
                        }
                        totalCurveLen += currentLen;
                        curveIdx += 1;
                        if (curveIdx < this.path.curves.length) {
                            currentLen = this.path.curves[curveIdx].length;
                        }
                    }
                    currentY -= del;
                    hitTestPath.segments[0].point.y = currentY;
                    hitTestPath.segments[1].point.y = currentY;
                }
                hitTestPath.remove();
                // check whether the first/last point has assigned variables or not
                let firstPoint = this.controlPoints[0].assignedVariables;
                for (let key in query) {
                    if (firstPoint[key].length > 0) {
                        query[key][0] = firstPoint[key];
                    }
                }
                let lastPoint = this.controlPoints[this.controlPoints.length - 1].assignedVariables;
                for (let key in lastPoint) {
                    if (lastPoint[key].length > 0) {
                        query[key][query[key].length - 1] = lastPoint[key];
                    }
                }
            }
            query['arrayLength'] = query[Object.keys(query)[0]].length;
            FeatureAction.setQuery(query);
        }
    }

    transformDataIntoSketch(id, period) {
        let targetData = DataStore.getDataArray(id, 1);
        let minIdx = targetData.z.indexOf(period[0]),
            maxIdx = targetData.z.indexOf(period[1]);

        if (this.state.xItem !== 'z' && this.state.yItem !== 'z') {
            let xData = targetData[this.state.xItem].slice(minIdx, maxIdx + 1),
                yData = targetData[this.state.yItem].slice(minIdx, maxIdx + 1);
            
            this.path = new paper.Path();
            this.path.strokeColor = 'black';
            this.path.strokeWidth = 5;

            for (let i = 0; i < xData.length; i++) {
                this.path.add(new paper.Point(this.xScale(xData[i]), this.yScale(yData[i])));
            }
        } else if (this.state.xItem === 'z') {
            let yData = targetData[this.state.yItem].slice(minIdx, maxIdx + 1);

            // put the sketch at the center in the horizontal direction
            let delta = Math.floor(this.xScale.domain()[1] / 2) - Math.floor(yData.length / 2);
            this.path = new paper.Path();
            this.path.strokeColor = 'black';
            this.path.strokeWidth = 5;

            for (let i = 0; i < yData.length; i++) {
                this.path.add(new paper.Point(this.xScale(i + delta), this.yScale(yData[i])));
            }
        } else if (this.state.yItem === 'z') {
            let xData = targetData[this.state.xItem].slice(minIdx, maxIdx + 1);

            // put the sketch at the center in the horizontal direction
            let delta = Math.floor(this.yScale.domain()[1] / 2) - Math.floor(xData.length / 2);
            this.path = new paper.Path();
            this.path.strokeColor = 'black';
            this.path.strokeWidth = 5;

            for (let i = 0; i < xData.length; i++) {
                this.path.add(new paper.Point(this.xScale(xData[i]), this.yScale(i + delta)));
            }
        }

        let segments = this.path.segments.slice(0, this.path.segments.length);
        this.path.simplify(10);
        // create this.controlPoints
        this.path.segments.forEach(function(e) {
            this.controlPoints.push({
                position: {x: e.point.x, y: e.point.y},
                assignedVariables: {},
                label: null,
                labelRect: null
            });

            for (let key in this.state.lookup) {
                this.controlPoints[this.controlPoints.length - 1].assignedVariables[key] = [];
            }
        }.bind(this));

        if (this.widthVar) {
            let widthData = targetData[this.widthVar].slice(minIdx, maxIdx + 1);
            let minWidth = 2.5, maxWidth = 25;
            let minVal = Math.min.apply(null, widthData), maxVal = Math.max.apply(null, widthData);
            for (let i = 0; i < widthData.length; i++) {
                this.radiuses.push((widthData[i] - minVal) / (maxVal - minVal) * (maxWidth - minWidth) + minWidth);
            }

            // simplificationDeg should be odd (- - * + +: * is the value of the point)
            let simplificationDeg = segments.length / this.path.segments.length;
            simplificationDeg = (Math.floor(simplificationDeg) % 2 === 1) ? Math.floor(simplificationDeg) : Math.ceil(simplificationDeg);

            // get the radius value of each point on the simplified path
            let idxOriginal = 0, idxSimple = 0;
            let radiusesSimple = [];
            while (idxOriginal < segments.length && idxSimple < this.path.segments.length) {
                if (segments[idxOriginal].point.x === this.path.segments[idxSimple].point.x
                    && segments[idxOriginal].point.y === this.path.segments[idxSimple].point.y) {
                    let radTmp = 0, count = 0;
                    let startIdx = idxOriginal - Math.floor(simplificationDeg / 2);
                    let endIdx = idxOriginal + Math.floor(simplificationDeg / 2);
                    startIdx = Math.max(0, startIdx);
                    endIdx = Math.min(segments.length - 1, endIdx);
                    for (let i = startIdx; i <= endIdx; i++) {
                        radTmp += this.radiuses[i];
                        count++;
                    }
                    radTmp /= count;
                    radiusesSimple.push(radTmp);
                    idxOriginal++;
                    idxSimple++;
                    continue;
                }
                idxOriginal++;
            }
            this.radiuses = radiusesSimple;
            this.drawPathWidth();
        }
    }

    CanvasXLabelOnClick() {
        return function () {
            let value = this.state.xItemonPanel;
            let minVal = Math.min.apply(null, this.state.minList[value]),
                maxVal = Math.max.apply(null, this.state.maxList[value]);
            if (value === 'z') {
                maxVal = Math.min(maxVal - minVal, 50);
                minVal = 0;
            }

            this.setValueSlider('sketchPadXRangeSlider', minVal, maxVal);
            $('#sketchPadXRangeSlider').slider('option', 'disabled', false);
            let panel = d3.select('#changeXAxisPanel_SketchPad');
            if (panel.style('visibility') === 'visible') {
                panel
                    .transition()
                    .duration(50)
                    .style('visibility', 'hidden');
                this.setState({
                    xItemonPanel: this.state.xItem
                });
            } else {
                let divHeight = document.getElementById('changeXAxisPanel_SketchPad').clientHeight;
                let divWidth = document.getElementById('changeXAxisPanel_SketchPad').clientWidth;
                panel
                    .style('transform', 'translate(' + (this.state.size / 2 - divWidth / 2) + 'px,' + (this.state.size - divHeight - this.margin.bottom) + 'px)')
                    .style('visibility', 'visible');
                if (this.state.xItem === value) {
                    // set slider values
                    let sliderMin = (this.xMinMax[0] - minVal) / (maxVal - minVal) * 100,
                        sliderMax = (this.xMinMax[1] - minVal) / (maxVal - minVal) * 100;
                    $('#sketchPadXRangeSlider').slider('option', 'values', [sliderMin, sliderMax]);
                }
            }
        }
    }

    CanvasYLabelOnClick() {
        return function () {
            let value = this.state.yItemonPanel;
            let minVal = Math.min.apply(null, this.state.minList[value]),
                maxVal = Math.max.apply(null, this.state.maxList[value]);
            if (value === 'z') {
                maxVal = Math.min(maxVal - minVal, 50);
                minVal = 0;
            }

            this.setValueSlider('sketchPadYRangeSlider', minVal, maxVal);
            $('#sketchPadYRangeSlider').slider('option', 'disabled', false);
            let panel = d3.select('#changeYAxisPanel_SketchPad');
            if (panel.style('visibility') === 'visible') {
                panel
                    .transition()
                    .duration(50)
                    .style('visibility', 'hidden');
                this.setState({
                    xItemonPanel: this.state.xItem
                });
            } else {
                let divHeight = document.getElementById('changeYAxisPanel_SketchPad').clientHeight;
                let divWidth = document.getElementById('changeYAxisPanel_SketchPad').clientWidth;
                panel
                    .style('transform', 'translate(' + (this.margin.left + 10) + 'px,' + (this.state.size / 2 - divHeight / 2) + 'px)')
                    .style('visibility', 'visible');
            }
            if (this.state.yItem === value) {
                // set slider values
                let sliderMin = (this.yMinMax[0] - minVal) / (maxVal - minVal) * 100,
                    sliderMax = (this.yMinMax[1] - minVal) / (maxVal - minVal) * 100;
                $('#sketchPadYRangeSlider').slider('option', 'values', [sliderMin, sliderMax]);
            }
        }
    }

    onSelectXItem(e) {
        let value = e.target.value;
        this.setState({xItemonPanel: value});
        let minVal = Math.min.apply(null, this.state.minList[value]),
            maxVal = Math.max.apply(null, this.state.maxList[value]);
        if (value === 'z') {
            maxVal = Math.min(maxVal - minVal, 50);
            minVal = 0;
        }
        this.setValueSlider('sketchPadXRangeSlider', minVal, maxVal);
        $('#sketchPadXRangeSlider').slider('option', 'disabled', false);
    }

    onSelectYItem(e) {
        let value = e.target.value;
        this.setState({yItemonPanel: value});
        let minVal = Math.min.apply(null, this.state.minList[value]),
            maxVal = Math.max.apply(null, this.state.maxList[value]);
        if (value === 'z') {
            maxVal = Math.min(maxVal - minVal, 50);
            minVal = 0;
        }
        this.setValueSlider('sketchPadYRangeSlider', minVal, maxVal);
        $('#sketchPadYRangeSlider').slider('option', 'disabled', false);
    }

    updateXAxisValue(min, max) {
        this.xMinMax = [min, max];
        this.updateAxis();
    }

    updateYAxisValue(min, max) {
        this.yMinMax = [min, max];
        this.updateAxis();
    }

    updateAxis() {
        let paddingLeft = Number($('#featureArea').css('padding-left').replace('px', '')),
            paddingRight = Number($('#featureArea').css('padding-right').replace('px', ''));
        let outerSize = Math.floor($('#mainFeatureArea').width() * 0.3 - paddingLeft - paddingRight);
        this.setState({
            size: outerSize
        });
        d3.select('#QBSCanvasArea')
            .style('padding-bottom', outerSize + 'px');
        this.svg
            .attr('width', outerSize)
            .attr('height', outerSize);
        this.canvas
            .attr('width', outerSize + 'px !important')
            .attr('height', outerSize + 'px !important');
        paper.setup(this.canvas.node());
        this.xScale
            .domain(this.xMinMax)
            .range([0, outerSize])
            .nice();
        this.xLabel = d3.axisTop(this.xScale)
            .ticks(5)
            .tickSize(-outerSize)
            .tickFormat(tickFormatting);
        this.xAxis
            .call(this.xLabel);
        this.xAxis.select('.domain').remove();
        this.xAxis.selectAll('.tick text')
            .attr('y', outerSize - this.margin.bottom)
            .style('color', '#8c7b7b');
        this.xAxisText
            .style('left', outerSize / 2 + 'px')
            .style('top', outerSize - 18 + 'px');

        this.yScale
            .domain(this.yMinMax)
            .range([outerSize, 0])
            .nice();
        this.yLabel = d3.axisRight(this.yScale)
            .ticks(5)
            .tickSize(outerSize)
            .tickFormat(tickFormatting);
        this.yAxis
            .call(this.yLabel);
        this.yAxis.select('.domain').remove();
        this.yAxis.selectAll('.tick text')
            .attr('x', this.margin.left)
            .attr('y', '-0.5em')
            .style('color', '#79897b');
        this.yAxisText
            .style('left', this.margin.left / 2 + 'px')
            .style('top', outerSize / 2 + 'px');
    }

    changeXAxis() {
        this.setState({
            xItem: this.state.xItemonPanel
        });
        if (this.xAxisText) {
            this.xAxisText
                .text(this.state.lookup[this.state.xItemonPanel]);
        }
        let min = Math.min.apply(null, this.state.minList[this.state.xItemonPanel]),
            max = Math.max.apply(null, this.state.maxList[this.state.xItemonPanel]);
        if (this.state.xItemonPanel === 'z') {
            max = Math.min(max - min, 50);
            min = 0;
        }
        let sliderRange = $('#sketchPadXRangeSlider').slider('option', 'values');
        let minVal = sliderRange[0] / 100 * (max - min) + min,
            maxVal = sliderRange[1] / 100 * (max - min) + min;
        this.updateXAxisValue(minVal, maxVal);
        d3.select('#changeXAxisPanel_SketchPad')
            .transition()
            .duration(50)
            .style('visibility', 'hidden');
        // if neither x or y axis is z, set default value of the length of the sketch query
        if (this.state.xItemonPanel !== 'z' && this.state.yItem !== 'z') {
            $('#periodOfSketchQuery').val(20);
        }
        this.convertSketchIntoQuery(this.state.xItemonPanel, this.state.yItem);
    }

    changeYAxis() {
        this.setState({
            yItem: this.state.yItemonPanel
        });
        if (this.yAxisText) {
            this.yAxisText
                .text(this.state.lookup[this.state.yItemonPanel]);
        }
        let min = Math.min.apply(null, this.state.minList[this.state.yItemonPanel]),
            max = Math.max.apply(null, this.state.maxList[this.state.yItemonPanel]);
        if (this.state.yItemonPanel === 'z') {
            max = Math.min(max - min, 50);
            min = 0;
        }
        let sliderRange = $('#sketchPadYRangeSlider').slider('option', 'values');
        let minVal = sliderRange[0] / 100 * (max - min) + min,
            maxVal = sliderRange[1] / 100 * (max - min) + min;
        this.updateYAxisValue(minVal, maxVal);
        d3.select('#changeYAxisPanel_SketchPad')
            .transition()
            .duration(50)
            .style('visibility', 'hidden');
        // if neither x or y axis is z, set default value of the length of the sketch query
        if (this.state.xItem !== 'z' && this.state.yItemonPanel !== 'z') {
            $('#periodOfSketchQuery').val(20);
        }
        this.convertSketchIntoQuery();
    }

    selectPen() {
        this.setState({
            selector: 'pen'
        });
        $('img[name=QBSSelector]').each(function() {
            $(this).removeClass('selected');
        });
        if (!this.state.assignVariables) {
            $('#selectorPen').addClass('selected');
        }
        this.updateSelectedStatus('pen');
    }

    selectEraser() {
        this.setState({
            selector: 'eraser'
        });
        $('img[name=QBSSelector]').each(function() {
            $(this).removeClass('selected');
        });
        if (!this.state.assignVariables) {
            $('#selectorEraser').addClass('selected');
        }
        this.updateSelectedStatus('eraser');
    }

    selectAddPoint() {
        this.setState({
            selector: 'addPoint'
        });
        $('img[name=QBSSelector]').each(function() {
            $(this).removeClass('selected');
        });
        if (!this.state.assignVariables) {
            $('#selectorAddPoint').addClass('selected');
        }
        this.updateSelectedStatus('addPoint');
    }

    selectControlPoint() {
        this.setState({
            selector: 'controlPoint'
        });
        $('img[name=QBSSelector]').each(function() {
            $(this).removeClass('selected');
        });
        if (!this.state.assignVariables) {
            $('#selectorControlPoint').addClass('selected');
        }
        this.updateSelectedStatus('controlPoint');
    }

    selectChangeWidth() {
        this.setState({
            selector: 'changeWidth'
        });
        $('img[name=QBSSelector]').each(function() {
            $(this).removeClass('selected');
        });
        if (!this.state.assignVariables) {
            $('#selectorChangeWidth').addClass('selected');
        }
        this.updateSelectedStatus('changeWidth');
    }

    switchVariableAssignment() {
        // this.assignVariables = !this.assignVariables;
        let state = !this.state.assignVariables;
        this.setState({
            assignVariables: state
        });
        if (state) {
            $('img[name=QBSSelector]').each(function() {
                $(this).removeClass('selected');
                $(this).addClass('disabled');
            });
        } else {
            let currentSelector = this.state.selector;
            $('img[name=QBSSelector]').each(function() {
                $(this).removeClass('disabled');
                if ($(this).attr('value') === currentSelector) {
                    $(this).addClass('selected');
                }
            });
        }
        $('#variableAssignmentSwitch').prop('checked', state);
        if (state && this.path) {
            this.path.fullySelected = true;
        } else if (!state) {
            this.setState({
                popover: false
            });
            if (this.highlightedPoint) {
                this.highlightedPoint.remove();
            }
            this.updateSelectedStatus(this.state.selector);
        }
    }

    updateSelectedStatus(selectedSelector) {
        // when any one of selectors is selected, hide popup for value assignment and switch off the value assignement mode
        if (selectedSelector === 'addPoint' || selectedSelector === 'eraser') {
            if (this.path) this.path.fullySelected = true;
        } else if (selectedSelector === 'controlPoint') {
            if (this.path) this.path.fullySelected = true;
        } else if (selectedSelector === 'changeWidth') {
            if (this.path) this.path.fullySelected = true;
        } else if (selectedSelector === 'pen') {
            if (this.path) this.path.fullySelected = false;
        }
    }

    removeAllAsignment() {
        for (let i = 0; i < this.controlPoints.length; i++) {
            for (let key in this.controlPoints[i].assignedVariables) {
                this.controlPoints[i].assignedVariables[key] = [];
            }
            if (this.controlPoints[i].label) {
                this.controlPoints[i].label.remove();
                this.controlPoints[i].label = null;
                this.controlPoints[i].labelRect.remove();
                this.controlPoints[i].labelRect = null;
            }
        }
    }

    axisSelectionPanel() {
        let xItems = [], yItems = [];
        for (let key in this.state.lookup) {
            let label = '';
            if (this.state.lookup[key].length > 1) {
                label = this.state.lookup[key].join(',');
            } else {
                label = this.state.lookup[key];
            }
            if (label.indexOf('JD') < 0) {
                xItems.push(
                    <div
                        className='form-check'
                        key={label}
                        style={{paddingLeft: '0px'}}>
                        <input
                            type='radio'
                            name='selectXAxis_SketchPad'
                            value={key}
                            checked={this.state.xItemonPanel === key}
                            onChange={this.onSelectXItem.bind(this)}/>
                        <label
                            className="form-check-label"
                            key={label}>
                            {label}
                        </label>
                    </div>
                );
                yItems.push(
                    <div
                        className='form-check'
                        key={label}
                        style={{paddingLeft: '0px'}}>
                        <input
                            type='radio'
                            name='selectYAxis_SketchPad'
                            value={key}
                            checked={this.state.yItemonPanel === key}
                            onChange={this.onSelectYItem.bind(this)}/>
                        <label
                            className="form-check-label"
                            key={label}>
                            {label}
                        </label>
                    </div>
                );
            } else {
                xItems.unshift(
                    <div
                        className='form-check'
                        key={label}
                        style={{paddingLeft: '0px'}}>
                        <input
                            type='radio'
                            name='selectXAxis_SketchPad'
                            value={key}
                            checked={this.state.xItemonPanel === key}
                            onChange={this.onSelectXItem.bind(this)}/>
                        <label
                            className="form-check-label"
                            key={label}>
                            {label}
                        </label>
                    </div>
                );
                yItems.unshift(
                    <div
                        className='form-check'
                        key={label}
                        style={{paddingLeft: '0px'}}>
                        <input
                            type='radio'
                            name='selectYAxis_SketchPad'
                            value={key}
                            checked={this.state.yItemonPanel === key}
                            onChange={this.onSelectYItem.bind(this)}/>
                        <label
                            className="form-check-label"
                            key={label}>
                            {label}
                        </label>
                    </div>
                );
            }
        }
        let xPanel = (
            <div
                className='overlayPanel'
                id='changeXAxisPanel_SketchPad'
                style={{visibility: 'hidden', textAlign: 'center', zIndex: '101'}}>
                <h6>Change x axis</h6>
                <div
                    id='changeXAxisItem_SketchPad'
                    style={{textAlign: 'left'}}>
                    <form id='changeXAxisForm_SketchPad'>
                        {xItems}
                    </form>
                    <div className='featureElem' id='sketchPadXRangeSlider' style={{width: '150px'}}>
                        <output id={'sketchPadXRangeSliderMax'} style={{bottom: '1.3rem', zIndex: 200}}></output>
                        <output id={'sketchPadXRangeSliderMin'} style={{bottom: '1.3rem', zIndex: 201}}></output>
                    </div>
                    <button className="btn btn-primary btn-sm"
                            id={'changeXAxisBtn_SketchPad'}
                            style={{float: 'right'}}
                            onClick={this.changeXAxis.bind(this)}>Done</button>
                </div>
            </div>
        );
        let yPanel = (
            <div
                className='overlayPanel'
                id='changeYAxisPanel_SketchPad'
                style={{visibility: 'hidden', textAlign: 'center', zIndex: '102'}}>
                <h6>Change y axis</h6>
                <div
                    id='changeYAxisItem_SketchPad'
                    style={{textAlign: 'left'}}>
                    <form id='changeYAxisForm_SketchPad'>
                        {yItems}
                    </form>
                </div>
                <div className='featureElem' id='sketchPadYRangeSlider' style={{width: '150px'}}>
                    <output id={'sketchPadYRangeSliderMax'} style={{bottom: '1.3rem', zIndex: 200}}></output>
                    <output id={'sketchPadYRangeSliderMin'} style={{bottom: '1.3rem', zIndex: 201}}></output>
                </div>
                <button className="btn btn-primary btn-sm"
                        id={'changeXAxisBtn_SketchPad'}
                        style={{float: 'right'}}
                        onClick={this.changeYAxis.bind(this)}>Done</button>
            </div>
        );
        return {x: xPanel, y: yPanel};
    }

    sketchMenu() {
        return (
            <div id='QBSSelectorMenu' className='featureElem'>
                <h5>Selection</h5>
                <form 
                    className='selector featureRow'>
                    <div className="form-check form-check-inline">
                        <img 
                            id='selectorPen'
                            className='selectorIcon selected'
                            name="QBSSelector"
                            value="pen"
                            src='img/icons/pen.png'
                            alt='pen'
                            width='30'
                            height='30'
                            title='draw a sketch'
                            onClick={this.selectPen.bind(this)} readOnly/>
                        <img 
                            id='selectorAddPoint'
                            className='selectorIcon'
                            name="QBSSelector"
                            value="addPoint"
                            src='img/icons/add.png'
                            alt='add point'
                            width='30'
                            height='30'
                            title='add a control point on the sketch'
                            onClick={this.selectAddPoint.bind(this)} readOnly/>
                        <img 
                            id='selectorEraser'
                            className='selectorIcon'
                            name="QBSSelector"
                            value="eraser"
                            src='img/icons/delete.png'
                            alt='delete point'
                            width='30'
                            height='30'
                            title='remove a control point from the sketch'
                            onClick={this.selectEraser.bind(this)} readOnly/>
                        <img 
                            id='selectorControlPoint'
                            className='selectorIcon'
                            name="QBSSelector"
                            value="controlPoint"
                            src='img/icons/control.png'
                            alt='control point'
                            width='30'
                            height='30'
                            title='move a control point on the sketch'
                            onClick={this.selectControlPoint.bind(this)} readOnly/>
                        <img 
                            id='selectorChangeWidth'
                            className='selectorIcon'
                            name="QBSSelector"
                            value="changeWidth"
                            src='img/icons/width.png'
                            alt='change width'
                            width='30'
                            height='30'
                            title='change the width of the sketch'
                            onClick={this.selectChangeWidth.bind(this)} readOnly/>
                    </div>
                    <div id='selectorExploration' className='tooltip' style={{visibility: 'hidden'}}>
                    </div>
                </form>
            </div>
        );
    }

    sketchOptions() {
        return (
            <div id='QBSSketchOptions' className='featureElem'>
                <h5 onClick={this.collapseQBSSketchOptions}>Options of Query-by-sketch</h5>
                <div id='QBSSketchOptionsMain'>
                    {this.sketchWidthControl()}
                    {this.assignVariablesArea()}
                    {this.definePeriodOfQuery()}
                </div>
            </div>
        );
    }

    importExportQueryMenu() {
        return (
            <div id='importExportQuery' className='featureElem form-inline' style={{float: 'right'}}>
                {/* <input type='button' className='btn btn-primary btn-sm' value='Import' onClick={this.importQueryClick.bind(this)}/> */}
                <div className="custom-file" style={{width: '170px', marginRight: '0.5rem'}}>
                    <input type='file' id='importQuery' className='custom-file-input' onChange={this.importQuery.bind(this)}/>
                    <label className='custom-file-label' htmlFor='importQuery' style={{justifyContent: 'start'}}>Import</label>
                </div>
                <button className='btn btn-primary btn-sm' onClick={this.exportQuery.bind(this)}>Export</button>
            </div>
        )
    }

    importQuery() {
        let file = document.getElementById('importQuery').files;
        let reader = new FileReader();
        reader.readAsText(file[0]);
        reader.onload = function() {
            let contents = reader.result;
            let query = JSON.parse(contents);
            if (query.type === 'Query-by-sketch') {
                this.clearCanvas();
                this.setState({
                    xItem: query.xItem,
                    yItem: query.yItem
                });
                if (this.xAxisText) {
                    this.xAxisText
                        .text(this.state.lookup[query.xItem]);
                }
                if (this.yAxisText) {
                    this.yAxisText
                        .text(this.state.lookup[query.yItem]);
                }
                this.xMinMax = query.xRange;
                this.yMinMax = query.yRange;
                this.updateAxis();
                $('#periodOfSketchQuery').val(query.queryLength);

                // for the case, the size of sketch pad is different
                let ratio = this.state.size / query.size;
                for (let i = 0; i < query.controlPoints.length; i++) {
                    this.controlPoints.push(query.controlPoints[i]);
                    this.controlPoints[this.controlPoints.length - 1].position.x = this.controlPoints[this.controlPoints.length - 1].position.x * ratio;
                    this.controlPoints[this.controlPoints.length - 1].position.y = this.controlPoints[this.controlPoints.length - 1].position.y * ratio;
                }

                this.path = new paper.Path();
                this.path.strokeColor = 'black';
                this.path.strokeWidth = 5;
                for (let i = 0; i < query.path.length; i++) {
                    // query.path[i][0]: "segment"
                    // query.path[i][1]: position of the point [x, y]
                    // query.path[i][2]: position of the handlein [x, y]
                    // query.path[i][3]: position of the handleout [x, y]
                    this.path.add(new paper.Point(query.path[i][1][0] * ratio, query.path[i][1][1] * ratio));
                    this.path.segments[this.path.segments.length - 1].handleIn.x = query.path[i][2][0] * ratio;
                    this.path.segments[this.path.segments.length - 1].handleIn.y = query.path[i][2][1] * ratio;
                    this.path.segments[this.path.segments.length - 1].handleOut.x = query.path[i][3][0] * ratio;
                    this.path.segments[this.path.segments.length - 1].handleOut.y = query.path[i][3][1] * ratio;
                }
                if (query.widthVar) {
                    this.widthVar = query.widthVar;
                    this.changeWidthVariable(this.widthVar);
                    this.radiuses = query.radiuses;
                    this.drawPathWidth();
                }
                for (let i = 0; i < this.controlPoints.length; i++) {
                    let label = '';
                    for (let key in this.controlPoints[i].assignedVariables) {
                        if (this.controlPoints[i].assignedVariables[key].length > 0) {
                            label += this.state.lookup[key] + ', ';
                        }
                    }
                    if (label !== '') {
                        this.controlPoints[i].label = new paper.PointText({
                            position: {x: this.controlPoints[i].position.x, y: this.controlPoints[i].position.y},
                            fillColor: '#7b7971',
                            justification: 'center',
                            fontSize: 8
                        });
                        label = label.slice(0, -2);
                        this.controlPoints[i].label.content = label;

                        this.controlPoints[i].labelRect = new paper.Path.Rectangle(
                            this.controlPoints[i].label.bounds
                        );
                        this.controlPoints[i].labelRect.fillColor = 'white';
                        this.controlPoints[i].labelRect.strokeColor = 'white';
                        this.controlPoints[i].label.insertAbove(this.controlPoints[i].labelRect);
                    }
                }
                this.convertSketchIntoQuery(query.xItem, query.yItem);
            } else {
                alert('This file is not for a query-by-sketch.');
            }
        }.bind(this);
    }

    exportQuery() {
        if (this.path) {
            let query = {
                type: 'Query-by-sketch',
                xItem: this.state.xItem,
                yItem: this.state.yItem,
                xRange: this.xScale.domain(),
                yRange: this.yScale.domain(),
                controlPoints: this.controlPoints,
                widthVar: this.widthVar,
                radiuses: this.radiuses,
                path: this.path.segments,
                queryLength: Number($('#periodOfSketchQuery').val()),
                size: this.state.size
            };
            query = JSON.stringify(query, null , '\t');
            let filename = 'sketchQuery_' + createDateLabel() + '.json';
            let blob = new Blob([query], {type: 'application/json'});
            let url = window.URL || window.webkitURL;
            let blobURL = url.createObjectURL(blob);
            let a = document.createElement('a');
            a.download = decodeURI(filename);
            a.href = blobURL;
        
            a.click();
        }
    }

    collapseQBSSketchOptions() {
        $('#QBSSketchOptionsMain').slideToggle();
    }

    sketchWidthControl() {
        let items = [];
        // exclude variables assigned to x or y axis, z (time) should not be assigned to width
        for (let key in this.state.lookup) {
            if (key !== this.state.xItem && key !== this.state.yItem) {
                let label = '';
                if (this.state.lookup[key].length > 1) {
                    label = this.state.lookup[key].join(',');
                } else {
                    label = this.state.lookup[key];
                }
                if (key !== 'z') {
                    items.push(
                        <option key={key} value={key}>{label}</option>
                    );
                }
            }
        }

        return (
            <div
                id='sketchWidthControl'
                className='container'
                style={{paddingRight: '0px', paddingLeft: '0px', marginBottom: '0.2rem'}}>
                <h6>Variable assigned to the sketch width</h6>
                <div className="row matchingOption"
                     style={{paddingLeft: '15px', paddingRight: '15px'}}>
                    <div className="custom-control custom-switch">
                        <input
                            type="checkbox"
                            className="custom-control-input"
                            id="widthDetectionSwitch"
                            checked={this.state.detectWidth}
                            onChange={this.updateWidthDetection.bind(this)}/>
                            <label className="custom-control-label" htmlFor="widthDetectionSwitch">Detect width</label>
                    </div>
                </div>
                <div className="row">
                    <div className='col-5'>
                        Variable assigned to width
                    </div>
                    <div className='col'>
                        <select
                            className="custom-select custom-select-sm"
                            id='widthVariables'
                            style={{width: '40%'}}
                            disabled={!this.state.detectWidth}
                            onChange={this.updateWidthVariable.bind(this)}>
                            {items}
                        </select>
                    </div>
                </div>
                <div className="row">
                    <div className='col-5'>
                        Value range
                    </div>
                    <div className='col'>
                        <div className='featureElem' id='sketchWidthSlider' style={{width: '150px'}}>
                            <output id={'sketchWidthSliderMax'} style={{bottom: '1.3rem', zIndex: 200}}></output>
                            <output id={'sketchWidthSliderMin'} style={{bottom: '1.3rem', zIndex: 201}}></output>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    updateWidthDetection() {
        let state = !this.state.detectWidth;
        this.setState({
            detectWidth: state
        });
        if (!state) {
            // if the width detection become off
            this.widthVar = null;
            // if path width is already assigned, remove the width
            if (this.pathWidth) {
                this.pathWidth.remove();
            }
            this.convertSketchIntoQuery(this.state.xItem, this.state.yItem);
            $('img[name=QBSSelector]').each(function() {
                if ($(this).attr('value') === 'changeWidth') {
                    $(this).addClass('disabled');
                }
            });
        } else {
            // if the width detection is on
            let variableList = document.getElementById('widthVariables');
            let selectedIdx = variableList.selectedIndex;
            let selectedVal = variableList.options[selectedIdx].value;
            this.widthVar = selectedVal;
            $('img[name=QBSSelector]').each(function() {
                $(this).removeClass('disabled');
            });
        }
    }

    updateWidthVariable() {
        let variableList = document.getElementById('widthVariables');
        if (variableList && variableList.options.length > 0) {
            let selectedIdx = variableList.selectedIndex;
            let selectedVal = variableList.options[selectedIdx].value;
            this.setValueSlider('sketchWidthSlider', Math.min.apply(null, this.state.minList[selectedVal]), Math.max.apply(null, this.state.maxList[selectedVal]));
            $('#sketchWidthSlider').on('slidestop', this.stopSlidingWidthSlider().bind(this));
            $('#sketchWidthSlider').slider('option', 'disabled', !this.state.detectWidth);
            this.widthVar = selectedVal;
            this.convertSketchIntoQuery(this.state.xItem, this.state.yItem);
        }
    }

    changeWidthVariable(value) {
        let variableList = document.getElementById('widthVariables');
        let idx = -1;
        if (variableList && variableList.options.length > 0) {
            for (idx = 0; idx < variableList.options.length; idx++) {
                if (variableList.options[idx].value === value) {
                    break;
                }
            }
        }
        if (idx < variableList.options.length) {
            variableList.selectedIndex = idx;
        }
    }

    stopSlidingWidthSlider() {
        return function (event, ui) {
            this.convertSketchIntoQuery(this.state.xItem, this.state.yItem);
        };
    }

    definePeriodOfQuery() {
        return (
            <div id='timeLengthOfSketch'>
                <h6>The length of time of the sketch</h6>
                <div className="row matchingOption">
                    <div className='col-5'>
                        Length of the sketched query
                    </div>
                    <div className='col form-inline'>
                        <input className="form-control form-control-sm"
                               type="text"
                               placeholder="Length of time"
                               id="periodOfSketchQuery"
                               style={{width: '40%', marginRight: '0.5rem'}}
                               onChange={this.updateTimeLength.bind(this)}
                               required={true}
                               disabled={(this.state.xItem === 'z' || this.state.yItem === 'z')}/>
                        <label className="col-form-label col-form-label-sm" htmlFor="periodOfSketchQuery">days</label>
                    </div>
                </div>
            </div>
        );
    }

    updateTimeLength() {
        let val = $('#periodOfSketchQuery').val();
        if (val !== '') {
            val = Number(val);
            let canvasSize = $('#QBSSketchPad').width();
            // TODO: Decide the axis range from the most left and right point of the sketch
            if (this.state.xItem === 'z') {
                let minX = this.controlPoints[0].position.x,
                    maxX = this.controlPoints[this.controlPoints.length - 1].position.x;
                this.updateXAxisValue(0, formatValue(val / (maxX - minX) * canvasSize));
            } else if (this.state.yItem === 'z') {
                let minY = this.controlPoints[0].position.y,
                    maxY = this.controlPoints[this.controlPoints.length - 1].position.y;
                this.updateYAxisValue(0, formatValue(val / (maxY - minY) * canvasSize));
            }
            this.convertSketchIntoQuery(this.state.xItem, this.state.yItem);
        }
    }

    assignVariablesArea() {
        return (
            <div id='variableAssignment'>
                <h6>Assign variables to the sketch</h6>
                <div className="row matchingOption">
                    <div className='col-5'>
                        <div className="custom-control custom-switch">
                            <input type="checkbox" className="custom-control-input" id="variableAssignmentSwitch" onChange={this.switchVariableAssignment.bind(this)}/>
                            <label className="custom-control-label" htmlFor="variableAssignmentSwitch">Assign variables</label>
                        </div>
                    </div>
                    <div className='col'>
                        <button type="button" className="btn btn-primary btn-sm" id='removeAllAssignment' onClick={this.removeAllAsignment.bind(this)}>Remove all assignments</button>
                    </div>
                </div>
            </div>
        );
    }

    onClickValueAssignmentCheckbox(e) {
        let value = e.target.value;
        let checked = e.target.checked;
        $('#slider_' + value).slider('option', 'disabled', !checked);
    }

    onClickValueAssignmentDone() {
        $('#controlPointPopover').css('display', 'none');
        let checked = $('input[name=assignedVariableList]');//:checked');
        let label ='';
        let current = this.controlPoints[this.highlightedPointIdx].assignedVariables;
        for (let i = 0; i < checked.length; i++) {
            if (checked[i].checked) {
                let value = checked[i].value;
                let min = Math.min.apply(null, this.state.minList[value]);
                let max = Math.max.apply(null, this.state.maxList[value]);
                let values = $('#slider_' + checked[i].value).slider('option', 'values');
                this.controlPoints[this.highlightedPointIdx].assignedVariables[value] = [min + (max - min) * values[0] / 100, min + (max - min) * values[1] / 100];
                // show labels of the name of the checked variables around the highlighted point
                label += this.state.lookup[value] + ', ';
            } else {
                let value = checked[i].value;
                this.controlPoints[this.highlightedPointIdx].assignedVariables[value] = [];
            }
        }
        // ToDo: Move text not to overlap on the stroke
        if (this.controlPoints[this.highlightedPointIdx].label) {
            this.controlPoints[this.highlightedPointIdx].label.remove();
            this.controlPoints[this.highlightedPointIdx].label = null;
            this.controlPoints[this.highlightedPointIdx].labelRect.remove();
            this.controlPoints[this.highlightedPointIdx].labelRect = null;
        }

        // show a label around the point
        if (label !== '') {
            // show what variables are assigned to the point
            this.controlPoints[this.highlightedPointIdx].label = new paper.PointText({
                position: {x: this.controlPoints[this.highlightedPointIdx].position.x, y: this.controlPoints[this.highlightedPointIdx].position.y - 10},
                fillColor: '#7b7971',
                justification: 'center',
                fontSize: 8
            });
            label = label.slice(0, -2);
            this.controlPoints[this.highlightedPointIdx].label.content = label;
            // set background of the label to avoid occlusion with the path and width
            this.controlPoints[this.highlightedPointIdx].labelRect = new paper.Path.Rectangle(
                this.controlPoints[this.highlightedPointIdx].label.bounds
            );
            this.controlPoints[this.highlightedPointIdx].labelRect.fillColor = 'white';
            this.controlPoints[this.highlightedPointIdx].labelRect.strokeColor = 'white';
            this.controlPoints[this.highlightedPointIdx].label.insertAbove(this.controlPoints[this.highlightedPointIdx].labelRect);
        }
        this.convertSketchIntoQuery(this.state.xItem, this.state.yItem);
    }

    setValueSlider(id, min, max) {
        let slider = $('#' + id);
        let sliderMin = $('#' + id + 'Min');
        let sliderMax = $('#' + id + 'Max');
        let key = id.slice('_')[1];
        slider.slider({
            range: true,
            disabled: true,//!$('#valueAssignmentCheckbox_' + key).prop('checked'),
            min: 0,
            max: 100,
            values: [ 0, 100 ],
            slide: function (event, ui) {
                let minVal = ui.values[0] / 100 * (max - min) + min;
                let maxVal = ui.values[1] / 100 * (max - min) + min;
                sliderMin.val(formatValue(minVal));
                sliderMax.val(formatValue(maxVal));
                let minPos = -8 + 150 * ui.values[0] / 100;
                let maxPos = - 8 + 150 - 150 * ui.values[1] / 100;
                if (ui.handleIndex === 0) {
                    sliderMin.css('display', 'initial');
                    sliderMin.css('left', minPos + 'px');
                } else if (ui.handleIndex === 1) {
                    sliderMax.css('display', 'initial');
                    sliderMax.css('right', maxPos + 'px');
                }
            }.bind(this),
            stop: function () {
                sliderMin.css('display', 'none');
                sliderMax.css('display', 'none');
            }
        });
        sliderMin.val(slider.slider('values', 0));
        sliderMax.val(slider.slider('values', 1));
    }

    controlPointPopover() {
        let counter = 0;
        let items = [];
        for (let key in this.state.lookup) {
            let label = '';
            if (this.state.lookup[key].length > 1) {
                label = this.state.lookup[key].join(',');
            } else {
                label = this.state.lookup[key][0];
            }
            if (label.indexOf('JD') < 0) {
                let sliderId = 'slider_' + key;
                items.push(
                    <div id={'assignVariable_' + key} className='row align-items-center' key={label}>
                        <div className='form-check col-4' style={{paddingLeft: '0px'}}
                             onChange={this.onClickValueAssignmentCheckbox.bind(this)}>
                            <input
                                type='checkbox'
                                id={'valueAssignmentCheckbox_' + key}
                                name='assignedVariableList'
                                value={key}/>
                            <label
                                className="form-check-label"
                                key={label}>
                                {label}
                            </label>
                        </div>
                        <div className='col' id={sliderId} style={{width: '150px'}}>
                            <output id={sliderId + "Max"} style={{bottom: '1.3rem', zIndex: 100 + counter}}></output>
                            <output id={sliderId + "Min"} style={{bottom: '1.3rem', zIndex: 150 + counter}}></output>
                        </div>
                        <div id={'widthValue_' + key} style={{display: 'none'}}>

                        </div>
                    </div>
                );
                this.setValueSlider(sliderId, Math.min.apply(null, this.state.minList[key]), Math.max.apply(null, this.state.maxList[key]));
            }
            counter++;
        }
        return (
            <div
                id='controlPointPopover'
                className='popover'// bs-popover-right'
                style={{
                    position: 'absolute',
                    opacity: '0.85',
                    display: 'none',
                    padding: '0.5rem 0.8rem'}}>
                <div id='controlPointPopoverArrow' className='arrow'>
                </div>
                <form
                    className='container'
                    name='assignVariablesForm'
                    style={{paddingRight: '0px', paddingLeft: '0px', marginBottom: '0.2rem'}}>
                    {items}
                </form>
                <button className="btn btn-primary btn-sm"
                        id={'valueAssignmentDoneBtn'}
                        style={{float: 'right'}}
                        onClick={this.onClickValueAssignmentDone.bind(this)}>Done</button>
            </div>
        )
    }

    render() {
        let axisSelection = this.axisSelectionPanel();
        return (
            <div id='QBSQuerying'>
                {this.sketchMenu()}
                <div id='QBSCanvasArea'>
                    {axisSelection.x}
                    {axisSelection.y}
                    {this.controlPointPopover()}
                    <div className='overlayHidingPanel'></div>
                </div>
                <div id='QBSSketchMenuArea'>
                    {this.importExportQueryMenu()}
                    <div style={{clear: 'both'}}></div>
                    {this.sketchOptions()}
                </div>
            </div>
        );
    }
}
