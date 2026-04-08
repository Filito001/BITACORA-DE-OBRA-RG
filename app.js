// ============================================
// SUPABASE CONFIGURATION
// ============================================
const supabaseUrl = 'https://khpvlbcfnelrnnycctfb.supabase.co';
const supabaseKey = 'sb_publishable_JYjyOW3jkW7x8FUm3EQgXQ_Bs9nYiNl';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let autoSaveTimeout = null;
let currentReportId = '';

// Quitamos el overlay de login ya que usaremos RLS desactivado y URLs ocultas
document.addEventListener('DOMContentLoaded', () => {
    const loginOverlay = document.getElementById('login-overlay');
    if (loginOverlay) loginOverlay.style.display = 'none';
    initApp();
});

// trigger autosave on any input change
document.addEventListener('input', function(e) {
    if (!currentReportId) return;
    if (e.target.matches('input, textarea')) {
        updateSyncStatus('Guardando...', false);
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(() => saveToCloud(), 1000);
    }
});

function updateSyncStatus(statusMsg, isOk = true) {
    const stTag = document.getElementById('sync-status');
    const txtTag = document.getElementById('sync-text');
    if(!stTag || !txtTag) return;
    
    txtTag.textContent = statusMsg;
    stTag.className = 'sync-status ' + (isOk ? 'ok' : 'syncing');
}

// ============================================
// IMAGE COMPRESSION (TO AVOID 1MB LIMIT)
// ============================================
function compressImage(file, maxWidth, callback) {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = event => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
            let width = img.width;
            let height = img.height;
            if (width > maxWidth) {
                height = Math.round(height *= maxWidth / width);
                width = maxWidth;
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // Comprime a JPEG con calidad 0.7 para que pese poquísimo (aprox 50KB-100KB)
            const compressedBaseColor = canvas.toDataURL('image/jpeg', 0.7);
            callback(compressedBaseColor);
        };
    };
}

// ============================================
// APP LOGIC
// ============================================

function initApp() {
    setupWeatherTable();
    setupAutoGrow();
    initCalendar();
    
    const queryParams = new URLSearchParams(window.location.search);
    const idParam = queryParams.get('id');
    
    const today = idParam ? idParam : new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('report-date');
    if (dateInput) dateInput.value = today;
    
    loadCloudReport(today);

    if (dateInput) {
        dateInput.addEventListener('change', function (e) {
            window.history.pushState({}, '', '?id=' + e.target.value);
            loadCloudReport(e.target.value);
        });
    }
}

// ============================================
// CLOUD SYNC LOGIC (SUPABASE)
// ============================================
async function saveToCloud() {
    currentReportId = document.getElementById('report-date').value;
    if (!currentReportId) return;
    
    let reportData;
    try {
        reportData = serializeForm(currentReportId);
    } catch (err) {
        console.error("Error al serializar:", err);
        updateSyncStatus('Error interno al serializar', false);
        return;
    }
    
    // Función recursiva para sanitizar undefined (Supabase también prefiere limpieza)
    function sanitize(obj) {
        Object.keys(obj).forEach(key => {
            if (obj[key] === undefined) obj[key] = null;
            else if (typeof obj[key] === 'object' && obj[key] !== null) sanitize(obj[key]);
        });
        return obj;
    }
    
    reportData = sanitize(reportData);
    
    const { data, error } = await supabase
        .from('reports')
        .upsert({ id: currentReportId, payload: reportData });
        
    if (error) {
        console.error("Supabase Reject:", error);
        updateSyncStatus('Error de Base de Datos', false);
    } else {
        updateSyncStatus('Sincronizado', true);
    }
}

async function loadCloudReport(dateStr) {
    currentReportId = dateStr;
    updateSyncStatus('Cargando...', false);
    
    const { data, error } = await supabase
        .from('reports')
        .select('payload')
        .eq('id', dateStr)
        .single();
        
    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        console.error("Supabase Read Error:", error);
        updateSyncStatus('Fallo de Lectura', false);
        return;
    }

    if (data && data.payload) {
        try {
            deserializeForm(data.payload);
        } catch(e) { console.error("Error al pintar informe", e); }
    } else {
        clearFormAndSetDate(dateStr);
        saveToCloud();
    }
    updateSyncStatus('Sincronizado', true);
}

function _triggerSave() {
    clearTimeout(autoSaveTimeout);
    updateSyncStatus('Guardando...', false);
    autoSaveTimeout = setTimeout(() => saveToCloud(), 500);
}

// Auto-grow textareas
window.autoGrow = function(element) {
    element.style.height = 'auto';
    element.style.height = (element.scrollHeight) + 'px';
}

function setupAutoGrow() {
    document.addEventListener('input', function (event) {
        if (event.target.tagName.toLowerCase() === 'textarea' && event.target.classList.contains('auto-grow')) {
            autoGrow(event.target);
        }
    });
}

