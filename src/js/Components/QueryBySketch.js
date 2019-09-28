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
            popover: false,
            assignVariables: false,
            targetList: targets,
            minList: minList,
            maxList: maxList
        }
        this.margin = {"bottom": 20, "left": 20 };
        this.sketching = false;
        this.path = null;
        this.pathWidth = null;
        this.penSizeCircle = null;
        this.highlightedPoint = null;
        this.highlightedPointIdx = -1;
        this.timeStamps = [];
        this.selectedHandle = null;
        this.selectedPoint = null;
        this.controlPoints = [];

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
        });
    }

    componentDidMount() {
        this.initCanvas();
        // this.initSketchMenu();
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
            .attr('fill', 'black')
            .attr('text-anchor', 'middle')
            .style('font-size', '0.7rem')
            .text(this.state.lookup[this.state.xItem])
            .on('click', this.CanvasXLabelOnClick().bind(this));

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

        this.tool = new paper.Tool();
        this.tool.minDistance = 15;
        this.tool.onMouseMove = this.CanvasOnMouseMove().bind(this);
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
    
    CanvasOnMouseMove() {
        return function (event) {
        }

    }

    CanvasOnMouseDown() {
        return function (event) {
            let hitResult;
            let hitResultWidth;
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
                    this.setState({
                        popover: true
                    });
                    let popover = $('#controlPointPopover');
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
                            $('#valueAssignmentCheckbox_' + key).prop('checked', false);
                            $('#slider_' + key).slider('option', 'values', [0, 0]);
                            $('#slider_' + key).slider('option', 'disabled', true);
                        } else {
                            $('#valueAssignmentCheckbox_' + key).prop('checked', true);
                            let min = Math.min.apply(null, this.state.minList[key]);
                            let max = Math.max.apply(null, this.state.maxList[key]);
                            $('#slider_' + key).slider('option', 'values', [
                                (this.controlPoints[this.highlightedPointIdx].assignedVariables[key][0] - min) / (max - min) * 100,
                                (this.controlPoints[this.highlightedPointIdx].assignedVariables[key][1] - min) / (max - min) * 100
                                ]);
                            $('#slider_' + key).slider('option', 'disabled', false);
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
                        this.timeStamps.push(Date.now());//event.event.timeStamp);
                        break;
                    case 'addPoint':
                        hitResult = null;
                        hitResult = this.path.hitTest(event.point, {fill: true, stroke: true, tolerance: 5});
                        hitResultWidth = null;
                        hitResultWidth = this.pathWidth.hitTest(event.point, {stroke: true, tolerance: 5});
                        if (hitResult) {
                            let curve = hitResult.location.curve;
                            this.path.insert(curve.segment2.index, new paper.Point(event.point.x, event.point.y));
                            this.controlPoints.splice(curve.segment2.index, 0, {
                                position: {x: event.point.x, y: event.point.x},
                                assignedVariables: {},
                                label: null
                            });
                            for (let key in this.state.lookup) {
                                this.controlPoints[curve.segment2.index].assignedVariables[key] = [];
                            }
                        } else if (hitResultWidth) {
                            let curve = hitResultWidth.location.curve;
                            this.pathWidth.insert(curve.segment2.index, new paper.Point(event.point.x, event.point.y));
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
                        } else if (hitResultWidth) {
                            this.pathWidth.removeSegment(hitResultWidth.segment.index);
                        }
                        break;
                    case 'controlPoint':
                        hitResult = null;
                        // Hit test on path for handles:
                        hitResult = this.path.hitTest(event.point, {handles: true, tolerance: 5});
                        if (hitResult) {
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
                                this.selectedPoint = hitResult.segment;
                            }
                        }
                        break;
                    case 'controlWidth':
                        hitResult = null;

                        hitResult = this.pathWidth.hitTest(event.point, {handles: true, tolerance: 5});
                        if (hitResult) {
                            if (hitResult.type === 'handle-in') {
                                this.selectedHandle = hitResult.segment.handleIn;
                            } else if (hitResult.type === 'handle-out') {
                                this.selectedHandle = hitResult.segment.handleOut;
                            }
                        }
                        if (this.selectedHandle == null) {
                            hitResult = this.pathWidth.hitTest(event.point, {segments: true, tolerance: 5});
                            if (hitResult) {
                                this.selectedPoint = hitResult.segment;
                            }
                        }
                        break;
                }
            }
        }
    }

    CanvasOnMouseDrag() {
        return function (event) {
            if (!this.state.assignVariables) {
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
                            this.controlPoints[this.selectedPoint.index].position = {x: this.selectedPoint.point.x + event.delta.x, y: this.selectedPoint.point.y + event.delta.y};
                        }
                        break;
                    case 'controlWidth':
                        if (this.selectedHandle) {
                            this.selectedHandle.x += event.delta.x;
                            this.selectedHandle.y += event.delta.y;
                        }
                        if (this.selectedPoint) {
                            this.selectedPoint.point.x += event.delta.x;
                            this.selectedPoint.point.y += event.delta.y;
                        }
                        break;
                }
            }
        }
    }

    CanvasOnMouseUp() {
        return function (event) {
            if (!this.state.assignVariables) {
                switch (this.state.selector) {
                    case 'pen':
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
                        let top = {x: event.point.x, y: event.point.y + t / 2};
                        let bottom = {x: event.point.x, y: event.point.y - t / 2};
                        this.pathWidth.add(top);
                        this.pathWidth.insert(0, bottom);
                        this.pathWidth.smooth();
                        this.pathWidth.simplify(50);
                        this.pathWidth.closed = true;

                        this.penSizeCircle.remove();
                        this.penSizeCircle = null;

                        this.sketching = false;
                        break;
                    case 'controlPoint':
                        this.selectedHandle = null;
                        this.selectedPoint = null;
                        break;
                    case 'controlWidth':
                        this.selectedHandle = null;
                        this.selectedPoint = null;
                        break;
                }
            }
        }
    }

    CanvasXLabelOnClick() {
        return function () {
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
        this.setState({xItemonPanel: e.target.value});
    }

    onSelectYItem(e) {
        this.setState({yItemonPanel: e.target.value});
    }

    changeXAxis() {
        this.setState({
            xItem: this.state.xItemonPanel
        });
        if (this.xAxisText) {
            this.xAxisText
                .text(this.state.lookup[this.state.xItemonPanel]);
        }
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
        let switched = !this.state.assignVariables;
        this.setState({
            assignVariables: switched
        });
        if (switched && this.path) {
            this.path.fullySelected = true;
            if (this.pathWidth) {
                this.pathWidth.fullySelected = false;
            }
        } else if (!switched) {
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
            if (this.pathWidth) this.pathWidth.fullySelected = true;
        } else if (selectedSelector === 'controlPoint') {
            if (this.path) this.path.fullySelected = true;
            if (this.pathWidth) this.pathWidth.fullySelected = false;
        } else if (selectedSelector === 'controlWidth') {
            if (this.path) this.path.fullySelected = false;
            if (this.pathWidth) this.pathWidth.fullySelected = true;
        } else if (selectedSelector === 'pen') {
            if (this.path) this.path.fullySelected = false;
            if (this.pathWidth) this.pathWidth.fullySelected = false;
        }
    }

    removeAllAsignment() {

    }

    selectControlPoint() {
        this.setState({
            popover: !this.state.popover
        });
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
                    <div className='form-check' key={label}>
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
                    <div className='form-check' key={label}>
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
                    <div className='form-check' key={label}>
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
                    <div className='form-check' key={label}>
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
                    style={{float: 'left', textAlign: 'left'}}>
                    <form id='changeXAxisForm_SketchPad'>
                        {xItems}
                    </form>
                </div>
                <button className="btn btn-primary btn-sm"
                        id={'changeXAxisBtn_SketchPad'}
                        onClick={this.changeXAxis.bind(this)}>Done</button>
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
                    style={{float: 'left', textAlign: 'left'}}>
                    <form id='changeYAxisForm_SketchPad'>
                        {yItems}
                    </form>
                </div>
                <button className="btn btn-primary btn-sm"
                        id={'changeXAxisBtn_SketchPad'}
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
                            value="controlWidth"
                            checked={this.state.selector === 'controlWidth'} readOnly/>
                        <label className="form-check-label" htmlFor="controlWidth">Control width</label>
                    </div>
                </form>
            </div>
        );
    }

    sketchOptions() {
        return (
            <div id='QBSSketchOptions' className='featureElem'>
                <h5>Options</h5>
                {this.assignVariables()}
            </div>
        );
    }

    assignVariables() {
        return (
            <div id='variableAssignment'>
                <h6>Assign variables to the sketch</h6>
                <div className='form-group'>
                    <div className="custom-control custom-switch">
                        <input type="checkbox" className="custom-control-input" id="variableAssignmentSwitch" onChange={this.switchVariableAssignment.bind(this)} checked={this.state.assignVariables}/>
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
        this.setState({
            popover: false
        });
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
            fillColor: 'black',
            justification: 'center',
            fontSize: 8
        });
        label = label.slice(0, -2);
        this.controlPoints[this.highlightedPointIdx].label.content = label;
    }

    setValueAssignmentSlider(id, min, max) {
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
                if (Math.log10(Math.abs(minVal)) < -2 && minVal !== 0) {
                    minVal = minVal.toExponential(1);
                } else {
                    minVal = minVal.toFixed(2);
                }
                if (Math.log10(Math.abs(maxVal)) < -2 && maxVal !== 0) {
                    maxVal = maxVal.toExponential(1);
                } else {
                    maxVal = maxVal.toFixed(2);
                }
                sliderMin.val(minVal);
                sliderMax.val(maxVal);
                let minPos = -8 + 150 * ui.values[0] / 100;
                let maxPos = - 8 + 150 - 150 * ui.values[1] / 100;
                sliderMin.css('left', minPos + 'px');
                sliderMax.css('right', maxPos + 'px');
            },
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
                    </div>
                );
                this.setValueAssignmentSlider(sliderId, Math.min.apply(null, this.state.minList[key]), Math.max.apply(null, this.state.maxList[key]));
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
                    display: (this.state.popover)? 'block': 'none',
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
                <div id='QBSCanvasArea'>
                    {axisSelection.x}
                    {axisSelection.y}
                    {this.controlPointPopover()}
                </div>
                <div id='QBSSketchMenuArea'>
                    {this.sketchMenu()}
                    {this.sketchOptions()}
                </div>
                {/*<label id='QBSYAxis'*/}
                       {/*style={{*/}
                           {/*fontSize: '0.8rem',*/}
                           {/*height: '30px',*/}
                           {/*width: width,*/}
                           {/*textAlign: 'center',*/}
                           {/*transform: 'rotate(-90deg) translate(' + -width / 2 + 'px, ' + (-height / 2 + 30 / 2) + 'px)',*/}
                           {/*float: 'left'}}*/}
                       {/*onClick={this.changeYAxis.bind(this)}>y</label>*/}
                {/*<canvas id='QBSSketchPad'*/}
                        {/*style={{*/}
                            {/*width: width - 30,*/}
                            {/*height: height,*/}
                            {/*float: 'right'}}></canvas>*/}
                {/*<div style={{clear: 'both'}}></div>*/}
                {/*<label id='QBSXAxis'*/}
                       {/*style={{*/}
                           {/*fontSize: '0.8rem',*/}
                           {/*width: width,*/}
                           {/*textAlign: 'center'}}*/}
                       {/*onClick={this.changeXAxis.bind(this)}>x</label>*/}
            </div>
        );
    }
}