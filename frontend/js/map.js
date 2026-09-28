const LocationMap = (() => {
  const defaultCenter = [-15.7801, -47.9292];
  let map = null;
  let marker = null;
  let onSelect = null;
  let geocodeRequestId = 0;

  function showMessage(element, message) {
    element.innerHTML = `<div class="map-message">${message}</div>`;
  }

  function init(element, options = {}) {
    onSelect = options.onSelect;
    if (!window.L) {
      showMessage(element, 'Não foi possível carregar o mapa. Verifique sua conexão e recarregue a página.');
      return;
    }

    const coordinates = options.coordinates;
    const hasCoordinates = coordinates
      && Number.isFinite(coordinates.lat)
      && Number.isFinite(coordinates.lng)
      && coordinates.lat >= -90 && coordinates.lat <= 90
      && coordinates.lng >= -180 && coordinates.lng <= 180;
    const center = hasCoordinates ? [coordinates.lat, coordinates.lng] : defaultCenter;

    map = L.map(element).setView(center, hasCoordinates ? 16 : 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    if (hasCoordinates) placeMarker(center[0], center[1], false);
    map.on('click', event => placeMarker(event.latlng.lat, event.latlng.lng, true));
    setTimeout(() => map && map.invalidateSize(), 0);
  }

  function placeMarker(latitude, longitude, shouldGeocode) {
    if (!map) return;
    if (marker) marker.setLatLng([latitude, longitude]);
    else {
      marker = L.marker([latitude, longitude], { draggable: true }).addTo(map);
      marker.on('dragend', () => {
        const point = marker.getLatLng();
        publishLocation(point.lat, point.lng, true);
      });
    }

    map.setView([latitude, longitude], shouldGeocode ? 16 : map.getZoom());
    publishLocation(latitude, longitude, shouldGeocode);
  }

  function publishLocation(latitude, longitude, shouldGeocode) {
    const requestId = ++geocodeRequestId;
    onSelect?.({ latitude, longitude, address: '' });
    if (!shouldGeocode) return;

    fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&accept-language=pt-BR`, {
      headers: { Accept: 'application/json' },
    })
      .then(response => response.ok ? response.json() : null)
      .then(result => {
        if (result?.display_name && requestId === geocodeRequestId) {
          onSelect?.({ latitude, longitude, address: result.display_name });
        }
      })
      .catch(() => {});
  }

  function useCurrentLocation(onError) {
    if (!navigator.geolocation) {
      onError('Seu navegador não oferece geolocalização.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (map) placeMarker(coords.latitude, coords.longitude, true);
        else onSelect?.({ latitude: coords.latitude, longitude: coords.longitude, address: '' });
      },
      () => onError('Não foi possível acessar sua localização. Marque o ponto no mapa.'),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  }

  function destroy() {
    geocodeRequestId += 1;
    if (map) map.remove();
    map = null;
    marker = null;
    onSelect = null;
  }

  return { init, useCurrentLocation, destroy };
})();
