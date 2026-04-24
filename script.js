let data = JSON.parse(localStorage.getItem('yk_data')) || {
    apps: [],
    categories: [{
            id: "c1",
            name: "ꦏꦼꦂꦗ",
            parent: null
        },
        {
            id: "c2",
            name: "ꦲꦶꦧꦸꦫꦤ꧀",
            parent: null
        },
        {
            id: "c3",
            name: "ꦏꦮꦿꦸꦃ",
            parent: null
        },
        {
            id: "c4",
            name: "ЧхатГПТ",
            parent: null
        },
        {
            id: "c5",
            name: "Гемини",
            parent: null
        }
    ],
    theme: 'theme-gold', // Set default to Gold Leaf
    folderColor: '#d4af37', // Set default Folder color to Gold
    folderStyle: 'classic', // Set default Folder icon to Classic
    bgStyle: 'mesh', // Set default Background to Mesh
    clicks: {}
};

/* --- 1. GLOBAL VARIABLES (Fixed Naming) --- */
let currentActiveId = null;
let currentActiveType = null;
let noteTimer = null;

// Use these names consistently throughout the script
let draggedId = null;
let draggedType = null;

let lightningInterval = null;
let isEnergized = false;

const SECURE_KEY = "yoyota";
const folderPaths = {
    classic: "M10,30 Q10,20 20,20 L40,20 L50,30 L80,30 Q90,30 90,40 L90,80 Q90,90 80,90 L20,90 Q10,90 10,80 Z",
    hexagon: "M50,5 L90,25 L90,75 L50,95 L10,75 L10,25 Z",
    shield: "M10,10 L50,5 L90,10 L90,50 Q90,90 50,95 Q10,90 10,50 Z",
    gem: "M30,10 L70,10 L90,40 L50,90 L10,40 Z"
};

let currentOpenFolderId = null;
let backStack = [],
    forwardStack = [];
let draggedItemId = null,
    draggedItemType = null;

let currentEditingId = null;
let tempIconBase64 = null;

// This variable should be at the top of your script.js
let notesEnabled = localStorage.getItem('notesEnabled') !== 'false';

function toggleHoverNotes() {
    const toggle = document.getElementById('noteToggle');
    const body = document.body;

    // Flip the state
    notesEnabled = !notesEnabled;
    
    // 1. Update Visuals
    toggle.classList.toggle('active', notesEnabled);
    body.classList.toggle('notes-disabled', !notesEnabled);
    
    // 2. SAVE STATE: This is the part that remembers after refresh
    localStorage.setItem('notesEnabled', notesEnabled);

    // 3. Immediate Action: Hide current note if turning off
    if (!notesEnabled) {
        const hoverNote = document.getElementById('hoverNote');
        if (hoverNote) hoverNote.style.display = 'none';
    }
}

// REPLACE your old listener with this one:
document.getElementById('icon-file-input').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (event) {
            const img = new Image();
            img.src = event.target.result;
            img.onload = function () {
                // 1. Create a tiny hidden canvas
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // 2. Set dimensions to standard icon size (64x64)
                canvas.width = 64;
                canvas.height = 64;

                // 3. Draw and resize the image onto the canvas
                ctx.drawImage(img, 0, 0, 64, 64);

                // 4. Export as a tiny, compressed string
                // 0.7 is the quality (70%), which is perfect for icons
                tempIconBase64 = canvas.toDataURL('image/jpeg', 0.7);

                // 5. Update the preview so you can see it
                document.getElementById('edit-icon-preview').src = tempIconBase64;

                console.log("Icon compressed and ready for storage!");
            };
        };
        reader.readAsDataURL(file);
    }
});

// 2. Open the Edit Menu
function openEditMenu(id) {
    currentEditingId = id;
    const app = data.apps.find(a => a.id === id);

    document.getElementById('edit-app-name').value = app.name;
    // Set preview to current icon (or default)
    document.getElementById('edit-icon-preview').src = app.icon || 'default-icon.png';
    tempIconBase64 = app.icon; // Store existing icon in case they don't change it

    document.getElementById('edit-modal').style.display = 'block';
}

// 3. Save Changes back to LocalStorage
function saveAppChanges() {
    const appIndex = data.apps.findIndex(a => a.id === currentEditingId);
    if (appIndex !== -1) {
        data.apps[appIndex].name = document.getElementById('edit-app-name').value;
        data.apps[appIndex].icon = tempIconBase64; // Save the new Base64 icon

        saveData(); // Your existing function to save to localStorage
        renderApps(); // Refresh the dashboard
        closeModal();
    }
}

function closeEditModal() {
    document.getElementById('edit-modal').style.display = 'none';
}

// Ensure clicking outside the box closes it too
window.onclick = function (event) {
    const modal = document.getElementById('edit-modal');
    if (event.target == modal) {
        closeEditModal();
    }
}


