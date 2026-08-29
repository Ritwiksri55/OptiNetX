let mapInstance;
const MODE_DRAG = 0;
const MODE_DRAW = 1;
let currentMode = MODE_DRAG;

let polygonLatLngs = [];
let closedPolygonLatLngs = [];

let routers = [];
let globalRouterId = 1;
let nextAvailableId = 1;
let gridRes = 30;
let cols, rows;
let ROUTER_SCREEN_RANGE = 400;

let heatmapCache;
let needsHeatmapUpdate = true;
let cacheCenterLatLng = null;

let filterStatus = 'all'; // 'all', 'deployed', 'pending'

// Store initial configuration for "Reset to Original" option
let initialConfiguration = null;

// Enterprise Optimal Colors
const C_OPTIMAL = [16, 185, 129];
const C_WEAK = [245, 158, 11];
const C_INTERFERENCE = [239, 68, 68];

let modeDragBtn, modeDrawBtn, fillAreaBtn;
let currentMouseLatLng = null;

function setup() {
    let mapWrapper = document.querySelector('.map-view');
    let canvasWidth = mapWrapper.clientWidth;
    let canvasHeight = mapWrapper.clientHeight;

    mapInstance = L.map('map', {
        zoomAnimation: false,
        markerZoomAnimation: false
    }).setView([28.6139, 77.2090], 18); // New Delhi, India

    // Esri World Imagery (Satellite view) - NO API KEY REQUIRED
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community'
    }).addTo(mapInstance);
    
    // Add labels overlay (roads, city names, landmarks)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: ''
    }).addTo(mapInstance);

    mapInstance.on('click', function (e) {
        if (currentMode === MODE_DRAW) {
            let pt = e.latlng;
            if (polygonLatLngs.length > 2) {
                let originPointScreen = mapInstance.latLngToContainerPoint(polygonLatLngs[0]);
                let currentPointScreen = mapInstance.latLngToContainerPoint(pt);
                let dx = originPointScreen.x - currentPointScreen.x;
                let dy = originPointScreen.y - currentPointScreen.y;
                let d = Math.sqrt(dx * dx + dy * dy);

                if (d < 30) {
                    closedPolygonLatLngs = [...polygonLatLngs];
                    polygonLatLngs = [];
                    fillAreaBtn.style.display = 'block';
                    
                    // Show AI button in fullscreen if active
                    if (document.getElementById('fullscreenControls').style.display === 'block') {
                        document.getElementById('fsFillAreaBtn').style.display = 'flex';
                    }
                    
                    setMode(MODE_DRAG);

                    try {
                        let coords = closedPolygonLatLngs.map(ll => [ll.lng, ll.lat]);
                        coords.push([closedPolygonLatLngs[0].lng, closedPolygonLatLngs[0].lat]);
                        let poly = turf.polygon([coords]);
                        let areaSqM = turf.area(poly);
                        let perimM = turf.length(poly, { units: 'meters' });

                        let areaText = (areaSqM > 1000000) ? (areaSqM / 1000000).toFixed(2) + " sq km" : areaSqM.toFixed(2) + " sq m";
                        let perimText = (perimM > 1000) ? (perimM / 1000).toFixed(2) + " km" : perimM.toFixed(2) + " m";

                        document.getElementById('statArea').innerText = areaText;
                        document.getElementById('statPerimeter').innerText = perimText;
                        document.getElementById('geoStatsPanel').style.display = 'block';
                    } catch (err) { }
                    return;
                }
            }
            if (closedPolygonLatLngs.length > 0) {
                closedPolygonLatLngs = [];
                fillAreaBtn.style.display = 'none';
                document.getElementById('geoStatsPanel').style.display = 'none';
            }
            polygonLatLngs.push(pt);
        }
    });

    mapInstance.on('moveend', () => { needsHeatmapUpdate = true; });
    mapInstance.on('zoomend', () => { needsHeatmapUpdate = true; });
    mapInstance.on('mousemove', (e) => { currentMouseLatLng = e.latlng; });

    let canvas = createCanvas(canvasWidth, canvasHeight);
    canvas.parent('canvas-container');

    heatmapCache = createGraphics(canvasWidth, canvasHeight);
    heatmapCache.noStroke();

    cols = floor(width / gridRes) + 1;
    rows = floor(height / gridRes) + 1;

    modeDragBtn = document.getElementById('modeDragBtn');
    modeDrawBtn = document.getElementById('modeDrawBtn');
    fillAreaBtn = document.getElementById('fillAreaBtn');

    modeDragBtn.addEventListener('click', () => setMode(MODE_DRAG));
    modeDrawBtn.addEventListener('click', () => setMode(MODE_DRAW));

    document.getElementById('addRouterBtn').addEventListener('click', () => {
        let center = mapInstance.getCenter();
        let rLat = (Math.random() - 0.5) * 0.0006;
        let rLng = (Math.random() - 0.5) * 0.0006;
        addRouter(center.lat + rLat, center.lng + rLng);
    });

    document.getElementById('clearRoutersBtn').addEventListener('click', () => {
        if (routers.length > 0 && !confirm('Are you sure you want to clear all routers?')) {
            return;
        }
        for (let r of routers) mapInstance.removeLayer(r.marker);
        routers = [];
        globalRouterId = 1;
        initialConfiguration = null; // Reset initial configuration
        updateRouterTable();
        updateRouterList();
        updateRouterCount();

        closedPolygonLatLngs = [];
        polygonLatLngs = [];
        fillAreaBtn.style.display = 'none';
        document.getElementById('geoStatsPanel').style.display = 'none';
        needsHeatmapUpdate = true;
    });

    fillAreaBtn.addEventListener('click', () => {
        fillGeoAreaWithRouters();
    });

    // Fullscreen functionality
    document.getElementById('fullscreenBtn').addEventListener('click', () => {
        let mapView = document.querySelector('.map-view');
        mapView.classList.add('fullscreen-mode');
        document.getElementById('exitFullscreenBtn').style.display = 'flex';
        document.getElementById('fullscreenControls').style.display = 'block';
        
        // Show AI Auto-Plan button in fullscreen if area is marked
        if (closedPolygonLatLngs.length > 0) {
            document.getElementById('fsFillAreaBtn').style.display = 'flex';
        }
        
        setTimeout(() => {
            mapInstance.invalidateSize();
            // Resize canvas to match fullscreen map
            let newW = mapView.clientWidth;
            let newH = mapView.clientHeight;
            resizeCanvas(newW, newH);
            heatmapCache = createGraphics(newW, newH);
            heatmapCache.noStroke();
            cols = floor(newW / gridRes) + 1;
            rows = floor(newH / gridRes) + 1;
            needsHeatmapUpdate = true;
        }, 100);
    });

    document.getElementById('exitFullscreenBtn').addEventListener('click', () => {
        let mapView = document.querySelector('.map-view');
        mapView.classList.remove('fullscreen-mode');
        document.getElementById('exitFullscreenBtn').style.display = 'none';
        document.getElementById('fullscreenControls').style.display = 'none';
        setTimeout(() => {
            mapInstance.invalidateSize();
            // Resize canvas back to normal view
            let mapWrapper = document.querySelector('.map-view');
            let newW = mapWrapper.clientWidth;
            let newH = mapWrapper.clientHeight;
            resizeCanvas(newW, newH);
            heatmapCache = createGraphics(newW, newH);
            heatmapCache.noStroke();
            cols = floor(newW / gridRes) + 1;
            rows = floor(newH / gridRes) + 1;
            needsHeatmapUpdate = true;
        }, 100);
    });
    
    // Fullscreen controls
    document.getElementById('fsDrawAreaBtn').addEventListener('click', () => {
        if (currentMode === MODE_DRAW) {
            setMode(MODE_DRAG);
        } else {
            setMode(MODE_DRAW);
        }
    });
    
    document.getElementById('fsAddRouterBtn').addEventListener('click', () => {
        let center = mapInstance.getCenter();
        let rLat = (Math.random() - 0.5) * 0.0006;
        let rLng = (Math.random() - 0.5) * 0.0006;
        addRouter(center.lat + rLat, center.lng + rLng);
    });
    
    document.getElementById('fsFillAreaBtn').addEventListener('click', () => {
        fillGeoAreaWithRouters();
    });
    
    document.getElementById('fsClearRoutersBtn').addEventListener('click', () => {
        if (routers.length > 0 && !confirm('Are you sure you want to clear all routers?')) {
            return;
        }
        for (let r of routers) mapInstance.removeLayer(r.marker);
        routers = [];
        globalRouterId = 1;
        initialConfiguration = null; // Reset initial configuration
        updateRouterTable();
        updateRouterList();
        updateRouterCount();
        closedPolygonLatLngs = [];
        polygonLatLngs = [];
        document.getElementById('fsFillAreaBtn').style.display = 'none';
        fillAreaBtn.style.display = 'none';
        document.getElementById('geoStatsPanel').style.display = 'none';
        needsHeatmapUpdate = true;
    });

    document.getElementById('radiusSlider').addEventListener('input', () => { 
        needsHeatmapUpdate = true;
        updatePowerDisplay();
        showAISuggestion();
    });
    document.getElementById('freqSelect').addEventListener('change', () => {
        needsHeatmapUpdate = true;
        showAISuggestion();
        if (closedPolygonLatLngs.length > 2) fillGeoAreaWithRouters();
    });

    // Tab Switching
    document.getElementById('tabPlanning').addEventListener('click', (e) => {
        e.target.classList.add('active');
        document.getElementById('tabDeployment').classList.remove('active');
        document.getElementById('viewPlanning').style.display = 'block';
        document.getElementById('viewDeployment').style.display = 'none';
    });
    document.getElementById('tabDeployment').addEventListener('click', (e) => {
        e.target.classList.add('active');
        document.getElementById('tabPlanning').classList.remove('active');
        document.getElementById('viewDeployment').style.display = 'block';
        document.getElementById('viewPlanning').style.display = 'none';
    });

    // Filter Select
    document.getElementById('filterSelect').addEventListener('change', (e) => {
        filterStatus = e.target.value;
        updateRouterTable();
        updateMarkerVisibility();
    });
    
    // Location Search
    let searchBtn = document.getElementById('searchBtn');
    let searchInput = document.getElementById('searchInput');
    
    if (searchBtn) {
        searchBtn.addEventListener('click', searchLocation);
    }
    
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchLocation();
        });
    }
    
    // Initialize power display
    updatePowerDisplay();
}

