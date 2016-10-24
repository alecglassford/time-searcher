'use strict';

var margin = 50,
    svg = d3.select('svg'),
    width = svg.attr('width') - 2 * margin,
    height = svg.attr('height') - 2 * margin,
    canvas = svg.append('g').attr('transform', 'translate(' + margin + ',' + margin + ')');

// Invisible background rectangle for dragability
canvas.append('rect')
    .attr('width', width)
    .attr('height', height)
    .attr('opacity', 0);

var boxData = [];

var drag = d3.drag();
canvas.call(drag.on('start', startBox))
    .call(drag.on('drag', dragBox));
function startBox() {
    boxData.push({startX: d3.event.x, startY: d3.event.y});
    console.log(boxData);
}
function dragBox() {
    boxData[boxData.length - 1].endX = d3.event.x;
    boxData[boxData.length - 1].endY = d3.event.y;
    updateBoxes();
}

function updateBoxes() {
    var boxes = canvas.selectAll('.box')
        .data(boxData);

    boxes.enter()
        .append('rect')
        .attr('class', 'box')
        .merge(boxes)
        .attr('transform', 'translate(' + -margin + ',' + -margin + ')')
        .attr('x', function(d) { return Math.min(d.startX, d.endX); })
        .attr('y', function(d) { return Math.min(d.startY, d.endY); })
        .attr('width', function(d) { return Math.abs(d.endX - d.startX); })
        .attr('height', function(d) { return Math.abs(d.endY - d.startY); });
}

var parseDate = d3.timeParse('%m/%d/%y');
function parse(d) {
    d.date = parseDate(d.date);
    return d;
}

d3.csv('data/stock_data.csv', parse, function(error, data) {
    if (error) {
        return console.warn(error);
    }

    // Data processing (and much else)
    // inspired by https://bl.ocks.org/mbostock/3884955
    var stocks = data.columns.slice(1).map(function(tickerSymbol) {
        return {
            tickerSymbol: tickerSymbol.trim(),
            values: data.map(function(d) {
                return {date: d.date, price: +d[tickerSymbol]};
            })
        };
    });

    console.log(stocks);

    var x = d3.scaleTime()
        .domain(d3.extent(data, function(d) { return d.date; }))
        .range([0, width]);
    var y = d3.scaleLinear()
        .domain([
            d3.min(stocks, function(stock) {
                return d3.min(stock.values, function(d) { return d.price; });
            }),
            d3.max(stocks, function(stock) {
                return d3.max(stock.values, function(d) { return d.price; });
            })
        ])
        .range([height, 0]);

    // x axis
    canvas.append('g')
        .attr('class', 'axis axis--x')
        .attr('transform', 'translate(0,' + height + ')')
        .call(d3.axisBottom(x));

    // y axis
    canvas.append('g')
        .attr("class", "axis axis--y")
        .call(d3.axisLeft(y));

    var line = d3.line()
        .x(function(d) { return x(d.date); })
        .y(function(d) { return y(d.price); });

    var stockLines = canvas.selectAll('.stock-line')
        .data(stocks)
        .enter()
        .append('g')
        .attr('class', 'stock-line')
        .on('mouseover', function(d) {
            d3.select(this).select('text')
                .style('visibility', 'visible');
        })
        .on('mouseout', function(d) {
            d3.select(this).select('text')
                .style('visibility', 'hidden');
        });

    stockLines.append('path')
        .attr('d', function(d) { return line(d.values);});

    stockLines.append('path')
        .attr('class', 'buffer')
        .attr('d', function(d) { return line(d.values);});

    stockLines.append('text')
        .attr('transform', function(d) {
            return 'translate(' +
                x(d.values[d.values.length -1].date) + ',' +
                y(d.values[d.values.length -1].price) + ')';
        })
        .text(function(d) { return d.tickerSymbol; })
        .style('visibility', 'hidden');
});
