import React from 'react';
import * as dataLib from '../lib/dataLib';
import {transformCamelToSentence} from '../lib/domActions';
import {formatValue} from '../lib/2DGraphLib';
import {selectMenu, showExtractionSourcePanel} from '../Actions/AppAction';
import * as DataAction from '../Actions/DataAction';
import * as FeatureAction from '../Actions/FeatureAction';
import AppStore from '../Stores/AppStore';
import DataStore from '../Stores/DataStore';

export default class Comment extends React.Component {
    constructor() {
        super();
        let privateComments = dataLib.getDataFromLocalStorage('privateComment');
        if (Array.isArray(privateComments)) {
            privateComments = dataLib.convertPreviousCommentsIntoNewFormat();
        }
        this.state = {
            privateComments: privateComments,
            selectedComment: {},
            selectedQuery: {},
            selectedCommentId: '',
            selectedQueryId: '',
        };
    }

    componentDidMount() {
        $('#privateCommentTable').tablesorter();
        
        AppStore.on('selectMenu', (menu) => {
            if (menu === 'comment') {
                this.setState({
                    privateComments: dataLib.getDataFromLocalStorage('privateComment')
                });
            }
        });
    }

    privateCommentListTr() {
        let table = [];
        if (this.state.privateComments) {
            for (let id in this.state.privateComments) {
                let color = this.state.privateComments[id].labelColor.replace('0x', '#');
                table.push(
                    <tr key={id} className='privateCommentBody' id={id} onClick={this.onClickCommentTableRow.bind(this)}>
                        <td style={{textAlign: 'center'}}>
                            <input type="checkbox" className={id + ' selectComment'} name='privateCommentSelector'/>
                        </td>
                        <td style={{textAlign: 'center'}}><span style={{color: color}}>■</span></td>
                        <td>{this.state.privateComments[id].timeStamp.toLocaleString('en-US')}</td>
                        <td>{this.state.privateComments[id].fileName}</td>
                        <td>{this.state.privateComments[id].start}</td>
                        <td>{this.state.privateComments[id].comment}</td>
                        <td>{this.state.privateComments[id].userName}</td>
                    </tr>
                );
            }
        }
        return table;
    }

    commentDetailTr() {
        let table = [];
        for (let key in this.state.selectedComment) {
            if (key === 'labelColor') {
                table.push(
                    <tr key={key} className='commentDetailTableTr' id={key}>
                        <td>Label</td>
                        <td><span style={{color: this.state.selectedComment[key].replace('0x', '#')}}>■</span></td>
                    </tr>
                );
            } else if (key !== 'query' && key !== 'parameters' && key !== 'queryId') {
                table.push(
                    <tr key={key} className='commentDetailTableTr' id={key}>
                        <td>{transformCamelToSentence(key)}</td>
                        <td>{this.state.selectedComment[key]}</td>
                    </tr>
                );
            } 
        }
        return table;
    }

    queryDetailTr() {
        let table = [];
        for (let key in this.state.selectedQuery) {
            if (typeof(this.state.selectedQuery[key]) !== 'object') {
                table.push(
                    <tr key={key} className='queryDetailTableTr' id={key}>
                        <td>{transformCamelToSentence(key)}</td>
                        <td>{this.state.selectedQuery[key]}</td>
                    </tr>
                );
            }
        }
        for (let key in this.state.selectedQuery.query) {
            if (key !== 'path' && key !== 'controlPoints') {
                let text = this.state.selectedQuery.query[key];
                if (Array.isArray(this.state.selectedQuery.query[key]) && this.state.selectedQuery.query[key].length > 1) {
                    if (Number(this.state.selectedQuery.query[key][0])) {
                        text = '';
                        for (let i = 0; i < this.state.selectedQuery.query[key].length; i++) {
                            text += formatValue(Number(this.state.selectedQuery.query[key][i])) + ', ';
                        }
                        text = text.substr(0, text.length - 2);
                    } else {
                        text = text.join(', ');
                    }
                }
                table.push(
                    <tr key={key} className='queryDetailTableTr' id={key}>
                        <td>{transformCamelToSentence(key)}</td>
                        <td>{text}</td>
                    </tr>
                );
            }
        }
        return table;
    }