function updatePowerDisplay() {
    let power = document.getElementById('radiusSlider').value;
    document.getElementById('powerValue').innerText = power;
}

function showAISuggestion() {
    if (closedPolygonLatLngs.length < 3 || routers.length === 0) {
        document.getElementById('aiSuggestion').style.display = 'none';
        document.getElementById('aiAlternatives').style.display = 'none';
        document.getElementById('fsAiSuggestion').style.display = 'none';
        document.getElementById('fsAiAlternatives').style.display = 'none';
        return;
    }
    
    let freqValue = parseFloat(document.getElementById('freqSelect').value);
    let power = parseInt(document.getElementById('radiusSlider').value);
    let routerCount = routers.length;
    
    // Store initial configuration on first AI deployment
    if (!initialConfiguration) {
        initialConfiguration = {
            freq: freqValue,
            power: power,
            routerCount: routerCount
        };
    }
    
    // Calculate area coverage
    let coords = closedPolygonLatLngs.map(ll => [ll.lng, ll.lat]);
    coords.push([closedPolygonLatLngs[0].lng, closedPolygonLatLngs[0].lat]);
    let poly = turf.polygon([coords]);
    let areaSqM = turf.area(poly);
    
    // Calculate coverage metrics after deployment
    setTimeout(() => {
        let optimalPercent = parseFloat(document.getElementById('statOptimal').innerText);
        let deadZonePercent = parseFloat(document.getElementById('statDead').innerText);
        let interferencePercent = parseFloat(document.getElementById('statInterfere').innerText);
        
        analyzeAndSuggestAlternatives(freqValue, power, routerCount, areaSqM, optimalPercent, deadZonePercent, interferencePercent);
    }, 500);
}

