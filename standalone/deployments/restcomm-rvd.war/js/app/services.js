angular.module('Rvd')
.service('notifications', ['$rootScope', '$timeout', function($rootScope, $timeout) {
	var notifications = {data:[]};
	
	$rootScope.notifications = notifications;
	
	notifications.put = function (notif) {
		notifications.data.push(notif);
		
		$timeout(function () { 
			if (notifications.data.indexOf(notif) != -1)
				notifications.data.splice(notifications.data.indexOf(notif),1); 
		}, 3000);
	}
	
	notifications.remove = function (removedIndex) {
		notifications.data.splice(removedIndex, 1);
	}
	
	return notifications;
}]);

/*
angular.module('Rvd').service('projectModules', [function () {
	var serviceInstance = {moduleData: []};
	
	serviceInstance.addModule = function (module) {
		serviceInstance.moduleData.push({name:module.name, label:module.label});
	}
	
	serviceInstance.removeModule = function (module) {
		serviceInstance.moduleData.splice(serviceInstance.moduleData.indexOf(module),1);
	}
	
	serviceInstance.getModuleSummary = function () {
		return serviceInstance.moduleData;
	}
	
	serviceInstance.log = function () {
		for (var i = 0; i < serviceInstance.moduleData.length; i++) {
			console.log(serviceInstance.moduleData[i]);
		}
	}
	
	return serviceInstance;
}]);
*/

angular.module('Rvd').service('authentication', ['$http', '$cookies', '$q', function ($http, $cookies, $q) {
	//console.log("Creating authentication service");
	var serviceInstance = {};
	var authInfo = {};
	
	function refresh() {
		authInfo.rvdticket = undefined;
		authInfo.username = undefined;
		var matches = RegExp( "^([^:]+)\:(.*)$" ).exec( $cookies.get("rvdticket") );
		if (matches != null) {
			authInfo.rvdticket = matches[2];
			authInfo.username = matches[1];
		}
	}	
	
	function doLogin(username, password) {
		var deferred = $q.defer();
		$http({	url:'services/auth/login', method:'POST', data:{ username: username, password: password}})
		.success ( function () {
			console.log("login successful");
			deferred.resolve();
		})
		.error( function (data, status) {
			console.log("error logging in");
			deferred.reject(data);
		});
		return deferred.promise;
	}
	serviceInstance.doLogin = doLogin;
	
	function doLogout() {
		var deferred = $q.defer();
		$http({	url:'services/auth/logout', method:'GET'})
		.success ( function () {
			console.log("logged out");
			deferred.resolve();
		})
		.error( function (data, status) {
			console.log("error logging out");
			deferred.reject(data);
		});		
		return deferred.promise;
	}
	serviceInstance.doLogout = doLogout;
	
	serviceInstance.getAuthInfo = function () {
		return authInfo;
	}
	
	serviceInstance.clearTicket = function () {
		$cookies.remove("rvdticket");
		authInfo.rvdticket = undefined;
		authInfo.username = undefined;
	}
	
	serviceInstance.looksAuthenticated = function () {
		refresh();
		if ( !authInfo.rvdticket )
			return false;
		return true;
	}
	
	
	
	serviceInstance.authResolver = function() {
		var deferred = $q.defer();
		if ( !this.looksAuthenticated() ) {
			deferred.reject("AUTHENTICATION_ERROR");
		} else {
			deferred.resolve({status:"authenticated"});
		}
		return deferred.promise;
	}
	
	return serviceInstance;
	
	
}]);

