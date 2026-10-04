// ========== ИНИЦИАЛИЗАЦИЯ КАРТЫ ==========
const map = L.map('map').setView([59.94, 30.33], 13);

L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles © Esri',
    maxZoom: 19
}).addTo(map);

// ========== МАРКЕРЫ МОСТОВ ==========
const markers = {};

BRIDGES.forEach(bridge => {
    const marker = L.marker([bridge.lat, bridge.lng]).addTo(map);
    marker.bindPopup(`<b>${bridge.name}</b><br>${bridge.year} г.`);
    marker.on('click', () => showBridgeCard(bridge));
    markers[bridge.id] = marker;
});

// ========== КАРТОЧКА МОСТА ==========
const bridgeCard = document.getElementById('bridgeCard');
const cardTitle = document.getElementById('cardTitle');
const cardYear = document.getElementById('cardYear');
const cardDesc = document.getElementById('cardDesc');

let currentBridge = null;

function showBridgeCard(bridge) {
    currentBridge = bridge;
    cardTitle.textContent = bridge.name;
    cardYear.textContent = bridge.year + ' г.';
    cardDesc.textContent = bridge.desc;
    bridgeCard.classList.remove('hidden');
}

document.getElementById('closeCard').addEventListener('click', () => {
    bridgeCard.classList.add('hidden');
});

// ========== AR-РЕЖИМ ==========
const arModal = document.getElementById('arModal');
const arOverlay = document.getElementById('arOverlay');

document.getElementById('arBtn').addEventListener('click', () => {
    if (!currentBridge) return;
    arModal.classList.remove('hidden');
    arOverlay.innerHTML = `
        <h3>${currentBridge.name}</h3>
        <p>Исторический слой активирован. Наведите камеру на мост, чтобы увидеть его историческое фото и информацию об архитекторе (${currentBridge.architect}).</p>
    `;
});

document.getElementById('closeAr').addEventListener('click', () => {
    arModal.classList.add('hidden');
});

// ========== МАРШРУТ ПО ВОДЕ ==========
let routeLine = null;
let routeStartMarker = null;

document.getElementById('routeBtn').addEventListener('click', () => {
    if (!currentBridge) {
        alert('Сначала выберите мост на карте');
        return;
    }

    const bridge = currentBridge;

    // Убираем старую линию
    if (routeLine) map.removeLayer(routeLine);
    if (routeStartMarker) map.removeLayer(routeStartMarker);

    // Находим ближайший причал к мосту
    const startPier = PIERS.reduce((nearest, pier) => {
        const d = Math.hypot(pier.lat - bridge.lat, pier.lng - bridge.lng);
        const dn = Math.hypot(nearest.lat - bridge.lat, nearest.lng - bridge.lng);
        return d < dn ? pier : nearest;
    }, PIERS[0]);

    // Строим маршрут по руслу
    const routePoints = buildWaterRoute(startPier, bridge);

    // Рисуем линию
    routeLine = L.polyline(routePoints, {
        color: '#ff6b4a',
        weight: 5,
        opacity: 0.9,
        dashArray: '12, 8',
        lineCap: 'round'
    }).addTo(map);

    // Маркер старта
    routeStartMarker = L.marker([startPier.lat, startPier.lng], {
        icon: L.divIcon({
            className: 'start-icon',
            html: '⛵',
            iconSize: [32, 32]
        })
    }).addTo(map).bindPopup(`Старт: ${startPier.name}`);

    // Подгоняем карту под маршрут
    map.fitBounds(routeLine.getBounds(), { padding: [80, 80] });

    // Информация о маршруте
    const distance = calculateDistance(routePoints);
    const time = Math.round(distance / 0.25);
    setTimeout(() => {
        alert(`Маршрут построен!\n\nОткуда: ${startPier.name}\nКуда: ${bridge.name}\nРасстояние: ${distance.toFixed(1)} км\nВремя в пути: ~${time} мин`);
    }, 400);
});

