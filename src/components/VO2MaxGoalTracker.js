import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const VO2MaxGoalTracker = ({ goalData = {} }) => {
  // DOM references
  const chartRef = useRef(null);
  const tooltipRef = useRef(null);
  
  // Set default values for safety
  const { 
    initial = 46, 
    current = 48, 
    target = 53, 
    createdAt = new Date('2025-02-13').toISOString(), 
    targetDate = new Date('2025-04-10').toISOString()
  } = goalData;
  
  const startDate = new Date(createdAt);
  const endDate = new Date(targetDate);
  const today = new Date();
  
  // Calculate key metrics
  const totalDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
  const daysElapsed = Math.round((today - startDate) / (1000 * 60 * 60 * 24));
  const percentComplete = Math.min(1, Math.max(0, daysElapsed / totalDays));
  
  // Expected progress value for today (linear)
  const expectedCurrent = initial + ((target - initial) * percentComplete);
  
  // Determine if on track
  const isOnTrack = current >= expectedCurrent;
  const difference = Math.abs(current - expectedCurrent).toFixed(1);
  
  // Format date for display
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  
  
 // Create the chart using D3
useEffect(() => {
    if (!chartRef.current) return;
  
    // Clear previous chart
    d3.select(chartRef.current).selectAll("*").remove();
    
    // Generate data points for actual progress (with interpolated points for smoothness)
    const actualData = [];
    
    // Add weekly data points between start and today for smoother curve
    const weeksBetween = Math.max(1, Math.floor(daysElapsed / 7));
    
    for (let i = 0; i <= weeksBetween; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + (i * 7));
      
      // Don't go past today
      if (date > today) break;
      
      // Linear interpolation for the smooth progress curve
      const progress = i / weeksBetween;
      const value = initial + ((current - initial) * progress);
      
      actualData.push({
        date: date,
        value: value,
        type: 'actual'
      });
    }
    
    // Ensure today's exact value is included
    if (actualData[actualData.length - 1].date < today) {
      actualData.push({
        date: today,
        value: current,
        type: 'actual'
      });
    }
    
    // Add target point
    const targetPoint = {
      date: endDate,
      value: target,
      type: 'target'
    };
    
    // Expected trend data (start to end)
    const expectedData = [
      {
        date: startDate,
        value: initial,
        type: 'expected'
      },
      {
        date: endDate,
        value: target,
        type: 'expected'
      }
    ];
  
    // Chart dimensions
    const margin = { top: 20, right: 20, bottom: 30, left: 30 };
    const width = chartRef.current.clientWidth - margin.left - margin.right;
    const height = 180 - margin.top - margin.bottom;
  
    // Create SVG with a clipping path for the area chart
    const svg = d3.select(chartRef.current)
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // Add clipping path to ensure the area doesn't overflow
    svg.append("defs").append("clipPath")
      .attr("id", "chart-area")
      .append("rect")
      .attr("width", width)
      .attr("height", height);
  
    // Create scales
    const xScale = d3.scaleTime()
      .domain([startDate, endDate])
      .range([0, width]);
  
    // Find min and max Y values with some padding
    const minValue = Math.floor(Math.min(initial, current, target) - 2);
    const maxValue = Math.ceil(Math.max(initial, current, target) + 2);
  
    const yScale = d3.scaleLinear()
      .domain([minValue, maxValue])
      .range([height, 0]);
      
    // Create target zone area (light colored background area)
    const targetZone = [
      { date: startDate, value: initial },
      { date: today, value: expectedCurrent },
      { date: endDate, value: target },
      { date: endDate, value: minValue },
      { date: startDate, value: minValue }
    ];
    
    svg.append("path")
      .datum(targetZone)
      .attr("fill", "#6366f122")
      .attr("d", d3.area()
        .x(d => xScale(d.date))
        .y0(d => {
          if (d.date === startDate || d.date === endDate) {
            return height;
          }
          return yScale(d.value);
        })
        .y1(d => {
          if (d.value === minValue) {
            return height;
          }
          return yScale(d.value);
        })
        .curve(d3.curveCatmullRom.alpha(0.5))
      );
  
    // Add subtle grid with minimalist y-axis labels
    const gridLines = svg.append("g")
      .attr("class", "grid");
      
    // Add grid lines
    gridLines.selectAll("line")
      .data(yScale.ticks(5))
      .enter()
      .append("line")
      .attr("x1", 0)
      .attr("x2", width)
      .attr("y1", d => yScale(d))
      .attr("y2", d => yScale(d))
      .attr("stroke", "#374151")
      .attr("stroke-width", 0.5);
      
    // Add minimalist y-axis labels
    gridLines.selectAll(".y-axis-label")
      .data(yScale.ticks(5))
      .enter()
      .append("text")
      .attr("class", "y-axis-label")
      .attr("x", -5)
      .attr("y", d => yScale(d))
      .attr("dy", "0.32em")
      .attr("text-anchor", "end")
      .attr("fill", "#9ca3af")
      .style("font-size", "10px")
      .text(d => d);
      
    // Create line with curved interpolation
    const line = d3.line()
      .x(d => xScale(d.date))
      .y(d => yScale(d.value))
      .curve(d3.curveCatmullRom.alpha(0.5)); // Smoother curve
      
    // Create area generator for the progress area
    const area = d3.area()
      .x(d => xScale(d.date))
      .y0(height)
      .y1(d => yScale(d.value))
      .curve(d3.curveCatmullRom.alpha(0.5));
      
    // Add progress area with gradient
    const progressGroup = svg.append("g")
      .attr("clip-path", "url(#chart-area)");
      
    // Create gradient
    const gradient = svg.append("defs")
      .append("linearGradient")
      .attr("id", "progress-gradient")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "0%")
      .attr("y2", "100%");
      
    gradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#10b981")
      .attr("stop-opacity", 0.7);
      
    gradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#10b981")
      .attr("stop-opacity", 0.1);
      
    // Add area chart for actual progress
    progressGroup.append("path")
      .datum(actualData)
      .attr("fill", "url(#progress-gradient)")
      .attr("d", area);
    
    // Add expected trend line (subtle blue dashed)
    svg.append("path")
      .datum(expectedData)
      .attr("fill", "none")
      .attr("stroke", "#6366f1")
      .attr("stroke-opacity", 0.5)
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "4,4")
      .attr("d", line);
      
    // Add actual progress line on top of area
    svg.append("path")
      .datum(actualData)
      .attr("fill", "none")
      .attr("stroke", "#10b981")
      .attr("stroke-width", 2.5)
      .attr("d", line);
      
    // Today indicator
    svg.append("line")
      .attr("x1", xScale(today))
      .attr("x2", xScale(today))
      .attr("y1", 0)
      .attr("y2", height)
      .attr("stroke", "#d1d5db")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "2,2");
      
    // Add key points with glow effect
    const defs = svg.append("defs");
    
    // Glow filter for the points
    const filter = defs.append("filter")
      .attr("id", "glow")
      .attr("x", "-50%")
      .attr("y", "-50%")
      .attr("width", "200%")
      .attr("height", "200%");
    
    filter.append("feGaussianBlur")
      .attr("stdDeviation", "2.5")
      .attr("result", "coloredBlur");
    
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode")
      .attr("in", "coloredBlur");
    feMerge.append("feMergeNode")
      .attr("in", "SourceGraphic");
    
    // Add starting point
    svg.append("circle")
      .attr("cx", xScale(startDate))
      .attr("cy", yScale(initial))
      .attr("r", 5)
      .attr("fill", "#10b981")
      .attr("stroke", "#1f2937")
      .attr("stroke-width", 2);
    
    // Add current point with glow
    svg.append("circle")
      .attr("cx", xScale(today))
      .attr("cy", yScale(current))
      .attr("r", 6)
      .attr("fill", "#10b981")
      .attr("stroke", "#1f2937")
      .attr("stroke-width", 2)
      .style("filter", "url(#glow)");
    
    // Add target point
    svg.append("circle")
      .attr("cx", xScale(endDate))
      .attr("cy", yScale(target))
      .attr("r", 5)
      .attr("fill", "#f59e0b")
      .attr("stroke", "#1f2937")
      .attr("stroke-width", 2);
      
    // Add minimal X axis (just start and end dates)
    svg.append("text")
      .attr("x", 0)
      .attr("y", height + 20)
      .attr("fill", "#9ca3af")
      .style("font-size", "12px")
      .text(formatDate(startDate));
      
    svg.append("text")
      .attr("x", width)
      .attr("y", height + 20)
      .attr("text-anchor", "end")
      .attr("fill", "#9ca3af")
      .style("font-size", "12px")
      .text(formatDate(endDate));
      
    // Add tooltip functionality
    const tooltip = d3.select(tooltipRef.current);
    
    // Enhanced tooltip for all points
    svg.selectAll("circle")
      .on("mouseover", (event, d) => {
        const circle = d3.select(event.target);
        circle.transition()
          .duration(200)
          .attr("r", d => parseFloat(circle.attr("r")) + 2);
        
        const pointDate = new Date(circle.attr("cx") ? xScale.invert(circle.attr("cx")) : today);
        const pointValue = circle.attr("cy") ? yScale.invert(circle.attr("cy")).toFixed(1) : current;
        const pointType = circle.attr("fill") === "#f59e0b" ? "Target" : "Actual";
        
        tooltip
          .style("opacity", 1)
          .style("left", `${event.pageX + 10}px`)
          .style("top", `${event.pageY - 30}px`)
          .html(`
            <div class="p-2">
              <div class="font-medium">${formatDate(pointDate)}</div>
              <div class="text-${pointType === 'Target' ? 'amber' : 'green'}-400">
                ${pointType}: ${pointValue}
              </div>
            </div>
          `);
      })
      .on("mousemove", (event) => {
        tooltip
          .style("left", `${event.pageX + 10}px`)
          .style("top", `${event.pageY - 30}px`);
      })
      .on("mouseout", (event) => {
        const circle = d3.select(event.target);
        circle.transition()
          .duration(200)
          .attr("r", circle.attr("fill") === "#f59e0b" ? 5 : 6);
        
        tooltip.style("opacity", 0);
      });
      
  }, [initial, current, target, createdAt, targetDate, startDate, endDate, today, expectedCurrent]);


  // Calculate days remaining
  const daysRemaining = totalDays - daysElapsed;
  
  return (
    <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-white">VO2 Max Progress</h3>
        
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
          isOnTrack ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
        }`}>
          {isOnTrack ? 'On Track' : 'Catch Up Needed'}
        </div>
      </div>
      
      
      {/* D3 Chart */}
      <div className="relative">
        <div ref={chartRef} className="w-full"></div>
        <div 
          ref={tooltipRef} 
          className="absolute bg-gray-800 border border-gray-700 rounded shadow-lg text-sm pointer-events-none z-10"
          style={{ opacity: 0 }}
        ></div>
      </div>
    </div>
  );
};

export default VO2MaxGoalTracker;