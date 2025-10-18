// TODO: Import necessary D3 or other charting libraries if used explicitly

let chartContainer = null;
let svg = null;
let chartGroup = null;
let dotsGroup = null;
let chartWidth = 800; // Default dimensions
let chartHeight = 600;
let resizeTimer = null;
let isDarkTheme = false;

/**
 * Initializes the chart container and SVG element.
 * Should be called once when the chart component mounts.
 * @param {string} containerId The ID of the DOM element to contain the chart.
 * @param {boolean} [initialDarkTheme=false] Whether dark theme is initially active.
 */
const initializeChart = (containerId, initialDarkTheme = false) => {
    chartContainer = document.getElementById(containerId);
    isDarkTheme = initialDarkTheme;

    if (!chartContainer) {
        console.error(`Chart container with ID '${containerId}' not found.`);
        return false;
    }

    console.log('Initializing chart structure...');
    chartContainer.innerHTML = ''; // Clear previous content
    chartContainer.style.position = 'relative'; // Needed for absolute positioning of SVG

    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    // Use viewBox for responsive scaling
    svg.setAttribute('viewBox', `0 0 ${chartWidth} ${chartHeight}`); 
    svg.style.display = 'block';
    svg.style.position = 'absolute'; 
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.zIndex = '1'; // Ensure it's behind UI elements if needed

    // Add main group for transformations (margins)
    chartGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    chartGroup.setAttribute('transform', 'translate(50, 50)'); // Example margins
    svg.appendChild(chartGroup);

    // Add group specifically for task dots
    dotsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    dotsGroup.classList.add('task-dots');
    chartGroup.appendChild(dotsGroup);

    // Add axes and quadrant lines (basic structure)
    drawAxes();
    drawQuadrantLines();

    chartContainer.appendChild(svg);
    
    // Add resize listener
    window.removeEventListener('resize', handleResize); // Remove previous listener if any
    window.addEventListener('resize', handleResize);
    
    console.log('Chart structure initialized.');
    return true;
};

const drawAxes = () => {
    if (!chartGroup) return;
    // Clear existing axes if any
    chartGroup.querySelectorAll('.axis-line').forEach(el => el.remove());

    const axisColor = isDarkTheme ? '#777' : '#999';
    const effectiveWidth = chartWidth - 100; // Adjust for margins
    const effectiveHeight = chartHeight - 100;

    // X Axis (Urgency)
    const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    xAxis.setAttribute('x1', '0');
    xAxis.setAttribute('y1', `${effectiveHeight / 2}`);
    xAxis.setAttribute('x2', `${effectiveWidth}`);
    xAxis.setAttribute('y2', `${effectiveHeight / 2}`);
    xAxis.setAttribute('stroke', axisColor);
    xAxis.setAttribute('stroke-width', '1');
    xAxis.classList.add('axis-line');
    chartGroup.appendChild(xAxis);

    // Y Axis (Importance)
    const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    yAxis.setAttribute('x1', `${effectiveWidth / 2}`);
    yAxis.setAttribute('y1', '0');
    yAxis.setAttribute('x2', `${effectiveWidth / 2}`);
    yAxis.setAttribute('y2', `${effectiveHeight}`);
    yAxis.setAttribute('stroke', axisColor);
    yAxis.setAttribute('stroke-width', '1');
    yAxis.classList.add('axis-line');
    chartGroup.appendChild(yAxis);
    
    // TODO: Add axis labels (e.g., "Urgency", "Importance")
};

const drawQuadrantLines = () => {
    // This might be redundant if axes already represent the center lines.
    // Kept if specific styling for quadrant division is needed.
    // For now, axes serve this purpose.
};

/**
 * Handles window resize events to potentially re-render the chart.
 */
const handleResize = () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        if (chartContainer) {
             console.log('Window resized, potentially re-rendering chart...');
             // Recalculate dimensions if needed based on container size
             // For viewBox, recalculation might not be strictly necessary unless aspect ratio changes
             // If tasks need repositioning based on new container size, call renderChart again.
             // Example: chartWidth = chartContainer.clientWidth;
             //          chartHeight = chartContainer.clientHeight;
             //          svg.setAttribute('viewBox', `0 0 ${chartWidth} ${chartHeight}`);
             //          drawAxes(); // Redraw axes based on new dimensions
             //          renderChart(lastRenderedTasks); // Re-render dots
        }
    }, 250);
};

