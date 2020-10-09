import React from 'react';
import * as d3 from 'd3';
import * as THREE from 'three';
import { SketchPicker } from 'react-color';
import * as TimeTubesAction from '../Actions/TimeTubesAction';
import TimeTubesStore from '../Stores/TimeTubesStore';
import DataStore from '../Stores/DataStore';

export default class Details extends React.Component{
    constructor() {
        super();
        this.id = DataStore.getTailID();
        this.data = DataStore.getData(this.id);
        this.lookup = this.data.data.lookup;
        this.state = {
            // id: DataStore.getTailID(),
            fileName: DataStore.getFileName(this.id),
            currentVal: DataStore.getValues(-1, 0),
            checked: true
        };
        this.tubeNum = TimeTubesStore.getTubeNum();
        this.opacityDistSet = TimeTubesStore.getOpacityDistSet();
        this.opacityCurves = TimeTubesStore.getOpacityCurves();
        this.colormapSize = 150;
        this.colorEncodingOption = {hue: 'default', value: 'default'};
    }

    componentDidMount() {
        this.setFarSlider();
        this.setColormapValueSlider();
        this.setColormapHueSlider();
        this.setCurrentColotPlot();
        this.setOpacityCurve();
        this.setOpacityEllipse();
        this.setCurrentColotPlot();


        // ToDo: at first file uploading, following 'upload' code cannot catch event emitter
        DataStore.on('upload', (id) => {
            if (this.id === -1) {
                this.id = id;
                this.lookup = DataStore.getData(id).data.lookup;
                this.setState({
                    fileName: DataStore.getFileName(id),
                    currentVal: DataStore.getValues(-1, 0),
                    checked: false
                });
            }
        });
        DataStore.on('updateDetail', (id, zpos) => {
            if (this.id === id) {
                let currentVal = DataStore.getValues(id, zpos);
                this.setState({
                    currentVal: currentVal
                });
                // 'currentColorPlot_' + this.id
                let minH, maxH;
                let minV, maxV;
                switch (this.colorEncodingOption.hue) {
                    case 'default':
                        minH = this.data.data.meta.min.H; 
                        maxH = this.data.data.meta.max.H;
                        break;
                    case 'histogramEqualization':
                        minH = this.data.data.hueValRanks.minmaxHue.min;
                        maxH = this.data.data.hueValRanks.minmaxHue.max;
                        break;
                    default:
                }
                switch (this.colorEncodingOption.value) {
                    case 'default':
                        minV = this.data.data.meta.min.V; 
                        maxV = this.data.data.meta.max.V;
                        break;
                    case 'histogramEqualization':
                        minV = this.data.data.hueValRanks.minmaxValue.min;
                        maxV = this.data.data.hueValRanks.minmaxValue.max;
                        break;
                    default:
                }
                let VRange = $('#colorValue_' + this.id).slider('option', 'values');
                let HRange = $('#colorHue_' + this.id).slider('option', 'values');
                let minVTmp = minV + (maxV - minV) * VRange[0] / 100,
                    maxVTmp = minV + (maxV - minV) * VRange[1] / 100;
                let minHTmp = minH + (maxH - minH) * HRange[0] / 100,
                    maxHTmp = minH + (maxH - minH) * HRange[1] / 100;
                let xPos = (currentVal.H - minHTmp) / (maxHTmp - minHTmp);
                if (xPos < 0) {
                    xPos = 0;
                } else if (1 < xPos) {
                    xPos = 1;
                }
                let yPos = (currentVal.V - minVTmp) / (maxVTmp - minVTmp);
                if (yPos < 0) {
                    yPos = 0;
                } else if (1 < yPos) {
                    yPos = 1;
                }
                $('#currentColorPlot_' + this.id)
                    .css('left', (xPos * this.colormapSize) + 'px')
                    .css('bottom', (yPos * this.colormapSize) + 'px');
            }
        });
        TimeTubesStore.on('updateChecked', (id) => {
            if (this.id === id) {
                this.setState({
                    checked: !this.state.checked
                });
            }
        });
        TimeTubesStore.on('updateColorEncodingOptionHue', (id, option) => {
            if (this.id === id) {
                this.colorEncodingOption.hue = option;
                // reset colormap hue & value sliders
                $( "#colorHue_" + id ).slider('option', 'values', [0, 100]);
            }
        });
        TimeTubesStore.on('updateColorEncodingOptionValue', (id, option) => {
            if (this.id === id) {
                this.colorEncodingOption.value = option;
                // reset colormap hue & value sliders
                $( "#colorValue_" + id ).slider('option', 'values', [0, 100]);
            }
        });
    }

