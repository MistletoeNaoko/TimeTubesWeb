import React from 'react';
import * as d3 from 'd3';
import * as domActions from '../lib/domActions';
import * as ScatterplotsAction from '../Actions/ScatterplotsAction';
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
        FeatureStore.on('convertResultIntoQuery', (id, period, ignored) => {
            if (FeatureStore.getMode() === 'QBE') {
                this.setState({
                    source: id
                });
            }
            if (id >= 0) {
                // if the light curve is not copied yet
                if (document.getElementById('QBE_SP_' + id) === null) {
                    // copy SP for lightcurve
                    this.copySP('scatterplots' + id + '_0', 'QBE_SP_' + id);
                }
            }
        });
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
                        display: (data.id === Number(this.state.source)) ? 'block': 'none'}}>
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
                id='QBESource'
                className='controllersElem featureColumn'
                style={{float: 'left', width: '30%', position: 'relative'}}>
                <div id='QBESourceMain' style={{display: 'block'}}>
                    <div id='QBESourceTT'>
                    </div>
                    <div id='QBESourceSP'>
                        {scatterplots}
                    </div>
                </div>
                <button
                    id='collapseSourcePanel'
                    className="btn btn-primary btn-sm"
                    style={{width: '4rem', height: '1.5rem',position: 'absolute', top: '0px', right: '-4rem'}}
                    onClick={domActions.toggleSourcePanel}>
                        Close
                </button>
            </div>
        );
    }
}
