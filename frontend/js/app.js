// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    loadDashboard();
    loadAccounts();
    loadCategories();
    loadDepartments();
    loadLocations();
    loadAssets();
    setupFormHandlers();

    // Agregar event listeners a los filtros
    document.getElementById('assetFilter').addEventListener('change', loadDashboard);
    document.getElementById('departmentFilter').addEventListener('change', loadDashboard);

    console.log('✓ Aplicación iniciada');
});

// DASHBOARD FINANCIERO
let dashboardCharts = {};
const COLORS = { blue: '#0EA5E9', orange: '#F97316', green: '#10B981' };

async function loadDashboard() {
    try {
        const [assetsRes, categoriesRes] = await Promise.all([
            fetch('/api/assets'),
            fetch('/api/categories')
        ]);
        const [assetsData, categoriesData] = await Promise.all([assetsRes.json(), categoriesRes.json()]);

        if (!assetsData.success || !categoriesData.success) return;

        let allAssets = assetsData.assets;
        const categories = categoriesData.categories;
        const today = new Date();

        // Obtener filtros
        const selectedCategory = document.getElementById('assetFilter').value;
        const selectedDepartment = document.getElementById('departmentFilter').value;
        const selectedLocation = document.getElementById('locationFilter').value;

        // Aplicar filtros
        let assets = allAssets.filter(a => {
            const catMatch = !selectedCategory || a.category.id == selectedCategory;
            const deptMatch = !selectedDepartment || a.department === selectedDepartment;
            const locMatch = !selectedLocation || a.location_name === selectedLocation;
            return catMatch && deptMatch && locMatch;
        });

        // Actualizar filtros
        const filterSelect = document.getElementById('assetFilter');
        if (!filterSelect.innerHTML.includes('Edificaciones')) {
            filterSelect.innerHTML = '<option value="">Todas las Categorías</option>' +
                categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }

        // Obtener departamentos únicos
        const departments = [...new Set(allAssets.map(a => a.department).filter(d => d))];
        const deptSelect = document.getElementById('departmentFilter');
        if (departments.length > 0) {
            deptSelect.innerHTML = '<option value="">Todos los Departamentos</option>' +
                departments.map(d => `<option value="${d}">${d}</option>`).join('');
        }

        // Obtener localidades únicas
        const locations = [...new Set(allAssets.map(a => a.location_name).filter(l => l))];
        const locSelect = document.getElementById('locationFilter');
        if (locations.length > 0) {
            locSelect.innerHTML = '<option value="">Todas las Localidades</option>' +
                locations.map(l => `<option value="${l}">${l}</option>`).join('');
        }

        // Calcular KPIs financieros principales
        const allAssetsForCalc = allAssets.length > 0 ? allAssets : assets;
        const grossValue = allAssetsForCalc.reduce((s, a) => s + parseFloat(a.acquisition_cost), 0);
        const depreciatedValue = allAssetsForCalc.reduce((s, a) => {
            const years = (today - new Date(a.acquisition_date)) / (1000 * 60 * 60 * 24 * 365.25);
            return s + (parseFloat(a.acquisition_cost) * (a.category.depreciation_rate / 100) * Math.max(0, years));
        }, 0);
        const netValue = grossValue - depreciatedValue;

        document.getElementById('grossValue').textContent = 'RD$ ' + grossValue.toLocaleString('es-DO', {maximumFractionDigits: 0});
        document.getElementById('depreciatedValue').textContent = 'RD$ ' + depreciatedValue.toLocaleString('es-DO', {maximumFractionDigits: 0});
        document.getElementById('netValue').textContent = 'RD$ ' + netValue.toLocaleString('es-DO', {maximumFractionDigits: 0});

        // Calcular KPIs de activos (con filtros aplicados)
        if (assets.length > 0) {
            const avgValue = assets.reduce((s, a) => s + parseFloat(a.acquisition_cost), 0) / assets.length;
            const maxAsset = assets.reduce((max, a) => parseFloat(a.acquisition_cost) > parseFloat(max.acquisition_cost) ? a : max);
            const minAsset = assets.reduce((min, a) => parseFloat(a.acquisition_cost) < parseFloat(min.acquisition_cost) ? a : min);
            const avgLife = (assets.reduce((s, a) => s + parseInt(a.useful_life_years), 0) / assets.length).toFixed(1);

            document.getElementById('avgAssetValue').textContent = 'RD$ ' + avgValue.toLocaleString('es-DO', {maximumFractionDigits: 0});
            document.getElementById('maxAssetValue').textContent = 'RD$ ' + parseFloat(maxAsset.acquisition_cost).toLocaleString('es-DO', {maximumFractionDigits: 0});
            document.getElementById('maxAssetName').textContent = maxAsset.description;
            document.getElementById('minAssetValue').textContent = 'RD$ ' + parseFloat(minAsset.acquisition_cost).toLocaleString('es-DO', {maximumFractionDigits: 0});
            document.getElementById('minAssetName').textContent = minAsset.description;
            document.getElementById('avgLife').textContent = avgLife + ' años';
        }

        // Generar gráficos
        generateFinancialCharts(assets, categories);
    } catch (error) {
        console.error('Error en dashboard:', error);
    }
}

