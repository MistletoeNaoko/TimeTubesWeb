import React from 'react';
import FeatureStore from '../Stores/FeatureStore';

export default class ExtractionSource extends React.Component {
    constructor(props) {
        super();
        this.state = {
            source: -1
        };
    }

    componentWillMount() {
        FeatureStore.on('updateSource', () => {
            this.setState({
                source: FeatureStore.getSource()
            });
        });
    }

    render() {
        return (
            <div id='QBESourceArea'>
                <div id='QBESourceTT'>
                    TimeTubes
                </div>
                <div id='QBESourceSP'>
                    Scatterplots
                </div>
            </div>
        );
    }
}