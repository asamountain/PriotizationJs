<script setup lang="ts">
import { ChevronDown, ChevronRight, CheckCircle2, Circle, MoreVertical, Play, StopCircle, Link as LinkIcon } from 'lucide-vue-next';

interface Task {
  id: number;
  name: string;
  importance: number;
  urgency: number;
  done: boolean;
  parent_id: number | null;
  total_time_spent?: number;
  active_timer_start?: string | null;
  link?: string;
}

const props = defineProps<{
  task: Task;
  subtasks: Task[];
  isExpanded: boolean;
}>();

const emit = defineEmits(['toggle-expand', 'toggle-done', 'toggle-timer', 'edit', 'delete']);

const toggleExpand = () => emit('toggle-expand', props.task.id);
</script>

<template>
  <div class="flex flex-col w-full">
    <!-- Task Row -->
    <div 
      class="group flex items-center py-1 px-2 hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-50"
      @click="$emit('edit', task)"
    >
      <!-- Prepend / Icons -->
      <div class="flex items-center min-w-[64px] shrink-0">
        <!-- Expand Button -->
        <button 
          v-if="subtasks.length > 0"
          @click.stop="toggleExpand"
          class="p-1 hover:bg-gray-200 rounded text-gray-500 transition-colors"
        >
          <ChevronDown v-if="isExpanded" :size="16" />
          <ChevronRight v-else :size="16" />
        </button>
        <div v-else class="w-6"></div>

        <!-- Checkbox -->
        <button 
          @click.stop="$emit('toggle-done', task)"
          class="p-1 hover:bg-gray-200 rounded transition-colors ml-1"
          :class="task.done ? 'text-green-500' : 'text-gray-400'"
        >
          <CheckCircle2 v-if="task.done" :size="18" />
          <Circle v-else :size="18" />
        </button>
      </div>

      <!-- Content -->
      <div class="flex items-center flex-grow min-width-0 gap-3">
        <span 
          class="text-sm font-medium truncate shrink"
          :class="{'line-through text-gray-400': task.done, 'text-gray-800': !task.done}"
        >
          {{ task.name }}
        </span>

        <!-- Links / Tags -->
        <div class="flex items-center gap-2 shrink-0">
          <a 
            v-if="task.link" 
            :href="task.link" 
            target="_blank" 
            @click.stop
            class="p-1 text-blue-500 hover:bg-blue-50 rounded"
          >
            <LinkIcon :size="14" />
          </a>
          
          <div class="flex items-center gap-1">
            <span class="px-1.5 py-0.5 border border-blue-200 text-[10px] font-bold text-blue-600 rounded bg-blue-50">I: {{ task.importance }}</span>
            <span class="px-1.5 py-0.5 border border-purple-200 text-[10px] font-bold text-purple-600 rounded bg-purple-50">U: {{ task.urgency }}</span>
          </div>
        </div>
      </div>

      <!-- Append / Actions -->
      <div class="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
        <!-- Timer -->
        <div class="flex items-center bg-gray-100 rounded-full px-2 py-0.5 text-[11px] font-bold text-gray-600">
          <span class="mr-2">0:00</span>
          <button @click.stop="$emit('toggle-timer', task)" class="text-green-600 hover:text-green-700">
            <Play v-if="!task.active_timer_start" :size="14" fill="currentColor" />
            <StopCircle v-else :size="14" fill="currentColor" class="text-red-600" />
          </button>
        </div>

        <button @click.stop class="p-1 hover:bg-gray-200 rounded text-gray-400">
          <MoreVertical :size="16" />
        </button>
      </div>
    </div>

    <!-- Subtasks Container -->
    <div 
      v-if="isExpanded && subtasks.length > 0" 
      class="ml-4 border-l border-gray-200"
    >
      <div v-for="(subtask, index) in subtasks" :key="subtask.id" class="relative">
        <!-- Horizontal Branch Line -->
        <div 
          class="absolute left-0 top-[22px] w-4 h-[1px] bg-gray-200"
        ></div>
        
        <!-- Recursive Component -->
        <div class="pl-4">
          <TaskItem 
            :task="subtask" 
            :subtasks="[]" 
            :isExpanded="false"
            @toggle-expand="$emit('toggle-expand', $event)"
            @toggle-done="$emit('toggle-done', $event)"
            @toggle-timer="$emit('toggle-timer', $event)"
            @edit="$emit('edit', $event)"
            @delete="$emit('delete', $event)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
