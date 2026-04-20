/* Reports Module */

async function generateReport(type) {
    showLoading();
    try {
        var result = await buildReportContent(type);
        document.getElementById("reportTitle").textContent = result.title;
        document.getElementById("reportContent").innerHTML = result.html;
        document.getElementById("reportOutput").style.display = "block";
        document.getElementById("reportOutput").scrollIntoView({ behavior: "smooth" });
        showToast("Report generated", "success");
    } catch (err) {
        showToast("Error: " + err.message, "error");
    } finally { hideLoading(); }
}

function reportHeader(title) {
    var now = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    var s = '<div style="border-bottom:2px solid var(--accent-cyan);padding-bottom:16px;margin-bottom:20px">';
    s += '<h4 style="margin:0">AquaRisk IMS - ' + title + '</h4>';
    s += '<p style="font-size:12px;color:var(--text-muted);margin-top:4px">Generated: ' + now + '</p></div>';
    return s;
}

function tbl(headers, rows) {
    var h = "<table><thead><tr>" + headers.map(function(x){return "<th>"+x+"</th>";}).join("") + "</tr></thead><tbody>";
    rows.forEach(function(r){h+="<tr>"+r.map(function(c){return "<td>"+c+"</td>";}).join("")+"</tr>";});
    return h + "</tbody></table>";
}

async function buildReportContent(type) {
    var html = "", title = "";
    if (type === "site_summary") { html = await reportSiteSummary(); title = "Site Summary Report"; }
    else if (type === "contaminant_analysis") { html = await reportContaminants(); title = "Contaminant Analysis"; }
    else if (type === "risk_assessment") { html = await reportRiskAssessment(); title = "Risk Assessment Report"; }
    else if (type === "transport_model") { html = reportTransport(); title = "Transport Model Report"; }
    else if (type === "regulatory_compliance") { html = await reportCompliance(); title = "Regulatory Compliance"; }
    else if (type === "remediation_recs") { html = await reportRemediation(); title = "Remediation Recommendations"; }
    return {title: title, html: html};
}
async function reportSiteSummary() {
    var sites = await apiGet("/api/sites");
    var stats = await apiGet("/api/dashboard/stats");
    var html = reportHeader("Site Summary Report");
    html += "<h4>Overview</h4>";
    html += tbl(["Metric","Value"],[
        ["Total Sites","<strong>"+stats.total_sites+"</strong>"],
        ["Active Sites","<strong>"+stats.active_sites+"</strong>"],
        ["Total Samples","<strong>"+stats.total_samples+"</strong>"],
        ["MCL Exceedances",""+stats.exceedances],
        ["Assessments",""+stats.total_assessments]
    ]);
    html += "<h4>Site Details</h4>";
    var siteRows = sites.map(function(s){
        return [s.name, s.location||"N/A", s.status, s.risk_level, ""+(s.sample_count||0), s.aquifer_type||"N/A"];
    });
    html += tbl(["Site","Location","Status","Risk","Samples","Aquifer"], siteRows);
    return html;
}

async function reportContaminants() {
    var contaminants = await apiGet("/api/contaminants");
    var html = reportHeader("Contaminant Analysis");
    html += "<h4>Regulated Contaminants (" + contaminants.length + " tracked)</h4>";
    var cRows = contaminants.map(function(c){
        return [c.name, c.category, (c.mcl!=null?c.mcl:"N/A"), (c.oral_rfd!=null?c.oral_rfd:"N/A"), (c.oral_csf!=null?c.oral_csf:"N/A"), c.is_carcinogen?"Yes":"No"];
    });
    html += tbl(["Name","Category","MCL","RfD","CSF","Carcinogen"], cRows);
    html += "<h4>Health Effects</h4>";
    contaminants.forEach(function(c){
        if(c.health_effects) html += "<p style=\"margin:6px 0;padding:8px 12px;background:var(--bg-tertiary);border-radius:6px;font-size:12px\"><strong>" + c.name + ":</strong> " + c.health_effects + "</p>";
    });
    return html;
}

async function reportRiskAssessment() {
    var assessments = await apiGet("/api/assessments");
    var html = reportHeader("Risk Assessment Report");
    var crit=0,hi=0,med=0,lo=0;
    assessments.forEach(function(a){
        if(a.risk_level==="Critical")crit++;
        else if(a.risk_level==="High")hi++;
        else if(a.risk_level==="Medium")med++;
        else lo++;
    });
    html += "<h4>Risk Distribution</h4>";
    var total = assessments.length || 1;
    html += tbl(["Level","Count","%"],[
        ["Critical",""+crit,(crit/total*100).toFixed(1)+"%"],
        ["High",""+hi,(hi/total*100).toFixed(1)+"%"],
        ["Medium",""+med,(med/total*100).toFixed(1)+"%"],
        ["Low",""+lo,(lo/total*100).toFixed(1)+"%"]
    ]);
    html += "<h4>Assessment Details</h4>";
    var aRows = assessments.map(function(a){
        return [a.assessment_name||"N/A", a.site_name||"N/A",
            a.hazard_quotient?a.hazard_quotient.toFixed(3):"N/A",
            a.cancer_risk?a.cancer_risk.toExponential(2):"N/A",
            a.risk_level||"N/A",
            a.assessment_date?new Date(a.assessment_date).toLocaleDateString():"N/A"];
    });
    html += tbl(["Assessment","Site","HQ","Cancer Risk","Level","Date"], aRows);
    return html;
}