angular.module('Rvd').service('projectSettingsService', ['$http','$q','$modal', '$resource', function ($http,$q,$modal,$resource) {
	//console.log("Creating projectSettigsService");
	var service = {};
	var cachedProjectSettings = {};
	
	// returns project settings from cache
	service.getProjectSettings = function () {
		return cachedProjectSettings;
	}
	
	// refreshes cachedProjectSettings asynchronously
	service.refresh = function (applicationSid) {
		var resource = $resource('services/projects/:applicationSid/settings');
		cachedProjectSettings = resource.get({applicationSid:applicationSid});
	}
	
	service.retrieve = function (applicationSid) {
		var deferred = $q.defer();
		$http({method:'GET', url:'services/projects/'+applicationSid+'/settings'})
		.success(function (data,status) {
			cachedProjectSettings = data;
			deferred.resolve(cachedProjectSettings);
		})
		.error(function (data,status) {
			if (status == 404) {
				cachedProjectSettings = {logging:false};
				deferred.resolve(cachedProjectSettings);
			}
			else
				deferred.reject("ERROR_RETRIEVING_PROJECT_SETTINGS");
		});
		return deferred.promise;
	}
	
	service.save = function (applicationSid, projectSettings) {
		var deferred = $q.defer();
		$http({method:'POST',url:'services/projects/'+applicationSid+'/settings',data:projectSettings})
		.success(function (data,status) {deferred.resolve()})
		.error(function (data,status) {deferred.reject('ERROR_SAVING_PROJECT_SETTINGS')});
		return deferred.promise;
	}
	
	function projectSettingsModelCtrl ($scope, projectSettings, projectSettingsService, applicationSid, projectName, $modalInstance, notifications) {
		//console.log("in projectSettingsModelCtrl");
		$scope.projectSettings = projectSettings;
		$scope.projectName = projectName;
		$scope.applicationSid = applicationSid;
		
		$scope.save = function (applicationSid, data) {
			//console.log("saving projectSettings for " + name);
			service.save(applicationSid, data).then(
				function () {$modalInstance.close()}, 
				function () {notifications.put("Error saving project settings")}
			);
		}
		$scope.cancel = function () {
			$modalInstance.close();
		}

		$scope.changeLoggingSetting = function () {
			if($scope.projectSettings.logging == false && $scope.projectSettings.loggingRCML == true){
				$scope.projectSettings.loggingRCML = false;
			}
		}
	}
	
	service.showModal = function(applicationSid, projectName) {
		var modalInstance = $modal.open({
			  templateUrl: 'templates/projectSettingsModal.html',
			  controller: projectSettingsModelCtrl,
			  size: 'lg',
			  resolve: {
				projectSettings: function () {
					var deferred = $q.defer()
					$http.get("services/projects/"+applicationSid+"/settings")
					.then(function (response) {
						deferred.resolve(response.data);
					}, function (response) {
						if ( response.status == 404 )
							deferred.resolve({});
						else {
							deferred.reject();
						}
					});
					return deferred.promise;
				},
				projectName: function () {return projectName;},
				applicationSid: function () {return applicationSid;}
			  }
			});

			modalInstance.result.then(function (projectSettings) {
				service.refresh(applicationSid);
				console.log(projectSettings);
			}, function () {});	
	}
	
	return service;
}]);


