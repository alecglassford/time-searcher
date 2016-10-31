'use strict';

///////////////////////////// globals + set up   ///////////////////////////
var DRILLDOWN = window.location.search.includes('?drilldown');
if (DRILLDOWN) {
    d3.select('#toggle-drilldown')
        .attr('href', '/')
        .text('Return to the original visualization.');
}
var WEEK = 1000 * 60 * 60 * 24 * 7; // ms in a week

var margin = 50,
    svg = d3.select('svg'),
    width = DRILLDOWN ? svg.attr('width')/2 - 2 * margin : svg.attr('width') - 2 * margin,
    height = svg.attr('height') - 2 * margin,
    canvas = svg.append('g').attr('transform', 'translate(' + margin + ',' + margin + ')');
if (DRILLDOWN) {
    var drilldown_canvas = svg.append('g').attr('transform', 'translate(' + String(width + 2 * margin) + ',' + margin + ')');
}
var stocks, x, y, boxData = [];

// data parser
var parseDate = d3.timeParse('%m/%d/%y');
function parse(d) {
    d.date = parseDate(d.date);
    return d;
}

////////////////////////////// For drawing boxes /////////////////////////////

// Invisible background rectangle for dragability
canvas.append('rect')
    .attr('width', width)
    .attr('height', height)
    .attr('opacity', 0.1);
var drag = d3.drag();
canvas.call(drag.on('start', startBox))
    .call(drag.on('end', endBox))
    .call(drag.on('drag', dragBox));

// The three event listeners for dragging
function startBox() {
    boxData.push({startX: d3.event.x - margin, startY: d3.event.y - margin});
}
function endBox() { // The case where the user just clicks, doesn't drag
    var recentBox = boxData[boxData.length - 1];
    if (!recentBox.hasOwnProperty('endX') ||
        !recentBox.hasOwnProperty('endY') ||
        Math.abs(x.invert(recentBox.endX) - x.invert(recentBox.startX)) < WEEK) {
        boxData.pop();
    }
    updateBoxes();
}
function dragBox() {
    boxData[boxData.length - 1].endX = Math.max(0, Math.min(d3.event.x - margin, width));
    boxData[boxData.length - 1].endY = Math.max(0, Math.min(d3.event.y - margin, height));
    displayFilteredStocks();
    updateBoxes();
}

function resizeBox(d, i) {
    var currX = Math.max(0, Math.min(d3.event.x, width));
    var currY = Math.max(0, Math.min(d3.event.y, height));
    if (Math.abs(d.endX - currX) < Math.abs(d.startX - currX)) {
        d.endX = currX;
    }
    else {
        d.startX = currX;
    }
    if (Math.abs(d.endY - currY) < Math.abs(d.startY - currY)) {
        d.endY = currY;
    }
    else {
        d.startY = currY;
    }
    displayFilteredStocks();
    updateBoxes();
}
function endResizeBox(d, i) {
    if (Math.abs(x.invert(d.endX) - x.invert(d.startX)) < WEEK) {
        boxData.splice(i, 1);
    }
    displayFilteredStocks();
    updateBoxes();
}

function updateBoxes() {
    var singleBoxDrag = d3.drag(); // I HAVE NO IDEA WHY THIS FIXED MY BUG :-/
    var boxes = canvas.selectAll('.box')
        .data(boxData);

    boxes.exit().remove();

    boxes.enter()
        .append('rect')
        .attr('class', 'box')
        .call(singleBoxDrag.on('drag', resizeBox))
        .call(singleBoxDrag.on('end', endResizeBox))
        .merge(boxes)
        .attr('x', function(d) { return Math.min(d.startX, d.endX); })
        .attr('y', function(d) { return Math.min(d.startY, d.endY); })
        .attr('width', function(d) { return Math.abs(d.endX - d.startX); })
        .attr('height', function(d) { return Math.abs(d.endY - d.startY); });
}

function clearBoxes() {
    boxData = [];
    displayFilteredStocks();
    updateBoxes();
}
d3.select('#clear-boxes').on('click', clearBoxes);
d3.select('body').on('keydown', function() {
    if (d3.event.key === 'Escape') {
        clearBoxes();
    }
});
////////////////////////////// End drawing boxes /////////////////////////////

function drawChart(stocks, canvas) {
    // x axis
    canvas.append('g')
        .attr('class', 'axis axis--x')
        .attr('transform', 'translate(0,' + height + ')')
        .call(d3.axisBottom(x))
            .append('text')
            .attr('class', 'axis-label')
            .attr('transform', 'translate(' + width + ',' + (margin/4) + ')')
            .text('time');

    // y axis
    canvas.append('g')
        .attr("class", "axis axis--y")
        .call(d3.axisLeft(y))
            .append('text')
            .attr('class', 'axis-label')
            .attr('transform', 'translate(' + (margin/2) + ',' + (-margin/4) + ')')
            .text('stock price ($)');

    var line = d3.line()
        .x(function(d) { return x(d.date); })
        .y(function(d) { return y(d.price); });

    var stockLines = canvas.selectAll('.stock-line')
        .data(stocks)
        .enter()
        .append('g')
        .attr('class', function(d) { return 'stock-line foreground symbol-' + d.tickerSymbol; });

    stockLines.append('path')
        .attr('class', 'buffer')
        .attr('d', function(d) { return line(d.values);});
    stockLines.append('path')
        .attr('class', 'main-line')
        .attr('d', function(d) { return line(d.values);});
    stockLines.append('text')
        .attr('class', 'stock-label')
        .attr('transform', function(d) {
            return 'translate(' +
                width + ',' +
                y(d.values[d.values.length -1].price) + ')';
        })
        .text(function(d) { return d.tickerSymbol; });
}

