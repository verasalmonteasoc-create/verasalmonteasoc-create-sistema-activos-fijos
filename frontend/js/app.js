// AUTENTICACIÓN E INICIALIZACIÓN
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
            const data = await res.json();
            currentUser = data.user;
            hideLoginShowApp();
            initApp();
        } else {
            showLogin();
        }
    } catch (e) {
        showLogin();
    }
});

function showLogin() {
    document.getElementById('loginOverlay').style.display = 'flex';
}

function hideLoginShowApp() {
    document.getElementById('loginOverlay').style.display = 'none';

    // Si la clave es temporal / primer ingreso, obligar a cambiarla antes de seguir
    if (currentUser && currentUser.must_change_password) {
        document.getElementById('pwdChangeOverlay').style.display = 'flex';
    }

    // Mostrar info del usuario en el header
    const info = document.getElementById('currentUserInfo');
    if (info && currentUser) {
        const roleLabel = currentUser.role === 'admin' ? 'Administrador' : 'Usuario';
        const name = currentUser.first_name || currentUser.username;
        info.innerHTML = `<i class="fas fa-user-circle"></i> ${name} <span style="background: ${currentUser.role === 'admin' ? '#003D7A' : '#6b7280'}; color: white; padding: 2px 8px; border-radius: 10px; font-size: 11px; margin-left: 5px;">${roleLabel}</span>`;
    }

    // Ocultar opciones solo-admin para usuarios normales
    if (currentUser && currentUser.role !== 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    }
}

async function doLogin(event) {
    event.preventDefault();
    const btn = document.getElementById('loginBtn');
    const errorDiv = document.getElementById('loginError');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
    errorDiv.style.display = 'none';

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: document.getElementById('loginUsername').value.trim(),
                password: document.getElementById('loginPassword').value,
                remember: true
            })
        });
        const data = await res.json();

        if (data.success) {
            currentUser = data.user;
            currentUser.is_admin = data.user.role === 'admin';
            hideLoginShowApp();
            initApp();
        } else {
            errorDiv.textContent = data.message || 'Credenciales incorrectas';
            errorDiv.style.display = 'block';
        }
    } catch (e) {
        errorDiv.textContent = 'Error de conexión con el servidor';
        errorDiv.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Iniciar Sesión';
    }
}

async function doLogout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) { /* ignorar */ }
    window.location.reload();
}

