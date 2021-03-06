var audioContext = null;
var meter = null;
var canvasContext = null;
var WIDTH=100;
var HEIGHT=25;
var rafID = null;

var PreferredMode = 0;

var timer;
//var pluginVersion = "1.3.6.0005";
var pluginVersion = "1.3.14.0002";
var npApiPluginVersion = "1.3.14.0002";
//in-call variables to manage display modes, etc
var fullScreenShare = false;
var isSharing = false;
var sharesInCall = 0;
var currentShareId = -1;
var participantsInCall = 0;
var newShareURI;
var appWindowId = [];
var sysDesktopId = [];
var callState = "Idle";
// configuration of behavior for this code
var useConsoleForLogging = true;
var useAlertsForLogging = false;
var useCallbackForOutEvents = true;		// if false, use a JavaScript event instead of callback
var willStartOnLoad = true;			// if true, will invoke start() on plug-in object from bodyLoaded()
var useLoginEvent = true;

var soapProxy = "https://vidyoweb.apps.vidyo.com/sp/soap_proxy.php";
var url_portalAddress = 'http://test.epresence.grnet.gr';
var url_user;
var url_pass;
var url_portalUri;
var url_guestName;
var url_roomPin;
var url_encoded;
var joinType = "guest";

// Toggle Icon code
var img_camera_array= new Array('/vidyo_client_resources/images/camera_privacy.png','/vidyo_client_resources/images/camera.png');
var img_mic_array= new Array('/vidyo_client_resources/images/mic_mute.png','/vidyo_client_resources/images/mic.png');
var img_speaker_array= new Array('/vidyo_client_resources/images/speaker_mute.png','/vidyo_client_resources/images/speaker.png');
var count_camera=-1;
var count_mic=-1;
var count_speaker=-1;



//this is a callback from sending the request in updateShareList that will be used to update the share list dropdown
function updateShareDropDown(response){
    log("updateShareDropDown(): " + response);

    var transformedData = {
        windows: [],
        desktops: [],
        sharing: (currentShareId === -1) ? false : true
    };
    var i,
        name,
        mywindow,
        desktop;
    //windows and desktops are separated in the response
    //you may choose not to expose all windows and/or desktops based on the use case. The filtering would happen here.
    for (i = 0; i < response.numApplicationWindows; i++) {
        name = (response.appWindowAppName[i] && response.appWindowAppName[i].length) ? response.appWindowAppName[i] : response.appWindowName[i];
        mywindow = {
            id: response.appWindowId[i],
            name: name,
            highlight: (currentShareId === response.appWindowId[i]) ? true : false
        };
        transformedData.windows.push(mywindow);
    }
    sysDesktopId.length = 0;
    for (i = 0; i < response.numSystemDesktops; i++) {
        //Custom text for sharing full displays
        var desktopName = "Desktop ";
        desktopName = desktopName + (i+1).toString();
        desktop = {
            id: response.sysDesktopId[i],
            name: desktopName,
            highlight: (currentShareId === response.sysDesktopId[i]) ? true : false
        };
        transformedData.desktops.push(desktop);
        sysDesktopId.push(response.sysDesktopId[i]);
    }


    var options = $("#img_share_b");
    options.html('');

    //note that using an HTML dropdown list allows the dropdown to appear over the video window.
    //Javascript and other more complex UI may not always overlay plugin/video divs in some browsers.
    if (isSharing) {
        options.append($("<option/>").val(-1).text("Stop Sharing"));
    }

    $.each(transformedData.windows, function() {
        if (this.highlight){
            options.append($("<option selected/>").val(this.id).text(this.name));
        }else{
            options.append($("<option/>").val(this.id).text(this.name));
        }
    });
    $.each(transformedData.desktops, function() {
        if (this.highlight){
            options.append($("<option selected/>").val(this.id).text(this.name));
        }else{
            options.append($("<option/>").val(this.id).text(this.name));
        }
    });

}

function updateShareList() {
    log('updateShareList()');
    var request = {
        'type': "RequestGetWindowsAndDesktops"
    };
    vidyoClient.sendRequest(request, updateShareDropDown);
}

function shareChanged(shareId) {
    //keep track of what's newly shared to updated highlighting on share dropdown
    currentShareId = shareId;
    //shareId = -1 means stop sharing
    if (shareId == -1) {
        isSharing = false;
        log("sending unshare event");
        document.getElementById('sharebutton').innerHTML = '<img  id= "stopshare" height="20px" src="/vidyo_client_resources/images/share_icon.png">';

        sendUnshareEvent();
    } else {
        isSharing = true;
        log("sending share event with id " + shareId);
        document.getElementById('sharebutton').innerHTML = '<button id="img_camera_b"  class="myclass" title="Διακοπή διαμοιρασμού" style="float:right; height:25px; width:32px;" onclick="shareChanged(-1)"><img  id= "stopshare" height="20px" src="/vidyo_client_resources/images/stop_share.png"></button>';

        sendShareEvent(shareId);
    }
}

var sendShareEvent = function(shareId) {
    var shareType;
    var window = shareId;

    if (sysDesktopId.indexOf(shareId)!==-1){
        shareType = 'DesktopWindow';
        if (proxyWrapper.isChrome){
            window = sysDesktopId.indexOf(shareId);
        }
    }else{
        shareType = 'ApplicationWindow';
    }
    var inEvent = {
        'type': 'InEventShare',
        'window': window,
        'shareType': shareType
    };

    vidyoClient.sendEvent(inEvent);
}

var sendUnshareEvent = function() {
    var inEvent = {
        'type': 'InEventUnshare'
    };

    vidyoClient.sendEvent(inEvent);
}


