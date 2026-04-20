/* ═══════════════════════════════════════════════════════════════════════
   Risk Assessment Module
   ═══════════════════════════════════════════════════════════════════════ */

let riskMatrixChart = null;

async function initRisk() {
    try {
        const sites = await apiGet('/api/sites');
        const select = document.getElementById('riskSiteSelect');
        if (select) {
            select.innerHTML = '<option value="">-- Select Site --</option>' +
                sites.map(s => '<option value="' + s.id + '">' + s.name + ' (' + s.risk_level + ')</option>').join('');
        }
        loadAssessmentHistory();
    } catch (err) {
        showToast('Failed to load sites: ' + err.message, 'error');
    }
}

async function runRiskAssessment() {
    const siteId = document.getElementById('riskSiteSelect').value;
    const name = document.getElementById('riskAssessmentName').value;
    const receptor = document.getElementById('riskReceptor').value;
    
    if (!siteId) {
        showToast('Please select a site', 'warning');
        return;
    }
    
    showLoading();
    
    try {
        const results = await apiPost('/api/assess/risk', {
            site_id: parseInt(siteId),
            name: name || undefined,
            receptor: receptor
        });
        renderRiskResults(results);
        loadAssessmentHistory();
        showToast('Risk assessment completed', 'success');
    } catch (err) {
        showToast('Assessment error: ' + err.message, 'error');
    } finally {
        hideLoading();
    }
}

function renderRiskResults(results) {
    const container = document.getElementById('riskResultsContainer');
    container.style.display = 'block';
    
    const riskColor = getRiskColor(results.overall_risk_level);
    
    // Build contaminant rows
    let contRows = '';
    if (results.contaminant_risks && results.contaminant_risks.length > 0) {
        contRows = results.contaminant_risks.map(function(cr) {
            return '<tr>' +
                '<td style="font-weight:500;color:var(--text-primary)">' + cr.contaminant + '</td>' +
                '<td>' + cr.concentration.toFixed(4) + '</td>' +
                '<td>' + (cr.mcl || 'N/A') + '</td>' +
                '<td>' + cr.pathway + '</td>' +
                '<td><strong>' + cr.hazard_quotient.toFixed(4) + '</strong></td>' +
                '<td>' + cr.cancer_risk.toExponential(2) + '</td>' +
                '<td><span class="risk-badge ' + cr.risk_level.toLowerCase() + '">' + cr.risk_level + '</span></td>' +
                '</tr>';
        }).join('');
    }
    
    const summaryCard = document.getElementById('riskSummaryCard');
    summaryCard.innerHTML = 
        '<h3 style="display:flex;align-items:center;gap:10px">' +
            '<i class="fas fa-shield-alt" style="color:' + riskColor + '"></i>' +
            ' Assessment Results - ' + (results.site ? results.site.name : 'Site') +
        '</h3>' +
        '<div class="risk-metrics">' +
            '<div class="risk-metric">' +
                '<span class="metric-value" style="color:' + riskColor + '">' + results.overall_risk_level + '</span>' +
                '<span class="metric-label">Overall Risk Level</span>' +
            '</div>' +
            '<div class="risk-metric">' +
                '<span class="metric-value" style="color:var(--accent-cyan)">' + results.overall_hazard_index.toFixed(3) + '</span>' +
                '<span class="metric-label">Hazard Index</span>' +
            '</div>' +
            '<div class="risk-metric">' +
                '<span class="metric-value" style="color:var(--accent-purple)">' + results.overall_cancer_risk.toExponential(2) + '</span>' +
                '<span class="metric-label">Total Cancer Risk</span>' +
            '</div>' +
            '<div class="risk-metric">' +
                '<span class="metric-value" style="color:' + (results.assessment && results.assessment.remediation_needed ? 'var(--accent-red)' : 'var(--accent-green)') + '">' +
                    (results.assessment && results.assessment.remediation_needed ? 'Yes' : 'No') +
                '</span>' +
                '<span class="metric-label">Remediation Needed</span>' +
            '</div>' +
        '</div>' +
        '<div style="margin-top:16px;padding:14px;background:var(--bg-tertiary);border-radius:8px;border-left:3px solid ' + riskColor + '">' +
            '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Recommended Action</div>' +
            '<div style="font-size:13px;color:var(--text-secondary)">' + results.recommended_action + '</div>' +
        '</div>' +
        (contRows ? 
            '<div style="margin-top:16px;overflow-x:auto">' +
                '<table class="data-table" style="font-size:12px">' +
                    '<thead><tr><th>Contaminant</th><th>Conc. (mg/L)</th><th>MCL</th><th>Pathway</th><th>HQ</th><th>Cancer Risk</th><th>Level</th></tr></thead>' +
                    '<tbody>' + contRows + '</tbody>' +
                '</table>' +
            '</div>' : '');
    
    // Render risk matrix chart
    renderRiskMatrix(results.contaminant_risks || []);
}

