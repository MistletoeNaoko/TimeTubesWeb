import React from 'react';
import * as TimeTubesAction from '../Actions/TimeTubesAction';
import * as DataAction from '../Actions/DataAction';
import TimeTubesStore from '../Stores/TimeTubesStore';
import DataStore from '../Stores/DataStore';

export default class Controllers extends React.Component{
    constructor() {
        super();
        this.state = {
            data: DataStore.getAllData(),
            grid: true,
            label: true,
            axis: true,
            plot: true,
            clip: true,
            shade: true
        }
    }

    componentWillMount() {
        DataStore.on('upload', () => {
            this.setState({
                data: DataStore.getAllData()
            });
        });
    }

    resetCamera() {
        let checked = this.getSelectedIDs();
        checked.forEach(function (value) {
            TimeTubesAction.resetCamera(value);
        });
    }

    switchCamera() {
        let checked = this.getSelectedIDs();
        checked.forEach(function (value) {
            TimeTubesAction.switchCamera(value);
        });
    }

    uploadFile() {
        let file = document.querySelector('input[type=file]').files;
        DataAction.uploadData(file);
    }

    searchTime() {
        let dst = document.getElementById('searchTimeForm').value;
        let checked = this.getSelectedIDs();
        checked.forEach(function (value) {
            TimeTubesAction.searchTime(value, Number(dst));
        });
    }

    switchGridDisplay() {
        let state = !this.state.grid;
        this.setState({
            grid: state
        });
        let checked = this.getSelectedIDs();
        checked.forEach(function (value) {
            TimeTubesAction.switchGridDisplay(value, state);
        });
    }

    switchLabelDisplay() {
        let state = !this.state.label;
        this.setState({
            label: state
        });
        let checked = this.getSelectedIDs();
        checked.forEach(function (value) {
            TimeTubesAction.switchLabelDisplay(value, state);
        });
    }

    switchAxisDisplay() {
        let state = !this.state.axis;
        this.setState({
            axis: state
        });
        let checked = this.getSelectedIDs();
        checked.forEach(function (value) {
            TimeTubesAction.switchAxisDisplay(value, state);
        });
    }

    switchPlotDisplay() {
        let state = !this.state.plot;
        this.setState({
            plot: state
        });
        let checked = this.getSelectedIDs();
        checked.forEach(function (value) {
            TimeTubesAction.switchPlotDisplay(value, state);
        });
    }

    changeBackground(){
        let backgroundList = document.getElementById('backgroundList');
        let selectedIdx = backgroundList.selectedIndex;
        let selectedCol = backgroundList.options[selectedIdx].value;
        let checked = this.getSelectedIDs();
        checked.forEach(function (value) {
            TimeTubesAction.changeBackground(value, selectedCol);
        });
    }

    clipTube() {
        let state = !this.state.clip;
        this.setState({
            clip: state
        });
        let checked = this.getSelectedIDs();
        checked.forEach(function (value) {
           TimeTubesAction.clipTube(value, state);
        });
    }

    switchShade() {
        let state = !this.state.shade;
        this.setState({
            shade: state
        });
        let checked = this.getSelectedIDs();
        checked.forEach(function (value) {
            TimeTubesAction.switchShade(value, state);
        });
    }

    mergeTubes() {
        let checked = this.getSelectedIDs();
        DataAction.mergeData(checked);
    }

    // changeFar() {
    //     let checked = this.getSelectedIDs();
    //     checked.forEach(function (value) {
    //         // TimeTubesAction
    //     })
    // }

    clickClose() {
        let state = document.getElementById('closeFilePanel').innerText;
        $('#fileMainArea').slideToggle();
        if (state.match('Close')) {
            document.getElementById('closeFilePanel').innerText = 'Open the file input panel';
        } else {
            document.getElementById('closeFilePanel').innerText = 'Close the file input panel';
        }
    }

    clickSub() {
        let current = Number($('#initialLineVal').text());
        if (current > 0) {
            $('#initialLineVal').text(current - 1);
        }
    }

    clickAdd() {
        let current = Number($('#initialLineVal').text());
        $('#initialLineVal').text(current + 1);
    }

    getSelectedIDs() {
        let checkedList = TimeTubesStore.getCheckedList();

        let checkedIDs = [];
        checkedList.forEach(function (value, i) {
            if (value) {
                checkedIDs.push(i);
            }
        })
        return checkedIDs;
    }