/**
 * Get shares in Conference
 * @param  {callback} currApp ID of share to see
 * @return {Object} Currently available shares
 */
var clientSharesGet = function (callback) {
    var request = {};
    request.type = "RequestGetWindowShares";

    // public properties for created object,
    // initial values of which are potentially passed
    // into this factory function
    request.requestType ="";// params && params.requestType || "";
    request.remoteAppUri = [""];//params && params.remoteAppUri || [""];
    request.remoteAppName = [""];// params && params.remoteAppName || [""];
    request.numApp = 0;// params && params.numApp || 0;
    request.currApp = 0;// params && params.currApp || 0;
    request.eventUri = "";// params && params.eventUri || "";
    request.newApp =  0;//params && params.newApp || 0;

    vidyoClient.sendRequest(request, callback);
};

//using non-inline callback for setting a new remote share to display
displayNewShare = function(request) {
    var shares = request.numApp;
    //if there's a new share, display it
    if (newShareURI){
        for (i = 0; i < request.numApp; i++){
            if (request.remoteAppUri[i]==newShareURI){
                request.newApp = i+1;
                break;
            }
        }
        //otherwise (when shares are removed), display the last share added
    }else{
        request.newApp = request.numApp;
    }
    request.type = "RequestSetWindowShares";
    request.requestType = "ChangeSharingWindow";

    //FIX: add response callback to check for success
    vidyoClient.sendRequest(request);
}

/**
 * Select remote share to see
 * @param  none; always picks the newest share added or last share in the list
 * @return {Object} number of current shares
 */
clientSharesSetCurrent = function () {
    clientSharesGet(displayNewShare);
};


//This function toggles from display:block to display:none - DO NOT USE on Vidyo elements.
function toggleDisplay(div_id) {
    var el = document.getElementById(div_id);
    if ( el.style.display == 'none' ) {	el.style.display = 'block';}
    else {el.style.display = 'none';}
}


function getUrlVars() {
    var vars = {};
    var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
        vars[key] = value;
    });
    return vars;
}

function toggleCameraIcon()
{
    count_camera++;
    document.getElementById("img_camera").src=img_camera_array[count_camera];
    if(count_camera==0)
        sendMuteCameraEvent(true);
    else
        sendMuteCameraEvent(false);
    if(count_camera==img_camera_array.length-1) {
        count_camera=-1;
    }
}

function toggleMicIcon()
{
    count_mic++;
    document.getElementById("img_mic").src=img_mic_array[count_mic];
    if(count_mic==0)
        sendMuteMicEvent(true);
    else
        sendMuteMicEvent(false);
    if(count_mic==img_mic_array.length-1) {
        count_mic=-1;
    }
}

function toggleSpeakerIcon()
{
    count_speaker++;
    document.getElementById("img_speaker").src=img_speaker_array[count_speaker];
    if(count_speaker==0)
        sendMuteSpeakerEvent(true);
    else
        sendMuteSpeakerEvent(false);
    if(count_speaker==img_speaker_array.length-1) {
        count_speaker=-1;
    }
}

function timeStamp() {
    var now = new Date();
    var date = [ now.getMonth() + 1, now.getDate(), now.getFullYear() ];
    var time = [ now.getHours(), now.getMinutes(), now.getSeconds() ];
    var suffix = ( time[0] < 12 ) ? "AM" : "PM";
    time[0] = ( time[0] < 12 ) ? time[0] : time[0] - 12;
    time[0] = time[0] || 12;

    for ( var i = 1; i < 3; i++ ) {
        if ( time[i] < 10 ) {
            time[i] = "0" + time[i];
        }
    }

    // Return the formatted string
    return date.join("/") + " " + time.join(":") + " " + suffix;
}

var log = function (msg) {
    if (useConsoleForLogging) {
        console.log(timeStamp() + "  " + msg);
    }
    if (useAlertsForLogging) {
        alert(msg);
    }
};


//Our logic is to always adjust self-view depending on participants in call and if there is a share in the conference
//We have found this logic to provide optimal viewing.
var setPreviewModeonStatusChange = function(){
    if (fullScreenShare){
        setPreviewMode("None");
        console.log('Changed - Lay out - on Status changed');
    }else{
        if (participantsInCall == 2){
            if (sharesInCall>0){
                setPreviewMode("Dock");
                console.log('Changed - Lay out - on Status changed');
            }else{
                setPreviewMode("PIP");
                console.log('Changed - Lay out - on Status changed');
            }
        }else if (participantsInCall == 1){
            setPreviewMode("Dock");
            console.log('Changed - Lay out - on Status changed');
        }else{
            setPreviewMode("None");
            console.log('Changed - Lay out - on Status changed');
        }
    }
};

/**
 * Get Number of Participants
 */
clientGetNumParticipants = function (callback) {
    var request = {
        'type': "RequestGetNumParticipants",
        'numParticipants':0
    };


    vidyoClient.sendRequest(request, function(response){
        log("clientGetNumParticipants(): " + response);
        callback(response.numParticipants);
    });
};



