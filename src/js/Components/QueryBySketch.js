import React from 'react';
import paper from 'paper';
import * as d3 from 'd3';
import FeatureStore from '../Stores/FeatureStore';
import DataStore from '../Stores/DataStore';

export default class QueryBySketch extends React.Component{
    constructor(props) {
        super();
        // make a complete lookup table for x/y axis selection of the sketch pad
        // props.lookup is a collection of lookups from all data
        let lookupList = {};
        props.lookup.forEach(function (e) {
           for (let key in e) {
               if (!lookupList[key]) {
                   lookupList[key] = e[key];
               } else {
                   e[key].forEach(function (ee) {
                       if (lookupList[key].indexOf(ee) < 0) {
                           lookupList[key].push(ee);
                       }
                   });
               }
           }
        });
        let targets = FeatureStore.getTarget();
        let minList = {}, maxList = {};
        let minTmp = [], maxTmp = [];
        for (let key in lookupList) {
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
            lookup: lookupList,
            selector: 'pen',
            targetList: targets,
            minList: minList,
            maxList: maxList,
            detectWidth: true
        }
        this.assignVariables = false;
        this.margin = {"bottom": 20, "left": 20 };
        this.curveSegment = 10;
        this.sketching = false;
        this.path = null;
        this.pathWidth = null;
        this.pathUpper = null;
        this.pathLower = null;
        this.radiuses = null;
        this.segPoints = [];
        this.penSizeCircle = null;
        this.highlightedPoint = null;
        this.highlightedPointIdx = -1;
        this.timeStamps = [];
        this.selectedIdx = -1;
        this.selectedHandle = null;
        this.selectedPoint = null;
        this.controlPoints = [];
        this.widthVar = null;

        FeatureStore.on('updateTarget', () => {
            let targets = FeatureStore.getTarget();

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
            this.setState({
                targerList: targets,
                minList: minList,
                maxList: maxList
            });
            let xMin = Math.min.apply(null, minList[this.state.xItem]),
                xMax = Math.max.apply(null, maxList[this.state.xItem]),
                yMin = Math.min.apply(null, minList[this.state.yItem]),
                yMax = Math.max.apply(null, maxList[this.state.yItem]);
            if (this.state.xItem === 'z') {
                xMax = xMax - xMin;
                xMin = 0;
            }
            if (this.state.yItem === 'z') {
                yMax = yMax - yMin;
                yMin = 0;
            }
            this.updateXAxisValue(xMin, xMax);
            this.updateYAxisValue(yMin, yMax);
        });
    }

    componentDidMount() {
        this.initCanvas();
        // this.initSketchMenu();
    }

