// ============================================
// SUPABASE CONFIGURATION (CLOUD DATABASE)
// ============================================
const supabaseUrl = 'https://zdtqcgubmqxjcahpbukc.supabase.co';
const supabaseKey = 'sb_publishable_OS_Y767gPrlN7IslzgIR4Q_0K04UShn';
let supabase = null;

try {
    if (window.supabase) {
        supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
    } else {
        console.error("Supabase CDN not loaded.");
    }
} catch (e) {
    console.error("Error al inicializar Supabase:", e);
}

let currentUser = null;
let isRegisterMode = false;

// Authenticate helper functions
async function checkUser() {
    if (!supabase) return null;
    try {
        const { data: { session } } = await supabase.auth.getSession();
        currentUser = session?.user || null;
    } catch(e) {
        console.error("No se pudo obtener la sesión", e);
    }
    return currentUser;
}

function toggleAuthMode(e) {
    if(e) e.preventDefault();
    isRegisterMode = !isRegisterMode;
    document.getElementById('auth-title').innerText = isRegisterMode ? 'Crear Cuenta' : 'Acceso Administrador';
    document.getElementById('auth-subtitle').innerText = isRegisterMode ? 'Regístrate para crear tus propias bitácoras.' : 'Inicia sesión para proteger y gestionar tus informes.';
    document.getElementById('btn-auth').innerText = isRegisterMode ? 'Registrarse' : 'Entrar a la Bitácora';
    document.getElementById('auth-toggle-text').innerText = isRegisterMode ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?';
    document.getElementById('auth-toggle-link').innerText = isRegisterMode ? 'Inicia sesión aquí' : 'Regístrate aquí';
    document.getElementById('login-error').style.display = 'none';
}

async function handleAuth() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-pass').value;
    const errorEl = document.getElementById('login-error');
    errorEl.style.display = 'none';

    if (!supabase) {
        errorEl.innerText = "Error: No hay conexión con la base de datos (Supabase no cargó temporalmente o requiere internet).";
        errorEl.style.display = 'block';
        return;
    }

    if (!email || !password) {
        errorEl.innerText = "Por favor ingresa correo y contraseña.";
        errorEl.style.display = 'block';
        return;
    }

    document.getElementById('btn-auth').innerText = 'Cargando...';
    try {
        if (isRegisterMode) {
            const { data, error } = await supabase.auth.signUp({ email, password });
            if (error) throw error;
            if (data.user) {
                if (!data.session) {
                    errorEl.innerText = "Cuenta creada. Por favor confirma tu correo o intenta iniciar sesión.";
                    errorEl.style.display = 'block';
                }
            }
        } else {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
        }
    } catch (err) {
        errorEl.innerText = err.message;
        errorEl.style.display = 'block';
    } finally {
        document.getElementById('btn-auth').innerText = isRegisterMode ? 'Registrarse' : 'Entrar a la Bitácora';
    }
}

async function handleLogout() {
    await supabase.auth.signOut();
    window.location.reload();
}

async function putData(dateStrParam, payloadObj) {
    if (!currentUser) throw new Error("No user authenticated");
    const { data, error } = await supabase
        .from('reportes')
        .upsert({ 
            id: `${dateStrParam}_${currentUser.id}`, 
            user_id: currentUser.id, 
            payload: payloadObj,
            report_date: dateStrParam
        }, { onConflict: 'id' });
    if (error) throw error;
    return data;
}

async function getData(dateStrParam) {
    if (!currentUser) return null;
    const { data, error } = await supabase
        .from('reportes')
        .select('payload')
        .eq('id', `${dateStrParam}_${currentUser.id}`)
        .maybeSingle();

    if (error) throw error;
    return data ? data.payload : null;
}

async function getAllKeys() {
    if (!currentUser) return [];
    const { data, error } = await supabase
        .from('reportes')
        .select('report_date')
        .eq('user_id', currentUser.id);

    if (error) throw error;
    return data.map(row => row.report_date);
}

