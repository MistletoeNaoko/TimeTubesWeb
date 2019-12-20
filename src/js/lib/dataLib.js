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
