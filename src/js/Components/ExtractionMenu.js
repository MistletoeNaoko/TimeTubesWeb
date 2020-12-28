import React from 'react';
import VisualQuery from '../Components/VisualQuery';
import AutomaticExtraction from '../Components/AutomaticExtraction';
import ClusteringSettings from './ClusteringSettings';
import * as FeatureAction from '../Actions/FeatureAction';
import DataStore from '../Stores/DataStore';
import FeatureStore from '../Stores/FeatureStore';
import ClusteringStore from '../Stores/ClusteringStore';

export default class ExtractionMenu extends React.Component {
    constructor(props) {
        super();
        this.state = {
            queryMode: FeatureStore.getMode()
        };
    }

    componentDidMount() {
        FeatureStore.on('switchQueryMode', (mode) => {
           this.setState({
               queryMode: mode
           });
        });
        FeatureStore.on('recoverQuery', (query) => {
            let mode = FeatureStore.getMode();
            this.setState({
                queryMode: mode
            });
            let AETab = $('#automaticExtraction'),
                VQTab = $('#visualQuery');
            if (mode === 'AE') {
                if (!AETab.hasClass('active')) {
                    AETab.addClass('show').addClass('active');
                }
                if (VQTab.hasClass('active')) {
                    VQTab.removeClass('show').removeClass('active');
                }
            } else if (mode === 'QBE' || mode === 'QBS') {
                if (!VQTab.hasClass('active')) {
                    VQTab.addClass('show').addClass('active');
                }
                if (AETab.hasClass('active')) {
                    AETab.removeClass('show').removeClass('active');
                }
            }
            // select all data sets as target
            let targets = $('input[name=targetList]');
            for (let i = 0; i < targets.length; i++) {
                targets[i].checked = true;
            }
        });
        ClusteringStore.on('showClusteringResults', () => {
            $('#extractionMenu').css('display', 'none');
        });
    }

    selectTabAE() {
        FeatureAction.switchQueryMode('AE'); // automatic extraction
    }

    selectTabClustering() {
        FeatureAction.switchQueryMode('Clustering');
    }

    updateTargets() {
        let selectedTargets = $('input[name=targetList]:checked');
        let targetIdList = [];
        for (let i = 0; i < selectedTargets.length; i++) {
            targetIdList.push(Number(selectedTargets[i].value));
        }
        FeatureAction.updateTarget(targetIdList);
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
                        name='targetList'
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
                        <h5>Target</h5>
                        <form onChange={this.updateTargets.bind(this)}>
                            {targetList}
                        </form>
                    </div>
                    <ul className="nav nav-tabs">
                        <li className="nav-item">
                            <a className="nav-link active" data-toggle="tab" href="#automaticExtraction" onClick={this.selectTabAE}>Automatic Extraction</a>
                        </li>
                        <li className="nav-item">
                            <a className="nav-link" data-toggle="tab" href="#visualQuery">Visual Query</a>
                        </li>
                        <li className="nav-item">
                            <a className="nav-link" data-toggle="tab" href="#clustering" onClick={this.selectTabClustering}>Clustering</a>
                        </li>
                    </ul>
                    <div id="extractionMenuTabs" className="tab-content">
                        <div className="tab-pane fade show active" id="automaticExtraction">
                            <AutomaticExtraction/>
                        </div>
                        <div className="tab-pane fade" id="visualQuery">
                            <VisualQuery/>
                        </div>
                        <div className="tab-pane fade" id="clustering">
                            <ClusteringSettings/>
                        </div>
                    </div>
                </div>
                {/*{QBESource}*/}
            </div>
        );
    }
}