    setFarSlider() {
        let id = this.id;
        let val = $('#farSliderVal_' + id);
        $("#farSlider_" + id).slider({
            range: "min",
            value: 0,
            min: 1,
            max: 100,
            slide: function( event, ui ) {
                val.css('display', 'initial');
                // subtract initial position of the camera
                val.val(ui.value);
                let min = $( "#farSlider_" + id ).slider('option', 'min');
                let range = $( "#farSlider_" + id ).slider('option', 'max') - min;
                let pos = -10 + $( '#farSlider_' + id ).width() * (ui.value - min) / range;

                val.css('left', pos + 'px');

                TimeTubesAction.changeFar(id, ui.value);
            },
            stop: function () {
                val.css('display', 'none');
            }
        });
        $("#farSliderVal_" + id).val($("#farSlider_" + id).slider("value"));
    }

    setColormapValueSlider() {
        let id = this.id;
        let value = $("#colorValue_" + id);
        let vMin = $('#colorValueMin_' + id);
        let vMax = $('#colorValueMax_' + id);
        value.slider({
            range: true,
            min: 0,
            max: 100,
            values: [ 0, 100 ],
            orientation: "vertical",
            slide: function (event, ui) {
                vMin.css('display', 'initial');
                vMax.css('display', 'initial');
                let colorEncodingOptionValue = TimeTubesStore.getColorEncodingOption().value;
                let data = DataStore.getData(id);
                let vMinValue, vMaxValue;
                switch (colorEncodingOptionValue) {
                    case 'default':
                        vMinValue = data.data.meta.min.V;
                        vMaxValue = data.data.meta.max.V;
                        break;
                    case 'histogramEqualization':
                        vMinValue = data.data.hueValRanks.minmaxValue.min;
                        vMaxValue = data.data.hueValRanks.minmaxValue.max;
                        break;
                    default:
                }
                let minVal = ui.values[0] / 100 * (vMaxValue - vMinValue) + vMinValue;
                let maxVal = ui.values[1] / 100 * (vMaxValue - vMinValue) + vMinValue;
                if (Math.log10(Math.abs(minVal)) < -2 && minVal !== 0) {
                    minVal = minVal.toExponential(1);
                } else {
                    minVal = minVal.toFixed(2);
                }
                if (Math.log10(Math.abs(maxVal)) < -2 && maxVal !== 0) {
                    maxVal = maxVal.toExponential(1);
                } else {
                    maxVal = maxVal.toFixed(2);
                }
                vMin.val(minVal);
                vMax.val(maxVal);
                let min = value.slider("option", "min");
                let range = value.slider("option", "max") - min;
                let minPos = -10 + 150 * (ui.values[0] - min) / range;
                let maxPos = -10 + 150 - 150 * (ui.values[1] - min) / range;
                vMin.css('bottom', minPos + 'px');
                vMax.css('top', maxPos + 'px');
                let rangeValue = vMaxValue - vMinValue;
                TimeTubesAction.updateMinMaxV(id, ui.values[0] / 100 * rangeValue + vMinValue, ui.values[1] / 100 * rangeValue + vMinValue);
            },
            stop: function () {
                vMin.css('display', 'none');
                vMax.css('display', 'none');
            }
        });
        vMin.val(value.slider('values', 0));
        vMax.val(value.slider('values', 1));
    }