function reportTransport() {
    var html = reportHeader("Transport Model Report");
    html += "<h4>Advection-Dispersion Equation</h4>";
    html += "<p style=\"color:var(--text-secondary);font-size:13px\">1D ADE with Ogata-Banks analytical solution for contaminant transport modeling.</p>";
    html += "<div style=\"padding:16px;background:var(--bg-tertiary);border-radius:8px;margin:12px 0;font-family:monospace;font-size:13px;color:var(--accent-cyan);text-align:center\">";
    html += "C(x,t) = (C0/2) x erfc[(Rx-vt)/(2*sqrt(DRt))] x exp(-lambda*t)</div>";
    html += "<h4>Parameters</h4>";
    html += tbl(["Parameter","Symbol","Unit","Description"],[
        ["Source Concentration","C0","mg/L","Initial concentration"],
        ["Velocity","v","m/day","Groundwater velocity"],
        ["Dispersion","D","m2/day","Hydrodynamic dispersion"],
        ["Retardation","R","dimensionless","Soil interaction delay"],
        ["Decay Rate","lambda","1/day","Degradation rate"]
    ]);
    return html;
}

async function reportCompliance() {
    var samples = await apiGet("/api/samples");
    var html = reportHeader("Regulatory Compliance");
    var exceed = samples.filter(function(s){return s.mcl && s.concentration > s.mcl;});
    var comply = samples.length - exceed.length;
    html += "<h4>Compliance Summary</h4>";
    var stotal = samples.length || 1;
    html += tbl(["Status","Count","%"],[
        ["Compliant",""+comply,(comply/stotal*100).toFixed(1)+"%"],
        ["Exceedance",""+exceed.length,(exceed.length/stotal*100).toFixed(1)+"%"]
    ]);
    if (exceed.length > 0) {
        html += "<h4>MCL Exceedances</h4>";
        var eRows = exceed.map(function(s){
            var factor = s.mcl ? (s.concentration/s.mcl).toFixed(1) : "N/A";
            return [s.site_name||"N/A", s.contaminant_name||"N/A", s.concentration.toFixed(4), ""+s.mcl, factor+"x"];
        });
        html += tbl(["Site","Contaminant","Measured","MCL","Factor"], eRows);
    }
    return html;
}

async function reportRemediation() {
    var sites = await apiGet("/api/sites");
    var html = reportHeader("Remediation Recommendations");
    var remSites = sites.filter(function(s){return s.risk_level==="Critical"||s.risk_level==="High";});
    html += "<h4>Sites Requiring Remediation (" + remSites.length + ")</h4>";
    remSites.forEach(function(site){
        html += "<div style=\"padding:16px;background:var(--bg-tertiary);border-radius:8px;margin:12px 0\">";
        html += "<h4 style=\"margin:0 0 8px\">" + site.name + " (" + site.risk_level + ")</h4>";
        html += "<p style=\"font-size:12px;color:var(--text-muted)\">" + (site.location||"") + "</p>";
        if (site.risk_level==="Critical") {
            html += "<ul style=\"font-size:12px;color:var(--text-secondary);padding-left:20px\"><li>Pump-and-Treat</li><li>In-Situ Chemical Oxidation</li><li>Permeable Reactive Barriers</li></ul>";
        } else {
            html += "<ul style=\"font-size:12px;color:var(--text-secondary);padding-left:20px\"><li>Monitored Natural Attenuation</li><li>Bioremediation</li><li>Phytoremediation</li></ul>";
        }
        html += "</div>";
    });
    html += "<h4>Technologies by Contaminant Type</h4>";
    html += tbl(["Type","Primary","Secondary","Timeframe"],[
        ["Heavy Metals","Chemical Precipitation","Ion Exchange","6-24 months"],
        ["VOCs","Air Stripping / SVE","ISCO","1-5 years"],
        ["Pesticides","Activated Carbon","Advanced Oxidation","2-10 years"],
        ["Inorganics","Reverse Osmosis","Electrodialysis","Ongoing"]
    ]);
    return html;
}

function closeReport() {
    document.getElementById("reportOutput").style.display = "none";
}

function printReport() {
    var content = document.getElementById("reportContent").innerHTML;
    var pw = window.open("", "_blank");
    pw.document.write("<html><head><title>AquaRisk Report</title><style>body{font-family:sans-serif;padding:40px;color:#333}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{padding:8px 12px;border:1px solid #ddd;text-align:left;font-size:12px}th{background:#f5f5f5;font-weight:600}h4{color:#0891b2;margin:20px 0 10px}</style></head><body>" + content + "</body></html>");
    pw.document.close();
    pw.print();
}