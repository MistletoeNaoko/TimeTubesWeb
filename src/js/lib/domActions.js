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
