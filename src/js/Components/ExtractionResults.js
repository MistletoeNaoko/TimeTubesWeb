import React from 'react';

export default class ExtractionResults extends React.Component {
    constructor(props) {
        super();
    }

    updateOrder() {
        console.log('update order');
    }

    updateKValue() {
        console.log('update k value');
    }

    updateDistanceThreshold() {
        console.log('distance threshold')
    }

    orderOfResults() {
        return (
            <div
                className="form-group form-inline"
                style={{float: 'right', marginLeft: '1rem'}}
                onChange={this.updateOrder.bind(this)}>
                <label
                    className="col-form-label col-form-label-sm"
                    style={{marginRight: '0.5rem'}}>Align results by</label>
                <select className="custom-select custom-select-sm" style={{width: '7rem'}}>
                    <option value="distance">Distance</option>
                    <option value="timeStamp">Time stamp</option>
                    <option value="data">Data</option>
                </select>
            </div>
        );
    }

    distanceThreshold() {
        return (
            <div className='form-group form-inline' style={{float: 'right', marginLeft: '1rem'}}>
                <label
                    className="col-form-label col-form-label-sm"
                    style={{marginRight: '0.5rem'}}>Distance threshold</label>
                <input className="form-control form-control-sm"
                       type="text"
                       placeholder="threshold"
                       id="distanceThreshold"
                       onChange={this.updateDistanceThreshold.bind(this)}
                       style={{width: '7rem'}}/>
            </div>
        );
    }

    topKResults() {
        return (
            <div className='form-group form-inline' style={{float: 'right', marginLeft: '1rem'}}>
                <label
                    className="col-form-label col-form-label-sm"
                    style={{marginRight: '0.5rem'}}>Top k result</label>
                <input className="form-control form-control-sm"
                       type="text"
                       placeholder="k value"
                       id="topKResults"
                       onChange={this.updateKValue.bind(this)}
                       style={{width: '7rem'}}/>
            </div>
        );
    }

    render() {
        return (
            <div id='extractionResults'>
                <div style={{overflow: 'hidden'}}>
                    {this.orderOfResults()}
                    {this.distanceThreshold()}
                    {this.topKResults()}
                </div>
                <div id='mainResultArea'>
                    Results of feature extraction will be shown here
                </div>
            </div>
        );
    }
}