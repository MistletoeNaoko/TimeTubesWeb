import React from 'react';
import * as domActions from '../lib/domActions';
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
    }

    componentDidMount() {
        // append image to the imageHolder
        let canvas = document.getElementById('resultSummary_' + this.rank);
        let ctx = canvas.getContext('2d');
        let size = Math.min(this.thumbnail.height, this.thumbnail.width);
        let px = this.thumbnail.width / 2 - size / 2,
            py = this.thumbnail.height / 2 - size / 2;
        ctx.drawImage(
            this.thumbnail,
            px, py,
            size, size,
            0, 0,
            300, 150);// why 300? the width of canvas seems to be 300px
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
                id={'resultSummary_' + this.rank}
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
                    {this.distance.toFixed(3)}
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
        $('#extractionDetailDistanceValue').text(this.distance.toFixed(3));
        let ignored = FeatureStore.getIgnored();
        let lookup = DataStore.getData(this.id).data.lookup;
        let ignoredList = '';
        for (let key in lookup) {
            if (ignored.indexOf(key) < 0 && key !== 'z') {
                ignoredList += lookup[key] + ', ';
            }
        }
        ignoredList = ignoredList.slice(0, ignoredList.length - 2);
        $('#extractionDetailVariableValue').text(ignoredList);
        $('#extractionDetailLC').height(size);

        // set up a line chart for comparison between query and time slice
        let width = $('#extractionDetailLC').width();
        let height = 200;
        FeatureAction.updateSelectedResult(this.id, this.period, width, height);
    }

    render() {
        return (
            <div className='resultSummary' onClick={this.showDetails.bind(this)}>
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