angular.module('Rvd').service('webTriggerService', ['$http','$q','$modal', function ($http,$q,$modal) {
	//console.log("Creating webTriggerService");
	var service = {};
	service.retrieve = function (applicationSid) {
		var deferred = $q.defer();
		$http({method:'GET', url:'services/projects/'+applicationSid+'/cc'})
		.success(function (data,status) {deferred.resolve(data)})
		.error(function (data,status) {
			if (status == 404)
				deferred.resolve({logging:false});
			else
				deferred.reject("ERROR_RETRIEVING_PROJECT_CC");
		});
		return deferred.promise;
	}
	
	service.save = function (applicationSid, ccInfo) {
		var deferred = $q.defer();
		$http({method:'POST',url:'services/projects/'+applicationSid+'/cc',data:ccInfo})
		.success(function (data,status) {deferred.resolve()})
		.error(function (data,status) {deferred.reject('ERROR_SAVING_PROJECT_CC')});
		return deferred.promise;
	}
	
	function webTriggerModalCtrl ($scope, ccInfo, applicationSid, rvdSettings, $modalInstance, notifications, $location) {
		console.log("in webTriggerModalCtrl");
		console.log(rvdSettings);
				
		$scope.save = function (applicationSid, data) {
			//console.log("saving ccInfo for " + name);
			service.save(applicationSid, data).then(
				function () {$modalInstance.close()}, 
				function () {notifications.put("Error saving project ccInfo")}
			);
		}
		$scope.cancel = function () {
			$modalInstance.close();
		}
		$scope.disableWebTrigger = function () { $scope.ccInfo = null; }
		$scope.enableWebTrigger = function () {
			if ($scope.ccInfo == null)
				$scope.ccInfo = createCcInfo();
		}	
		$scope.getWebTriggerUrl = function () {
			return $location.protocol() + "://" + $location.host() + ":" +  $location.port() + "/restcomm-rvd/services/apps/" +  applicationSid + '/start<span class="text-muted">?from=12345&amp;to=+1231231231&amp;token=mysecret</span>';
		};
		$scope.getRvdHost = function() {
			return $location.host();
		}
		$scope.getRvdPort = function() {
			return $location.port();
		}
			
		function createCcInfo() {
			return {lanes:[{startPoint:{to:"",from:""}}]};
		}
		function setWebTriggerStatus(webTriggerEnabled) {
			if ( webTriggerEnabled )
				$scope.enableWebTrigger();
			else
				$scope.disableWebTrigger();
		}
		$scope.setWebTriggerStatus = setWebTriggerStatus;
		
		if (ccInfo == null) {
			ccInfo = {};
			$scope.webTriggerEnabled = false;
		} else
			$scope.webTriggerEnabled = true;
		$scope.ccInfo = ccInfo;
		setWebTriggerStatus($scope.webTriggerEnabled);
			
		$scope.applicationSid = applicationSid;
		$scope.rvdSettings = rvdSettings;
	}
	
	service.showModal = function(applicationSid) {
		var modalInstance = $modal.open({
			  templateUrl: 'templates/webTriggerModal.html',
			  controller: webTriggerModalCtrl,
			  size: 'lg',
			  resolve: {
				ccInfo: function () {
					var deferred = $q.defer()
					$http.get("services/projects/"+applicationSid+"/cc")
					.then(function (response) {
						deferred.resolve(response.data);
					}, function (response) {
						if ( response.status == 404 )
							deferred.resolve(null);
						else {
							deferred.reject();
						}
					});
					return deferred.promise;
				},
				applicationSid: function () {return applicationSid;},
				rvdSettings: function (rvdSettings) {
					return rvdSettings.refresh();
				}
			  }
			});

			modalInstance.result.then(function (ccInfo) {
				console.log(ccInfo);
			}, function () {});	
	}
	
	return service;
}]);


angular.module('Rvd').service('projectLogService', ['$http','$q','$routeParams', 'notifications', function ($http,$q,$routeParams,notifications) {
	var service = {};
	service.retrieve = function () {
		var deferred = $q.defer();
		$http({method:'GET', url:'services/apps/'+$routeParams.applicationSid+'/log'})
		.success(function (data,status) {
			console.log('retrieved log data');
			deferred.resolve(data);
		})
		.error(function (data,status) {
			deferred.reject();
		});
		return deferred.promise;
	}
	service.reset = function () {
		var deferred = $q.defer();
		$http({method:'DELETE', url:'services/apps/'+$routeParams.applicationSid+'/log'})
		.success(function (data,status) {
			console.log('reset log data');
			notifications.put({type:'success',message:$routeParams.projectName+' log reset'});
			deferred.resolve();
		})
		.error(function (data,status) {
			//notifications.put({type:'danger',message:'Cannot reset '+$routeParams.projectName+' log'});
			deferred.reject();
		});
		return deferred.promise;		
	}
	
	return service;
}]); 

angular.module('Rvd').service('rvdSettings', ['$http', '$q', function ($http, $q) {
	var service = {data:{}};
	var defaultSettings = {appStoreDomain:"apps.restcomm.com"};
	var effectiveSettings = {};
	
	function updateEffectiveSettings (retrievedSettings) {
		angular.copy(defaultSettings,effectiveSettings);
		angular.extend(effectiveSettings,retrievedSettings);		
	}
	
	service.saveSettings = function (settings) {
		var deferred = $q.defer();
		$http.post("services/settings", settings, {headers: {'Content-Type': 'application/data'}}).success( function () {
			service.data = settings; // since this is a successfull save, update the internal settings data structure
			updateEffectiveSettings(settings);
			deferred.resolve();
		}).error(function () {
			dererred.reject();
		});
		return deferred.promise;
	}
	
	/* retrieves the settings from the server and updates stores them in an internal service object */
	service.refresh = function () {
		var deferred = $q.defer();
		$http.get("services/settings")
		.then(function (response) {
			service.data = response.data;
			updateEffectiveSettings(service.data);
			deferred.resolve(service.data);
		}, function (response) {
			if ( response.status == 404 ) {
				angular.copy(defaultSettings,effectiveSettings);
				service.data = {};
				deferred.resolve(service.data);
			}
			else {
				deferred.reject();
			}
		});
		return deferred.promise;		
	}
	
	service.getEffectiveSettings = function () {
		return effectiveSettings;
	}
	service.getDefaultSettings = function () {
		return defaultSettings;
	}
	
	return service;
}]);

