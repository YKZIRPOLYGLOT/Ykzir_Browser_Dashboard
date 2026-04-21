let data = JSON.parse(localStorage.getItem('yk_data')) || {
    apps: [],
    categories: ["Work", "Personal", "AI Tools"],
    theme: 'theme-midnight',
    folderColor: '#7367f0',
    folderStyle: 'classic',
    bgStyle: 'gradient',
    clicks: {}
};

const SECURE_KEY = "yoyota";

const folderPaths = {
    classic: "M10,30 Q10,20 20,20 L40,20 L50,30 L80,30 Q90,30 90,40 L90,80 Q90,90 80,90 L20,90 Q10,90 10,80 Z",
    hexagon: "M50,5 L90,25 L90,75 L50,95 L10,75 L10,25 Z",
    shield: "M10,10 L50,5 L90,10 L90,50 Q90,90 50,95 Q10,90 10,50 Z",
    gem: "M30,10 L70,10 L90,40 L50,90 L10,40 Z"
};

document.addEventListener('DOMContentLoaded', () => {
    applyVisuals();
    setupEvents();
    renderDashboard();
});

function setupEvents() {
    document.querySelectorAll('#sidebarNav li[data-view]').forEach(li => {
        li.onclick = () => {
            document.querySelectorAll('#sidebarNav li').forEach(el => el.classList.remove('active'));
            li.classList.add('active');
            showView(li.getAttribute('data-view'));
        };
    });

    document.getElementById('globalSearch').oninput = (e) => renderDashboard(e.target.value);
    document.getElementById('importTrigger').onclick = () => document.getElementById('importInput').click();
    document.getElementById('importInput').onchange = handleImport;
    
    window.onclick = (e) => {
        if (!e.target.closest('.item-actions')) {
            document.querySelectorAll('.dropdown-menu').forEach(d => d.classList.remove('show'));
        }
    };
}

