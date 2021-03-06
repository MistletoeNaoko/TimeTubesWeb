import React from 'react';
import Scatterplots from './Scatterplots';
import DataStore from '../Stores/DataStore';
import * as ScatterplotsAction from '../Actions/ScatterplotsAction';

export default class ScatterplotsHolder extends React.Component{
    constructor(props) {
        super();
        this.id = props.id;
        this.data = props.data;
        this.fileName = this.data.name;
        this.menuHeight = 24;
        this.state = {
            scatterplotsList: [],
            width: props.width,
            height: props.height
        }; //x, y, xrange, yrange
    }

    componentDidMount() {
        DataStore.on('showInitSP', (id) => {
            if (id === this.id) {
                let list = this.state.scatterplotsList;
                list.push({x: 'z', y: 'V'});
                this.setState({
                    scatterplotsList: list
                });
            }
        });
    }

    addScatterplots() {
        let selectX = document.getElementById("scatterSelectXAxis_" + this.id);
        let selectY = document.getElementById("scatterSelectYAxis_" + this.id);
        let selectItemX = selectX.options[selectX.selectedIndex].value;
        let selectItemY = selectY.options[selectY.selectedIndex].value;

        if (selectItemX !== 'unselected' && selectItemY !== 'unselected') {
            let list = this.state.scatterplotsList;
            list.push({x: selectItemX, y: selectItemY});
            this.setState({
                scatterplotsList: list
            });
        }
    }

    resetScatterplotsZoom() {
        ScatterplotsAction.resetScatterplotsZoom(this.id);
    }

    render() {
        // first div: to align SPs vertically
        // second div: to change the width of the div depending on the child's size (svg)
        // Scatterplots: main SP elements
        let scatterplots = this.state.scatterplotsList.map((axis, i) => {
            return (
                    <div
                        key={this.id + '_' + i}
                        id={'scatterplots' + this.id + '_' + i}
                        style={{display: 'inline-block'}}>
                        <Scatterplots
                            key={this.id + '_' + i}
                            id={this.id}
                            divID={'scatterplots' + this.id + '_' + i}
                            xItem={axis.x}
                            yItem={axis.y}
                            width={this.props.width}
                            height={this.props.height - this.menuHeight}/>
                    </div>);
        });
        let items = [];
        for (let key in this.data.lookup) {
            let label = '';
            if (this.data.lookup[key].length > 1) {
                label = this.data.lookup[key].join(',');
            } else {
                label = this.data.lookup[key];
            }
            items.push(<option key={key} value={key}>{label}</option>);
        }
        return (
            <div className='scatterplotsHolder' id={'scatterplotsHolder_' + this.id}>
                <div className='scatterplotsMenu row'>
                        {this.fileName}
                        <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            id={"scatterResetBtn_" + this.id}
                            onClick={this.resetScatterplotsZoom.bind(this)}>Reset</button>
                        <select
                            className="custom-select select_axis"
                            id={"scatterSelectXAxis_" + this.id}
                            defaultValue={'unselected'}
                            style={{width: '6rem', height: '1.5rem', float: 'right'}}>
                            <option value='unselected'>x axis</option>
                            {items}
                        </select>
                        <select
                            className="custom-select select_axis"
                            id={"scatterSelectYAxis_" + this.id}
                            defaultValue={'unselected'}
                            style={{width: '6rem', height: '1.5rem', float: 'right'}}>
                            <option value='unselected'>y axis</option>
                            {items}
                        </select>
                        <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            id={"showScatter_" + this.id}
                            style={{float: 'right'}}
                            onClick={this.addScatterplots.bind(this)}>+</button>
                </div>
                <div 
                    id={'scatterplots_' + this.id} 
                    className='scatterplotsViewports'
                    style={{height: this.props.height - this.menuHeight + 'px', width: this.props.width + 'px'}}>
                    {scatterplots}
                    <div style={{clear:'both'}}></div>
                </div>
            </div>
        );
    }
}
