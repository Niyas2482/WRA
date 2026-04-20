/* ═══════════════════════════════════════════════════════════════════════
   Exposure Analysis Module
   ═══════════════════════════════════════════════════════════════════════ */

let exposureChart = null;

async function initExposure() {
    try {
        const contaminants = await apiGet('/api/contaminants');
        const select = document.getElementById('expContaminant');
        if (select) {
            select.innerHTML = `<option value="">-- Select Contaminant --</option>` +
                contaminants.map(c => `<option value="${c.id}" data-rfd="${c.oral_rfd}" data-csf="${c.oral_csf}" data-carcin="${c.is_carcinogen}" data-mcl="${c.mcl}">${c.name} (MCL: ${c.mcl || 'N/A'} mg/L)</option>`).join('');
            
            select.addEventListener('change', () => {
                const opt = select.selectedOptions[0];
                if (opt && opt.value) {
                    const mcl = parseFloat(opt.dataset.mcl) || 0.01;
                    document.getElementById('expConcentration').value = (mcl * 2).toFixed(4);
                }
            });
        }
    } catch (err) {
        showToast('Failed to load contaminants: ' + err.message, 'error');
    }
}

async function runExposureAnalysis() {
    const contaminantId = document.getElementById('expContaminant').value;
    const concentration = parseFloat(document.getElementById('expConcentration').value);
    const receptor = document.getElementById('expReceptor').value;
    
    const pathways = [];
    if (document.getElementById('pathIngestion').checked) pathways.push('ingestion');
    if (document.getElementById('pathDermal').checked) pathways.push('dermal');
    if (document.getElementById('pathInhalation').checked) pathways.push('inhalation');
    
    if (pathways.length === 0) {
        showToast('Please select at least one exposure pathway', 'warning');
        return;
    }
    
    if (!concentration || concentration <= 0) {
        showToast('Please enter a valid concentration', 'warning');
        return;
    }
    
    const payload = {
        concentration,
        pathways,
        receptor,
        contaminant_id: contaminantId || null
    };
    
    showLoading();
    
    try {
        const results = await apiPost('/api/analyze/exposure', payload);
        renderExposureResults(results);
        showToast('Exposure analysis completed', 'success');
    } catch (err) {
        showToast('Analysis error: ' + err.message, 'error');
    } finally {
        hideLoading();
    }
}

function renderExposureResults(results) {
    // Summary
    const summary = document.getElementById('exposureSummary');
    summary.style.display = 'block';
    
    const riskLevel = results.overall_risk_level;
    const riskColor = getRiskColor(riskLevel);
    
    document.getElementById('overallRiskLevel').innerHTML = 
        `<span style="color:${riskColor}">Overall Risk: ${riskLevel}</span>`;
    document.getElementById('overallHI').textContent = 
        `Hazard Index: ${results.total_hazard_index.toFixed(4)}`;
    document.getElementById('overallCR').textContent = 
        `Total Cancer Risk: ${results.total_cancer_risk.toExponential(2)}`;
    document.getElementById('remediationFlag').innerHTML = results.remediation_needed 
        ? '<span style="color:var(--accent-red)"><i class="fas fa-exclamation-triangle"></i> Remediation Recommended</span>'
        : '<span style="color:var(--accent-green)"><i class="fas fa-check-circle"></i> Within Acceptable Limits</span>';
    
    // Gauge
    const gaugePercent = Math.min(100, results.total_hazard_index * 50);
    const gaugeFill = document.getElementById('gaugeFill');
    const gaugeLabel = document.getElementById('gaugeLabel');
    gaugeLabel.textContent = results.total_hazard_index.toFixed(2);
    
    const gauge = document.getElementById('riskGauge');
    gauge.style.background = `conic-gradient(
        ${riskColor} 0deg,
        ${riskColor}80 ${gaugePercent * 3.6}deg,
        rgba(30, 41, 59, 0.5) ${gaugePercent * 3.6}deg 360deg
    )`;
    
    // Pathway cards
    const pathwayCards = document.getElementById('pathwayCards');
    const pathwayIcons = {
        'ingestion': { icon: 'fa-glass-water', cls: 'ingestion' },
        'dermal': { icon: 'fa-hand-holding-water', cls: 'dermal' },
        'inhalation': { icon: 'fa-lungs', cls: 'inhalation' }
    };
    
    pathwayCards.innerHTML = Object.entries(results.pathways).map(([pathway, data]) => {
        const pi = pathwayIcons[pathway] || { icon: 'fa-circle', cls: '' };
        return `
            <div class="pathway-card">
                <div class="pathway-header">
                    <div class="pathway-icon ${pi.cls}"><i class="fas ${pi.icon}"></i></div>
                    <div>
                        <h4>${pathway.charAt(0).toUpperCase() + pathway.slice(1)}</h4>
                        <span class="risk-badge ${data.risk.risk_level.toLowerCase()}">${data.risk.risk_level}</span>
                    </div>
                </div>
                <div class="metric"><span class="label">Average Daily Dose</span><span class="value">${data.exposure.add.toExponential(3)} mg/kg/day</span></div>
                <div class="metric"><span class="label">Lifetime ADD</span><span class="value">${data.exposure.ladd.toExponential(3)} mg/kg/day</span></div>
                <div class="metric"><span class="label">Hazard Quotient</span><span class="value" style="color:${getRiskColor(data.risk.risk_level)}">${data.risk.hazard_quotient.toFixed(4)}</span></div>
                <div class="metric"><span class="label">Cancer Risk</span><span class="value">${data.risk.cancer_risk.toExponential(2)}</span></div>
                <div class="metric"><span class="label">Risk Score</span><span class="value">${data.risk.risk_score.toFixed(1)}</span></div>
            </div>
        `;
    }).join('');
    
    // Chart
    renderExposureChart(results);
}

function renderExposureChart(results) {
    const chartCard = document.getElementById('exposureChartCard');
    chartCard.style.display = 'block';
    
    const ctx = document.getElementById('exposureChart');
    if (exposureChart) exposureChart.destroy();
    
    const pathways = Object.keys(results.pathways);
    const hqValues = pathways.map(p => results.pathways[p].risk.hazard_quotient);
    const crValues = pathways.map(p => results.pathways[p].risk.cancer_risk * 1e6); // Scale for visibility
    
    exposureChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: pathways.map(p => p.charAt(0).toUpperCase() + p.slice(1)),
            datasets: [
                {
                    label: 'Hazard Quotient',
                    data: hqValues,
                    backgroundColor: 'rgba(59, 130, 246, 0.7)',
                    borderColor: '#3b82f6',
                    borderWidth: 2,
                    borderRadius: 6,
                    yAxisID: 'y'
                },
                {
                    label: 'Cancer Risk (×10⁻⁶)',
                    data: crValues,
                    backgroundColor: 'rgba(239, 68, 68, 0.7)',
                    borderColor: '#ef4444',
                    borderWidth: 2,
                    borderRadius: 6,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            plugins: {
                legend: { labels: { font: { size: 11 } } }
            },
            scales: {
                y: {
                    type: 'linear',
                    position: 'left',
                    title: { display: true, text: 'Hazard Quotient', color: '#3b82f6' },
                    grid: { color: 'rgba(148, 163, 184, 0.06)' },
                    beginAtZero: true
                },
                y1: {
                    type: 'linear',
                    position: 'right',
                    title: { display: true, text: 'Cancer Risk (×10⁻⁶)', color: '#ef4444' },
                    grid: { drawOnChartArea: false },
                    beginAtZero: true
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}