function showView(id) {
    document.querySelectorAll('.view-panel').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${id}`).classList.add('active');
    document.getElementById('viewTitle').innerText = id.charAt(0).toUpperCase() + id.slice(1);
    
    if(id === 'dashboard') renderDashboard();
    if(id === 'statistics') renderStats();
    if(id === 'settings') syncSettingsUI();
    lucide.createIcons();
}

function renderDashboard(query = '') {
    const uncat = document.getElementById('uncategorized-container');
    const folders = document.getElementById('folder-container');
    if(!uncat || !folders) return;

    uncat.innerHTML = ''; folders.innerHTML = '';
    const q = query.toLowerCase();
    const filtered = data.apps.filter(a => a.name.toLowerCase().includes(q));

    filtered.filter(a => !a.category || !data.categories.includes(a.category)).forEach(app => {
        uncat.appendChild(createCard(app));
    });

    data.categories.forEach(cat => {
        const catApps = filtered.filter(a => a.category === cat);
        const folder = document.createElement('div');
        folder.className = 'modern-folder';
        const path = folderPaths[data.folderStyle] || folderPaths.classic;
        
        folder.innerHTML = `
            <div class="folder-icon-box">
                <svg class="folder-svg" viewBox="0 0 100 100"><path d="${path}" /></svg>
                <div>
                    <div style="font-weight:600; font-size:14px;">${cat}</div>
                    <div style="font-size:10px; opacity:0.5;">${catApps.length} shortcuts</div>
                </div>
                <div style="margin-left:auto; opacity:0.2;" onclick="deleteCat(event, '${cat}')"><i data-lucide="trash-2" size="14"></i></div>
            </div>
            <div class="folder-content">
                <div class="inner-grid"></div>
            </div>
        `;
        
        const innerGrid = folder.querySelector('.inner-grid');
        catApps.forEach(app => innerGrid.appendChild(createCard(app)));
        folders.appendChild(folder);
    });
    lucide.createIcons();
}

function createCard(app) {
    let domain = "google.com";
    try { domain = new URL(app.url).hostname; } catch(e) {}
    const icon = `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
        <div class="item-actions" onclick="toggleMenu(event, '${app.id}')">
            <i data-lucide="more-vertical" size="12"></i>
            <div id="drop-${app.id}" class="dropdown-menu">
                <div onclick="deleteApp(event, '${app.id}')" style="color:#ea5455">Delete</div>
                <div onclick="toggleFav(event, '${app.id}')">${app.favorite ? 'Unfavorite' : 'Favorite'}</div>
            </div>
        </div>
        <div onclick="openApp('${app.id}')">
            <div class="icon-box"><img src="${icon}" onerror="this.src='https://www.google.com/s2/favicons?sz=64&domain=google.com'"></div>
            <div style="font-size:10px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${app.name}</div>
        </div>
    `;
    return card;
}

function toggleMenu(e, id) {
    e.stopPropagation();
    const menu = document.getElementById(`drop-${id}`);
    const isVisible = menu.classList.contains('show');
    document.querySelectorAll('.dropdown-menu').forEach(d => d.classList.remove('show'));
    if(!isVisible) menu.classList.add('show');
}

function openApp(id) {
    const app = data.apps.find(a => a.id === id);
    if(app) {
        data.clicks[id] = (data.clicks[id] || 0) + 1;
        save();
        window.open(app.url, '_blank');
    }
}

function deleteApp(e, id) {
    e.stopPropagation();
    if(confirm("Hapus link?") && prompt("Pass:") === SECURE_KEY) {
        data.apps = data.apps.filter(a => a.id !== id);
        save(); renderDashboard();
    }
}

function deleteCat(e, name) {
    e.stopPropagation();
    if(confirm(`Hapus folder ${name}?`) && prompt("Pass:") === SECURE_KEY) {
        data.categories = data.categories.filter(c => c !== name);
        save(); renderDashboard();
    }
}

function resetEverything() {
    if(confirm("SEMUA DATA AKAN DIHAPUS!") && prompt("Ketik password:") === SECURE_KEY) {
        data = { apps: [], categories: ["Work", "AI Tools"], theme: 'theme-midnight', folderColor: '#7367f0', folderStyle: 'classic', bgStyle: 'gradient', clicks: {} };
        save(); location.reload();
    }
}

function openModal(id) {
    if(id === 'linkModal') {
        const sel = document.getElementById('linkCatSelect');
        sel.innerHTML = `<option value="">No Folder</option>` + data.categories.map(c => `<option value="${c}">${c}</option>`).join('');
    }
    document.getElementById(id).style.display = 'flex';
}

function closeModals() { document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none'); }

function saveLink() {
    const name = document.getElementById('linkName').value;
    const url = document.getElementById('linkUrl').value;
    const cat = document.getElementById('linkCatSelect').value;
    if(name && url) {
        data.apps.push({ id: 'a'+Date.now(), name, url, category: cat, favorite: false });
        save(); closeModals(); renderDashboard();
    }
}

function saveFolder() {
    const name = document.getElementById('folderName').value.trim();
    if(name && !data.categories.includes(name)) {
        data.categories.push(name);
        save(); closeModals(); renderDashboard();
    }
}

function applyVisuals() {
    document.body.className = data.theme + ' bg-' + data.bgStyle;
    document.documentElement.style.setProperty('--folder-color', data.folderColor);
}

function updateVisuals() {
    data.folderColor = document.getElementById('folderColorPicker').value;
    data.bgStyle = document.getElementById('bgStyleSelect').value;
    data.folderStyle = document.getElementById('folderStyleSelect').value;
    save(); applyVisuals(); renderDashboard();
}

function changeTheme(t) { data.theme = t; save(); applyVisuals(); }

function syncSettingsUI() {
    document.getElementById('themeSelect').value = data.theme;
    document.getElementById('folderColorPicker').value = data.folderColor;
    document.getElementById('bgStyleSelect').value = data.bgStyle;
    document.getElementById('folderStyleSelect').value = data.folderStyle;
}

function save() { localStorage.setItem('yk_data', JSON.stringify(data)); }

function renderStats() {
    document.getElementById('stat-totalApps').innerText = data.apps.length;
    document.getElementById('stat-totalCats').innerText = data.categories.length;
    document.getElementById('stat-totalClicks').innerText = Object.values(data.clicks).reduce((a,b)=>a+b,0);
}

function handleImport(e) {
    const reader = new FileReader();
    reader.onload = (ev) => {
        data = JSON.parse(ev.target.result);
        save(); location.reload();
    };
    reader.readAsText(e.target.files[0]);
}

function exportData() {
    const blob = new Blob([JSON.stringify(data)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'backup.json';
    a.click();
}