const SUPABASE_URL = 'https://tqysigxqrlydmzbxzxqk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxeXNpZ3hxcmx5ZG16Ynh6eHFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzMzAwMTQsImV4cCI6MjA3NjkwNjAxNH0.AJKtnWhzwi1vKjCu17JHaKLwzETp8OMiP8UwwSF5uxI';

let supabase;

let territories = [];
const graffitiDurationInput = document.getElementById('graffitiDuration');
const territoriesListDiv = document.getElementById('territoriesList');
const currentDateTimeSpan = document.getElementById('currentDateTime');
let globalGraffitiDuration = 120;

const activeTerritoriesCountSpan = document.getElementById('activeTerritoriesCount');
const activeGraffitisCountSpan = document.getElementById('activeGraffitisCount');
const expiredGraffitisCountSpan = document.getElementById('expiredGraffitisCount');
const upcomingGraffitisListUl = document.getElementById('upcomingGraffitisList');
const copyUpcomingBtn = document.getElementById('copyUpcomingBtn');
const sidebarContainer = document.querySelector('.sidebar-container');

const chatMessagesDiv = document.getElementById('chatMessages');
const chatUserNameInput = document.getElementById('chatUserName');
const chatMessageInput = document.getElementById('chatMessageInput');
const sendChatMessageBtn = document.getElementById('sendChatMessageBtn');


async function fetchGlobalGraffitiDuration() {
    if (!supabase) {
        return;
    }

    const { data, error } = await supabase
        .from('settings')
        .select('setting_value')
        .eq('setting_name', 'graffiti_duration_hours')
        .single();

    if (error) {
        globalGraffitiDuration = 120;
        graffitiDurationInput.value = globalGraffitiDuration;
        return;
    }

    if (data && data.setting_value) {
        const duration = parseInt(data.setting_value);
        if (!isNaN(duration) && duration > 0) {
            globalGraffitiDuration = duration;
            graffitiDurationInput.value = globalGraffitiDuration;
        } else {
            globalGraffitiDuration = 120;
            graffitiDurationInput.value = globalGraffitiDuration;
        }
    }
}

async function saveGlobalGraffitiDuration(newDuration) {
    if (!supabase) {
        return { success: false, error: 'client_not_initialized' };
    }

    try {
        const payload = {
            setting_name: 'graffiti_duration_hours',
            setting_value: String(newDuration)
        };

        const { data, error } = await supabase
            .from('settings')
            .upsert(payload, { onConflict: 'setting_name' })
            .select();

        if (error) {
            console.error('Error saving graffiti duration setting (upsert):', error);
            return { success: false, error };
        }
        return { success: true, data };
    } catch (err) {
        console.error('Unexpected error in saveGlobalGraffitiDuration:', err);
        return { success: false, error: err };
    }
}

function getArgentineTime() {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * -3));
}

