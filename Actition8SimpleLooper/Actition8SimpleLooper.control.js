loadAPI(10);

host.setShouldFailOnDeprecatedUse(true);
host.defineController("Actition", "ActitionUSB8SimpleLooper", "0.1", "24515550-6c6a-4fca-bbc1-3fc29f9a3630", "Brent Tubbs");
host.defineMidiPorts(1, 1);

var global = this;

if (host.platformIsWindows())   {
    host.addDeviceNameBasedDiscoveryPair(["ActitioN MIDI Controller"], ["ActitioN MIDI Controller"]);
} else if (host.platformIsMac()) {
    // TODO: Double check these device names in MacOS.
    host.addDeviceNameBasedDiscoveryPair(["ActitioN MIDI Controller"], ["ActitioN MIDI Controller"]);   
} else if (host.platformIsLinux()) {
    // TODO: Double check these device names in Linux.
    host.addDeviceNameBasedDiscoveryPair(["ActitioN MIDI Controller"], ["ActitioN MIDI Controller"]);   
}

// button 1 on the Actition 8 button controller outputs a CC message of 96, or 0x60 in hex.
const PLAY_MIN = 0x60;
const PLAY_MAX = 0x63;
const STOP_MIN = 0x64;
const STOP_MAX = 0x67;
   
var sceneBank;
//var slotBank;
var cursorTrack;
var tracks = [];
var trackStates = [];

const playbackStates = {
    RECORDING: "recording",
    RECORDING_QUEUED: "queued for recording",
    PLAYING: "playing",
    PLAYING_QUEUED: "queued for playback",
    STOPPED:"stopped",
    STOP_QUEUED:"queued for stop"
};

// construct a LooperTrack object and set up callbacks for that track.
const LooperTrack = (trackIdx, bwTrack) => {
    const slotBank = bwTrack.clipLauncherSlotBank();

    // these variables will store the state, and get updated from the callback closures below.
    let playbackState = undefined;
    let hasContent = false;
    
    const onPlaybackState = function(idx, stateNum, queued) {
        if (stateNum == 0) {
            state = queued ? playbackStates.STOP_QUEUED : playbackStates.STOPPED;
        } else if (stateNum == 1) {
            state = queued ? playbackStates.PLAYING_QUEUED : playbackStates.PLAYING;
        } else if (stateNum == 2) {
            state = queued ? playbackStates.RECORDING_QUEUED : playbackStates.RECORDING;
        }
        playbackState = state;    
        println("track " + trackIdx + " " + state);    
    }    
    slotBank.addPlaybackStateObserver(onPlaybackState);

    const onHasContent = function(idx, hasContent) {
        hasContent = hasContent;
        println("track " + trackIdx + " hasContent: " + hasContent);
    }
    slotBank.addHasContentObserver(onHasContent);

    const looperTrack = {};
    
    looperTrack.onPlayButton = function() {
        println("playButton " + playbackState);
        switch (playbackState) {
            case playbackStates.STOPPED:
                slotBank.launch(0);
                break;
            case playbackStates.STOP_QUEUED:
                slotBank.launch(0);
                break;
            case playbackStates.RECORDING:
                // stop recording, queue play
                slotBank.launch(0); 
                break;
            case playbackStates.RECORDING_QUEUED:
                // do nothing?  yeah
                break;
            case playbackStates.PLAYING:
                // not sure
                break;
            case playbackStates.PLAYING_QUEUED:
                // not sure
                break;
            case undefined:
                // if we have content, then assume it's stopped.
                // if we have no content, then record.
                // launching the slotbank will accomplish both.
                println("launching!"); 
                if (hasContent) {
                    slotBank.launch(0);
                } else {
                    bwTrack.recordNewLauncherClip(0);
                }
        }
    }

    looperTrack.onStopButton = function() {
        println("stopButton " + playbackState);
        switch (playbackState) {
            case playbackStates.PLAYING:
                slotBank.stop();
                break;
            case playbackStates.RECORDING:
                slotBank.stop();
                break;                
            case playbackStates.PLAYING_QUEUED:
                slotBank.stop();
                break;        
            case playbackStates.STOPPED:
                slotBank.getItemAt(0).deleteObject();
                break;
            case playbackStates.STOP_QUEUED:
                slotBank.getItemAt(0).deleteObject();
                break;                
            case undefined:
                if (hasContent) {
                    slotBank.getItemAt(0).deleteObject();
                } else {
                    println("no content");
                }                  
                break;
        }
    }    
    return looperTrack;
  }

function init() {   
    host.getMidiInPort(0).setMidiCallback(onMidi);
    //cursorTrack = host.createCursorTrack("ActitioNLooper", "ActitioNLooper", 0, 4, true);
    const trackBank = host.createMainTrackBank(4, 0, 1);

    for (i=0; i < 4; i++) {
        let bwTrack = trackBank.getItemAt(i);
        const looperTrack = LooperTrack(i, bwTrack);
        tracks.push(looperTrack);
    }

    println("Actition8 initialized!");    
}

function onMidi(status, button, lvl) {
    // only process the down press, not the release.
    if (!lvl) {
        return;
    }

    // select the track
    const trackIdx = (button - PLAY_MIN) % 4;

    // play button or stop button?
    const action = button >= PLAY_MIN && button <= PLAY_MAX ? "play" : "stop";
    const looperTrack = tracks[trackIdx];

    if (action == "play") {
        looperTrack.onPlayButton();
    } else if (action == "stop") {
        looperTrack.onStopButton();
    }
}