    setColormapHueSlider() {
        let id = this.id;
        let hue = $("#colorHue_" + id);
        let hMin = $('#colorHueMin_' + id);
        let hMax = $('#colorHueMax_' + id);
        hue.slider({
            range: true,
            min: 0,
            max: 100,
            values: [ 0, 100 ],
            slide: function (event, ui) {
                hMin.css('display', 'initial');
                hMax.css('display', 'initial');
                let colorEncodingOptionHue = TimeTubesStore.getColorEncodingOption().hue;
                let data = DataStore.getData(id);
                let hMinValue, hMaxValue;
                switch (colorEncodingOptionHue) {
                    case 'default':
                        hMinValue = data.data.meta.min.H;
                        hMaxValue = data.data.meta.max.H;
                        break;
                    case 'histogramEqualization':
                        hMinValue = data.data.hueValRanks.minmaxHue.min;
                        hMaxValue = data.data.hueValRanks.minmaxHue.max;
                        break;
                    default:
                }
                let minVal = ui.values[0] / 100 * (hMaxValue - hMinValue) + hMinValue;
                let maxVal = ui.values[1] / 100 * (hMaxValue - hMinValue) + hMinValue;
                if (Math.log10(Math.abs(minVal)) < -2 && minVal !== 0) {
                    minVal = minVal.toExponential(1);
                } else {
                    minVal = minVal.toFixed(2);
                }
                if (Math.log10(Math.abs(maxVal)) < -2 && maxVal !== 0) {
                    maxVal = maxVal.toExponential(1);
                } else {
                    maxVal = maxVal.toFixed(2);
                }
                hMin.val(minVal);
                hMax.val(maxVal);
                let minPos = -8 + 150 * ui.values[0] / 100;
                let maxPos = - 8 + 150 - 150 * ui.values[1] / 100;
                hMin.css('left', minPos + 'px');
                hMax.css('right', maxPos + 'px');
                let rangeValue = hMaxValue - hMinValue;
                TimeTubesAction.updateMinMaxH(id, ui.values[0] / 100 * rangeValue + hMinValue, ui.values[1] / 100 * rangeValue + hMinValue);
            },
            stop: function () {
                hMin.css('display', 'none');
                hMax.css('display', 'none');
            }
        });
        hMin.val(hue.slider('values', 0));
        hMax.val(hue.slider('values', 1));
    }

    setCurrentColotPlot() {
        // set current color plot to the initial position
        let currentVal = DataStore.getValues(this.id, 0);
        let minH, maxH;
        let minV, maxV;
        switch (this.colorEncodingOption.hue) {
            case 'default':
                minH = this.data.data.meta.min.H; 
                maxH = this.data.data.meta.max.H;
                break;
            case 'histogramEqualization':
                minH = this.data.data.hueValRanks.minmaxHue.min;
                maxH = this.data.data.hueValRanks.minmaxHue.max;
                break;
            default:
        }
        switch (this.colorEncodingOption.value) {
            case 'default':
                minV = this.data.data.meta.min.V; 
                maxV = this.data.data.meta.max.V;
                break;
            case 'histogramEqualization':
                minV = this.data.data.hueValRanks.minmaxValue.min;
                maxV = this.data.data.hueValRanks.minmaxValue.max;
                break;
            default:
        }
        let xPos = (currentVal.H - minH) / (maxH - minH);
        if (maxH === minH) {
            xPos = 0;
        } else if (xPos < 0) {
            xPos = 0;
        } else if (1 < xPos) {
            xPos = 1;
        }
        let yPos = (currentVal.V - minV) / (maxV - minV);
        if (yPos < 0) {
            yPos = 0;
        } else if (1 < yPos) {
            yPos = 1;
        }
        $('#currentColorPlot_' + this.id)
            .css('left', (xPos * this.colormapSize) + 'px')
            .css('bottom', (yPos * this.colormapSize) + 'px');
    }