/* --- 2. DOM CONTENT LOADED (Fixed Logic) --- */
document.addEventListener('DOMContentLoaded', () => {
    applyVisuals();
    setupSidebar();
    refreshCurrentView();

    const savedState = localStorage.getItem('notesEnabled');
    notesEnabled = (savedState !== 'false');

    // 2. Get the elements
    const toggle = document.getElementById('noteToggle');
    const body = document.body;

    // 3. Apply the state to the UI so it looks correct on start
    if (!notesEnabled) {
        body.classList.add('notes-disabled');
        if (toggle) toggle.classList.remove('active');
    } else {
        body.classList.remove('notes-disabled');
        if (toggle) toggle.classList.add('active');
    }

    const globalSearch = document.getElementById('globalSearch');
    if (globalSearch) globalSearch.oninput = (e) => renderDashboard(e.target.value);

    const importTrigger = document.getElementById('importTrigger');
    const importInput = document.getElementById('importInput');
    if (importTrigger && importInput) {
        importTrigger.onclick = () => importInput.click();
        importInput.onchange = handleImport;
    }

    // Global Drag for Links
    window.addEventListener('dragenter', (e) => {
        if (e.dataTransfer.types.includes('text/uri-list') || e.dataTransfer.types.includes('text/plain')) {
            openModal('linkModal');
        }
    });

    // --- REORDERING CONTAINER LOGIC ---
    const uncatContainer = document.getElementById('uncategorized-container');
    if (uncatContainer) {
        uncatContainer.ondragover = (e) => e.preventDefault();
        uncatContainer.ondrop = (e) => {
            // If dropped on the empty space of the container, move to the end
            if (draggedType === 'app' && e.target === uncatContainer) {
                const fromIndex = data.apps.findIndex(a => a.id === draggedId);
                if (fromIndex !== -1) {
                    const [movedItem] = data.apps.splice(fromIndex, 1);
                    data.apps.push(movedItem);
                    save();
                    renderDashboard();
                }
            }
        };
    }

    dropZone.addEventListener('drop', (e) => {
        const rawUrl = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
        if (rawUrl) {
            const url = rawUrl.split('\n')[0].trim();
            if (url.startsWith('http')) {
                // 1. Fill the URL
                document.getElementById('linkUrl').value = url;

                // 2. Open the Modal first
                openModal('linkModal');

                // 3. Set the Category logic with a tiny timeout 
                // This ensures the dropdown options exist before we try to select one
                setTimeout(() => {
                    const select = document.getElementById('linkCatSelect');
                    if (typeof currentOpenFolderId !== 'undefined' && currentOpenFolderId && select) {
                        const currentFolder = data.categories.find(c => c.id === currentOpenFolderId);

                        if (currentFolder) {
                            // Loop through options to find the one matching the folder name
                            for (let i = 0; i < select.options.length; i++) {
                                if (select.options[i].text === currentFolder.name || select.options[i].value === currentFolder.name) {
                                    select.selectedIndex = i;
                                    break;
                                }
                            }
                        }
                    } else if (select) {
                        // Default to none if not in a folder
                        select.value = "";
                    }
                }, 10); // 10ms is enough to let the DOM update
            }
        }
    });


    // Hover Note Protection
    const noteEl = document.getElementById('hoverNote');
    if (noteEl) {
        noteEl.onmouseenter = () => clearTimeout(noteTimer);
        noteEl.onmouseleave = () => {
            noteEl.style.display = 'none';
        };
    }

    window.onclick = (e) => {
        if (!e.target.closest('.item-actions')) {
            document.querySelectorAll('.dropdown-menu').forEach(d => d.classList.remove('show'));
        }
    };
});


// Add this to your existing script
document.addEventListener('contextmenu', function (e) {
    // Check if we right-clicked an app shortcut
    const appElement = e.target.closest('.app-shortcut');
    if (appElement) {
        e.preventDefault(); // Stop the default browser menu
        const appId = appElement.getAttribute('data-id'); // Make sure your HTML has data-id
        openEditMenu(appId);
    }
});

function openEditMenu(id) {
    const modal = document.getElementById('edit-modal');
    if (!modal) return;

    currentEditingId = id;
    const app = data.apps.find(a => a.id === id);

    // Fill the fields
    document.getElementById('edit-app-name').value = app.name;
    document.getElementById('edit-icon-preview').src = app.icon || 'https://www.google.com/s2/favicons?sz=64&domain=' + new URL(app.url).hostname;

    // Show the modal
    modal.style.display = 'flex';
}