// declarations for functions, wired to plugin events
var onOutEvent = function (event) {
    var log_mesg;
    event = event || {};
    var msg = "Received out event with type of " + event.type;

    log(msg);
    switch (event.type) {
        case 'OutEventPluginConnectionSuccess':
            waitingForConnection = false;
            //if( whichIE()>-1){
            //    console.log('IE detected waiting 1 second to request config');
            setTimeout(function () {
                updateConfiglist();
                its_ready();
                EnableAppSharing();
            }, 500);
            //}
            // else {
            //    updateConfiglist();
            //    its_ready();
            //}
            // Below code enables permissions checkbox on Chrome
            if (proxyWrapper.isChrome) {
                proxyWrapper.started = true;
                proxyWrapper.sendRequest({
                    type: 'RequestSetDomain',
                    'domain': url_portalAddress
                }, function (response) {
                    if (response.result !== 'ok') {
                        log.error('vidyo', 'error setting domain');
                    }
                });
            } else {
                vidyo.started = true;
            }
            //callback(true);
            break;
        case 'OutEventPluginConnectionFailure':
            //alert('received OutEventPluginConnectionFailure, aborting');
            waitingForConnection = false;
            if (!proxyWrapper.isChrome) {
                vidyoClient.stop();
            }
            alert('Multiple VidyoWeb browser tabs are not supported. ' + 'Please close this tab and use your original VidyoWeb instance.');

            //callback(false, 'Multiple VidyoWeb browser tabs are not supported. ' + 'Please close this tab and use your original VidyoWeb instance.');
            break;
        case 'OutEventPluginError':
            //alert('received OutEventPluginError, aborting');
            waitingForConnection = false;
            if (!proxyWrapper.isChrome) {
                vidyoClient.stop();
            }
            //callback(false, 'Error received trying to start VidyoClient ' + event.error);
            break;
        case 'OutEventReloaded':
            //alert('received OutEventReloaded, aborting');
            waitingForConnection = false;
            if (!proxyWrapper.isChrome) {
                vidyoClient.stop();
            }
            //callback(false, 'VidyoWeb is still logging out. please wait a few seconds before trying to join a conference.');
            break;
        case 'extensionMsgClientClosed':
            if (event.message === 'Native host has exited.') {
                log('VidyoClientForWeb stopped for some reason');
                console.log('*******************************************');
                console.log(event);
                console.log('*******************************************');
            }else if (event.message === 'Specified native messaging host not found.'){
                log('VidyoClientForWeb not Found or not installed');
            }
            break;
        case 'extensionMsgClientStarting':
//            document.getElementById("VidyoChromeInstall").className = 'videoWrapperNone';
//            document.getElementById("VidyoChromeInstall").style.display = 'none';
//            document.getElementById("VidyoSplash").className = 'videoWrapperFull';
//            document.getElementById("VidyoSplash").style.display = 'block';
            break;
//---------typical OUT EVENTS-------------
        case 'OutEventCallState':
            log_mesg = "********* Call State Changed to: " + event.callState + "**********";
            log(log_mesg);
            callState = event.callState;
            break;
        case 'OutEventSignedIn':
            //this is used if you intend to log in with credentials and join your own room ONLY.
            if (joinType == "user"){
                log("Joining Own Room...");
                sendStartMyMeetingEvent();
            }else{
                //add Soap logic for joining as guest
            }
            break;
        case 'OutEventSignIn':
            if (parseInt(event.activeEid, 10) === 0){
                var licenseEvent = {
                    'type': "InEventLicense"
                };
                vidyoClient.sendEvent(licenseEvent);
            }
            break;
        case 'OutEventLogicStarted':
            stop_loading();
            break;
        case 'OutEventConferenceActive':
            document.getElementById("VidyoSplash").className = 'videoWrapperSmall';
            toggleDisplay('VidyoSplash');
            //AUDIO METER SCRIPT HERE
            var url = window.location.href;
            var res = url.split("/");
            if (res[4] !== 'demo-room') {                  //DEMO ROOM AND IE DETECTION
                //$.post("/conferences/conferenceUserLogin", {id: res[4]});
                // $.post("/conferences/vidyoClientLockRoom", {conference_id: res[4], action: "lock"});
            }
            else if(res[4] == 'demo-room' && !whichIE()){
                canvasContext = document.getElementById( "meter" ).getContext("2d");
                // monkeypatch Web Audio
                window.AudioContext = window.AudioContext || window.webkitAudioContext;
                // grab an audio context
                audioContext = new AudioContext();
                // Attempt to get audio input
                try {
                    // monkeypatch getUserMedia
                    navigator.getUserMedia =
                        navigator.getUserMedia ||
                        navigator.webkitGetUserMedia ||
                        navigator.mediaDevices.getUserMedia;
                    // ask for an audio input
                    navigator.getUserMedia(
                        {
                            "audio": {
                                "mandatory": {
                                    "googEchoCancellation": "false",
                                    "googAutoGainControl": "false",
                                    "googNoiseSuppression": "false",
                                    "googHighpassFilter": "false"
                                },
                                "optional": []
                            },
                        }, gotStream, didntGetStream);
                } catch (e) {
                    console.log('getUserMedia threw exception :' + e);
                }
            }
            document.getElementById("VidyoArea").className = 'videoFull';
            document.getElementById("pluginHolder").className = 'videoFull';
            if (proxyWrapper.isChrome){
                document.getElementsByTagName("video")[0].style.width="100%";
                document.getElementsByTagName("video")[0].style.height="100%";
            }
            setPreferredMode(0);
            setPreviewMode("None");
            console.log('Changed - Lay out - on Conference active');
            //toggleDisplay('Buttons');
            togglehoverbuttons ();
            updateParticipantsList();
            setParticipantLimit(16);
            break;
        case 'OutEventConferenceEnded':
            setParticipantLimit(16);
            //Assume want to stop the plugin after conference is over. Change logic for registered user use
            if (joinType == "user"){
                if (!useLoginEvent)
                    sendSoapUserLogOut();
            }
            sendLeaveEvent();

            break;
        case 'OutEventJoinProgress':
            //this logic is used to advance the progress bar in the UI. Other out events
            //will indicate how many joinprogress steps there are, but here we assume 6 steps
            //(100/6 ~=16.6)
            var progressSoFar = $( "#progressbar" ).progressbar( "value" );
            progressSoFar+= 16.6;
            $( "#progressbar" ).progressbar({
                value: progressSoFar
            });

            log_mesg = "Join Progress " + progressSoFar;
            log(log_mesg);
            break;
        case 'OutEventAddShare':
            sharesInCall++;
            log_mesg = "Share added from URI: " + event.URI;
            log(log_mesg);
            newShareURI = event.URI;
            clientSharesSetCurrent();
            setPreviewModeonStatusChange();
            break;
        case 'OutEventRemoveShare':
            sharesInCall--;
            if (sharesInCall==0){
                fullScreenShare = false;
                setParticipantLimit(16);
            }
            setPreviewModeonStatusChange();
            break;
        case 'OutEventParticipantsChanged':
            participantsInCall = event.participantCount;
            setPreviewModeonStatusChange();
            updateParticipantsList();
            play_sound("#parts_changed");
            break;
        case 'PrivateOutEventGetJoinApproval':
            if (!event.joinStatus) {
                location.reload();
            }
            break;
        case 'OutEventEndpointStatus':
            //END POINT STATUS
            break;
        case 'PrivateOutEventVcsoapGuestLink':
            log("****** GuestID = " + event.guestID + "********");
            if(event.fault === 'ConferenceLocked'){
                alert('ERROR: '+event.fault);
            }
            window.location = "/conferences";
            break;
        //please add additional OutEvents as needed
        case 'OutEventGroupChat':
            msg = event.message;
            name = event.displayName;
            var dt = new Date();
            var hours = dt.getHours();
            var minutes = dt.getMinutes();
            var ampm = hours >= 12 ? 'pm' : 'am';
            hours = hours % 12;
            hours = hours ? hours : 12; // the hour '0' should be '12'
            minutes = minutes < 10 ? '0'+minutes : minutes;
            var  html =  document.getElementById('group_chat_t').innerHTML;
            html += '<br/><span style="color:blue">'+name+': </span><span style="color:#d3d3d3">('+hours + ":" + minutes +' '+ampm+')</span><br/>'+msg+'<br/>';
            document.getElementById('group_chat_t').innerHTML= html;
            var objDiv = document.getElementById("group_chat_t");
            objDiv.scrollTop = objDiv.scrollHeight;
            if($("#group_chat").css('display') === 'none' || $("#chat_side_bar").css('display') === 'none') {
                // play_sound("#new_message");
                animate_button("#img_chat");
            }



            break;

        case 'OutEventPrivateChat':

            var  msg = event.message;
            var  name = event.displayName;
            var dt = new Date();
            var hours = dt.getHours();
            var minutes = dt.getMinutes();
            var ampm = hours >= 12 ? 'pm' : 'am';
            hours = hours % 12;
            hours = hours ? hours : 12; // the hour '0' should be '12'
            minutes = minutes < 10 ? '0'+minutes : minutes;
            var request = {
                'type': "RequestGetParticipants"

            };
            vidyoClient.sendRequest(request, function(response){
                var reply = response.name;
                for (i = 0; i < reply.length; i++) {
                    if (reply[i] === name ) {


                        if($("#chat_side_bar").css('display') === 'none'){
                            animate_button("#img_chat");
                        }
                        var textid = "#text_area"+i;
                        var html2 = $(textid).html();
                        html2 += '<br/><span style="color:blue">'+name+': </span><span style="color:#d3d3d3">('+hours + ":" + minutes +' '+ampm+')</span><br/>'+msg+'<br/>';
                        $(textid).html(html2);


                        if( $("#chat_modal"+i).css('display') === 'block') {
                            var objDiv = document.getElementById('text_area'+i);
                            objDiv.scrollTop = objDiv.scrollHeight;

                        }

                        var id = "#par_spn"+i;
                        if($(id).html() !== null && $(id).html() !== ""){
                            var val = parseInt($(id).html());
                        }else{
                            val = 0;
                        }
                        val = val + 1;
                        if( $("#chat_modal"+i).css('display') === 'none' || $("#private_chat_modals").css('display') === 'none') {
                            $(id).html(val);
                            //  play_sound("#new_message");
                        }

                    }
                }
            });



        default:
            break;
    }
};