function filterStocks() {
    var filteredStocks = stocks;
    for (var boxIndex in boxData) {
        var boxDatum = boxData[boxIndex];
        var min_price = y.invert(Math.max(boxDatum.startY, boxDatum.endY));
        var max_price = y.invert(Math.min(boxDatum.startY, boxDatum.endY));
        var start_time = x.invert(Math.min(boxDatum.startX, boxDatum.endX));
        var end_time = x.invert(Math.max(boxDatum.startX, boxDatum.endX));
        filteredStocks = filteredStocks.filter(function(stock) {
            for (var valIndex in stock.values) {
                var value = stock.values[valIndex];
                if (value.date < start_time) {continue;}
                if (value.date > end_time) {break;}
                if (value.price < min_price || value.price > max_price) {return false;}
            }
            return true;
        });
    }
    return filteredStocks;
}

function displayFilteredStocks() {
    var filteredStocks = filterStocks();
    var foregroundLines = canvas.selectAll('.stock-line')
        .data(filteredStocks, function(d) { return d.tickerSymbol; });
    foregroundLines.exit().classed('foreground', false);
    foregroundLines.classed('foreground', true);
    if (DRILLDOWN) {updateDrilldown(filteredStocks);}
}

function updateDrilldown(filteredStocks) {
    var drilldown_y = d3.scaleLinear()
        .domain([
            d3.min(filteredStocks, function(stock) {
                return d3.min(stock.values, function(d) { return d.price; });
            }),
            d3.max(filteredStocks, function(stock) {
                return d3.max(stock.values, function(d) { return d.price; });
            })
        ])
        .range([height, 0]);
    drilldown_canvas.select('.axis--y').call(d3.axisLeft(drilldown_y));

    var drilldown_line = d3.line()
        .x(function(d) { return x(d.date); })
        .y(function(d) { return drilldown_y(d.price); });

    var drilldownLines = drilldown_canvas.selectAll('.stock-line')
        .data(filteredStocks, function (d) { return d.tickerSymbol; });

    // Remove stocks that are filtered out
    drilldownLines.exit().remove();

    // Add stocks that are filtered in
    var newLines = drilldownLines.enter()
        .append('g')
        .attr('class', function(d) { return 'stock-line foreground symbol-' + d.tickerSymbol; });
    newLines.append('path').attr('class', 'buffer');
    newLines.append('path').attr('class', 'main-line');
    newLines.append('text').attr('class', 'stock-label')
        .text(function(d) { return d.tickerSymbol; });

    // Rescale/redraw lines
    drilldownLines = newLines.merge(drilldownLines);
    drilldownLines.selectAll('.buffer')
        .attr('d', function(d) { return drilldown_line(d.values);});
    drilldownLines.selectAll('.main-line')
        .attr('d', function(d) { return drilldown_line(d.values);});
    drilldownLines.selectAll('.stock-label')
        .attr('transform', function(d) {
            return 'translate(' +
                width + ',' +
                drilldown_y(d.values[d.values.length -1].price) + ')';
        });
}

d3.csv('data/stock_data.csv', parse, function(error, data) {
    if (error) {
        return console.warn(error);
    }

    // Data processing (and much else)
    // inspired by https://bl.ocks.org/mbostock/3884955
    stocks = data.columns.slice(1).map(function(tickerSymbol) {
        return {
            tickerSymbol: tickerSymbol.trim(),
            values: data.map(function(d) {
                return {date: d.date, price: +d[tickerSymbol]};
            })
        };
    });

    x = d3.scaleTime()
        .domain(d3.extent(data, function(d) { return d.date; }))
        .range([0, width]);
    y = d3.scaleLinear()
        .domain([
            d3.min(stocks, function(stock) {
                return d3.min(stock.values, function(d) { return d.price; });
            }),
            d3.max(stocks, function(stock) {
                return d3.max(stock.values, function(d) { return d.price; });
            })
        ])
        .range([height, 0]);

    drawChart(stocks, canvas);
    if (DRILLDOWN) {
        drawChart(stocks, drilldown_canvas);
        drilldown_canvas.append('text')
            .attr('text-anchor', 'middle')
            .attr('transform', 'translate(' + (width/2) + ',' + (-margin/4) + ')')
            .text('Selected stocks (view only, drag on other chart)');
    }
});

// Just for fun
d3.select('#select-stock').on('input', function() {
    d3.selectAll('.requested').classed('requested', false);
    if (this.value) {
        var symbol = this.value.toUpperCase();
        d3.selectAll('.symbol-' + symbol).classed('requested', true);
    }
});