angular.module('Rvd').service('variableRegistry', [function () {
	var service = {
		lastVariableId: 0,
		variables: []
	};
	
	service.newId = function () {
		service.lastVariableId ++;
		return service.lastVariableId;
	}
	
	service.addVariable = function (varInfo) {
		//console.log('adding variable' + varInfo.id)
		service.variables.push(varInfo);
	}
	
	service.removeVariable = function (varInfo) {
		//console.log('removing variable' + varInfo.id);
		service.variables.splice(service.variables.indexOf(varInfo), 1);
	}
	
	function registerVariable(name) {
		var newid = service.newId();
		service.addVariable({id:newid, name:name});
	}

	service.listUserDefined = function () {
		return variables;
	}
	service.listAll = function () {
		return service.variables;
	}	
	
	registerVariable("core_To");
	registerVariable("core_From");
	registerVariable("core_CallSid");
	registerVariable("core_AccountSid");
	registerVariable("core_CallStatus");
	registerVariable("core_ApiVersion");
	registerVariable("core_Direction");
	registerVariable("core_CallerName");
	// after collect, record, ussdcollect
	registerVariable("core_Digits");
	// after dial
	registerVariable("core_DialCallStatus");
	registerVariable("core_DialCallSid");
	registerVariable("core_DialCallDuration");
	registerVariable("core_DialRingDuration");
	registerVariable("core_RecordingUrl");
	// after record
	//registerVariable("core_RecordingUrl");
	registerVariable("core_RecordingDuration");
	// after dial or record
	registerVariable("core_PublicRecordingUrl");
	// after sms
	registerVariable("core_SmsSid");
	registerVariable("core_SmsStatus");
	// after fax
	registerVariable("core_FaxSid");
	registerVariable("core_FaxStatus");
	// SMS project
	registerVariable("core_Body");
	
	
	return service;
}]);

// An simple inter-service communications service
angular.module('Rvd').service('communications', [function () {
	// for each type of event create a new set of *Handlers array, a subscribe and a publish function
	var newNodeHandlers = [];
	var nodeRemovedHandlers = [];
	return {
		subscribeNewNodeEvent: function (handler) {
			newNodeHandlers.push(handler);
		},
		publishNewNodeEvent: function (data) {
			angular.forEach(newNodeHandlers, function (handler) {
				handler(data);
			});
		},
		subscribeNodeRemovedEvent: function (handler) {
			nodeRemovedHandlers.push(handler);
		},
		publishNodeRemovedEvent: function (data) {
			angular.forEach(nodeRemovedHandlers, function (handler) {
				handler(data);
			});
		}		
	}
}]);