let autoSaveTimeout = null;
let currentReportId = '';

document.addEventListener('DOMContentLoaded', async () => {
    // ATTACH EVENT LISTENERS SAFELY
    const btnAuth = document.getElementById('btn-auth');
    if (btnAuth) btnAuth.addEventListener('click', handleAuth);

    const toggleLink = document.getElementById('auth-toggle-link');
    if (toggleLink) toggleLink.addEventListener('click', toggleAuthMode);

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) btnLogout.addEventListener('click', handleLogout);

    const loginOverlay = document.getElementById('login-overlay');
    await checkUser();

    if (supabase) {
        supabase.auth.onAuthStateChange((event, session) => {
            currentUser = session?.user || null;
            if (event === 'SIGNED_IN') {
                if (loginOverlay) loginOverlay.style.display = 'none';
                initApp();
            } else if (event === 'SIGNED_OUT') {
                if (loginOverlay) loginOverlay.style.display = 'flex';
            }
        });
    } else {
        const errTag = document.getElementById('login-error');
        if(errTag) {
            errTag.innerText = "ATENCIÓN: No hay conexión a internet o el script de Supabase está bloqueado. Revisa tu red.";
            errTag.style.display = 'block';
        }
    }

    if (!currentUser) {
        if (loginOverlay) loginOverlay.style.display = 'flex';
    } else {
        if (loginOverlay) loginOverlay.style.display = 'none';
        initApp();
    }
});

// trigger autosave on any input change
document.addEventListener('input', function (e) {
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
    if (!stTag || !txtTag) return;

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
    
    try { initCalendar(); } catch (e) { console.error(e); }

    const todayStr = new Date().toISOString().split('T')[0];
    const urlParams = new URLSearchParams(window.location.search);
    const dateParam = urlParams.get('id');
    const dateInput = document.getElementById('report-date');

    if (dateParam) {
        if (dateInput) dateInput.value = dateParam;
        try { loadCloudReport(dateParam); } catch (e) { console.error(e); }
    } else {
        if (dateInput) dateInput.value = todayStr;
        try { loadCloudReport(todayStr); } catch (e) { console.error(e); }
    }

    if (dateInput) {
        dateInput.addEventListener('change', function (e) {
            window.history.pushState({}, '', '?id=' + e.target.value);
            loadCloudReport(e.target.value);
        });
    }
}

// ============================================
// OFFLINE SYNC LOGIC
// ============================================
async function saveToCloud() {
    currentReportId = document.getElementById('report-date').value;
    if (!currentReportId) return;

    let reportData;
    try {
        reportData = serializeForm(currentReportId);
    } catch (err) {
        console.error("Error al serializar:", err);
        updateSyncStatus('Error', false);
        return;
    }

    try {
        await putData(currentReportId, reportData);
        updateSyncStatus('Guardado Local', true);
        renderRainChart(currentReportId);
    } catch (err) {
        console.error("Local Error:", err);
        updateSyncStatus('Fallo de Guardado', false);
    }
}

async function loadCloudReport(dateStr) {
    currentReportId = dateStr;
    updateSyncStatus('Cargando...', false);

    try {
        const payload = await getData(dateStr);
        if (payload) {
            deserializeForm(payload);
        } else {
            clearFormAndSetDate(dateStr);
            saveToCloud();
        }
        updateSyncStatus('Cargado Local', true);
        renderRainChart(currentReportId);
    } catch (err) {
        console.error("Local Read Error:", err);
        updateSyncStatus('Fallo de Lectura', false);
    }
}

function _triggerSave() {
    clearTimeout(autoSaveTimeout);
    updateSyncStatus('Guardando...', false);
    autoSaveTimeout = setTimeout(() => saveToCloud(), 500);
}

// Auto-grow textareas
window.autoGrow = function (element) {
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
        td.dataset.state = "0";
        td.dataset.minutes = "0";
        td.innerHTML = `<div class="w-cell"></div>`;
        td.addEventListener('click', function (e) {
            if (e.target.tagName.toLowerCase() === 'input') return;
            let currentState = parseInt(this.dataset.state || "0");
            currentState = (currentState + 1) % 3;
            this.dataset.state = currentState.toString();
            this.dataset.minutes = currentState === 2 ? "60" : "0";
            
            const cell = this.querySelector('.w-cell');
            cell.className = 'w-cell';
            if (currentState === 1) {
                cell.classList.add('w-sec');
                cell.innerHTML = '<i class="fas fa-sun"></i>';
            } else if (currentState === 2) {
                cell.classList.add('w-lluvia');
                cell.innerHTML = '<i class="fas fa-cloud-rain"></i><input type="number" class="rain-mins-input noprint" value="60" min="1" max="60" onchange="this.parentElement.parentElement.dataset.minutes = this.value; this.nextElementSibling.innerText = this.value + \'m\'; _triggerSave()"><span class="rain-mins-print" style="display:none; font-size: 0.65rem; font-weight: bold; line-height:1;">60m</span>';
            } else {
                cell.innerHTML = '';
            }
            _triggerSave();
        });
        slotsRow.appendChild(td);
    }
}

