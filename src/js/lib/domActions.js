import {resizeExtractionResultsArea} from '../Actions/AppAction';

export function toggleSourcePanel() {
    let current = $('#QBESourceMain').css('display');
    if (current === 'block') {
        $('#QBESourceMain').css('display', 'none');//toggle();
        $('#QBESource').css('width', '0%');
        $('#QBESource').css('padding', '0px');
        $('#extractionResults').css('width', '70%');
        $('#collapseSourcePanel').text('Open');
    } else if (current === 'none') {
        $('#QBESourceMain').css('display', 'block');
        $('#QBESource').css('width', '30%');
        $('#QBESource').css('padding', '15px');
        $('#extractionResults').css('width', '40%');
        $('#collapseSourcePanel').text('Close');
    }
    // resizeExtractionResultsArea();
}

export function toggleExtractionDetailPanel() {
    let current = $('#resultDetailArea').css('display');
    if (current === 'block') {
        $('#resultDetailArea').css('display', 'none');
        $('#resultDetail').css('height', '1.5rem');
        $('#resultDetail').css('margin-bottom', '0');
        $('#collapseResultDetailPanel').text('Open');
    } else if (current === 'none') {
        $('#resultDetailArea').css('display', 'block');
        $('#resultDetail').css('height', 'auto');
        $('#resultDetail').css('margin-bottom', '1.5rem');
        $('#collapseResultDetailPanel').text('Close');
    }
}

export function getIgnoredVariables() {
    let checked = $('input[name=QBEIgnored]:checked');
    let ignored = [];
    for (let i = 0; i < checked.length; i++) {
        ignored.push(checked[i].value);
    }
    return ignored;
}

export function uncheckIgnoredVariables() {
    let checked = $('input[name=QBEIgnored]:checked');
    for (let i = 0; i < checked.length; i++) {
        checked[i].checked = false;
    }
}

export function transformCamelToSentence(str) {
    let result = str.replace( /([A-Z])/g, " $1" );
    result = result.charAt(0).toUpperCase() + result.slice(1);
    return result;
}

export function transformSentenceToCamel(str) {
    let result = '';
    let splited = str.split(' ');
    result = splited[0];
    for (let i = 1; i < splited.length; i++) {
        result += splited[i].charAt(0).toUpperCase() + splited[i].slice(1);
    }
    result = result.charAt(0).toLowerCase() + result.slice(1);
    return result;
}

export function displayLoading(parentId) {
    if ($('#loading').length <= 0) {
        $("#" + parentId).append('<img id="loading" src="img/icons/loading.gif" width="30" height="30"/>');
    }
    return 'displayLoading';
}

export function removeLoading() {
    $('#loading').remove();
}
