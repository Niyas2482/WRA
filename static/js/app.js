/* ═══════════════════════════════════════════════════════════════════════
   AquaRisk IMS — Main Application Controller
   ═══════════════════════════════════════════════════════════════════════ */

const API_BASE = '';

// ── API Helpers ────────────────────────────────────────────────────────
async function api(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
        headers: { 'Content-Type': 'application/json' },
        ...options
    };
    if (config.body && typeof config.body === 'object') {
        config.body = JSON.stringify(config.body);
    }
    const response = await fetch(url, config);
    if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || `HTTP ${response.status}`);
    }
    return response.json();
}

async function apiGet(endpoint) { return api(endpoint); }
async function apiPost(endpoint, data) { return api(endpoint, { method: 'POST', body: data }); }
async function apiPut(endpoint, data) { return api(endpoint, { method: 'PUT', body: data }); }
async function apiDelete(endpoint) { return api(endpoint, { method: 'DELETE' }); }

// ── Navigation ─────────────────────────────────────────────────────────
const pageNames = {
    'dashboard': 'Risk Assessment Dashboard',
    'sites': 'Site Management',
    'contaminants': 'Contaminant Database',
    'transport': 'Contaminant Transport Modeling',
    'exposure': 'Exposure Pathway Analysis',
    'risk': 'Risk Assessment Engine',
    'reports': 'Reports & Analytics'
};

function navigateTo(page) {
    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });
    
    // Update pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(`page-${page}`);
    if (target) target.classList.add('active');
    
    // Update breadcrumb
    document.getElementById('currentPageTitle').textContent = pageNames[page] || page;
    
    // Initialize page
    initPage(page);
    
    // Update URL hash
    window.location.hash = page;
}

function initPage(page) {
    switch(page) {
        case 'dashboard': loadDashboard(); break;
        case 'sites': loadSites(); break;
        case 'contaminants': loadContaminants(); break;
        case 'transport': initTransport(); break;
        case 'exposure': initExposure(); break;
        case 'risk': initRisk(); break;
        case 'reports': break;
    }
}

// ── Toast Notifications ────────────────────────────────────────────────
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-times-circle',
        warning: 'fas fa-exclamation-circle',
        info: 'fas fa-info-circle'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="${icons[type]}"></i><span>${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => toast.remove(), 5000);
}

// ── Loading Overlay ────────────────────────────────────────────────────
function showLoading() {
    document.getElementById('loadingOverlay').classList.add('active');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('active');
}

// ── Modal ──────────────────────────────────────────────────────────────
let currentModalType = null;
let currentModalData = null;

function openModal(title, bodyHTML, type, data = null) {
    currentModalType = type;
    currentModalData = data;
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHTML;
    document.getElementById('modalOverlay').classList.add('active');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
    currentModalType = null;
    currentModalData = null;
}

function saveModalData() {
    switch(currentModalType) {
        case 'site': saveSite(); break;
        case 'contaminant': saveContaminant(); break;
        case 'sample': saveSample(); break;
    }
}

// ── Animated Counter ───────────────────────────────────────────────────
function animateCounter(element, target, duration = 1000) {
    let start = 0;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
        start += increment;
        if (start >= target) {
            element.textContent = Math.round(target).toLocaleString();
            clearInterval(timer);
        } else {
            element.textContent = Math.round(start).toLocaleString();
        }
    }, 16);
}

// ── Chart.js Defaults ──────────────────────────────────────────────────
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = 'rgba(148, 163, 184, 0.1)';
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.responsive = true;
Chart.defaults.maintainAspectRatio = false;
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.padding = 16;

// ── Utility ────────────────────────────────────────────────────────────
function formatScientific(num) {
    if (!num || num === 0) return '0';
    if (Math.abs(num) < 0.001) return num.toExponential(2);
    if (Math.abs(num) < 1) return num.toFixed(4);
    return num.toFixed(2);
}

function getRiskColor(level) {
    const colors = {
        'Critical': '#ef4444',
        'High': '#f97316',
        'Medium': '#eab308',
        'Low': '#10b981'
    };
    return colors[level] || '#64748b';
}

// ── Initialize ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Sidebar navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(item.dataset.page);
        });
    });
    
    // Mobile menu toggle
    document.getElementById('menuToggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });
    
    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', () => {
        const currentPage = document.querySelector('.nav-item.active')?.dataset.page || 'dashboard';
        initPage(currentPage);
        showToast('Data refreshed successfully', 'success');
    });
    
    // Close modal on overlay click
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
    });
    
    // Hash routing
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    navigateTo(hash);
});
