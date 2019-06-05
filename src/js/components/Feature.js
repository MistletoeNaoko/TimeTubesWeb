import React from 'react';
import * as TimeTubesAction from '../Actions/TimeTubesAction';
import DataStore from '../Stores/DataStore';

export default class Feature extends React.Component {
    constructor() {
        super();
        this.state = {
            visualQuery: false,
            dragSelection: true
        };
    }

    switchVisualQuery() {
        let status = $('#switchVisualQuery').prop('checked');
        this.setState({visualQuery: status});
        TimeTubesAction.switchVisualQuery(status);
    }

    switchDragSelection() {
        let status = !this.state.dragSelection;
        this.setState({dragSelection: status});
        TimeTubesAction.switchDragSelection(status);
    }

    render() {
        let tubeNum = DataStore.getDataNum();
        let featureStatus = false;
        if (tubeNum > 0)
            featureStatus = true;
        return (
            <div id='featureArea' className='controllersElem'>
                <div className="custom-control custom-switch">
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
        );
    }
}