function analyzeAndSuggestAlternatives(freq, power, routerCount, areaSqM, optimal, deadZone, interference) {
    let suggestion = '';
    let alternatives = [];
    
    // Calculate coverage density
    let density = (routerCount / (areaSqM / 1000));
    
    // GOAL: Zero Dead Zones + Maximum Optimal Signal
    let hasDeadZones = deadZone > 0.5;
    let hasGoodOptimal = optimal >= 70;
    let hasLowInterference = interference < 10;
    
    // Add "Reset to Original" option if configuration has changed
    if (initialConfiguration && (freq !== initialConfiguration.freq || power !== initialConfiguration.power)) {
        alternatives.push({
            type: 'reset',
            freq: initialConfiguration.freq,
            power: initialConfiguration.power,
            title: `🔄 Reset to Original Configuration`,
            details: `Back to ${initialConfiguration.freq} GHz @ ${initialConfiguration.power} power`,
            benefit: `Return to initial deployment with ${initialConfiguration.routerCount} routers`,
            keepRouters: false
        });
    }
    
    // Current configuration analysis
    if (freq === 2.4) {
        if (hasDeadZones) {
            suggestion = `⚠️ <strong>Dead zones detected!</strong> Increase power or add more routers for complete coverage.`;
            
            // Calculate alternatives
            let higherPower = Math.min(1500, Math.ceil(power * 1.4));
            
            alternatives.push({
                type: 'powerOnly',
                freq: 2.4,
                power: higherPower,
                title: `Option 1: Increase Power to ${higherPower}`,
                details: `Keep current ${routerCount} routers, only boost power by 40%`,
                benefit: `Estimated: ${Math.min(99, optimal + 15)}% optimal, reduced dead zones`,
                keepRouters: true
            });
            
            alternatives.push({
                type: 'redeploy',
                freq: 2.4,
                power: power,
                title: `Option 2: Redeploy with More Density`,
                details: `AI will recalculate optimal router placement at ${power} power`,
                benefit: `New router count estimated, targeting 0% dead zones`,
                keepRouters: false
            });
            
        } else if (!hasGoodOptimal) {
            suggestion = `💡 Coverage complete but <strong>optimal signal is low.</strong> Increase power for better performance.`;
            
            let betterPower = Math.min(1500, Math.ceil(power * 1.3));
            alternatives.push({
                type: 'powerOnly',
                freq: 2.4,
                power: betterPower,
                title: `Recommended: Increase Power to ${betterPower}`,
                details: `Keep current ${routerCount} routers with 30% more power`,
                benefit: `Estimated: ${Math.min(99, optimal + 18)}% optimal, 0% dead zones`,
                keepRouters: true
            });
            
        } else {
            suggestion = `✓ <strong>Excellent!</strong> Zero dead zones with ${optimal.toFixed(1)}% optimal signal. Configuration is perfect for 2.4 GHz.`;
        }
        
    } else { // 5 GHz
        if (hasDeadZones) {
            suggestion = `⚠️ <strong>5 GHz dead zones detected!</strong> Higher density needed for complete coverage.`;
            
            let higherPower5Ghz = Math.min(1500, Math.ceil(power * 1.5));
            
            alternatives.push({
                type: 'freq',
                freq: 2.4,
                power: power,
                title: `Option 1: Switch to 2.4 GHz & Redeploy`,
                details: `Better range, AI will recalculate router placement`,
                benefit: `Estimated: fewer routers needed, 0% dead zones`,
                keepRouters: false
            });
            
            alternatives.push({
                type: 'powerOnly',
                freq: 5,
                power: higherPower5Ghz,
                title: `Option 2: Increase Power to ${higherPower5Ghz}`,
                details: `Keep current ${routerCount} routers, boost 5 GHz power 50%`,
                benefit: `Estimated: ${Math.min(99, optimal + 20)}% optimal, reduced dead zones`,
                keepRouters: true
            });
            
            alternatives.push({
                type: 'redeploy',
                freq: 5,
                power: power,
                title: `Option 3: Redeploy with More Density`,
                details: `AI will recalculate for dense 5 GHz coverage at ${power} power`,
                benefit: `New router count, targeting 0% dead zones`,
                keepRouters: false
            });
            
        } else if (!hasGoodOptimal) {
            suggestion = `💡 5 GHz coverage complete but <strong>optimal signal needs boost.</strong>`;
            
            let betterPower = Math.min(1500, Math.ceil(power * 1.4));
            alternatives.push({
                type: 'powerOnly',
                freq: 5,
                power: betterPower,
                title: `Recommended: Increase Power to ${betterPower}`,
                details: `Keep current ${routerCount} routers with 40% more 5 GHz power`,
                benefit: `Estimated: ${Math.min(99, optimal + 22)}% optimal, high-speed coverage`,
                keepRouters: true
            });
            
        } else {
            suggestion = `✓ <strong>Perfect!</strong> Zero dead zones with ${optimal.toFixed(1)}% optimal signal. Excellent 5 GHz configuration.`;
        }
    }
    
    // Display suggestion
    document.getElementById('aiSuggestionText').innerHTML = suggestion;
    document.getElementById('aiSuggestion').style.display = 'flex';
    
    // Also update fullscreen AI suggestion
    document.getElementById('fsAiSuggestionText').innerHTML = suggestion;
    document.getElementById('fsAiSuggestion').style.display = 'flex';
    
    // Display alternatives
    if (alternatives.length > 0) {
        let altHTML = '';
        alternatives.forEach((alt, index) => {
            altHTML += `
                <div class="alt-option" onclick="applyAIAlternative(${index})">
                    <div class="alt-option-title">${alt.title} 👆 Click to Apply</div>
                    <div class="alt-option-details">${alt.details}</div>
                    <div class="alt-option-details">→ <span class="alt-option-highlight">${alt.benefit}</span></div>
                </div>
            `;
        });
        document.getElementById('aiAlternativesContent').innerHTML = altHTML;
        document.getElementById('aiAlternatives').style.display = 'block';
        
        // Also update fullscreen alternatives
        document.getElementById('fsAiAlternativesContent').innerHTML = altHTML;
        document.getElementById('fsAiAlternatives').style.display = 'block';
        
        // Store alternatives globally for clicking
        window.currentAlternatives = alternatives;
    } else {
        document.getElementById('aiAlternatives').style.display = 'none';
        document.getElementById('fsAiAlternatives').style.display = 'none';
        window.currentAlternatives = [];
    }
}

