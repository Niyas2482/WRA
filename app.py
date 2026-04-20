"""
Intelligent Risk Assessment Models for Water Remediation
Backend API - Flask Application
"""

import os
import math
import json
import random
from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import numpy as np

# ─── App Configuration ───────────────────────────────────────────────────────
  
app = Flask(__name__)
CORS(app)
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(basedir, "water_remediation.db")}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'water-remediation-risk-2024'

db = SQLAlchemy(app)

# ─── Database Models ─────────────────────────────────────────────────────────

class Site(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    location = db.Column(db.String(300))
    latitude = db.Column(db.Float, default=28.6139)
    longitude = db.Column(db.Float, default=77.2090)
    area_sqm = db.Column(db.Float, default=10000)
    aquifer_type = db.Column(db.String(100), default='Unconfined')
    status = db.Column(db.String(50), default='Active')
    risk_level = db.Column(db.String(20), default='Medium')
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    samples = db.relationship('Sample', backref='site', lazy=True, cascade='all, delete-orphan')
    assessments = db.relationship('RiskAssessment', backref='site', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id, 'name': self.name, 'location': self.location,
            'latitude': self.latitude, 'longitude': self.longitude,
            'area_sqm': self.area_sqm, 'aquifer_type': self.aquifer_type,
            'status': self.status, 'risk_level': self.risk_level,
            'description': self.description,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'sample_count': len(self.samples),
            'assessment_count': len(self.assessments)
        }


class Contaminant(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    cas_number = db.Column(db.String(50))
    category = db.Column(db.String(100))  # Heavy Metal, Organic, Inorganic, Pesticide, VOC
    mcl = db.Column(db.Float)  # Maximum Contaminant Level (mg/L)
    mclg = db.Column(db.Float)  # MCL Goal
    unit = db.Column(db.String(20), default='mg/L')
    oral_rfd = db.Column(db.Float)  # Oral Reference Dose (mg/kg/day)
    inhalation_rfc = db.Column(db.Float)  # Inhalation Reference Concentration
    oral_csf = db.Column(db.Float)  # Oral Cancer Slope Factor
    inhalation_csf = db.Column(db.Float)  # Inhalation Cancer Slope Factor
    molecular_weight = db.Column(db.Float)
    solubility = db.Column(db.Float)  # mg/L
    koc = db.Column(db.Float)  # Organic carbon partition coefficient
    half_life_days = db.Column(db.Float)
    health_effects = db.Column(db.Text)
    is_carcinogen = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    samples = db.relationship('Sample', backref='contaminant', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id, 'name': self.name, 'cas_number': self.cas_number,
            'category': self.category, 'mcl': self.mcl, 'mclg': self.mclg,
            'unit': self.unit, 'oral_rfd': self.oral_rfd,
            'inhalation_rfc': self.inhalation_rfc,
            'oral_csf': self.oral_csf, 'inhalation_csf': self.inhalation_csf,
            'molecular_weight': self.molecular_weight, 'solubility': self.solubility,
            'koc': self.koc, 'half_life_days': self.half_life_days,
            'health_effects': self.health_effects, 'is_carcinogen': self.is_carcinogen,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Sample(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    site_id = db.Column(db.Integer, db.ForeignKey('site.id'), nullable=False)
    contaminant_id = db.Column(db.Integer, db.ForeignKey('contaminant.id'), nullable=False)
    concentration = db.Column(db.Float, nullable=False)
    depth_m = db.Column(db.Float, default=0)
    sample_date = db.Column(db.DateTime, default=datetime.utcnow)
    sample_type = db.Column(db.String(50), default='Groundwater')  # Groundwater, Surface, Soil
    ph = db.Column(db.Float)
    temperature_c = db.Column(db.Float)
    notes = db.Column(db.Text)

    def to_dict(self):
        return {
            'id': self.id, 'site_id': self.site_id,
            'contaminant_id': self.contaminant_id,
            'concentration': self.concentration,
            'depth_m': self.depth_m,
            'sample_date': self.sample_date.isoformat() if self.sample_date else None,
            'sample_type': self.sample_type,
            'ph': self.ph, 'temperature_c': self.temperature_c,
            'notes': self.notes,
            'site_name': self.site.name if self.site else None,
            'contaminant_name': self.contaminant.name if self.contaminant else None,
            'mcl': self.contaminant.mcl if self.contaminant else None
        }


class RiskAssessment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    site_id = db.Column(db.Integer, db.ForeignKey('site.id'), nullable=False)
    assessment_name = db.Column(db.String(200))
    assessment_date = db.Column(db.DateTime, default=datetime.utcnow)
    exposure_pathway = db.Column(db.String(100))  # Ingestion, Dermal, Inhalation
    receptor_type = db.Column(db.String(100), default='Adult Resident')
    hazard_quotient = db.Column(db.Float)
    hazard_index = db.Column(db.Float)
    cancer_risk = db.Column(db.Float)
    risk_level = db.Column(db.String(20))  # Low, Medium, High, Critical
    risk_score = db.Column(db.Float)
    remediation_needed = db.Column(db.Boolean, default=False)
    recommended_action = db.Column(db.Text)
    parameters_json = db.Column(db.Text)  # Store calculation parameters as JSON
    status = db.Column(db.String(50), default='Completed')

    def to_dict(self):
        return {
            'id': self.id, 'site_id': self.site_id,
            'assessment_name': self.assessment_name,
            'assessment_date': self.assessment_date.isoformat() if self.assessment_date else None,
            'exposure_pathway': self.exposure_pathway,
            'receptor_type': self.receptor_type,
            'hazard_quotient': self.hazard_quotient,
            'hazard_index': self.hazard_index,
            'cancer_risk': self.cancer_risk,
            'risk_level': self.risk_level,
            'risk_score': self.risk_score,
            'remediation_needed': self.remediation_needed,
            'recommended_action': self.recommended_action,
            'parameters_json': self.parameters_json,
            'status': self.status,
            'site_name': self.site.name if self.site else None
        }


class TransportModel(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200))
    site_id = db.Column(db.Integer, db.ForeignKey('site.id'))
    model_type = db.Column(db.String(100), default='Advection-Dispersion')
    velocity = db.Column(db.Float)  # m/day
    dispersion_coeff = db.Column(db.Float)  # m²/day
    retardation_factor = db.Column(db.Float, default=1.0)
    decay_rate = db.Column(db.Float, default=0.0)  # 1/day
    source_concentration = db.Column(db.Float)  # mg/L
    porosity = db.Column(db.Float, default=0.3)
    results_json = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    site = db.relationship('Site', backref='transport_models')

    def to_dict(self):
        return {
            'id': self.id, 'name': self.name, 'site_id': self.site_id,
            'model_type': self.model_type, 'velocity': self.velocity,
            'dispersion_coeff': self.dispersion_coeff,
            'retardation_factor': self.retardation_factor,
            'decay_rate': self.decay_rate,
            'source_concentration': self.source_concentration,
            'porosity': self.porosity,
            'results_json': self.results_json,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


# ─── Contaminant Transport Simulation Engine ────────────────────────────────

def advection_dispersion_1d(C0, v, D, R, lam, x_arr, t):
    """
    Analytical solution to 1D advection-dispersion equation with retardation and decay.
    Ogata-Banks solution.
    C(x,t) = (C0/2) * { erfc[(Rx - vt) / (2*sqrt(DRt))] + exp(vx/D) * erfc[(Rx + vt) / (2*sqrt(DRt))] } * exp(-lam*t)
    """
    if t <= 0:
        return np.zeros_like(x_arr)
    
    v_eff = v / R
    D_eff = D / R
    
    concentrations = []
    for x in x_arr:
        if x <= 0:
            concentrations.append(C0)
            continue
        
        sqrt_term = 2.0 * math.sqrt(D_eff * t) if D_eff * t > 0 else 1e-10
        
        arg1 = (x - v_eff * t) / sqrt_term
        arg2 = (x + v_eff * t) / sqrt_term
        
        # Clamp to avoid overflow
        arg1 = max(min(arg1, 10), -10)
        arg2 = max(min(arg2, 10), -10)
        
        term1 = math.erfc(arg1)
        
        pe = min(v * x / D, 500) if D > 0 else 500
        term2 = math.exp(pe) * math.erfc(arg2) if pe < 500 else 0
        
        C = (C0 / 2.0) * (term1 + term2) * math.exp(-lam * t)
        concentrations.append(max(0, min(C, C0)))
    
    return np.array(concentrations)


def simulate_plume_2d(C0, v, Dx, Dy, lam, grid_size=50, t=30):
    """2D plume simulation for visualization."""
    x = np.linspace(-20, 100, grid_size)
    y = np.linspace(-50, 50, grid_size)
    X, Y = np.meshgrid(x, y)
    
    if t <= 0:
        return {'x': x.tolist(), 'y': y.tolist(), 'concentrations': np.zeros((grid_size, grid_size)).tolist()}
    
    C = np.zeros_like(X)
    for i in range(grid_size):
        for j in range(grid_size):
            xi, yi = X[i, j], Y[i, j]
            if xi <= 0 and abs(yi) < 5:
                C[i, j] = C0
            elif xi > 0 and t > 0:
                exp_x = -(xi - v * t) ** 2 / (4 * Dx * t) if Dx * t > 0 else -100
                exp_y = -yi ** 2 / (4 * Dy * t) if Dy * t > 0 else -100
                exp_total = exp_x + exp_y - lam * t
                exp_total = max(min(exp_total, 100), -100)
                denom = 4 * math.pi * t * math.sqrt(Dx * Dy) if Dx * Dy > 0 else 1
                C[i, j] = C0 * math.exp(exp_total) / max(denom, 1e-10)
    
    # Normalize
    max_c = np.max(C)
    if max_c > 0:
        C = C / max_c * C0
    
    return {
        'x': x.tolist(),
        'y': y.tolist(),
        'concentrations': C.tolist()
    }


# ─── Exposure Analysis Engine ────────────────────────────────────────────────

def calculate_exposure_dose(concentration, pathway, receptor='adult'):
    """Calculate Average Daily Dose (ADD) for different exposure pathways."""
    # EPA standard exposure parameters
    params = {
        'adult': {
            'body_weight': 70,      # kg
            'ingestion_rate': 2.0,  # L/day
            'exposure_freq': 350,   # days/year
            'exposure_duration': 30, # years
            'averaging_time_nc': 30 * 365,  # days (non-cancer)
            'averaging_time_c': 70 * 365,   # days (cancer)
            'skin_area': 5700,      # cm²
            'skin_perm': 0.001,     # cm/hr
            'exposure_time_dermal': 0.58,  # hr/event
            'inhalation_rate': 20,  # m³/day
            'volatilization_factor': 0.5  # L/m³ (simplified)
        },
        'child': {
            'body_weight': 15,
            'ingestion_rate': 1.0,
            'exposure_freq': 350,
            'exposure_duration': 6,
            'averaging_time_nc': 6 * 365,
            'averaging_time_c': 70 * 365,
            'skin_area': 2800,
            'skin_perm': 0.001,
            'exposure_time_dermal': 0.58,
            'inhalation_rate': 10,
            'volatilization_factor': 0.5
        }
    }
    
    p = params.get(receptor, params['adult'])
    
    if pathway == 'ingestion':
        add = (concentration * p['ingestion_rate'] * p['exposure_freq'] * p['exposure_duration']) / \
              (p['body_weight'] * p['averaging_time_nc'])
        ladd = (concentration * p['ingestion_rate'] * p['exposure_freq'] * p['exposure_duration']) / \
               (p['body_weight'] * p['averaging_time_c'])
    
    elif pathway == 'dermal':
        absorbed_dose_per_event = concentration * p['skin_perm'] * p['exposure_time_dermal']
        add = (absorbed_dose_per_event * p['skin_area'] * p['exposure_freq'] * p['exposure_duration']) / \
              (p['body_weight'] * p['averaging_time_nc'] * 1000)
        ladd = (absorbed_dose_per_event * p['skin_area'] * p['exposure_freq'] * p['exposure_duration']) / \
               (p['body_weight'] * p['averaging_time_c'] * 1000)
    
    elif pathway == 'inhalation':
        air_conc = concentration * p['volatilization_factor']
        add = (air_conc * p['inhalation_rate'] * p['exposure_freq'] * p['exposure_duration']) / \
              (p['body_weight'] * p['averaging_time_nc'])
        ladd = (air_conc * p['inhalation_rate'] * p['exposure_freq'] * p['exposure_duration']) / \
               (p['body_weight'] * p['averaging_time_c'])
    else:
        add = 0
        ladd = 0
    
    return {
        'add': add,
        'ladd': ladd,
        'parameters': p,
        'pathway': pathway,
        'receptor': receptor,
        'concentration': concentration
    }


def calculate_risk(add, ladd, rfd, csf, is_carcinogen):
    """Calculate Hazard Quotient and Cancer Risk."""
    hq = add / rfd if rfd and rfd > 0 else 0
    cancer_risk = ladd * csf if csf and csf > 0 and is_carcinogen else 0
    
    if hq > 10 or cancer_risk > 1e-4:
        risk_level = 'Critical'
    elif hq > 1 or cancer_risk > 1e-5:
        risk_level = 'High'
    elif hq > 0.5 or cancer_risk > 1e-6:
        risk_level = 'Medium'
    else:
        risk_level = 'Low'
    
    risk_score = min(100, (hq * 20) + (cancer_risk * 1e6))
    
    return {
        'hazard_quotient': round(hq, 6),
        'cancer_risk': cancer_risk,
        'risk_level': risk_level,
        'risk_score': round(risk_score, 2),
        'remediation_needed': hq > 1 or cancer_risk > 1e-4
    }


# ─── API Routes ──────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')


# ── Dashboard ──
@app.route('/api/dashboard/stats')
def dashboard_stats():
    total_sites = Site.query.count()
    active_sites = Site.query.filter_by(status='Active').count()
    total_contaminants = Contaminant.query.count()
    total_samples = Sample.query.count()
    total_assessments = RiskAssessment.query.count()
    
    critical = RiskAssessment.query.filter_by(risk_level='Critical').count()
    high = RiskAssessment.query.filter_by(risk_level='High').count()
    medium = RiskAssessment.query.filter_by(risk_level='Medium').count()
    low = RiskAssessment.query.filter_by(risk_level='Low').count()
    
    # Recent assessments
    recent = RiskAssessment.query.order_by(RiskAssessment.assessment_date.desc()).limit(10).all()
    
    # Contaminant distribution by category
    categories = db.session.query(
        Contaminant.category, db.func.count(Contaminant.id)
    ).group_by(Contaminant.category).all()
    
    # Site risk distribution
    site_risks = db.session.query(
        Site.risk_level, db.func.count(Site.id)
    ).group_by(Site.risk_level).all()
    
    # Sample trends (last 12 months)
    trends = []
    for i in range(11, -1, -1):
        d = datetime.utcnow() - timedelta(days=i * 30)
        d_end = d + timedelta(days=30)
        count = Sample.query.filter(
            Sample.sample_date >= d,
            Sample.sample_date < d_end
        ).count()
        trends.append({
            'month': d.strftime('%b %Y'),
            'count': count
        })
    
    # Exceedances
    exceedances = 0
    samples_with_mcl = db.session.query(Sample, Contaminant).join(Contaminant).all()
    for sample, contaminant in samples_with_mcl:
        if contaminant.mcl and sample.concentration > contaminant.mcl:
            exceedances += 1
    
    return jsonify({
        'total_sites': total_sites,
        'active_sites': active_sites,
        'total_contaminants': total_contaminants,
        'total_samples': total_samples,
        'total_assessments': total_assessments,
        'exceedances': exceedances,
        'risk_distribution': {
            'critical': critical, 'high': high,
            'medium': medium, 'low': low
        },
        'contaminant_categories': [{'category': c[0] or 'Unknown', 'count': c[1]} for c in categories],
        'site_risks': [{'level': s[0] or 'Unknown', 'count': s[1]} for s in site_risks],
        'sample_trends': trends,
        'recent_assessments': [a.to_dict() for a in recent]
    })


# ── Sites CRUD ──
@app.route('/api/sites', methods=['GET'])
def get_sites():
    sites = Site.query.order_by(Site.created_at.desc()).all()
    return jsonify([s.to_dict() for s in sites])

@app.route('/api/sites', methods=['POST'])
def create_site():
    data = request.json
    site = Site(
        name=data['name'],
        location=data.get('location', ''),
        latitude=float(data.get('latitude', 28.6139)),
        longitude=float(data.get('longitude', 77.2090)),
        area_sqm=float(data.get('area_sqm', 10000)),
        aquifer_type=data.get('aquifer_type', 'Unconfined'),
        status=data.get('status', 'Active'),
        risk_level=data.get('risk_level', 'Medium'),
        description=data.get('description', '')
    )
    db.session.add(site)
    db.session.commit()
    return jsonify(site.to_dict()), 201

@app.route('/api/sites/<int:id>', methods=['GET'])
def get_site(id):
    site = Site.query.get_or_404(id)
    return jsonify(site.to_dict())

@app.route('/api/sites/<int:id>', methods=['PUT'])
def update_site(id):
    site = Site.query.get_or_404(id)
    data = request.json
    for key in ['name', 'location', 'latitude', 'longitude', 'area_sqm', 'aquifer_type', 'status', 'risk_level', 'description']:
        if key in data:
            setattr(site, key, data[key])
    db.session.commit()
    return jsonify(site.to_dict())

@app.route('/api/sites/<int:id>', methods=['DELETE'])
def delete_site(id):
    site = Site.query.get_or_404(id)
    db.session.delete(site)
    db.session.commit()
    return jsonify({'message': 'Site deleted'})


# ── Contaminants CRUD ──
@app.route('/api/contaminants', methods=['GET'])
def get_contaminants():
    category = request.args.get('category')
    query = Contaminant.query
    if category:
        query = query.filter_by(category=category)
    contaminants = query.order_by(Contaminant.name).all()
    return jsonify([c.to_dict() for c in contaminants])

@app.route('/api/contaminants', methods=['POST'])
def create_contaminant():
    data = request.json
    contaminant = Contaminant(
        name=data['name'],
        cas_number=data.get('cas_number', ''),
        category=data.get('category', 'Other'),
        mcl=float(data['mcl']) if data.get('mcl') else None,
        mclg=float(data['mclg']) if data.get('mclg') else None,
        unit=data.get('unit', 'mg/L'),
        oral_rfd=float(data['oral_rfd']) if data.get('oral_rfd') else None,
        inhalation_rfc=float(data['inhalation_rfc']) if data.get('inhalation_rfc') else None,
        oral_csf=float(data['oral_csf']) if data.get('oral_csf') else None,
        inhalation_csf=float(data['inhalation_csf']) if data.get('inhalation_csf') else None,
        molecular_weight=float(data['molecular_weight']) if data.get('molecular_weight') else None,
        solubility=float(data['solubility']) if data.get('solubility') else None,
        koc=float(data['koc']) if data.get('koc') else None,
        half_life_days=float(data['half_life_days']) if data.get('half_life_days') else None,
        health_effects=data.get('health_effects', ''),
        is_carcinogen=data.get('is_carcinogen', False)
    )
    db.session.add(contaminant)
    db.session.commit()
    return jsonify(contaminant.to_dict()), 201

@app.route('/api/contaminants/<int:id>', methods=['PUT'])
def update_contaminant(id):
    contaminant = Contaminant.query.get_or_404(id)
    data = request.json
    for key in data:
        if hasattr(contaminant, key):
            setattr(contaminant, key, data[key])
    db.session.commit()
    return jsonify(contaminant.to_dict())

@app.route('/api/contaminants/<int:id>', methods=['DELETE'])
def delete_contaminant(id):
    contaminant = Contaminant.query.get_or_404(id)
    db.session.delete(contaminant)
    db.session.commit()
    return jsonify({'message': 'Contaminant deleted'})


# ── Samples CRUD ──
@app.route('/api/samples', methods=['GET'])
def get_samples():
    site_id = request.args.get('site_id')
    query = Sample.query
    if site_id:
        query = query.filter_by(site_id=int(site_id))
    samples = query.order_by(Sample.sample_date.desc()).all()
    return jsonify([s.to_dict() for s in samples])

@app.route('/api/samples', methods=['POST'])
def create_sample():
    data = request.json
    sample = Sample(
        site_id=int(data['site_id']),
        contaminant_id=int(data['contaminant_id']),
        concentration=float(data['concentration']),
        depth_m=float(data.get('depth_m', 0)),
        sample_type=data.get('sample_type', 'Groundwater'),
        ph=float(data['ph']) if data.get('ph') else None,
        temperature_c=float(data['temperature_c']) if data.get('temperature_c') else None,
        notes=data.get('notes', '')
    )
    db.session.add(sample)
    db.session.commit()
    return jsonify(sample.to_dict()), 201


# ── Transport Simulation ──
@app.route('/api/simulate/transport', methods=['POST'])
def simulate_transport():
    data = request.json
    velocity = float(data.get('velocity', 1.0))
    dispersion = float(data.get('dispersion', 0.5))
    decay = float(data.get('decay', 0.0))
    retardation = float(data.get('retardation', 1.0))
    source_conc = float(data.get('source_concentration', 100))
    max_distance = float(data.get('distance', 100))
    time = float(data.get('time', 30))
    porosity = float(data.get('porosity', 0.3))
    
    # 1D concentration profile
    x_arr = np.linspace(0, max_distance, 200)
    concentrations = advection_dispersion_1d(source_conc, velocity, dispersion, retardation, decay, x_arr, time)
    
    # Time series at a specific point
    monitor_distance = max_distance / 2
    time_arr = np.linspace(0.1, time * 2, 100)
    time_series = []
    for t in time_arr:
        c = advection_dispersion_1d(source_conc, velocity, dispersion, retardation, decay, 
                                     np.array([monitor_distance]), t)
        time_series.append(float(c[0]))
    
    # 2D plume
    plume = simulate_plume_2d(source_conc, velocity, dispersion, dispersion * 0.1, decay, 40, time)
    
    # Save model
    model = TransportModel(
        name=data.get('name', f'Simulation {datetime.utcnow().strftime("%Y%m%d_%H%M%S")}'),
        site_id=data.get('site_id'),
        velocity=velocity,
        dispersion_coeff=dispersion,
        retardation_factor=retardation,
        decay_rate=decay,
        source_concentration=source_conc,
        porosity=porosity
    )
    db.session.add(model)
    db.session.commit()
    
    return jsonify({
        'model_id': model.id,
        'spatial_profile': {
            'distances': x_arr.tolist(),
            'concentrations': concentrations.tolist()
        },
        'time_series': {
            'times': time_arr.tolist(),
            'concentrations': time_series,
            'monitor_distance': monitor_distance
        },
        'plume_2d': plume,
        'parameters': {
            'velocity': velocity,
            'dispersion': dispersion,
            'decay': decay,
            'retardation': retardation,
            'source_concentration': source_conc,
            'porosity': porosity
        }
    })


# ── Exposure Analysis ──
@app.route('/api/analyze/exposure', methods=['POST'])
def analyze_exposure():
    data = request.json
    concentration = float(data.get('concentration', 0.05))
    pathways = data.get('pathways', ['ingestion', 'dermal', 'inhalation'])
    receptor = data.get('receptor', 'adult')
    contaminant_id = data.get('contaminant_id')
    
    results = {}
    total_hq = 0
    total_cancer_risk = 0
    
    # Get contaminant toxicity data
    rfd = float(data.get('oral_rfd', 0.02))
    csf = float(data.get('oral_csf', 0))
    is_carcinogen = data.get('is_carcinogen', False)
    
    if contaminant_id:
        contaminant = Contaminant.query.get(contaminant_id)
        if contaminant:
            rfd = contaminant.oral_rfd or rfd
            csf = contaminant.oral_csf or csf
            is_carcinogen = contaminant.is_carcinogen
    
    for pathway in pathways:
        exposure = calculate_exposure_dose(concentration, pathway, receptor)
        risk = calculate_risk(exposure['add'], exposure['ladd'], rfd, csf, is_carcinogen)
        
        results[pathway] = {
            'exposure': exposure,
            'risk': risk
        }
        total_hq += risk['hazard_quotient']
        total_cancer_risk += risk['cancer_risk']
    
    # Overall risk
    if total_hq > 10:
        overall_level = 'Critical'
    elif total_hq > 1:
        overall_level = 'High'
    elif total_hq > 0.5:
        overall_level = 'Medium'
    else:
        overall_level = 'Low'
    
    return jsonify({
        'pathways': results,
        'total_hazard_index': round(total_hq, 6),
        'total_cancer_risk': total_cancer_risk,
        'overall_risk_level': overall_level,
        'remediation_needed': total_hq > 1 or total_cancer_risk > 1e-4,
        'receptor': receptor,
        'concentration': concentration
    })


# ── Risk Assessment ──
@app.route('/api/assess/risk', methods=['POST'])
def assess_risk():
    data = request.json
    site_id = data.get('site_id')
    
    if not site_id:
        return jsonify({'error': 'site_id required'}), 400
    
    site = Site.query.get_or_404(site_id)
    samples = Sample.query.filter_by(site_id=site_id).all()
    
    if not samples:
        return jsonify({'error': 'No samples found for this site'}), 400
    
    overall_hq = 0
    overall_cancer = 0
    contaminant_risks = []
    
    for sample in samples:
        contaminant = sample.contaminant
        if not contaminant or not contaminant.oral_rfd:
            continue
        
        for pathway in ['ingestion', 'dermal', 'inhalation']:
            exposure = calculate_exposure_dose(sample.concentration, pathway, 'adult')
            risk = calculate_risk(
                exposure['add'], exposure['ladd'],
                contaminant.oral_rfd, contaminant.oral_csf,
                contaminant.is_carcinogen
            )
            overall_hq += risk['hazard_quotient']
            overall_cancer += risk['cancer_risk']
            
            contaminant_risks.append({
                'contaminant': contaminant.name,
                'concentration': sample.concentration,
                'mcl': contaminant.mcl,
                'pathway': pathway,
                'hazard_quotient': risk['hazard_quotient'],
                'cancer_risk': risk['cancer_risk'],
                'risk_level': risk['risk_level']
            })
    
    if overall_hq > 10:
        overall_level = 'Critical'
        action = 'Immediate remediation required. Consider pump-and-treat or in-situ chemical oxidation.'
    elif overall_hq > 1:
        overall_level = 'High'
        action = 'Remediation recommended. Evaluate natural attenuation progress and consider active treatment.'
    elif overall_hq > 0.5:
        overall_level = 'Medium'
        action = 'Continue monitoring. Assess natural attenuation effectiveness.'
    else:
        overall_level = 'Low'
        action = 'Continue routine monitoring program.'
    
    # Save assessment
    assessment = RiskAssessment(
        site_id=site_id,
        assessment_name=data.get('name', f'Risk Assessment - {site.name}'),
        exposure_pathway='Combined',
        receptor_type=data.get('receptor', 'Adult Resident'),
        hazard_quotient=overall_hq,
        hazard_index=overall_hq,
        cancer_risk=overall_cancer,
        risk_level=overall_level,
        risk_score=min(100, overall_hq * 20 + overall_cancer * 1e6),
        remediation_needed=overall_hq > 1,
        recommended_action=action,
        parameters_json=json.dumps(contaminant_risks)
    )
    db.session.add(assessment)
    
    # Update site risk level
    site.risk_level = overall_level
    db.session.commit()
    
    return jsonify({
        'assessment': assessment.to_dict(),
        'contaminant_risks': contaminant_risks,
        'overall_hazard_index': round(overall_hq, 4),
        'overall_cancer_risk': overall_cancer,
        'overall_risk_level': overall_level,
        'recommended_action': action,
        'site': site.to_dict()
    })


# ── Assessments CRUD ──
@app.route('/api/assessments', methods=['GET'])
def get_assessments():
    site_id = request.args.get('site_id')
    query = RiskAssessment.query
    if site_id:
        query = query.filter_by(site_id=int(site_id))
    assessments = query.order_by(RiskAssessment.assessment_date.desc()).all()
    return jsonify([a.to_dict() for a in assessments])

@app.route('/api/assessments/<int:id>', methods=['DELETE'])
def delete_assessment(id):
    a = RiskAssessment.query.get_or_404(id)
    db.session.delete(a)
    db.session.commit()
    return jsonify({'message': 'Assessment deleted'})


# ── Transport Models ──
@app.route('/api/transport-models', methods=['GET'])
def get_transport_models():
    models = TransportModel.query.order_by(TransportModel.created_at.desc()).all()
    return jsonify([m.to_dict() for m in models])


# ─── Seed Data ───────────────────────────────────────────────────────────────

def seed_database():
    """Populate database with realistic sample data."""
    if Site.query.count() > 0:
        return
    
    # Sites
    sites_data = [
        {'name': 'Yamuna River Industrial Zone', 'location': 'Delhi NCR, India', 'latitude': 28.5672, 'longitude': 77.2410, 'area_sqm': 25000, 'aquifer_type': 'Alluvial', 'status': 'Active', 'risk_level': 'High', 'description': 'Industrial discharge zone with heavy metal contamination from textile and leather manufacturing.'},
        {'name': 'Hindon River Basin Site', 'location': 'Ghaziabad, UP', 'latitude': 28.6692, 'longitude': 77.4538, 'area_sqm': 18000, 'aquifer_type': 'Unconfined', 'status': 'Active', 'risk_level': 'Critical', 'description': 'Severely contaminated site with groundwater pollution from industrial effluents.'},
        {'name': 'Mithi River Catchment', 'location': 'Mumbai, Maharashtra', 'latitude': 19.1034, 'longitude': 72.8897, 'area_sqm': 30000, 'aquifer_type': 'Basaltic', 'status': 'Active', 'risk_level': 'Medium', 'description': 'Urban catchment area with mixed industrial and domestic waste contamination.'},
        {'name': 'Palar River Valley', 'location': 'Vellore, Tamil Nadu', 'latitude': 12.9165, 'longitude': 79.1325, 'area_sqm': 15000, 'aquifer_type': 'Crystalline', 'status': 'Under Review', 'risk_level': 'High', 'description': 'Tannery waste contamination affecting groundwater with chromium and other heavy metals.'},
        {'name': 'Periyar River Industrial', 'location': 'Kochi, Kerala', 'latitude': 9.9312, 'longitude': 76.2673, 'area_sqm': 20000, 'aquifer_type': 'Laterite', 'status': 'Active', 'risk_level': 'Medium', 'description': 'Chemical industrial complex with potential groundwater contamination.'},
        {'name': 'Bhopal Lake Remediation', 'location': 'Bhopal, MP', 'latitude': 23.2599, 'longitude': 77.4126, 'area_sqm': 50000, 'aquifer_type': 'Alluvial', 'status': 'Remediation', 'risk_level': 'Critical', 'description': 'Legacy contamination site with persistent organic pollutants and pesticides.'},
        {'name': 'Damodar River Corridor', 'location': 'Dhanbad, Jharkhand', 'latitude': 23.7957, 'longitude': 86.4304, 'area_sqm': 22000, 'aquifer_type': 'Sedimentary', 'status': 'Active', 'risk_level': 'High', 'description': 'Coal mining region with acid mine drainage and heavy metal leaching.'},
        {'name': 'Sabarmati Riverfront', 'location': 'Ahmedabad, Gujarat', 'latitude': 23.0225, 'longitude': 72.5714, 'area_sqm': 12000, 'aquifer_type': 'Alluvial', 'status': 'Monitoring', 'risk_level': 'Low', 'description': 'Rehabilitated riverfront with ongoing groundwater quality monitoring program.'},
    ]
    
    for sd in sites_data:
        db.session.add(Site(**sd))
    db.session.commit()
    
    # Contaminants (EPA regulated with toxicity data)
    contaminants_data = [
        {'name': 'Arsenic', 'cas_number': '7440-38-2', 'category': 'Heavy Metal', 'mcl': 0.01, 'mclg': 0, 'oral_rfd': 0.0003, 'oral_csf': 1.5, 'molecular_weight': 74.92, 'solubility': 20, 'koc': 200, 'half_life_days': 10000, 'health_effects': 'Skin damage, circulatory system problems, increased cancer risk', 'is_carcinogen': True},
        {'name': 'Lead', 'cas_number': '7439-92-1', 'category': 'Heavy Metal', 'mcl': 0.015, 'mclg': 0, 'oral_rfd': 0.0036, 'oral_csf': 0.0085, 'molecular_weight': 207.2, 'solubility': 9.9, 'koc': 900, 'half_life_days': 50000, 'health_effects': 'Kidney damage, developmental delays in children, cognitive impairment', 'is_carcinogen': True},
        {'name': 'Chromium (VI)', 'cas_number': '18540-29-9', 'category': 'Heavy Metal', 'mcl': 0.1, 'mclg': 0.1, 'oral_rfd': 0.003, 'oral_csf': 0.5, 'molecular_weight': 52.0, 'solubility': 1680, 'koc': 19, 'half_life_days': 365, 'health_effects': 'Allergic dermatitis, lung cancer with inhalation exposure', 'is_carcinogen': True},
        {'name': 'Mercury', 'cas_number': '7439-97-6', 'category': 'Heavy Metal', 'mcl': 0.002, 'mclg': 0.002, 'oral_rfd': 0.0003, 'oral_csf': None, 'molecular_weight': 200.59, 'solubility': 0.06, 'koc': 5200, 'half_life_days': 1000, 'health_effects': 'Kidney damage, neurological effects, developmental toxicity', 'is_carcinogen': False},
        {'name': 'Cadmium', 'cas_number': '7440-43-9', 'category': 'Heavy Metal', 'mcl': 0.005, 'mclg': 0.005, 'oral_rfd': 0.0005, 'oral_csf': None, 'molecular_weight': 112.41, 'solubility': 5600, 'koc': 75, 'half_life_days': 15000, 'health_effects': 'Kidney damage, bone disease (osteomalacia), lung damage', 'is_carcinogen': False},
        {'name': 'Benzene', 'cas_number': '71-43-2', 'category': 'VOC', 'mcl': 0.005, 'mclg': 0, 'oral_rfd': 0.004, 'oral_csf': 0.055, 'molecular_weight': 78.11, 'solubility': 1780, 'koc': 59, 'half_life_days': 10, 'health_effects': 'Anemia, immune suppression, leukemia', 'is_carcinogen': True},
        {'name': 'Trichloroethylene (TCE)', 'cas_number': '79-01-6', 'category': 'VOC', 'mcl': 0.005, 'mclg': 0, 'oral_rfd': 0.0005, 'oral_csf': 0.046, 'molecular_weight': 131.39, 'solubility': 1100, 'koc': 94, 'half_life_days': 300, 'health_effects': 'Liver damage, kidney cancer, non-Hodgkin lymphoma', 'is_carcinogen': True},
        {'name': 'Tetrachloroethylene (PCE)', 'cas_number': '127-18-4', 'category': 'VOC', 'mcl': 0.005, 'mclg': 0, 'oral_rfd': 0.01, 'oral_csf': 0.0021, 'molecular_weight': 165.83, 'solubility': 150, 'koc': 364, 'half_life_days': 180, 'health_effects': 'Liver damage, kidney effects, neurological effects', 'is_carcinogen': True},
        {'name': 'Fluoride', 'cas_number': '16984-48-8', 'category': 'Inorganic', 'mcl': 4.0, 'mclg': 4.0, 'oral_rfd': 0.06, 'oral_csf': None, 'molecular_weight': 19.0, 'solubility': 40000, 'koc': 1, 'half_life_days': 100000, 'health_effects': 'Bone disease (skeletal fluorosis), dental fluorosis', 'is_carcinogen': False},
        {'name': 'Nitrate', 'cas_number': '14797-55-8', 'category': 'Inorganic', 'mcl': 10, 'mclg': 10, 'oral_rfd': 1.6, 'oral_csf': None, 'molecular_weight': 62.0, 'solubility': 912000, 'koc': 0.1, 'half_life_days': 30, 'health_effects': 'Methemoglobinemia (blue baby syndrome), thyroid effects', 'is_carcinogen': False},
        {'name': 'Atrazine', 'cas_number': '1912-24-9', 'category': 'Pesticide', 'mcl': 0.003, 'mclg': 0.003, 'oral_rfd': 0.035, 'oral_csf': 0.22, 'molecular_weight': 215.68, 'solubility': 33, 'koc': 100, 'half_life_days': 60, 'health_effects': 'Cardiovascular problems, reproductive difficulties, endocrine disruption', 'is_carcinogen': True},
        {'name': 'Lindane (γ-BHC)', 'cas_number': '58-89-9', 'category': 'Pesticide', 'mcl': 0.0002, 'mclg': 0.0002, 'oral_rfd': 0.0003, 'oral_csf': 1.3, 'molecular_weight': 290.83, 'solubility': 7.3, 'koc': 1100, 'half_life_days': 400, 'health_effects': 'Liver and kidney damage, neurological effects, immune suppression', 'is_carcinogen': True},
    ]
    
    for cd in contaminants_data:
        db.session.add(Contaminant(**cd))
    db.session.commit()
    
    # Sample data
    sites = Site.query.all()
    contaminants = Contaminant.query.all()
    
    for site in sites:
        num_samples = random.randint(5, 15)
        selected_contaminants = random.sample(contaminants, min(num_samples, len(contaminants)))
        
        for contaminant in selected_contaminants:
            # Generate concentration relative to MCL
            if site.risk_level == 'Critical':
                multiplier = random.uniform(1.5, 10)
            elif site.risk_level == 'High':
                multiplier = random.uniform(0.8, 5)
            elif site.risk_level == 'Medium':
                multiplier = random.uniform(0.3, 2)
            else:
                multiplier = random.uniform(0.05, 0.8)
            
            mcl = contaminant.mcl or 0.01
            conc = mcl * multiplier
            
            sample = Sample(
                site_id=site.id,
                contaminant_id=contaminant.id,
                concentration=round(conc, 6),
                depth_m=round(random.uniform(1, 30), 1),
                sample_date=datetime.utcnow() - timedelta(days=random.randint(0, 365)),
                sample_type=random.choice(['Groundwater', 'Surface Water', 'Soil Leachate']),
                ph=round(random.uniform(5.5, 8.5), 1),
                temperature_c=round(random.uniform(15, 35), 1),
                notes=f'Routine monitoring sample from {site.name}'
            )
            db.session.add(sample)
    
    db.session.commit()
    
    # Generate risk assessments for each site
    for site in sites:
        for i in range(random.randint(1, 3)):
            hq = random.uniform(0.1, 15) if site.risk_level in ['Critical', 'High'] else random.uniform(0.01, 2)
            cr = random.uniform(1e-7, 1e-3) if site.risk_level in ['Critical', 'High'] else random.uniform(1e-8, 1e-5)
            
            if hq > 10:
                rl = 'Critical'
            elif hq > 1:
                rl = 'High'
            elif hq > 0.5:
                rl = 'Medium'
            else:
                rl = 'Low'
            
            assessment = RiskAssessment(
                site_id=site.id,
                assessment_name=f'Assessment {i+1} - {site.name}',
                assessment_date=datetime.utcnow() - timedelta(days=random.randint(0, 180)),
                exposure_pathway=random.choice(['Ingestion', 'Dermal', 'Inhalation', 'Combined']),
                receptor_type=random.choice(['Adult Resident', 'Child', 'Industrial Worker']),
                hazard_quotient=round(hq, 4),
                hazard_index=round(hq * random.uniform(1, 1.5), 4),
                cancer_risk=cr,
                risk_level=rl,
                risk_score=min(100, round(hq * 20 + cr * 1e6, 2)),
                remediation_needed=hq > 1,
                recommended_action='Continue monitoring' if hq < 1 else 'Remediation recommended',
                status=random.choice(['Completed', 'Under Review', 'Pending'])
            )
            db.session.add(assessment)
    
    db.session.commit()
    print("✓ Database seeded with sample data")


# ─── Main ─────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        seed_database()
    app.run(debug=False, host='0.0.0.0', port=5000)


  