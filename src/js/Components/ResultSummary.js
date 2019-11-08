import React from 'react';
import * as domActions from '../lib/domActions';
import {formatValue} from '../lib/2DGraphLib';
import * as FeatureAction from '../Actions/FeatureAction';
import FeatureStore from '../Stores/FeatureStore';
import DataStore from '../Stores/DataStore';

export default class ResultSummary extends React.Component {
    constructor(props) {
        super();
        this.id = props.id;
        this.fileName = DataStore.getFileName(this.id);
        this.thumbnail = props.thumbnail;
        this.period = props.period;
        this.distance = props.distance;
        this.rank = props.rank;
        this.path = props.path;
        this.ignored = FeatureStore.getIgnored();
        this.lookup = DataStore.getData(this.id).data.lookup;
        this.variables = [];
        // relative position on the result summary panel
        this.clickedX = null;
        this.clickedY = null;
        // flag to identify whether the action is click or mousedown
        this.moved = false;
        for (let key in this.lookup) {
            if (this.ignored.indexOf(key) < 0 && key !== 'z') {
                this.variables.push(key);
            }
        }
    }

    componentDidMount() {
        // append image to the imageHolder
        let canvas = document.getElementById('resultSummaryCanvas_' + this.rank);
        let ctx = canvas.getContext('2d');
        let size = Math.min(this.thumbnail.height, this.thumbnail.width);
        let px = this.thumbnail.width / 2 - size / 2,
            py = this.thumbnail.height / 2 - size / 2;
        this.thumbnail.onload = function() {
            ctx.drawImage(
                this.thumbnail,
                px, py,
                size, size,
                0, 0,
                300, 150);// why 300? the width of canvas seems to be 300px
        }.bind(this);

        document.getElementById('resultSummary_' + this.rank).addEventListener('mousedown', this.onMouseDownOnResultSummary.bind(this), false);
    }

    showFileName() {
        return (
            <label>
                {this.fileName}
            </label>
        );
    }

    showThumbnail() {
        return (
            <canvas
                id={'resultSummaryCanvas_' + this.rank}
                className='resultSummaryCanvas'>
            </canvas>
        );
    }

    showPeriod() {
        return (
            <div className='row'>
                <div className='col4'>
                    <label>Period</label>
                </div>
                <div className='col'>
                    {this.period[0]} - {this.period[1]}
                </div>
            </div>
        );
    }

    showDistance() {
        return (
            <div className='row'>
                <div className='col4'>
                    <label>Distance</label>
                </div>
                <div className='col'>
                    {formatValue(this.distance)}
                </div>
            </div>
        );
    }

    showDetails() {
        if ($('#resultDetailArea').css('display') === 'none') {
            domActions.toggleExtractionDetailPanel();
        }
        let canvas = document.getElementById('detailThumbnailCanvas');
        let size = $('#extractionDetailThumbnail').width();
        $('#detailThumbnailCanvas').width(size);
        $('#detailThumbnailCanvas').height(size);
        let ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, size, size);
        let square = Math.min(this.thumbnail.height, this.thumbnail.width);
        let px = this.thumbnail.width / 2 - square / 2,
            py = this.thumbnail.height / 2 - square / 2;
        // TODO: the size of the image is converted into 300 * 150
        ctx.drawImage(
            this.thumbnail,
            px, py,
            square, square,
            0, 0,
            300, 150
        );
        $('#extractionDetailPeriodValue').text(this.period[0] + ' - ' + this.period[1]);
        $('#extractionDetailLengthValue').text((this.period[1] - this.period[0]) + ' days');
        $('#extractionDetailDistanceValue').text(formatValue(this.distance));
        let ignoredList = '';
        for (let i = 0; i < this.variables.length; i++) {
            ignoredList += this.lookup[this.variables[i]] + ', ';
        }
        ignoredList = ignoredList.slice(0, ignoredList.length - 2);
        $('#extractionDetailVariableValue').text(ignoredList);
        $('#extractionDetailLC').height(size);