function generateFinancialCharts(assets, categories) {
    const catMap = {};
    categories.forEach(c => {
        catMap[c.id] = { name: c.name, gross: 0, depreciated: 0, count: 0 };
    });

    const today = new Date();
    assets.forEach(a => {
        const cat = catMap[a.category.id];
        if (cat) {
            const cost = parseFloat(a.acquisition_cost);
            const years = (today - new Date(a.acquisition_date)) / (1000 * 60 * 60 * 24 * 365.25);
            const deprec = cost * (a.category.depreciation_rate / 100) * Math.max(0, years);
            cat.gross += cost;
            cat.depreciated += deprec;
            cat.count++;
        }
    });

    // TOP 10 (Barras Horizontales)
    const top10 = assets.sort((a, b) => parseFloat(b.acquisition_cost) - parseFloat(a.acquisition_cost)).slice(0, 10);
    if (dashboardCharts.top10) dashboardCharts.top10.destroy();
    dashboardCharts.top10 = new Chart(document.getElementById('top10Chart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: top10.map((a, i) => `${i+1}. ${a.description.substring(0, 20)}`),
            datasets: [{ label: 'RD$', data: top10.map(a => parseFloat(a.acquisition_cost)), backgroundColor: COLORS.blue, borderRadius: 4 }]
        },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } } }
    });

    // DISTRIBUCIÓN POR CATEGORÍA (Dona)
    if (dashboardCharts.dist) dashboardCharts.dist.destroy();
    const catNames = Object.values(catMap).map(c => c.name);
    const catCounts = Object.values(catMap).map(c => c.count);
    dashboardCharts.dist = new Chart(document.getElementById('categoryDistChart').getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: catNames,
            datasets: [{ data: catCounts, backgroundColor: [COLORS.blue, COLORS.orange, COLORS.green, '#8B5CF6', '#EC4899', '#14B8A6', '#F59E0B', '#EF4444'], borderWidth: 2, borderColor: '#fff' }]
        },
        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom' } } }
    });

    // VALOR BRUTO vs DEPRECIACIÓN (Barras Apiladas)
    if (dashboardCharts.stack) dashboardCharts.stack.destroy();
    dashboardCharts.stack = new Chart(document.getElementById('depreciationStackChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: catNames,
            datasets: [
                { label: 'Valor Bruto', data: Object.values(catMap).map(c => c.gross), backgroundColor: COLORS.blue, borderRadius: [4, 4, 0, 0] },
                { label: 'Depreciación', data: Object.values(catMap).map(c => c.depreciated), backgroundColor: COLORS.orange, borderRadius: [4, 4, 0, 0] }
            ]
        },
        options: { indexAxis: 'x', stacked: true, responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom' } } }
    });

    // VALOR NETO POR CATEGORÍA (Línea)
    if (dashboardCharts.net) dashboardCharts.net.destroy();
    const netByCategory = Object.values(catMap).map(c => c.gross - c.depreciated);
    dashboardCharts.net = new Chart(document.getElementById('netValueChart').getContext('2d'), {
        type: 'line',
        data: {
            labels: catNames,
            datasets: [{
                label: 'Valor Neto RD$',
                data: netByCategory,
                borderColor: COLORS.green,
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: COLORS.green,
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5
            }]
        },
        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } } }
    });
}

