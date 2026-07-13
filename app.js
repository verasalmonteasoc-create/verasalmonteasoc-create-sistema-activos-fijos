/**
 * Aplicación Principal - Sistema de Gestión de Activos
 */

let currentUser = null;
let currentPage = 'dashboard';
let categories = [];
let charts = {};

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Iniciando aplicación...');

    // Cargar usuario actual
    await loadCurrentUser();

    // Si no hay usuario, redirigir a login
    if (!currentUser) {
        redirectToLogin();
        return;
    }

    // Inicializar interfaz
    initializeUI();
    loadDashboard();

    console.log('Aplicación iniciada correctamente');
});

// ========== AUTENTICACIÓN ==========
async function loadCurrentUser() {
    try {
        const response = await API.auth.getCurrentUser();
        if (response.success) {
            currentUser = response.user;
            updateUserInfo();
        }
    } catch (error) {
        console.error('Error loading current user:', error);
        redirectToLogin();
    }
}

function updateUserInfo() {
    document.getElementById('userName').textContent = currentUser.username;
    document.getElementById('userRole').textContent = currentUser.role === 'admin' ? 'Administrador' : 'Usuario';
}

function redirectToLogin() {
    window.location.href = '/login.html';
}

// ========== INTERFAZ ==========
function initializeUI() {
    // Event listeners del sidebar
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            navigateTo(page);
        });
    });

    // Botón de logout
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Toggle sidebar mobile
    document.getElementById('toggleSidebar').addEventListener('click', () => {
        document.querySelector('.sidebar').classList.toggle('open');
    });

    // Cerrar modal
    document.querySelector('.modal-close').addEventListener('click', UI.closeModal);

    // Cargar categorías
    loadCategories();

    // Filtros en página de activos
    document.getElementById('filterCategory').addEventListener('change', () => loadAssets());
    document.getElementById('filterStatus').addEventListener('change', () => loadAssets());
    document.getElementById('clearFilters').addEventListener('click', () => {
        document.getElementById('filterCategory').value = '';
        document.getElementById('filterStatus').value = '';
        loadAssets();
    });

    // Formulario de activo
    document.getElementById('assetForm').addEventListener('submit', handleAssetSubmit);

    // Búsqueda
    document.getElementById('searchInput').addEventListener('input', (e) => {
        const search = e.target.value;
        if (currentPage === 'assets') {
            loadAssets(1, search);
        }
    });

    // Botones de reportes
    document.querySelectorAll('[data-report]').forEach(btn => {
        btn.addEventListener('click', () => {
            const report = btn.dataset.report;
            loadReport(report);
        });
    });

    // Export CSV
    document.getElementById('exportBtn').addEventListener('click', () => {
        API.reports.exportCSV();
        UI.toast('Descargando archivo...', 'info');
    });

    // Nueva categoría
    document.getElementById('newCategoryBtn').addEventListener('click', () => {
        showCategoryForm();
    });

    // Formulario de perfil
    document.getElementById('profileForm').addEventListener('submit', updateProfile);
}

// ========== NAVEGACIÓN ==========
function navigateTo(page) {
    // Actualizar página actual
    currentPage = page;

    // Actualizar menú activo
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-page="${page}"]`).closest('.nav-item').classList.add('active');

    // Ocultar todas las páginas
    document.querySelectorAll('.page-section').forEach(section => {
        section.classList.remove('active');
    });

    // Mostrar página seleccionada
    const pageElement = document.getElementById(`${page}-page`);
    if (pageElement) {
        pageElement.classList.add('active');

        // Actualizar título
        const title = document.querySelector(`[data-page="${page}"]`).textContent.trim();
        document.getElementById('pageTitle').textContent = title;
    }

    // Cerrar sidebar en mobile
    if (window.innerWidth <= 768) {
        document.querySelector('.sidebar').classList.remove('open');
    }

    // Cargar datos específicos de la página
    switch (page) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'assets':
            loadAssets();
            break;
        case 'depreciation':
            loadDepreciationPage();
            break;
        case 'reports':
            // Página de reportes ya cargada
            break;
        case 'categories':
            loadCategories();
            break;
        case 'settings':
            loadSettings();
            break;
    }
}

// ========== DASHBOARD ==========
async function loadDashboard() {
    try {
        UI.showSpinner();

        const summary = await API.reports.getSummary();

        // Actualizar KPI cards
        document.getElementById('totalAssets').textContent = summary.summary.total_assets;
        document.getElementById('totalValue').textContent = Format.currency(summary.summary.total_acquisition_cost);
        document.getElementById('totalDepreciation').textContent = Format.currency(summary.summary.total_accumulated_depreciation);
        document.getElementById('netValue').textContent = Format.currency(summary.summary.total_net_book_value);

        // Cargar tabla de activos recientes
        const assets = await API.assets.getAll(1, 5);
        populateRecentAssets(assets.assets);

        // Cargar gráficos
        loadDashboardCharts();

        UI.hideSpinner();
    } catch (error) {
        console.error('Error loading dashboard:', error);
        UI.toast('Error cargando dashboard', 'error');
        UI.hideSpinner();
    }
}

function populateRecentAssets(assets) {
    const tbody = document.getElementById('recentAssetsTable');
    tbody.innerHTML = '';

    assets.forEach(asset => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td><strong>${asset.code}</strong></td>
            <td>${asset.description}</td>
            <td>${asset.category.name}</td>
            <td>${Format.currency(asset.acquisition_cost)}</td>
            <td>${UI.formatStatus(asset.status)}</td>
            <td>
                <button class="btn btn-sm" onclick="viewAssetDetails(${asset.id})">
                    <i class="fas fa-eye"></i> Ver
                </button>
            </td>
        `;
    });
}