function save() {
    localStorage.setItem('yk_data', JSON.stringify(data));
}

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
    if (!activeLi) return;
    const viewId = activeLi.getAttribute('data-view');
    document.querySelectorAll('.view-panel').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${viewId}`).classList.add('active');
    document.getElementById('viewTitle').innerText = viewId.charAt(0).toUpperCase() + viewId.slice(1);
    if (viewId === 'dashboard') renderDashboard();
    else if (viewId === 'categories') renderCategories();
    else if (viewId === 'statistics') renderStats();
    else if (viewId === 'settings') syncSettingsUI();
    lucide.createIcons();
}

/* --- 3. REORDERING FUNCTIONS (Add this if missing) --- */
function handleReorder(targetAppId) {
    if (draggedType !== 'app' || draggedId === targetAppId) return;

    const fromIndex = data.apps.findIndex(a => a.id === draggedId);
    const toIndex = data.apps.findIndex(a => a.id === targetAppId);

    if (fromIndex !== -1 && toIndex !== -1) {
        const [movedItem] = data.apps.splice(fromIndex, 1);
        data.apps.splice(toIndex, 0, movedItem);
        save();
        renderDashboard();
    }
}

/* --- 4. DRAG HANDLERS (Corrected Variables) --- */
function handleDragStart(e, id, type) {
    draggedId = id; // Changed from draggedItemId
    draggedType = type; // Changed from draggedItemType
    e.target.classList.add('dragging');
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
}

function handleDragOver(e) {
    e.preventDefault();
    const target = e.target.closest('.modern-folder, .drop-zone, .folder-window, .drop-to-root-zone');
    if (target) target.classList.add('drag-over');
}

function handleDragLeave(e) {
    const target = e.target.closest('.modern-folder, .drop-zone, .folder-window, .drop-to-root-zone');
    if (target) target.classList.remove('drag-over');
}

/* --- FIXED DROP LOGIC --- */
function handleDropOnFolder(e, targetFolderId) {
    e.preventDefault();
    e.stopPropagation();
    handleDragEnd(e);

    // Updated to use draggedType and draggedId
    if (draggedType === 'app') {
        const app = data.apps.find(a => a.id === draggedId);
        const targetCat = data.categories.find(c => c.id === targetFolderId);
        if (app && targetCat) {
            app.category = targetCat.name;
            save();
            refreshCurrentView();
            if (currentOpenFolderId) openFolderWindow(currentOpenFolderId, true);
        }
    } else if (draggedType === 'folder' && draggedId !== targetFolderId) {
        const folder = data.categories.find(c => c.id === draggedId);
        if (folder) {
            folder.parent = targetFolderId;
            save();
            refreshCurrentView();
            if (currentOpenFolderId) openFolderWindow(currentOpenFolderId, true);
        }
    }
}

function handleDropToRoot(e) {
    e.preventDefault();
    e.stopPropagation();
    handleDragEnd(e);

    // Updated to use draggedType and draggedId
    if (draggedType === 'app') {
        const app = data.apps.find(a => a.id === draggedId);
        if (app) {
            app.category = null;
            save();
            refreshCurrentView();
            if (currentOpenFolderId) openFolderWindow(currentOpenFolderId, true);
        }
    } else if (draggedType === 'folder') {
        const folder = data.categories.find(c => c.id === draggedId);
        if (folder) {
            folder.parent = null;
            save();
            if (currentOpenFolderId === draggedId) closeFolderWindow();
            else {
                refreshCurrentView();
                if (currentOpenFolderId) openFolderWindow(currentOpenFolderId, true);
            }
        }
    }
}

function handleDropInWindow(e) {
    if (e.target.closest('.drop-to-root-zone')) return;
    if (currentOpenFolderId) handleDropOnFolder(e, currentOpenFolderId);
}


/* --- RENDERING WITH HOVER NOTES --- */
function renderDashboard(query = '') {
    const uncat = document.getElementById('uncategorized-container');
    const folders = document.getElementById('folder-container');
    uncat.innerHTML = '';
    folders.innerHTML = '';
    const q = query.toLowerCase();
    const filteredApps = data.apps.filter(a => a.name.toLowerCase().includes(q));
    const catNames = data.categories.map(c => c.name);

    // Render Uncategorized Apps
    filteredApps.filter(a => !a.category || !catNames.includes(a.category)).forEach(app => uncat.appendChild(createAppCard(app)));

    // Render Folders
    data.categories.filter(cat => !cat.parent).forEach(cat => {
        const folderEl = document.createElement('div');
        folderEl.className = 'modern-folder';
        folderEl.draggable = true;

        // --- HOVER NOTE LOGIC ---
        folderEl.onmouseenter = (e) => showNote(e, cat.id, 'folder');
        folderEl.onmouseleave = hideNote;

        folderEl.onclick = () => openFolderWindow(cat.id);
        folderEl.ondragstart = (e) => handleDragStart(e, cat.id, 'folder');
        folderEl.ondragend = handleDragEnd;
        folderEl.ondragover = handleDragOver;
        folderEl.ondragleave = handleDragLeave;
        folderEl.ondrop = (e) => handleDropOnFolder(e, cat.id);

        const path = folderPaths[data.folderStyle] || folderPaths.classic;
        const totalCount = data.apps.filter(a => a.category === cat.name).length + data.categories.filter(c => c.parent === cat.id).length;

        folderEl.innerHTML = `<div class="folder-icon-box"><svg class="folder-svg" viewBox="0 0 100 100"><path d="${path}" /></svg><div><div style="font-weight:600; font-size:14px;">${cat.name}</div><div style="font-size:10px; opacity:0.5;">${totalCount} items</div></div></div>`;
        folders.appendChild(folderEl);
    });
    lucide.createIcons();
}

function createAppCard(app) {
    let domain = "google.com";
    try {
        domain = new URL(app.url).hostname;
    } catch (e) {}

    // MODIFIED: Use app.icon if it exists (for your custom file explorer icons)
    const icon = app.icon || `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;

    const card = document.createElement('div');
    card.className = 'item-card';
    card.setAttribute('data-id', app.id); // ADDED: Critical for the right-click script
    card.draggable = true;

    // --- ADDED: RIGHT CLICK TRIGGER ---
    card.oncontextmenu = (e) => {
        e.preventDefault(); // Stop standard browser menu
        openEditMenu(app.id); // Triggers your new gold menu
    };

    // --- HOVER NOTE LOGIC ---
    card.onmouseenter = (e) => showNote(e, app.id, 'app');
    card.onmouseleave = hideNote;

    // --- DRAG START ---
    card.ondragstart = (e) => {
        handleDragStart(e, app.id, 'app');
    };

    // --- DRAG OVER ---
    card.ondragover = (e) => {
        e.preventDefault();
        card.style.transform = "scale(1.1)";
    };

    card.ondragleave = () => {
        card.style.transform = "scale(1)";
    };

    // --- THE DROP ---
    card.ondrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        card.style.transform = "scale(1)";
        handleReorder(app.id);
    };

    card.ondragend = handleDragEnd;

    // MODIFIED: Updated innerHTML to use the custom icon and added Edit to dropdown
    card.innerHTML = `
        <div class="item-actions" onclick="toggleAppMenu(event, '${app.id}')">
            <i data-lucide="more-vertical" size="14"></i>
            <div id="drop-${app.id}" class="dropdown-menu">
                <div onclick="openEditMenu('${app.id}')">Edit</div>
                <div onclick="deleteApp(event, '${app.id}')" style="color:#ea5455;">Delete</div>
            </div>
        </div>
        <div onclick="launchApp('${app.id}')">
            <div class="icon-box"><img src="${icon}"></div>
            <div style="font-size:11px; font-weight:600;">${app.name}</div>
        </div>`;

    return card;
}

function openFolderWindow(folderId, isNavigating = false) {
    const cat = data.categories.find(c => c.id === folderId);
    if (!cat) return;
    if (!isNavigating && currentOpenFolderId !== folderId) {
        if (currentOpenFolderId) backStack.push(currentOpenFolderId);
        forwardStack = [];
    }
    currentOpenFolderId = folderId;
    const overlay = document.getElementById('folderWindow');
    const grid = document.getElementById('windowFolderGrid');
    document.getElementById('windowTitleText').innerText = cat.name;
    grid.innerHTML = '';

    data.categories.filter(c => c.parent === folderId).forEach(sub => {
        const div = document.createElement('div');
        div.className = 'item-card';
        div.draggable = true;

        // --- HOVER NOTE LOGIC FOR SUB-FOLDERS ---
        div.onmouseenter = (e) => showNote(e, sub.id, 'folder');
        div.onmouseleave = hideNote;

        div.onclick = (e) => {
            e.stopPropagation();
            openFolderWindow(sub.id);
        };
        div.ondragstart = (e) => handleDragStart(e, sub.id, 'folder');
        div.ondragend = handleDragEnd;
        div.ondragover = handleDragOver;
        div.ondragleave = handleDragLeave;
        div.ondrop = (e) => handleDropOnFolder(e, sub.id);
        div.innerHTML = `<div class="icon-box"><i data-lucide="folder" style="color:var(--folder-color);"></i></div><div style="font-size:11px; font-weight:600;">${sub.name}</div>`;
        grid.appendChild(div);
    });

    data.apps.filter(a => a.category === cat.name).forEach(app => grid.appendChild(createAppCard(app)));
    updateNavButtons();
    overlay.classList.add('show');
    lucide.createIcons();
}