    formatValue(value) {
        value = Number(value);
        let result;
        if (Math.log10(Math.abs(value)) < -2 && value !== 0) {
            result = value.toExponential(1);
        } else {
            result = value.toFixed(2);
        }
        return result;
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
        this.canvas = parentArea.append('canvas')
            .attr('width', outerSize + 'px !important')
            .attr('height', outerSize + 'px !important')
            .attr('id', 'QBSSketchPad')
            .style('position', 'absolute')
            .style('border', '1px solid lightgray');
        paper.setup(this.canvas.node());

        this.xAxis = parentArea
            .append('g')
            .attr('class', 'x_axis')
            .style('position', 'absolute');
        this.xAxis
            .style('left', outerSize / 2 + 'px')
            .style('top', outerSize - this.margin.bottom + 'px');
        this.xAxisText = this.xAxis
            .append('text')
            .attr('class', 'axisLabel')
            .attr('id', 'sketchPadXLabel')
            .attr('fill', 'black')
            .attr('text-anchor', 'middle')
            .style('font-size', '0.7rem')
            .text(this.state.lookup[this.state.xItem])
            .on('click', this.CanvasXLabelOnClick().bind(this));
        let xMin = Math.min.apply(null, this.state.minList[this.state.xItem]),
            xMax = Math.max.apply(null, this.state.maxList[this.state.xItem]);
        if (this.state.xItem === 'z') {
            xMax = xMax - xMin;
            xMin = 0;
        }
        this.xMinValueText = parentArea
            .append('g')
            .style('position', 'absolute')
            .attr('class', 'axisLabel')
            .attr('id', 'sketchPadXMin')
            .attr('text-anchor', 'left')
            .style('font-size', '0.5rem')
            .style('left', this.margin.left + 'px')
            .style('bottom', '0.5rem')
            .text(this.formatValue(xMin));
        this.xMaxValueText = parentArea
            .append('g')
            .style('position', 'absolute')
            .attr('class', 'axisLabel')
            .attr('id', 'sketchPadXMax')
            .attr('text-anchor', 'right')
            .style('font-size', '0.5rem')
            .style('right', this.margin.left + 'px')
            .style('bottom', '0.5rem')
            .text(this.formatValue(xMax));

        this.yAxis = parentArea
            .append('g')
            .attr('class', 'y_axis')
            .style('position', 'absolute');
        this.yAxis
            .style('left', this.margin.left / 2 + 'px')
            .style('top', outerSize / 2 + 'px');
        this.yAxisText = this.yAxis
            .append('text')
            .attr('class', 'axisLabel')
            .attr('fill', 'black')
            .attr('transform', 'rotate(-90)')
            .attr('text-anchor', 'middle')
            .style('font-size', '0.7rem')
            .text(this.state.lookup[this.state.yItem])
            .on('click', this.CanvasYLabelOnClick().bind(this));
        let yMin = Math.min.apply(null, this.state.minList[this.state.yItem]),
            yMax = Math.max.apply(null, this.state.maxList[this.state.yItem]);
        if (this.state.yItem === 'z') {
            yMax = yMax - Min;
            yMin = 0;
        }
        this.yMinValueText = parentArea
            .append('g')
            .style('position', 'absolute')
            .attr('class', 'axisLabel')
            .attr('id', 'sketchPadYMin')
            .attr('text-anchor', 'left')
            .style('font-size', '0.5rem')
            .style('left', this.margin.left / 2 + 'px')
            .style('bottom', '1rem')
            .text(this.formatValue(yMin));
        this.yMaxValueText = parentArea
            .append('g')
            .style('position', 'absolute')
            .attr('class', 'axisLabel')
            .attr('id', 'sketchPadYMax')
            .attr('text-anchor', 'right')
            .style('font-size', '0.5rem')
            .style('left', this.margin.left / 2 + 'px')
            .style('top', '0.5rem')
            .text(this.formatValue(yMax));

        this.tool = new paper.Tool();
        this.tool.minDistance = 15;
        this.tool.onMouseDown = this.CanvasOnMouseDown().bind(this);
        this.tool.onMouseDrag = this.CanvasOnMouseDrag().bind(this);
        this.tool.onMouseUp = this.CanvasOnMouseUp().bind(this);

        paper.view.onFrame = this.CanvasOnFrame().bind(this);
    }

    CanvasOnFrame() {
        return function (event) {
            if (this.sketching && this.penSizeCircle) {
                let center = this.penSizeCircle.position;
                let now = Date.now();
                let deltaT = now - this.timeStamps[this.timeStamps.length - 1];
                let t = deltaT / 1000 * 30 + 5 / 2;
                this.penSizeCircle.remove();
                this.penSizeCircle = new paper.Path.Circle(center, t);
                this.penSizeCircle.strokeColor = '#325D88';
            }
        }
    }

