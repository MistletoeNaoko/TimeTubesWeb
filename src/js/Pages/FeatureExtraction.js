import React from 'react';
import ExtractionMenu from '../Components/ExtractionMenu';
import ExtractionResults from '../Components/ExtractionResults';
import ExtractionSource from '../Components/ExtractionSource';
import * as FeatureAction from '../Actions/FeatureAction';
import FeatureStore from '../Stores/FeatureStore';
import ClusteringResults from '../Components/ClusteringResults';

export default class FeatureExtraction extends React.Component{
    constructor(props) {
        super();
        // FeatureAction.switchQueryMode('AE');
        this.state = {
            queryMode: FeatureStore.getMode()
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
            } else if (mode === 'Clustering') {
                $('#clusteringResults').css({
                    width: (100 - 30) + '%'
                });
            } else {
                $('#extractionResults').css({
                    width: (100 - 30) + '%'
                });
            }
        });
    }

    render() {
        let QBESource;
        if (this.state.queryMode === 'QBE') {
            QBESource = <ExtractionSource/>;
        }
        let resultsPanel;
        if (this.state.queryMode === 'Clustering') {
            resultsPanel = <ClusteringResults/>;
        } else {
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
