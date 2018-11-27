init();

function init() {
	'use strict';
	var editorLauncher = {
		onAdd : function() {
			$('#editor').show();
		},
		onRemove : function() {
			$('#editor').hide();
		}
	};

	var osm = L.tileLayer(
				'http://{s}.tile.osm.org/{z}/{x}/{y}.png', 
				{ attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors' });

	var map = L.map('map', {
		center: [39.73, -104.99],
		zoom: 10,
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


	var point = function(){
		this.name = ko.observable(),
		this.lat	= ko.observable(),
		this.lon	= ko.observable()
	}

	var ViewModel = function() {
		var that = this;
		that.points = ko.observableArray();
		that.filter = ko.observable('');
	    that.filteredPoints = ko.computed(function() {
	        var filter = that.filter();
	        if (!filter) {
	            return that.points();
	        } else {
	            return ko.utils.arrayFilter(that.points(), function(item) {
	                return filter.match(item.name());
	            });
	        }
	    });
		that.save = function() {
			var points = that.points();
			var data = [];
			for(var i = 0; i < points.length; i++){
				data.push({
					name : points[i].name(),
					lat  : points[i].lat(),
					lon  : points[i].lon()
				});
			}
			var csv = Papa.unparse(data);
			save(csv);
		}
		that.sort = function(e){
			var getItem = null;
			if(e == 'place') {
				getItem = function(item) {
					return item.name();
				}
			} else if(e == 'lat') {
				getItem = function(item) {
					return item.lat();
				}
			} else if(e == 'lon') {
				getItem = function(item) {
					return item.lon();
				}
			}
			that.points.sort(function(right, left){
			    return getItem(left) == getItem(right)
			        ? 0 : (getItem(left) < getItem(right) ? 1 : -1);
			});
		}
		that.exists = function(p){
			for(var i = 0; i < that.points().length; i++) {
				var item = that.points()[i];
				if(item.name() == p.name() && item.lat() == p.lat() && item.lon() == p.lon()) {
					return true;
				}
			}
			return false;
		}
	}

	var viewModel = new ViewModel();


	$("#file").on('change', function(e) {
		Papa.parse(e.target.files[0], {
			header : true,
			complete : function(result) {
				for(var i = 0 ; i < result.data.length; i++) {
					var item = result.data[i];
					addMarker(item.name, item.lat, item.lon);
				}
				$("#file").after($("#file").clone(true));
				$("#file").remove();
			}
		});
	});

	function save(text){
		var blob = new Blob([text], {type: "text/plain"}); // バイナリデータを作ります。

		if(window.navigator.msSaveBlob){
		    window.navigator.msSaveBlob(blob, "ファイル名.txt");
		} else {
		    var a = document.createElement("a");
		    a.href = URL.createObjectURL(blob);
		    a.target = '_blank';
		    a.download = 'ファイル名.txt';
		    a.click();
		}		
	}

	function removePoint(p){
		viewModel.points.remove(p);
	}

	function addPoint(p) {
		viewModel.points.push(p);
	}

	map.on('dblclick', function(e) { 
		addMarker('', e.latlng.lat, e.latlng.lng); 
	});


	var isAdding = false;
	var addMarker = function(name, lat, lng){
		if (isNaN(lat) | isNaN(lng) | isAdding){
			return;
		}
		isAdding = true;

		function createPoint(lat, lon){
			var p = new point();
			p.name(name)
			p.lat(lat);
			p.lon(lon);
			return p;
		}

		var p = createPoint(lat, lng);

		if(viewModel.exists(p)) {
			return;
		}


		var marker = L.marker(new L.LatLng(lat, lng), {
			draggable: true,
			shotpoint: p
		}).addTo(map);

		marker.name = name;
		var popupElement = document.createElement('div');
		popupElement.innerHTML = 
				'<table class="llaselecter-marker-position">' +
				'<tr>' +
					'<td>地名</td><td><input class="llaselecter-map-station" value="' + marker.name + '"></td>' + 
				'</tr>' + 
				'<tr>' +
					'<td>緯度[°]</td><td><input class="llaselecter-map-latitude" value="' + marker._latlng.lat + '"></td>' + 
				'</tr>' + 
				'<tr>' +
					'<td>経度[°]</td><td><input class="llaselecter-map-longitude" value="' + marker._latlng.lng + '"></td>' + 
				'</tr>' + 
				'</table>' + 
				'<div class="llaselecter-map-buttons">' + 
				'<button class="button-change">了解</button>' + 
				'<button class="button-delete">削除</button>' +
				'<button class="button_cancel">取消</button>' +
				'</div>'
				;
			
		var updatePosition = function(){
			return function(e){
				var srcElement = null;
				if (document.all){
					srcElement = e.srcElement;
				} else {
					srcElement = e.target;
				}
				var elements = null;
				if (e instanceof KeyboardEvent){
					if(e.keyCode !== 13) {
						return;
					}
					elements = srcElement
							.parentNode
							.parentNode
							.parentNode
							.parentNode
							.getElementsByTagName('input');
				} else if(e instanceof MouseEvent){
					elements = srcElement
							.parentNode
							.parentNode
							.getElementsByTagName('input');
				}
					var lat = parseFloat(elements[1].value);
					var lng = parseFloat(elements[2].value);
					if (isNaN(lat) | isNaN(lng)){
						return;
					}
					marker.name = elements[0].value;
					marker.options.shotpoint.name(marker.name);
					marker.options.shotpoint.lat(lat);
					marker.options.shotpoint.lon(lng);
					marker.setLatLng(L.latLng(lat, lng));
			};
		};

			
		popupElement.getElementsByTagName('button')[0].addEventListener('click', updatePosition(), false);
			
		popupElement.getElementsByTagName('table')[0].addEventListener('keydown', updatePosition(), false);
		popupElement.getElementsByTagName('button')[1].addEventListener('click', function(e){
			removePoint(marker.options.shotpoint);
			map.removeLayer(marker);
		}, false);
		popupElement.getElementsByTagName('button')[2].addEventListener('click', function(e){
			marker.closePopup();
		}, false);
			
		marker.bindPopup(popupElement).openPopup();
		marker.getPopup().on('open', function(e){
			var elements = marker.getPopup().getContent().getElementsByTagName('input');
					elements[0].value = marker.name;
					elements[1].value = marker.getLatLng().lat;
					elements[2].value = marker.getLatLng().lng;
					elements = null;
		});

		addPoint(marker.options.shotpoint);
		isAdding = false;	
	};

	ko.applyBindings(viewModel);

}
