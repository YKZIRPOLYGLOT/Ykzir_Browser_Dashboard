// State
let state = {
    apps: JSON.parse(localStorage.getItem('ykzir_apps')) || [],
    categories: JSON.parse(localStorage.getItem('ykzir_cats')) || ['Works', 'Google', 'AI Tools'],
    stats: JSON.parse(localStorage.getItem('ykzir_stats')) || { clicks: {}, catViews: {} },
    currentTab: 'all'
};

// --- INITIALIZE ---
function init() {
    render();
    startTime();
}

function render() {
    const grid = document.getElementById('appGrid');
    const sideCats = document.getElementById('sidebarCategories');
    const statsView = document.getElementById('statsView');
    grid.innerHTML = '';
    sideCats.innerHTML = '';
    
    // Sidebar Categories
    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `nav-item ${state.currentTab === cat ? 'active' : ''}`;
        btn.innerHTML = `<i class="fa-solid fa-folder"></i> ${cat}`;
        btn.onclick = () => switchTab(cat);
        sideCats.appendChild(btn);
    });

    if (state.currentTab === 'stats') {
        grid.style.display = 'none';
        statsView.style.display = 'grid';
        renderStats();
    } else {
        grid.style.display = 'grid';
        statsView.style.display = 'none';
        renderApps();
    }
    save();
}

// --- APP RENDERING ---
function renderApps() {
    const grid = document.getElementById('appGrid');
    let filtered = state.apps;

    if (state.currentTab === 'fav') filtered = state.apps.filter(a => a.favorite);
    else if (state.currentTab !== 'all') filtered = state.apps.filter(a => a.category === state.currentTab);

    filtered.forEach(app => {
        const card = document.createElement('div');
        card.className = 'app-card';
        // Using high-res favicon service
        const iconUrl = `https://unavatar.io/google/${new URL(app.url).hostname}`;

        card.innerHTML = `
            <div class="app-icon-box">
                <img src="${iconUrl}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/1243/1243966.png'">
            </div>
            <div style="font-weight:600; text-align:center">${app.name}</div>
            <div style="font-size:0.7rem; color:var(--text-muted); margin-top:5px">${app.category}</div>
        `;
        
        card.onclick = () => trackClick(app);
        grid.appendChild(card);
    });
}

// --- STATS LOGIC ---
function trackClick(app) {
    state.stats.clicks[app.name] = (state.stats.clicks[app.name] || 0) + 1;
    state.stats.catViews[app.category] = (state.stats.catViews[app.category] || 0) + 1;
    save();
    window.open(app.url, '_blank');
}

function renderStats() {
    const view = document.getElementById('statsView');
    const topApp = Object.entries(state.stats.clicks).sort((a,b) => b[1]-a[1])[0] || ["None", 0];
    const topCat = Object.entries(state.stats.catViews).sort((a,b) => b[1]-a[1])[0] || ["None", 0];

    view.innerHTML = `
        <div class="stat-card">
            <h4>Most Used App</h4>
            <div class="stat-val">${topApp[0]}</div>
            <p>${topApp[1]} Clicks</p>
        </div>
        <div class="stat-card">
            <h4>Favorite Category</h4>
            <div class="stat-val">${topCat[0]}</div>
            <p>${topCat[1]} Interactions</p>
        </div>
    `;
}

// --- HELPERS ---
function switchTab(tab) {
    state.currentTab = tab;
    document.getElementById('currentTabTitle').innerText = tab.charAt(0).toUpperCase() + tab.slice(1);
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    render();
}

function save() {
    localStorage.setItem('ykzir_apps', JSON.stringify(state.apps));
    localStorage.setItem('ykzir_cats', JSON.stringify(state.categories));
    localStorage.setItem('ykzir_stats', JSON.stringify(state.stats));
}

function showModal(id) { 
    // Fill category select for app modal
    if(id === 'appModal') {
        const sel = document.getElementById('appCategory');
        sel.innerHTML = state.categories.map(c => `<option value="${c}">${c}</option>`).join('');
    }
    document.getElementById(id).style.display = 'flex'; 
}

function closeModals() { 
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none'); 
}

function startTime() {
    const today = new Date();
    document.getElementById('dateTime').innerText = today.toLocaleDateString() + ' ' + today.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    setTimeout(startTime, 1000);
}

// Export/Import
function exportData() {
    const data = JSON.stringify(state);
    const blob = new Blob([data], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'ykzir_backup.json';
    a.click();
}

function importData() { document.getElementById('importFile').click(); }
document.getElementById('importFile').onchange = (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
        const imported = JSON.parse(ev.target.result);
        state.apps = imported.apps;
        state.categories = imported.categories;
        render();
    };
    reader.readAsText(e.target.files[0]);
};

// New App Form
document.getElementById('appForm').onsubmit = (e) => {
    e.preventDefault();
    state.apps.push({
        id: Date.now(),
        name: document.getElementById('appName').value,
        url: document.getElementById('appUrl').value,
        category: document.getElementById('appCategory').value,
        favorite: document.getElementById('appFavorite').checked
    });
    closeModals();
    render();
};

init();