    setOpacityCurve() {
        let outerWidth = 150, outerHeight = 150;
        let margin = {top: 10, bottom: 15, left: 15, right: 10};
        let width = outerWidth - margin.left - margin.right;
        let height = outerHeight - margin.top - margin.bottom;
        let svg = d3.select('#opacityCurve_' + this.id)
            .append('svg')
            .attr('width', outerWidth)
            .attr('height', outerHeight)
            .attr('id', 'opacityCurveArea_' + this.id);

        // frame of the svg
        svg
            .append('rect')
            .attr('width', width)
            .attr('height', height)
            .style('fill', 'none')
            .style('stroke', 'lightgray')
            .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

        // draw a grid
        let del = width / (this.tubeNum - 1);
        for (let i = 1; i < this.tubeNum; i++) {
            svg
                .append('line')
                .attr('x1', del * i)
                .attr('y1', 0)
                .attr('x2', del * i)
                .attr('y2', width)
                .style('stroke', 'lightgray')
                .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
            svg
                .append('line')
                .attr('x1', 0)
                .attr('y1', del * i)
                .attr('x2', height)
                .attr('y2', del * i)
                .style('stroke', 'lightgray')
                .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
        }

        // scales
        this.xScaleOpacity = d3.scaleLinear()
            .domain([0, 1])
            .range([margin.left, outerWidth - margin.left]);
        this.yScaleOpacity = d3.scaleLinear()
            .domain([0, 1])
            .range([outerHeight - margin.top, margin.bottom]);

        // Draw the explanation of the opacity curve
        svg.append('g')
            .attr('class', 'axisLabel opacityCurveXAxis')
            .append('text')
            .attr('x', outerWidth / 2)
            .attr('y', outerHeight - margin.bottom / 2 + 5)
            .style('fill', 'black')
            .style('text-anchor', 'middle')
            .style('font-size', 'xx-small')
            .text('Radial size of the tube');
        svg.append('g')
            .append('text')
            .attr('class', 'axisLabel opacityCurveYAxis')
            .attr('transform', 'rotate(-90)')
            .attr('x', - outerHeight / 2)
            .attr('y', margin.left / 2 + 2)
            .style('fill', 'black')
            .style('font-size', 'xx-small')
            .style('text-anchor', 'middle')
            .text('Opacity');


        svg.append('path')
            .datum(this.opacityDistSet.Default)
            .style('fill', 'none')
            .style('stroke', 'lightcoral')
            .style('stroke-width', 3)
            .attr('id', 'opacityCurvePath_' + this.id)
            .attr('d', d3.line()
                .x(function (d) {
                    return this.xScaleOpacity(d[0]);
                }.bind(this))
                .y(function (d) {
                    return this.yScaleOpacity(d[1]);
                }.bind(this))
                .curve(d3.curveBasis)
            );
    }

    setOpacityEllipse() {
        let outerWidth = 150, outerHeight = 150;
        let margin = {'top': 10, 'bottom': 10, 'left': 10, 'right': 10};
        let width = outerWidth - margin.left - margin.right;
        let height = outerHeight - margin.top - margin.bottom;
        let svg = d3.select('#opacityEllipse_' + this.id)
            .append('svg')
            .attr('width', outerWidth)
            .attr('height', outerHeight)
            .attr('id', 'opacityEllipseArea_' + this.id);

        // frame of the svg
        svg
            .append('rect')
            .attr('width', width)
            .attr('height', height)
            .style('fill', 'none')
            .style('stroke', 'lightgray')
            .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

        // make n ellipses with different radius and opacity values
        // rx = 50 * i / tubeNum
        // ry = 30 * i / tubbeNum
        let posX = Math.ceil(margin.left + width / 2),
            posY = Math.ceil(margin.top + height / 2);
        let points = this.opacityCurves.Default.getSpacedPoints(this.tubeNum);

        for (let i = 1; i <= this.tubeNum; i++) {
            let alpha = 1 - (1 - points[i - 1].y) / (1 - points[i].y);
            svg.append('ellipse')
                .attr('cx', posX)
                .attr('cy', posY)
                .attr('rx', 50 * i / this.tubeNum)
                .attr('ry', 30 * i / this.tubeNum)
                .attr('id', 'opacityEllipseEllipse_' + this.id + '-' + i)
                .style('fill', 'orange')
                .style('opacity', alpha);
        }
    }

    onChangeCheckbox(id) {
        TimeTubesAction.updateChecked(id);
        // this.setState({
        //     checked: !this.state.checked
        // });

        // let checked = this.state.checked;
        // checked[id] = !checked[id];
        // this.setState({
        //     checked: checked
        // });
    }

    zoomOutTimeTubes() {
        TimeTubesAction.zoomOutTimeTubes(this.id);
    }

    resetZoomTimeTubes() {
        TimeTubesAction.resetZoomTimeTubes(this.id);
    }

    zoomInTimeTubes() {
        TimeTubesAction.zoomInTimeTubes(this.id);
    }

    showPopoverFar() {
        let state = $('#changeFar_' + this.id).css('visibility');
        let leftPos = $('#farPopoverBtn_' + this.id).position();
        switch (state) {
            case 'visible':
                $('#changeFar_' + this.id).css('visibility', 'hidden');
                break;
            case 'hidden':
                $('#changeFar_' + this.id).css('left', leftPos.left);
                $('#changeFar_' + this.id).css('visibility', 'visible');
                $("#farSlider_" + this.id).slider('option', 'value', TimeTubesStore.getCameraProp(this.id).far);
                break;
        }
    }

