const taskInput = document.getElementById('task-input');
const addTaskBtn = document.getElementById('add-task-btn');
const taskList = document.getElementById('task-list');

addTaskBtn.addEventListener('click', () => {
    const taskText = taskInput.value.trim();
    
    if (taskText === '') {
        alert('Please enter a task!');
        return;
    }

    // Create a new list item elements
    const li = document.createElement('li');
    li.textContent = taskText;

    // Append the list item to our list
    taskList.appendChild(li);

    // Clear out input field
    taskInput.value = '';
});
