export class ChartVisualization {
  constructor() {
    this.chartGroup = null;
    this.dotsGroup = null;
    this.relationshipsGroup = null;
    this.chartWidth = 800;
    this.chartHeight = 600;
    this.quadrantStats = { q1: 0, q2: 0, q3: 0, q4: 0 };
    this.tooltipElement = null;
    this.isMobile = window.innerWidth < 600;
    this.vuetifyColors = {
      primary: '#255035',
      secondary: '#449461',
      accent: '#63D88E',
      error: '#255035', // Q1: Important & Urgent (Deep Forest)
      warning: '#54B678', // Q3: Not Important & Urgent (Medium Green)
      info: '#63D88E', // Q4: Not Important & Not Urgent (Seafoam)
      success: '#449461', // Q2: Important & Not Urgent (Mid Forest)
    };
    // Q1 Zoom Mode state
    this.isQ1ZoomMode = false;
    this.showRelationships = localStorage.getItem('showRelationships') === 'true';
    this.zoomConfig = {
      minImportance: 0,
      maxImportance: 10,
      minUrgency: 0,
      maxUrgency: 10,
      isZoomed: false
    };
    // Selection state for zoom
    this.selectionState = {
      active: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      rect: null
    };
    this.isPersistentTooltip = false;
    this.showNotSureTasks = localStorage.getItem('showNotSureTasks') === 'true';
    this.showSubtasks = localStorage.getItem('showSubtasks') !== 'false'; // Default to true
    // Touch state for mobile interactions
    this.touchStartTime = null;
    this.touchedDot = null;

    // Listen for resize to update mobile state
    window.addEventListener('resize', () => {
      const wasMobile = this.isMobile;
      this.isMobile = window.innerWidth < 600;
      if (wasMobile !== this.isMobile) {
        // Re-render chart if crossing mobile threshold
        this.initializeChart();
      }
    });
  }
  
  initializeChart() {
    console.log('Initializing Vuetify style chart');
    
    // Make sure there are no errors from previous initialization attempts
    try {
      const container = document.getElementById('taskChart');
      if (!container) {
        console.error('No chart container found!');
        return;
      }
      
      // Ensure chart container allows overflow
      container.style.overflow = 'visible';
      
      // Clear container
      container.innerHTML = '';
      
      // Create SVG with clean design
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      svg.setAttribute('viewBox', '0 0 800 600');
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      svg.style.display = 'block';
      svg.style.width = '100%';
      svg.style.height = '100%';
      svg.style.userSelect = 'none'; // Prevent text selection during drag
      
      // Create definitions for filters and patterns
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      
      // Create the elevation shadow filter (Vuetify-style)
      const elevationShadow = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
      elevationShadow.setAttribute('id', 'elevation-2');
      elevationShadow.setAttribute('x', '-50%');
      elevationShadow.setAttribute('y', '-50%');
      elevationShadow.setAttribute('width', '200%');
      elevationShadow.setAttribute('height', '200%');
      
      // Vuetify-style soft shadow
      const feDropShadow = document.createElementNS('http://www.w3.org/2000/svg', 'feDropShadow');
      feDropShadow.setAttribute('dx', '0');
      feDropShadow.setAttribute('dy', '2');
      feDropShadow.setAttribute('stdDeviation', '2');
      feDropShadow.setAttribute('flood-opacity', '0.2');
      feDropShadow.setAttribute('flood-color', 'rgba(0,0,0,0.5)');
      elevationShadow.appendChild(feDropShadow);
      
      defs.appendChild(elevationShadow);
      
      // Create ripple effect filter
      const rippleFilter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
      rippleFilter.setAttribute('id', 'ripple-effect');
      rippleFilter.setAttribute('x', '-50%');
      rippleFilter.setAttribute('y', '-50%');
      rippleFilter.setAttribute('width', '200%');
      rippleFilter.setAttribute('height', '200%');
      
      const feGaussianBlur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
      feGaussianBlur.setAttribute('in', 'SourceGraphic');
      feGaussianBlur.setAttribute('stdDeviation', '1');
      feGaussianBlur.setAttribute('result', 'blur');
      rippleFilter.appendChild(feGaussianBlur);
      
      defs.appendChild(rippleFilter);

      // Add arrow marker for relationship lines
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', 'arrowhead');
      marker.setAttribute('markerWidth', '10');
      marker.setAttribute('markerHeight', '7');
      marker.setAttribute('refX', '9');
      marker.setAttribute('refY', '3.5');
      marker.setAttribute('orient', 'auto');
      
      const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
      polygon.setAttribute('fill', 'rgba(0,0,0,0.3)');
      marker.appendChild(polygon);
      defs.appendChild(marker);
      
      svg.appendChild(defs);
      
      // Create clean background
      const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      background.setAttribute('x', '0');
      background.setAttribute('y', '0');
      background.setAttribute('width', '800');
      background.setAttribute('height', '600');
      background.setAttribute('fill', 'var(--v-background, #ffffff)');
      background.setAttribute('rx', '4');
      background.setAttribute('ry', '4');
      background.addEventListener('click', () => {
        this.hideTooltip(true);
      });
      svg.appendChild(background);
      
      // Add subtle border
      const border = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      border.setAttribute('x', '2');
      border.setAttribute('y', '2');
      border.setAttribute('width', '796');
      border.setAttribute('height', '596');
      border.setAttribute('fill', 'none');
      border.setAttribute('stroke', 'var(--v-border, rgba(0,0,0,0.12))');
      border.setAttribute('stroke-width', '1');
      border.setAttribute('rx', '4');
      border.setAttribute('ry', '4');
      svg.appendChild(border);
      
      // Add quadrants FIRST (so they're in the background)
      const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      gridGroup.classList.add('grid-lines');
      
      // Add the four quadrants with labels
      this.addVuetifyQuadrants(gridGroup);
      
      svg.appendChild(gridGroup);
      
      // Create group for relationship lines (BEFORE dots so they are behind)
      const relationshipsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      relationshipsGroup.classList.add('task-relationships');
      svg.appendChild(relationshipsGroup);
      
      // Create dots group for task nodes AFTER quadrants (so dots are on top)
      const dotsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      dotsGroup.classList.add('task-nodes');
      svg.appendChild(dotsGroup);

      // Create selection rectangle for zooming (invisible by default)
      const selectionRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      selectionRect.setAttribute('fill', 'rgba(37, 80, 53, 0.15)');
      selectionRect.setAttribute('stroke', '#255035');
      selectionRect.setAttribute('stroke-width', '1');
      selectionRect.setAttribute('stroke-dasharray', '4,4');
      selectionRect.style.display = 'none';
      selectionRect.style.pointerEvents = 'none';
      svg.appendChild(selectionRect);
      this.selectionState.rect = selectionRect;
      
      // Store SVG and group for later use
      this.chartGroup = svg;
      this.dotsGroup = dotsGroup;
      this.relationshipsGroup = relationshipsGroup;
      container.appendChild(svg);

      // Update app state for zoom button visibility
      if (window.app) {
        window.app.isChartZoomed = this.zoomConfig.isZoomed || this.isQ1ZoomMode;
      }

      // Add Zoom Drag Event Listeners
      this.addZoomEventListeners(svg);

      // Add global touch handler to dismiss tooltips on mobile
      if (!this.globalTouchHandlerAdded) {
        document.addEventListener('touchstart', (e) => {
          if (!e.target.closest('.task-dot') && !e.target.closest('.chart-tooltip')) {
            this.hideTooltip();
          }
        }, { passive: true });
        this.globalTouchHandlerAdded = true;
      }

      // Request tasks to render immediately
      this.getTasks().then(tasks => {
        if (tasks && tasks.length > 0) {
          console.log(`Rendering ${tasks.length} tasks immediately`);
          this.renderChart(tasks);
        }
      }).catch(err => console.error('Error getting tasks:', err));

      return this;
    } catch (error) {
      console.error('Error initializing chart:', error);
    }
  }

