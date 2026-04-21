// State Management
let state = {
    apps: JSON.parse(localStorage.getItem('nexus_v2_apps')) || [],
    categories: JSON.parse(localStorage.getItem('nexus_v2_cats')) || ['Works', 'Google', 'AI Tools', 'Entertainment', 'Education', 'Tools']
};

const mainGrid = document.getElementById('mainGrid');
const favGrid = document.getElementById('favoritesSection');
const appSearch = document.getElementById('appSearch');
const searchOverlay = document.getElementById('searchOverlay');

// --- RENDER FUNCTIONS ---

function render() {
    const searchTerm = appSearch.value.toLowerCase();
    mainGrid.innerHTML = '';
    favGrid.innerHTML = '';

    // 1. Favorites (Only show if not searching)
    if (searchTerm === '') {
        const favorites = state.apps.filter(app => app.favorite);
        favorites.forEach(app => favGrid.appendChild(createAppElement(app)));
    }

    // 2. Folders
    state.categories.forEach(cat => {
        const catApps = state.apps.filter(app => app.category === cat && app.name.toLowerCase().includes(searchTerm));
        if (catApps.length > 0) {
            mainGrid.appendChild(createFolderElement(cat, catApps));
        }
    });

    // 3. Uncategorized
    const uncategorized = state.apps.filter(app => 
        (app.category === 'uncategorized' || !state.categories.includes(app.category)) &&
        app.name.toLowerCase().includes(searchTerm)
    );
    uncategorized.forEach(app => mainGrid.appendChild(createAppElement(app)));

    save();
}

function createAppElement(app) {
    const div = document.createElement('div');
    div.className = 'app-item';
    const iconUrl = `https://www.google.com/s2/favicons?domain=${app.url}&sz=128`;

    div.innerHTML = `
        <div class="app-controls">
            <button onclick="editApp('${app.id}', event)"><i class="fa-solid fa-edit"></i></button>
            <button onclick="deleteApp('${app.id}', event)"><i class="fa-solid fa-trash"></i></button>
        </div>
        <div class="app-icon" style="background: ${stringToColor(app.name)}">
            <img src="${iconUrl}" onerror="this.parentElement.innerHTML='<i class=\'fa-solid fa-globe\'></i>'">
        </div>
        <div class="app-label">${app.name}</div>
    `;

    div.onclick = (e) => {
        if (!e.target.closest('.app-controls')) {
            window.open(app.url, '_blank');
            closeSearch();
        }
    };
    return div;
}

function createFolderElement(title, apps) {
    const wrapper = document.createElement('div');
    wrapper.className = 'folder-wrapper';

    wrapper.innerHTML = `
        <div class="folder-card">
            <div class="folder-preview">
                <div class="mini-dot"></div><div class="mini-dot"></div>
                <div class="mini-dot"></div><div class="mini-dot"></div>
            </div>
            <h4>${title}</h4>
            <small style="color:var(--text-dim)">${apps.length} items</small>
        </div>
        <div class="folder-expanded"></div>
    `;

    const expansion = wrapper.querySelector('.folder-expanded');
    apps.forEach(app => expansion.appendChild(createAppElement(app)));

    return wrapper;
}

// --- CORE LOGIC ---

function save() {
    localStorage.setItem('nexus_v2_apps', JSON.stringify(state.apps));
    localStorage.setItem('nexus_v2_cats', JSON.stringify(state.categories));
}

function closeModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
    document.getElementById('appForm').reset();
    document.getElementById('editId').value = '';
}

// --- SEARCH OVERLAY LOGIC ---
function openSearch() {
    searchOverlay.style.display = 'flex';
    appSearch.focus();
}

function closeSearch() {
    searchOverlay.style.display = 'none';
    appSearch.value = '';
    render();
}

document.getElementById('openSearchBtn').onclick = openSearch;

// Close search on ESC
window.onkeydown = (e) => {
    if (e.key === "Escape") closeSearch();
    if (e.altKey && e.key === "s") openSearch();
};

// Close search on clicking outside modal
searchOverlay.onclick = (e) => {
    if (e.target === searchOverlay) closeSearch();
};

appSearch.oninput = render;

// --- ACTIONS ---

document.getElementById('addAppBtn').onclick = () => {
    const select = document.getElementById('appCategory');
    select.innerHTML = '<option value="uncategorized">Uncategorized</option>' + 
        state.categories.map(c => `<option value="${c}">${c}</option>`).join('');
    document.getElementById('appModal').style.display = 'flex';
};

document.getElementById('manageFoldersBtn').onclick = () => {
    updateFolderListUI();
    document.getElementById('folderModal').style.display = 'flex';
};

document.getElementById('closeFolderModal').onclick = closeModals;

document.getElementById('createNewFolder').onclick = () => {
    const name = document.getElementById('newFolderName').value.trim();
    if(name && !state.categories.includes(name)) {
        state.categories.push(name);
        document.getElementById('newFolderName').value = '';
        updateFolderListUI();
        render();
    }
};

function updateFolderListUI() {
    const list = document.getElementById('folderList');
    list.innerHTML = state.categories.map(c => `
        <div class="folder-edit-item">
            <span>${c}</span>
            <button onclick="removeCategory('${c}')" style="background:none; border:none; color:#ff4444; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
        </div>
    `).join('');
}

window.removeCategory = (cat) => {
    state.categories = state.categories.filter(c => c !== cat);
    updateFolderListUI();
    render();
};

document.getElementById('appForm').onsubmit = (e) => {
    e.preventDefault();
    const id = document.getElementById('editId').value || Date.now().toString();
    const newApp = {
        id,
        name: document.getElementById('appName').value,
        url: document.getElementById('appUrl').value,
        category: document.getElementById('appCategory').value,
        favorite: document.getElementById('appFavorite').checked
    };

    const idx = state.apps.findIndex(a => a.id === id);
    if(idx > -1) state.apps[idx] = newApp;
    else state.apps.push(newApp);

    closeModals();
    render();
};

window.deleteApp = (id, e) => {
    e.stopPropagation();
    if(confirm("Delete this shortcut?")) {
        state.apps = state.apps.filter(a => a.id !== id);
        render();
    }
};

window.editApp = (id, e) => {
    e.stopPropagation();
    const app = state.apps.find(a => a.id === id);
    document.getElementById('editId').value = app.id;
    document.getElementById('appName').value = app.name;
    document.getElementById('appUrl').value = app.url;
    document.getElementById('appFavorite').checked = app.favorite;
    document.getElementById('addAppBtn').click(); 
    document.getElementById('appCategory').value = app.category;
};

// --- IMPORT/EXPORT ---

document.getElementById('exportBtn').onclick = () => {
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
};

document.getElementById('importBtn').onclick = () => document.getElementById('importFile').click();

document.getElementById('importFile').onchange = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
        state = JSON.parse(event.target.result);
        save();
        render();
    };
    reader.readAsText(file);
};

function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${Math.abs(hash) % 360}, 40%, 35%)`;
}

render();