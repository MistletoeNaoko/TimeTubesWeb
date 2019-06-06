import React from 'react';
import * as TimeTubesAction from '../Actions/TimeTubesAction';
import DataStore from '../Stores/DataStore';

export default class Feature extends React.Component {
    constructor() {
        super();
        this.state = {
            visualQuery: false,
            dragSelection: true,
            selector: true
        };
    }

    switchVisualQuery() {
        let status = $('#switchVisualQuery').prop('checked');
        this.setState({visualQuery: status});
        TimeTubesAction.switchVisualQuery(status);
    }

    switchSelector() {
        this.setState({selector: !this.state.selector});
        TimeTubesAction.switchSelector();
    }

    switchDragSelection() {
        let status = !this.state.dragSelection;
        this.setState({dragSelection: status});
        TimeTubesAction.switchDragSelection(status);
    }

    resetSelection() {
        TimeTubesAction.resetSelection();
    }

    selectTimeInterval() {
        let val = $('#selectTimeIntervalInput').val();
        if (!isNaN(val) && val != '') {
            TimeTubesAction.selectTimeInterval(val);
        }
    }

    render() {
        let tubeNum = DataStore.getDataNum();
        let featureStatus = false;
        if (tubeNum > 0)
            featureStatus = true;
        return (
            <div id='featureArea' className='controllersElem'>
                <h5>FEATURE EXTRACTION</h5>
                <div className="custom-control custom-switch featureElem">
                    <input
                        type="checkbox"
                        className="custom-control-input"
                        id="switchVisualQuery"
                        checked={this.state.visualQuery}
                        disabled={!featureStatus}
                        onClick={this.switchVisualQuery.bind(this)}/>
                        <label
                            className="custom-control-label"
                            htmlFor="switchVisualQuery">
                            Visual query
                        </label>
                </div>
                <div className='featureElem'>
                    <h6>Selection</h6>
                    <form id='selector featureRow' onChange={this.switchSelector.bind(this)}>
                        <div className="form-check form-check-inline">
                            <input
                                type="radio"
                                name="file_type"
                                value="select"
                                disabled={!this.state.visualQuery}
                                checked={this.state.selector}/>
                            <label className="form-check-label" htmlFor="inlineCheckbox1">Select</label>
                        </div>
                        <div className="form-check form-check-inline">
                            <input
                                type="radio"
                                name="file_type"
                                value="Deselect"
                                disabled={!this.state.visualQuery}
                                checked={!this.state.selector}/>
                            <label className="form-check-label" htmlFor="inlineCheckbox1">Deselect</label>
                        </div>
                    </form>
                    <div id='selectTimeInterval' className='form-row featureRow'>
                        <div className="input-group input-group-sm" style={{width: '10rem', marginRight: '1.5rem'}}>
                            <span style={{marginRight: '0.3rem'}}>Select</span>
                            <input
                                type="text"
                                className="form-control custom-input"
                                id='selectTimeIntervalInput'
                                disabled={!this.state.visualQuery}/>
                            <span style={{marginLeft: '0.3rem'}}>days</span>
                        </div>
                        <button className="btn btn-secondary btn-sm"
                                type="button"
                                id='selectTimeIntervalBtn'
                                style={{right: '0'}}
                                disabled={!this.state.visualQuery}
                                onClick={this.selectTimeInterval.bind(this)} >Select</button>
                    </div>
                    <button
                        id='resetSelectionBtn'
                        className='btn btn-secondary btn-sm featureRow'
                        disabled={!this.state.visualQuery}
                        onClick={this.resetSelection.bind(this)}>
                        Reset Selection
                    </button>
                </div>
                <div className='featureElem'>
                    <h6>Options</h6>
                    <div className="form-check form-check-inline">
                        <input
                            className="form-check-input"
                            type="checkbox"
                            id="checkboxDragTube"
                            value="option1"
                            checked={this.state.dragSelection}
                            disabled={!this.state.visualQuery}
                            onChange={this.switchDragSelection.bind(this)}/>
                        <label
                            className="form-check-label"
                            htmlFor="inlineCheckbox1">
                            Selection by drag
                        </label>
                    </div>
                </div>
            </div>
        );
    }
}