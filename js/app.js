// --- Supabase Client Initialization ---
const SUPABASE_URL = 'https://tqysigxqrlydmzbxzxqk.supabase.co'; // ¡REEMPLAZA ESTO!
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxeXNpZ3hxcmx5ZG16Ynh6eHFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzMzAwMTQsImV4cCI6MjA3NjkwNjAxNH0.AJKtnWhzwi1vKjCu17JHaKLwzETp8OMiP8UwwSF5uxI'; // ¡REEMPLAZA ESTO!

let supabase; // Declara 'supabase' globalmente, pero no lo inicialices aquí.

// ------------------------------------------

// Variables globales
let territories = []; // Ahora se cargará desde Supabase
const graffitiDurationInput = document.getElementById('graffitiDuration');
const territoriesListDiv = document.getElementById('territoriesList');
const currentDateTimeSpan = document.getElementById('currentDateTime');

// --- Funciones de Utilidad ---

// Función para obtener la hora actual de Argentina (GMT-3) y formatearla
function getArgentineTime() {
    const now = new Date();
    // Ajustar a UTC primero, luego aplicar el offset de Argentina (-3 horas)
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * -3)); // -3 horas para GMT-3
}

function formatDateTime(date) {
    if (!date) return ''; // Manejar fechas nulas
    // Asegurarse de que la fecha se formatee como hora local de Argentina si es posible
    // La conversión a ISOString ya debería tener la zona horaria correcta de Supabase
    return new Date(date).toLocaleString('es-AR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'America/Argentina/Buenos_Aires'
    });
}

