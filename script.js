
"use strict";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const STORAGE_KEY = "taskflow_workspace_v1";
const COLORS = {
  purple: { bg: "#eeeaff", text: "#7157e8", bar: "purple-bg", icon: "✦" },
  blue: { bg: "#eaf3ff", text: "#478cf4", bar: "blue-bg", icon: "◈" },
  green: { bg: "#e6f8f0", text: "#25a77e", bar: "green-bg", icon: "✓" },
  orange: { bg: "#fff0df", text: "#e99542", bar: "orange-bg", icon: "⚡" },
  pink: { bg: "#ffedf7", text: "#e96bba", bar: "pink-bg", icon: "♡" }
};

const today = () => new Date().toISOString().slice(0, 10);
const makeId = () => crypto.randomUUID
  ? crypto.randomUUID()
  : Date.now().toString(36) + Math.random().toString(36).slice(2);

function seedData() {
  const p1 = makeId();
  const p2 = makeId();
  const p3 = makeId();

  return {
    name: "Workspace User",
    projects: [
      { id: p1, name: "Website Redesign", description: "Refresh the company website.", color: "purple", deadline: "", createdAt: Date.now() },
      { id: p2, name: "Marketing Campaign", description: "Plan and launch the next campaign.", color: "blue", deadline: "", createdAt: Date.now() },
      { id: p3, name: "Mobile App", description: "Improve the mobile experience.", color: "green", deadline: "", createdAt: Date.now() }
    ],
    tasks: [
      { id: makeId(), title: "Design homepage layout", description: "Prepare the new homepage design.", projectId: p1, assignee: "Alex", priority: "high", status: "progress", deadline: today(), comments: "Review the first draft.", createdAt: Date.now() },
      { id: makeId(), title: "Prepare campaign brief", description: "Finalize campaign goals and audience.", projectId: p2, assignee: "Jordan", priority: "medium", status: "todo", deadline: "", comments: "", createdAt: Date.now() },
      { id: makeId(), title: "Review app feedback", description: "Organize feedback from testers.", projectId: p3, assignee: "Taylor", priority: "low", status: "done", deadline: "", comments: "Initial review completed.", createdAt: Date.now() }
    ],
    notifications: [
      { id: makeId(), text: "Welcome to your TaskFlow workspace. Create your first task or edit the sample tasks.", createdAt: Date.now(), read: false }
    ]
  };
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedData();

    const data = JSON.parse(raw);
    if (!Array.isArray(data.projects) || !Array.isArray(data.tasks)) {
      return seedData();
    }

    return {
      name: typeof data.name === "string" ? data.name : "Workspace User",
      projects: data.projects,
      tasks: data.tasks,
      notifications: Array.isArray(data.notifications) ? data.notifications : []
    };
  } catch (error) {
    console.error("Could not load workspace data:", error);
    return seedData();
  }
}

let data = loadData();
let currentView = "overview";
let selectedProject = null;
let toastTimer;

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error(error);
    showToast("Unable to save. Browser storage may be full.");
    return false;
  }
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function formatDate(date) {
  if (!date) return "No deadline";
  const parsed = new Date(date + "T12:00:00");
  if (Number.isNaN(parsed.getTime())) return "No deadline";
  return parsed.toLocaleDateString(undefined, {
    day: "numeric", month: "short", year: "numeric"
  });
}

function projectById(id) {
  return data.projects.find(project => project.id === id);
}

function projectTasks(projectId) {
  return data.tasks.filter(task => task.projectId === projectId);
}

function taskProgress(projectId) {
  const tasks = projectTasks(projectId);
  if (!tasks.length) return 0;
  return Math.round(tasks.filter(task => task.status === "done").length / tasks.length * 100);
}

function addNotification(text) {
  data.notifications.unshift({
    id: makeId(),
    text,
    createdAt: Date.now(),
    read: false
  });
  data.notifications = data.notifications.slice(0, 30);
}

