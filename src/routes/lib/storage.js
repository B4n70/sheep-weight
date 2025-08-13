// Simple localStorage-based data storage
let taskIdCounter = Number.parseInt(localStorage.getItem("taskIdCounter") || "1")
let userIdCounter = Number.parseInt(localStorage.getItem("userIdCounter") || "1")
let itemIdCounter = Number.parseInt(localStorage.getItem("itemIdCounter") || "1")

// Helper functions
function saveToStorage(key, data) {
  localStorage.setItem(key, JSON.stringify(data))
}

function getFromStorage(key, defaultValue = []) {
  const stored = localStorage.getItem(key)
  return stored ? JSON.parse(stored) : defaultValue
}

// User management
export async function createUser(email, passwordHash, role = "team") {
  const users = getFromStorage("users", [])

  // Check if user already exists
  if (users.find((u) => u.email === email)) {
    throw new Error("User already exists")
  }

  const newUser = {
    id: userIdCounter++,
    email,
    password_hash: passwordHash,
    role,
    created_at: new Date().toISOString(),
  }

  users.push(newUser)
  saveToStorage("users", users)
  localStorage.setItem("userIdCounter", userIdCounter.toString())

  return newUser
}

export async function getUserByEmail(email) {
  const users = getFromStorage("users", [])
  return users.find((u) => u.email === email) || null
}

export async function getAllUsers() {
  return getFromStorage("users", [])
}

// Task management
export async function createTask(taskData) {
  const tasks = getFromStorage("tasks", [])
  const users = getFromStorage("users", [])

  const assignedUser = taskData.assignedTo ? users.find((u) => u.id == taskData.assignedTo) : null

  const newTask = {
    id: taskData.id || taskIdCounter++,
    description: taskData.description,
    priority: taskData.priority,
    status: taskData.status || "pending",
    assignedTo: taskData.assignedTo,
    assignedToEmail: assignedUser?.email || null,
    createdBy: taskData.createdBy,
    dueDate: taskData.dueDate,
    createdAt: taskData.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: taskData.items || [],
  }

  tasks.push(newTask)
  saveToStorage("tasks", tasks)
  localStorage.setItem("taskIdCounter", taskIdCounter.toString())

  return newTask
}

export async function getTasks() {
  return getFromStorage("tasks", [])
}

export async function updateTaskStatus(taskId, status) {
  const tasks = getFromStorage("tasks", [])
  const taskIndex = tasks.findIndex((t) => t.id == taskId)

  if (taskIndex !== -1) {
    tasks[taskIndex].status = status
    tasks[taskIndex].updated_at = new Date().toISOString()
    saveToStorage("tasks", tasks)
    return tasks[taskIndex]
  }

  throw new Error("Task not found")
}

export async function deleteTask(taskId) {
  const tasks = getFromStorage("tasks", [])
  const filteredTasks = tasks.filter((t) => t.id !== taskId)
  saveToStorage("tasks", filteredTasks)
}

// Enhanced task management with items
export async function createTaskWithItems(
  title,
  description,
  priority,
  assignedTo,
  createdBy,
  dueDate,
  taskItems = [],
) {
  const tasks = getFromStorage("tasks", [])
  const users = getFromStorage("users", [])

  const assignedUser = assignedTo ? users.find((u) => u.id == assignedTo) : null

  const newTask = {
    id: taskIdCounter++,
    title,
    description,
    priority,
    status: "pending",
    assigned_to: assignedTo,
    assigned_to_email: assignedUser?.email || null,
    created_by: createdBy,
    due_date: dueDate,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    items: taskItems, // Array of {itemId, itemName, quantity, unit}
  }

  tasks.push(newTask)
  saveToStorage("tasks", tasks)
  localStorage.setItem("taskIdCounter", taskIdCounter.toString())

  return newTask
}

