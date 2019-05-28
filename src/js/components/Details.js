import React from 'react';
import { SketchPicker } from 'react-color';
import * as TimeTubesAction from '../Actions/TimeTubesAction';
import TimeTubesStore from '../Stores/TimeTubesStore';
import DataStore from '../Stores/DataStore';

export default class Details extends React.Component{
    constructor() {
        super();
        this.state = {
            id: DataStore.getTailID(),
            fileName: DataStore.getFileName(DataStore.getTailID()),
            currentVal: DataStore.getValues(-1, 0),
            checked: true
        };
    }

    componentWillMount() {
        // ToDo: at first file uploading, following 'upload' code cannot catch event emitter
        DataStore.on('upload', (arg1) => {
            if (this.state.id === -1) {
                this.setState({
                    id: arg1,
                    fileName: DataStore.getFileName(arg1),
                    currentVal: DataStore.getValues(0, 0),
                    checked: false
                });
            }
        });
        DataStore.on('updateDetail', (arg1, arg2) => {
            if (this.state.id === arg1) {
                this.setState({

                    currentVal: DataStore.getValues(arg1, arg2)
                });
            }
        });

        TimeTubesStore.on('updateChecked', (arg1) => {
            if (this.state.id === arg1) {
                this.setState({
                    checked: !this.state.checked
                });
            }
        });
    }

    componentDidMount() {
        this.setFarSlider();
        this.setColormapValueSlider();
        this.setColormapHueSlider();
    }

    setFarSlider() {
        let id = this.state.id;
        let val = $('#farSliderVal-' + id);
        $("#farSlider-" + id).slider({
            range: "min",
            value: 0,
            min: 1,
            max: 100,
            slide: function( event, ui ) {
                val.css('display', 'initial');
                val.val(ui.value);
                let min = $( "#farSlider-" + id ).slider('option', 'min');
                let range = $( "#farSlider-" + id ).slider('option', 'max') - min;
                let pos = -10 + $( '#farSlider-' + id ).width() * (ui.value - min) / range;

                val.css('left', pos + 'px');

                TimeTubesAction.changeFar(id, ui.value);
            },
            stop: function () {
                val.css('display', 'none');
            }
        });
        $("#farSliderVal-" + id).val($("#farSlider-" + id).slider("value"));
    }

    setColormapValueSlider() {
        let id = this.state.id;
        let value = $("#colorValue-" + id);
        let vMin = $('#colorValueMin-' + id);
        let vMax = $('#colorValueMax-' + id);
        value.slider({
            range: true,
            min: 0,
            max: 100,
            values: [ 0, 100 ],
            orientation: "vertical",
            slide: function (event, ui) {
                vMin.css('display', 'initial');
                vMax.css('display', 'initial');
                vMin.val(ui.values[0]);
                vMax.val(ui.values[1]);
                let min = value.slider("option", "min");
                let range = value.slider("option", "max") - min;
                let minPos = -10 + 150 * (ui.values[0] - min) / range;
                let maxPos = -10 + 150 - 150 * (ui.values[1] - min) / range;
                vMin.css('bottom', minPos + 'px');
                vMax.css('top', maxPos + 'px');
                let data = DataStore.getData(id);
                let rangeValue = data.data.meta.max.V - data.data.meta.min.V;
                TimeTubesAction.updateMinMaxV(id, ui.values[0] / 100 * rangeValue + data.data.meta.min.V, ui.values[1] / 100 * rangeValue + data.data.meta.min.V);
            },
            stop: function () {
                vMin.css('display', 'none');
                vMax.css('display', 'none');
            }
        });
        vMin.val(value.slider('values', 0));
        vMax.val(value.slider('values', 1));
    }

    setColormapHueSlider() {
        let id = this.state.id;
        let hue = $("#colorHue-" + id);
        let hMin = $('#colorHueMin-' + id);
        let hMax = $('#colorHueMax-' + id);
        hue.slider({
            range: true,
            min: 0,
            max: 100,
            values: [ 0, 100 ],
            slide: function (event, ui) {
                hMin.css('display', 'initial');
                hMax.css('display', 'initial');
                hMin.val(ui.values[0]);
                hMax.val(ui.values[1]);
                let minPos = -8 + 150 * ui.values[0] / 100;
                let maxPos = - 8 + 150 - 150 * ui.values[1] / 100;
                hMin.css('left', minPos + 'px');
                hMax.css('right', maxPos + 'px');
                let data = DataStore.getData(id);
                let rangeValue = data.data.meta.max.H - data.data.meta.min.H;
                TimeTubesAction.updateMinMaxH(id, ui.values[0] / 100 * rangeValue + data.data.meta.min.H, ui.values[1] / 100 * rangeValue + data.data.meta.min.H);
            },
            stop: function () {
                hMin.css('display', 'none');
                hMax.css('display', 'none');
            }
        });
        hMin.val(hue.slider('values', 0));
        hMax.val(hue.slider('values', 1));
    }

