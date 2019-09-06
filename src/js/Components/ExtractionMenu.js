import React from 'react';
import VisualQuery from '../Components/VisualQuery';
import AutomaticExtraction from '../Components/AutomaticExtraction';
import DataStore from '../Stores/DataStore';

export default class ExtractionMenu extends React.Component {
    constructor(props) {
        super();
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
            <div>
                <div id='targetDatasetsList' className='controllersElem'>
                    <h6>Target datasets</h6>
                    {targetList}
                </div>
                <ul className="nav nav-tabs">
                    <li className="nav-item">
                        <a className="nav-link active" data-toggle="tab" href="#automaticExtraction">Automatic Extraction</a>
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
        );
    }
}