async function loadDashboardCharts() {
    try {
        // Gráfico por categoría
        const byCategory = await API.reports.getByCategory();
        const categoryCtx = document.getElementById('categoryChart').getContext('2d');

        if (charts.categoryChart) {
            charts.categoryChart.destroy();
        }

        charts.categoryChart = new Chart(categoryCtx, {
            type: 'bar',
            data: {
                labels: byCategory.report.map(r => r.category),
                datasets: [{
                    label: 'Cantidad de Activos',
                    data: byCategory.report.map(r => r.asset_count),
                    backgroundColor: '#003d7a',
                    borderColor: '#002349',
                    borderWidth: 1,
                }],
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false,
                    },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                    },
                },
            },
        });

        // Gráfico por estado
        const summary = await API.reports.getSummary();
        const statusCtx = document.getElementById('statusChart').getContext('2d');

        if (charts.statusChart) {
            charts.statusChart.destroy();
        }

        charts.statusChart = new Chart(statusCtx, {
            type: 'doughnut',
            data: {
                labels: ['Activos', 'Inactivos', 'Retirados'],
                datasets: [{
                    data: [
                        summary.summary.active_assets,
                        summary.summary.inactive_assets,
                        summary.summary.retired_assets,
                    ],
                    backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                    borderColor: ['#059669', '#d97706', '#dc2626'],
                    borderWidth: 2,
                }],
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                    },
                },
            },
        });
    } catch (error) {
        console.error('Error loading dashboard charts:', error);
    }
}

// ========== GESTIÓN DE ACTIVOS ==========
async function loadAssets(page = 1, search = '') {
    try {
        UI.showSpinner();

        const filters = {
            category_id: document.getElementById('filterCategory').value,
            status: document.getElementById('filterStatus').value,
            search: search || document.getElementById('searchInput').value,
        };

        const response = await API.assets.getAll(page, 10, filters);
        populateAssetsTable(response.assets);
        createPagination('assetsPagination', response.pagination, () => loadAssets(page));

        UI.hideSpinner();
    } catch (error) {
        console.error('Error loading assets:', error);
        UI.toast('Error cargando activos', 'error');
        UI.hideSpinner();
    }
}