    render() {
        // ToDo: render will be run before componentWillMount,
        //  so a warning 'Warning: Controllers is changing an uncontrolled input of type checkbox to be controlled.' will occur
        //  because the program calls this.state.checked[i] before it's assigned.
        //  This will not affect to the program.
        // ToDo: codes are too long, too confusing
        return (
            <div >
                <div id='inputFile' className='controllersElem'>
                    <h5>FILE</h5>
                    <div id="fileMainArea">
                        <h6>File type</h6>
                        <form id="file_type">
                            <div className="form-check form-check-inline">
                                <input type="radio" name="file_type" value="csv" checked />
                                    <label className="form-check-label" htmlFor="inlineCheckbox1">csv</label>
                            </div>
                            <div className="form-check form-check-inline">
                                <input type="radio" name="file_type" value="tsv"/>
                                    <label className="form-check-label" htmlFor="inlineCheckbox1">tsv</label>
                            </div>
                            <div className="form-check form-check-inline">
                                <input type="radio" name="file_type" value="space"/>
                                    <label className="form-check-label" htmlFor="inlineCheckbox1">space</label>
                            </div>
                        </form>
                        <h6>Initial line of the data (exclude headers)</h6>
                        <div className="form-row" id="initialLineField" style={{display: 'flex', justifyContent: 'center'}}>
                            <button
                                type="button"
                                id="sub"
                                className="sub btn btn-secondary  btn-sm"
                                style={{textAlign: 'center'}}
                                onClick={this.clickSub.bind(this)}>
                                -
                            </button>
                            <label
                                id="initialLineVal"
                                style={{textAlign: 'center', width: '30px'}}>
                                2
                            </label>
                            <button
                                type="button"
                                id="add"
                                className="add btn btn-secondary  btn-sm"
                                style={{textAlign: 'center'}}
                                onClick={this.clickAdd.bind(this)}>
                                +
                            </button>
                        </div>
                        <h6>Select files</h6>
                        <div className="custom-file">
                            <input type='file' className="custom-file-input" id='uploadFileForm' onChange={this.uploadFile.bind(this)} multiple/>
                            <label className="custom-file-label" htmlFor="customFile"></label>
                        </div>
                    </div>
                </div>
                <div
                    className="closePanel"
                    id="closeFilePanel"
                    style={{textAlign: 'center'}}
                    onClick={this.clickClose.bind(this)}>Close the file input panel</div>
                <div id='cameraControllers' className='controllersElem'>
                    <h5>CAMERA</h5>
                    <button
                        id='resetCameraBtn'
                        className='btn btn-secondary btn-sm'
                        onClick={this.resetCamera.bind(this)}>
                        Reset
                    </button>
                    <button
                        id='switchCameraBtn'
                        className='btn btn-secondary btn-sm'
                        onClick={this.switchCamera.bind(this)}>
                        Switch
                    </button>
                    <div style={{clear:'both'}}></div>
                </div>
                <div id='displayControllers' className='controllersElem'>
                    <h5>DISPLAY</h5>
                    <div className="form-check form-check-inline">
                        <input
                            className="form-check-input"
                            type="checkbox"
                            id="checkboxGrid"
                            value="option1"
                            checked={this.state.grid}
                            onChange={this.switchGridDisplay.bind(this)}/>
                            <label
                                className="form-check-label"
                                htmlFor="inlineCheckbox1">
                                Grid
                            </label>
                    </div>
                    <div className="form-check form-check-inline">
                        <input
                            className="form-check-input"
                            type="checkbox"
                            id="checkboxLabel"
                            value="option1"
                            checked={this.state.label}
                            onChange={this.switchLabelDisplay.bind(this)}/>
                            <label
                                className="form-check-label"
                                htmlFor="inlineCheckbox1">
                                Label
                            </label>
                    </div>
                    <div className="form-check form-check-inline">
                        <input
                            className="form-check-input"
                            type="checkbox"
                            id="checkboxAxis"
                            value="option1"
                            checked={this.state.axis}
                            onChange={this.switchAxisDisplay.bind(this)}/>
                            <label
                                className="form-check-label"
                                htmlFor="inlineCheckbox1">
                                Axis
                            </label>
                    </div>
                    <div className="form-check form-check-inline">
                        <input
                            className="form-check-input"
                            type="checkbox"
                            id="checkboxPlot"
                            value="option1"
                            checked={this.state.plot}
                            onChange={this.switchPlotDisplay.bind(this)}/>
                            <label
                                className="form-check-label"
                                htmlFor="inlineCheckbox1">
                                Plot
                            </label>
                    </div>
                    <select
                        className="form-control"
                        id='backgroundList'
                        onChange={this.changeBackground.bind(this)}
                        style={{fontSize: '0.8rem'}}>
                        <option value='0x000000'>Black</option>
                        <option value='0x3f3f3f'>Gray 75</option>
                        <option value='0x7f7f7f'>Gray 50</option>
                        <option value='0xbfbfbf'>Gray 25</option>
                        <option value='0xffffff'>White</option>
                        <option value='0x191970'>Navy</option>
                    </select>
                </div>
                <div id='tubeControllers' className='controllersElem'>
                    <h5>TIMETUBES</h5>
                    <div className="form-check form-check-inline">
                        <input
                            className="form-check-input"
                            type="checkbox"
                            id="checkboxClip"
                            value="option1"
                            checked={this.state.clip}
                            onChange={this.clipTube.bind(this)}/>
                            <label
                                className="form-check-label"
                                htmlFor="inlineCheckbox1">
                                Clip
                            </label>
                    </div>
                    <div className="form-check form-check-inline">
                        <input
                            className="form-check-input"
                            type="checkbox"
                            id="checkboxShade"
                            value="option1"
                            checked={this.state.shade}
                            onChange={this.switchShade.bind(this)}/>
                            <label
                                className="form-check-label"
                                htmlFor="inlineCheckbox1">
                                Shade
                            </label>
                    </div>
                    <br/>
                    <button
                        id='mergeBtn'
                        className='btn btn-secondary btn-sm'
                        onClick={this.mergeTubes.bind(this)}>
                        Merge
                    </button>
                </div>
            </div>
        );
    }
}