/* ═══════════════════════════════════════════════════════════════════════
   Sites Module
   ═══════════════════════════════════════════════════════════════════════ */

let sitesMap = null;
let sitesData = [];

async function loadSites() {
    try {
        sitesData = await apiGet('/api/sites');
        renderSitesGrid(sitesData);
        renderSitesMap(sitesData);
    } catch (err) {
        showToast('Failed to load sites: ' + err.message, 'error');
    }
}

function renderSitesGrid(sites) {
    const grid = document.getElementById('sitesGrid');
    if (!grid) return;
    
    grid.innerHTML = sites.map(function(s) {
        var rl = (s.risk_level || 'medium').toLowerCase();
        return '<div class="site-card ' + rl + '">' +
            '<div class="site-header">' +
                '<div>' +
                    '<h4>' + s.name + '</h4>' +
                    '<div class="site-location"><i class="fas fa-map-pin"></i> ' + (s.location || 'Unknown') + '</div>' +
                '</div>' +
                '<span class="risk-badge ' + rl + '">' + s.risk_level + '</span>' +
            '</div>' +
            '<p style="font-size:12px;color:var(--text-muted);margin:8px 0;line-height:1.5">' + (s.description || '').substring(0, 120) + '...</p>' +
            '<div class="site-stats">' +
                '<div class="site-stat">' +
                    '<span class="stat-value">' + (s.sample_count || 0) + '</span>' +
                    '<span class="stat-label">Samples</span>' +
                '</div>' +
                '<div class="site-stat">' +
                    '<span class="stat-value">' + (s.assessment_count || 0) + '</span>' +
                    '<span class="stat-label">Assessments</span>' +
                '</div>' +
                '<div class="site-stat">' +
                    '<span class="stat-value">' + (s.area_sqm ? (s.area_sqm / 1000).toFixed(1) + 'k' : 'N/A') + '</span>' +
                    '<span class="stat-label">Area (m²)</span>' +
                '</div>' +
                '<div class="site-stat">' +
                    '<span class="stat-value">' + (s.aquifer_type || 'N/A') + '</span>' +
                    '<span class="stat-label">Aquifer</span>' +
                '</div>' +
            '</div>' +
            '<div class="site-actions">' +
                '<button class="btn-sm" onclick="editSite(' + s.id + ')"><i class="fas fa-edit"></i> Edit</button>' +
                '<button class="btn-sm" onclick="viewSiteOnMap(' + s.latitude + ',' + s.longitude + ')"><i class="fas fa-map"></i> Map</button>' +
                '<button class="btn-sm" onclick="runSiteAssessment(' + s.id + ')"><i class="fas fa-shield-alt"></i> Assess</button>' +
                '<button class="btn-sm" onclick="deleteSite(' + s.id + ')" style="color:var(--accent-red)"><i class="fas fa-trash"></i></button>' +
            '</div>' +
        '</div>';
    }).join('');
}

function renderSitesMap(sites) {
    var mapEl = document.getElementById('sitesMapContainer');
    if (!mapEl) return;
    
    if (sitesMap) sitesMap.remove();
    
    sitesMap = L.map('sitesMapContainer', {
        center: [22.5, 78.5],
        zoom: 5,
        attributionControl: false
    });
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
    }).addTo(sitesMap);
    
    sites.forEach(function(site) {
        var color = getRiskColor(site.risk_level);
        var marker = L.circleMarker([site.latitude, site.longitude], {
            radius: 10,
            fillColor: color,
            color: color,
            weight: 2,
            opacity: 0.9,
            fillOpacity: 0.5
        }).addTo(sitesMap);
        
        marker.bindPopup(
            '<strong>' + site.name + '</strong><br>' +
            '<span style="color:#94a3b8">' + (site.location || '') + '</span><br>' +
            '<span style="color:' + color + ';font-weight:600">Risk: ' + site.risk_level + '</span><br>' +
            '<span style="color:#94a3b8">Status: ' + site.status + '</span><br>' +
            '<span style="color:#94a3b8">Samples: ' + (site.sample_count || 0) + '</span>'
        );
    });
    
    if (sites.length > 0) {
        var bounds = sites.map(function(s) { return [s.latitude, s.longitude]; });
        sitesMap.fitBounds(bounds, { padding: [30, 30] });
    }
    
    setTimeout(function() { sitesMap.invalidateSize(); }, 100);
}