function updateProfile() {
  const initial = [...data.name.trim()][0]?.toUpperCase() || "U";
  $("#profileName").textContent = data.name;
  $("#displayName").value = data.name;
  $("#topProfileBtn").textContent = initial;
  $(".profile .avatar").textContent = initial;
}

function renderStats() {
  const completed = data.tasks.filter(task => task.status === "done").length;
  const progress = data.tasks.filter(task => task.status === "progress").length;
  const overdue = data.tasks.filter(task =>
    task.status !== "done" && task.deadline && task.deadline < today()
  ).length;
  const total = data.tasks.length;
  const rate = total ? Math.round(completed / total * 100) : 0;

  $("#totalTasks").textContent = total;
  $("#progressTasks").textContent = progress;
  $("#completedTasks").textContent = completed;
  $("#overdueTasks").textContent = overdue;
  $("#completionRate").textContent = rate + "%";
  $("#ringCompleted").textContent = completed;
  $("#ringRemaining").textContent = total - completed;
  $("#progressRing").style.background =
    `conic-gradient(var(--purple) ${rate * 3.6}deg, #efedf8 ${rate * 3.6}deg)`;
  $("#projectCount").textContent = data.projects.length;
}

function renderProjectNavigation() {
  $("#projectNav").innerHTML = data.projects.map(project => {
    const color = COLORS[project.color] || COLORS.purple;
    return `
      <button data-project="${escapeHTML(project.id)}" title="${escapeHTML(project.name)}">
        <i class="project-dot" style="background:${color.text}"></i>
        <span class="project-nav-name">${escapeHTML(project.name)}</span>
        <span>${projectTasks(project.id).length}</span>
      </button>`;
  }).join("");
}

function renderProjects() {
  const container = $("#projectCards");
  const empty = $("#emptyProjects");
  const projects = selectedProject
    ? data.projects.filter(project => project.id === selectedProject)
    : [...data.projects].sort((a, b) => b.createdAt - a.createdAt).slice(0, 4);

  empty.classList.toggle("hidden", data.projects.length > 0);
  container.classList.toggle("hidden", projects.length === 0);

  container.innerHTML = projects.map(project => {
    const color = COLORS[project.color] || COLORS.purple;
    const tasks = projectTasks(project.id);
    const percent = taskProgress(project.id);

    return `
      <article class="project-card">
        <div class="project-card-top">
          <div class="project-title-wrap">
            <span class="project-color-icon" style="background:${color.bg};color:${color.text}">${color.icon}</span>
            <div>
              <h3>${escapeHTML(project.name)}</h3>
              <p>${tasks.length} task${tasks.length === 1 ? "" : "s"}${project.deadline ? " · Due " + escapeHTML(formatDate(project.deadline)) : ""}</p>
            </div>
          </div>
          <div class="project-actions">
            <button data-edit-project="${escapeHTML(project.id)}" title="Edit project">✎</button>
            <button data-delete-project="${escapeHTML(project.id)}" title="Delete project">×</button>
          </div>
        </div>
        <p class="muted" style="margin-top:12px">${escapeHTML(project.description || "No description added.")}</p>
        <div class="project-progress-label"><span>Progress</span><strong>${percent}%</strong></div>
        <div class="progress-track"><div class="progress-fill ${color.bar}" style="width:${percent}%"></div></div>
        <button class="text-button" data-open-project="${escapeHTML(project.id)}" style="margin-top:13px;padding:0">View project tasks →</button>
      </article>`;
  }).join("");
}

function matchesSearch(task, query) {
  if (!query) return true;
  const project = projectById(task.projectId);
  const searchable = [
    task.title, task.description, task.assignee, task.comments,
    project?.name
  ].join(" ").toLowerCase();
  return searchable.includes(query.toLowerCase());
}

function getFilteredTasks() {
  const status = $("#statusFilter").value;
  const priority = $("#priorityFilter").value;
  const query = $("#taskSearch").value.trim();
  const globalQuery = $("#globalSearch").value.trim();

  return data.tasks.filter(task => {
    if (selectedProject && task.projectId !== selectedProject) return false;
    if (status !== "all" && task.status !== status) return false;
    if (priority !== "all" && task.priority !== priority) return false;
    return matchesSearch(task, query) && matchesSearch(task, globalQuery);
  }).sort((a, b) => {
    if (!a.deadline) return b.deadline ? 1 : b.createdAt - a.createdAt;
    if (!b.deadline) return -1;
    return a.deadline.localeCompare(b.deadline);
  });
}