/* --- STATS & UTILS --- */
function renderStats() {
    const totalApps = data.apps.length;
    const totalClicks = Object.values(data.clicks).reduce((a, b) => a + b, 0);

    // Update summary counters
    document.getElementById('stat-totalApps').innerText = totalApps;
    document.getElementById('stat-totalCats').innerText = data.categories.length;
    document.getElementById('stat-totalClicks').innerText = totalClicks;

    // 1. Render Top 5 Most Used
    const topList = document.getElementById('top-apps-list');
    topList.innerHTML = '';
    [...data.apps].map(a => ({
            ...a,
            count: data.clicks[a.id] || 0
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .forEach(a => {
            const div = document.createElement('div');
            div.className = 'stats-item';
            div.innerHTML = `<span>${a.name}</span><span style="color:var(--accent); font-weight:bold;">${a.count}</span>`;
            topList.appendChild(div);
        });

    // 2. ADD THIS SECTION: Render Category Distribution
    const catDistList = document.getElementById('cat-dist-list');
    catDistList.innerHTML = ''; // Clear previous content

    data.categories.forEach(cat => {
        // Count how many apps are in this category
        const count = data.apps.filter(a => a.category === cat.name).length;

        // Calculate the percentage safely
        const percentage = totalApps > 0 ? Math.round((count / totalApps) * 100) : 0;

        const div = document.createElement('div');
        div.className = 'stats-item';
        div.innerHTML = `
            <span>${cat.name}</span>
            <div style="text-align: right;">
                <span style="font-weight:bold;">${count} items</span>
                <small style="display:block; opacity:0.5; font-size:10px;">${percentage}%</small>
            </div>
        `;
        catDistList.appendChild(div);
    });

    // Refresh icons if necessary
    if (window.lucide) lucide.createIcons();
}

function closeFolderWindow() {
    document.getElementById('folderWindow').classList.remove('show');
    currentOpenFolderId = null;
    backStack = [];
    forwardStack = [];
}

function windowHistoryBack() {
    if (backStack.length > 0) {
        forwardStack.push(currentOpenFolderId);
        openFolderWindow(backStack.pop(), true);
    }
}

function windowHistoryForward() {
    if (forwardStack.length > 0) {
        backStack.push(currentOpenFolderId);
        openFolderWindow(forwardStack.pop(), true);
    }
}

function updateNavButtons() {
    document.getElementById('windowBack').disabled = backStack.length === 0;
    document.getElementById('windowForward').disabled = forwardStack.length === 0;
}

function launchApp(id) {
    const app = data.apps.find(a => a.id === id);
    if (app) {
        data.clicks[id] = (data.clicks[id] || 0) + 1;
        save();
        window.open(app.url, '_blank');
    }
}

function toggleAppMenu(e, id) {
    e.stopPropagation();
    const menu = document.getElementById(`drop-${id}`);
    const isVisible = menu.classList.contains('show');
    document.querySelectorAll('.dropdown-menu').forEach(d => d.classList.remove('show'));
    if (!isVisible) menu.classList.add('show');
}

function deleteApp(e, id) {
    e.stopPropagation();
    if (confirm("Hapus shortcut?") && prompt("Password:") === SECURE_KEY) {
        data.apps = data.apps.filter(a => a.id !== id);
        save();
        refreshCurrentView();
        if (currentOpenFolderId) openFolderWindow(currentOpenFolderId, true);
    }
}
/* --- CATEGORY MANAGEMENT --- */

function renderCategories() {
    const grid = document.getElementById('categoriesGrid');
    if (!grid) return;
    grid.innerHTML = '';

    data.categories.forEach(cat => {
        const card = document.createElement('div');
        card.className = 'cat-card';

        // Find parent name if it exists
        const parent = data.categories.find(p => p.id === cat.parent);
        const parentName = parent ? parent.name : 'None';

        card.innerHTML = `
            <div>
                <h3>${cat.name}</h3>
                <p style="font-size:10px; color:#888;">Parent: ${parentName}</p>
            </div>
            <button onclick="deleteCat(event, '${cat.id}')" 
                    style="color:#ea5455; background:none; border:1px solid #ea5455; padding:5px 10px; border-radius:5px; cursor:pointer; margin-top:10px;">
                Delete
            </button>
        `;
        grid.appendChild(card);
    });
}

function deleteCat(e, id) {
    e.stopPropagation();

    // Security check using your key "yoyota"
    const pass = prompt("Enter Security Key to delete category:");
    if (pass !== SECURE_KEY) {
        alert("Incorrect Key!");
        return;
    }

    if (confirm("Are you sure? This will move items inside this category to Uncategorized.")) {
        // 1. Find the name of the category being deleted
        const catToDelete = data.categories.find(c => c.id === id);
        if (!catToDelete) return;

        // 2. Remove the category from the list
        data.categories = data.categories.filter(c => c.id !== id);

        // 3. Orphan handling: If any category had THIS as a parent, reset them to null
        data.categories.forEach(c => {
            if (c.parent === id) c.parent = null;
        });

        // 4. App handling: If any app was in this category name, reset it to null
        data.apps.forEach(app => {
            if (app.category === catToDelete.name) app.category = null;
        });

        save();
        refreshCurrentView();
    }
}

function deleteCat(e, id) {
    e.stopPropagation();
    if (confirm(`Hapus folder?`) && prompt("Password:") === SECURE_KEY) {
        data.categories = data.categories.filter(c => c.id !== id);
        data.categories.forEach(c => {
            if (c.parent === id) c.parent = null;
        });
        save();
        refreshCurrentView();
    }
}

function openModal(id) {
    if (id === 'linkModal') {
        document.getElementById('linkCatSelect').innerHTML = `<option value="">Uncategorized</option>` + data.categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    } else if (id === 'folderModal') {
        document.getElementById('folderParentSelect').innerHTML = `<option value="">None (Top Level)</option>` + data.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
    document.getElementById(id).style.display = 'flex';
}

function closeModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
}

function saveLink() {
    const name = document.getElementById('linkName').value.trim();
    const url = document.getElementById('linkUrl').value.trim();
    const cat = document.getElementById('linkCatSelect').value;

    if (name && url) {
        data.apps.push({
            id: 'a' + Date.now(),
            name: name,
            url: url,
            category: cat || null
        });

        save();

        // Reset inputs
        document.getElementById('linkName').value = '';
        document.getElementById('linkUrl').value = '';

        closeModals();

        // --- UI REFRESH LOGIC ---
        refreshCurrentView(); // Refreshes the main dashboard background

        // If a folder window is open, refresh its content specifically
        if (typeof currentOpenFolderId !== 'undefined' && currentOpenFolderId) {
            openFolderWindow(currentOpenFolderId, true);
        }
    } else {
        alert("Please enter both a name and a valid URL.");
    }
}

function saveFolder() {
    const name = document.getElementById('folderName').value.trim();
    const parentId = document.getElementById('folderParentSelect').value || null;

    if (name) {
        data.categories.push({
            id: 'c' + Date.now(),
            name,
            parent: parentId
        });

        save();
        closeModals();

        // --- UI REFRESH LOGIC ---
        refreshCurrentView(); // Update sidebar/main grid

        // If we just added a sub-folder while inside a parent folder, refresh the window
        if (typeof currentOpenFolderId !== 'undefined' && currentOpenFolderId) {
            openFolderWindow(currentOpenFolderId, true);
        }
    }
}

function openEditModal(e, id) {
    e.stopPropagation();
    const app = data.apps.find(a => a.id === id);
    if (!app) return;
    document.getElementById('editLinkId').value = app.id;
    document.getElementById('editLinkName').value = app.name;
    document.getElementById('editLinkUrl').value = app.url;
    document.getElementById('editLinkCatSelect').innerHTML = `<option value="">Uncategorized</option>` + data.categories.map(c => `<option value="${c.name}" ${app.category === c.name ? 'selected' : ''}>${c.name}</option>`).join('');
    document.getElementById('editLinkModal').style.display = 'flex';
}

function updateLink() {
    const id = document.getElementById('editLinkId').value;
    const idx = data.apps.findIndex(a => a.id === id);
    if (idx !== -1) {
        data.apps[idx] = {
            ...data.apps[idx],
            name: document.getElementById('editLinkName').value,
            url: document.getElementById('editLinkUrl').value,
            category: document.getElementById('editLinkCatSelect').value
        };
        save();
        closeModals();
        refreshCurrentView();
    }
}

function applyVisuals() {
    // Clean all possible background classes
    const bgClasses = ['style-solid', 'style-gradient', 'style-dots', 'style-mesh', 'style-cybergrid',
        'style-blueprint', 'style-topo', 'style-circuit', 'style-hex', 'style-scanline',
        'style-stardust', 'style-carbon', 'style-prism', 'style-glitch'
    ];
    document.body.classList.remove(...bgClasses);

    document.body.className = data.theme;
    document.body.classList.add(`style-${data.bgStyle}`);
    document.documentElement.style.setProperty('--folder-color', data.folderColor);
}

function updateVisuals() {
    data.folderColor = document.getElementById('folderColorPicker').value;
    data.bgStyle = document.getElementById('bgStyleSelect').value;
    data.folderStyle = document.getElementById('folderStyleSelect').value;
    save();
    applyVisuals();
    refreshCurrentView();
}

function changeTheme(t) {
    data.theme = t;
    save();
    applyVisuals();
}

function syncSettingsUI() {
    document.getElementById('themeSelect').value = data.theme;
    document.getElementById('folderColorPicker').value = data.folderColor;
    document.getElementById('bgStyleSelect').value = data.bgStyle;
    document.getElementById('folderStyleSelect').value = data.folderStyle;
}

function resetEverything() {
    if (confirm("HAPUS SEMUA?") && prompt("Password:") === SECURE_KEY) {
        localStorage.removeItem('yk_data');
        location.reload();
    }
}

/* --- REPLACING THE OLD handleImport --- */
function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const importedData = JSON.parse(ev.target.result);

            // Validation: Check if it's a valid yk_data file
            if (importedData.apps && importedData.categories) {
                // Completely overwrite the local data object to include everything
                data = importedData;

                // Save to localStorage
                save();

                // Success message and reload
                alert("Data successfully imported, Ustadz Rizky!");
                location.reload();
            } else {
                alert("Invalid format: Missing apps or categories.");
            }
        } catch (err) {
            alert("Error: The file is not a valid JSON.");
            console.error(err);
        }
    };
    reader.readAsText(file);
}