export async function updateTask(taskId, updates) {
  const tasks = getFromStorage("tasks", [])
  const taskIndex = tasks.findIndex((t) => t.id == taskId)

  if (taskIndex !== -1) {
    tasks[taskIndex] = {
      ...tasks[taskIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    }
    saveToStorage("tasks", tasks)
    return tasks[taskIndex]
  }

  throw new Error("Task not found")
}

export async function addTaskItemUpdate(taskId, itemUpdates, updatedBy) {
  const updates = getFromStorage("taskItemUpdates", [])
  const tasks = getFromStorage("tasks", [])
  const taskIndex = tasks.findIndex((t) => t.id == taskId)

  if (taskIndex === -1) {
    throw new Error("Task not found")
  }

  const task = tasks[taskIndex]
  const updateRecord = {
    id: Date.now().toString(),
    taskId: taskId,
    taskDescription: task.description,
    updatedBy: updatedBy,
    updatedAt: new Date().toISOString(),
    itemUpdates: itemUpdates, // Array of {itemId, itemName, quantityAdded, newTotal}
  }

  // Update the task items with new quantities
  itemUpdates.forEach((update) => {
    const itemIndex = task.items.findIndex((item) => item.itemId === update.itemId)
    if (itemIndex !== -1) {
      task.items[itemIndex].completedQuantity = Math.min(
        task.items[itemIndex].completedQuantity + update.quantityAdded,
        task.items[itemIndex].quantity,
      )
    }
  })

  // Auto-update task status based on completion
  const allItemsCompleted = task.items.every((item) => item.completedQuantity >= item.quantity)
  const anyItemStarted = task.items.some((item) => item.completedQuantity > 0)

  if (allItemsCompleted) {
    task.status = "completed"
  } else if (anyItemStarted) {
    task.status = "in-progress"
  }

  task.updatedAt = new Date().toISOString()

  // Save the update record and updated task
  updates.push(updateRecord)
  saveToStorage("taskItemUpdates", updates)
  saveToStorage("tasks", tasks)

  return updateRecord
}

export async function getTaskItemUpdates(taskId = null) {
  const updates = getFromStorage("taskItemUpdates", [])
  if (taskId) {
    return updates.filter((update) => update.taskId == taskId)
  }
  return updates
}

// Item management
export async function createItem(name, description = "") {
  const items = getFromStorage("predefinedItems", [])

  const newItem = {
    id: itemIdCounter++,
    name,
    description,
    created_at: new Date().toISOString(),
  }

  items.push(newItem)
  saveToStorage("predefinedItems", items)
  localStorage.setItem("itemIdCounter", itemIdCounter.toString())

  return newItem
}

export async function updateItem(itemId, name, description = "") {
  const items = getFromStorage("predefinedItems", [])
  const itemIndex = items.findIndex((i) => i.id == itemId)

  if (itemIndex !== -1) {
    items[itemIndex] = { ...items[itemIndex], name, description, updated_at: new Date().toISOString() }
    saveToStorage("predefinedItems", items)
    return items[itemIndex]
  }

  throw new Error("Item not found")
}

export async function deleteItem(itemId) {
  const items = getFromStorage("predefinedItems", [])
  const filteredItems = items.filter((i) => i.id != itemId)
  saveToStorage("predefinedItems", filteredItems)
}

// Predefined items with enhanced structure
export async function getPredefinedItems() {
  const stored = getFromStorage("predefinedItems", [])
  if (stored.length === 0) {
    // Initialize with default items
    const defaultItems = [
      { id: 1, name: "Research Hours", description: "Research and analysis tasks" },
      { id: 2, name: "Development Hours", description: "Software development tasks" },
      { id: 3, name: "Testing Sessions", description: "Quality assurance and testing" },
      { id: 4, name: "Documentation Pages", description: "Documentation and writing" },
      { id: 5, name: "Review Items", description: "Code and content review" },
    ]
    saveToStorage("predefinedItems", defaultItems)
    itemIdCounter = 6
    localStorage.setItem("itemIdCounter", itemIdCounter.toString())
    return defaultItems
  }
  return stored
}

// Initialize with demo data if empty
export function initializeDemoData() {
  const users = getFromStorage("users", [])
  if (users.length === 0) {
    // SHA-256 hash of "password" is: 5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8
    createUser("admin@company.com", "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8", "main")
    createUser("user@company.com", "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8", "team")
  }
}

// Authentication function
export async function authenticateUser(email, password) {
  const user = await getUserByEmail(email)
  if (!user) return null

  // Hash the provided password and compare
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")

  return hashHex === user.password_hash ? user : null
}

// Data loading functions
export async function getItems() {
  return await getPredefinedItems()
}

export async function getUsers() {
  return await getAllUsers()
}
