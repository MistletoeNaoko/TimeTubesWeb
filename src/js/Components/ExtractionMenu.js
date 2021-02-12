import React from 'react';
import VisualQuery from '../Components/VisualQuery';
import AutomaticExtraction from '../Components/AutomaticExtraction';
import ClusteringSettings from './ClusteringSettings';
import * as FeatureAction from '../Actions/FeatureAction';
import {resizeExtractionResultsArea} from '../Actions/AppAction';
import {toggleExtractionMenu} from '../lib/domActions';
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
        let tabHeight = window.innerHeight - $('#appHeader').outerHeight(true) - $('#targetDatasetsList').outerHeight(true) - $('#extractionMenuNavTabs').outerHeight(true);
        $('#extractionMenuTabs').height(tabHeight);

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
                VQTab = $('#visualQuery'),
                clusteringTab = $('#clusteringSetting');
            if (mode === 'AE') {
                if (!AETab.hasClass('active')) {
                    AETab.addClass('show').addClass('active');
                }
                if (VQTab.hasClass('active')) {
                    VQTab.removeClass('show').removeClass('active');
                }
                if (clusteringTab.hasClass('active')) {
                    clusteringTab.removeClass('show').removeClass('active');
                }
            } else if (mode === 'QBE' || mode === 'QBS') {
                if (!VQTab.hasClass('active')) {
                    VQTab.addClass('show').addClass('active');
                }
                if (AETab.hasClass('active')) {
                    AETab.removeClass('show').removeClass('active');
                }
                if (clusteringTab.hasClass('active')) {
                    clusteringTab.removeClass('show').removeClass('active');
                }
            }
            // select all data sets as target
            let targets = $('input[name=targetList]');
            for (let i = 0; i < targets.length; i++) {
                targets[i].checked = true;
            }
        });
    }

    componentDidUpdate() {
        let tabHeight = window.innerHeight - $('#appHeader').outerHeight(true) - $('#targetDatasetsList').outerHeight(true) - $('#extractionMenuNavTabs').outerHeight(true);
        $('#extractionMenuTabs').height(tabHeight);
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

    clickCloseExtractionMenu() {
        toggleExtractionMenu();
        resizeExtractionResultsArea();
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
                style={{float: 'left', position: 'relative'}}>
                <div id='extractionMainMenu'>
                    <div id='targetDatasetsList' className='controllersElem'>
                        <h5>Target</h5>
                        <form onChange={this.updateTargets.bind(this)}>
                            {targetList}
                        </form>
                    </div>
                    <ul className="nav nav-tabs" id='extractionMenuNavTabs'>
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
                <button
                    id='collapseExtractionMenu'
                    className="btn btn-primary btn-sm"
                    style={{width: '4rem', height: '1.5rem',position: 'absolute', top: '0px', right: '-4rem', zIndex: 100}}
                    onClick={this.clickCloseExtractionMenu}>
                        Close
                </button>
            </div>
        );
    }
}