function applyAIAlternative(index) {
    if (!window.currentAlternatives || !window.currentAlternatives[index]) return;
    
    let alt = window.currentAlternatives[index];
    
    // Apply frequency change if needed
    if (alt.freq !== parseFloat(document.getElementById('freqSelect').value)) {
        document.getElementById('freqSelect').value = alt.freq;
    }
    
    // Apply power change
    if (alt.type === 'powerOnly' || alt.type === 'freq' || alt.type === 'reset' || alt.type === 'power') {
        document.getElementById('radiusSlider').value = alt.power;
        updatePowerDisplay();
    }
    
    // Show feedback
    let feedback = document.createElement('div');
    feedback.className = 'ai-feedback';
    
    if (alt.type === 'reset') {
        feedback.innerHTML = `🔄 Resetting to original configuration...`;
        feedback.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            color: white;
            padding: 20px 30px;
            border-radius: 12px;
            font-size: 0.9rem;
            font-weight: 700;
            box-shadow: 0 8px 32px rgba(99, 102, 241, 0.4);
            z-index: 10000;
            animation: fadeInScale 0.3s ease;
        `;
    } else if (alt.keepRouters) {
        feedback.innerHTML = `✓ Power adjusted to ${alt.power}! Routers unchanged, updating coverage...`;
        feedback.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #06b6d4, #0891b2);
            color: white;
            padding: 20px 30px;
            border-radius: 12px;
            font-size: 0.9rem;
            font-weight: 700;
            box-shadow: 0 8px 32px rgba(6, 182, 212, 0.4);
            z-index: 10000;
            animation: fadeInScale 0.3s ease;
        `;
    } else {
        feedback.innerHTML = `✓ Applied! Redeploying with ${alt.freq} GHz @ ${alt.power} power...`;
        feedback.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, var(--success), var(--success-hover));
            color: white;
            padding: 20px 30px;
            border-radius: 12px;
            font-size: 0.9rem;
            font-weight: 700;
            box-shadow: 0 8px 32px rgba(16, 185, 129, 0.4);
            z-index: 10000;
            animation: fadeInScale 0.3s ease;
        `;
    }
    
    document.body.appendChild(feedback);
    
    // Trigger recalculation only if needed
    setTimeout(() => {
        // Only redeploy if the option requires it (type 'redeploy', 'freq', or 'reset')
        if (!alt.keepRouters && closedPolygonLatLngs.length > 0) {
            fillGeoAreaWithRouters();
        } else {
            // Just update heatmap for power-only changes
            needsHeatmapUpdate = true;
            // Re-run AI suggestion after power change
            setTimeout(() => {
                showAISuggestion();
            }, 500);
        }
        
        // Remove feedback after 2 seconds
        setTimeout(() => {
            feedback.remove();
        }, 2000);
    }, 500);
}

// Location Search Function
async function searchLocation() {
    const searchInput = document.getElementById('searchInput');
    const resultsDiv = document.getElementById('searchResults');
    
    if (!searchInput || !resultsDiv) return;
    
    const query = searchInput.value.trim();
    
    if (!query) {
        resultsDiv.innerHTML = '<div class="search-message search-error">Please enter a location</div>';
        setTimeout(() => resultsDiv.innerHTML = '', 2000);
        return;
    }
    
    resultsDiv.innerHTML = '<div class="search-message search-loading">Searching...</div>';
    
    // Check if input is coordinates (lat, lng) format
    const coordPattern = /^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/;
    const coordMatch = query.match(coordPattern);
    
    if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lng = parseFloat(coordMatch[2]);
        
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            mapInstance.setView([lat, lng], 18);
            resultsDiv.innerHTML = '<div class="search-message search-success">✓ Location found!</div>';
            setTimeout(() => resultsDiv.innerHTML = '', 2000);
        } else {
            resultsDiv.innerHTML = '<div class="search-message search-error">Invalid coordinates</div>';
            setTimeout(() => resultsDiv.innerHTML = '', 2000);
        }
        return;
    }
    
    // Search by location name using Nominatim (OpenStreetMap)
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
        const data = await response.json();
        
        if (data.length === 0) {
            resultsDiv.innerHTML = '<div class="search-message search-error">No results found</div>';
            setTimeout(() => resultsDiv.innerHTML = '', 2000);
            return;
        }
        
        resultsDiv.innerHTML = '';
        data.forEach((result) => {
            const resultItem = document.createElement('div');
            resultItem.className = 'search-result-item';
            resultItem.innerHTML = `
                <div class="result-name">${result.display_name}</div>
                <div class="result-coords">${parseFloat(result.lat).toFixed(4)}, ${parseFloat(result.lon).toFixed(4)}</div>
            `;
            resultItem.addEventListener('click', () => {
                mapInstance.setView([result.lat, result.lon], 18);
                resultsDiv.innerHTML = '<div class="search-message search-success">✓ Location set!</div>';
                searchInput.value = '';
                setTimeout(() => resultsDiv.innerHTML = '', 1500);
            });
            resultsDiv.appendChild(resultItem);
        });
    } catch (error) {
        resultsDiv.innerHTML = '<div class="search-message search-error">Search failed. Try again.</div>';
        setTimeout(() => resultsDiv.innerHTML = '', 2000);
    }
}

function deployRouterNode(id) {
    let r = routers.find(x => x.id === id);
    if (r) {
        r.isDeployed = true;
        r.updateMarkerStyle();
        updateRouterTable();
        needsHeatmapUpdate = true;
        updateRouterCount();
        updateMarkerVisibility();
    }
}

function undeployRouterNode(id) {
    let r = routers.find(x => x.id === id);
    if (r) {
        r.isDeployed = false;
        r.updateMarkerStyle();
        updateRouterTable();
        needsHeatmapUpdate = true;
        updateRouterCount();
        updateMarkerVisibility();
    }
}

function updateRouterCount() {
    let totalPlanned = routers.length;
    let totalDeployed = routers.filter(r => r.isDeployed).length;
    let remainingToDeploy = totalPlanned - totalDeployed;

    document.getElementById('ledgerPlanned').innerText = totalPlanned;
    document.getElementById('ledgerDeployed').innerText = totalDeployed;
    document.getElementById('ledgerRemaining').innerText = remainingToDeploy;

    // Update map info box
    document.getElementById('mapRouterCount').innerText = totalPlanned;

    if (document.getElementById('sideTotalPlanned')) {
        document.getElementById('sideTotalPlanned').innerText = totalPlanned;
        document.getElementById('sideCompleted').innerText = totalDeployed;
        document.getElementById('sideToDeploy').innerText = remainingToDeploy;

        let progress = totalPlanned > 0 ? (totalDeployed / totalPlanned) * 100 : 0;
        document.getElementById('deploymentProgress').style.width = progress + '%';
    }
}

function updateRouterList() {
    let listPanel = document.getElementById('routerListPanel');
    let listContainer = document.getElementById('routerList');
    
    if (routers.length === 0) {
        listPanel.style.display = 'none';
        return;
    }
    
    listPanel.style.display = 'block';
    listContainer.innerHTML = '';
    
    routers.forEach(r => {
        let item = document.createElement('div');
        item.className = 'router-item';
        item.innerHTML = `
            <div class="router-info">
                <div class="router-id">Router ${r.id}</div>
                <div class="router-coords">${r.latlng.lat.toFixed(4)}, ${r.latlng.lng.toFixed(4)}</div>
            </div>
            <button class="router-delete-btn" onclick="removeRouter(${r.id})">✕ Delete</button>
        `;
        listContainer.appendChild(item);
    });
}

function removeRouter(id) {
    let index = routers.findIndex(r => r.id === id);
    if (index !== -1) {
        mapInstance.removeLayer(routers[index].marker);
        routers.splice(index, 1);
        
        // Renumber all remaining routers sequentially
        renumberRouters();
        
        updateRouterTable();
        updateRouterList();
        updateRouterCount();
        needsHeatmapUpdate = true;
    }
}

function updateRouterTable() {
    let container = document.getElementById('routerTableBody');
    if (!container) return;
    container.innerHTML = '';

    let filteredRouters = routers.filter(r => {
        if (filterStatus === 'deployed') return r.isDeployed;
        if (filterStatus === 'pending') return !r.isDeployed;
        return true;
    });

    if (filteredRouters.length === 0) {
        container.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No planning data available matching filter.</td></tr>`;
        return;
    }

    filteredRouters.forEach(r => {
        let tr = document.createElement('tr');
        tr.id = 'node-row-' + r.id;

        let statusHtml = r.isDeployed ? `<span class="badge-status badge-active">Active</span>` : `<span class="badge-status badge-pending">Pending</span>`;
        let actionBtn = r.isDeployed ? `<button class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.8rem;" onclick="undeployRouterNode(${r.id})">Revoke Unit</button>` : `<button class="btn btn-primary" style="padding: 6px 12px; font-size: 0.8rem;" onclick="deployRouterNode(${r.id})">Deploy Unit</button>`;

        let freqText = document.getElementById('freqSelect').value + " GHz";

        tr.innerHTML = `
            <td><strong>AP-NODE-${r.id}</strong></td>
            <td id="node-coords-${r.id}" class="text-muted" style="font-family: monospace; font-size: 0.8rem;">${r.latlng.lat.toFixed(6)}, ${r.latlng.lng.toFixed(6)}</td>
            <td>${freqText}</td>
            <td class="status-cell">${statusHtml}</td>
            <td class="action-cell">
                ${actionBtn}
            </td>
        `;
        container.appendChild(tr);
    });
}

