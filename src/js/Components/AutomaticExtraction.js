import React from 'react';

export default class AutomaticExtraction extends React.Component {
    constructor(props) {
        super();
    }

    runAutomaticExtraction() {

    }

    render() {
        return (
            <div 
                id='automaticExtractionQuerying'
                className='controllersElem'>
                <div className="custom-control custom-checkbox">
                    <input type="checkbox" className="custom-control-input" id="flareExtractionCheck"/>
                    <label className="custom-control-label" htmlFor="flareExtractionCheck">Flare</label>
                </div>
                <div id='rotationExtraction'>
                    <div className="custom-control custom-checkbox">
                        <input type="checkbox" className="custom-control-input" id="rotationExtractionCheck"/>
                        <label className="custom-control-label" htmlFor="rotationExtractionCheck">Rotation</label>
                    </div>
                    <div className='container'
                        style={{paddingRight: '0px', paddingLeft: '0px', marginBottom: '0.2rem'}}>
                        <div className="row matchingOption"> 
                            <div className='col-5'>
                                Rotation period
                            </div>
                            <div className='col form-inline'>
                                <input className="form-control form-control-sm"
                                    type="text"
                                    placeholder="min"
                                    id="rotationPeriodMin"
                                    style={{width: '20%', marginRight: '0.5rem'}}/>
                                ~
                                <input className="form-control form-control-sm"
                                    type="text"
                                    placeholder="max"
                                    id="rotationPeriodMax"
                                    style={{width: '20%', marginRight: '0.5rem', marginLeft: '0.5rem'}}/>
                                <label className="col-form-label col-form-label-sm"> days</label>
                            </div>
                        </div>
                        <div className='row matchingOption'>
                            <div className='col-5'>
                                Rotation diameter
                            </div>
                            <div className='col form-inline'>
                                <input className="form-control form-control-sm"
                                        type="text"
                                        placeholder="diameter"
                                        id="rotationDiameter"
                                        style={{width: '40%', marginRight: '0.5rem'}}/>
                            </div>
                        </div>
                        <div className='row matchingOption'>
                            <div className='col-5'>
                                Weight for average
                            </div>
                            <div className='col'>
                                <select
                                    className="custom-select custom-select-sm"
                                    id='weightForAverageList'
                                    style={{width: '40%'}}>
                                    <option value="3">σ=3</option>
                                    <option value="Manhattan">Manhattan</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="custom-control custom-checkbox">
                    <input type="checkbox" className="custom-control-input" id="anomalyExtractionCheck"/>
                    <label className="custom-control-label" htmlFor="anomalyExtractionCheck">Anomaly</label>
                </div>
                <button className="btn btn-primary btn-sm"
                        type="button"
                        id='runAutomaticExtractionBtn'
                        style={{float: 'right'}}
                        onClick={this.runAutomaticExtraction.bind(this)}>Run</button>
            </div>
        );
    }
}
