import React from 'react';
import * as THREE from 'three';
import * as FeatureAction from '../Actions/FeatureAction';
import DataStore from '../Stores/DataStore';
import FeatureStore from '../Stores/FeatureStore';
import SelectedTimeSlice from './SelectedTimeSlice';
import QueryBySketch from './QueryBySketch';

export default class VisualQuery extends React.Component {
    constructor() {
        super();
        this.state = {
            visualQuery: false,
            dragSelection: true,
            queryMode: FeatureStore.getMode(),
            QBESource: 'SP',
            selector: true,
            source: -1,
            selectedInterval: []
        };
    }

    componentWillMount() {
        FeatureStore.on('updateSelectedTimeSlice', () => {
            this.setState({
                selectedInterval: FeatureStore.getSelectedInterval()
            });
            this.updateSelectedInterval();
        });
        FeatureStore.on('updateSource', () => {
            this.setState({
                source: FeatureStore.getSource()
            });
        });
        FeatureStore.on('switchQueryMode', (mode) => {
            this.setState({
                queryMode: mode
            });
        });
        FeatureStore.on('updateSelectedPeriod', () => {
            // this.selectedInterval = FeatureStore.getSelectedPeriod();
            this.updateSelectedInterval();
        });
    }

    switchSelector() {
        this.setState({selector: !this.state.selector});
        FeatureAction.switchSelector();
    }

    switchDragSelection() {
        this.setState({dragSelection: !this.state.dragSelection});
        FeatureAction.switchDragSelection();
    }

    switchQueryMode(obj) {
        let selectedQueryMode = $('input[name=queryMode]:checked').val();
        FeatureAction.switchQueryMode(selectedQueryMode);
    }

    switchQBESource() {
        let source = '';
        if (this.state.QBESource === 'SP') {
            source = 'TT';
        } else if (this.state.QBESource === 'TT') {
            source = 'SP';
        }
        this.setState({
            QBESource: source
        });
    }

    resetSelection() {
        FeatureAction.resetSelection();
    }

    selectTimeInterval() {
        let val = $('#selectTimeIntervalInput').val();
        if (!isNaN(val) && val != '') {
            FeatureAction.selectTimeInterval(this.state.source, val);
        }
    }

    updateSource() {
        let sourceList = document.getElementById('sourceList');
        let selectedIdx = sourceList.selectedIndex;
        let selectedId = sourceList.options[selectedIdx].value; // get id
        FeatureAction.updateSource(selectedId);
    }

    updateTarget() {
        // console.log('updateTarget');
    }

    updateSelectedInterval() {
        let period = FeatureStore.getSelectedPeriod();
        this.setState({
            selectedInterval: period
        });
        $('#selectedInterval').text('JD: ' + period[0] + ' - ' + period[1]);
    }

    showSelectedTube() {
        // new react component
    }

    updateIgnoredVariables() {
        let checked = $('input[name=QBEIgnored]:checked');
        let ignored = [];
        for (let i = 0; i < checked.length; i++) {
            ignored.push(checked[i].value);
        }
        FeatureAction.setIgnoredVariables(ignored);
    }

    extractionSource() {
        let idFile = DataStore.getAllIdsFileNames();
        let sourceList = idFile.map((data) => {
            return <option value={data.id} key={data.id}>{data.name}</option>;
        });
        sourceList.unshift(<option value='default' key='default'>Select a source of the visual query</option>)
        return (
            <div className='featureElem'
                 style={{display: (this.state.queryMode === 'QBE') ? 'block': 'none'}}>
                <h5>Source</h5>
                <select
                    className="custom-select custom-select-sm"
                    id='sourceList'
                    onChange={this.updateSource.bind(this)}>
                        {sourceList}
                </select>
            </div>
        );
    }

    queryModes() {
        return (
            <div className='featureElem'>
                <h5>Query mode</h5>
                <form id='queryMode' onChange={this.switchQueryMode.bind(this)}>
                    <div className="form-check form-check-inline">
                        <input
                            type="radio"
                            name="queryMode"
                            value="QBE"
                            checked={this.state.queryMode === 'QBE'} readOnly/>
                        <label className="form-check-label" htmlFor="QBE">Query-by-example</label>
                    </div>
                    <div className="form-check form-check-inline">
                        <input
                            type="radio"
                            name="queryMode"
                            value="QBS"
                            checked={this.state.queryMode === 'QBS'} readOnly/>
                        <label className="form-check-label" htmlFor="QBS">Query-by-sketch</label>
                    </div>
                </form>
            </div>
        );
    }

