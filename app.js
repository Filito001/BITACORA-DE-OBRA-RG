document.addEventListener("DOMContentLoaded", () => {
    // 1. Database Init and Preload
    initIndexedDB(() => {
        const dateInput = document.getElementById('report-date');
        if (dateInput) {
            const today = new Date().toISOString().split('T')[0];
            
            // On load, attempt to load today's current saved file if any
            loadLogFromDB(today, () => {
                // If nothing was found, at least set date
                dateInput.value = today;
            });
        }
        initCalendar();
        setupNotifications();
    });

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
    // Global checking
    document.querySelectorAll('textarea.auto-grow').forEach(ta => autoGrow(ta));
}

window.autoGrow = function(element) {
    element.style.height = 'auto';
    element.style.height = (element.scrollHeight) + 'px';
}

// Weather Slots Logic
function setupWeatherTable() {
    const slotsRow = document.getElementById('weather-slots');
    if (!slotsRow) return;

    for (let i = 0; i < 12; i++) {
        const td = document.createElement('td');
        td.dataset.state = 0;
        
        td.addEventListener('click', function() {
            let currentState = parseInt(this.dataset.state);
            currentState = (currentState + 1) % 3;
            
            this.className = '';
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

// Table Rows Manipulations
window.removeRow = function(btn) {
    const row = btn.closest('tr');
    if(row) row.remove();
}

window.addPersonRow = function() {
    addPersonRowWithData(["", "", ""]);
}

window.addMaterialRow = function() {
    addMaterialRowWithData(["", "", "", "", ""]);
}

function addPersonRowWithData(dataArr) {
    const tbody = document.getElementById('personnel-body');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><textarea class="editable-input full-width auto-grow" rows="1">${dataArr[0]}</textarea></td>
        <td><textarea class="editable-input full-width auto-grow" rows="1">${dataArr[1]}</textarea></td>
        <td><textarea class="editable-input full-width auto-grow" rows="1">${dataArr[2]}</textarea></td>
        <td class="noprint text-center"><button class="btn-delete" onclick="removeRow(this)"><i class="fas fa-trash"></i></button></td>
    `;
    tbody.appendChild(tr);
    tr.querySelectorAll('.auto-grow').forEach(ta => autoGrow(ta));
}

function addMaterialRowWithData(dataArr) {
    const tbody = document.getElementById('materials-body');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="date" class="editable-input full-width" value="${dataArr[0]}" /></td>
        <td><input type="time" class="editable-input full-width" value="${dataArr[1]}" /></td>
        <td><textarea class="editable-input full-width auto-grow" rows="1">${dataArr[2]}</textarea></td>
        <td><input type="text" class="editable-input full-width" value="${dataArr[3]}" /></td>
        <td><textarea class="editable-input full-width auto-grow" rows="1">${dataArr[4]}</textarea></td>
        <td class="noprint text-center"><button class="btn-delete" onclick="removeRow(this)"><i class="fas fa-trash"></i></button></td>
    `;
    tbody.appendChild(tr);
    tr.querySelectorAll('.auto-grow').forEach(ta => autoGrow(ta));
}

// Photo Uploads
window.handleImageUpload = function(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const emptyMsg = document.getElementById('empty-photos-msg');
    if (emptyMsg) emptyMsg.style.display = 'none';

    Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            injectPhoto(e.target.result, "");
        };
        reader.readAsDataURL(file);
    });
    event.target.value = '';
}

function injectPhoto(imgSrc, captionStr = '') {
    const grid = document.getElementById('photos-grid');
    const photoItem = document.createElement('div');
    photoItem.className = 'photo-item';
    photoItem.innerHTML = `
        <div class="photo-img-wrapper">
            <img src="${imgSrc}" alt="Registro Fotográfico" />
            <button class="photo-remove-btn noprint" onclick="removePhoto(this)"><i class="fas fa-times"></i></button>
        </div>
        <div class="photo-caption">
            <textarea class="editable-input full-width auto-grow" rows="2" placeholder="Describa la actividad en la foto...">${captionStr}</textarea>
        </div>
    `;
    grid.appendChild(photoItem);
    const newTextarea = photoItem.querySelector('textarea');
    if (newTextarea) autoGrow(newTextarea);

    document.getElementById('empty-photos-msg').style.display = 'none';
}

window.removePhoto = function(btn) {
    const photoItem = btn.closest('.photo-item');
    if (photoItem) {
        photoItem.remove();
        const grid = document.getElementById('photos-grid');
        if (grid.querySelectorAll('.photo-item').length === 0) {
            const emptyMsg = document.getElementById('empty-photos-msg');
            if (emptyMsg) emptyMsg.style.display = 'flex';
        }
    }
}

// =========================================================
// INDEXEDDB OFFLINE STORAGE LOGIC
// =========================================================
const DB_NAME = "BitacorasOfflineDB";
const DB_VERSION = 1;
window.db = null;

function initIndexedDB(callback) {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = (e) => console.error("Database error: ", e);
    request.onupgradeneeded = (e) => {
        const dbInstance = e.target.result;
        if (!dbInstance.objectStoreNames.contains("logs")) {
            dbInstance.createObjectStore("logs", { keyPath: "date" });
        }
    };
    request.onsuccess = (e) => {
        window.db = e.target.result;
        console.log("Database initialized successfully.");
        if (callback) callback();
    };
}

function getAllKeys(callback) {
    if (!window.db) return callback([]);
    const tx = window.db.transaction("logs", "readonly");
    const req = tx.objectStore("logs").getAllKeys();
    req.onsuccess = () => callback(req.result || []);
}

function loadLogFromDB(dateStr, notFoundCallback) {
    if (!window.db) return;
    const tx = window.db.transaction("logs", "readonly");
    const req = tx.objectStore("logs").get(dateStr);
    req.onsuccess = () => {
        if (req.result) {
            deserializeForm(req.result);
        } else {
            if (notFoundCallback) notFoundCallback();
        }
    };
}

// The core export and print feature
window.exportAndPrint = function() {
    const dateInput = document.getElementById('report-date').value;
    if (!dateInput) {
        alert("Por favor escoge una fecha de reporte antes de guardar.");
        return;
    }

    const dataObj = serializeForm(dateInput);
    
    // Save to Database
    const tx = window.db.transaction("logs", "readwrite");
    const store = tx.objectStore("logs");
    store.put(dataObj);

    tx.oncomplete = () => {
        initCalendar(); // Refresh Side Calendar
        // Small delay to ensure rendering finished before print wrapper halts engine
        setTimeout(() => window.print(), 100);
    };
}

// Grabs all values from DOM into a neat JSON
function serializeForm(dateStr) {
    const data = {
        date: dateStr,
        obra: document.getElementById('obra-name').value,
        codigo: document.querySelectorAll('.header-meta input')[0].value,
        version: document.querySelectorAll('.header-meta input')[1].value,
        tiempo: document.querySelectorAll('.general-info input')[1].value,
        temperatura: document.querySelectorAll('.temp-input-wrapper input')[0].value,
        weatherSlots: Array.from(document.getElementById('weather-slots').children).map(td => td.dataset.state),
        precipitaciones: document.querySelectorAll('.precipitaciones-box input')[0].value,
        notaClima: document.querySelectorAll('.precipitaciones-box textarea')[0].value,
        actividadesCampo: document.querySelectorAll('.textarea-container textarea')[0].value,
        recomendaciones: document.querySelectorAll('.textarea-container textarea')[1].value,
        signatures: Array.from(document.querySelectorAll('.signature-box input')).map(inp => inp.value)
    };

    // Personal dynamic rows
    data.personnel = [];
    document.querySelectorAll('#personnel-body tr').forEach(tr => {
        const textareas = tr.querySelectorAll('textarea');
        if (textareas.length >= 3) {
            data.personnel.push([textareas[0].value, textareas[1].value, textareas[2].value]);
        }
    });

    // Materials dynamic rows
    data.materials = [];
    document.querySelectorAll('#materials-body tr').forEach(tr => {
        const inputs = tr.querySelectorAll('input, textarea');
        if (inputs.length >= 5) {
            data.materials.push([inputs[0].value, inputs[1].value, inputs[2].value, inputs[3].value, inputs[4].value]);
        }
    });

    // Photos array of Base64 strings and captions
    data.photos = [];
    document.querySelectorAll('.photo-item').forEach(item => {
        const img = item.querySelector('img').src;
        const caption = item.querySelector('textarea').value;
        data.photos.push({ img, caption });
    });

    return data;
}

// Injects JSON data back to DOM visually
function deserializeForm(data) {
    if (!data) return;

    document.getElementById('report-date').value = data.date;
    document.getElementById('obra-name').value = data.obra || '';
    
    document.querySelectorAll('.header-meta input')[0].value = data.codigo || '';
    document.querySelectorAll('.header-meta input')[1].value = data.version || '';
    document.querySelectorAll('.general-info input')[1].value = data.tiempo || '';
    document.querySelectorAll('.temp-input-wrapper input')[0].value = data.temperatura || '';

    // Weather
    const slots = document.getElementById('weather-slots').children;
    if (data.weatherSlots) {
        data.weatherSlots.forEach((state, i) => {
            if (slots[i]) {
                slots[i].dataset.state = state;
                slots[i].className = '';
                if(state == 1) slots[i].classList.add('slot-sec');
                if(state == 2) slots[i].classList.add('slot-lluvia');
            }
        });
    }

    document.querySelectorAll('.precipitaciones-box input')[0].value = data.precipitaciones || '';
    document.querySelectorAll('.precipitaciones-box textarea')[0].value = data.notaClima || '';
    
    const textareas = document.querySelectorAll('.textarea-container textarea');
    textareas[0].value = data.actividadesCampo || '';
    textareas[1].value = data.recomendaciones || '';

    // Dynamic Lists
    document.getElementById('personnel-body').innerHTML = '';
    if (data.personnel && data.personnel.length > 0) {
        data.personnel.forEach(row => addPersonRowWithData(row));
    } else {
        addPersonRowWithData(["", "", ""]);
    }

    document.getElementById('materials-body').innerHTML = '';
    if (data.materials && data.materials.length > 0) {
        data.materials.forEach(row => addMaterialRowWithData(row));
    } else {
        addMaterialRowWithData(["", "", "", "", ""]);
    }

    // Signatures
    const sigInputs = document.querySelectorAll('.signature-box input');
    if (data.signatures) {
        data.signatures.forEach((val, i) => {
            if (sigInputs[i]) sigInputs[i].value = val;
        });
    }

    // Photos
    document.querySelectorAll('.photo-item').forEach(p => p.remove());
    document.getElementById('empty-photos-msg').style.display = 'flex';
    if (data.photos) {
        data.photos.forEach(photo => injectPhoto(photo.img, photo.caption));
    }

    // Fix height adjustments
    document.querySelectorAll('textarea.auto-grow').forEach(ta => autoGrow(ta));
}

function clearFormAndSetDate(dateStr) {
    // Defines a blank state
    const blank = {
        date: dateStr, obra: 'Reserva de Guance', codigo: '', version: '01', tiempo: '', temperatura: '',
        weatherSlots: Array(12).fill(0), precipitaciones: '', notaClima: '', actividadesCampo: '', recomendaciones: '',
        signatures: ['Arq. Filemón Arias', 'Residente de Interventoría', 'SERRA I&A S.A.S', 'Arq. Wilmer', 'Residente de Obra', 'PORTICO'],
        personnel: [['', '', '']], materials: [['', '', '', '', '']], photos: []
    };
    deserializeForm(blank);
}

// =========================================================
// CALENDAR WIDGET LOGIC
// =========================================================
function initCalendar() {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;

    getAllKeys((completedLogs) => {
        grid.innerHTML = '';
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const todayStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];
        
        document.getElementById('calendar-header').innerText = 
            ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"][currentMonth] + " " + currentYear;

        const firstDay = new Date(currentYear, currentMonth, 1);
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        let startDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; 

        for (let i = 0; i < startDayOfWeek; i++) {
            const blank = document.createElement('div');
            blank.className = 'cal-day';
            grid.appendChild(blank);
        }

        for (let i = 1; i <= lastDay.getDate(); i++) {
            const dayDiv = document.createElement('div');
            dayDiv.className = 'cal-day current-month';
            dayDiv.innerText = i;
            dayDiv.style.cursor = 'pointer';
            
            const loopDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

            if (loopDateStr <= todayStr) {
                if (completedLogs.includes(loopDateStr)) {
                    dayDiv.classList.add('done');
                    dayDiv.innerHTML += ' <i class="fas fa-check"></i>';
                } else {
                    dayDiv.classList.add('missed');
                    dayDiv.innerHTML += ' <i class="fas fa-times"></i>';
                }
            }

            // Click interaction to load historical data
            dayDiv.onclick = () => {
                const isSaved = completedLogs.includes(loopDateStr);
                
                // Adding a sleek visual feedback 
                grid.querySelectorAll('.cal-day').forEach(d => d.style.boxShadow = 'none');
                dayDiv.style.boxShadow = 'inset 0 0 0 2px var(--accent)';

                if (isSaved) {
                    loadLogFromDB(loopDateStr);
                } else {
                    clearFormAndSetDate(loopDateStr);
                }
                
                // Focus on top of document so mobile user knows form was updated
                window.scrollTo({ top: 0, behavior: 'smooth' });
            };

            grid.appendChild(dayDiv);
        }
    });
}

// =========================================================
// NOTIFICATION LOGIC
// =========================================================
let notificationShownToday = false;

function setupNotifications() {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "denied" && Notification.permission !== "granted") {
        Notification.requestPermission();
    }
    setInterval(checkReminder, 60000);
    checkReminder();
}

function checkReminder() {
    const now = new Date();
    const todayStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];

    getAllKeys((completedLogs) => {
        if (now.getHours() >= 16) {
            if (!completedLogs.includes(todayStr) && !notificationShownToday) {
                if (Notification.permission === "granted") {
                    new Notification("¡Recordatorio de Bitácora!", {
                        body: "Ya son más de las 4 PM. No olvides registrar la bitácora de obra de hoy.",
                        icon: "https://cdn-icons-png.flaticon.com/512/2832/2832810.png"
                    });
                    notificationShownToday = true;
                }
            }
        }
    });
}