function updateMarkerVisibility() {
    routers.forEach(r => {
        let shouldShow = true;
        if (filterStatus === 'deployed' && !r.isDeployed) shouldShow = false;
        if (filterStatus === 'pending' && r.isDeployed) shouldShow = false;

        if (shouldShow && !mapInstance.hasLayer(r.marker)) {
            r.marker.addTo(mapInstance);
        } else if (!shouldShow && mapInstance.hasLayer(r.marker)) {
            mapInstance.removeLayer(r.marker);
        }
    });
}

function addRouter(lat, lng) {
    let r = new Router(lat, lng, globalRouterId);
    routers.push(r);
    globalRouterId++;
    
    // Renumber all routers sequentially
    renumberRouters();
    
    updateRouterTable();
    updateRouterList();
    updateRouterCount();
    updateMarkerVisibility();
    needsHeatmapUpdate = true;
}

function renumberRouters() {
    // Renumber all routers sequentially from 1
    routers.forEach((router, index) => {
        router.id = index + 1;
    });
    // Set next ID to be one after the last router
    globalRouterId = routers.length + 1;
}

function setMode(mode) {
    currentMode = mode;
    if (mode === MODE_DRAG) {
        modeDragBtn.classList.add('active');
        modeDrawBtn.classList.remove('active');
        mapInstance.dragging.enable();
        document.getElementById('map').style.cursor = 'grab';
    } else {
        modeDrawBtn.classList.add('active');
        modeDragBtn.classList.remove('active');
        mapInstance.dragging.disable();
        document.getElementById('map').style.cursor = 'crosshair';
    }
}