    onChangeCheckbox(id) {
        TimeTubesAction.updateChecked(id);
        // this.setState({
        //     checked: !this.state.checked
        // });

        // let checked = this.state.checked;
        // checked[id] = !checked[id];
        // this.setState({
        //     checked: checked
        // });
    }

    showPopoverFar() {
        let state = $('#changeFar-' + this.state.id).css('visibility');
        let leftPos = $('#farPopoverBtn-' + this.state.id).position();
        switch (state) {
            case 'visible':
                $('#changeFar-' + this.state.id).css('visibility', 'hidden');
                break;
            case 'hidden':
                $('#changeFar-' + this.state.id).css('left', leftPos.left);
                $('#changeFar-' + this.state.id).css('visibility', 'visible');
                break;
        }
    }

    showPopoverPlotColor() {
        let state = $('#changePlotColor-' + this.state.id).css('visibility');
        let leftPos = $('#plotColorPopoverBtn-' + this.state.id).position();
        switch (state) {
            case 'visible':
                $('#changePlotColor-' + this.state.id).css('visibility', 'hidden');
                break;
            case 'hidden':
                $('#changePlotColor-' + this.state.id).css('left', leftPos.left);
                $('#changePlotColor-' + this.state.id).css('visibility', 'visible');
                break;
        }
    }

    showPopoverColormap() {
        let state = $('#changeColormap-' + this.state.id).css('visibility');
        let leftPos = $('#colormapPopoverBtn-' + this.state.id).position();
        switch (state) {
            case 'visible':
                $('#changeColormap-' + this.state.id).css('visibility', 'hidden');
                break;
            case 'hidden':
                $('#changeColormap-' + this.state.id).css('left', leftPos.left);
                $('#changeColormap-' + this.state.id).css('visibility', 'visible');
                break;
        }
    }

    showPopoverSearch() {
        let state = $('#searchTime-' + this.state.id).css('visibility');
        let leftPos = $('#searchPopoverBtn-' + this.state.id).position();
        switch (state) {
            case 'visible':
                $('#searchTime-' + this.state.id).css('visibility', 'hidden');
                break;
            case 'hidden':
                $('#searchTime-' + this.state.id).css('left', leftPos.left);
                $('#searchTime-' + this.state.id).css('visibility', 'visible');
                break;
        }
    }

    searchTime() {
        let id = this.state.id;
        let dst = $('#searchTimeInput-' + id).val();
        if (!isNaN(dst) && dst != '') {
            TimeTubesAction.searchTime(id, Number(dst));
        }
    }

    changePlotColor(color, event) {
        TimeTubesAction.changePlotColor(this.state.id, color.hex);
    }

