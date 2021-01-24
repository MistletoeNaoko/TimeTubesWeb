export function toggleExtractionMenu(display) {
    let current = $('#extractionMainMenu').css('display');
    if (display === 'none' || current === 'block') {
        $('#extractionMainMenu').css('display', 'none');//toggle();
        $('#extractionMenu').css('width', '0%');
        if ($('#extractionResults').length > 0) {
            $('#extractionResults').css('width', '100%');
        } else if ($('#clusteringResults').length > 0) {
            $('#clusteringResults').css('width', '100%');
            $('#clusteringProcess').css('display', 'block');
            $('#clusteringProcess').css('width', '20%');
            $('#clusteringResultsOverview').css('width', '60%');
            $('#clusteringDetail').css('width', '20%');
        }
        $('#collapseExtractionMenu').text('Open');
    } else if (display === 'block' || current === 'none') {
        $('#extractionMainMenu').css('display', 'block');
        $('#extractionMenu').css('width', '30%');
        if ($('#extractionResults').length > 0) {
            $('#extractionResults').css('width', '70%');
        } else if ($('#clusteringResults').length > 0) {
            $('#clusteringResults').css('width', '70%');
            $('#clusteringProcess').css('display', 'none');
            $('#clusteringResultsOverview').css('width', '70%');
            $('#clusteringDetail').css('width', '30%');
        }
        $('#collapseExtractionMenu').text('Close');
    }
}

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

export function getActiveVariables() {
    let checked = $('input[name=QBEActive]:checked');
    let active = [];
    for (let i = 0; i < checked.length; i++) {
        active.push(checked[i].value);
    }
    return active;
}

export function uncheckActiveVariables() {
    let checked = $('input[name=QBEActive]:checked');
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
