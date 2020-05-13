import React from 'react';
import * as TimeTubesAction from '../Actions/TimeTubesAction';
import * as DataAction from '../Actions/DataAction';
import TimeTubesStore from '../Stores/TimeTubesStore';
import DataStore from '../Stores/DataStore';
import TimeTubes from './TimeTubes';

export default class Controllers extends React.Component{
    constructor() {
        super();
        this.state = {
            fileType: 'csv',
            grid: true,
            label: true,
            axis: true,
            plot: true,
            comment: true,
            clip: true,
            shade: true,
            lock: false,
            multiOptions: false
        }
    }

    componentDidMount() {
        this.setAverageSlider();

        DataStore.on('upload', () => {
            if (DataStore.getAllData().length > 1) {
                this.setState({
                    multiOptions: true
                });
            }
            $('#fileInputPanel').css('visibility', 'hidden');
        });
    }

    setAverageSlider() {
        let val = $('#averageSliderVal');
        $('#averageSlider').slider({
            range: 'min',
            value: 0,
            min: 0,
            max: 200,
            slide: function(event, ui) {
                val.css('display', 'initial');
                val.val(ui.value + ' days');
                let min = $('#averageSlider').slider('option', 'min');
                let range = $('#averageSlider').slider('option', 'max') - min;
                let pos = -10 + $('#averageSlider').width() * (ui.value - min) / range;

                val.css('left', pos + 'px');

                TimeTubesAction.updateAveragePeriod(ui.value);
            }, 
            stop: function() {
                val.css('display', 'none');
            }
        });
    }

