import React from 'react';
import * as d3 from 'd3';
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
            let sourceId = FeatureStore.getSource();
            this.setState({
                source: FeatureStore.getSource()
            });
            if (sourceId >= 0) {
                // if the light curve is not copied yet
                if (document.getElementById('QBE_SP_' + sourceId) === null) {
                    // copy SP for lightcurve
                    this.copySP('scatterplots' + sourceId + '_0', 'QBE_SP_' + sourceId);
                }
            }
        });
        FeatureStore.on('switchQueryMode', (mode) => {
            if (mode === 'QBE') {
                if (this.state.source >= 0) {
                    // if the light curve is not copied yet
                    if (document.getElementById('QBE_SP_' + this.state.source) === null) {
                        // copy SP for lightcurve
                        this.copySP('scatterplots' + this.state.source + '_0', 'QBE_SP_' + this.state.source);
                    }
                }
            }
        });
    }

    copySP(originalSPId, divId) {
        let content = d3.select('#' + originalSPId).html();
        let SPdiv = d3.select('#QBESourceSP')
            .append('div')
            .attr('id', divId)
            .html(content);
        // resize SP
    }

    render() {
        return (
            <div
                id='QBESourceArea'>
                <div id='QBESourceTT'>
                </div>
                <div id='QBESourceSP'>
                </div>
            </div>
        );
    }
}