/* --- IMPROVED EXPORT FUNCTION --- */
function exportData() {
    // 1. Create a snapshot of the current state
    const backup = JSON.stringify(data, null, 2); // null, 2 makes the JSON readable

    // 2. Create a blob and a temporary download link
    const blob = new Blob([backup], {
        type: 'application/json'
    });
    const url = URL.createObjectURL(blob);

    // 3. Generate a filename with the current date (e.g., backup_2026-04-23.json)
    const date = new Date().toISOString().split('T')[0];
    const fileName = `yk_dashboard_backup_${date}.json`;

    // 4. Trigger the download
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();

    // 5. Cleanup
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log("Data exported successfully, Ustadz Rizky!");
}

function openImageModal() {
    const modal = document.getElementById('imageModal');
    if (!modal) return;

    // Show modal
    modal.style.display = 'flex';

    // Trigger the Screen-Wide Lightning
    modal.classList.add('lightning-flash');

    // Smooth fade in for content
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);

    // Stop the lightning effect after it finishes (0.6s)
    setTimeout(() => {
        modal.classList.remove('lightning-flash');
    }, 650);
}


function createLightning() {
    const container = document.getElementById('lightning-container');
    const frameElement = document.getElementById('mainFrame');
    const frameRect = frameElement.getBoundingClientRect();

    // Generate 1-3 bolts per interval for realism
    const boltCount = Math.floor(Math.random() * 3) + 1;

    for (let i = 0; i < boltCount; i++) {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("style", "position:absolute; top:0; left:0; width:100%; height:100%;");

        // Random Screen Edge Start
        const startX = Math.random() > 0.5 ? (Math.random() > 0.5 ? 0 : window.innerWidth) : Math.random() * window.innerWidth;
        const startY = Math.random() > 0.5 ? 0 : window.innerHeight;

        const targetX = frameRect.left + frameRect.width / 2;
        const targetY = frameRect.top + frameRect.height / 2;

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("class", "lightning-bolt");

        let d = `M ${startX} ${startY}`;
        let currX = startX;
        let currY = startY;
        const segments = 8;

        for (let j = 1; j <= segments; j++) {
            currX += (targetX - currX) / (segments - j + 1) + (Math.random() - 0.5) * 100;
            currY += (targetY - currY) / (segments - j + 1) + (Math.random() - 0.5) * 100;
            d += ` L ${currX} ${currY}`;
        }
        d += ` L ${targetX} ${targetY}`;

        path.setAttribute("d", d);
        svg.appendChild(path);
        container.appendChild(svg);

        // ACTIVATE RAINBOW ON FIRST HIT
        if (!isEnergized) {
            isEnergized = true;
            frameElement.classList.add('energized');
        }

        setTimeout(() => svg.remove(), 300);
    }
}