/**
 * Detects if plugin is installed or not
 *
 * @return {Boolean} Application object
 */
function didntGetStream() {
    console.log('Stream generation failed.');
}

var mediaStreamSource = null;

function gotStream(stream) {
    console.log('** GOT STREAM **');
    // Create an AudioNode from the stream.
    mediaStreamSource = audioContext.createMediaStreamSource(stream);

    // Create a new volume meter and connect it.
    meter = createAudioMeter(audioContext);
    mediaStreamSource.connect(meter);

    // kick off the visual updating
    drawLoop();
}
function drawLoop( time ) {
    // clear the background
    canvasContext.clearRect(0,0,WIDTH,HEIGHT);

    // check if we're currently clipping
    if (meter.checkClipping())
        canvasContext.fillStyle = "red";
    else
        canvasContext.fillStyle = "green";

    // draw a bar based on the current volume
    canvasContext.fillRect(0, 0, meter.volume*WIDTH*1.4, HEIGHT);

    // set up the next visual callback
    rafID = window.requestAnimationFrame( drawLoop );
}
vidyoPluginIsInstalled = function() {
    var isFound = false;
//    log('vidyoPluginIsInstalled()');
    navigator.plugins.refresh(false);
    var pluginMimeType = "application/x-vidyoweb-";
    pluginMimeType+= pluginVersion;
    var pluginActiveXType = "VidyoInc.VidyoWeb_";
    pluginActiveXType+= pluginVersion;

    /* Try NPAPI approach */
    /*jslint unparam: true*/
    $.each(navigator.mimeTypes, function (i, val) {
        if (val.type === pluginMimeType) {
            /* Reload page when plugin is detected */
            log('vidyoPluginIsInstalled() -- NPAPI plugin found');
            isFound = true;
            return true;
        }
    });
    /*jslint unparam: false*/

    /* Try IE approach (add object to DOM)*/
    var pluginAdded = addPluginToDom();
    if (pluginAdded) {
        log('vidyoPluginIsInstalled() -- Plugin added to DOM');
        isFound = true;
    }

    return isFound;
};