    render() {
        let cur = this.state.currentVal;
        let detail = '';
        for (let i = 0; i < cur.keys.length; i++) {
            let val;
            if (cur.keys[i] === 'JD' || cur.keys[i] === 'V-J') {
                val = cur.vals[i].toFixed(3);
            } else if (cur.keys[i] === 'Flx(V)') {
                val = cur.vals[i].toExponential(2);
            } else {
                val = cur.vals[i].toFixed(4);
            }
            detail += cur.keys[i] + ': ' + val + '\n';
        }
        let viewportWidth = 500; //TODO: get interactively!
        return (
            <div id={'onViewportControllers-' + this.state.id}>
                <div id={'fileSelector-' + this.state.id} style={{position: 'absolute', color: 'white', top: '0px', left: '0px', zIndex:'11', fontSize: '0.8rem'}}>
                    <label id={'fileName-' + this.state.id}>
                        <input
                            type='checkbox'
                            id={'selectView-' + this.state.id}
                            name='selectView'
                            key={this.state.id}
                            value={this.state.id}
                            checked={this.state.checked}
                            onChange={this.onChangeCheckbox.bind(this, this.state.id)}/>
                        {this.state.fileName}
                    </label>
                </div>
                <div id={'eachTubeControllers-' + this.state.id}
                    style={{position: 'absolute', bottom: '0px', left: '0px', zIndex:'21', fontSize: '0.8rem'}}>
                {/*    Add camera far, search box, color map*/}
                    <button type="button"
                            className="btn btn-sm btn-secondary"
                            id={'colormapPopoverBtn-' + this.state.id}
                            onClick={this.showPopoverColormap.bind(this)}>
                        Colormap
                    </button>
                    <button type="button"
                            className="btn btn-sm btn-secondary"
                            id={'farPopoverBtn-' + this.state.id}
                            onClick={this.showPopoverFar.bind(this)}>
                        Far
                    </button>
                    <button type="button"
                            className="btn btn-sm btn-secondary"
                            id={'plotColorPopoverBtn-' + this.state.id}
                            onClick={this.showPopoverPlotColor.bind(this)}>
                        Plot Color
                    </button>
                    <button type="button"
                            className="btn btn-sm btn-secondary"
                            id={'searchPopoverBtn-' + this.state.id}
                            onClick={this.showPopoverSearch.bind(this)}>
                        Search
                    </button>
                </div>
                <div className="input-group input-group-sm popover-controller"
                    id={"changeColormap-" + this.state.id}
                    style={{visibility: 'hidden', position: 'absolute', bottom: '1.7rem', width: 'auto', zIndex:'31'}}>
                    <div id={"colorFilter-" + this.state.id}>
                        <div id={"colorValue-" + this.state.id} style={{float: 'left', height: '150px'}}>
                            <output id={"colorValueMax-" + this.state.id} style={{marginLeft: '1.3rem'}}></output>
                            <output id={"colorValueMin-" + this.state.id} style={{marginLeft: '1.3rem'}}></output>
                        </div>
                        <div id={"colorMap-" + this.state.id} style={{float: 'left', marginLeft: '10px'}}>
                            <label htmlFor="file_photo">
                                <img src="img/1_256.png" style={{width: '150px', height: '150px'}}/>
                            </label>
                        </div>
                        <div style={{clear:'both'}}></div>
                        <div id={"colorHue-" + this.state.id} style={{width: '150px', marginTop: '5px', marginLeft: '20px'}}>
                            <output id={"colorHueMax-" + this.state.id} style={{bottom: '1.3rem'}}></output>
                            <output id={"colorHueMin-" + this.state.id} style={{bottom: '1.3rem'}}></output>
                        </div>
                    </div>
                </div>
                <div className="input-group input-group-sm popover-controller"
                    id={"changeFar-" + this.state.id}
                    style={{visibility: 'hidden', position: 'absolute', bottom: '1.7rem', width: 'auto', zIndex:'41'}}>
                    <div id={'farSliderArea-' + this.state.id}>
                        <label id={'idLabel-' + this.state.id} style={{float: 'left', width: '2rem'}}>far</label>
                        <div id={'farSlider-' + this.state.id}
                            style={{float: 'left', width: '8rem', marginBottom: '.5rem', marginTop: '.5rem'}}>
                            {/* onChange={this.changeFar.bind(this)}>*/}
                            <output id={"farSliderVal-" + this.state.id}
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
                </div>
                <div className="input-group input-group-sm popover-controller"
                    id={"changePlotColor-" + this.state.id}
                    style={{visibility: 'hidden', position: 'absolute', bottom: '1.7rem', width: 'auto', zIndex:'51'}}>
                    <SketchPicker
                        presetColors={TimeTubesStore.getPresetColors()}
                        color={TimeTubesStore.getPlotColor(this.state.id)}
                        onChange={this.changePlotColor.bind(this)}/>
                </div>
                <div className="input-group input-group-sm popover-controller"
                     id={"searchTime-" + this.state.id}
                     style={{visibility: 'hidden', position: 'absolute', bottom: '1.7rem', width: '10rem', zIndex:'61'}}>
                    <input type="text"
                           className="form-control"
                           id={"searchTimeInput-" + this.state.id}
                           placeholder="Input JD"
                           style={{height: '1.5rem'}}/>
                    <button className="btn btn-secondary btn-sm"
                            type="button"
                            id={"searchTimeBtn-" + this.state.id}
                            onClick={this.searchTime.bind(this)} >Search</button>
                </div>
                <div style={{position: 'absolute', color: 'white', right: '0px', bottom: '0px', whiteSpace: 'pre-line', zIndex:'10', fontSize: '0.8rem'}}>
                    {detail}
                </div>
                {/*<ul>{this.state.currentVal}</ul>*/}
            </div>
        )
    }
}