function openImageModal() {
    const modal = document.getElementById('imageModal');
    const frameElement = document.getElementById('mainFrame');

    // Reset state
    isEnergized = false;
    frameElement.classList.remove('energized');

    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);

    // Start Continuous Lightning (Every 400ms to 1200ms randomly)
    const strikeLoop = () => {
        createLightning();
        let nextStrike = Math.random() * 800 + 400;
        lightningInterval = setTimeout(strikeLoop, nextStrike);
    };
    strikeLoop();
}

function closeImageModal() {
    const modal = document.getElementById('imageModal');
    // STOP the lightning
    clearTimeout(lightningInterval);

    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
            document.getElementById('lightning-container').innerHTML = ''; // Clear stray bolts
        }, 300);
    }
}




// 1. Initialize the formatter with SECONDS included
const clockFormatter = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit', // Added this line
    hour12: false,
    timeZone: 'Asia/Jakarta'
});

function updateClock() {
    const now = new Date();

    // Update the display
    const clockElement = document.getElementById('live-clock');
    if (clockElement) {
        clockElement.innerText = clockFormatter.format(now);
    }

    // 2. SELF-CORRECTION LOGIC
    // This ensures the update happens exactly at the turn of every second
    const delay = 1000 - now.getMilliseconds();
    setTimeout(updateClock, delay);
}

// Start the cycle
updateClock();


// 1. Data Wisdom (Dikategorikan untuk kontrol urutan bahasa)
const wisdomData = {
    arabic: [
        "العلم بلا عمل كالشجر بلا ثمر، والعمل بلا علم كالمضي في طريق مظلم بلا هدى.",
        "ليس اليتيم من مات أبواه، بل اليتيم يتيم العلم والأدب والأخلاق الكريمة التي ترفع شأن الإنسان.",
        "إذا رأيت نيوب الليث بارزة فلا تظنن أن الليث يبتسم، فالحذر شيمة الحكيم في مواجهة الخطر.",
        "عدو عاقل خير من صديق جاهل، لأن الجاهل قد يضرك من حيث أراد أن ينفعك بجهله.",
        "الوقت كالسيف إن لم تقطعه قطعك، فاجتهد في استغلال دقائق عمرك قبل أن تضيع هباءً.",
        "بقدر الكد تكتسب المعالي، ومن طلب العلا سهر الليالي وبذل الجهد في سبيل الوصول إلى غايته.",
        "إن الشباب والفراغ والجدة مفسدة للمرء أي مفسدة إن لم تستغل في طلب العلم وبناء الذات.",
        "خير الكلام ما قل ودل، ولم يطل فيمل السامع، فالبلاغة في الإيجاز وإيصال المعنى بوضوح.",
        "لا تطلع سرك لأحد، فإن الشذر إذا كشفت عنه ضاع جماله وقيمته، واجعل صدرك مستودعاً لأسرارك.",
        "الاتحاد قوة والفرقة ضعف، ولا يستطيع المرء أن يجني ثمار النجاح وحيداً دون تعاون مع الآخرين."
    ],
    english: [
        "The only way to do great work is to love what you do. If you haven't found it yet, keep looking. Don't settle. — Steve Jobs",
        "It is not the critic who counts; not the man who points out how the strong man stumbles, or where the doer of deeds could have done them better. — Theodore Roosevelt",
        "Knowing others is intelligence; knowing yourself is true wisdom. Mastering others is strength; mastering yourself is true power. — Lao Tzu",
        "Success is not final, failure is not fatal: it is the courage to continue that counts. — Winston Churchill",
        "The test of a first-rate intelligence is the ability to hold two opposed ideas in the mind at the same time and still retain the ability to function. — F. Scott Fitzgerald",
        "You have power over your mind — not outside events. Realize this, and you will find strength. — Marcus Aurelius",
        "The function of leadership is to produce more leaders, not more followers. — Ralph Nader",
        "Man is condemned to be free; because once thrown into the world, he is responsible for everything he does. — Jean-Paul Sartre",
        "The secret of change is to focus all of your energy, not on fighting the old, but on building the new. — Socrates",
        "Education is the most powerful weapon which you can use to change the world. — Nelson Mandela",
        "In the middle of every difficulty lies opportunity. — Albert Einstein",
        "Science is not only compatible with spirituality; it is a profound source of spirituality. — Carl Sagan",
        "Life is not a problem to be solved, but a reality to be experienced. — Søren Kierkegaard",
        "Great spirits have always encountered violent opposition from mediocre minds. — Albert Einstein",
        "What you get by achieving your goals is not as important as what you become by achieving your goals. — Henry David Thoreau",
        "Your time is limited, so don't waste it living someone else's life. — Steve Jobs",
        "Everything can be taken from a man but one thing: the last of the human freedoms—to choose one’s attitude in any given set. — Viktor Frankl",
        "The only thing necessary for the triumph of evil is for good men to do nothing. — Edmund Burke",
        "Integrity is doing the right thing, even when no one is watching. — C.S. Lewis",
        "The journey of the sun and the stars is not more regular than the progression of human thought. — Alexander von Humboldt"
    ],
    javanese: [
        "ꦴꦱꦸꦫꦢꦶꦫꦗꦪꦤꦶꦔꦿꦠ꧀꧈ꦭꦼꦙꦸꦂꦢꦼꦤꦶꦁꦥꦔꦱ꧀ꦠꦸꦠꦶ꧉", // Sura Dira Jayaningrat, Lebur Dening Pangastuti.
        "ꦩꦼꦩꦪꦸꦲꦪꦸꦤꦶꦁꦧꦮꦤ꧈ꦩ꧀ꦧꦿꦱ꧀ꦠꦢꦸꦂꦲꦁꦏꦿ꧉", // Memayu Hayuning Bawana, Ambrasta dur Hangkara.
        "ꦢꦠꦤ꧀ꦱꦼꦫꦶꦏ꧀ꦭꦩꦸꦤ꧀ꦏꦼꦠꦩꦤ꧀꧈ꦢꦠꦤ꧀ꦱꦸꦱahꦭꦩꦸꦤ꧀ꦏꦼꦭꦔꦤ꧀꧉", // Datan Serik Lamun Ketaman, Datan Susah Lamun Kelangan.
        "ꦒꦺꦴꦭꦺꦏ꧀ꦱꦩ꧀ꦥꦸꦂꦤꦤꦶꦁꦲꦸꦫꦶꦥ꧀ꦭꦲꦶꦂꦧꦠꦶꦤ꧀ꦭꦤ꧀ꦲꦪꦸꦤꦶꦁꦧꦮꦤ꧉", // Golek Sampurnaning Urip Lahir Batin lan Ayuning Bawana.
        "ꦲꦸꦫꦶꦥ꧀ꦲꦶꦏꦸꦲꦸꦫꦸꦥ꧀꧈ꦩꦸꦭꦾꦤꦼꦲꦸꦫꦶꦥ꧀ꦲꦶꦏꦸꦢꦸꦢꦸꦲꦩꦂꦒꦧꦤ꧀ꦝ꧉", // Urip Iku Urup, mulyane urip iku dudu amarga bandha.
        "ꦲꦗꦩꦶꦭꦶꦏ꧀ꦧꦿꦁꦏꦁꦩꦺꦭꦺꦴꦏ꧀꧈ꦲꦗꦩꦔꦿꦺꦴꦩꦸꦤ꧀ꦝꦏ꧀ꦏꦼꦤ꧀ꦝꦺꦴ꧉", // Aja Milik Barang Kang Melok, Aja Mangro Mundak Kendo.
        "ꦔ꧀ꦭꦸꦫꦸꦏ꧀ꦠꦤ꧀ꦥꦧꦭ꧈ꦩꦼꦤꦁꦠꦤ꧀ꦥꦔꦱꦶꦫꦏꦼ꧉", // Ngluruk Tanpa Bala, Menang Tanpa Ngasirake.
        "ꦱꦸꦒꦶꦲꦶꦠꦤ꧀ꦥꦧꦤ꧀ꦝ꧈ꦢꦶꦒ꧀ꦢꦪꦠꦤ꧀ꦥꦲꦗꦶ꧉", // Sugih Tanpa Bandha, Digdaya Tanpa Aji.
        "ꦩꦸꦩ꧀ꦥꦸꦁꦲꦤꦺꦴꦩ꧀ꦔꦸꦢꦶꦪꦭꦶꦏꦸꦲꦸꦠꦩ꧉", // Mumpung anom ngudiya laku utama.
        "ꦏꦸꦢꦸꦢꦢꦶꦮꦺꦴꦁꦱꦶꦁꦠꦤ꧀ꦱahꦤꦿꦶꦩꦺꦴꦲꦶꦁꦥꦤ꧀ꦢꦸꦩ꧉" // Kudu dadi wong sing tansah nrimo ing pandum.
    ]
};

