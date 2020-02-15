import {isEqual} from 'lodash';
// import * as fs from 'fs';

// const fs = require('browserfs');
// const commentDataPath = '/commentDB.csv';

// export function addCommentData(data) {
//     fs.writeFile(commentDataPath, data, function(err) {
//         if (err) throw err;
//         console.log('The file has been saved!');
//     });
// }

// export function addCommentData(data) {
//     let httpObj = new XMLHttpRequest();
//     httpObj.open("GET","save.rb?request="+encodeURI(data),true);
//     httpObj.send(null);
// }
let privateComment = JSON.parse(localStorage.getItem('privateComment'));
let queryTable = JSON.parse(localStorage.getItem('queryTable'));

export function addCommentData(comment, query, parameters) {
    // Need to update privateComment and queryTable here 
    // for the first time users
    let commentId = getUniqueId();
    if (privateComment === null) {
        privateComment = JSON.parse(localStorage.getItem('privateComment'));
    }
    if (queryTable === null) {
        queryTable = JSON.parse(localStorage.getItem('queryTable'));
    } 
    
    // check whether the query has already existed or not
    let queryFlag = false;
    let id;
    for (id in queryTable) {
        // because id is assigned to the query in queryTable,
        // the system has to check each property in the query

        // check only when mode and option are the same for simplicity
        if (queryTable[id].mode === query.mode 
            && JSON.stringify(queryTable[id].option) === JSON.stringify(query.option)) {
            let flagProperty = true;
            for (let key in queryTable[id]) {
                // if query and queryTable[i] is not the same
                if (key === 'id') continue;
                if (!(key in query) || !isEqual(query[key], queryTable[id][key])) {
                    flagProperty = false;
                    break;
                }
            }
            if (flagProperty) {
                queryFlag = true;
                break;
            } else {
                continue;
            }
        }
    }
    
    if (queryFlag) {
        // the query have already been registered
        comment.queryId = id;
    } else {
        // the query have not registered yet
        let queryForRegister = {};
        let queryId = getUniqueId();
        for (let key in query) {
            if (key !== 'values') {
                queryForRegister[key] = query[key];
            }
        }
        queryForRegister.parameters = parameters;
        queryTable[queryId] = queryForRegister;
        localStorage.setItem('queryTable', JSON.stringify(queryTable));
        comment.queryId = queryId;
    }
    privateComment[commentId] = comment;
    localStorage.setItem('privateComment', JSON.stringify(privateComment));
}

export function getUniqueId() {
    let strong = 1000;
    return new Date().getTime().toString(16) + Math.floor(strong * Math.random()).toString(16);
}

export function getDataFromLocalStorage(key) {
    return JSON.parse(localStorage.getItem(key));
}

export function deletePrivateComment(id) {
    let queryId;
    let flag = false;
    if (id in privateComment) {
        queryId = privateComment[id].queryId;
        delete privateComment[id];
        flag = true;
    }
    localStorage.setItem('privateComment', JSON.stringify(privateComment));

    if (queryId) {
        // check whether there are any queries which are no more used
        let deleteQueryFlag = true;
        for (let commentId in privateComment) {
            if (privateComment[commentId].queryId === queryId) {
                deleteQueryFlag = false;
                break;
            }
        }
        if (deleteQueryFlag) {
            // delete a query because no comments refer to the query
            delete queryTable[queryId];
            localStorage.setItem('queryTable', JSON.stringify(queryTable));
        }
    }
    return flag;
}

export function getPrivateCommentFromId(id) {
    return privateComment[id];
}

export function getQueryFromId(id) {
    return queryTable[id];
}

export function exportPrivateComment(idList) {
    let selected = [];
    for (let i = 0; i < idList.length; i++) {
        selected.push(privateComment[idList[i]]);
    }
    let contents = '';
    for (let i = 0; i < selected.length; i++) {
        for (let key in selected[i]) {
            if (key === 'timeStamp') {
                contents += selected[i][key].replace(', ', '_');
            } else if (key === 'queryId') {

            } else {
                contents += selected[i][key] + ',';
            }
        }
        contents = contents.substring(0, contents.length - 1);
        contents += '\n';
    }
    let filename = 'privateComment_' + createDateLabel() + '.csv';
    let blob = new Blob([contents], {type: 'text/csv'});
    let url = window.URL || window.webkitURL;
    let blobURL = url.createObjectURL(blob);
    let a = document.createElement('a');
    a.download = decodeURI(filename);
    a.href = blobURL;

    a.click();
}

export function createDateLabel() {
    let now = new Date();
    let year = now.getFullYear(),
        month = now.getMonth() + 1,
        day = now.getDate(),
        hour = now.getHours(),
        minute = now.getMinutes(),
        second = now.getSeconds();

    if (month < 10) {
        month = '0' + month.toString();
    } else {
        month = month.toString();
    }
    if (day < 10) {
        day = '0' + day.toString();
    } else {
        day = day.toString();
    }
    if (hour < 10) {
        hour = '0' + hour.toString();
    } else {
        hour = hour.toString();
    }
    if (minute < 10) {
        minute = '0' + minute.toString();
    } else {
        minute = minute.toString();
    }
    if (second < 10) {
        second = '0' + second.toString();
    } else {
        second = second.toString();
    }
    return year + month + day + hour + minute + second;
}