function populateAssetsTable(assets) {
    const tbody = document.getElementById('assetsTable');
    tbody.innerHTML = '';

    assets.forEach(asset => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td><strong>${asset.code}</strong></td>
            <td>${asset.description}</td>
            <td>${asset.category.name}</td>
            <td>${Format.currency(asset.acquisition_cost)}</td>
            <td>${Format.currency(asset.accumulated_depreciation)}</td>
            <td><strong>${Format.currency(asset.net_book_value)}</strong></td>
            <td>${UI.formatStatus(asset.status)}</td>
            <td>
                <button class="btn btn-sm" onclick="viewAssetDetails(${asset.id})">
                    <i class="fas fa-eye"></i>
                </button>
                ${currentUser.is_admin ? `
                    <button class="btn btn-sm" onclick="editAsset(${asset.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm" onclick="deleteAsset(${asset.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                ` : ''}
            </td>
        `;
    });
}

async function handleAssetSubmit(e) {
    e.preventDefault();

    if (!UI.validateForm('assetForm')) {
        UI.toast('Por favor completa todos los campos requeridos', 'warning');
        return;
    }

    try {
        UI.showSpinner();

        const formData = new FormData(document.getElementById('assetForm'));
        const data = {
            description: formData.get('description'),
            category_id: parseInt(formData.get('category')),
            acquisition_date: formData.get('acquisitionDate'),
            acquisition_cost: parseFloat(formData.get('acquisitionCost')),
            residual_value_percent: parseFloat(formData.get('residualValue')),
            useful_life_years: parseInt(formData.get('usefulLife')),
            location: formData.get('location'),
            department: formData.get('department'),
            responsible: formData.get('responsible'),
            serial_number: formData.get('serialNumber'),
            notes: formData.get('notes'),
        };

        const response = await API.assets.create(data);

        if (response.success) {
            UI.toast('Activo creado exitosamente', 'success');
            document.getElementById('assetForm').reset();
            navigateTo('assets');
        }

        UI.hideSpinner();
    } catch (error) {
        console.error('Error creating asset:', error);
        UI.toast('Error creando activo', 'error');
        UI.hideSpinner();
    }
}

function viewAssetDetails(assetId) {
    // Mostrar modal con detalles del activo
    // (Implementar según necesidad)
}

function editAsset(assetId) {
    // Implementar edición de activo
}

async function deleteAsset(assetId) {
    if (!confirm('¿Estás seguro de que deseas eliminar este activo?')) {
        return;
    }

    try {
        const response = await API.assets.delete(assetId);
        if (response.success) {
            UI.toast('Activo eliminado', 'success');
            loadAssets();
        }
    } catch (error) {
        console.error('Error deleting asset:', error);
        UI.toast('Error eliminando activo', 'error');
    }
}

// ========== DEPRECIACIÓN ==========
async function loadDepreciationPage() {
    try {
        // Llenar años y meses
        const year = new Date().getFullYear();
        const yearSelect = document.getElementById('depYearFilter');

        yearSelect.innerHTML = '';
        for (let y = year - 5; y <= year + 1; y++) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            yearSelect.appendChild(opt);
        }
        yearSelect.value = year;

        const monthSelect = document.getElementById('depMonthFilter');
        monthSelect.innerHTML = '<option value="">Todos los meses</option>';
        const months = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        for (let m = 1; m <= 12; m++) {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = months[m];
            monthSelect.appendChild(opt);
        }

        // Event listeners
        yearSelect.addEventListener('change', loadDepreciationReport);
        monthSelect.addEventListener('change', loadDepreciationReport);

        // Cargar reporte inicial
        await loadDepreciationReport();
    } catch (error) {
        console.error('Error loading depreciation page:', error);
    }
}

async function loadDepreciationReport() {
    try {
        const year = document.getElementById('depYearFilter').value;
        const month = document.getElementById('depMonthFilter').value;

        const response = await API.reports.getDepreciation(year, month ? parseInt(month) : null);

        // Actualizar total
        document.getElementById('periodDepreciation').textContent = Format.currency(response.total_depreciation);

        // Llenar tabla
        const tbody = document.getElementById('depreciationTable');
        tbody.innerHTML = '';

        response.records.forEach(record => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${record.asset_code}</td>
                <td>${record.asset_description}</td>
                <td>${record.category}</td>
                <td>${record.month_year}</td>
                <td>${Format.currency(record.depreciation_amount)}</td>
                <td>${Format.currency(record.accumulated_depreciation)}</td>
                <td>${Format.currency(record.net_book_value)}</td>
            `;
        });
    } catch (error) {
        console.error('Error loading depreciation report:', error);
        UI.toast('Error cargando reporte de depreciación', 'error');
    }
}

// ========== REPORTES ==========
async function loadReport(reportType) {
    try {
        UI.showSpinner();
        const reportContent = document.getElementById('reportContent');
        reportContent.innerHTML = '';

        let response;
        switch (reportType) {
            case 'by-category':
                response = await API.reports.getByCategory();
                renderCategoryReport(response.report);
                break;
            case 'by-department':
                response = await API.reports.getByDepartment();
                renderDepartmentReport(response.report);
                break;
            case 'aging':
                response = await API.reports.getAgingAnalysis();
                renderAgingReport(response.report);
                break;
        }

        UI.hideSpinner();
    } catch (error) {
        console.error('Error loading report:', error);
        UI.toast('Error cargando reporte', 'error');
        UI.hideSpinner();
    }
}

