/* ═══════════════════════════════════════════════════════════════════════
   Transport Modeling Module
   ═══════════════════════════════════════════════════════════════════════ */

let transportCharts = {};

function initTransport() {
    // Charts will be created on first simulation
}

function updateTransportLabel(input) {
    const id = input.id + 'Val';
    const label = document.getElementById(id);
    if (label) label.textContent = input.value;
}

async function runTransportSimulation() {
    const params = {
        source_concentration: parseFloat(document.getElementById('srcConc').value),
        velocity: parseFloat(document.getElementById('gwVelocity').value),
        dispersion: parseFloat(document.getElementById('dispCoeff').value),
        retardation: parseFloat(document.getElementById('retardation').value),
        decay: parseFloat(document.getElementById('decayRate').value),
        time: parseFloat(document.getElementById('simTime').value),
        distance: parseFloat(document.getElementById('maxDist').value)
    };
    
    showLoading();
    
    try {
        const results = await apiPost('/api/simulate/transport', params);
        renderSpatialChart(results.spatial_profile, params);
        renderBreakthroughChart(results.time_series, params);
        renderPlumeVisualization(results.plume_2d, params);
        showToast('Transport simulation completed', 'success');
    } catch (err) {
        showToast('Simulation error: ' + err.message, 'error');
    } finally {
        hideLoading();
    }
}

function renderSpatialChart(profile, params) {
    const ctx = document.getElementById('spatialChart');
    if (!ctx) return;
    if (transportCharts.spatial) transportCharts.spatial.destroy();
    
    // Downsample for smooth rendering
    const step = Math.max(1, Math.floor(profile.distances.length / 100));
    const distances = profile.distances.filter((_, i) => i % step === 0);
    const concentrations = profile.concentrations.filter((_, i) => i % step === 0);
    
    transportCharts.spatial = new Chart(ctx, {
        type: 'line',
        data: {
            labels: distances.map(d => d.toFixed(1)),
            datasets: [
                {
                    label: 'Concentration',
                    data: concentrations,
                    borderColor: '#06b6d4',
                    backgroundColor: 'rgba(6, 182, 212, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0,
                    borderWidth: 2.5
                },
                {
                    label: 'MCL (example: 0.01 mg/L)',
                    data: distances.map(() => 0.01 * params.source_concentration),
                    borderColor: '#ef4444',
                    borderWidth: 1.5,
                    borderDash: [8, 4],
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            plugins: {
                legend: { labels: { font: { size: 11 } } },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(4)} mg/L`
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Distance (m)', color: '#94a3b8' },
                    grid: { color: 'rgba(148, 163, 184, 0.06)' },
                    ticks: { maxTicksLimit: 10 }
                },
                y: {
                    title: { display: true, text: 'Concentration (mg/L)', color: '#94a3b8' },
                    grid: { color: 'rgba(148, 163, 184, 0.06)' },
                    beginAtZero: true
                }
            },
            interaction: { intersect: false, mode: 'index' }
        }
    });
}

function renderBreakthroughChart(timeSeries, params) {
    const ctx = document.getElementById('breakthroughChart');
    if (!ctx) return;
    if (transportCharts.breakthrough) transportCharts.breakthrough.destroy();
    
    const step = Math.max(1, Math.floor(timeSeries.times.length / 80));
    const times = timeSeries.times.filter((_, i) => i % step === 0);
    const concs = timeSeries.concentrations.filter((_, i) => i % step === 0);
    
    transportCharts.breakthrough = new Chart(ctx, {
        type: 'line',
        data: {
            labels: times.map(t => t.toFixed(1)),
            datasets: [{
                label: `C at x = ${timeSeries.monitor_distance.toFixed(0)} m`,
                data: concs,
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                fill: true,
                tension: 0.3,
                pointRadius: 0,
                borderWidth: 2.5
            }]
        },
        options: {
            plugins: {
                legend: { labels: { font: { size: 11 } } },
                tooltip: {
                    callbacks: {
                        label: ctx => `Concentration: ${ctx.parsed.y.toFixed(4)} mg/L`
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Time (days)', color: '#94a3b8' },
                    grid: { color: 'rgba(148, 163, 184, 0.06)' },
                    ticks: { maxTicksLimit: 10 }
                },
                y: {
                    title: { display: true, text: 'Concentration (mg/L)', color: '#94a3b8' },
                    grid: { color: 'rgba(148, 163, 184, 0.06)' },
                    beginAtZero: true
                }
            },
            interaction: { intersect: false, mode: 'index' }
        }
    });
}

function renderPlumeVisualization(plume, params) {
    const canvas = document.getElementById('plumeCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    
    const data = plume.concentrations;
    const rows = data.length;
    const cols = data[0]?.length || 0;
    
    if (rows === 0 || cols === 0) return;
    
    // Find max concentration for normalization
    let maxC = 0;
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            if (data[i][j] > maxC) maxC = data[i][j];
        }
    }
    
    const cellW = w / cols;
    const cellH = h / rows;
    
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            const val = maxC > 0 ? data[i][j] / maxC : 0;
            
            if (val < 0.001) {
                ctx.fillStyle = 'rgba(10, 14, 26, 0)';
            } else {
                // Concentration gradient: blue -> cyan -> yellow -> orange -> red
                const hue = 200 - val * 200; // blue(200) to red(0)
                const saturation = 80 + val * 20;
                const lightness = 15 + val * 40;
                const alpha = Math.min(0.9, val * 1.5);
                ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
            }
            
            ctx.fillRect(j * cellW, i * cellH, cellW + 1, cellH + 1);
        }
    }
    
    // Draw source indicator
    const srcX = cols * 0.167 * cellW;
    const srcY = h / 2;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(srcX, srcY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Labels
    ctx.fillStyle = '#f0f4f8';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText('Source', srcX - 16, srcY - 12);
    ctx.fillText(`v = ${params.velocity} m/d`, 10, 20);
    ctx.fillText(`D = ${params.dispersion} m²/d`, 10, 36);
    ctx.fillText(`t = ${params.time} days`, 10, 52);
    
    // Color bar
    const barX = w - 30;
    const barY = 20;
    const barH = h - 40;
    const barW = 15;
    
    const gradient = ctx.createLinearGradient(barX, barY, barX, barY + barH);
    gradient.addColorStop(0, 'hsl(0, 100%, 55%)');
    gradient.addColorStop(0.25, 'hsl(40, 100%, 50%)');
    gradient.addColorStop(0.5, 'hsl(60, 100%, 45%)');
    gradient.addColorStop(0.75, 'hsl(180, 80%, 40%)');
    gradient.addColorStop(1, 'hsl(200, 80%, 25%)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    ctx.strokeRect(barX, barY, barW, barH);
    
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px Inter, sans-serif';
    ctx.fillText('High', barX - 5, barY - 4);
    ctx.fillText('Low', barX - 2, barY + barH + 12);
    
    // Flow direction arrow
    ctx.strokeStyle = '#f0f4f8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 30, h - 20);
    ctx.lineTo(w / 2 + 30, h - 20);
    ctx.lineTo(w / 2 + 22, h - 26);
    ctx.moveTo(w / 2 + 30, h - 20);
    ctx.lineTo(w / 2 + 22, h - 14);
    ctx.stroke();
    ctx.fillStyle = '#f0f4f8';
    ctx.font = '11px Inter, sans-serif';
    ctx.fillText('Flow →', w / 2 - 18, h - 6);
}
