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

	init: function() {
		var storedPlaces = localStorage.getItem('dragMapPlaces');
		if (storedPlaces) {
			storedPlaces = JSON.parse(storedPlaces);
			this.places = storedPlaces;
		}
	},

	saveData: function() {
		var saveData = jQuery.extend(true, {}, this.places);
		for (var aPlace in saveData) {
			if (saveData.hasOwnProperty(aPlace)) {
				delete saveData[aPlace].googleData;
			}
		}
		localStorage.setItem('dragMapPlaces', JSON.stringify(saveData));
	},

	addPlace: function(google_id, name, data) {
		if (this.places[google_id] !== undefined) return false;
		if (data === undefined) data = {};

		if(name !== undefined) data.placeName = name;
		else data.placeName = 'NONAME!';

		data.id = google_id;

		this.places[google_id] = data;

		this.saveData();

		return true;
	},

	updatePlace: function(id, data, overwrite) {
		if (this.places[id] === undefined) return false;
		if (overwrite === undefined) overwrite = false;

		var changed = false;

		for (var dataName in data) {
			if (data.hasOwnProperty(dataName)) {
				if (this.places[id].hasOwnProperty(dataName) && !overwrite) {
					return 2;
				}
				else {
					this.places[id][dataName] = data[dataName];
					changed = true;
				}
			}
		}

		if (changed) this.saveData();

		return true;
	},
	
	checkUpdateDate: function(id, property, hours) {
		if (hours === undefined) {
			hours = 12;
		}

		var time_threshold = hours * 3600000;
		var time_since_update = new Date() - this.places[id][property].receivedDate;

		if (time_since_update > time_threshold) return true;
		else return false;
	}
}



