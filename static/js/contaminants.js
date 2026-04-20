/* ═══════════════════════════════════════════════════════════════════════
   Contaminants Module
   ═══════════════════════════════════════════════════════════════════════ */

let contaminantsData = [];

async function loadContaminants() {
    try {
        const filter = document.getElementById('contaminantFilter')?.value || '';
        const endpoint = filter ? `/api/contaminants?category=${filter}` : '/api/contaminants';
        contaminantsData = await apiGet(endpoint);
        renderContaminantsTable(contaminantsData);
    } catch (err) {
        showToast('Failed to load contaminants: ' + err.message, 'error');
    }
}

function renderContaminantsTable(data) {
    const tbody = document.getElementById('contaminantsBody');
    if (!tbody) return;
    
    tbody.innerHTML = data.map(c => `
        <tr>
            <td style="color: var(--text-primary); font-weight: 500">
                <div style="display:flex;align-items:center;gap:8px">
                    <div style="width:8px;height:8px;border-radius:50%;background:${getCategoryColor(c.category)}"></div>
                    ${c.name}
                </div>
            </td>
            <td style="font-family:monospace;font-size:12px">${c.cas_number || '—'}</td>
            <td><span class="status-badge">${c.category || 'Unknown'}</span></td>
            <td><strong>${c.mcl != null ? c.mcl : '—'}</strong></td>
            <td>${c.oral_rfd != null ? c.oral_rfd : '—'}</td>
            <td>${c.oral_csf != null ? c.oral_csf : '—'}</td>
            <td class="${c.is_carcinogen ? 'carcin-yes' : 'carcin-no'}">
                <i class="fas ${c.is_carcinogen ? 'fa-exclamation-triangle' : 'fa-check-circle'}"></i>
                ${c.is_carcinogen ? 'Yes' : 'No'}
            </td>
            <td>
                <div style="display:flex;gap:4px">
                    <button class="btn-sm" onclick="viewContaminant(${c.id})" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-sm" onclick="editContaminant(${c.id})" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-sm" onclick="deleteContaminant(${c.id})" title="Delete" style="color:var(--accent-red)">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function getCategoryColor(category) {
    const colors = {
        'Heavy Metal': '#ef4444',
        'VOC': '#8b5cf6',
        'Inorganic': '#3b82f6',
        'Pesticide': '#f97316',
        'Other': '#64748b'
    };
    return colors[category] || '#64748b';
}

function openContaminantModal(data = null) {
    const isEdit = !!data;
    const html = `
        <div class="control-group">
            <label>Contaminant Name *</label>
            <input type="text" class="text-input" id="formContName" value="${data?.name || ''}" required>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="control-group">
                <label>CAS Number</label>
                <input type="text" class="text-input" id="formContCAS" value="${data?.cas_number || ''}">
            </div>
            <div class="control-group">
                <label>Category</label>
                <select class="select-input" id="formContCategory">
                    <option value="Heavy Metal" ${data?.category === 'Heavy Metal' ? 'selected' : ''}>Heavy Metal</option>
                    <option value="VOC" ${data?.category === 'VOC' ? 'selected' : ''}>VOC</option>
                    <option value="Inorganic" ${data?.category === 'Inorganic' ? 'selected' : ''}>Inorganic</option>
                    <option value="Pesticide" ${data?.category === 'Pesticide' ? 'selected' : ''}>Pesticide</option>
                    <option value="Other" ${data?.category === 'Other' ? 'selected' : ''}>Other</option>
                </select>
            </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="control-group">
                <label>MCL (mg/L)</label>
                <input type="number" class="text-input" id="formContMCL" value="${data?.mcl || ''}" step="0.0001" min="0">
            </div>
            <div class="control-group">
                <label>MCLG (mg/L)</label>
                <input type="number" class="text-input" id="formContMCLG" value="${data?.mclg || ''}" step="0.0001" min="0">
            </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="control-group">
                <label>Oral RfD (mg/kg/day)</label>
                <input type="number" class="text-input" id="formContRfD" value="${data?.oral_rfd || ''}" step="0.00001" min="0">
            </div>
            <div class="control-group">
                <label>Oral CSF</label>
                <input type="number" class="text-input" id="formContCSF" value="${data?.oral_csf || ''}" step="0.001" min="0">
            </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="control-group">
                <label>Molecular Weight</label>
                <input type="number" class="text-input" id="formContMW" value="${data?.molecular_weight || ''}" step="0.01">
            </div>
            <div class="control-group">
                <label>Half-life (days)</label>
                <input type="number" class="text-input" id="formContHL" value="${data?.half_life_days || ''}" step="1">
            </div>
        </div>
        <div class="control-group">
            <label>Health Effects</label>
            <textarea class="text-input" id="formContHealth" rows="3" style="resize:vertical">${data?.health_effects || ''}</textarea>
        </div>
        <div class="control-group">
            <label class="checkbox-label" style="background:none;padding:0">
                <input type="checkbox" id="formContCarcinogen" ${data?.is_carcinogen ? 'checked' : ''}>
                <span><i class="fas fa-exclamation-triangle"></i> Known Carcinogen</span>
            </label>
        </div>
    `;
    openModal(isEdit ? 'Edit Contaminant' : 'Add New Contaminant', html, 'contaminant', data);
}

async function saveContaminant() {
    const payload = {
        name: document.getElementById('formContName').value,
        cas_number: document.getElementById('formContCAS').value,
        category: document.getElementById('formContCategory').value,
        mcl: document.getElementById('formContMCL').value || null,
        mclg: document.getElementById('formContMCLG').value || null,
        oral_rfd: document.getElementById('formContRfD').value || null,
        oral_csf: document.getElementById('formContCSF').value || null,
        molecular_weight: document.getElementById('formContMW').value || null,
        half_life_days: document.getElementById('formContHL').value || null,
        health_effects: document.getElementById('formContHealth').value,
        is_carcinogen: document.getElementById('formContCarcinogen').checked
    };
    
    if (!payload.name) {
        showToast('Please enter a contaminant name', 'warning');
        return;
    }
    
    try {
        if (currentModalData?.id) {
            await apiPut(`/api/contaminants/${currentModalData.id}`, payload);
            showToast('Contaminant updated successfully', 'success');
        } else {
            await apiPost('/api/contaminants', payload);
            showToast('Contaminant added successfully', 'success');
        }
        closeModal();
        loadContaminants();
    } catch (err) {
        showToast('Error saving contaminant: ' + err.message, 'error');
    }
}

function editContaminant(id) {
    const data = contaminantsData.find(c => c.id === id);
    if (data) openContaminantModal(data);
}

function viewContaminant(id) {
    const c = contaminantsData.find(x => x.id === id);
    if (!c) return;
    
    const html = `
        <div style="display:grid;gap:12px">
            <div style="padding:12px;background:var(--bg-tertiary);border-radius:8px">
                <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Category</div>
                <div style="font-size:14px;font-weight:600">${c.category}</div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div style="padding:12px;background:var(--bg-tertiary);border-radius:8px">
                    <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">MCL</div>
                    <div style="font-size:16px;font-weight:700;color:var(--accent-cyan)">${c.mcl || 'N/A'} mg/L</div>
                </div>
                <div style="padding:12px;background:var(--bg-tertiary);border-radius:8px">
                    <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Oral RfD</div>
                    <div style="font-size:16px;font-weight:700;color:var(--accent-cyan)">${c.oral_rfd || 'N/A'} mg/kg/day</div>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div style="padding:12px;background:var(--bg-tertiary);border-radius:8px">
                    <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Oral CSF</div>
                    <div style="font-size:14px;font-weight:600">${c.oral_csf || 'N/A'}</div>
                </div>
                <div style="padding:12px;background:var(--bg-tertiary);border-radius:8px">
                    <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Carcinogen</div>
                    <div class="${c.is_carcinogen ? 'carcin-yes' : 'carcin-no'}" style="font-size:14px;font-weight:600">
                        <i class="fas ${c.is_carcinogen ? 'fa-exclamation-triangle' : 'fa-check-circle'}"></i> ${c.is_carcinogen ? 'Yes' : 'No'}
                    </div>
                </div>
            </div>
            ${c.health_effects ? `
            <div style="padding:12px;background:var(--bg-tertiary);border-radius:8px">
                <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Health Effects</div>
                <div style="font-size:13px;color:var(--text-secondary);line-height:1.5">${c.health_effects}</div>
            </div>
            ` : ''}
        </div>
    `;
    openModal(c.name, html, 'view');
    document.getElementById('modalSaveBtn').style.display = 'none';
}

async function deleteContaminant(id) {
    if (!confirm('Are you sure you want to delete this contaminant?')) return;
    try {
        await apiDelete(`/api/contaminants/${id}`);
        showToast('Contaminant deleted', 'success');
        loadContaminants();
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}

// Filter change listener
document.addEventListener('DOMContentLoaded', () => {
    const filter = document.getElementById('contaminantFilter');
    if (filter) filter.addEventListener('change', loadContaminants);
});
