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
    setupSidebar();
    refreshCurrentView();

    document.getElementById('globalSearch').oninput = (e) => renderDashboard(e.target.value);
    document.getElementById('importTrigger').onclick = () => document.getElementById('importInput').click();
    document.getElementById('importInput').onchange = handleImport;
    
    window.onclick = (e) => {
        if (!e.target.closest('.item-actions')) {
            document.querySelectorAll('.dropdown-menu').forEach(d => d.classList.remove('show'));
        }
    };
});

function save() { localStorage.setItem('yk_data', JSON.stringify(data)); }

function setupSidebar() {
    document.querySelectorAll('#sidebarNav li[data-view]').forEach(li => {
        li.onclick = () => {
            document.querySelectorAll('#sidebarNav li').forEach(el => el.classList.remove('active'));
            li.classList.add('active');
            refreshCurrentView();
        };
    });
}

function refreshCurrentView() {
    const activeLi = document.querySelector('#sidebarNav li.active');
    if(!activeLi) return;
    const viewId = activeLi.getAttribute('data-view');
    
    document.querySelectorAll('.view-panel').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${viewId}`).classList.add('active');
    document.getElementById('viewTitle').innerText = viewId.charAt(0).toUpperCase() + viewId.slice(1);

    if(viewId === 'dashboard') renderDashboard();
    else if(viewId === 'categories') renderCategories();
    else if(viewId === 'statistics') renderStats();
    else if(viewId === 'settings') syncSettingsUI();
    lucide.createIcons();
}

function renderDashboard(query = '') {
    const uncat = document.getElementById('uncategorized-container');
    const folders = document.getElementById('folder-container');
    uncat.innerHTML = ''; folders.innerHTML = '';
    const q = query.toLowerCase();
    const filteredApps = data.apps.filter(a => a.name.toLowerCase().includes(q));

    filteredApps.filter(a => !a.category || !data.categories.includes(a.category)).forEach(app => uncat.appendChild(createAppCard(app)));

    data.categories.forEach(cat => {
        const catApps = filteredApps.filter(a => a.category === cat);
        const folderEl = document.createElement('div');
        folderEl.className = 'modern-folder';
        const path = folderPaths[data.folderStyle] || folderPaths.classic;
        folderEl.innerHTML = `
            <div class="folder-icon-box">
                <svg class="folder-svg" viewBox="0 0 100 100"><path d="${path}" /></svg>
                <div><div style="font-weight:600; font-size:14px;">${cat}</div><div style="font-size:10px; opacity:0.5;">${catApps.length} items</div></div>
            </div>
            <div class="folder-content"><div class="inner-grid"></div></div>`;
        const innerGrid = folderEl.querySelector('.inner-grid');
        catApps.forEach(app => innerGrid.appendChild(createAppCard(app)));
        folders.appendChild(folderEl);
    });
    lucide.createIcons();
}

function renderCategories() {
    const grid = document.getElementById('categoriesGrid');
    grid.innerHTML = '';
    data.categories.forEach(cat => {
        const card = document.createElement('div');
        card.className = 'cat-card';
        card.innerHTML = `<h3>${cat}</h3><p style="font-size:12px; margin:10px 0;">${data.apps.filter(a => a.category === cat).length} items</p>
            <button onclick="deleteCat(event, '${cat}')" style="color:#ea5455; background:none; border:1px solid #ea5455; padding:5px 10px; border-radius:5px; cursor:pointer;">Delete Folder</button>`;
        grid.appendChild(card);
    });
}

function createAppCard(app) {
    let domain = "google.com";
    try { domain = new URL(app.url).hostname; } catch(e) {}
    const icon = `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
        <div class="item-actions" onclick="toggleAppMenu(event, '${app.id}')">
            <i data-lucide="more-vertical" size="14"></i>
            <div id="drop-${app.id}" class="dropdown-menu">
                <div onclick="openEditModal(event, '${app.id}')">Edit Shortcut</div>
                <div onclick="deleteApp(event, '${app.id}')" style="color:#ea5455; border-top:1px solid var(--border)">Delete</div>
            </div>
        </div>
        <div onclick="launchApp('${app.id}')">
            <div class="icon-box"><img src="${icon}"></div>
            <div style="font-size:11px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${app.name}</div>
        </div>`;
    return card;
}

function launchApp(id) {
    const app = data.apps.find(a => a.id === id);
    if(app) { data.clicks[id] = (data.clicks[id] || 0) + 1; save(); window.open(app.url, '_blank'); }
}

function toggleAppMenu(e, id) {
    e.stopPropagation();
    const menu = document.getElementById(`drop-${id}`);
    const isVisible = menu.classList.contains('show');
    document.querySelectorAll('.dropdown-menu').forEach(d => d.classList.remove('show'));
    if(!isVisible) menu.classList.add('show');
}

function deleteApp(e, id) {
    e.stopPropagation();
    if(confirm("Hapus shortcut?") && prompt("Password:") === SECURE_KEY) {
        data.apps = data.apps.filter(a => a.id !== id);
        save(); refreshCurrentView();
    }
}

function deleteCat(e, name) {
    e.stopPropagation();
    if(confirm(`Hapus folder "${name}"?`) && prompt("Password:") === SECURE_KEY) {
        data.categories = data.categories.filter(c => c !== name);
        save(); refreshCurrentView();
    }
}

function renderStats() {
    const totalApps = data.apps.length;
    const totalClicks = Object.values(data.clicks).reduce((a, b) => a + b, 0);
    document.getElementById('stat-totalApps').innerText = totalApps;
    document.getElementById('stat-totalCats').innerText = data.categories.length;
    document.getElementById('stat-totalClicks').innerText = totalClicks;

    const topList = document.getElementById('top-apps-list');
    topList.innerHTML = '';
    [...data.apps].map(a => ({...a, count: data.clicks[a.id] || 0}))
        .sort((a,b) => b.count - a.count).slice(0, 5).forEach(a => {
            const div = document.createElement('div');
            div.className = 'stats-item';
            div.innerHTML = `<span class="stats-item-name">${a.name}</span><span class="stats-item-val">${a.count} clicks</span>`;
            topList.appendChild(div);
        });

    const distList = document.getElementById('cat-dist-list');
    distList.innerHTML = '';
    data.categories.forEach(cat => {
        const count = data.apps.filter(a => a.category === cat).length;
        const perc = totalApps > 0 ? (count / totalApps * 100).toFixed(0) : 0;
        const div = document.createElement('div');
        div.style.marginBottom = "10px";
        div.innerHTML = `<div style="display:flex; justify-content:space-between; font-size:11px;"><span>${cat}</span><span>${count} items</span></div>
            <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${perc}%"></div></div>`;
        distList.appendChild(div);
    });
}

