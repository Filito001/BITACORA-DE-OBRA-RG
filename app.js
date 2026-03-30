document.addEventListener("DOMContentLoaded", () => {
    // 1. Preload today's date
    const dateInput = document.getElementById('report-date');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        // dateInput.value = today; // Wait, actually sometimes users want to set past dates. Let's just set today.
        dateInput.value = today;
    }

    // 2. Setup Weather Interactive Table
    setupWeatherTable();

    // 3. Auto-grow Textareas
    setupAutoGrow();
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