function draw() {
    clear();

    let zoom = mapInstance.getZoom();
    let scale = pow(2, zoom - 18);
    let baseStrength = parseInt(document.getElementById('radiusSlider').value) || 400;

    let freqValue = parseFloat(document.getElementById('freqSelect').value) || 2.4;
    let freqPowerMultiplier = (freqValue === 5) ? 0.55 : 1.0;

    ROUTER_SCREEN_RANGE = baseStrength * scale * freqPowerMultiplier;

    if (needsHeatmapUpdate) {
        computeHeatmapToCache();
        needsHeatmapUpdate = false;
    }

    let ox = 0, oy = 0;
    if (cacheCenterLatLng && !needsHeatmapUpdate) {
        let cPt = mapInstance.latLngToContainerPoint(cacheCenterLatLng);
        let mapSize = mapInstance.getSize();
        ox = cPt.x - (mapSize.x / 2);
        oy = cPt.y - (mapSize.y / 2);
    }

    image(heatmapCache, ox, oy);
    drawGeoPolygonArea();

    for (let i = 0; i < routers.length; i++) {
        // Only draw waves and markers if they match filter
        let shouldShow = true;
        if (filterStatus === 'deployed' && !routers[i].isDeployed) shouldShow = false;
        if (filterStatus === 'pending' && routers[i].isDeployed) shouldShow = false;

        if (shouldShow) {
            if (routers[i].isDeployed) {
                routers[i].update();
                routers[i].displayWaves();
            }
            routers[i].display();
        }
    }
}

function windowResized() {
    let mapWrapper = document.querySelector('.map-view');
    if (!mapWrapper) return;
    let newW = mapWrapper.clientWidth;
    let newH = mapWrapper.clientHeight;
    resizeCanvas(newW, newH);

    heatmapCache = createGraphics(newW, newH);
    heatmapCache.noStroke();
    cols = floor(newW / gridRes) + 1;
    rows = floor(newH / gridRes) + 1;
    needsHeatmapUpdate = true;
    
    // Invalidate map size to ensure proper rendering
    if (mapInstance) {
        mapInstance.invalidateSize();
    }
}

function drawGeoPolygonArea() {
    if (polygonLatLngs.length > 0) {
        stroke(59, 130, 246);
        strokeWeight(2);
        let screenPts = polygonLatLngs.map(ll => mapInstance.latLngToContainerPoint(ll));
        for (let i = 0; i < screenPts.length - 1; i++) {
            line(screenPts[i].x, screenPts[i].y, screenPts[i + 1].x, screenPts[i + 1].y);
        }
        if (currentMouseLatLng) {
            let pt = mapInstance.latLngToContainerPoint(currentMouseLatLng);
            line(screenPts[screenPts.length - 1].x, screenPts[screenPts.length - 1].y, pt.x, pt.y);
        }
        noStroke(); fill(59, 130, 246); ellipse(screenPts[0].x, screenPts[0].y, 10, 10);
    }

    if (closedPolygonLatLngs.length > 0) {
        fill(59, 130, 246, 20);
        stroke(59, 130, 246, 150);
        strokeWeight(2);
        let screenPts = closedPolygonLatLngs.map(ll => mapInstance.latLngToContainerPoint(ll));
        beginShape(); drawingContext.setLineDash([5, 5]);
        for (let pt of screenPts) vertex(pt.x, pt.y);
        endShape(CLOSE); drawingContext.setLineDash([]);
    }
}