var viewModel = function() {
	var self = this;

	this.doneLoading = ko.observable(false);
	this.places = ko.observableArray();
	this.sortedPlaces = ko.computed(function() {
		return self.places().sort(function(left, right) {
			return left.placeName == right.placeName ? 0 : (left.placeName < right.placeName ? -1 : 1)
		});
	});
	this.selectedPlace = ko.observable(null);
	this.searchTerm = ko.observable('');
	this.pendingGooglePlaceRequests = [];
	this.pendingWikipediaRequests = [];

	this.init = function() {
		model.init();
		this.initGoogleMap();
		this.searchGooglePlaces();
	};

	this.initView = function() {
		self.populatePlaces();
		self.placesVisible = ko.computed(function() {
			var places = self.places();
			var visible = 0;
			var numPlaces = places.length;

			for (var p = 0; p < numPlaces; p++) {
				if (places[p].visible()) {
					visible++;
				}
			}

			return visible;
		});
		ko.applyBindings(self);

		self.doneLoading(true);
	};

	this.decorateModelPlaceData = function(data) {
		data = jQuery.extend(true, {}, data);

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

		if (data.googleData.opening_hours && data.googleData.opening_hours.open_now) data.openNow = ko.observable(true);
		else data.openNow = ko.observable(false);
		data.googleRating = ko.observable(false);
		data.googleWebsite = ko.observable(false);
		data.googleMapsURL = ko.observable(false);
		data.wikipediaArticles = ko.observableArray();

		var location = data.googleData.geometry.location;

		var mapMarkerOptions = {
			map: self.googleMap,
			place: {location: location, placeId: data.id},
			title: data.placeName,
			visible: data.visible()
		};
		if (!data.openNow()) {
			mapMarkerOptions.icon = {size: new google.maps.Size(48, 48), url: 'img/blue_marker.png'};
		}
		
		data.googleMapMarker = new google.maps.Marker(mapMarkerOptions);
		
		data.googleMapMarker.addListener('click', function(event) {
			self.selectedPlace(this.place.placeId);
		});

		data.googleInfoWindow = new google.maps.InfoWindow({
			content: ''
		});
		data.googleInfoWindow.addListener('closeclick', function(event) {
			self.selectedPlace(null);
		})

		data.visible.subscribe(function(visibility) {
			data.googleMapMarker.setVisible(visibility);
		});

		data.selected.subscribe(function(selected) {
			if (selected) {
				data.oldMapMarkerIcon = data.googleMapMarker.getIcon();
				data.googleMapMarker.setIcon({size: new google.maps.Size(42, 42), url: 'img/marker_pin.png'});
				data.googleMapMarker.setAnimation(google.maps.Animation.BOUNCE);
				setTimeout(function() {
					data.googleMapMarker.setAnimation(null);
				}, 2100);
				data.googleInfoWindow.setContent(jQuery('#iw-' + data.id).html());
				data.googleInfoWindow.open(self.googleMap, data.googleMapMarker);
			}
			else {
				data.googleMapMarker.setAnimation(null);
				data.googleMapMarker.setIcon(data.oldMapMarkerIcon);
				data.googleInfoWindow.close();
			}
		});

		return data;
	}

	this.updatePlace = function(place_id) {
		if (model.places[place_id]) {
			// Call for detail update(s), unless data is recently cached
			if (self.pendingGooglePlaceRequests.indexOf(place_id) === -1 &&
				(!model.places[place_id].googlePlaceData ||
				 model.checkUpdateDate(place_id, 'googlePlaceData')))
			{
				self.detailGooglePlace(place_id);
			}
			if (self.pendingWikipediaRequests.indexOf(place_id) === -1 &&
				(!model.places[place_id].wikipediaData ||
				 model.checkUpdateDate(place_id, 'wikipediaData')))
			{
				self.pendingWikipediaRequests.push(place_id);
				var wikipedia_url = 'https://en.wikipedia.org/w/api.php';
				var wikipedia_query_settings = {
					data: 'action=opensearch&search=' + model.places[place_id].placeName + '&format=json',
					dataType: 'jsonp'
				};

				$.ajax(wikipedia_url, wikipedia_query_settings).done(function(data, status, XHR) {
					self.parseWikipediaRequest(data, status, XHR, place_id);
				}).fail(function(XHR, status, error) {
					alert('Connection to Wikipedia failed, please try again later.');

					var pending_index = self.pendingWikipediaRequests.indexOf(place_id);
					if (pending_index > -1) self.pendingWikipediaRequests.splice(pending_index, 1);
				});
			}
		}

		places = self.places();

		for (var p = 0; p <= places.length; p++) {
			if (p == places.length) {
				p = false;
				break;
			}
			else if (places[p].id == place_id) {
				break;
			}
		}

		if (p !== false) {
			if (model.places[place_id]) {
				var model_data = model.places[place_id];
				if (model_data.googlePlaceData) {
					if (model_data.googlePlaceData.rating) places[p].googleRating(model_data.googlePlaceData.rating.toFixed(1));
					if (model_data.googlePlaceData.website) places[p].googleWebsite(model_data.googlePlaceData.website);
					if (model_data.googlePlaceData.url) places[p].googleMapsURL(model_data.googlePlaceData.url);
				}
				if (model_data.wikipediaData) {
					if (model_data.wikipediaData.articles) {
						places[p].wikipediaArticles(model_data.wikipediaData.articles);
					}
				}

				places[p].googleInfoWindow.setContent(jQuery('#iw-' + places[p].id).html());   // Update popup window
				return true;
			}
		}

		return false;
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
	};

	this.parseWikipediaRequest = function(data, status, XHR, place_id) {
		if (data.error) {
			alert('Wikipedia error: ' + data.error.code + "\n" +
				  data.error.info);
		}
		else {
			if (data.length) {
				var names = data[1];
				var excerpts = data[2];
				var urls = data[3];
			}
			var articles = [];
			for (var a = 0; a < names.length && a < 3; a++) {
				articles[a] = ({name: names[a], excerpt: excerpts[a], url: urls[a]});
			}
			var model_data = {wikipediaData: {articles: articles, dateReceived: new Date()}};

			model.updatePlace(place_id, model_data, true);
			self.updatePlace(place_id);
		}

		var pending_index = self.pendingWikipediaRequests.indexOf(place_id);
		if (pending_index > -1) self.pendingWikipediaRequests.splice(pending_index, 1);
	}
	
	this.parseGoogleDetailRequest = function(place, status, placeId) {
		if (status == google.maps.places.PlacesServiceStatus.OK) {
			var props_to_keep = ['place_id', 'formatted_address', 'formatted_phone_number', 'price_level', 'rating', 'url', 'website'];
			var data = {};
			for (var p = 0; p < props_to_keep.length; p++) {
				if (place.hasOwnProperty(props_to_keep[p])) {
					data[props_to_keep[p]] = place[props_to_keep[p]];
				}
			}
			data.dateReceived = new Date();
			model.updatePlace(place.place_id, {googlePlaceData: data}, true);
			self.updatePlace(placeId);
		}
		else if (status == google.maps.places.PlacesServiceStatus.OVER_QUERY_LIMIT) alert('Google maps data could not be loaded because this page has gone over its query limit. Please try again later.');
		else if (status == google.maps.places.PlacesServiceStatus.INVALID_REQUEST) alert('ERROR: Google Maps received an invalid request.');
		else if (status == google.maps.places.PlacesServiceStatus.ZERO_RESULTS) alert('ERROR: Google Maps did not find any restaurants.');
		else if (status == google.maps.places.PlacesServiceStatus.UNKNOWN_ERROR) alert('ERROR: Google Maps encountered an unknown error.');
		else alert('ERROR: Unknown status recevied from Google Maps');

		var pending_index = self.pendingGooglePlaceRequests.indexOf(placeId);
		if (pending_index > -1) self.pendingGooglePlaceRequests.splice(pending_index, 1);
	}

	this.parseGoogleSearchResults = function(results, status, pagination) {
		if (status == google.maps.places.PlacesServiceStatus.OK) {
			for (var i = 0; i < results.length; i++) {
				if (!results[i].permanently_closed) {
					var google_id = results[i].place_id;
					var data = {'googleData': results[i]};

					if (model.places[google_id] === undefined) {
						model.addPlace(google_id, results[i].name, data);
					}
					else {
						// Update data, if it isn't already there
						model.updatePlace(google_id, data, false);
					}
				}
			}
		}
		else if (status == google.maps.places.PlacesServiceStatus.OVER_QUERY_LIMIT) alert('Google maps data could not be loaded because this page has gone over its query limit. Please try again later.');
		else if (status == google.maps.places.PlacesServiceStatus.INVALID_REQUEST) alert('ERROR: Google Maps received an invalid request.');
		else if (status == google.maps.places.PlacesServiceStatus.ZERO_RESULTS) alert('ERROR: Google Maps did not find any restaurants.');
		else if (status == google.maps.places.PlacesServiceStatus.UNKNOWN_ERROR) alert('ERROR: Google Maps encountered an unknown error.');
		else alert('ERROR: Unknown status recevied from Google Maps');

		// Page through additonal results if present, otherwise tell viewModel to finish initialization
		if (pagination.hasNextPage) {
			pagination.nextPage();
		}
		else {
			self.initView();
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

		self.googlePlacesService.nearbySearch(request, this.parseGoogleSearchResults);
	};
	
	this.detailGooglePlace = function(placeId) {
		if (model.places.hasOwnProperty(placeId)) {
			var request = {placeId: placeId};
			self.googlePlacesService.getDetails(request, function(place, status) {
				self.parseGoogleDetailRequest(place, status, placeId);
			});
		}
	}

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
		this.googlePlacesService = new google.maps.places.PlacesService(this.googleMap);
	};

	this.selectPlace = function(place) {
		currentPlace = self.selectedPlace();
		if (currentPlace != place.id) {
			self.updatePlace(place.id);
			self.selectedPlace(place.id);
		}
		else {
			self.selectedPlace(null);
		}
	}
}



dragVM = new viewModel();