    queryParametersDetailTr() {
        let table = [];
        for (let key in this.state.selectedQuery.parameters) {
            let label = (key === 'DTWType')? 'DTW Type': transformCamelToSentence(key);
            let val = (typeof(this.state.selectedQuery.parameters[key]) === 'boolean')? this.state.selectedQuery.parameters[key].toString(): this.state.selectedQuery.parameters[key];
            if (Array.isArray(val)) {
                let text = '';
                for (let i = 0; i < val.length; i++) {
                    text += formatValue(Number(val[i])) + ', ';
                }
                text = text.substr(0, text.length - 2);
                val = text;
            }
            table.push(
                <tr key={key} className='queryParameterDetailTableTr' id={key}>
                    <td>{label}</td>
                    <td>{val}</td>
                </tr>
            );
        }
        return table;
    }

    onClickCommentTableRow(e) {
        this.updateCommentDetail(e.target.parentNode.id);
    }

    updateCommentDetail(id) {
        let comment = dataLib.getPrivateCommentFromId(id);
        if (comment) {
            let query = dataLib.getQueryFromId(comment.queryId);
            this.setState({
                selectedCommentId: id,
                selectedComment: comment,
                selectedQueryId: comment.queryId,
                selectedQuery: query
            });
        }
    }

    privateCommentListHeader() {
        return (
            <thead>
                <tr id='privateCommentHeader'>
                    <th className='col-1'>Select</th>
                    <th className='col-1'>Label</th>
                    <th className='col-2 num' value='timeStamp'>Date (GMT)</th>
                    <th className='col-2 case' value='fileName'>File name</th>
                    <th className='col-1 num' value='start'>JD</th>
                    <th className='col-3' value='comment'>Comment</th>
                    <th className='col-2 case' value='userName'>User name</th>
                    {/* <th className='col-1'>Edit</th> */}
                </tr>
            </thead>
        )
    }

    getSelectedPrivateComment() {
        let checked = $('input[name=privateCommentSelector]:checked');
        let checkedIds = [];
        for (let i = 0; i < checked.length; i++) {
            checkedIds.push($(checked[i]).attr('class').split(' ')[0]);
        }
        return checkedIds;
    }

    editPrivateComment() {

    }

    deletePrivateComment(e) {
        let selectedIds = this.getSelectedPrivateComment();
        let cleanDetailTableFlag = false;
        for (let i = 0; i < selectedIds.length; i++) {
            dataLib.deletePrivateComment(selectedIds[i]);
            if (selectedIds[i] === this.state.selectedCommentId) {
                cleanDetailTableFlag = true;
            }
        }
        // update table
        if (cleanDetailTableFlag) {
            this.setState({
                privateComments: dataLib.getDataFromLocalStorage('privateComment'),
                selectedCommentId: '',
                selectedComment: {},
                selectedQueryId: '',
                selectedQuery: {}
            });
        } else {
            this.setState({
                privateComments: dataLib.getDataFromLocalStorage('privateComment')
            });
        }
        DataAction.updatePrivateComment();
    }

    deleteThisComment() {
        dataLib.deletePrivateComment(this.state.selectedCommentId);
        this.setState({
            privateComments: dataLib.getDataFromLocalStorage('privateComment'),
            selectedCommentId: '',
            selectedComment: {},
            selectedQueryId: '',
            selectedQuery: {}
        });
        DataAction.updatePrivateComment();
    }

    recoverTheQuery() {
        // do something!
        if (Object.keys(this.state.selectedQuery).length > 0) {
            let flag = true;
            if (this.state.selectedQuery.mode === 'visual query' && this.state.selectedQuery.option === 'query-by-example') {
                // check whether the source file is opened or not
                let fileExist = DataStore.getIdFromName(this.state.selectedQuery.query.source);
                if (fileExist < 0) {
                    alert('You have to open the file whose file name is ' + this.state.selectedQuery.query.source + 'to recover the query-by-example.');
                    flag = false;
                }
            } else if (this.state.selectedQuery.mode === 'visual query' && this.state.selectedQuery.option === 'query-by-sketch') {
                // format variable name (e.g. Q/I -> x, V-J -> H)
            }
            if (flag) {
                if (this.state.selectedQuery.mode === 'visual query' && this.state.selectedQuery.option === 'query-by-example') {
                    let promise = Promise.resolve();
                    promise
                        .then(function() {
                            showExtractionSourcePanel(DataStore.getIdFromName(this.state.selectedQuery.query.source));
                        }.bind(this))
                        .then(function() {
                            FeatureAction.recoverQuery(this.state.selectedQuery);
                            selectMenu('feature');
                        }.bind(this));
                } else {
                    FeatureAction.recoverQuery(this.state.selectedQuery);
                    selectMenu('feature');
                }
            }
        } else {
            if (Object.keys(this.state.selectedComment).length > 0) {
                alert('No query information is stored with this comment.');
            } else {
                alert('Please select a comment from the left table.');
            }
        }
    }

