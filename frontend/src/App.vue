<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { LayoutDashboard, ListTodo, Plus, Search, Settings, HelpCircle, FileText, Download } from 'lucide-vue-next';
import TaskItem from './components/TaskItem.vue';
import { initializeSocket, toggleDone as socketToggleDone } from './services/socket';

interface Task {
  id: number;
  name: string;
  importance: number;
  urgency: number;
  done: boolean;
  parent_id: number | null;
  status?: string;
  notes?: string;
  link?: string;
}

const tasks = ref<Task[]>([]);
const expandedTasks = ref<Set<number>>(new Set());
const searchQuery = ref('');
const sortBy = ref('priority');

const activeTasks = computed(() => {
  let filtered = tasks.value.filter(t => !t.done && t.parent_id === null);
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    filtered = filtered.filter(t => t.name.toLowerCase().includes(q));
  }
  return filtered;
});

const subtasksMap = computed(() => {
  const map: Record<number, Task[]> = {};
  tasks.value.forEach(t => {
    if (t.parent_id !== null) {
      if (!map[t.parent_id]) map[t.parent_id] = [];
      map[t.parent_id].push(t);
    }
  });
  return map;
});

const toggleExpand = (id: number) => {
  if (expandedTasks.value.has(id)) expandedTasks.value.delete(id);
  else expandedTasks.value.add(id);
};

const toggleDone = (task: Task) => {
  socketToggleDone(task.id);
};

onMounted(() => {
  initializeSocket((updatedTasks) => {
    tasks.value = updatedTasks;
  });
});
</script>

<template>
  <div class="flex h-screen bg-gray-50 font-sans text-gray-900">
    <!-- Sidebar -->
    <aside class="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
      <div class="p-6 border-b border-gray-100 flex items-center gap-3">
        <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
          <LayoutDashboard :size="20" />
        </div>
        <h1 class="text-lg font-bold tracking-tight">Prioritize</h1>
      </div>
      
      <nav class="flex-grow p-4 space-y-1">
        <a href="#" class="flex items-center gap-3 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg font-medium">
          <ListTodo :size="18" /> Active Tasks
        </a>
        <a href="#" class="flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
          <FileText :size="18" /> Analytics
        </a>
        <a href="#" class="flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
          <Settings :size="18" /> Settings
        </a>
      </nav>

      <div class="p-4 border-t border-gray-100 space-y-2">
        <button class="w-full flex items-center gap-2 px-3 py-2 text-gray-500 hover:text-gray-800 text-sm">
          <HelpCircle :size="16" /> Support
        </button>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-grow flex flex-col min-w-0">
      <!-- Header -->
      <header class="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shrink-0">
        <div class="flex items-center bg-gray-100 px-3 py-1.5 rounded-lg w-96">
          <Search :size="18" class="text-gray-400 mr-2" />
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Search tasks..." 
            class="bg-transparent border-none outline-none text-sm w-full"
          />
        </div>

        <div class="flex items-center gap-4">
          <button class="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
            <Download :size="20" />
          </button>
          <button class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all shadow-sm shadow-blue-200">
            <Plus :size="18" /> New Task
          </button>
          <div class="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white ring-1 ring-gray-200">
            JD
          </div>
        </div>
      </header>

      <!-- Scrollable Area -->
      <div class="flex-grow overflow-auto p-8">
        <div class="max-w-5xl mx-auto space-y-8">
          
          <!-- Eisenhower Matrix Visualization (Placeholder) -->
          <section class="grid grid-cols-2 gap-4 h-64">
            <div class="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 relative overflow-hidden flex flex-col">
              <span class="text-[10px] font-bold uppercase tracking-wider text-red-500 mb-2">Important & Urgent</span>
              <div class="flex-grow bg-red-50/50 rounded-lg border border-dashed border-red-100"></div>
            </div>
            <div class="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 relative overflow-hidden flex flex-col">
              <span class="text-[10px] font-bold uppercase tracking-wider text-green-500 mb-2">Important & Not Urgent</span>
              <div class="flex-grow bg-green-50/50 rounded-lg border border-dashed border-green-100"></div>
            </div>
          </section>

          <!-- Task List -->
          <section class="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 class="font-bold text-gray-800">Task Hierarchy</h2>
              <select v-model="sortBy" class="text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none font-medium">
                <option value="priority">Priority (High → Low)</option>
                <option value="newest">Newest First</option>
              </select>
            </div>

            <div class="p-2">
              <TaskItem 
                v-for="task in activeTasks" 
                :key="task.id" 
                :task="task" 
                :subtasks="subtasksMap[task.id] || []"
                :isExpanded="expandedTasks.has(task.id)"
                @toggle-expand="toggleExpand"
                @toggle-done="toggleDone"
              />
            </div>
          </section>

        </div>
      </div>
    </main>
  </div>
</template>

<style>
/* Custom thin scrollbar */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #e5e7eb;
  border-radius: 10px;
}
::-webkit-scrollbar-thumb:hover {
  background: #d1d5db;
}
</style>