var setParticipantLimit = function(count){
    if (count>8 || count<0)
        count = 16;
    var inEvent = {
        'type': "InEventParticipantsLimit",
        'maxNumParticipants': count
    };
    vidyoClient.sendEvent(inEvent);

}

var onDoubleClickChrome = function(){
    if (sharesInCall>0){
        if (fullScreenShare){
            setParticipantLimit(16);
            fullScreenShare=false;
        }else{
            setParticipantLimit(0);
            fullScreenShare=true;
        }
        setPreviewModeonStatusChange();

    }
}

var startChromeVideo = function() {
    var retval = false;
    var holder = document.getElementById('pluginHolder');
    //holder.innerHTML = '<video autoplay style="width:1px; height: 1px; background: black;"></video>' + '<label id="lbl_usermedia" style="position: relative; color: #ddd; top: -50%; margin-left: 20px; font-size: 20px; font-family: arial;">' + 'Make sure to allow the browser to use your camera.</label>';
    holder.innerHTML = '<video autoplay style="width:100%; height: 100%; background: black;" ondblclick="onDoubleClickChrome()"></video>';

    var usermediaMessage = document.getElementById('lbl_usermedia');
    var video = holder.childNodes[0];
    proxyWrapper.useVideoElem(video, function(message, permissionDeniedError) {
        //usermediaMessage.innerHTML = message + "<br>Please reload the page and try again";
        usermediaMessage.innerHTML = message;
        if (!permissionDeniedError && !message) {
            //$scope.joinConference();
            retval = true;
        } else if (permissionDeniedError) {
            styledAlert('VidyoWeb needs access to your camera in order to join a conference.' + 'If you change your mind, click the camera icon in your url bar and allow the browser to use your devices');
        } else {
            styledAlert('VidyoWeb could not start your camera. Please reload the page and try again.');
        }
    });
    return retval;
}

var successFunction = function() {
//    $scope.isOnExtensionDownloadPage = true;
//    showInstallStep('install_extension_inline');
};

//oops, could not directly install, just pop-up the extension webstore
var errorFunction = function(e) {
    openChromeWebStore();
};

openChromeWebStore = function() {
    window.open('https://chrome.google.com/webstore/detail/mmedphfiemffkinodeemalghecnicmnh', '', 'width=1000, height=300');
};
//Install directly. Will only work on Google verified sites connected to the VidyoWeb extension.
installExtension = function() {
    chrome.webstore.install('https://chrome.google.com/webstore/detail/mmedphfiemffkinodeemalghecnicmnh', successFunction, errorFunction);
};


detectCameraStatusAndContinue = function() {
    vidyoClient.sendRequest({type: 'RequestGetCameraStatus'}, function(cameraReady) {
            if (cameraReady.status) {
                startChromeVideo();
            } else {
                //loop until camera detected
                setTimeout(detectCameraStatusAndContinue, 2000);
            }
        }
    );
}

var chromePluginInstallPrompted = false;
detectVidyoClientForWebAndContinue = function() {
    var checkVersion = proxyWrapper.supportedVersions[0];
    proxyWrapper.sendEvent({
        type: 'RequestConnectVersion',
        version: checkVersion
    }, function (connectRes) {
        log("proxyWrapper.sendEvent(RequestConnectVersion): " +  connectRes);
        if (connectRes.result) {
            proxyWrapper.isSupportedVersion(function (supported, version) {
                log("proxyWrapper.isSupportedVersion: supported:" + supported + ", version:" + version);
                if (supported) {
                    if (chromePluginInstallPrompted){
                        location.reload();
                    }
                    document.getElementById("VidyoSplash").className = 'videoWrapperFull';
                    document.getElementById("VidyoSplash").style.display = 'block';
                    document.getElementById("VidyoChromeInstall").className = 'videoWrapperNone';
                    document.getElementById("VidyoChromeInstall").style.display = 'none';


                    proxyWrapper.start(function (startRes) {
                        log("proxyWrapper.start: " + startRes);
                        detectCameraStatusAndContinue();
                    });
                } else {
                    chromePluginInstallPrompted = true;
                    stop_loading();
                    log('version not supported, need to install VidyoClientforWeb');
                    document.getElementById("VidyoSplash").className = 'videoWrapperNone';
                    document.getElementById("VidyoSplash").style.display = 'none';
                    document.getElementById("VidyoChromeInstall").className = 'mypanel';
                    document.getElementById("VidyoChromeInstall").style.display = 'block';
                    log("Will check version again after short delay");
                    setTimeout(detectVidyoClientForWebAndContinue, 4000);
                }
            });
        } else {
            log('no version sent');
            setTimeout(detectVidyoClientForWebAndContinue, 2000)
        }
    });
}

