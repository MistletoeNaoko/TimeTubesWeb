export function tickFormatting(value) {
    let result = value;
    if (Math.log10(Math.abs(value)) < -2 && value !== 0) {
        result = value.toExponential(0);
    }
    return result;
}

export function formatValue(value) {
    value = Number(value);
    let result;
    if (Math.log10(Math.abs(value)) < -2 && value !== 0) {
        result = value.toExponential(1);
    } else {
        result = value.toFixed(2);
    }
    return result;
}