function viewSiteOnMap(lat, lng) {
    if (sitesMap) {
        sitesMap.setView([lat, lng], 12);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function runSiteAssessment(siteId) {
    navigateTo('risk');
    setTimeout(function() {
        var select = document.getElementById('riskSiteSelect');
        if (select) select.value = siteId;
    }, 500);
}

function openSiteModal(data) {
    var isEdit = !!data;
    var html = 
        '<div class="control-group">' +
            '<label>Site Name *</label>' +
            '<input type="text" class="text-input" id="formSiteName" value="' + (data ? data.name : '') + '" required>' +
        '</div>' +
        '<div class="control-group">' +
            '<label>Location</label>' +
            '<input type="text" class="text-input" id="formSiteLocation" value="' + (data ? data.location || '' : '') + '">' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
            '<div class="control-group">' +
                '<label>Latitude</label>' +
                '<input type="number" class="text-input" id="formSiteLat" value="' + (data ? data.latitude : '28.6139') + '" step="0.0001">' +
            '</div>' +
            '<div class="control-group">' +
                '<label>Longitude</label>' +
                '<input type="number" class="text-input" id="formSiteLng" value="' + (data ? data.longitude : '77.2090') + '" step="0.0001">' +
            '</div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
            '<div class="control-group">' +
                '<label>Area (m²)</label>' +
                '<input type="number" class="text-input" id="formSiteArea" value="' + (data ? data.area_sqm : '10000') + '">' +
            '</div>' +
            '<div class="control-group">' +
                '<label>Aquifer Type</label>' +
                '<select class="select-input" id="formSiteAquifer">' +
                    '<option value="Unconfined">Unconfined</option>' +
                    '<option value="Confined">Confined</option>' +
                    '<option value="Alluvial">Alluvial</option>' +
                    '<option value="Basaltic">Basaltic</option>' +
                    '<option value="Crystalline">Crystalline</option>' +
                    '<option value="Laterite">Laterite</option>' +
                    '<option value="Sedimentary">Sedimentary</option>' +
                '</select>' +
            '</div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
            '<div class="control-group">' +
                '<label>Status</label>' +
                '<select class="select-input" id="formSiteStatus">' +
                    '<option value="Active">Active</option>' +
                    '<option value="Monitoring">Monitoring</option>' +
                    '<option value="Under Review">Under Review</option>' +
                    '<option value="Remediation">Remediation</option>' +
                    '<option value="Closed">Closed</option>' +
                '</select>' +
            '</div>' +
            '<div class="control-group">' +
                '<label>Risk Level</label>' +
                '<select class="select-input" id="formSiteRisk">' +
                    '<option value="Low">Low</option>' +
                    '<option value="Medium">Medium</option>' +
                    '<option value="High">High</option>' +
                    '<option value="Critical">Critical</option>' +
                '</select>' +
            '</div>' +
        '</div>' +
        '<div class="control-group">' +
            '<label>Description</label>' +
            '<textarea class="text-input" id="formSiteDesc" rows="3" style="resize:vertical">' + (data ? data.description || '' : '') + '</textarea>' +
        '</div>';
    
    openModal(isEdit ? 'Edit Site' : 'Add New Site', html, 'site', data);
    
    if (data) {
        setTimeout(function() {
            var aq = document.getElementById('formSiteAquifer');
            var st = document.getElementById('formSiteStatus');
            var rl = document.getElementById('formSiteRisk');
            if (aq) aq.value = data.aquifer_type || 'Unconfined';
            if (st) st.value = data.status || 'Active';
            if (rl) rl.value = data.risk_level || 'Medium';
        }, 50);
    }
}

async function saveSite() {
    var payload = {
        name: document.getElementById('formSiteName').value,
        location: document.getElementById('formSiteLocation').value,
        latitude: parseFloat(document.getElementById('formSiteLat').value),
        longitude: parseFloat(document.getElementById('formSiteLng').value),
        area_sqm: parseFloat(document.getElementById('formSiteArea').value),
        aquifer_type: document.getElementById('formSiteAquifer').value,
        status: document.getElementById('formSiteStatus').value,
        risk_level: document.getElementById('formSiteRisk').value,
        description: document.getElementById('formSiteDesc').value
    };
    
    if (!payload.name) {
        showToast('Please enter a site name', 'warning');
        return;
    }
    
    try {
        if (currentModalData && currentModalData.id) {
            await apiPut('/api/sites/' + currentModalData.id, payload);
            showToast('Site updated successfully', 'success');
        } else {
            await apiPost('/api/sites', payload);
            showToast('Site added successfully', 'success');
        }
        closeModal();
        loadSites();
    } catch (err) {
        showToast('Error saving site: ' + err.message, 'error');
    }
}

function editSite(id) {
    var data = sitesData.find(function(s) { return s.id === id; });
    if (data) openSiteModal(data);
}

async function deleteSite(id) {
    if (!confirm('Are you sure you want to delete this site and all its data?')) return;
    try {
        await apiDelete('/api/sites/' + id);
        showToast('Site deleted', 'success');
        loadSites();
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}