async function submitPasswordChange(event) {
    event.preventDefault();
    const p1 = document.getElementById('newPwd1').value;
    const p2 = document.getElementById('newPwd2').value;
    const errorDiv = document.getElementById('pwdChangeError');
    const btn = document.getElementById('pwdChangeBtn');
    errorDiv.style.display = 'none';

    if (p1 !== p2) {
        errorDiv.textContent = 'Las contraseñas no coinciden.';
        errorDiv.style.display = 'block';
        return;
    }
    if (p1.length < 8) {
        errorDiv.textContent = 'La contraseña debe tener al menos 8 caracteres.';
        errorDiv.style.display = 'block';
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    try {
        const res = await fetch(`/api/auth/users/${currentUser.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: p1 })
        });
        const data = await res.json();
        if (data.success) {
            currentUser.must_change_password = false;
            document.getElementById('pwdChangeOverlay').style.display = 'none';
        } else {
            errorDiv.textContent = data.message || 'No se pudo cambiar la contraseña.';
            errorDiv.style.display = 'block';
        }
    } catch (e) {
        errorDiv.textContent = 'Error de conexión.';
        errorDiv.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check"></i> Guardar y continuar';
    }
}

function initApp() {
    initNavigation();
    loadDashboard();
    loadDashboardWidgets();
    loadDashboardExtras();
    loadAccounts();
    loadCategories();
    loadDepartments();
    loadLocations();
    loadAssets();
    setupFormHandlers();

    // Agregar event listeners a los filtros
    document.getElementById('assetFilter').addEventListener('change', loadDashboard);
    document.getElementById('departmentFilter').addEventListener('change', loadDashboard);

    // Si se accede vía QR (?asset_id=123), abrir el detalle en modo visualización
    const urlParams = new URLSearchParams(window.location.search);
    const qrAssetId = urlParams.get('asset_id');
    if (qrAssetId) {
        viewAssetDetails(qrAssetId, true);
    }

    console.log('✓ Aplicación iniciada');
}

// DASHBOARD FINANCIERO
let dashboardCharts = {};
const COLORS = { blue: '#0EA5E9', orange: '#F97316', green: '#10B981' };

async function loadDashboard() {
    try {
        const [assetsRes, categoriesRes] = await Promise.all([
            fetch('/api/assets?per_page=500'),
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
        const allAssetsForCalc = assets.length > 0 ? assets : allAssets;
        const grossValue = allAssetsForCalc.reduce((s, a) => s + parseFloat(a.acquisition_cost), 0);

        const depreciatedValue = allAssetsForCalc.reduce((s, a) => {
            const accumulated = parseFloat(a.accumulated_depreciation);
            if (accumulated > 0) {
                return s + accumulated;
            }

            const acquisitionDate = new Date(a.acquisition_date);
            const millisecondsSinceAcquisition = today - acquisitionDate;
            const monthsSinceAcquisition = millisecondsSinceAcquisition / (1000 * 60 * 60 * 24 * 30.44);
            const usefulLife = parseInt(a.useful_life_years);
            const acquisitionCost = parseFloat(a.acquisition_cost);
            const residualPercent = parseFloat(a.residual_value_percent);
            const residualValue = acquisitionCost * (residualPercent / 100);
            const depreciableAmount = acquisitionCost - residualValue;
            const monthsOfUsefulLife = usefulLife * 12;
            const monthlyDepreciation = depreciableAmount / monthsOfUsefulLife;
            const calculatedDepreciation = Math.min(monthlyDepreciation * Math.max(0, monthsSinceAcquisition), depreciableAmount);

            return s + calculatedDepreciation;
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
            if (page === 'search-assets') initSearchAssets();
            if (page === 'accounting') loadAccounts();
            if (page === 'depreciation') initDepreciationMonth();
            if (page === 'categories') loadCategories();
            if (page === 'departments') loadDepartments();
            if (page === 'locations') loadLocations();
            if (page === 'assets') loadAssets();
            if (page === 'users') loadUsers();
            if (page === 'config') loadConfigPage();
            if (page === 'inventory') loadInventoryPage();
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

function openImportAccountsModal() {
    document.getElementById('importAccountsModal').classList.add('active');
    document.getElementById('importProgress').style.display = 'none';
    document.getElementById('importResults').style.display = 'none';
    document.getElementById('importAccountsFile').value = '';
}

function closeImportAccountsModal() {
    document.getElementById('importAccountsModal').classList.remove('active');
    document.getElementById('importAccountsFile').value = '';
}

async function submitImportAccounts(e) {
    e.preventDefault();
    const fileInput = document.getElementById('importAccountsFile');
    const file = fileInput.files[0];

    if (!file) {
        alert('Por favor selecciona un archivo');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        document.getElementById('importProgress').style.display = 'block';
        document.getElementById('importResults').style.display = 'none';

        const res = await fetch('/api/accounting/accounts/import', {
            method: 'POST',
            body: formData
        });

        const data = await res.json();
        document.getElementById('importProgress').style.display = 'none';
        document.getElementById('importResults').style.display = 'block';

        if (data.success) {
            let resultText = `✓ ${data.imported_count} cuentas importadas exitosamente`;
            if (data.errors && data.errors.length > 0) {
                resultText += ` (${data.errors.length} errores)`;
            }
            document.getElementById('importResultsText').innerHTML = resultText;

            if (data.errors && data.errors.length > 0) {
                const errorsList = document.getElementById('importErrorsList');
                errorsList.innerHTML = data.errors.map(err => `<li>${err}</li>`).join('');
            }

            setTimeout(() => {
                closeImportAccountsModal();
                loadAccounts();
            }, 2000);
        } else {
            document.getElementById('importResultsText').innerHTML = `✗ Error: ${data.message}`;
        }
    } catch (error) {
        document.getElementById('importProgress').style.display = 'none';
        document.getElementById('importResults').style.display = 'block';
        document.getElementById('importResultsText').innerHTML = `✗ Error: ${error.message}`;
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
                        <button class="btn" onclick="openEditCategoryModal(${cat.id}, '${cat.name.replace(/'/g, "\\'")}', ${cat.depreciation_rate}, '${(cat.description || '').replace(/'/g, "\\'")}'${cat.asset_account ? `, '${cat.asset_account}'` : `, ''`}, '${cat.accumulated_depreciation_account || ''}', '${cat.depreciation_expense_account || ''}')" >Editar</button>
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

async function openCategoryModal() {
    // Cargar cuentas contables
    try {
        const res = await fetch('/api/accounting/accounts');
        const data = await res.json();

        if (data.success && data.accounts.length > 0) {
            const accountOptions = '<option value="">Seleccionar cuenta...</option>' +
                data.accounts.map(acc => `<option value="${acc.code}">${acc.code} - ${acc.name}</option>`).join('');

            document.getElementById('categoryAssetAccount').innerHTML = accountOptions;
            document.getElementById('categoryAccumDeprecAccount').innerHTML = accountOptions;
            document.getElementById('categoryDeprecExpenseAccount').innerHTML = accountOptions;
        }
    } catch (error) {
        console.error('Error cargando cuentas:', error);
    }

    // Limpiar formulario
    document.getElementById('categoryForm').reset();
    document.getElementById('categoryModal').classList.add('active');
}

function closeCategoryModal() {
    document.getElementById('categoryModal').classList.remove('active');
}

async function submitCategory(e) {
    e.preventDefault();
    const name = document.getElementById('categoryName').value;
    const rate = document.getElementById('categoryRate').value;
    const description = document.getElementById('categoryDesc').value;
    const assetAccount = document.getElementById('categoryAssetAccount').value;
    const accumDeprecAccount = document.getElementById('categoryAccumDeprecAccount').value;
    const deprecExpenseAccount = document.getElementById('categoryDeprecExpenseAccount').value;

    try {
        const res = await fetch('/api/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                depreciation_rate: rate,
                description,
                asset_account: assetAccount,
                accumulated_depreciation_account: accumDeprecAccount,
                depreciation_expense_account: deprecExpenseAccount
            })
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

async function openEditCategoryModal(id, name, rate, desc, assetAcc, accumAcc, expenseAcc) {
    // Cargar cuentas contables
    try {
        const res = await fetch('/api/accounting/accounts');
        const data = await res.json();

        if (data.success && data.accounts.length > 0) {
            const accountOptions = '<option value="">Seleccionar cuenta...</option>' +
                data.accounts.map(acc => `<option value="${acc.code}">${acc.code} - ${acc.name}</option>`).join('');

            document.getElementById('editCategoryAssetAccount').innerHTML = accountOptions;
            document.getElementById('editCategoryAccumDeprecAccount').innerHTML = accountOptions;
            document.getElementById('editCategoryDeprecExpenseAccount').innerHTML = accountOptions;

            // Seleccionar las cuentas vinculadas
            if (assetAcc) document.getElementById('editCategoryAssetAccount').value = assetAcc;
            if (accumAcc) document.getElementById('editCategoryAccumDeprecAccount').value = accumAcc;
            if (expenseAcc) document.getElementById('editCategoryDeprecExpenseAccount').value = expenseAcc;
        }
    } catch (error) {
        console.error('Error cargando cuentas:', error);
    }

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
    const assetAccount = document.getElementById('editCategoryAssetAccount').value;
    const accumDeprecAccount = document.getElementById('editCategoryAccumDeprecAccount').value;
    const deprecExpenseAccount = document.getElementById('editCategoryDeprecExpenseAccount').value;

    try {
        const res = await fetch(`/api/categories/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                depreciation_rate: rate,
                description: desc,
                asset_account: assetAccount,
                accumulated_depreciation_account: accumDeprecAccount,
                depreciation_expense_account: deprecExpenseAccount
            })
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

function openImportDepartmentsModal() {
    document.getElementById('importDepartmentsModal').classList.add('active');
    document.getElementById('importDepartmentsResults').style.display = 'none';
    document.getElementById('importDepartmentsFile').value = '';
}

function closeImportDepartmentsModal() {
    document.getElementById('importDepartmentsModal').classList.remove('active');
}

async function submitImportDepartments(e) {
    e.preventDefault();
    const file = document.getElementById('importDepartmentsFile').files[0];

    if (!file) {
        alert('Selecciona un archivo');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        document.getElementById('importDepartmentsProgress').style.display = 'block';
        document.getElementById('importDepartmentsResults').style.display = 'none';

        const res = await fetch('/api/departments/import', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        document.getElementById('importDepartmentsProgress').style.display = 'none';
        document.getElementById('importDepartmentsResults').style.display = 'block';

        if (data.success) {
            let resultsText = `✓ ${data.imported_count} departamentos importados exitosamente`;
            if (data.errors && data.errors.length > 0) {
                resultsText += `\n\n⚠ ${data.errors.length} errores:`;
            }
            document.getElementById('importDepartmentsResultsText').textContent = resultsText;

            if (data.errors && data.errors.length > 0) {
                const errorsList = document.getElementById('importDepartmentsErrorsList');
                errorsList.innerHTML = data.errors.map(err => `<li>${err}</li>`).join('');
            }

            setTimeout(() => {
                closeImportDepartmentsModal();
                loadDepartments();
                loadAssets();
            }, 2000);
        } else {
            document.getElementById('importDepartmentsResultsText').textContent = `✗ Error: ${data.message}`;
        }
    } catch (error) {
        document.getElementById('importDepartmentsProgress').style.display = 'none';
        document.getElementById('importDepartmentsResults').style.display = 'block';
        document.getElementById('importDepartmentsResultsText').textContent = `✗ Error: ${error.message}`;
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
            fetch('/api/assets?per_page=500'),
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
                        <button class="btn" onclick="openEditAssetModal(${JSON.stringify(asset).replace(/"/g, '&quot;')})" style="font-size: 12px;">Editar</button>
                        <button class="btn" onclick="showAssetQR(${asset.id}, '${asset.code}')" style="background: #8B5CF6; font-size: 12px;"><i class="fas fa-qrcode"></i> QR</button>
                        <button class="btn btn-danger" onclick="deleteAsset(${asset.id})" style="font-size: 12px;">Eliminar</button>
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
    document.getElementById('importAccountsForm').addEventListener('submit', submitImportAccounts);
    document.getElementById('categoryForm').addEventListener('submit', submitCategory);
    document.getElementById('editCategoryForm').addEventListener('submit', submitEditCategory);
    document.getElementById('assetForm').addEventListener('submit', submitAsset);
    document.getElementById('editAssetForm').addEventListener('submit', submitEditAsset);
    document.getElementById('departmentForm').addEventListener('submit', submitDepartment);
    document.getElementById('importDepartmentsForm').addEventListener('submit', submitImportDepartments);
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

// CONSULTA Y BÚSQUEDA DE ACTIVOS
let allAssetsForSearch = [];

async function initSearchAssets() {
    try {
        const [assetsRes, categoriesRes, deptsRes] = await Promise.all([
            fetch('/api/assets'),
            fetch('/api/categories'),
            fetch('/api/departments')
        ]);

        allAssetsForSearch = await assetsRes.json();
        const categories = await categoriesRes.json();
        const departments = await deptsRes.json();

        // Poblar dropdowns de búsqueda
        if (categories.success) {
            const catSelect = document.getElementById('searchCategory');
            catSelect.innerHTML = '<option value="">Todas las Categorías</option>' +
                categories.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }

        if (departments.success) {
            const deptSelect = document.getElementById('searchDepartment');
            deptSelect.innerHTML = '<option value="">Todos los Departamentos</option>' +
                departments.departments.map(d => `<option value="${d.name}">${d.name}</option>`).join('');
        }

        searchAssets();
    } catch (error) {
        console.error('Error inicializando búsqueda:', error);
    }
}

async function searchAssets() {
    if (!allAssetsForSearch.success) return;

    const searchTerm = (document.getElementById('searchInput')?.value || '').toLowerCase();
    const categoryId = document.getElementById('searchCategory')?.value || '';
    const department = document.getElementById('searchDepartment')?.value || '';
    const status = document.getElementById('searchStatus')?.value || '';

    let results = allAssetsForSearch.assets.filter(asset => {
        const matchSearch = !searchTerm ||
            asset.code.toLowerCase().includes(searchTerm) ||
            asset.description.toLowerCase().includes(searchTerm);
        const matchCat = !categoryId || asset.category.id == categoryId;
        const matchDept = !department || asset.department === department;
        const matchStatus = !status || asset.status === status;
        return matchSearch && matchCat && matchDept && matchStatus;
    });

    const tbody = document.getElementById('searchResultsTable');
    if (results.length > 0) {
        tbody.innerHTML = results.map(asset => `
            <tr>
                <td>${asset.code}</td>
                <td>${asset.description}</td>
                <td>${asset.category.name}</td>
                <td>${asset.department || '-'}</td>
                <td>RD$ ${parseFloat(asset.acquisition_cost).toLocaleString('es-DO', {maximumFractionDigits: 0})}</td>
                <td><span style="padding: 5px 10px; border-radius: 3px; background: ${asset.status === 'active' ? '#28a745' : '#dc3545'}; color: white;">${asset.status === 'active' ? 'Activo' : 'Inactivo'}</span></td>
                <td><button class="btn" onclick="viewAssetDetails(${asset.id})">Ver Detalles</button></td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = '<tr><td colspan="7">No se encontraron activos</td></tr>';
    }
}

async function viewAssetDetails(assetId, readOnly = false) {
    try {
        const res = await fetch(`/api/assets/${assetId}`);
        const data = await res.json();

        if (!data.success) {
            alert('Error al cargar los detalles');
            return;
        }

        // Modo visualización (acceso vía QR): ocultar acciones de edición y
        // mostrar el botón de "confirmar existencia" para el conteo físico
        const detailActions = document.getElementById('assetDetailsActions');
        if (detailActions) {
            detailActions.querySelectorAll('.btn-edit-action, .btn-delete-action, .btn-journal-action')
                .forEach(btn => btn.style.display = readOnly ? 'none' : '');
        }
        const verifyBar = document.getElementById('assetVerifyBar');
        if (verifyBar) {
            verifyBar.style.display = readOnly ? 'block' : 'none';
            document.getElementById('assetVerifyResult').innerHTML = '';
        }

        const asset = data.asset;
        const today = new Date();
        const acqDate = new Date(asset.acquisition_date);
        const yearsElapsed = (today - acqDate) / (1000 * 60 * 60 * 24 * 365.25);
        const accumDepreciation = parseFloat(asset.accumulated_depreciation);
        const netValue = parseFloat(asset.net_book_value);
        const deprecPercent = ((accumDepreciation / asset.acquisition_cost) * 100).toFixed(1);

        // Llenar información básica
        document.getElementById('detailCode').textContent = asset.code;
        document.getElementById('detailDesc').textContent = asset.description;
        document.getElementById('detailCategory').textContent = asset.category.name;
        document.getElementById('detailDept').textContent = asset.department || '-';
        document.getElementById('detailLocation').textContent = asset.location_name || '-';
        document.getElementById('detailStatus').textContent = asset.status === 'active' ? 'Activo' : 'Inactivo';

        // Llenar información financiera
        document.getElementById('detailCost').textContent = `RD$ ${parseFloat(asset.acquisition_cost).toLocaleString('es-DO', {maximumFractionDigits: 2})}`;
        document.getElementById('detailAcqDate').textContent = new Date(asset.acquisition_date).toLocaleDateString('es-DO');
        document.getElementById('detailUsefulLife').textContent = `${asset.useful_life_years} años`;
        document.getElementById('detailAccumDepreciation').textContent = `RD$ ${accumDepreciation.toLocaleString('es-DO', {maximumFractionDigits: 2})}`;
        document.getElementById('detailNetValue').textContent = `RD$ ${netValue.toLocaleString('es-DO', {maximumFractionDigits: 2})}`;
        document.getElementById('detailDeprecPercent').textContent = `${deprecPercent}%`;

        // Llenar información técnica
        document.getElementById('detailBrand').textContent = asset.brand || '-';
        document.getElementById('detailModel').textContent = asset.model || '-';
        document.getElementById('detailYear').textContent = asset.year_manufactured || '-';
        document.getElementById('detailColor').textContent = asset.color || '-';
        document.getElementById('detailUser').textContent = asset.asset_user || '-';
        document.getElementById('detailPhysicalLoc').textContent = asset.physical_location || '-';
        document.getElementById('detailWarranty').textContent = asset.warranty || '-';
        document.getElementById('detailCondition').textContent = asset.asset_condition || '-';
        document.getElementById('detailSupplier').textContent = asset.supplier_name || '-';

        // Mostrar información específica según categoría
        const vehicleEquipInfo = document.getElementById('vehicleEquipmentInfo');
        const vehicleFields = document.getElementById('vehicleFields');
        const equipmentFields = document.getElementById('equipmentFields');

        if (asset.plate_number || asset.chassis) {
            vehicleEquipInfo.style.display = 'block';
            vehicleFields.style.display = 'block';
            equipmentFields.style.display = 'none';
            document.getElementById('detailPlate').textContent = asset.plate_number || '-';
            document.getElementById('detailChassis').textContent = asset.chassis || '-';
        } else if (asset.equipment_serial || asset.equipment_supplier) {
            vehicleEquipInfo.style.display = 'block';
            vehicleFields.style.display = 'none';
            equipmentFields.style.display = 'block';
            document.getElementById('detailEquipSerial').textContent = asset.equipment_serial || '-';
            document.getElementById('detailEquipSupplier').textContent = asset.equipment_supplier || '-';
        } else {
            vehicleEquipInfo.style.display = 'none';
        }

        // Llenar información de compra
        const residualValue = parseFloat(asset.acquisition_cost) * (parseFloat(asset.residual_value_percent) / 100);
        const depreciableAmount = parseFloat(asset.acquisition_cost) - residualValue;
        const monthlyDepreciation = depreciableAmount / (asset.useful_life_years * 12);
        const totalMonthsElapsed = yearsElapsed * 12;
        const monthsRemaining = Math.max(0, (asset.useful_life_years * 12) - totalMonthsElapsed);
        const yearsRemaining = (monthsRemaining / 12).toFixed(1);

        document.getElementById('detailPurchaseSupplier').textContent = asset.supplier_name || '-';
        document.getElementById('detailPurchaseDate').textContent = new Date(asset.acquisition_date).toLocaleDateString('es-DO');
        document.getElementById('detailPurchaseCost').textContent = `RD$ ${parseFloat(asset.acquisition_cost).toLocaleString('es-DO', {maximumFractionDigits: 2})}`;
        document.getElementById('detailInvoiceNumber').textContent = asset.invoice_filename || '-';
        document.getElementById('detailFiscalReceipt').textContent = asset.fiscal_receipt_number || '-';

        // Mostrar link de factura si existe
        if (asset.invoice_filename) {
            document.getElementById('detailInvoiceFile').innerHTML = `<a href="#" style="color: #003D7A; text-decoration: underline;">📄 ${asset.invoice_filename}</a>`;
        } else {
            document.getElementById('detailInvoiceFile').textContent = 'Sin documento adjunto';
        }

        document.getElementById('detailResidualPercent').textContent = `${asset.residual_value_percent}%`;
        document.getElementById('detailResidualValue').textContent = `RD$ ${residualValue.toLocaleString('es-DO', {maximumFractionDigits: 2})}`;
        document.getElementById('detailDepreciationYears').textContent = asset.useful_life_years;

        // Llenar auditoría
        document.getElementById('detailCreatedAt').textContent = new Date(asset.created_at).toLocaleString('es-DO');
        document.getElementById('detailUpdatedAt').textContent = new Date(asset.updated_at).toLocaleString('es-DO');

        // Guardar ID para acciones
        document.getElementById('assetDetailsModal').dataset.assetId = assetId;

        // Abrir modal
        document.getElementById('assetDetailsModal').classList.add('active');
    } catch (error) {
        console.error('Error:', error);
        alert('Error al cargar los detalles del activo');
    }
}

function closeAssetDetailsModal() {
    document.getElementById('assetDetailsModal').classList.remove('active');
}

function editAssetFromDetails() {
    const assetId = document.getElementById('assetDetailsModal').dataset.assetId;
    closeAssetDetailsModal();
    // Buscar el asset en la tabla de activos y abrirlo
    const allAssets = document.querySelectorAll('#assetsTable tr');
    let found = false;
    allAssets.forEach(row => {
        const code = row.textContent;
        if (code.includes(document.getElementById('detailCode').textContent)) {
            const editBtn = row.querySelector('button:contains("Editar")');
            if (editBtn) {
                editBtn.click();
                found = true;
            }
        }
    });
    if (!found) {
        alert('Abre la sección "Activos" para editar este activo');
    }
}

function deleteAssetFromDetails() {
    const assetId = document.getElementById('assetDetailsModal').dataset.assetId;
    if (confirm('¿Eliminar este activo?')) {
        fetch(`/api/assets/${assetId}`, { method: 'DELETE' })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    alert('✓ Activo eliminado');
                    closeAssetDetailsModal();
                    searchAssets();
                } else {
                    alert('Error: ' + data.message);
                }
            })
            .catch(error => alert('Error: ' + error.message));
    }
}

// IMPORTAR ACTIVOS DESDE EXCEL
function openImportAssetsModal() {
    document.getElementById('importAssetsModal').classList.add('active');
    document.getElementById('importAssetsForm').reset();
    document.getElementById('importAssetsProgress').style.display = 'none';
    document.getElementById('importAssetsResultsList').style.display = 'none';
}

function closeImportAssetsModal() {
    document.getElementById('importAssetsModal').classList.remove('active');
}

async function submitImportAssets(e) {
    e.preventDefault();
    const file = document.getElementById('importAssetsFile').files[0];
    if (!file) {
        alert('Selecciona un archivo');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    document.getElementById('importAssetsProgress').style.display = 'block';

    try {
        const res = await fetch('/api/assets/import', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        document.getElementById('importAssetsProgress').style.display = 'none';
        document.getElementById('importAssetsResultsList').style.display = 'block';

        const resultsList = document.getElementById('importAssetsResultsList');
        resultsList.innerHTML = '';

        if (data.success) {
            const msg = document.createElement('li');
            msg.style.color = '#28a745';
            msg.textContent = `✓ ${data.imported_count} activos importados`;
            resultsList.appendChild(msg);

            if (data.errors && data.errors.length > 0) {
                const errTitle = document.createElement('li');
                errTitle.style.color = '#dc3545';
                errTitle.style.fontWeight = 'bold';
                errTitle.textContent = `Errores encontrados (${data.errors.length}):`;
                resultsList.appendChild(errTitle);

                data.errors.forEach(err => {
                    const li = document.createElement('li');
                    li.style.color = '#dc3545';
                    li.textContent = err;
                    li.style.marginLeft = '20px';
                    resultsList.appendChild(li);
                });
            }

            setTimeout(() => {
                closeImportAssetsModal();
                loadAssets();
                loadDashboard();
            }, 2000);
        } else {
            const errLi = document.createElement('li');
            errLi.style.color = '#dc3545';
            errLi.textContent = `✗ Error: ${data.message}`;
            resultsList.appendChild(errLi);
        }
    } catch (error) {
        document.getElementById('importAssetsProgress').style.display = 'none';
        alert('Error: ' + error.message);
    }
}

// DEPRECIACIÓN MENSUAL
let depreciationData = null;

function initDepreciationMonth() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    document.getElementById('depreciationMonth').value = `${year}-${month}`;
    loadPreviousMonths();
}

async function loadPreviousMonths() {
    try {
        const response = await fetch('/api/depreciation/months');
        const data = await response.json();

        if (data.success && data.months.length > 0) {
            const selectFrom = document.getElementById('monthFromSelect');
            const selectTo = document.getElementById('monthToSelect');

            selectFrom.innerHTML = '<option value="">Seleccionar mes...</option>';
            selectTo.innerHTML = '<option value="">Seleccionar mes...</option>';

            data.months.forEach(month => {
                const value = `${month.year}-${String(month.month).padStart(2, '0')}`;

                const optionFrom = document.createElement('option');
                optionFrom.value = value;
                optionFrom.textContent = month.display;
                selectFrom.appendChild(optionFrom);

                const optionTo = document.createElement('option');
                optionTo.value = value;
                optionTo.textContent = month.display;
                selectTo.appendChild(optionTo);
            });

            // Seleccionar el primer mes en "Desde" y el último en "Hasta"
            if (data.months.length > 0) {
                selectFrom.value = `${data.months[data.months.length - 1].year}-${String(data.months[data.months.length - 1].month).padStart(2, '0')}`;
                selectTo.value = `${data.months[0].year}-${String(data.months[0].month).padStart(2, '0')}`;
                updatePeriodSummary();

                // Agregar event listeners
                selectFrom.addEventListener('change', updatePeriodSummary);
                selectTo.addEventListener('change', updatePeriodSummary);
            }

            document.getElementById('previousMonthsSection').style.display = 'block';
        } else {
            document.getElementById('previousMonthsSection').style.display = 'none';
        }
    } catch (error) {
        console.error('Error cargando meses anteriores:', error);
    }
}

async function calculateDepreciation() {
    try {
        const monthInput = document.getElementById('depreciationMonth').value;
        if (!monthInput) {
            alert('Por favor selecciona un mes y año');
            return;
        }

        const [year, month] = monthInput.split('-');

        // El cálculo lo hace el SERVIDOR (fuente de verdad). El cliente solo pide el período.
        const res = await fetch(`/api/depreciation/preview?year=${parseInt(year)}&month=${parseInt(month)}`);
        const data = await res.json();

        if (!data.success) {
            alert('Error: ' + (data.message || 'no se pudo calcular la depreciación'));
            return;
        }

        if (data.already_processed) {
            alert('⚠ La depreciación de este período ya fue procesada. Se muestra solo como referencia; no se puede volver a contabilizar.');
        }

        if (!data.details || data.details.length === 0) {
            alert('No hay activos por depreciar en este período.');
            return;
        }

        depreciationData = {
            year: data.year,
            month: data.month,
            alreadyProcessed: data.already_processed,
            monthStr: new Date(`${year}-${month}-01`).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
            totalAssets: data.total_assets,
            totalDepreciation: data.total_depreciation,
            details: data.details
        };

        displayDepreciationPreview();

    } catch (error) {
        alert('Error: ' + error.message);
    }
}

function displayDepreciationPreview() {
    // Mostrar resumen
    document.getElementById('depreciationSummary').style.display = 'block';
    document.getElementById('depreciationDetails').style.display = 'block';
    document.getElementById('depreciationActions').style.display = 'block';
    document.getElementById('depreciationMessage').style.display = 'none';

    document.getElementById('assetsCount').textContent = depreciationData.totalAssets;
    document.getElementById('totalDepreciation').textContent = 'RD$ ' + depreciationData.totalDepreciation.toFixed(2);
    document.getElementById('depreciationPeriod').textContent = depreciationData.monthStr;

    // Mostrar tabla
    const tbody = document.getElementById('depreciationTable');
    tbody.innerHTML = '';

    depreciationData.details.forEach(d => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${d.code}</td>
            <td>${d.description}</td>
            <td>${d.category}</td>
            <td>RD$ ${d.cost.toFixed(2)}</td>
            <td>RD$ ${d.monthlyDepreciation.toFixed(2)}</td>
            <td>RD$ ${d.previousAccumulated.toFixed(2)}</td>
            <td>RD$ ${d.newAccumulated.toFixed(2)}</td>
        `;
        tbody.appendChild(row);
    });
}

async function processMonthlyDepreciation() {
    try {
        if (!depreciationData) {
            alert('Debe calcular depreciación primero');
            return;
        }

        const btn = event.target;
        btn.disabled = true;
        btn.textContent = 'Procesando...';

        // El servidor recalcula: solo se envía el período (no montos del cliente)
        const response = await fetch('/api/depreciation/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                year: depreciationData.year,
                month: depreciationData.month
            })
        });

        const data = await response.json();

        if (data.success) {
            document.getElementById('depreciationSummary').style.display = 'none';
            document.getElementById('depreciationDetails').style.display = 'none';
            document.getElementById('depreciationActions').style.display = 'none';

            const msgDiv = document.getElementById('depreciationMessage');
            msgDiv.style.display = 'block';
            msgDiv.style.background = '#d4edda';
            msgDiv.style.borderLeft = '4px solid #28a745';
            msgDiv.style.padding = '15px';
            msgDiv.innerHTML = `
                <h4 style="color: #155724; margin-top: 0;">✓ Depreciación Procesada Exitosamente</h4>
                <p><strong>Período:</strong> ${depreciationData.monthStr}</p>
                <p><strong>Activos Procesados:</strong> ${depreciationData.totalAssets}</p>
                <p><strong>Depreciación Total:</strong> RD$ ${depreciationData.totalDepreciation.toFixed(2)}</p>
                <p><strong>Asiento Contable Generado:</strong> ${data.reference}</p>
                <p style="font-size: 12px; color: #666; margin-bottom: 10px;">
                    Se generó un asiento automático debitando la cuenta de Gasto de Depreciación y acreditando Depreciación Acumulada.
                </p>
                <button class="btn btn-success" onclick="downloadDepreciationReport(${depreciationData.year}, ${depreciationData.month})" style="background: #28a745; margin-top: 10px;">
                    Descargar Reporte Excel
                </button>
            `;

            depreciationData = null;
            setTimeout(() => {
                loadDashboard();
                loadAssets();
            }, 3000);
        } else {
            const msgDiv = document.getElementById('depreciationMessage');
            msgDiv.style.display = 'block';
            msgDiv.style.background = '#f8d7da';
            msgDiv.style.borderLeft = '4px solid #dc3545';
            msgDiv.style.padding = '15px';
            if (response.status === 409) {
                msgDiv.innerHTML = `<h4 style="color: #721c24; margin-top: 0;">⚠ Mes ya Procesado</h4><p style="color: #721c24;">${data.message}</p>`;
            } else {
                msgDiv.innerHTML = `<h4 style="color: #721c24; margin-top: 0;">✗ Error</h4><p style="color: #721c24;">${data.message}</p>`;
            }
        }

        btn.disabled = false;
        btn.textContent = '✓ Procesar Depreciación y Generar Asiento';

    } catch (error) {
        alert('Error: ' + error.message);
        event.target.disabled = false;
        event.target.textContent = '✓ Procesar Depreciación y Generar Asiento';
    }
}

