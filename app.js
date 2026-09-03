const taskInput = document.getElementById('task-input');
const addTaskBtn = document.getElementById('add-task-btn');
const taskList = document.getElementById('task-list');

// 1. Load tasks from Local Storage when the webpage opens
let savedTasks = JSON.parse(localStorage.getItem('tasks')) || [];

// 2. Define a function to render the task array onto the screen UI
function renderTasks() {
    // Clear out current list items to avoid duplicate visual entries
    taskList.innerHTML = '';
    
    // Loop through the stored array and build the HTML items
    savedTasks.forEach((taskText) => {
        const li = document.createElement('li');
        li.textContent = taskText;
        taskList.appendChild(li);
    });
}

// 3. Trigger the initial render when the application loads
renderTasks();

// 4. Handle adding a new item to the task pool
addTaskBtn.addEventListener('click', () => {
    const taskText = taskInput.value.trim();
    
    if (taskText === '') {
        alert('Please enter a task!');
        return;
    }

    // Add the new task string to our array state
    savedTasks.push(taskText);

    // Save the updated array back into browser memory
    localStorage.setItem('tasks', JSON.stringify(savedTasks));

    // Refresh the visible list elements
    renderTasks();

    // Clear out input field for next entry
    taskInput.value = '';
});
