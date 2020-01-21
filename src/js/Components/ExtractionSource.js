import React from 'react';
import * as d3 from 'd3';
import * as domActions from '../lib/domActions';
import * as FeatureAction from '../Actions/FeatureAction';
import DataStore from '../Stores/DataStore';
import FeatureStore from '../Stores/FeatureStore';
// import Scatterplots from './Scatterplots';
import ScatterplotsQBE from './ScatterplotsQBE';

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
        });
        // FeatureStore.on('convertResultIntoQuery', (id, period, ignored) => {
        //     if (FeatureStore.getMode() === 'QBE') {
        //         this.setState({
        //             source: id
        //         });
        //     }
        // });
    }

    render() {
        // draw scatterplots for lightcurve whenever a new file is uploaded
        // let size = $('#QBESource').outerWidth(true) - Number($('#QBESource').css('padding-left').replace('px', '')) * 2;
        let size = 400;
        // because the size of the panel is the same with featureArea, check the size of featureArea
        if (document.getElementById('featureArea') !== null) {
            let tmp = $('#featureArea').outerWidth(true) - Number($('#featureArea').css('padding-left').replace('px', '')) * 2;
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
                    <ScatterplotsQBE
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
                    <div id='QBESourceTT' className='featureElem'>
                        <div id='selectorForQBETT'>
                            <h5>Selection options for TimeTubes</h5>
                            <form className="form-check form-check-inline selector featureRow"
                                id='QBESelectorTT'>
                                <img
                                    id='QBESelectTT'
                                    className='selectorIcon selected'
                                    name='QBESelectorTT'
                                    value='Select'
                                    src='img/icons/pen.png'
                                    alt='pen'
                                    width='30'
                                    height='30'
                                    title='select a part of the tube'
                                    onClick={this.selectSelect.bind(this)} readOnly/>
                                <img
                                    id='QBEDeselectTT'
                                    className='selectorIcon'
                                    name='QBESelectorTT'
                                    value='Deselect'
                                    src='img/icons/eraser.png'
                                    alt='eraser'
                                    width='30'
                                    height='30'
                                    title='deselect a part of the tube'
                                    onClick={this.selectDeselect.bind(this)} readOnly/>
                            </form>
                        </div>
                    </div>
                    <div id='QBESourceSP' className='featureElem'>
                        <div id='selectorForQBESP'>
                            <h5>Selection options for scatterplots</h5>
                            <form className="form-check form-check-inline selector featureRow"
                                id='QBESelectorSP'>
                                <img
                                    id='QBESelectRegionSP'
                                    className='selectorIcon selected'
                                    name='QBESelectorSP'
                                    value='SelectRegion'
                                    src='img/icons/selectRegion.png'
                                    alt='select region'
                                    width='30'
                                    height='30'
                                    title='select a part of the scatterplot'
                                    onClick={this.selectSelectRegion.bind(this)} readOnly/>
                                <img
                                    id='QBEMoveSP'
                                    className='selectorIcon'
                                    name='QBESelectorSP'
                                    value='Move'
                                    src='img/icons/move.png'
                                    alt='move'
                                    width='30'
                                    height='30'
                                    title='move the scatteplot'
                                    onClick={this.selectMove.bind(this)} readOnly/>
                                <img
                                    id='QBEResetSP'
                                    className='selectorIcon'
                                    name='QBESelectorSP'
                                    value='Reset'
                                    src='img/icons/reset.png'
                                    alt='reset'
                                    width='30'
                                    height='30'
                                    title='reset changes on the scatterplot'
                                    onClick={this.selectReset.bind(this)} readOnly/>
                            </form>
                        </div>
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

    selectSelect() {
        $('img[name=QBESelectorTT]').each(function() {
            $(this).removeClass('selected');
        });
        $('#QBESelectTT').addClass('selected');
        FeatureAction.switchSelector(true);
    }

    selectDeselect() {
        $('img[name=QBESelectorTT]').each(function() {
            $(this).removeClass('selected');
        });
        $('#QBEDeselectTT').addClass('selected');
        FeatureAction.switchSelector(false);
    }

    selectSelectRegion() {
        $('img[name=QBESelectorSP]').each(function() {
            $(this).removeClass('selected');
        });
        $('#QBESelectRegionSP').addClass('selected');
        FeatureAction.switchQBESelectorSP('selectRegion');
    };

    selectMove() {
        $('img[name=QBESelectorSP]').each(function() {
            $(this).removeClass('selected');
        });
        $('#QBEMoveSP').addClass('selected');
        FeatureAction.switchQBESelectorSP('move');
    };

    selectReset() {
        FeatureAction.switchQBESelectorSP('reset');
    };
}
