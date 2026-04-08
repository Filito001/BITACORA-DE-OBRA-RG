// ============================================
// FIREBASE CONFIGURATION (VIEW ONLY)
// ============================================
const firebaseConfig = {
    apiKey: "AIzaSyCMX0XS9PW-ftdxTyfXIPx7EhBNnyHkWaI",
    authDomain: "bitacora-de-obra-rg.firebaseapp.com",
    projectId: "bitacora-de-obra-rg",
    storageBucket: "bitacora-de-obra-rg.firebasestorage.app",
    messagingSenderId: "296530875584",
    appId: "1:296530875584:web:baf85905206caecc58c925"
};

// Inicializar Firebase Compat V10
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let currentReportId = '';

document.addEventListener('DOMContentLoaded', () => {
    initView();
});

function updateSyncStatus(statusMsg, isOk = true) {
    const stTag = document.getElementById('sync-status');
    const txtTag = document.getElementById('sync-text');
    if(!stTag || !txtTag) return;
    
    txtTag.textContent = statusMsg;
    stTag.className = 'sync-status ' + (isOk ? 'ok' : 'syncing');
}

function initView() {
    const queryParams = new URLSearchParams(window.location.search);
    const idParam = queryParams.get('id');
    
    if (!idParam) {
        document.body.innerHTML = "<h2 style='text-align:center; margin-top:50px; color:#ef4444;'>Error: No se ha especificado un reporte válido en el enlace.</h2>";
        return;
    }
    
    currentReportId = idParam;
    document.getElementById('report-date').value = currentReportId;
    
    // Configurar campos en modo "readonly" globalmente
    lockAllInputs();
    
    // Escuchar el reporte en tiempo real
    updateSyncStatus('Cargando...', false);
    
    db.collection('reports').doc(currentReportId).onSnapshot((doc) => {
        if (doc.exists) {
            deserializeForm(doc.data());
            lockAllInputs(); // Relock dynamically added textareas
            updateSyncStatus('Live: sincronizado', true);
        } else {
            updateSyncStatus('Reporte no encontrado', false);
        }
    }, (error) => {
        console.error("Error al escuchar reporte:", error);
        updateSyncStatus('Error de conexión', false);
    });
}

function lockAllInputs() {
    // Deshabilitar el calendario lateral y ocultar flechas
    document.querySelector('.calendar-widget').style.display = 'none';
    
    document.querySelectorAll('input, select, textarea').forEach(el => {
        el.setAttribute('readonly', 'true');
        if (el.type === 'date' || el.type === 'time') {
            el.addEventListener('click', (e) => e.preventDefault());
        }
    });

    // Desactivar botones de agregar y eliminar
    document.querySelectorAll('button:not(.btn-print)').forEach(btn => {
        btn.style.display = 'none';
    });
    
    // Desactivar event listeners del clima
    document.querySelectorAll('#weather-slots td').forEach(td => {
        td.style.pointerEvents = 'none'; // Quitar eventos de click
    });

    // Eliminar etiquetas de subida
    document.querySelectorAll('.signature-upload-btn, .hidden').forEach(el => {
        el.style.display = 'none';
    });
}

// Auto-grow textareas
window.autoGrow = function(element) {
    element.style.height = 'auto';
    element.style.height = (element.scrollHeight) + 'px';
}

function addPersonRowWithData(dataArr) {
    const tbody = document.getElementById('personnel-body');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><textarea class="editable-input full-width auto-grow" rows="1">${dataArr[0]}</textarea></td>
        <td><textarea class="editable-input full-width auto-grow" rows="1">${dataArr[1]}</textarea></td>
        <td><textarea class="editable-input full-width auto-grow" rows="1">${dataArr[2]}</textarea></td>
        <td class="noprint text-center"></td>
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
        <td class="noprint text-center"></td>
    `;
    tbody.appendChild(tr);
    tr.querySelectorAll('.auto-grow').forEach(ta => autoGrow(ta));
}

window.addSignatureBox = function(dataArr) {
    const container = document.getElementById('signatures-container');
    if (!container) return;
    const box = document.createElement('div');
    box.className = 'signature-box';
    box.style.position = 'relative';
    const imgHtml = dataArr[3] ? `<img src="${dataArr[3]}" class="signature-img" />` : '';
    box.innerHTML = `
        <div class="signature-img-container">
            ${imgHtml}
        </div>
        <div class="sign-line"></div>
        <input type="text" class="editable-input bold-text text-center full-width sig-name" value="${dataArr[0] || ''}" />
        <input type="text" class="editable-input text-center text-sm full-width sig-role" value="${dataArr[1] || ''}" />
        <input type="text" class="editable-input text-center text-sm full-width sig-company" value="${dataArr[2] || ''}" />
    `;
    container.appendChild(box);
}

function injectPhoto(imgSrc, captionStr = '') {
    const grid = document.getElementById('photos-grid');
    const photoItem = document.createElement('div');
    photoItem.className = 'photo-item';
    photoItem.innerHTML = `
        <div class="photo-img-wrapper">
            <img src="${imgSrc}" alt="Registro Fotográfico" />
        </div>
        <div class="photo-caption">
            <textarea class="editable-input full-width auto-grow" rows="2">${captionStr}</textarea>
        </div>
    `;
    grid.appendChild(photoItem);
    const emptyMsg = document.getElementById('empty-photos-msg');
    if (emptyMsg) emptyMsg.style.display = 'none';
}

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
    }

    document.getElementById('materials-body').innerHTML = '';
    if (data.materials && data.materials.length > 0) {
        data.materials.forEach(row => addMaterialRowWithData(row));
    }

    // Signatures
    const container = document.getElementById('signatures-container');
    if (container) container.innerHTML = '';
    if (data.signatures && data.signatures.length > 0) {
        if (typeof data.signatures[0] === 'string') {
            for (let i = 0; i < data.signatures.length; i += 3) {
                window.addSignatureBox([data.signatures[i] || '', data.signatures[i+1] || '', data.signatures[i+2] || '', '']);
            }
        } else {
            data.signatures.forEach(sig => {
                window.addSignatureBox([sig.nombre || '', sig.cargo || '', sig.empresa || '', sig.img || '']);
            });
        }
    }

    // Photos
    document.querySelectorAll('.photo-item').forEach(p => p.remove());
    document.getElementById('empty-photos-msg').style.display = 'flex';
    if (data.photos) {
        data.photos.forEach(photo => injectPhoto(photo.img, photo.caption));
    }

    document.querySelectorAll('textarea.auto-grow').forEach(ta => autoGrow(ta));
}