// 2. State Management untuk Urutan dan Pengulangan
let languageSequence = ['arabic', 'english', 'javanese'];
let currentLangIndex = 0;
let usedIndices = {
    arabic: [],
    english: [],
    javanese: []
};

function shuffle(array) {
    let currentIndex = array.length,
        randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

function getUniqueIndex(lang) {
    const totalData = wisdomData[lang].length;
    if (usedIndices[lang].length >= totalData) {
        usedIndices[lang] = [];
    }
    let randomIndex;
    do {
        randomIndex = Math.floor(Math.random() * totalData);
    } while (usedIndices[lang].includes(randomIndex));
    usedIndices[lang].push(randomIndex);
    return randomIndex;
}

// 3. Fungsi Utama Set Quote
function setRandomQuote() {
    const quoteEl = document.getElementById('daily-quote');
    if (!quoteEl) return;

    const currentLang = languageSequence[currentLangIndex];
    const quoteIdx = getUniqueIndex(currentLang);
    const selectedQuote = wisdomData[currentLang][quoteIdx];

    quoteEl.innerText = selectedQuote;

    // Tingkatkan index urutan bahasa
    currentLangIndex++;

    // Jika satu siklus (Ar, En, Jv) selesai, acak urutan baru
    if (currentLangIndex >= languageSequence.length) {
        currentLangIndex = 0;
        languageSequence = shuffle(['arabic', 'english', 'javanese']);
    }
}

// 4. Event Listeners
const avatarWrapper = document.querySelector('.avatar-clock-wrapper');
if (avatarWrapper) {
    avatarWrapper.addEventListener('mouseenter', setRandomQuote);
}

setRandomQuote();


// Put this inside your DOMContentLoaded block
const dropZone = document.getElementById('dropZone');

if (dropZone) {
    // 1. Prevent browser from opening the link when dropped
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    });

    // 2. Visual feedback when dragging over
    dropZone.addEventListener('dragover', () => {
        dropZone.style.background = 'rgba(115, 103, 240, 0.2)';
        dropZone.style.borderColor = 'var(--accent)';
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.style.background = 'transparent';
        dropZone.style.borderColor = 'var(--folder-color)';
    });

    // 3. The Modified Drop Logic
    dropZone.addEventListener('drop', (e) => {
        dropZone.style.background = 'transparent';
        dropZone.style.borderColor = 'var(--folder-color)';

        // Try multiple data formats (text/uri-list is best for cross-tab drags)
        const rawUrl = e.dataTransfer.getData('text/uri-list') ||
            e.dataTransfer.getData('text/plain') ||
            e.dataTransfer.getData('url');

        if (rawUrl) {
            // Clean up the URL (uri-list sometimes adds extra lines)
            const url = rawUrl.split('\n')[0].trim();

            if (url.startsWith('http')) {
                document.getElementById('linkUrl').value = url;

                // Try to extract a clean name
                try {
                    const urlObj = new URL(url);
                    let domain = urlObj.hostname.replace('www.', '').split('.')[0];
                    // Special case for YouTube titles if available
                    document.getElementById('linkName').value = domain.charAt(0).toUpperCase() + domain.slice(1);
                } catch (err) {
                    document.getElementById('linkName').value = "New Link";
                }

                document.getElementById('linkName').focus();
            } else {
                alert("Dropped item is not a valid web link.");
            }
        } else {
            // If rawUrl is empty, it means Edge blocked the Bookmark Bar data.
            alert("Edge security blocked the Bookmark Bar. \n\nPlease drag the Padlock icon (🔒) from the address bar instead!");
        }
    });
}

/* --- HOVER NOTE FUNCTIONS --- */

function showNote(e, id, type) {
    // If the toggle is OFF, stop the function immediately
    if (!notesEnabled) return; 
    
    clearTimeout(noteTimer);
    clearTimeout(noteTimer);
    currentActiveId = id;
    currentActiveType = type;

    const target = type === 'app' ?
        data.apps.find(a => a.id === id) :
        data.categories.find(c => c.id === id);

    if (!target) return;

    const noteEl = document.getElementById('hoverNote');
    const noteText = document.getElementById('noteText');

    // Set text - using target.note which will be saved in your data object
    noteText.innerText = target.note || "No notes added yet.";

    noteEl.style.display = 'block';
    // Position near mouse
    noteEl.style.top = (e.clientY + 15) + 'px';
    noteEl.style.left = (e.clientX + 15) + 'px';
}