function downloadDepreciationReport(year, month) {
    const url = `/api/depreciation/report?year=${year}&month=${month}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = `Depreciacion_${year}_${String(month).padStart(2, '0')}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function updatePeriodSummary() {
    const monthFromSelect = document.getElementById('monthFromSelect');
    const monthToSelect = document.getElementById('monthToSelect');
    const valueFrom = monthFromSelect.value;
    const valueTo = monthToSelect.value;

    if (!valueFrom || !valueTo) {
        document.getElementById('periodSummary').style.display = 'none';
        return;
    }

    const dateFrom = new Date(valueFrom + '-01');
    const dateTo = new Date(valueTo + '-01');

    if (dateFrom > dateTo) {
        alert('La fecha "Desde" no puede ser posterior a "Hasta"');
        return;
    }

    const textFrom = monthFromSelect.options[monthFromSelect.selectedIndex].text;
    const textTo = monthToSelect.options[monthToSelect.selectedIndex].text;
    document.getElementById('periodText').textContent = `${textFrom} a ${textTo}`;

    // Calcular depreciación total del período
    calculatePeriodDepreciation(valueFrom, valueTo);

    document.getElementById('periodSummary').style.display = 'block';
}

async function calculatePeriodDepreciation(monthFrom, monthTo) {
    try {
        const response = await fetch(`/api/depreciation/period-total?from=${monthFrom}&to=${monthTo}`);
        const data = await response.json();

        if (data.success) {
            document.getElementById('periodDepreciation').textContent = `RD$ ${data.total_depreciation.toFixed(2)}`;
        }
    } catch (error) {
        console.error('Error calculando depreciación del período:', error);
    }
}

function downloadPeriodReport() {
    const monthFromSelect = document.getElementById('monthFromSelect');
    const monthToSelect = document.getElementById('monthToSelect');
    const valueFrom = monthFromSelect.value;
    const valueTo = monthToSelect.value;

    if (!valueFrom || !valueTo) {
        alert('Por favor selecciona ambas fechas');
        return;
    }

    const dateFrom = new Date(valueFrom + '-01');
    const dateTo = new Date(valueTo + '-01');

    if (dateFrom > dateTo) {
        alert('La fecha "Desde" no puede ser posterior a "Hasta"');
        return;
    }

    const [yearFrom, monthFrom] = valueFrom.split('-');
    const [yearTo, monthTo] = valueTo.split('-');

    const url = `/api/depreciation/period-report?year_from=${yearFrom}&month_from=${monthFrom}&year_to=${yearTo}&month_to=${monthTo}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = `Depreciacion_${yearFrom}_${monthFrom}_a_${yearTo}_${monthTo}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function cancelDepreciation() {
    document.getElementById('depreciationMonth').value = '';
    document.getElementById('depreciationSummary').style.display = 'none';
    document.getElementById('depreciationDetails').style.display = 'none';
    document.getElementById('depreciationActions').style.display = 'none';
    document.getElementById('depreciationMessage').style.display = 'none';
    depreciationData = null;
}

// ====== REPORTES SAP ======
function getReportParams() {
    const year = document.getElementById('reportYear').value;
    const month = document.getElementById('reportMonth').value;
    let params = `year=${year}`;
    if (month) params += `&month=${month}`;
    return params;
}

function downloadDepreciationDetail() {
    const params = getReportParams();
    window.location.href = `/api/reports/depreciation-detail-excel?${params}`;
}

function downloadDepreciationSummary() {
    const params = getReportParams();
    window.location.href = `/api/reports/depreciation-summary-excel?${params}`;
}

function downloadJournalEntries() {
    const params = getReportParams();
    window.location.href = `/api/reports/journal-entries-excel?${params}`;
}

function downloadAssetMovement() {
    const year = document.getElementById('reportYear').value;
    window.location.href = `/api/reports/asset-movement-excel?year=${year}`;
}

function downloadReconciliation() {
    window.location.href = `/api/reports/reconciliation-excel`;
}

function downloadAuditTrail() {
    window.location.href = `/api/reports/audit-trail-excel?days=30`;
}

// ====== CÓDIGO QR ======
async function showAssetQR(assetId, assetCode) {
    try {
        const response = await fetch(`/api/assets/${assetId}/qrcode-data`);
        const data = await response.json();

        if (data.success) {
            // Crear modal con QR
            const modal = document.getElementById('qrModal');
            document.getElementById('qrAssetCode').textContent = data.asset_code;
            document.getElementById('qrAssetDesc').textContent = data.asset_description;
            document.getElementById('qrImage').src = data.qr_data_uri;

            // Guardar el ID del asset para descargar
            document.getElementById('qrDownloadBtn').onclick = () => downloadAssetQR(assetId, data.asset_code);

            modal.classList.add('active');
        }
    } catch (error) {
        console.error('Error generando QR:', error);
        alert('Error al generar el código QR');
    }
}

function downloadAssetQR(assetId, assetCode) {
    const link = document.createElement('a');
    link.href = `/api/assets/${assetId}/qrcode`;
    link.download = `QR_${assetCode}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function closeQRModal() {
    document.getElementById('qrModal').classList.remove('active');
}

function printQR() {
    const printWindow = window.open('', '', 'width=600, height=700');
    const qrImage = document.getElementById('qrImage').src;
    const assetCode = document.getElementById('qrAssetCode').textContent;
    const assetDesc = document.getElementById('qrAssetDesc').textContent;

    printWindow.document.write(`
        <html>
            <head>
                <title>QR - ${assetCode}</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
                    h2 { color: #003D7A; margin-bottom: 20px; }
                    .qr-container { padding: 20px; border: 2px solid #ddd; border-radius: 8px; margin: 20px 0; }
                    img { max-width: 400px; height: auto; }
                    .info { margin: 20px 0; font-size: 14px; }
                    .info p { margin: 5px 0; }
                </style>
            </head>
            <body>
                <h2>CÓDIGO QR DE ACTIVO</h2>
                <div class="info">
                    <p><strong>Código:</strong> ${assetCode}</p>
                    <p><strong>Descripción:</strong> ${assetDesc}</p>
                </div>
                <div class="qr-container">
                    <img src="${qrImage}" alt="QR Code">
                </div>
                <p style="font-size: 12px; margin-top: 20px; color: #666;">Escanea este código QR para ver los detalles del activo</p>
            </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

// ====== ASIENTOS CONTABLES ======
async function createAssetJournalEntry() {
    const assetId = document.getElementById('assetDetailsModal').dataset.assetId;

    if (!assetId) {
        alert('No se ha seleccionado un activo');
        return;
    }

    try {
        const response = await fetch(`/api/depreciation/asset-entry/${assetId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (data.success) {
            alert(`✓ Asiento contable creado correctamente\n\nAsiento ID: ${data.entry.id}\nFecha: ${data.entry.entry_date}\nEstado: ${data.entry.status}\nMonto: RD$ ${parseFloat(data.entry.amount).toLocaleString('es-DO', {minimumFractionDigits: 2})}`);
            closeAssetDetailsModal();
        } else {
            alert(`Error: ${data.message}`);
        }
    } catch (error) {
        console.error('Error creando asiento contable:', error);
        alert('Error al crear el asiento contable');
    }
}

// CONFIGURACIÓN - CARGA DE DATOS
async function importAuxiliar() {
    const file = document.getElementById('auxFile').files[0];
    if (!file) {
        alert('Por favor selecciona el archivo del auxiliar');
        return;
    }

    if (!confirm('Esta importación REEMPLAZA los activos existentes de las categorías incluidas en el archivo.\n\n¿Deseas continuar?')) {
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    const progress = document.getElementById('auxProgress');
    const result = document.getElementById('auxResult');
    progress.style.display = 'block';
    result.style.display = 'none';

    try {
        const res = await fetch('/api/assets/import-auxiliar', { method: 'POST', body: formData });
        const data = await res.json();
        progress.style.display = 'none';
        result.style.display = 'block';

        if (data.success) {
            const fmt = n => 'RD$ ' + parseFloat(n).toLocaleString('es-DO', {minimumFractionDigits: 2});
            const notInFile = data.not_in_file_count
                ? `<div style="color: #9a6a12; margin-top: 8px; font-size: 13px;">
                     <i class="fas fa-info-circle"></i> ${data.not_in_file_count} activo(s) del sistema no venían en el archivo (posibles bajas) — no se tocaron.
                   </div>` : '';
            result.innerHTML = `
                <div style="background: #f0fdf4; border: 1px solid #10B981; border-radius: 6px; padding: 15px;">
                    <strong style="color: #166534;">✓ ${data.created_count} creados · ${data.updated_count} actualizados</strong><br>
                    <table style="margin-top: 10px; font-size: 13px;">
                        <tr><td style="padding-right: 15px;">Costo de Adquisición:</td><td><strong>${fmt(data.total_cost)}</strong></td></tr>
                        <tr><td>Depreciación Acumulada:</td><td><strong>${fmt(data.total_depreciation)}</strong></td></tr>
                        <tr><td>Valor Neto en Libros:</td><td><strong>${fmt(data.total_net)}</strong></td></tr>
                    </table>
                    ${notInFile}
                    ${data.errors ? `<div style="color: #9a3412; margin-top: 10px;">Advertencias:<br>${data.errors.join('<br>')}</div>` : ''}
                </div>`;
            loadDashboard();
            loadAssets();
            loadDepartments();
        } else {
            result.innerHTML = `<div style="background: #fef2f2; border: 1px solid #dc2626; border-radius: 6px; padding: 15px; color: #991b1b;">
                ✗ ${data.message}${data.errors ? '<br>' + data.errors.join('<br>') : ''}</div>`;
        }
    } catch (error) {
        progress.style.display = 'none';
        result.style.display = 'block';
        result.innerHTML = `<div style="color: #991b1b;">✗ Error: ${error.message}</div>`;
    }
}

async function importConfigFile(inputId, resultId, endpoint, entityLabel, refreshFn) {
    const file = document.getElementById(inputId).files[0];
    if (!file) {
        alert('Por favor selecciona un archivo');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    const result = document.getElementById(resultId);
    result.style.display = 'block';
    result.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Importando...';

    try {
        const res = await fetch(endpoint, { method: 'POST', body: formData });
        const data = await res.json();

        if (data.success) {
            const count = data.imported_count ?? data.imported ?? 0;
            result.innerHTML = `<div style="background: #f0fdf4; border: 1px solid #10B981; border-radius: 6px; padding: 12px; color: #166534;">
                ✓ ${count} ${entityLabel} importados${data.errors && data.errors.length ? ` (${data.errors.length} advertencias)` : ''}</div>`;
            if (refreshFn) refreshFn();
        } else {
            result.innerHTML = `<div style="background: #fef2f2; border: 1px solid #dc2626; border-radius: 6px; padding: 12px; color: #991b1b;">✗ ${data.message}</div>`;
        }
    } catch (error) {
        result.innerHTML = `<div style="color: #991b1b;">✗ Error: ${error.message}</div>`;
    }
}

function importConfigAccounts() {
    importConfigFile('cfgAccountsFile', 'cfgAccountsResult', '/api/accounting/accounts/import', 'cuentas', loadAccounts);
}

function importConfigDepartments() {
    importConfigFile('cfgDeptFile', 'cfgDeptResult', '/api/departments/import', 'departamentos', loadDepartments);
}

// GESTIÓN DE USUARIOS (solo admin)
async function loadUsers() {
    try {
        const res = await fetch('/api/auth/users?per_page=100');
        const data = await res.json();
        const tbody = document.getElementById('usersTable');

        if (data.success && data.users.length > 0) {
            tbody.innerHTML = data.users.map(u => {
                const roleBadge = u.role === 'admin'
                    ? '<span style="background: #003D7A; color: white; padding: 3px 10px; border-radius: 10px; font-size: 12px;">Administrador</span>'
                    : '<span style="background: #6b7280; color: white; padding: 3px 10px; border-radius: 10px; font-size: 12px;">Usuario</span>';
                const statusBadge = u.active
                    ? '<span style="color: #166534;">● Activo</span>'
                    : '<span style="color: #991b1b;">● Inactivo</span>';
                const lastLogin = u.last_login
                    ? new Date(u.last_login).toLocaleString('es-DO')
                    : 'Nunca';
                const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || '-';
                return `
                    <tr>
                        <td><strong>${u.username}</strong></td>
                        <td>${fullName}</td>
                        <td>${u.email}</td>
                        <td>${roleBadge}</td>
                        <td>${statusBadge}</td>
                        <td>${lastLogin}</td>
                        <td>
                            <button class="btn" onclick='openEditUserModal(${JSON.stringify(u)})'>Editar</button>
                        </td>
                    </tr>`;
            }).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="7">No hay usuarios</td></tr>';
        }
    } catch (error) {
        console.error('Error cargando usuarios:', error);
    }
}

function openUserModal() {
    document.getElementById('userModalTitle').textContent = 'Nuevo Usuario';
    document.getElementById('userForm').reset();
    document.getElementById('userId').value = '';
    document.getElementById('userUsername').disabled = false;
    document.getElementById('userPassword').required = true;
    document.getElementById('userPasswordLabel').textContent = 'Contraseña *';
    document.getElementById('userPasswordHint').style.display = 'none';
    document.getElementById('userActiveGroup').style.display = 'none';
    document.getElementById('userModal').classList.add('active');
}

function openEditUserModal(u) {
    document.getElementById('userModalTitle').textContent = `Editar Usuario: ${u.username}`;
    document.getElementById('userForm').reset();
    document.getElementById('userId').value = u.id;
    document.getElementById('userUsername').value = u.username;
    document.getElementById('userUsername').disabled = true;
    document.getElementById('userFirstName').value = u.first_name || '';
    document.getElementById('userLastName').value = u.last_name || '';
    document.getElementById('userEmail').value = u.email;
    document.getElementById('userRole').value = u.role;
    document.getElementById('userActive').value = String(u.active);
    document.getElementById('userPassword').required = false;
    document.getElementById('userPasswordLabel').textContent = 'Nueva Contraseña (opcional)';
    document.getElementById('userPasswordHint').style.display = 'block';
    document.getElementById('userActiveGroup').style.display = 'block';
    document.getElementById('userModal').classList.add('active');
}

function closeUserModal() {
    document.getElementById('userModal').classList.remove('active');
}

async function saveUser(event) {
    event.preventDefault();
    const userId = document.getElementById('userId').value;
    const password = document.getElementById('userPassword').value;

    try {
        let res;
        if (userId) {
            // Editar usuario existente
            const payload = {
                first_name: document.getElementById('userFirstName').value,
                last_name: document.getElementById('userLastName').value,
                email: document.getElementById('userEmail').value,
                role: document.getElementById('userRole').value,
                active: document.getElementById('userActive').value === 'true'
            };
            if (password) payload.password = password;

            res = await fetch(`/api/auth/users/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            // Crear usuario nuevo
            res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: document.getElementById('userUsername').value.trim(),
                    first_name: document.getElementById('userFirstName').value,
                    last_name: document.getElementById('userLastName').value,
                    email: document.getElementById('userEmail').value.trim(),
                    password: password,
                    role: document.getElementById('userRole').value
                })
            });
        }

        const data = await res.json();
        if (data.success) {
            closeUserModal();
            loadUsers();
            alert(userId ? '✓ Usuario actualizado' : '✓ Usuario creado exitosamente');
        } else {
            alert('Error: ' + data.message);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// ═══════════════ FASE 2–4: CICLO DE VIDA, CONFIGURACIÓN, REPORTES ═══════════════
const fmtRD = n => 'RD$ ' + parseFloat(n || 0).toLocaleString('es-DO', {minimumFractionDigits: 2});
const detailAssetId = () => document.getElementById('assetDetailsModal').dataset.assetId;
const todayISO = () => new Date().toISOString().slice(0, 10);

// ---- BAJA / RETIRO ----
async function openRetireModal() {
    const id = detailAssetId();
    document.getElementById('retireDate').value = todayISO();
    document.getElementById('retireAmount').value = 0;
    // Cargar cuentas de banco/caja
    const accRes = await fetch('/api/accounting/accounts');
    const accData = await accRes.json();
    const sel = document.getElementById('retireCashAccount');
    sel.innerHTML = '<option value="">— Seleccionar —</option>' +
        (accData.accounts || []).filter(a => a.account_type === 'Activo')
            .map(a => `<option value="${a.code}">${a.code} — ${a.name}</option>`).join('');
    // Preview de valores
    const r = await fetch(`/api/assets/${id}`);
    const d = await r.json();
    window._retireAsset = d.asset;
    const cost = parseFloat(d.asset.acquisition_cost);
    const accum = parseFloat(d.asset.accumulated_depreciation);
    document.getElementById('retirePreview').innerHTML =
        `<b>${d.asset.code}</b> — ${d.asset.description}<br>
         Costo: ${fmtRD(cost)} · Deprec. acum.: ${fmtRD(accum)} · <b>Valor en libros: ${fmtRD(cost - accum)}</b>`;
    updateRetireGainLoss();
    document.getElementById('retireAmount').oninput = updateRetireGainLoss;
    document.getElementById('retireModal').classList.add('active');
}
function updateRetireGainLoss() {
    if (!window._retireAsset) return;
    const cost = parseFloat(window._retireAsset.acquisition_cost);
    const accum = parseFloat(window._retireAsset.accumulated_depreciation);
    const nbv = cost - accum;
    const amt = parseFloat(document.getElementById('retireAmount').value || 0);
    const gl = amt - nbv;
    const el = document.getElementById('retireGainLoss');
    el.textContent = (gl >= 0 ? 'Ganancia en la baja: ' : 'Pérdida en la baja: ') + fmtRD(Math.abs(gl));
    el.style.color = gl >= 0 ? '#166534' : '#991b1b';
}
async function submitRetire(e) {
    e.preventDefault();
    const id = detailAssetId();
    const body = {
        disposal_date: document.getElementById('retireDate').value,
        disposal_amount: parseFloat(document.getElementById('retireAmount').value || 0),
        reason: document.getElementById('retireReason').value,
        cash_account: document.getElementById('retireCashAccount').value || null
    };
    const res = await fetch(`/api/lifecycle/assets/${id}/retire`, {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
    const d = await res.json();
    if (d.success) {
        alert(`✓ Activo dado de baja.\nValor en libros: ${fmtRD(d.net_book_value)}\n` +
              `${d.gain_loss >= 0 ? 'Ganancia' : 'Pérdida'}: ${fmtRD(Math.abs(d.gain_loss))}\nAsiento #${d.journal_entry_id}`);
        document.getElementById('retireModal').classList.remove('active');
        closeAssetDetailsModal(); loadAssets(); loadDashboard();
    } else alert('Error: ' + d.message);
}

// ---- TRASLADO ----
async function openTransferModal() {
    document.getElementById('transferDate').value = todayISO();
    const [dRes, lRes] = await Promise.all([fetch('/api/departments'), fetch('/api/locations')]);
    const [dData, lData] = await Promise.all([dRes.json(), lRes.json()]);
    document.getElementById('transferDept').innerHTML = '<option value="">— Sin cambio —</option>' +
        (dData.departments || []).map(x => `<option value="${x.id}">${x.name}</option>`).join('');
    document.getElementById('transferLoc').innerHTML = '<option value="">— Sin cambio —</option>' +
        (lData.locations || []).map(x => `<option value="${x.id}">${x.name}</option>`).join('');
    document.getElementById('transferUser').value = '';
    document.getElementById('transferNotes').value = '';
    document.getElementById('transferModal').classList.add('active');
}
async function submitTransfer(e) {
    e.preventDefault();
    const id = detailAssetId();
    const body = {date: document.getElementById('transferDate').value, notes: document.getElementById('transferNotes').value};
    const dept = document.getElementById('transferDept').value;
    const loc = document.getElementById('transferLoc').value;
    const user = document.getElementById('transferUser').value.trim();
    if (dept) body.to_department_id = parseInt(dept);
    if (loc) body.to_location_id = parseInt(loc);
    if (user) body.to_user = user;
    const res = await fetch(`/api/lifecycle/assets/${id}/transfer`, {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
    const d = await res.json();
    if (d.success) { alert('✓ ' + d.message); document.getElementById('transferModal').classList.remove('active'); closeAssetDetailsModal(); loadAssets(); }
    else alert('Error: ' + d.message);
}

// ---- REVALUACIÓN ----
function openRevalueModal() {
    document.getElementById('revalueDate').value = todayISO();
    document.getElementById('revalueAmount').value = '';
    document.getElementById('revalueReason').value = '';
    document.getElementById('revalueModal').classList.add('active');
}
async function submitRevalue(e) {
    e.preventDefault();
    const id = detailAssetId();
    const body = {date: document.getElementById('revalueDate').value,
        adjustment: parseFloat(document.getElementById('revalueAmount').value),
        reason: document.getElementById('revalueReason').value};
    const res = await fetch(`/api/lifecycle/assets/${id}/revalue`, {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
    const d = await res.json();
    if (d.success) { alert(`✓ ${d.message}\nNuevo costo: ${fmtRD(d.new_cost)}`); document.getElementById('revalueModal').classList.remove('active'); closeAssetDetailsModal(); loadAssets(); loadDashboard(); }
    else alert('Error: ' + d.message);
}

// ---- HISTORIAL ----
async function showAssetMovements() {
    const id = detailAssetId();
    const res = await fetch(`/api/lifecycle/assets/${id}/movements`);
    const d = await res.json();
    const body = document.getElementById('movementsBody');
    if (!d.movements || d.movements.length === 0) {
        body.innerHTML = '<p style="color:#666;">Sin movimientos registrados.</p>';
    } else {
        body.innerHTML = '<table><thead><tr><th>Fecha</th><th>Tipo</th><th>Desde</th><th>Hacia</th><th>Monto</th><th>Notas</th></tr></thead><tbody>' +
            d.movements.map(m => `<tr><td>${m.date || '-'}</td><td>${m.type_label}</td><td>${m.from || '-'}</td><td>${m.to || '-'}</td><td>${m.amount != null ? fmtRD(m.amount) : '-'}</td><td>${m.notes || ''}</td></tr>`).join('') +
            '</tbody></table>';
    }
    document.getElementById('movementsModal').classList.add('active');
}

// ---- VERIFICAR EXISTENCIA (QR / conteo) ----
async function verifyAssetPresence() {
    const id = detailAssetId();
    const res = await fetch('/api/inventory/count', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({asset_id: parseInt(id), method: 'qr'})});
    const d = await res.json();
    const el = document.getElementById('assetVerifyResult');
    if (d.success) {
        beep(true);
        el.innerHTML = `<span style="color:#166534;font-weight:600;"><i class="fas fa-check-circle"></i> ${d.message}</span>
            <div style="font-size:13px;color:#64748b;margin-top:4px;">${d.stats.counted} de ${d.stats.total} contados en este inventario</div>`;
    } else {
        el.innerHTML = `<span style="color:#991b1b;">${d.message}</span>`;
    }
}

// ---- CONFIGURACIÓN: EMPRESA ----
async function loadCompany() {
    const d = await (await fetch('/api/settings/company')).json();
    if (!d.success) return;
    const c = d.company;
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v || ''; };
    set('coLegalName', c.legal_name); set('coTradeName', c.trade_name); set('coRnc', c.rnc);
    set('coPhone', c.phone); set('coAddress', c.address); set('coCity', c.city);
    set('coCurrency', c.currency || 'RD$'); set('coFiscalStart', c.fiscal_year_start_month || 1);
}
async function saveCompany() {
    const g = id => document.getElementById(id).value;
    const body = {legal_name: g('coLegalName'), trade_name: g('coTradeName'), rnc: g('coRnc'),
        phone: g('coPhone'), address: g('coAddress'), city: g('coCity'), currency: g('coCurrency'),
        fiscal_year_start_month: parseInt(g('coFiscalStart')) || 1};
    const d = await (await fetch('/api/settings/company', {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)})).json();
    document.getElementById('coResult').innerHTML = d.success ? '<span style="color:#166534;">✓ Guardado</span>' : '<span style="color:#991b1b;">' + d.message + '</span>';
}

// ---- CONFIGURACIÓN: CATEGORÍAS ----
let _accountsCache = [];
async function loadCatConfig() {
    const [cRes, aRes] = await Promise.all([fetch('/api/settings/categories/config'), fetch('/api/accounting/accounts')]);
    const cData = await cRes.json(); const aData = await aRes.json();
    _accountsCache = aData.accounts || [];
    const opts = (sel) => '<option value="">—</option>' + _accountsCache.map(a => `<option value="${a.code}" ${a.code === sel ? 'selected' : ''}>${a.code}</option>`).join('');
    const tbody = document.getElementById('catConfigTable');
    tbody.innerHTML = (cData.categories || []).map(c => `
        <tr data-id="${c.id}">
            <td><b>${c.name}</b></td>
            <td><select class="cc-method" style="padding:6px;"><option value="linea_recta" ${c.depreciation_method==='linea_recta'?'selected':''}>Línea recta</option><option value="saldos_decrecientes" ${c.depreciation_method==='saldos_decrecientes'?'selected':''}>Saldos decrec.</option></select></td>
            <td><input class="cc-rate" type="number" step="0.01" value="${c.depreciation_rate ?? ''}" style="width:70px;padding:6px;"></td>
            <td><input class="cc-tax" type="number" step="0.01" value="${c.tax_depreciation_rate ?? ''}" style="width:70px;padding:6px;"></td>
            <td><select class="cc-asset" style="padding:6px;">${opts(c.asset_account)}</select></td>
            <td><select class="cc-accum" style="padding:6px;">${opts(c.accumulated_depreciation_account)}</select></td>
            <td><select class="cc-exp" style="padding:6px;">${opts(c.depreciation_expense_account)}</select></td>
            <td><select class="cc-gl" style="padding:6px;">${opts(c.gain_loss_account)}</select></td>
            <td><button class="btn" style="padding:6px 10px;" onclick="saveCatConfig(${c.id}, this)">Guardar</button></td>
        </tr>`).join('') || '<tr><td colspan="9">No hay categorías</td></tr>';
}
async function saveCatConfig(id, btn) {
    const tr = btn.closest('tr');
    const body = {
        depreciation_method: tr.querySelector('.cc-method').value,
        tax_depreciation_rate: tr.querySelector('.cc-tax').value || null,
        asset_account: tr.querySelector('.cc-asset').value || null,
        accumulated_depreciation_account: tr.querySelector('.cc-accum').value || null,
        depreciation_expense_account: tr.querySelector('.cc-exp').value || null,
        gain_loss_account: tr.querySelector('.cc-gl').value || null
    };
    const d = await (await fetch(`/api/settings/categories/${id}/config`, {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)})).json();
    btn.textContent = d.success ? '✓' : 'Error';
    setTimeout(() => btn.textContent = 'Guardar', 1500);
}

// ---- CONFIGURACIÓN: PERÍODOS ----
async function loadPeriods() {
    const d = await (await fetch('/api/lifecycle/periods')).json();
    const el = document.getElementById('periodsList');
    if (!d.periods || d.periods.length === 0) { el.innerHTML = '<p style="color:#666;">Ningún período cerrado.</p>'; return; }
    el.innerHTML = '<table><thead><tr><th>Período</th><th>Estado</th><th></th></tr></thead><tbody>' +
        d.periods.map(p => `<tr><td>${String(p.month).padStart(2,'0')}/${p.year}</td>
            <td>${p.is_closed ? '<span style="color:#991b1b;">🔒 Cerrado</span>' : '<span style="color:#166534;">Abierto</span>'}</td>
            <td>${p.is_closed ? `<button class="btn" style="padding:5px 10px;background:#475569;" onclick="reopenPeriod(${p.year},${p.month})">Reabrir</button>` : ''}</td></tr>`).join('') +
        '</tbody></table>';
}
async function closePeriod() {
    const year = parseInt(document.getElementById('lockYear').value), month = parseInt(document.getElementById('lockMonth').value);
    const d = await (await fetch('/api/lifecycle/periods/close', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({year, month})})).json();
    if (d.success) loadPeriods(); else alert(d.message);
}
async function reopenPeriod(year, month) {
    const d = await (await fetch('/api/lifecycle/periods/open', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({year, month})})).json();
    if (d.success) loadPeriods();
}

function loadConfigPage() {
    loadCompany(); loadCatConfig(); loadPeriods();
}

// ---- WIDGETS DEL DASHBOARD ----
async function loadDashboardWidgets() {
    const cont = document.getElementById('dashboardWidgets');
    if (!cont) return;
    const widget = (icon, color, label, value, sub) => `
        <div style="background:white;border-radius:10px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,.08);border-left:4px solid ${color};">
            <div style="display:flex;align-items:center;gap:10px;">
                <i class="fas ${icon}" style="color:${color};font-size:22px;"></i>
                <div><div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.04em;">${label}</div>
                <div style="font-size:22px;font-weight:700;color:#0f172a;">${value}</div>
                ${sub ? `<div style="font-size:12px;color:#94a3b8;">${sub}</div>` : ''}</div>
            </div>
        </div>`;
    try {
        const [regRes, invRes, perRes] = await Promise.all([
            fetch('/api/lifecycle/reports/register?include_retired=1'),
            fetch('/api/inventory/sessions'),
            fetch('/api/lifecycle/periods')
        ]);
        const reg = await regRes.json(), inv = await invRes.json(), per = await perRes.json();
        const activos = reg.rows.filter(r => r.status === 'active').length;
        const bajas = reg.rows.filter(r => r.status === 'retired').length;

        let invHtml = widget('fa-clipboard-check', '#0ea5e9', 'Conteo Físico', 'Sin iniciar', 'Inícialo en Configuración');
        const openSes = (inv.sessions || []).find(s => s.status === 'open') || (inv.sessions || [])[0];
        if (openSes && openSes.stats) {
            invHtml = widget('fa-clipboard-check', '#0ea5e9', 'Conteo Físico',
                `${openSes.stats.counted}/${openSes.stats.total}`,
                `${openSes.stats.missing} por verificar · ${openSes.status === 'open' ? 'abierto' : 'cerrado'}`);
        }
        const closed = (per.periods || []).filter(p => p.is_closed);
        const lastClosed = closed.length ? `${String(closed[0].month).padStart(2,'0')}/${closed[0].year}` : 'Ninguno';

        cont.innerHTML =
            widget('fa-cubes', '#003D7A', 'Activos Activos', activos, 'en operación') +
            widget('fa-box-open', '#b45309', 'Dados de Baja', bajas, 'retirados / vendidos') +
            invHtml +
            widget('fa-lock', '#64748b', 'Último Período Cerrado', lastClosed, `${closed.length} cerrado(s)`);
    } catch (e) { /* silencioso */ }
}

// ---- ALERTAS Y TENDENCIA DEL DASHBOARD ----
async function loadDashboardExtras() {
    // Alertas operativas
    try {
        const cont = document.getElementById('dashboardAlerts');
        if (cont) {
            const chip = (color, bg, icon, text) =>
                `<span style="background:${bg};color:${color};border:1px solid ${color}33;border-radius:20px;padding:6px 14px;font-size:13px;"><i class="fas ${icon}"></i> ${text}</span>`;
            const [per, inv, reg] = await Promise.all([
                fetch('/api/lifecycle/periods').then(r => r.json()),
                fetch('/api/inventory/sessions').then(r => r.json()),
                fetch('/api/lifecycle/reports/register').then(r => r.json())
            ]);
            let chips = '';
            if (!(per.periods || []).some(p => p.is_closed))
                chips += chip('#9a6a12', '#fbf2df', 'fa-lock-open', 'Ningún período contable cerrado aún');
            const open = (inv.sessions || []).find(s => s.status === 'open');
            if (open && open.stats && open.stats.missing > 0)
                chips += chip('#0369a1', '#eef6ff', 'fa-clipboard-check',
                    `Conteo abierto: ${open.stats.missing} activos por verificar`);
            if (open && open.stats && open.stats.discrepancies > 0)
                chips += chip('#9a3412', '#fff7ed', 'fa-triangle-exclamation',
                    `${open.stats.discrepancies} diferencias detectadas en el conteo`);
            const nearFull = (reg.rows || []).filter(r => r.cost > 0 && r.accumulated / r.cost >= 0.85).length;
            if (nearFull > 0)
                chips += chip('#b45309', '#fff7ed', 'fa-hourglass-end', `${nearFull} activos por completar su depreciación`);
            cont.innerHTML = chips;
        }
    } catch (e) { /* silencioso */ }

    // Tendencia de depreciación mensual (últimos 24 períodos)
    try {
        if (typeof Chart === 'undefined') return;
        const d = await (await fetch('/api/depreciation/monthly-totals')).json();
        const rows = (d.rows || []).slice(-24);
        const canvas = document.getElementById('depTrendChart');
        if (!canvas || rows.length === 0) return;
        document.getElementById('depTrendCard').style.display = 'block';
        if (dashboardCharts.trend) dashboardCharts.trend.destroy();
        dashboardCharts.trend = new Chart(canvas, {
            type: 'line',
            data: { labels: rows.map(r => r.period),
                datasets: [{ label: 'Depreciación', data: rows.map(r => r.total),
                    borderColor: '#0EA5E9', backgroundColor: 'rgba(14,165,233,.12)', fill: true, tension: .3 }] },
            options: { plugins: { legend: { display: false } },
                scales: { y: { ticks: { callback: v => 'RD$ ' + (v / 1e6).toFixed(1) + 'M' } } } }
        });
    } catch (e) { /* silencioso */ }
}

// ---- REPORTES DE GESTIÓN ----
async function reportForecast() {
    const out = document.getElementById('mgmtReportOutput');
    out.innerHTML = 'Cargando...';
    const d = await (await fetch('/api/lifecycle/reports/forecast?months=12')).json();
    out.innerHTML = `<h4>Proyección de depreciación — próximos 12 meses</h4>
        <table><thead><tr><th>Período</th><th>Depreciación proyectada</th><th>Activos depreciándose</th></tr></thead><tbody>` +
        d.rows.map(r => `<tr><td>${r.period}</td><td>${fmtRD(r.total)}</td><td>${r.assets}</td></tr>`).join('') +
        '</tbody></table>';
}
function xlsReport(name) {
    const y = new Date().getFullYear();
    const urls = {
        movement: `/api/lifecycle/reports/movement?format=xlsx&from=${y}-01-01&to=${y}-12-31`,
        register: '/api/lifecycle/reports/register?format=xlsx',
        tax: '/api/lifecycle/reports/tax-vs-book?format=xlsx',
        forecast: '/api/lifecycle/reports/forecast?months=12&format=xlsx'
    };
    window.open(urls[name]);
}

async function reportMovement() {
    const out = document.getElementById('mgmtReportOutput');
    out.innerHTML = 'Cargando...';
    const year = new Date().getFullYear();
    const d = await (await fetch(`/api/lifecycle/reports/movement?from=${year}-01-01&to=${year}-12-31`)).json();
    let tA = 0, tR = 0, tD = 0;
    out.innerHTML = `<h4>Movimiento de Activos ${year} (adiciones · bajas · depreciación)</h4>
        <table><thead><tr><th>Categoría</th><th>Adiciones</th><th># Alta</th><th>Bajas</th><th># Baja</th><th>Depreciación</th></tr></thead><tbody>` +
        d.rows.map(r => { tA += r.additions; tR += r.retirements; tD += r.depreciation;
            return `<tr><td>${r.category}</td><td>${fmtRD(r.additions)}</td><td>${r.additions_n}</td><td>${fmtRD(r.retirements)}</td><td>${r.retirements_n}</td><td>${fmtRD(r.depreciation)}</td></tr>`; }).join('') +
        `<tr style="font-weight:700;background:#f1f5f9;"><td>TOTAL</td><td>${fmtRD(tA)}</td><td></td><td>${fmtRD(tR)}</td><td></td><td>${fmtRD(tD)}</td></tr></tbody></table>`;
}
async function reportRegister() {
    const out = document.getElementById('mgmtReportOutput');
    out.innerHTML = 'Cargando...';
    const d = await (await fetch('/api/lifecycle/reports/register')).json();
    out.innerHTML = `<h4>Libro de Activos Fijos — ${d.totals.count} activos</h4>
        <table><thead><tr><th>Código</th><th>Descripción</th><th>Categoría</th><th>Costo</th><th>Dep. Acum.</th><th>Valor en Libros</th></tr></thead><tbody>` +
        d.rows.map(r => `<tr><td>${r.code}</td><td>${r.description}</td><td>${r.category}</td><td>${fmtRD(r.cost)}</td><td>${fmtRD(r.accumulated)}</td><td>${fmtRD(r.nbv)}</td></tr>`).join('') +
        `<tr style="font-weight:700;background:#f1f5f9;"><td colspan="3">TOTAL</td><td>${fmtRD(d.totals.cost)}</td><td>${fmtRD(d.totals.accumulated)}</td><td>${fmtRD(d.totals.nbv)}</td></tr></tbody></table>`;
}
async function reportTaxVsBook() {
    const out = document.getElementById('mgmtReportOutput');
    out.innerHTML = 'Cargando...';
    const d = await (await fetch('/api/lifecycle/reports/tax-vs-book')).json();
    out.innerHTML = `<h4>Depreciación Anual: Fiscal vs Contable</h4>
        <table><thead><tr><th>Categoría</th><th>Base</th><th>Tasa NIIF</th><th>Tasa Fiscal</th><th>Deprec. Contable</th><th>Deprec. Fiscal</th><th>Diferencia</th></tr></thead><tbody>` +
        d.rows.map(r => `<tr><td>${r.category}</td><td>${fmtRD(r.base)}</td><td>${r.book_rate}%</td><td>${r.tax_rate}%</td><td>${fmtRD(r.book_annual)}</td><td>${fmtRD(r.tax_annual)}</td><td>${fmtRD(r.difference)}</td></tr>`).join('') +
        `<tr style="font-weight:700;background:#f1f5f9;"><td colspan="4">TOTAL</td><td>${fmtRD(d.totals.book)}</td><td>${fmtRD(d.totals.tax)}</td><td>${fmtRD(d.totals.difference)}</td></tr></tbody></table>`;
}

// ═══════════════════ MÓDULO DE INVENTARIO FÍSICO (QR) ═══════════════════
let invSession = null, invReportData = null, invCurrentTab = 'counted', qrScanner = null;

function beep(ok = true) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = ok ? 880 : 240;
        g.gain.setValueAtTime(.15, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .25);
        o.start(); o.stop(ctx.currentTime + .25);
    } catch (e) { /* sin sonido */ }
}

async function loadInventoryPage() {
    const d = await (await fetch('/api/inventory/sessions/open')).json();
    invSession = d.session;
    document.getElementById('invNoSession').style.display = invSession ? 'none' : 'block';
    document.getElementById('invActive').style.display = invSession ? 'block' : 'none';
    if (invSession) {
        document.getElementById('invSessName').textContent = invSession.name;
        document.getElementById('invSessScope').textContent = invSession.scope_label;
        renderInvStats(invSession.stats);
        await loadInvReport();
    }
    await loadInvHistory();
    // Respetar permisos: los botones admin-only ya se ocultan al iniciar sesión
    if (currentUser && currentUser.role !== 'admin') {
        document.querySelectorAll('#inventory-page .admin-only').forEach(el => el.style.display = 'none');
    }
}

function renderInvStats(s) {
    if (!s) return;
    document.getElementById('invStatCounted').textContent = s.counted;
    document.getElementById('invStatMissing').textContent = s.missing;
    document.getElementById('invStatDiff').textContent = s.discrepancies;
    document.getElementById('invStatExtra').textContent = s.unregistered;
    document.getElementById('invProgressText').textContent = `${s.counted} de ${s.total} contados`;
    document.getElementById('invProgressPct').textContent = s.progress + '%';
    document.getElementById('invProgressBar').style.width = Math.min(100, s.progress) + '%';
}

// ---- Sesiones ----
async function openNewSessionModal() {
    const [dRes, cRes] = await Promise.all([fetch('/api/departments'), fetch('/api/categories')]);
    const dData = await dRes.json(), cData = await cRes.json();
    document.getElementById('nsDept').innerHTML = '<option value="">— Todos —</option>' +
        (dData.departments || []).map(x => `<option value="${x.id}">${x.name}</option>`).join('');
    document.getElementById('nsCat').innerHTML = '<option value="">— Todas —</option>' +
        (cData.categories || []).map(x => `<option value="${x.id}">${x.name}</option>`).join('');
    document.getElementById('nsName').value = `Inventario ${new Date().toLocaleDateString('es-DO')}`;
    document.getElementById('newSessionModal').classList.add('active');
}

async function createInvSession(e) {
    e.preventDefault();
    const body = {
        name: document.getElementById('nsName').value.trim(),
        scope_department_id: document.getElementById('nsDept').value || null,
        scope_category_id: document.getElementById('nsCat').value || null,
        notes: document.getElementById('nsNotes').value
    };
    const d = await (await fetch('/api/inventory/sessions', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)})).json();
    if (d.success) {
        document.getElementById('newSessionModal').classList.remove('active');
        await loadInventoryPage();
    } else alert('Error: ' + d.message);
}