function openModal(id) {
    if(id === 'linkModal') {
        const sel = document.getElementById('linkCatSelect');
        sel.innerHTML = `<option value="">Uncategorized</option>` + data.categories.map(c => `<option value="${c}">${c}</option>`).join('');
    }
    document.getElementById(id).style.display = 'flex';
}

function openEditModal(e, id) {
    e.stopPropagation();
    const app = data.apps.find(a => a.id === id);
    if(!app) return;
    document.querySelectorAll('.dropdown-menu').forEach(d => d.classList.remove('show'));
    document.getElementById('editLinkId').value = app.id;
    document.getElementById('editLinkName').value = app.name;
    document.getElementById('editLinkUrl').value = app.url;
    const sel = document.getElementById('editLinkCatSelect');
    sel.innerHTML = `<option value="">Uncategorized</option>` + data.categories.map(c => `<option value="${c}" ${app.category === c ? 'selected' : ''}>${c}</option>`).join('');
    document.getElementById('editLinkModal').style.display = 'flex';
}

function closeModals() { document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none'); }

function saveLink() {
    const name = document.getElementById('linkName').value;
    const url = document.getElementById('linkUrl').value;
    const cat = document.getElementById('linkCatSelect').value;
    if(name && url) { data.apps.push({ id: 'a'+Date.now(), name, url, category: cat }); save(); closeModals(); refreshCurrentView(); }
}

function updateLink() {
    const id = document.getElementById('editLinkId').value;
    const name = document.getElementById('editLinkName').value;
    const url = document.getElementById('editLinkUrl').value;
    const cat = document.getElementById('editLinkCatSelect').value;
    const idx = data.apps.findIndex(a => a.id === id);
    if(idx !== -1) { data.apps[idx] = {...data.apps[idx], name, url, category: cat}; save(); closeModals(); refreshCurrentView(); }
}

function saveFolder() {
    const name = document.getElementById('folderName').value.trim();
    if(name && !data.categories.includes(name)) { data.categories.push(name); save(); closeModals(); refreshCurrentView(); }
}

function applyVisuals() {
    document.body.className = data.theme + ' bg-' + data.bgStyle;
    document.documentElement.style.setProperty('--folder-color', data.folderColor);
}

function updateVisuals() {
    data.folderColor = document.getElementById('folderColorPicker').value;
    data.bgStyle = document.getElementById('bgStyleSelect').value;
    data.folderStyle = document.getElementById('folderStyleSelect').value;
    save(); applyVisuals(); refreshCurrentView();
}

function changeTheme(t) { data.theme = t; save(); applyVisuals(); }

function syncSettingsUI() {
    document.getElementById('themeSelect').value = data.theme;
    document.getElementById('folderColorPicker').value = data.folderColor;
    document.getElementById('bgStyleSelect').value = data.bgStyle;
    document.getElementById('folderStyleSelect').value = data.folderStyle;
}

function resetEverything() {
    if(confirm("HAPUS SEMUA?") && prompt("Konfirmasi Password:") === SECURE_KEY) { localStorage.removeItem('yk_data'); location.reload(); }
}

function handleImport(e) {
    const reader = new FileReader();
    reader.onload = (ev) => { try { data = {...data, ...JSON.parse(ev.target.result)}; save(); location.reload(); } catch(err) { alert("Invalid JSON"); } };
    reader.readAsText(e.target.files[0]);
}

function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `backup.json`;
    a.click();
}