function hideNote() {
    // 300ms delay to allow moving mouse into the note window
    noteTimer = setTimeout(() => {
        const noteEl = document.getElementById('hoverNote');
        if (noteEl && !noteEl.matches(':hover')) {
            noteEl.style.display = 'none';
        }
    }, 300);
}

function editNote() {
    const target = currentActiveType === 'app' ?
        data.apps.find(a => a.id === currentActiveId) :
        data.categories.find(c => c.id === currentActiveId);

    if (!target) return;

    const newNote = prompt(`Note for ${target.name}:`, target.note || "");

    if (newNote !== null) {
        target.note = newNote;
        save(); // Make sure your save() function calls localStorage.setItem
        document.getElementById('noteText').innerText = newNote || "No notes added yet.";
    }
}

function clearNote() {
    const target = currentActiveType === 'app' ?
        data.apps.find(a => a.id === currentActiveId) :
        data.categories.find(c => c.id === currentActiveId);

    if (target && confirm("Clear this note?")) {
        target.note = "";
        save();
        document.getElementById('noteText').innerText = "No notes added yet.";
    }
}

function handleReorder(targetAppId) {
    // draggedId and draggedType are set in your handleDragStart
    if (draggedType !== 'app' || draggedId === targetAppId) return;

    const fromIndex = data.apps.findIndex(a => a.id === draggedId);
    const toIndex = data.apps.findIndex(a => a.id === targetAppId);

    if (fromIndex !== -1 && toIndex !== -1) {
        // Move the item in the array
        const [movedItem] = data.apps.splice(fromIndex, 1);
        data.apps.splice(toIndex, 0, movedItem);

        save(); // Save the new order to localStorage
        renderDashboard(); // Refresh the screen
    }
}


// Add this at the bottom of your script.js
window.addEventListener('contextmenu', function (e) {
    // Find the closest parent that is an app shortcut
    const shortcut = e.target.closest('.app-shortcut');

    if (shortcut) {
        e.preventDefault(); // Prevent the standard browser menu

        // We need the ID of the app. 
        // Ensure your render function adds data-id="${app.id}" to the shortcut div
        const appId = shortcut.getAttribute('data-id');
        openEditMenu(appId);
    }
});

function openEditMenu(id) {
    const app = data.apps.find(a => a.id === id);
    if (!app) return;

    currentEditingId = id;

    // 1. Set the Name
    document.getElementById('edit-app-name').value = app.name;

    // 2. Set the Preview (Fallback to favicon if no custom icon exists)
    let domain = "google.com";
    try {
        domain = new URL(app.url).hostname;
    } catch (e) {}

    const previewImg = document.getElementById('edit-icon-preview');
    previewImg.src = app.icon || `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;

    // 3. Show the Modal
    document.getElementById('edit-modal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('edit-modal').style.display = 'none';
    // Clear the temp storage so it doesn't leak into the next edit
    tempIconBase64 = null;
}


function saveAppChanges() {
    const appIndex = data.apps.findIndex(a => a.id === currentEditingId);

    if (appIndex !== -1) {
        // 1. Update the name
        data.apps[appIndex].name = document.getElementById('edit-app-name').value;

        // 2. Update the icon if a new one was browsed
        if (tempIconBase64) {
            data.apps[appIndex].icon = tempIconBase64;
        }

        // 3. THE FIX: Call the save function
        saveData();

        // 4. Refresh the UI and close
        renderDashboard(); // Or renderApps() depending on your script
        closeEditModal();

        // Reset the temp variable for the next edit
        tempIconBase64 = null;
    }
}

function saveData() {
    // This takes your 'data' object and saves it as a string in LocalStorage
    localStorage.setItem('dashboardData', JSON.stringify(data));
    console.log("Data saved successfully to workstation storage.");
}

function openAddLinkInFolder() {
    // 1. Open your existing link modal
    openModal('linkModal');

    // 2. Pre-select the current folder in the category dropdown
    const select = document.getElementById('linkCatSelect');
    const currentFolder = data.categories.find(c => c.id === currentOpenFolderId);

    if (currentFolder && select) {
        select.value = currentFolder.name;
    }
}

function openAddFolderInFolder() {
    // 1. Open your existing folder modal
    openModal('folderModal');

    // 2. Pre-select the current folder as the parent
    const select = document.getElementById('folderParentSelect');
    if (currentOpenFolderId && select) {
        select.value = currentOpenFolderId;
    }
}

// --- 1. THE OPEN MENU FIX ---
function openEditMenu(id) {
    // Find the specific app in your data array
    const app = data.apps.find(a => a.id === id);
    if (!app) return;

    currentEditingId = id;

    // Set the Name field
    document.getElementById('edit-app-name').value = app.name;

    // FIX: Set the URL field so it shows the original link
    // We check app.url; if it doesn't exist, we default to empty string
    const urlInput = document.getElementById('edit-app-url');
    if (urlInput) {
        urlInput.value = app.url || "";
    }

    // Handle Icon Preview
    const iconPreview = document.getElementById('edit-icon-preview');
    if (app.icon) {
        iconPreview.src = app.icon;
    } else {
        // Fallback to favicon if no custom icon exists
        let domain = "google.com";
        try {
            domain = new URL(app.url).hostname;
        } catch (e) {
            domain = "google.com";
        }
        iconPreview.src = `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
    }

    // Show the modal
    document.getElementById('edit-modal').style.display = 'flex';
}

// --- 2. THE SAVE CHANGES FIX ---
function saveAppChanges() {
    const appIndex = data.apps.findIndex(a => a.id === currentEditingId);

    if (appIndex !== -1) {
        // Update the Name
        data.apps[appIndex].name = document.getElementById('edit-app-name').value;

        // FIX: Capture and update the edited URL
        const newUrl = document.getElementById('edit-app-url').value;
        data.apps[appIndex].url = newUrl;

        // Update icon if a new one was uploaded during this session
        if (tempIconBase64) {
            data.apps[appIndex].icon = tempIconBase64;
        }

        // Persist to localStorage
        saveData();

        // Refresh the UI
        renderDashboard();
        closeEditModal();

        // Cleanup
        tempIconBase64 = null;
    }
}