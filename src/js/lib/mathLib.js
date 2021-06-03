export function getGaussData(sigma) {
    let data = [];
    if (sigma > 0) {
        for (let i = -4; i <= 4; i++) {
            let gauss = Math.exp(-i * i / (2 * sigma * sigma)) / Math.sqrt(2 * Math.PI * sigma * sigma);
            data.push({x: i, y: gauss});
        }
    } else {
        data.push({x: -1, y: 1});
        data.push({x: 1, y: 1});
    }
    return data;
}

export function getGaussValue(xPos, sigma) {
    return Math.exp(- Math.pow(xPos, 2) / (2 * Math.pow(sigma, 2))) / Math.sqrt(2 * Math.PI * Math.pow(sigma, 2));
}

export function ordinalSuffixOf(num) {
    let i = num % 10,
        j = num % 100;
    if (i == 1 && j != 11) {
        return num + "st";
    }
    if (i == 2 && j != 12) {
        return num + "nd";
    }
    if (i == 3 && j != 13) {
        return num + "rd";
    }
    return num + "th";
}

export function objectSum(a, b) {
    let result = {};
    if (typeof(a) == 'object' && typeof(b) == 'object') {
        for (let key in a) {
            if (typeof(a[key]) == 'number')
                result[key] = a[key] + b[key];
        }
    } else if (typeof(a) == 'number') {
        for (let key in b) {
            if (typeof(b[key]) == 'number')
                result[key] = a + b[key];
        }
    } else if (typeof(b) == 'number') {
        for (let key in a) {
            if (typeof(a[key]) == 'number')
                result[key] = a[key] + b;
        }
    }
    return result;
}

export function objectSub(a, b) {
    let result = {};
    if (typeof(a) == 'object' && typeof(b) == 'object') {
        for (let key in a) {
            if (typeof(a[key]) == 'number')
                result[key] = a[key] - b[key];
        }
    } else if (typeof(a) == 'number') {
        for (let key in b) {
            if (typeof(b[key]) == 'number')
                result[key] = a - b[key];
        }
    } else if (typeof(b) == 'number') {
        for (let key in a) {
            if (typeof(a[key]) == 'number')
                result[key] = a[key] - b;
        }
    }
    return result;
}

export function objectMul(a, b) {
    let result = {};
    if (typeof(a) == 'object' && typeof(b) == 'object') {
        for (let key in a) {
            if (typeof(a[key]) == 'number')
                result[key] = a[key] * b[key];
        }
    } else if (typeof(a) == 'number') {
        for (let key in b) {
            if (typeof(b[key]) == 'number')
                result[key] = a * b[key];
        }
    } else if (typeof(b) == 'number') {
        for (let key in a) {
            if (typeof(a[key]) == 'number')
                result[key] = a[key] * b;
        }
    }
    return result;
}

export function objectDiv(a, b) {
    let result = {};
    if (typeof(a) == 'object' && typeof(b) == 'object') {
        for (let key in a) {
            if (typeof(a[key]) == 'number')
                result[key] = a[key] / b[key];
        }
    } else if (typeof(a) == 'number') {
        for (let key in b) {
            if (typeof(b[key]) == 'number')
                result[key] = a / b[key];
        }
    } else if (typeof(b) == 'number') {
        for (let key in a) {
            if (typeof(a[key]) == 'number')
                result[key] = a[key] / b;
        }
    }
    return result;
}

export function objectAbsSub(a, b) {
    let result = {};
    if (typeof(a) == 'object' && typeof(b) == 'object') {
        for (let key in a) {
            if (typeof(a[key]) == 'number')
                result[key] = Math.abs(a[key] - b[key]);
        }
    } else if (typeof(a) == 'number') {
        for (let key in b) {
            if (typeof(b[key]) == 'number')
                result[key] = Math.abs(a - b[key]);
        }
    } else if (typeof(b) == 'number') {
        for (let key in a) {
            if (typeof(a[key]) == 'number')
                result[key] = Math.abs(a[key] - b);
        }
    }
    return result;
}

export function objectTotal(data, exceptions) {
    let total = 0;
    if (exceptions) {
        for (let key in data) {
            if (exceptions.indexOf(key) < 0) 
                total += data[key];
        }
    } else {
        for (let key in data) {
            total += data[key];
        }
    }
    return total;
}
