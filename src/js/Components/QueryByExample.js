import React from 'react';
import * as FeatureAction from '../Actions/FeatureAction';
import DataStore from '../Stores/DataStore';
import { func } from 'prop-types';

export default class QueryByExample extends React.Component {
    constructor(props) {
        super();
        this.state = {
            dragSelection: true,
            selector: true,
        };
    }

    extractionSource() {
        let idFile = DataStore.getAllIdsFileNames();
        let sourceList = idFile.map((data) => {
            return <option value={data.id} key={data.id}>{data.name}</option>;
        });
        sourceList.unshift(<option value='default' key='default'>Select a source</option>)
        return (
            <div className='featureElem'>
                <h5>Source</h5>
                <select
                    className="custom-select custom-select-sm"
                    id='sourceList'
                    style={{width: '40%'}}
                    onChange={this.updateSource.bind(this)}>
                    {sourceList}
                </select>
            </div>
        );
    }

    updateSource() {
        let sourceList = document.getElementById('sourceList');
        let selectedIdx = sourceList.selectedIndex;
        let selectedId = sourceList.options[selectedIdx].value; // get id
        FeatureAction.updateSource(selectedId);
    }

    QBESelector() {
        return (
            <div className='featureElem'>
                <h5>Selection</h5>
                <div className="form-check">
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
                <form className="form-check form-check-inline selector featureRow"
                      id='QBESelector' onChange={this.switchSelector.bind(this)}>
                    <img
                        id='QBESelect'
                        className='selectorIcon selected'
                        name='QBESelector'
                        value='Select'
                        src='img/icons/pen.png'
                        alt='pen'
                        width='30'
                        height='30'
                        title='select a part of the tube'
                        onClick={this.selectSelect.bind(this)} readOnly/>
                    <img
                        id='QBEDeselect'
                        className='selectorIcon'
                        name='QBESelector'
                        value='Deselect'
                        src='img/icons/eraser.png'
                        alt='eraser'
                        width='30'
                        height='30'
                        title='deselect a part of the tube'
                        onClick={this.selectDeselect.bind(this)} readOnly/>
                        
                    {/* <div className="custom-control custom-radio">
                        <input
                            type="radio"
                            id='QBESelect'
                            name="QBESelector"
                            className="custom-control-input"
                            value="Select"
                            checked={this.state.selector} readOnly/>
                        <label className="custom-control-label" htmlFor="QBESelect">Select</label>
                    </div>
                    <div
                        className="custom-control custom-radio"
                        style={{marginLeft: '0.5rem'}}>
                        <input
                            type="radio"
                            id='QBEDeselect'
                            name="QBESelector"
                            className="custom-control-input"
                            value="Deselect"
                            checked={!this.state.selector} readOnly/>
                        <label className="custom-control-label" htmlFor="QBEDeselect">Deselect</label>
                    </div> */}
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
            </div>
        );
    }

    switchSelector() {
        this.setState({selector: !this.state.selector});
        FeatureAction.switchSelector();
    }

    selectSelect() {
        this.setState({
            selector: true
        });
        $('img[name=QBESelector]').each(function() {
            $(this).removeClass('selected');
        });
        $('#QBESelect').addClass('selected');
    }

    selectDeselect() {
        this.setState({
            selector: false
        });
        $('img[name=QBESelector]').each(function() {
            $(this).removeClass('selected');
        });
        $('#QBEDeselect').addClass('selected');
    }

    selectTimeInterval() {
        let val = $('#selectTimeIntervalInput').val();
        if (!isNaN(val) && val != '') {
            FeatureAction.selectTimeInterval(val);
        }
    }

    switchDragSelection() {
        this.setState({dragSelection: !this.state.dragSelection});
        FeatureAction.switchDragSelection();
    }

    resetSelection() {
        FeatureAction.resetSelection();
    }

    render() {
        return (
            <div id='QBEQuerying'>
                {this.extractionSource()}
                {this.QBESelector()}
            </div>
        );
    }
}
