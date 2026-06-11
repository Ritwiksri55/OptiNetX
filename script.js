let mapInstance;
const MODE_DRAG = 0;
const MODE_DRAW = 1;
let currentMode = MODE_DRAG;

let polygonLatLngs = [];
let closedPolygonLatLngs = [];

let routers = [];
let globalRouterId = 1;
let gridRes = 30;
let cols, rows;
let ROUTER_SCREEN_RANGE = 400;

let heatmapCache;
let needsHeatmapUpdate = true;
let cacheCenterLatLng = null;

let filterStatus = 'all'; // 'all', 'deployed', 'pending'

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
    }).setView([40.7128, -74.0060], 18);

    // Premium map tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 20,
        attribution: '&copy; OpenStreetMap'
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
        for (let r of routers) mapInstance.removeLayer(r.marker);
        routers = [];
        globalRouterId = 1;
        updateRouterTable();
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

    document.getElementById('radiusSlider').addEventListener('input', () => { needsHeatmapUpdate = true; });
    document.getElementById('freqSelect').addEventListener('change', () => {
        needsHeatmapUpdate = true;
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

    if (document.getElementById('sideTotalPlanned')) {
        document.getElementById('sideTotalPlanned').innerText = totalPlanned;
        document.getElementById('sideCompleted').innerText = totalDeployed;
        document.getElementById('sideToDeploy').innerText = remainingToDeploy;

        let progress = totalPlanned > 0 ? (totalDeployed / totalPlanned) * 100 : 0;
        document.getElementById('deploymentProgress').style.width = progress + '%';
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
    let r = new Router(lat, lng, globalRouterId++);
    routers.push(r);

    updateRouterTable();
    updateRouterCount();
    updateMarkerVisibility();
    needsHeatmapUpdate = true; // Refresh predictive map display for new pending nodes
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
    cols = floor(width / gridRes) + 1;
    rows = floor(height / gridRes) + 1;
    needsHeatmapUpdate = true;
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
    let freqPowerMultiplier = (freqValue === 5) ? 0.55 : 1.0; // Fixed mismatch with visual range!
    let baseStrength = parseInt(document.getElementById('radiusSlider').value) || 400;

    let zoom = mapInstance.getZoom();
    let scale = pow(2, zoom - 18);
    // Balanced hexagonal packing: Tights R to 0.85 to securely eliminate edge dead-zones while minimizing overlap
    let R = baseStrength * scale * freqPowerMultiplier * 0.85;
    let dx = R * 1.732;
    let dy = R * 1.5;

    let cx = (minX + maxX) / 2;
    let cy = (minY + maxY) / 2;

    let startRow = Math.floor((minY - dy - cy) / dy);
    let endRow = Math.ceil((maxY + dy - cy) / dy);

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