    showPopoverPlotColor() {
        let state = $('#changePlotColor_' + this.id).css('visibility');
        let leftPos = $('#plotColorPopoverBtn_' + this.id).position();
        switch (state) {
            case 'visible':
                $('#changePlotColor_' + this.id).css('visibility', 'hidden');
                break;
            case 'hidden':
                $('#changePlotColor_' + this.id).css('left', leftPos.left);
                $('#changePlotColor_' + this.id).css('visibility', 'visible');
                break;
        }
    }

    showPopoverOpacity() {
        let state = $('#changeOpacity_' + this.id).css('visibility');
        let leftPos = $('#opacityPopoverBtn_' + this.id).position();
        switch (state) {
            case 'visible':
                $('#changeOpacity_' + this.id).css('visibility', 'hidden');
                break;
            case 'hidden':
                $('#changeOpacity_' + this.id).css('left', leftPos.left);
                $('#changeOpacity_' + this.id).css('visibility', 'visible');
                break;
        }
    }

    showPopoverColormap() {
        let state = $('#changeColormap_' + this.id).css('visibility');
        let leftPos = $('#colormapPopoverBtn_' + this.id).position();
        switch (state) {
            case 'visible':
                $('#changeColormap_' + this.id).css('visibility', 'hidden');
                break;
            case 'hidden':
                $('#changeColormap_' + this.id).css('left', leftPos.left);
                $('#changeColormap_' + this.id).css('visibility', 'visible');
                break;
        }
    }

    showPopoverSearch() {
        let state = $('#searchTime_' + this.id).css('visibility');
        let leftPos = $('#searchPopoverBtn_' + this.id).position();
        switch (state) {
            case 'visible':
                $('#searchTime_' + this.id).css('visibility', 'hidden');
                break;
            case 'hidden':
                $('#searchTime_' + this.id).css('left', leftPos.left);
                $('#searchTime_' + this.id).css('visibility', 'visible');
                break;
        }
    }

    searchTime() {
        let id = this.id;
        let dst = $('#searchTimeInput_' + id).val();
        if (!isNaN(dst) && dst != '') {
            TimeTubesAction.searchTime(id, Number(dst));
        }
    }

    changePlotColor(color, event) {
        TimeTubesAction.changePlotColor(this.id, color.hex);
    }

    changeColorMap() {
        $('#mask_uploadColormap_' + this.id).val($('#uploadColormap_' + this.id).val());
        let file = document.getElementById('uploadColormap_' + this.id).files;
        
        let reader = new FileReader();
        reader.readAsDataURL(file[0]);
        reader.onload = function() {
            let dataURL = reader.result;
            document.getElementById('colormap_' + this.id).style.backgroundImage = 'url(' + dataURL + ')';
            let textureTHREE = new THREE.TextureLoader();
            textureTHREE.load(dataURL, function(texture) {
                TimeTubesAction.updateTexture(this.id, texture);
            }.bind(this));
        }.bind(this);
    }

    changeColorMapMask() {
        $('#uploadColormap_' + this.id).click();
    }

    clickColormapOption(e) {
        let colormapType = e.target.className.split(' ')[1];
        let textureColormap = new THREE.TextureLoader();
        switch (colormapType) {
            case 'colormapBR':
                document.getElementById('colormap_' + this.id).style.backgroundImage = 'url(../img/1_256.png)';let textureTHREE = new THREE.TextureLoader();
                textureColormap.load('img/1_256.png', function(texture) {
                    TimeTubesAction.updateTexture(this.id, texture);
                }.bind(this));
                break;
            case 'colormapRGB':
                document.getElementById('colormap_' + this.id).style.backgroundImage = 'url(../img/RGB.png)';
                textureColormap.load('img/RGB.png', function(texture) {
                    TimeTubesAction.updateTexture(this.id, texture);
                }.bind(this));
                break;
            default:
                break;
        }
    }

