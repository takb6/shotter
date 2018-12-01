init();

function init() {
	'use strict';
	var editorLauncher = {
		onAdd: function () {
			$('#editor').show();
			var evt = window.document.createEvent('UIEvents'); 
			evt.initUIEvent('resize', true, false, window, 0); 
			window.dispatchEvent(evt);
		},
		onRemove: function () {
			$('#editor').hide();
			var evt = window.document.createEvent('UIEvents'); 
			evt.initUIEvent('resize', true, false, window, 0); 
			window.dispatchEvent(evt);
		}
	};

	var osm = L.tileLayer(
		'http://{s}.tile.osm.org/{z}/{x}/{y}.png',
		{ attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors' });

	var map = L.map('map', {
		center: [0, 0],
		zoom: 2,
		layers: [osm, editorLauncher]
	});

	map.doubleClickZoom.disable();

	var baseLayers = {
		"OpenStreetMap": osm,
	};

	var overlays = {
		"Editor": editorLauncher
	};

	L.control.layers(baseLayers, overlays).addTo(map);
	L.control.scale().addTo(map);


	var point = function () {
		this.name = ko.observable();
		this.lat = ko.observable();
		this.lon = ko.observable();
		this.isSelected = ko.observable();
	}

	var ViewModel = function () {
		var that = this;
		that.points = ko.observableArray();
		that.filter = ko.observable('');
		that.filteredPoints = ko.computed(function () {
			var filter = that.filter();
			if (!filter) {
				return that.points();
			} else {
				return ko.utils.arrayFilter(that.points(), function (item) {
					return item.name().match(filter);
				});
			}
		});
		that.removeAll = function() {
			while(that.filteredPoints().length > 0) {
				var p = that.filteredPoints()[0];
				removePoint(p);
			}
		}
		that.save = function () {
			var points = that.points();
			var data = [];
			for (var i = 0; i < points.length; i++) {
				data.push({
					name: points[i].name(),
					lat : points[i].lat(),
					lon : points[i].lon()
				});
			}
			var csv = Papa.unparse(data);
			save(csv);
		}
		var sortByPlace = 1;
		var sortByLat = 1;
		var sortByLon = 1;
		var sortDirection = 0;
		that.sort = function (e) {
			var getItem = null;
			if (e == 'place') {
				sortByPlace = -sortByPlace;
				sortDirection = sortByPlace;
				getItem = function (item) {
					return item.name();
				}
			} else if (e == 'lat') {
				sortByLat = -sortByLat;
				sortDirection = sortByLat;
				getItem = function (item) {
					return item.lat();
				}
			} else if (e == 'lon') {
				sortByLon = -sortByLon;
				sortDirection = sortByLon;
				getItem = function (item) {
					return item.lon();
				}
			}
			that.points.sort(function (right, left) {
				return getItem(left) == getItem(right)
					? 0 : (getItem(left) < getItem(right) ? 1 : sortDirection);
			});
		}
		that.exists = function (p) {
			for (var i = 0; i < that.points().length; i++) {
				var item = that.points()[i];
				if (item.lat() == p.lat() && item.lon() == p.lon()) {
					return true;
				}
			}
			return false;
		}
	}

	var viewModel = new ViewModel();

	$("#file").on('change', function (e) {
		Papa.parse(e.target.files[0], {
			header: true,
			complete: function (result) {
				for (var i = 0; i < result.data.length; i++) {
					var item = result.data[i];
					addMarker(item.name, item.lat, item.lon);
				}
				$("#file").after($("#file").clone(true));
				$("#file").remove();
			}
		});
	});

	function save(text) {
		var blob = new Blob([text], { type: "text/plain" });

		if (window.navigator.msSaveBlob) {
			window.navigator.msSaveBlob(blob, "ファイル名.txt");
		} else {
			var a = document.createElement("a");
			a.href = URL.createObjectURL(blob);
			a.target = '_blank';
			a.download = 'ファイル名.txt';
			a.click();
		}
	}

	function removePoint(p) {
		map.eachLayer(function(marker){
			if(marker.options)
				if(marker.options.point == p)
					map.removeLayer(marker);
		});
		viewModel.points.remove(p);
	}

	function addPoint(p) {
		viewModel.points.push(p);
	}

	map.on('click', function (e) {
		addMarker('', e.latlng.lat, e.latlng.lng);
	});

	function toLon(lng) {
		var lon = lng;
		while (lon < -180.0)
			lon = lon + 360.0;
		while (lon > 180.0)
			lon = lon - 360.0;
		return lon;
	}

	var addMarker = function (name, lat, lng) {

		if (isNaN(lat) | isNaN(lng)) {
			return;
		}

		lat = new Number(lat);
		lng = new Number(lng);

		lat = parseFloat(lat.toFixed(6));
		lng = parseFloat(lng.toFixed(6));

		function createPoint(lat, lon) {
			var p = new point();
			p.name(name)
			p.lat(lat);
			p.lon(lon);
			return p;
		}

		var lon = toLon(lng);

		var p = createPoint(lat, lon);
		if (viewModel.exists(p)) {
			return;
		}

		var marker = L.marker(new L.LatLng(lat, lon), {
			point: p
		}).addTo(map);

		var popupElement = document.createElement('div');
		popupElement.innerHTML =
			'<table class="editor-popup">' +
			'<tr>' +
			'<td>地名</td><td><input class="editor-popup-name" value="' + name + '"></td>' +
			'</tr>' +
			'<tr>' +
			'<td>緯度[°]</td><td><input class="editor-popup-lat" value="' + lat + '"></td>' +
			'</tr>' +
			'<tr>' +
			'<td>経度[°]</td><td><input class="editor-popup-lon" value="' + lon + '"></td>' +
			'</tr>' +
			'</table>' +
			'<div class="editor-popup-buttons">' +
			'<img src="images/icon_remove.svg" class="editor-popup-remove"/>' +
			'</div>'
			;

		p.name.subscribe(function(name){
			popupElement.getElementsByClassName("editor-popup-name")[0].value = name;
		});
		p.isSelected.subscribe(function(isSelected){
			if(isSelected) marker.openPopup();
		});

		var updatePosition = function () {
			return function (e) {
				var elements = popupElement.getElementsByTagName('input');
				var name = elements[0].value;
				var lat = parseFloat(elements[1].value);
				var lng = parseFloat(elements[2].value);
				if (isNaN(lat) | isNaN(lng)) {
					return;
				}
				lat = lat.toFixed(6);
				lng = lng.toFixed(6);

				var lon = toLon(lng);

				marker.options.point.name(name);
				marker.options.point.lat(lat);
				marker.options.point.lon(lon);
				marker.setLatLng(L.latLng(lat, lon));
			};
		};

		addPoint(marker.options.point);
		marker.bindPopup(popupElement).openPopup();
		marker.getPopup().on('open', function (e) {
			var elements = marker.getPopup().getContent().getElementsByTagName('input');
			var latlng = marker.getLatLng();
			var lat = latlng.lat;
			var lng = latlng.lng;
			elements[0].value = marker.options.point.name();
			elements[1].value = lat;
			elements[2].value = lng;
			elements = null;
			marker.options.circle = L.circle([lat, lng], 4000, {
				color: 'red',
				fillColor: '#f03',
				fillOpacity: 0.3
			}).addTo(map);
		});
		marker.getPopup().on('close', function (e) {
			if (!marker.options.circle) return;
			map.removeLayer(marker.options.circle);
		});

		if (!marker.options.point.name()) {
			var url = "https://nominatim.openstreetmap.org/reverse?format=json&lat=" + lat + "&lon=" + lon + "&zoom=18&addressdetails=1";
			$.ajax({
				url: url,
				dataType: "json",
				success: function (response) {
					var desc = "";
					if(response.display_name) {
						for(var item in response.address) {
							console.log(item);
						}

						desc = response.display_name;
					}
					marker.options.point.name(desc);
				}
			});
		}

		popupElement.getElementsByClassName('editor-popup-remove')[0].addEventListener('click', function (e) {
			removePoint(marker.options.point);
		}, false);
		popupElement.getElementsByTagName('input')[0].addEventListener('change', updatePosition());
		popupElement.getElementsByTagName('input')[1].addEventListener('change', updatePosition());
		popupElement.getElementsByTagName('input')[2].addEventListener('change', updatePosition());

	};

	ko.applyBindings(viewModel);

}