async function closeInvSession() {
    if (!invSession || !confirm('¿Cerrar este conteo? Ya no se podrán registrar más activos.')) return;
    const d = await (await fetch(`/api/inventory/sessions/${invSession.id}/close`, {method: 'POST'})).json();
    if (d.success) await loadInventoryPage(); else alert(d.message);
}

async function reopenInvSession(id) {
    if (!confirm('¿Reabrir este conteo? Se cerrará cualquier otro conteo abierto.')) return;
    const d = await (await fetch(`/api/inventory/sessions/${id}/reopen`, {method: 'POST'})).json();
    if (d.success) await loadInventoryPage(); else alert(d.message);
}

// ---- Escáner por cámara ----
async function openScanner() {
    const overlay = document.getElementById('scannerOverlay');
    const feedback = document.getElementById('scannerFeedback');
    if (typeof Html5Qrcode === 'undefined') {
        alert('No se pudo cargar el lector de QR (revisa la conexión a internet).\nPuedes escribir el código manualmente.');
        return;
    }
    overlay.style.display = 'flex';
    feedback.innerHTML = 'Iniciando cámara...';
    try {
        qrScanner = new Html5Qrcode('qrReader', {verbose: false});
        await qrScanner.start({facingMode: 'environment'}, {fps: 10, qrbox: {width: 250, height: 250}},
            async (text) => {
                // Evitar re-lecturas del mismo código en ráfaga
                if (openScanner._last === text && Date.now() - (openScanner._lastAt || 0) < 2500) return;
                openScanner._last = text; openScanner._lastAt = Date.now();
                await handleScan(text);
            }, () => { /* frames sin QR: ignorar */ });
        feedback.innerHTML = 'Cámara lista. Escanea los códigos QR uno tras otro.';
    } catch (err) {
        feedback.innerHTML = `<span style="color:#fca5a5;">No se pudo abrir la cámara: ${err}.
            Verifica que diste permiso y que la página esté en HTTPS.</span>`;
    }
}