var didCheckExtension = false;
detectExtensionAndContinue = function() {

    var userAgent = navigator.userAgent || navigator.vendor || window.opera;


    if( userAgent.match( /Edge/i ) || userAgent.match( /OPR/i ))
    {
        stop_loading();
        document.getElementById("ExtensionInstall").style.display = 'none';
        $("#whole").hide();
        $("#not_supported").show();
        console.log('NOT SUPPORTED');
        return false;
    }

    proxyWrapper.detectExtension('mmedphfiemffkinodeemalghecnicmnh', function (result) {
        log("proxyWrapper.detectExtension result:" + result);
        extensionInstalled = result;
        if (extensionInstalled && !didCheckExtension) {
            proxyWrapper.connect();
            proxyWrapper.setOutEventDispatchMethod(onOutEvent);
            detectVidyoClientForWebAndContinue();
        } else if (extensionInstalled && didCheckExtension) {
            log('Page should reload in order to utilize the extension');
            document.getElementById("VidyoSplash").className = 'videoWrapperFull';
            document.getElementById("VidyoSplash").style.display = 'block';
            document.getElementById("ExtensionInstall").className = 'videoWrapperNone';
            document.getElementById("ExtensionInstall").style.display = 'none';
            location.reload();

        } else {
            log("No Extension detected, need to install Extension");
            //prompt user to install Extension
            stop_loading();
            document.getElementById("VidyoSplash").className = 'videoWrapperNone';
            document.getElementById("VidyoSplash").style.display = 'none';
            document.getElementById("ExtensionInstall").className = 'mypanel';
            document.getElementById("ExtensionInstall").style.display = 'block';
            log("Will check extension again after short delay");
            setTimeout(detectExtensionAndContinue, 2000);
        }
        didCheckExtension = true;
    });
}

var startChromePlugin = function() {

    vidyoClient.setProxy(proxyWrapper);
    if (!proxyWrapper.started) {
        detectExtensionAndContinue();
    }else{
        startChromeVideo();
    }
    return true;
};

// declarations for functions, wired to lifecycle events
var pluginCheck = function () {

    //if(navigator.userAgent.toLowerCase().indexOf('firefox') > -1){
    //    stop_loading();
    //    document.getElementById("ExtensionInstall").style.display = 'none';
    //    $("#whole").hide();
    //    $("#not_supported").show();
    //    console.log('NOT SUPPORTED');
    //    return false;
    //}
    var pluginPresent = false;
    var isChrome = proxyWrapper.isChrome;

    if (!isChrome) {
        pluginPresent = vidyoPluginIsInstalled();
    }

    if (isChrome || pluginPresent){
        document.getElementById("VidyoSplash").className = 'videoWrapperFull';
        document.getElementById("VidyoSplash").style.display = 'block';
        document.getElementById("VidyoInstall").className = 'videoWrapperNone';
        document.getElementById("VidyoInstall").style.display = 'none';
        if (isChrome){
            log("Chrome detected! Loading nonNPAPI Extension and Plugin");
            startChromePlugin();
        }else{
            log("non-Chrome detected! Loading NPAPI Plugin");

            //if(navigator.userAgent.toLowerCase().indexOf('firefox') > -1){
            //    stop_loading();
            //    document.getElementById("ExtensionInstall").style.display = 'none';
            //    $("#whole").hide();
            //    $("#not_supported").show();
            //    console.log('NOT SUPPORTED');
            //    return false;
            //}
            //else{
                startPlugin();
            //}


        }
    } else { // not Chrome and NPAPI plugin not installed
        log("NPAPI Plugin Not Installed!");
        stop_loading();
        document.getElementById("VidyoSplash").className = 'videoWrapperNone';
        document.getElementById("VidyoSplash").style.display = 'none';
        document.getElementById("VidyoInstall").className = 'mypanel';
        document.getElementById("VidyoInstall").style.display = 'block';
        timer = setTimeout(function(){pluginCheck()}, 3000);
    }
};

var sendSoapUserLinkEndpoint = function(endpointID){
    var body = {
        EID: endpointID
    };

    return sendSoapUserRequest("linkEndpoint",body, url_portalAddress, url_user, url_pass);
}

var sendSoapUserLogin = function () {
    return sendSoapUserRequest("logIn","", url_portalAddress, url_user, url_pass);
}

var sendSoapUserLogOut = function () {
    return sendSoapUserRequest("logOut","", url_portalAddress, url_user, url_pass);
}

var getPortalVersion = function () {
    return sendSoapUserRequest("getPortalVersion","", url_portalAddress, url_user, url_pass);
}

/**
 * Sends a Web Service User API request to the portal using SOAP proxy.
 * Can replace SOAP interface here.
 * @param  {String} action SOAP action
 * @param  {Object} body   Body of the SOAP request
 * @return {Object}        Promise to resolve the request and Object.request will have jQuery Ajax request that can be canceled
 */
var sendSoapUserRequest = function (action, body, portalAddr, username, password) {
    //logger.log('info', 'soap', 'sendSoapUserRequest(', (action || ""), (body || ""), ')');
    if (!url_portalAddress){
        return;
    }

    try {
        return soapClient.request({
            ajaxDataType: 'jsonp',
            proxyUrl: soapProxy,
            soapAction: action,
            soapServerUrl: portalAddr,
            soapServiceUsername: username,
            soapServicePassword: password,
            soapServicePath: "/services/v1_1/VidyoPortalUserService?wsdl",
            soapBody: (body || "")
        });

    } catch (e) {
        var mesg = "Failed to send Soap request(" + action + "): " + e;
        log(mesg);
        return "";
    }
};


var beforeUnload = function () {
    setParticipantLimit(16);
    if (callState != "InConference"){
        var inEvent = {
            'type': "InEventCancel"
        };
        vidyoClient.sendEvent(inEvent);
    }
    //return 'Please press the Logout button to logout.';
}

var isSecure = function()
{
    return window.location.protocol == 'https:';
}