function renderTasks() {
  const tasks = getFilteredTasks();
  const tbody = $("#taskTable");

  tbody.innerHTML = tasks.map(task => {
    const project = projectById(task.projectId);
    const priority = ["high", "medium", "low"].includes(task.priority) ? task.priority : "medium";
    const status = ["todo", "progress", "done"].includes(task.status) ? task.status : "todo";
    const overdue = status !== "done" && task.deadline && task.deadline < today();

    const statusLabel = { todo: "To do", progress: "In progress", done: "Completed" }[status];

    return `
      <tr>
        <td>
          <div class="task-name">${escapeHTML(task.title)}</div>
          ${task.description ? `<span class="task-description">${escapeHTML(task.description)}</span>` : ""}
          ${task.assignee ? `<span class="task-description">Assigned to ${escapeHTML(task.assignee)}</span>` : ""}
          ${task.comments ? `<span class="task-description">💬 ${escapeHTML(task.comments)}</span>` : ""}
        </td>
        <td>${escapeHTML(project?.name || "Unassigned")}</td>
        <td><span class="priority priority-${priority}">${priority[0].toUpperCase() + priority.slice(1)}</span></td>
        <td style="${overdue ? "color:#dc5b68;font-weight:700" : ""}">${escapeHTML(formatDate(task.deadline))}${overdue ? " !" : ""}</td>
        <td><button class="status status-${status}" data-cycle-status="${escapeHTML(task.id)}" title="Click to change status">${statusLabel} ↻</button></td>
        <td><div class="row-actions">
          <button data-edit-task="${escapeHTML(task.id)}" title="Edit task">✎</button>
          <button data-delete-task="${escapeHTML(task.id)}" title="Delete task">×</button>
        </div></td>
      </tr>`;
  }).join("");

  $("#emptyTasks").classList.toggle("hidden", tasks.length > 0);
  $(".table-wrap").classList.toggle("hidden", tasks.length === 0);
}

function renderDeadlines() {
  const container = $("#deadlineList");
  const tasks = data.tasks
    .filter(task => task.status !== "done" && task.deadline)
    .sort((a, b) => a.deadline.localeCompare(b.deadline));

  if (!tasks.length) {
    container.innerHTML = `<div class="empty-state"><span>◷</span><h3>No upcoming deadlines</h3><p>Add a deadline to a task to see it here.</p></div>`;
    return;
  }

  const groups = {};
  tasks.forEach(task => {
    const key = task.deadline < today() ? "Overdue" :
      task.deadline === today() ? "Due today" : formatDate(task.deadline);
    (groups[key] ||= []).push(task);
  });

  container.innerHTML = Object.entries(groups).map(([date, group]) => `
    <div class="calendar-day">${escapeHTML(date)}</div>
    ${group.map(task => `
      <div class="deadline-item">
        <div>
          <strong>${escapeHTML(task.title)}</strong>
          <p>${escapeHTML(projectById(task.projectId)?.name || "Unassigned")} · ${escapeHTML(task.assignee || "No assignee")}</p>
        </div>
        <div class="row-actions">
          <span class="priority priority-${escapeHTML(task.priority)}">${escapeHTML(task.priority)}</span>
          <button data-edit-task="${escapeHTML(task.id)}" title="Edit task">✎</button>
        </div>
      </div>`).join("")}
  `).join("");
}

function renderNotifications() {
  const unread = data.notifications.some(item => !item.read);
  $("#notificationDot").style.display = unread ? "block" : "none";

  $("#notificationList").innerHTML = data.notifications.length
    ? data.notifications.map(item => `
      <div class="notification-item">
        <strong>${item.read ? "Read" : "New update"}</strong><br>
        ${escapeHTML(item.text)}
        <p style="margin:5px 0 0;color:#aaa9ba">${new Date(item.createdAt).toLocaleString()}</p>
      </div>`).join("")
    : `<p class="muted">No notifications yet.</p>`;
}

