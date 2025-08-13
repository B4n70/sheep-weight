<script>
  import { onMount } from 'svelte';
  import * as storage from './lib/storage.js';

  // Authentication state
  let isAuthenticated = $state(false);
  let currentUser = $state(null);
  let loginEmail = $state('');
  let loginPassword = $state('');
  let loginError = $state('');

  // Theme state
  let isDarkMode = $state(false);

  // Navigation state
  let activeTab = $state('tasks');

  // Task management state
  let tasks = $state([]);
  let items = $state([]);
  let users = [];
  let newTaskDescription = $state('');
  let newTaskDueDate = $state('');
  let newTaskPriority = $state('low');
  let selectedItems = $state([{ itemId: '', quantity: 1 }]);

  // Item management state
  let newItemName = $state('');
  let editingItem = $state(null);

  // Task editing state
  let editingTask = $state(null);
  let editTaskDescription = $state('');
  let editTaskDueDate = $state('');
  let editTaskPriority = $state('low');

  // Auditable update system state
  let updatingTask = $state(null);
  let updateQuantities = $state({});
  let taskUpdates = [];
  let showUpdateHistory = $state({});

  // Initialize app
  onMount(async () => {
    // Initialize demo data
    await storage.initializeDemoData();
    
    // Load theme from localStorage with immediate application
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    isDarkMode = savedTheme === 'dark' || (!savedTheme && prefersDark);
    
    // Apply theme immediately to document
    document.documentElement.classList.toggle('dark', isDarkMode);
    
    // Load data
    await loadData();
  });

  function updateTheme() {
    // Apply theme immediately to document
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }

  function toggleTheme() {
    isDarkMode = !isDarkMode;
    updateTheme();
  }

  async function loadData() {
    tasks = await storage.getTasks();
    items = await storage.getPredefinedItems();
    users = await storage.getAllUsers();
  }

  async function handleLogin(event) {
    event.preventDefault();
    loginError = '';
    
    try {
      const user = await storage.authenticateUser(loginEmail, loginPassword);
      if (user) {
        currentUser = user;
        isAuthenticated = true;
        loginEmail = '';
        loginPassword = '';
        await loadData();
      } else {
        loginError = 'Invalid email or password';
      }
    } catch (error) {
      loginError = 'Login failed. Please try again.';
    }
  }

  function handleLogout() {
    isAuthenticated = false;
    currentUser = null;
    activeTab = 'tasks';
  }

  // Task management functions
  async function createTask(event) {
    event.preventDefault();
    
    if (!newTaskDescription.trim()) return;
    
    const validItems = selectedItems.filter(item => item.itemId && item.quantity > 0);
    
    const task = {
      id: Date.now().toString(),
      description: newTaskDescription,
      dueDate: newTaskDueDate,
      priority: newTaskPriority,
      status: 'pending',
      createdBy: currentUser.id,
      createdAt: new Date().toISOString(),
      items: validItems.map(item => ({
        itemId: item.itemId,
        quantity: parseInt(item.quantity),
        completedQuantity: 0
      }))
    };
    
    await storage.createTask(task);
    await loadData();
    
    // Reset form
    newTaskDescription = '';
    newTaskDueDate = '';
    newTaskPriority = 'low';
    selectedItems = [{ itemId: '', quantity: 1 }];
  }

  function addItemToTask() {
    selectedItems = [...selectedItems, { itemId: '', quantity: 1 }];
  }

  function removeItemFromTask(index) {
    selectedItems = selectedItems.filter((_, i) => i !== index);
  }

  // Item management functions
  async function createItem(event) {
    event.preventDefault();
    
    if (!newItemName.trim()) return;
    
    const item = {
      id: Date.now().toString(),
      name: newItemName
    };
    
    await storage.createItem(item.name);
    await loadData();
    
    newItemName = '';
  }

  function startEditingItem(item) {
    editingItem = { ...item };
  }

  async function updateItem(event) {
    event.preventDefault();
    
    if (!editingItem.name.trim()) return;
    
    await storage.updateItem(editingItem.id, editingItem.name);
    await loadData();
    
    editingItem = null;
  }

  function cancelEditingItem() {
    editingItem = null;
  }

  async function deleteItem(itemId) {
    if (confirm('Are you sure you want to delete this item?')) {
      await storage.deleteItem(itemId);
      await loadData();
    }
  }

  // Task editing functions
  function startEditingTask(task) {
    editingTask = task;
    editTaskDescription = task.description;
    editTaskDueDate = task.dueDate || '';
    editTaskPriority = task.priority;
  }

  async function saveEditTask(event) {
    event.preventDefault();
    
    const updatedTask = {
      ...editingTask,
      description: editTaskDescription,
      dueDate: editTaskDueDate,
      priority: editTaskPriority
    };
    
    await storage.updateTask(updatedTask);
    await loadData();
    
    editingTask = null;
  }

  function cancelEditTask() {
    editingTask = null;
  }

  // Auditable update system functions
  async function openUpdateModal(task) {
    updatingTask = task;
    // Initialize update quantities for each item
    updateQuantities = {};
    task.items.forEach(item => {
      updateQuantities[item.itemId] = 0;
    });
    
    // Load update history for this task
    taskUpdates = await storage.getTaskItemUpdates(task.id);
  }

  async function submitItemUpdates(event) {
    event.preventDefault();
    
    if (!updatingTask) return;
    
    // Prepare updates array with only items that have quantities > 0
    const itemUpdates = [];
    updatingTask.items.forEach(item => {
      const quantityToAdd = parseInt(updateQuantities[item.itemId]) || 0;
      if (quantityToAdd > 0) {
        itemUpdates.push({
          itemId: item.itemId,
          itemName: getItemName(item.itemId),
          quantityAdded: quantityToAdd,
          newTotal: Math.min(item.completedQuantity + quantityToAdd, item.quantity)
        });
      }
    });
    
    if (itemUpdates.length === 0) {
      alert('Please enter at least one quantity to update.');
      return;
    }
    
    try {
      await storage.addTaskItemUpdate(updatingTask.id, itemUpdates, currentUser.id);
      await loadData();
      updatingTask = null;
      updateQuantities = {};
    } catch (error) {
      alert('Error updating task items: ' + error.message);
    }
  }

  function cancelUpdate() {
    updatingTask = null;
    updateQuantities = {};
  }

  function toggleUpdateHistory(taskId) {
    showUpdateHistory[taskId] = !showUpdateHistory[taskId];
  }

  function getItemName(itemId) {
    const item = items.find(i => i.id === itemId);
    return item ? item.name : 'Unknown Item';
  }

  function getUserName(userId) {
    const user = users.find(u => u.id == userId);
    return user ? user.name || user.email : 'Unknown User';
  }

  function getPriorityColor(priority) {
    switch (priority) {
      case 'high': return 'text-red-600 dark:text-red-400';
      case 'medium': return 'text-yellow-600 dark:text-yellow-400';
      case 'low': return 'text-green-600 dark:text-green-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  }

  function getStatusColor(status) {
    switch (status) {
      case 'completed': return 'text-green-600 dark:text-green-400';
      case 'in-progress': return 'text-blue-600 dark:text-blue-400';
      case 'pending': return 'text-gray-600 dark:text-gray-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  }

  function sortTasksByPriority(tasks) {
    const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
    return [...tasks].sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
  }

  async function deleteTask(taskId) {
    if (confirm('Are you sure you want to delete this task?')) {
      await storage.deleteTask(taskId);
      await loadData();
    }
  }
</script>

<main class="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 transition-all duration-300">
  {#if !isAuthenticated}
    <!-- Login Screen -->
    <div class="min-h-screen flex items-center justify-center p-4">
      <div class="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl shadow-2xl p-8 w-full max-w-md border border-white/20 dark:border-slate-700/50">
        <div class="text-center mb-8">
          <h1 class="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            TaskTracker Pro
          </h1>
          <p class="text-slate-600 dark:text-slate-400">Professional Task Management System</p>
        </div>

        <form onsubmit={handleLogin} class="space-y-6">
          <div>
            <label for="email" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              bind:value={loginEmail}
              class="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              placeholder="Enter your email"
              required
            />
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              bind:value={loginPassword}
              class="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              placeholder="Enter your password"
              required
            />
          </div>

          {#if loginError}
            <div class="text-red-600 dark:text-red-400 text-sm text-center bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
              {loginError}
            </div>
          {/if}

          <button
            type="submit"
            class="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02]"
          >
            Sign In
          </button>
        </form>

        <div class="mt-8 p-4 bg-slate-100 dark:bg-slate-700/50 rounded-xl">
          <p class="text-sm text-slate-600 dark:text-slate-400 mb-2 font-medium">Demo Accounts:</p>
          <div class="text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <div><strong>Admin:</strong> admin@company.com / password</div>
            <div><strong>User:</strong> user@company.com / password</div>
          </div>
        </div>
      </div>
    </div>
  {:else}
    <!-- Main Application -->
    <div class="min-h-screen">
      <!-- Header -->
      <header class="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-b border-white/20 dark:border-slate-700/50 sticky top-0 z-40">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between items-center h-16">
            <div class="flex items-center space-x-4">
              <h1 class="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                TaskTracker Pro
              </h1>
              <div class="text-sm text-slate-600 dark:text-slate-400">
                Welcome, {currentUser.name}
              </div>
            </div>

            <div class="flex items-center space-x-4">
              <button
                onclick={toggleTheme}
                class="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors duration-200"
                aria-label="Toggle theme"
              >
                {#if isDarkMode}
                  <svg class="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707a1 1 0 001.414 0zM4 11a1 1 0 100-2H3a1 1 0 000 2h1zm7-4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1z" clip-rule="evenodd"></path>
                  </svg>
                {:else}
                  <svg class="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 20 20">
                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path>
                  </svg>
                {/if}
              </button>

              <button
                onclick={handleLogout}
                class="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition-colors duration-200"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <!-- Navigation Tabs -->
      <div class="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border-b border-white/20 dark:border-slate-700/50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav class="flex space-x-8">
            <button
              onclick={() => activeTab = 'tasks'}
              class="py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 {activeTab === 'tasks' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}"
            >
              Tasks
            </button>
            <button
              onclick={() => activeTab = 'items'}
              class="py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 {activeTab === 'items' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}"
            >
              Manage Items
            </button>
          </nav>
        </div>
      </div>

      <!-- Content -->
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {#if activeTab === 'tasks'}
          <!-- Tasks Tab -->
          <div class="flex flex-col lg:flex-row gap-8">
            <!-- Moved Create Task Form to the left - 30% width on large screens -->
            <div class="lg:w-[30%] lg:min-w-[350px]">
              <div class="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-xl p-6 border border-white/20 dark:border-slate-700/50 lg:sticky lg:top-24">
                <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-6">Create New Task</h2>
                
                <form onsubmit={createTask} class="space-y-6">
                  <div>
                    <label for="taskDescription" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Task Description
                    </label>
                    <input
                      id="taskDescription"
                      type="text"
                      bind:value={newTaskDescription}
                      class="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white/50 dark:bg-slate-700/50 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      placeholder="Enter task description"
                      required
                    />
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label for="taskDueDate" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Due Date
                      </label>
                      <input
                        id="taskDueDate"
                        type="date"
                        bind:value={newTaskDueDate}
                        class="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white/50 dark:bg-slate-700/50 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      />
                    </div>

                    <div>
                      <label for="taskPriority" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Priority
                      </label>
                      <select
                        id="taskPriority"
                        bind:value={newTaskPriority}
                        class="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white/50 dark:bg-slate-700/50 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                  </div>

                  <!-- Task Items -->
                  <div>
                    <div class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-4">
                      Task Items
                    </div>
                    <div class="space-y-3">
                      {#each selectedItems as item, index}
                        <div class="flex items-center space-x-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                          <select
                            bind:value={item.itemId}
                            class="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                          >
                            <option value="">Select an item</option>
                            {#each items as availableItem}
                              <option value={availableItem.id}>{availableItem.name}</option>
                            {/each}
                          </select>
                          
                          <input
                            type="number"
                            bind:value={item.quantity}
                            min="1"
                            class="w-20 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                            placeholder="Qty"
                          />
                          
                          {#if selectedItems.length > 1}
                            <button
                              type="button"
                              onclick={() => removeItemFromTask(index)}
                              class="p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors duration-200"
                              aria-label="Remove item"
                            >
                              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                              </svg>
                            </button>
                          {/if}
                        </div>
                      {/each}
                      
                      <button
                        type="button"
                        onclick={addItemToTask}
                        class="w-full py-2 px-4 border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg transition-all duration-200"
                      >
                        + Add Another Item
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    class="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-[1.02]"
                  >
                    Create Task
                  </button>
                </form>
              </div>
            </div>

            <!-- Moved Tasks List to the right - 70% width on large screens -->
            <div class="flex-1 lg:w-[70%] space-y-4">
              <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">Tasks</h2>
              
              {#if tasks.length === 0}
                <div class="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-xl p-8 text-center border border-white/20 dark:border-slate-700/50">
                  <p class="text-slate-600 dark:text-slate-400">No tasks created yet. Create your first task using the form!</p>
                </div>
              {:else}
                <!-- Added priority sorting to display tasks from high to low priority -->
                {#each sortTasksByPriority(tasks) as task}
                  <div class="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-xl p-6 border border-white/20 dark:border-slate-700/50">
                    <div class="flex justify-between items-start mb-4">
                      <div class="flex-1">
                        <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                          {task.description}
                        </h3>
                        <div class="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                          <span class="flex items-center">
                            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3a1 1 0 012 0v4m0 0V3a1 1 0 012 0v4m0 0h4l-4 4-4-4h4z"></path>
                            </svg>
                            Priority: <span class="{getPriorityColor(task.priority)} font-medium ml-1">{task.priority}</span>
                          </span>
                          <span class="flex items-center">
                            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            Status: <span class="{getStatusColor(task.status)} font-medium ml-1">{task.status}</span>
                          </span>
                          {#if task.dueDate}
                            <span class="flex items-center">
                              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3a1 1 0 012 0v4m0 0V3a1 1 0 012 0v4m0 0h4l-4 4-4-4h4z"></path>
                              </svg>
                              Due: {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          {/if}
                          <span class="flex items-center">
                            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            Created: {new Date(task.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      
                      <div class="flex items-center space-x-2">
                        <button
                          onclick={() => startEditingTask(task)}
                          class="p-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors duration-200"
                          aria-label="Edit task"
                        >
                          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                          </svg>
                        </button>
                        <button
                          onclick={() => deleteTask(task.id)}
                          class="p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors duration-200"
                          aria-label="Delete task"
                        >
                          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                          </svg>
                        </button>
                      </div>
                    </div>

                    <!-- Task Items -->
                    {#if task.items && task.items.length > 0}
                      <div class="mt-4">
                        <h4 class="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Task Items:</h4>
                        <div class="space-y-3">
                          {#each task.items as taskItem}
                            <div class="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                              <div class="flex-1">
                                <span class="font-medium text-slate-900 dark:text-slate-100">
                                  {getItemName(taskItem.itemId)}
                                </span>
                                <div class="mt-1">
                                  <div class="flex items-center space-x-2">
                                    <div class="flex-1 bg-slate-200 dark:bg-slate-600 rounded-full h-2">
                                      <div 
                                        class="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                                        style="width: {(taskItem.completedQuantity / taskItem.quantity) * 100}%"
                                      ></div>
                                    </div>
                                    <span class="text-sm text-slate-600 dark:text-slate-400 min-w-0">
                                      {taskItem.completedQuantity}/{taskItem.quantity}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          {/each}
                        </div>
                        
                        <div class="flex items-center justify-between mt-4">
                          <button
                            onclick={() => openUpdateModal(task)}
                            class="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 transform hover:scale-[1.02]"
                          >
                            Update Progress
                          </button>
                          
                          <button
                            onclick={() => toggleUpdateHistory(task.id)}
                            class="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-sm font-medium transition-colors duration-200"
                          >
                            {showUpdateHistory[task.id] ? 'Hide' : 'Show'} Update History
                          </button>
                        </div>
                        
                        <!-- Update History Section -->
                        {#if showUpdateHistory[task.id]}
                          <div class="mt-4 p-4 bg-slate-100 dark:bg-slate-600/50 rounded-lg">
                            <h5 class="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Update History</h5>
                            {#await storage.getTaskItemUpdates(task.id) then updates}
                              {#if updates.length === 0}
                                <p class="text-sm text-slate-500 dark:text-slate-400">No updates recorded yet.</p>
                              {:else}
                                <div class="space-y-2">
                                  {#each updates.reverse() as update}
                                    <div class="text-xs bg-white dark:bg-slate-700 p-3 rounded border">
                                      <div class="flex justify-between items-start mb-2">
                                        <span class="font-medium text-slate-900 dark:text-slate-100">
                                          {getUserName(update.updatedBy)}
                                        </span>
                                        <span class="text-slate-500 dark:text-slate-400">
                                          {new Date(update.updatedAt).toLocaleString()}
                                        </span>
                                      </div>
                                      <div class="space-y-1">
                                        {#each update.itemUpdates as itemUpdate}
                                          <div class="text-slate-600 dark:text-slate-300">
                                            <strong>{itemUpdate.itemName}:</strong> +{itemUpdate.quantityAdded} 
                                            (Total: {itemUpdate.newTotal})
                                          </div>
                                        {/each}
                                      </div>
                                    </div>
                                  {/each}
                                </div>
                              {/if}
                            {/await}
                          </div>
                        {/if}
                      </div>
                    {/if}
                  </div>
                {/each}
              {/if}
            </div>
          </div>
        {:else if activeTab === 'items'}
          <!-- Items Tab -->
          <div class="space-y-8">
            <!-- Create Item Form -->
            <div class="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-xl p-6 border border-white/20 dark:border-slate-700/50">
              <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-6">Add New Item</h2>
              
              <form onsubmit={createItem} class="space-y-4">
                <div>
                  <label for="itemName" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Item Name
                  </label>
                  <input
                    id="itemName"
                    type="text"
                    bind:value={newItemName}
                    class="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white/50 dark:bg-slate-700/50 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="Enter item name"
                    required
                  />
                </div>

                <button
                  type="submit"
                  class="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-[1.02]"
                >
                  Add Item
                </button>
              </form>
            </div>

            <!-- Items List -->
            <div class="space-y-4">
              <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">Predefined Items</h2>
              
              {#if items.length === 0}
                <div class="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-xl p-8 text-center border border-white/20 dark:border-slate-700/50">
                  <p class="text-slate-600 dark:text-slate-400">No items created yet. Add your first item above!</p>
                </div>
              {:else}
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {#each items as item}
                    <div class="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-xl shadow-lg p-4 border border-white/20 dark:border-slate-700/50">
                      {#if editingItem && editingItem.id === item.id}
                        <form onsubmit={updateItem} class="space-y-3">
                          <input
                            type="text"
                            bind:value={editingItem.name}
                            class="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white/50 dark:bg-slate-700/50 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                            required
                          />
                          <div class="flex space-x-2">
                            <button
                              type="submit"
                              class="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors duration-200"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onclick={cancelEditingItem}
                              class="flex-1 bg-gray-500 hover:bg-gray-600 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors duration-200"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      {:else}
                        <div class="flex justify-between items-center">
                          <div class="flex-1">
                            <h3 class="font-medium text-slate-900 dark:text-slate-100">{item.name}</h3>
                          </div>
                          <div class="flex items-center space-x-2">
                            <button
                              onclick={() => startEditingItem(item)}
                              class="p-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors duration-200"
                              aria-label="Edit item"
                            >
                              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                              </svg>
                            </button>
                            <button
                              onclick={() => deleteItem(item.id)}
                              class="p-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors duration-200"
                              aria-label="Delete item"
                            >
                              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                              </svg>
                            </button>
                          </div>
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    </div>

    <!-- Edit Task Modal -->
    {#if editingTask}
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div class="bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-2xl shadow-2xl p-6 w-full max-w-md border border-white/20 dark:border-slate-700/50">
          <h3 class="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-6">Edit Task</h3>
          
          <form onsubmit={saveEditTask} class="space-y-4">
            <div>
              <label for="editDescription" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Task Description
              </label>
              <input
                id="editDescription"
                type="text"
                bind:value={editTaskDescription}
                class="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white/50 dark:bg-slate-700/50 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                placeholder="Enter task description"
                required
              />
            </div>

            <div>
              <label for="editDueDate" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Due Date
              </label>
              <input
                id="editDueDate"
                type="date"
                bind:value={editTaskDueDate}
                class="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white/50 dark:bg-slate-700/50 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
            </div>

            <div>
              <label for="editPriority" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Priority
              </label>
              <select
                id="editPriority"
                bind:value={editTaskPriority}
                class="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white/50 dark:bg-slate-700/50 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div class="flex space-x-3 pt-4">
              <button
                type="submit"
                class="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
                aria-label="Save Changes"
              >
                Save Changes
              </button>
              <button
                type="button"
                onclick={cancelEditTask}
                class="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
                aria-label="Cancel"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    {/if}

    <!-- Update Progress Modal -->
    {#if updatingTask}
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div class="bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-2xl shadow-2xl p-6 w-full max-w-lg border border-white/20 dark:border-slate-700/50">
          <h3 class="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-6">Update Task Progress</h3>
          <p class="text-sm text-slate-600 dark:text-slate-400 mb-6">
            Task: <strong>{updatingTask.description}</strong>
          </p>
          
          <form onsubmit={submitItemUpdates} class="space-y-4">
            <div class="space-y-4">
              {#each updatingTask.items as taskItem}
                <div class="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <div class="flex justify-between items-center mb-2">
                    <span class="font-medium text-slate-900 dark:text-slate-100">
                      {getItemName(taskItem.itemId)}
                    </span>
                    <span class="text-sm text-slate-600 dark:text-slate-400">
                      Current: {taskItem.completedQuantity}/{taskItem.quantity}
                    </span>
                  </div>
                  
                  <div class="flex items-center space-x-3">
                    <label for="qty-{taskItem.itemId}" class="text-sm text-slate-700 dark:text-slate-300">
                      Add completed:
                    </label>
                    <input
                      id="qty-{taskItem.itemId}"
                      type="number"
                      bind:value={updateQuantities[taskItem.itemId]}
                      min="0"
                      max={taskItem.quantity - taskItem.completedQuantity}
                      class="w-20 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      placeholder="0"
                    />
                    <span class="text-sm text-slate-500 dark:text-slate-400">
                      (Max: {taskItem.quantity - taskItem.completedQuantity})
                    </span>
                  </div>
                </div>
              {/each}
            </div>

            <div class="flex space-x-3 pt-4">
              <button
                type="submit"
                class="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
              >
                Submit Updates
              </button>
              <button
                type="button"
                onclick={cancelUpdate}
                class="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    {/if}
  {/if}
</main>