    exportPrivateComment() {
        dataLib.exportPrivateComment(this.getSelectedPrivateComment());
    }

    selectAllPrivateComment() {
        let currentMode = $('#selectAllPrivateCommentBtn').text();
        let checkboxes = $('input[name=privateCommentSelector]');
        if (currentMode === 'Select All') { 
            checkboxes.prop('checked', true);
            $('#selectAllPrivateCommentBtn').text('Deselect All');
        } else if (currentMode === 'Deselect All') {
            checkboxes.prop('checked', false);
            $('#selectAllPrivateCommentBtn').text('Select All');            
        }
    }

    render() {
        let tableHeader = this.privateCommentListHeader();
        let tableContents = this.privateCommentListTr();
        let detailContents = this.commentDetailTr();
        let queryDetailContents = this.queryDetailTr();
        let queryParametersDetailContentes = this.queryParametersDetailTr();
        return (
            <div
                className='contents commentRow'
                id='mainCommentsArea'>
                    {/* style={{display: 'flex'}}> */}
                <div className='commentColumn' id='commentTableArea'>
                    <ul className="nav nav-tabs">
                        <li className="nav-item">
                            <a className="nav-link active" data-toggle="tab" href="#private">Private comments</a>
                        </li>
                        <li className="nav-item">
                            <a className="nav-link disabled" data-toggle="tab" href="#public">Public comments</a>
                        </li>
                    </ul>
                    <div id="myTabContent" className="tab-content">
                        <div className="tab-pane fade active show commentsArea" id="private">
                            <div id='privateCommentMenu' style={{float: 'right', marginBottom: '15px'}}>
                                <button
                                    className='btn btn-danger btn-sm'
                                    type='button'
                                    id={'deleteCommentBtn'}
                                    onClick={this.deletePrivateComment.bind(this)}>
                                    Delete
                                </button>
                                <button
                                    className='btn btn-primary btn-sm'
                                    type='button'
                                    id='selectAllPrivateCommentBtn'
                                    onClick={this.selectAllPrivateComment.bind(this)}>
                                    Select All
                                </button>
                                <button
                                    className='btn btn-primary btn-sm'
                                    type='button'
                                    id='exportPrivateCommentBtn'
                                    onClick={this.exportPrivateComment.bind(this)}>
                                    Export
                                </button>
                            </div>
                            <table id='privateCommentTable' className="table table-hover tablesorter">
                                {tableHeader}
                                <tbody id='privateCommentBody'>
                                    {tableContents}
                                </tbody>
                            </table>
                        </div>
                        <div className="tab-pane fade commentsArea" id="public">
                            Public comments will be here.
                        </div>
                    </div>
                </div>
                <div className='commentColumn' id='commentDetailArea'>
                    <div id='commentMenu' style={{float: 'right', marginBottom: '15px'}}>
                        <button
                            className='btn btn-danger btn-sm'
                            type='button'
                            id='deleteThisCommentBtn'
                            onClick={this.deleteThisComment.bind(this)}>
                            Delete this comment
                        </button>
                        <button
                            className='btn btn-primary btn-sm'
                            type='button'
                            id='recoverTheQueryBtn'
                            onClick={this.recoverTheQuery.bind(this)}>
                            Recover the query
                        </button>
                    </div>
                    <div style={{clear: 'both'}}></div>
                    <h5>Comment</h5>
                    <table id='commentDetailTable' className="table table-hover">
                        <tbody id='commentDetailBody'>
                            {detailContents}
                        </tbody>
                    </table>
                    <h5>Query</h5>
                    <table id='queryDetailTable' className="table table-hover">
                        <tbody id='queryDetailBody'>
                            {queryDetailContents}
                        </tbody>
                    </table>
                    <table id='queryParametersDetailTable' className="table table-hover">
                        <tbody id='queryParametersDetailBody'>
                            {queryParametersDetailContentes}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }
}