        // set up a line chart for comparison between query and time slice
        let width = $('#extractionDetailLC').width();
        let height = 200;
        FeatureAction.updateSelectedResult(this.id, this.period, width, height, this.path);
    }

    onMouseDownOnResultSummary(event) {
        this.moved = false;
        let elem = document.getElementById('resultSummary_' + this.rank);
        elem.classList.add('drag');
    
        this.clickedX = event.pageX - elem.offsetLeft;
        this.clickedY = event.pageY - elem.offsetTop;
        // elem.style.position = 'absolute';
    
        document.body.addEventListener('mousemove', this.onMouseMoveOnResultSummary.bind(this), false);
        document.body.addEventListener('mouseleave', this.onMouseUpFromResultSummary.bind(this), false);
        elem.addEventListener('mouseup', this.onMouseUpFromResultSummary.bind(this), false);
    }
    
    onMouseMoveOnResultSummary(event) {
        this.moved = true;
        let drag = document.getElementsByClassName('drag')[0];
        if (drag) {
            drag.style.position = 'absolute';
            event.preventDefault();
    
            drag.style.top = event.pageY - this.clickedY + 'px';
            drag.style.left = event.pageX - this.clickedX + 'px';


            let mode = FeatureStore.getMode();
            switch (mode) {
                case 'AE':
                    // do nothing
                    break;
                case 'QBE':
                    let selectedTimeSlice = $('#selectedTimeSliceView');
                    let selectedTimeSlicePos = selectedTimeSlice.offset(),
                        selectedTimeSliceWidth = selectedTimeSlice.width(),
                        selectedTimeSliceHeight = selectedTimeSlice.height();
                    
                    if ((selectedTimeSlicePos.left <= event.pageX && event.pageX <= selectedTimeSlicePos.left + selectedTimeSliceWidth)
                    && (selectedTimeSlicePos.top <= event.pageY && event.pageY <= selectedTimeSlicePos.top + selectedTimeSliceHeight)) {
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

                    if ((sketchPadPos.left <= event.pageX && event.pageX <= sketchPadPos.left + sketchPadWidth)
                    && (sketchPadPos.top <= event.pageY && event.pageY <= sketchPadPos.top + sketchPadHeight)) {
                        let overlayPanel = $('#QBSCanvasArea > .overlayHidingPanel');
                        overlayPanel.css('display', 'block');
                        overlayPanel.css('width', Math.min(sketchPadWidth, sketchPadHeight));
                        overlayPanel.css('height', Math.min(sketchPadWidth, sketchPadHeight));
                    }
                    break;
            }

        }
    }
    
    onMouseUpFromResultSummary(event) {
        document.body.removeEventListener('mousemove', this.onMouseMoveOnResultSummary.bind(this), false);

        let drag = document.getElementsByClassName('drag')[0];
        if (drag) {
            drag.removeEventListener('mouseup', this.onMouseUpFromResultSummary.bind(this), false);
            drag.classList.remove('drag');
            drag.style.position = 'static';
        }

        if (this.moved) {
            let mode = FeatureStore.getMode();
            // judge whether the result summary panel is on the selectedTimeSlice view/sketch pad
            // if not, move it to the original position and change the position style to static
            switch (mode) {
                case 'AE':
                    drag.style.position = 'static';
                    // TODO: show alert
                    break;
                case 'QBE':
                    $('#selectedTimeSliceView > .overlayHidingPanel').css('display', 'none');
                    let selectedTimeSlice = $('#selectedTimeSliceView');
                    let selectedTimeSlicePos = selectedTimeSlice.offset(),
                        selectedTimeSliceWidth = selectedTimeSlice.width(),
                        selectedTimeSliceHeight = selectedTimeSlice.height();
                    
                    if ((selectedTimeSlicePos.left <= event.pageX && event.pageX <= selectedTimeSlicePos.left + selectedTimeSliceWidth)
                    && (selectedTimeSlicePos.top <= event.pageY && event.pageY <= selectedTimeSlicePos.top + selectedTimeSliceHeight)) {
                        console.log('summary panel is now inside the QBE area');
                        // convert the result into a new query
                        FeatureAction.convertResultIntoQuery(this.id, this.period, this.ignored);
                    }
                    break;
                case 'QBS':
                    $('#QBSCanvasArea > .overlayHidingPanel').css('display', 'none');
                    let sketchPad = $('#QBSSketchPad');
                    let sketchPadPos = sketchPad.offset(),
                        sketchPadWidth = sketchPad.width(),
                        sketchPadHeight = sketchPad.innerHeight();

                    if ((sketchPadPos.left <= event.pageX && event.pageX <= sketchPadPos.left + sketchPadWidth)
                    && (sketchPadPos.top <= event.pageY && event.pageY <= sketchPadPos.top + sketchPadHeight)) {
                        console.log('summary panel is now inside the QBS area');
                        // convert the result into a new query
                    }
                    break;
            }
            // move it to the original position
            this.moveToOriginalPos();
        } else {
            this.showDetails();
        }
    }

    moveToOriginalPos() {
        let nextResult = $('#resultSummary_' + (this.rank + 1));
        if (nextResult) {
            nextResult.insertBefore($('#resultSummary_' + this.rank));
        } else {
            let previousResult = $('#resultSummary_' + (this.rank - 1));
            previousResult.insertAfter($('#resultSummary_' + this.rank));
        }
    }
    

    render() {
        return (
            <div 
                className='resultSummary'
                id={'resultSummary_' + this.rank}>
                {this.showFileName()}
                {this.showThumbnail()}
                <div
                    className='container'
                    style={{paddingLeft: '0px', paddingRight: '0px'}}>
                    {this.showPeriod()}
                    {this.showDistance()}
                </div>
            </div>
        );
    }
}