angular.module('Rvd').service('editedNodes', ['communications', function (communications) {
	var service = {
		nodes: [],
		activeNodeIndex : -1 // no node is active (visible)
	}
	
	// makes a node edited. The node should already exist in the registry (this is not verified)
	function addEditedNode(nodeName) {
		// maybe check if the node exists
		if ( getNodeIndex(nodeName) == -1 ) {
			service.nodes.push({name:nodeName});
		} 
	}
	
	// a new node has been added to the registry
	function onNewNodeHandler(nodeName) {
		console.log("editedNodes: new node created: " + nodeName );
		addEditedNode(nodeName);
	}
	
	// Finds the node's index by name. Returns -1 if not found
	function getNodeIndex(nodeName) {
		for (var i=0; i<service.nodes.length; i++) {
			if ( service.nodes[i].name == nodeName ) {
				return i;
				break;
			}
		}
		return -1;
	}
	
	function setActiveNode(nodeName) {
		service.activeNodeIndex = getNodeIndex(nodeName);
	}
	
	function isNodeActive(nodeName) {
		var i = getNodeIndex(nodeName);
		if ( i != -1 && i == service.activeNodeIndex )
			return true;
		return false;
	}
	
	function getActiveNode(nodeName) {
		if ( service.activeNodeIndex != -1 )
			return service.nodes[service.activeNodeIndex].name;
		// else return undefined
	}
	
	
	// triggered when a node will be removed form the registry. We remove this editedNode and update actieNodeIndex accordingly
	function onNodeRemovedHandler(nodeName) {
		// if this is the active node, activate the next one
		var i = getNodeIndex(nodeName);

		if ( i != -1 ) {
			service.nodes.splice(i,1);
			
			if ( i < service.activeNodeIndex )
				service.activeNodeIndex --;
			if (i >= service.nodes.length)
				service.activeNodeIndex = service.nodes.length - 1; // this even works whan the last node is removed
		} else
			console.log("Error removing module " + nodeName +". It does not exist");

	}
	
	function getEditedNodes() {
		return service.nodes;
	}
	
	function clear() {
		service.nodes = [];
		service.activeNodeIndex = -1;
	}
		
	
	// event handlers
	communications.subscribeNewNodeEvent(onNewNodeHandler);
	communications.subscribeNodeRemovedEvent(onNodeRemovedHandler);
	
	// public interface
	service.setActiveNode = setActiveNode;
	service.getActiveNode = getActiveNode;
	service.addEditedNode = addEditedNode;
	service.getEditedNodes = getEditedNodes;
	service.isNodeActive = isNodeActive;
	service.clear = clear;
	service.removeEditedNode = onNodeRemovedHandler;
	
	return service;
}]);

angular.module('Rvd').service('nodeRegistry', ['communications', function (communications) {

	var service = {
		lastNodeId: 0,
		nodes: [],
		nodesByName : {}
	};
	
	function newName() {
		var id = ++service.lastNodeId;
		return "module" + id;
	}
	
	// Pushes a new node in the registry If it doesn't have an id it assigns one to it
	function addNode(node) {
		if (node.name) {
			// Node already has an id. Update lastNodeId if required
			//if (lastNodeId < node.id)
			//	lastNodeId = node.id;
			// it is dangerous to add a node with an id less that lastNodeId
			// else ...
		} else {
			var name = newName();
			node.setName(name);	
		}
		service.nodes.push(node);
		service.nodesByName[node.name] = node;
		
		//communications.publishNewNodeEvent(node.name);
	}
	function removeNode(nodeName) {
		var node = getNode(nodeName);
		if ( node ) {
			communications.publishNodeRemovedEvent(node.name);
			service.nodes.splice(service.nodes.indexOf(node), 1);
			delete service.nodesByName[node.name];
		} else
			console.log("Cannot remove node " + nodeName + ". Node does not exist");
	}
	function getNode(name) {
		return service.nodesByName[name];
		//for (var i=0; i < service.nodes.length; i ++) {
		//	if ( service.nodes[i].name == name )
		//		return service.nodes[i];
		//}
	}
	// dangerous! nodesByName object can be changed and trash service structure
	//function getNodesByName() {
	//	return service.nodesByName;
	//}
	function getNodes() {
		return service.nodes;
	}
	function reset(lastId) {
		if ( ! lastId )
			service.lastNodeId = 0;
		else
			service.lastNodeId = lastId;
	}
	function clear() {
		service.lastNodeId = 0;
		service.nodes = [];
		service.nodesByName = {};
	}
	
	// public interface
	service.addNode = addNode;
	service.removeNode = removeNode;
	service.getNode = getNode;
	service.getNodes = getNodes;
	service.reset = reset;
	service.clear = clear;
	
	return service;
}]);

angular.module('Rvd').factory('stepService', [function() {
	var stepService = {
		serviceName: 'stepService',
		lastStepId: 0,
			 
		newStepName: function () {
			return 'step' + (++this.lastStepId);
		}		 
	};
	
	return stepService;
}]);

