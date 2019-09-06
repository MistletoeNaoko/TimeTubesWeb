import React from 'react';
import VisualQuery from '../Components/VisualQuery';
import AutomaticExtraction from '../Components/AutomaticExtraction';

export default class ExtractionMenu extends React.Component {
    constructor(props) {
        super();
    }

    render() {
        return (
            <div>
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