function renderAll() {
  updateProfile();
  renderStats();
  renderProjectNavigation();
  renderProjects();
  renderTasks();
  renderDeadlines();
  renderNotifications();
  updateView();
}

function updateView() {
  const titles = {
    overview: ["Good things start here ✦", "Plan smart, work together, and make progress every day."],
    projects: ["Your projects ✦", "Manage your projects and track progress."],
    tasks: ["All tasks ✦", "Organize priorities and keep work moving."],
    calendar: ["Deadline planner ✦", "Stay ahead of important deadlines."]
  };

  const [title, subtitle] = titles[currentView];
  $("#pageTitle").textContent = title;
  $("#pageSubtitle").textContent = subtitle;
  $("#breadcrumb").textContent = selectedProject
    ? projectById(selectedProject)?.name || "Projects"
    : currentView[0].toUpperCase() + currentView.slice(1);

  $$(".nav-link").forEach(link => {
    link.classList.toggle("active", link.dataset.view === currentView);
  });

  $("#overviewPanel").classList.toggle("hidden", currentView !== "overview" && currentView !== "projects");
  $("#taskPanel").classList.toggle("hidden", currentView === "calendar");
  $("#calendarPanel").classList.toggle("hidden", currentView !== "calendar");

  $("#taskSectionTitle").textContent =
    selectedProject ? `Tasks · ${projectById(selectedProject)?.name || ""}` :
    currentView === "projects" ? "Project tasks" : "Recent tasks";

  $("#statsGrid").classList.toggle("hidden", currentView === "calendar");
}

function switchView(view) {
  if (!["overview", "projects", "tasks", "calendar"].includes(view)) return;
  currentView = view;
  selectedProject = null;
  renderAll();
  $("#sidebar").classList.remove("open");
}

function openModal(id) {
  $( "#" + id).classList.remove("hidden");
  const firstInput = $("#" + id + " input:not([type=hidden])");
  if (firstInput) setTimeout(() => firstInput.focus(), 50);
}

function closeModal(id) {
  $("#" + id).classList.add("hidden");
}

function populateProjectOptions(selectedId = "") {
  $("#taskProject").innerHTML = data.projects.length
    ? data.projects.map(project => `<option value="${escapeHTML(project.id)}" ${project.id === selectedId ? "selected" : ""}>${escapeHTML(project.name)}</option>`).join("")
    : `<option value="">Create a project first</option>`;
}

function openTaskModal(taskId = null) {
  $("#taskForm").reset();
  $("#taskId").value = "";
  $("#taskModalTitle").textContent = taskId ? "Edit task" : "Create a task";
  populateProjectOptions(selectedProject || "");

  if (taskId) {
    const task = data.tasks.find(item => item.id === taskId);
    if (!task) return;
    $("#taskId").value = task.id;
    $("#taskTitle").value = task.title;
    $("#taskDescription").value = task.description || "";
    $("#taskProject").value = task.projectId || "";
    $("#taskAssignee").value = task.assignee || "";
    $("#taskPriority").value = task.priority || "medium";
    $("#taskStatus").value = task.status || "todo";
    $("#taskDeadline").value = task.deadline || "";
    $("#taskComments").value = task.comments || "";
  }

  openModal("taskModal");
}

function openProjectModal(projectId = null) {
  $("#projectForm").reset();
  $("#projectId").value = "";
  $("#projectModalTitle").textContent = projectId ? "Edit project" : "Create a project";

  if (projectId) {
    const project = projectById(projectId);
    if (!project) return;
    $("#projectId").value = project.id;
    $("#projectName").value = project.name;
    $("#projectDescription").value = project.description || "";
    $("#projectColor").value = project.color || "purple";
    $("#projectDeadline").value = project.deadline || "";
  }

  openModal("projectModal");
}