    CanvasOnMouseDown() {
        return function (event) {
            let hitResult;
            if (this.assignVariables) {
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
                    let popoverWidth = popover.width() + arrowHeight,
                        popoverHeight = popover.height() + arrowHeight;
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
                                let valueRange = [Number($('#sketchPadXMin').text()), Number($('#sketchPadXMax').text())];
                                $('#widthValue_' + key).css('display', 'block');
                                $('#widthValue_' + key).text(this.formatValue((valueRange[1] - valueRange[0]) / this.state.size * (this.state.size - this.controlPoints[this.highlightedPointIdx].position.x) + valueRange[0]));
                            } else if (key === this.state.yItem) {
                                // show y value
                                $('#valueAssignmentCheckbox_' + key).prop('disabled', true);
                                $('#slider_' + key).css('display', 'none');
                                let valueRange = [Number($('#sketchPadYMin').text()), Number($('#sketchPadYMax').text())];
                                $('#widthValue_' + key).css('display', 'block');
                                $('#widthValue_' + key).text(this.formatValue((valueRange[1] - valueRange[0]) / this.state.size * (this.state.size - this.controlPoints[this.highlightedPointIdx].position.y) + valueRange[0]));
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
                                $('#widthValue_' + key).text(this.formatValue((maxRange - minRange) / (maxRad - minRad) * (this.radiuses[this.highlightedPointIdx] - minRad) + minRange));
                            }
                        } else {
                            // if some variables are already assigned
                            if (key === this.state.xItem) {
                                // show x value
                                $('#valueAssignmentCheckbox_' + key).prop('disabled', true);
                                $('#slider_' + key).css('display', 'none');
                                let valueRange = [Number($('#sketchPadXMin').text()), Number($('#sketchPadXMax').text())];
                                $('#widthValue_' + key).css('display', 'block');
                                $('#widthValue_' + key).text(this.formatValue((valueRange[1] - valueRange[0]) / this.state.size * (this.state.size - this.controlPoints[this.highlightedPointIdx].position.x) + valueRange[0]));
                            } else if (key === this.state.yItem) {
                                // show y value
                                $('#valueAssignmentCheckbox_' + key).prop('disabled', true);
                                $('#slider_' + key).css('display', 'none');
                                let valueRange = [Number($('#sketchPadYMin').text()), Number($('#sketchPadYMax').text())];
                                $('#widthValue_' + key).css('display', 'block');
                                $('#widthValue_' + key).text(this.formatValue((valueRange[1] - valueRange[0]) / this.state.size * (this.state.size - this.controlPoints[this.highlightedPointIdx].position.y) + valueRange[0]));
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
                                $('#widthValue_' + key).text(this.formatValue((maxRange - minRange) / (maxRad - minRad) * (this.radiuses[this.highlightedPointIdx] - minRad) + minRange));
                            }
                        }
                    }
                }
            } else {
                switch (this.state.selector) {
                    case 'pen':
                        this.sketching = true;
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
                            }
                        }
                        this.controlPoints = [];
                        this.timeStamps = [];

                        this.radiuses = [];
                        this.radiuses.push(0);
                        this.pathWidth = new paper.Path({
                            segments: [event.point],
                            strokeColor: '#325D88',
                            strokeWidth: 1,
                            fillColor: '#29ABE0',
                            opacity: 0.5
                        });
                        this.path = new paper.Path({
                            segments: [event.point],
                            strokeColor: 'black',
                            strokeWidth: 5
                        });
                        this.penSizeCircle = new paper.Path.Circle(event.point, 2.5);
                        this.penSizeCircle.strokeColor = '#325D88';
                        this.timeStamps.push(Date.now());
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
                                label: null
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
                            let r0 = this.radiuses[curve.segment1.index],
                                r2 = this.radiuses[curve.segment2.index];
                            let r1 = (r2 - r0) * curve.length / originalCurveLen + r0;
                            this.radiuses.splice(curve.segment2.index, 0, r1);
                            this.pathWidth.remove();
                            this.drawPathWidth();
                        }
                        break;
                    case 'eraser':
                        hitResult = null;
                        hitResult = this.path.hitTest(event.point, {segments: true, tolerance: 5});
                        hitResultWidth = null;
                        hitResultWidth = this.pathWidth.hitTest(event.point, {segments: true, tolerance: 5});
                        if (hitResult) {
                            this.path.removeSegment(hitResult.segment.index);
                            this.controlPoints.splice(hitResult.segment.index, 1);
                            this.radiuses.splice(hitResult.segment.index, 1);
                            this.pathWidth.remove();
                            this.drawPathWidth();
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
                        this.tool.minDistance = 1;
                        this.selectedIdx = -1;
                        this.selectedPoint = null;
                        hitResult = null;

                        hitResult = this.path.hitTest(event.point, {segments: true, tolerance: 5});
                        if (hitResult) {
                            this.selectedIdx = hitResult.segment.index;
                            this.selectedPoint = hitResult.segment;
                        }
                        break;
                }
            }
        }
    }

    CanvasOnMouseDrag() {
        return function (event) {
            if (!this.assignVariables) {
                switch (this.state.selector) {
                    case 'pen':
                        this.path.add(event.point);
                        let now = Date.now();
                        let deltaT = now - this.timeStamps[this.timeStamps.length - 1];
                        this.timeStamps.push(now);
                        let t = deltaT / 1000 * 30 + 5 / 2;
                        let deltaX = event.delta.x, deltaY = event.delta.y;
                        let l = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                        let step = event.delta;
                        step.angle += 90;
                        let top = {x: event.middlePoint.x + t / l * step.x, y: event.middlePoint.y + t / l * step.y};
                        let bottom = {x: event.middlePoint.x - t / l * step.x, y: event.middlePoint.y - t / l * step.y};
                        this.pathWidth.add(top);
                        this.pathWidth.insert(0, bottom);
                        this.pathWidth.smooth();
                        this.radiuses.push(t);
                        this.penSizeCircle.remove();
                        this.penSizeCircle = new paper.Path.Circle(event.point, 2.5);
                        this.penSizeCircle.strokeColor = '#325D88';
                        break;
                    case 'controlPoint':
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
                                this.pathUpper[idx] = {x: p.x + rj / lDelta * delta.x, y: p.y + rj / lDelta * delta.y};
                                this.pathLower[idx] = {x: p.x - rj / lDelta * delta.x, y: p.y - rj / lDelta * delta.y};
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
                                this.pathUpper[idx] = {x: p.x + rj / lDelta * delta.x, y: p.y + rj / lDelta * delta.y};
                                this.pathLower[idx] = {x: p.x - rj / lDelta * delta.x, y: p.y - rj / lDelta * delta.y};
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
                                this.pathUpper[i] = {x: p.x + rj / lDelta * delta.x, y: p.y + rj / lDelta * delta.y};
                                this.pathLower[i] = {x: p.x - rj / lDelta * delta.x, y: p.y - rj / lDelta * delta.y};
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
                                this.pathUpper[idx] = {x: p.x + rj / lDelta * delta.x, y: p.y + rj / lDelta * delta.y};
                                this.pathLower[idx] = {x: p.x - rj / lDelta * delta.x, y: p.y - rj / lDelta * delta.y};
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
                        break;
                    case 'changeWidth':
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
                        break;
                }
            }
        }
    }

    CanvasOnMouseUp() {
        return function (event) {
            if (!this.assignVariables) {
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
                                label: null
                            });
                            for (let key in this.state.lookup) {
                                this.controlPoints[this.controlPoints.length - 1].assignedVariables[key] = [];
                            }
                        }.bind(this));
                        let now = Date.now();
                        let deltaT = now - this.timeStamps[this.timeStamps.length - 1];
                        this.timeStamps.push(now);
                        let t = deltaT / 1000 * 30 + 5 / 2;
                        this.radiuses.push(t);

                        // remove the temporal width path
                        this.pathWidth.remove();

                        // simplificationDeg should be odd (- - * + +: * is the value of the point)
                        let simplificationDeg = segments.length / this.path.segments.length;
                        simplificationDeg = (Math.floor(simplificationDeg) % 2 === 1)? Math.floor(simplificationDeg): Math.ceil(simplificationDeg);

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
                        this.penSizeCircle = null;

                        this.sketching = false;
                        break;
                    case 'controlPoint':
                        this.selectedHandle = null;
                        this.selectedPoint = null;
                        break;
                    case 'changeWidth':
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
                        break;
                }
                this.tool.minDistance = 15;
            }
        }
    }

    drawPathWidth() {
        // compute the upper/lower points of the simplified curve
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

    CanvasXLabelOnClick() {
        return function () {
            let value = this.state.xItemonPanel;
            let minVal = Math.min.apply(null, this.state.minList[value]),
                maxVal = Math.max.apply(null, this.state.maxList[value]);
            if (value === 'z') {
                maxVal = maxVal - minVal;
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
            }
        }
    }

    CanvasYLabelOnClick() {
        return function () {
            let value = this.state.yItemonPanel;
            let minVal = Math.min.apply(null, this.state.minList[value]),
                maxVal = Math.max.apply(null, this.state.maxList[value]);
            if (value === 'z') {
                maxVal = maxVal - minVal;
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
        }
    }

    onSelectXItem(e) {
        let value = e.target.value;
        this.setState({xItemonPanel: value});
        this.setValueSlider('sketchPadXRangeSlider', Math.min.apply(null, this.state.minList[value]), Math.max.apply(null, this.state.maxList[value]));
    }

    onSelectYItem(e) {
        let value = e.target.value;
        this.setState({yItemonPanel: value});
        this.setValueSlider('sketchPadYRangeSlider', Math.min.apply(null, this.state.minList[value]), Math.max.apply(null, this.state.maxList[value]));
    }

    updateXAxisValue(min, max) {
        if (this.xMinValueText) {
            this.xMinValueText
                .text(this.formatValue(min));
        }
        if (this.xMaxValueText) {
            this.xMaxValueText
                .text(this.formatValue(max));
        }
    }

    updateYAxisValue(min, max) {
        if (this.yMinValueText) {
            this.yMinValueText
                .text(this.formatValue(min));
        }
        if (this.yMaxValueText) {
            this.yMaxValueText
                .text(this.formatValue(max));
        }
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
            max = max - min;
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
            max = max - min;
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
    }

    switchSelector() {
        let selectedSelector = $('input[name=QBSSelector]:checked').val();
        this.setState({
            selector: selectedSelector
        });
        this.updateSelectedStatus(selectedSelector);
    }

    switchVariableAssignment() {
        this.assignVariables = !this.assignVariables;
        $('#variableAssignmentSwitch').prop('checked', this.assignVariables);
        if (this.assignVariables && this.path) {
            this.path.fullySelected = true;
            if (this.pathWidth) {
                this.pathWidth.fullySelected = false;
            }
        } else if (!this.assignVariables) {
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
        if (selectedSelector === 'addPoint' || selectedSelector === 'eraser') {
            if (this.path) this.path.fullySelected = true;
            // if (this.pathWidth) this.pathWidth.fullySelected = true;
        } else if (selectedSelector === 'controlPoint') {
            if (this.path) this.path.fullySelected = true;
            if (this.pathWidth) this.pathWidth.fullySelected = false;
        } else if (selectedSelector === 'changeWidth') {
            if (this.path) this.path.fullySelected = true;
            if (this.pathWidth) this.pathWidth.fullySelected = false;
        } else if (selectedSelector === 'pen') {
            if (this.path) this.path.fullySelected = false;
            if (this.pathWidth) this.pathWidth.fullySelected = false;
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
                <form className='selector featureRow' onChange={this.switchSelector.bind(this)}>
                    <div className="form-check form-check-inline">
                        <input
                            type="radio"
                            name="QBSSelector"
                            value="pen"
                            checked={this.state.selector === 'pen'} readOnly/>
                        <label className="form-check-label" htmlFor="pen">Pen</label>
                    </div>
                    <div className="form-check form-check-inline">
                        <input
                            type="radio"
                            name="QBSSelector"
                            value="addPoint"
                            checked={this.state.selector === 'addPoint'} readOnly/>
                        <label className="form-check-label" htmlFor="addPoint">Add points</label>
                    </div>
                    <div className="form-check form-check-inline">
                        <input
                            type="radio"
                            name="QBSSelector"
                            value="eraser"
                            checked={this.state.selector === 'eraser'} readOnly/>
                        <label className="form-check-label" htmlFor="eraser">Eraser</label>
                    </div>
                    <div className="form-check form-check-inline">
                        <input
                            type="radio"
                            name="QBSSelector"
                            value="controlPoint"
                            checked={this.state.selector === 'controlPoint'} readOnly/>
                        <label className="form-check-label" htmlFor="controlPoint">Control point</label>
                    </div>
                    <div className="form-check form-check-inline">
                        <input
                            type="radio"
                            name="QBSSelector"
                            value="changeWidth"
                            checked={this.state.selector === 'changeWidth'} readOnly/>
                        <label className="form-check-label" htmlFor="changeWidth">Change width</label>
                    </div>
                </form>
            </div>
        );
    }

    sketchOptions() {
        return (
            <div id='QBSSketchOptions' className='featureElem'>
                <h5>Options</h5>
                {this.sketchWidthControl()}
                {this.definePeriodOfQuery()}
                {this.assignVariablesArea()}
            </div>
        );
    }

    sketchWidthControl() {
        let items = [];
        for (let key in this.state.lookup) {
            let label = '';
            if (this.state.lookup[key].length > 1) {
                label = this.state.lookup[key].join(',');
            } else {
                label = this.state.lookup[key];
            }
            if (label.indexOf('JD') < 0) {
                items.push(
                    <option key={key} value={key}>{label}</option>
                );
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
                            onChange={this.updateWidthVariable()}>
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
        let state = this.state.detectWidth;
        this.setState({
            detectWidth: !state
        });
        if (state) {
            // if the width detection become off
            this.widthVar = null;
        } else {
            // if the width detection is on
            let variableList = document.getElementById('widthVariables');
            let selectedIdx = variableList.selectedIndex;
            let selectedVal = variableList.options[selectedIdx].value;
            this.widthVar = selectedVal;
        }
    }

    updateWidthVariable() {
        let variableList = document.getElementById('widthVariables');
        if (variableList) {
            let selectedIdx = variableList.selectedIndex;
            let selectedVal = variableList.options[selectedIdx].value;
            this.setValueSlider('sketchWidthSlider', Math.min.apply(null, this.state.minList[selectedVal]), Math.max.apply(null, this.state.maxList[selectedVal]));
            $('#sketchWidthSlider').slider('option', 'disabled', !this.state.detectWidth);
            this.widthVar = selectedVal;
        }
    }

    definePeriodOfQuery() {
        return (
            <div id='timeLengthOfSketch'>
                <h6>The length of time of the sketch</h6>
                <div className="form-inline">
                    <input className="form-control form-control-sm"
                           type="text"
                           placeholder="Length of time"
                           id="periodOfSketchQuery"
                           style={{width: '40%', marginRight: '0.5rem'}}
                           onChange={this.updateTimeLength.bind(this)}/>
                    <label className="col-form-label col-form-label-sm" htmlFor="periodOfSketchQuery">days</label>
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
                this.updateXAxisValue(0, this.formatValue(val / (maxX - minX) * canvasSize));
            } else if (this.state.yItem === 'z') {
                let minY = this.controlPoints[0].position.y,
                    maxY = this.controlPoints[this.controlPoints.length - 1].position.y;
                this.updateYAxisValue(0, this.formatValue(val / (maxY - minY) * canvasSize));
            }
        }
    }

    assignVariablesArea() {
        return (
            <div id='variableAssignment'>
                <h6>Assign variables to the sketch</h6>
                <div className='form-group'>
                    <div className="custom-control custom-switch">
                        <input type="checkbox" className="custom-control-input" id="variableAssignmentSwitch" onChange={this.switchVariableAssignment.bind(this)}/>
                        <label className="custom-control-label" htmlFor="variableAssignmentSwitch">Assign variables</label>
                    </div>
                    <button type="button" className="btn btn-primary btn-sm" id='removeAllAssignment' onClick={this.removeAllAsignment.bind(this)}>Remove all assignment</button>
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
        let checked = $('input[name=assignedVariableList]:checked');
        let label ='';
        let current = this.controlPoints[this.highlightedPointIdx].assignedVariables;
        for (let i = 0; i < checked.length; i++) {
            let value = checked[i].value;
            let min = Math.min.apply(null, this.state.minList[value]);
            let max = Math.max.apply(null, this.state.maxList[value]);
            let values = $('#slider_' + checked[i].value).slider('option', 'values');
            this.controlPoints[this.highlightedPointIdx].assignedVariables[value] = [min + (max - min) * values[0] / 100, min + (max - min) * values[1] / 100];
            label += this.state.lookup[value] + ', ';
            // show labels of the name of thechecked variables around the highlighted point
        }
        // ToDo: Move text not to overlap on the stroke
        if (this.controlPoints[this.highlightedPointIdx].label) {
            this.controlPoints[this.highlightedPointIdx].label.remove();
        }
        this.controlPoints[this.highlightedPointIdx].label = new paper.PointText({
            position: {x: this.controlPoints[this.highlightedPointIdx].position.x, y: this.controlPoints[this.highlightedPointIdx].position.y - 10},
            fillColor: '#7b7971',
            justification: 'center',
            fontSize: 8
        });
        label = label.slice(0, -2);
        this.controlPoints[this.highlightedPointIdx].label.content = label;
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
                sliderMin.css('display', 'initial');
                sliderMax.css('display', 'initial');
                let minVal = ui.values[0] / 100 * (max - min) + min;
                let maxVal = ui.values[1] / 100 * (max - min) + min;
                sliderMin.val(this.formatValue(minVal));
                sliderMax.val(this.formatValue(maxVal));
                let minPos = -8 + 150 * ui.values[0] / 100;
                let maxPos = - 8 + 150 - 150 * ui.values[1] / 100;
                sliderMin.css('left', minPos + 'px');
                sliderMax.css('right', maxPos + 'px');
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
                </div>
                <div id='QBSSketchMenuArea'>
                    {this.sketchOptions()}
                </div>
            </div>
        );
    }
}