    QBESelection() {
        let items = [];
        if (this.state.source >= 0) {
            let lookup = DataStore.getData(Number(this.state.source)).data.lookup;
            for (let key in lookup) {
                let label = '';
                if (lookup[key].length > 1) {
                    label = lookup[key].join(',');
                } else {
                    label = lookup[key];
                }
                if (key !== 'z') {
                    items.push(
                        <div className="form-check"
                             key={key}>
                            <input
                                className="form-check-input"
                                type="checkbox"
                                name='QBEIgnored'
                                value={key}
                                id={"QBEIgnored_" + key}
                            />
                                <label
                                    className="form-check-label"
                                    htmlFor={"QBEIgnored_" + key}>
                                    {label}
                                </label>
                        </div>
                    );
                }
            }
        }
        return (
            <div className='featureElem'>
                <h5>Selection</h5>
                <form className='selector featureRow' onChange={this.switchSelector.bind(this)}>
                    <div className="form-check form-check-inline">
                        <input
                            type="radio"
                            name="selector"
                            value="select"
                            checked={this.state.selector} readOnly/>
                        <label className="form-check-label" htmlFor="pen">Select</label>
                    </div>
                    <div className="form-check form-check-inline">
                        <input
                            type="radio"
                            name="selector"
                            value="Deselect"
                            checked={!this.state.selector} readOnly/>
                        <label className="form-check-label" htmlFor="eraser">Deselect</label>
                    </div>
                </form>
                <div id='selectTimeInterval' className='form-row featureRow'>
                    <div className="input-group input-group-sm" style={{width: '10rem', marginRight: '1.5rem'}}>
                        <span style={{marginRight: '0.3rem'}}>Select</span>
                        <input
                            type="text"
                            className="form-control custom-input"
                            id='selectTimeIntervalInput'/>
                        <span style={{marginLeft: '0.3rem'}}>days</span>
                    </div>
                    <button className="btn btn-primary btn-sm"
                            type="button"
                            id='selectTimeIntervalBtn'
                            style={{right: '0'}}
                            onClick={this.selectTimeInterval.bind(this)} >Select</button>
                </div>
                <button
                    id='resetSelectionBtn'
                    className='btn btn-primary btn-sm featureRow'
                    onClick={this.resetSelection.bind(this)}>
                    Deselect all
                </button>
                <h6>Options</h6>
                <div className="form-check form-check-inline">
                    <input
                        className="form-check-input"
                        type="checkbox"
                        id="checkboxDragTube"
                        value="option1"
                        checked={this.state.dragSelection}
                        onChange={this.switchDragSelection.bind(this)}/>
                    <label
                        className="form-check-label"
                        htmlFor="inlineCheckbox1">
                        Selection by drag
                    </label>
                </div>
                <h6>Ignored variables</h6>
                <form id='QBEIgnoredVariables' onChange={this.updateIgnoredVariables.bind(this)}>
                    {items}
                </form>
            </div>
        );
    }

    QBSSelection() {
        let lookupList = [];
        let dataList = DataStore.getAllData();
        dataList.forEach(function (e) {
           lookupList.push(e.data.lookup);
        });
        return (
            <div className='featureElem' id='QBSArea'>
                <QueryBySketch
                    id={this.state.source}
                    xItem={'z'}
                    yItem={'V'}
                    lookup={lookupList}/>
            </div>
        );
    }

    selectionDetail() {
        let selectedTimeSlice;
        // when the mode is QBS, selectedTimeSlice view is not needed to be shown
        if (this.state.source >= 0 && this.state.queryMode === 'QBE') {
            selectedTimeSlice = <SelectedTimeSlice sourceId={this.state.source}/>;
        }
        let selectionDetail;
        if (this.state.queryMode === 'QBE') {
            selectionDetail = (
                <div className='featureElem' style={{position: 'relative'}}>
                    <h5>Selection Detail</h5>
                    <span id='selectedInterval'></span>
                    <div id='selectedIntervalViewArea'>
                        {selectedTimeSlice}
                    </div>
                </div>
            );
        }
        return selectionDetail;
    }

    render() {
        let queryDefinition;
        if (this.state.queryMode === 'QBE') {
            queryDefinition = this.QBESelection();
        } else if (this.state.queryMode === 'QBS') {
            queryDefinition = this.QBSSelection();
        }

        return (
            <div id='featureArea' className='controllersElem'>
                {this.queryModes()}
                {this.extractionSource()}
                {queryDefinition}
                {this.selectionDetail()}
            </div>
        );
    }
}