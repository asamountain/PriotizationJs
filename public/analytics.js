const { createApp } = Vue;
const { createVuetify } = Vuetify;

const vuetify = createVuetify({
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          primary: '#1976D2',
          secondary: '#424242',
          accent: '#82B1FF',
          error: '#FF5252',
          info: '#2196F3',
          success: '#4CAF50',
          warning: '#FFC107',
        }
      },
      dark: {
        colors: {
          primary: '#2196F3',
          secondary: '#424242',
          accent: '#FF4081',
          error: '#FF5252',
          info: '#2196F3',
          success: '#4CAF50',
          warning: '#FB8C00',
        }
      }
    }
  }
});

const app = createApp({
  data() {
    return {
      loading: true,
      isDarkTheme: localStorage.getItem('darkTheme') === 'true',
      tasks: [],
      timeLogs: [],
      stats: {
        totalHours: 0,
        totalPomodoros: 0,
        totalSessions: 0,
        avgSessionMinutes: 0
      },
      taskStats: [],
      tableHeaders: [
        { title: 'Task', key: 'name', sortable: true },
        { title: 'Time Spent', key: 'total_time', sortable: true },
        { title: 'Pomodoros', key: 'pomodoro_count', sortable: true },
        { title: 'Sessions', key: 'session_count', sortable: true },
        { title: 'Importance', key: 'importance', sortable: true },
        { title: 'Status', key: 'done', sortable: true }
      ],
      charts: {}
    };
  },
  computed: {
    theme() {
      return this.isDarkTheme ? 'dark' : 'light';
    },
    currentDateRange() {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return `Last 30 Days`;
    }
  },
  methods: {
    toggleTheme() {
      this.isDarkTheme = !this.isDarkTheme;
      localStorage.setItem('darkTheme', this.isDarkTheme);
      document.body.classList.toggle('dark-theme', this.isDarkTheme);
      
      // Update all charts with new theme
      this.updateChartThemes();
    },
    
    async fetchAnalyticsData() {
      try {
        const response = await fetch('/api/analytics');
        const data = await response.json();
        this.tasks = data.tasks;
        this.timeLogs = data.timeLogs;
        
        this.calculateStats();
        this.prepareTaskStats();
        this.createCharts();
      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        this.loading = false;
      }
    },
    
    calculateStats() {
      // Total time in seconds
      const totalSeconds = this.tasks.reduce((sum, task) => sum + (task.total_time_spent || 0), 0);
      this.stats.totalHours = (totalSeconds / 3600).toFixed(1);
      
      // Total pomodoros
      this.stats.totalPomodoros = this.tasks.reduce((sum, task) => sum + (task.pomodoro_count || 0), 0);
      
      // Total sessions
      this.stats.totalSessions = this.timeLogs.length;
      
      // Average session length
      if (this.timeLogs.length > 0) {
        const avgSeconds = this.timeLogs.reduce((sum, log) => sum + (log.duration || 0), 0) / this.timeLogs.length;
        this.stats.avgSessionMinutes = Math.round(avgSeconds / 60);
      }
    },
    
    prepareTaskStats() {
      this.taskStats = this.tasks
        .filter(task => task.total_time_spent > 0)
        .map(task => {
          const taskLogs = this.timeLogs.filter(log => log.task_id === task.id);
          return {
            name: task.name,
            total_time: task.total_time_spent,
            pomodoro_count: task.pomodoro_count || 0,
            session_count: taskLogs.length,
            importance: task.importance || 5,
            urgency: task.urgency || 5,
            done: task.done
          };
        })
        .sort((a, b) => b.total_time - a.total_time);
    },
    
    createCharts() {
      this.$nextTick(() => {
        this.createTaskTimeChart();
        this.createStatusChart();
        this.createDailyTimeChart();
        this.createPomodoroTrendChart();
        this.createSessionLengthChart();
        this.createHourlyChart();
      });
    },
    
    createTaskTimeChart() {
      const ctx = document.getElementById('taskTimeChart');
      if (!ctx) return;
      
      const top10Tasks = this.taskStats.slice(0, 10);
      
      this.charts.taskTime = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: top10Tasks.map(t => t.name),
          datasets: [{
            label: 'Hours',
            data: top10Tasks.map(t => (t.total_time / 3600).toFixed(2)),
            backgroundColor: 'rgba(25, 118, 210, 0.7)',
            borderColor: 'rgba(25, 118, 210, 1)',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Hours'
              }
            }
          },
          plugins: {
            legend: {
              display: false
            }
          }
        }
      });
    },
    
    createStatusChart() {
      const ctx = document.getElementById('statusChart');
      if (!ctx) return;
      
      const completed = this.tasks.filter(t => t.done).length;
      const active = this.tasks.filter(t => !t.done).length;
      
      this.charts.status = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Active', 'Completed'],
          datasets: [{
            data: [active, completed],
            backgroundColor: [
              'rgba(255, 193, 7, 0.7)',
              'rgba(76, 175, 80, 0.7)'
            ],
            borderColor: [
              'rgba(255, 193, 7, 1)',
              'rgba(76, 175, 80, 1)'
            ],
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom'
            }
          }
        }
      });
    },
    
    createDailyTimeChart() {
      const ctx = document.getElementById('dailyTimeChart');
      if (!ctx) return;
      
      // Group time logs by date
      const dailyData = {};
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      // Initialize all days with 0
      for (let i = 0; i < 30; i++) {
        const date = new Date(thirtyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        dailyData[dateStr] = 0;
      }
      
      // Aggregate time by date
      this.timeLogs.forEach(log => {
        if (log.start_time) {
          const date = new Date(log.start_time).toISOString().split('T')[0];
          if (dailyData.hasOwnProperty(date)) {
            dailyData[date] += (log.duration || 0) / 3600; // Convert to hours
          }
        }
      });
      
      const dates = Object.keys(dailyData).sort();
      const values = dates.map(date => dailyData[date].toFixed(2));
      
      this.charts.dailyTime = new Chart(ctx, {
        type: 'line',
        data: {
          labels: dates.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
          datasets: [{
            label: 'Focus Hours',
            data: values,
            backgroundColor: 'rgba(33, 150, 243, 0.2)',
            borderColor: 'rgba(33, 150, 243, 1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Hours'
              }
            }
          },
          plugins: {
            legend: {
              display: false
            }
          }
        }
      });
    },
    
    createPomodoroTrendChart() {
      const ctx = document.getElementById('pomodoroTrendChart');
      if (!ctx) return;
      
      // Group pomodoros by date (from time logs >= 25 min)
      const dailyPomodoros = {};
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      // Initialize all days with 0
      for (let i = 0; i < 30; i++) {
        const date = new Date(thirtyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        dailyPomodoros[dateStr] = 0;
      }
      
      // Count pomodoros (sessions >= 25 minutes)
      this.timeLogs.forEach(log => {
        if (log.start_time && log.duration >= 1500) { // 25 minutes = 1500 seconds
          const date = new Date(log.start_time).toISOString().split('T')[0];
          if (dailyPomodoros.hasOwnProperty(date)) {
            dailyPomodoros[date]++;
          }
        }
      });
      
      const dates = Object.keys(dailyPomodoros).sort();
      const values = dates.map(date => dailyPomodoros[date]);
      
      this.charts.pomodoroTrend = new Chart(ctx, {
        type: 'line',
        data: {
          labels: dates.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
          datasets: [{
            label: 'Pomodoros',
            data: values,
            backgroundColor: 'rgba(255, 193, 7, 0.2)',
            borderColor: 'rgba(255, 193, 7, 1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                stepSize: 1
              },
              title: {
                display: true,
                text: 'Count'
              }
            }
          },
          plugins: {
            legend: {
              display: false
            }
          }
        }
      });
    },
    
    createSessionLengthChart() {
      const ctx = document.getElementById('sessionLengthChart');
      if (!ctx) return;
      
      // Categorize sessions by length
      const categories = {
        '< 5 min': 0,
        '5-15 min': 0,
        '15-25 min': 0,
        '25+ min (Pomodoro)': 0
      };
      
      this.timeLogs.forEach(log => {
        const minutes = (log.duration || 0) / 60;
        if (minutes < 5) categories['< 5 min']++;
        else if (minutes < 15) categories['5-15 min']++;
        else if (minutes < 25) categories['15-25 min']++;
        else categories['25+ min (Pomodoro)']++;
      });
      
      this.charts.sessionLength = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: Object.keys(categories),
          datasets: [{
            data: Object.values(categories),
            backgroundColor: [
              'rgba(244, 67, 54, 0.7)',
              'rgba(255, 193, 7, 0.7)',
              'rgba(33, 150, 243, 0.7)',
              'rgba(76, 175, 80, 0.7)'
            ],
            borderColor: [
              'rgba(244, 67, 54, 1)',
              'rgba(255, 193, 7, 1)',
              'rgba(33, 150, 243, 1)',
              'rgba(76, 175, 80, 1)'
            ],
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom'
            }
          }
        }
      });
    },
    
    createHourlyChart() {
      const ctx = document.getElementById('hourlyChart');
      if (!ctx) return;
      
      // Group time by hour of day
      const hourlyData = Array(24).fill(0);
      
      this.timeLogs.forEach(log => {
        if (log.start_time) {
          const hour = new Date(log.start_time).getHours();
          hourlyData[hour] += (log.duration || 0) / 3600; // Convert to hours
        }
      });
      
      this.charts.hourly = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
          datasets: [{
            label: 'Hours',
            data: hourlyData.map(h => h.toFixed(2)),
            backgroundColor: 'rgba(33, 150, 243, 0.7)',
            borderColor: 'rgba(33, 150, 243, 1)',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Hours'
              }
            },
            x: {
              title: {
                display: true,
                text: 'Hour of Day'
              }
            }
          },
          plugins: {
            legend: {
              display: false
            }
          }
        }
      });
    },
    
    updateChartThemes() {
      const textColor = this.isDarkTheme ? '#fff' : '#666';
      const gridColor = this.isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
      
      Object.values(this.charts).forEach(chart => {
        if (chart) {
          chart.options.scales?.x && (chart.options.scales.x.ticks = { color: textColor });
          chart.options.scales?.y && (chart.options.scales.y.ticks = { color: textColor });
          chart.options.scales?.x && (chart.options.scales.x.grid = { color: gridColor });
          chart.options.scales?.y && (chart.options.scales.y.grid = { color: gridColor });
          chart.options.plugins.legend.labels = { color: textColor };
          chart.update();
        }
      });
    },
    
    formatHours(seconds) {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${minutes}m`;
    }
  },
  mounted() {
    // Apply theme
    if (this.isDarkTheme) {
      document.body.classList.add('dark-theme');
    }
    
    // Fetch data and create charts
    this.fetchAnalyticsData();
  }
});

app.use(vuetify);
app.mount('#app');