$("#taskForm").addEventListener("submit", event => {
  event.preventDefault();

  const id = $("#taskId").value;
  const title = $("#taskTitle").value.trim();
  const projectId = $("#taskProject").value;

  if (!title) return showToast("Please enter a task title.");
  if (!projectId || !projectById(projectId)) {
    return showToast("Create a project before adding tasks.");
  }

  const existing = data.tasks.find(task => task.id === id);
  const task = {
    id: id || makeId(),
    title,
    description: $("#taskDescription").value.trim(),
    projectId,
    assignee: $("#taskAssignee").value.trim(),
    priority: $("#taskPriority").value,
    status: $("#taskStatus").value,
    deadline: $("#taskDeadline").value,
    comments: $("#taskComments").value.trim(),
    createdAt: existing?.createdAt || Date.now()
  };

  if (existing) {
    Object.assign(existing, task);
    addNotification(`Task updated: ${title}`);
  } else {
    data.tasks.unshift(task);
    addNotification(`Task created: ${title}`);
  }

  if (saveData()) {
    closeModal("taskModal");
    renderAll();
    showToast(existing ? "Task updated successfully!" : "Task created successfully!");
  }
});

$("#projectForm").addEventListener("submit", event => {
  event.preventDefault();

  const id = $("#projectId").value;
  const name = $("#projectName").value.trim();
  if (!name) return showToast("Please enter a project name.");

  const existing = projectById(id);
  const project = {
    id: id || makeId(),
    name,
    description: $("#projectDescription").value.trim(),
    color: $("#projectColor").value,
    deadline: $("#projectDeadline").value,
    createdAt: existing?.createdAt || Date.now()
  };

  if (existing) {
    Object.assign(existing, project);
    addNotification(`Project updated: ${name}`);
  } else {
    data.projects.unshift(project);
    addNotification(`Project created: ${name}`);
  }

  if (saveData()) {
    closeModal("projectModal");
    currentView = "projects";
    selectedProject = null;
    renderAll();
    showToast(existing ? "Project updated!" : "Project created!");
  }
});

$("#profileForm").addEventListener("submit", event => {
  event.preventDefault();
  const name = $("#displayName").value.trim();
  if (!name) return showToast("Please enter your display name.");

  data.name = name;
  if (saveData()) {
    closeModal("profileModal");
    renderAll();
    showToast("Profile updated!");
  }
});

function deleteTask(id) {
  const task = data.tasks.find(item => item.id === id);
  if (!task) return;
  if (!confirm(`Delete "${task.title}"? This cannot be undone.`)) return;

  data.tasks = data.tasks.filter(item => item.id !== id);
  addNotification(`Task deleted: ${task.title}`);
  if (saveData()) {
    renderAll();
    showToast("Task deleted.");
  }
}

function deleteProject(id) {
  const project = projectById(id);
  if (!project) return;

  const count = projectTasks(id).length;
  const message = count
    ? `Delete "${project.name}" and its ${count} associated task(s)?`
    : `Delete "${project.name}"?`;

  if (!confirm(message)) return;

  data.projects = data.projects.filter(item => item.id !== id);
  data.tasks = data.tasks.filter(task => task.projectId !== id);
  if (selectedProject === id) selectedProject = null;
  addNotification(`Project deleted: ${project.name}`);

  if (saveData()) {
    renderAll();
    showToast("Project deleted.");
  }
}

function cycleTaskStatus(id) {
  const task = data.tasks.find(item => item.id === id);
  if (!task) return;

  const next = { todo: "progress", progress: "done", done: "todo" };
  task.status = next[task.status] || "todo";
  addNotification(`"${task.title}" is now ${task.status === "done" ? "completed" : task.status === "progress" ? "in progress" : "to do"}.`);

  if (saveData()) {
    renderAll();
    showToast("Task status updated.");
  }
}

