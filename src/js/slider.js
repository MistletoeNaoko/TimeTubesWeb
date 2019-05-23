// var $ = require('jQuery');
$(function() {
    let val = $('#farSliderVal');
    $( "#farSlider" ).slider({
        range: "min",
        value: 0,
        min: 1,
        max: 100,
        slide: function( event, ui ) {
            val.css('display', 'initial');
            val.val(ui.value);
            let min = $( "#farSlider" ).slider('option', 'min');
            let range = $( "#farSlider" ).slider('option', 'max') - min;
            let pos = -10 + $('#farSlider').width() * (ui.value - min) / range;

            val.css('left', pos + 'px');
        },
        stop: function () {
            val.css('display', 'none');
        }
    });
    $( "#farSliderVal" ).val($( "#farSlider" ).slider( "value" ) );
});


$( function() {
    let value = $("#color_value");
    let vMin = $('#color_value_min');
    let vMax = $('#color_value_max');
    value.slider({
        range: true,
        min: 0,
        max: 100,
        values: [ 0, 100 ],
        orientation: "vertical",
        slide: function (event, ui) {
            vMin.css('display', 'initial');
            vMax.css('display', 'initial');
            vMin.val(ui.values[0]);
            vMax.val(ui.values[1]);
            let min = value.slider("option", "min");
            let range = value.slider("option", "max") - min;
            let minPos = -10 + 150 * (ui.values[0] - min) / range;
            let maxPos = -10 + 150 - 150 * (ui.values[1] - min) / range;
            vMin.css('bottom', minPos + 'px');
            vMax.css('top', maxPos + 'px');
            if (blazarData[currentIdx].length !== 0) {
                let rangeFL = blazarMax[currentIdx]['Flx(V)'] - blazarMin[currentIdx]['Flx(V)'];
                timetubes[currentIdx].tube.material.uniforms.minmaxFlx.value = new THREE.Vector2(
                    ui.values[0] / 100 * rangeFL + blazarMin[currentIdx]['Flx(V)'],
                    ui.values[1] / 100 * rangeFL + blazarMin[currentIdx]['Flx(V)']);
            }
        },
        stop: function () {
            vMin.css('display', 'none');
            vMax.css('display', 'none');
        }
    });
    vMin.val(value.slider('values', 0));
    vMax.val(value.slider('values', 1));
} );

$( function() {
    let hue = $( "#color_hue" );
    let hMin = $('#color_hue_min');
    let hMax = $('#color_hue_max');
    hue.slider({
        range: true,
        min: 0,
        max: 100,
        values: [ 0, 100 ],
        // orientation: "horizontal"
        slide: function( event, ui ) {
            hMin.css('display', 'initial');
            hMax.css('display', 'initial');
            hMin.val(ui.values[0]);
            hMax.val(ui.values[1]);
            let minPos = -35 + 150 * ui.values[0] / 100;
            let maxPos = -20 + 150 - 150 * ui.values[1] / 100;
            hMin.css('left', minPos + 'px');
            hMax.css('right', maxPos + 'px');
            if (blazarData[currentIdx].length !== 0) {
                let rangeVJ = blazarMax[currentIdx]['V-J'] - blazarMin[currentIdx]['V-J'];
                timetubes[currentIdx].tube.material.uniforms.minmaxVJ.value = new THREE.Vector2(
                    ui.values[0] / 100 * rangeVJ + blazarMin[currentIdx]['V-J'],
                    ui.values[1] / 100 * rangeVJ + blazarMin[currentIdx]['V-J']);
            }
        },
        stop: function () {
            hMin.css('display', 'none');
            hMax.css('display', 'none');
        }
    });
    hMin.val(hue.slider('values', 0));
    hMax.val(hue.slider('values', 1));
} );