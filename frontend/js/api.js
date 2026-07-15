/**
 * API Service Layer
 * Maneja todas las comunicaciones con el backend
 */

const API = {
    BASE_URL: '/api',

    /**
     * Realizar petición HTTP
     */
    async request(endpoint, options = {}) {
        const url = `${this.BASE_URL}${endpoint}`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
        };

        const config = { ...defaultOptions, ...options };

        try {
            const response = await fetch(url, config);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error(`API Error: ${endpoint}`, error);
            throw error;
        }
    },

    /**
     * GET request
     */
    get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    },

    /**
     * POST request
     */
    post(endpoint, body) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(body),
        });
    },

    /**
     * PUT request
     */
    put(endpoint, body) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(body),
        });
    },

    /**
     * DELETE request
     */
    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    },

    // ========== AUTENTICACIÓN ==========
    auth: {
        login(username, password, remember = false) {
            return API.post('/auth/login', { username, password, remember });
        },

        logout() {
            return API.post('/auth/logout', {});
        },

        getCurrentUser() {
            return API.get('/auth/me');
        },

        register(userData) {
            return API.post('/auth/register', userData);
        },

        getUsers(page = 1, perPage = 20) {
            return API.get(`/auth/users?page=${page}&per_page=${perPage}`);
        },

        updateUser(userId, data) {
            return API.put(`/auth/users/${userId}`, data);
        },
    },

    // ========== ACTIVOS ==========
    assets: {
        getAll(page = 1, perPage = 20, filters = {}) {
            let query = `?page=${page}&per_page=${perPage}`;
            if (filters.status) query += `&status=${filters.status}`;
            if (filters.category_id) query += `&category_id=${filters.category_id}`;
            if (filters.search) query += `&search=${encodeURIComponent(filters.search)}`;
            return API.get(`/assets${query}`);
        },

        getById(assetId) {
            return API.get(`/assets/${assetId}`);
        },

        create(data) {
            return API.post('/assets', data);
        },

        update(assetId, data) {
            return API.put(`/assets/${assetId}`, data);
        },

        delete(assetId) {
            return API.delete(`/assets/${assetId}`);
        },

        getDepreciation(assetId) {
            return API.get(`/assets/${assetId}/depreciation`);
        },

        retire(assetId, reason) {
            return API.post(`/assets/${assetId}/retire`, { reason });
        },

        getSummary(assetId) {
            return API.get(`/assets/${assetId}/summary`);
        },

        downloadInvoice(assetId) {
            window.location.href = `/api/assets/${assetId}/invoice`;
        },

        viewInvoice(assetId) {
            return fetch(`/api/assets/${assetId}/invoice/view`).then(r => r.blob()).then(blob => {
                const url = window.URL.createObjectURL(blob);
                window.open(url, '_blank');
                window.URL.revokeObjectURL(url);
            });
        },
    },

    // ========== CATEGORÍAS ==========
    categories: {
        getAll() {
            return API.get('/categories');
        },

        getById(categoryId) {
            return API.get(`/categories/${categoryId}`);
        },

        create(data) {
            return API.post('/categories', data);
        },

        update(categoryId, data) {
            return API.put(`/categories/${categoryId}`, data);
        },

        delete(categoryId) {
            return API.delete(`/categories/${categoryId}`);
        },

        getAssets(categoryId, page = 1, perPage = 20) {
            return API.get(`/categories/${categoryId}/assets?page=${page}&per_page=${perPage}`);
        },
    },

    // ========== REPORTES ==========
    reports: {
        getSummary() {
            return API.get('/reports/assets-summary');
        },

        getByCategory() {
            return API.get('/reports/by-category');
        },

        getByDepartment() {
            return API.get('/reports/by-department');
        },

        getDepreciation(year, month) {
            let query = `/reports/depreciation?year=${year}`;
            if (month) query += `&month=${month}`;
            return API.get(query);
        },

        getDepreciationSchedule(assetId) {
            return API.get(`/reports/depreciation-schedule/${assetId}`);
        },

        getAgingAnalysis() {
            return API.get('/reports/aging-analysis');
        },

        exportCSV() {
            window.location.href = '/api/reports/export/csv';
        },

        getDepreciationForecast(months) {
            return API.get(`/reports/depreciation-forecast/${months}`);
        },
    },

    // ========== CONFIGURACIÓN CONTABLE ==========
    accounting: {
        getAccounts() {
            return API.get('/accounting/accounts');
        },

        createAccount(data) {
            return API.post('/accounting/accounts', data);
        },

        updateAccount(accountId, data) {
            return API.put(`/accounting/accounts/${accountId}`, data);
        },

        deleteAccount(accountId) {
            return API.delete(`/accounting/accounts/${accountId}`);
        },

        getJournalEntries(year, month) {
            let query = '/accounting/journal';
            if (year || month) {
                query += '?';
                if (year) query += `year=${year}`;
                if (month) query += (year ? '&' : '') + `month=${month}`;
            }
            return API.get(query);
        },

        generateJournal(year, month) {
            return API.post('/accounting/journal/generate', { year, month });
        },
    },
};