function exportCSV() {
  const tasks = getFilteredTasks();
  if (!tasks.length) return showToast("There are no tasks to export.");

  const quote = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const rows = [
    ["Task", "Description", "Project", "Assignee", "Priority", "Status", "Deadline", "Comments"],
    ...tasks.map(task => [
      task.title,
      task.description,
      projectById(task.projectId)?.name || "",
      task.assignee,
      task.priority,
      task.status,
      task.deadline,
      task.comments
    ])
  ];

  const csv = "\uFEFF" + rows.map(row => row.map(quote).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "taskflow-tasks.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("CSV export downloaded.");
}

$("#addTaskBtn").addEventListener("click", () => {
  if (!data.projects.length) return openProjectModal();
  openTaskModal();
});
$("#quickStartBtn").addEventListener("click", () => {
  if (!data.projects.length) return openProjectModal();
  openTaskModal();
});
$("#emptyAddTask").addEventListener("click", () => {
  if (!data.projects.length) return openProjectModal();
  openTaskModal();
});
$("#calendarAddBtn").addEventListener("click", () => {
  if (!data.projects.length) return openProjectModal();
  openTaskModal();
});
$("#sidebarAddProject").addEventListener("click", () => openProjectModal());
$("#firstProjectBtn").addEventListener("click", () => openProjectModal());

$("#editProfileBtn").addEventListener("click", () => openModal("profileModal"));
$("#topProfileBtn").addEventListener("click", () => openModal("profileModal"));

$$("[data-close]").forEach(button => {
  button.addEventListener("click", () => closeModal(button.dataset.close));
});

$$(".modal-backdrop").forEach(backdrop => {
  backdrop.addEventListener("click", event => {
    if (event.target === backdrop) closeModal(backdrop.id);
  });
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    $$(".modal-backdrop").forEach(modal => modal.classList.add("hidden"));
    $("#notificationPanel").classList.add("hidden");
    $("#sidebar").classList.remove("open");
  }
});

$$(".nav-link").forEach(button => {
  button.addEventListener("click", () => switchView(button.dataset.view));
});

document.addEventListener("click", event => {
  const target = event.target.closest("button");
  if (!target) return;

  if (target.dataset.editTask) openTaskModal(target.dataset.editTask);
  if (target.dataset.deleteTask) deleteTask(target.dataset.deleteTask);
  if (target.dataset.cycleStatus) cycleTaskStatus(target.dataset.cycleStatus);
  if (target.dataset.editProject) openProjectModal(target.dataset.editProject);
  if (target.dataset.deleteProject) deleteProject(target.dataset.deleteProject);

  if (target.dataset.project) {
    selectedProject = target.dataset.project;
    currentView = "projects";
    renderAll();
    $("#sidebar").classList.remove("open");
  }

  if (target.dataset.openProject) {
    selectedProject = target.dataset.openProject;
    currentView = "projects";
    renderAll();
  }

  if (target.dataset.go) switchView(target.dataset.go);
});

["#taskSearch", "#globalSearch", "#statusFilter", "#priorityFilter"].forEach(selector => {
  $(selector).addEventListener("input", renderTasks);
  $(selector).addEventListener("change", renderTasks);
});

$("#clearFiltersBtn").addEventListener("click", () => {
  $("#taskSearch").value = "";
  $("#globalSearch").value = "";
  $("#statusFilter").value = "all";
  $("#priorityFilter").value = "all";
  renderTasks();
});

$("#exportBtn").addEventListener("click", exportCSV);
$("#menuBtn").addEventListener("click", () => $("#sidebar").classList.toggle("open"));

$("#notificationBtn").addEventListener("click", () => {
  const panel = $("#notificationPanel");
  panel.classList.toggle("hidden");
  if (!panel.classList.contains("hidden")) {
    data.notifications.forEach(item => item.read = true);
    saveData();
    renderNotifications();
  }
});

$("#closeNotifications").addEventListener("click", () => {
  $("#notificationPanel").classList.add("hidden");
});

$("#workspaceBtn").addEventListener("click", () => {
  showToast("You're working in your personal workspace.");
});

$("#year").textContent = new Date().getFullYear();
$("#todayLabel").textContent = new Date().toLocaleDateString(undefined, {
  weekday: "long", month: "long", day: "numeric"
}).toUpperCase();

renderAll();