function formatDateTime(date) {
    if (!date) return '';
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
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

async function fetchTerritories() {
    if (!supabase) {
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
        .order('created_at', { ascending: true });

    if (error) {
        alert('Error al cargar territorios: ' + error.message);
        return [];
    }

    return data.map(territory => ({
        id: territory.id,
        name: territory.name,
        graffitis: territory.graffitis || []
    }));
}

async function renderTerritories() {
    territories = await fetchTerritories();
    territoriesListDiv.innerHTML = '';

    territories.forEach((territory) => {
        const territoryDiv = document.createElement('div');
        territoryDiv.className = 'territory-item';
        territoryDiv.setAttribute('data-id', territory.id);

        territoryDiv.innerHTML = `
            <div class="territory-header">
                <h3 class="display-name">${territory.name}</h3>
                <div class="edit-name" style="display:none;">
                    <input type="text" value="${territory.name}" class="edit-name-input" maxlength="15">
                    <button class="save-btn" onclick="saveTerritoryName('${territory.id}', this)">Guardar</button>
                    <button class="cancel-btn" onclick="cancelTerritoryEdit('${territory.id}', this)">Cancelar</button>
                </div>
                <div class="territory-actions">
                    <button class="add-graffiti-btn" ${territory.graffitis.length >= 3 ? 'disabled' : ''} onclick="addGraffiti('${territory.id}')">
                        Agregar Grafiti
                    </button>
                    <button class="edit-btn" onclick="editTerritoryName('${territory.id}', this)" title="Editar Nombre">
                        <i class="fa-solid fa-pencil"></i>
                    </button>
                    <button class="delete-btn" onclick="deleteTerritory('${territory.id}')" title="Eliminar Territorio">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>
            <ul class="territory-graffiti-list" id="graffitiList-${territory.id}"></ul>
        `;
        territoriesListDiv.appendChild(territoryDiv);
        renderGraffitis(territory.id, territory.graffitis);
    });
    updateCountdowns();
    updateSidebarStats();
    updateUpcomingGraffitis();
}

function renderGraffitis(territoryId, graffitisData) {
    const graffitiList = document.getElementById(`graffitiList-${territoryId}`);
    if (!graffitiList) return;
    graffitiList.innerHTML = '';

    graffitisData.forEach((graffiti) => {
        const startDate = new Date(graffiti.start_time);
        const endDate = new Date(graffiti.end_time);

        const graffitiItem = document.createElement('li');
        graffitiItem.className = 'graffiti-item';
        graffitiItem.setAttribute('data-id', graffiti.id);

        graffitiItem.innerHTML = `
            <p><strong>Inicio:</strong> <span class="graffiti-start-display">${formatDateTime(startDate)}</span></p>
            <p><strong>Fin:</strong> <span class="graffiti-end-display">${formatDateTime(endDate)}</span></p>
            <p class="countdown" id="countdown-${territoryId}-${graffiti.id}"></p>
            <div class="edit-graffiti-start-time-wrapper" style="display:none;">
                <label for="editStartTime-${territoryId}-${graffiti.id}">Modificar:</label>
                <input type="datetime-local" id="editStartTime-${territoryId}-${graffiti.id}" value="${formatDateTimeLocal(startDate)}">
            </div>
            <div class="graffiti-actions" id="graffiti-actions-${territoryId}-${graffiti.id}">
                <button class="edit-btn" onclick="editGraffitiStartTime('${territoryId}', '${graffiti.id}', this)" title="Modificar">
                    <i class="fa-solid fa-gear"></i>
                </button>
                <button class="delete-btn" onclick="deleteGraffiti('${territoryId}', '${graffiti.id}')" title="Eliminar">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="edit-graffiti-actions" id="edit-graffiti-actions-${territoryId}-${graffiti.id}" style="display:none;">
                <button class="save-btn" onclick="saveGraffitiStartTime('${territoryId}', '${graffiti.id}', this)">Guardar</button>
                <button class="cancel-btn" onclick="cancelGraffitiEdit('${territoryId}', '${graffiti.id}', this)">Cancelar</button>
            </div>
        `;
        graffitiList.appendChild(graffitiItem);
    });

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
        if (!supabase) {
            alert('Error: Supabase no está inicializado.');
            return;
        }
        const { data, error } = await supabase
            .from('territories')
            .insert([{ name: name }])
            .select();

        if (error) {
            alert('Error al agregar territorio: ' + error.message);
            if (error.code === '23505') {
                alert('Ya existe un territorio con ese nombre. Por favor, elige otro.');
            }
            return;
        }

        newTerritoryNameInput.value = '';
        await renderTerritories();
    } else {
        alert('Por favor, ingresa un nombre para el territorio.');
    }
}

async function deleteTerritory(territoryId) {
    const territoryToDelete = territories.find(t => t.id === territoryId);
    if (!territoryToDelete) return;

    if (confirm(`¿Estás seguro de que quieres eliminar el territorio "${territoryToDelete.name}" y todos sus grafitis?`)) {
        if (!supabase) {
            alert('Error: Supabase no está inicializado.');
            return;
        }
        const { error } = await supabase
            .from('territories')
            .delete()
            .eq('id', territoryId);

        if (error) {
            alert('Error al eliminar territorio: ' + error.message);
            return;
        }

        await renderTerritories();
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
            alert('Error: Supabase no está inicializado.');
            return;
        }
        const { error } = await supabase
            .from('territories')
            .update({ name: newName })
            .eq('id', territoryId);

        if (error) {
            alert('Error al actualizar nombre del territorio: ' + error.message);
            if (error.code === '23505') {
                alert('Ya existe un territorio con ese nombre. Por favor, elige otro.');
            }
            return;
        }
        await renderTerritories();
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
        const durationHours = globalGraffitiDuration;
        if (isNaN(durationHours) || durationHours <= 0) {
            alert('La duración del grafiti no es válida. Por favor, corrígela en la configuración global.');
            return;
        }

        const startTime = getArgentineTime();
        const endTime = new Date(startTime.getTime() + durationHours * 60 * 60 * 1000);

        if (!supabase) {
            alert('Error: Supabase no está inicializado.');
            return;
        }
        const { data, error } = await supabase
            .from('graffitis')
            .insert([{
                territory_id: territoryId,
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString()
            }])
            .select();

        if (error) {
            alert('Error al agregar grafiti: ' + error.message);
            return;
        }
        await renderTerritories();
    } else {
        alert('Este territorio ya tiene el máximo de 3 grafitis activos.');
    }
}