// Table Rows Manipulations
window.removeRow = function (btn) {
    btn.closest('tr').remove();
    _triggerSave();
}

window.addPersonRow = function () {
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

window.addMaterialRow = function () {
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
window.addSignatureBox = function (dataArr = ["", "", "", ""]) {
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

window.removeSignatureBox = function (btn) {
    btn.closest('.signature-box').remove();
    _triggerSave();
}

window.handleSignatureUpload = function (event, inputElem) {
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
window.handleImageUpload = function (event) {
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
window.addEventListener('paste', function (e) {
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

window.removePhoto = function (btn) {
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
window.exportAndPrint = function () {
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
        weatherSlots: Array.from(document.getElementById('weather-slots').children).map(td => ({
            state: td.dataset.state || "0",
            minutes: td.dataset.minutes || "0"
        })),
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
        data.weatherSlots.forEach((slotData, i) => {
            if (slots[i]) {
                const td = slots[i];
                let state = "0", mins = "0";
                if (typeof slotData === 'object' && slotData !== null) {
                    state = slotData.state || "0";
                    mins = slotData.minutes || "0";
                } else {
                    state = slotData;
                    mins = (state == 2 || state === '2') ? "60" : "0";
                }
                td.dataset.state = state;
                td.dataset.minutes = mins;
                
                let cell = td.querySelector('.w-cell');
                if (!cell) {
                    td.innerHTML = `<div class="w-cell"></div>`;
                    cell = td.querySelector('.w-cell');
                }
                cell.className = 'w-cell';
                cell.innerHTML = '';

                if (state == 1) {
                    cell.classList.add('w-sec');
                    cell.innerHTML = '<i class="fas fa-sun"></i>';
                } else if (state == 2) {
                    cell.classList.add('w-lluvia');
                    cell.innerHTML = `<i class="fas fa-cloud-rain"></i><input type="number" class="rain-mins-input noprint" value="${mins}" min="1" max="60" onchange="this.parentElement.parentElement.dataset.minutes = this.value; this.nextElementSibling.innerText = this.value + 'm'; _triggerSave()"><span class="rain-mins-print" style="display:none; font-size: 0.65rem; font-weight: bold; line-height:1;">${mins}m</span>`;
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
                window.addSignatureBox([data.signatures[i] || '', data.signatures[i + 1] || '', data.signatures[i + 2] || '', '']);
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
        weatherSlots: Array.from({length: 12}, () => ({state: "0", minutes: "0"})), precipitaciones: '', notaClima: '', actividadesCampo: '', recomendaciones: '',
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

window.changeMonth = function (offset) {
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
    // Re-fetch keys from Local DB
    getAllKeys().then((keys) => {
        const completedLogs = keys || [];

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

// =========================================================
// PDF EXPORT / PRINT OTPIMIZATIONS (Hide Empty Elements)
// =========================================================
window.addEventListener('beforeprint', function () {
    // 1. Hide empty rows in personnel
    document.querySelectorAll('#personnel-body tr').forEach(tr => {
        const textareas = tr.querySelectorAll('textarea');
        let isEmpty = true;
        textareas.forEach(ta => {
            if (ta.value.trim() !== '') isEmpty = false;
        });
        if (isEmpty) tr.dataset.printHidden = 'true';
    });

    // 2. Hide empty rows in materials
    document.querySelectorAll('#materials-body tr').forEach(tr => {
        const inputs = tr.querySelectorAll('input, textarea');
        let isEmpty = true;
        inputs.forEach(input => {
            if (input.value.trim() !== '') isEmpty = false;
        });
        if (isEmpty) tr.dataset.printHidden = 'true';
    });

    // 3. Hide completely empty sections (like photos or completely empty tables)
    document.querySelectorAll('.section-block').forEach(section => {

        // If it's the photo section
        const grid = section.querySelector('#photos-grid');
        if (grid) {
            const photos = grid.querySelectorAll('.photo-item');
            if (photos.length === 0) {
                section.dataset.printHidden = 'true';
            }
        }

        // If it's a tables section and all rows within are hidden
        const tbody = section.querySelector('tbody#personnel-body, tbody#materials-body');
        if (tbody) {
            const allRows = tbody.querySelectorAll('tr');
            const hiddenRows = tbody.querySelectorAll('tr[data-print-hidden="true"]');
            if (allRows.length > 0 && allRows.length === hiddenRows.length) {
                section.dataset.printHidden = 'true';
            }
        }
    });

    // Apply display none
    document.querySelectorAll('[data-print-hidden="true"]').forEach(el => {
        el.style.display = 'none';
    });
});

window.addEventListener('afterprint', function () {
    // Restore display
    document.querySelectorAll('[data-print-hidden="true"]').forEach(el => {
        el.style.display = '';
        delete el.dataset.printHidden;
    });
});

let rainChartInstance = null;
async function renderRainChart(currentDateString) {
    if (!currentDateString) return;
    const ctx = document.getElementById('rainChart');
    if (!ctx) return;

    const currentMonthPrefix = currentDateString.substring(0, 7);
    const allKeys = await getAllKeys();
    const monthKeys = allKeys.filter(k => k.startsWith(currentMonthPrefix) && k <= currentDateString).sort();

    const currentDay = parseInt(currentDateString.substring(8, 10), 10);
    const dailyRainMap = {};

    for (const key of monthKeys) {
        const payload = await getData(key);
        if (payload && payload.weatherSlots) {
            let rainHours = 0;
            payload.weatherSlots.forEach(s => {
                if (typeof s === 'object' && s !== null) {
                    if (s.state == 2) {
                        rainHours += (parseFloat(s.minutes) || 0) / 60;
                    }
                } else {
                    if (s == 2 || s === '2') {
                        rainHours += 1;
                    }
                }
            });
            const dayNum = parseInt(key.substring(8, 10), 10);
            dailyRainMap[dayNum] = rainHours;
        }
    }

    let totalRain = 0;
    const labels = [];
    const dataPoints = [];

    for (let i = 1; i <= currentDay; i++) {
        labels.push(i.toString());
        const hours = dailyRainMap[i] || 0;
        dataPoints.push(hours);
        totalRain += hours;
    }

    const lbl = document.getElementById('rain-total-label');
    if (lbl) lbl.textContent = `Total Acumulado del Mes: ${Number.isInteger(totalRain) ? totalRain : totalRain.toFixed(1)} horas`;

    if (rainChartInstance) {
        rainChartInstance.destroy();
    }

    rainChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Horas de lluvia',
                data: dataPoints,
                backgroundColor: 'rgba(59, 130, 246, 0.6)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}
