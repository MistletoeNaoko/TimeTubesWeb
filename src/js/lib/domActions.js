import * as d3 from 'd3';

d3.selection.prototype.moveToFront =
    function() {
        return this.each(function(){this.parentNode.appendChild(this);});
    };
export function toggleExtractionMenu(display) {
    let current = $('#extractionMainMenu').css('display');
    if (display === 'none' || current === 'block') {
        $('#extractionMainMenu').css('display', 'none');//toggle();
        $('#extractionMenu').css('width', '0%');
        if ($('#extractionResults').length > 0) {
            $('#extractionResults').css('width', '100%');
        } else if ($('#clusteringResults').length > 0) {
            $('#clusteringResults').css('width', '100%');
            $('#clusteringResultsLeftColumnTabContent').css('display', 'block');
            // $('#clusteringResultsLeftColumnTabContent').css('width', '20%');
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
            $('#clusteringResultsLeftColumnTabContent').css('display', 'none');
            $('#clusteringResultsOverview').css('width', '70%');
            $('#clusteringDetail').css('width', '30%');
        }
        $('#collapseExtractionMenu').text('Close');
    }
}

export function toggleSourcePanel(flag=undefined) {
    let current = $('#QBESourceMain').css('display');
    if (typeof(flag) !== 'undefined') {
        if (flag) {
            $('#QBESourceMain').css('display', 'block');
            $('#QBESource').css('width', '30%');
            $('#QBESource').css('padding', '15px');
            $('#extractionResults').css('width', '40%');
            $('#collapseSourcePanel').text('Close');
        } else {
            $('#QBESourceMain').css('display', 'none');//toggle();
            $('#QBESource').css('width', '0%');
            $('#QBESource').css('padding', '0px');
            $('#extractionResults').css('width', '70%');
            $('#collapseSourcePanel').text('Open');
        }
    } else {
        if (current === 'block') {
            $('#QBESourceMain').css('display', 'none');//toggle();
            $('#QBESource').css('width', '0%');
            $('#QBESource').css('padding', '0px');
            $('#extractionResults').css('width', '70%');
            $('#collapseSourcePanel').text('Open');
        } else if (current === 'none' || $('#QBESourceMain').length <= 0) {
            $('#QBESourceMain').css('display', 'block');
            $('#QBESource').css('width', '30%');
            $('#QBESource').css('padding', '15px');
            $('#extractionResults').css('width', '40%');
            $('#collapseSourcePanel').text('Close');
        }
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

export function highlightCorrespondingElemInClusteringResults(dataId, SSId, period, beforeAfter) {
    // highlight SS on the timeline
    d3.select('#clusterLine_' + dataId + '_' + SSId)
    .attr('stroke', 'black')
    .attr('stroke-width', 1.5)
    .moveToFront();

    // highlight the clustering detail panel if the currently focused cluster is the cluster of the selected SS
    if ($('#subsequenceDetailTr_' + dataId + '_' + SSId).length > 0) {
        // highlight cluster center line chart
        d3.selectAll('.clusterMemberLineChart_' + dataId + '_' + SSId)
            .attr('stroke', '#f26418');
        // highlight histogram
        d3.select('#SSLengthBar_' + Math.floor(period[1] - period[0]))
            .attr('stroke', 'black')
            .attr('stroke-width', 1.5);
        // highlight sparkline
        d3.selectAll('tr.subsequenceDetailTr')
            .classed('table-active', false);
        d3.select('#subsequenceDetailTr_' + dataId + '_' + SSId)
            .classed('table-active', true);
        // highlight histogram for clusters before/after the selected cluster 
        if (typeof(beforeAfter[0]) !== 'undefined') {
            d3.select('#clusterBeforeHistogramRects_' + beforeAfter[0])
                .attr('stroke', 'black')
                .attr('stroke-width', 1.5);
        }
        if (typeof(beforeAfter[1]) !== 'undefined') {
            d3.select('#clusterAfterHistogramRects_' + beforeAfter[1])
                .attr('stroke', 'black')
                .attr('stroke-width', 1.5);
        }
    }

    // highlight sparklines in the filtering process panel
    if ($('#subsequenceTr_' + dataId + '_' + SSId).length) {
        d3.selectAll('tr.subsequenceTr')
            .classed('table-active', false);
        d3.select('#subsequenceTr_' + dataId + '_' + SSId)
            .classed('table-active', true);
    }
    if ($('#updatedSubsequenceTr_' + dataId + '_' + SSId).length) {
        d3.selectAll('tr.updatedSubsequenceTr')
            .classed('table-active', false);
        d3.select('#updatedSubsequenceTr_' + dataId + '_' + SSId)
            .classed('table-active', true);
    }

    // highlight data points on MDS scatterplot
    d3.select('#dataPointsMDS_' + dataId + '_' + SSId)
        .attr('r', 4)
        .attr('stroke', 'black')
        .attr('stroke-width', 1)
        .moveToFront();
}

export function removeHighlightCorrespondingElemInClusteringResults(dataId, SSId) {
    // remove highlight from timeline
    d3.select('#clusterLine_' + dataId + '_' + SSId)
    .attr('stroke-width', 0);

    // remove highlights from clustering detail panel if the currently focued cluster coincides with the selected SS's cluster
    if ($('#subsequenceDetailTr_' + dataId + '_' + SSId).length > 0) {
        // remove highlight from cluster center line chart
        d3.selectAll('.clusterMemberLineChart_' + dataId + '_' + SSId)
            .attr('stroke', 'lightgray');
        // remove highlight from histogram
        d3.selectAll('.SSLengthBar')
            .attr('stroke-width', 0);
        // remove highlight from sparkline
        d3.select('#subsequenceDetailTr_' + dataId + '_' + SSId)
            .classed('table-active', false);
        // remove stroke from histogram for clusters before/after the selected cluster
        d3.selectAll('#clusterBeforeHistogramRects rect')
            .attr('stroke-width', 0);
        d3.selectAll('#clusterAfterHistogramRects rect')
            .attr('stroke-width', 0);
    }

    // remove highlight sparklines in the filtering process panel
    if ($('#subsequenceTr_' + dataId + '_' + SSId).length) {
        d3.select('#subsequenceTr_' + dataId + '_' + SSId)
            .classed('table-active', false);
    }
    if ($('#updatedSubsequenceTr_' + dataId + '_' + SSId).length) {
        d3.select('#updatedSubsequenceTr_' + dataId + '_' + SSId)
            .classed('table-active', false);
    }

    // remove highlight of data points on MDS scatterplot
    d3.select('#dataPointsMDS_' + dataId + '_' + SSId)
    .attr('r', 3)
    .attr('stroke-width', 0);
}
