import React from 'react';
import * as THREE from 'three';
import * as FeatureAction from '../Actions/FeatureAction';
import DataStore from '../Stores/DataStore';
import FeatureStore from '../Stores/FeatureStore';
import SelectedTimeSlice from './SelectedTimeSlice';

export default class Feature extends React.Component {
    constructor() {
        super();
        this.state = {
            visualQuery: false,
            dragSelection: true,
            selector: true,
            source: -1,
            selectedInterval: []
        };
    }

    componentWillMount() {
        FeatureStore.on('updateSelectedInterval', () => {
            this.setState({selectedInterval: FeatureStore.getSelectedInterval()});
            this.updateSelectedInterval();
        });
        FeatureStore.on('updateSource', () => {
            this.setState({source: FeatureStore.getSource()});
        });
    }

    switchVisualQuery() {
        let status = $('#switchVisualQuery').prop('checked');
        this.setState({visualQuery: status});
        FeatureAction.switchVisualQuery(status);
        this.updateSource();
    }

    switchSelector() {
        this.setState({selector: !this.state.selector});
        FeatureAction.switchSelector();
    }

    switchDragSelection() {
        this.setState({dragSelection: !this.state.dragSelection});
        FeatureAction.switchDragSelection();
    }

    resetSelection() {
        FeatureAction.resetSelection();
    }

    selectTimeInterval() {
        let val = $('#selectTimeIntervalInput').val();
        if (!isNaN(val) && val != '') {
            FeatureAction.selectTimeInterval(val);
        }
    }

    updateSource() {
        let sourceList = document.getElementById('sourceList');
        let selectedIdx = sourceList.selectedIndex;
        let selectedId = sourceList.options[selectedIdx].value; // get id
        FeatureAction.updateSource(selectedIdx);
    }

    updateTarget() {
        // console.log('updateTarget');
    }

    updateSelectedInterval() {
        let period = this.state.selectedInterval;
        $('#selectedInterval').text('JD: ' + period[0] + ' - ' + period[1]);
    }

    showSelectedTube() {
        // new react component
    }

    render() {
        let tubeNum = DataStore.getDataNum();
        let featureStatus = false;
        let visualQueryStatus = this.state.visualQuery;
        if (tubeNum > 0)
            featureStatus = true;

        const idFile = DataStore.getAllIdsFileNames();
        const sourceList = idFile.map((data) => {
            return <option value={data.id} key={data.id}>{data.name}</option>;
        });
        const targetList = idFile.map((data) => {
            return (<label className="form-check form-check-inline" htmlFor="inlineCheckbox1" key={data.id}><input className="form-check-input" type="checkbox" id={"checkboxTarget" + data.id} value={data.id} key={data.id} disabled={!visualQueryStatus}/>{data.name}</label>);
        });
        let selectedTimeSlice = null;
        if (this.state.source >= 0) {
            selectedTimeSlice = <SelectedTimeSlice sourceId={this.state.source} selectedInterval={this.state.selectedInterval}/>;
        }
        return (
            <div id='featureArea' className='controllersElem'>
                <h5>FEATURE EXTRACTION</h5>
                <div className="custom-control custom-switch featureElem">
                    <input
                        type="checkbox"
                        className="custom-control-input"
                        id="switchVisualQuery"
                        checked={visualQueryStatus}
                        disabled={!featureStatus}
                        onClick={this.switchVisualQuery.bind(this)}/>
                        <label
                            className="custom-control-label"
                            htmlFor="switchVisualQuery">
                            Visual query
                        </label>
                </div>
                <div className='featureElem'>
                    <h6>Source</h6>
                    <select
                        className="custom-select custom-select-sm"
                        id='sourceList'
                        disabled={!this.state.visualQuery}
                        onChange={this.updateSource.bind(this)}>
                        {sourceList}
                    </select>
                </div>
                <div className='featureElem'>
                    <h6>Target</h6>
                    <div id='targetList' onChange={this.updateTarget.bind(this)}>
                        {targetList}
                    </div>
                </div>
                <div className='featureElem'>
                    <h6>Selection</h6>
                    <form id='selector featureRow' onChange={this.switchSelector.bind(this)}>
                        <div className="form-check form-check-inline">
                            <input
                                type="radio"
                                name="pen"
                                value="select"
                                disabled={!visualQueryStatus}
                                checked={this.state.selector}/>
                            <label className="form-check-label" htmlFor="inlineCheckbox1">Select</label>
                        </div>
                        <div className="form-check form-check-inline">
                            <input
                                type="radio"
                                name="eraser"
                                value="Deselect"
                                disabled={!visualQueryStatus}
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
                                disabled={!visualQueryStatus}/>
                            <span style={{marginLeft: '0.3rem'}}>days</span>
                        </div>
                        <button className="btn btn-secondary btn-sm"
                                type="button"
                                id='selectTimeIntervalBtn'
                                style={{right: '0'}}
                                disabled={!visualQueryStatus}
                                onClick={this.selectTimeInterval.bind(this)} >Select</button>
                    </div>
                    <button
                        id='resetSelectionBtn'
                        className='btn btn-secondary btn-sm featureRow'
                        disabled={!visualQueryStatus}
                        onClick={this.resetSelection.bind(this)}>
                        Deselect all
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
                            disabled={!visualQueryStatus}
                            onChange={this.switchDragSelection.bind(this)}/>
                        <label
                            className="form-check-label"
                            htmlFor="inlineCheckbox1">
                            Selection by drag
                        </label>
                    </div>
                </div>
                <div className='featureElem'>
                    <h6>Selection Detail</h6>
                    <span id='selectedInterval'></span>
                    <div id='selectedIntervalViewArea'>
                        {selectedTimeSlice}
                        {/*<SelectedTimeSlice sourceId={this.state.source} selectedInterval={this.state.selectedInterval}/>*/}
                    </div>
                </div>
            </div>
        );
    }
}