var bodyLoaded = function () {
    var str = document.location.href;
    var res = str.split("?");
    //prevent right-clicking on video div containing Vidyo on Chrome
    //document.oncontextmenu = function() { return false; };
    // parseUrlArgs();
    if (!isSecure()){
        //var mainURL = res[0].substring(7);
        //document.getElementById("maingURL").innerHTML = mainURL;
        //document.getElementById("mainuURL").innerHTML = mainURL;
        stop_loading();
        document.getElementById("VidyoSplash").style.display = 'none';
        document.getElementById("usage").className = 'mypanel';
        document.getElementById("usage").style.display = 'block';
    }else{
        //  var mainURL = res[0].substring(8);
        //  document.getElementById("maingURL").innerHTML = mainURL;
        // document.getElementById("mainuURL").innerHTML = mainURL;

        //load scripts first
        //vidyo.client2.js is the non-requirejs version of vidyo.client.js.
        //Feel free to use angular, requirejs, etc as desired for ease of loading or to fit the current architecture
        var scripts = ['/vidyo_client_resources/scripts/vidyo/proxywrapper.js', '/vidyo_client_resources/scripts/vidyo/vidyo.client2.js', '/vidyo_client_resources/scripts/vidyo/soap-proxy.js','/vidyo_client_resources/scripts/myfunctions.js'];
        console.log('scripts_loaded');
        $.getScript(scripts[0], function() {
            $.getScript(scripts[1], function() {
                $.getScript(scripts[2], function() {
                    $.getScript(scripts[3], function() {
                        pluginCheck();
                    });

                });
            });
        });
    }
};

var whichIE = function() {
    var undef,
        rv = -1,
    // Return value assumes failure.
        ua = window.navigator.userAgent,
        msie = ua.indexOf('MSIE '),
        trident = ua.indexOf('Trident/'),
        rvNum;
    log("userAgent: " + ua);
    if (msie > 0) {
        // IE 10 or older => return version number
        rv = parseInt(ua.substring(msie + 5, ua.indexOf('.', msie)),
            10);
    } else if (trident > 0) {
        // IE 11 (or newer) => return version number
        rvNum = ua.indexOf('rv:');
        rv = parseInt(ua.substring(rvNum + 3, ua.indexOf('.', rvNum)),
            10);
    }
    return ((rv > -1) ? rv : undef);
};

var addPluginToDom = function() {
    //don't add if already added
    var pluginHTML = document.getElementById('plugin');
    if (!pluginHTML) {
        log("Attempting to add plugin to the DOM...");

        var pluginMimeType = "application/x-vidyoweb-";
        pluginMimeType+= pluginVersion;

        pluginHTML = document.createElement('object');
        pluginHTML.className = 'plugin';
        pluginHTML.id = 'plugin';
        pluginHTML.width = "100%";
        pluginHTML.height = "100%";

        var ie_version = whichIE();
        var holder = document.getElementById('pluginHolder');
        if (ie_version && ie_version < 11){
            holder.appendChild(pluginHTML);
        }
        try {
            pluginHTML.type = pluginMimeType;
        } catch (e) {
            var mesg = "Unable to Instantiate VidyoWeb: " + pluginMimeType + "; Error:" + e;
            log(mesg);
            if (ie_version && ie_version < 11){
                holder.removeChild(pluginHTML);
            }
            return false;
        }
        if (!pluginHTML.parentNode) {
            holder.appendChild(pluginHTML);
        }
        if (!pluginHTML.start) {
            holder.removeChild(pluginHTML);
            return false;
        }
    }
    return true;
};
// declarations for functions, wired to clicking of page hyperlinks
var startPlugin = function ()	{
    if(addPluginToDom()){
        var pluginHTML = document.getElementById('plugin');
        var config = {
            plugin: pluginHTML,
            outEventCallbackObject: this,
            defaultOutEventCallbackMethod: "onOutEvent",
            useCallbackWithPlugin: useCallbackForOutEvents
        };
        if (vidyoClient.start(config)) {
            log("VidyoWeb started successfully");
            console.log('stoped_loading');
        } else {
            log("VidyoWeb did not start successfully!");
            stop_loading();
        }
    }else{
        log("VidyoWeb did not start successfully!");
        stop_loading();
        document.getElementById("VidyoSplash").style.display = 'none';
        $("#plgPermission").show();
    }
};
var setPreferredMode = function(preferred){
    var inEvent = {
        'type': "InEventLayout"
    };
    inEvent.numPreferred = preferred;
    vidyoClient.sendEvent(inEvent);
};

var setPreviewMode = function(previewMode){
    console.log('changed to'+previewMode);
    var inEvent = {
        'type': "EventPreview"
    };
    inEvent.previewMode = previewMode;
    vidyoClient.sendEvent(inEvent);
};

var parseUrlArgs = function () {
    url_portalAddress = getUrlVars()["portalAddress"];
    url_user          = getUrlVars()["username"];
    url_pass          = getUrlVars()["password"];
    url_portalUri     = getUrlVars()["portalUri"];
    url_guestName     = getUrlVars()["guestName"];
    url_roomPin       = getUrlVars()["roomPin"];
    url_encoded       = getUrlVars()["encoded"];
    url_useSignIn     = getUrlVars()["useSignIn"];
}

var sendLoginEvent = function () {
    if (url_useSignIn){
        useLoginEvent = false;
    }
    if (url_portalUri){
        sendGuestLogin();
        joinType = "guest";
        beginProgressBar();
    } else if (url_portalAddress){
        sendUserLogin();
        joinType = "user";
        beginProgressBar();
    }else{
        document.getElementById("VidyoSplash").style.display = 'none';
        document.getElementById("usage").className = 'videoWrapperFull';
        document.getElementById("usage").style.display = 'block';
    }

}