  addZoomEventListeners(svg) {
    const getSVGCoords = (e) => {
      const rect = svg.getBoundingClientRect();
      const width = rect.width || 1;
      const height = rect.height || 1;
      const x = ((e.clientX - rect.left) / width) * 800;
      const y = ((e.clientY - rect.top) / height) * 600;
      return { x, y };
    };

    svg.addEventListener('mousedown', (e) => {
      // Only start selection if not clicking on a dot and it's left click
      if (e.target.closest('.task-dot') || e.button !== 0) return;

      const coords = getSVGCoords(e);
      this.selectionState.active = true;
      this.selectionState.startX = coords.x;
      this.selectionState.startY = coords.y;
      
      this.selectionState.rect.style.display = 'block';
      this.selectionState.rect.setAttribute('x', coords.x);
      this.selectionState.rect.setAttribute('y', coords.y);
      this.selectionState.rect.setAttribute('width', '0');
      this.selectionState.rect.setAttribute('height', '0');
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.selectionState.active) return;

      const coords = getSVGCoords(e);
      this.selectionState.currentX = coords.x;
      this.selectionState.currentY = coords.y;

      const x = Math.min(this.selectionState.startX, coords.x);
      const y = Math.min(this.selectionState.startY, coords.y);
      const width = Math.abs(this.selectionState.startX - coords.x);
      const height = Math.abs(this.selectionState.startY - coords.y);

      this.selectionState.rect.setAttribute('x', x);
      this.selectionState.rect.setAttribute('y', y);
      this.selectionState.rect.setAttribute('width', width);
      this.selectionState.rect.setAttribute('height', height);
    });

