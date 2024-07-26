
/* eslint-disable */

// Defined in tour.pug as following:
//  section.section-map
//  #map(data-locations=`${JSON.stringify(tour.locations)}`)
//  Whatever put into the attribute of 'data-locations' will be stored
// in 'dataset.locations', in this case is Stringified JSON format.

const displayMap = (locations) => { 
  var map = L.map('map', { zoomControl: false});  //to disable + - zoom
  // var map = L.map('map', { zoomControl: false }).setView([31.111745, -118.113491], );
   
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    crossOrigin: ""
  }).addTo(map);
   
  const points = [];
  locations.forEach((loc) => {
    points.push([loc.coordinates[1], loc.coordinates[0]]);
    L.marker([loc.coordinates[1], loc.coordinates[0]])
      .addTo(map)
      .bindPopup(`<p>Day ${loc.day}: ${loc.description}</p>`, { autoClose: false })
      .openPopup();
  });
   
  const bounds = L.latLngBounds(points).pad(0.5);
  map.fitBounds(bounds);
   
  map.scrollWheelZoom.disable();  //to disable zoom by mouse wheel
};

const mapBox = document.getElementById('map');

if(mapBox){ 
  const locations = JSON.parse(mapBox.dataset.locations);   
  displayMap(locations);
}