// USGS Earthquake Hazards Program web repository for usage guidance 
//     and for accessing several different time periods of recorded earthquake activity: 
//     https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php

// USGS Earthquake data for all earthquakes for the past 7 days (updated every minute):
let urlWeek  = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson"

// USGS Earthquake data for all earthquakes for the past 30 days (updated every minute):
let urlMonth = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson"


//------------------------------------------------------------------------------------------------------------  
// Function to create the overall map, including separate layers and legend
function createMap(earthquakes) {

    // Create the tile layers for the streetmap and topographical map backgrounds of our map.
    let mapLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });

    let topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
    });

    // Create a baseMaps object to hold the map layers.
    let baseMaps = {
        "Street Map": mapLayer,
        "Topographical Map": topoLayer
    };
    //--------------------------------------------------------------------------------------------------------
    // Function to transpose original coordinates for tectonic plates from [lng, lat] to [lat, lng]
    function transposeCoordinates(coords) {
        return coords.map(coord => [coord[1], coord[0]]);
    }

    // Fetch tectonic plates data and initialize the map; data obtained from https://github.com/fraxen/tectonicplates
    d3.json("resources/tectonicplates-master/GeoJSON/PB2002_plates.json").then(function(data) {
        let platePolygons = [];

        if (data && data.features && data.features.length > 0) {
            const features = data.features;

            for (let i = 0; i < features.length; i++){
                let feature = features[i];
                let coordinates = feature.geometry.coordinates[0];
                let txposedCoords = transposeCoordinates(coordinates);
                
                platePolygons.push(
                    L.polygon(
                        txposedCoords,
                        {
                            color: "orange",
                            weight: 5,
                            fillOpacity: 0
                        }
                    ).bindPopup("Plate name: <h3>" + feature.properties.PlateName + "</h3>")
                );
            }

            let plates = L.layerGroup(platePolygons);

            // Create an overlayMaps object to hold the earthquakes and tectonic plates layers.
            let overlayMaps = {
                "Tectonic Plates": plates,
                "Earthquakes": earthquakes                
            };

            // Establish the map after data has been loaded
            let myMap = L.map("map", {
                center: [44.966667, -103.766667], // Center of USA (incl. AK & HI) per https://www.usgs.gov/educational-resources/geographic-centers
                zoom: 3.5,
                layers: [mapLayer, topoLayer, plates, earthquakes]
            });

            // Add control layers to the map
            L.control.layers(baseMaps, overlayMaps, {collapsed: false}).addTo(myMap);
         // Add legend
         function getColor(depthValue) {
            return depthValue >= 90 ? "#A4F600": //green
                   depthValue >= 70 ? "#DDF403": //yellow
                   depthValue >= 50 ? "#F7DB12": //gold
                   depthValue >= 30 ? "#F9B72A": //orange
                   depthValue >= 10 ? "#F8A35D": //burnt orange
                                  "#F66066"; //red
        }

        var legend = L.control({position: 'bottomright'});

        legend.onAdd = function (map) {
            var div = L.DomUtil.create('div', 'info legend'),
            depths = [-10, 10, 30, 50, 70, 90],
            labels = ['<h4><u>Quake Depth (km)</u></h4>'];

            for (var i = 0; i < depths.length; i++) {
                div.innerHTML +=
                    labels.push(
                    '<i style="background:' + getColor(depths[i] + 1) + '"></i> ' +
                    depths[i] + (depths[i + 1] ? ' to <span>&lt;</span>' + depths[i + 1] + '<br>' : '+'));
            }
            div.innerHTML = labels.join('<br>');
            return div;
        };

        legend.addTo(myMap);
    } 
        
        //Error checks
        else {
            console.error("Data is not in the expected format or is empty.");
        }
    }).catch(function(error) {
        console.error("Failed to load tectonic plates data:", error);
    });
};

//------------------------------------------------------------------------------------------------------------  

//Function to create the circle markers for each reported earthquake event, including size of circle determined
//     by magnitude of the quake and fill color of the circle based on depth measurement of the quake.
function createMarkers(response) {

    // Pull the "features" property from response.
    let features = response.features;

    // Initialize an array to hold earthquake epicenter markers.
    let epicenterMarkers = [];

    // Loop through the features array.
    for (let index = 0; index < features.length; index++) {
        let feature      = features[index];

        let coordinates  = feature.geometry.coordinates; // [longitude, latitude, magnitude]
        let depth        = coordinates[2];

        let place        = feature.properties.place;
        let magnitude    = feature.properties.mag;
        let unixDatetime = feature.properties.time;

        // Convert unixDatetime to UTC normalized format
        let formatTime = d3.timeFormat("%B %d, %Y at %I:%M%p UTC")
        let dateTime     = formatTime(new Date(unixDatetime));

        // For each earthquake, create a marker, and bind a popup with the earthquake's place and magnitude.      
        //Function to set marker size for given earthquake instance
        function markerSize(magnitude) {
        return magnitude * 25000;
        }

        //Filter to set fillColor for given earthquake instance based on depth. See notes after 'Add legend' above.
            // Conditionals for earthquake depth
            let filterColor = "";
            if (depth >= 90) {
                filterColor = "#A4F600"; //green
                }
            else if (depth >= 70) {
                filterColor = "#DDF403"; //yellow
                }
            else if (depth >= 50) {
                filterColor = "#F7DB12"; //gold
                }
            else if (depth >= 30) {
                filterColor = "#F9B72A"; //orange
                }   
            else if (depth >= 10) {
                filterColor = "#F8A35D"; //burnt orange
                }   
            else {
                filterColor = "#F66066"; //red
                }

        //Build of each earthquake marker using coordinate data from the selected feature
        let epicenterMarker = L.circle([coordinates[1], coordinates[0]],{
        fillOpacity: 0.75,
        color: "black",
        weight: 0.5,
        fillColor: filterColor,
        // Setting our circle's radius to equal the output of our markerSize() function:
        // This will make our marker's size proportionate to its magnitude.
        radius: markerSize(magnitude)        
        })
        .bindPopup("Location: <h3>" + place 
                    + "</h3>Date: <h3>" + dateTime 
                    + "</h3>Magnitude: <h3>" + magnitude 
                    + "</h3>Depth (km): <h3>" + depth +"</h3>");

        // Add the marker to the epicenterMarkers array.
        epicenterMarkers.push(epicenterMarker);
    }

    // Create a layer group that's made from the epicenterMarkers array, and pass it to the createMap function.
    createMap(L.layerGroup(epicenterMarkers))
}

//------------------------------------------------------------------------------------------------------------
// Perform an D3 JSON call to the USGS repo to get the earthquake information. Call createMarkers when it completes.
d3.json(urlWeek).then(createMarkers);