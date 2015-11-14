/* General TODOs:
 *    Show place data on selection
 *    Add No Results message if search does not match any items
 *    Implement localstorage to cache data and store favorites etc.
 *    Implement request fail handling for Google API requests
 *    Find a way to style markers for more than just selection (Udacity stretch goal)
 *    Animate place marker on selection (Udacity requirement)
 *    Get expanded data from Google Places when selected
 *    Implement "favorite" button for places
 *    Implement at least two other APIs for additional data (possibilities: Yelp, Instagram, Foursquare, Wikipedia), with request fail handling
 *    Implement paging of Google Place search results to show more places
 *    Keyboard shortcuts for search (Udacity stretch goal)
 *    Search other fields with search (Udacity stretch goal)
 *    Autocomplete for search?
 *    Save places to Google Maps from this page?
 */

var model = {
	'googleMapSettings': {
		centerLat: 30.287798,
		centerLng: -97.742345,
		zoom: 16,
		searchBoundingBoxCoords: {
			sw: {lat: 30.282309, lng: -97.742694},
			ne: {lat: 30.291971, lng: -97.741153}
		},
	},
	'googleSearchTypes': ['bakery', 'bar', 'cafe', 'restaurant'],
	'places': {},

	addPlace: function(google_id, data) {
		if (this.places[google_id] !== undefined) return false;
		if (data === undefined) data = {};

		if(data.googleData.name) data.placeName = data.googleData.name;
		else data.placeName = 'NONAME!';

		data.id = google_id;

		this.places[google_id] = data;

		return true;
	},

	updatePlaceData: function(id, data) {
		// TODO: write function
	}
}



var viewModel = function() {
	var self = this;

	this.places = ko.observableArray();
	this.selectedPlace = ko.observable(null);
	this.searchTerm = ko.observable('');

	this.init = function() {
		this.initGoogleMap();
		this.searchGooglePlaces();
	};

	this.decorateModelPlaceData = function(data) {
		data.selected = ko.pureComputed(function() {
			if (data.id == self.selectedPlace()) return true;
			else return false;
		}, this);

		data.visible = ko.pureComputed(function() {
			var searchTerm = self.searchTerm().toLowerCase();
			var name = data.placeName.toLowerCase();

			if (!searchTerm || data.selected()) return true;
			else if (name.indexOf(searchTerm) > -1) return true;
			else return false;
		});

		var location = data.googleData.geometry.location;

		data.googleMapMarker = new google.maps.Marker({
			map: self.googleMap,
			//position: location,
			place: {location: location, placeId: data.googleData.id},
			title: data.placeName,
			visible: data.visible()
		});
		data.googleMapMarker.addListener('click', function(event) {
			self.selectedPlace(this.place.placeId);
		});

		data.visible.subscribe(function(visibility) {
			data.googleMapMarker.setVisible(visibility);
		});

		return data;
	}

	this.populatePlaces = function() {
		var places_array = [];
		for (var place_id in model.places) {
			if (model.places.hasOwnProperty(place_id)) {
				var data = this.decorateModelPlaceData(model.places[place_id]);
				places_array.push(data);
			}
		}
		self.places(places_array);
		ko.applyBindings(self);
	};

	this.parseGoogleSearchResults = function(results, status, pagination) {
		// TODO: Page through additonal results, if present
		//console.log(pagination);
		if (status == google.maps.places.PlacesServiceStatus.OK) {
			//console.log(results);
			if (model.places.length > 0) {
				// Updating data from Google
				console.log('Update from google maps search');
			}
			else {
				// Initializing data from Google
				for (var i = 0; i < results.length; i++) {
					var data = {'googleData': results[i]};
					model.addPlace(results[i].id, data);
				}

				self.populatePlaces();
			}
		}
	};

	this.searchGooglePlaces = function() {
		var bounding_box_sw = new google.maps.LatLng(model.googleMapSettings.searchBoundingBoxCoords.sw.lat, model.googleMapSettings.searchBoundingBoxCoords.sw.lng);
		var bounding_box_ne = new google.maps.LatLng(model.googleMapSettings.searchBoundingBoxCoords.ne.lat, model.googleMapSettings.searchBoundingBoxCoords.ne.lng);
		var bounding_box = new google.maps.LatLngBounds(bounding_box_sw, bounding_box_ne);
		var request = {
			bounds: bounding_box,
			types: model.googleSearchTypes
		};

		var service = new google.maps.places.PlacesService(this.googleMap);
		service.nearbySearch(request, this.parseGoogleSearchResults);
	};

	this.getGoogleMapCenterCoords = function() {
		return [model.googleMapSettings.centerLat, model.googleMapSettings.centerLng];
	};

	this.getGoogleMapZoomLevel = function() {
		return model.googleMapSettings.zoom;
	};
	
	this.initGoogleMap = function() {
		var google_map_center_coords = this.getGoogleMapCenterCoords();
		var google_map_init_settings = {
			center: new google.maps.LatLng(google_map_center_coords[0], google_map_center_coords[1]),
			zoom: this.getGoogleMapZoomLevel()
		};

		this.googleMap = new google.maps.Map(document.getElementById('map'), google_map_init_settings);
	};

	this.selectPlace = function(place) {
		currentPlace = self.selectedPlace();
		if (currentPlace != place.id) {
			self.selectedPlace(place.id);
		}
	}
}



dragVM = new viewModel();