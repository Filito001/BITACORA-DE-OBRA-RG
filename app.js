document.addEventListener("DOMContentLoaded", () => {
    // 1. Preload today's date
    const dateInput = document.getElementById('report-date');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
    }

    // 2. Setup Weather Interactive Table
    setupWeatherTable();

    // 3. Auto-grow Textareas
    setupAutoGrow();

    // 4. Initialize Calendar
    initCalendar();

    // 5. Setup Notifications Recordatorio (4PM)
    setupNotifications();
});

// Auto-grow textareas to fit content
function setupAutoGrow() {
    document.addEventListener('input', function (event) {
        if (event.target.tagName.toLowerCase() === 'textarea' && event.target.classList.contains('auto-grow')) {
            autoGrow(event.target);
        }
    });

    // Initial check for all textareas
    document.querySelectorAll('textarea.auto-grow').forEach(ta => autoGrow(ta));
}

function autoGrow(element) {
    // Temporarily shrink to get actual scroll height
    element.style.height = 'auto';
    // Set to scroll height
    element.style.height = (element.scrollHeight) + 'px';
}

// Weather Slots Logic
function setupWeatherTable() {
    const slotsRow = document.getElementById('weather-slots');
    if (!slotsRow) return;

    // Create 12 slots for 7am to 6pm
    for (let i = 0; i < 12; i++) {
        const td = document.createElement('td');
        // Data attribute to track state: 0 = none, 1 = dry, 2 = rain
        td.dataset.state = 0;
        
        td.addEventListener('click', function() {
            let currentState = parseInt(this.dataset.state);
            currentState = (currentState + 1) % 3; // cycle 0 -> 1 -> 2 -> 0
            
            this.className = ''; // clear classes
            this.dataset.state = currentState;

            if (currentState === 1) {
                this.classList.add('slot-sec');
            } else if (currentState === 2) {
                this.classList.add('slot-lluvia');
            }
        });
        
        slotsRow.appendChild(td);
    }
}

// Global func to remove table rows
window.removeRow = function(btn) {
    const row = btn.closest('tr');
    if(row) {
        row.remove();
    }
}

// Add row to Personnel Table
window.addPersonRow = function() {
    const tbody = document.getElementById('personnel-body');
    const tr = document.createElement('tr');
    
    tr.innerHTML = `
        <td><textarea class="editable-input full-width auto-grow" rows="1"></textarea></td>
        <td><textarea class="editable-input full-width auto-grow" rows="1"></textarea></td>
        <td><textarea class="editable-input full-width auto-grow" rows="1"></textarea></td>
        <td class="noprint text-center"><button class="btn-delete" onclick="removeRow(this)"><i class="fas fa-trash"></i></button></td>
    `;
    
    tbody.appendChild(tr);
    // trigger auto grow on new textareas
    tr.querySelectorAll('.auto-grow').forEach(ta => autoGrow(ta));
}

// Add row to Materials Table
window.addMaterialRow = function() {
    const tbody = document.getElementById('materials-body');
    const tr = document.createElement('tr');
    
    tr.innerHTML = `
        <td><input type="date" class="editable-input full-width" /></td>
        <td><input type="time" class="editable-input full-width" /></td>
        <td><textarea class="editable-input full-width auto-grow" rows="1"></textarea></td>
        <td><input type="text" class="editable-input full-width" /></td>
        <td><textarea class="editable-input full-width auto-grow" rows="1"></textarea></td>
        <td class="noprint text-center"><button class="btn-delete" onclick="removeRow(this)"><i class="fas fa-trash"></i></button></td>
    `;
    
    tbody.appendChild(tr);
    tr.querySelectorAll('.auto-grow').forEach(ta => autoGrow(ta));
}

