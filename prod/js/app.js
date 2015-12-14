var model={googleMapSettings:{centerLat:30.287798,centerLng:-97.742345,zoom:16,searchBoundingBoxCoords:{sw:{lat:30.282309,lng:-97.742694},ne:{lat:30.291971,lng:-97.741153}}},googleSearchTypes:["bakery","bar","cafe","restaurant"],places:{},init:function(){var e=localStorage.getItem("dragMapPlaces");e&&(e=JSON.parse(e),this.places=e)},saveData:function(){var e=jQuery.extend(!0,{},this.places);for(var a in e)e.hasOwnProperty(a)&&delete e[a].googleData;localStorage.setItem("dragMapPlaces",JSON.stringify(e))},addPlace:function(e,a,o){return void 0===e||void 0!==this.places[e]||void 0===a?!1:(void 0===o&&(o={}),o.placeName=a,o.id=e,this.places[e]=o,this.saveData(),!0)},updatePlace:function(e,a,o){if(void 0===this.places[e])return!1;void 0===o&&(o=!1);var t=!1;for(var l in a)if(a.hasOwnProperty(l)){if(this.places[e].hasOwnProperty(l)&&!o)return 2;this.places[e][l]=a[l],t=!0}return t&&this.saveData(),!0},checkUpdateDate:function(e,a,o){void 0===o&&(o=12);var t=36e5*o,l=new Date-this.places[e][a].receivedDate;return l>t?!0:!1}},viewModel=function(){var e=this;this.doneLoading=ko.observable(!1),this.places=ko.observableArray(),this.sortedPlaces=ko.computed(function(){return e.places().sort(function(e,a){return e.openNow()==a.openNow()?e.placeName==a.placeName?0:e.placeName<a.placeName?-1:1:e.openNow()>a.openNow()?-1:1})}),this.selectedPlace=ko.observable(null),this.searchTerm=ko.observable(""),this.pendingGooglePlaceRequests=ko.observableArray(),this.pendingWikipediaRequests=ko.observableArray(),this.loadingData=ko.computed(function(){return e.pendingGooglePlaceRequests().length+e.pendingWikipediaRequests().length>0?!0:!1}),this.init=function(){model.init(),this.initGoogleMap(),this.searchGooglePlaces()},this.initView=function(){e.populatePlaces(),e.placesVisible=ko.computed(function(){for(var a=e.places(),o=0,t=a.length,l=0;t>l;l++)a[l].visible()&&o++;return o}),ko.applyBindings(e),e.doneLoading(!0)},this.decorateModelPlaceData=function(a){a=jQuery.extend(!0,{},a),a.selected=ko.pureComputed(function(){return a.id==e.selectedPlace()?!0:!1},this),a.visible=ko.pureComputed(function(){var o=e.searchTerm().toLowerCase(),t=a.placeName.toLowerCase();return o?t.indexOf(o)>-1?!0:!1:!0}),a.googleData.opening_hours&&a.googleData.opening_hours.open_now?a.openNow=ko.observable(!0):a.openNow=ko.observable(!1),a.googleRating=ko.observable(!1),a.googleWebsite=ko.observable(!1),a.googleMapsURL=ko.observable(!1),a.wikipediaArticles=ko.observableArray(),a.noData=ko.computed(function(){return this.googleRating()||this.googleWebsite()||this.wikipediaArticles().length||e.pendingGooglePlaceRequests().indexOf(this.id)>-1||e.pendingWikipediaRequests().indexOf(this.id)>-1?!1:!0},a);var o=a.googleData.geometry.location,t={map:e.googleMap,place:{location:o,placeId:a.id},title:a.placeName,visible:a.visible()};return a.openNow()||(t.icon={size:new google.maps.Size(48,48),url:"img/blue_marker.png"}),a.googleMapMarker=new google.maps.Marker(t),a.googleMapMarker.addListener("click",function(a){e.selectedPlace(this.place.placeId)}),a.googleInfoWindow=new google.maps.InfoWindow({content:""}),a.googleInfoWindow.addListener("closeclick",function(a){e.selectedPlace(null)}),a.visible.subscribe(function(o){!o&&a.selected()&&e.selectPlace(null),a.googleMapMarker.setVisible(o)}),a.selected.subscribe(function(o){o?(a.oldMapMarkerIcon=a.googleMapMarker.getIcon(),a.googleMapMarker.setIcon({size:new google.maps.Size(42,42),url:"img/marker_pin.png"}),a.googleMapMarker.setAnimation(google.maps.Animation.BOUNCE),setTimeout(function(){a.googleMapMarker.setAnimation(null)},2100),a.googleInfoWindow.setContent(jQuery("#iw-"+a.id).html()),a.googleInfoWindow.open(e.googleMap,a.googleMapMarker)):(a.googleMapMarker.setAnimation(null),a.googleMapMarker.setIcon(a.oldMapMarkerIcon),a.googleInfoWindow.close())}),a},this.populatePlaces=function(){var a=[];for(var o in model.places)if(model.places.hasOwnProperty(o)){var t=this.decorateModelPlaceData(model.places[o]);a.push(t)}e.places(a)},this.updatePlace=function(a){if(model.places[a]&&(-1!==e.pendingGooglePlaceRequests().indexOf(a)||model.places[a].googlePlaceData&&!model.checkUpdateDate(a,"googlePlaceData")||e.detailGooglePlace(a),-1===e.pendingWikipediaRequests().indexOf(a)&&(!model.places[a].wikipediaData||model.checkUpdateDate(a,"wikipediaData")))){e.pendingWikipediaRequests.push(a);var o="https://en.wikipedia.org/w/api.php",t={data:"action=opensearch&search="+model.places[a].placeName+"&format=json",dataType:"jsonp"};$.ajax(o,t).done(function(o,t,l){e.parseWikipediaRequest(o,t,l,a)}).fail(function(o,t,l){alert("Connection to Wikipedia failed, please try again later.");var i=e.pendingWikipediaRequests().indexOf(a);i>-1&&e.pendingWikipediaRequests.splice(i,1)})}places=e.places();for(var l=0;l<=places.length;l++){if(l==places.length){l=!1;break}if(places[l].id==a)break}if(l!==!1&&model.places[a]){var i=model.places[a];return i.googlePlaceData&&(i.googlePlaceData.rating&&places[l].googleRating(i.googlePlaceData.rating.toFixed(1)),i.googlePlaceData.website&&places[l].googleWebsite(i.googlePlaceData.website),i.googlePlaceData.url&&places[l].googleMapsURL(i.googlePlaceData.url)),i.wikipediaData&&i.wikipediaData.articles&&places[l].wikipediaArticles(i.wikipediaData.articles),places[l].googleInfoWindow.setContent(jQuery("#iw-"+places[l].id).html()),!0}return!1},this.parseWikipediaRequest=function(a,o,t,l){if(a.error)alert("Wikipedia error: "+a.error.code+"\n"+a.error.info);else{var i=[],s=[],n=[],r=[];a.length&&(i=a[1],s=a[2],n=a[3]);for(var g=0;g<i.length&&3>g;g++)r[g]={name:i[g],excerpt:s[g],url:n[g]};var c={wikipediaData:{articles:r,dateReceived:new Date}};model.updatePlace(l,c,!0),e.updatePlace(l)}var p=e.pendingWikipediaRequests.indexOf(l);p>-1&&e.pendingWikipediaRequests.splice(p,1)},this.parseGoogleDetailRequest=function(a,o,t){if(o==google.maps.places.PlacesServiceStatus.OK){for(var l=["place_id","formatted_address","formatted_phone_number","price_level","rating","url","website"],i={},s=0;s<l.length;s++)a.hasOwnProperty(l[s])&&(i[l[s]]=a[l[s]]);i.dateReceived=new Date,model.updatePlace(a.place_id,{googlePlaceData:i},!0),e.updatePlace(t)}else o==google.maps.places.PlacesServiceStatus.OVER_QUERY_LIMIT?alert("Google maps data could not be loaded because this page has gone over its query limit. Please try again later."):o==google.maps.places.PlacesServiceStatus.INVALID_REQUEST?alert("ERROR: Google Maps received an invalid request."):o==google.maps.places.PlacesServiceStatus.ZERO_RESULTS?alert("ERROR: Google Maps did not find any restaurants."):o==google.maps.places.PlacesServiceStatus.UNKNOWN_ERROR?alert("ERROR: Google Maps encountered an unknown error."):alert("ERROR: Unknown status recevied from Google Maps");var n=e.pendingGooglePlaceRequests().indexOf(t);n>-1&&e.pendingGooglePlaceRequests.splice(n,1)},this.parseGoogleSearchResults=function(a,o,t){if(o==google.maps.places.PlacesServiceStatus.OK){for(var l=0;l<a.length;l++)if(!a[l].permanently_closed){var i=a[l].place_id,s={googleData:a[l]};void 0===model.places[i]?model.addPlace(i,a[l].name,s):model.updatePlace(i,s,!1)}}else o==google.maps.places.PlacesServiceStatus.OVER_QUERY_LIMIT?alert("Google maps data could not be loaded because this page has gone over its query limit. Please try again later."):o==google.maps.places.PlacesServiceStatus.INVALID_REQUEST?alert("ERROR: Google Maps received an invalid request."):o==google.maps.places.PlacesServiceStatus.ZERO_RESULTS?alert("ERROR: Google Maps did not find any restaurants."):o==google.maps.places.PlacesServiceStatus.UNKNOWN_ERROR?alert("ERROR: Google Maps encountered an unknown error."):alert("ERROR: Unknown status recevied from Google Maps");t.hasNextPage?t.nextPage():e.initView()},this.searchGooglePlaces=function(){var a=new google.maps.LatLng(model.googleMapSettings.searchBoundingBoxCoords.sw.lat,model.googleMapSettings.searchBoundingBoxCoords.sw.lng),o=new google.maps.LatLng(model.googleMapSettings.searchBoundingBoxCoords.ne.lat,model.googleMapSettings.searchBoundingBoxCoords.ne.lng),t=new google.maps.LatLngBounds(a,o),l={bounds:t,types:model.googleSearchTypes};e.googlePlacesService.nearbySearch(l,this.parseGoogleSearchResults)},this.detailGooglePlace=function(a){if(model.places.hasOwnProperty(a)){var o={placeId:a};e.googlePlacesService.getDetails(o,function(o,t){e.parseGoogleDetailRequest(o,t,a)})}},this.getGoogleMapCenterCoords=function(){return[model.googleMapSettings.centerLat,model.googleMapSettings.centerLng]},this.getGoogleMapZoomLevel=function(){return model.googleMapSettings.zoom},this.initGoogleMap=function(){var e=this.getGoogleMapCenterCoords(),a={center:new google.maps.LatLng(e[0],e[1]),zoom:this.getGoogleMapZoomLevel()};this.googleMap=new google.maps.Map(document.getElementById("map"),a),this.googlePlacesService=new google.maps.places.PlacesService(this.googleMap)},this.selectPlace=function(a){currentPlace=e.selectedPlace(),a&&a.id&&currentPlace!=a.id?(e.updatePlace(a.id),e.selectedPlace(a.id)):e.selectedPlace(null)}};dragVM=new viewModel;