async function deleteGraffiti(territoryId, graffitiId) {
    if (confirm('¿Estás seguro de que quieres eliminar este grafiti?')) {
        if (!supabase) {
            alert('Error: Supabase no está inicializado.');
            return;
        }
        const { error } = await supabase
            .from('graffitis')
            .delete()
            .eq('id', graffitiId);

        if (error) {
            alert('Error al eliminar grafiti: ' + error.message);
            return;
        }
        await renderTerritories();
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

    const durationHours = globalGraffitiDuration;
    if (isNaN(durationHours) || durationHours <= 0) {
        alert('La duración del grafiti no es válida. Por favor, corrígela en la configuración global.');
        return;
    }

    const newStartDate = new Date(newStartTimeString);
    const newEndTime = new Date(newStartDate.getTime() + durationHours * 60 * 60 * 1000);

    if (!supabase) {
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
        alert('Error al actualizar hora de inicio del grafiti: ' + error.message);
        return;
    }
    await renderTerritories();
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
    const input = document.getElementById('graffitiDuration');
    const newDuration = parseInt(input ? input.value : globalGraffitiDuration);

    if (isNaN(newDuration) || newDuration <= 0) {
        alert('Por favor, ingresa una duración válida (en horas).');
        if (input) input.value = globalGraffitiDuration;
        return;
    }

    if (newDuration !== globalGraffitiDuration) {
        globalGraffitiDuration = newDuration;

        const saveResult = await saveGlobalGraffitiDuration(globalGraffitiDuration);
        if (!saveResult.success) {
            console.error('No se pudo guardar la duración global:', saveResult.error);
            alert('Error al guardar la duración global en la base de datos. Revisa la consola para más detalles.');
            const inputEl = document.getElementById('graffitiDuration');
            if (inputEl) inputEl.value = globalGraffitiDuration;
            return;
        }
    }

    const updates = [];
    territories.forEach(territory => {
        territory.graffitis.forEach(graffiti => {
            const startTime = new Date(graffiti.start_time);
            const newEndTime = new Date(startTime.getTime() + globalGraffitiDuration * 60 * 60 * 1000).toISOString();
            if (graffiti.end_time !== newEndTime) {
                updates.push({ id: graffiti.id, end_time: newEndTime });
            }
        });
    });

    if (updates.length > 0) {
        if (!supabase) {
            alert('Error: Supabase no está inicializado.');
            return;
        }
        for (const updateItem of updates) {
            const { error } = await supabase
                .from('graffitis')
                .update({ end_time: updateItem.end_time })
                .eq('id', updateItem.id);

            if (error) {
                console.error(`Error updating graffiti ${updateItem.id}:`, error.message || error);
            }
        }
    }

    await renderTerritories();
}


function updateCountdowns() {
    if (territoriesListDiv && territoriesListDiv.offsetParent !== null) {
        territories.forEach((territory) => {
            territory.graffitis.forEach((graffiti) => {
                const countdownElement = document.getElementById(`countdown-${territory.id}-${graffiti.id}`);
                const graffitiItemDiv = document.querySelector(`.graffiti-item[data-id="${graffiti.id}"]`);
                const endTimeDisplayElement = graffitiItemDiv ? graffitiItemDiv.querySelector('.graffiti-end-display') : null;

                if (!countdownElement || !graffitiItemDiv || !endTimeDisplayElement) return;

                const endTime = new Date(graffiti.end_time);
                const now = getArgentineTime();
                const timeLeft = endTime.getTime() - now.getTime();

                endTimeDisplayElement.textContent = formatDateTime(endTime);

                if (timeLeft <= 0) {
                    countdownElement.textContent = '¡Tiempo agotado!';
                    countdownElement.classList.add('red');
                    graffitiItemDiv.style.backgroundColor = '#5C1C1C';
                    graffitiItemDiv.style.borderColor = 'var(--danger-color)';
                    return;
                } else {
                    graffitiItemDiv.style.backgroundColor = '';
                    graffitiItemDiv.style.borderColor = '';
                }

                const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

                countdownElement.textContent = `Faltan: ${days}d ${hours}h ${minutes}m ${seconds}s`;

                if (timeLeft < (24 * 60 * 60 * 1000)) {
                    countdownElement.classList.add('red');
                } else {
                    countdownElement.classList.remove('red');
                }
            });
        });
    }
}


function updateCurrentDateTime() {
    if (currentDateTimeSpan && currentDateTimeSpan.offsetParent !== null) {
        const now = getArgentineTime();
        currentDateTimeSpan.textContent = `Hora de Argentina: ${formatDateTime(now)}`;
    }
}


function updateSidebarStats() {
    if (!sidebarContainer || sidebarContainer.offsetParent === null) return;

    let activeTerritories = new Set();
    let activeGraffitis = 0;
    let expiredGraffitis = 0;
    const now = getArgentineTime();

    territories.forEach(territory => {
        let territoryHasActiveGraffiti = false;
        territory.graffitis.forEach(graffiti => {
            const endTime = new Date(graffiti.end_time);
            if (endTime.getTime() > now.getTime()) {
                activeGraffitis++;
                territoryHasActiveGraffiti = true;
            } else {
                expiredGraffitis++;
            }
        });
        if (territoryHasActiveGraffiti) {
            activeTerritories.add(territory.id);
        }
    });

    activeTerritoriesCountSpan.textContent = activeTerritories.size;
    activeGraffitisCountSpan.textContent = activeGraffitis;
    expiredGraffitisCountSpan.textContent = expiredGraffitis;
}

function updateUpcomingGraffitis() {
    if (!sidebarContainer || sidebarContainer.offsetParent === null) return;

    upcomingGraffitisListUl.innerHTML = '';
    const now = getArgentineTime();
    const allGraffitis = [];

    territories.forEach(territory => {
        territory.graffitis.forEach(graffiti => {
            const endTime = new Date(graffiti.end_time);
            if (endTime.getTime() > now.getTime()) {
                allGraffitis.push({
                    territoryName: territory.name,
                    endTime: endTime,
                    graffitiId: graffiti.id
                });
            }
        });
    });

    allGraffitis.sort((a, b) => a.endTime.getTime() - b.endTime.getTime());

    allGraffitis.slice(0, 5).forEach(g => {
        const timeLeft = g.endTime.getTime() - now.getTime();
        const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        
        const listItem = document.createElement('li');
        listItem.className = 'upcoming-graffiti-item';
        listItem.innerHTML = `
            <strong>${g.territoryName}:</strong> ${days}d ${hours}h ${minutes}m
        `;
        upcomingGraffitisListUl.appendChild(listItem);
    });

    if (allGraffitis.length === 0) {
        const listItem = document.createElement('li');
        listItem.textContent = 'No hay grafitis próximos a vencer.';
        upcomingGraffitisListUl.appendChild(listItem);
    }
}

function copyUpcomingGraffitisToClipboard() {
    let textToCopy = "Próximos grafitis a vencer (CMK):\n\n";
    const upcomingItems = upcomingGraffitisListUl.querySelectorAll('.upcoming-graffiti-item');

    if (upcomingItems.length === 0 || (upcomingItems.length === 1 && upcomingItems[0].textContent === 'No hay grafitis próximos a vencer.')) {
        textToCopy = "No hay grafitis próximos a vencer actualmente.";
    } else {
        upcomingItems.forEach(item => {
            textToCopy += `- ${item.textContent.replace(':', ' vence en:')}\n`;
        });
    }

    navigator.clipboard.writeText(textToCopy).then(() => {
        alert('Lista de próximos grafitis copiada al portapapeles.');
    }).catch(err => {
        console.error('Error al copiar al portapapeles:', err);
        alert('Error al copiar la lista.');
    });
}


async function fetchChatMessages() {
    if (!supabase) {
        return [];
    }

    const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        console.error('Error fetching chat messages:', error.message);
        return [];
    }

    return data.reverse();
}