/**
 * Utilidad para formatear números
 */
const Format = {
    currency(value) {
        return new Intl.NumberFormat('es-DO', {
            style: 'currency',
            currency: 'DOP',
            minimumFractionDigits: 2,
        }).format(value);
    },

    number(value, decimals = 2) {
        return new Intl.NumberFormat('es-DO', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        }).format(value);
    },

    date(dateString) {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('es-DO', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        }).format(date);
    },

    shortDate(dateString) {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('es-DO', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(date);
    },

    percent(value) {
        return `${this.number(value, 2)}%`;
    },
};

/**
 * Utilidades de UI
 */
const UI = {
    /**
     * Mostrar notificación toast
     */
    toast(message, type = 'info', duration = 3000) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type} show`;

        setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    },

    /**
     * Mostrar modal
     */
    showModal(content, title = '') {
        const modal = document.getElementById('assetModal');
        const modalBody = document.getElementById('assetModalBody');

        if (title) {
            modalBody.innerHTML = `<h2>${title}</h2>${content}`;
        } else {
            modalBody.innerHTML = content;
        }

        modal.classList.add('show');
    },

    /**
     * Cerrar modal
     */
    closeModal() {
        const modal = document.getElementById('assetModal');
        modal.classList.remove('show');
    },

    /**
     * Mostrar spinner de carga
     */
    showSpinner() {
        document.body.style.cursor = 'loading';
    },

    /**
     * Ocultar spinner de carga
     */
    hideSpinner() {
        document.body.style.cursor = 'auto';
    },

    /**
     * Formatear estado
     */
    formatStatus(status) {
        const statusMap = {
            'active': '<span class="badge badge-success">Activo</span>',
            'inactive': '<span class="badge badge-warning">Inactivo</span>',
            'retired': '<span class="badge badge-danger">Retirado</span>',
        };
        return statusMap[status] || status;
    },

    /**
     * Crear fila de tabla
     */
    createTableRow(data, columns) {
        const tr = document.createElement('tr');
        columns.forEach(col => {
            const td = document.createElement('td');
            td.innerHTML = data[col] || '';
            tr.appendChild(td);
        });
        return tr;
    },

    /**
     * Limpiar tabla
     */
    clearTable(tableId) {
        const table = document.getElementById(tableId);
        if (table && table.getElementsByTagName('tbody')[0]) {
            table.getElementsByTagName('tbody')[0].innerHTML = '';
        }
    },

    /**
     * Validar formulario
     */
    validateForm(formId) {
        const form = document.getElementById(formId);
        if (!form) return false;
        return form.checkValidity();
    },

    /**
     * Obtener datos del formulario
     */
    getFormData(formId) {
        const form = document.getElementById(formId);
        const formData = new FormData(form);
        const data = {};

        for (let [key, value] of formData.entries()) {
            data[key] = value;
        }

        return data;
    },

    /**
     * Llenar select
     */
    populateSelect(selectId, options, valueKey = 'id', textKey = 'name') {
        const select = document.getElementById(selectId);
        if (!select) return;

        select.innerHTML = '<option value="">Seleccionar opción</option>';
        options.forEach(option => {
            const opt = document.createElement('option');
            opt.value = option[valueKey];
            opt.textContent = option[textKey];
            select.appendChild(opt);
        });
    },
};

/**
 * Almacenamiento local
 */
const Storage = {
    set(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    },

    get(key) {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    },

    remove(key) {
        localStorage.removeItem(key);
    },

    clear() {
        localStorage.clear();
    },
};

console.log('API Service loaded');