function formatDateTimeLocal(date) {
    if (!date) return ''; // Manejar fechas nulas
    const d = new Date(date); // Asegúrate de que es un objeto Date
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// --- Funciones de Interacción con Supabase ---

async function fetchTerritories() {
    console.log("Fetching territories...");
    // Verificar si supabase está inicializado
    if (!supabase) {
        console.error("Supabase client not initialized. Cannot fetch territories.");
        return [];
    }

    const { data, error } = await supabase
        .from('territories')
        .select(`
            *,
            graffitis (
                id, start_time, end_time
            )
        `)
        .order('created_at', { ascending: true }); // Ordenar por fecha de creación

    if (error) {
        console.error('Error fetching territories:', error.message);
        alert('Error al cargar territorios: ' + error.message);
        return [];
    }

    // Adaptar la estructura de datos de Supabase a la esperada por el frontend
    return data.map(territory => ({
        id: territory.id,
        name: territory.name,
        graffitis: territory.graffitis || [] // Asegurarse de que graffitis sea un array
    }));
}

async function renderTerritories() {
    territories = await fetchTerritories(); // Cargar los territorios al renderizar
    territoriesListDiv.innerHTML = ''; // Limpiar la lista antes de renderizar

    territories.forEach((territory) => { // Eliminado territoryIndex, ahora usamos territory.id
        const territoryDiv = document.createElement('div');
        territoryDiv.className = 'territory-item';
        // Usar territory.id en lugar de territoryIndex para identificadores únicos
        territoryDiv.setAttribute('data-id', territory.id);

        territoryDiv.innerHTML = `
            <div class="territory-header">
                <h3 class="display-name">${territory.name}</h3>
                <div class="edit-name">
                    <input type="text" value="${territory.name}" class="edit-name-input" maxlength="15">
                    <button class="save-btn" onclick="saveTerritoryName('${territory.id}', this)">Guardar</button>
                    <button class="cancel-btn" onclick="cancelTerritoryEdit('${territory.id}', this)">Cancelar</button>
                </div>
                <div class="territory-actions">
                    <button class="edit-btn" onclick="editTerritoryName('${territory.id}', this)">Editar Nombre</button>
                    <button class="add-graffiti-btn" ${territory.graffitis.length >= 3 ? 'disabled' : ''} onclick="addGraffiti('${territory.id}')">Agregar Grafiti</button>
                    <button class="delete-btn" onclick="deleteTerritory('${territory.id}')">Eliminar Territorio</button>
                </div>
            </div>
            <ul class="territory-graffiti-list" id="graffitiList-${territory.id}"></ul>
        `;
        territoriesListDiv.appendChild(territoryDiv);
        renderGraffitis(territory.id, territory.graffitis);
    });
    updateCountdowns(); // Actualizar cuenta regresiva después de renderizar
}

function renderGraffitis(territoryId, graffitisData) {
    const graffitiList = document.getElementById(`graffitiList-${territoryId}`);
    if (!graffitiList) return; // Asegurarse de que el elemento existe
    graffitiList.innerHTML = '';

    graffitisData.forEach((graffiti) => { // Eliminado graffitiIndex
        const startDate = new Date(graffiti.start_time); // Usar start_time de Supabase
        const endDate = new Date(graffiti.end_time);     // Usar end_time de Supabase

        const graffitiItem = document.createElement('li');
        graffitiItem.className = 'graffiti-item';
        graffitiItem.setAttribute('data-id', graffiti.id); // Identificador para el graffiti

        graffitiItem.innerHTML = `
            <p><strong>Inicio:</strong> <span class="graffiti-start-display">${formatDateTime(startDate)}</span></p>
            <p><strong>Fin:</strong> <span class="graffiti-end-display">${formatDateTime(endDate)}</span></p>
            <p class="countdown" id="countdown-${territoryId}-${graffiti.id}"></p>
            <div class="edit-graffiti-start-time-wrapper" style="display:none;">
                <label for="editStartTime-${territoryId}-${graffiti.id}">Modificar:</label>
                <input type="datetime-local" id="editStartTime-${territoryId}-${graffiti.id}" value="${formatDateTimeLocal(startDate)}">
            </div>
            <div class="graffiti-actions" id="graffiti-actions-${territoryId}-${graffiti.id}">
                <button class="edit-btn" onclick="editGraffitiStartTime('${territoryId}', '${graffiti.id}', this)">Modificar</button>
                <button class="delete-btn" onclick="deleteGraffiti('${territoryId}', '${graffiti.id}')">Eliminar</button>
            </div>
            <div class="edit-graffiti-actions" id="edit-graffiti-actions-${territoryId}-${graffiti.id}" style="display:none;">
                <button class="save-btn" onclick="saveGraffitiStartTime('${territoryId}', '${graffiti.id}', this)">Guardar</button>
                <button class="cancel-btn" onclick="cancelGraffitiEdit('${territoryId}', '${graffiti.id}', this)">Cancelar</button>
            </div>
        `;
        graffitiList.appendChild(graffitiItem);
    });

    // Habilitar/deshabilitar botón de agregar graffiti
    const territoryDiv = territoriesListDiv.querySelector(`.territory-item[data-id="${territoryId}"]`);
    const addGraffitiBtn = territoryDiv ? territoryDiv.querySelector('.add-graffiti-btn') : null;
    if (addGraffitiBtn) {
        if (graffitisData.length >= 3) {
            addGraffitiBtn.disabled = true;
        } else {
            addGraffitiBtn.disabled = false;
        }
    }
}

async function addTerritory() {
    const newTerritoryNameInput = document.getElementById('newTerritoryName');
    const name = newTerritoryNameInput.value.trim();
    if (name) {
        console.log("Intentando agregar territorio:", name);
        if (!supabase) {
            console.error("Supabase client not initialized. Cannot add territory.");
            alert('Error: Supabase no está inicializado.');
            return;
        }
        const { data, error } = await supabase
            .from('territories')
            .insert([{ name: name }])
            .select(); // Retornar el territorio recién creado

        if (error) {
            console.error('Error adding territory:', error.message);
            alert('Error al agregar territorio: ' + error.message);
            // Si el error es por nombre duplicado, informar al usuario
            if (error.code === '23505') { // Código de error para unique_violation
                alert('Ya existe un territorio con ese nombre. Por favor, elige otro.');
            }
            return;
        }

        console.log("Territorio agregado con éxito:", data);
        newTerritoryNameInput.value = '';
        await renderTerritories(); // Volver a renderizar para mostrar el nuevo territorio
    } else {
        alert('Por favor, ingresa un nombre para el territorio.');
    }
}

async function deleteTerritory(territoryId) {
    const territoryToDelete = territories.find(t => t.id === territoryId);
    if (!territoryToDelete) return;

    if (confirm(`¿Estás seguro de que quieres eliminar el territorio "${territoryToDelete.name}" y todos sus grafitis?`)) {
        if (!supabase) {
            console.error("Supabase client not initialized. Cannot delete territory.");
            alert('Error: Supabase no está inicializado.');
            return;
        }
        const { error } = await supabase
            .from('territories')
            .delete()
            .eq('id', territoryId);

        if (error) {
            console.error('Error deleting territory:', error.message);
            alert('Error al eliminar territorio: ' + error.message);
            return;
        }

        await renderTerritories(); // Volver a renderizar para actualizar la lista
    }
}

function editTerritoryName(territoryId, button) {
    const territoryDiv = button.closest('.territory-item');
    const displayName = territoryDiv.querySelector('.display-name');
    const editNameDiv = territoryDiv.querySelector('.edit-name');
    const editNameInput = editNameDiv.querySelector('.edit-name-input');

    displayName.style.display = 'none';
    territoryDiv.querySelector('.territory-actions').style.display = 'none';
    editNameDiv.style.display = 'flex';

    // Encontrar el nombre actual del territorio en el array local (ya cargado de Supabase)
    const currentTerritory = territories.find(t => t.id === territoryId);
    if (currentTerritory) {
        editNameInput.value = currentTerritory.name;
    }
    editNameInput.focus();
}

async function saveTerritoryName(territoryId, button) {
    const territoryDiv = button.closest('.territory-item');
    const editNameInput = territoryDiv.querySelector('.edit-name-input');
    const newName = editNameInput.value.trim();

    if (newName) {
        if (!supabase) {
            console.error("Supabase client not initialized. Cannot save territory name.");
            alert('Error: Supabase no está inicializado.');
            return;
        }
        const { error } = await supabase
            .from('territories')
            .update({ name: newName })
            .eq('id', territoryId);

        if (error) {
            console.error('Error updating territory name:', error.message);
            alert('Error al actualizar nombre del territorio: ' + error.message);
            if (error.code === '23505') { // Código de error para unique_violation
                alert('Ya existe un territorio con ese nombre. Por favor, elige otro.');
            }
            return;
        }
        await renderTerritories(); // Volver a renderizar para actualizar todo
    } else {
        alert('El nombre del territorio no puede estar vacío.');
    }
}

function cancelTerritoryEdit(territoryId, button) {
    const territoryDiv = button.closest('.territory-item');
    const displayName = territoryDiv.querySelector('.display-name');
    const editNameDiv = territoryDiv.querySelector('.edit-name');

    displayName.style.display = 'block';
    territoryDiv.querySelector('.territory-actions').style.display = 'flex';
    editNameDiv.style.display = 'none';
}

async function addGraffiti(territoryId) {
    const currentTerritory = territories.find(t => t.id === territoryId);
    if (!currentTerritory) return;

    if (currentTerritory.graffitis.length < 3) {
        const durationHours = parseInt(graffitiDurationInput.value);
        if (isNaN(durationHours) || durationHours <= 0) {
            alert('Por favor, ingresa una duración válida (en horas) para el grafiti.');
            return;
        }

        const startTime = getArgentineTime();
        const endTime = new Date(startTime.getTime() + durationHours * 60 * 60 * 1000);

        if (!supabase) {
            console.error("Supabase client not initialized. Cannot add graffiti.");
            alert('Error: Supabase no está inicializado.');
            return;
        }
        const { data, error } = await supabase
            .from('graffitis')
            .insert([{
                territory_id: territoryId,
                start_time: startTime.toISOString(), // Guardar en formato ISO
                end_time: endTime.toISOString()      // Guardar en formato ISO
            }])
            .select();

        if (error) {
            console.error('Error adding graffiti:', error.message);
            alert('Error al agregar grafiti: ' + error.message);
            return;
        }
        await renderTerritories(); // Volver a renderizar para actualizar los grafitis
    } else {
        alert('Este territorio ya tiene el máximo de 3 grafitis activos.');
    }
}

async function deleteGraffiti(territoryId, graffitiId) {
    if (confirm('¿Estás seguro de que quieres eliminar este grafiti?')) {
        if (!supabase) {
            console.error("Supabase client not initialized. Cannot delete graffiti.");
            alert('Error: Supabase no está inicializado.');
            return;
        }
        const { error } = await supabase
            .from('graffitis')
            .delete()
            .eq('id', graffitiId);

        if (error) {
            console.error('Error deleting graffiti:', error.message);
            alert('Error al eliminar grafiti: ' + error.message);
            return;
        }
        await renderTerritories(); // Volver a renderizar para actualizar los grafitis
    }
}

function editGraffitiStartTime(territoryId, graffitiId, button) {
    const graffitiItem = button.closest('.graffiti-item');
    const startTimeDisplay = graffitiItem.querySelector('.graffiti-start-display');
    const editStartTimeWrapper = graffitiItem.querySelector('.edit-graffiti-start-time-wrapper');
    const graffitiActions = graffitiItem.querySelector(`#graffiti-actions-${territoryId}-${graffitiId}`);
    const editGraffitiActions = graffitiItem.querySelector(`#edit-graffiti-actions-${territoryId}-${graffitiId}`);
    const editStartTimeInput = graffitiItem.querySelector(`#editStartTime-${territoryId}-${graffitiId}`);

    startTimeDisplay.style.display = 'none';
    graffitiActions.style.display = 'none';
    editStartTimeWrapper.style.display = 'block';
    editGraffitiActions.style.display = 'flex';

    // Cargar el valor actual del graffiti desde el estado local para el input de edición
    const currentTerritory = territories.find(t => t.id === territoryId);
    const currentGraffiti = currentTerritory ? currentTerritory.graffitis.find(g => g.id === graffitiId) : null;
    if (currentGraffiti) {
        editStartTimeInput.value = formatDateTimeLocal(new Date(currentGraffiti.start_time));
    }
}

async function saveGraffitiStartTime(territoryId, graffitiId, button) {
    const graffitiItem = button.closest('.graffiti-item');
    const editStartTimeInput = graffitiItem.querySelector(`#editStartTime-${territoryId}-${graffitiId}`);
    const newStartTimeString = editStartTimeInput.value;

    if (!newStartTimeString) {
        alert('Por favor, selecciona una fecha y hora válidas.');
        return;
    }

    const durationHours = parseInt(graffitiDurationInput.value);
    if (isNaN(durationHours) || durationHours <= 0) {
        alert('La duración del grafiti no es válida. Por favor, corrígela en la configuración global.');
        return;
    }

    const newStartDate = new Date(newStartTimeString);
    const newEndTime = new Date(newStartDate.getTime() + durationHours * 60 * 60 * 1000);

    if (!supabase) {
        console.error("Supabase client not initialized. Cannot save graffiti start time.");
        alert('Error: Supabase no está inicializado.');
        return;
    }
    const { error } = await supabase
        .from('graffitis')
        .update({
            start_time: newStartDate.toISOString(),
            end_time: newEndTime.toISOString()
        })
        .eq('id', graffitiId);

    if (error) {
        console.error('Error updating graffiti start time:', error.message);
        alert('Error al actualizar hora de inicio del grafiti: ' + error.message);
        return;
    }
    await renderTerritories(); // Volver a renderizar para actualizar los grafitis
}

function cancelGraffitiEdit(territoryId, graffitiId, button) {
    const graffitiItem = button.closest('.graffiti-item');
    const startTimeDisplay = graffitiItem.querySelector('.graffiti-start-display');
    const editStartTimeWrapper = graffitiItem.querySelector('.edit-graffiti-start-time-wrapper');
    const graffitiActions = graffitiItem.querySelector(`#graffiti-actions-${territoryId}-${graffitiId}`);
    const editGraffitiActions = graffitiItem.querySelector(`#edit-graffiti-actions-${territoryId}-${graffitiId}`);

    startTimeDisplay.style.display = 'block';
    graffitiActions.style.display = 'flex';
    editStartTimeWrapper.style.display = 'none';
    editGraffitiActions.style.display = 'none';
}

async function updateAllGraffitiEndTimes() {
    const durationHours = parseInt(graffitiDurationInput.value);
    if (isNaN(durationHours) || durationHours <= 0) {
        return;
    }

    // Recorre todos los territorios y grafitis localmente para recalcular y luego hacer un batch update
    const updates = [];
    territories.forEach(territory => {
        territory.graffitis.forEach(graffiti => {
            const startTime = new Date(graffiti.start_time);
            const newEndTime = new Date(startTime.getTime() + durationHours * 60 * 60 * 1000).toISOString();
            if (graffiti.end_time !== newEndTime) { // Solo si realmente cambió
                updates.push({
                    id: graffiti.id,
                    end_time: newEndTime
                });
            }
        });
    });

    if (updates.length > 0) {
        if (!supabase) {
            console.error("Supabase client not initialized. Cannot update graffiti end times.");
            alert('Error: Supabase no está inicializado.');
            return;
        }
        for (const updateItem of updates) {
            const { error } = await supabase
                .from('graffitis')
                .update({ end_time: updateItem.end_time })
                .eq('id', updateItem.id);

            if (error) {
                console.error('Error updating graffiti end time:', error.message);
                // No mostrar alerta para cada error individual, quizás un log o un mensaje general
            }
        }
    }
    await renderTerritories(); // Volver a renderizar para mostrar las nuevas horas de fin
}


function updateCountdowns() {
    territories.forEach((territory) => {
        territory.graffitis.forEach((graffiti) => {
            const countdownElement = document.getElementById(`countdown-${territory.id}-${graffiti.id}`);
            // Asegurarse de seleccionar el elemento de display de fin correcto
            const graffitiItemDiv = document.querySelector(`.graffiti-item[data-id="${graffiti.id}"]`);
            const endTimeDisplayElement = graffitiItemDiv ? graffitiItemDiv.querySelector('.graffiti-end-display') : null;


            if (!countdownElement || !endTimeDisplayElement) return;

            const endTime = new Date(graffiti.end_time);
            const now = getArgentineTime();
            const timeLeft = endTime.getTime() - now.getTime();

            // Actualizar el texto de fin si la duración global cambió (ya se hace en renderTerritories)
            endTimeDisplayElement.textContent = formatDateTime(endTime);

            if (timeLeft <= 0) {
                countdownElement.textContent = '¡Tiempo agotado!';
                countdownElement.classList.add('red'); // Expiró el contador
                document.body.classList.add('red');
                return;
            }

            const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

            countdownElement.textContent = `Faltan: ${days}d ${hours}h ${minutes}m ${seconds}s`;

            if (timeLeft < (24 * 60 * 60 * 1000)) { // Menos de 24 horas
                countdownElement.classList.add('red');
            } else {
                countdownElement.classList.remove('red');
            }
        });
    });
}

function updateCurrentDateTime() {
    const now = getArgentineTime();
    currentDateTimeSpan.textContent = `Hora de Argentina: ${formatDateTime(now)}`;
}


// --- Función Principal de Inicialización de la Aplicación ---
async function initializeApp() {
    console.log("Initializing CMK Territories App...");

    // ¡Mueve la inicialización de Supabase AQUÍ!
    // Esto asegura que la librería Supabase ya esté cargada y disponible
	if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
  	  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  	  console.log("✅ Supabase client initialized correctamente.");
	} else {
  	  console.error("❌ Supabase library not loaded. Cannot initialize client.");
  	  alert("Error: La librería de Supabase no se ha cargado correctamente. Intenta recargar la página.");
  	  return;
}


    await renderTerritories();
    updateCountdowns();
    updateCurrentDateTime();

    setInterval(updateCountdowns, 1000);
    setInterval(updateCurrentDateTime, 1000);

    graffitiDurationInput.addEventListener('change', updateAllGraffitiEndTimes);
    console.log("App initialized.");
}



// --- Evento DOMContentLoaded ---
// Esto asegura que initializeApp() se llama solo después de que todo el HTML
// y los scripts de CDN (como Supabase) se hayan cargado.
document.addEventListener('DOMContentLoaded', initializeApp);