    changeFileType() {
        let fileType = $('input[name=fileType]:checked').val();
        this.setState({
            fileType: fileType
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
        let file = document.getElementById('uploadFileForm').files;
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

    switchCommentDisplay() {
        let state = !this.state.comment;
        this.setState({
            comment: state
        });
        let checked = this.getSelectedIDs();
        checked.forEach(function (value) {
            TimeTubesAction.switchComment(value, state);
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

    selectAllViews() {
        let currentMode = $('#selectAllViews').text();
        let checkboxes = $('input[name=selectView]');
        if (currentMode === 'Select All') {
            checkboxes.prop('checked', true);
            $('#selectAllViews').text('Deselect All');
        } else if (currentMode === 'Deselect All') {
            checkboxes.prop('checked', false);
            $('#selectAllViews').text('Select All');
        }
    }

    timeFitting() {
        // move all checked TimeTubes to the observation time of the active window
        // JD_Current<JD_Min：to JD_Min
        // JD_Max<JD_Current：to JD_Max
        // pass dstJD to Action. Each TimeTubes view think about how much I should move
        if(this.state.multiOptions) {
            let activeId = TimeTubesStore.getActiveId();
            let currentJD = TimeTubesStore.getFocused(activeId);
            let currentData = DataStore.getData(activeId);
            TimeTubesAction.timeFitting(currentJD + currentData.data.spatial[0].z);
        }
    }

    mergeTubes() {
        if (this.state.multiOptions) {
            let checked = this.getSelectedIDs();
            DataAction.mergeData(checked);
        }
    }

    lockControl() {
        if (this.state.multiOptions) {
            let state = !this.state.lock;
            this.setState({
                lock: state
            });
            let checked = this.getSelectedIDs();
            TimeTubesAction.lockControl(checked, state);
        }
    }

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

    basicMenu() {
        return (
            <ul className="navbar-nav" id='basicMenu'>
                <li className="nav-item dropdown">
                    <label
                        className="nav-link menuLabel"
                        href="#"
                        id='controllersFileDropdown'
                        role='button'
                        onClick={this.showFileInputPanel.bind(this)}>File</label>
                    <div className="input-group input-group-sm dropdownonTubeMenu"
                         style={{visibility: 'hidden', position: 'absolute', top: '2rem', width: 'auto', zIndex:'100'}}
                         id='fileInputPanel'>
                        {this.fileInputPanel()}
                    </div>
                </li>
                <li className="nav-item">
                    <label className="nav-link dropdown-toggle menuLabel"
                           href="#"
                           id='controllersSettingDropdown'
                           role='button'
                           data-toggle="dropdown"
                           aria-haspopup="true"
                           aria-expanded="false"
                           style={{fontSize: '1rem'}}>&#9881;</label>
                    <div className="dropdown-menu controllersElem" aria-labelledby="navbarDropdown">
                        {/* <a className='dropdown-item'>&#10004;&#65039; 1 day</a>
                        <a className='dropdown-item'>3 day</a>
                        <a className='dropdown-item'>7 day</a> */}
                        <h6>Wheel interval</h6>
                        <select
                            id='wheelIntervalList'
                            className="form-control custom-select"
                            onChange={this.updateWheelInterval.bind(this)}
                            style={{fontSize: '0.8rem', height: '1.5rem', width: '5rem'}}>
                            <option value='1'>1 day</option>
                            <option value='3'>3 days</option>
                            <option value='5'>5 days</option>
                            <option value='7'>7 days</option>
                        </select>
                    </div>
                </li>
            </ul>
        );
    }

    showFileInputPanel() {
        let state = $('#fileInputPanel').css('visibility');
        let leftPos = $('#controllersFileDropdown').position();
        switch (state) {
            case 'visible':
                $('#fileInputPanel').css('visibility', 'hidden');
                break;
            case 'hidden':
                $('#fileInputPanel').css('left', leftPos.left);
                $('#fileInputPanel').css('visibility', 'visible');
                break;
        }
    }

    fileInputPanel() {
        return (
            <div id='inputFile' className='controllersElem'>
                <h6>File type</h6>
                <form id="fileType" className='form-check-inline' style={{minWidth: '200px'}}
                      onChange={this.changeFileType.bind(this)}>
                    <div className="custom-control custom-radio"
                        style={{marginRight: '0.5rem'}}>
                        <input
                            type="radio"
                            name="fileType"
                            value="csv"
                            className="custom-control-input"
                            checked={this.state.fileType === 'csv'} readOnly/>
                        <label className="custom-control-label" htmlFor="inlineCheckbox1">csv</label>
                    </div>
                    <div className="custom-control custom-radio"
                        style={{marginRight: '0.5rem'}}>
                        <input
                            type="radio"
                            name="fileType"
                            value="tsv"
                            className="custom-control-input"
                            disabled={true}
                            checked={this.state.fileType === 'tsv'} readOnly/>
                        <label className="custom-control-label" htmlFor="inlineCheckbox1">tsv</label>
                    </div>
                    <div className="custom-control custom-radio"
                        style={{marginRight: '0.5rem'}}>
                        <input
                            type="radio"
                            name="fileType"
                            value="space"
                            disabled={true}
                            className="custom-control-input"
                            checked={this.state.fileType === 'space'} readOnly/>
                        <label className="custom-control-label" htmlFor="inlineCheckbox1">space</label>
                    </div>
                </form>
                <h6>Initial line of the data (excluding headers)</h6>
                <div className="form-row" id="initialLineField" style={{display: 'flex', justifyContent: 'center'}}>
                    <button
                        type="button"
                        id="sub"
                        className="sub btn btn-primary  btn-sm"
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
                        className="add btn btn-primary btn-sm"
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
                <div style={{display: 'flex', justifyContent: 'center', marginTop: '0.5rem'}}>
                    <button type="button" className="btn btn-primary btn-sm" onClick={this.openTestData.bind(this)}>Synthetic Data</button>
                </div>
            </div>
        );
    }

    openTestData() {
        $.ajax({
            url: 'data/synthesisData8.csv',
            success: function(data) {
                DataAction.importDemoData('testdata4.csv', data);
            }
        });
    }

    updateWheelInterval(e) {
        let wheelIntervalList = document.getElementById('wheelIntervalList');
        let selectedIdx = wheelIntervalList.selectedIndex;
        let selectedInterval = wheelIntervalList.options[selectedIdx].value;
        TimeTubesAction.updateWheelInterval(Number(selectedInterval));
    }

    displayMenu() {
        return (
            <ul className="navbar-nav" id='displayMenu'>
                <li className="nav-item">
                    <label className="nav-link menuLabel"
                           id='resetCameraBtn'
                           onClick={this.resetCamera.bind(this)}>Reset</label>
                </li>
                <li className="nav-item">
                    <label className="nav-link menuLabel"
                           id='switchCameraBtn'
                           onClick={this.switchCamera.bind(this)}>Switch camera</label>
                </li>
                <div className="custom-control custom-checkbox menuItem">
                    <input
                        className="custom-control-input menuCheck"
                        type="checkbox"
                        id="checkboxGrid"
                        checked={this.state.grid}
                        onChange={this.switchGridDisplay.bind(this)}/>
                    <label
                        className="custom-control-label nav-link menuLabel"
                        onClick={this.switchGridDisplay.bind(this)}>Grid</label>
                </div>
                <div className="custom-control custom-checkbox menuItem">
                    <input
                        className="custom-control-input menuCheck"
                        type="checkbox"
                        id="checkboxLabel"
                        checked={this.state.label}
                        onChange={this.switchLabelDisplay.bind(this)}/>
                    <label
                        className="custom-control-label nav-link menuLabel"
                        onClick={this.switchLabelDisplay.bind(this)}>Label</label>
                </div>
                <div className="custom-control custom-checkbox menuItem">
                    <input
                        className="custom-control-input menuCheck"
                        type="checkbox"
                        id="checkboxAxis"
                        checked={this.state.axis}
                        onChange={this.switchAxisDisplay.bind(this)}/>
                    <label
                        className="custom-control-label nav-link menuLabel"
                        onClick={this.switchAxisDisplay.bind(this)}>Axis</label>
                </div>
                <div className="custom-control custom-checkbox menuItem">
                    <input
                        className="custom-control-input menuCheck"
                        type="checkbox"
                        id="checkboxPlot"
                        checked={this.state.plot}
                        onChange={this.switchPlotDisplay.bind(this)}/>
                    <label
                        className="custom-control-label nav-link menuLabel"
                        onClick={this.switchPlotDisplay.bind(this)}>Plot</label>
                </div>
                <div className="custom-control custom-checkbox menuItem">
                    <input
                        className="custom-control-input menuCheck"
                        type="checkbox"
                        id="checkboxComment"
                        checked={this.state.comment}
                        onChange={this.switchCommentDisplay.bind(this)}/>
                    <label
                        className="custom-control-label nav-link menuLabel"
                        onClick={this.switchCommentDisplay.bind(this)}>Comment</label>
                </div>
                <div className="form-check form-check-inline menuItem">
                <select
                    className="form-control custom-select"
                    id='backgroundList'
                    onChange={this.changeBackground.bind(this)}
                    style={{fontSize: '0.8rem', height: '1.5rem', width: '5rem'}}>
                    <option value='0x000000'>Black</option>
                    <option value='0x3f3f3f'>Gray 75</option>
                    <option value='0x7f7f7f'>Gray 50</option>
                    <option value='0xbfbfbf'>Gray 25</option>
                    <option value='0xffffff'>White</option>
                    <option value='0x191970'>Navy</option>
                </select>
                </div>
            </ul>
        );
    }

    tubeMenu() {
        return (
            <ul className="navbar-nav" id='tubeMenu'>
                <div className="custom-control custom-checkbox menuItem">
                    <input
                        className="custom-control-input menuCheck"
                        type="checkbox"
                        id="checkboxClip"
                        value="option1"
                        checked={this.state.clip}
                        onChange={this.clipTube.bind(this)}/>
                    <label
                        className="custom-control-label nav-link menuLabel"
                        htmlFor="inlineCheckbox1"
                        onClick={this.clipTube.bind(this)}>Clip</label>
                </div>
                <div className="custom-control custom-checkbox menuItem">
                    <input
                        className="custom-control-input menuCheck"
                        type="checkbox"
                        id="checkboxShade"
                        value="option1"
                        checked={this.state.shade}
                        onChange={this.switchShade.bind(this)}/>
                    <label
                        className="custom-control-label nav-link menuLabel"
                        htmlFor="inlineCheckbox1"
                        onClick={this.switchShade.bind(this)}>Shade</label>
                </div>
                <li className='nav-item dropdown'>
                    <label className="nav-link dropdown-toggle menuLabel" href="#"
                           id="navbarDropdown" role="button" data-toggle="dropdown"
                           aria-haspopup="true" aria-expanded="false">
                        Average
                    </label>
                    <div className="dropdown-menu controllersElem" aria-labelledby="navbarDropdown">
                        <div id='averageSlider'
                            style={{float: 'left', width: '8rem', marginBottom: '.5rem', marginTop: '.5rem'}}>
                            <output id="averageSliderVal"
                                    style={{
                                        position: 'absolute',
                                        display:'none',
                                        top: '-30px',
                                        backgroundColor: '#fff',
                                        opacity: '0.8',
                                        borderRadius: '3px',
                                        color: '#777',
                                        padding: '2px'
                            }}></output>
                        </div>
                    </div>
                </li>
                <li className="nav-item">
                    <label className="nav-link menuLabel" id='selectAllViews' onClick={this.selectAllViews.bind(this)}>Select All</label>
                </li>
            </ul>
        );
    }

    multiTubesMenu() {
        return (
            <ul className="navbar-nav" id='multiTubesMenu'>
                <div className="custom-control custom-checkbox menuItem">
                    <input
                        className="custom-control-input menuCheck"
                        type="checkbox"
                        id='checkboxLock'
                        value="option1"
                        checked={this.state.lock}
                        onChange={this.lockControl.bind(this)}
                        disabled={!this.state.multiOptions}/>
                    <label
                        className="custom-control-label nav-link menuLabel"
                        htmlFor="inlineCheckbox1"
                        onClick={this.lockControl.bind(this)}>Lock</label>
                </div>
                <li className="nav-item">
                    <label className="nav-link menuLabel"
                           onClick={this.timeFitting.bind(this)}>Time Fitting</label>
                </li>
                <li className='nav-item dropdown'>
                    <label className="nav-link dropdown-toggle menuLabel" href="#"
                           id="navbarDropdown" role="button" data-toggle="dropdown"
                           aria-haspopup="true" aria-expanded="false">
                        Fusion
                    </label>
                    <div className="dropdown-menu controllersElem" aria-labelledby="navbarDropdown">
                        <label className="dropdown-item menuLabel"
                               id='mergeBtn'
                               onClick={this.mergeTubes.bind(this)}>All</label>
                    </div>
                </li>
            </ul>
        );
    }


    render() {
        // ToDo: render will be run before componentWillMount,
        //  so a warning 'Warning: Controllers is changing an uncontrolled input of type checkbox to be controlled.' will occur
        //  because the program calls this.state.checked[i] before it's assigned.
        //  This will not affect to the program.
        return (
            <nav className="navbar navbar-expand-lg navbar-dark bg-primary" id='tubeControllers'>
                <div className="collapse navbar-collapse" id="TimeTubesMenu">
                    {this.basicMenu()}
                    {this.displayMenu()}
                    {this.tubeMenu()}
                    {this.multiTubesMenu()}
                </div>
            </nav>
        );
    }
}