function computeHeatmapToCache() {
    heatmapCache.clear();
    cacheCenterLatLng = mapInstance.getCenter();

    let c_optimal = 0, c_weak = 0, c_interfere = 0, c_dead = 0, c_total = 0;
    let hasPoly = (closedPolygonLatLngs.length > 2);
    let screenPoly = hasPoly ? closedPolygonLatLngs.map(ll => mapInstance.latLngToContainerPoint(ll)) : null;

    // Calculate predicted heatmap using visibly filtered routers (allows previewing pending routers!)
    let activeRouters = routers.filter(r => {
        if (filterStatus === 'deployed' && !r.isDeployed) return false;
        if (filterStatus === 'pending' && r.isDeployed) return false;
        return true;
    });

    if (activeRouters.length === 0) {
        document.getElementById('statOptimal').innerText = "0%";
        document.getElementById('statWeak').innerText = "0%";
        document.getElementById('statInterfere').innerText = "0%";
        document.getElementById('statDead').innerText = "100%";
        return;
    }

    let rScreen = activeRouters.map(r => mapInstance.latLngToContainerPoint(r.latlng));
    let freqValue = parseFloat(document.getElementById('freqSelect').value) || 2.4;
    let localInterferenceRatio = (freqValue === 5) ? 0.03 : 0.25;

    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            let px = i * gridRes + gridRes / 2;
            let py = j * gridRes + gridRes / 2;

            if (hasPoly && !pointInPolygonScreen(px, py, screenPoly)) continue;
            c_total++;

            let signals = [];
            for (let rs of rScreen) {
                let d = dist(px, py, rs.x, rs.y);
                if (d < ROUTER_SCREEN_RANGE) {
                    let signalStr = max(0, ROUTER_SCREEN_RANGE - d);
                    if (signalStr > 0) signals.push(signalStr);
                }
            }

            let col = null;
            if (signals.length == 1) {
                let rRatio = signals[0] / ROUTER_SCREEN_RANGE;
                if (rRatio > 0.5) { c_optimal++; col = color(C_OPTIMAL[0], C_OPTIMAL[1], C_OPTIMAL[2], map(rRatio, 0.5, 1, 60, 180)); }
                else { c_weak++; col = color(C_WEAK[0], C_WEAK[1], C_WEAK[2], map(rRatio, 0, 0.5, 30, 100)); }
            } else if (signals.length > 1) {
                signals.sort((a, b) => b - a);
                let diff = abs(signals[0] - signals[1]);
                if (diff < ROUTER_SCREEN_RANGE * localInterferenceRatio && signals[1] > ROUTER_SCREEN_RANGE * 0.3) {
                    c_interfere++; col = color(C_INTERFERENCE[0], C_INTERFERENCE[1], C_INTERFERENCE[2], map(signals[1], 0, ROUTER_SCREEN_RANGE, 80, 200));
                } else {
                    let rRatio = signals[0] / ROUTER_SCREEN_RANGE;
                    if (rRatio > 0.5) { c_optimal++; col = color(C_OPTIMAL[0], C_OPTIMAL[1], C_OPTIMAL[2], map(rRatio, 0.5, 1, 60, 180)); }
                    else { c_weak++; col = color(C_WEAK[0], C_WEAK[1], C_WEAK[2], map(rRatio, 0, 0.5, 30, 100)); }
                }
            } else {
                c_dead++;
            }

            if (col !== null) {
                heatmapCache.fill(col);
                heatmapCache.rect(i * gridRes, j * gridRes, gridRes, gridRes);
            }
        }
    }

    if (c_total > 0) {
        document.getElementById('statOptimal').innerText = ((c_optimal / c_total) * 100).toFixed(1) + '%';
        document.getElementById('statWeak').innerText = ((c_weak / c_total) * 100).toFixed(1) + '%';
        document.getElementById('statInterfere').innerText = ((c_interfere / c_total) * 100).toFixed(1) + '%';
        document.getElementById('statDead').innerText = ((c_dead / c_total) * 100).toFixed(1) + '%';
        
        // Update map info box
        let coveragePercent = ((c_optimal / c_total) * 100).toFixed(1);
        let interferencePercent = ((c_interfere / c_total) * 100).toFixed(1);
        document.getElementById('mapCoverage').innerText = coveragePercent + '%';
        document.getElementById('mapInterference').innerText = interferencePercent + '%';
    }
}

