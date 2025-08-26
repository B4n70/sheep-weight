"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Sun, Moon, Trash2, Clock, Calendar, Edit2 } from "lucide-react"

interface User {
  id: string
  email: string
  role: string
}

interface Task {
  id: string
  description: string
  status: string
  priority: string
  due_date: string
  created_at: string
  created_by: string
  items: TaskItem[]
}

interface TaskItem {
  id: string
  item_id: string
  quantity: number
  completed_quantity: number
  item_name: string
}

interface Item {
  id: string
  name: string
}

interface UpdateProgress {
  taskId: string
  items: { itemId: string; itemName: string; currentQuantity: number; maxQuantity: number; newQuantity: number }[]
}

export default function TaskTracker() {
  const [user, setUser] = useState<User | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [activeTab, setActiveTab] = useState("tasks")

  // Authentication states
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [signupEmail, setSignupEmail] = useState("")
  const [signupPassword, setSignupPassword] = useState("")
  const [authMode, setAuthMode] = useState<"login" | "signup">("login")
  const [authError, setAuthError] = useState("")

  // Data states
  const [tasks, setTasks] = useState<Task[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)

  // Task creation states
  const [newTaskDescription, setNewTaskDescription] = useState("")
  const [newTaskDueDate, setNewTaskDueDate] = useState("")
  const [newTaskPriority, setNewTaskPriority] = useState("medium")
  const [selectedItems, setSelectedItems] = useState<{ itemId: string; quantity: number }[]>([
    { itemId: "", quantity: 1 },
  ])

  // Manage items states
  const [newItemName, setNewItemName] = useState("")
  const [editingItem, setEditingItem] = useState<{ id: string; name: string } | null>(null)

  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [updateProgress, setUpdateProgress] = useState<UpdateProgress | null>(null)

  useEffect(() => {
    checkUser()
    initializeTheme()
  }, [])

  const checkUser = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (session?.user) {
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", session.user.id).single()

      if (profile) {
        setUser({
          id: profile.id,
          email: profile.email,
          role: profile.role,
        })
        setIsAuthenticated(true)
        loadData()
      }
    }
  }

  const initializeTheme = () => {
    const savedTheme = localStorage.getItem("theme")
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    const shouldBeDark = savedTheme === "dark" || (!savedTheme && prefersDark)

    setIsDarkMode(shouldBeDark)
    document.documentElement.classList.toggle("dark", shouldBeDark)
  }

  const toggleTheme = () => {
    const newTheme = !isDarkMode
    setIsDarkMode(newTheme)
    document.documentElement.classList.toggle("dark", newTheme)
    localStorage.setItem("theme", newTheme ? "dark" : "light")
  }

  const loadData = async () => {
    setLoading(true)
    try {
      // Load tasks with items
      const { data: tasksData } = await supabase
        .from("tasks")
        .select(`
          *,
          task_items (
            id,
            item_id,
            quantity,
            completed_quantity,
            items (name)
          )
        `)
        .order("created_at", { ascending: false })

      const { data: itemsData } = await supabase.from("items").select("*").order("name")

      if (tasksData) {
        const formattedTasks = tasksData.map((task) => ({
          ...task,
          items: task.task_items.map((item: any) => ({
            ...item,
            item_name: item.items.name,
          })),
        }))
        setTasks(formattedTasks)
      }

      if (itemsData) {
        setItems(itemsData)
      }
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError("")
    setLoading(true)

    try {
      if (authMode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password: loginPassword,
        })

        if (error) throw error

        if (data.user) {
          await checkUser()
          setLoginEmail("")
          setLoginPassword("")
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: signupEmail,
          password: signupPassword,
        })

        if (error) throw error

        if (data.user) {
          setAuthError("Please check your email to confirm your account")
          setSignupEmail("")
          setSignupPassword("")
        }
      }
    } catch (error: any) {
      setAuthError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setIsAuthenticated(false)
    setTasks([])
    setItems([])
  }

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTaskDescription.trim() || !user) return

    setLoading(true)
    try {
      const validItems = selectedItems.filter((item) => item.itemId && item.quantity > 0)

      const { data: taskData, error: taskError } = await supabase
        .from("tasks")
        .insert({
          description: newTaskDescription,
          status: "pending",
          priority: newTaskPriority,
          due_date: newTaskDueDate || null,
          created_by: user.id,
        })
        .select()
        .single()

      if (taskError) throw taskError

      if (validItems.length > 0) {
        const taskItems = validItems.map((item) => ({
          task_id: taskData.id,
          item_id: item.itemId,
          quantity: item.quantity,
          completed_quantity: 0,
        }))

        const { error: itemsError } = await supabase.from("task_items").insert(taskItems)

        if (itemsError) throw itemsError
      }

      // Reset form
      setNewTaskDescription("")
      setNewTaskDueDate("")
      setNewTaskPriority("medium")
      setSelectedItems([{ itemId: "", quantity: 1 }])

      await loadData()
    } catch (error) {
      console.error("Error creating task:", error)
    } finally {
      setLoading(false)
    }
  }

  // Manage items functions
  const createItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItemName.trim()) return

    setLoading(true)
    try {
      const { error } = await supabase.from("items").insert({ name: newItemName.trim() })

      if (error) throw error

      setNewItemName("")
      await loadData()
    } catch (error) {
      console.error("Error creating item:", error)
    } finally {
      setLoading(false)
    }
  }

  const updateItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingItem || !editingItem.name.trim()) return

    setLoading(true)
    try {
      const { error } = await supabase.from("items").update({ name: editingItem.name.trim() }).eq("id", editingItem.id)

      if (error) throw error

      setEditingItem(null)
      await loadData()
    } catch (error) {
      console.error("Error updating item:", error)
    } finally {
      setLoading(false)
    }
  }

  const deleteItem = async (itemId: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return

    setLoading(true)
    try {
      const { error } = await supabase.from("items").delete().eq("id", itemId)

      if (error) throw error

      await loadData()
    } catch (error) {
      console.error("Error deleting item:", error)
    } finally {
      setLoading(false)
    }
  }

  const openUpdateModal = (task: Task) => {
    const updateData: UpdateProgress = {
      taskId: task.id,
      items: task.items.map((item) => ({
        itemId: item.id,
        itemName: item.item_name,
        currentQuantity: item.completed_quantity,
        maxQuantity: item.quantity,
        newQuantity: 0,
      })),
    }
    setUpdateProgress(updateData)
    setShowUpdateModal(true)
  }

  const submitProgressUpdate = async () => {
    if (!updateProgress || !user) return

    setLoading(true)
    try {
      // Update each item's progress
      for (const item of updateProgress.items) {
        if (item.newQuantity > 0) {
          const newCompletedQuantity = item.currentQuantity + item.newQuantity

          // Update the task item
          const { error: updateError } = await supabase
            .from("task_items")
            .update({ completed_quantity: newCompletedQuantity })
            .eq("id", item.itemId)

          if (updateError) throw updateError

          // Create audit trail
          const { error: auditError } = await supabase.from("audit_trail").insert({
            task_id: updateProgress.taskId,
            user_id: user.id,
            action: "progress_update",
            details: {
              item_id: item.itemId,
              item_name: item.itemName,
              quantity_added: item.newQuantity,
              previous_completed: item.currentQuantity,
              new_completed: newCompletedQuantity,
            },
          })

          if (auditError) throw auditError
        }
      }

      setShowUpdateModal(false)
      setUpdateProgress(null)
      await loadData()
    } catch (error) {
      console.error("Error updating progress:", error)
    } finally {
      setLoading(false)
    }
  }

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    if (!user) return

    setLoading(true)
    try {
      const { error } = await supabase.from("tasks").update({ status: newStatus }).eq("id", taskId)

      if (error) {
        throw error
      }

      // Create audit trail for status change
      const { error: auditError } = await supabase.from("audit_trail").insert({
        task_id: taskId,
        user_id: user.id,
        action: "status_change",
        details: {
          new_status: newStatus,
          changed_at: new Date().toISOString(),
        },
      })

      if (auditError) throw auditError

      await loadData()
    } catch (error) {
      console.error("Error updating task status:", error)
    } finally {
      setLoading(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">FocusFlow</CardTitle>
            <Button variant="ghost" size="sm" onClick={toggleTheme} className="absolute top-4 right-4">
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </CardHeader>
          <CardContent>
            <Tabs value={authMode} onValueChange={(value) => setAuthMode(value as "login" | "signup")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleAuth} className="space-y-4">
                  <Input
                    type="email"
                    placeholder="Email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleAuth} className="space-y-4">
                  <Input
                    type="email"
                    placeholder="Email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                  />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                  />
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Creating account..." : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {authError && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <p className="text-sm text-red-600 dark:text-red-400">{authError}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">FocusFlow</h1>
            <div className="flex items-center space-x-4">
              <Badge variant="secondary">{user?.role}</Badge>
              <Button variant="ghost" size="sm" onClick={toggleTheme}>
                {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button variant="outline" onClick={handleSignOut}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="manage-items">Manage Items</TabsTrigger>
          </TabsList>

          <TabsContent value="tasks">
            <div className="flex gap-8">
              {/* Create Task Form - Left Side (30%) */}
              <div className="w-full lg:w-[30%]">
                <Card className="sticky top-24">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Plus className="h-5 w-5" />
                      Create New Task
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={createTask} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Description</label>
                        <Input
                          value={newTaskDescription}
                          onChange={(e) => setNewTaskDescription(e.target.value)}
                          placeholder="Enter task description"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Due Date</label>
                        <Input type="date" value={newTaskDueDate} onChange={(e) => setNewTaskDueDate(e.target.value)} />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Priority</label>
                        <select
                          value={newTaskPriority}
                          onChange={(e) => setNewTaskPriority(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Task Items</label>
                        {selectedItems.map((selectedItem, index) => (
                          <div key={index} className="flex gap-2 mb-2">
                            <select
                              value={selectedItem.itemId}
                              onChange={(e) => {
                                const newItems = [...selectedItems]
                                newItems[index].itemId = e.target.value
                                setSelectedItems(newItems)
                              }}
                              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
                            >
                              <option value="">Select item</option>
                              {items.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name}
                                </option>
                              ))}
                            </select>
                            <Input
                              type="number"
                              min="1"
                              value={selectedItem.quantity}
                              onChange={(e) => {
                                const newItems = [...selectedItems]
                                newItems[index].quantity = Number.parseInt(e.target.value) || 1
                                setSelectedItems(newItems)
                              }}
                              className="w-20"
                            />
                            {selectedItems.length > 1 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const newItems = selectedItems.filter((_, i) => i !== index)
                                  setSelectedItems(newItems)
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedItems([...selectedItems, { itemId: "", quantity: 1 }])}
                          className="w-full"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Item
                        </Button>
                      </div>

                      <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? "Creating..." : "Create Task"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>

              {/* Tasks List - Right Side (70%) */}
              <div className="w-full lg:w-[70%]">
                <div className="space-y-4">
                  {loading && tasks.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="mt-2 text-gray-600 dark:text-gray-400">Loading tasks...</p>
                    </div>
                  ) : tasks.length === 0 ? (
                    <Card>
                      <CardContent className="text-center py-8">
                        <p className="text-gray-600 dark:text-gray-400">No tasks yet. Create your first task!</p>
                      </CardContent>
                    </Card>
                  ) : (
                    tasks
                      .sort((a, b) => {
                        const priorityOrder = { high: 3, medium: 2, low: 1 }
                        return (
                          priorityOrder[b.priority as keyof typeof priorityOrder] -
                          priorityOrder[a.priority as keyof typeof priorityOrder]
                        )
                      })
                      .map((task) => (
                        <Card key={task.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-6">
                            <div className="flex justify-between items-start mb-4">
                              <div className="flex-1">
                                <h3 className="text-lg font-semibold mb-2">{task.description}</h3>
                                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                                  <Badge
                                    variant={
                                      task.priority === "high"
                                        ? "destructive"
                                        : task.priority === "medium"
                                          ? "default"
                                          : "secondary"
                                    }
                                  >
                                    {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                                  </Badge>
                                  <div className="relative group">
                                    <Badge
                                      variant="outline"
                                      className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                                    >
                                      {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                                    </Badge>
                                    <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                                      <div className="py-1 min-w-[120px]">
                                        {["pending", "in-progress", "completed", "cancelled"].map((status) => (
                                          <button
                                            key={status}
                                            onClick={() => updateTaskStatus(task.id, status)}
                                            className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                                            disabled={loading || task.status === status}
                                          >
                                            {status.charAt(0).toUpperCase() + status.slice(1)}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                  {task.due_date && (
                                    <div className="flex items-center gap-1">
                                      <Calendar className="h-4 w-4" />
                                      {new Date(task.due_date).toLocaleDateString()}
                                    </div>
                                  )}
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-4 w-4" />
                                    {new Date(task.created_at).toLocaleDateString()}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {task.items && task.items.length > 0 && (
                              <div className="space-y-2">
                                <h4 className="font-medium text-sm">Task Items:</h4>
                                {task.items.map((item) => (
                                  <div
                                    key={item.id}
                                    className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded"
                                  >
                                    <span className="text-sm">{item.item_name}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-gray-600 dark:text-gray-400">
                                        {item.completed_quantity}/{item.quantity}
                                      </span>
                                      <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                        <div
                                          className="bg-blue-600 h-2 rounded-full transition-all"
                                          style={{
                                            width: `${Math.min((item.completed_quantity / item.quantity) * 100, 100)}%`,
                                          }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                ))}
                                <div className="pt-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openUpdateModal(task)}
                                    className="w-full"
                                  >
                                    <Edit2 className="h-4 w-4 mr-2" />
                                    Update Progress
                                  </Button>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Manage items tab content */}
          <TabsContent value="manage-items">
            <div className="flex gap-8">
              {/* Create Item Form - Left Side (30%) */}
              <div className="w-full lg:w-[30%]">
                <Card className="sticky top-24">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Plus className="h-5 w-5" />
                      {editingItem ? "Edit Item" : "Create New Item"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={editingItem ? updateItem : createItem} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Item Name</label>
                        <Input
                          value={editingItem ? editingItem.name : newItemName}
                          onChange={(e) => {
                            if (editingItem) {
                              setEditingItem({ ...editingItem, name: e.target.value })
                            } else {
                              setNewItemName(e.target.value)
                            }
                          }}
                          placeholder="Enter item name"
                          required
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button type="submit" className="flex-1" disabled={loading}>
                          {loading ? "Saving..." : editingItem ? "Update Item" : "Create Item"}
                        </Button>
                        {editingItem && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setEditingItem(null)
                              setNewItemName("")
                            }}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </div>

              {/* Items List - Right Side (70%) */}
              <div className="w-full lg:w-[70%]">
                <div className="space-y-4">
                  {loading && items.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="mt-2 text-gray-600 dark:text-gray-400">Loading items...</p>
                    </div>
                  ) : items.length === 0 ? (
                    <Card>
                      <CardContent className="text-center py-8">
                        <p className="text-gray-600 dark:text-gray-400">No items yet. Create your first item!</p>
                      </CardContent>
                    </Card>
                  ) : (
                    items.map((item) => (
                      <Card key={item.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-6">
                          <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold">{item.name}</h3>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingItem({ id: item.id, name: item.name })}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteItem(item.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {showUpdateModal && updateProgress && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Update Task Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {updateProgress.items.map((item, index) => (
                  <div key={item.itemId} className="space-y-2">
                    <label className="block text-sm font-medium">{item.itemName}</label>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      Currently completed: {item.currentQuantity} / {item.maxQuantity}
                    </div>
                    <Input
                      type="number"
                      min="0"
                      max={item.maxQuantity - item.currentQuantity}
                      placeholder="How many completed today?"
                      value={item.newQuantity}
                      onChange={(e) => {
                        const newItems = [...updateProgress.items]
                        newItems[index].newQuantity = Number.parseInt(e.target.value) || 0
                        setUpdateProgress({ ...updateProgress, items: newItems })
                      }}
                    />
                  </div>
                ))}

                <div className="flex gap-2 pt-4">
                  <Button onClick={submitProgressUpdate} disabled={loading} className="flex-1">
                    {loading ? "Updating..." : "Submit Update"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowUpdateModal(false)
                      setUpdateProgress(null)
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
