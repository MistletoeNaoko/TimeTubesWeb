import React from 'react';
import * as FeatureAction from '../Actions/FeatureAction';
import DataStore from '../Stores/DataStore';
import FeatureStore from '../Stores/FeatureStore';

export default class QueryByExample extends React.Component {
    constructor(props) {
        super();
        this.state = {
            dragSelection: true,
            source: -1
        };
    }

    componentDidMount() {
        FeatureStore.on('recoverQuery', (query) => {
            if (FeatureStore.getMode() === 'QBE') {
                let sourceList = document.getElementById('sourceList');
                for (let i = 0; i < sourceList.options.length; i++) {
                    if (Number(sourceList.options[i].value) === Number(FeatureStore.getSource())) {
                        sourceList.selectedIndex = i;
                        break;
                    }
                }
            }
        });
    }

    extractionSource() {
        let idFile = DataStore.getAllIdsFileNames();
        let sourceList = idFile.map((data) => {
            return <option value={data.id} key={data.id}>{data.name}</option>;
        });
        sourceList.unshift(<option value='default' key='default'>Select a source</option>)
        return (
            <div className='featureElem'>
                <h5>Source</h5>
                <select
                    className="custom-select custom-select-sm"
                    id='sourceList'
                    style={{width: '40%'}}
                    onChange={this.updateSource.bind(this)}>
                    {sourceList}
                </select>
            </div>
        );
    }

    updateSource() {
        let sourceList = document.getElementById('sourceList');
        let selectedIdx = sourceList.selectedIndex;
        let selectedId = sourceList.options[selectedIdx].value; // get id
        FeatureAction.updateSource(selectedId);
    }

    render() {
        return (
            <div id='QBEQuerying'>
                {this.extractionSource()}
            </div>
        );
    }
}