function renderCategoryReport(data) {
    let html = '<table class="table"><thead><tr><th>Categoría</th><th>Tasa %</th><th>Activos</th><th>Costo</th><th>Depreciación</th><th>Valor Neto</th></tr></thead><tbody>';

    data.forEach(row => {
        html += `
            <tr>
                <td>${row.category}</td>
                <td>${row.depreciation_rate}%</td>
                <td>${row.asset_count}</td>
                <td>${Format.currency(row.total_acquisition_cost)}</td>
                <td>${Format.currency(row.total_accumulated_depreciation)}</td>
                <td>${Format.currency(row.total_net_book_value)}</td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    document.getElementById('reportContent').innerHTML = html;
}

function renderDepartmentReport(data) {
    let html = '<table class="table"><thead><tr><th>Departamento</th><th>Activos</th><th>Costo</th><th>Valor Neto</th></tr></thead><tbody>';

    data.forEach(row => {
        html += `
            <tr>
                <td>${row.department}</td>
                <td>${row.asset_count}</td>
                <td>${Format.currency(row.total_acquisition_cost)}</td>
                <td>${Format.currency(row.total_net_book_value)}</td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    document.getElementById('reportContent').innerHTML = html;
}

function renderAgingReport(data) {
    let html = '<div class="aging-report">';

    data.forEach(row => {
        html += `
            <div class="aging-section">
                <h4>${row.range}</h4>
                <p>Activos: ${row.asset_count} | Valor: ${Format.currency(row.total_acquisition_cost)}</p>
                <table class="table"><thead><tr><th>Código</th><th>Descripción</th><th>Años</th><th>Valor</th></tr></thead><tbody>`;

                row.assets.forEach(asset => {
                    const years = Math.floor(asset.days_old / 365);
                    html += `<tr><td>${asset.code}</td><td>${asset.description}</td><td>${years}</td><td>${Format.currency(asset.net_book_value)}</td></tr>`;
                });

                html += '</tbody></table></div>';
    });

    html += '</div>';
    document.getElementById('reportContent').innerHTML = html;
}

// ========== CATEGORÍAS ==========
async function loadCategories() {
    try {
        const response = await API.categories.getAll();
        categories = response.categories;

        // Llenar select de categorías
        if (document.getElementById('category')) {
            UI.populateSelect('category', response.categories, 'id', 'name');
        }

        // Llenar filtro de categorías
        const filterCategorySelect = document.getElementById('filterCategory');
        if (filterCategorySelect) {
            filterCategorySelect.innerHTML = '<option value="">Todas</option>';
            response.categories.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat.id;
                opt.textContent = cat.name;
                filterCategorySelect.appendChild(opt);
            });
        }

        // Si estamos en la página de categorías, mostrar tabla
        if (currentPage === 'categories') {
            populateCategoriesTable(response.categories);
        }
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

function populateCategoriesTable(categories) {
    const tbody = document.getElementById('categoriesTable');
    tbody.innerHTML = '';

    categories.forEach(cat => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td><strong>${cat.name}</strong></td>
            <td>${cat.depreciation_rate}%</td>
            <td>${cat.asset_count}</td>
            <td>${cat.description || '-'}</td>
            <td>
                ${currentUser.is_admin ? `
                    <button class="btn btn-sm" onclick="editCategory(${cat.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm" onclick="deleteCategory(${cat.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                ` : '-'}
            </td>
        `;
    });
}

function showCategoryForm() {
    // Implementar formulario de categoría
}

function editCategory(categoryId) {
    // Implementar edición de categoría
}

async function deleteCategory(categoryId) {
    if (!confirm('¿Eliminar esta categoría?')) return;

    try {
        const response = await API.categories.delete(categoryId);
        if (response.success) {
            UI.toast('Categoría eliminada', 'success');
            loadCategories();
        }
    } catch (error) {
        UI.toast('Error eliminando categoría', 'error');
    }
}

// ========== CONFIGURACIÓN ==========
function loadSettings() {
    if (currentUser) {
        document.getElementById('profileUsername').value = currentUser.username;
        document.getElementById('profileEmail').value = currentUser.email;
        document.getElementById('profileName').value = `${currentUser.first_name} ${currentUser.last_name}`;
    }
}

async function updateProfile(e) {
    e.preventDefault();

    try {
        const name = document.getElementById('profileName').value;
        const [firstName, ...lastNameParts] = name.split(' ');

        const response = await API.auth.updateUser(currentUser.id, {
            first_name: firstName,
            last_name: lastNameParts.join(' '),
        });

        if (response.success) {
            UI.toast('Perfil actualizado', 'success');
            currentUser = response.user;
            updateUserInfo();
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        UI.toast('Error actualizando perfil', 'error');
    }
}

// ========== UTILIDADES ==========
function createPagination(elementId, pagination, onPageChange) {
    const container = document.getElementById(elementId);
    container.innerHTML = '';

    for (let i = 1; i <= pagination.pages; i++) {
        const button = document.createElement('button');
        button.textContent = i;
        button.className = i === pagination.page ? 'active' : '';
        button.addEventListener('click', () => onPageChange(i));
        container.appendChild(button);
    }
}

async function logout() {
    try {
        await API.auth.logout();
        redirectToLogin();
    } catch (error) {
        console.error('Error logging out:', error);
    }
}

console.log('App loaded');