/**
 * Updates the chart's color scheme based on the theme.
 * @param {boolean} newIsDarkTheme True if dark theme is active, false otherwise.
 */
const updateChartColors = (newIsDarkTheme) => {
    isDarkTheme = newIsDarkTheme;
    console.log(`Updating chart colors. Dark theme: ${isDarkTheme}`);
    if (!chartGroup || !svg) return;

    drawAxes(); // Redraw axes with new colors
    // Update dot colors (will happen during the next renderChart call)
};

/**
 * Calculates the color for a task based on its quadrant.
 * @param {object} task The task object with importance and urgency.
 * @returns {string} A hex color code.
 */
const getQuadrantColorForTask = (task) => {
    const { importance = 5, urgency = 5 } = task;
    // Define quadrant colors (adjust as needed)
    const colors = {
        q1: '#e57373', // High Importance, High Urgency (Red)
        q2: '#81c784', // High Importance, Low Urgency (Green)
        q3: '#64b5f6', // Low Importance, Low Urgency (Blue)
        q4: '#fff176', // Low Importance, High Urgency (Yellow)
    };
    
    if (importance >= 5 && urgency >= 5) return colors.q1;
    if (importance >= 5 && urgency < 5) return colors.q2;
    if (importance < 5 && urgency < 5) return colors.q3;
    if (importance < 5 && urgency >= 5) return colors.q4;
    
    return '#9e9e9e'; // Default grey
};

/**
 * Renders the tasks as dots on the chart.
 * @param {Array<object>} tasks An array of task objects.
 */
const renderChart = (tasks = []) => {
    if (!dotsGroup || !chartGroup) {
        console.error('Chart not initialized. Cannot render tasks.');
        return;
    }
    
    console.log(`Rendering ${tasks.length} tasks on the chart.`);
    // Clear existing dots
    dotsGroup.innerHTML = ''; 

    const effectiveWidth = chartWidth - 100; // Adjust for margins
    const effectiveHeight = chartHeight - 100;

    // Simple linear scale (0-10) to (0-effectiveDimension)
    const scaleX = (urgency) => (urgency / 10) * effectiveWidth;
    const scaleY = (importance) => (1 - (importance / 10)) * effectiveHeight; // Invert Y-axis

    tasks.forEach(task => {
        if (task.done) return; // Don't draw completed tasks

        const cx = scaleX(task.urgency ?? 5);
        const cy = scaleY(task.importance ?? 5);
        const fill = getQuadrantColorForTask(task);
        const stroke = isDarkTheme ? '#444' : '#fff';

        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', cx);
        dot.setAttribute('cy', cy);
        dot.setAttribute('r', '8'); // Dot radius
        dot.setAttribute('fill', fill);
        dot.setAttribute('stroke', stroke);
        dot.setAttribute('stroke-width', '1.5');
        dot.classList.add('task-dot');
        dot.setAttribute('data-task-id', task.id);

        // Add tooltip (basic)
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = `${task.name}\nImportance: ${task.importance}, Urgency: ${task.urgency}`;
        dot.appendChild(title);
        
        // TODO: Add event listeners for click/hover if needed (e.g., to show task details)
        // dot.addEventListener('click', () => handleDotClick(task.id));

        dotsGroup.appendChild(dot);
    });
};

// TODO: Implement completion chart logic if it remains separate
const initializeCompletionChart = () => {
    console.warn('initializeCompletionChart is not fully implemented in chartService yet.');
};

const renderCompletionChart = (tasks = []) => {
    console.warn('renderCompletionChart is not fully implemented in chartService yet.');
};


export const chartService = {
    initializeChart,
    renderChart,
    updateChartColors,
    // Potentially export other functions like getQuadrantColorForTask if needed externally
    initializeCompletionChart, // Keep if needed
    renderCompletionChart,     // Keep if needed
}; 