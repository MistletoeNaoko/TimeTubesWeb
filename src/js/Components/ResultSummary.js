import React from 'react';
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
        console.log(canvas);
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

    render() {
        return (
            <div className='resultSummary'>
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