function renderChatMessages(messages) {
    chatMessagesDiv.innerHTML = '';
    messages.forEach(msg => {
        const messageItem = document.createElement('div');
        messageItem.className = 'chat-message-item';
        const formattedTime = formatDateTime(new Date(msg.created_at));
        messageItem.innerHTML = `
            <span class="message-meta"><strong>${msg.user_name}</strong> - ${formattedTime}</span>
            <span class="message-text">${msg.message_content}</span>
        `;
        chatMessagesDiv.appendChild(messageItem);
    });
    chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
}

async function sendChatMessage() {
    const userName = chatUserNameInput.value.trim();
    const messageContent = chatMessageInput.value.trim();

    if (!userName || !messageContent) {
        alert('Por favor, ingresa tu nombre y un mensaje.');
        return;
    }

    if (!supabase) {
        alert('Error: Supabase no está inicializado.');
        return;
    }

    const { data, error } = await supabase
        .from('chat_messages')
        .insert([
            { user_name: userName, message_content: messageContent }
        ])
        .select();

    if (error) {
        alert('Error al enviar mensaje: ' + error.message);
        return;
    }

    chatMessageInput.value = '';
    await refreshChat();
}

async function refreshChat() {
    const messages = await fetchChatMessages();
    renderChatMessages(messages);
}