// Weather Slots Logic
function setupWeatherTable() {
    const slotsRow = document.getElementById('weather-slots');
    if (!slotsRow) return;
    slotsRow.innerHTML = '';

    for (let i = 0; i < 12; i++) {
        const td = document.createElement('td');
        td.dataset.state = 0;
        td.innerHTML = `<div class="w-cell"></div>`;
        td.addEventListener('click', function() {
            let currentState = parseInt(this.dataset.state);
            currentState = (currentState + 1) % 3;
            this.dataset.state = currentState;
            const cell = this.querySelector('.w-cell');
            cell.className = 'w-cell';
            if (currentState === 1) {
                cell.classList.add('w-sec');
                cell.innerHTML = '<i class="fas fa-sun"></i>';
            } else if (currentState === 2) {
                cell.classList.add('w-lluvia');
                cell.innerHTML = '<i class="fas fa-cloud-rain"></i>';
            } else {
                cell.innerHTML = '';
            }
            _triggerSave();
        });
        slotsRow.appendChild(td);
    }
}

// Table Rows Manipulations
window.removeRow = function(btn) {
    btn.closest('tr').remove();
    _triggerSave();
}

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
    _triggerSave();
}

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
    _triggerSave();
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

// Signatures
window.addSignatureBox = function(dataArr = ["", "", "", ""]) {
    const container = document.getElementById('signatures-container');
    if (!container) return;
    const box = document.createElement('div');
    const uniqueId = 'sig-upload-' + Math.random().toString(36).substr(2, 9);
    box.className = 'signature-box';
    box.style.position = 'relative';
    const imgHtml = dataArr[3] ? `<img src="${dataArr[3]}" class="signature-img" />` : '';
    box.innerHTML = `
        <div class="signature-img-container">
            ${imgHtml}
            <label for="${uniqueId}" class="signature-upload-btn noprint"><i class="fas fa-upload"></i> Firma</label>
            <input type="file" id="${uniqueId}" class="hidden" accept="image/*" onchange="handleSignatureUpload(event, this)" />
        </div>
        <div class="sign-line"></div>
        <input type="text" class="editable-input bold-text text-center full-width sig-name" value="${dataArr[0] || ''}" placeholder="Nombre" />
        <input type="text" class="editable-input text-center text-sm full-width sig-role" value="${dataArr[1] || ''}" placeholder="Cargo" />
        <input type="text" class="editable-input text-center text-sm full-width sig-company" value="${dataArr[2] || ''}" placeholder="Empresa" />
        <input type="hidden" class="sig-base64" value="${dataArr[3] || ''}" />
        <button class="btn-delete signature-delete-btn noprint" onclick="removeSignatureBox(this)" style="position: absolute; top: -5px; right: 0; padding: 2px;"><i class="fas fa-times"></i></button>
    `;
    container.appendChild(box);
}

window.removeSignatureBox = function(btn) {
    btn.closest('.signature-box').remove();
    _triggerSave();
}

window.handleSignatureUpload = function(event, inputElem) {
    const file = event.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    
    compressImage(file, 400, (compressedBase64) => {
        const box = inputElem.closest('.signature-box');
        let img = box.querySelector('.signature-img');
        if (!img) {
            img = document.createElement('img');
            img.className = 'signature-img';
            box.querySelector('.signature-img-container').prepend(img);
        }
        img.src = compressedBase64;
        box.querySelector('.sig-base64').value = compressedBase64;
        _triggerSave();
    });
}

// Photos
window.handleImageUpload = function(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) return;
        compressImage(file, 800, (compressedBase64) => {
            injectPhoto(compressedBase64, "");
        });
    });
}