// Handle Image Uploads
window.handleImageUpload = function(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const grid = document.getElementById('photos-grid');
    const emptyMsg = document.getElementById('empty-photos-msg');

    if (emptyMsg) {
        emptyMsg.style.display = 'none';
    }

    Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) return;

        const reader = new FileReader();
        
        reader.onload = function(e) {
            const imgSrc = e.target.result;
            
            const photoItem = document.createElement('div');
            photoItem.className = 'photo-item';
            
            photoItem.innerHTML = `
                <div class="photo-img-wrapper">
                    <img src="${imgSrc}" alt="Registro Fotográfico" />
                    <button class="photo-remove-btn noprint" onclick="removePhoto(this)"><i class="fas fa-times"></i></button>
                </div>
                <div class="photo-caption">
                    <textarea class="editable-input full-width auto-grow" rows="2" placeholder="Describa la actividad en la foto..."></textarea>
                </div>
            `;
            
            grid.appendChild(photoItem);
            // initialize autogrow for the new caption
            const newTextarea = photoItem.querySelector('textarea');
            if (newTextarea) autoGrow(newTextarea);
        };
        
        reader.readAsDataURL(file);
    });
    
    // Clear input so same files can be selected again if removed
    event.target.value = '';
}

window.removePhoto = function(btn) {
    const photoItem = btn.closest('.photo-item');
    if (photoItem) {
        photoItem.remove();
        
        // Check if we need to show empty message again
        const grid = document.getElementById('photos-grid');
        const remainingPhotos = grid.querySelectorAll('.photo-item');
        if (remainingPhotos.length === 0) {
            const emptyMsg = document.getElementById('empty-photos-msg');
            if (emptyMsg) emptyMsg.style.display = 'flex';
        }
    }
}

// --- CALENDAR & LOCALSTORAGE LOGIC ---
const STORAGE_KEY = 'bitacoras_completadas';

function getCompletedLogs() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
}

function saveLog(dateStr) {
    let logs = getCompletedLogs();
    if (!logs.includes(dateStr)) {
        logs.push(dateStr);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    }
}

window.exportAndPrint = function() {
    const dateInput = document.getElementById('report-date');
    if (dateInput && dateInput.value) {
        saveLog(dateInput.value);
        initCalendar(); // Refresh calendar immediately to show green check
    }
    window.print();
}

function initCalendar() {
    const header = document.getElementById('calendar-header');
    const grid = document.getElementById('calendar-grid');
    if (!header || !grid) return;

    grid.innerHTML = '';
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const todayStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];
    
    // Set Header
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    header.innerText = `${monthNames[currentMonth]} ${currentYear}`;

    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    
    // 0 = Sunday, 1 = Monday ... calculate blanks before first day
    let startDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; 

    // Blanks
    for (let i = 0; i < startDayOfWeek; i++) {
        const blank = document.createElement('div');
        blank.className = 'cal-day';
        grid.appendChild(blank);
    }

    const completedLogs = getCompletedLogs();

    for (let i = 1; i <= lastDay.getDate(); i++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'cal-day current-month';
        dayDiv.innerText = i;
        
        // Format YYYY-MM-DD
        const monthNumStr = String(currentMonth + 1).padStart(2, '0');
        const dayNumStr = String(i).padStart(2, '0');
        const loopDateStr = `${currentYear}-${monthNumStr}-${dayNumStr}`;

        if (loopDateStr <= todayStr) {
            // It's a past or present day
            if (completedLogs.includes(loopDateStr)) {
                dayDiv.classList.add('done');
                dayDiv.innerHTML += ' <i class="fas fa-check"></i>';
            } else {
                dayDiv.classList.add('missed');
                dayDiv.innerHTML += ' <i class="fas fa-times"></i>';
            }
        }

        grid.appendChild(dayDiv);
    }
}

// --- NOTIFICATIONS LOGIC ---
let notificationShownToday = false;

function setupNotifications() {
    if (!("Notification" in window)) {
        console.warn("Este navegador no soporta notificaciones de escritorio o móviles nativas.");
        return;
    }

    if (Notification.permission !== "denied" && Notification.permission !== "granted") {
        Notification.requestPermission();
    }

    // Check every minute if we hit 4PM and no log
    setInterval(checkReminder, 60000);
    checkReminder(); // initial check
}

function checkReminder() {
    const now = new Date();
    const todayStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];
    const completedLogs = getCompletedLogs();

    // Check if after 16:00 (4:00 PM)
    if (now.getHours() >= 16) {
        if (!completedLogs.includes(todayStr) && !notificationShownToday) {
            if (Notification.permission === "granted") {
                new Notification("¡Recordatorio de Bitácora!", {
                    body: "Son más de las 4 PM y no has llenado la bitácora de obra de hoy.",
                    icon: "https://cdn-icons-png.flaticon.com/512/2832/2832810.png"
                });
                notificationShownToday = true;
            }
        }
    }
}
