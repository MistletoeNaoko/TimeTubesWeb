import React from 'react';
import ExtractionMenu from '../Components/ExtractionMenu';
import ExtractionResults from '../Components/ExtractionResults';
import ExtractionSource from '../Components/ExtractionSource';
import * as FeatureAction from '../Actions/FeatureAction';
import FeatureStore from '../Stores/FeatureStore';

export default class FeatureExtraction extends React.Component{
    constructor(props) {
        super();
        // FeatureAction.switchQueryMode('AE');
        this.state = {
            queryMode: FeatureStore.getMode(),
            menu: 'Visualization'
        };
    }

    componentWillMount() {
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
            } else {
                $('#extractionResults').css({
                    width: (100 - 30) + '%'
                });
            }
        });
    }

    render() {
        let QBESource;
        return (
            <div className='contents' id='mainFeatureArea'>
                <ExtractionMenu/>
                {/*{QBESource}*/}
                <div id='QBESource'
                     className='controllersElem'
                    style={{
                        float: 'left',
                        width: '30%',
                        height: '100vh',
                        display: (this.state.queryMode === 'QBE') ? 'block': 'none'}}>
                    <ExtractionSource/>
                </div>
                <ExtractionResults/>
            </div>
        );
    }
}