function buildWaterRoute(startPier, endBridge) {
    const points = [[startPier.lat, startPier.lng]];
    const nearestToStart = findNearestRiverPoint(startPier.lat, startPier.lng);
    const nearestToEnd = findNearestRiverPoint(endBridge.lat, endBridge.lng);
    const startIdx = RIVER_PATH.indexOf(nearestToStart);
    const endIdx = RIVER_PATH.indexOf(nearestToEnd);

    if (startIdx <= endIdx) {
        for (let i = startIdx; i <= endIdx; i++) points.push(RIVER_PATH[i]);
    } else {
        for (let i = startIdx; i >= endIdx; i--) points.push(RIVER_PATH[i]);
    }

    points.push([endBridge.lat, endBridge.lng]);
    return points;
}

function findNearestRiverPoint(lat, lng) {
    let nearest = RIVER_PATH[0];
    let minDist = Infinity;
    RIVER_PATH.forEach(point => {
        const d = Math.hypot(point[0] - lat, point[1] - lng);
        if (d < minDist) { minDist = d; nearest = point; }
    });
    return nearest;
}

function calculateDistance(points) {
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
        const [lat1, lng1] = points[i];
        const [lat2, lng2] = points[i + 1];
        const dLat = (lat2 - lat1) * 111;
        const dLng = (lng2 - lng1) * 111 * Math.cos(lat1 * Math.PI / 180);
        total += Math.hypot(dLat, dLng);
    }
    return total;
}

// ========== НАВИГАЦИЯ ПО СТРАНИЦАМ ==========
const navLinks = document.querySelectorAll('.nav-link');
const pages = document.querySelectorAll('.page');

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const pageId = link.dataset.page;
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        pages.forEach(p => p.classList.remove('active'));
        document.getElementById('page-' + pageId).classList.add('active');
        if (pageId === 'map') setTimeout(() => map.invalidateSize(), 100);
        if (pageId === 'bridges') renderBridgeList();
    });
});

// ========== СПИСОК РАЗВОДА ==========
function renderBridgeList() {
    const list = document.getElementById('bridgeList');
    if (!list) return;
    list.innerHTML = '';
    BRIDGES.forEach(bridge => {
        const s = bridge.schedule;
        const statusClass = s.status === 'red' ? 'red' : 'green';
        const statusText = s.status === 'red' ? 'Разведен' : 'Сведен';
        const timeText = s.status === 'red' ? s.разведен : '—';
        const item = document.createElement('div');
        item.className = 'bridge-item';
        item.innerHTML = `
            <div class="name"><span class="dot ${statusClass}"></span>${bridge.name}</div>
            <div class="time ${statusClass}">${timeText} ${s.status === 'red' ? '' : '• ' + statusText}</div>
        `;
        list.appendChild(item);
    });
}

// ========== ПОИСК ==========
const searchInput = document.getElementById('searchInput');
const suggestionsBox = document.createElement('div');
suggestionsBox.className = 'suggestions';
suggestionsBox.style.display = 'none';
searchInput.parentElement.appendChild(suggestionsBox);

searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    suggestionsBox.innerHTML = '';
    if (!query) { suggestionsBox.style.display = 'none'; return; }
    const found = BRIDGES.filter(b =>
        b.name.toLowerCase().includes(query) ||
        String(b.year).includes(query) ||
        b.architect.toLowerCase().includes(query)
    );
    if (found.length === 0) {
        suggestionsBox.innerHTML = '<div class="suggestion-item empty">Ничего не найдено</div>';
        suggestionsBox.style.display = 'block';
        return;
    }
    found.forEach(bridge => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.innerHTML = `
            <div class="suggestion-name">${bridge.name}</div>
            <div class="suggestion-meta">${bridge.year} г. • ${bridge.architect}</div>
        `;
        item.addEventListener('click', () => {
            map.setView([bridge.lat, bridge.lng], 15);
            markers[bridge.id].openPopup();
            showBridgeCard(bridge);
            searchInput.value = bridge.name;
            suggestionsBox.style.display = 'none';
        });
        suggestionsBox.appendChild(item);
    });
    suggestionsBox.style.display = 'block';
});

document.addEventListener('click', (e) => {
    if (!searchInput.parentElement.contains(e.target)) {
        suggestionsBox.style.display = 'none';
    }
});

// Инициализация
renderBridgeList();