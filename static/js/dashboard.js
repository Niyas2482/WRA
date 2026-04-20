/* ═══════════════════════════════════════════════════════════════════════
   Dashboard Module
   ═══════════════════════════════════════════════════════════════════════ */

let dashboardCharts = {};
let dashboardMap = null;

async function loadDashboard() {
    try {
        const stats = await apiGet('/api/dashboard/stats');
        renderKPIs(stats);
        renderRiskDistChart(stats.risk_distribution);
        renderCategoryChart(stats.contaminant_categories);
        renderTrendsChart(stats.sample_trends);
        renderDashboardMap(stats);
        renderRecentAssessments(stats.recent_assessments);
    } catch (err) {
        showToast('Failed to load dashboard: ' + err.message, 'error');
    }
}

function renderKPIs(stats) {
    animateCounter(document.getElementById('kpiActiveSites'), stats.active_sites);
    animateCounter(document.getElementById('kpiTotalSamples'), stats.total_samples);
    animateCounter(document.getElementById('kpiExceedances'), stats.exceedances);
    animateCounter(document.getElementById('kpiAssessments'), stats.total_assessments);
}

function renderRiskDistChart(dist) {
    const ctx = document.getElementById('riskDistChart');
    if (!ctx) return;
    if (dashboardCharts.riskDist) dashboardCharts.riskDist.destroy();
    
    dashboardCharts.riskDist = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Critical', 'High', 'Medium', 'Low'],
            datasets: [{
                label: 'Risk Assessments',
                data: [dist.critical, dist.high, dist.medium, dist.low],
                backgroundColor: [
                    'rgba(239, 68, 68, 0.8)',
                    'rgba(249, 115, 22, 0.8)',
                    'rgba(234, 179, 8, 0.8)',
                    'rgba(16, 185, 129, 0.8)'
                ],
                borderColor: [
                    '#ef4444', '#f97316', '#eab308', '#10b981'
                ],
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(148, 163, 184, 0.06)' },
                    ticks: { stepSize: 1 }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

function renderCategoryChart(categories) {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;
    if (dashboardCharts.category) dashboardCharts.category.destroy();
    
    const colors = [
        'rgba(59, 130, 246, 0.8)',
        'rgba(6, 182, 212, 0.8)',
        'rgba(139, 92, 246, 0.8)',
        'rgba(236, 72, 153, 0.8)',
        'rgba(16, 185, 129, 0.8)'
    ];
    
    dashboardCharts.category = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: categories.map(c => c.category),
            datasets: [{
                data: categories.map(c => c.count),
                backgroundColor: colors.slice(0, categories.length),
                borderColor: 'rgba(10, 14, 26, 0.8)',
                borderWidth: 3,
                hoverOffset: 8
            }]
        },
        options: {
            cutout: '60%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { padding: 12, font: { size: 11 } }
                }
            }
        }
    });
}

function renderTrendsChart(trends) {
    const ctx = document.getElementById('trendsChart');
    if (!ctx) return;
    if (dashboardCharts.trends) dashboardCharts.trends.destroy();
    
    dashboardCharts.trends = new Chart(ctx, {
        type: 'line',
        data: {
            labels: trends.map(t => t.month),
            datasets: [{
                label: 'Samples Collected',
                data: trends.map(t => t.count),
                borderColor: '#06b6d4',
                backgroundColor: 'rgba(6, 182, 212, 0.1)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#06b6d4',
                pointBorderColor: '#0a0e1a',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 7
            }]
        },
        options: {
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(148, 163, 184, 0.06)' }
                },
                x: {
                    grid: { display: false },
                    ticks: { maxRotation: 45, font: { size: 10 } }
                }
            }
        }
    });
}

function renderDashboardMap(stats) {
    const mapEl = document.getElementById('dashboardMap');
    if (!mapEl) return;
    
    if (dashboardMap) {
        dashboardMap.remove();
    }
    
    dashboardMap = L.map('dashboardMap', {
        center: [22.5, 78.5],
        zoom: 5,
        zoomControl: true,
        attributionControl: false
    });
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
    }).addTo(dashboardMap);
    
    // Fetch sites and add markers
    apiGet('/api/sites').then(sites => {
        sites.forEach(site => {
            const color = getRiskColor(site.risk_level);
            const marker = L.circleMarker([site.latitude, site.longitude], {
                radius: 8,
                fillColor: color,
                color: color,
                weight: 2,
                opacity: 0.9,
                fillOpacity: 0.6
            }).addTo(dashboardMap);
            
            marker.bindPopup(`
                <strong>${site.name}</strong><br>
                <span style="color:#94a3b8">${site.location}</span><br>
                <span style="color:${color}; font-weight:600">Risk: ${site.risk_level}</span><br>
                <span style="color:#94a3b8">Status: ${site.status}</span>
            `);
        });
        
        // Fit bounds if sites exist
        if (sites.length > 0) {
            const bounds = sites.map(s => [s.latitude, s.longitude]);
            dashboardMap.fitBounds(bounds, { padding: [30, 30] });
        }
    });
    
    setTimeout(() => dashboardMap.invalidateSize(), 100);
}

function renderRecentAssessments(assessments) {
    const tbody = document.getElementById('recentAssessmentsBody');
    if (!tbody) return;
    
    tbody.innerHTML = assessments.map(a => `
        <tr>
            <td style="color: var(--text-primary); font-weight: 500">${a.assessment_name || 'N/A'}</td>
            <td>${a.site_name || 'N/A'}</td>
            <td>${a.exposure_pathway || 'N/A'}</td>
            <td><strong>${a.hazard_index ? a.hazard_index.toFixed(3) : 'N/A'}</strong></td>
            <td>${a.cancer_risk ? a.cancer_risk.toExponential(2) : 'N/A'}</td>
            <td><span class="risk-badge ${(a.risk_level || '').toLowerCase()}">${a.risk_level || 'N/A'}</span></td>
            <td><span class="status-badge ${(a.status || '').toLowerCase()}">${a.status || 'N/A'}</span></td>
        </tr>
    `).join('');
}
