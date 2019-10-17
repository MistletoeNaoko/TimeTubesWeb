export function tickFormatting(d) {
    let result = d;
    if (Math.log10(Math.abs(d)) < -2 && d !== 0) {
        result = d.toExponential(0);
    }
    return result;
}