async function closeScanner() {
    try { if (qrScanner) { await qrScanner.stop(); qrScanner.clear(); } } catch (e) { /* ya detenido */ }
    qrScanner = null;
    document.getElementById('scannerOverlay').style.display = 'none';
    await loadInvReport();
}

async function handleScan(text) {
    const feedback = document.getElementById('scannerFeedback');
    const fast = document.getElementById('invFastMode')?.checked;
    if (fast) {
        const d = await (await fetch('/api/inventory/count', {method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({code: text, method: 'qr'})})).json();
        beep(d.success);
        if (d.success) {
            renderInvStats(d.stats);
            feedback.innerHTML = `<span style="color:#86efac;">✓ ${d.asset.code} — ${d.asset.description}</span>
                ${d.has_discrepancy ? '<br><span style="color:#fdba74;">⚠ ' + d.discrepancies.join(' · ') + '</span>' : ''}
                <br><span style="opacity:.7;font-size:13px;">${d.stats.counted} de ${d.stats.total} contados</span>`;
        } else {
            feedback.innerHTML = `<span style="color:#fca5a5;">✗ ${d.message}</span>`;
        }
    } else {
        beep(true);
        await closeScanner();
        await lookupCode(text);
    }
}

// ---- Buscar y confirmar el conteo ----
async function lookupCode(code) {
    if (!code || !code.trim()) return;
    const card = document.getElementById('invScanCard');
    card.style.display = 'block';
    card.innerHTML = '<div style="background:white;border-radius:10px;padding:16px;">Buscando...</div>';
    const d = await (await fetch(`/api/inventory/lookup?code=${encodeURIComponent(code.trim())}`)).json();
    document.getElementById('invManualCode').value = '';

    if (!d.success) {
        beep(false);
        card.innerHTML = `<div style="background:#fef2f2;border:1px solid #dc2626;border-radius:10px;padding:16px;">
            <b style="color:#991b1b;">✗ ${d.message}</b>
            <div style="font-size:13px;color:#666;margin:8px 0;">Código leído: <code>${code}</code></div>
            <button class="btn" style="background:#8b5cf6;" onclick="openUnregModal('${String(code).replace(/'/g, "")}')">
                <i class="fas fa-plus"></i> Registrar como hallazgo sin registrar</button></div>`;
        return;
    }

    const a = d.asset;
    const [dRes, lRes] = await Promise.all([fetch('/api/departments'), fetch('/api/locations')]);
    const depts = (await dRes.json()).departments || [], locs = (await lRes.json()).locations || [];
    const opt = (arr, sel) => arr.map(x => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${x.name}</option>`).join('');
    const cond = (v, sel) => `<option value="${v}" ${v === sel ? 'selected' : ''}>`;

    card.innerHTML = `
    <div style="background:white;border:2px solid #10B981;border-radius:10px;padding:18px;">
        <div style="display:flex;justify-content:space-between;align-items:start;gap:10px;flex-wrap:wrap;">
            <div>
                <div style="font-size:18px;font-weight:700;color:#003D7A;">${a.code}</div>
                <div style="font-size:15px;">${a.description}</div>
                <div style="font-size:13px;color:#64748b;margin-top:4px;">
                    ${a.category || '-'} · ${a.brand || ''} ${a.model || ''} ${a.plate_number ? '· Placa ' + a.plate_number : ''}
                </div>
            </div>
            ${a.status !== 'active' ? '<span style="background:#fef2f2;color:#991b1b;padding:4px 10px;border-radius:12px;font-size:12px;">Estado: ' + a.status + '</span>' : ''}
        </div>
        ${d.already_counted ? `<div style="background:#eef6ff;border:1px solid #0ea5e9;border-radius:6px;padding:9px;margin-top:10px;font-size:13px;color:#0369a1;">
            <i class="fas fa-info-circle"></i> Ya fue contado en esta sesión (${new Date(d.already_counted.counted_at).toLocaleString('es-DO')}). Puedes corregir los datos.</div>` : ''}
        <div style="background:#f8fafc;border-radius:8px;padding:12px;margin-top:12px;font-size:13px;">
            <b>Según el sistema:</b> Depto <b>${a.department || '—'}</b> · Localidad <b>${a.location || '—'}</b> · Condición <b>${a.condition_label || '—'}</b>
        </div>
        <div style="margin-top:14px;font-weight:600;font-size:14px;color:#003D7A;">¿Dónde y cómo lo encontraste?</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:8px;">
            <div><label style="font-size:13px;color:#555;">Departamento</label>
                <select id="cfDept" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;">
                    <option value="">— Sin especificar —</option>${opt(depts, a.department_id)}</select></div>
            <div><label style="font-size:13px;color:#555;">Localidad</label>
                <select id="cfLoc" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;">
                    <option value="">— Sin especificar —</option>${opt(locs, a.location_id)}</select></div>
            <div><label style="font-size:13px;color:#555;">Condición física</label>
                <select id="cfCond" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;">
                    ${cond('good', a.condition)}Bueno</option>${cond('fair', a.condition)}Regular</option>${cond('poor', a.condition)}Malo</option></select></div>
        </div>
        <div style="margin-top:10px;"><label style="font-size:13px;color:#555;">Observaciones</label>
            <input type="text" id="cfObs" placeholder="Opcional" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;"></div>
        <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">
            <button class="btn" style="background:#10B981;flex:1;min-width:150px;padding:14px;font-size:16px;" onclick="confirmCount(${a.id})">
                <i class="fas fa-check"></i> Confirmar conteo</button>
            <button class="btn" style="background:#64748b;" onclick="document.getElementById('invScanCard').style.display='none'">Cancelar</button>
            <button class="btn" style="background:#0ea5e9;" onclick="openScanner()"><i class="fas fa-qrcode"></i> Escanear otro</button>
        </div>
    </div>`;
}

async function confirmCount(assetId) {
    const body = {
        asset_id: assetId,
        found_department_id: document.getElementById('cfDept').value || null,
        found_location_id: document.getElementById('cfLoc').value || null,
        found_condition: document.getElementById('cfCond').value,
        observations: document.getElementById('cfObs').value,
        method: 'qr'
    };
    const d = await (await fetch('/api/inventory/count', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)})).json();
    beep(d.success);
    const card = document.getElementById('invScanCard');
    if (d.success) {
        renderInvStats(d.stats);
        card.innerHTML = `<div style="background:#f0fdf4;border:1px solid #10B981;border-radius:10px;padding:16px;">
            <b style="color:#166534;">✓ ${d.asset.code} registrado</b>
            ${d.has_discrepancy ? '<div style="color:#9a3412;margin-top:8px;font-size:14px;">⚠ Diferencia detectada:<br>' + d.discrepancies.join('<br>') + '</div>' : ''}
            <div style="margin-top:12px;"><button class="btn" style="background:#0ea5e9;" onclick="openScanner()">
                <i class="fas fa-qrcode"></i> Escanear el siguiente</button></div></div>`;
        await loadInvReport();
    } else alert('Error: ' + d.message);
}

// ---- Activo no registrado ----
async function openUnregModal(code) {
    const dData = await (await fetch('/api/departments')).json();
    document.getElementById('urDept').innerHTML = '<option value="">— Sin especificar —</option>' +
        (dData.departments || []).map(x => `<option value="${x.id}">${x.name}</option>`).join('');
    document.getElementById('urCode').value = code || '';
    document.getElementById('urDesc').value = '';
    document.getElementById('urNotes').value = '';
    document.getElementById('unregModal').classList.add('active');
}

async function submitUnregistered(e) {
    e.preventDefault();
    const body = {
        description: document.getElementById('urDesc').value,
        scanned_code: document.getElementById('urCode').value,
        department_id: document.getElementById('urDept').value || null,
        observations: document.getElementById('urNotes').value
    };
    const d = await (await fetch(`/api/inventory/sessions/${invSession.id}/unregistered`, {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)})).json();
    if (d.success) {
        document.getElementById('unregModal').classList.remove('active');
        document.getElementById('invScanCard').style.display = 'none';
        renderInvStats(d.stats);
        await loadInvReport();
    } else alert(d.message);
}

// ---- Listados ----
async function loadInvReport() {
    if (!invSession) return;
    invReportData = await (await fetch(`/api/inventory/sessions/${invSession.id}/report`)).json();
    if (invReportData.session) renderInvStats(invReportData.session.stats);
    invTab(invCurrentTab);
}

function invTab(tab) {
    invCurrentTab = tab;
    document.querySelectorAll('.inv-tab').forEach(b =>
        b.style.background = b.dataset.tab === tab ? '#003D7A' : '#64748b');
    const el = document.getElementById('invTabContent');
    if (!invReportData) { el.innerHTML = 'Cargando...'; return; }
    const d = invReportData;
    const empty = t => `<p style="color:#64748b;padding:10px;">${t}</p>`;

    if (tab === 'counted') {
        el.innerHTML = d.counted.length === 0 ? empty('Aún no has contado ningún activo.') :
            `<table><thead><tr><th>Código</th><th>Descripción</th><th>Depto hallado</th><th>Condición</th><th>Contó</th><th>Hora</th><th>Dif.</th><th></th></tr></thead><tbody>` +
            d.counted.map(c => `<tr${c.has_discrepancy ? ' style="background:#fff7ed;"' : ''}>
                <td><b>${c.code}</b></td><td>${c.description}</td><td>${c.found_department}</td>
                <td>${c.found_condition}</td><td>${c.counted_by}</td>
                <td>${(c.counted_at || '').slice(11, 16)}</td>
                <td>${c.has_discrepancy ? '<span style="color:#9a3412;" title="' + c.discrepancy_notes + '">⚠</span>' : '✓'}</td>
                <td><button class="btn admin-only" style="padding:4px 8px;background:#dc2626;" onclick="undoCount(${c.count_id})" title="Deshacer">✕</button></td>
            </tr>`).join('') + '</tbody></table>';
    } else if (tab === 'missing') {
        el.innerHTML = d.missing.length === 0 ? empty('¡No hay faltantes! Todos los activos del alcance fueron encontrados.') :
            `<table><thead><tr><th>Código</th><th>Descripción</th><th>Categoría</th><th>Departamento</th><th>Usuario</th><th>Valor en libros</th><th>Última vez visto</th></tr></thead><tbody>` +
            d.missing.map(m => `<tr><td><b>${m.code}</b></td><td>${m.description}</td><td>${m.category}</td>
                <td>${m.department}</td><td>${m.asset_user}</td><td>${fmtRD(m.nbv)}</td>
                <td>${m.last_verified_at ? m.last_verified_at.slice(0, 10) : 'Nunca'}</td></tr>`).join('') + '</tbody></table>';
    } else if (tab === 'diff') {
        el.innerHTML = d.discrepancies.length === 0 ? empty('Sin diferencias: todo coincide con el sistema.') :
            `<table><thead><tr><th>Código</th><th>Descripción</th><th>Diferencia detectada</th><th>Observaciones</th></tr></thead><tbody>` +
            d.discrepancies.map(c => `<tr><td><b>${c.code}</b></td><td>${c.description}</td>
                <td style="color:#9a3412;">${c.discrepancy_notes}</td><td>${c.observations}</td></tr>`).join('') + '</tbody></table>';
    } else {
        el.innerHTML = `<button class="btn" style="background:#8b5cf6;margin-bottom:12px;" onclick="openUnregModal('')">
                <i class="fas fa-plus"></i> Agregar hallazgo</button>` +
            (d.unregistered.length === 0 ? empty('No se registraron activos fuera del sistema.') :
            `<table><thead><tr><th>Descripción</th><th>Código</th><th>Departamento</th><th>Observaciones</th><th></th></tr></thead><tbody>` +
            d.unregistered.map(u => `<tr><td><b>${u.description}</b></td><td>${u.scanned_code}</td><td>${u.department}</td>
                <td>${u.observations}</td>
                <td><button class="btn admin-only" style="padding:4px 8px;background:#dc2626;" onclick="deleteUnreg(${u.id})">✕</button></td>
            </tr>`).join('') + '</tbody></table>');
    }
    if (currentUser && currentUser.role !== 'admin') {
        el.querySelectorAll('.admin-only').forEach(b => b.style.display = 'none');
    }
}

async function undoCount(id) {
    if (!confirm('¿Deshacer este conteo?')) return;
    const d = await (await fetch(`/api/inventory/count/${id}`, {method: 'DELETE'})).json();
    if (d.success) { renderInvStats(d.stats); await loadInvReport(); } else alert(d.message);
}

async function deleteUnreg(id) {
    const d = await (await fetch(`/api/inventory/unregistered/${id}`, {method: 'DELETE'})).json();
    if (d.success) await loadInvReport(); else alert(d.message);
}

async function applyFindings() {
    if (!invSession) return;
    if (!confirm('Se actualizará el maestro de activos (departamento, localidad y condición) con lo hallado en el conteo.\n\n¿Continuar?')) return;
    const d = await (await fetch(`/api/inventory/sessions/${invSession.id}/apply`, {method: 'POST'})).json();
    alert(d.success ? `✓ ${d.message}` : 'Error: ' + d.message);
    if (d.success) { await loadAssets(); await loadInventoryPage(); }
}

function downloadInvReport() {
    if (invSession) window.open(`/api/inventory/sessions/${invSession.id}/report?format=xlsx`);
}

async function loadInvHistory() {
    const d = await (await fetch('/api/inventory/sessions')).json();
    const el = document.getElementById('invHistory');
    const rows = (d.sessions || []);
    if (rows.length === 0) { el.innerHTML = '<p style="color:#64748b;">Aún no se ha hecho ningún conteo.</p>'; return; }
    el.innerHTML = `<table><thead><tr><th>Conteo</th><th>Alcance</th><th>Estado</th><th>Contados</th><th>Faltantes</th><th>Dif.</th><th>Inicio</th><th></th></tr></thead><tbody>` +
        rows.map(s => `<tr>
            <td><b>${s.name}</b></td><td style="font-size:13px;">${s.scope_label}</td>
            <td>${s.status === 'open' ? '<span style="color:#166534;">● Abierto</span>' : '<span style="color:#64748b;">Cerrado</span>'}</td>
            <td>${s.stats.counted}/${s.stats.total}</td><td>${s.stats.missing}</td><td>${s.stats.discrepancies}</td>
            <td>${(s.started_at || '').slice(0, 10)}</td>
            <td style="white-space:nowrap;">
                <button class="btn" style="padding:4px 8px;" onclick="window.open('/api/inventory/sessions/${s.id}/report?format=xlsx')" title="Excel"><i class="fas fa-file-excel"></i></button>
                ${s.status === 'closed' ? `<button class="btn admin-only" style="padding:4px 8px;background:#475569;" onclick="reopenInvSession(${s.id})">Reabrir</button>` : ''}
            </td></tr>`).join('') + '</tbody></table>';
    if (currentUser && currentUser.role !== 'admin') {
        el.querySelectorAll('.admin-only').forEach(b => b.style.display = 'none');
    }
}

console.log('✓ App script loaded');