    changeOpacityDistribution() {
        let opacityList = document.getElementById('opacityList_' + this.id);
        let selectedIdx = opacityList.selectedIndex;
        let selectedOpt = opacityList.options[selectedIdx].value;
        this.drawOpacityCurve(selectedOpt);
        this.drawOpacityEllipse(selectedOpt);
        TimeTubesAction.updateOpacity(this.id, selectedOpt);
    }

    updateColorEncodingOptionHue() {
        let optionList = document.getElementById('colorEncodingOptionHue_' + this.id);
        let selectedIdx = optionList.selectedIndex;
        let selectedOpt = optionList.options[selectedIdx].value;
        TimeTubesAction.updateColorEncodingOptionHue(this.id, selectedOpt);
    }

    updateColorEncodingOptionValue() {
        let optionList = document.getElementById('colorEncodingOptionValue_' + this.id);
        let selectedIdx = optionList.selectedIndex;
        let selectedOpt = optionList.options[selectedIdx].value;
        TimeTubesAction.updateColorEncodingOptionValue(this.id, selectedOpt);
    }

    drawOpacityCurve(opt) {
        d3.select('#opacityCurvePath_' + this.id)
            .remove();

        let svg = d3.select('#opacityCurveArea_' + this.id);

        svg.append('path')
            .datum(this.opacityDistSet[opt])
            .style('fill', 'none')
            .style('stroke', 'lightcoral')
            .style('stroke-width', 3)
            .attr('id', 'opacityCurvePath_' + this.id)
            .attr('d', d3.line()
                .x(function (d) {
                    return this.xScaleOpacity(d[0]);
                }.bind(this))
                .y(function (d) {
                    return this.yScaleOpacity(d[1]);
                }.bind(this))
                .curve(d3.curveBasis)
            );
    }

    drawOpacityEllipse(opt) {
        let alpha = 1;
        if (opt === 'Flat') {
            for (let i = 1; i <= this.tubeNum; i++) {
                d3.select('#opacityEllipseEllipse_' + this.id + '-' + i)
                    .style('opacity', alpha);
            }
        } else {
            let points = this.opacityCurves[opt].getSpacedPoints(this.tubeNum);
            for (let i = 1; i <= this.tubeNum; i++) {
                alpha = 1 - (1 - points[i - 1].y) / (1 - points[i].y);
                d3.select('#opacityEllipseEllipse_' + this.id + '-' + i)
                    .style('opacity', alpha);
            }
        }
    }

