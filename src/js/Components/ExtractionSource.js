import React from 'react';
import * as d3 from 'd3';
import DataStore from '../Stores/DataStore';
import FeatureStore from '../Stores/FeatureStore';
import Scatterplots from './Scatterplots';

export default class ExtractionSource extends React.Component {
    constructor(props) {
        super();
        this.state = {
            data: DataStore.getAllData(),
            source: -1
        };
    }

    componentWillMount() {
        DataStore.on('upload', () => {
            this.setState({
                data: DataStore.getAllData()
            });
        });
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
    }

    render() {
        // draw scatterplots for lightcurve whenever a new file is uploaded
        // let size = $('#QBESource').outerWidth(true) - Number($('#QBESource').css('padding-left').replace('px', '')) * 2;
        let size = 500;
        if (document.getElementById('QBESource') !== null) {
            let tmp = $('#QBESource').outerWidth(true) - Number($('#QBESource').css('padding-left').replace('px', '')) * 2;
            if (tmp > 0)
                size = tmp;
        }
        let scatterplots = this.state.data.map((data) => {
            return (
                <div
                    key={data.id}
                    id={'QBE_SP_' + data.id}
                    style={{
                        display: 'inline-block',
                        visibility: (data.id === Number(this.state.source)) ? 'visible': 'hidden'}}>
                    <Scatterplots
                        key={data.id}
                        id={data.id}
                        divID={'QBE_SP_' + data.id}
                        xItem={'z'}
                        yItem={'V'}
                        width={size}
                        height={Math.ceil(size * 0.8)}/>
                </div>
            );
        });
        return (
            <div
                id='QBESourceArea'>
                <div id='QBESourceTT'>
                </div>
                <div id='QBESourceSP'>
                    {scatterplots}
                </div>
            </div>
        );
    }
}