// Navegación
function initNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;

            // Actualizar activo
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Mostrar página
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById(`${page}-page`).classList.add('active');
            document.getElementById('pageTitle').textContent = link.textContent.trim();

            // Recargar datos
            if (page === 'accounting') loadAccounts();
            if (page === 'categories') loadCategories();
            if (page === 'departments') loadDepartments();
            if (page === 'locations') loadLocations();
            if (page === 'assets') loadAssets();
        });
    });
}

// CUENTAS CONTABLES
async function loadAccounts() {
    try {
        const res = await fetch('/api/accounting/accounts');
        const data = await res.json();

        const tbody = document.getElementById('accountsTable');
        if (data.success && data.accounts.length > 0) {
            tbody.innerHTML = data.accounts.map(acc => `
                <tr>
                    <td>${acc.code}</td>
                    <td>${acc.name}</td>
                    <td>${acc.account_type}</td>
                    <td>
                        <button class="btn" onclick="openEditAccountModal('${acc.id}', '${acc.code}', '${acc.name.replace(/'/g, "\\'")}', '${acc.account_type}', '${(acc.description || '').replace(/'/g, "\\'")}')" >Editar</button>
                        <button class="btn btn-danger" onclick="deleteAccount(${acc.id})">Eliminar</button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="4">Sin cuentas registradas</td></tr>';
        }
    } catch (error) {
        console.error('Error cargando cuentas:', error);
    }
}

function openAccountModal() {
    document.getElementById('accountModal').classList.add('active');
}

function closeAccountModal() {
    document.getElementById('accountModal').classList.remove('active');
}

async function submitAccount(e) {
    e.preventDefault();
    const code = document.getElementById('accountCode').value;
    const name = document.getElementById('accountName').value;
    const type = document.getElementById('accountType').value;
    const desc = document.getElementById('accountDesc').value;

    try {
        const res = await fetch('/api/accounting/accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, name, account_type: type, description: desc })
        });
        const data = await res.json();

        if (data.success) {
            alert('✓ Cuenta creada exitosamente');
            document.getElementById('accountForm').reset();
            closeAccountModal();
            loadAccounts();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

function openEditAccountModal(id, code, name, type, desc) {
    document.getElementById('editAccountId').value = id;
    document.getElementById('editAccountCode').value = code;
    document.getElementById('editAccountName').value = name;
    document.getElementById('editAccountType').value = type;
    document.getElementById('editAccountDesc').value = desc;
    document.getElementById('editAccountModal').classList.add('active');
}

function closeEditAccountModal() {
    document.getElementById('editAccountModal').classList.remove('active');
}

async function submitEditAccount(e) {
    e.preventDefault();
    const id = document.getElementById('editAccountId').value;
    const code = document.getElementById('editAccountCode').value;
    const name = document.getElementById('editAccountName').value;
    const type = document.getElementById('editAccountType').value;
    const desc = document.getElementById('editAccountDesc').value;

    try {
        const res = await fetch(`/api/accounting/accounts/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, name, account_type: type, description: desc })
        });
        const data = await res.json();

        if (data.success) {
            alert('✓ Cuenta actualizada exitosamente');
            document.getElementById('editAccountForm').reset();
            closeEditAccountModal();
            loadAccounts();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function deleteAccount(id) {
    if (confirm('¿Eliminar esta cuenta?')) {
        try {
            const res = await fetch(`/api/accounting/accounts/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                loadAccounts();
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    }
}

// CATEGORÍAS
async function loadCategories() {
    try {
        const res = await fetch('/api/categories');
        const data = await res.json();

        const tbody = document.getElementById('categoriesTable');
        const select = document.getElementById('assetCategory');
        const editSelect = document.getElementById('editAssetCategory');

        if (data.success && data.categories.length > 0) {
            tbody.innerHTML = data.categories.map(cat => `
                <tr>
                    <td>${cat.name}</td>
                    <td>${cat.depreciation_rate}%</td>
                    <td>${cat.description || '-'}</td>
                    <td>
                        <button class="btn" onclick="openEditCategoryModal(${cat.id}, '${cat.name.replace(/'/g, "\\'")}', ${cat.depreciation_rate}, '${(cat.description || '').replace(/'/g, "\\'")}')" >Editar</button>
                        <button class="btn btn-danger" onclick="deleteCategory(${cat.id})">Eliminar</button>
                    </td>
                </tr>
            `).join('');

            const catOptions = '<option value="">Seleccionar...</option>' + data.categories.map(cat =>
                `<option value="${cat.id}">${cat.name}</option>`
            ).join('');
            select.innerHTML = catOptions;
            editSelect.innerHTML = catOptions;
        } else {
            tbody.innerHTML = '<tr><td colspan="4">Sin categorías registradas</td></tr>';
        }
    } catch (error) {
        console.error('Error cargando categorías:', error);
    }
}

function openCategoryModal() {
    document.getElementById('categoryModal').classList.add('active');
}

function closeCategoryModal() {
    document.getElementById('categoryModal').classList.remove('active');
}

async function submitCategory(e) {
    e.preventDefault();
    const name = document.getElementById('categoryName').value;
    const rate = document.getElementById('categoryRate').value;

    try {
        const res = await fetch('/api/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, depreciation_rate: rate })
        });
        const data = await res.json();

        if (data.success) {
            alert('✓ Categoría creada exitosamente');
            document.getElementById('categoryForm').reset();
            closeCategoryModal();
            loadCategories();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

function openEditCategoryModal(id, name, rate, desc) {
    document.getElementById('editCategoryId').value = id;
    document.getElementById('editCategoryName').value = name;
    document.getElementById('editCategoryRate').value = rate;
    document.getElementById('editCategoryDesc').value = desc;
    document.getElementById('editCategoryModal').classList.add('active');
}

function closeEditCategoryModal() {
    document.getElementById('editCategoryModal').classList.remove('active');
}

async function submitEditCategory(e) {
    e.preventDefault();
    const id = document.getElementById('editCategoryId').value;
    const name = document.getElementById('editCategoryName').value;
    const rate = document.getElementById('editCategoryRate').value;
    const desc = document.getElementById('editCategoryDesc').value;

    try {
        const res = await fetch(`/api/categories/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, depreciation_rate: rate, description: desc })
        });
        const data = await res.json();

        if (data.success) {
            alert('✓ Categoría actualizada exitosamente');
            closeEditCategoryModal();
            loadCategories();
            loadDashboard();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function deleteCategory(id) {
    if (confirm('¿Eliminar esta categoría?')) {
        try {
            const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                loadCategories();
                loadDashboard();
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    }
}

// DEPARTAMENTOS
async function loadDepartments() {
    try {
        const res = await fetch('/api/departments');
        const data = await res.json();

        const tbody = document.getElementById('departmentsTable');
        if (data.success && data.departments.length > 0) {
            tbody.innerHTML = data.departments.map(dept => `
                <tr>
                    <td>${dept.name}</td>
                    <td>${dept.description || '-'}</td>
                    <td>
                        <button class="btn" onclick="openEditDepartmentModal(${dept.id}, '${dept.name.replace(/'/g, "\\'")}', '${(dept.description || '').replace(/'/g, "\\'")}')" >Editar</button>
                        <button class="btn btn-danger" onclick="deleteDepartment(${dept.id})">Eliminar</button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="3">Sin departamentos registrados</td></tr>';
        }
    } catch (error) {
        console.error('Error cargando departamentos:', error);
    }
}

function openDepartmentModal() {
    document.getElementById('departmentId').value = '';
    document.getElementById('departmentName').value = '';
    document.getElementById('departmentDesc').value = '';
    document.getElementById('departmentModalTitle').textContent = 'Nuevo Departamento';
    document.getElementById('departmentModal').classList.add('active');
}

function openEditDepartmentModal(id, name, desc) {
    document.getElementById('departmentId').value = id;
    document.getElementById('departmentName').value = name;
    document.getElementById('departmentDesc').value = desc;
    document.getElementById('departmentModalTitle').textContent = 'Editar Departamento';
    document.getElementById('departmentModal').classList.add('active');
}

function closeDepartmentModal() {
    document.getElementById('departmentModal').classList.remove('active');
}

async function submitDepartment(e) {
    e.preventDefault();
    const id = document.getElementById('departmentId').value;
    const name = document.getElementById('departmentName').value;
    const desc = document.getElementById('departmentDesc').value;

    if (!name) {
        alert('Ingresa el nombre del departamento');
        return;
    }

    try {
        const url = id ? `/api/departments/${id}` : '/api/departments';
        const method = id ? 'PUT' : 'POST';
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description: desc })
        });
        const data = await res.json();

        if (data.success) {
            alert('✓ Departamento ' + (id ? 'actualizado' : 'creado') + ' exitosamente');
            document.getElementById('departmentForm').reset();
            closeDepartmentModal();
            loadDepartments();
            loadAssets();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function deleteDepartment(id) {
    if (confirm('¿Eliminar este departamento?')) {
        try {
            const res = await fetch(`/api/departments/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                loadDepartments();
                loadAssets();
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    }
}

// LOCALIDADES
async function loadLocations() {
    try {
        const res = await fetch('/api/locations');
        const data = await res.json();
        const tbody = document.getElementById('locationsTable');
        const assetLocSelect = document.getElementById('assetLocation');
        const editAssetLocSelect = document.getElementById('editAssetLocation');

        if (data.success && data.locations && data.locations.length > 0) {
            tbody.innerHTML = data.locations.map(location => {
                const locationId = location.id;
                const locationName = location.name.replace(/'/g, "&apos;");
                const locationAddress = (location.address || '').replace(/'/g, "&apos;");
                const locationCity = (location.city || '').replace(/'/g, "&apos;");
                const locationPhone = (location.phone || '').replace(/'/g, "&apos;");
                const locationDesc = (location.description || '').replace(/'/g, "&apos;");
                return `
                <tr>
                    <td>${location.name}</td>
                    <td>${location.city || '-'}</td>
                    <td>${location.phone || '-'}</td>
                    <td>${location.description || '-'}</td>
                    <td>
                        <button class="btn" onclick="openEditLocationModal(${locationId}, '${locationName}', '${locationAddress}', '${locationCity}', '${locationPhone}', '${locationDesc}')">Editar</button>
                        <button class="btn btn-danger" onclick="deleteLocation(${locationId})">Eliminar</button>
                    </td>
                </tr>
            `}).join('');

            // Cargar opciones de localidades en activos
            if (assetLocSelect) {
                assetLocSelect.innerHTML = '<option value="">Seleccionar...</option>' +
                    data.locations.map(l => `<option value="${l.name}">${l.name}</option>`).join('');
            }
            if (editAssetLocSelect) {
                editAssetLocSelect.innerHTML = '<option value="">Seleccionar...</option>' +
                    data.locations.map(l => `<option value="${l.name}">${l.name}</option>`).join('');
            }
        } else if (data.success) {
            tbody.innerHTML = '<tr><td colspan="5">No hay localidades</td></tr>';
        } else {
            tbody.innerHTML = '<tr><td colspan="5">Error: ' + (data.message || 'No se pudo cargar') + '</td></tr>';
        }
    } catch (error) {
        const tbody = document.getElementById('locationsTable');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5">Error: ' + error.message + '</td></tr>';
        }
        console.error('Error cargando localidades:', error);
    }
}

function openLocationModal() {
    document.getElementById('locationId').value = '';
    document.getElementById('locationName').value = '';
    document.getElementById('locationAddress').value = '';
    document.getElementById('locationCity').value = '';
    document.getElementById('locationPhone').value = '';
    document.getElementById('locationDesc').value = '';
    document.getElementById('locationModalTitle').textContent = 'Nueva Localidad';
    document.getElementById('locationModal').classList.add('active');
}

function openEditLocationModal(id, name, address, city, phone, desc) {
    document.getElementById('locationId').value = id;
    document.getElementById('locationName').value = name;
    document.getElementById('locationAddress').value = address;
    document.getElementById('locationCity').value = city;
    document.getElementById('locationPhone').value = phone;
    document.getElementById('locationDesc').value = desc;
    document.getElementById('locationModalTitle').textContent = 'Editar Localidad';
    document.getElementById('locationModal').classList.add('active');
}

function closeLocationModal() {
    document.getElementById('locationModal').classList.remove('active');
}

async function submitLocation(e) {
    e.preventDefault();
    const id = document.getElementById('locationId').value;
    const name = document.getElementById('locationName').value;
    const address = document.getElementById('locationAddress').value;
    const city = document.getElementById('locationCity').value;
    const phone = document.getElementById('locationPhone').value;
    const desc = document.getElementById('locationDesc').value;

    if (!name) {
        alert('Ingresa el nombre de la localidad');
        return;
    }

    try {
        const url = id ? `/api/locations/${id}` : '/api/locations';
        const method = id ? 'PUT' : 'POST';
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, address, city, phone, description: desc })
        });
        const data = await res.json();

        if (data.success) {
            alert('✓ Localidad ' + (id ? 'actualizada' : 'creada') + ' exitosamente');
            document.getElementById('locationForm').reset();
            closeLocationModal();
            loadLocations();
            loadAssets();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function deleteLocation(id) {
    if (confirm('¿Eliminar esta localidad?')) {
        try {
            const res = await fetch(`/api/locations/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                loadLocations();
                loadAssets();
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    }
}

// ACTIVOS
async function loadAssets() {
    try {
        const [assetsRes, categoriesRes, departmentsRes] = await Promise.all([
            fetch('/api/assets'),
            fetch('/api/categories'),
            fetch('/api/departments')
        ]);
        const [assetsData, categoriesData, departmentsData] = await Promise.all([
            assetsRes.json(),
            categoriesRes.json(),
            departmentsRes.json()
        ]);

        const tbody = document.getElementById('assetsTable');
        const editAssetCatSelect = document.getElementById('editAssetCategory');
        const assetCatSelect = document.getElementById('assetCategory');
        const editAssetDeptSelect = document.getElementById('editAssetDepartment');
        const assetDeptSelect = document.getElementById('assetDepartment');

        if (assetsData.success && assetsData.assets.length > 0) {
            tbody.innerHTML = assetsData.assets.map(asset => `
                <tr>
                    <td>${asset.code}</td>
                    <td>${asset.description}</td>
                    <td>${asset.category.name}</td>
                    <td>${asset.department || '-'}</td>
                    <td>RD$ ${parseFloat(asset.acquisition_cost).toLocaleString('es-DO', {minimumFractionDigits: 2})}</td>
                    <td>
                        <button class="btn" onclick="openEditAssetModal(${JSON.stringify(asset).replace(/"/g, '&quot;')})">Editar</button>
                        <button class="btn btn-danger" onclick="deleteAsset(${asset.id})">Eliminar</button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="6">Sin activos registrados</td></tr>';
        }

        if (categoriesData.success) {
            const catOptions = '<option value="">Seleccionar...</option>' + categoriesData.categories.map(cat =>
                `<option value="${cat.id}">${cat.name}</option>`
            ).join('');
            assetCatSelect.innerHTML = catOptions;
            editAssetCatSelect.innerHTML = catOptions;
        }

        if (departmentsData.success) {
            const deptOptions = '<option value="">Seleccionar...</option>' + departmentsData.departments.map(dept =>
                `<option value="${dept.name}">${dept.name}</option>`
            ).join('');
            assetDeptSelect.innerHTML = deptOptions;
            editAssetDeptSelect.innerHTML = deptOptions;
        }
    } catch (error) {
        console.error('Error cargando activos:', error);
    }
}

function openAssetModal() {
    document.getElementById('assetModal').classList.add('active');
}

function closeAssetModal() {
    document.getElementById('assetModal').classList.remove('active');
}

async function submitAsset(e) {
    e.preventDefault();
    const description = document.getElementById('assetDesc').value;
    const categoryId = document.getElementById('assetCategory').value;
    const department = document.getElementById('assetDepartment').value;
    const cost = document.getElementById('assetCost').value;
    const life = document.getElementById('assetLife').value;

    if (!categoryId) {
        alert('Selecciona una categoría');
        return;
    }

    try {
        const location_name = document.getElementById('assetLocation').value;
        const formData = new FormData();
        formData.append('description', description);
        formData.append('category_id', categoryId);
        formData.append('department', department || null);
        formData.append('location_name', location_name || null);
        formData.append('acquisition_date', new Date().toISOString().split('T')[0]);
        formData.append('acquisition_cost', cost);
        formData.append('useful_life_years', life);
        formData.append('acquisition_year', document.getElementById('assetYear').value || new Date().getFullYear());
        formData.append('asset_user', document.getElementById('assetUser').value || '');
        formData.append('warranty', document.getElementById('assetWarranty').value || '');
        formData.append('brand', document.getElementById('assetBrand').value || '');
        formData.append('model', document.getElementById('assetModel').value || '');
        formData.append('color', document.getElementById('assetColor').value || '');
        formData.append('year_manufactured', document.getElementById('assetYearMfg').value || '');
        formData.append('physical_location', document.getElementById('assetPhysicalLocation').value || '');
        formData.append('asset_condition', document.getElementById('assetCondition').value || 'good');
        formData.append('plate_number', document.getElementById('assetPlate').value || '');
        formData.append('chassis', document.getElementById('assetChassis').value || '');
        formData.append('equipment_serial', document.getElementById('assetSerial').value || '');
        formData.append('equipment_supplier', document.getElementById('assetSupplier').value || '');

        // Agregar archivo de factura si existe
        const invoiceFile = document.getElementById('assetInvoice').files[0];
        if (invoiceFile) {
            formData.append('invoice_file', invoiceFile);
        }

        const res = await fetch('/api/assets', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (data.success) {
            alert('✓ Activo creado exitosamente');
            document.getElementById('assetForm').reset();
            closeAssetModal();
            loadAssets();
            loadDashboard();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

function openEditAssetModal(asset) {
    document.getElementById('editAssetId').value = asset.id;
    document.getElementById('editAssetDesc').value = asset.description;
    document.getElementById('editAssetCategory').value = asset.category.id;
    document.getElementById('editAssetDepartment').value = asset.department || '';
    document.getElementById('editAssetLocation').value = asset.location_name || '';
    document.getElementById('editAssetCost').value = asset.acquisition_cost;
    document.getElementById('editAssetLife').value = asset.useful_life_years;
    document.getElementById('editAssetYear').value = asset.acquisition_year || '';
    document.getElementById('editAssetUser').value = asset.asset_user || '';
    document.getElementById('editAssetWarranty').value = asset.warranty || '';
    document.getElementById('editAssetBrand').value = asset.brand || '';
    document.getElementById('editAssetModel').value = asset.model || '';
    document.getElementById('editAssetColor').value = asset.color || '';
    document.getElementById('editAssetYearMfg').value = asset.year_manufactured || '';
    document.getElementById('editAssetPhysicalLocation').value = asset.physical_location || '';
    document.getElementById('editAssetCondition').value = asset.asset_condition || 'good';
    document.getElementById('editAssetPlate').value = asset.plate_number || '';
    document.getElementById('editAssetChassis').value = asset.chassis || '';
    document.getElementById('editAssetSerial').value = asset.equipment_serial || '';
    document.getElementById('editAssetSupplier').value = asset.equipment_supplier || '';

    updateFieldsForCategory('editAssetCategory');
    document.getElementById('editAssetModal').classList.add('active');
}

function closeEditAssetModal() {
    document.getElementById('editAssetModal').classList.remove('active');
}

async function submitEditAsset(e) {
    e.preventDefault();
    const id = document.getElementById('editAssetId').value;
    const description = document.getElementById('editAssetDesc').value;
    const categoryId = document.getElementById('editAssetCategory').value;
    const department = document.getElementById('editAssetDepartment').value;
    const cost = document.getElementById('editAssetCost').value;
    const life = document.getElementById('editAssetLife').value;

    if (!categoryId) {
        alert('Selecciona una categoría');
        return;
    }

    try {
        const location_name = document.getElementById('editAssetLocation').value;
        const res = await fetch(`/api/assets/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                description,
                category_id: categoryId,
                department: department || null,
                location_name: location_name || null,
                acquisition_cost: cost,
                useful_life_years: life,
                acquisition_year: document.getElementById('editAssetYear').value || new Date().getFullYear(),
                asset_user: document.getElementById('editAssetUser').value || '',
                warranty: document.getElementById('editAssetWarranty').value || '',
                brand: document.getElementById('editAssetBrand').value || '',
                model: document.getElementById('editAssetModel').value || '',
                color: document.getElementById('editAssetColor').value || '',
                year_manufactured: document.getElementById('editAssetYearMfg').value || '',
                physical_location: document.getElementById('editAssetPhysicalLocation').value || '',
                asset_condition: document.getElementById('editAssetCondition').value || 'good',
                plate_number: document.getElementById('editAssetPlate').value || '',
                chassis: document.getElementById('editAssetChassis').value || '',
                equipment_serial: document.getElementById('editAssetSerial').value || '',
                equipment_supplier: document.getElementById('editAssetSupplier').value || ''
            })
        });
        const data = await res.json();

        if (data.success) {
            alert('✓ Activo actualizado exitosamente');
            closeEditAssetModal();
            loadAssets();
            loadDashboard();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function deleteAsset(id) {
    if (confirm('¿Eliminar este activo?')) {
        try {
            const res = await fetch(`/api/assets/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                loadAssets();
                loadDashboard();
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    }
}

// Actualizar campos según la categoría seleccionada
function updateFieldsForCategory(selectElementId) {
    const selectElement = document.getElementById(selectElementId);
    const categoryId = selectElement.value;

    const isVehicle = categoryId === '4' || categoryId === '2'; // Vehículos o Vehículos y Equipos
    const isEquipment = categoryId === '2' || categoryId === '8'; // Equipos o Vehículos y Equipos

    // Mostrar/ocultar campos de vehículos
    const vehiclePrefix = selectElementId.includes('edit') ? 'edit' : '';
    if (document.getElementById(`${vehiclePrefix}VehicleFields`)) {
        document.getElementById(`${vehiclePrefix}VehicleFields`).style.display = isVehicle ? 'block' : 'none';
        document.getElementById(`${vehiclePrefix}ChassisField`).style.display = isVehicle ? 'block' : 'none';
    }

    // Mostrar/ocultar campos de equipos
    if (document.getElementById(`${vehiclePrefix}EquipmentFields`)) {
        document.getElementById(`${vehiclePrefix}EquipmentFields`).style.display = isEquipment ? 'block' : 'none';
        document.getElementById(`${vehiclePrefix}SupplierField`).style.display = isEquipment ? 'block' : 'none';
    }
}

// FORM HANDLERS
function setupFormHandlers() {
    document.getElementById('accountForm').addEventListener('submit', submitAccount);
    document.getElementById('editAccountForm').addEventListener('submit', submitEditAccount);
    document.getElementById('categoryForm').addEventListener('submit', submitCategory);
    document.getElementById('editCategoryForm').addEventListener('submit', submitEditCategory);
    document.getElementById('assetForm').addEventListener('submit', submitAsset);
    document.getElementById('editAssetForm').addEventListener('submit', submitEditAsset);
    document.getElementById('departmentForm').addEventListener('submit', submitDepartment);
    document.getElementById('locationForm').addEventListener('submit', submitLocation);

    // Event listener para botones editar (delegado)
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('edit-account-btn')) {
            const id = e.target.dataset.id;
            const code = e.target.dataset.code;
            const name = e.target.dataset.name;
            const type = e.target.dataset.type;
            const desc = e.target.dataset.desc;
            openEditAccountModal(id, code, name, type, desc);
        }
    });

    // Cerrar modales al hacer clic fuera
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
}

console.log('✓ App script loaded');