    render() {
        let cur = this.state.currentVal;
        let detailTable = [];
        for (let key in cur) {
            let val;
            if (key === 'z' || key === 'H') {
                val = cur[key].toFixed(3);
            } else if (key === 'V') {
                val = cur[key].toExponential(2);
            } else {
                val = cur[key].toFixed(4);
            }
            detailTable.push(<tr key={key + '_' + this.id} className='detailTableRow'><td className='detailTableData detailTableVari'>{this.lookup[key]}</td><td className='detailTableData'>{val}</td></tr>);
        }
        let viewportWidth = 500; //TODO: get interactively!
        // Z index
        // 10 ~ : check box for files
        // 20 ~ : zoom
        // 30 ~ : tube controllers
        // 11 : detail panel
        return (
            <div id={'onViewportControllers_' + this.id}>
                <div id={'fileSelector_' + this.id}
                     className='controllersOnView'
                     style={{position: 'absolute', color: 'white', top: '0px', left: '0px', zIndex:'10', fontSize: '0.8rem', marginLeft: '1.5rem'}}>
                    <input
                        type='checkbox'
                        id={'selectView_' + this.id}
                        name='selectView'
                        key={this.id}
                        value={this.id}
                        checked={this.state.checked}
                        onChange={this.onChangeCheckbox.bind(this, this.id)}/>
                    <label
                        id={'fileName_' + this.id}
                        style={{paddingLeft: '0.5rem', paddingRight: '0.5rem'}}>
                        {this.state.fileName}
                    </label>
                </div>
                <div id={'zoomControllers_' + this.id}
                     className='controllersOnView'
                     style={{position: 'absolute', top: '0px', right: '0px', zIndex: '20', fontSize: '0.8rem'}}>
                    <button type="button"
                            className="btn btn-sm btn-primary"
                            id={'zoomOutBtn_' + this.id}
                            onClick={this.zoomOutTimeTubes.bind(this)}>
                        -
                    </button>
                    <button type="button"
                            className="btn btn-sm btn-primary"
                            id={'resetZoomBtn_' + this.id}
                            onClick={this.resetZoomTimeTubes.bind(this)}>
                        □
                    </button>
                    <button type="button"
                            className="btn btn-sm btn-primary"
                            id={'zoomInBtn_' + this.id}
                            onClick={this.zoomInTimeTubes.bind(this)}>
                        +
                    </button>
                </div>
                <div id={'eachTubeControllers_' + this.id}
                     className='controllersOnView'
                     style={{position: 'absolute', bottom: '0px', left: '0px', zIndex:'30', fontSize: '0.8rem'}}>
                {/*    Add camera far, search box, color map*/}
                    <button type="button"
                            className="btn btn-sm btn-primary"
                            id={'colormapPopoverBtn_' + this.id}
                            onClick={this.showPopoverColormap.bind(this)}>
                        Colormap
                    </button>
                    <button type="button"
                            className="btn btn-sm btn-primary"
                            id={'farPopoverBtn_' + this.id}
                            onClick={this.showPopoverFar.bind(this)}>
                        Far
                    </button>
                    <button type="button"
                            className="btn btn-sm btn-primary"
                            id={'plotColorPopoverBtn_' + this.id}
                            onClick={this.showPopoverPlotColor.bind(this)}>
                        Plot Color
                    </button>
                    <button type="button"
                            className="btn btn-sm btn-primary"
                            id={'opacityPopoverBtn_' + this.id}
                            onClick={this.showPopoverOpacity.bind(this)}>
                        Opacity
                    </button>
                    <button type="button"
                            className="btn btn-sm btn-primary"
                            id={'searchPopoverBtn_' + this.id}
                            onClick={this.showPopoverSearch.bind(this)}>
                        Search
                    </button>
                </div>
                <div className="input-group input-group-sm popover-controller"
                    id={"changeColormap_" + this.id}
                    style={{visibility: 'hidden', position: 'absolute', bottom: '1.7rem', width: 'auto', zIndex:'31'}}>
                    <div id={"colorFilter_" + this.id}>
                        <div className="colormapController"
                            style={{alignItems: 'center', display:'flex'}}>
                            <div id={"colorValue_" + this.id} style={{float: 'left', height: this.colormapSize + 'px'}}>
                                <output id={"colorValueMax_" + this.id} style={{marginLeft: '1.3rem'}}></output>
                                <output id={"colorValueMin_" + this.id} style={{marginLeft: '1.3rem'}}></output>
                            </div>
                            <div id={"colorMapArea_" + this.id}  className='colormapArea' style={{float: 'left', marginLeft: '10px'}}>
                                <input type="file" className="custom-file-input colormapFile" id={"uploadColormap_" + this.id} onChange={this.changeColorMap.bind(this)}/>
                                <label className="fileMask">
                                    <span id={'colormap_' + this.id}>
                                        <input type="text" id={"mask_uploadColormap_" + this.id} className='colormapFile' onClick={this.changeColorMapMask.bind(this)}></input>
                                    </span>
                                </label>
                                <span 
                                    className='currentColor' 
                                    id={'currentColorPlot_' + this.id}
                                    ></span>
                            </div>
                            <div style={{clear:'both'}}></div>
                        </div>
                        <div id={"colorHue_" + this.id} style={{width: this.colormapSize + 'px', marginTop: '5px', marginLeft: '20px'}}>
                            <output id={"colorHueMax_" + this.id} style={{bottom: '1.3rem'}}></output>
                            <output id={"colorHueMin_" + this.id} style={{bottom: '1.3rem'}}></output>
                        </div>
                        <div 
                            id={'colormapOptions_' + this.id}
                            className='colormapOptions'>
                                    <img src="img/1_256.png" 
                                        className='colormapOption colormapBR'
                                        id={'colormapBR_' + this.id}
                                        style={{width: '30px', height: '30px'}}
                                        onClick={this.clickColormapOption.bind(this)}/>
                                    <img src="img/RGB.png" 
                                        className='colormapOption colormapRGB'
                                        id={'colormapRGB_' + this.id}
                                        style={{width: '30px', height: '30px'}}
                                        onClick={this.clickColormapOption.bind(this)}/>
                        </div>
                        <div className="row">
                            <div className="col-3">
                                V-J
                            </div>
                            <div className="col">
                                <div className="form-group">
                                    <select 
                                        className="custom-select" 
                                        id={"colorEncodingOptionHue_" + this.id}
                                        style={{fontSize: '0.8rem', height: '1.5rem'}}
                                        onChange={this.updateColorEncodingOptionHue.bind(this)}>
                                        <option value="default">Default</option>
                                        <option value="histogramEqualization">Histogram Equalization</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="row">
                            <div className="col-3">
                                Flx(V)
                            </div>
                            <div className="col">
                                <div className="form-group">
                                    <select 
                                        className="custom-select" 
                                        id={"colorEncodingOptionValue_" + this.id}
                                        style={{fontSize: '0.8rem', height: '1.5rem'}}
                                        onChange={this.updateColorEncodingOptionValue.bind(this)}>
                                        <option value="default">Default</option>
                                        <option value="histogramEqualization">Histogram Equalization</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="input-group input-group-sm popover-controller"
                    id={"changeFar_" + this.id}
                    style={{visibility: 'hidden', position: 'absolute', bottom: '1.7rem', width: 'auto', zIndex:'32'}}>
                    <div id={'farSliderArea_' + this.id}>
                        <label id={'idLabel_' + this.id} style={{float: 'left', width: '2rem'}}>far</label>
                        <div id={'farSlider_' + this.id}
                            style={{float: 'left', width: '8rem', marginBottom: '.5rem', marginTop: '.5rem'}}>
                            {/* onChange={this.changeFar.bind(this)}>*/}
                            <output id={"farSliderVal_" + this.id}
                                    style={{
                                        position: 'absolute',
                                        display:'none',
                                        top: '-30px',
                                        backgroundColor: '#fff',
                                        opacity: '0.8',
                                        borderRadius: '3px',
                                        color: '#777',
                                        padding: '2px'
                            }}></output>
                        </div>
                    </div>
                </div>
                <div className="input-group input-group-sm popover-controller"
                    id={"changePlotColor_" + this.id}
                    style={{visibility: 'hidden', position: 'absolute', bottom: '1.7rem', width: 'auto', zIndex:'33'}}>
                    <SketchPicker
                        presetColors={TimeTubesStore.getPresetColors()}
                        color={TimeTubesStore.getPlotColor(this.id)}
                        onChange={this.changePlotColor.bind(this)}/>
                </div>
                <div className="input-group input-group-sm popover-controller"
                     id={"changeOpacity_" + this.id}
                     style={{visibility: 'hidden', position: 'absolute', bottom: '1.7rem', width: 'auto', zIndex:'34', display: 'block'}}>
                    <select
                        className="form-control"
                        id={'opacityList_' + this.id}
                        onChange={this.changeOpacityDistribution.bind(this)}
                        style={{fontSize: '0.8rem', width: '150px'}}>
                        <option value='Default'>Default</option>
                        <option value='Flat'>Flat</option>
                        <option value='Linear'>Linear</option>
                        <option value='Valley'>Valley shaped</option>
                    </select>
                    <div className={'currentOpacity'}
                         style={{display: 'flex'}}>
                        <div id={'opacityCurve_' + this.id}></div>
                        <div id={'opacityEllipse_' + this.id}></div>
                    </div>
                </div>
                <div className="input-group input-group-sm popover-controller"
                     id={"searchTime_" + this.id}
                     style={{visibility: 'hidden', position: 'absolute', bottom: '1.7rem', width: '10rem', zIndex:'35'}}>
                    <input type="text"
                           className="form-control custom-input"
                           id={"searchTimeInput_" + this.id}
                           placeholder="Input JD"/>
                    <button className="btn btn-primary btn-sm"
                            type="button"
                            id={"searchTimeBtn_" + this.id}
                            onClick={this.searchTime.bind(this)} >Search</button>
                </div>
                <div id='detailValueArea'
                     className='controllersOnView'
                     style={{position: 'absolute', color: 'white', right: '0px', bottom: '0px', whiteSpace: 'pre-line', zIndex:'11', fontSize: '0.8rem'}}>
                    <table className='detailTable'>
                        <tbody className='detailTableBody'>
                            {detailTable}
                        </tbody>
                    </table>
                    {/*{detail}*/}
                </div>
                {/*<ul>{this.state.currentVal}</ul>*/}
            </div>
        )
    }
}