    window.addEventListener('mouseup', (e) => {
      if (!this.selectionState.active) return;

      this.selectionState.active = false;
      this.selectionState.rect.style.display = 'none';

      const x1 = Math.min(this.selectionState.startX, this.selectionState.currentX);
      const x2 = Math.max(this.selectionState.startX, this.selectionState.currentX);
      const y1 = Math.min(this.selectionState.startY, this.selectionState.currentY);
      const y2 = Math.max(this.selectionState.startY, this.selectionState.currentY);

      const width = x2 - x1;
      const height = y2 - y1;

      // Only zoom if the selection is large enough (e.g., > 10px)
      if (width > 10 && height > 10) {
        this.performZoom(x1, x2, y1, y2);
      }
    });
  }

  performZoom(x1, x2, y1, y2) {
    console.log(`Zooming to: SVG X(${x1}-${x2}), Y(${y1}-${y2})`);
    
    // Map SVG coordinates back to Importance (X) and Urgency (Y)
    // Importance: 40 to 760 (range 720)
    // Urgency: 560 to 40 (range 520, inverted)
    
    const mapXToImportance = (svgX) => {
      const { minImportance, maxImportance } = this.zoomConfig;
      const range = maxImportance - minImportance;
      return minImportance + ((svgX - 40) / 720) * range;
    };
    
    const mapYToUrgency = (svgY) => {
      const { minUrgency, maxUrgency } = this.zoomConfig;
      const range = maxUrgency - minUrgency;
      return maxUrgency - ((svgY - 40) / 520) * range;
    };

    const newMinImp = Math.max(0, mapXToImportance(x1));
    const newMaxImp = Math.min(10, mapXToImportance(x2));
    const newMinUrg = Math.max(0, mapYToUrgency(y2));
    const newMaxUrg = Math.min(10, mapYToUrgency(y1));

    this.zoomConfig = {
      minImportance: newMinImp,
      maxImportance: newMaxImp,
      minUrgency: newMinUrg,
      maxUrgency: newMaxUrg,
      isZoomed: true
    };

    this.isQ1ZoomMode = false; // Custom zoom overrides Q1 zoom
    this.initializeChart();
    
    if (window.app) {
      window.app.showNotification('Zoomed in. Drag to zoom more or click Eisenhower Matrix to reset.', 'info');
    }
  }

  resetZoom() {
    this.zoomConfig = {
      minImportance: 0,
      maxImportance: 10,
      minUrgency: 0,
      maxUrgency: 10,
      isZoomed: false
    };
    this.isQ1ZoomMode = false;
    this.initializeChart();
  }

  zoomIn() {
    this.adjustZoom(0.8);
  }

  zoomOut() {
    this.adjustZoom(1.25);
  }

  adjustZoom(factor) {
    const { minImportance, maxImportance, minUrgency, maxUrgency } = this.zoomConfig;
    
    const centerImp = (minImportance + maxImportance) / 2;
    const centerUrg = (minUrgency + maxUrgency) / 2;
    
    const halfWidth = (maxImportance - minImportance) * factor / 2;
    const halfHeight = (maxUrgency - minUrgency) * factor / 2;
    
    this.zoomConfig = {
      minImportance: Math.max(0, centerImp - halfWidth),
      maxImportance: Math.min(10, centerImp + halfWidth),
      minUrgency: Math.max(0, centerUrg - halfHeight),
      maxUrgency: Math.min(10, centerUrg + halfHeight),
      isZoomed: true
    };
    
    if (this.zoomConfig.minImportance === 0 && this.zoomConfig.maxImportance === 10 && 
        this.zoomConfig.minUrgency === 0 && this.zoomConfig.maxUrgency === 10) {
      this.zoomConfig.isZoomed = false;
    }
    
    this.isQ1ZoomMode = false;
    this.initializeChart();
  }

  toggleQ1ZoomMode() {
    if (this.isQ1ZoomMode) {
      this.resetZoom();
    } else {
      this.isQ1ZoomMode = true;
      this.zoomConfig = {
        minImportance: 5,
        maxImportance: 10,
        minUrgency: 5,
        maxUrgency: 10,
        isZoomed: true
      };
      this.initializeChart();
    }
    return this.isQ1ZoomMode;
  }
  
  getTasks() {
    return new Promise((resolve) => {
      // Try to get tasks from Vue app
      if (window.app && Array.isArray(window.app.tasks) && window.app.tasks.length > 0) {
        console.log('Using tasks from Vue app:', window.app.tasks.length);
        return resolve(window.app.tasks);
      }
      
      // Try taskManager
      if (window.taskManager && Array.isArray(window.taskManager.tasks) && window.taskManager.tasks.length > 0) {
        console.log('Using tasks from taskManager:', window.taskManager.tasks.length);
        return resolve(window.taskManager.tasks);
      }
      
      // No tasks found in memory - in the new flow, we just wait for the app to push tasks via renderChart
      console.log('No tasks found in memory for chart');
      resolve([]);
    });
  }
  
  addVuetifyQuadrants(parentGroup) {
    const { minImportance, maxImportance, minUrgency, maxUrgency, isZoomed } = this.zoomConfig;

    if (isZoomed || this.isQ1ZoomMode) {
      // In zoom mode, show a subtle background tint based on the center of the zoom
      const centerImp = (minImportance + maxImportance) / 2;
      const centerUrg = (minUrgency + maxUrgency) / 2;
      
      let bgColor = this.vuetifyColors.primary;
      let label = `ZOOM: ${minImportance.toFixed(1)}-${maxImportance.toFixed(1)} / ${minUrgency.toFixed(1)}-${maxUrgency.toFixed(1)}`;
      
      if (centerImp > 5 && centerUrg > 5) bgColor = this.vuetifyColors.error;
      else if (centerImp > 5 && centerUrg <= 5) bgColor = this.vuetifyColors.success;
      else if (centerImp <= 5 && centerUrg > 5) bgColor = this.vuetifyColors.warning;
      else bgColor = this.vuetifyColors.info;

      const zoomBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      zoomBg.setAttribute('x', '5%');
      zoomBg.setAttribute('y', '6%');
      zoomBg.setAttribute('width', '90%');
      zoomBg.setAttribute('height', '88%');
      zoomBg.setAttribute('fill', bgColor);
      zoomBg.setAttribute('opacity', '0.08');
      zoomBg.setAttribute('rx', '4');
      zoomBg.setAttribute('ry', '4');
      zoomBg.style.cursor = 'crosshair';
      zoomBg.addEventListener('click', (e) => this.handleQuadrantClick(e));
      parentGroup.appendChild(zoomBg);

      // Add grid lines for better granularity
      this.addDynamicGrid(parentGroup);

      // Add zoom mode label
      const zoomLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      zoomLabel.setAttribute('x', '50%');
      zoomLabel.setAttribute('y', '4%');
      zoomLabel.setAttribute('text-anchor', 'middle');
      zoomLabel.setAttribute('font-family', 'Roboto, sans-serif');
      zoomLabel.setAttribute('font-size', '12px');
      zoomLabel.setAttribute('font-weight', '600');
      zoomLabel.setAttribute('fill', bgColor);
      zoomLabel.textContent = label;
      parentGroup.appendChild(zoomLabel);
    } else {
      // Normal mode: Create quadrant backgrounds with Vuetify color scheme
      
      // Quadrant 1: Important & Urgent (top-right) - Error color
      const q1 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      q1.setAttribute('x', '50%');
      q1.setAttribute('y', '6%');
      q1.setAttribute('width', '45%');
      q1.setAttribute('height', '44%');
      q1.setAttribute('fill', this.vuetifyColors.error);
      q1.setAttribute('opacity', '0.05');
      q1.setAttribute('rx', '2');
      q1.setAttribute('ry', '2');
      q1.style.cursor = 'crosshair';
      q1.addEventListener('click', (e) => this.handleQuadrantClick(e));
      parentGroup.appendChild(q1);

      // Quadrant 2: Important & Not Urgent (bottom-right) - Success color
      const q2 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      q2.setAttribute('x', '50%');
      q2.setAttribute('y', '50%');
      q2.setAttribute('width', '45%');
      q2.setAttribute('height', '44%');
      q2.setAttribute('fill', this.vuetifyColors.success);
      q2.setAttribute('opacity', '0.05');
      q2.setAttribute('rx', '2');
      q2.setAttribute('ry', '2');
      q2.style.cursor = 'crosshair';
      q2.addEventListener('click', (e) => this.handleQuadrantClick(e));
      parentGroup.appendChild(q2);

      // Quadrant 3: Not Important & Urgent (top-left) - Warning color
      const q3 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      q3.setAttribute('x', '5%');
      q3.setAttribute('y', '6%');
      q3.setAttribute('width', '45%');
      q3.setAttribute('height', '44%');
      q3.setAttribute('fill', this.vuetifyColors.warning);
      q3.setAttribute('opacity', '0.05');
      q3.setAttribute('rx', '2');
      q3.setAttribute('ry', '2');
      q3.style.cursor = 'crosshair';
      q3.addEventListener('click', (e) => this.handleQuadrantClick(e));
      parentGroup.appendChild(q3);

      // Quadrant 4: Not Important & Not Urgent (bottom-left) - Info color
      const q4 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      q4.setAttribute('x', '5%');
      q4.setAttribute('y', '50%');
      q4.setAttribute('width', '45%');
      q4.setAttribute('height', '44%');
      q4.setAttribute('fill', this.vuetifyColors.info);
      q4.setAttribute('opacity', '0.05');
      q4.setAttribute('rx', '2');
      q4.setAttribute('ry', '2');
      q4.style.cursor = 'crosshair';
      q4.addEventListener('click', (e) => this.handleQuadrantClick(e));
      parentGroup.appendChild(q4);

      // Add axes lines
      const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      xAxis.setAttribute('x1', '5%');
      xAxis.setAttribute('y1', '50%');
      xAxis.setAttribute('x2', '95%');
      xAxis.setAttribute('y2', '50%');
      xAxis.setAttribute('stroke', 'var(--v-border, rgba(0,0,0,0.12))');
      xAxis.setAttribute('stroke-width', '2');
      parentGroup.appendChild(xAxis);

      const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      yAxis.setAttribute('x1', '50%');
      yAxis.setAttribute('y1', '6%');
      yAxis.setAttribute('x2', '50%');
      yAxis.setAttribute('y2', '94%');
      yAxis.setAttribute('stroke', 'var(--v-border, rgba(0,0,0,0.12))');
      yAxis.setAttribute('stroke-width', '2');
      parentGroup.appendChild(yAxis);
    }

    // Add axis labels in Vuetify typography style
    const importanceLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    importanceLabel.setAttribute('x', '50%');
    importanceLabel.setAttribute('y', '98%');
    importanceLabel.setAttribute('text-anchor', 'middle');
    importanceLabel.setAttribute('font-family', 'Roboto, sans-serif');
    importanceLabel.setAttribute('font-size', '14px');
    importanceLabel.setAttribute('font-weight', '500');
    importanceLabel.setAttribute('fill', 'var(--v-text-primary, rgba(0,0,0,0.87))');
    importanceLabel.textContent = isZoomed ? `IMPORTANCE (${minImportance.toFixed(1)}-${maxImportance.toFixed(1)})` : 'IMPORTANCE';
    parentGroup.appendChild(importanceLabel);

    const urgencyLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    urgencyLabel.setAttribute('x', '2%');
    urgencyLabel.setAttribute('y', '50%');
    urgencyLabel.setAttribute('text-anchor', 'middle');
    urgencyLabel.setAttribute('font-family', 'Roboto, sans-serif');
    urgencyLabel.setAttribute('font-size', '14px');
    urgencyLabel.setAttribute('font-weight', '500');
    urgencyLabel.setAttribute('fill', 'var(--v-text-primary, rgba(0,0,0,0.87))');
    urgencyLabel.setAttribute('transform', 'rotate(-90, 20, 300)');
    urgencyLabel.textContent = isZoomed ? `URGENCY (${minUrgency.toFixed(1)}-${maxUrgency.toFixed(1)})` : 'URGENCY';
    parentGroup.appendChild(urgencyLabel);
  }

  addDynamicGrid(parentGroup) {
    const { minImportance, maxImportance, minUrgency, maxUrgency } = this.zoomConfig;
    const gridColor = 'rgba(0, 0, 0, 0.06)';

    // Add 10 grid lines
    for (let i = 0; i <= 10; i++) {
      const ratio = i / 10;
      const xPercent = 5 + ratio * 90;
      const yPercent = 94 - ratio * 88;

      // Vertical lines
      const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      vLine.setAttribute('x1', `${xPercent}%`);
      vLine.setAttribute('y1', '6%');
      vLine.setAttribute('x2', `${xPercent}%`);
      vLine.setAttribute('y2', '94%');
      vLine.setAttribute('stroke', gridColor);
      vLine.setAttribute('stroke-width', '0.5');
      parentGroup.appendChild(vLine);

      // Horizontal lines
      const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      hLine.setAttribute('x1', '5%');
      hLine.setAttribute('y1', `${yPercent}%`);
      hLine.setAttribute('x2', '95%');
      hLine.setAttribute('y2', `${yPercent}%`);
      hLine.setAttribute('stroke', gridColor);
      hLine.setAttribute('stroke-width', '0.5');
      parentGroup.appendChild(hLine);

      // Labels (every 2 lines)
      if (i % 2 === 0) {
        const impVal = minImportance + ratio * (maxImportance - minImportance);
        const urgVal = minUrgency + ratio * (maxUrgency - minUrgency);

        const xLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        xLabel.setAttribute('x', `${xPercent}%`);
        xLabel.setAttribute('y', '96%');
        xLabel.setAttribute('text-anchor', 'middle');
        xLabel.setAttribute('font-size', '10px');
        xLabel.setAttribute('fill', 'rgba(0,0,0,0.5)');
        xLabel.textContent = impVal.toFixed(1);
        parentGroup.appendChild(xLabel);

        const yLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        yLabel.setAttribute('x', '3%');
        yLabel.setAttribute('y', `${yPercent}%`);
        yLabel.setAttribute('text-anchor', 'middle');
        yLabel.setAttribute('font-size', '10px');
        yLabel.setAttribute('fill', 'rgba(0,0,0,0.5)');
        yLabel.textContent = urgVal.toFixed(1);
        parentGroup.appendChild(yLabel);
      }
    }
  }
  
  addVuetifyQuadrantLabels(parentGroup) {
    // Define quadrant boundaries
    const quadrantCoords = {
      q1: { x: 580, y: 170 }, // Important & Urgent (top-right)
      q2: { x: 580, y: 430 }, // Important & Not Urgent (bottom-right)
      q3: { x: 220, y: 170 }, // Not Important & Urgent (top-left)
      q4: { x: 220, y: 430 }  // Not Important & Not Urgent (bottom-left)
    };
    
    // Q1: Important & Urgent (top-right)
    this.createVuetifyChip(
      parentGroup, 
      quadrantCoords.q1.x, 
      quadrantCoords.q1.y, 
      'Important & Urgent', 
      this.vuetifyColors.error
    );
    
    // Q2: Important & Not Urgent (bottom-right)
    this.createVuetifyChip(
      parentGroup, 
      quadrantCoords.q2.x, 
      quadrantCoords.q2.y, 
      'Important & Not Urgent', 
      this.vuetifyColors.success
    );
    
    // Q3: Not Important & Urgent (top-left)
    this.createVuetifyChip(
      parentGroup, 
      quadrantCoords.q3.x, 
      quadrantCoords.q3.y, 
      'Not Important & Urgent', 
      this.vuetifyColors.warning
    );
    
    // Q4: Not Important & Not Urgent (bottom-left)
    this.createVuetifyChip(
      parentGroup, 
      quadrantCoords.q4.x, 
      quadrantCoords.q4.y, 
      'Not Important & Not Urgent', 
      this.vuetifyColors.info
    );
  }
  
  createVuetifyChip(parentGroup, x, y, label, color) {
    const chipGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    chipGroup.classList.add('vuetify-chip');
    
    // Chip background with improved appearance
    const chipBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    chipBg.setAttribute('x', x - 80); // Wider to accommodate longer text
    chipBg.setAttribute('y', y - 14);
    chipBg.setAttribute('width', '160'); // Wider rectangle
    chipBg.setAttribute('height', '28'); // Slightly taller
    chipBg.setAttribute('rx', '14');
    chipBg.setAttribute('ry', '14');
    chipBg.setAttribute('fill', 'white'); // White background
    chipBg.setAttribute('opacity', '0.85'); // Semi-transparent
    chipBg.setAttribute('stroke', color);
    chipBg.setAttribute('stroke-width', '1.5'); // Slightly thicker border
    chipBg.setAttribute('filter', 'url(#elevation-2)'); // Add shadow for better visibility
    chipGroup.appendChild(chipBg);
    
    // Chip text with improved styling
    const chipText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    chipText.setAttribute('x', x);
    chipText.setAttribute('y', y + 5); // Center text vertically
    chipText.setAttribute('text-anchor', 'middle');
    chipText.setAttribute('font-family', 'Roboto, sans-serif');
    chipText.setAttribute('font-size', '12px'); // Slightly larger text
    chipText.setAttribute('font-weight', '500');
    chipText.setAttribute('fill', color);
    chipText.textContent = label;
    chipGroup.appendChild(chipText);
    
    parentGroup.appendChild(chipGroup);
  }
  
      async renderRelationships(tasks) {
        if (!this.relationshipsGroup) return;
        this.relationshipsGroup.innerHTML = '';
    
        // Only render if showRelationships is true
        if (!this.showRelationships) return;
    
        const socket = window.app?.socket || window.taskManager?.socket;      if (!socket) return;
  
      const visibleTaskIds = new Set(tasks.map(t => t.id));
  
      socket.emit('getTaskRelationships', null); 
      
      socket.once('taskRelationships', (data) => {
        // Handle the case where the data structure might be different
        const relationships = data.relationships || (Array.isArray(data) ? data : []);
        
        relationships.forEach(rel => {
          if (visibleTaskIds.has(rel.enabler_task_id) && visibleTaskIds.has(rel.enabled_task_id)) {
            const enabler = tasks.find(t => t.id === rel.enabler_task_id);
            const enabled = tasks.find(t => t.id === rel.enabled_task_id);
  
            if (enabler && enabled) {
              const pos1 = this.calculateTaskPosition(enabler);
              const pos2 = this.calculateTaskPosition(enabled);
  
              const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
              line.setAttribute('x1', pos1.x);
              line.setAttribute('y1', pos1.y);
              line.setAttribute('x2', pos2.x);
              line.setAttribute('y2', pos2.y);
              line.setAttribute('stroke', 'rgba(0,0,0,0.15)');
              line.setAttribute('stroke-width', '1.5');
              line.setAttribute('stroke-dasharray', '4,4');
              line.setAttribute('marker-end', 'url(#arrowhead)');
              line.classList.add('relationship-line');
              
              this.relationshipsGroup.appendChild(line);
            }
          }
        });
      });
    }
  
  renderChart(tasks) {
    console.log('Rendering Vuetify style chart');

    if (!this.dotsGroup) {
      console.error('No dots group available for rendering!');
      return;
    }

    // Clear existing dots and relationships
    this.dotsGroup.innerHTML = '';
    if (this.relationshipsGroup) this.relationshipsGroup.innerHTML = '';

    const { minImportance, maxImportance, minUrgency, maxUrgency } = this.zoomConfig;

    // Filter for active tasks within zoom range
    let visibleTasks = tasks ? tasks.filter(task => {
      const isWithinZoom = task.importance >= minImportance &&
                          task.importance <= maxImportance &&
                          task.urgency >= minUrgency &&
                          task.urgency <= maxUrgency;
      
      const isNotSureHidden = !this.showNotSureTasks && task.status === 'Not Sure';
      const isSubtaskMatch = !task.parent_id || this.showSubtasks;
      
      return !task.done && 
             isSubtaskMatch &&
             isWithinZoom &&
             !isNotSureHidden;
    }) : [];

    // If no tasks, show empty state
    if (!visibleTasks || visibleTasks.length === 0) {
      this.renderEmptyState();
      return;
    }
    
    console.log(`Found ${visibleTasks.length} active tasks to render`);

    // Calculate quadrant stats (if Vue app exists, update there too)
    this.calculateQuadrantStats(visibleTasks);

    // Render relationships
    this.renderRelationships(visibleTasks);

    // Group tasks that would overlap on the chart
    const taskGroups = this.groupOverlappingTasks(visibleTasks);

    // Render each group of tasks
    taskGroups.forEach(group => {
      if (group.length === 1) {
        // Single task - render normally
        const task = group[0];
        const position = this.calculateTaskPosition(task);
        const dot = this.createTaskDot(task, position.x, position.y);
        this.dotsGroup.appendChild(dot);
      } else {
        // Multiple tasks in same position - create a cluster
        const position = this.calculateTaskPosition(group[0]);
        const cluster = this.createTaskCluster(group, position.x, position.y);
        this.dotsGroup.appendChild(cluster);
      }
    });

    console.log(`Successfully rendered task dots on the chart`);
  }
  
  renderEmptyState() {
    // Create empty state message
    const emptyGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    
    const textBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    textBg.setAttribute('x', '250');
    textBg.setAttribute('y', '280');
    textBg.setAttribute('width', '300');
    textBg.setAttribute('height', '40');
    textBg.setAttribute('rx', '20');
    textBg.setAttribute('ry', '20');
    textBg.setAttribute('fill', '#f5f5f5');
    emptyGroup.appendChild(textBg);
    
    const emptyText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    emptyText.setAttribute('x', '400');
    emptyText.setAttribute('y', '305');
    emptyText.setAttribute('text-anchor', 'middle');
    emptyText.setAttribute('font-family', 'Roboto, sans-serif');
    emptyText.setAttribute('font-size', '16px');
    emptyText.setAttribute('fill', '#757575');
    emptyText.textContent = 'No active tasks to display';
    emptyGroup.appendChild(emptyText);
    
    this.dotsGroup.appendChild(emptyGroup);
  }
  
  calculateTaskPosition(task) {
    // Set default values if missing
    const importance = task.importance !== undefined ? Number(task.importance) : 5;
    const urgency = task.urgency !== undefined ? Number(task.urgency) : 5;

    const { minImportance, maxImportance, minUrgency, maxUrgency } = this.zoomConfig;
    const importanceRange = maxImportance - minImportance;
    const urgencyRange = maxUrgency - minUrgency;

    // Map to chart coordinates (40 to 760 for X, 560 to 40 for Y)
    const x = 40 + ((importance - minImportance) / (importanceRange || 1)) * 720;
    const y = 560 - ((urgency - minUrgency) / (urgencyRange || 1)) * 520;

    return { x, y };
  }
  
  createTaskDot(task, x, y) {
    const dotGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    dotGroup.classList.add('task-dot-group');
    dotGroup.setAttribute('data-task-id', task.id);

    // Determine color based on quadrant
    const color = this.getQuadrantColorForTask(task);

    // Calculate dot size based on leverage score (higher leverage = larger dot)
    const leverageScore = task.leverage_score || 0;
    const baseRadius = 12;
    const maxBonus = 6; // Max additional radius for high leverage tasks
    const radius = baseRadius + Math.min(leverageScore * 1.5, maxBonus);

    // Create the task dot with proper styling
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', x);
    dot.setAttribute('cy', y);
    dot.setAttribute('r', radius.toString());
    dot.setAttribute('fill', color);
    dot.setAttribute('class', 'task-dot');
    dot.setAttribute('data-task-id', task.id);
    dot.setAttribute('data-leverage', leverageScore);
    dot.style.cursor = 'pointer';
    
    // Add shadow for elevation
    dot.setAttribute('filter', 'url(#elevation-2)');
    
    // Add improved event listeners
    dot.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent quadrant click from firing
      this.focusOnTask(task.id);
    });
    
    // Use a flag to track hover state
    let isHovering = false;
    dot.addEventListener('mouseenter', () => {
      isHovering = true;
      
      // Only apply transform if this dot is NOT selected
      if (!dot.classList.contains('selected-dot')) {
        dot.style.stroke = '#fff';
        dot.style.strokeWidth = '2px';
      }
      
      // Show tooltip after a small delay to prevent flickering
      setTimeout(() => {
        if (isHovering) {
          const content = this.createTooltipContent(task);
          this.showStableTooltip(content, dot, task);
        }
      }, 50);
    });
    
    dot.addEventListener('mouseleave', () => {
      isHovering = false;

      // Only reset styles if this dot is NOT selected
      if (!dot.classList.contains('selected-dot')) {
        dot.style.stroke = 'none';
        dot.style.strokeWidth = '0px';
      }

      this.hideTooltip();
    });

    // Touch events for mobile
    dot.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.touchStartTime = Date.now();
      this.touchedDot = dot;

      // Show tooltip immediately on touch
      const content = this.createTooltipContent(task);
      this.showStableTooltip(content, dot, task);

      // Visual feedback
      dot.style.stroke = '#fff';
      dot.style.strokeWidth = '3px';
    }, { passive: false });

    dot.addEventListener('touchend', (e) => {
      e.preventDefault();
      const touchDuration = Date.now() - (this.touchStartTime || 0);

      // Reset visual state
      if (!dot.classList.contains('selected-dot')) {
        dot.style.stroke = 'none';
        dot.style.strokeWidth = '0px';
      }

      // Short tap (< 300ms) = focus on task
      if (touchDuration < 300) {
        this.focusOnTask(task.id);
        // Hide tooltip after short delay
        setTimeout(() => this.hideTooltip(), 1500);
      }
      // Long press = keep tooltip visible (user can tap elsewhere to dismiss)

      this.touchStartTime = null;
    }, { passive: false });

    dotGroup.appendChild(dot);
    
    // Add a text label below the dot for very important tasks
    if (task.importance > 7 || task.urgency > 7) {
      const taskName = task.name.length > 15 ? task.name.substring(0, 12) + '...' : task.name;
      
      // Add background for text
      const textBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      textBg.setAttribute('x', x - 50);
      textBg.setAttribute('y', y + 15);
      textBg.setAttribute('width', '100');
      textBg.setAttribute('height', '20');
      textBg.setAttribute('rx', '10');
      textBg.setAttribute('ry', '10');
      textBg.setAttribute('fill', 'white');
      textBg.setAttribute('opacity', '0.8');
      textBg.setAttribute('stroke', color);
      textBg.setAttribute('stroke-width', '1');
      dotGroup.appendChild(textBg);
      
      // Add text
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', x);
      text.setAttribute('y', y + 29);
      text.setAttribute('font-family', 'Roboto, sans-serif');
      text.setAttribute('font-size', '10px');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', '#333');
      text.textContent = taskName;
      dotGroup.appendChild(text);
    }
    
    return dotGroup;
  }
  
  createTooltipContent(task) {
    // Get subtasks if available
    const subtasks = [];
    if (window.taskManager && window.taskManager.tasks) {
      const allTasks = window.taskManager.tasks;
      subtasks.push(...allTasks.filter(t => t.parent_id === task.id));
    } else if (window.app && window.app.tasks) {
      const allTasks = window.app.tasks;
      subtasks.push(...allTasks.filter(t => t.parent_id === task.id));
    }

    // Format completion count
    const completedSubtasks = subtasks.filter(s => s.done).length;

    // Leverage score display
    const leverageScore = task.leverage_score || 0;

    // Create tooltip content with Vuetify styling
    return `
      <div style="font-family: Roboto, sans-serif; width: 250px; border-radius: 4px; overflow: hidden; box-shadow: 0 3px 6px rgba(0,0,0,0.16);">
        <div style="background-color: ${this.getQuadrantColorForTask(task)}; color: white; padding: 12px 16px;">
          <div style="font-weight: 500; font-size: 16px;">${task.name}</div>
          ${leverageScore > 0 ? `<div style="margin-top: 4px; font-size: 12px; opacity: 0.9;">
            ↗ Leverage Score: ${leverageScore} (enables ${leverageScore} task${leverageScore > 1 ? 's' : ''})
          </div>` : ''}
        </div>
        <div style="background: white; padding: 12px 16px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <div>Importance: <b>${Number(task.importance).toFixed(1)}/10</b></div>
            <div>Urgency: <b>${Number(task.urgency).toFixed(1)}/10</b></div>
          </div>
          ${task.link ? `<div style="margin-bottom: 8px; overflow: hidden; text-overflow: ellipsis;">
            <a href="${task.link}" target="_blank" style="color: #1976D2; text-decoration: none;">
              ${task.link}
            </a>
          </div>` : ''}
          ${task.due_date ? `<div style="margin-bottom: 8px;">
            Due: <b>${new Date(task.due_date).toLocaleDateString()}</b>
          </div>` : ''}
          ${subtasks.length > 0 ? `
            <div style="margin-top: 12px; border-top: 1px solid #e0e0e0; padding-top: 12px;">
              <div style="font-weight: 500; margin-bottom: 8px;">
                Subtasks: ${completedSubtasks}/${subtasks.length}
              </div>
              <ul style="margin: 0; padding-left: 20px;">
                ${subtasks.slice(0, 3).map(s => `
                  <li style="${s.done ? 'text-decoration: line-through; opacity: 0.6;' : ''}">
                    ${s.name}
                  </li>
                `).join('')}
                ${subtasks.length > 3 ? `<li style="opacity: 0.6; list-style: none;">+ ${subtasks.length - 3} more</li>` : ''}
              </ul>
            </div>
          ` : ''}
          <div style="margin-top: 12px; font-size: 12px; color: #757575; text-align: center;">
            Click to focus on this task
          </div>
        </div>
      </div>
    `;
  }
  
  showStableTooltip(content, element, task, persistent = false) {
    // If we're already persistent and this is just a hover call, ignore it
    if (this.isPersistentTooltip && !persistent) return;
    
    // Remove any existing tooltips if not persistent or if we're forcing a new persistent one
    if (!this.isPersistentTooltip || persistent) {
      this.hideTooltip(true); // force hide even if persistent
    }

    this.isPersistentTooltip = persistent;

    // Create tooltip container if it doesn't exist
    if (!this.tooltipElement) {
      this.tooltipElement = document.createElement('div');
      this.tooltipElement.className = 'chart-tooltip';
      this.tooltipElement.style.zIndex = '9999';
      this.tooltipElement.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      this.tooltipElement.style.opacity = '0';
      
      // Handle clicks on the tooltip (delegation)
      this.tooltipElement.addEventListener('click', (e) => {
        const taskItem = e.target.closest('.cluster-task-item');
        if (taskItem) {
          const taskId = parseInt(taskItem.getAttribute('data-task-id'));
          if (taskId) {
            this.focusOnTask(taskId);
            this.hideTooltip(true);
          }
        }
      });
      
      document.body.appendChild(this.tooltipElement);
    }

    // Update content
    this.tooltipElement.innerHTML = content;

    // Mobile: Show as bottom sheet
    if (this.isMobile) {
      this.tooltipElement.classList.add('mobile-tooltip');
      this.tooltipElement.style.position = 'fixed';
      this.tooltipElement.style.left = '0';
      this.tooltipElement.style.right = '0';
      this.tooltipElement.style.bottom = '0';
      this.tooltipElement.style.top = 'auto';
      this.tooltipElement.style.transform = 'translateY(100%)';
      this.tooltipElement.style.maxWidth = '100%';
      this.tooltipElement.style.pointerEvents = 'auto';
      this.tooltipElement.style.visibility = 'visible';

      // Animate in
      requestAnimationFrame(() => {
        this.tooltipElement.style.opacity = '1';
        this.tooltipElement.style.transform = 'translateY(0)';
      });
      return;
    }

    // Desktop: Position near element
    this.tooltipElement.classList.remove('mobile-tooltip');
    this.tooltipElement.style.position = 'absolute';
    this.tooltipElement.style.maxWidth = '300px';
    this.tooltipElement.style.pointerEvents = persistent ? 'auto' : 'none';

    // Get element position once and store it
    const rect = element.getBoundingClientRect();
    const dotCenterX = rect.left + rect.width / 2;
    const dotCenterY = rect.top + rect.height / 2;

    // Determine fixed tooltip position with full calculations before showing tooltip
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Pre-show the tooltip but keep it invisible to measure its dimensions
    this.tooltipElement.style.opacity = '0';
    this.tooltipElement.style.left = `${dotCenterX}px`;
    this.tooltipElement.style.top = `${dotCenterY}px`;
    this.tooltipElement.style.visibility = 'visible';
    this.tooltipElement.style.transform = 'translate(-50%, -100%)';

    // Measure the tooltip
    const tooltipRect = this.tooltipElement.getBoundingClientRect();
    const tooltipWidth = tooltipRect.width;
    const tooltipHeight = tooltipRect.height;

    // Calculate available space in different directions
    const spaceRight = viewportWidth - dotCenterX - tooltipWidth/2;
    const spaceLeft = dotCenterX - tooltipWidth/2;
    const spaceAbove = dotCenterY - tooltipHeight;
    const spaceBelow = viewportHeight - dotCenterY - tooltipHeight;

    // Choose the best position with sufficient margins
    let finalX, finalY, finalTransform;

    if (spaceAbove > 20) {
      // Position above
      finalX = dotCenterX;
      finalY = rect.top - 15;
      finalTransform = 'translate(-50%, -100%)';
    } else if (spaceBelow > 20) {
      // Position below
      finalX = dotCenterX;
      finalY = rect.bottom + 15;
      finalTransform = 'translate(-50%, 0)';
    } else if (spaceRight > 20) {
      // Position right
      finalX = rect.right + 15;
      finalY = dotCenterY;
      finalTransform = 'translate(0, -50%)';
    } else {
      // Position left
      finalX = rect.left - 15;
      finalY = dotCenterY;
      finalTransform = 'translate(-100%, -50%)';
    }

    // Set final position
    this.tooltipElement.style.left = `${finalX}px`;
    this.tooltipElement.style.top = `${finalY}px`;
    this.tooltipElement.style.transform = finalTransform;

    // Make tooltip visible
    this.tooltipElement.style.opacity = '1';
    this.tooltipElement.style.visibility = 'visible';
  }
  
  hideTooltip(force = false) {
    if (this.isPersistentTooltip && !force) return;
    
    if (force) {
      this.isPersistentTooltip = false;
    }

    if (this.tooltipElement) {
      this.tooltipElement.style.opacity = '0';
      this.tooltipElement.style.pointerEvents = 'none'; // Ensure it's not clickable when hidden
      // On mobile, also animate out
      if (this.isMobile) {
        this.tooltipElement.style.transform = 'translateY(100%)';
      }
    }
  }
  
  calculateQuadrantStats(tasks) {
    // Reset stats
    this.quadrantStats = { q1: 0, q2: 0, q3: 0, q4: 0 };
    
    // Process tasks
    tasks.forEach(task => {
      const quadrant = this.getQuadrantForTask(task);
      this.quadrantStats[quadrant]++;
    });
    
    // Update Vue app if available
    if (window.app && window.app.quadrantStats) {
      window.app.quadrantStats = { ...this.quadrantStats };
    }
    
    return this.quadrantStats;
  }
  
  getQuadrantForTask(task) {
    const isImportant = task.importance > 5;
    const isUrgent = task.urgency > 5;
    
    if (isImportant && isUrgent) return 'q1';
    if (isImportant && !isUrgent) return 'q2';
    if (!isImportant && isUrgent) return 'q3';
    return 'q4';
  }
  
  getQuadrantColorForTask(task) {
    const quadrant = this.getQuadrantForTask(task);
    switch (quadrant) {
      case 'q1':
        return this.vuetifyColors.error;
      case 'q2':
        return this.vuetifyColors.success;
      case 'q3':
        return this.vuetifyColors.warning;
      case 'q4':
        return this.vuetifyColors.info;
      default:
        throw new Error('Invalid quadrant');
    }
  }
  
  focusOnTask(taskId) {
    console.log(`Focusing on task ${taskId}`);
    
    // Hide any persistent tooltips
    this.hideTooltip(true);
    
    if (!this.dotsGroup) {
      console.warn('Chart not initialized, cannot focus on task');
      return;
    }
    
    // Find the task dot in the SVG
    const taskDot = this.dotsGroup.querySelector(`.task-dot[data-task-id="${taskId}"]`);
    if (!taskDot) {
      console.warn(`No dot found for task ${taskId}`);
      return;
    }
    
    // Remove highlight from all dots
    this.dotsGroup.querySelectorAll('.task-dot').forEach(dot => {
      dot.classList.remove('selected-dot');
      dot.setAttribute('r', '12'); // Reset to normal size
      dot.setAttribute('stroke', 'none');
    });
    
    // Highlight the selected dot
    taskDot.classList.add('selected-dot');
    taskDot.setAttribute('r', '18'); // Make it bigger
    taskDot.setAttribute('stroke', '#ffffff');
    taskDot.setAttribute('stroke-width', '3');
    // Explicitly remove any transform that might have been added on hover
    taskDot.style.transform = '';
    
    // Also highlight in the task list
    const taskListItem = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
    
    // If task item is not found, it might be inside a collapsed parent
    if (!taskListItem && window.app) {
      // Find the task in the app data
      const task = window.app.tasks.find(t => t.id == taskId);
      if (task) {
        // Expand all ancestors
        let parentId = task.parent_id;
        let parentsExpanded = false;
        
        while (parentId) {
          if (!window.app.expandedTasks.has(parentId)) {
            window.app.toggleExpand(parentId, true);
            parentsExpanded = true;
          }
          const parent = window.app.tasks.find(t => t.id == parentId);
          parentId = parent ? parent.parent_id : null;
        }
        
        if (parentsExpanded) {
          // Wait for DOM update
          setTimeout(() => {
            const retryItem = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
            if (retryItem) {
              this.scrollAndHighlight(retryItem);
            }
          }, 150);
          return;
        }
      }
    }
    
    if (taskListItem) {
      this.scrollAndHighlight(taskListItem);
    }
  }

  scrollAndHighlight(element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Add a highlight class
    element.classList.add('highlighted-task');
    
    // Remove the highlight after 3 seconds
    setTimeout(() => {
      element.classList.remove('highlighted-task');
    }, 3000);
  }
  
  updateChartColors() {
    console.log('Updating chart colors based on theme');
    
    // Check if the chart is initialized
    if (!this.chartGroup) {
      console.warn('Chart not initialized yet, cannot update colors');
      return;
    }
    
    // Determine if dark theme is active
    const isDarkTheme = document.body.classList.contains('dark-theme') || 
                       localStorage.getItem('isDarkTheme') === 'true';
    
    // Update background color
    const background = this.chartGroup.querySelector('rect:first-child');
    if (background) {
      background.setAttribute('fill', isDarkTheme ? '#121212' : '#ffffff');
    }
    
    // Update text colors
    const textElements = this.chartGroup.querySelectorAll('text');
    textElements.forEach(text => {
      if (!text.hasAttribute('data-color-locked')) {
        text.setAttribute('fill', isDarkTheme ? 'rgba(255,255,255,0.87)' : 'rgba(0,0,0,0.87)');
      }
    });
    
    // If tasks are available, re-render to apply new colors
    this.getTasks().then(tasks => {
      if (tasks && tasks.length > 0) {
        this.renderChart(tasks);
      }
    }).catch(err => console.error('Error getting tasks for color update:', err));
  }
  
  // Group tasks that would appear in the same position
  groupOverlappingTasks(tasks) {
    const groups = [];
    const positionMap = new Map();
    
    tasks.forEach(task => {
      const position = this.calculateTaskPosition(task);
      const key = `${Math.round(position.x)},${Math.round(position.y)}`;
      
      if (!positionMap.has(key)) {
        positionMap.set(key, []);
      }
      
      positionMap.get(key).push(task);
    });
    
    positionMap.forEach(tasksAtPosition => {
      groups.push(tasksAtPosition);
    });
    
    return groups;
  }
  
  // Create a visual representation of multiple tasks at the same position
  createTaskCluster(tasks, x, y) {
    const clusterGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    clusterGroup.classList.add('task-cluster');
    
    // Create the main cluster dot
    const mainDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    mainDot.setAttribute('cx', x);
    mainDot.setAttribute('cy', y);
    mainDot.setAttribute('r', '16'); // Slightly larger to show it's a cluster
    mainDot.setAttribute('fill', this.getQuadrantColorForTask(tasks[0]));
    mainDot.setAttribute('class', 'task-dot cluster-dot');
    mainDot.setAttribute('data-task-count', tasks.length);
    mainDot.style.cursor = 'pointer';
    mainDot.style.transition = 'all 0.2s ease';
    
    // Add shadow for elevation
    mainDot.setAttribute('filter', 'url(#elevation-2)');
    
    // Add event listeners for the cluster
    mainDot.addEventListener('click', (e) => {
      e.stopPropagation();
      const content = this.createClusterTooltipContent(tasks);
      this.showStableTooltip(content, mainDot, tasks, true); // true for persistent
    });
    mainDot.addEventListener('mouseenter', () => this.handleClusterHover(mainDot, tasks));
    mainDot.addEventListener('mouseleave', () => this.handleClusterLeave(mainDot));
    
    clusterGroup.appendChild(mainDot);
    
    // Add count indicator
    const countLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    countLabel.setAttribute('x', x);
    countLabel.setAttribute('y', y + 4);
    countLabel.setAttribute('text-anchor', 'middle');
    countLabel.setAttribute('font-family', 'Roboto, sans-serif');
    countLabel.setAttribute('font-size', '10px');
    countLabel.setAttribute('font-weight', 'bold');
    countLabel.setAttribute('fill', 'white');
    countLabel.textContent = tasks.length;
    clusterGroup.appendChild(countLabel);
    
    return clusterGroup;
  }
  
  // Handle hover on a task cluster
  handleClusterHover(clusterDot, tasks) {
    // Enlarge dot on hover
    clusterDot.setAttribute('r', '18');
    clusterDot.setAttribute('stroke', '#fff');
    clusterDot.setAttribute('stroke-width', '2');
    
    // Create multi-task tooltip content
    const content = this.createClusterTooltipContent(tasks);
    this.showStableTooltip(content, clusterDot, tasks);
  }
  
  // Handle mouse leave on a cluster
  handleClusterLeave(clusterDot) {
    // Restore original size
    clusterDot.setAttribute('r', '16');
    clusterDot.setAttribute('stroke', 'none');
    clusterDot.setAttribute('stroke-width', '0');
    
    // Hide tooltip
    this.hideTooltip();
  }
  
  createClusterTooltipContent(tasks) {
    return `
      <div style="font-family: Roboto, sans-serif; width: 280px; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
        <div style="background-color: ${this.getQuadrantColorForTask(tasks[0])}; color: white; padding: 12px 16px; position: relative;">
          <div style="font-weight: 500; font-size: 16px;">${tasks.length} Tasks at this position</div>
        </div>
        <div style="background: white; padding: 8px 0; max-height: 300px; overflow-y: auto;">
          ${tasks.map((task, index) => `
            <div 
              class="cluster-task-item" 
              data-task-id="${task.id}"
              style="padding: 10px 16px; cursor: pointer; transition: background 0.2s;"
              onmouseover="this.style.background='rgba(0,0,0,0.05)'"
              onmouseout="this.style.background='transparent'"
            >
              <div style="font-weight: 500; color: ${this.getQuadrantColorForTask(task)};">
                ${index + 1}. ${task.name}
              </div>
              <div style="display: flex; justify-content: space-between; margin-top: 4px; font-size: 12px; color: #666;">
                <div>Importance: <b>${task.importance}/10</b></div>
                <div>Urgency: <b>${task.urgency}/10</b></div>
              </div>
            </div>
          `).join('')}
          <div style="margin: 8px 16px 4px; padding-top: 8px; border-top: 1px solid #eee; font-size: 12px; color: #757575; text-align: center;">
            Click a task to select it
          </div>
        </div>
      </div>
    `;
  }
  
  // Handle clicks on quadrants to add tasks
  handleQuadrantClick(event) {
    // Get the SVG element and calculate the clicked position
    const svg = this.chartGroup;
    const rect = svg.getBoundingClientRect();

    // Get mouse position relative to SVG
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Convert from screen coordinates to SVG viewBox coordinates
    const viewBoxWidth = 800;
    const viewBoxHeight = 600;
    const svgX = (x / (rect.width || 1)) * viewBoxWidth;
    const svgY = (y / (rect.height || 1)) * viewBoxHeight;

    let importance, urgency;

    if (this.isQ1ZoomMode) {
      // In Q1 zoom mode: map to 5-10 range with decimal precision
      const { minImportance, maxImportance, minUrgency, maxUrgency } = this.zoomConfig;

      // Convert SVG coordinates to 5-10 scale
      importance = minImportance + ((svgX - 40) / 720) * (maxImportance - minImportance);
      urgency = minUrgency + ((560 - svgY) / 520) * (maxUrgency - minUrgency);

      // Round to one decimal place for finer granularity
      importance = Math.round(importance * 10) / 10;
      urgency = Math.round(urgency * 10) / 10;

      // Clamp to Q1 range
      importance = Math.max(minImportance, Math.min(maxImportance, importance));
      urgency = Math.max(minUrgency, Math.min(maxUrgency, urgency));
    } else {
      // Normal mode: Convert SVG coordinates to importance/urgency values (1-10)
      importance = Math.round(((svgX - 40) / 720) * 10);
      urgency = Math.round(((560 - svgY) / 520) * 10);

      // Clamp values to 1-10 range
      importance = Math.max(1, Math.min(10, importance));
      urgency = Math.max(1, Math.min(10, urgency));
    }

    console.log(`Quadrant clicked at: Importance=${importance}, Urgency=${urgency} (Q1 Zoom: ${this.isQ1ZoomMode})`);

    // Trigger the modal in the Vue app
    if (window.app && typeof window.app.openQuickAddModal === 'function') {
      window.app.openQuickAddModal(importance, urgency);
    } else {
      console.warn('Vue app or openQuickAddModal method not available');
    }
  }
} 