function renderRiskMatrix(risks) {
    const ctx = document.getElementById('riskMatrixChart');
    if (!ctx) return;
    if (riskMatrixChart) riskMatrixChart.destroy();
    
    // Group by contaminant
    const grouped = {};
    risks.forEach(function(r) {
        if (!grouped[r.contaminant]) grouped[r.contaminant] = { hq: 0, cr: 0 };
        grouped[r.contaminant].hq += r.hazard_quotient;
        grouped[r.contaminant].cr += r.cancer_risk;
    });
    
    const labels = Object.keys(grouped);
    const hqData = labels.map(function(l) { return grouped[l].hq; });
    const crData = labels.map(function(l) { return grouped[l].cr * 1e6; });
    
    riskMatrixChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Hazard Quotient',
                    data: hqData,
                    backgroundColor: hqData.map(function(v) {
                        if (v > 10) return 'rgba(239, 68, 68, 0.8)';
                        if (v > 1) return 'rgba(249, 115, 22, 0.8)';
                        if (v > 0.5) return 'rgba(234, 179, 8, 0.8)';
                        return 'rgba(16, 185, 129, 0.8)';
                    }),
                    borderRadius: 6,
                    borderSkipped: false,
                    yAxisID: 'y'
                }
            ]
        },
        options: {
            indexAxis: 'y',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(ctx) { return 'HQ: ' + ctx.parsed.x.toFixed(4); }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Hazard Quotient', color: '#94a3b8' },
                    grid: { color: 'rgba(148, 163, 184, 0.06)' },
                    beginAtZero: true
                },
                y: {
                    grid: { display: false },
                    ticks: { font: { size: 11 } }
                }
            }
        }
    });
}

async function loadAssessmentHistory() {
    try {
        const assessments = await apiGet('/api/assessments');
        const tbody = document.getElementById('assessmentHistoryBody');
        if (!tbody) return;
        
        tbody.innerHTML = assessments.map(function(a) {
            var date = a.assessment_date ? new Date(a.assessment_date).toLocaleDateString() : 'N/A';
            return '<tr>' +
                '<td style="font-weight:500;color:var(--text-primary)">' + (a.assessment_name || 'N/A') + '</td>' +
                '<td>' + (a.site_name || 'N/A') + '</td>' +
                '<td>' + (a.exposure_pathway || 'N/A') + '</td>' +
                '<td><strong>' + (a.hazard_quotient ? a.hazard_quotient.toFixed(3) : 'N/A') + '</strong></td>' +
                '<td>' + (a.cancer_risk ? a.cancer_risk.toExponential(2) : 'N/A') + '</td>' +
                '<td><span class="risk-badge ' + (a.risk_level || '').toLowerCase() + '">' + (a.risk_level || 'N/A') + '</span></td>' +
                '<td>' + date + '</td>' +
                '<td><button class="btn-sm" onclick="deleteAssessment(' + a.id + ')" style="color:var(--accent-red)"><i class="fas fa-trash"></i></button></td>' +
                '</tr>';
        }).join('');
    } catch (err) {
        console.error('Error loading assessments:', err);
    }
}

async function deleteAssessment(id) {
    if (!confirm('Delete this assessment?')) return;
    try {
        await apiDelete('/api/assessments/' + id);
        showToast('Assessment deleted', 'success');
        loadAssessmentHistory();
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}