// Clipboard Paste Support for Photos
window.addEventListener('paste', function(e) {
    // Solo permitimos pegar si no estamos editando un campo de texto simple
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        const type = e.target.type;
        if (type !== 'file') return; // Dejar que el texto se pegue normal
    }

    const items = (e.clipboardData || window.clipboardData).items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image/') !== -1) {
            const file = items[i].getAsFile();
            if (file) {
                // Prevenir pegado si lo hacen fuera de la zona para que no brinque la pantalla, aunque es un dashboard.
                e.preventDefault(); 
                compressImage(file, 800, (compressedBase64) => {
                    injectPhoto(compressedBase64, "");
                });
            }
        }
    }
});

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
            <textarea class="editable-input full-width auto-grow" rows="2" placeholder="Describa la actividad...">${captionStr}</textarea>
        </div>
    `;
    grid.appendChild(photoItem);
    const emptyMsg = document.getElementById('empty-photos-msg');
    if (emptyMsg) emptyMsg.style.display = 'none';
    _triggerSave();
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
        _triggerSave();
    }
}

// ---------------------------------------------
// The core export and print feature
// ---------------------------------------------
window.exportAndPrint = function() {
    const dateInput = document.getElementById('report-date').value;
    if (!dateInput) {
        alert("Por favor escoge una fecha de reporte antes de guardar.");
        return;
    }

    saveToCloud();
    initCalendar(); // Refresh Side Calendar
    setTimeout(() => window.print(), 300);
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
        signatures: []
    };

    // Serialize sign boxes specifically
    document.querySelectorAll('.signature-box').forEach(box => {
        const inputs = box.querySelectorAll('input[type="text"]');
        const imgInput = box.querySelector('.sig-base64');
        if (inputs.length >= 3) {
            data.signatures.push({
                nombre: inputs[0].value,
                cargo: inputs[1].value,
                empresa: inputs[2].value,
                img: imgInput ? imgInput.value : ''
            });
        }
    });

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
                const td = slots[i];
                td.dataset.state = state;
                let cell = td.querySelector('.w-cell');
                if (!cell) {
                    td.innerHTML = `<div class="w-cell"></div>`;
                    cell = td.querySelector('.w-cell');
                }
                cell.className = 'w-cell';
                cell.innerHTML = '';
                
                if(state == 1) {
                    cell.classList.add('w-sec');
                    cell.innerHTML = '<i class="fas fa-sun"></i>';
                }
                if(state == 2) {
                    cell.classList.add('w-lluvia');
                    cell.innerHTML = '<i class="fas fa-cloud-rain"></i>';
                }
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
    const container = document.getElementById('signatures-container');
    if (container) container.innerHTML = '';
    if (data.signatures && data.signatures.length > 0) {
        if (typeof data.signatures[0] === 'string') {
            // Backward compatibility
            for (let i = 0; i < data.signatures.length; i += 3) {
                window.addSignatureBox([data.signatures[i] || '', data.signatures[i+1] || '', data.signatures[i+2] || '', '']);
            }
        } else {
            // New Array of Objects format
            data.signatures.forEach(sig => {
                window.addSignatureBox([sig.nombre || '', sig.cargo || '', sig.empresa || '', sig.img || '']);
            });
        }
    } else {
        window.addSignatureBox(["", "", "", ""]);
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
        signatures: [
            { nombre: 'Arq. Filemón Arias', cargo: 'Residente de Interventoría', empresa: 'SERRA I&A S.A.S', img: '' },
            { nombre: 'Arq. Wilmer', cargo: 'Residente de Obra', empresa: 'PORTICO', img: '' }
        ],
        personnel: [
            ['SERRA I&A S.A.S', '1 Profesional\n(Residente de interventoría)', 'Verificación y control de avance de obra'],
            ['PORTICO S.A.S', '1 Profesional\n(Residente de obra)', 'Ejecución de obra'],
            ['PORTICO S.A.S', '1 Ayudante de obra', 'Oficios varios'],
            ['G&G Ingenieros Asociados', '1 Topógrafo\n1 Operario retroexcavadora\n1 SST\n1 Oficial', 'Tareas asignadas']
        ], 
        materials: [['', '', '', '', '']], photos: []
    };
    deserializeForm(blank);
}

// =========================================================
// CALENDAR WIDGET LOGIC
// =========================================================
let currentDisplayedMonth = new Date().getMonth();
let currentDisplayedYear = new Date().getFullYear();

window.changeMonth = function(offset) {
    currentDisplayedMonth += offset;
    if (currentDisplayedMonth < 0) {
        currentDisplayedMonth = 11;
        currentDisplayedYear--;
    } else if (currentDisplayedMonth > 11) {
        currentDisplayedMonth = 0;
        currentDisplayedYear++;
    }
    initCalendar();
}

function initCalendar() {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;
    if (!currentUser) return; // Only process if authed

    // Re-fetch keys from firestore (all doc ids)
    db.collection('reports').get().then(snapshot => {
        const completedLogs = [];
        snapshot.forEach(doc => completedLogs.push(doc.id));
        
        grid.innerHTML = '';
        const now = new Date();
        const todayStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];
        
        document.getElementById('calendar-header').innerText = 
            ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"][currentDisplayedMonth] + " " + currentDisplayedYear;

        const firstDay = new Date(currentDisplayedYear, currentDisplayedMonth, 1);
        const lastDay = new Date(currentDisplayedYear, currentDisplayedMonth + 1, 0);
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
            
            const loopDateStr = `${currentDisplayedYear}-${String(currentDisplayedMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

            if (loopDateStr <= todayStr) {
                if (completedLogs.includes(loopDateStr)) {
                    dayDiv.classList.add('done');
                    dayDiv.innerHTML += ' <i class="fas fa-check"></i>';
                } else {
                    dayDiv.classList.add('missed');
                    dayDiv.innerHTML += ' <i class="fas fa-times"></i>';
                }
            }

            dayDiv.onclick = () => {
                grid.querySelectorAll('.cal-day').forEach(d => d.style.boxShadow = 'none');
                dayDiv.style.boxShadow = 'inset 0 0 0 2px var(--accent)';
                
                document.getElementById('report-date').value = loopDateStr;
                window.history.pushState({}, '', '?id=' + loopDateStr);
                loadCloudReport(loopDateStr);
                
                window.scrollTo({ top: 0, behavior: 'smooth' });
            };

            grid.appendChild(dayDiv);
        }
    }).catch(err => console.error(err));
}

// Notifications Logic Removed for Cloud Version to avoid double popups