async function cleanOldChatMessages() {
    if (!supabase) {
        return;
    }

    const { count, error } = await supabase
        .from('chat_messages')
        .select('id', { count: 'exact' });

    if (error) {
        console.error('Error counting chat messages:', error.message);
        return;
    }

    if (count > 50) {
        const { data: latestMessages, error: fetchError } = await supabase
            .from('chat_messages')
            .select('id')
            .order('created_at', { ascending: false })
            .limit(50);

        if (fetchError) {
            console.error('Error fetching latest chat messages:', fetchError.message);
            return;
        }

        const latestIds = latestMessages.map(msg => msg.id);

        const { error: deleteError } = await supabase
            .from('chat_messages')
            .delete()
            .not('id', 'in', `(${latestIds.join(',')})`);

        if (deleteError) {
            console.error('Error deleting old chat messages:', deleteError.message);
        } else {
            console.log(`Cleaned ${count - 50} old chat messages.`);
        }
    }
}


async function initializeApp() {
    if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
  	  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
	} else {
  	  alert("Error: La librería de Supabase no se ha cargado correctamente. Intenta recargar la página.");
  	  return;
    }


    await fetchGlobalGraffitiDuration();
    await renderTerritories();
    updateCountdowns();
    updateCurrentDateTime();
    updateSidebarStats();
    updateUpcomingGraffitis();

    await refreshChat();
    const storedUserName = localStorage.getItem('cmk_chat_user_name');
    if (storedUserName) {
        chatUserNameInput.value = storedUserName;
    }

    sendChatMessageBtn.addEventListener('click', sendChatMessage);
    chatMessageInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    });
    chatUserNameInput.addEventListener('change', (e) => {
        localStorage.setItem('cmk_chat_user_name', e.target.value.trim());
    });

    if (!window.countdownInterval) {
        window.countdownInterval = setInterval(updateCountdowns, 1000);
    }
    if (!window.dateTimeInterval) {
        window.dateTimeInterval = setInterval(updateCurrentDateTime, 1000);
    }

    if (!window.sidebarUpdateInterval) {
        window.sidebarUpdateInterval = setInterval(() => {
            updateSidebarStats();
            updateUpcomingGraffitis();
        }, 10000);
    }

    if (!window.chatUpdateInterval) {
        window.chatUpdateInterval = setInterval(async () => {
            await refreshChat();
            await cleanOldChatMessages();
        }, 30000);
    }

    graffitiDurationInput.addEventListener('change', updateAllGraffitiEndTimes);
    
    copyUpcomingBtn.addEventListener('click', copyUpcomingGraffitisToClipboard);
}

window.initializeApp = initializeApp;