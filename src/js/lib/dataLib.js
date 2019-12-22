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

export function addCommentData(data) {
    privateComment = JSON.parse(localStorage.getItem('privateComment'));
    privateComment.push(data);
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
    let flag = false;
    for (let i = 0; i < privateComment.length; i++) {
        if (privateComment[i].id === id) {
            privateComment.splice(i, 1);
            flag = true;
            break;
        }
    }
    localStorage.setItem('privateComment', JSON.stringify(privateComment));
    return flag;
}

export function getPrivateCommentFromId(id) {
    for (let i = 0; i < privateComment.length; i++) {
        if (privateComment[i].id === id) {
            return privateComment[i];
        }
    }
    return -1;
}

export function exportPrivateComment(idList) {
    let selected = [];
    for (let i = 0; i < idList.length; i++) {
        selected.push(privateComment.filter(d => {
            if (d.id === idList[i]) return true;
        })[0]);
    }
    let contents = '';
    for (let i = 0; i < selected.length; i++) {
        for (let key in selected[i]) {
            if (key === 'timeStamp') {
                contents += selected[i][key].replace(', ', '_');
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
