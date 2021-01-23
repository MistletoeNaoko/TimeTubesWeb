import React from 'react';
import ExtractionMenu from '../Components/ExtractionMenu';
import ExtractionResults from '../Components/ExtractionResults';
import ExtractionSource from '../Components/ExtractionSource';
import AppStore from '../Stores/AppStore';
import FeatureStore from '../Stores/FeatureStore';
import ClusteringResults from '../Components/ClusteringResults';

export default class FeatureExtraction extends React.Component{
    constructor(props) {
        super();
        // FeatureAction.switchQueryMode('AE');
        this.state = {
            queryMode: FeatureStore.getMode(),
            showQBESource: false,
            resultsPanel: 'featureExtraction'
        };
    }
    
    componentDidMount() {
        FeatureStore.on('switchQueryMode', (mode) => {
            setTimeout(() =>
                this.setState({
                    queryMode: mode
                })
            );
            if (mode === 'QBE') {
                $('#extractionResults').css({
                    width: (100 - 30 * 2) + '%'
                });
            } else if (mode === 'Clustering') {
                $('#clusteringResults').css({
                    width: (100 - 30) + '%'
                });
            } else {
                $('#extractionResults').css({
                    width: (100 - 30) + '%'
                });
            }
            this.showResultsPanel(mode);
        });
        FeatureStore.on('recoverQuery', (query) => {
            let mode = FeatureStore.getMode();
            this.setState({
                queryMode: mode
            });
            if (mode === 'QBE') {
                $('#extractionResults').css({
                    width: (100 - 30 * 2) + '%'
                });
                this.setState({
                    resultsPanel: 'featureExtraction'
                });
            } else if (mode === 'Clustering') {
                $('#clusteringResults').css({
                    width: (100 - 30) + '%'
                });
                this.setState({
                    resultsPanel: 'clustering'
                });
            } else {
                $('#extractionResults').css({
                    width: (100 - 30) + '%'
                });
                this.setState({
                    resultsPanel: 'featureExtraction'
                });
            }
        });
        FeatureStore.on('setQuery', () => {
            if (this.state.resultsPanel !== 'featureExtraction') {
                this.setState({
                    resultsPanel: 'featureExtraction'
                });
            }
        });
        AppStore.on('showExtractionSourcePanel', (id) => {
            if (id !== 'default' && Number(id) >= 0) {
                this.setState({
                    showQBESource: true,
                    resultsPanel: 'featureExtraction'
                });
            } else {
                // ソースが選ばれていない時は今表示されているのから変更しなくていいはず？
                this.setState({
                    showQBESource: false
                });
            }
        });
    }

    showResultsPanel(mode) {
        // queryモードと現在どちらの結果パネルが表示されているか、そして、結果パネルに結果は表示されているか
        // を元に、どちらの結果パネルを表示するかを決定
        let panel;
        let clusteringResultFlag = $('#clusteringTimelineArea').length > 0? true: false;
        if (!clusteringResultFlag) {
            // clustering results are not displayed
            // show result panel according to current query mode
            if (mode === 'Clustering') {
                panel = 'clustering';
            } else {
                panel = 'featureExtraction';
            }
        } else {
            // clustering results are displayed
            if (mode === 'AE') {
                panel = 'featureExtraction';
            } else {
                panel = 'clustering';
            }
        }
        this.setState({
            resultsPanel: panel
        });
    }

    render() {
        let QBESource;
        if (this.state.showQBESource) {
            QBESource = <ExtractionSource/>;
        }
        let resultsPanel;
        if (this.state.resultsPanel === 'clustering') {
            resultsPanel = <ClusteringResults/>;
        } else if (this.state.resultsPanel === 'featureExtraction') {
            resultsPanel = <ExtractionResults/>;
        }
        return (
            <div
                className='contents'
                id='mainFeatureArea'
                style={{display: 'flex'}}>{/* overflow: 'auto',  */}
                <ExtractionMenu/>
                {QBESource}
                {/*<div id='QBESource'*/}
                     {/*className='controllersElem'*/}
                     {/*style={{*/}
                         {/*float: 'left',*/}
                         {/*width: '30%',*/}
                         {/*display: (this.state.queryMode === 'QBE') ? 'block': 'none'}}>*/}
                    {/*<ExtractionSource/>*/}
                {/*</div>*/}
                {resultsPanel}
            </div>
        );
    }
}
