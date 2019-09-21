import React from 'react';
import VisualQuery from '../Components/VisualQuery';
import AutomaticExtraction from '../Components/AutomaticExtraction';
import * as FeatureAction from '../Actions/FeatureAction';
import ExtractionSource from '../Components/ExtractionSource';
import DataStore from '../Stores/DataStore';
import FeatureStore from '../Stores/FeatureStore';

export default class ExtractionMenu extends React.Component {
    constructor(props) {
        super();
        this.state = {
            queryMode: FeatureStore.getMode()
        };
    }

    componentWillMount() {
        FeatureStore.on('switchQueryMode', (mode) => {
           this.setState({
               queryMode: mode
           });
        });
    }

    selectTab() {
        FeatureAction.switchQueryMode('AE'); // automatic extraction
    }

    render() {
        const idFile = DataStore.getAllIdsFileNames();
        const targetList = idFile.map((data) => {
            return (
                <label
                    className="form-check form-check-inline"
                    htmlFor="inlineCheckbox1"
                    key={data.id}>
                    <input
                        className="form-check-input"
                        type="checkbox"
                        id={"checkboxTarget" + data.id}
                        value={data.id}
                        key={data.id}/>
                    {data.name}
                    </label>
            );
        });
        return (
            <div
                id='extractionMenu'
                className='featureColumn'
                style={{overflow: 'auto'}}>
                <div id='extractionMainMenu'>
                    <div id='targetDatasetsList' className='controllersElem'>
                        <h5>Target datasets</h5>
                        {targetList}
                    </div>
                    <ul className="nav nav-tabs">
                        <li className="nav-item">
                            <a className="nav-link active" data-toggle="tab" href="#automaticExtraction" onClick={this.selectTab}>Automatic Extraction</a>
                        </li>
                        <li className="nav-item">
                            <a className="nav-link" data-toggle="tab" href="#visualQuery">Visual Query</a>
                        </li>
                    </ul>
                    <div id="extractionMenuTabs" className="tab-content">
                        <div className="tab-pane fade show active" id="automaticExtraction">
                            <AutomaticExtraction/>
                        </div>
                        <div className="tab-pane fade" id="visualQuery">
                            <VisualQuery/>
                        </div>
                    </div>
                </div>
                {/*{QBESource}*/}
            </div>
        );
    }
}