function pointInPolygonScreen(px, py, vs) {
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i].x, yi = vs[i].y;
        let xj = vs[j].x, yj = vs[j].y;
        let intersect = ((yi > py) != (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function fillGeoAreaWithRouters() {
    if (closedPolygonLatLngs.length < 3) return;

    for (let r of routers) mapInstance.removeLayer(r.marker);
    routers = [];
    globalRouterId = 1;
    updateRouterTable();
    updateRouterList();
    updateRouterCount();
    needsHeatmapUpdate = true;

    let screenPoly = closedPolygonLatLngs.map(ll => mapInstance.latLngToContainerPoint(ll));
    let minX = width, maxX = 0, minY = height, maxY = 0;
    for (let pt of screenPoly) {
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
    }

    let freqValue = parseFloat(document.getElementById('freqSelect').value) || 2.4;
    let baseStrength = parseInt(document.getElementById('radiusSlider').value) || 400;

    let zoom = mapInstance.getZoom();
    let scale = pow(2, zoom - 18);
    
    // AI PRIORITY: ZERO DEAD ZONES + MAXIMUM OPTIMAL SIGNAL
    // Aggressive coverage multiplier ensures complete area coverage
    let freqPowerMultiplier = (freqValue === 5) ? 0.55 : 1.0;
    
    // ZERO DEAD ZONE COEFFICIENT: 0.98 for maximum coverage overlap
    // This ensures every point in the area has optimal signal strength
    // Higher overlap = more optimal signal, zero dead zones
    let zeroDeadZoneCoeff = 0.98;
    
    let R = baseStrength * scale * freqPowerMultiplier * zeroDeadZoneCoeff;
    
    // Tighter hexagonal grid for zero dead zones
    let dx = R * 1.6;   // Reduced from 1.732 for more coverage overlap
    let dy = R * 1.4;   // Reduced from 1.5 for denser placement

    let cx = (minX + maxX) / 2;
    let cy = (minY + maxY) / 2;

    let startRow = Math.floor((minY - dy - cy) / dy);
    let endRow = Math.ceil((maxY + dy - cy) / dy);

    // Generate optimal router placement for ZERO DEAD ZONES
    for (let j = startRow; j <= endRow; j++) {
        let py = cy + j * dy;
        let offsetX = (Math.abs(j) % 2 === 1) ? (dx / 2) : 0;

        let startCol = Math.floor((minX - dx - cx - offsetX) / dx);
        let endCol = Math.ceil((maxX + dx - cx - offsetX) / dx);

        for (let i = startCol; i <= endCol; i++) {
            let px = cx + i * dx + offsetX;
            if (pointInPolygonScreen(px, py, screenPoly)) {
                let newLL = mapInstance.containerPointToLatLng([px, py]);
                addRouter(newLL.lat, newLL.lng);
            }
        }
    }
    
    // AI ANALYSIS: Zero Dead Zone Optimization
    console.log(`AI Optimization: ZERO DEAD ZONES MODE`);
    console.log(`- Frequency: ${freqValue} GHz`);
    console.log(`- Base Power: ${baseStrength} units`);
    console.log(`- Coverage Radius: ${R.toFixed(2)} px`);
    console.log(`- Routers Deployed: ${routers.length}`);
    console.log(`- Zero Dead Zone Coefficient: ${zeroDeadZoneCoeff}`);
    console.log(`- Goal: Maximum Optimal Signal + Zero Dead Zones`);
    
    // Show AI suggestion
    showAISuggestion();
}

var TransIcon = L.DivIcon.extend({
    options: { className: 'custom-div-icon', html: "<div class='router-touch-area pending'></div>", iconSize: [44, 44], iconAnchor: [22, 22] }
});

class Router {
    constructor(lat, lng, id) {
        this.id = id;
        this.isDeployed = false;
        this.latlng = L.latLng(lat, lng);
        this.marker = L.marker(this.latlng, { icon: new TransIcon(), draggable: true }).addTo(mapInstance);
        this.iconElement = this.marker.getElement() ? this.marker.getElement().querySelector('.router-touch-area') : null;

        this.marker.on('drag', (e) => {
            this.latlng = e.target.getLatLng();
            needsHeatmapUpdate = true; // Update predictive calculations even when dragging pending nodes 

            let coordSpan = document.getElementById('node-coords-' + this.id);
            if (coordSpan) coordSpan.innerText = `${this.latlng.lat.toFixed(6)}, ${this.latlng.lng.toFixed(6)}`;
        });

        this.radius = 12;
        this.waves = [];
        this.waveTimer = 0;
    }

    updateMarkerStyle() {
        if (this.marker.getElement()) {
            this.iconElement = this.marker.getElement().querySelector('.router-touch-area');
        }
        if (!this.iconElement) return;

        if (this.isDeployed) {
            this.iconElement.classList.remove('pending');
        } else {
            this.iconElement.classList.add('pending');
        }
    }

    update() {
        this.waveTimer += deltaTime;
        if (this.waveTimer > 1500) {
            this.waves.push({ rFactor: 0, alpha: 200 });
            this.waveTimer = 0;
        }
    }

    displayWaves() {
        noFill();
        let screenPos = mapInstance.latLngToContainerPoint(this.latlng);
        for (let i = this.waves.length - 1; i >= 0; i--) {
            let w = this.waves[i];
            w.rFactor += 0.005;
            w.alpha -= 1.5;
            if (w.alpha <= 0) {
                this.waves.splice(i, 1);
                continue;
            }
            let rad = w.rFactor * ROUTER_SCREEN_RANGE;
            stroke(16, 185, 129, w.alpha * 0.5);
            strokeWeight(1);
            ellipse(screenPos.x, screenPos.y, rad * 2, rad * 2);
        }
    }

    display() {
        let screenPos = mapInstance.latLngToContainerPoint(this.latlng);
        push();
        translate(screenPos.x, screenPos.y);

        if (this.isDeployed) {
            fill(255);
            stroke(16, 185, 129);
            strokeWeight(2);
            ellipse(0, 0, this.radius * 2);

            noStroke(); fill(16, 185, 129); ellipse(0, 0, this.radius);
        } else {
            fill(255);
            stroke(100, 116, 139);
            strokeWeight(2);
            ellipse(0, 0, this.radius * 2);

            noStroke(); fill(100, 116, 139); ellipse(0, 0, this.radius);
        }

        fill(255);
        textAlign(CENTER, CENTER);
        textFont('Inter, sans-serif');
        textSize(10);
        textStyle(BOLD);
        text(this.id, 0, 0);

        pop();
    }
}