var sendUserLogin = function () {
    if (!url_portalAddress || !url_user || !url_pass){
        return 0;
    }
    if (useLoginEvent){
        var inEvent = {
            'type': "InEventLogin",
            'portalUri': url_portalAddress,
            'userName': url_user,
            'userPass': url_pass
        };
        vidyoClient.sendEvent(inEvent);
    }else{
        sendSoapUserLogin()
            .done(function (response) {
                if (response) {
                    var mesg = "Login Response: " + response;
                    log(mesg);
                    vidyoClient.sendRequest({type: 'RequestGetEID'}, function(response) {
                            if (response.EID) {
                                sendSoapUserLinkEndpoint(response.EID);
                            }
                        }
                    );
                    //"BGHT4Z2VTJUJ7HTRCNHQS4YSQXZZZBSFZR2J5HPHYE97400VM0001@sandboxga.vidyo.com:17992;transport=TCP"
                    var vmsplit = response.vmaddress.split("@");
                    var vmIdentity = vmsplit[0];
                    var serverplit = vmsplit[1].split(":");
                    var serverAddress = serverplit[0];
                    var secured = response.vmaddress.indexOf("TLS");
                    var proxyAddress = "";
                    if (response.proxyaddress)
                        proxyAddress = response.proxyaddress.substring(0,response.proxyaddress.length-4);
                    if (secured > 0)
                        secured = true;
                    else
                        secured = false;

                    var SignInEvent = {
                        'type': "InEventSignIn",
                        'serverAddress': serverAddress,
                        'serverPort': "17992",
                        'userName': url_user,
                        'portalAccessKey': response.pak,
                        'portalAddress': url_portalAddress + "/services/",
                        'portalVersion': "",
                        'vmIdentity': vmIdentity,
                        'locationTag': response.loctag,
                        'vidyoProxyAddress': [proxyAddress],
                        'vidyoProxyPort': ["443"],
                        'emcpSecured': secured,
                        'guestLogin': false,
                        'showDialpad': true,
                        'showStartmeeting': true
                    };
                    vidyoClient.sendEvent(SignInEvent);
                }
            })
            .fail(function () {
                log("Failed");
            });
    }
};

var sendGuestLogin = function () {
    if (!url_portalUri){
        return 0;
    }
    var encoded;
    if (!url_encoded || (parseInt(url_encoded,10)==0)){
        encoded = 0;
    }else{
        encoded = 1;
    }
    var portalAddress;
    var portalRes;
    var roomKey;
    if (encoded){
        var temp = decodeURIComponent(url_portalUri);
        portalRes = temp.split("\/flex.html\?roomdirect.html&key=");
        portalAddress = portalRes[0];
        roomKey = portalRes[1];
    }else{
        portalRes = url_portalUri.split("\/flex.html\?roomdirect.html");
        portalAddress = portalRes[0];
        var roomKey = getUrlVars()["key"];
    }
    if (!url_guestName){
        url_guestName = "Guest";
    }
    //replace ALL occurrences of "+" in Guest name (in case of multiple spaces
    url_guestName = url_guestName.replace(/\+/g," ");

    var inEvent = {
        'type': "PrivateInEventVcsoapGuestLink",
        'typeRequest': "GuestLink",
        'requestId': 1234,
        'portalUri': portalAddress,
        'roomKey'  : roomKey,
        'guestName': url_guestName,
        'loginType': "guest"
    };

    if (url_roomPin){
        inEvent.pin = roomPin;
    }
    vidyoClient.sendEvent(inEvent);
};

var beginProgressBar = function() {
    $( "#progressbar" ).progressbar({
        value: 16.6
    });
}

var sendStartMyMeetingEvent = function () {
    var inEvent = {
        'type': "PrivateInEventStartMyMeeting"
    };
    vidyoClient.sendEvent(inEvent);
};

var unloadVidyo = function() {
    var obj = document.getElementById("pluginHolder");
    obj.removeChild(obj.childNodes[0]);
    delete obj;
}

var sendLeaveEvent = function () {
    var inEvent = {
        'type': "InEventLeave"
    };
    // Make sure you reduce the size of the VidyoWeb Plugin renderer now,
    // otherwise you will see video artifacts
    document.getElementById("pluginHolder").style.width="1px";
    document.getElementById("pluginHolder").style.height="1px";
    //document.getElementById("pluginHolder").style.display = 'none';
    document.getElementById("VidyoSplash").className = 'videoWrapperFull';
    toggleDisplay('VidyoSplash');
    toggleDisplay('js-progressbar-container');
    //toggleDisplay('Buttons');
    document.getElementById("VidyoArea").className = 'videoWrapperSmall';
    document.getElementById("pluginHolder").className = 'videoWrapperSmall';
    $("#hover_buttons").css('visibility','hidden');
    $("#whole").css('visibility','hidden');
    $("#chat_side_bar").hide();
    $("#options_menu").hide();
    $("#goodbye").show();
    vidyoClient.sendEvent(inEvent);
    clearInterval(call_timer);
    onleaving();
    //setTimeout(close_Tab,5000);
    //});
    //unloadVidyo();
};

var sendMuteCameraEvent = function (bMute) {
    var inEvent = {
        'type': "InEventMuteVideo",
        'willMute': true
    };
    inEvent.willMute = bMute;
    vidyoClient.sendEvent(inEvent);
};

var sendMuteMicEvent = function (bMute) {
    var inEvent = {
        'type': "InEventMuteAudioIn",
        'willMute': true
    };
    inEvent.willMute = bMute;

    vidyoClient.sendEvent(inEvent);
};

var sendMuteSpeakerEvent = function (bMute) {
    var inEvent = {
        'type': "InEventMuteAudioOut",
        'willMute': true
    };
    inEvent.willMute = bMute;

    vidyoClient.sendEvent(inEvent);
};

// end hiding script from old browsers -->
